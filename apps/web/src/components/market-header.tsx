import type { MarketRegime, ScanRow } from '@/lib/types';

const indexFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

function pct(value: number | null | undefined): string {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function compact(value: number | null | undefined): string {
  return value == null ? '-' : compactFormatter.format(value);
}

function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return value < 0 ? 'down' : 'up';
}

export function MarketHeader({
  rows,
  dataStatus,
  marketDate,
  marketRegime,
}: {
  rows: ScanRow[];
  dataStatus: string;
  marketDate: string | null;
  marketRegime?: MarketRegime | null;
}) {
  const leader = rows.reduce<ScanRow | null>((best, row) => {
    if (!best) return row;
    return (row.flow_score ?? -1) > (best.flow_score ?? -1) ? row : best;
  }, null);
  const scoredRows = rows.filter((row) => row.flow_score != null);
  const averageScore = scoredRows.length
    ? scoredRows.reduce((total, row) => total + (row.flow_score ?? 0), 0) / scoredRows.length
    : null;
  const advancers = marketRegime?.breadth_advancers ?? null;
  const decliners = marketRegime?.breadth_decliners ?? null;
  const breadth = advancers == null || decliners == null ? '-' : `${advancers}/${decliners}`;
  const marketMode = marketRegime?.market_mode || (dataStatus === 'LIVE' ? 'Đã lưu' : 'Minh họa');

  return (
    <div className="marketGrid">
      <div className="marketCard marketMain">
        <div>
          <div className="marketLabel">Phiên dữ liệu</div>
          <div className="marketValue">{marketDate ?? 'Demo'}</div>
          <div className="subtitle">{marketRegime?.summary ?? 'Dữ liệu scan đã lưu theo phiên EOD'}</div>
        </div>
        <div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>{marketMode}</span>
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">{marketRegime?.index_symbol || 'VNINDEX'}</div>
        <div className="metricValue">
          {marketRegime?.index_close == null ? '-' : indexFormatter.format(marketRegime.index_close)}
        </div>
        <div className={`metricHint ${changeClass(marketRegime?.index_change_pct)}`}>
          {pct(marketRegime?.index_change_pct)}
        </div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Breadth</div>
        <div className="metricValue">{breadth}</div>
        <div className="metricHint">Mã tăng / mã giảm</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Thanh khoản</div>
        <div className="metricValue">{compact(marketRegime?.liquidity_value)}</div>
        <div className="metricHint">{marketRegime?.distribution_flag ? 'Có dấu hiệu phân phối' : 'Giá trị giao dịch'}</div>
      </div>
      <div className="marketCard">
        <div className="marketLabel">Dẫn sóng</div>
        <div className="metricValue accent">{leader?.symbol ?? '-'}</div>
        <div className="metricHint">
          {leader?.flow_score == null ? '-' : `${leader.flow_score.toFixed(1)} /100`}
          {averageScore == null ? '' : ` · TB ${averageScore.toFixed(1)}`}
        </div>
      </div>
    </div>
  );
}
