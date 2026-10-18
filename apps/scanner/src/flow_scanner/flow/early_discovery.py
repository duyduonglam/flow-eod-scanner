"""Independent experimental screen; never changes the main FLOW score."""
from math import isfinite
from statistics import fmean, pstdev
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.indicators.moving_averages import ema

FORMULA_VERSION = 'early-dema-bb-rs-ichi-v2'
EFFECTIVE_DATE = '2026-10-19'


def classify_early(rows: list[OHLCVRecord], rs_rating: float | None = None) -> dict | None:
    if rs_rating is None or not isfinite(rs_rating) or rs_rating < 80 or rs_rating > 100:
        return None
    if len(rows) < 260:
        return None
    cloud = ichimoku_context(rows)
    if cloud['cloud_position'] != 'ABOVE':
        return None
    closes = [r.close / r.adj_ratio for r in rows]
    if any(not isfinite(c) or c <= 0 for c in closes):
        return None
    e20, e21, e50, e200 = [ema(closes, n) for n in (20, 21, 50, 200)]
    # The first EMA's available values seed its second smoothing.
    second = ema([v for v in e21 if v is not None], 21)
    dema = 2 * e21[-1] - second[-1]
    upper = fmean(closes[-20:]) + 2 * pstdev(closes[-20:])
    extension = (closes[-1] / e20[-1] - 1) * 100
    avg_value = fmean(r.close * 1000 * r.volume for r in rows[-20:])
    current_value = rows[-1].close * 1000 * rows[-1].volume
    prior_volume = fmean(r.volume for r in rows[-21:-1])
    volume_ratio = rows[-1].volume / prior_volume if prior_volume > 0 else 0
    base = (
        dema > e20[-1] > e50[-1] > e200[-1]
        and closes[-1] > dema
        and e20[-1] > e20[-6] and e50[-1] > e50[-6]
        and e200[-1] > e200[-21]
        and extension <= 8 and avg_value >= 10_000_000_000
        and current_value >= 5_000_000_000
    )
    if not base:
        return None
    if closes[-1] <= upper:
        stage = 'PREPARING'
    else:
        previous_breakout = any(
            closes[i] > fmean(closes[i-19:i+1]) + 2 * pstdev(closes[i-19:i+1])
            for i in range(len(closes)-5, len(closes)-1)
        )
        if previous_breakout or volume_ratio < 1.3:
            return None
        stage = 'NEW_BREAKOUT'
    return {
        'formula_version': FORMULA_VERSION, 'stage': stage, 'rs_rating': rs_rating,
        **cloud,
        'dema21': dema, 'ema20': e20[-1], 'ema50': e50[-1], 'ema200': e200[-1],
        'upper_bb': upper, 'adjusted_close': closes[-1], 'price_basis': 'fireant_adjusted',
        'volume_ratio': volume_ratio, 'extension_pct': extension,
        'avg_value_20': avg_value, 'current_value': current_value,
        'close': rows[-1].close,
    }


def ichimoku_context(rows: list[OHLCVRecord]) -> dict:
    """Cloud at the scan session: 9/26/52 spans displaced 26 sessions forward."""
    endpoint = len(rows) - 1 - 26
    def midpoint(period):
        window = rows[endpoint-period+1:endpoint+1]
        return (max(r.high/r.adj_ratio for r in window) + min(r.low/r.adj_ratio for r in window))/2
    span_a = (midpoint(9) + midpoint(26))/2
    span_b = midpoint(52)
    top, bottom = max(span_a,span_b), min(span_a,span_b)
    close = rows[-1].close/rows[-1].adj_ratio
    position = 'ABOVE' if close > top else 'BELOW' if close < bottom else 'INSIDE'
    green = span_a > span_b
    return {'cloud_green':green, 'cloud_position':position, 'cloud_top':top, 'cloud_bottom':bottom,
            'ichimoku_priority': 1 if position=='ABOVE' else 0}
