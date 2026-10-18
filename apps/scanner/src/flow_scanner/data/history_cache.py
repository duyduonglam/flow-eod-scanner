"""Durable raw history with a small correction overlap and explicit provenance."""
from datetime import date, timedelta
from math import isfinite
from copy import copy
from threading import local, Lock
import requests
from flow_scanner.data.validator import validate_price_record


class HistoryCacheError(RuntimeError):
    pass


def fingerprint(row):
    return (row.open, row.high, row.low, row.close, row.reference, row.volume, row.adj_ratio)


class CachedPriceProvider:
    def __init__(self, provider, repo, symbol_ids):
        self.provider = provider
        self.repo = repo
        self.symbol_ids = symbol_ids
        self.states = repo.list_history_states()
        self.stats = {'bootstrap_symbols': 0, 'incremental_symbols': 0, 'saved_bars': 0, 'revised_bars': 0}
        self.errors = []
        self._local = local()
        self._lock = Lock()

    def __getattr__(self, key):
        return getattr(self.provider, key)

    def _resources(self):
        if not hasattr(self._local, "resources"):
            resources = []
            for original in (self.provider, self.repo):
                if hasattr(original, "session"):
                    clone = copy(original)
                    clone.session = requests.Session()
                    clone.session.headers.update(original.session.headers)
                    resources.append(clone)
                else:
                    resources.append(original)
            self._local.resources = tuple(resources)
        return self._local.resources

    def fetch_daily_prices(self, symbol, start_date, end_date):
        symbol_id = self.symbol_ids.get(symbol)
        if symbol_id is None:
            raise HistoryCacheError(f'No symbol id for history cache: {symbol}')
        try:
            provider, repo = self._resources()
            state = self.states.get(symbol_id)
            cache_start = min(start_date, date.fromisoformat(state["range_start"])) if state else start_date
            cached = repo.read_price_history(symbol_id, cache_start, end_date) if state else []
            reusable = (
                state is not None and state['range_start'] <= start_date.isoformat()
                and state['checked_through'] <= end_date.isoformat()
                and bool(cached) and len(cached) == int(state['bar_count'])
            )
            fetch_start = max(start_date, date.fromisoformat(state['checked_through']) - timedelta(days=7)) if reusable else start_date
            fresh = self._fetch(provider, symbol, fetch_start, end_date)
            old_by_date = {r.market_date: r for r in cached}
            # Corrections, rights and adjustments can change older data too.
            corrected = any(r.market_date in old_by_date and fingerprint(r) != fingerprint(old_by_date[r.market_date]) for r in fresh)
            periodic = reusable and (end_date - date.fromisoformat(state['full_refresh_date'])).days >= 30
            if reusable and (corrected or periodic):
                fresh = self._fetch(provider, symbol, start_date, end_date)
                fetch_start = start_date
            revisions = [old_by_date[r.market_date] for r in fresh
                         if r.market_date in old_by_date and fingerprint(r) != fingerprint(old_by_date[r.market_date])]
            merged = dict(old_by_date)
            merged.update({r.market_date: r for r in fresh})
            combined = sorted((r for r in merged.values() if start_date <= r.market_date <= end_date), key=lambda r: r.market_date)
            if not combined:
                return []
            # Only changed or newly fetched bars need a write, not the entire history.
            changed = [r for r in fresh if r.market_date not in old_by_date or fingerprint(r) != fingerprint(old_by_date[r.market_date])]
            next_state = {
                'symbol_id': symbol_id, 'range_start': start_date.isoformat(),
                'checked_through': end_date.isoformat(), 'bar_count': len(combined),
                'full_refresh_date': end_date.isoformat() if fetch_start == start_date else state['full_refresh_date'],
            }
            repo.save_price_history(symbol_id, changed, next_state, revisions)
            self.states[symbol_id] = next_state
            with self._lock:
                self.stats['incremental_symbols' if reusable else 'bootstrap_symbols'] += 1
                self.stats['saved_bars'] += len(changed)
                self.stats['revised_bars'] += len(revisions)
            return combined
        except Exception as exc:
            self.errors.append({'symbol': symbol, 'error': type(exc).__name__})
            raise HistoryCacheError(f'History cache failed for {symbol}: {type(exc).__name__}') from exc

    def _fetch(self, provider, symbol, start, end):
        rows = provider.fetch_daily_prices(symbol, start, end)
        dates = set()
        for row in rows:
            numeric = (row.open, row.high, row.low, row.close, row.volume, row.adj_ratio)
            if (row.symbol != symbol or row.source.lower() != 'fireant'
                or not start <= row.market_date <= end or row.market_date in dates
                or not all(isfinite(v) for v in numeric) or row.adj_ratio <= 0
                or not validate_price_record(row)[0]):
                raise HistoryCacheError(f'Invalid FireAnt history for {symbol}')
            dates.add(row.market_date)
        return rows
