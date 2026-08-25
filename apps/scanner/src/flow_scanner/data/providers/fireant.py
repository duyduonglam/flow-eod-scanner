from __future__ import annotations
from datetime import date, datetime
from typing import Any
import requests
from flow_scanner.domain.models import OHLCVRecord

class FireAntProvider:
    def __init__(self, base_url: str = 'https://api.fireant.vn', api_key: str | None = None, session: requests.Session | None = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = session or requests.Session()

    def _headers(self) -> dict[str, str]:
        return {'Authorization': f'Bearer {self.api_key}'} if self.api_key else {}

    def fetch_daily_prices(self, symbol: str, start_date: date, end_date: date) -> list[OHLCVRecord]:
        url = f'{self.base_url}/symbols/{symbol}/historical-quotes'
        response = self.session.get(url, headers=self._headers(), params={
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
        }, timeout=20)
        response.raise_for_status()
        payload = response.json()
        rows = payload if isinstance(payload, list) else payload.get('data', [])
        return [self._map_row(symbol, row) for row in rows]

    @staticmethod
    def _map_row(symbol: str, row: dict[str, Any]) -> OHLCVRecord:
        raw_date = row.get('date') or row.get('tradingDate') or row.get('time')
        market_date = datetime.fromisoformat(str(raw_date).replace('Z', '+00:00')).date()
        return OHLCVRecord(
            symbol=symbol.upper(),
            market_date=market_date,
            open=float(row.get('priceOpen', row.get('open'))),
            high=float(row.get('priceHigh', row.get('high'))),
            low=float(row.get('priceLow', row.get('low'))),
            close=float(row.get('priceClose', row.get('close'))),
            reference=float(row['priceBasic']) if row.get('priceBasic') is not None else None,
            volume=int(row.get('totalVolume', row.get('volume', 0))),
            source='fireant',
            fetched_at=datetime.now().astimezone(),
        )
