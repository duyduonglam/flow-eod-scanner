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
    <section className="historyRail" aria-label="Lich su scan">
      <div>
        <div className="sectionLabel">Lich su scan</div>
        <div className="historyHint">Chon ngay da luu de xem lai watchlist</div>
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
          <div className="headerDate">{marketDate ?? 'No market date'}</div>
        </div>
      </header>
      <MarketHeader rows={rows} dataStatus={dataStatus} marketDate={marketDate} />
      <HistoryNav dates={dates} selectedDate={marketDate} />
      <ScanTable rows={rows} dataStamp={stamp} />
      <section className="notes">
        <h2>Ghi chu EOD</h2>
        <ul>
          <li>Uu tien ma co diem tong cao, RS tot va dong tien xac nhan.</li>
          <li>Khong mua duoi khi gia da vuot xa Entry Zone hoac Stop Distance qua rong.</li>
          <li>Day la watchlist dinh luong, khong phai tu van dau tu ca nhan.</li>
        </ul>
      </section>
    </main>
  );
}
