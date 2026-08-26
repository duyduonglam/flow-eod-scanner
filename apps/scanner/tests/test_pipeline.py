from datetime import date, timedelta
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.pipeline import run_eod_pipeline

class FakeProvider:
    def __init__(self, growth=0.001, overrides=None):
        self.growth=growth; self.overrides=overrides or {}
    def fetch_daily_prices(self, symbol,start_date,end_date):
        rows=[]; price=100.0; d=end_date-timedelta(days=299)
        for i in range(300):
            price*=1+self.growth
            close=self.overrides.get((symbol,i),price)
            rows.append(OHLCVRecord(symbol,d+timedelta(days=i),close,close*1.01,close*0.99,close,close,100000+i,'fake'))
        return rows

class FlakyProvider(FakeProvider):
    def __init__(self):
        super().__init__()
        self.calls = 0

    def fetch_daily_prices(self, symbol,start_date,end_date):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("Rate Limit Exceeded")
        return super().fetch_daily_prices(symbol,start_date,end_date)

def test_pipeline_scans_and_returns_ranked_rows():
    out=run_eod_pipeline(date(2026,8,25),['AAA','BBB'],[FakeProvider()])
    assert out['status']=='OK'
    assert out['scanned']==2
    assert len(out['rows'])==2

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
