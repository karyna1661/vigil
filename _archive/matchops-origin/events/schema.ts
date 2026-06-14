export const OPS_EVENT_KINDS = [
  "transport_inflow",
  "gate_capacity",
  "staffing_status",
  "vendor_readiness",
  "crowd_density",
  "task_status",
] as const;

export const OPS_ZONES = [
  "transport_hub",
  "north_gate",
  "south_gate",
  "east_gate",
  "west_gate",
  "vendor_concourse",
  "security_control",
  "command_center",
] as const;

export const OPS_EVENT_SOURCES = ["simulated_feed", "operator_report", "gitlab_sync"] as const;

export type OpsEventKind = (typeof OPS_EVENT_KINDS)[number];
export type OpsZone = (typeof OPS_ZONES)[number];
export type OpsEventSource = (typeof OPS_EVENT_SOURCES)[number];

export type OpsMetric = {
  name: string;
  value: number;
  unit: string;
  expected?: number;
  threshold?: number;
};

export type OpsEvent = {
  id: string;
  kind: OpsEventKind;
  source: OpsEventSource;
  occurredAt: string;
  venueId: string;
  zone: OpsZone;
  summary: string;
  metric: OpsMetric;
  context?: Record<string, string | number | boolean>;
};

export type OpsEventValidationResult =
  | { ok: true; event: OpsEvent }
  | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value);

const isIsoDateTime = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
};

const validateMetric = (value: unknown): string[] => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return ["metric must be an object"];
  }

  if (!isNonEmptyString(value.name)) {
    errors.push("metric.name must be a non-empty string");
  }

  if (!isFiniteNumber(value.value)) {
    errors.push("metric.value must be a finite number");
  }

  if (!isNonEmptyString(value.unit)) {
    errors.push("metric.unit must be a non-empty string");
  }

  if ("expected" in value && value.expected !== undefined && !isFiniteNumber(value.expected)) {
    errors.push("metric.expected must be a finite number when provided");
  }

  if ("threshold" in value && value.threshold !== undefined && !isFiniteNumber(value.threshold)) {
    errors.push("metric.threshold must be a finite number when provided");
  }

  return errors;
};

const validateContext = (value: unknown): string[] => {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return ["context must be an object when provided"];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    const validEntry = ["string", "number", "boolean"].includes(typeof entry);
    return validEntry ? [] : [`context.${key} must be a string, number, or boolean`];
  });
};

export const validateOpsEvent = (value: unknown): OpsEventValidationResult => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["event must be an object"] };
  }

  if (!isNonEmptyString(value.id)) {
    errors.push("id must be a non-empty string");
  }

  if (!isOneOf(value.kind, OPS_EVENT_KINDS)) {
    errors.push(`kind must be one of: ${OPS_EVENT_KINDS.join(", ")}`);
  }

  if (!isOneOf(value.source, OPS_EVENT_SOURCES)) {
    errors.push(`source must be one of: ${OPS_EVENT_SOURCES.join(", ")}`);
  }

  if (!isIsoDateTime(value.occurredAt)) {
    errors.push("occurredAt must be a valid ISO-like datetime string");
  }

  if (!isNonEmptyString(value.venueId)) {
    errors.push("venueId must be a non-empty string");
  }

  if (!isOneOf(value.zone, OPS_ZONES)) {
    errors.push(`zone must be one of: ${OPS_ZONES.join(", ")}`);
  }

  if (!isNonEmptyString(value.summary)) {
    errors.push("summary must be a non-empty string");
  }

  errors.push(...validateMetric(value.metric));
  errors.push(...validateContext(value.context));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, event: value as OpsEvent };
};

export const isOpsEvent = (value: unknown): value is OpsEvent => validateOpsEvent(value).ok;
