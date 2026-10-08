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
