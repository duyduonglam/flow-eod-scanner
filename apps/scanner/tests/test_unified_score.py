from flow_scanner.flow.unified_score import SCORE_VERSION, compute_unified_score


def test_unified_score_combines_volume_mcdx_flow_rs_and_entry_to_100():
    result = compute_unified_score(
        trend_checks={f"check_{index}": True for index in range(11)},
        banker=80,
        banker_ma=60,
        banker_rising=True,
        hot_money=50,
        retailer=20,
        volume_buzz=60,
        ud_volume_ratio=2,
        current_volume_above_average=True,
        current_volume_is_high=True,
        rs_rating=95,
        swing_up=True,
        in_entry_zone=True,
        near_entry_zone=False,
        stop_distance_pct=7,
        not_extended=True,
    )

    assert result.score_version == SCORE_VERSION
    assert result.components == {
        "flow": 25.0,
        "mcdx": 20.0,
        "volume": 20.0,
        "rs": 15.0,
        "swing_entry": 20.0,
    }
    assert result.total_score == 100.0
    assert result.label == "YES"


def test_unified_score_is_stable_without_news_data():
    kwargs = dict(
        trend_checks={f"check_{index}": index < 6 for index in range(11)},
        banker=80,
        banker_ma=60,
        banker_rising=True,
        hot_money=50,
        retailer=20,
        volume_buzz=60,
        ud_volume_ratio=2,
        current_volume_above_average=True,
        current_volume_is_high=True,
        rs_rating=95,
        swing_up=False,
        in_entry_zone=False,
        near_entry_zone=True,
        stop_distance_pct=9,
        not_extended=False,
    )

    first = compute_unified_score(**kwargs)
    second = compute_unified_score(**kwargs)

    assert first.total_score == second.total_score == 73.6
    assert first.components["swing_entry"] == 5.0

