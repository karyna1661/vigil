import assert from "node:assert/strict";
import test from "node:test";

import { generateOpsFeed, SIMULATED_FEED_STAGES } from "../../src/events/feed.js";
import { validateOpsEvent } from "../../src/events/schema.js";

const startTime = Date.UTC(2026, 5, 1, 17, 0, 0);

test("emits a deterministic sequence for the same input", () => {
  const first = generateOpsFeed({ matchId: "match-1", startTime });
  const second = generateOpsFeed({ matchId: "match-1", startTime });

  assert.deepEqual(first, second);
});

test("events are emitted in chronological order", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });

  for (let index = 1; index < feed.length; index += 1) {
    const previous = Date.parse(feed[index - 1].occurredAt);
    const current = Date.parse(feed[index].occurredAt);

    assert.ok(current >= previous, `${feed[index].id} should not occur before the previous event`);
  }
});

test("all emitted events pass the authoritative schema validator", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });

  for (const event of feed) {
    const result = validateOpsEvent(event);

    assert.equal(result.ok, true, `${event.id} should be schema-valid`);
  }
});

test("sequence shape matches the calm-to-drift scenario", () => {
  const feed = generateOpsFeed({ matchId: "match-1", startTime });
  const stages = feed.map((event) => event.context?.feedStage);

  assert.deepEqual(stages, [...SIMULATED_FEED_STAGES]);
});
