from __future__ import annotations

def rma(values: list[float], period: int) -> list[float | None]:
    """Wilder moving average compatible with Pine ta.rma semantics after warmup."""
    if period <= 0:
        raise ValueError('period must be positive')
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    alpha = 1.0 / period
    for i in range(period, len(values)):
        prev = alpha * values[i] + (1.0 - alpha) * prev
        out[i] = prev
    return out


def rsi(closes: list[float], period: int = 14) -> list[float | None]:
    if period <= 0:
        raise ValueError('period must be positive')
    if not closes:
        return []
    if len(closes) == 1:
        return [None]

    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(change, 0.0) for change in changes]
    losses = [max(-change, 0.0) for change in changes]
    avg_gain = rma(gains, period)
    avg_loss = rma(losses, period)

    out: list[float | None] = [None] * len(closes)
    for change_idx in range(len(changes)):
        g = avg_gain[change_idx]
        l = avg_loss[change_idx]
        close_idx = change_idx + 1
        if g is None or l is None:
            continue
        if l == 0 and g == 0:
            out[close_idx] = 50.0
        elif l == 0:
            out[close_idx] = 100.0
        elif g == 0:
            out[close_idx] = 0.0
        else:
            rs = g / l
            out[close_idx] = 100.0 - (100.0 / (1.0 + rs))
    return out
