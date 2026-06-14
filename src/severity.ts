import type { SeverityLevel, SeverityInput, SeverityOutput } from "./types.js";

export type { SeverityLevel, SeverityInput, SeverityOutput };

function timeGapScore(hours_open: number): number {
  if (isNaN(hours_open) || hours_open < 0) return 0.2;
  if (hours_open < 24) return 0.2;
  if (hours_open < 72) return 0.6;
  if (hours_open < 168) return 0.85;
  return 1.0;
}

function responseRequiredScore(deployment_needed: boolean): number {
  return deployment_needed ? 1.0 : 0.2;
}

function eventPressureScore(alert_count_24h: number): number {
  if (alert_count_24h > 20) return 1.0;
  if (alert_count_24h > 10) return 0.7;
  return 0.4;
}

export function computeSeverity(input: SeverityInput): SeverityOutput {
  const time = timeGapScore(input.hours_open);
  const response = responseRequiredScore(input.deployment_needed);
  const pressure = eventPressureScore(input.alert_count_24h);

  const score = time * 0.5 + response * 0.3 + pressure * 0.2;

  let level: SeverityLevel;

  if (score >= 0.8) level = "CRITICAL";
  else if (score >= 0.6) level = "HIGH";
  else if (score >= 0.4) level = "MEDIUM";
  else level = "LOW";

  return {
    score: Number(score.toFixed(2)),
    level,
    breakdown: {
      timeGap: time,
      responseRequired: response,
      eventPressure: pressure,
    },
  };
}
