import type { ScanRow } from '@/lib/types';

export function MarketHeader({
  rows,
  dataStatus,
  marketDate,
}: {
  rows: ScanRow[];
  dataStatus: string;
  marketDate: string | null;
}) {
  const strong = rows.filter((row) => (row.flow_score ?? 0) >= 80).length;
  const watch = rows.filter((row) => (row.flow_score ?? 0) >= 70 && (row.flow_score ?? 0) < 80).length;
  const candidates = rows.filter(
    (row) => row.decision === 'BUY' || row.decision === 'TEST BUY' || row.decision === 'BUY RETEST',
  ).length;

  return (
    <div className="marketGrid">
      <div className="marketCard marketMain">
        <div>
          <div className="marketLabel">Data Mode</div>
          <div className="marketValue">{dataStatus}</div>
          <div className="subtitle">{marketDate ? `Market date ${marketDate}` : 'Fallback data'}</div>
        </div>
        <div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>
            {dataStatus === 'LIVE' ? 'Connected' : 'Waiting'}
          </span>
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Stocks scanned</div>
        <div className="metricValue">{rows.length}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Score &gt;= 80</div>
        <div className="metricValue">{strong}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">70-80</div>
        <div className="metricValue">{watch}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Candidates</div>
        <div className="metricValue">{candidates}</div>
      </div>
    </div>
  );
}
