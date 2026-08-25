import math
from flow_scanner.indicators.moving_averages import sma
from flow_scanner.indicators.rsi import rsi
from flow_scanner.indicators.mcdx import compute_mcdx
from flow_scanner.indicators.volume import volume_buzz, ud_volume_ratio
from flow_scanner.indicators.relative_strength import relative_performance, percentile_rs
from flow_scanner.indicators.swing import swing_direction

def test_sma_matches_simple_window():
    assert sma([1,2,3,4,5],3) == [None,None,2.0,3.0,4.0]

def test_wilder_rsi_monotonic_gain_reaches_100():
    values = [float(i) for i in range(1, 70)]
    result = rsi(values, 14)
    assert result[-1] == 100.0

def test_wilder_rsi_flat_is_50():
    values = [10.0] * 30
    assert rsi(values, 14)[-1] == 50.0

def test_mcdx_values_are_bounded_and_retailer_zero_in_strong_uptrend():
    values = [float(i) for i in range(1, 100)]
    result = compute_mcdx(values)
    assert result['banker'][-1] == 100.0
    assert result['hot_money_line'][-1] == 100.0
    assert result['hot_money'][-1] == 0.0  # Pine display normalizes to 100 - banker - retailer
    assert result['retailer'][-1] == 0.0
    assert 0 <= result['banker_ma'][-1] <= 100

def test_volume_buzz_matches_pine_formula_including_current_bar():
    volumes = [100] * 49 + [200]
    expected = (200 / ((49*100+200)/50) - 1) * 100
    assert math.isclose(volume_buzz(volumes), expected)

def test_ud_volume_is_strict_up_down():
    closes = [1.0] + [2.0 if i % 2 == 0 else 1.0 for i in range(50)]
    vols = [100] * 51
    assert math.isclose(ud_volume_ratio(closes, vols), 1.0)

def test_relative_performance_uses_weighted_63_126_189_252_lookbacks():
    index = [100.0] * 253
    stock = [100.0] * 253
    stock[-1] = 200.0
    assert relative_performance(stock, index) == 200.0

def test_percentile_rs_caps_at_99_and_preserves_order():
    out = percentile_rs({'A': 80.0, 'B': 100.0, 'C': 120.0})
    assert out['C'] == 99
    assert out['A'] < out['B'] < out['C']

def test_swing_direction_tracks_latest_rolling_extreme():
    highs = list(map(float, range(1, 61)))
    lows = [x - 1 for x in highs]
    assert swing_direction(highs, lows, 50) == 'UP'

def test_mcdx_display_components_sum_to_100_when_available():
    values=[100 + ((i % 9)-4)*0.7 + i*0.08 for i in range(120)]
    result=compute_mcdx(values)
    b=result['banker'][-1]; h=result['hot_money'][-1]; r=result['retailer'][-1]
    assert b is not None and h is not None and r is not None
    assert math.isclose(b+h+r,100.0,abs_tol=1e-9)
