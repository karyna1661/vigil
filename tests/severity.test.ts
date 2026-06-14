import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSeverity } from "../src/severity.js";

describe("computeSeverity", () => {
  it("CRITICAL: old alert + deployment needed + high pressure", () => {
    const result = computeSeverity({
      hours_open: 90,
      deployment_needed: true,
      alert_count_24h: 18,
    });
    assert.equal(result.level, "CRITICAL");
    assert.ok(result.score >= 0.8, `Expected score >= 0.8, got ${result.score}`);
    assert.equal(result.breakdown.timeGap, 0.85);
    assert.equal(result.breakdown.responseRequired, 1.0);
    assert.equal(result.breakdown.eventPressure, 0.7);
  });

  it("LOW: recent alert + no deployment + low pressure", () => {
    const result = computeSeverity({
      hours_open: 10,
      deployment_needed: false,
      alert_count_24h: 5,
    });
    assert.equal(result.level, "LOW");
    assert.ok(result.score < 0.4);
  });

  it("MEDIUM: mid-range values", () => {
    const result = computeSeverity({
      hours_open: 30,
      deployment_needed: false,
      alert_count_24h: 5,
    });
    assert.equal(result.level, "MEDIUM");
    assert.ok(result.score >= 0.4 && result.score < 0.6);
  });

  it("HIGH: significant gap", () => {
    const result = computeSeverity({
      hours_open: 50,
      deployment_needed: true,
      alert_count_24h: 5,
    });
    assert.equal(result.level, "HIGH");
    assert.ok(result.score >= 0.6 && result.score < 0.8);
  });

  it("is deterministic", () => {
    const input = { hours_open: 100, deployment_needed: true, alert_count_24h: 15 };
    const r1 = computeSeverity(input);
    const r2 = computeSeverity(input);
    assert.deepEqual(r1, r2);
  });

  it("timeGapScore thresholds align with Phase 2", () => {
    const t1 = computeSeverity({ hours_open: 23, deployment_needed: false, alert_count_24h: 5 });
    assert.equal(t1.breakdown.timeGap, 0.2);

    const t2 = computeSeverity({ hours_open: 24, deployment_needed: false, alert_count_24h: 5 });
    assert.equal(t2.breakdown.timeGap, 0.6);

    const t3 = computeSeverity({ hours_open: 72, deployment_needed: false, alert_count_24h: 5 });
    assert.equal(t3.breakdown.timeGap, 0.85);

    const t4 = computeSeverity({ hours_open: 168, deployment_needed: false, alert_count_24h: 5 });
    assert.equal(t4.breakdown.timeGap, 1.0);
  });

  it("responseRequiredScore: deployment_needed=true → 1.0", () => {
    const result = computeSeverity({ hours_open: 10, deployment_needed: true, alert_count_24h: 5 });
    assert.equal(result.breakdown.responseRequired, 1.0);
  });

  it("responseRequiredScore: deployment_needed=false → 0.2", () => {
    const result = computeSeverity({ hours_open: 10, deployment_needed: false, alert_count_24h: 5 });
    assert.equal(result.breakdown.responseRequired, 0.2);
  });

  it("edge case: zero alerts in 24h", () => {
    const result = computeSeverity({ hours_open: 100, deployment_needed: true, alert_count_24h: 0 });
    assert.equal(result.breakdown.eventPressure, 0.4);
    assert.equal(result.level, "CRITICAL");
  });
});
