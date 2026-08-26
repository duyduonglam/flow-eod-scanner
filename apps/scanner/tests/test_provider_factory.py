from flow_scanner.data.providers.factory import build_provider_chain
from flow_scanner.data.providers.vnstock import VnStockProvider, normalize_symbol_listing
from datetime import date
import sys
import types

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


def test_vnstock_provider_uses_quote_bar_length(monkeypatch):
    class FakeFrame:
        def iterrows(self):
            yield 0, {"time": "2026-08-25", "open": 10, "high": 11, "low": 9, "close": 10.5, "volume": 1000}

    class FakeQuote:
        calls = []

        def __init__(self, symbol, source):
            self.symbol = symbol
            self.source = source

        def history(self, **kwargs):
            self.calls.append(kwargs)
            return FakeFrame()

    vnstock_module = types.ModuleType("vnstock")
    vnstock_module.__path__ = []
    api_module = types.ModuleType("vnstock.api")
    api_module.__path__ = []
    quote_module = types.ModuleType("vnstock.api.quote")
    quote_module.Quote = FakeQuote
    monkeypatch.setitem(sys.modules, "vnstock", vnstock_module)
    monkeypatch.setitem(sys.modules, "vnstock.api", api_module)
    monkeypatch.setitem(sys.modules, "vnstock.api.quote", quote_module)

    rows = VnStockProvider(source="VCI").fetch_daily_prices("AAA", date(2025, 6, 1), date(2026, 8, 25))

    assert FakeQuote.calls == [{"end": "2026-08-25", "length": "300b", "interval": "1D"}]
    assert rows[0].symbol == "AAA"
    assert rows[0].market_date == date(2026, 8, 25)
