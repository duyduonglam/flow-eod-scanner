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
    averageScore == null ? 'Đang chờ' : averageScore >= 80 ? 'Rất tốt' : averageScore >= 70 ? 'Tốt' : 'Thận trọng';

  return (
    <div className="marketGrid">
      <div className="marketCard marketMain">
        <div>
          <div className="marketLabel">Ngày thị trường</div>
          <div className="marketValue">{marketDate ?? 'Demo'}</div>
          <div className="subtitle">{dataStatus === 'LIVE' ? 'Dữ liệu scan đã lưu' : 'Dữ liệu minh họa'}</div>
        </div>
        <div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>
            {dataStatus}
          </span>
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Số lượng mã</div>
        <div className="metricValue">{rows.length}</div>
        <div className="metricHint">{strong} mã trên 80 điểm</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Mã mạnh nhất</div>
        <div className="metricValue accent">{leader?.symbol ?? '-'}</div>
        <div className="metricHint">
          {leader?.flow_score == null ? '-' : `${leader.flow_score.toFixed(1)} /100`}
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Chất lượng</div>
        <div className="metricValue">{averageScore == null ? '-' : averageScore.toFixed(1)}</div>
        <div className="metricHint">{qualityLabel}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Ứng viên</div>
        <div className="metricValue">{candidates}</div>
        <div className="metricHint">{watch} mã watch 70-80</div>
      </div>
    </div>
  );
}
