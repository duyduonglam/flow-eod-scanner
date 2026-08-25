from __future__ import annotations
from dataclasses import dataclass
from flow_scanner.flow.risk_engine import RLevels, compute_r_levels

@dataclass(frozen=True)
class TradePlan:
    entry_low: float | None
    entry_high: float | None
    stop: float | None
    decision: str
    invalidation: str
    chase_risk: str
    levels: RLevels | None


def build_trade_plan(highs: list[float], lows: list[float], closes: list[float], flow_score: float | None, swing: str | None, lookback: int = 20) -> TradePlan:
    if len(closes) < lookback + 1 or flow_score is None:
        return TradePlan(None, None, None, 'WATCH', 'Insufficient validated history', 'UNKNOWN', None)

    close = closes[-1]
    prior_pivot = max(highs[-lookback-1:-1])
    recent_support = min(lows[-10:])
    entry_low = prior_pivot
    entry_high = prior_pivot * 1.03
    # Conservative structural stop, but never wider than 8% from pivot for V1.
    stop = max(recent_support, prior_pivot * 0.92)
    levels = compute_r_levels((entry_low + entry_high) / 2, stop)

    extension = (close / prior_pivot - 1) * 100 if prior_pivot else 0
    if extension > 5:
        chase = 'HIGH'
    elif extension > 3:
        chase = 'MEDIUM'
    else:
        chase = 'LOW'

    if swing == 'DOWN' or flow_score < 70:
        decision = 'WATCH'
    elif extension > 5:
        decision = 'DO NOT CHASE'
    elif close >= prior_pivot and close <= entry_high:
        decision = 'BUY RETEST' if flow_score < 85 else 'BUY'
    elif close < prior_pivot and flow_score >= 85:
        decision = 'TEST BUY'
    else:
        decision = 'WATCH'

    invalidation = f'Close < {stop:.2f} or Swing DOWN'
    return TradePlan(entry_low, entry_high, stop, decision, invalidation, chase, levels)
