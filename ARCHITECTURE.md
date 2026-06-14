# Vigil — Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIGIL SYSTEM ARCHITECTURE                        │
│                 Agentic Deployment Intelligence for Humanitarian Ops        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   IFRC GO API    │  Live humanitarian surge alerts (327 raised, 35 fulfilled)
│   (External)     │  https://goadmin.ifrc.org/api/v2/surge_alert/
└────────┬─────────┘
         │ fetch (REST API)
         ▼
┌──────────────────┐
│   PHASE 1        │  Ingestion Pipeline
│   INGEST         │  - Fetch alerts from IFRC GO
│   (ingest.ts)    │  - Deduplicate by alert ID
│                  │  - Send to Splunk HEC
└────────┬─────────┘
         │ HEC (HTTP Event Collector)
         │ sourcetype: ifrc:surge_alert
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SPLUNK (index=vigil)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ ifrc:surge_alert│  │ vigil:scored_gap│  │ vigil:metrics   │            │
│  │ (Raw Alerts)    │  │ (Scored Gaps)   │  │ (Pipeline Health)│            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└────────┬────────────────────────────────────────────────────────────────────┘
         │ query (SPL via REST API)
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VIGIL OBSERVER LOOP (vigil.ts)                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CYCLE: observe → detect → score → explain → output → sleep         │   │
│  │ Interval: 30s (configurable) | Timeout: 15s (Splunk) + 8s (LLM)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐  │
│  │   PHASE 2    │   │   PHASE 3    │   │   PHASE 4    │   │   OUTPUT   │  │
│  │   DETECT     │   │   SCORE      │   │   EXPLAIN    │   │            │  │
│  │              │   │              │   │              │   │            │  │
│  │ Filter:      │   │ Formula:     │   │ LLM:         │   │ Ranked     │  │
│  │ critical +   │   │ timeGap(0.5) │   │ Splunk AI    │   │ gaps +     │  │
│  │ severe gaps  │   │ +response(0.3│   │ (primary) or │   │ explanations│  │
│  │              │   │ +pressure(0.2│   │ Mimo         │   │ + audit    │  │
│  │ detect.ts    │   │              │   │ (fallback)   │   │ trail      │  │
│  │              │   │ severity.ts  │   │              │   │            │  │
│  │              │   │              │   │ explain.ts   │   │ vigil.ts   │  │
│  └──────────────┘   └──────────────┘   └──────────────┘   └────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TYPES (types.ts) — Shared across all phases                        │   │
│  │ WorldState → SeverityOutput → Explanation → CycleResult            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────┬────────────────────────────────────────────────────────────────────┘
         │ HEC (POST scored gaps + cycle metrics)
         │ sourcetype: vigil:scored_gap / vigil:metrics
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPLUNK VISUALIZATION                               │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ Active Gaps by      │  │ Severity            │  │ Critical Alerts   │  │
│  │ Country (Top 10)    │  │ Distribution (Pie)  │  │ Aging (>7 days)   │  │
│  └─────────────────────┘  └─────────────────────┘  └───────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Saved Searches: vigil_active_gaps | vigil_severity_distribution    │   │
│  │                  vigil_critical_aging                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DESIGN PRINCIPLES                                │
│                                                                             │
│  1. TRUTH / JUDGMENT / EXPLANATION                                          │
│     Phase 2 → Truth (what exists)                                          │
│     Phase 3 → Judgment (how bad)                                           │
│     Phase 4 → Explanation (why it matters)                                 │
│                                                                             │
│  2. DETERMINISTIC CORE                                                      │
│     - LLM explains, never decides                                          │
│     - Scoring is formulaic (0.5/0.3/0.2 weights)                           │
│     - Every output is traceable and auditable                              │
│                                                                             │
│  3. BOUNDED AI                                                              │
│     - LLM receives only structured JSON input                              │
│     - Output validated with upper bounds                                   │
│     - Fallback on any failure (never crashes)                              │
│                                                                             │
│  4. REAL DATA ONLY                                                          │
│     - Live IFRC GO API (no mocks, no synthetic data)                       │
│     - Every data point verifiable at source                                │
│     - "If a signal is not in Splunk, it does not exist"                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TECH STACK                                        │
│                                                                             │
│  Runtime:      TypeScript on Node.js                                        │
│  Data Source:   IFRC GO API (live, public)                                  │
│  Ingestion:    Splunk HEC (HTTP Event Collector)                           │
│  Query Layer:  Splunk REST API / MCP Server                                 │
│  AI Layer:     Splunk AI (primary) / Mimo (fallback)                          │
│  Packaging:    Splunk App (.spl) with AppInspect                          │
│  Testing:      Node.js built-in test runner (22 tests)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```
