import Link from 'next/link';
import type { ScanRow } from '@/lib/types';

const fmt = (value: number | null, digits = 2) => (value == null ? '-' : value.toFixed(digits));
const priceFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

const decisionClass = (decision: string) =>
  decision === 'BUY'
    ? 'buy'
    : decision === 'BUY RETEST'
      ? 'buyretest'
      : decision === 'TEST BUY'
        ? 'testbuy'
        : decision === 'DO NOT CHASE'
          ? 'nochase'
          : decision === 'EXIT'
            ? 'exit'
            : 'watch';

const scoreClass = (score: number | null) => {
  if (score == null) return 'empty';
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 55) return 'caution';
  return 'weak';
};

function HeadlineNews({ row }: { row: ScanRow }) {
  if (!row.headline_news) return <span className="muted">-</span>;

  return (
    <div className="newsCell">
      {row.headline_news_url ? (
        <a
          className="newsLink"
          href={row.headline_news_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở nguồn tin để xác minh"
        >
          {row.headline_news}
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span>{row.headline_news}</span>
      )}
      {row.headline_news_source ? <span className="newsSource">{row.headline_news_source}</span> : null}
    </div>
  );
}

export function ScanTable({
  rows,
  dataStamp,
  showMarketDate = false,
  emptyMessage = 'Chưa có kết quả cho bộ lọc hiện tại.',
}: {
  rows: ScanRow[];
  dataStamp?: string;
  showMarketDate?: boolean;
  emptyMessage?: string;
}) {
  return (
    <section className="scanSection">
      <div className="toolbar">
        <div>
          <div className="sectionLabel">Bảng kết quả</div>
          <div className="tableSub">
            {showMarketDate
              ? 'Lịch sử ticker được sắp xếp từ phiên mới nhất đến cũ hơn'
              : 'Sắp xếp theo điểm tổng, tín hiệu và vùng quản trị rủi ro'}
          </div>
        </div>
        <div className="dataStamp">{dataStamp ?? 'EOD validated - 15:45 ICT'}</div>
      </div>
      <div className="tableWrap">
        <table className="scanTable">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Điểm tổng</th>
              <th>Tín hiệu chính</th>
              <th>Tin tức nổi bật</th>
              <th>Entry Zone</th>
              <th>Stop &amp; Distance %</th>
              <th>1R</th>
              <th>2R</th>
              <th>3R</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.symbol}-${row.market_date}`}>
                  <td>
                    <Link className="symbol" href={`/stocks/${row.symbol}?date=${row.market_date}`}>
                      {row.symbol}
                    </Link>
                    {row.close != null ? <div className="symbolPrice">{priceFormatter.format(row.close)}</div> : null}
                    {showMarketDate ? <div className="symbolDate">{row.market_date}</div> : null}
                  </td>
                  <td>
                    <div className="scoreCell">
                      <div>
                        <span className={`score ${scoreClass(row.flow_score)}`}>
                          {row.flow_score == null ? '-' : row.flow_score.toFixed(1)}
                        </span>
                        <span className="scoreUnit">/100</span>
                      </div>
                      <div className="scoreTrack" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, Math.max(0, row.flow_score ?? 0))}%` }} />
                      </div>
                      <div className="muted">{row.flow_label}</div>
                    </div>
                  </td>
                  <td className="signal">{row.main_signal}</td>
                  <td className="signal">
                    <HeadlineNews row={row} />
                  </td>
                  <td>{row.entry_low == null ? '-' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`}</td>
                  <td className="num stopCell">
                    <strong>{fmt(row.stop_price)}</strong>
                    <span>{row.stop_distance_pct == null ? '-' : `${fmt(row.stop_distance_pct, 1)}%`}</span>
                  </td>
                  <td className="num">{fmt(row.one_r)}</td>
                  <td className="num">{fmt(row.two_r)}</td>
                  <td className="num">{fmt(row.three_r)}</td>
                  <td className="decision">
                    <span className={`status ${decisionClass(row.decision)}`}>{row.decision}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="emptyTable" colSpan={10}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
