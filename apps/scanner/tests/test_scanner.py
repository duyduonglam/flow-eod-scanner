from datetime import date, timedelta
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.main import scan_universe

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
