import type { WorldState } from "./types.js";

export function detect(states: WorldState[]): WorldState[] {
  return states.filter(
    (s) => s.gap_severity === "critical" || s.gap_severity === "severe"
  );
}
