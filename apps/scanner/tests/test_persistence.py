from flow_scanner.persistence import build_scan_result_payload, build_stock_signal_payload


def test_build_scan_result_payload_maps_scanner_rows_for_supabase():
    rows = [
        {
            "symbol": "AAA",
            "flow_score": 88.4,
            "flow_label": "YES",
            "avg_value_20": 25_000_000_000,
            "current_value": 6_000_000_000,
            "main_signal": "FLOW YES",
            "headline_news": "News",
            "entry_low": 10.0,
            "entry_high": 10.5,
            "stop_price": 9.7,
            "stop_distance_pct": 5.0,
            "one_r": 11.0,
            "two_r": 12.0,
            "three_r": 13.0,
            "decision": "BUY RETEST",
            "invalidation": "Close below stop",
        }
    ]
    payload = build_scan_result_payload(rows, {"AAA": 42}, "2026-08-25")

    assert payload == [
        {
            "market_date": "2026-08-25",
            "symbol_id": 42,
            "rank": 1,
            "total_score": 88.4,
            "score_label": "YES",
            "main_signal": "FLOW YES",
            "headline_news": "News",
            "entry_low": 10.0,
            "entry_high": 10.5,
            "stop_price": 9.7,
            "stop_distance_pct": 5.0,
            "one_r": 11.0,
            "two_r": 12.0,
            "three_r": 13.0,
            "decision": "BUY RETEST",
            "invalidation": "Close below stop",
            "is_existing_leader": False,
            "is_new_candidate": True,
            "is_deteriorating": False,
        }
    ]


def test_build_scan_result_payload_publishes_only_scores_at_least_75():
    rows = [
        {"symbol": "LOW", "flow_score": 74.9, "avg_value_20": 25_000_000_000, "current_value": 6_000_000_000, "decision": "WATCH"},
        {"symbol": "EDGE", "flow_score": 75.0, "avg_value_20": 25_000_000_000, "current_value": 6_000_000_000, "decision": "WATCH"},
    ]

    payload = build_scan_result_payload(rows, {"LOW": 1, "EDGE": 2}, "2026-09-11")

    assert [item["symbol_id"] for item in payload] == [2]
    assert payload[0]["rank"] == 1


def test_build_scan_result_payload_keeps_unified_score_breakdown():
    rows = [{
        "symbol": "AAA",
        "flow_score": 88.4,
        "flow_label": "YES",
        "score_version": "volume-mcdx-flow-v1",
        "score_components": {"flow": 25, "mcdx": 20, "volume": 18, "rs": 15, "swing_entry": 10},
        "avg_value_20": 25_000_000_000,
        "current_value": 6_000_000_000,
        "decision": "BUY",
    }]

    payload = build_scan_result_payload(rows, {"AAA": 1}, "2026-10-06")

    assert payload[0]["score_version"] == "volume-mcdx-flow-v1"
    assert payload[0]["score_components"]["mcdx"] == 20


def test_build_stock_signal_payload_keeps_indicator_fields():
    rows = [
        {
            "symbol": "AAA",
            "close": 10.2,
            "change_pct": None,
            "flow_score": 88.4,
            "flow_label": "YES",
            "avg_value_20": 25_000_000_000,
            "current_value": 6_000_000_000,
            "pass_count": 9,
            "total_count": 11,
            "rs_rating": 91,
            "banker": 56.2,
            "banker_ma": 51.0,
            "hot_money": 42.0,
            "hot_money_ma": 39.0,
            "retailer": 1.8,
            "retailer_ma": 3.0,
            "swing_direction": "UP",
            "volume_buzz": 125.5,
            "ud_volume_ratio": 1.2,
            "chase_risk": "NORMAL",
            "data_status": "VALID",
        }
    ]

    payload = build_stock_signal_payload(rows, {"AAA": 42}, "2026-08-25")

    assert payload == [
        {
            "market_date": "2026-08-25",
            "symbol_id": 42,
            "close": 10.2,
            "change_pct": None,
            "flow_score": 88.4,
            "flow_label": "YES",
            "pass_count": 9,
            "total_count": 11,
            "rs_rating": 91,
            "banker": 56.2,
            "banker_ma": 51.0,
            "hot_money": 42.0,
            "hot_money_ma": 39.0,
            "retailer": 1.8,
            "retailer_ma": 3.0,
            "swing_direction": "UP",
            "volume_buzz": 125.5,
            "ud_volume_ratio": 1.2,
            "chase_risk": "NORMAL",
            "t_plus_two_risk": None,
            "risk_class": None,
            "data_status": "VALID",
        }
    ]


def test_build_scan_result_payload_excludes_illiquid_rows_from_main_list():
    rows = [
        {
            "symbol": "LIQUID",
            "flow_score": 82,
            "flow_label": "A",
            "avg_value_20": 25_000_000_000,
            "current_value": 6_000_000_000,
            "decision": "WATCH",
        },
        {
            "symbol": "LOWAVG",
            "flow_score": 92,
            "flow_label": "A",
            "avg_value_20": 9_900_000_000,
            "current_value": 8_000_000_000,
            "decision": "WATCH",
        },
        {
            "symbol": "LOWTODAY",
            "flow_score": 90,
            "flow_label": "A",
            "avg_value_20": 30_000_000_000,
            "current_value": 4_900_000_000,
            "decision": "WATCH",
        },
    ]

    payload = build_scan_result_payload(rows, {"LIQUID": 1, "LOWAVG": 2, "LOWTODAY": 3}, "2026-09-30")

    assert [row["symbol_id"] for row in payload] == [1]

