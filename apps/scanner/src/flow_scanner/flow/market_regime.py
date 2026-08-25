from __future__ import annotations

def classify_market_mode(index_change_pct: float | None, advancers: int | None, decliners: int | None, distribution_flag: bool = False) -> str:
    if index_change_pct is None or advancers is None or decliners is None:
        return 'CAUTION'
    breadth = advancers / max(decliners, 1)
    if distribution_flag and index_change_pct < 0:
        return 'RISK OFF'
    if index_change_pct >= 1.0 and breadth >= 1.4:
        return 'RISK ON'
    if index_change_pct <= -1.0 and breadth <= 0.75:
        return 'RISK OFF'
    if index_change_pct < -0.5 or breadth < 0.85:
        return 'CAUTION'
    return 'NORMAL'
