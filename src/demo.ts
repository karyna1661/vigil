import "dotenv/config";
import { IfrcService } from "./modules/ifrc/ifrc.service.js";
import { detect } from "./detect.js";
import { computeSeverity } from "./severity.js";
import { explain, mapToExplanationInput } from "./explain.js";
import { randomUUID } from "node:crypto";
import type { WorldState, GapSeverity, VigilSurgeEvent } from "./types.js";

const HEC_URL = process.env.SPLUNK_HEC_URL;
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;

function eventToWorldState(event: VigilSurgeEvent, allAlerts: VigilSurgeEvent[]): WorldState {
  const created = new Date(event.created_at);
  const isValidDate = !isNaN(created.getTime());
  const hoursOpen = isValidDate ? (Date.now() - created.getTime()) / (1000 * 60 * 60) : 0;

  let gapSeverity: GapSeverity = "watching";
  if (isValidDate && event.status === "Open") {
    if (hoursOpen >= 168) gapSeverity = "severe";
    else if (hoursOpen >= 72) gapSeverity = "critical";
    else if (hoursOpen >= 24) gapSeverity = "warning";
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
    days_open: Math.round((hoursOpen / 24) * 10) / 10,
    sectors_needed: event.molnix_tags,
    has_response: false,
    gap_severity: gapSeverity,
    alert_count_24h,
  };
}

function formatDuration(hours: number): string {
  if (isNaN(hours) || hours < 0) return "N/A";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  DEMO COMPLETE                                             ║");
console.log("║  Next: In Splunk Web, search:                              ║");
console.log("║    sourcetype=\"vigil:scored_gap\" | table country, disaster_type, severity_level, explanation_summary  ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
