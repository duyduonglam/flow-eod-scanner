from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
import re
from typing import Any

import requests


NEWS_ENDPOINT = "https://vietstock.info/api/news/today"
FIREANT_ENDPOINT = "https://api.fireant.vn"
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


def _fetch_vietstock_payload(
    market_date: str,
    *,
    session: requests.Session,
    page_size: int,
) -> Any:
    params = {"date": market_date, "page": 1, "pageSize": page_size}
    response = session.get(
        NEWS_ENDPOINT,
        params=params,
        headers={"Accept": "application/json", "User-Agent": "FLOW-Vietnam/1.2"},
        timeout=NEWS_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def fetch_market_news(
    market_date: str,
    *,
    session: requests.Session | None = None,
    page_size: int = 100,
) -> list[dict[str, Any]]:
    client = session or requests.Session()
    payload = _fetch_vietstock_payload(market_date, session=client, page_size=page_size)
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


def fetch_fireant_news(
    market_date: str,
    symbols: list[str],
    *,
    session: requests.Session | None = None,
    max_symbols: int = 35,
    page_size: int = 20,
) -> list[dict[str, Any]]:
    """Fetch dated FireAnt posts for a bounded set of scanned symbols.

    FireAnt is used through its documented anonymous-login and posts endpoints.
    We never treat a provider homepage as an article URL; an attached file or
    explicit content URL is the only accepted link from a post.
    """
    client = session or requests.Session()
    login = client.post(
        f"{FIREANT_ENDPOINT}/authentication/anonymous-login",
        headers={"Accept": "application/json", "User-Agent": "FLOW-Vietnam/1.2"},
        timeout=NEWS_TIMEOUT_SECONDS,
    )
    login.raise_for_status()
    login_payload = login.json()
    token = None
    if isinstance(login_payload, dict):
        token = login_payload.get("accessToken") or login_payload.get("access_token") or login_payload.get("token")
    if not token:
        raise RuntimeError("FireAnt anonymous login did not return an access token")
    client.headers.update({"Authorization": f"Bearer {token}"})

    cutoff = datetime.combine(date.fromisoformat(market_date), datetime.max.time(), tzinfo=VIETNAM_TZ)
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for requested_symbol in list(dict.fromkeys(symbols))[:max_symbols]:
        symbol = str(requested_symbol or "").strip().upper()
        if not symbol:
            continue
        response = client.get(
            f"{FIREANT_ENDPOINT}/symbols/{symbol}/posts",
            params={"type": 1, "offset": 0, "limit": page_size},
            headers={"Accept": "application/json", "User-Agent": "FLOW-Vietnam/1.2"},
            timeout=NEWS_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        raw_posts = payload.get("data", []) if isinstance(payload, dict) else payload
        if not isinstance(raw_posts, list):
            continue
        for raw in raw_posts:
            if not isinstance(raw, dict):
                continue
            published_text = str(raw.get("date") or raw.get("publishedAt") or "").strip() or None
            published = _parse_published_at(published_text)
            if published is None or published.astimezone(VIETNAM_TZ) > cutoff:
                continue
            if published.astimezone(VIETNAM_TZ).date() != date.fromisoformat(market_date):
                continue
            title = str(raw.get("title") or raw.get("description") or "").strip()
            if not title:
                continue
            url = str(raw.get("contentURL") or raw.get("contentUrl") or raw.get("link") or "").strip() or None
            if not url:
                for attached in raw.get("files") or []:
                    if isinstance(attached, dict):
                        url = str(attached.get("fileContentUrl") or attached.get("url") or "").strip() or None
                        if url:
                            break
            source_data = raw.get("postSource")
            source = str(source_data.get("name") if isinstance(source_data, dict) else source_data or "FireAnt").strip()
            tagged = raw.get("taggedSymbols") or []
            explicit_symbol = symbol
            if tagged and isinstance(tagged[0], dict):
                explicit_symbol = str(tagged[0].get("symbol") or symbol).strip().upper()
            identity = url or f"{explicit_symbol}:{title.casefold()}"
            if identity in seen:
                continue
            seen.add(identity)
            normalized.append(
                {
                    "title": title,
                    "url": url,
                    "published_at": published_text,
                    "source": source or "FireAnt",
                    "snippet": str(raw.get("summary") or raw.get("description") or "").strip(),
                    "symbol": explicit_symbol,
                }
            )
    normalized.sort(key=lambda item: _parse_published_at(item.get("published_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
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
        matched_symbols: list[str] = []
        explicit_symbol = str(article.get("symbol") or "").upper().strip()
        if explicit_symbol in symbols:
            matched_symbols.append(explicit_symbol)
        matched_symbols.extend(symbol for symbol in symbols if symbol not in matched_symbols and _mentions_symbol(context, symbol))
        matched_ids = [symbols[symbol] for symbol in matched_symbols]
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
