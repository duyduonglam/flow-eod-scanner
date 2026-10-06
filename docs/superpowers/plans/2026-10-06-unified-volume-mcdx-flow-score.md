# Unified Volume-MCDX-FLOW Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the local FireAnt scanner and the web GitHub Actions scanner use one deterministic 100-point score based on the supplied Volume/MCDX and FLOW/Swing scripts.

**Architecture:** Extract the shared scoring contract into a small, language-neutral specification and implement equivalent Python and JavaScript adapters around it. The web and local outputs will expose the same component breakdown, total score, score version, and decision inputs. Auto Chart patterns remain descriptive signals unless a pattern is confirmed; the supplied Pine script does not define a numeric pattern score.

**Tech Stack:** Python 3.11 scanner, JavaScript FireAnt CLI, pytest, existing Supabase persistence, Next.js read-only dashboard.

**Spec:** `D:/STOCK/20260711_Volumes + MCDX Line.txt` and `D:/STOCK/20260718_Flow system,Swing, Auto Chart.txt`

## Global Constraints

- FireAnt remains the primary price, volume, history, and news source.
- The score is point-in-time: no future bars, future news, or post-date revisions may affect a historical date.
- No secret may be printed, committed, or sent to the browser.
- One shared score version must be stored with every scan result.
- News is displayed and provenance-checked but does not change the numeric score when unavailable.
- Auto Chart output is a qualitative pattern label; it is not assigned arbitrary points without a deterministic rule in the source scripts.

## Review Focus

- Identical OHLCV input must produce identical component scores in Python and JavaScript; test in Task 1.
- Missing news must not change the score; test in Task 1.
- Low liquidity must be excluded consistently before ranking; test in Task 2.
- Historical scans must not use data after the requested date; test in Task 2.
- Web publication must preserve the same breakdown and score version as the local scan; test in Task 3.

### Common score contract

The first implementation will use these fixed weights:

| Component | Weight | Definition |
|---|---:|---|
| Trend Template / FLOW structure | 25 | The 11 daily template checks from the FLOW script, normalized to 25; includes MA50/150/200 alignment, 52-week position, RS >90, and Banker >90. |
| MCDX | 20 | Banker level/trend, Hot Money range, Retailer level, using the supplied periods/sensitivities. |
| Volume | 20 | Volume Buzz, U/D Volume ratio, current-vs-average volume, and high-volume confirmation. |
| RS | 15 | IBD-style relative-performance percentile versus VNINDEX, with the last quarter weighted double. |
| Swing / Entry | 20 | Swing direction, BB/RSI and EMA/DEMA confirmation, Entry Zone distance, and Stop Distance. |
| **Total** | **100** | Sum of the five components. |

The output will include `score_version: "volume-mcdx-flow-v1"` and a `score_components` object. News, chart-pattern labels, and source URLs remain separate fields.

### Task 1: Define and test the shared scoring contract

**Files:**
- Create: `apps/scanner/src/flow_scanner/flow/unified_score.py`
- Test: `apps/scanner/tests/test_unified_score.py`
- Modify: `tools/fireant_eod_scan.mjs`
- Test: `tools/fireant_eod_scan.test.mjs` or the existing JavaScript test entrypoint

- [ ] Write failing tests for the five components, the 100-point total, score version, missing-news invariance, and deterministic rounding.
- [ ] Run the focused tests and verify they fail because the unified scorer does not exist.
- [ ] Implement the Python scorer with explicit inputs for template checks, MCDX snapshot, volume metrics, RS rating, and swing/entry metrics.
- [ ] Implement the equivalent JavaScript scorer and replace the local script's independent total-score calculation with it.
- [ ] Run focused tests and then the complete local scanner test suite.

### Task 2: Use the shared score in the web scanner and ranking

**Files:**
- Modify: `apps/scanner/src/flow_scanner/main.py`
- Modify: `apps/scanner/src/flow_scanner/persistence.py`
- Modify: `apps/scanner/src/flow_scanner/flow/ranking.py`
- Modify: `apps/scanner/tests/test_scanner.py`
- Modify: `apps/scanner/tests/test_persistence.py`

- [ ] Add regression tests proving `flow_score`, `total_score`, and `score_components` are the unified values.
- [ ] Replace the current composite formula with the shared five-component contract.
- [ ] Persist `score_version` and component fields in `stock_signals`/`scan_results` without breaking existing rows.
- [ ] Keep existing liquidity gates and publish limits, but apply them after the unified score is calculated.
- [ ] Run all scanner tests and verify historical date filtering remains point-in-time.

### Task 3: Align the local output and web dashboard contract

**Files:**
- Modify: `tools/fireant_eod_scan.mjs`
- Modify: `apps/web/src/lib/view-model.ts` or the current API view-model module
- Modify: `apps/web/src/components/ScanTable.tsx` or the current table component
- Test: existing web unit tests plus a score-breakdown regression test

- [ ] Make both paths emit the same field names: `totalScore`, `scoreComponents`, `scoreVersion`, `flowLabel`, `decision`, `entryLow`, `entryHigh`, `stop`, and `oneR/twoR/threeR`.
- [ ] Show the component breakdown in the detail/diagnostic view while keeping the main table compact.
- [ ] Mark Auto Chart pattern labels separately from the numeric score and show the pattern date/confirmation state.
- [ ] Verify the web cannot silently fall back to the old score version.

### Task 4: Verify, deploy, and compare one real date

**Files:**
- Modify: `docs/` with the score contract and migration notes if required
- No secret files or generated scan outputs committed

- [ ] Run the full scanner tests, web tests, build, and static checks.
- [ ] Run both scanners for one historical date and compare all five component values and rankings.
- [ ] Commit and push only after the comparison is exact within the documented rounding tolerance.
- [ ] Trigger one production scan and verify Supabase row counts, score version, and production API output.


