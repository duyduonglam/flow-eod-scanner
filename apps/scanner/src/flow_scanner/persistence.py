from __future__ import annotations

from typing import Any

BUY_DECISIONS = {"BUY", "BUY RETEST", "TEST BUY"}
DETERIORATING_DECISIONS = {"TRIM", "EXIT"}


def _value(row: dict[str, Any], key: str) -> Any:
    return row.get(key)


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
        symbol_id = _symbol_id(row, symbol_ids)
        if symbol_id is None:
            continue
        decision = str(row.get("decision") or "WATCH")
        payload.append(
            {
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
        )
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
        "flow_score",
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
        mapped.update({field: row.get(field) for field in signal_fields})
        payload.append(mapped)
    return payload
