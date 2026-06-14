# MatchOps Commander — Origin Archive

This folder contains the original MatchOps Commander codebase from the Rapid hackathon submission.

MatchOps was a sports-event drift detection system that monitored live match operations (transport, gates, staffing, vendors) and mapped drift to GitLab execution plans.

## Why It's Here

MatchOps provided the architectural foundation for Vigil:

- **Deterministic control path** — LLM explains, never decides
- **Phase-based pipeline** — Feed → Drift → Decision → Execution
- **Pure functions** — same inputs always produce same outputs
- **Audit trail** — every step produces a human-readable entry

## What Transferred to Vigil

```
MatchOps module    →    Vigil module
─────────────────────────────────────
src/events/        →    src/modules/ifrc/       (replaced)
src/drift/         →    src/modules/detect/     (adapted)
src/policy/        →    src/modules/decide/     (adapted)
src/execution/     →    src/modules/act/        (adapted)
src/demo/          →    src/demo/               (rewritten)
```

The control path principle — no model in the execution loop — transfers verbatim.

## Tech Stack (Original)

- TypeScript on Node.js
- Gemini (explanation only)
- GitLab MCP (execution)
- Splunk MCP (observability)
- 46 tests across all modules
