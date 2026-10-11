from datetime import date
import pytest
from flow_scanner.foreign_flow import normalize_foreign_quote, fetch_foreign_flow

def quote(symbol='VNINDEX', day='2026-10-09', **extra):
    return dict(symbol=symbol, date=day+'T00:00:00', buyForeignValue=1000000000, sellForeignValue=2000000000, unit=1, **extra)

def test_exact_session_and_vnd():
    assert normalize_foreign_quote(quote(), date(2026,10,9), 'VNINDEX') == (1000000000,2000000000)
    with pytest.raises(ValueError): normalize_foreign_quote(quote(day='2026-10-08'),date(2026,10,9),'VNINDEX')

@pytest.mark.parametrize('field,value', [('buyForeignValue',None),('sellForeignValue',-1),('unit',1000),('buyForeignValue',float('nan'))])
def test_rejects_missing_or_invalid_values(field,value):
    row=quote(); row[field]=value
    with pytest.raises(ValueError): normalize_foreign_quote(row,date(2026,10,9),'VNINDEX')

class Response:
    def __init__(self, rows): self.rows=rows
    def raise_for_status(self): pass
    def json(self): return self.rows
class Session:
    def get(self,url,**kwargs):
        symbol=url.split('/')[-2]
        return Response([quote(symbol)])
class Provider:
    session=Session(); base_url='https://api.fireant.vn'
    def _authenticate(self): pass

def test_aggregates_all_three_exchanges_with_provenance():
    data=fetch_foreign_flow(date(2026,10,9),Provider())
    assert data['buy_value']==3000000000
    assert data['sell_value']==6000000000
    assert data['net_value']==-3000000000
    assert data['scope']=='HOSE + HNX + UPCoM'
    assert len(data['provenance']['quotes'])==3

def test_missing_exchange_does_not_publish_partial_total():
    class Missing(Session):
        def get(self,url,**kwargs): return Response([])
    p=Provider();p.session=Missing()
    with pytest.raises(ValueError): fetch_foreign_flow(date(2026,10,9),p)
