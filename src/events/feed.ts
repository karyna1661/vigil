import type { OpsEvent } from "./schema.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const SIMULATED_FEED_STAGES = [
  "baseline",
  "transport_inflow_lag",
  "gate_pressure_rising",
  "staffing_gap_detected",
  "vendor_readiness_delay",
] as const;

export type SimulatedFeedStage = (typeof SIMULATED_FEED_STAGES)[number];

export type FeedOverrides = Partial<
  Record<SimulatedFeedStage, { value?: number; threshold?: number }>
>;

export type GenerateOpsFeedInput = {
  matchId: string;
  startTime: number;
  venueId?: string;
  overrides?: FeedOverrides;
};

type FeedEventTemplate = Omit<OpsEvent, "id" | "occurredAt" | "venueId"> & {
  stage: SimulatedFeedStage;
};

const eventTemplates: readonly FeedEventTemplate[] = [
  {
    stage: "baseline",
    kind: "task_status",
    source: "simulated_feed",
    zone: "command_center",
    summary: "Operational baseline established. All matchday systems are nominal.",
    metric: {
      name: "readiness_percent",
      value: 82,
      expected: 80,
      threshold: 75,
      unit: "percent",
    },
    context: {
      feedStage: "baseline",
      minutesToKickoff: 120,
      simulated: true,
    },
  },
  {
    stage: "transport_inflow_lag",
    kind: "transport_inflow",
    source: "simulated_feed",
    zone: "transport_hub",
    summary: "Inbound supporter flow is below the expected arrival curve two hours before kickoff.",
    metric: {
      name: "supporters_arrived",
      value: 620,
      expected: 850,
      threshold: 680,
      unit: "people",
    },
    context: {
      feedStage: "transport_inflow_lag",
      minutesToKickoff: 115,
      simulated: true,
    },
  },
  {
    stage: "gate_pressure_rising",
    kind: "gate_capacity",
    source: "simulated_feed",
    zone: "north_gate",
    summary: "North Gate queue pressure is rising beyond the forecasted entry rate.",
    metric: {
      name: "queue_wait_minutes",
      value: 18,
      expected: 8,
      threshold: 12,
      unit: "minutes",
    },
    context: {
      feedStage: "gate_pressure_rising",
      minutesToKickoff: 110,
      simulated: true,
    },
  },
  {
    stage: "staffing_gap_detected",
    kind: "staffing_status",
    source: "simulated_feed",
    zone: "security_control",
    summary: "Security staffing is below the required level for current gate pressure.",
    metric: {
      name: "staff_present",
      value: 12,
      expected: 20,
      threshold: 16,
      unit: "staff",
    },
    context: {
      feedStage: "staffing_gap_detected",
      minutesToKickoff: 105,
      simulated: true,
    },
  },
  {
    stage: "vendor_readiness_delay",
    kind: "vendor_readiness",
    source: "simulated_feed",
    zone: "vendor_concourse",
    summary: "Concession vendor setup is late enough to threaten halftime readiness.",
    metric: {
      name: "vendors_ready",
      value: 7,
      expected: 12,
      threshold: 10,
      unit: "vendors",
    },
    context: {
      feedStage: "vendor_readiness_delay",
      minutesToKickoff: 100,
      simulated: true,
    },
  },
];

const toIsoTimestamp = (startTime: number, index: number): string =>
  new Date(startTime + index * FIVE_MINUTES_MS).toISOString();

export const generateOpsFeed = ({
  matchId,
  startTime,
  venueId = "world-cup-stadium-a",
  overrides,
}: GenerateOpsFeedInput): OpsEvent[] =>
  eventTemplates.map(({ stage, ...template }, index) => {
    const o = overrides?.[stage];
    return {
      ...template,
      id: `${matchId}-${index}`,
      occurredAt: toIsoTimestamp(startTime, index),
      venueId,
      metric: {
        ...template.metric,
        ...(o?.value !== undefined ? { value: o.value } : {}),
        ...(o?.threshold !== undefined ? { threshold: o.threshold } : {}),
      },
      context: template.context ? { ...template.context } : undefined,
    };
  });
