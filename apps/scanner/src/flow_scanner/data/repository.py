from __future__ import annotations
import time

import requests

class SupabaseRepository:
    def __init__(
        self,
        url: str,
        service_role_key: str,
        session: requests.Session | None = None,
        upsert_chunk_size: int = 250,
        upsert_retries: int = 3,
        retry_sleep_seconds: float = 1.0,
    ):
        self.url = url.rstrip('/')
        self.key = service_role_key
        self.session = session or requests.Session()
        self.upsert_chunk_size = upsert_chunk_size
        self.upsert_retries = upsert_retries
        self.retry_sleep_seconds = retry_sleep_seconds

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

    def _upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        for start in range(0, len(rows), self.upsert_chunk_size):
            chunk = rows[start:start + self.upsert_chunk_size]
            self._post_upsert_chunk(table, chunk, on_conflict)

    def _post_upsert_chunk(self, table: str, rows: list[dict], on_conflict: str) -> None:
        last_error: requests.RequestException | None = None
        for attempt in range(self.upsert_retries):
            try:
                response = self.session.post(
                    f'{self.url}/rest/v1/{table}',
                    params={'on_conflict': on_conflict},
                    headers=self._headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
                    json=rows,
                    timeout=60,
                )
                response.raise_for_status()
                return
            except requests.RequestException as exc:
                last_error = exc
                if attempt == self.upsert_retries - 1:
                    raise
                time.sleep(self.retry_sleep_seconds * (2 ** attempt))
        if last_error:
            raise last_error

    def delete_scan_rows_for_date(self, market_date: str) -> None:
        response = self.session.delete(
            f'{self.url}/rest/v1/scan_results',
            params={'market_date': f'eq.{market_date}'},
            headers=self._headers(),
            timeout=60,
        )
        response.raise_for_status()

    def upsert_scan_rows(self, rows: list[dict]) -> None:
        self._upsert('scan_results', rows, 'market_date,symbol_id')

    def upsert_stock_signal_rows(self, rows: list[dict]) -> None:
        self._upsert('stock_signals', rows, 'market_date,symbol_id')
