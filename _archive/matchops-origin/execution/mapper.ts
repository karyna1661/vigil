import type { ActionIntent } from "../policy/types.js";
import type { ExecutionPlan, ExecutionTarget } from "./types.js";

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const sortedKeys = Object.keys(value).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const entries = sortedKeys
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );

  return `{${entries.join(",")}}`;
};

type Mapping = {
  target: ExecutionTarget;
  action: string;
  buildPayload: (intent: ActionIntent) => Record<string, unknown>;
  buildReason: (intent: ActionIntent) => string;
};

const mappings: Record<string, Mapping> = {
  MONITOR: {
    target: "GITLAB_COMMENT",
    action: "post_comment",
    buildPayload: (intent) => ({
      message: `Monitoring: priority=${intent.priority} confidence=${intent.confidence} reason=${intent.reason}`,
      priority: intent.priority,
      confidence: intent.confidence,
      reason: intent.reason,
    }),
    buildReason: (intent) =>
      `Monitor action for priority ${intent.priority} at confidence ${intent.confidence}`,
  },
  CREATE_INCIDENT: {
    target: "GITLAB_ISSUE",
    action: "create_issue",
    buildPayload: (intent) => ({
      title: `Incident: ${intent.reason}`,
      description: intent.reason,
      labels: [intent.priority, "incident"],
      priority: intent.priority,
      confidence: intent.confidence,
      reason: intent.reason,
    }),
    buildReason: (intent) =>
      `Create incident issue for priority ${intent.priority} at confidence ${intent.confidence}`,
  },
  ESCALATE: {
    target: "GITLAB_PIPELINE",
    action: "trigger_pipeline",
    buildPayload: (intent) => ({
      pipeline: "escalation-pipeline",
      variables: {
        priority: intent.priority,
        confidence: intent.confidence,
        reason: intent.reason,
      },
    }),
    buildReason: (intent) =>
      `Trigger escalation pipeline for priority ${intent.priority} at confidence ${intent.confidence}`,
  },
};

export const mapActionsToExecutionPlans = (
  actions: readonly ActionIntent[],
): readonly ExecutionPlan[] => {
  return actions.map((action) => {
    const mapping = mappings[action.type];
    const payload = mapping.buildPayload(action);
    const stablePayloadString = stableStringify(payload);
    const idempotencyKey = `matchops:${action.type}:${mapping.target}:${mapping.action}:${stablePayloadString}`;

    return {
      target: mapping.target,
      action: mapping.action,
      payload,
      idempotencyKey,
      reason: mapping.buildReason(action),
    };
  });
};
