from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class RLevels:
    stop_distance_pct: float
    one_r: float
    two_r: float
    three_r: float


def compute_r_levels(entry: float, stop: float) -> RLevels | None:
    if entry <= 0 or stop <= 0 or stop >= entry:
        return None
    risk = entry - stop
    return RLevels(
        stop_distance_pct=risk / entry * 100.0,
        one_r=entry + risk,
        two_r=entry + 2 * risk,
        three_r=entry + 3 * risk,
    )
