from datetime import date, timedelta
import math
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.main import scan_universe
from flow_scanner.persistence import build_stock_signal_payload

def history(symbol: str, growth: float, n=300):
    start = date(2025,1,1)
    rows=[]
    price=10.0
    for i in range(n):
        price *= 1 + growth
        rows.append(OHLCVRecord(symbol,start+timedelta(days=i),price*0.995,price*1.01,price*0.99,price,price,100000+i,'test'))
    return rows

def test_scan_universe_emits_required_table_fields():
    idx = history('VNINDEX', 0.0005)
    result = scan_universe({'AAA': history('AAA',0.001), 'BBB': history('BBB',0.0002)}, idx)
    assert len(result) == 2
    top = result[0]
    for key in ['symbol','flow_score','main_signal','entry_low','entry_high','stop_price','stop_distance_pct','one_r','two_r','three_r','decision','invalidation']:
        assert key in top
    assert top['rs_rating'] >= result[1]['rs_rating']


def test_stock_signal_payload_converts_non_json_floats_to_null():
    rows = [{
        "symbol": "AAA",
        "close": 10.0,
        "flow_score": math.nan,
        "banker": math.inf,
        "hot_money": -math.inf,
        "data_status": "VALID",
    }]

    payload = build_stock_signal_payload(rows, {"AAA": 1}, "2026-09-25")

    assert payload[0]["flow_score"] is None
    assert payload[0]["banker"] is None
    assert payload[0]["hot_money"] is None
    assert payload[0]["close"] == 10.0
