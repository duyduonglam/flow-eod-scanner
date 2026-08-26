import { NextResponse } from 'next/server';
import { getLatestScanRows } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows, dataStatus, marketDate } = await getLatestScanRows();
  return NextResponse.json({ market_date: marketDate, data_status: dataStatus, rows });
}
