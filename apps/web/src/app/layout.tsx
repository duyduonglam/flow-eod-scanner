import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {title:'FLOW EOD Scanner', description:'Vietnam EOD stock signal scanner'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="vi"><body>{children}</body></html>}
