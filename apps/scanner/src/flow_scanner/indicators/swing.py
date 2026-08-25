from __future__ import annotations

def swing_direction(highs: list[float], lows: list[float], length: int = 50) -> str | None:
    if len(highs) != len(lows):
        raise ValueError('highs and lows must have equal length')
    if not highs:
        return None
    trend: bool | None = None
    for i in range(len(highs)):
        start = max(0, i + 1 - length)
        upper = max(highs[start:i + 1])
        lower = min(lows[start:i + 1])
        if highs[i] == upper:
            trend = True
        if lows[i] == lower:
            trend = False
    if trend is None:
        return None
    return 'UP' if trend else 'DOWN'
