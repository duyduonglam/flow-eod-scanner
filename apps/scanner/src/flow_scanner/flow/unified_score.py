from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Mapping, Sequence


SCORE_VERSION = "volume-mcdx-flow-v1"


@dataclass(frozen=True)
class UnifiedScore:
    total_score: float
    label: str
    components: dict[str, float]
    score_version: str = SCORE_VERSION


def _number(value: float | int | None, fallback: float = 0.0) -> float:
    try:
        result = float(value) if value is not None else fallback
    except (TypeError, ValueError):
        return fallback
    return result if isfinite(result) else fallback


def _round(value: float) -> float:
    return round(value + 1e-9, 1)


def _label(total: float) -> str:
    if total >= 80:
        return "YES"
    if total >= 70:
        return "PARTIAL"
    return "NO"


def compute_unified_score(
    *,
    trend_checks: Mapping[str, bool] | Sequence[bool],
    banker: float | None,
    banker_ma: float | None,
    banker_rising: bool,
    hot_money: float | None,
    retailer: float | None,
    volume_buzz: float | None,
    ud_volume_ratio: float | None,
    current_volume_above_average: bool,
    current_volume_is_high: bool,
    rs_rating: float | None,
    swing_up: bool,
    in_entry_zone: bool,
    near_entry_zone: bool,
    stop_distance_pct: float | None,
    not_extended: bool,
) -> UnifiedScore:
    checks = list(trend_checks.values()) if isinstance(trend_checks, Mapping) else list(trend_checks)
    flow = min(25.0, 25.0 * sum(bool(value) for value in checks) / max(len(checks), 11))

    banker_value = _number(banker)
    banker_ma_value = _number(banker_ma)
    hot_value = _number(hot_money)
    retailer_value = _number(retailer, 100.0)
    mcdx = 0.0
    if banker_value > 50:
        mcdx += 5
    if banker_value >= banker_ma_value:
        mcdx += 4
    if banker_rising:
        mcdx += 3
    if 30 <= hot_value <= 90:
        mcdx += 4
    if retailer_value <= 30:
        mcdx += 2
    if banker_value >= 70 and banker_value >= banker_ma_value:
        mcdx += 2

    buzz = _number(volume_buzz, -100.0)
    ud_ratio = _number(ud_volume_ratio)
    volume = 0.0
    if buzz > 0:
        volume += 4
    if buzz > 50:
        volume += 3
    if ud_ratio > 1:
        volume += 4
    if ud_ratio > 1.5:
        volume += 3
    if current_volume_above_average:
        volume += 3
    if current_volume_is_high:
        volume += 3

    rs_value = _number(rs_rating)
    if rs_value > 90:
        rs = 15.0
    elif rs_value > 80:
        rs = 10.0
    elif rs_value > 70:
        rs = 5.0
    else:
        rs = 0.0

    swing_entry = 0.0
    if swing_up:
        swing_entry += 5
    if in_entry_zone:
        swing_entry += 6
    elif near_entry_zone:
        swing_entry += 3
    stop_distance = _number(stop_distance_pct, 100.0)
    if stop_distance <= 8:
        swing_entry += 4
    elif stop_distance <= 10:
        swing_entry += 2
    if not_extended:
        swing_entry += 5

    components = {
        "flow": _round(flow),
        "mcdx": _round(min(mcdx, 20.0)),
        "volume": _round(min(volume, 20.0)),
        "rs": _round(rs),
        "swing_entry": _round(min(swing_entry, 20.0)),
    }
    total = _round(sum(components.values()))
    return UnifiedScore(total, _label(total), components)

