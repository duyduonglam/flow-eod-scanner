import { MarketHeader } from '@/components/market-header';
import { ScanTable } from '@/components/scan-table';
import { demoRows } from '@/lib/demo-data';

export default function Home(){return <main className="shell"><header className="topbar"><div className="brand"><div className="logo">F</div><div><div className="title">FLOW Scanner</div><div className="subtitle">Vietnam EOD signal dashboard</div></div></div><div className="subtitle">DEMO UI · chưa kết nối EOD</div></header><MarketHeader/><ScanTable rows={demoRows}/><section className="notes"><h2>Nhận định quan trọng</h2><ul><li>Ưu tiên mã có FLOW ≥85, RS cao và Swing UP; không mua chỉ vì tăng mạnh trong ngày.</li><li>DO NOT CHASE khi giá vượt quá vùng mua hợp lý; chờ retest thay vì tăng T+2 risk.</li><li>Dữ liệu bị xung đột giữa nguồn chính và fallback sẽ không được phép sinh Entry/Stop/R.</li></ul></section></main>}
