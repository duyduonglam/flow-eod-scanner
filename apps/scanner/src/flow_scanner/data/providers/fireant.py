from __future__ import annotations
from datetime import date, datetime
from typing import Any
import requests
from flow_scanner.domain.models import OHLCVRecord

class FireAntProvider:
    def __init__(
        self,
        base_url: str = 'https://api.fireant.vn',
        api_key: str | None = None,
        session: requests.Session | None = None,
        page_size: int = 200,
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = session or requests.Session()
        self.page_size = page_size
        self._authenticated = False

    def _authenticate(self) -> None:
        if self._authenticated:
            return
        self.session.headers.update({
            'Accept': 'application/json',
            'User-Agent': 'FLOW-Vietnam/1.1',
        })
        if self.api_key:
            self.session.headers['Authorization'] = f'Bearer {self.api_key}'
            self._authenticated = True
            return

        response = self.session.post(f'{self.base_url}/authentication/anonymous-login', timeout=30)
        response.raise_for_status()
        payload = response.json() if response.content else {}
        if isinstance(payload, dict):
            for key in ('access_token', 'accessToken', 'token'):
                token = payload.get(key)
                if isinstance(token, str) and token:
                    self.session.headers['Authorization'] = f'Bearer {token}'
                    break
        self._authenticated = True

    def fetch_daily_prices(self, symbol: str, start_date: date, end_date: date) -> list[OHLCVRecord]:
        self._authenticate()
        url = f'{self.base_url}/symbols/{symbol}/historical-quotes'
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            response = self.session.get(url, params={
                'startDate': f'{start_date.isoformat()}T00:00:00',
                'endDate': f'{end_date.isoformat()}T23:59:59',
                'offset': offset,
                'limit': self.page_size,
            }, timeout=30)
            response.raise_for_status()
            payload = response.json()
            page = payload if isinstance(payload, list) else payload.get('data', [])
            if not isinstance(page, list):
                raise RuntimeError(f'Unexpected FireAnt response for {symbol}: {type(payload).__name__}')
            rows.extend(page)
            if len(page) < self.page_size:
                break
            offset += len(page)
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
