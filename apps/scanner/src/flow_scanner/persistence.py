from __future__ import annotations

import math
from typing import Any

BUY_DECISIONS = {"BUY", "BUY RETEST", "TEST BUY"}
DETERIORATING_DECISIONS = {"TRIM", "EXIT"}
MIN_PUBLISHED_SCORE = 75.0
MIN_AVG_VALUE_20 = 20_000_000_000
MIN_CURRENT_VALUE = 5_000_000_000


def _value(row: dict[str, Any], key: str) -> Any:
    value = row.get(key)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _symbol_id(row: dict[str, Any], symbol_ids: dict[str, int]) -> int | None:
    symbol = str(row.get("symbol", "")).upper()
    return symbol_ids.get(symbol)


def build_scan_result_payload(
    rows: list[dict[str, Any]],
    symbol_ids: dict[str, int],
    market_date: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for row in rows:
        score = row.get("flow_score")
        if score is None or float(score) < MIN_PUBLISHED_SCORE:
            continue
        avg_value_20 = row.get("avg_value_20")
        current_value = row.get("current_value")
        if avg_value_20 is None or float(avg_value_20) < MIN_AVG_VALUE_20:
            continue
        if current_value is None or float(current_value) < MIN_CURRENT_VALUE:
            continue
        symbol_id = _symbol_id(row, symbol_ids)
        if symbol_id is None:
            continue
        decision = str(row.get("decision") or "WATCH")
        item = {
                "market_date": market_date,
                "symbol_id": symbol_id,
                "rank": len(payload) + 1,
                "total_score": _value(row, "flow_score"),
                "score_label": _value(row, "flow_label"),
                "main_signal": _value(row, "main_signal"),
                "headline_news": _value(row, "headline_news"),
                "entry_low": _value(row, "entry_low"),
                "entry_high": _value(row, "entry_high"),
                "stop_price": _value(row, "stop_price"),
                "stop_distance_pct": _value(row, "stop_distance_pct"),
                "one_r": _value(row, "one_r"),
                "two_r": _value(row, "two_r"),
                "three_r": _value(row, "three_r"),
                "decision": decision,
                "invalidation": _value(row, "invalidation"),
                "is_existing_leader": False,
                "is_new_candidate": decision in BUY_DECISIONS,
                "is_deteriorating": decision in DETERIORATING_DECISIONS,
            }
        if row.get("score_version") is not None:
            item["score_version"] = _value(row, "score_version")
        if row.get("score_components") is not None:
            item["score_components"] = _value(row, "score_components")
        payload.append(item)
        if len(payload) >= limit:
            break
    return payload


def build_stock_signal_payload(
    rows: list[dict[str, Any]],
    symbol_ids: dict[str, int],
    market_date: str,
) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    signal_fields = [
        "close",
        "change_pct",
        "flow_score",
        "score_version",
        "score_components",
        "flow_label",
        "pass_count",
        "total_count",
        "rs_rating",
        "banker",
        "banker_ma",
        "hot_money",
        "hot_money_ma",
        "retailer",
        "retailer_ma",
        "swing_direction",
        "volume_buzz",
        "ud_volume_ratio",
        "chase_risk",
        "t_plus_two_risk",
        "risk_class",
        "data_status",
    ]
    for row in rows:
        symbol_id = _symbol_id(row, symbol_ids)
        if symbol_id is None:
            continue
        mapped = {"market_date": market_date, "symbol_id": symbol_id}
        mapped.update({field: _value(row, field) for field in signal_fields})
        if row.get("score_version") is None:
            mapped.pop("score_version", None)
        if row.get("score_components") is None:
            mapped.pop("score_components", None)
        payload.append(mapped)
    return payload

