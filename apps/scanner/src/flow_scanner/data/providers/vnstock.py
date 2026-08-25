from __future__ import annotations
from datetime import date, datetime
from flow_scanner.domain.models import OHLCVRecord

class VnStockProvider:
    """Zero-key fallback adapter.

    The import is lazy so the deterministic engine remains testable without
    network packages. Current vnstock APIs may vary by release, so this adapter
    normalizes either common dataframe schema: time/tradingDate + OHLCV.
    """
    def __init__(self, source: str = 'VCI'):
        self.source = source

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
