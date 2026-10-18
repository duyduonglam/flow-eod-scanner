from datetime import date, timedelta
from dataclasses import replace
from flow_scanner.domain.models import OHLCVRecord


def setup_rows():
    rows=[]
    for i in range(320):
        c=10+i*0.015
        rows.append(OHLCVRecord('AAA',date(2025,1,1)+timedelta(days=i),c,c,c,c,c,1_000_000,'fireant'))
    # A quiet pause keeps the trend stack and makes the next session a new breakout.
    for i in range(300,320):
        c=14.5+(0.05 if i%2 else -0.05)
        rows[i]=replace(rows[i],open=c,high=c,low=c,close=c)
    return rows


def test_classifier_detects_new_breakout_without_main_score_floor():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    out=classify_early(rows,rs_rating=80)
    assert out['stage']=='NEW_BREAKOUT'
    assert out['volume_ratio']==2
    assert out['formula_version']=='early-dema-bb-rs-ichi-v2'


def test_preparing_and_failed_breakout_are_distinct():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    # A small rise remains within the band.
    rows[-1]=replace(rows[-1],open=14.55,high=14.55,low=14.55,close=14.55)
    assert classify_early(rows,rs_rating=80)['stage']=='PREPARING'
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=1_000_000)
    assert classify_early(rows,rs_rating=80) is None


def test_early_liquidity_and_extension_boundaries():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    assert classify_early([replace(r,volume=100_000) for r in rows],rs_rating=80) is None
    assert classify_early(rows[:259],rs_rating=80) is None
    assert classify_early(rows[:-1]+[replace(rows[-1],open=20,high=20,low=20,close=20)],rs_rating=80) is None


def test_rs_gate_includes_80_but_rejects_lower_or_missing_rs():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    assert classify_early(rows,rs_rating=80)['rs_rating']==80
    assert classify_early(rows,rs_rating=79.99) is None
    assert classify_early(rows,rs_rating=None) is None


def test_cloud_context_uses_displaced_cloud_and_labels_positions():
    from flow_scanner.flow.early_discovery import ichimoku_context
    rows=setup_rows()
    a=ichimoku_context(rows)
    assert a['cloud_green'] is True
    assert a['cloud_position']=='ABOVE'
    assert a['ichimoku_priority']==1
    # Latest 26 bars must not alter the cloud displayed at the scan session.
    changed=rows.copy()
    for i in range(len(rows)-26,len(rows)):
        changed[i]=replace(rows[i],high=rows[i].high*2,low=rows[i].low*.5)
    b=ichimoku_context(changed)
    assert a['cloud_top']==b['cloud_top'] and a['cloud_bottom']==b['cloud_bottom']
    middle=(a['cloud_top']+a['cloud_bottom'])/2
    assert ichimoku_context(rows[:-1]+[replace(rows[-1],close=middle)])['ichimoku_priority']==0
    below=ichimoku_context(rows[:-1]+[replace(rows[-1],close=a['cloud_bottom']*.9)])
    assert below['ichimoku_priority']==0


def test_cloud_gate_requires_above_both_spans_regardless_of_color():
    from flow_scanner.flow.early_discovery import classify_early, ichimoku_context
    rows=setup_rows()
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    assert classify_early(rows,rs_rating=80) is not None
    # Historical high makes the displayed cloud red and above today's price.
    # Recent EMA/Bollinger inputs are untouched.
    rows[-60]=replace(rows[-60],high=100)
    assert ichimoku_context(rows)['cloud_position']!='ABOVE'
    assert classify_early(rows,rs_rating=80) is None
    # A red cloud still qualifies when price is above its upper edge.
    rows=setup_rows()
    for i in range(242,268):
        rows[i]=replace(rows[i],high=15.1)
    ctx=ichimoku_context(rows)
    assert ctx['cloud_green'] is False and ctx['cloud_position']=='ABOVE'
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    assert classify_early(rows,rs_rating=80) is not None
