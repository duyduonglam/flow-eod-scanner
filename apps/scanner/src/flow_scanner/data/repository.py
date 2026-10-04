from __future__ import annotations
import time
import requests

UPSERT_BATCH_SIZE = 200
MAX_WRITE_ATTEMPTS = 3

class SupabaseRepository:
    def __init__(self, url: str, service_role_key: str, session: requests.Session | None = None):
        self.url = url.rstrip('/')
        self.key = service_role_key
        self.session = session or requests.Session()

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json',
        }
        if extra:
            headers.update(extra)
        return headers

    def list_active_symbols(self) -> list[dict]:
        response = self.session.get(
            f'{self.url}/rest/v1/symbols',
            params={'select':'id,symbol,exchange', 'is_active':'eq.true', 'asset_type':'eq.stock'},
            headers=self._headers(), timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def upsert_symbols(self, rows: list[dict]) -> None:
        if not rows:
            return
        payload = [
            {
                'symbol': str(row['symbol']).upper(),
                'exchange': row['exchange'],
                'asset_type': 'stock',
                'is_active': True,
            }
            for row in rows
        ]
        response = self.session.post(
            f'{self.url}/rest/v1/symbols',
            params={'on_conflict': 'symbol'},
            headers=self._headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def _post_json_with_retry(self, url: str, *, params: dict[str, str], payload: list[dict]) -> None:
        last_error: requests.RequestException | None = None
        for attempt in range(MAX_WRITE_ATTEMPTS):
            try:
                response = self.session.post(
                    url,
                    params=params,
                    headers=self._headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
                    json=payload,
                    timeout=60,
                )
                response.raise_for_status()
                return
            except (requests.ConnectionError, requests.Timeout) as exc:
                last_error = exc
                if attempt == MAX_WRITE_ATTEMPTS - 1:
                    raise
                time.sleep(2 * (attempt + 1))
        if last_error:
            raise last_error

    def _upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        url = f'{self.url}/rest/v1/{table}'
        params = {'on_conflict': on_conflict}
        for index in range(0, len(rows), UPSERT_BATCH_SIZE):
            self._post_json_with_retry(url, params=params, payload=rows[index:index + UPSERT_BATCH_SIZE])

    def upsert_scan_rows(self, rows: list[dict]) -> None:
        self._upsert('scan_results', rows, 'market_date,symbol_id')

    def upsert_market_regime(self, row: dict) -> None:
        self._upsert('market_regimes', [row], 'market_date')

    def delete_scan_rows_for_date(self, market_date: str) -> None:
        response = self.session.delete(
            f'{self.url}/rest/v1/scan_results',
            params={'market_date': f'eq.{market_date}'},
            headers=self._headers({'Prefer': 'return=minimal'}),
            timeout=30,
        )
        response.raise_for_status()

    def upsert_stock_signal_rows(self, rows: list[dict]) -> None:
        self._upsert('stock_signals', rows, 'market_date,symbol_id')

    def delete_news_items_for_date(self, market_date: str) -> None:
        response = self.session.delete(
            f'{self.url}/rest/v1/news_items',
            params={'market_date': f'eq.{market_date}'},
            headers=self._headers({'Prefer': 'return=minimal'}),
            timeout=30,
        )
        response.raise_for_status()

    def insert_news_items(self, rows: list[dict]) -> None:
        if not rows:
            return
        url = f'{self.url}/rest/v1/news_items'
        for index in range(0, len(rows), UPSERT_BATCH_SIZE):
            response = self.session.post(
                url,
                headers=self._headers({'Prefer': 'return=minimal'}),
                json=rows[index:index + UPSERT_BATCH_SIZE],
                timeout=60,
            )
            response.raise_for_status()

    def replace_news_items_for_date(self, market_date: str, rows: list[dict]) -> None:
        if not rows:
            return
        self.delete_news_items_for_date(market_date)
        self.insert_news_items(rows)
