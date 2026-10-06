from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from flow_scanner.flow.entry_engine import TradePlan
from flow_scanner.flow.trend_template import TrendTemplateResult
from flow_scanner.indicators.mcdx import MCDXSnapshot, compute_mcdx
from flow_scanner.indicators.moving_averages import ema, sma
from flow_scanner.indicators.volume import ud_volume_ratio, volume_buzz
from flow_scanner.flow.unified_score import SCORE_VERSION, compute_unified_score


@dataclass(frozen=True)
class CompositeScore:
    total_score: float
    label: str
    components: dict[str, float]
    notes: list[str]
    score_version: str = SCORE_VERSION


def _last_number(values: list[float | None]) -> float | None:
    return values[-1] if values and values[-1] is not None else None


def _dema_latest(values: list[float], period: int = 21) -> float | None:
    ema1 = ema(values, period)
    latest_ema1 = _last_number(ema1)
    if latest_ema1 is None:
        return None
    ema1_values = [value for value in ema1 if value is not None]
    ema2 = ema(ema1_values, period)
    latest_ema2 = _last_number(ema2)
    if latest_ema2 is None:
        return None
    return 2 * latest_ema1 - latest_ema2


def _stddev(values: list[float]) -> float:
    mean = sum(values) / len(values)
    return sqrt(sum((value - mean) ** 2 for value in values) / len(values))


def _atr(highs: list[float], lows: list[float], closes: list[float], period: int = 10) -> float | None:
    if len(closes) < period + 1:
        return None
    true_ranges = []
    for index in range(1, len(closes)):
        true_ranges.append(max(
            highs[index] - lows[index],
            abs(highs[index] - closes[index - 1]),
            abs(lows[index] - closes[index - 1]),
        ))
    window = true_ranges[-period:]
    return sum(window) / period


def _supertrend_up(highs: list[float], lows: list[float], closes: list[float], period: int = 10, factor: float = 3.0) -> bool:
    atr_value = _atr(highs, lows, closes, period)
    if atr_value is None:
        return False
    hl2 = (highs[-1] + lows[-1]) / 2
    lower_band = hl2 - factor * atr_value
    return closes[-1] > lower_band and closes[-1] >= closes[-2]


def _ichimoku_positive(highs: list[float], lows: list[float], closes: list[float]) -> bool:
    if len(closes) < 52:
        return False
    conversion = (max(highs[-9:]) + min(lows[-9:])) / 2
    base = (max(highs[-26:]) + min(lows[-26:])) / 2
    span_a = (conversion + base) / 2
    span_b = (max(highs[-52:]) + min(lows[-52:])) / 2
    return closes[-1] > max(span_a, span_b)


def _bb_signal_positive(closes: list[float], period: int = 20, mult: float = 2.0) -> bool:
    if len(closes) < period + 1:
        return False
    current_window = closes[-period:]
    previous_window = closes[-period - 1:-1]
    basis = sum(current_window) / period
    previous_basis = sum(previous_window) / period
    upper = basis + mult * _stddev(current_window)
    return closes[-1] > upper or basis > previous_basis


def _structure_score(closes: list[float], highs: list[float], lows: list[float], trend: TrendTemplateResult | None) -> tuple[float, list[str]]:
    if trend is None:
        return 0.0, ["Insufficient FLOW structure"]
    close = closes[-1]
    latest_ema = _last_number(ema(closes, 21))
    latest_dema = _dema_latest(closes, 21)
    score = 0.0
    notes: list[str] = []
    if close > trend.ma50:
        score += 4
    if close > trend.ma200:
        score += 4
    if trend.ma50 > trend.ma200:
        score += 4
    if latest_ema is not None and latest_dema is not None and close > latest_ema and close > latest_dema:
        score += 4
    if _supertrend_up(highs, lows, closes):
        score += 4
    if _ichimoku_positive(highs, lows, closes):
        score += 3
    if _bb_signal_positive(closes):
        score += 2
    if score < 15:
        notes.append("FLOW structure is not fully aligned")
    return min(score, 25.0), notes


def _mcdx_score(closes: list[float], mcdx: MCDXSnapshot) -> tuple[float, list[str]]:
    data = compute_mcdx(closes)
    banker_series = data["banker"]
    banker = mcdx.banker
    banker_ma = mcdx.banker_ma
    hot_money = mcdx.hot_money
    retailer = mcdx.retailer
    score = 0.0
    notes: list[str] = []
    if banker is not None and banker > 50:
        score += 5
    if banker is not None and banker_ma is not None and banker >= banker_ma:
        score += 6
    if len(banker_series) >= 2 and banker_series[-1] is not None and banker_series[-2] is not None and banker_series[-1] >= banker_series[-2]:
        score += 4
    if hot_money is not None and 30 <= hot_money <= 90:
        score += 4
    if retailer is not None and retailer <= 30:
        score += 3
    if banker is not None and banker_ma is not None and banker >= 70 and banker >= banker_ma:
        score += 3
    if banker is not None and banker_ma is not None and banker < banker_ma:
        notes.append("Banker below MA")
    if hot_money is not None and hot_money > 95:
        notes.append("Hot Money overheated")
    return min(score, 25.0), notes


def _volume_score(closes: list[float], volumes: list[int]) -> tuple[float, list[str]]:
    buzz = volume_buzz(volumes)
    ud_ratio = ud_volume_ratio(closes, volumes)
    score = 0.0
    notes: list[str] = []
    if buzz is not None and buzz > 0:
        score += 4
    if buzz is not None and buzz > 50:
        score += 3
    if ud_ratio is not None and ud_ratio > 1:
        score += 4
    if ud_ratio is not None and ud_ratio > 1.5:
        score += 3
    if len(volumes) >= 50:
        avg_volume = sum(volumes[-50:]) / 50
        if avg_volume > 0 and volumes[-1] > avg_volume:
            score += 3
        if max(volumes[-252:]) == volumes[-1] or max(volumes[-50:]) == volumes[-1]:
            score += 3
    if buzz is not None and buzz < 0:
        notes.append("Volume Buzz negative")
    return min(score, 20.0), notes


def _swing_entry_score(closes: list[float], trend: TrendTemplateResult | None, swing: str | None, plan: TradePlan) -> tuple[float, list[str]]:
    score = 0.0
    notes: list[str] = []
    close = closes[-1]
    if swing == "UP":
        score += 5
    if plan.entry_low is not None and plan.entry_high is not None:
        if plan.entry_low <= close <= plan.entry_high:
            score += 6
        elif close <= plan.entry_high * 1.03:
            score += 3
        else:
            notes.append("Extended above Entry Zone")
    if plan.levels is not None:
        if plan.levels.stop_distance_pct <= 8:
            score += 4
        elif plan.levels.stop_distance_pct <= 10:
            score += 2
        else:
            notes.append("Stop distance too wide")
    if trend is None or close <= trend.ma50 * 1.2:
        score += 2
    else:
        notes.append("Extended above MA50")
    return min(score, 20.0), notes


def _rs_score(rs_rating: int | None) -> tuple[float, list[str]]:
    if rs_rating is None:
        return 0.0, ["RS unavailable"]
    if rs_rating > 90:
        return 10.0, []
    if rs_rating > 80:
        return 4.0, []
    return 0.0, ["RS below 80"]


def compute_composite_score(
    *,
    closes: list[float],
    highs: list[float],
    lows: list[float],
    volumes: list[int],
    trend: TrendTemplateResult | None,
    mcdx: MCDXSnapshot,
    rs_rating: int | None,
    swing: str | None,
    plan: TradePlan,
) -> CompositeScore:
    data = compute_mcdx(closes)
    banker_series = data["banker"]
    banker_rising = (
        len(banker_series) >= 2
        and banker_series[-1] is not None
        and banker_series[-2] is not None
        and banker_series[-1] >= banker_series[-2]
    )
    buzz = volume_buzz(volumes)
    ud_ratio = ud_volume_ratio(closes, volumes)
    avg_volume = sum(volumes[-50:]) / 50 if len(volumes) >= 50 else 0
    current_is_high = bool(volumes) and (
        volumes[-1] >= max(volumes[-50:]) if len(volumes) >= 50 else False
    )
    if len(volumes) >= 252:
        current_is_high = current_is_high or volumes[-1] >= max(volumes[-252:])

    close = closes[-1]
    in_entry = bool(
        plan.entry_low is not None
        and plan.entry_high is not None
        and plan.entry_low <= close <= plan.entry_high
    )
    near_entry = bool(
        not in_entry
        and plan.entry_high is not None
        and close <= plan.entry_high * 1.03
    )
    stop_distance = plan.levels.stop_distance_pct if plan.levels else None
    not_extended = trend is None or close <= trend.ma50 * 1.2
    unified = compute_unified_score(
        trend_checks=trend.checks if trend else {},
        banker=mcdx.banker,
        banker_ma=mcdx.banker_ma,
        banker_rising=banker_rising,
        hot_money=mcdx.hot_money,
        retailer=mcdx.retailer,
        volume_buzz=buzz,
        ud_volume_ratio=ud_ratio,
        current_volume_above_average=bool(volumes) and volumes[-1] > avg_volume,
        current_volume_is_high=current_is_high,
        rs_rating=rs_rating,
        swing_up=swing == "UP",
        in_entry_zone=in_entry,
        near_entry_zone=near_entry,
        stop_distance_pct=stop_distance,
        not_extended=not_extended,
    )
    components = {
        "structure": unified.components["flow"],
        "mcdx": unified.components["mcdx"],
        "volume": unified.components["volume"],
        "swing_entry": unified.components["swing_entry"],
        "rs": unified.components["rs"],
    }
    notes: list[str] = []
    if buzz is not None and buzz < 0:
        notes.append("Volume Buzz negative")
    if mcdx.banker is not None and mcdx.banker_ma is not None and mcdx.banker < mcdx.banker_ma:
        notes.append("Banker below MA")
    if rs_rating is None:
        notes.append("RS unavailable")
    if plan.entry_high is not None and close > plan.entry_high * 1.03:
        notes.append("Extended above Entry Zone")
    return CompositeScore(unified.total_score, unified.label, components, notes, unified.score_version)

