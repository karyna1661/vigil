# Vigil — Architecture

![System Architecture](docs/architecture.svg)

## Data Flow

```
IFRC GO API (live) → Ingest → Splunk HEC → Splunk Index → Observer Loop → Splunk HEC → Dashboard
```

## Observer Cycle

```
observe → detect → score → explain → output → sleep (30s)
```

| Phase | File | Purpose |
|-------|------|---------|
| Observe | `src/vigil.ts` | Fetch alerts from IFRC GO API |
| Detect | `src/detect.ts` | Filter critical/severe gaps |
| Score | `src/severity.ts` | Deterministic severity scoring (0.5/0.3/0.2 weights) |
| Explain | `src/explain.ts` | LLM explanations (Splunk AI → Mimo → Template) |
| Output | `src/vigil.ts` | Post scored gaps to Splunk HEC |

## Design Principles

1. **Truth → Judgment → Explanation** — Phase 2 (what exists), Phase 3 (how bad), Phase 4 (why it matters)
2. **Deterministic Core** — LLM explains, never decides. Scoring is formulaic.
3. **Bounded AI** — LLM receives only structured JSON. Output validated with upper bounds.
4. **Real Data Only** — Live IFRC GO API. No mocks, no synthetic data.

## Tech Stack

- **Runtime:** TypeScript on Node.js
- **Data Source:** IFRC GO API (live, public)
- **Ingestion:** Splunk HEC (HTTP Event Collector)
- **Query Layer:** Splunk REST API / MCP Server
- **AI Layer:** Splunk AI (primary) / Mimo (fallback)
- **Packaging:** Splunk App (.spl) with AppInspect
- **Testing:** Node.js built-in test runner (27 tests)
