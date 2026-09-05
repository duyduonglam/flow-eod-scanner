import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getScanRowBySymbol } from '@/lib/live-scan';
import type { Decision, ScanRow } from '@/lib/types';

type StockPageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ date?: string }>;
};

const fmt = (value: number | null | undefined, digits = 2) =>
  value == null ? '-' : value.toFixed(digits);

const decisionClass = (decision: Decision) =>
  decision === 'BUY'
    ? 'buy'
    : decision === 'BUY RETEST'
      ? 'buyretest'
      : decision === 'TEST BUY'
        ? 'testbuy'
        : decision === 'DO NOT CHASE' || decision === 'EXIT'
          ? 'nochase'
          : 'watch';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalChecks({ row }: { row: ScanRow }) {
  const checks = [
    row.rs_rating == null ? null : ['RS Rating', String(row.rs_rating)],
    row.banker == null ? null : ['Banker', `${fmt(row.banker, 1)}%`],
    row.retailer == null ? null : ['Retailer', `${fmt(row.retailer, 1)}%`],
    row.swing_direction == null ? null : ['Swing', row.swing_direction],
  ].filter((check): check is [string, string] => check != null);

  if (!checks.length) return null;

  return (
    <div className="checklist">
      {checks.map(([label, value]) => (
        <div className="check" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function HeadlineNews({ row }: { row: ScanRow }) {
  if (!row.headline_news) return <p>-</p>;
  return (
    <div className="detailNews">
      {row.headline_news_url ? (
        <a href={row.headline_news_url} target="_blank" rel="noopener noreferrer">
          {row.headline_news}
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <p>{row.headline_news}</p>
      )}
      {row.headline_news_source ? <span>{row.headline_news_source}</span> : null}
    </div>
  );
}

export default async function StockPage({ params, searchParams }: StockPageProps) {
  const { symbol } = await params;
  const { date } = await searchParams;
  const row = await getScanRowBySymbol(symbol, date);

  if (!row) notFound();

  const backHref = row.market_date ? `/?date=${row.market_date}` : '/';
  const entry =
    row.entry_low == null || row.entry_high == null ? '-' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`;
  const coreMetrics = [
    row.close == null ? null : ['Close', fmt(row.close)],
    ['Score', row.flow_score == null ? '-' : `${row.flow_score.toFixed(1)}%`],
    ['Label', row.flow_label || '-'],
    ['Decision', row.decision],
  ].filter((metric): metric is [string, string] => metric != null);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <Link className="backLink" href={backHref}>
            Quay lại scanner
          </Link>
          <div className="detailTitle">
            {row.symbol} / {row.decision}
          </div>
          <div className="subtitle">Ngày dữ liệu {row.market_date}</div>
        </div>
        <span className={`status ${decisionClass(row.decision)}`}>
          {row.flow_score == null ? '-' : `${row.flow_score.toFixed(1)}%`}
        </span>
      </header>

      <div className="detailGrid">
        <section className="panel">
          <h3>Tín hiệu hiện tại</h3>
          <div className="kpis">
            {coreMetrics.map(([label, value]) => (
              <Metric label={label} value={value} key={label} />
            ))}
          </div>
          <SignalChecks row={row} />
          <div className="detailBlock">
            <span>Tín hiệu chính</span>
            <p>{row.main_signal || '-'}</p>
          </div>
          <div className="detailBlock">
            <span>Tin tức nổi bật</span>
            <HeadlineNews row={row} />
          </div>
        </section>

        <section className="panel">
          <h3>Kế hoạch giao dịch</h3>
          <div className="kpis tradeKpis">
            <Metric label="Entry Zone" value={entry} />
            <Metric label="Stop" value={fmt(row.stop_price)} />
            <Metric
              label="Distance"
              value={row.stop_distance_pct == null ? '-' : `${fmt(row.stop_distance_pct, 1)}%`}
            />
            <Metric label="1R" value={fmt(row.one_r)} />
            <Metric label="2R" value={fmt(row.two_r)} />
            <Metric label="3R" value={fmt(row.three_r)} />
          </div>
          <div className="detailBlock">
            <span>Invalidation</span>
            <p>{row.invalidation || 'Giá đóng cửa dưới Stop hoặc Swing chuyển DOWN.'}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
