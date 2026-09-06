import type { MarketRegime, ScanRow } from '@/lib/types';

const indexFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const liquidityFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

function pct(value: number | null | undefined): string {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function liquidity(value: number | null | undefined): string {
  return value == null ? '-' : `${liquidityFormatter.format(value / 1_000_000_000_000)} Nghìn tỉ`;
}

function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return value < 0 ? 'down' : 'up';
}

function MarketIcon({ type }: { type: 'session' | 'index' | 'breadth' | 'liquidity' | 'leader' }) {
  const icon =
    type === 'session' ? (
      <>
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4.5 8h15" />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
        <path d="M8 12h3" />
        <path d="M8 16h5" />
      </>
    ) : type === 'index' ? (
      <path d="M5 15h3l2.4-7 4.2 13 3-8H21" />
    ) : type === 'breadth' ? (
      <>
        <path d="M7 17V9" />
        <path d="M12 17V5" />
        <path d="M17 17v-6" />
        <path d="M5 19h14" />
      </>
    ) : type === 'liquidity' ? (
      <>
        <path d="M12 3v18" />
        <path d="M7 7.5c0-2 2-3.5 5-3.5s5 1.3 5 3.2c0 2.3-2.4 2.8-5 3.3s-5 1-5 3.3S9 17.5 12 17.5s5-1.4 5-3.5" />
      </>
    ) : (
      <path d="m12 3 2.9 5.9 6.1.9-4.5 4.4 1.1 6.1L12 17.4l-5.6 2.9 1.1-6.1L3 9.8l6.1-.9L12 3Z" />
    );

  return (
    <svg className={`marketIcon ${type}`} viewBox="0 0 24 24" aria-hidden="true">
      {icon}
    </svg>
  );
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
  const marketMode = marketRegime?.market_mode || (dataStatus === 'LIVE' ? 'Đã lưu' : 'Minh họa');
  const sessionLabel = dataStatus === 'LIVE' ? 'Scan EOD đã lưu' : 'Dữ liệu minh họa';
  const indexChangeClass = changeClass(marketRegime?.index_change_pct);
  const liquidityChangeClass =
    marketRegime?.liquidity_value == null ? '' : marketRegime?.distribution_flag ? 'down' : 'up';
  const scanStateLabel = dataStatus === 'LIVE' ? 'Scan đã lưu' : sessionLabel;

  return (
    <div className="marketGrid">
      <div className="marketCard marketMain">
        <div>
          <div className="marketLabel withIcon">
            <MarketIcon type="session" />
            Phiên dữ liệu
          </div>
          <div className="marketValue">{marketDate ?? 'Demo'}</div>
        </div>
        <div className="sessionStatusGroup">
          <div className="compactLine">{scanStateLabel}</div>
          <span className={`status ${dataStatus === 'LIVE' ? 'buyretest' : 'watch'}`}>{marketMode}</span>
        </div>
      </div>
      <div className="marketCard marketIndex">
        <div className="marketLabel withIcon">
          <MarketIcon type="index" />
          {marketRegime?.index_symbol || 'VNINDEX'}
        </div>
        <div className={`compactMetricLine ${indexChangeClass}`}>
          <span>{marketRegime?.index_close == null ? '-' : indexFormatter.format(marketRegime.index_close)}</span>
          <span>{pct(marketRegime?.index_change_pct)}</span>
        </div>
      </div>
      <div className="marketCard marketBreadth">
        <div className="marketLabel withIcon">
          <MarketIcon type="breadth" />
          Mã tăng/Mã giảm
        </div>
        <div className="compactMetricLine breadthValue">
          {advancers == null || decliners == null ? (
            '-'
          ) : (
            <>
              <span className="breadthUp">{advancers}</span>
              <span className="breadthDivider">/</span>
              <span className="breadthDown">{decliners}</span>
            </>
          )}
        </div>
      </div>
      <div className="marketCard marketLiquidity">
        <div className="marketLabel withIcon">
          <MarketIcon type="liquidity" />
          Thanh khoản
        </div>
        <div className={`compactMetricLine ${liquidityChangeClass}`}>{liquidity(marketRegime?.liquidity_value)}</div>
      </div>
      <div className="marketCard marketLeader">
        <div className="marketLabel withIcon">
          <MarketIcon type="leader" />
          Dẫn sóng
        </div>
        <div className="compactMetricLine accent">
          <span>{leader?.symbol ?? '-'}</span>
          <span>
            {leader?.flow_score == null ? '-' : `${leader.flow_score.toFixed(1)}/100`}
            {averageScore == null ? '' : ` · TB ${averageScore.toFixed(1)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
