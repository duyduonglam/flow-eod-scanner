from flow_scanner.data.repository import SupabaseRepository
import pytest

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


class SymbolPageResponse(FakeResponse):
    def __init__(self, rows):
        self.rows = rows

    def json(self):
        return self.rows


class SymbolPageSession:
    def __init__(self, count, server_limit=1000):
        self.rows = [
            {"id": index, "symbol": f"S{index:04d}", "exchange": "HOSE"}
            for index in range(1, count + 1)
        ]
        self.server_limit = server_limit
        self.requests = []

    def get(self, url, params, headers, timeout):
        self.requests.append(params.copy())
        offset = int(params.get("offset", 0))
        limit = min(int(params.get("limit", 1000)), self.server_limit)
        return SymbolPageResponse(self.rows[offset:offset + limit])


@pytest.mark.parametrize("count,server_limit", [(1524, 1000), (2000, 1000), (524, 200), (0, 1000)])
def test_list_active_symbols_reads_complete_universe_beyond_server_row_cap(count, server_limit):
    session = SymbolPageSession(count, server_limit)
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    rows = repo.list_active_symbols()

    assert len(rows) == count
    assert [row["id"] for row in rows] == list(range(1, count + 1))
    assert all(params.get("order") == "id.asc" for params in session.requests)
    assert all(params["is_active"] == "eq.true" and params["asset_type"] == "eq.stock" for params in session.requests)
