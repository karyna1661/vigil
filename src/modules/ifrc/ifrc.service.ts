import type { VigilSurgeEvent } from "../../types.js";
import type { IfrcSurgeAlertResponse, IfrcSurgeAlertRaw } from "./ifrc.types.js";

const BASE_URL = process.env.IFRC_API_URL;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const toVigilEvent = (raw: IfrcSurgeAlertRaw): VigilSurgeEvent => ({
  id: raw.id,
  country: raw.country?.name ?? "Unknown",
  event: raw.event?.name ?? String(raw.event?.id ?? "Unknown"),
  disaster_type: raw.event?.dtype?.name ?? "Unknown",
  status: raw.molnix_status_display ?? raw.category_display ?? raw.status ?? "unknown",
  created_at: raw.created_at,
  modified_at: raw.modified_at ?? raw.created_at,
  description: raw.message ?? "",
  deployment_needed: raw.deployment_needed ?? false,
  molnix_tags: (raw.molnix_tags ?? []).map((t) => t.name),
});

export class IfrcService {
  async fetchSurgeAlerts(limit = 50): Promise<VigilSurgeEvent[]> {
    const baseUrl = requireEnv("IFRC_API_URL", BASE_URL);
    const url = new URL(baseUrl);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`IFRC API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as IfrcSurgeAlertResponse;
    if (!Array.isArray(data.results)) {
      throw new Error("IFRC API returned unexpected response structure");
    }
    return data.results.map(toVigilEvent);
  }
}
