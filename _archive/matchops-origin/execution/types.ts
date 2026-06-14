export type ExecutionTarget = "GITLAB_ISSUE" | "GITLAB_PIPELINE" | "GITLAB_COMMENT";

export type ExecutionPlan = {
  target: ExecutionTarget;
  action: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  reason: string;
};
