# FLOW EOD Scanner — project memory

Updated: 2026-10-08 (Asia/Ho_Chi_Minh).

## Read first

- `docs/FLOW_EOD_SCANNER_HANDOFF.md`: operational handoff supplied by the user.
- `docs/20261001_Data_Acquisition_API_Standard_v1.2_Scoring_Agnostic.md`: canonical, scoring-agnostic data contract supplied by the user.
- `docs/operations/2026-10-08-universe-correction.md`: production findings and correction audit.

## Project identity and current behavior

- Repository: `duyduonglam/flow-eod-scanner`, default branch `main`.
- Production: https://vnsuperstock.vercel.app/.
- Supabase project: `cyyffkziqiefrxmbdmyr` (`flow-eod-scanner`). This is separate from `flow-fireant-sandbox` and the Sites dashboards.
- Active formula: `volume-mcdx-flow-v1`: FLOW/Trend 25, MCDX 20, Volume 20, RS 15, Swing/Entry 20. Do not replace it with V5/V6 from another project or older conversation.
- Python scorer: `apps/scanner/src/flow_scanner/flow/unified_score.py`; JS mirror: `tools/unified_score.mjs`. Formula changes require explicit user scope, matching tests and both implementations.
- Current production rules, observed in code: at least 260 validated bars; average 20-session trade value >=20 billion VND; current-session trade value >=5 billion VND; published score >=75; maximum 10 published rows. Trade value = close in thousand VND ×1000×volume. The exact current comparisons are >=, not strict >; any requested strict-boundary change needs a separate patch.
- Price acquisition in the production CLI is FireAnt-only, with a 90% valid-history coverage gate. Do not describe fallback as used without run evidence. News can fall back from Vietstock to FireAnt posts.
- Load every page of the active-stock universe in stable ID order; never assume one Supabase response contains all symbols. Calculate RS over the same-day validated histories before liquidity/publication filtering.
- Main scheduled workflow: `.github/workflows/eod_scan.yml`, `0 9 * * *` (16:00 Vietnam). Manual one-day workflow: `.github/workflows/backfill_scan.yml`, workflow ID `352393256`.

## Daily operation and honest status

1. Use Vietnam dates, wait for EOD bars, request the exact session (no lookback for a one-day correction).
2. Prefer the dashboard manual scan button. POST `/api/scan/manual` now checks Origin/Referer, so the handoff's bare curl example is not sufficient. Do not remove the origin check or expose secrets.
3. An existing supported trigger is a new `.github/scan_requests/*.json` file on main containing `market_date`; the backfill workflow reads it. Use one unique request per intended run.
4. Wait for Actions, inspect the actual scanner JSON/logs, verify the Supabase counts and `/api/scan/latest?date=YYYY-MM-DD` (which can fall back to another date).
5. Report requested date, actual data date, actual source, active universe, valid histories, conflicts and news availability.
6. `data_status: LIVE` means database-backed data, not full Data Contract v1.2 certification. The current CLI's `pipeline_status: VERIFIED` is based on its 90% coverage gate; do not upgrade that claim to full-universe VERIFIED without exclusion/error/provenance evidence.
7. Preserve prior published results and record revision, reason and correction time when correcting coverage. Do not force-write empty data or fabricate news/URLs.

## Reporting and interface preferences

Respond in Vietnamese. Required table:
`Mã/Giá hiện tại | % thay đổi phiên | Điểm tổng | Tín hiệu chính | Tin tức nổi bật | Entry Zone | Stop & Distance | R Targets | Decision`.
Follow with a brief assessment, notable exclusions and relevant invalidation. Mark absent verified ticker news as unavailable. Treat decisions as scanner labels, not personal trade recommendations.
For future UI edits, elements at the same level must share typography, size, spacing and alignment; prioritize balanced, consistent presentation.

## Verification

- `PYTHONPATH=apps/scanner/src python -m pytest -q apps/scanner/tests`
- `PYTHONPATH=apps/scanner/src python .github/scripts/verify_unified_score.py`
- `node --test tools/unified_score.test.mjs`
- Run web tests/build when changing web code.
- Never expose tokens, API keys, service-role keys or credential-bearing logs.

## Latest completed session

2026-10-08 correction run 37768435407: active universe 1524, valid histories 1486, published rows 7, price source FireAnt without fallback, web LIVE. DRI/PVP/BVH score >=80; PVT/NVB/BSR/MSR score 75–79.9. See the correction audit and before/after snapshots; do not claim full Data Contract v1.2 certification from the legacy VERIFIED label alone.

## Daily dashboard behavior (2026-10-08)

- Quick assessment derives market context from the selected session's regime, VNINDEX change, breadth and distribution flag; preserve saved per-session editorial notes. Only show ticker groups with matching data; use decision labels for retest/watch/buy groupings.
- All five snapshot cards include a consistent secondary description. Breadth and liquidity describe the scanned data set, not exchange-wide totals.
- The Mã column is centered and 30% narrower (96px → 67.2px); adjacent % uses `stock_signals.change_pct`, computed from the same session's reference price (previous close only if reference absent). Show missing values as —, never as zero. Green/red denote rise/fall.
- Migration `20261008132113_stock_signal_change_pct.sql` adds the nullable field without changing scoring or publication rules.

- Snapshot follows the five-card market overview reference: selected data session, VN-Index, breadth, scanned-set trade value, and foreign buy/sell availability. Counts come from saved same-day stock_signals, not another project. Foreign flow is unavailable in the current database; never copy the reference image values. Liquidity comparison is between saved scanned sets, whose coverage can differ.
- Both Mã and % columns use the same 67.2px width and centered headers/cells.
