export type VigilSurgeEvent = {
  id: number;
  country: string;
  event: string;
  disaster_type: string;
  status: string;
  created_at: string;
  modified_at: string;
  description: string;
  deployment_needed: boolean;
  molnix_tags: string[];
};

export type IngestionResult = {
  sent: number;
  failed: number;
};

export type IngestionMetrics = {
  batch_size: number;
  sent: number;
  failed: number;
  timestamp: string;
  cycle_duration_ms: number;
};

export type GapSeverity = "watching" | "warning" | "critical" | "severe";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SeverityInput = {
  hours_open: number;
  deployment_needed: boolean;
  alert_count_24h: number;
};

export type SeverityOutput = {
  score: number;
  level: SeverityLevel;
  breakdown: {
    timeGap: number;
    responseRequired: number;
    eventPressure: number;
  };
};

export type Explanation = {
  summary: string;
  cause: string;
  impact: string;
  recommended_action: string;
};

export type WorldState = {
  alert_id: number;
  country_name: string;
  country_iso3: string;
  disaster_type: string;
  event_name: string;
  deployment_needed: boolean;
  status: string;
  created_at: string;
  hours_open: number;
  days_open: number;
  sectors_needed: string[];
  has_response: boolean;
  gap_severity: GapSeverity;
  alert_count_24h: number;
  severity?: SeverityOutput;
  explanation?: Explanation;
};
