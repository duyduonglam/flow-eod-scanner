from datetime import date, timedelta
from dataclasses import replace
import pytest
from flow_scanner.domain.models import OHLCVRecord

class MemoryRepo:
    def __init__(self): self.rows={};self.states={};self.revisions=[]
    def list_history_states(self): return self.states.copy()
    def read_price_history(self,symbol_id,start,end):
        return [r for r in self.rows.get(symbol_id,[]) if start<=r.market_date<=end]
    def save_price_history(self,symbol_id,rows,state,revisions):
        self.revisions.extend(revisions)
        merged={r.market_date:r for r in self.rows.get(symbol_id,[])}
        merged.update({r.market_date:r for r in rows})
        self.rows[symbol_id]=sorted(merged.values(),key=lambda r:r.market_date)
        self.states[symbol_id]=state

class Provider:
    def __init__(self,rows):self.rows=rows;self.calls=[]
    def fetch_daily_prices(self,symbol,start,end):
        self.calls.append((start,end))
        return [r for r in self.rows if start<=r.market_date<=end]


def bars():
    return [OHLCVRecord('AAA',date(2025,1,1)+timedelta(days=i),10,10,10,10,10,1_000_000,'fireant') for i in range(400)]


def test_bootstrap_then_incremental_matches_full_history_and_keeps_prior_dates():
    from flow_scanner.data.history_cache import CachedPriceProvider
    rows=bars();p=Provider(rows);repo=MemoryRepo();start=rows[0].market_date;end=rows[-2].market_date
    first=CachedPriceProvider(p,repo,{'AAA':1})
    assert first.fetch_daily_prices('AAA',start,end)==rows[:-1]
    next_start=start+timedelta(days=1)
    next_provider=CachedPriceProvider(p,repo,{'AAA':1})
    assert next_provider.fetch_daily_prices('AAA',next_start,rows[-1].market_date)==rows[1:]
    assert p.calls[-1][0]==end-timedelta(days=7)
    assert len(repo.rows[1])==400


def test_cache_does_not_manufacture_current_bar_and_new_symbols_bootstrap():
    from flow_scanner.data.history_cache import CachedPriceProvider
    rows=bars();p=Provider(rows);repo=MemoryRepo()
    cached=CachedPriceProvider(p,repo,{'AAA':1})
    assert cached.fetch_daily_prices('AAA',rows[0].market_date,rows[-1].market_date+timedelta(days=1))[-1].market_date==rows[-1].market_date
    assert p.calls[0][0]==rows[0].market_date


def test_changed_overlap_refreshes_full_window_and_archives_previous_value():
    from flow_scanner.data.history_cache import CachedPriceProvider
    rows=bars();p=Provider(rows);repo=MemoryRepo();start=rows[0].market_date;end=rows[-1].market_date
    CachedPriceProvider(p,repo,{'AAA':1}).fetch_daily_prices('AAA',start,end)
    p.rows=[replace(r,volume=2_000_000) for r in rows]
    out=CachedPriceProvider(p,repo,{'AAA':1}).fetch_daily_prices('AAA',start,end)
    assert p.calls[-1][0]==start
    assert out[0].volume==2_000_000
    assert len(repo.revisions)==400


def test_invalid_or_future_rows_are_rejected_and_write_failure_is_visible():
    from flow_scanner.data.history_cache import CachedPriceProvider, HistoryCacheError
    rows=bars();repo=MemoryRepo();p=Provider(rows)
    p.rows[-1]=replace(rows[-1],close=float('nan'))
    with pytest.raises(HistoryCacheError):
        CachedPriceProvider(p,repo,{'AAA':1}).fetch_daily_prices('AAA',rows[0].market_date,rows[-1].market_date)
    class BrokenRepo(MemoryRepo):
        def save_price_history(self,*a):raise RuntimeError('write failed')
    with pytest.raises(HistoryCacheError):
        CachedPriceProvider(Provider(rows),BrokenRepo(),{'AAA':1}).fetch_daily_prices('AAA',rows[0].market_date,rows[-1].market_date)


def test_missing_cached_bar_forces_full_refresh():
    from flow_scanner.data.history_cache import CachedPriceProvider
    rows=bars();repo=MemoryRepo();p=Provider(rows);start=rows[0].market_date;end=rows[-1].market_date
    CachedPriceProvider(p,repo,{'AAA':1}).fetch_daily_prices('AAA',start,end)
    repo.rows[1].pop(100)
    out=CachedPriceProvider(p,repo,{'AAA':1}).fetch_daily_prices('AAA',start,end)
    assert p.calls[-1][0]==start
    assert len(out)==400
