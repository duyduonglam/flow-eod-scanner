from __future__ import annotations
from datetime import date, datetime
from collections.abc import Iterable
from flow_scanner.domain.models import OHLCVRecord

EXCHANGE_MAP = {
    'HSX': 'HOSE',
    'HOSE': 'HOSE',
    'HNX': 'HNX',
    'UPCOM': 'UPCOM',
    'UPCoM': 'UPCOM',
}


def normalize_symbol_listing(rows: Iterable[dict]) -> list[dict[str, str]]:
    symbols: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        symbol = str(row.get('symbol') or row.get('ticker') or '').upper().strip()
        exchange = str(row.get('exchange') or row.get('board') or '').strip()
        security_type = str(row.get('type') or row.get('asset_type') or 'STOCK').upper().strip()
        normalized_exchange = EXCHANGE_MAP.get(exchange.upper())
        if not symbol or symbol in seen or security_type != 'STOCK' or normalized_exchange is None:
            continue
        symbols.append({'symbol': symbol, 'exchange': normalized_exchange})
        seen.add(symbol)
    return symbols


class VnStockProvider:
    """Zero-key fallback adapter.

    The import is lazy so the deterministic engine remains testable without
    network packages. Current vnstock APIs may vary by release, so this adapter
    normalizes either common dataframe schema: time/tradingDate + OHLCV.
    """
    def __init__(self, source: str = 'VCI'):
        self.source = source

    def list_symbols(self) -> list[dict[str, str]]:
        try:
            from vnstock import Listing  # type: ignore
        except ImportError as exc:
            raise RuntimeError('vnstock is not installed') from exc
        try:
            listing = Listing(source=self.source)
        except TypeError:
            listing = Listing()
        df = listing.symbols_by_exchange()
        return normalize_symbol_listing(df.to_dict('records'))

    def fetch_daily_prices(self, symbol: str, start_date: date, end_date: date) -> list[OHLCVRecord]:
        try:
            from vnstock import Vnstock  # type: ignore
        except ImportError as exc:
            raise RuntimeError('vnstock is not installed') from exc
        stock = Vnstock().stock(symbol=symbol, source=self.source)
        df = stock.quote.history(start=start_date.isoformat(), end=end_date.isoformat(), interval='1D')
        rows: list[OHLCVRecord] = []
        for _, row in df.iterrows():
            raw_date = row.get('time', row.get('tradingDate'))
            market_date = raw_date.date() if hasattr(raw_date, 'date') else datetime.fromisoformat(str(raw_date)).date()
            rows.append(OHLCVRecord(
                symbol=symbol.upper(), market_date=market_date,
                open=float(row['open']), high=float(row['high']), low=float(row['low']), close=float(row['close']),
                reference=None, volume=int(row['volume']), source=f'vnstock:{self.source.lower()}', fetched_at=datetime.now().astimezone(),
            ))
        return rows
