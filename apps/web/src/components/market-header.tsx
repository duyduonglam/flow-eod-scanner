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
          <div className="marketLabel">Ket noi du lieu</div>
          <div className="marketValue">{dataStatus}</div>
          <div className="subtitle">{marketDate ? `Ngay du lieu ${marketDate}` : 'Du lieu mau'}</div>
        </div>
        <div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>
            {dataStatus === 'LIVE' ? 'Connected' : 'Waiting'}
          </span>
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">So ma hien thi</div>
        <div className="metricValue">{rows.length}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Diem &gt;= 80</div>
        <div className="metricValue">{strong}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Diem 70-80</div>
        <div className="metricValue">{watch}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Ung vien</div>
        <div className="metricValue">{candidates}</div>
      </div>
    </div>
  );
}
