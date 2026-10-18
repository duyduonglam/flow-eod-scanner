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
        rows: list[dict] = []
        offset = 0
        while True:
            response = self.session.get(
                f'{self.url}/rest/v1/symbols',
                params={
                    'select': 'id,symbol,exchange',
                    'is_active': 'eq.true',
                    'asset_type': 'eq.stock',
                    'order': 'id.asc',
                    'limit': '1000',
                    'offset': str(offset),
                },
                headers=self._headers(), timeout=20,
            )
            response.raise_for_status()
            page = response.json()
            if not page:
                return rows
            rows.extend(page)
            # Advance by the returned count: the server may cap below our limit.
            offset += len(page)

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

    def upsert_foreign_flow(self, row: dict) -> None:
        self._upsert("market_foreign_flows", [row], "market_date")

    def _read_all(self, table: str, params: dict) -> list[dict]:
        rows = []
        while True:
            response = self.session.get(
                f'{self.url}/rest/v1/{table}',
                params={**params, 'offset': str(len(rows)), 'limit': '1000'},
                headers=self._headers(), timeout=60,
            )
            response.raise_for_status()
            page = response.json()
            if not page:
                return rows
            rows.extend(page)

    def list_history_states(self) -> dict[int, dict]:
        return {int(r['symbol_id']): r for r in self._read_all('price_history_state', {'select': '*', 'order': 'symbol_id.asc'})}

    def history_symbol_ids(self) -> dict[str, int]:
        return {r['symbol']: int(r['id']) for r in self._read_all('symbols', {'select': 'id,symbol', 'asset_type': 'eq.index', 'order': 'id.asc'})}

    def read_price_history(self, symbol_id, start, end):
        from datetime import date, datetime
        from flow_scanner.domain.models import OHLCVRecord
        rows = self._read_all('daily_prices', {
            'select': 'market_date,open,high,low,close,reference,volume,source,fetched_at,adj_ratio,symbols!inner(symbol)',
            'symbol_id': f'eq.{symbol_id}', 'source': 'eq.fireant',
            'and': f'(market_date.gte.{start.isoformat()},market_date.lte.{end.isoformat()})',
            'validation_status': 'eq.VALID', 'order': 'market_date.asc',
        })
        return [OHLCVRecord(
            r['symbols']['symbol'], date.fromisoformat(r['market_date']),
            float(r['open']), float(r['high']), float(r['low']), float(r['close']),
            float(r['reference']) if r['reference'] is not None else None,
            int(r['volume']), r['source'],
            datetime.fromisoformat(r['fetched_at']) if r['fetched_at'] else None,
            float(r['adj_ratio']),
        ) for r in rows]

    def save_price_history(self, symbol_id, rows, state, revisions):
        from dataclasses import asdict
        from datetime import datetime, timezone
        def payload(row):
            return {
                'symbol_id': symbol_id, 'market_date': row.market_date.isoformat(),
                'open': row.open, 'high': row.high, 'low': row.low, 'close': row.close,
                'reference': row.reference, 'volume': row.volume, 'source': 'fireant',
                'adj_ratio': row.adj_ratio, 'validation_status': 'VALID',
                'fetched_at': (row.fetched_at or datetime.now(timezone.utc)).isoformat(),
            }
        # Archive previous canonical values before correction; never delete old dates.
        if revisions:
            archive = [{'symbol_id': symbol_id, 'market_date': r.market_date.isoformat(), 'previous_value': payload(r)} for r in revisions]
            response = self.session.post(f'{self.url}/rest/v1/price_history_revisions', headers=self._headers({'Prefer':'return=minimal'}), json=archive, timeout=60)
            response.raise_for_status()
        self._upsert('daily_prices', [payload(r) for r in rows], 'symbol_id,market_date,source')
        self._upsert('price_history_state', [state], 'symbol_id')

    def start_early_run(self, market_date):
        from flow_scanner.flow.early_discovery import FORMULA_VERSION
        self._upsert('early_scan_runs', [{'market_date': market_date, 'status': 'RUNNING', 'formula_version': FORMULA_VERSION, 'candidate_count': None, 'cache_stats': None}], 'market_date')

    def publish_early_rows(self, market_date, rows, cache_stats):
        from flow_scanner.flow.early_discovery import FORMULA_VERSION
        response = self.session.delete(f'{self.url}/rest/v1/early_discoveries', params={'market_date': f'eq.{market_date}'}, headers=self._headers(), timeout=30)
        response.raise_for_status()
        self._upsert('early_discoveries', rows, 'market_date,symbol_id')
        self._upsert('early_scan_runs', [{'market_date': market_date, 'status': 'COMPLETE', 'formula_version': FORMULA_VERSION, 'candidate_count': len(rows), 'cache_stats': cache_stats}], 'market_date')
