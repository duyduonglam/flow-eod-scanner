from __future__ import annotations

def volume_buzz(volumes: list[int], period: int = 50) -> float | None:
    if len(volumes) < period or period <= 0:
        return None
    avg = sum(volumes[-period:]) / period
    if avg == 0:
        return None
    return (volumes[-1] / avg - 1.0) * 100.0


def ud_volume_ratio(closes: list[float], volumes: list[int], period: int = 50) -> float | None:
    if len(closes) != len(volumes):
        raise ValueError('closes and volumes must have equal length')
    if len(closes) < period + 1:
        return None
    up = 0
    down = 0
    start = len(closes) - period
    for i in range(start, len(closes)):
        if closes[i] > closes[i - 1]:
            up += volumes[i]
        elif closes[i] < closes[i - 1]:
            down += volumes[i]
    if down == 0:
        return float('inf') if up > 0 else None
    return up / down
