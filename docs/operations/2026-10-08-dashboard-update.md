# Daily dashboard update — 2026-10-08

User scope: daily market assessment, secondary information under snapshot metrics, consistent layout, centered Mã column reduced 30%, and adjacent session-change %.

The assessment now derives market context from the selected session, preserves saved narrative, suppresses empty groups, and uses scanner decisions for watch/retest/buy groups. Compact list rows no longer stretch vertically. All snapshot cards have secondary context. Mã width is 67.2px (previously 96px), with an adjacent 80px percent column.

Nullable stock_signals.change_pct is computed from FireAnt session reference, falling back to previous close only when reference is absent. Migration applied without access or score changes. All seven published 2026-10-08 rows were updated from exact-date FireAnt bars after matching database close; older rows lacking the value show —. DRI +3.09%, PVP +1.63%, BVH +3.18%, PVT +2.82%, NVB +4.40%, BSR +0.79%, MSR +5.90%.

Validation: 29 web unit tests, 64 scanner tests, 2 JS score tests, Python formula verification and Next.js production build passed. Production UI verification follows deployment.
