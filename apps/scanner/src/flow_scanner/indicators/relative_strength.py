from __future__ import annotations

LOOKBACKS = (63, 126, 189, 252)
WEIGHTS = (0.4, 0.2, 0.2, 0.2)

def _weighted_performance(closes: list[float]) -> float | None:
    if len(closes) < 253:
        return None
    current = closes[-1]
    performances = [current / closes[-1 - lb] for lb in LOOKBACKS]
    return sum(w * p for w, p in zip(WEIGHTS, performances))


def relative_performance(stock_closes: list[float], index_closes: list[float]) -> float | None:
    stock = _weighted_performance(stock_closes)
    index = _weighted_performance(index_closes)
    if stock is None or index is None or index == 0:
        return None
    return stock / index * 100.0


def percentile_rs(scores: dict[str, float | None]) -> dict[str, int | None]:
    valid = sorted((score, symbol) for symbol, score in scores.items() if score is not None)
    if not valid:
        return {symbol: None for symbol in scores}
    n = len(valid)
    output: dict[str, int | None] = {symbol: None for symbol in scores}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and valid[j + 1][0] == valid[i][0]:
            j += 1
        avg_rank = (i + j) / 2 + 1
        percentile = max(1, min(99, round(avg_rank / n * 99)))
        for k in range(i, j + 1):
            output[valid[k][1]] = percentile
        i = j + 1
    return output
