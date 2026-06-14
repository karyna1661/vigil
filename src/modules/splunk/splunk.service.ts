import { randomUUID } from "node:crypto";
import type { VigilSurgeEvent, IngestionResult, IngestionMetrics } from "../../types.js";

const BASE_URL = process.env.SPLUNK_BASE_URL;
const USERNAME = process.env.SPLUNK_USERNAME;
const PASSWORD = process.env.SPLUNK_PASSWORD;
const HEC_URL = process.env.SPLUNK_HEC_URL;
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const BATCH_SIZE = 20;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function hecUrl(): string {
  const channel = randomUUID();
  const hecUrl = requireEnv("SPLUNK_HEC_URL", HEC_URL);
  return `${hecUrl}?channel=${channel}`;
}

const hecHeaders = () => ({
  Authorization: `Splunk ${requireEnv("SPLUNK_HEC_TOKEN", HEC_TOKEN)}`,
  "Content-Type": "application/json",
});

export class SplunkService {
  async sendBatch(events: VigilSurgeEvent[]): Promise<IngestionResult> {
    if (events.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const result = await this.sendBatchChunk(batch);
      sent += result.sent;
      failed += result.failed;
    }

    return { sent, failed };
  }

  private async sendBatchChunk(batch: VigilSurgeEvent[]): Promise<IngestionResult> {
    try {
      const body = batch
        .map((event) => JSON.stringify({ event, sourcetype: "ifrc:surge_alert" }))
        .join("\n");

      const response = await fetch(hecUrl(), {
        method: "POST",
        headers: {
          ...hecHeaders(),
          "Content-Type": "text/plain",
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`HEC batch error: ${response.status} - ${text}`);
        return await this.sendIndividually(batch);
      }

      return { sent: batch.length, failed: 0 };
    } catch (error) {
      console.error("HEC batch send failed, falling back to individual:", error);
      return await this.sendIndividually(batch);
    }
  }

  private async sendIndividually(events: VigilSurgeEvent[]): Promise<IngestionResult> {
    let sent = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const response = await fetch(hecUrl(), {
          method: "POST",
          headers: hecHeaders(),
          body: JSON.stringify({ event, sourcetype: "ifrc:surge_alert" }),
        });

        if (response.ok) {
          sent++;
        } else {
          const text = await response.text();
          console.error(`HEC individual error for event ${event.id}: ${response.status} - ${text}`);
          failed++;
        }
      } catch (error) {
        console.error(`HEC individual send failed for event ${event.id}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  async sendMetrics(metrics: IngestionMetrics): Promise<void> {
    try {
      const response = await fetch(hecUrl(), {
        method: "POST",
        headers: hecHeaders(),
        body: JSON.stringify({ event: metrics, sourcetype: "vigil:metrics" }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`HEC metrics error: ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error("Failed to send metrics:", error);
    }
  }

  async query<T>(spl: string): Promise<T[]> {
    const baseUrl = requireEnv("SPLUNK_BASE_URL", BASE_URL);
    const host = new URL(baseUrl).hostname;
    const url = `https://${host}/en-US/splunkd/__raw/services/search/jobs`;
    const username = requireEnv("SPLUNK_USERNAME", USERNAME);
    const password = requireEnv("SPLUNK_PASSWORD", PASSWORD);
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        search: spl,
        output_mode: "json",
        exec_mode: "oneshot",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Splunk query failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as { results: T[] };
    return data.results ?? [];
  }
}
