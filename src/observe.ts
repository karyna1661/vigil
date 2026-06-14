import "dotenv/config";
import { SplunkService } from "./modules/splunk/splunk.service.js";
import { detect } from "./detect.js";
import type { WorldState, GapSeverity } from "./types.js";

type SplunkRow = {
  id: string;
  country: string;
  disaster_type: string;
  status: string;
  created_at: string;
  hours_open: string;
  days_open: string;
  gap_severity: string;
  alert_count_24h: string;
};

function mapToWorldState(row: SplunkRow): WorldState {
  return {
    alert_id: Number(row.id),
    country_name: row.country,
    country_iso3: row.country,
    disaster_type: row.disaster_type,
    event_name: row.disaster_type,
    deployment_needed: false,
    status: row.status,
    created_at: row.created_at,
    hours_open: Number(row.hours_open),
    days_open: Number(row.days_open),
    sectors_needed: [],
    has_response: false,
    gap_severity: isValidGapSeverity(row.gap_severity) ? row.gap_severity : "watching",
    alert_count_24h: Number(row.alert_count_24h) || 0,
  };
}

function isValidGapSeverity(value: string): value is GapSeverity {
  return ["watching", "warning", "critical", "severe"].includes(value);
}

const CORRELATION_SPL = `
index=* sourcetype=ifrc:surge_alert
| eval created_epoch=strptime(created_at, "%Y-%m-%dT%H:%M:%S")
| eval hours_open=round((now() - created_epoch)/3600, 0)
| eval days_open=round(hours_open/24, 1)
| eval gap_severity=case(
    status="Open" AND hours_open < 24, "watching",
    status="Open" AND hours_open >= 24 AND hours_open < 72, "warning",
    status="Open" AND hours_open >= 72 AND hours_open < 168, "critical",
    status="Open" AND hours_open >= 168, "severe",
    true(), "resolved"
)
| search gap_severity!="resolved"
| eval is_recent=if((now() - created_epoch) <= 86400, 1, 0)
| eventstats sum(is_recent) as alert_count_24h by country disaster_type
| dedup id
| table id country disaster_type status created_at hours_open days_open gap_severity alert_count_24h
`;

function formatDuration(hours: number): string {
  if (isNaN(hours) || hours < 0) return "N/A";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
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

function printGaps(gaps: WorldState[]): void {
  if (gaps.length === 0) {
    console.log("\n[RESULT] No critical or severe gaps found.");
    return;
  }

  console.log(`\n[GAPS] ${gaps.length} critical/severe alerts require attention:\n`);
  console.log(
    "Country".padEnd(28) +
    "Disaster".padEnd(22) +
    "Open".padEnd(8) +
    "Severity".padEnd(10) +
    "Status"
  );
  console.log("-".repeat(80));

  for (const g of gaps) {
    console.log(
      g.country_name.padEnd(28) +
      g.disaster_type.padEnd(22) +
      formatDuration(g.hours_open).padEnd(8) +
      g.gap_severity.toUpperCase().padEnd(10) +
      g.status
    );
  }
}

async function main() {
  const splunk = new SplunkService();

  console.log("[QUERY] Executing SPL correlation query...");
  const rows = await splunk.query<SplunkRow>(CORRELATION_SPL);
  const state = rows.map(mapToWorldState);
  console.log(`[QUERY] Returned ${state.length} rows`);

  printGapDistribution(state);

  const gaps = detect(state);
  printGaps(gaps);

  console.log("\n[PROOF]");
  console.log(`  input:  ${state.length} alerts`);
  console.log(`  output: ${gaps.length} critical/severe gaps`);
  console.log(`  verified: ${gaps.length > 0 ? "YES — real gaps detected" : "no gaps in current data"}`);
}

main().catch((err) => {
  console.error("[ERROR]", err);
  process.exit(1);
});
