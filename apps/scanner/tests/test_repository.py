from flow_scanner.data.repository import SupabaseRepository

def test_repository_headers_use_service_key():
    repo=SupabaseRepository('https://example.supabase.co','secret')
    h=repo._headers()
    assert h['apikey']=='secret'
    assert h['Authorization']=='Bearer secret'


class FakeResponse:
    def raise_for_status(self):
        return None


class FakeSession:
    def __init__(self):
        self.posts = []

    def post(self, url, headers=None, json=None, params=None, timeout=None):
        self.posts.append({
            "url": url,
            "headers": headers,
            "json": json,
            "params": params,
            "timeout": timeout,
        })
        return FakeResponse()


def test_upsert_scan_rows_uses_market_date_symbol_conflict_key():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.upsert_scan_rows([{"market_date": "2026-08-25", "symbol_id": 1}])

    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/scan_results"
    assert session.posts[0]["params"] == {"on_conflict": "market_date,symbol_id"}
    assert session.posts[0]["headers"]["Prefer"] == "resolution=merge-duplicates,return=minimal"


def test_upsert_stock_signal_rows_uses_market_date_symbol_conflict_key():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.upsert_stock_signal_rows([{"market_date": "2026-08-25", "symbol_id": 1}])

    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/stock_signals"
    assert session.posts[0]["params"] == {"on_conflict": "market_date,symbol_id"}
    assert session.posts[0]["headers"]["Prefer"] == "resolution=merge-duplicates,return=minimal"


def test_upsert_symbols_uses_symbol_conflict_key():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.upsert_symbols([{"symbol": "vhm", "exchange": "HOSE"}])

    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/symbols"
    assert session.posts[0]["params"] == {"on_conflict": "symbol"}
    assert session.posts[0]["headers"]["Prefer"] == "resolution=merge-duplicates,return=minimal"
    assert session.posts[0]["json"] == [
        {"symbol": "VHM", "exchange": "HOSE", "asset_type": "stock", "is_active": True}
    ]
