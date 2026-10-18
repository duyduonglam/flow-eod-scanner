import Link from 'next/link';
import {ScanTableColumns, TradePlanCells} from '@/components/scan-table';
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
    <div className="tableWrap"><table className="scanTable earlyDiscoveryTable"><ScanTableColumns /><thead><tr>
      <th>Mã</th><th>%</th><th>Điểm FLOW</th><th>Tín hiệu chính</th><th>Thanh khoản</th><th>Entry Zone</th><th className="riskHead">Stop</th><th className="riskHead">1R</th><th className="riskHead">2R</th><th className="riskHead">3R</th><th>Trạng thái</th>
    </tr></thead><tbody>{rows.length?rows.map(r=><tr key={`${r.symbol}-${r.market_date}`}>
      <td><Link className="symbol" href={`/stocks/${r.symbol}?date=${r.market_date}`}>{r.symbol}</Link><div className="symbolPrice">{num(r.close)}</div></td>
      <td className={`dailyChange ${r.change_pct==null?'':r.change_pct>0?'up':r.change_pct<0?'down':''}`}>{num(r.change_pct)}{r.change_pct==null?'':'%'}</td>
      <td><div className="scoreCell"><div><span className="score">{num(r.flow_score,1)}</span><span className="scoreUnit">/100</span></div></div></td>
      <td className="signal"><strong>RS {num(r.rs_rating,0)}</strong> · {r.cloud_position==='ABOVE'?'Trên mây Ichimoku':'—'}<br />Vol/TB20 trước {num(r.volume_ratio)}x<br />Cách EMA20 {num(r.extension_pct)}%</td>
      <td className="signal">GTGD TB20: <strong>{num(r.avg_value_20/1e9)} tỷ</strong><br />GTGD phiên: {num(r.current_value/1e9)} tỷ</td>
      <TradePlanCells row={r} />
      <td className="decision"><span className={`status ${r.stage==='NEW_BREAKOUT'?'buyretest':'watch'}`}>{r.stage==='NEW_BREAKOUT'?'BỨT PHÁ MỚI':'CHUẨN BỊ'}</span></td>
    </tr>):<tr><td colSpan={11} className="emptyTable">Không có mã đạt công thức phát hiện sớm trong phiên này.</td></tr>}</tbody></table></div>}
  </section>;
}
