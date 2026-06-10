export type ActionType = "MONITOR" | "CREATE_INCIDENT" | "ESCALATE";

export type ActionPriority = "low" | "medium" | "high";

export type ActionIntent = {
  type: ActionType;
  priority: ActionPriority;
  confidence: number;
  reason: string;
};
