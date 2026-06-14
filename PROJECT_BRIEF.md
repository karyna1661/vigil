# Project Brief

This file is the one-page identity of the project.

Use this file for project identity only:
- what kind of project this is
- what problem it exists to solve
- what shape it should grow into

Do not use this file as the current execution contract.
Use phase specs and SEC files for what should be built right now.

## Project Name
Vigil

## Subtitle
Agentic deployment intelligence for humanitarian surge operations

## Mission
Detect unmet humanitarian response expectations using live IFRC data and Splunk-powered reasoning.

## Primary User
- humanitarian operations coordinators monitoring surge deployments
- IFRC field teams tracking alert-to-response gaps
- Splunk hackathon judges evaluating observability integration
- ops leads who need deterministic gap detection with causal explanation

## Core Problem
Humanitarian response systems generate alerts, but they don't reason about whether those alerts are being fulfilled. The IFRC GO platform has documented 327 surge alerts raised against only 35 deployments actually fulfilled. No system watches this gap, quantifies the risk, or explains why responses are delayed.

## Product Shape
A standing observer over real-world humanitarian signals inside Splunk. Not a dashboard. Not a pipeline. A loop that continuously asks: "what should have happened, but didn't?" It ingests real IFRC GO data, correlates alerts with responses, scores severity, and explains causality — all deterministic, auditable, no LLM in the critical path.

## Constraints
- Technical:
  - TypeScript on Node.js (plain, no framework)
  - Real IFRC GO API data only — no mocks, no synthetic data
  - Splunk HEC for ingestion, Splunk MCP for queries
  - Mimo / Splunk AI for explanation only — not in control path
  - All pure functions — deterministic, no hidden state
- Product:
  - same inputs always produce same outputs
  - every step produces a human-readable audit entry
  - LLM explains decisions but does not own authoritative scoring or triggers
  - if a signal is not in Splunk, it does not exist
- Time:
  - built for the Splunk Agentic Ops Hackathon — Observability track
  - 5-day execution window
- Safety:
  - operator override must remain available
  - automation gated by proof, not confidence alone
  - dry-run first for any execution action

## Non-Goals
- a general-purpose incident management platform
- replacing human judgment in humanitarian operations
- LLM-driven decision making in the critical path
- dashboards before the core loop is dependable
- fake data or simulated responses

## Success Signals
- real IFRC surge alerts flow into Splunk and are queryable via SPL
- alert-response gaps are detected and correlated automatically
- severity scores are computed from real time gaps and event pressure
- LLM explanations reference only provided data, no hallucination
- the observer loop runs continuously and outputs ranked humanitarian gaps
- judges can verify the data by calling the IFRC GO API directly

## Phase Sequence Notes
- Phase 0:
  - foundation: Project OS setup, project brief, phase specs, SEC configuration (COMPLETE)
- Phase 1:
  - ingestion: IFRC GO surge alerts + response events → Splunk HEC
- Phase 2:
  - correlation: Splunk MCP queries, alert-response gap detection
- Phase 3:
  - severity: deterministic scoring model (time gap, response missing, event pressure)
- Phase 4:
  - explanation: LLM causal reasoning layer (explains, never decides)
- Phase 5:
  - observer loop: continuous standing observer (observe → detect → score → explain → output)
- Phase 6:
  - packaging: Splunk app with AppInspect validation
- Phase 7:
  - demo: 3-minute winning demo + Devpost submission

## Working Rules
- raw ideas do not go straight into implementation
- active phase spec is the implementation contract
- build mode is the default implementation posture
- review mode is required before milestone acceptance
- proof and compaction are mandatory for meaningful milestones
