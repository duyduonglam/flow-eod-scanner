import {getSupabase} from '@/lib/supabase';
import {buildHistoryRows} from '@/lib/market-history';
export async function PriceHistory({symbol,marketDate}:{symbol:string;marketDate:string}) {
  const db=getSupabase();
  if(!db)return null;
  const stock=await db.from('symbols').select('id').eq('symbol',symbol).maybeSingle();
  if(!stock.data)return null;
  const [prices,signals]=await Promise.all([
    db.from('daily_prices').select('market_date,close,reference,volume').eq('symbol_id',stock.data.id).eq('source','fireant').eq('validation_status','VALID').lte('market_date',marketDate).order('market_date',{ascending:false}).limit(120),
    db.from('stock_signals').select('market_date,flow_score,score_version').eq('symbol_id',stock.data.id).lte('market_date',marketDate).order('market_date',{ascending:false}).limit(121),
  ]);
  const fmt=(n:number|null,d=2)=>n==null?'—':n.toLocaleString('vi-VN',{maximumFractionDigits:d,minimumFractionDigits:d});
  const rows=buildHistoryRows(prices.data??[],signals.data??[]);
  return <section className="scanSection"><div className="toolbar"><div><h2 className="sectionLabel">Lịch sử giá &amp; điểm · {symbol}</h2><div className="tableSub">120 phiên gần nhất đến ngày đang xem · Giá giao dịch chưa điều chỉnh · Điểm được lưu theo từng phiên từ khi thu thập</div></div></div>
    {prices.error||signals.error?<p className="emptyTable">Chưa tải được lịch sử. Hãy tải lại trang.</p>:
    <div className="tableWrap"><table className="scanTable earlyTable"><thead><tr><th>Ngày</th><th>Giá đóng cửa</th><th>% phiên</th><th>Số lượng</th><th>Điểm FLOW</th><th>Thay đổi điểm</th></tr></thead><tbody>
      {rows.length?rows.map(r=><tr key={r.market_date}><td>{r.market_date}</td><td className="num">{fmt(r.close)}</td><td className="num">{fmt(r.changePct)}{r.changePct==null?'':'%'}</td><td className="num">{fmt(r.volume,0)}</td><td className="num">{fmt(r.score,1)}</td><td className="num">{r.scoreChange!=null&&r.scoreChange>0?'+':''}{fmt(r.scoreChange,1)}</td></tr>):<tr><td colSpan={6} className="emptyTable">Chưa có chuỗi giá được lưu. Thu thập toàn thị trường bắt đầu từ 19/10/2026.</td></tr>}
    </tbody></table></div>}
  </section>;
}
