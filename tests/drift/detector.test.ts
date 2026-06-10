import assert from "node:assert/strict";
import test from "node:test";

import { detectOperationalDrift } from "../../src/drift/detector.js";
import { generateOpsFeed } from "../../src/events/feed.js";
import type { OpsEvent } from "../../src/events/schema.js";

const startTime = Date.UTC(2026, 5, 1, 17, 0, 0);

const makeEvent = (overrides: Partial<OpsEvent> = {}): OpsEvent => ({
  id: "evt-1",
  kind: "transport_inflow",
  source: "simulated_feed",
  occurredAt: "2026-06-01T17:00:00.000Z",
  venueId: "world-cup-stadium-a",
  zone: "transport_hub",
  summary: "Test event",
  metric: {
    name: "supporters_arrived",
    value: 620,
    threshold: 680,
    unit: "people",
  },
  ...overrides,
});

test("baseline-only feed returns no drift state", () => {
  const [baseline] = generateOpsFeed({ matchId: "match-1", startTime });

  const state = detectOperationalDrift([baseline]);

  assert.deepEqual(state, {
    level: "none",
    signals: [],
    confidence: 0,
    triggeredBy: [],
  });
});

test("transport supporters below threshold produces warning state", () => {
  const event = makeEvent();

  const state = detectOperationalDrift([event]);

  assert.equal(state.level, "warning");
  assert.deepEqual(state.signals, ["transport-arrival-lag"]);
  assert.equal(state.confidence, 0.65);
  assert.deepEqual(state.triggeredBy, [event]);
});

test("gate queue wait above critical threshold produces direct critical state", () => {
  const event = makeEvent({
    id: "evt-gate-critical",
    kind: "gate_capacity",
    zone: "north_gate",
    metric: {
      name: "queue_wait_minutes",
      value: 25,
      threshold: 12,
      unit: "minutes",
    },
  });

  const state = detectOperationalDrift([event]);

  assert.equal(state.level, "critical");
  assert.deepEqual(state.signals, ["gate-queue-pressure", "critical-escalation"]);
  assert.equal(state.confidence, 0.9);
  assert.deepEqual(state.triggeredBy, [event]);
});

test("full generated feed escalates through multiple distinct warning signals", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });

  const state = detectOperationalDrift(feed);

  assert.equal(state.level, "critical");
  assert.deepEqual(state.signals, [
    "transport-arrival-lag",
    "gate-queue-pressure",
    "staffing-gap",
    "vendor-readiness-gap",
    "critical-escalation",
  ]);
  assert.equal(state.confidence, 0.9);
  assert.deepEqual(state.triggeredBy, feed.slice(1));
});

test("supported drift metric without numeric threshold is a non-signal", () => {
  const event = makeEvent({
    metric: {
      name: "supporters_arrived",
      value: 620,
      unit: "people",
    },
  });

  assert.doesNotThrow(() => detectOperationalDrift([event]));
  assert.deepEqual(detectOperationalDrift([event]), {
    level: "none",
    signals: [],
    confidence: 0,
    triggeredBy: [],
  });
});

test("unsupported metrics and events are non-signals", () => {
  const unsupportedMetric = makeEvent({
    metric: {
      name: "readiness_percent",
      value: 40,
      threshold: 75,
      unit: "percent",
    },
  });
  const unsupportedEvent = makeEvent({
    kind: "task_status",
    zone: "command_center",
  });

  assert.deepEqual(detectOperationalDrift([unsupportedMetric, unsupportedEvent]), {
    level: "none",
    signals: [],
    confidence: 0,
    triggeredBy: [],
  });
});

test("repeated calls with the same events produce deeply equal state", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });

  const first = detectOperationalDrift(feed);
  const second = detectOperationalDrift(feed);

  assert.deepEqual(first, second);
});

test("input events are not mutated", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });
  const before = structuredClone(feed);

  detectOperationalDrift(feed);

  assert.deepEqual(feed, before);
});
