import Link from 'next/link';
import type { ScanRow } from '@/lib/types';

const fmt = (value: number | null, digits = 2) => (value == null ? 'N/A' : value.toFixed(digits));

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

export function ScanTable({ rows, dataStamp }: { rows: ScanRow[]; dataStamp?: string }) {
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          <button className="tab active">All</button>
          <button className="tab">BUY</button>
          <button className="tab">BUY RETEST</button>
          <button className="tab">TEST BUY</button>
          <button className="tab">WATCH</button>
        </div>
        <div className="dataStamp">{dataStamp ?? 'EOD validated - 15:45 ICT'}</div>
      </div>
      <div className="tableWrap">
        <table className="scanTable">
          <thead>
            <tr>
              <th>Ma</th>
              <th>Diem tong</th>
              <th>Tin hieu chinh</th>
              <th>Tin tuc noi bat</th>
              <th>Entry Zone</th>
              <th>Stop</th>
              <th>Stop Distance</th>
              <th>1R</th>
              <th>2R</th>
              <th>3R</th>
              <th>Decision</th>
              <th>Invalidation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td>
                  <Link className="symbol" href={`/stocks/${row.symbol}`}>
                    {row.symbol}
                  </Link>
                  <div className="muted">{fmt(row.close)}</div>
                </td>
                <td>
                  <span className="score">{row.flow_score == null ? 'N/A' : `${row.flow_score.toFixed(1)}%`}</span>
                  <div className="muted">{row.flow_label}</div>
                </td>
                <td className="signal">{row.main_signal}</td>
                <td className="signal muted">{row.headline_news || '-'}</td>
                <td>{row.entry_low == null ? 'N/A' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`}</td>
                <td className="num">{fmt(row.stop_price)}</td>
                <td className="num">
                  {row.stop_distance_pct == null ? 'N/A' : `${fmt(row.stop_distance_pct, 1)}%`}
                </td>
                <td className="num">{fmt(row.one_r)}</td>
                <td className="num">{fmt(row.two_r)}</td>
                <td className="num">{fmt(row.three_r)}</td>
                <td className="decision">
                  <span className={`status ${decisionClass(row.decision)}`}>{row.decision}</span>
                </td>
                <td className="signal">{row.invalidation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
