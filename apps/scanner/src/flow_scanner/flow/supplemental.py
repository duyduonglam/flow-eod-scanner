from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SupplementalResult:
    score: float
    components: dict[str, float]
    penalty: float
    hv1: bool
    hve: bool
    volume_contraction: bool
    vcp: bool
    rs_new_high: bool
    pivot_distance_pct: float | None
    stop_distance_pct: float | None


def _mean(values: list[float | int]) -> float | None:
    if not values:
        return None
    return sum(float(v) for v in values) / len(values)


def _mcdx_value(series: dict[str, list[float | None]], name: str, offset: int = 0) -> float | None:
    values = series.get(name, [])
    idx = len(values) - 1 - offset
    if idx < 0:
        return None
    return values[idx]


def _rs_new_high(stock_closes: list[float], index_closes: list[float], lookback: int = 63) -> bool:
    n = min(len(stock_closes), len(index_closes))
    if n < lookback + 1:
        return False
    stock = stock_closes[-n:]
    index = index_closes[-n:]
    ratios = [s / i for s, i in zip(stock, index) if i > 0]
    if len(ratios) < lookback + 1:
        return False
    current = ratios[-1]
    prior_high = max(ratios[-lookback - 1:-1])
    return current >= prior_high


def _relative_20d(stock_closes: list[float], index_closes: list[float]) -> float | None:
    n = min(len(stock_closes), len(index_closes))
    if n < 21:
        return None
    stock = stock_closes[-n:]
    index = index_closes[-n:]
    if stock[-21] <= 0 or index[-21] <= 0:
        return None
    stock_return = stock[-1] / stock[-21] - 1.0
    index_return = index[-1] / index[-21] - 1.0
    return (stock_return - index_return) * 100.0


def _trade_geometry(highs: list[float], lows: list[float], closes: list[float]) -> tuple[float | None, float | None]:
    if len(closes) < 21:
        return None, None
    pivot = max(highs[-21:-1])
    if pivot <= 0:
        return None, None
    close = closes[-1]
    pivot_distance = (close / pivot - 1.0) * 100.0
    entry = (pivot + pivot * 1.03) / 2.0
    stop = max(min(lows[-10:]), pivot * 0.92)
    if stop <= 0 or stop >= entry:
        stop_distance = None
    else:
        stop_distance = (entry - stop) / entry * 100.0
    return pivot_distance, stop_distance


def compute_supplemental_strength(
    closes: list[float],
    highs: list[float],
    lows: list[float],
    volumes: list[int],
    index_closes: list[float],
    mcdx_series: dict[str, list[float | None]],
    swing: str | None,
    volume_buzz: float | None,
    ud_volume_ratio: float | None,
) -> SupplementalResult:
    if not (len(closes) == len(highs) == len(lows) == len(volumes)) or len(closes) < 64:
        return SupplementalResult(0.0, {}, 0.0, False, False, False, False, False, None, None)

    close = closes[-1]
    prior_close = closes[-2]
    avg50 = _mean(volumes[-50:]) if len(volumes) >= 50 else None
    up_day = close > prior_close
    hv1 = len(volumes) >= 50 and up_day and volumes[-1] >= max(volumes[-50:])
    hve = bool(avg50 and up_day and volumes[-1] >= avg50 * 1.5)

    volume_score = 0.0
    if volume_buzz is not None:
        if volume_buzz >= 50:
            volume_score += 6
        elif volume_buzz >= 20:
            volume_score += 5
        elif volume_buzz >= 0:
            volume_score += 4
        elif volume_buzz >= -20:
            volume_score += 2
    if ud_volume_ratio is not None:
        if ud_volume_ratio >= 1.5:
            volume_score += 6
        elif ud_volume_ratio >= 1.2:
            volume_score += 5
        elif ud_volume_ratio >= 1.0:
            volume_score += 3
        elif ud_volume_ratio >= 0.8:
            volume_score += 1
    if hve:
        volume_score += 4
    if hv1:
        volume_score += 4

    banker = _mcdx_value(mcdx_series, 'banker')
    banker_ma = _mcdx_value(mcdx_series, 'banker_ma')
    banker_3d = _mcdx_value(mcdx_series, 'banker', 3)
    retailer = _mcdx_value(mcdx_series, 'retailer')
    retailer_ma = _mcdx_value(mcdx_series, 'retailer_ma')
    hot_money = _mcdx_value(mcdx_series, 'hot_money')
    mcdx_score = 0.0
    if banker is not None and banker_ma is not None and banker > banker_ma:
        mcdx_score += 7
    if banker is not None and banker_3d is not None and banker > banker_3d:
        mcdx_score += 5
    if retailer is not None and retailer_ma is not None and retailer < retailer_ma:
        mcdx_score += 4
    if hot_money is not None:
        if hot_money <= 80:
            mcdx_score += 4
        elif hot_money <= 95:
            mcdx_score += 2

    recent_vol = _mean(volumes[-5:])
    prior_vol = _mean(volumes[-20:-5]) if len(volumes) >= 20 else None
    volume_contraction = bool(recent_vol is not None and prior_vol and recent_vol <= prior_vol * 0.80)
    recent_range = _mean([(h - l) / c for h, l, c in zip(highs[-5:], lows[-5:], closes[-5:]) if c > 0])
    prior_range = _mean([(h - l) / c for h, l, c in zip(highs[-20:-5], lows[-20:-5], closes[-20:-5]) if c > 0])
    range_contraction = bool(recent_range is not None and prior_range and recent_range <= prior_range * 0.80)
    vcp = volume_contraction and range_contraction
    pivot_distance, stop_distance = _trade_geometry(highs, lows, closes)

    setup_score = 0.0
    if volume_contraction:
        setup_score += 6
    if vcp:
        setup_score += 6
    if pivot_distance is not None:
        if 0 <= pivot_distance <= 3:
            setup_score += 8
        elif -3 <= pivot_distance < 0:
            setup_score += 6
        elif -8 <= pivot_distance < -3:
            setup_score += 3
        elif 3 < pivot_distance <= 5:
            setup_score += 4

    rs_new_high = _rs_new_high(closes, index_closes)
    relative_20d = _relative_20d(closes, index_closes)
    momentum_score = 0.0
    if swing == 'UP':
        momentum_score += 5
    if rs_new_high:
        momentum_score += 6
    if relative_20d is not None:
        if relative_20d >= 3:
            momentum_score += 4
        elif relative_20d > 0:
            momentum_score += 3

    high20 = max(highs[-20:])
    low20 = min(lows[-20:])
    range20 = high20 - low20
    position20 = (close - low20) / range20 if range20 > 0 else 0.5
    higher_low = min(lows[-5:]) > min(lows[-10:-5]) if len(lows) >= 10 else False
    structure_score = 0.0
    if position20 >= 0.75:
        structure_score += 5
    elif position20 >= 0.60:
        structure_score += 3
    elif position20 >= 0.50:
        structure_score += 1
    if higher_low:
        structure_score += 5

    risk_score = 0.0
    if stop_distance is not None:
        if stop_distance <= 5:
            risk_score += 8
        elif stop_distance <= 6.5:
            risk_score += 6
        elif stop_distance <= 8:
            risk_score += 4
    if pivot_distance is not None:
        if -3 <= pivot_distance <= 3:
            risk_score += 7
        elif -8 <= pivot_distance < -3:
            risk_score += 4
        elif 3 < pivot_distance <= 5:
            risk_score += 3

    penalty = 0.0
    if pivot_distance is not None and pivot_distance > 5:
        penalty += 12
    if swing == 'DOWN':
        penalty += 8
    if volume_buzz is not None and volume_buzz < -50:
        penalty += 5
    banker_falling = banker is not None and banker_3d is not None and banker < banker_3d
    if banker is not None and banker_ma is not None and banker < banker_ma and banker_falling:
        penalty += 5
    if avg50 and close < prior_close and volumes[-1] >= avg50 * 1.5:
        penalty += 5

    components = {
        'volume_quality': min(20.0, volume_score),
        'mcdx_quality': min(20.0, mcdx_score),
        'setup': min(20.0, setup_score),
        'momentum_confirmation': min(15.0, momentum_score),
        'price_structure': min(10.0, structure_score),
        'risk_timing': min(15.0, risk_score),
    }
    raw_score = sum(components.values())
    score = max(0.0, min(100.0, raw_score - min(25.0, penalty)))
    return SupplementalResult(
        score=round(score, 1),
        components=components,
        penalty=min(25.0, penalty),
        hv1=hv1,
        hve=hve,
        volume_contraction=volume_contraction,
        vcp=vcp,
        rs_new_high=rs_new_high,
        pivot_distance_pct=round(pivot_distance, 2) if pivot_distance is not None else None,
        stop_distance_pct=round(stop_distance, 2) if stop_distance is not None else None,
    )


def flow_strength_score(core_score: float, supplemental_score: float) -> float:
    return round(max(0.0, min(100.0, core_score * 0.70 + supplemental_score * 0.30)), 1)


def grade_for_score(score: float | None) -> str:
    if score is None:
        return 'N/A'
    if score >= 90:
        return 'A+'
    if score >= 85:
        return 'A'
    if score >= 80:
        return 'B'
    if score >= 75:
        return 'C'
    return '-'
