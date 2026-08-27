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
        <div>
          <div className="sectionLabel">Bang ket qua</div>
          <div className="tableSub">Sap xep theo diem tong va chat luong tin hieu</div>
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
              <th>Stop &amp; Distance %</th>
              <th>1R</th>
              <th>2R</th>
              <th>3R</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td>
                  <Link className="symbol" href={`/stocks/${row.symbol}?date=${row.market_date}`}>
                    {row.symbol}
                  </Link>
                  {row.close != null ? <div className="muted">{fmt(row.close)}</div> : null}
                </td>
                <td>
                  <span className="score">{row.flow_score == null ? 'N/A' : `${row.flow_score.toFixed(1)}%`}</span>
                  <div className="muted">{row.flow_label}</div>
                </td>
                <td className="signal">{row.main_signal}</td>
                <td className="signal muted">{row.headline_news || '-'}</td>
                <td>{row.entry_low == null ? 'N/A' : `${fmt(row.entry_low)}-${fmt(row.entry_high)}`}</td>
                <td className="num stopCell">
                  <strong>{fmt(row.stop_price)}</strong>
                  <span>{row.stop_distance_pct == null ? 'N/A' : `${fmt(row.stop_distance_pct, 1)}%`}</span>
                </td>
                <td className="num">{fmt(row.one_r)}</td>
                <td className="num">{fmt(row.two_r)}</td>
                <td className="num">{fmt(row.three_r)}</td>
                <td className="decision">
                  <span className={`status ${decisionClass(row.decision)}`}>{row.decision}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
