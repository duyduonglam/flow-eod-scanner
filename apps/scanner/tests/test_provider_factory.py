from flow_scanner.data.providers.factory import build_provider_chain
from flow_scanner.data.providers.vnstock import VnStockProvider, normalize_symbol_listing

def test_provider_chain_has_zero_key_fallback(monkeypatch):
    monkeypatch.delenv('FIREANT_API_KEY', raising=False)
    monkeypatch.delenv('OPENSTOCK_API_KEY', raising=False)
    chain=build_provider_chain()
    assert len(chain)==1
    assert isinstance(chain[0],VnStockProvider)


def test_normalize_symbol_listing_keeps_stocks_and_exchange_codes():
    rows = [
        {"symbol": "VCB", "exchange": "HSX", "type": "STOCK"},
        {"symbol": "PVS", "exchange": "HNX", "type": "STOCK"},
        {"symbol": "BSR", "exchange": "UPCOM", "type": "STOCK"},
        {"symbol": "VNINDEX", "exchange": "HOSE", "type": "INDEX"},
        {"symbol": "", "exchange": "HOSE", "type": "STOCK"},
    ]

    assert normalize_symbol_listing(rows) == [
        {"symbol": "VCB", "exchange": "HOSE"},
        {"symbol": "PVS", "exchange": "HNX"},
        {"symbol": "BSR", "exchange": "UPCOM"},
    ]
