# 2026-10-08 universe correction

Revision: `2026-10-08-full-universe-pagination-1`.
Reason: fix silent truncation of the configured stock universe at the Supabase REST row cap.

Before correction:
- Actions run: https://github.com/duyduonglam/flow-eod-scanner/actions/runs/37765237891.
- Scanner log: requested/actual date 2026-10-08; active_symbols 1000; scanned 977; published 3; FireAnt; price fallback none; conflicts [].
- SQL confirms 1524 active stock records in the configured Supabase universe.
- Previous public result preserved in `2026-10-08-before-full-universe.json` (market regime plus PVP, PVT, NVB).
- The previous run logged VERIFIED but did not cover the configured universe. Its 209 advancers/229 decliners and liquidity are based on the scanned histories, not exchange-wide statistics.

Changes:
- Paginate active symbols in stable ID order until an empty page, advancing by the actual returned count to accommodate lower server limits.
- Increase the backfill per-session timeout from 8 to 20 minutes: the truncated 1000-symbol run took about 7m43s.
- Preserve the current formula and publication parameters.

Validation before publishing the patch: 63 scanner tests pass, including regression cases for 1524/2000 symbols and a reduced 200-row server cap. Score contract and JS parity tests are checked separately.

Completion evidence and corrected-at time will be appended after the new run and web verification. LIVE and the legacy CLI VERIFIED label are not equivalent to full v1.2 certification; missing-history classifications and complete provenance remain limitations.

## Trigger repair

First correction attempt: Actions run 37768187019 passed all 63 scanner tests but failed before scanning with an empty REQUEST_FILE. Reproduced cause: checkout's default depth 1 makes `git diff-tree HEAD` unable to report the parent diff. A real Git fixture returned no request at depth 1 and the correct request at depth 2. Set checkout fetch-depth to 2. No data was written by that failed attempt.

## Completed verification

Corrected at: 2026-10-08T11:24:19Z (18:24:19 Vietnam); web checked at 2026-10-08T11:26:36.038470+00:00.

- Successful run: https://github.com/duyduonglam/flow-eod-scanner/actions/runs/37768435407, source commit fecc3f85e0ef1f026ba327f331dc45adb1992114.
- Requested date = actual date = 2026-10-08.
- Configured active-stock universe 1524 (HOSE 405, HNX 299, UPCOM 820); attempted through the complete paginated list.
- Valid same-day histories scored: 1486 (97.51%); 38 symbols have no valid signal in this run. Detailed rejection/error classifications are not persisted by the legacy pipeline.
- FireAnt price source; no price fallback; conflicts reported as []. Primary-only mode does not provide an independent source cross-check.
- Published 7 scan_results, 1486 stock_signals, 4 news_items, 1 market_regime; SQL counts verified.
- Web API `/api/scan/latest?date=2026-10-08`: market_date 2026-10-08; data_status LIVE; 7 rows; every score_version volume-mcdx-flow-v1.
- Rows: DRI 85.7 TEST BUY; PVP 83.0 WATCH; BVH 80.9 WATCH; PVT 79.2 BUY RETEST; NVB 78.5 WATCH; BSR 77.7 WATCH; MSR 76.0 BUY RETEST.
- Three rows score >=80, four score 75–79.9.
- VNINDEX 1738.97 (-0.8224%), RISK OFF. Scanned-history breadth 313 advancers/340 decliners; current-value aggregate 16,985,411,213,970 VND. These aggregates describe the valid scanned histories, not separately verified exchange totals.
- Liquidity exclusions reported: 1387 histories, under the unchanged >=20B average/20 sessions and >=5B current-session publication rules.
- News primary Vietstock returned 403; actual news fallback FireAnt posts published 4 items. BVH/BSR headline URLs are absent; do not represent them as independently verified original articles.
- Stop Distance and R targets use the midpoint of Entry Zone, not current close.
- Scanner tests 63/63, score contract and JS tests 2/2 passed; GitHub Web Checks success; GitHub Vercel deployment status success.
- Prior public result and corrected public result are preserved in the adjacent before/after JSON files.

Status interpretation: LIVE/PUBLISHED verified on the production API and database. The CLI emitted its legacy VERIFIED label; full canonical v1.2 certification is not claimed because per-symbol rejection classifications, corporate-action evidence, cross-checks and complete source provenance are not available in this run report.
