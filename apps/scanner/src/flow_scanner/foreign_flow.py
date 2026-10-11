"""Exact-session exchange totals; monetary quote fields are already VND."""
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
from flow_scanner.data.providers.fireant import FireAntProvider

EXCHANGES = ('VNINDEX', 'HNXINDEX', 'UPINDEX')

def normalize_foreign_quote(row: dict, market_date: date, symbol: str) -> tuple[float, float]:
    if row.get('symbol') != symbol or str(row.get('date', ''))[:10] != market_date.isoformat():
        raise ValueError(f'Foreign flow session/symbol mismatch: {symbol}')
    if Decimal(str(row.get('unit', 1))) != 1:
        raise ValueError(f'Unsupported foreign flow monetary unit: {symbol}')
    values = []
    for field in ('buyForeignValue', 'sellForeignValue'):
        try:
            value = Decimal(str(row.get(field)))
        except Exception as exc:
            raise ValueError(f'Missing foreign flow {field}: {symbol}') from exc
        if not value.is_finite() or value < 0:
            raise ValueError(f'Invalid foreign flow {field}: {symbol}')
        values.append(float(value))
    return tuple(values)

def fetch_foreign_flow(market_date: date, provider=None) -> dict:
    provider = provider or FireAntProvider()
    provider._authenticate()
    quotes, requests = [], []
    buy, sell = Decimal(0), Decimal(0)
    for symbol in EXCHANGES:
        url = f'{provider.base_url}/symbols/{symbol}/historical-quotes'
        params = dict(startDate=market_date.isoformat()+'T00:00:00', endDate=market_date.isoformat()+'T23:59:59', offset=0, limit=10)
        response = provider.session.get(url, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
        rows = payload if isinstance(payload, list) else payload.get('data', [])
        exact = [r for r in rows if str(r.get('date',''))[:10] == market_date.isoformat() and r.get('symbol') == symbol]
        if len(exact) != 1:
            raise ValueError(f'Missing or duplicate foreign flow session: {symbol} {market_date}')
        b, s = normalize_foreign_quote(exact[0], market_date, symbol)
        buy += Decimal(str(b)); sell += Decimal(str(s))
        quotes.append(exact[0]); requests.append(dict(url=url, params=params))
    canonical = json.dumps(quotes, sort_keys=True, separators=(',', ':'))
    return dict(market_date=market_date.isoformat(), buy_value=float(buy), sell_value=float(sell), net_value=float(buy-sell),
                source='FireAnt', scope='HOSE + HNX + UPCoM', fetched_at=datetime.now(timezone.utc).isoformat(),
                provenance=dict(requests=requests, quotes=quotes, raw_sha256=hashlib.sha256(canonical.encode()).hexdigest(), monetary_unit='VND'))
