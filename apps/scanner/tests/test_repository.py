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
        self.deletes = []

    def post(self, url, headers=None, json=None, params=None, timeout=None):
        self.posts.append({
            "url": url,
            "headers": headers,
            "json": json,
            "params": params,
            "timeout": timeout,
        })
        return FakeResponse()

    def delete(self, url, headers=None, params=None, timeout=None):
        self.deletes.append({
            "url": url,
            "headers": headers,
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


def test_delete_scan_rows_for_date_removes_stale_published_rows():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.delete_scan_rows_for_date("2026-09-28")

    assert session.deletes[0]["url"] == "https://example.supabase.co/rest/v1/scan_results"
    assert session.deletes[0]["params"] == {"market_date": "eq.2026-09-28"}
    assert session.deletes[0]["headers"]["Prefer"] == "return=minimal"


def test_upsert_stock_signal_rows_uses_market_date_symbol_conflict_key():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.upsert_stock_signal_rows([{"market_date": "2026-08-25", "symbol_id": 1}])

    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/stock_signals"
    assert session.posts[0]["params"] == {"on_conflict": "market_date,symbol_id"}
    assert session.posts[0]["headers"]["Prefer"] == "resolution=merge-duplicates,return=minimal"


def test_upsert_market_regime_uses_market_date_conflict_key():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.upsert_market_regime({"market_date": "2026-09-29", "market_mode": "NORMAL"})

    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/market_regimes"
    assert session.posts[0]["params"] == {"on_conflict": "market_date"}
    assert session.posts[0]["json"] == [{"market_date": "2026-09-29", "market_mode": "NORMAL"}]


def test_upsert_stock_signal_rows_batches_large_payloads():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)
    rows = [{"market_date": "2026-08-25", "symbol_id": index} for index in range(401)]

    repo.upsert_stock_signal_rows(rows)

    assert [len(post["json"]) for post in session.posts] == [200, 200, 1]
    assert all(post["timeout"] == 60 for post in session.posts)


def test_replace_news_items_for_date_replaces_only_the_selected_session():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)
    rows = [{"market_date": "2026-10-02", "title": "News", "source": "Vietstock"}]

    repo.replace_news_items_for_date("2026-10-02", rows)

    assert session.deletes[0]["url"] == "https://example.supabase.co/rest/v1/news_items"
    assert session.deletes[0]["params"] == {"market_date": "eq.2026-10-02"}
    assert session.posts[0]["url"] == "https://example.supabase.co/rest/v1/news_items"
    assert session.posts[0]["params"] is None
    assert session.posts[0]["json"] == rows


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
