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
  const leader = rows.reduce<ScanRow | null>((best, row) => {
    if (!best) return row;
    return (row.flow_score ?? -1) > (best.flow_score ?? -1) ? row : best;
  }, null);
  const scoredRows = rows.filter((row) => row.flow_score != null);
  const averageScore = scoredRows.length
    ? scoredRows.reduce((total, row) => total + (row.flow_score ?? 0), 0) / scoredRows.length
    : null;
  const qualityLabel =
    averageScore == null ? 'Dang cho' : averageScore >= 80 ? 'Rat tot' : averageScore >= 70 ? 'Tot' : 'Than trong';

  return (
    <div className="marketGrid">
      <div className="marketCard marketMain">
        <div>
          <div className="marketLabel">Ngay thi truong</div>
          <div className="marketValue">{marketDate ?? 'Demo'}</div>
          <div className="subtitle">{dataStatus === 'LIVE' ? 'Du lieu scan da luu' : 'Du lieu minh hoa'}</div>
        </div>
        <div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>
            {dataStatus}
          </span>
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">So luong ma</div>
        <div className="metricValue">{rows.length}</div>
        <div className="metricHint">{strong} ma tren 80 diem</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Ma manh nhat</div>
        <div className="metricValue accent">{leader?.symbol ?? '-'}</div>
        <div className="metricHint">
          {leader?.flow_score == null ? '-' : `${leader.flow_score.toFixed(1)} /100`}
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Chat luong</div>
        <div className="metricValue">{averageScore == null ? '-' : averageScore.toFixed(1)}</div>
        <div className="metricHint">{qualityLabel}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Ung vien</div>
        <div className="metricValue">{candidates}</div>
        <div className="metricHint">{watch} ma watch 70-80</div>
      </div>
    </div>
  );
}
