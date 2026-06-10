# MatchOps Commander — Splunk Edition

AI incident command for live-event operations with Splunk observability.

MatchOps Commander detects operational drift during high-pressure live events, executes response work through GitLab, and preserves a visible audit trail — all deterministic, auditable, no LLM in the critical path.

Built for the [Splunk Agentic Ops Hackathon](https://splunk.devpost.com/) — Observability track.

## What It Does

Live event operations depend on WhatsApp threads, spreadsheets, and verbal escalation. Risks emerge before incidents are declared, but the people responsible often see them too late.

MatchOps Commander watches live operational signals, detects when things drift off baseline, decides what to do, and maps actions to GitLab execution plans — with idempotency keys and a full audit trail.

## Architecture

```
Feed (OpsEvent[]) → Drift (DriftState) → Decision (ActionIntent[]) → Execution (ExecutionPlan[])
```

| Phase     | Module           | What It Does                                                          |
| --------- | ---------------- | --------------------------------------------------------------------- |
| Feed      | `src/events/`    | Simulated operational event stream with configurable overrides        |
| Drift     | `src/drift/`     | Threshold-based drift detection with 4 rules + critical escalation    |
| Decision  | `src/policy/`    | Maps drift state to action intents with confidence scoring            |
| Execution | `src/execution/` | Maps action intents to GitLab execution plans with idempotency keys   |
| Demo      | `src/demo/`      | Interactive terminal-style UI with scenario presets and live pipeline |

**Core principles:**

- All pure functions — deterministic, no hidden state
- Same inputs always produce same outputs
- LLM explains decisions but does not own authoritative scoring or triggers
- Every step produces a human-readable audit entry

## Tech Stack

- **Runtime:** TypeScript on Node.js
- **AI Layer:** Gemini (explanation only — not in control path)
- **Execution:** GitLab MCP (issues, pipelines, comments)
- **Observability:** Splunk MCP Server (operational data ingestion, visualization, and alerting)
- **Testing:** Node.js built-in test runner

## Quick Start

```bash
npm install
npm test          # 46 tests
npm run check     # typecheck
npm run demo      # interactive demo on http://localhost:3001
```

## Demo

The interactive demo lets you:

1. **Select scenario presets** — Nominal, Warning, or Critical
2. **Adjust operational sliders** — transport delays, gate pressure, staffing gaps, vendor readiness
3. **Watch the pipeline** — see drift detection, action decisions, and execution plans update in real time
4. **Review the audit trail** — every decision is explained and traceable

## Project Structure

```
src/
├── demo/           # Interactive UI + HTTP server
├── drift/          # Drift detection rules and state machine
├── events/         # Event schema and simulated feed emitter
├── execution/      # Action intent → GitLab execution plan mapping
└── policy/         # Drift state → action intent decision policy

tests/              # 46 tests across all modules
```

## How It Works

1. **Feed:** Emits a stream of operational events (transport, gates, staffing, vendors) with configurable values
2. **Drift:** Compares each event against threshold rules and classifies state as `none`, `warning`, or `critical`
3. **Decision:** Maps drift state to action intents (MONITOR, CREATE_INCIDENT, ESCALATE) with confidence scores
4. **Execution:** Converts action intents into GitLab execution plans with deterministic idempotency keys

## License

MIT
