import { IfrcService } from "./modules/ifrc/ifrc.service.js";
import { SplunkService } from "./modules/splunk/splunk.service.js";
import type { VigilSurgeEvent, IngestionMetrics } from "./types.js";

const seenIds = new Set<number>();

function deduplicate(events: VigilSurgeEvent[]): VigilSurgeEvent[] {
  const fresh: VigilSurgeEvent[] = [];

  for (const event of events) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      fresh.push(event);
    }
  }

  return fresh;
}

export async function runIngestion(): Promise<{ events: VigilSurgeEvent[]; metrics: IngestionMetrics }> {
  const start = Date.now();
  const ifrc = new IfrcService();
  const splunk = new SplunkService();

  console.log("[INGEST] Fetching surge alerts from IFRC GO...");
  const raw = await ifrc.fetchSurgeAlerts();
  console.log(`[INGEST] Fetched ${raw.length} alerts`);

  const events = deduplicate(raw);
  console.log(`[INGEST] After dedup: ${events.length} new events`);

  console.log("[INGEST] Sending to Splunk HEC...");
  const result = await splunk.sendBatch(events);
  console.log(`[INGEST] Sent: ${result.sent}, Failed: ${result.failed}`);

  const duration = Date.now() - start;
  const metrics: IngestionMetrics = {
    batch_size: events.length,
    sent: result.sent,
    failed: result.failed,
    timestamp: new Date().toISOString(),
    cycle_duration_ms: duration,
  };

  await splunk.sendMetrics(metrics);
  console.log(`[INGEST] Metrics sent. Duration: ${duration}ms`);

  return { events, metrics };
}
