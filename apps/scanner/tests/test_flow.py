from flow_scanner.flow.trend_template import compute_trend_template
from flow_scanner.flow.risk_engine import compute_r_levels
from flow_scanner.flow.entry_engine import build_trade_plan
from flow_scanner.flow.market_regime import classify_market_mode
from flow_scanner.flow.ranking import rank_candidates

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
