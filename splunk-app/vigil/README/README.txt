# Vigil — Splunk App

Agentic deployment intelligence for humanitarian surge operations.

## Installation

1. Create `index=vigil` in Splunk
2. Install `vigil.spl` via Splunk Web (Settings → Apps → Install app from file)
3. Ensure HEC is enabled with token configured in `.env`
4. Run the observer loop: `npm run vigil`

## Dashboard

Access via Splunk Web → Vigil → Humanitarian Gap Monitor

Three panels:
- Active Gaps by Country (top 10)
- Severity Distribution (pie chart)
- Critical Alerts Aging (>7 days)

## Saved Searches

- `vigil_active_gaps` — Open gaps by country
- `vigil_severity_distribution` — Severity level counts
- `vigil_critical_aging` — Alerts open longer than 7 days

## Data Sources

- `index=vigil sourcetype=ifrc:surge_alert` — Raw IFRC alerts
- `index=vigil sourcetype=vigil:scored_gap` — Scored + explained gaps
- `index=vigil sourcetype=vigil:metrics` — Pipeline health metrics
