from __future__ import annotations
from dataclasses import asdict
from datetime import date, timedelta
from typing import Iterable
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.data.validator import resolve_price
from flow_scanner.main import scan_universe

class PipelineError(RuntimeError): pass


def _fetch_first_history(providers: Iterable[object], symbol: str, start: date, end: date, min_rows: int = 253):
    histories: list[tuple[str, list[OHLCVRecord]]] = []
    for provider in providers:
        try:
            rows = provider.fetch_daily_prices(symbol, start, end)
        except Exception:
            continue
        rows = sorted(rows, key=lambda r: r.market_date)
        if len(rows) >= min_rows:
            histories.append((type(provider).__name__, rows))
    return histories


def run_eod_pipeline(market_date: date, symbols: list[str], providers: list[object], index_symbol: str = 'VNINDEX') -> dict:
    start = market_date - timedelta(days=800)
    index_histories = _fetch_first_history(providers, index_symbol, start, market_date)
    if not index_histories:
        raise PipelineError('No index history with at least 253 validated rows')
    index_history = index_histories[0][1]
    if index_history[-1].market_date != market_date:
        return {'status':'SKIPPED', 'reason':'index has no bar for requested market date', 'rows':[], 'conflicts':[]}

    histories: dict[str, list[OHLCVRecord]] = {}
    conflicts: list[dict] = []
    for symbol in symbols:
        candidates = _fetch_first_history(providers, symbol, start, market_date)
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
