import Link from 'next/link';
import type {EarlyRow} from '@/lib/early-discovery';
const num=(n:number|null,d=2)=>n==null?'—':n.toLocaleString('vi-VN',{minimumFractionDigits:d,maximumFractionDigits:d});
export function EarlyDiscoveryTable({rows,status,marketDate}:{rows:EarlyRow[];status:string;marketDate:string|null}) {
  return <section className="scanSection earlyDiscovery" aria-labelledby="early-title">
    <div className="toolbar"><div><h2 id="early-title" className="sectionLabel">Phát hiện sớm · Thử nghiệm</h2>
      <div className="tableSub">DEMA/EMA xếp tăng · Bollinger Band · Thanh khoản bình quân ≥10 tỷ</div></div>
      <div className="dataStamp">{marketDate??'Chờ phiên'} · {status==='COMPLETE'?`${rows.length} mã`:'Từ 19/10/2026'}</div>
    </div>
    <details className="earlyFormula"><summary>Công thức và cách đọc</summary>
      <p>Cấu trúc: DEMA21 &gt; EMA20 &gt; EMA50 &gt; EMA200; giá đóng cửa &gt; DEMA21. EMA20/50 cao hơn 5 phiên trước, EMA200 cao hơn 20 phiên trước. Giá không cao hơn EMA20 quá 8%.</p>
      <p>Thanh khoản: GTGD bình quân 20 phiên ≥10 tỷ; phiên hiện tại ≥5 tỷ; đủ 260 phiên lịch sử.</p>
      <p><strong>CHUẨN BỊ:</strong> đạt cấu trúc trên, giá chưa vượt biên trên BB. <strong>BỨT PHÁ MỚI:</strong> đóng trên Upper BB (SMA20 + 2 độ lệch chuẩn); 4 phiên trước không đóng trên biên; khối lượng ≥1,3 lần trung bình 20 phiên trước.</p>
      <p>Chỉ báo dùng giá điều chỉnh FireAnt; cột Giá là giá giao dịch. Điểm FLOW là thông tin tham khảo, không có ngưỡng điểm tối thiểu trong bảng thử nghiệm. Tín hiệu không phải lệnh mua.</p>
    </details>
    {status==='ERROR'?<p className="emptyTable" role="status">Chưa tải được dữ liệu phát hiện sớm. Hãy tải lại trang.</p>:
    status!=='COMPLETE'?<p className="emptyTable" role="status">Chưa có kết quả thử nghiệm hoàn tất cho phiên này. Bắt đầu từ phiên 19/10/2026.</p>:
    <div className="tableWrap"><table className="scanTable earlyTable"><thead><tr>
      <th>Mã / Giá</th><th>% phiên</th><th>Trạng thái</th><th>Điểm FLOW</th><th>Vol / TB20 trước</th><th>Cách EMA20</th><th>GTGD TB20</th><th>GTGD phiên</th>
    </tr></thead><tbody>{rows.length?rows.map(r=><tr key={`${r.symbol}-${r.market_date}`}>
      <td><Link className="symbol" href={`/stocks/${r.symbol}?date=${r.market_date}`}>{r.symbol}</Link><div className="symbolPrice">{num(r.close)}</div></td>
      <td className={`dailyChange ${r.change_pct==null?'':r.change_pct>0?'up':r.change_pct<0?'down':''}`}>{num(r.change_pct)}{r.change_pct==null?'':'%'}</td>
      <td><span className={`status ${r.stage==='NEW_BREAKOUT'?'buyretest':'watch'}`}>{r.stage==='NEW_BREAKOUT'?'BỨT PHÁ MỚI':'CHUẨN BỊ'}</span></td>
      <td className="num">{num(r.flow_score,1)}</td><td className="num">{num(r.volume_ratio)}x</td>
      <td className="num">{num(r.extension_pct)}%</td><td className="num">{num(r.avg_value_20/1e9)} tỷ</td><td className="num">{num(r.current_value/1e9)} tỷ</td>
    </tr>):<tr><td colSpan={8} className="emptyTable">Không có mã đạt công thức phát hiện sớm trong phiên này.</td></tr>}</tbody></table></div>}
  </section>;
}
