import "dotenv/config";
import { randomUUID } from "node:crypto";
import { IfrcService } from "./modules/ifrc/ifrc.service.js";
import { detect } from "./detect.js";
import { computeSeverity } from "./severity.js";
import { explain } from "./explain.js";
import type { WorldState, GapSeverity, VigilSurgeEvent } from "./types.js";

const HEC_URL = process.env.SPLUNK_HEC_URL;
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;

function eventToWorldState(
  event: VigilSurgeEvent,
  allAlerts: VigilSurgeEvent[]
): WorldState {
  const created = new Date(event.created_at);
  const isValidDate = !isNaN(created.getTime());
  const hoursOpen = isValidDate
    ? (Date.now() - created.getTime()) / (1000 * 60 * 60)
    : 0;
  const daysOpen = hoursOpen / 24;

  let gapSeverity: GapSeverity;
  if (!isValidDate) {
    gapSeverity = "watching";
  } else if (event.status !== "Open") {
    gapSeverity = "watching";
  } else if (hoursOpen < 24) {
    gapSeverity = "watching";
  } else if (hoursOpen < 72) {
    gapSeverity = "warning";
  } else if (hoursOpen < 168) {
    gapSeverity = "critical";
  } else {
    gapSeverity = "severe";
  }

  const alertKey = `${event.country}:${event.disaster_type}`;
  const alert_count_24h = allAlerts.filter(
    (a) =>
      `${a.country}:${a.disaster_type}` === alertKey &&
      (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60) <= 24
  ).length;

  return {
    alert_id: event.id,
    country_name: event.country,
    country_iso3: event.country,
    disaster_type: event.disaster_type,
    event_name: event.event,
    deployment_needed: event.deployment_needed,
    status: event.status,
    created_at: event.created_at,
    hours_open: Math.round(hoursOpen),
    days_open: Math.round(daysOpen * 10) / 10,
    sectors_needed: event.molnix_tags,
    has_response: false,
    gap_severity: gapSeverity,
    alert_count_24h,
  };
}

export type AuditEntry = {
  phase: "observe" | "detect" | "score" | "explain" | "output";
  timestamp: string;
  success: boolean;
  duration_ms: number;
  error?: string;
};

export type CycleAudit = {
  cycle_id: number;
  entries: AuditEntry[];
  total_duration_ms: number;
};

export type CycleResult = {
  cycle_id: number;
  timestamp: string;
  states: WorldState[];
  gaps: WorldState[];
  duration_ms: number;
  error?: string;
};

async function postScoredGaps(gaps: WorldState[]): Promise<void> {
  if (!HEC_URL || !HEC_TOKEN || gaps.length === 0) return;

  const events = gaps.map((g) => ({
    alert_id: g.alert_id,
    country: g.country_name,
    disaster_type: g.disaster_type,
    event_name: g.event_name,
    hours_open: g.hours_open,
    severity_level: g.severity?.level ?? "UNKNOWN",
    severity_score: g.severity?.score ?? 0,
    gap_severity: g.gap_severity,
    explanation_summary: g.explanation?.summary ?? "",
    explanation_cause: g.explanation?.cause ?? "",
    explanation_impact: g.explanation?.impact ?? "",
    recommended_action: g.explanation?.recommended_action ?? "",
    timestamp: new Date().toISOString(),
  }));

  const body = events
    .map((event) => JSON.stringify({ event, sourcetype: "vigil:scored_gap" }))
    .join("\n");

  try {
    const channel = randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${HEC_URL}?channel=${channel}`, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${HEC_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[HEC] Scored gaps error: ${response.status}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[HEC] Scored gaps post timed out");
    } else {
      console.error("[HEC] Failed to post scored gaps:", err);
    }
  }
}

function formatDuration(hours: number): string {
  if (isNaN(hours) || hours < 0) return "N/A";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function printCycleHeader(cycle: number): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`  CYCLE ${cycle} — ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}`);
}

function printGapDistribution(states: WorldState[]): void {
  const counts = { watching: 0, warning: 0, critical: 0, severe: 0 };
  for (const s of states) {
    counts[s.gap_severity]++;
  }
  console.log("\n[GAP DISTRIBUTION]");
  console.log(`  watching: ${counts.watching}`);
  console.log(`  warning:  ${counts.warning}`);
  console.log(`  critical: ${counts.critical}`);
  console.log(`  severe:   ${counts.severe}`);
  console.log(`  total:    ${states.length}`);
}

function printRankedGaps(gaps: WorldState[]): void {
  if (gaps.length === 0) {
    console.log("\n[RESULT] No critical or severe gaps detected.");
    return;
  }

  const ranked = [...gaps].sort((a, b) => {
    const scoreA = a.severity?.score ?? 0;
    const scoreB = b.severity?.score ?? 0;
    return scoreB - scoreA;
  });

  console.log(`\n[GAPS] ${ranked.length} critical/severe alerts require attention:\n`);
  console.log(
    "Rank".padEnd(6) +
    "Country".padEnd(32) +
    "Disaster".padEnd(20) +
    "Open".padEnd(8) +
    "Severity".padEnd(10) +
    "Score".padEnd(8) +
    "Level"
  );
  console.log("-".repeat(94));

  for (let i = 0; i < ranked.length; i++) {
    const g = ranked[i];
    console.log(
      `#${i + 1}`.padEnd(6) +
      g.country_name.padEnd(32) +
      g.disaster_type.padEnd(20) +
      formatDuration(g.hours_open).padEnd(8) +
      g.gap_severity.toUpperCase().padEnd(10) +
      (g.severity?.score.toFixed(2) ?? "N/A").padEnd(8) +
      (g.severity?.level ?? "N/A")
    );
  }
}

function printExplanations(gaps: WorldState[]): void {
  const withExplanation = gaps.filter((g) => g.explanation);
  if (withExplanation.length === 0) return;

  console.log("\n[EXPLANATIONS]");
  for (const g of withExplanation) {
    const exp = g.explanation!;
    console.log(`\n  #${g.alert_id} ${g.country_name} — ${g.disaster_type}`);
    console.log(`    Summary: ${exp.summary}`);
    console.log(`    Cause: ${exp.cause}`);
    console.log(`    Impact: ${exp.impact}`);
    console.log(`    Action: ${exp.recommended_action}`);
  }
}

function printAuditEntry(entry: AuditEntry): void {
  const status = entry.success ? "OK" : `FAIL: ${entry.error}`;
  console.log(`  [${entry.phase}] ${status} (${entry.duration_ms}ms)`);
}

function printCycleAudit(audit: CycleAudit): void {
  console.log("\n[AUDIT]");
  console.log(`  cycle: ${audit.cycle_id}`);
  console.log(`  total_duration_ms: ${audit.total_duration_ms}`);
  for (const entry of audit.entries) {
    printAuditEntry(entry);
  }
}

async function runCycle(ifrc: IfrcService, cycle: number): Promise<CycleResult> {
  const start = Date.now();
  const audit: AuditEntry[] = [];

  printCycleHeader(cycle);

  try {
    const observeStart = Date.now();
    console.log("[OBSERVE] Querying IFRC GO API...");
    const events = await withTimeout(ifrc.fetchSurgeAlerts(50), 10000);
    const states = events.map((e) => eventToWorldState(e, events));
    audit.push({
      phase: "observe",
      timestamp: new Date().toISOString(),
      success: true,
      duration_ms: Date.now() - observeStart,
    });
    console.log(`[OBSERVE] Retrieved ${states.length} alerts`);

    if (states.length === 0) {
      console.log("[RESULT] No active alerts retrieved.");
      const duration = Date.now() - start;
      printCycleAudit({ cycle_id: cycle, entries: audit, total_duration_ms: duration });
      return { cycle_id: cycle, timestamp: new Date().toISOString(), states: [], gaps: [], duration_ms: duration };
    }

    printGapDistribution(states);

    const detectStart = Date.now();
    console.log("[DETECT] Filtering critical/severe gaps...");
    const gaps = detect(states);
    audit.push({
      phase: "detect",
      timestamp: new Date().toISOString(),
      success: true,
      duration_ms: Date.now() - detectStart,
    });
    console.log(`[DETECT] Found ${gaps.length} gaps`);

    const scoreStart = Date.now();
    console.log("[SCORE] Computing severity...");
    const scored = gaps.map((g) => ({
      ...g,
      severity: computeSeverity({
        hours_open: g.hours_open,
        deployment_needed: g.deployment_needed,
        alert_count_24h: g.alert_count_24h,
      }),
    }));
    audit.push({
      phase: "score",
      timestamp: new Date().toISOString(),
      success: true,
      duration_ms: Date.now() - scoreStart,
    });

    const explainStart = Date.now();
    console.log("[EXPLAIN] Generating explanations...");
    const explained = await withTimeout(explain(scored), 30000);
    audit.push({
      phase: "explain",
      timestamp: new Date().toISOString(),
      success: true,
      duration_ms: Date.now() - explainStart,
    });

    console.log("[INGEST] Posting scored gaps to Splunk Cloud...");
    await postScoredGaps(explained);

    const outputStart = Date.now();
    printRankedGaps(explained);
    printExplanations(explained);
    audit.push({
      phase: "output",
      timestamp: new Date().toISOString(),
      success: true,
      duration_ms: Date.now() - outputStart,
    });

    const duration = Date.now() - start;
    printCycleAudit({ cycle_id: cycle, entries: audit, total_duration_ms: duration });

    return { cycle_id: cycle, timestamp: new Date().toISOString(), states, gaps: explained, duration_ms: duration };
  } catch (err) {
    const duration = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ERROR] Cycle ${cycle} failed:`, errorMsg);

    const failedPhase = audit.length === 0 ? "observe" : audit[audit.length - 1].phase;
    audit.push({
      phase: failedPhase as AuditEntry["phase"],
      timestamp: new Date().toISOString(),
      success: false,
      duration_ms: duration,
      error: errorMsg,
    });

    printCycleAudit({ cycle_id: cycle, entries: audit, total_duration_ms: duration });

    return { cycle_id: cycle, timestamp: new Date().toISOString(), states: [], gaps: [], duration_ms: duration, error: errorMsg };
  }
}

async function withTimeout<T>(fn: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    fn,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

export async function vigilLoop(
  intervalMs: number = 30_000
): Promise<void> {
  const ifrc = new IfrcService();
  let cycle = 0;
  let running = true;

  console.log("[VIGIL] Starting observer loop...");
  console.log(`[VIGIL] Source: IFRC GO API`);
  console.log(`[VIGIL] Sink: Splunk Cloud HEC`);
  console.log(`[VIGIL] Interval: ${intervalMs}ms`);
  console.log("[VIGIL] Press Ctrl+C to stop\n");

  const shutdown = () => {
    console.log("\n[VIGIL] Stopping observer loop...");
    running = false;
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    cycle++;
    const cycleStart = Date.now();
    await runCycle(ifrc, cycle);

    if (running) {
      const elapsed = Date.now() - cycleStart;
      const sleepMs = Math.max(0, intervalMs - elapsed);
      console.log(`\n[VIGIL] Next cycle in ${Math.round(sleepMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  console.log("[VIGIL] Observer loop stopped.");
}

const rawInterval = parseInt(process.env.VIGIL_INTERVAL_MS ?? "30000", 10);
const interval = isNaN(rawInterval) || rawInterval < 5000 ? 30000 : rawInterval;

if (process.argv[1]?.endsWith("vigil.ts")) {
  vigilLoop(interval);
}
