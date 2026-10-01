from datetime import date, timedelta
import pytest
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.pipeline import PipelineError, ProviderRateLimitError, run_eod_pipeline

class FakeProvider:
    def __init__(self, growth=0.001, overrides=None):
        self.growth=growth; self.overrides=overrides or {}
    def fetch_daily_prices(self, symbol,start_date,end_date):
        rows=[]; price=100.0; d=end_date-timedelta(days=299)
        for i in range(300):
            reference=price
            price*=1+self.growth
            close=self.overrides.get((symbol,i),price)
            rows.append(OHLCVRecord(symbol,d+timedelta(days=i),close,close*1.01,close*0.99,close,reference,100000+i,'fake'))
        return rows

class FlakyProvider(FakeProvider):
    def __init__(self, exc: BaseException | None = None):
        super().__init__()
        self.calls = 0
        self.exc = exc or RuntimeError("Rate Limit Exceeded")

    def fetch_daily_prices(self, symbol,start_date,end_date):
        self.calls += 1
        if self.calls == 1:
            raise self.exc
        return super().fetch_daily_prices(symbol,start_date,end_date)

class CapturingProvider(FakeProvider):
    def __init__(self):
        super().__init__()
        self.start_dates = []

    def fetch_daily_prices(self, symbol,start_date,end_date):
        self.start_dates.append(start_date)
        return super().fetch_daily_prices(symbol,start_date,end_date)

class EmptyProvider:
    def fetch_daily_prices(self, symbol, start_date, end_date):
        return []

class PartialProvider(FakeProvider):
    def fetch_daily_prices(self, symbol, start_date, end_date):
        if symbol == 'BBB':
            return []
        rows = super().fetch_daily_prices(symbol, start_date, end_date)
        return [OHLCVRecord(
            row.symbol, row.market_date, row.open, row.high, row.low, row.close,
            row.reference, row.volume, 'fireant', row.fetched_at,
        ) for row in rows]

class ShortProvider(FakeProvider):
    def fetch_daily_prices(self, symbol, start_date, end_date):
        return super().fetch_daily_prices(symbol, start_date, end_date)[:259]

def test_pipeline_scans_and_returns_ranked_rows():
    out=run_eod_pipeline(date(2026,8,25),['AAA','BBB'],[FakeProvider()])
    assert out['status']=='OK'
    assert out['scanned']==2
    assert len(out['rows'])==2
    assert out['market_regime']['market_date']=='2026-08-25'
    assert out['market_regime']['index_symbol']=='VNINDEX'
    assert out['market_regime']['index_close'] > 0
    assert out['market_regime']['breadth_advancers']==2
    assert out['market_regime']['breadth_decliners']==0
    assert out['market_regime']['liquidity_value'] > 0
    assert out['market_regime']['market_mode'] in {'RISK ON','NORMAL','CAUTION','RISK OFF'}
    assert out['primary_source'] == 'FAKE'
    assert out['fallback_sources_actually_used'] == []
    assert '20 tỷ' in out['market_regime']['exclusion_notes']

def test_pipeline_skips_symbol_when_providers_conflict():
    a=FakeProvider()
    b=FakeProvider(growth=0.001)
    # force materially different latest close for AAA while keeping OHLC valid
    original=b.fetch_daily_prices
    def fetch(symbol,start,end):
        rows=original(symbol,start,end)
        if symbol=='AAA':
            last=rows[-1]; c=last.close*0.85
            rows[-1]=OHLCVRecord(last.symbol,last.market_date,c,c*1.01,c*0.99,c,c,last.volume,'fake2')
        return rows
    b.fetch_daily_prices=fetch
    out=run_eod_pipeline(date(2026,8,25),['AAA'],[a,b])
    assert out['scanned']==0
    assert out['conflicts'][0]['symbol']=='AAA'

def test_pipeline_retries_transient_rate_limit():
    provider = FlakyProvider()

    out = run_eod_pipeline(date(2026,8,25),['AAA'],[provider], retry_sleep_seconds=0)

    assert out['status']=='OK'
    assert out['scanned']==1
    assert provider.calls==3

def test_pipeline_retries_provider_system_exit_rate_limit():
    provider = FlakyProvider(SystemExit(1))

    out = run_eod_pipeline(date(2026,8,25),['AAA'],[provider], retry_sleep_seconds=0)

    assert out['status']=='OK'
    assert out['scanned']==1
    assert provider.calls==3

def test_pipeline_can_disable_rate_limit_retries():
    provider = FlakyProvider()

    with pytest.raises(ProviderRateLimitError):
        run_eod_pipeline(
            date(2026,8,25),
            ['AAA'],
            [provider],
            retry_sleep_seconds=0,
            max_rate_limit_retries=0,
        )

    assert provider.calls==1

def test_pipeline_uses_bounded_history_window_to_limit_provider_requests():
    provider = CapturingProvider()

    run_eod_pipeline(date(2026,8,25),['AAA'],[provider])

    assert provider.start_dates == [date(2025,4,12), date(2025,4,12)]

def test_pipeline_strict_primary_source_does_not_fallback_to_secondary_provider():
    with pytest.raises(PipelineError, match='fireant'):
        run_eod_pipeline(
            date(2026,8,25),
            ['AAA'],
            [EmptyProvider(), FakeProvider()],
            primary_only=True,
            required_source='fireant',
        )

def test_pipeline_strict_primary_source_rejects_non_fireant_records():
    with pytest.raises(PipelineError, match='fireant'):
        run_eod_pipeline(
            date(2026,8,25),
            ['AAA'],
            [FakeProvider()],
            primary_only=True,
            required_source='fireant',
        )

def test_pipeline_strict_primary_source_rejects_partial_coverage():
    with pytest.raises(PipelineError, match='coverage'):
        run_eod_pipeline(
            date(2026,8,25),
            ['AAA', 'BBB'],
            [PartialProvider()],
            primary_only=True,
            required_source='fireant',
            min_coverage_ratio=0.9,
        )

def test_pipeline_rejects_history_shorter_than_canonical_minimum():
    with pytest.raises(PipelineError, match='260'):
        run_eod_pipeline(date(2026,8,25), ['AAA'], [ShortProvider()])
