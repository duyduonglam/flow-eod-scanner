from __future__ import annotations

DECISION_PRIORITY = {
    'BUY': 7, 'BUY RETEST': 6, 'TEST BUY': 5, 'HOLD': 4,
    'WATCH': 3, 'DO NOT CHASE': 2, 'TRIM': 1, 'EXIT': 0,
}

def rank_candidates(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: (
        DECISION_PRIORITY.get(r.get('decision'), -1),
        r.get('flow_score') if r.get('flow_score') is not None else -1,
        r.get('rs_rating') if r.get('rs_rating') is not None else -1,
    ), reverse=True)
