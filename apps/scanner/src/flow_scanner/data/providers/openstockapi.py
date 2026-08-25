from datetime import date
from flow_scanner.domain.models import OHLCVRecord

class OpenStockAPIProvider:
    """Adapter boundary for a future OpenStockAPI client.

    The external library is intentionally not imported in the core package so
    scanner tests and deployment remain reproducible. A concrete client can be
    injected behind this interface later.
    """
    def __init__(self, client=None):
        self.client = client

    def fetch_daily_prices(self, symbol: str, start_date: date, end_date: date) -> list[OHLCVRecord]:
        if self.client is None:
            return []
        return self.client.fetch_daily_prices(symbol, start_date, end_date)
