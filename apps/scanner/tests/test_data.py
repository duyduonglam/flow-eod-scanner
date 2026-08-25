from datetime import date
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.data.validator import validate_price_record, resolve_price

def rec(close=20.4, source='a', market_date=date(2026,8,25)):
    low = min(19.8, close)
    high = max(20.5, close)
    open_price = min(max(20.0, low), high)
    return OHLCVRecord('PVT', market_date, open_price, high, low, close, 20.3, 1_000_000, source)

def test_valid_price_record():
    assert validate_price_record(rec())[0]

def test_rejects_close_outside_range():
    bad = OHLCVRecord('PVT', date(2026,8,25), 20.0, 20.5, 19.8, 21.0, 20.3, 1, 'x')
    assert validate_price_record(bad)[0] is False

def test_two_sources_must_agree():
    out = resolve_price(rec(20.4,'a'), rec(18.3,'b'))
    assert out.status == 'DATA_CONFLICT'
    assert out.record is None

def test_fallback_used_when_primary_invalid():
    bad = OHLCVRecord('PVT', date(2026,8,25), 21, 20, 19, 20, 20, 1, 'a')
    out = resolve_price(bad, rec(20.4,'b'))
    assert out.status == 'FALLBACK'
