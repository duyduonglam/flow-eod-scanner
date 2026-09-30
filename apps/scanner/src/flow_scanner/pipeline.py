from __future__ import annotations
from dataclasses import asdict
from datetime import date, timedelta
import time
from typing import Iterable
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.data.validator import resolve_price
from flow_scanner.flow.market_regime import classify_market_mode
from flow_scanner.main import scan_universe

class PipelineError(RuntimeError): pass
class ProviderRateLimitError(RuntimeError): pass

HISTORY_LOOKBACK_DAYS = 450
MIN_AVG_VALUE_20 = 20_000_000_000
MIN_CURRENT_VALUE = 5_000_000_000
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


def _previous_close(row: OHLCVRecord, history: list[OHLCVRecord]) -> float | None:
    if row.reference and row.reference > 0:
        return row.reference
    if len(history) >= 2 and history[-2].close > 0:
        return history[-2].close
    return None


def _change_pct(row: OHLCVRecord, history: list[OHLCVRecord]) -> float | None:
    previous = _previous_close(row, history)
    if previous is None:
        return None
    return (row.close / previous - 1) * 100


def _market_regime_payload(
    market_date: date,
    index_symbol: str,
    index_history: list[OHLCVRecord],
    histories: dict[str, list[OHLCVRecord]],
) -> dict:
    index_row = index_history[-1]
    index_change_pct = _change_pct(index_row, index_history)
    advancers = 0
    decliners = 0
    liquidity_value = 0.0
    liquidity_excluded = 0
    for rows in histories.values():
        row = rows[-1]
        change = _change_pct(row, rows)
        if change is not None and change > 0:
            advancers += 1
        elif change is not None and change < 0:
            decliners += 1
        current_value = row.close * 1000 * row.volume
        avg_value_20 = sum(item.close * 1000 * item.volume for item in rows[-20:]) / min(len(rows), 20)
        liquidity_value += current_value
        if avg_value_20 < MIN_AVG_VALUE_20 or current_value < MIN_CURRENT_VALUE:
            liquidity_excluded += 1
    distribution_flag = index_change_pct is not None and index_change_pct < 0 and decliners > advancers
    return {
        "market_date": market_date.isoformat(),
        "market_mode": classify_market_mode(index_change_pct, advancers, decliners, distribution_flag),
        "index_symbol": index_symbol,
        "index_close": index_row.close,
        "index_change_pct": index_change_pct,
        "breadth_advancers": advancers,
        "breadth_decliners": decliners,
        "liquidity_value": liquidity_value,
        "distribution_flag": distribution_flag,
        "exclusion_notes": (
            f"Đã loại {liquidity_excluded} mã khỏi bảng chính vì giá trị giao dịch bình quân 20 phiên dưới 20 tỷ "
            "hoặc phiên hiện tại dưới 5 tỷ."
        ),
    }


def run_eod_pipeline(
    market_date: date,
    symbols: list[str],
    providers: list[object],
    index_symbol: str = 'VNINDEX',
    retry_sleep_seconds: float = 65.0,
    history_lookback_days: int = HISTORY_LOOKBACK_DAYS,
    max_rate_limit_retries: int = 2,
) -> dict:
    start = market_date - timedelta(days=history_lookback_days)
    index_histories = _fetch_first_history(
        providers,
        index_symbol,
        start,
        market_date,
        retry_sleep_seconds=retry_sleep_seconds,
        max_rate_limit_retries=max_rate_limit_retries,
    )
    if not index_histories:
        raise PipelineError('No index history with at least 253 validated rows')
    index_history = index_histories[0][1]
    if index_history[-1].market_date != market_date:
        return {'status':'SKIPPED', 'reason':'index has no bar for requested market date', 'rows':[], 'conflicts':[]}

    histories: dict[str, list[OHLCVRecord]] = {}
    conflicts: list[dict] = []
    for symbol in symbols:
        candidates = _fetch_first_history(
            providers,
            symbol,
            start,
            market_date,
            retry_sleep_seconds=retry_sleep_seconds,
            max_rate_limit_retries=max_rate_limit_retries,
        )
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
        'market_regime': _market_regime_payload(market_date, index_symbol, index_history, histories),
        'conflicts':conflicts,
    }
