import requests

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


def test_upsert_stock_signal_rows_splits_large_payloads_into_chunks():
    session = FakeSession()
    repo = SupabaseRepository(
        "https://example.supabase.co",
        "secret",
        session=session,
        upsert_chunk_size=2,
    )

    repo.upsert_stock_signal_rows([
        {"market_date": "2026-09-14", "symbol_id": 1},
        {"market_date": "2026-09-14", "symbol_id": 2},
        {"market_date": "2026-09-14", "symbol_id": 3},
    ])

    assert [post["json"] for post in session.posts] == [
        [
            {"market_date": "2026-09-14", "symbol_id": 1},
            {"market_date": "2026-09-14", "symbol_id": 2},
        ],
        [{"market_date": "2026-09-14", "symbol_id": 3}],
    ]


class TimeoutOnceSession(FakeSession):
    def __init__(self):
        super().__init__()
        self.failures_remaining = 1

    def post(self, url, headers=None, json=None, params=None, timeout=None):
        if self.failures_remaining:
            self.failures_remaining -= 1
            self.posts.append({
                "url": url,
                "headers": headers,
                "json": json,
                "params": params,
                "timeout": timeout,
                "failed": True,
            })
            raise requests.Timeout("write operation timed out")
        return super().post(url, headers=headers, json=json, params=params, timeout=timeout)


def test_upsert_stock_signal_rows_retries_transient_timeouts():
    session = TimeoutOnceSession()
    repo = SupabaseRepository(
        "https://example.supabase.co",
        "secret",
        session=session,
        upsert_retries=2,
        retry_sleep_seconds=0,
    )

    repo.upsert_stock_signal_rows([{"market_date": "2026-09-14", "symbol_id": 1}])

    assert len(session.posts) == 2
    assert session.posts[0]["failed"] is True
    assert session.posts[1]["json"] == [{"market_date": "2026-09-14", "symbol_id": 1}]


def test_delete_scan_rows_for_date_removes_stale_published_results():
    session = FakeSession()
    repo = SupabaseRepository("https://example.supabase.co", "secret", session=session)

    repo.delete_scan_rows_for_date("2026-09-25")

    assert session.deletes == [
        {
            "url": "https://example.supabase.co/rest/v1/scan_results",
            "headers": repo._headers(),
            "params": {"market_date": "eq.2026-09-25"},
            "timeout": 60,
        }
    ]
