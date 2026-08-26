from flow_scanner.persistence import build_scan_result_payload, build_stock_signal_payload


def test_build_scan_result_payload_maps_scanner_rows_for_supabase():
    rows = [
        {
            "symbol": "AAA",
            "flow_score": 88.4,
            "flow_label": "YES",
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


def test_build_stock_signal_payload_keeps_indicator_fields():
    rows = [
        {
            "symbol": "AAA",
            "close": 10.2,
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
            "data_status": "VALID",
        }
    ]

    payload = build_stock_signal_payload(rows, {"AAA": 42}, "2026-08-25")

    assert payload == [
        {
            "market_date": "2026-08-25",
            "symbol_id": 42,
            "close": 10.2,
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
