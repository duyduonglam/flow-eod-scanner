from flow_scanner.flow.composite_score import compute_composite_score
from flow_scanner.flow.entry_engine import build_trade_plan
from flow_scanner.flow.trend_template import compute_trend_template
from flow_scanner.indicators.mcdx import latest_mcdx
from flow_scanner.indicators.swing import swing_direction


def rising_series(n=300, growth=0.01, start=10.0):
    closes = []
    price = start
    for _ in range(n):
        price *= 1 + growth
        closes.append(price)
    highs = [close * 1.01 for close in closes]
    lows = [close * 0.99 for close in closes]
    volumes = [100_000 + i * 500 for i in range(n)]
    return closes, highs, lows, volumes


def test_composite_score_combines_flow_mcdx_volume_swing_and_rs():
    closes, highs, lows, volumes = rising_series()
    trend = compute_trend_template(closes, highs, lows, rs_rating=95, banker=95)
    mcdx = latest_mcdx(closes)
    swing = swing_direction(highs, lows)
    plan = build_trade_plan(highs, lows, closes, 90, swing)

    result = compute_composite_score(
        closes=closes,
        highs=highs,
        lows=lows,
        volumes=volumes,
        trend=trend,
        mcdx=mcdx,
        rs_rating=95,
        swing=swing,
        plan=plan,
    )

    assert result.total_score >= 70
    assert result.label == "PARTIAL"
    assert result.score_version == "volume-mcdx-flow-v1"
    assert result.components["structure"] > 0
    assert result.components["mcdx"] > 0
    assert result.components["volume"] > 0
    assert result.components["swing_entry"] > 0
    assert result.components["rs"] == 15


def test_composite_score_penalizes_extended_entries_even_when_trend_is_strong():
    closes, highs, lows, volumes = rising_series(n=300, growth=0.002)
    highs[-21:-1] = [100.0] * 20
    lows[-10:] = [94.0] * 10
    closes[-1] = 108.0
    highs[-1] = 109.0
    lows[-1] = 107.0
    trend = compute_trend_template(closes, highs, lows, rs_rating=95, banker=95)
    mcdx = latest_mcdx(closes)
    swing = "UP"
    plan = build_trade_plan(highs, lows, closes, 90, swing)

    result = compute_composite_score(
        closes=closes,
        highs=highs,
        lows=lows,
        volumes=volumes,
        trend=trend,
        mcdx=mcdx,
        rs_rating=95,
        swing=swing,
        plan=plan,
    )

    assert plan.decision == "DO NOT CHASE"
    assert result.components["swing_entry"] < 10
    assert "Extended above Entry Zone" in result.notes

