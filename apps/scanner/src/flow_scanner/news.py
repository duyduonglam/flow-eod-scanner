from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
import json
import re
from typing import Any

import requests


NEWS_ENDPOINT = "https://vietstock.info/api/news/today"
NEWS_PROXY_ENDPOINT = "https://r.jina.ai/http://vietstock.info/api/news/today"
NEWS_TIMEOUT_SECONDS = 30
VIETNAM_TZ = timezone(timedelta(hours=7))


def _parse_published_at(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _article_date(published_at: str | None) -> date | None:
    parsed = _parse_published_at(published_at)
    return parsed.astimezone(VIETNAM_TZ).date() if parsed else None


def _decode_news_payload(response: requests.Response) -> Any:
    """Decode direct JSON or JSON wrapped by the read-only transport proxy."""
    try:
        return response.json()
    except (ValueError, requests.exceptions.JSONDecodeError):
        body = response.text
        marker = "Markdown Content:"
        if marker in body:
            body = body.split(marker, 1)[1].strip()
        start = body.find("{")
        end = body.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("News response did not contain a JSON object")
        return json.loads(body[start:end + 1])


def _fetch_news_payload(
    market_date: str,
    *,
    session: requests.Session,
    page_size: int,
) -> Any:
    params = {"date": market_date, "page": 1, "pageSize": page_size}
    try:
        response = session.get(
            NEWS_ENDPOINT,
            params=params,
            headers={"Accept": "application/json", "User-Agent": "FLOW-Vietnam/1.1"},
            timeout=NEWS_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return _decode_news_payload(response)
    except requests.RequestException as direct_error:
        # GitHub-hosted runners can receive a 403 from Vietstock while the
        # same public endpoint remains reachable through this read-only proxy.
        # The URL and JSON payload are unchanged; this is only a transport
        # fallback, not a second news source.
        try:
            response = session.get(
                NEWS_PROXY_ENDPOINT,
                params=params,
                headers={"Accept": "text/plain", "User-Agent": "FLOW-Vietnam/1.1"},
                timeout=NEWS_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return _decode_news_payload(response)
        except requests.RequestException as proxy_error:
            raise RuntimeError(
                f"Vietstock news unavailable directly ({direct_error}); proxy fallback failed ({proxy_error})"
            ) from proxy_error


def fetch_market_news(
    market_date: str,
    *,
    session: requests.Session | None = None,
    page_size: int = 100,
) -> list[dict[str, Any]]:
    client = session or requests.Session()
    payload = _fetch_news_payload(market_date, session=client, page_size=page_size)
    raw_articles = payload.get("articles", []) if isinstance(payload, dict) else payload
    if not isinstance(raw_articles, list):
        return []

    requested_date = date.fromisoformat(market_date)
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in raw_articles:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()
        url = str(raw.get("url") or "").strip() or None
        source = str(raw.get("sourceName") or "Vietstock News").strip()
        published_at = raw.get("publishedAt")
        published_text = str(published_at).strip() if published_at else None
        if not title or not published_text or _article_date(published_text) != requested_date:
            continue
        identity = url or title.casefold()
        if identity in seen:
            continue
        seen.add(identity)
        normalized.append(
            {
                "title": title,
                "url": url,
                "published_at": published_text,
                "source": source or "Vietstock News",
                "snippet": str(raw.get("snippet") or raw.get("summaryVi") or "").strip(),
            }
        )

    return normalized


def _mentions_symbol(text: str, symbol: str) -> bool:
    return re.search(rf"(?<![A-Z0-9]){re.escape(symbol.upper())}(?![A-Z0-9])", text.upper()) is not None


def build_news_payload(
    articles: list[dict[str, Any]],
    symbol_ids: dict[str, int],
    market_date: str,
) -> list[dict[str, Any]]:
    symbols = {str(symbol).upper(): int(symbol_id) for symbol, symbol_id in symbol_ids.items()}
    payload: list[dict[str, Any]] = []
    for article in articles:
        title = str(article.get("title") or "").strip()
        if not title:
            continue
        context = f"{title} {article.get('snippet') or ''}"
        matched_ids = [symbol_id for symbol, symbol_id in symbols.items() if _mentions_symbol(context, symbol)]
        targets = matched_ids or [None]
        for symbol_id in targets:
            payload.append(
                {
                    "market_date": market_date,
                    "symbol_id": symbol_id,
                    "title": title,
                    "url": article.get("url"),
                    "category": "MARKET_NEWS",
                    "sentiment": "NEUTRAL",
                    "source": article.get("source") or "Vietstock News",
                    "published_at": article.get("published_at"),
                }
            )
    return payload


def attach_headline_news(
    rows: list[dict[str, Any]],
    news_items: list[dict[str, Any]],
    symbol_ids: dict[str, int],
) -> list[dict[str, Any]]:
    ids_by_symbol = {str(symbol).upper(): int(symbol_id) for symbol, symbol_id in symbol_ids.items()}
    by_symbol_id: dict[int, dict[str, Any]] = {}
    for item in news_items:
        symbol_id = item.get("symbol_id")
        if symbol_id is None or symbol_id in by_symbol_id:
            continue
        by_symbol_id[int(symbol_id)] = item

    enriched: list[dict[str, Any]] = []
    for row in rows:
        enriched_row = dict(row)
        symbol_id = ids_by_symbol.get(str(row.get("symbol") or "").upper())
        item = by_symbol_id.get(symbol_id) if symbol_id is not None else None
        if item:
            enriched_row["headline_news"] = item["title"]
        enriched.append(enriched_row)
    return enriched
