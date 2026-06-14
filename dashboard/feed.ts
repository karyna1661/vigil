import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeSeverity } from "../src/severity.js";
import { explain } from "../src/explain.js";
import type { WorldState } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

const MOCK_GAPS: WorldState[] = [
  { alert_id: 21835, country_name: "Democratic Republic of Congo", country_iso3: "COD", disaster_type: "Epidemic", event_name: "DRC", deployment_needed: true, status: "Open", created_at: "2026-06-09T10:16:15Z", hours_open: 264, days_open: 11, sectors_needed: ["Health"], has_response: false, gap_severity: "severe", alert_count_24h: 18 },
  { alert_id: 21834, country_name: "Kenya", country_iso3: "KEN", disaster_type: "Epidemic", event_name: "Kenya", deployment_needed: true, status: "Open", created_at: "2026-06-08T22:19:38Z", hours_open: 288, days_open: 12, sectors_needed: ["Health", "WASH"], has_response: false, gap_severity: "severe", alert_count_24h: 15 },
  { alert_id: 21833, country_name: "Sudan", country_iso3: "SDN", disaster_type: "Complex Emergency", event_name: "Sudan", deployment_needed: true, status: "Open", created_at: "2026-06-07T14:30:00Z", hours_open: 360, days_open: 15, sectors_needed: ["Health", "Protection"], has_response: false, gap_severity: "severe", alert_count_24h: 22 },
  { alert_id: 21832, country_name: "Myanmar", country_iso3: "MMR", disaster_type: "Flood", event_name: "Myanmar", deployment_needed: true, status: "Open", created_at: "2026-06-10T08:00:00Z", hours_open: 192, days_open: 8, sectors_needed: ["WASH", "Shelter"], has_response: false, gap_severity: "critical", alert_count_24h: 12 },
  { alert_id: 21831, country_name: "Pakistan", country_iso3: "PAK", disaster_type: "Flood", event_name: "Pakistan", deployment_needed: true, status: "Open", created_at: "2026-06-11T06:00:00Z", hours_open: 120, days_open: 5, sectors_needed: ["Health"], has_response: false, gap_severity: "critical", alert_count_24h: 8 },
  { alert_id: 21830, country_name: "Ethiopia", country_iso3: "ETH", disaster_type: "Drought", event_name: "Ethiopia", deployment_needed: true, status: "Open", created_at: "2026-06-05T12:00:00Z", hours_open: 480, days_open: 20, sectors_needed: ["Food Security", "WASH"], has_response: false, gap_severity: "severe", alert_count_24h: 14 },
  { alert_id: 21829, country_name: "Somalia", country_iso3: "SOM", disaster_type: "Drought", event_name: "Somalia", deployment_needed: true, status: "Open", created_at: "2026-06-06T09:00:00Z", hours_open: 408, days_open: 17, sectors_needed: ["Food Security"], has_response: false, gap_severity: "severe", alert_count_24h: 11 },
  { alert_id: 21828, country_name: "Yemen", country_iso3: "YEM", disaster_type: "Complex Emergency", event_name: "Yemen", deployment_needed: true, status: "Open", created_at: "2026-06-04T15:00:00Z", hours_open: 552, days_open: 23, sectors_needed: ["Health", "WASH", "Protection"], has_response: false, gap_severity: "severe", alert_count_24h: 19 },
  { alert_id: 21827, country_name: "Bangladesh", country_iso3: "BGD", disaster_type: "Flood", event_name: "Bangladesh", deployment_needed: true, status: "Open", created_at: "2026-06-10T14:00:00Z", hours_open: 180, days_open: 7.5, sectors_needed: ["WASH"], has_response: false, gap_severity: "critical", alert_count_24h: 9 },
  { alert_id: 21826, country_name: "Nigeria", country_iso3: "NGA", disaster_type: "Flood", event_name: "Nigeria", deployment_needed: true, status: "Open", created_at: "2026-06-09T18:00:00Z", hours_open: 246, days_open: 10, sectors_needed: ["Health", "Shelter"], has_response: false, gap_severity: "severe", alert_count_24h: 16 },
];

async function runDashboardCycle(cycle: number) {
  const start = Date.now();
  const audit: { phase: string; time: string; ok: boolean; duration?: number }[] = [];

  const observeStart = Date.now();
  const states = MOCK_GAPS;
  audit.push({ phase: "OBSERVE", time: new Date().toISOString().slice(11, 19), ok: true, duration: Date.now() - observeStart });

  const detectStart = Date.now();
  const gaps = states.filter((s) => s.gap_severity === "critical" || s.gap_severity === "severe");
  audit.push({ phase: "DETECT", time: new Date().toISOString().slice(11, 19), ok: true, duration: Date.now() - detectStart });

  const scoreStart = Date.now();
  const scored = gaps.map((g) => ({
    ...g,
    severity: computeSeverity({ hours_open: g.hours_open, deployment_needed: g.deployment_needed, alert_count_24h: g.alert_count_24h }),
  }));
  audit.push({ phase: "SCORE", time: new Date().toISOString().slice(11, 19), ok: true, duration: Date.now() - scoreStart });

  const explainStart = Date.now();
  const explained = await explain(scored);
  audit.push({ phase: "EXPLAIN", time: new Date().toISOString().slice(11, 19), ok: true, duration: Date.now() - explainStart });

  const ranked = [...explained].sort((a, b) => (b.severity?.score ?? 0) - (a.severity?.score ?? 0));

  audit.push({ phase: "OUTPUT", time: new Date().toISOString().slice(11, 19), ok: true });

  const data = {
    cycle,
    timestamp: new Date().toISOString(),
    totalAlerts: states.length,
    gaps: ranked.map((g) => ({
      country: g.country_name,
      disaster_type: g.disaster_type,
      hours_open: g.hours_open,
      severity_level: g.severity?.level,
      severity_score: g.severity?.score,
      explanation_summary: g.explanation?.summary,
      explanation_cause: g.explanation?.cause,
      explanation_impact: g.explanation?.impact,
      recommended_action: g.explanation?.recommended_action,
    })),
    audit,
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`[CYCLE ${cycle}] ${gaps.length} gaps | ${Date.now() - start}ms`);
}

let cycle = 0;
async function loop() {
  cycle++;
  await runDashboardCycle(cycle);
  setTimeout(loop, 10000);
}

loop();
