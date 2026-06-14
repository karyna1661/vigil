# Phase 6 Checklist — Splunk App Packaging

## Status: Implementation Complete, Manual Steps Remaining

## What's Done ✅

- [x] Splunk app directory structure created (`splunk-app/vigil/`)
- [x] `app.conf` written with correct metadata
- [x] `savedsearches.conf` with 3 saved searches
- [x] `metadata/default.meta` with permissions
- [x] `vigil_dashboard.xml` with 3 panels
- [x] `README.txt` with installation instructions
- [x] HEC output for scored gaps (`sourcetype=vigil:scored_gap`)
- [x] HEC output for cycle results (`sourcetype=vigil:metrics`)

## Manual Steps Required

### Task 0: Create `index=vigil` in Splunk

**Option A — Via Splunk Web:**
1. Go to Settings → Indexes → New Index
2. Index Name: `vigil`
3. Index Data Type: Event
4. Save

**Option B — Via Splunk Search:**
```spl
| datamodel null search | head 1 | eval index="vigil" | outputlookup index名录
```

**Option C — Via CLI (on Splunk server):**
```bash
$SPLUNK_HOME/bin/splunk add index vigil -remote_servers <server>
```

### Task 8: Run AppInspect Validation

**Install AppInspect:**
```bash
pip install splunk-app-inspect
```

**Run validation:**
```bash
python -m splunk_appinspect splunk-app/vigil/ --output-format=txt
```

**Expected:** Zero errors, zero warnings

### Task 9: Package the .spl File

**Install packaging toolkit:**
```bash
pip install splunk-packaging-toolkit
```

**Package the app:**
```bash
cd splunk-app
tar -czf vigil.spl vigil/
```

**Or using the toolkit:**
```bash
splunk-package vigil/
```

**Output:** `vigil.spl` — ready for upload to Splunk

## Install the App

1. Open Splunk Web
2. Go to Settings → Apps → Install app from file
3. Upload `vigil.spl`
4. Restart Splunk if prompted
5. Access dashboard: Splunk Web → Vigil → Humanitarian Gap Monitor

## Verify End-to-End Flow

1. Run observer loop: `npm run vigil`
2. Open Splunk Web → Search & Reporting
3. Run: `index=vigil | table _time, country, severity_level, severity_score`
4. Check dashboard: Splunk Web → Vigil → Humanitarian Gap Monitor
5. Verify 3 panels show real data

## Troubleshooting

- **No data in `index=vigil`:** Check HEC token and URL in `.env`
- **Dashboard empty:** Ensure `index=vigil` exists and observer loop has run
- **AppInspect errors:** Check file permissions in `metadata/default.meta`
