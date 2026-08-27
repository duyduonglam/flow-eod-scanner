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
    ['RS Rating', row.rs_rating == null ? '-' : String(row.rs_rating)],
    ['Banker', row.banker == null ? '-' : `${fmt(row.banker, 1)}%`],
    ['Retailer', row.retailer == null ? '-' : `${fmt(row.retailer, 1)}%`],
    ['Swing', row.swing_direction ?? '-'],
  ];

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

export default async function StockPage({ params, searchParams }: StockPageProps) {
  const { symbol } = await params;
  const { date } = await searchParams;
  const row = await getScanRowBySymbol(symbol, date);

  if (!row) notFound();

  const backHref = row.market_date ? `/?date=${row.market_date}` : '/';
  const entry =
    row.entry_low == null || row.entry_high == null ? '-' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <Link className="backLink" href={backHref}>
            Quay lai scanner
          </Link>
          <div className="detailTitle">
            {row.symbol} / {row.decision}
          </div>
          <div className="subtitle">Ngay du lieu {row.market_date}</div>
        </div>
        <span className={`status ${decisionClass(row.decision)}`}>
          {row.flow_score == null ? '-' : `${row.flow_score.toFixed(1)}%`}
        </span>
      </header>

      <div className="detailGrid">
        <section className="panel">
          <h3>Tin hieu hien tai</h3>
          <div className="kpis">
            <Metric label="Close" value={fmt(row.close)} />
            <Metric label="Score" value={row.flow_score == null ? '-' : `${row.flow_score.toFixed(1)}%`} />
            <Metric label="Label" value={row.flow_label || '-'} />
            <Metric label="Decision" value={row.decision} />
          </div>
          <SignalChecks row={row} />
          <div className="detailBlock">
            <span>Tin hieu chinh</span>
            <p>{row.main_signal || '-'}</p>
          </div>
          <div className="detailBlock">
            <span>Tin tuc noi bat</span>
            <p>{row.headline_news || '-'}</p>
          </div>
        </section>

        <section className="panel">
          <h3>Ke hoach giao dich</h3>
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
            <p>{row.invalidation || 'Gia dong cua duoi Stop hoac Swing chuyen DOWN.'}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
