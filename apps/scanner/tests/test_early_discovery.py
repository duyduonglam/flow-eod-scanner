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
    out=classify_early(rows)
    assert out['stage']=='NEW_BREAKOUT'
    assert out['volume_ratio']==2
    assert out['formula_version']=='early-dema-bb-v1'


def test_preparing_and_failed_breakout_are_distinct():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    # A small rise remains within the band.
    rows[-1]=replace(rows[-1],open=14.55,high=14.55,low=14.55,close=14.55)
    assert classify_early(rows)['stage']=='PREPARING'
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=1_000_000)
    assert classify_early(rows) is None


def test_early_liquidity_and_extension_boundaries():
    from flow_scanner.flow.early_discovery import classify_early
    rows=setup_rows()
    rows[-1]=replace(rows[-1],open=15,high=15,low=15,close=15,volume=2_000_000)
    assert classify_early([replace(r,volume=100_000) for r in rows]) is None
    assert classify_early(rows[:259]) is None
    assert classify_early(rows[:-1]+[replace(rows[-1],open=20,high=20,low=20,close=20)]) is None
