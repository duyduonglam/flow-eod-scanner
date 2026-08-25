from __future__ import annotations
from dataclasses import dataclass
from flow_scanner.indicators.rsi import rsi

@dataclass(frozen=True)
class MCDXSnapshot:
    banker: float | None
    banker_ma: float | None
    hot_money: float | None          # displayed/table percentage; Banker + Hot Money + Retailer = 100 where available
    hot_money_line: float | None     # raw yellow MCDX line before table normalization
    hot_money_ma: float | None       # MA of raw yellow line, matching Pine
    retailer: float | None
    retailer_ma: float | None


def _raw_mcdx(rsi_value: float | None, sensitivity: float, base: float) -> float | None:
    if rsi_value is None:
        return None
    return min(20.0, max(0.0, sensitivity * (rsi_value - base)))


def _optional_sma(series: list[float | None], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(series)
    for i in range(period - 1, len(series)):
        window = series[i + 1 - period:i + 1]
        if all(v is not None for v in window):
            out[i] = sum(float(v) for v in window) / period
    return out


def compute_mcdx(closes: list[float], ma_period: int = 10) -> dict[str, list[float | None]]:
    banker_rsi = rsi(closes, 50)
    hot_rsi = rsi(closes, 40)
    banker_raw = [_raw_mcdx(v, 1.5, 50.0) for v in banker_rsi]
    hot_raw = [_raw_mcdx(v, 0.7, 30.0) for v in hot_rsi]

    banker: list[float | None] = []
    hot_line: list[float | None] = []
    hot_display: list[float | None] = []
    retailer: list[float | None] = []
    for b, h in zip(banker_raw, hot_raw):
        if b is None or h is None:
            banker.append(None); hot_line.append(None); hot_display.append(None); retailer.append(None)
            continue
        banker_pct = b * 5.0
        hot_line_pct = h * 5.0
        retailer_pct = max(20.0 - (b + h), 0.0) * 5.0
        # Pine table formula: max(100 - BankerPct - RetailerPct, 0).
        hot_display_pct = max(100.0 - banker_pct - retailer_pct, 0.0)
        banker.append(banker_pct)
        hot_line.append(hot_line_pct)
        hot_display.append(hot_display_pct)
        retailer.append(retailer_pct)

    return {
        'banker': banker,
        'banker_ma': _optional_sma(banker, ma_period),
        'hot_money': hot_display,
        'hot_money_line': hot_line,
        'hot_money_ma': _optional_sma(hot_line, ma_period),
        'retailer': retailer,
        'retailer_ma': _optional_sma(retailer, ma_period),
    }


def latest_mcdx(closes: list[float]) -> MCDXSnapshot:
    data = compute_mcdx(closes)
    def last(name: str): return data[name][-1] if data[name] else None
    return MCDXSnapshot(
        banker=last('banker'), banker_ma=last('banker_ma'),
        hot_money=last('hot_money'), hot_money_line=last('hot_money_line'), hot_money_ma=last('hot_money_ma'),
        retailer=last('retailer'), retailer_ma=last('retailer_ma'),
    )
