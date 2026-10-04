from flow_scanner.news import build_news_payload, fetch_market_news, attach_headline_news


class FakeResponse:
    def __init__(self, payload, *, error=None, text=None):
        self.payload = payload
        self.error = error
        self.text = text or ""

    def raise_for_status(self):
        if self.error:
            raise self.error
        return None

    def json(self):
        if self.payload is None:
            raise ValueError("not JSON")
        return self.payload


class FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def get(self, url, *, params, headers, timeout):
        self.calls.append((url, params, headers, timeout))
        return FakeResponse(self.payload)


class FallbackSession:
    def __init__(self):
        self.calls = []

    def get(self, url, *, params, headers, timeout):
        self.calls.append((url, params, headers, timeout))
        if len(self.calls) == 1:
            return FakeResponse({}, error=__import__("requests").HTTPError("403"))
        return FakeResponse(
            None,
            text='Title: x\n\nMarkdown Content:\n{"articles": [{"title": "PVP tin", "url": "https://example.test/pvp", "publishedAt": "2026-10-02T08:30:00Z", "sourceName": "Vietstock"}]}',
        )


def test_fetch_market_news_normalizes_daily_articles():
    session = FakeSession(
        {
            "articles": [
                {
                    "title": "PVP cong bo ket qua kinh doanh",
                    "url": "https://example.test/pvp",
                    "publishedAt": "2026-10-02T08:30:00Z",
                    "sourceName": "Vietstock",
                    "snippet": "PVP ghi nhan ket qua moi.",
                }
            ]
        }
    )

    articles = fetch_market_news("2026-10-02", session=session)

    assert articles[0]["title"] == "PVP cong bo ket qua kinh doanh"
    assert articles[0]["published_at"] == "2026-10-02T08:30:00Z"
    assert session.calls[0][1]["date"] == "2026-10-02"


def test_fetch_market_news_uses_transport_fallback_after_vietstock_forbidden():
    session = FallbackSession()

    articles = fetch_market_news("2026-10-02", session=session)

    assert articles[0]["title"] == "PVP tin"
    assert session.calls[0][0] == "https://vietstock.info/api/news/today"
    assert session.calls[1][0].startswith("https://r.jina.ai/http://vietstock.info/api/news/today")


def test_fetch_market_news_excludes_articles_after_the_requested_session():
    session = FakeSession(
        {
            "articles": [
                {
                    "title": "News trong phien",
                    "url": "https://example.test/in-session",
                    "publishedAt": "2026-10-02T08:30:00Z",
                    "sourceName": "Vietstock",
                },
                {
                    "title": "News tuong lai",
                    "url": "https://example.test/future",
                    "publishedAt": "2026-10-03T08:30:00Z",
                    "sourceName": "Vietstock",
                },
            ]
        }
    )

    assert [item["title"] for item in fetch_market_news("2026-10-02", session=session)] == ["News trong phien"]


def test_build_news_payload_keeps_general_news_and_maps_explicit_ticker():
    articles = [
        {
            "title": "PVP cong bo ket qua kinh doanh",
            "url": "https://example.test/pvp",
            "published_at": "2026-10-02T08:30:00Z",
            "source": "Vietstock",
            "snippet": "",
        },
        {
            "title": "VN-Index giam diem trong phien cuoi tuan",
            "url": "https://example.test/market",
            "published_at": "2026-10-02T09:00:00Z",
            "source": "Vietstock",
            "snippet": "",
        },
    ]

    payload = build_news_payload(articles, {"PVP": 42}, "2026-10-02")

    assert [row["symbol_id"] for row in payload] == [42, None]
    assert payload[0]["market_date"] == "2026-10-02"


def test_attach_headline_news_only_uses_symbol_relevant_articles():
    rows = [{"symbol": "PVP"}, {"symbol": "HHP"}]
    articles = build_news_payload(
        [
            {
                "title": "PVP cong bo ket qua kinh doanh",
                "url": "https://example.test/pvp",
                "published_at": "2026-10-02T08:30:00Z",
                "source": "Vietstock",
                "snippet": "",
            }
        ],
        {"PVP": 42, "HHP": 43},
        "2026-10-02",
    )

    result = attach_headline_news(rows, articles, {"PVP": 42, "HHP": 43})

    assert result[0]["headline_news"] == "PVP cong bo ket qua kinh doanh"
    assert result[1].get("headline_news") is None
