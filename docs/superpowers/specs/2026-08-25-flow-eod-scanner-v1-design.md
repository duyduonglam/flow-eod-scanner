# FLOW EOD Scanner V1 Design

## Goal
Build an end-of-day Vietnam stock scanner for HOSE, HNX, and UPCoM that validates market data first, calculates deterministic FLOW/MCDX/RS signals outside TradingView, ranks candidates, and exposes results in a simple web dashboard.

## Source of truth
The user-provided Pine Script v6 indicators are the calculation baseline for V1 core logic:
- FLOW System: 11-check Trend Template, VNINDEX-relative RS framework, swing direction and price structure.
- MarketSmith Volumes + MCDX Lines: Volume Buzz, U/D Volume, Banker/Hot Money/Retailer and 10-period MCDX averages.

## Architecture
Market Data Providers -> Validator -> PostgreSQL/Supabase -> Python Scanner -> REST/API layer -> Next.js Dashboard -> Gemini commentary.

AI may explain signals, but may not calculate prices, FLOW scores, RS ratings, MCDX values, entry zones, stops, R multiples, or final deterministic fields.

## Data
Primary provider: FireAnt-compatible REST adapter.
Fallback: OpenStockAPI-compatible adapter.
Backfill target: 500 trading sessions.
Every stored observation records source and fetch timestamp.

A record is invalid if OHLC relationships fail, volume is negative, date is absent, or required data are missing. When two same-date provider observations disagree beyond a configurable tolerance, scanner status is DATA_CONFLICT and deterministic trade levels are not produced.

## FLOW Core
11 binary criteria:
1. Close > MA50
2. Close > MA150
3. Close > MA200
4. MA50 > MA150
5. MA50 > MA200
6. MA150 > MA200
7. MA200 > MA200[22]
8. Close within 25% of 52-week high
9. Close >25% above 52-week low
10. RS Rating > 90
11. Banker > 90%

Score = passed / 11 * 100. YES >=85, PARTIAL >=70, NO otherwise.

## RS
Relative performance uses 63/126/189/252-session stock performance relative to VNINDEX with weights 40/20/20/20. V1 converts the relative performance to a live percentile ranking across the active Vietnam equity universe rather than depending on the TradingView request.seed environment.

## MCDX
Banker = clamp(1.5 * (RSI(close,50)-50), 0, 20) * 5.
Hot Money = clamp(0.7 * (RSI(close,40)-30), 0, 20) * 5.
Retailer = max(20 - bankerRaw - hotMoneyRaw, 0) * 5.
Banker/Hot/Retailer MA are SMA(10).

RSI must use Wilder/RMA semantics to match Pine ta.rsi.

## Volume
Volume Buzz = current volume / SMA50(volume) - 1, in percent.
U/D Volume = sum(volume where close > prior close, 50 sessions) / sum(volume where close < prior close, 50 sessions).

## Decisions
Allowed deterministic decision labels: BUY, TEST BUY, BUY RETEST, WATCH, DO NOT CHASE, HOLD, TRIM, EXIT.
V1 implements conservative decision logic and labels weak/unknown data as WATCH rather than fabricating certainty.

## UI
Primary screen is table-first, responsive and easy to scan. Columns:
Mã | Điểm tổng | Tín hiệu chính | Tin tức nổi bật | Entry Zone | Stop | Stop Distance | 1R | 2R | 3R | Decision | Invalidation.

Stock detail shows current price, FLOW score, RS, MCDX, swing, volume metrics, 11-check checklist, trade plan, and AI commentary.

## Accuracy gate
Before production deployment, deterministic calculations must be validated against TradingView snapshots for representative tickers. No production deployment if MA/MCDX/volume/FLOW parity is materially wrong.


## V2 FLOW Strength scoring

Core 11 remains unchanged and continues to represent the primary Trend Template / RS / Banker foundation.

Final published score:

FLOW Strength = 0.70 * Core Score + 0.30 * Supplemental Score.

Core Score remains passed / 11 * 100.

Supplemental Score is deterministic, 0-100, and intentionally avoids re-scoring the absolute Core thresholds. It uses six groups:

1. Volume Quality — max 20
   - Volume Buzz
   - U/D Volume Ratio 50
   - HVE: up-day volume >= 1.5x Volume MA50
   - HV1: up-day volume is the highest volume in the latest 50 sessions

2. MCDX Quality — max 20
   - Banker above Banker MA10
   - Banker improving versus three sessions earlier
   - Retailer below Retailer MA10
   - Hot Money not in an excessively hot state

3. Setup — max 20
   - Five-session volume contraction versus the preceding 15 sessions
   - VCP proxy requires both range contraction and volume contraction
   - Distance to the prior 20-session pivot rewards a tight pre-breakout / early-breakout zone

4. Momentum Confirmation — max 15
   - Swing UP
   - RS line versus VNINDEX at a 63-session new high
   - Positive 20-session relative performance versus VNINDEX

5. Price Structure — max 10
   - Close position inside the latest 20-session range
   - Higher recent low

6. Risk / Timing — max 15
   - Structural stop distance
   - Distance from the prior pivot

Penalty is capped at 25 points and covers:
- price more than 5% above pivot,
- Swing DOWN,
- Volume Buzz below -50%,
- Banker below MA10 and falling,
- high-volume down-day distribution.

Grade:
- A+ >= 90
- A >= 85
- B >= 80
- C >= 75
- below 75 is outside the publication band.

The existing decision engine remains separate from FLOW Strength. A high-scoring stock may still be DO NOT CHASE when price is extended more than 5% above the pivot.
