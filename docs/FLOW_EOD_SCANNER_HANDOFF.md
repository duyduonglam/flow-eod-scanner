# FLOW EOD Scanner Handoff

Last updated: 2026-10-07

This document is for handing the FLOW EOD Scanner project to another ChatGPT/Codex session so it can scan the Vietnam stock market, update the web dashboard, and adjust the formula when needed.

Do not paste or expose API keys, GitHub tokens, Supabase service-role keys, deploy keys, or other secrets in chat, source code, logs, frontend output, or reports.

## Project Summary

FLOW EOD Scanner scans Vietnam-listed stocks after market close using RS + MCDX + FLOW logic, writes the result to Supabase, and the Vercel web app reads that data.

Production web:

- `https://vnsuperstock.vercel.app`

Repository:

- Local repo: `C:\Users\ADMIN\Documents\DỊCH TÀI LIỆU\flow-eod-scanner`
- GitHub repo: `duyduonglam/flow-eod-scanner`

Current score version:

- `volume-mcdx-flow-v1`

Core data source:

- FireAnt is the preferred source for price, OHLCV, liquidity, symbols, and news/posts.
- The production scanner also has provider fallback behavior in the Python pipeline. Always state the actual data date used.

## Daily Operating Procedure

1. Trigger the scan after the Vietnam market has closed and FireAnt has published EOD bars.
2. Confirm the GitHub Actions workflow completes successfully.
3. Check the web API returns the new `market_date` and `data_status: LIVE`.
4. Report the result in Vietnamese with the required table format.
5. If the latest trading day has no valid market bar yet, do not force-write empty data. Report that the web is still showing the last valid session.

Preferred production trigger:

```bash
POST https://vnsuperstock.vercel.app/api/scan/manual
body: {}
```

The endpoint dispatches GitHub Actions and should not require the user to enter a manual secret on the web.

Workflow to monitor:

- Manual/web trigger currently uses `FLOW EOD Backfill`
- Latest verified workflow id used by the web helper: `352393256`
- Main scheduled workflow: `.github/workflows/eod_scan.yml`
- Backfill/manual one-day workflow: `.github/workflows/backfill_scan.yml`

GitHub Actions schedule:

- `.github/workflows/eod_scan.yml`
- Cron: `0 9 * * *`
- Vietnam time: 16:00 daily

## Production Web Check

Check latest or specific date:

```text
https://vnsuperstock.vercel.app/api/scan/latest?date=YYYY-MM-DD
```

Important fields to verify:

- `market_date`
- `data_status`
- `market_regime.market_mode`
- `market_regime.index_close`
- `market_regime.breadth_advancers`
- `market_regime.breadth_decliners`
- `market_regime.liquidity_value`
- `market_regime.exclusion_notes`
- `rows[].score_version`
- `rows[].flow_score`
- `rows[].decision`
- `rows[].headline_news`
- `rows[].headline_news_url`

Expected current score version:

```text
volume-mcdx-flow-v1
```

## Required Report Format

Open with:

- Scan date
- Actual price data date
- Main source
- Exclusion rule

Main table columns:

```text
| Mã/Giá hiện tại | Điểm tổng | Tín hiệu chính | Tin tức nổi bật | Entry Zone | Stop & Distance | R Targets | Decision |
```

Ticker cell format:

```html
**PVP**<br>24,60
```

R Targets format:

```text
1R: x / 2R: y / 3R: z
```

After the table, include:

- Đánh giá nhanh
- Loại trừ đáng chú ý
- Invalidation chung if needed
- Disclaimer: this is a quantitative watchlist, not personal investment advice

## Score Formula: volume-mcdx-flow-v1

The active formula lives in:

- Python scanner: `apps/scanner/src/flow_scanner/flow/unified_score.py`
- JS local script mirror: `tools/unified_score.mjs`

Total score = 100 points:

| Component | Max Points | Purpose |
|---|---:|---|
| FLOW / Trend | 25 | Trend structure and setup quality |
| MCDX | 20 | Banker, hot money, retailer pressure |
| Volume | 20 | Volume confirmation and up/down participation |
| RS | 15 | Relative strength percentile |
| Swing / Entry | 20 | Entry location, stop distance, not extended |

### FLOW / Trend: 25 points

Uses 11 checks. Points are proportional:

```text
FLOW = min(25, 25 * true_check_count / max(check_count, 11))
```

Checks include:

- Close > MA50
- Close > MA150
- Close > MA200
- MA50 > MA150
- MA50 > MA200
- MA150 > MA200
- MA200 rising over 22 sessions
- Close >= 75% of 52-week high
- Close >= 125% of 52-week low
- RS rating > 90
- Banker > 90

Known issue: RS and Banker also appear in separate components, so there is some double counting. If revising the formula, consider removing RS and Banker from FLOW and keeping FLOW purely trend-structure based.

### MCDX: 20 points

| Condition | Points |
|---|---:|
| Banker > 50 | +5 |
| Banker >= Banker MA | +4 |
| Banker rising | +3 |
| Hot money between 30 and 90 | +4 |
| Retailer <= 30 | +2 |
| Banker >= 70 and Banker >= Banker MA | +2 |

### Volume: 20 points

| Condition | Points |
|---|---:|
| Volume buzz > 0 | +4 |
| Volume buzz > 50 | +3 |
| Up/down volume ratio > 1 | +4 |
| Up/down volume ratio > 1.5 | +3 |
| Current volume above average | +3 |
| Current volume is a recent high | +3 |

### RS: 15 points

| RS Rating | Points |
|---|---:|
| > 90 | 15 |
| > 80 | 10 |
| > 70 | 5 |
| <= 70 | 0 |

### Swing / Entry: 20 points

| Condition | Points |
|---|---:|
| Swing up | +5 |
| In Entry Zone | +6 |
| Near Entry Zone | +3 |
| Stop distance <= 8% | +4 |
| Stop distance <= 10% | +2 |
| Not extended | +5 |

## Two Scanner Paths

There are two meaningful scan paths. They are related but not identical.

### 1. Production Python Scanner

Entry point:

```bash
python -m flow_scanner.cli
```

Used by:

- `.github/workflows/eod_scan.yml`
- `.github/workflows/backfill_scan.yml`
- Web manual scan button

It writes/upserts to Supabase and powers the web dashboard.

Typical output is narrower. For example, on 2026-10-07 it published only:

- `PVP`
- `PVT`

Reason: production publish logic is stricter and focuses on the main actionable dashboard.

### 2. Local FireAnt Radar Script

Script:

```bash
node tools\fireant_eod_scan.mjs --date=YYYY-MM-DD --output=fireant_eod_scan_YYYY-MM-DD_dryrun.json
```

This script reads FireAnt directly and writes a local JSON file. It does not update Supabase unless separately integrated.

It is a wider radar. On 2026-10-07 it scanned:

- Universe: 1,522 symbols
- Eligible after filters: 32 symbols
- Top examples: `DRI`, `PVT`, `BVH`, `PVP`, `BSR`, `MSR`, `NVB`, `GVR`, `FRT`, `MSN`

Important difference:

- `fireant_eod_scan.mjs` keeps `HOLD` and `DO NOT CHASE` rows in the output.
- Production web is more selective.

Recommended future UI model:

- Main Table: actionable `BUY`, `BUY RETEST`, `WATCH near Entry Zone`
- Extended Radar: strong but extended names, including `HOLD` and `DO NOT CHASE`

## Manual Scan And Backfill

Manual scan from web:

- Calls `/api/scan/manual`
- Uses GitHub Actions dispatch
- Current helper: `apps/web/src/lib/manual-scan.ts`
- Tests: `apps/web/src/lib/manual-scan.test.ts`

Backfill old dates:

- Use `.github/workflows/backfill_scan.yml`
- Inputs: `start_date`, `end_date`, `limit`
- It runs each weekday in the range.

If a date has no valid provider bar:

- Workflow may complete `success` but show warning:

```text
Backfill failed or no market bar for YYYY-MM-DD
```

In that case, the web should keep the latest valid session and should not create empty rows.

## Supabase Tables

The scanner/web use these tables:

- `market_regimes`
- `symbols`
- `daily_prices`
- `stock_signals`
- `scan_results`
- `news_items`

Useful validation query:

```sql
select 'scan_results' as table_name, count(*)::int as row_count
from public.scan_results where market_date = date 'YYYY-MM-DD'
union all
select 'news_items', count(*)::int
from public.news_items where market_date = date 'YYYY-MM-DD'
union all
select 'stock_signals', count(*)::int
from public.stock_signals where market_date = date 'YYYY-MM-DD'
union all
select 'market_regimes', count(*)::int
from public.market_regimes where market_date = date 'YYYY-MM-DD';
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in any response.

## Secrets Required

GitHub repository secrets for scanner workflows:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREANT_API_KEY`
- `OPENSTOCK_API_KEY`

Vercel production env vars for web manual scan:

- `GITHUB_ACTIONS_DISPATCH_TOKEN`
- Optional: `MANUAL_SCAN_SECRET` if the UI/API is changed to require one again

Token requirements:

- GitHub fine-grained token
- Repository: `duyduonglam/flow-eod-scanner`
- Permission: Actions read/write

Never print token values.

## Verification Commands

From repo root:

```bash
python .github\scripts\verify_unified_score.py
```

Expected output:

```text
Using unified score: volume-mcdx-flow-v1
```

Web tests:

```bash
cd apps\web
npm.cmd test
npm.cmd run build
```

Scanner tests:

```bash
python -m pytest -q apps/scanner/tests
```

On Windows, prefer `npm.cmd` over `npm` because PowerShell may block `npm.ps1`.

## Troubleshooting

### Web still shows yesterday

Check:

- Did GitHub Actions complete?
- Did workflow warn `no market bar`?
- Does `/api/scan/latest?date=YYYY-MM-DD` return the requested date?

If provider has no EOD bar yet, do not force update. Report that the latest valid session remains on web.

### Manual scan queued but nothing changes

Likely causes:

- FireAnt has not published the EOD bar yet.
- Workflow dispatch token is invalid or lacks Actions write.
- Workflow ID/config changed.
- Scanner completed with warning but no data was written.

### News is missing

The production scanner may publish price/signal rows even when news is missing. Do not invent news URLs.

Preferred behavior:

- Show real news title and URL if present.
- If no fresh news exists, keep older verified news in the general news box where the web supports it.
- Do not create Google search links as substitutes for real source URLs.

### Too few symbols on web

Production scanner is narrower than the local FireAnt radar script. If the user wants more coverage, add an Extended Radar section instead of loosening the main table too much.

### Formula feels double counted

Known overlap:

- RS appears in both FLOW checks and RS component.
- Banker appears in both FLOW checks and MCDX component.
- Volume has several related checks.
- Entry/extended status appears in both score and decision.

Suggested next version:

```text
volume-mcdx-flow-v2
Trend Structure: 20
RS: 20
MCDX: 20
Volume: 15
Entry Quality: 20
Liquidity Quality: 5
Risk Penalty: 0 to -15
```

If implementing v2:

- Update `apps/scanner/src/flow_scanner/flow/unified_score.py`
- Update `flow-eod-scanner/tools/unified_score.mjs`
- Update tests in `apps/scanner/tests/test_unified_score.py`
- Update tests in `tools/unified_score.test.mjs`
- Update `.github/scripts/verify_unified_score.py`
- Run scanner tests, web tests, and build before pushing

## Recent Known Baseline

2026-10-07 production Python scanner result:

- Market date: `2026-10-07`
- Data status: `LIVE`
- Market mode: `NORMAL`
- VNINDEX: `1,753.39`
- Main rows: `PVP`, `PVT`
- Score version: `volume-mcdx-flow-v1`

2026-10-07 local FireAnt radar result:

- Universe: `1,522`
- Eligible: `32`
- Top radar rows included: `DRI`, `PVT`, `BVH`, `PVP`, `BSR`, `MSR`, `NVB`, `GVR`, `FRT`, `MSN`

This difference is expected under the current system.

## Preferred Handoff Instruction For Future ChatGPT

Use this when starting a new ChatGPT/Codex session:

```text
You are continuing the FLOW EOD Scanner project.
Read FLOW_EOD_SCANNER_HANDOFF.md first.
Do not expose secrets.
Use FireAnt as the preferred data source.
For daily production updates, trigger the web manual scan endpoint, monitor GitHub Actions, then verify /api/scan/latest.
If changing formula, update Python and JS score implementations plus tests.
If comparing formulas, run dry-run only and do not write Supabase unless explicitly asked.
Report in Vietnamese using the required table format and state the actual data date.
```
