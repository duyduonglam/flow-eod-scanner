import { NextResponse } from 'next/server';
import { getScanRowBySymbol } from '@/lib/live-scan';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const date = new URL(request.url).searchParams.get('date');
  const row = await getScanRowBySymbol(symbol, date);

  return row ? NextResponse.json(row) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
