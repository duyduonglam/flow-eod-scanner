from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

ValidationStatus = Literal['VALID', 'FALLBACK', 'DATA_CONFLICT', 'INVALID']

@dataclass(frozen=True)
class OHLCVRecord:
    symbol: str
    market_date: date
    open: float
    high: float
    low: float
    close: float
    reference: float | None
    volume: int
    source: str
    fetched_at: datetime | None = None

@dataclass(frozen=True)
class ValidatedPrice:
    status: ValidationStatus
    record: OHLCVRecord | None
    reason: str | None = None
