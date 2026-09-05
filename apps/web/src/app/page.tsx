import { MarketHeader } from '@/components/market-header';
import { ManualScanControl } from '@/components/manual-scan-control';
import { ScanSearch } from '@/components/scan-search';
import { ScanSummary } from '@/components/scan-summary';
import { ScanTable } from '@/components/scan-table';
import { getScanRows, getSessionNews } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams: Promise<{ date?: string; q?: string }>;
};

function HistoryNav({ dates, selectedDate }: { dates: string[]; selectedDate: string | null }) {
  if (!dates.length) return null;

  return (
    <section className="historyRail" aria-label="Lịch sử scan">
      <div>
        <div className="sectionLabel">Lịch sử scan</div>
        <div className="historyHint">Chọn ngày đã lưu để xem lại watchlist</div>
      </div>
      <div className="dateChips">
        {dates.map((date) => (
          <a className={`dateChip ${date === selectedDate ? 'active' : ''}`} href={`/?date=${date}`} key={date}>
            {date}
          </a>
        ))}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const { date, q } = await searchParams;
  const { rows, dataStatus, marketDate, source, dates, searchSymbol } = await getScanRows(date, q);
  const sessionNews = searchSymbol ? [] : await getSessionNews(marketDate);
  const stamp = searchSymbol
    ? `Lịch sử ${searchSymbol} · ${rows.length} phiên`
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
            <div className="title">FLOW EOD Scanner</div>
            <div className="subtitle">RS + MCDX + FLOW dashboard</div>
          </div>
        </div>
        <div className="headerMeta">
          <div className={`connection ${source === 'live' ? 'online' : 'demo'}`}>
            {source === 'live' ? 'Supabase LIVE' : 'Demo fallback'}
          </div>
          <div className="headerDate">
            {searchSymbol ? `Tìm ${searchSymbol} · mọi phiên` : marketDate ?? 'Chưa có ngày dữ liệu'}
          </div>
        </div>
      </header>

      {searchSymbol ? null : <MarketHeader rows={rows} dataStatus={dataStatus} marketDate={marketDate} />}
      <ScanSearch query={searchSymbol} />
      <ManualScanControl defaultDate={marketDate} />
      {searchSymbol ? (
        <section className="searchResultBanner" aria-live="polite">
          <div>
            <div className="sectionLabel">Kết quả lịch sử</div>
            <strong>{searchSymbol}</strong>
          </div>
          <span>{rows.length ? `${rows.length} phiên đã lưu` : 'Không tìm thấy phiên nào trong database'}</span>
        </section>
      ) : (
        <HistoryNav dates={dates} selectedDate={marketDate} />
      )}

      <ScanTable
        rows={rows}
        dataStamp={stamp}
        showMarketDate={Boolean(searchSymbol)}
        emptyMessage={searchSymbol ? `Không có dữ liệu lịch sử cho mã ${searchSymbol}.` : undefined}
      />

      {searchSymbol ? null : <ScanSummary rows={rows} news={sessionNews} marketDate={marketDate} />}

      <section className="notes">
        <h2>Ghi chú EOD</h2>
        <ul>
          <li>Ưu tiên mã có điểm tổng cao, RS tốt và dòng tiền xác nhận.</li>
          <li>Không mua đuổi khi giá đã vượt xa Entry Zone hoặc Stop Distance quá rộng.</li>
          <li>Link tin tức chỉ mở nguồn đã lưu trong database; không tạo link giả khi chưa có nguồn xác minh.</li>
          <li>Đây là watchlist định lượng, không phải tư vấn đầu tư cá nhân.</li>
        </ul>
      </section>
    </main>
  );
}
