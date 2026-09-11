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

function targetPercent(target: number | null, close: number | null): string | null {
  if (target == null || close == null || close === 0) return null;
  const value = ((target - close) / close) * 100;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function RewardCell({ value, close }: { value: number | null; close: number | null }) {
  const percent = targetPercent(value, close);
  return (
    <td className="num rewardCell riskMetric">
      <strong>{fmt(value)}</strong>
      {percent ? <span>{percent}</span> : null}
    </td>
  );
}

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
  sessionSummary,
  sessionStatus,
  sessionMode,
  sectionTitle = 'Bảng kết quả',
  sectionSubtitle,
}: {
  rows: ScanRow[];
  dataStamp?: string;
  showMarketDate?: boolean;
  emptyMessage?: string;
  sessionSummary?: string | null;
  sessionStatus?: string | null;
  sessionMode?: string | null;
  sectionTitle?: string;
  sectionSubtitle?: string;
}) {
  const hasSessionFooter = Boolean(sessionSummary || sessionStatus || sessionMode);
  return (
    <section className={`scanSection ${hasSessionFooter ? 'hasSessionSummary' : ''}`}>
      <div className="toolbar">
        <div>
          <div className="sectionLabel">{sectionTitle}</div>
          <div className="tableSub">
            {sectionSubtitle ?? (showMarketDate
              ? 'Lịch sử ticker được sắp xếp từ phiên mới nhất đến cũ hơn'
              : 'Sắp xếp theo điểm tổng, tín hiệu và vùng quản trị rủi ro')}
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
              <th className="riskHead">Stop</th>
              <th className="riskHead">1R</th>
              <th className="riskHead">2R</th>
              <th className="riskHead">3R</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const entryLow = row.entry_low == null || row.entry_high == null
                  ? null
                  : Math.min(row.entry_low, row.entry_high);
                const entryHigh = row.entry_low == null || row.entry_high == null
                  ? null
                  : Math.max(row.entry_low, row.entry_high);
                const inEntryZone = row.close != null && entryLow != null && entryHigh != null
                  && row.close >= entryLow && row.close <= entryHigh;

                return (
                <tr className={inEntryZone ? 'entryZoneActive' : undefined} key={`${row.symbol}-${row.market_date}`}>
                  <td>
                    <Link className="symbol" href={`/stocks/${row.symbol}?date=${row.market_date}`}>
                      {row.symbol}
                    </Link>
                    {row.close != null ? <div className="symbolPrice">{priceFormatter.format(row.close)}</div> : null}
                    {inEntryZone ? <span className="entryBadge">ENTRY</span> : null}
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
                  <td className="entryCell">{row.entry_low == null ? '-' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`}</td>
                  <td className="num riskMetric">
                    <div className="stopCell">
                      <strong>{fmt(row.stop_price)}</strong>
                      <span>{row.stop_distance_pct == null ? '-' : `${fmt(row.stop_distance_pct, 1)}%`}</span>
                    </div>
                  </td>
                  <RewardCell value={row.one_r} close={row.close} />
                  <RewardCell value={row.two_r} close={row.close} />
                  <RewardCell value={row.three_r} close={row.close} />
                  <td className="decision">
                    <span className={`status ${decisionClass(row.decision)}`}>{row.decision}</span>
                  </td>
                </tr>
                );
              })
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
      {hasSessionFooter ? (
        <div className="sessionSummary">
          {sessionSummary ? <div>{sessionSummary}</div> : null}
          {sessionStatus || sessionMode ? (
            <div className="sessionSummaryMeta">
              {sessionStatus ? <span>{sessionStatus}</span> : null}
              {sessionMode ? <span className="status buyretest">{sessionMode}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
