from flow_scanner.data.providers.factory import build_provider_chain
from flow_scanner.data.providers.vnstock import VnStockProvider

def test_provider_chain_has_zero_key_fallback(monkeypatch):
    monkeypatch.delenv('FIREANT_API_KEY', raising=False)
    monkeypatch.delenv('OPENSTOCK_API_KEY', raising=False)
    chain=build_provider_chain()
    assert len(chain)==1
    assert isinstance(chain[0],VnStockProvider)
