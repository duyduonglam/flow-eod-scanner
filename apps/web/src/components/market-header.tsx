import type { MarketRegime, ScanRow } from '@/lib/types';

const indexFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const liquidityFormatter = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pct(value: number | null | undefined): string {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function liquidity(value: number | null | undefined): string {
  return value == null ? '-' : `${liquidityFormatter.format(value / 1_000_000_000_000)} nghìn tỷ`;
}

function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return value < 0 ? 'down' : 'up';
}

function modeClass(value: string | null | undefined): string {
  const normalized = (value ?? '').toUpperCase().replace(/\s+/g, '');
  if (normalized.includes('RISKOFF')) return 'riskoff';
  if (normalized.includes('RISKON')) return 'riskon';
  return 'buyretest';
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
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
        <path d="M5 6H3v2a4 4 0 0 0 4 4" />
        <path d="M19 6h2v2a4 4 0 0 1-4 4" />
      </>
    );

  return (
    <svg className={`marketIcon ${type}`} viewBox="0 0 24 24" aria-hidden="true">
      {icon}
    </svg>
  );
}

export function MarketHeader({
  dataStatus,
  marketDate,
  marketRegime,
  rows = [],
}: {
  dataStatus: string;
  marketDate: string | null;
  marketRegime?: MarketRegime | null;
  rows?: ScanRow[];
}) {
  const advancers = marketRegime?.breadth_advancers ?? null;
  const decliners = marketRegime?.breadth_decliners ?? null;
  const marketMode = marketRegime?.market_mode?.trim() || null;
  const indexChangeClass = changeClass(marketRegime?.index_change_pct);
  const liquidityChangeClass =
    changeClass(marketRegime?.liquidity_change_pct);

  return (
    <section className="marketSnapshot" aria-label="Tổng quan thị trường">
      <div className="snapshotHeader">
        <div>
          <div className="snapshotTitle">
            <span className="snapshotDot" aria-hidden="true" />
            Tổng quan thị trường
            {marketMode ? <span className={`status snapshotMode ${modeClass(marketMode)}`}>{marketMode}</span> : null}
          </div>
        </div>
        <span className={`snapshotBadge ${dataStatus === 'LIVE' ? 'online' : 'demo'}`}>
          {dataStatus === 'LIVE' ? 'Published EOD' : 'Demo fallback'}
        </span>
      </div>
      <div className="marketGrid">
      <div className="marketCard marketMain">
        <div className="marketLabel withIcon">
          <MarketIcon type="session" />
          Phiên dữ liệu
        </div>
        <div className="marketValue">{marketDate ?? 'Demo'}</div>
        <div className="marketDetail">{dataStatus === 'LIVE' ? `${marketRegime?.validated_count ?? '—'} mã hợp lệ · ${rows.length} mã công bố` : 'Dữ liệu minh họa'}</div>
      </div>
      <div className="marketCard marketIndex">
        <div className="marketLabel withIcon">
          <MarketIcon type="index" />
          {marketRegime?.index_symbol === 'VNINDEX' ? 'VN-INDEX' : marketRegime?.index_symbol || 'VN-INDEX'}
        </div>
        <div className={`compactMetricLine ${indexChangeClass}`}>
          <span>{marketRegime?.index_close == null ? '-' : indexFormatter.format(marketRegime.index_close)}</span>
        </div>
        <div className={`marketDetail ${indexChangeClass}`}>{pct(marketRegime?.index_change_pct)} so với phiên trước</div>
      </div>
      <div className="marketCard marketBreadth">
        <div className="marketLabel withIcon">
          <MarketIcon type="breadth" />
          Mã tăng / Mã giảm
        </div>
        <div className="compactMetricLine breadthValue">
          {advancers == null || decliners == null ? (
            '-'
          ) : (
            <>
              <span className="breadthUp">{advancers} ↑</span>
              <span className="breadthDivider">·</span>
              <span className="breadthDown">{decliners} ↓</span>
            </>
          )}
        </div>
        <div className="marketDetail">Trong tập dữ liệu đã quét</div>
      </div>
      <div className="marketCard marketLiquidity">
        <div className="marketLabel withIcon">
          <MarketIcon type="liquidity" />
          GTGD tập mã đã quét
        </div>
        <div className="compactMetricLine accent">{liquidity(marketRegime?.liquidity_value)}</div>
        <div className={`marketDetail ${liquidityChangeClass}`}>{marketRegime?.liquidity_change_pct == null ? 'Chưa có so sánh phiên trước' : `${pct(marketRegime.liquidity_change_pct)} so với tập mã phiên trước`}</div>
      </div>
      <div className="marketCard marketForeign">
        <div className="marketLabel withIcon">
          <MarketIcon type="liquidity" />
          Khối ngoại mua / bán
        </div>
        <div className="compactMetricLine">Chưa có dữ liệu</div>
        <div className="marketDetail">Chưa có số liệu xác minh của phiên</div>
      </div>
      </div>
    </section>
  );
}
