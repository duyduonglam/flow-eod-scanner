import { MarketHeader } from '@/components/market-header';
import { ScanTable } from '@/components/scan-table';
import { getScanRows } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams: Promise<{ date?: string }>;
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
  const { date } = await searchParams;
  const { rows, dataStatus, marketDate, source, dates } = await getScanRows(date);
  const stamp = marketDate ? `Du lieu ${marketDate} / ${dataStatus}` : `${dataStatus} / du lieu mau`;

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
          <div className="headerDate">{marketDate ?? 'Chưa có ngày dữ liệu'}</div>
        </div>
      </header>
      <MarketHeader rows={rows} dataStatus={dataStatus} marketDate={marketDate} />
      <HistoryNav dates={dates} selectedDate={marketDate} />
      <ScanTable rows={rows} dataStamp={stamp} />
      <section className="notes">
        <h2>Ghi chú EOD</h2>
        <ul>
          <li>Ưu tiên mã có điểm tổng cao, RS tốt và dòng tiền xác nhận.</li>
          <li>Không mua đuổi khi giá đã vượt xa Entry Zone hoặc Stop Distance quá rộng.</li>
          <li>Đây là watchlist định lượng, không phải tư vấn đầu tư cá nhân.</li>
        </ul>
      </section>
    </main>
  );
}
