"""Independent experimental screen; never changes the main FLOW score."""
from math import isfinite
from statistics import fmean, pstdev
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.indicators.moving_averages import ema

FORMULA_VERSION = 'early-dema-bb-v1'
EFFECTIVE_DATE = '2026-10-19'


def classify_early(rows: list[OHLCVRecord]) -> dict | None:
    if len(rows) < 260:
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
        'formula_version': FORMULA_VERSION, 'stage': stage,
        'dema21': dema, 'ema20': e20[-1], 'ema50': e50[-1], 'ema200': e200[-1],
        'upper_bb': upper, 'adjusted_close': closes[-1], 'price_basis': 'fireant_adjusted',
        'volume_ratio': volume_ratio, 'extension_pct': extension,
        'avg_value_20': avg_value, 'current_value': current_value,
        'close': rows[-1].close,
    }
