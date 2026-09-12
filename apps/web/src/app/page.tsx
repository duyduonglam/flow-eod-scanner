import { DashboardControls } from '@/components/dashboard-controls';
import { MarketHeader } from '@/components/market-header';
import { ScanSummary } from '@/components/scan-summary';
import { ScanTable } from '@/components/scan-table';
import { getScanRows, getSessionNews } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams: Promise<{ date?: string; q?: string; decision?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { date, q, decision } = await searchParams;
  const { rows, dataStatus, marketDate, source, dates, searchSymbol, decisionFilter, marketRegime } = await getScanRows(
    date,
    q,
    decision,
  );
  const isDecisionHistory = Boolean(decisionFilter && !date && !searchSymbol);
  const isHistoryView = Boolean(searchSymbol || decisionFilter);
  const qualityRows = rows.filter((row) => row.flow_score != null && row.flow_score >= 80);
  const watchRows = rows.filter((row) => row.flow_score != null && row.flow_score >= 75 && row.flow_score < 80);
  const sessionNews = isHistoryView ? [] : await getSessionNews(marketDate);
  const stamp = searchSymbol
    ? decisionFilter
      ? `Lịch sử ${searchSymbol} · Decision ${decisionFilter} · ${rows.length} phiên`
      : `Lịch sử ${searchSymbol} · ${rows.length} phiên`
    : decisionFilter
      ? `Decision ${decisionFilter} · ${rows.length} kết quả lịch sử`
    : marketDate
      ? `Dữ liệu ${marketDate} / ${dataStatus}`
      : `${dataStatus} / dữ liệu mẫu`;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <span>F</span>
          </div>
          <div>
            <div className="title">VNStock Market Intelligence</div>
            <div className="subtitle">Bản đồ các mã cổ phiếu mạnh nhất thị trường Việt Nam</div>
          </div>
        </div>
        <div className="headerMeta">
          <div className={`connection ${source === 'live' ? 'online' : 'demo'}`}>
            {source === 'live' ? 'Supabase LIVE' : 'Demo fallback'}
          </div>
        </div>
      </header>

      {searchSymbol || isDecisionHistory ? null : (
        <MarketHeader dataStatus={dataStatus} marketDate={marketDate} marketRegime={marketRegime} rows={rows} />
      )}
      <DashboardControls dates={dates} selectedDate={marketDate} query={searchSymbol} decision={decisionFilter} />
      {isHistoryView ? (
        <section className="searchResultBanner" aria-live="polite">
          <div>
            <div className="sectionLabel">Kết quả lịch sử</div>
            <strong>{searchSymbol ?? `Decision ${decisionFilter}`}</strong>
          </div>
          <span>{rows.length ? `${rows.length} kết quả đã lưu` : 'Không tìm thấy dữ liệu phù hợp trong database'}</span>
        </section>
      ) : null}

      {isHistoryView ? (
        <ScanTable
          rows={rows}
          dataStamp={stamp}
          showMarketDate
          emptyMessage={searchSymbol
            ? `Không có dữ liệu lịch sử cho mã ${searchSymbol}.`
            : `Không có dữ liệu lịch sử cho Decision ${decisionFilter}.`}
        />
      ) : (
        <>
          <ScanTable
            rows={qualityRows}
            dataStamp={stamp}
            sectionTitle="Bảng CHẤT LƯỢNG · Tổng điểm từ 80"
            sectionSubtitle="Nhóm tín hiệu đạt chuẩn công bố chính của hệ thống."
            emptyMessage="Chưa có mã đạt Tổng điểm từ 80 trong phiên này."
            sessionSummary={marketRegime?.summary}
          />
          {watchRows.length ? (
            <ScanTable
              rows={watchRows}
              dataStamp={stamp}
              sectionTitle="Bảng THEO DÕI · Tổng điểm 75–79,9"
              sectionSubtitle="Mã đáng theo dõi nhưng cần thêm xác nhận về dòng tiền, thanh khoản hoặc xu hướng."
            />
          ) : null}
        </>
      )}

      {isHistoryView ? null : <ScanSummary rows={rows} news={sessionNews} marketDate={marketDate} />}

      <section className="notes">
        <h2>Ghi chú EOD</h2>
        <ul>
          <li>Hệ thống giúp lọc nhanh nhóm cổ phiếu mạnh theo FLOW score, RS, dòng tiền và vùng quản trị rủi ro sau mỗi phiên.</li>
          <li>Nên ưu tiên các mã có tín hiệu đồng thuận: điểm cao, xu hướng tốt, thanh khoản xác nhận và giá còn nằm gần Entry Zone.</li>
          <li>Luôn kiểm tra thêm bối cảnh VNINDEX, Breadth, tin tức và thanh khoản trước khi hành động, đặc biệt khi thị trường phân hóa.</li>
          <li>Tránh mua đuổi khi giá đã vượt xa vùng mua hoặc Stop quá rộng; dashboard là công cụ tham khảo, không phải khuyến nghị đầu tư cá nhân.</li>
        </ul>
      </section>
    </main>
  );
}
