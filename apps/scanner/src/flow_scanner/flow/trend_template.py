from __future__ import annotations
from dataclasses import dataclass
from flow_scanner.indicators.moving_averages import sma

@dataclass(frozen=True)
class TrendTemplateResult:
    checks: dict[str, bool]
    pass_count: int
    total_count: int
    score_pct: float
    label: str
    ma50: float
    ma150: float
    ma200: float
    high_52w: float
    low_52w: float


def compute_trend_template(
    closes: list[float], highs: list[float], lows: list[float],
    rs_rating: float | None, banker: float | None,
) -> TrendTemplateResult | None:
    if not (len(closes) == len(highs) == len(lows)) or len(closes) < 222:
        return None
    ma50s = sma(closes, 50)
    ma150s = sma(closes, 150)
    ma200s = sma(closes, 200)
    ma50 = ma50s[-1]
    ma150 = ma150s[-1]
    ma200 = ma200s[-1]
    ma200_prev = ma200s[-23] if len(ma200s) >= 222 else None
    if None in (ma50, ma150, ma200, ma200_prev):
        return None

    window = min(252, len(closes))
    high_52w = max(highs[-window:])
    low_52w = min(lows[-window:])
    close = closes[-1]
    checks = {
        'close_gt_ma50': close > ma50,
        'close_gt_ma150': close > ma150,
        'close_gt_ma200': close > ma200,
        'ma50_gt_ma150': ma50 > ma150,
        'ma50_gt_ma200': ma50 > ma200,
        'ma150_gt_ma200': ma150 > ma200,
        'ma200_rising_22d': ma200 > ma200_prev,
        'within_25pct_52w_high': close >= high_52w * 0.75,
        'above_25pct_52w_low': close >= low_52w * 1.25,
        'rs_gt_90': rs_rating is not None and rs_rating > 90,
        'banker_gt_90': banker is not None and banker > 90,
    }
    passed = sum(checks.values())
    score = passed / 11 * 100.0
    label = 'YES' if score >= 85 else 'PARTIAL' if score >= 70 else 'NO'
    return TrendTemplateResult(checks, passed, 11, score, label, float(ma50), float(ma150), float(ma200), high_52w, low_52w)
