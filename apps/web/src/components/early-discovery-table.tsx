import Link from 'next/link';
import type {EarlyRow} from '@/lib/early-discovery';
const num=(n:number|null,d=2)=>n==null?'—':n.toLocaleString('vi-VN',{minimumFractionDigits:d,maximumFractionDigits:d});
export function EarlyDiscoveryTable({rows,status,marketDate}:{rows:EarlyRow[];status:string;marketDate:string|null}) {
  return <section className="scanSection earlyDiscovery" aria-labelledby="early-title">
    <div className="toolbar"><div><h2 id="early-title" className="sectionLabel">Phát hiện sớm · Thử nghiệm</h2>
      <div className="tableSub">RS ≥80 · Giá trên mây Ichimoku · DEMA/EMA + BB · Thanh khoản ≥10 tỷ</div></div>
      <div className="dataStamp">{marketDate??'Chờ phiên'} · {status==='COMPLETE'?`${rows.length} mã`:'Từ 19/10/2026'}</div>
    </div>
    {status==='ERROR'?<p className="emptyTable" role="status">Chưa tải được dữ liệu phát hiện sớm. Hãy tải lại trang.</p>:
    status!=='COMPLETE'?<p className="emptyTable" role="status">Chưa có kết quả thử nghiệm hoàn tất cho phiên này. Bắt đầu từ phiên 19/10/2026.</p>:
    <div className="tableWrap"><table className="scanTable earlyTable"><thead><tr>
      <th>Mã / Giá</th><th>% phiên</th><th>Trạng thái</th><th>RS</th><th>Ichimoku</th><th>Điểm FLOW</th><th>Vol / TB20 trước</th><th>Cách EMA20</th><th>GTGD TB20</th><th>GTGD phiên</th>
    </tr></thead><tbody>{rows.length?rows.map(r=><tr key={`${r.symbol}-${r.market_date}`}>
      <td><Link className="symbol" href={`/stocks/${r.symbol}?date=${r.market_date}`}>{r.symbol}</Link><div className="symbolPrice">{num(r.close)}</div></td>
      <td className={`dailyChange ${r.change_pct==null?'':r.change_pct>0?'up':r.change_pct<0?'down':''}`}>{num(r.change_pct)}{r.change_pct==null?'':'%'}</td>
      <td><span className={`status ${r.stage==='NEW_BREAKOUT'?'buyretest':'watch'}`}>{r.stage==='NEW_BREAKOUT'?'BỨT PHÁ MỚI':'CHUẨN BỊ'}</span></td>
      <td className="num">{num(r.rs_rating,1)}</td><td>{r.cloud_position==='ABOVE'?'Trên mây':'—'}</td><td className="num">{num(r.flow_score,1)}</td><td className="num">{num(r.volume_ratio)}x</td>
      <td className="num">{num(r.extension_pct)}%</td><td className="num">{num(r.avg_value_20/1e9)} tỷ</td><td className="num">{num(r.current_value/1e9)} tỷ</td>
    </tr>):<tr><td colSpan={10} className="emptyTable">Không có mã đạt công thức phát hiện sớm trong phiên này.</td></tr>}</tbody></table></div>}
  </section>;
}
