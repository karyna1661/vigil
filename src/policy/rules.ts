import type { DriftLevel } from "../drift/detector.js";
import type { ActionPriority, ActionType } from "./types.js";

export const KNOWN_PHASE_2_SIGNALS = [
  "transport-arrival-lag",
  "gate-queue-pressure",
  "staffing-gap",
  "vendor-readiness-gap",
  "critical-escalation",
] as const;

const knownPhase2SignalSet = new Set<string>(KNOWN_PHASE_2_SIGNALS);

export const CRITICAL_ESCALATION_SIGNAL = "critical-escalation";

export const CONFIDENCE_FORMULA_NAME = "phase-3-signal-count-confidence";

export const BASELINE_ACTION_BY_LEVEL: Record<
  DriftLevel,
  { type: ActionType; priority: ActionPriority }
> = {
  none: { type: "MONITOR", priority: "low" },
  warning: { type: "CREATE_INCIDENT", priority: "medium" },
  critical: { type: "ESCALATE", priority: "high" },
};

export const isKnownPhase2Signal = (signal: string): boolean =>
  knownPhase2SignalSet.has(signal);
