import { NextResponse } from 'next/server';
import { getScanRows } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  const { rows, dataStatus, marketDate, dates } = await getScanRows(date);
  return NextResponse.json({ market_date: marketDate, data_status: dataStatus, dates, rows });
}
