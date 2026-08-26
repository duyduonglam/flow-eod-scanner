import { MarketHeader } from '@/components/market-header';
import { ScanTable } from '@/components/scan-table';
import { getLatestScanRows } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { rows, dataStatus, marketDate, source } = await getLatestScanRows();
  const stamp = marketDate ? `Du lieu ${marketDate} - ${dataStatus}` : `${dataStatus} - du lieu mau`;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">F</div>
          <div>
            <div className="title">FLOW Scanner</div>
            <div className="subtitle">Vietnam EOD signal dashboard</div>
          </div>
        </div>
        <div className="subtitle">{source === 'live' ? 'LIVE Supabase' : 'DEMO fallback'}</div>
      </header>
      <MarketHeader rows={rows} dataStatus={dataStatus} marketDate={marketDate} />
      <ScanTable rows={rows} dataStamp={stamp} />
      <section className="notes">
        <h2>Nhan dinh quan trong</h2>
        <ul>
          <li>Uu tien ma co diem tong cao, RS tot va dong tien xac nhan; khong mua chi vi tang manh trong ngay.</li>
          <li>DO NOT CHASE khi gia vuot qua vung mua hop ly; cho retest thay vi tang rui ro T+2.</li>
          <li>Entry, Stop va 1R/2R/3R chi la tham chieu ky thuat, khong phai khuyen nghi mua ban ca nhan.</li>
        </ul>
      </section>
    </main>
  );
}
