from typing import Protocol
from datetime import date
from flow_scanner.domain.models import OHLCVRecord

class MarketDataProvider(Protocol):
    def fetch_daily_prices(self, symbol: str, start_date: date, end_date: date) -> list[OHLCVRecord]: ...
