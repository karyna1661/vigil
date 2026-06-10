import assert from "node:assert/strict";
import test from "node:test";

import { isOpsEvent, validateOpsEvent, type OpsEvent } from "../../src/events/schema.js";

const validTransportEvent: OpsEvent = {
  id: "evt-transport-001",
  kind: "transport_inflow",
  source: "simulated_feed",
  occurredAt: "2026-06-01T17:30:00.000Z",
  venueId: "world-cup-stadium-a",
  zone: "transport_hub",
  summary: "Inbound supporter flow is below expected curve two hours before kickoff.",
  metric: {
    name: "supporters_arrived",
    value: 620,
    expected: 850,
    threshold: 0.8,
    unit: "people",
  },
  context: {
    minutesToKickoff: 120,
    simulated: true,
  },
};

test("accepts a valid transport inflow event", () => {
  const result = validateOpsEvent(validTransportEvent);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.event.kind, "transport_inflow");
    assert.equal(result.event.zone, "transport_hub");
  }
  assert.equal(isOpsEvent(validTransportEvent), true);
});

test("rejects an event missing required fields", () => {
  const result = validateOpsEvent({
    ...validTransportEvent,
    id: "",
    metric: {
      name: "supporters_arrived",
      unit: "people",
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /id must be a non-empty string/);
    assert.match(result.errors.join("\n"), /metric.value must be a finite number/);
  }
});

test("rejects an unsupported event kind", () => {
  const result = validateOpsEvent({
    ...validTransportEvent,
    kind: "weather_vibes",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /kind must be one of/);
  }
});
