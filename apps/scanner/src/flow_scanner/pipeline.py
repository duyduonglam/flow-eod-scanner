from __future__ import annotations
from dataclasses import asdict
from datetime import date, timedelta
import time
from typing import Iterable
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.data.validator import resolve_price
from flow_scanner.main import scan_universe

class PipelineError(RuntimeError): pass
class ProviderRateLimitError(RuntimeError): pass

RATE_LIMIT_MARKERS = (
    'rate limit',
    'rate limit exceeded',
    'giới hạn api',
    'gioi han api',
    'maximum api request',
    '429',
)


def _is_rate_limit_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in RATE_LIMIT_MARKERS)


def _fetch_first_history(
    providers: Iterable[object],
    symbol: str,
    start: date,
    end: date,
    min_rows: int = 253,
    max_rate_limit_retries: int = 2,
    retry_sleep_seconds: float = 65.0,
):
    histories: list[tuple[str, list[OHLCVRecord]]] = []
    for provider in providers:
        for attempt in range(max_rate_limit_retries + 1):
            try:
                rows = provider.fetch_daily_prices(symbol, start, end)
                break
            except SystemExit as exc:
                if attempt >= max_rate_limit_retries:
                    raise ProviderRateLimitError(f'{type(provider).__name__} stopped while fetching {symbol}') from exc
                if retry_sleep_seconds > 0:
                    time.sleep(retry_sleep_seconds)
                continue
            except Exception as exc:
                if _is_rate_limit_error(exc):
                    if attempt >= max_rate_limit_retries:
                        raise ProviderRateLimitError(f'{type(provider).__name__} rate limited while fetching {symbol}') from exc
                    if retry_sleep_seconds > 0:
                        time.sleep(retry_sleep_seconds)
                    continue
                rows = []
                break
        rows = sorted(rows, key=lambda r: r.market_date)
        if len(rows) >= min_rows:
            histories.append((type(provider).__name__, rows))
    return histories


def run_eod_pipeline(
    market_date: date,
    symbols: list[str],
    providers: list[object],
    index_symbol: str = 'VNINDEX',
    retry_sleep_seconds: float = 65.0,
) -> dict:
    start = market_date - timedelta(days=800)
    index_histories = _fetch_first_history(providers, index_symbol, start, market_date, retry_sleep_seconds=retry_sleep_seconds)
    if not index_histories:
        raise PipelineError('No index history with at least 253 validated rows')
    index_history = index_histories[0][1]
    if index_history[-1].market_date != market_date:
        return {'status':'SKIPPED', 'reason':'index has no bar for requested market date', 'rows':[], 'conflicts':[]}

    histories: dict[str, list[OHLCVRecord]] = {}
    conflicts: list[dict] = []
    for symbol in symbols:
        candidates = _fetch_first_history(providers, symbol, start, market_date, retry_sleep_seconds=retry_sleep_seconds)
        if not candidates:
            continue
        primary = candidates[0][1]
        if primary[-1].market_date != market_date:
            continue
        if len(candidates) > 1 and candidates[1][1][-1].market_date == market_date:
            check = resolve_price(primary[-1], candidates[1][1][-1])
            if check.status == 'DATA_CONFLICT':
                conflicts.append({'symbol':symbol, 'reason':check.reason})
                continue
        histories[symbol] = primary

    rows = scan_universe(histories, index_history)
    return {
        'status':'OK',
        'market_date':market_date.isoformat(),
        'scanned':len(histories),
        'rows':rows,
        'conflicts':conflicts,
    }
