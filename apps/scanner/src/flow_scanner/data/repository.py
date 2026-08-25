from __future__ import annotations
import requests

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

    def upsert_scan_rows(self, rows: list[dict]) -> None:
        if not rows:
            return
        response = self.session.post(
            f'{self.url}/rest/v1/scan_results',
            headers=self._headers({'Prefer':'resolution=merge-duplicates'}),
            json=rows, timeout=30,
        )
        response.raise_for_status()
