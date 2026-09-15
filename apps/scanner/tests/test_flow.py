from flow_scanner.flow.trend_template import compute_trend_template
from flow_scanner.flow.risk_engine import compute_r_levels
from flow_scanner.flow.entry_engine import build_trade_plan
from flow_scanner.flow.market_regime import classify_market_mode
from flow_scanner.flow.ranking import rank_candidates
from flow_scanner.flow.supplemental import (
    compute_supplemental_strength,
    flow_strength_score,
    grade_for_score,
)
from flow_scanner.indicators.mcdx import compute_mcdx
from flow_scanner.indicators.volume import volume_buzz, ud_volume_ratio
from flow_scanner.indicators.swing import swing_direction


def rising_series(n=300):
    closes = [100 + i * 0.5 for i in range(n)]
    highs = [c * 1.01 for c in closes]
    lows = [c * 0.99 for c in closes]
    return closes, highs, lows


def test_trend_template_has_11_checks_and_yes_threshold():
    closes, highs, lows = rising_series()
    result = compute_trend_template(closes, highs, lows, 95, 95)
    assert result is not None
    assert result.total_count == 11
    assert result.pass_count == 11
    assert result.score_pct == 100.0
    assert result.label == 'YES'


def test_partial_threshold_matches_pine():
    closes, highs, lows = rising_series()
    result = compute_trend_template(closes, highs, lows, 80, 20)
    assert result is not None
    assert result.pass_count == 9
    assert round(result.score_pct, 1) == 81.8
    assert result.label == 'PARTIAL'


def test_flow_strength_uses_70_30_weighting_and_grades():
    assert flow_strength_score(100, 50) == 85.0
    assert flow_strength_score(90, 80) == 87.0
    assert grade_for_score(90) == 'A+'
    assert grade_for_score(85) == 'A'
    assert grade_for_score(80) == 'B'
    assert grade_for_score(75) == 'C'
    assert grade_for_score(74.9) == '-'


def test_supplemental_score_is_bounded_and_uses_six_groups():
    closes = [10.0]
    for _ in range(1, 300):
        closes.append(closes[-1] * 1.003)
    highs = [c * 1.01 for c in closes]
    lows = [c * 0.99 for c in closes]
    volumes = [100000 + i * 100 for i in range(300)]

    index = [10.0]
    for _ in range(1, 300):
        index.append(index[-1] * 1.001)

    result = compute_supplemental_strength(
        closes,
        highs,
        lows,
        volumes,
        index,
        compute_mcdx(closes),
        swing_direction(highs, lows),
        volume_buzz(volumes),
        ud_volume_ratio(closes, volumes),
    )

    assert 0 <= result.score <= 100
    assert set(result.components) == {
        'volume_quality',
        'mcdx_quality',
        'setup',
        'momentum_confirmation',
        'price_structure',
        'risk_timing',
    }
    assert result.rs_new_high is True


def test_supplemental_penalizes_chasing_more_than_five_percent_above_pivot():
    closes = [10.0]
    for _ in range(1, 300):
        closes.append(closes[-1] * 1.003)
    highs = [c * 1.01 for c in closes]
    lows = [c * 0.99 for c in closes]
    volumes = [100000 + i * 100 for i in range(300)]

    index = [10.0]
    for _ in range(1, 300):
        index.append(index[-1] * 1.001)

    base = compute_supplemental_strength(
        closes,
        highs,
        lows,
        volumes,
        index,
        compute_mcdx(closes),
        swing_direction(highs, lows),
        volume_buzz(volumes),
        ud_volume_ratio(closes, volumes),
    )

    chased_closes = closes.copy()
    chased_highs = highs.copy()
    chased_lows = lows.copy()
    pivot = max(chased_highs[-21:-1])
    chased_closes[-1] = pivot * 1.08
    chased_highs[-1] = chased_closes[-1] * 1.01
    chased_lows[-1] = chased_closes[-1] * 0.99

    chased = compute_supplemental_strength(
        chased_closes,
        chased_highs,
        chased_lows,
        volumes,
        index,
        compute_mcdx(chased_closes),
        swing_direction(chased_highs, chased_lows),
        volume_buzz(volumes),
        ud_volume_ratio(chased_closes, volumes),
    )

    assert chased.pivot_distance_pct is not None and chased.pivot_distance_pct > 5
    assert chased.penalty >= 12
    assert chased.score < base.score


def test_r_levels():
    levels = compute_r_levels(20, 19)
    assert levels is not None
    assert levels.stop_distance_pct == 5
    assert levels.one_r == 21
    assert levels.two_r == 22
    assert levels.three_r == 23


def test_trade_plan_refuses_to_chase_extended_price():
    closes, highs, lows = rising_series(40)
    highs[-21:-1] = [100.0] * 20
    lows[-10:] = [94.0] * 10
    closes[-1] = 107.0
    plan = build_trade_plan(highs, lows, closes, 90, 'UP')
    assert plan.decision == 'DO NOT CHASE'
    assert plan.chase_risk == 'HIGH'


def test_market_mode():
    assert classify_market_mode(1.2, 350, 200) == 'RISK ON'
    assert classify_market_mode(-1.5, 150, 300) == 'RISK OFF'


def test_ranking_prefers_actionable_decision_then_score():
    rows = [
        {'symbol':'A','decision':'WATCH','flow_score':99,'rs_rating':99},
        {'symbol':'B','decision':'BUY RETEST','flow_score':85,'rs_rating':91},
    ]
    assert rank_candidates(rows)[0]['symbol'] == 'B'
