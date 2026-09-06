import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'VNStock Market Intelligence',
  description: 'Bản đồ các mã cổ phiếu mạnh nhất thị trường Việt Nam',
};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="vi"><body>{children}</body></html>}
