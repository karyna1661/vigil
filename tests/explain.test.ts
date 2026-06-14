import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  explain,
  mapToExplanationInput,
  validateExplanation,
  buildPrompt,
  type LLMAdapter,
} from "../src/explain.js";
import type { WorldState, Explanation } from "../src/types.js";

const mockState: WorldState = {
  alert_id: 12345,
  country_name: "Kenya",
  country_iso3: "KEN",
  disaster_type: "Epidemic",
  event_name: "Kenya",
  deployment_needed: true,
  status: "Open",
  created_at: "2026-06-01T00:00:00Z",
  hours_open: 264,
  days_open: 11,
  sectors_needed: ["Health", "WASH"],
  has_response: false,
  gap_severity: "severe",
  alert_count_24h: 18,
  severity: { score: 0.87, level: "CRITICAL", breakdown: { timeGap: 0.85, responseRequired: 1.0, eventPressure: 0.7 } },
};

const mockStateNoSeverity: WorldState = {
  ...mockState,
  severity: undefined,
};

const mockAdapter: LLMAdapter = async (prompt: string) => {
  return JSON.stringify({
    summary: "Test explanation summary",
    cause: "Test cause based on data",
    impact: "Test impact on operations",
    recommended_action: "Test recommended action",
  });
};

describe("mapToExplanationInput", () => {
  it("maps WorldState to ExplanationInput", () => {
    const input = mapToExplanationInput(mockState);
    assert.equal(input.event, "Kenya");
    assert.equal(input.country, "Kenya");
    assert.equal(input.hours_open, 264);
    assert.equal(input.deployment_needed, true);
    assert.equal(input.alert_count_24h, 18);
    assert.equal(input.severity_score, 0.87);
    assert.equal(input.severity_level, "CRITICAL");
  });

  it("uses defaults when severity is missing", () => {
    const input = mapToExplanationInput(mockStateNoSeverity);
    assert.equal(input.severity_score, 0);
    assert.equal(input.severity_level, "LOW");
  });
});

describe("buildPrompt", () => {
  it("includes input JSON in prompt", () => {
    const input = mapToExplanationInput(mockState);
    const prompt = buildPrompt(input);
    assert.ok(prompt.includes("RULES:"));
    assert.ok(prompt.includes('"event": "Kenya"'));
    assert.ok(prompt.includes('"severity_level": "CRITICAL"'));
  });
});

describe("validateExplanation", () => {
  it("accepts valid explanation", () => {
    const exp: Explanation = {
      summary: "Test summary",
      cause: "Test cause",
      impact: "Test impact",
      recommended_action: "Test action",
    };
    assert.ok(validateExplanation(exp));
  });

  it("rejects null", () => {
    assert.ok(!validateExplanation(null));
  });

  it("rejects missing fields", () => {
    assert.ok(!validateExplanation({ summary: "test" }));
  });

  it("rejects empty strings", () => {
    assert.ok(!validateExplanation({
      summary: "",
      cause: "test",
      impact: "test",
      recommended_action: "test",
    }));
  });

  it("rejects summary too long (>300)", () => {
    assert.ok(!validateExplanation({
      summary: "x".repeat(300),
      cause: "test",
      impact: "test",
      recommended_action: "test",
    }));
  });

  it("rejects cause too long (>500)", () => {
    assert.ok(!validateExplanation({
      summary: "test",
      cause: "x".repeat(500),
      impact: "test",
      recommended_action: "test",
    }));
  });

  it("rejects impact too long (>500)", () => {
    assert.ok(!validateExplanation({
      summary: "test",
      cause: "test",
      impact: "x".repeat(500),
      recommended_action: "test",
    }));
  });

  it("rejects recommended_action too long (>500)", () => {
    assert.ok(!validateExplanation({
      summary: "test",
      cause: "test",
      impact: "test",
      recommended_action: "x".repeat(500),
    }));
  });
});

describe("explain", () => {
  it("returns template explanation when no adapter provided", async () => {
    const noOpAdapter: LLMAdapter = async () => { throw new Error("skip"); };
    const results = await explain([mockState], noOpAdapter);
    assert.equal(results.length, 1);
    assert.ok(results[0].explanation);
    assert.ok(results[0].explanation!.summary.includes("Kenya"));
    assert.ok(results[0].explanation!.cause.includes("Kenya"));
    assert.ok(results[0].explanation!.impact.includes("severity"));
    assert.ok(results[0].explanation!.recommended_action.length > 0);
  });

  it("uses adapter when provided", async () => {
    const results = await explain([mockState], mockAdapter);
    assert.equal(results.length, 1);
    assert.equal(results[0].explanation!.summary, "Test explanation summary");
    assert.equal(results[0].explanation!.cause, "Test cause based on data");
  });

  it("preserves original WorldState fields", async () => {
    const results = await explain([mockState], mockAdapter);
    assert.equal(results[0].alert_id, 12345);
    assert.equal(results[0].country_name, "Kenya");
    assert.equal(results[0].gap_severity, "severe");
    assert.equal(results[0].severity!.score, 0.87);
  });

  it("handles empty input", async () => {
    const results = await explain([], mockAdapter);
    assert.equal(results.length, 0);
  });

  it("handles multiple states in batches", async () => {
    const states = [
      mockState,
      { ...mockState, alert_id: 99999, country_name: "Afghanistan" },
      { ...mockState, alert_id: 88888, country_name: "Pakistan" },
    ];
    const results = await explain(states, mockAdapter);
    assert.equal(results.length, 3);
    assert.ok(results[0].explanation);
    assert.ok(results[1].explanation);
    assert.ok(results[2].explanation);
  });

  it("returns structured explanation, not string", async () => {
    const results = await explain([mockState], mockAdapter);
    const exp = results[0].explanation!;
    assert.equal(typeof exp.summary, "string");
    assert.equal(typeof exp.cause, "string");
    assert.equal(typeof exp.impact, "string");
    assert.equal(typeof exp.recommended_action, "string");
  });

  it("fallback explanation passes validation", async () => {
    const results = await explain([mockState]);
    assert.ok(validateExplanation(results[0].explanation!));
  });
});
