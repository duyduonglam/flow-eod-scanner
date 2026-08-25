from __future__ import annotations

def sma(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError('period must be positive')
    out: list[float | None] = [None] * len(values)
    running = 0.0
    for i, value in enumerate(values):
        running += float(value)
        if i >= period:
            running -= float(values[i - period])
        if i >= period - 1:
            out[i] = running / period
    return out


def ema(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError('period must be positive')
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    alpha = 2.0 / (period + 1.0)
    prev = seed
    for i in range(period, len(values)):
        prev = alpha * values[i] + (1 - alpha) * prev
        out[i] = prev
    return out
