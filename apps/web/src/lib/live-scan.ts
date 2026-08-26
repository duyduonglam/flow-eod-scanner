import { demoRows } from '@/lib/demo-data';
import { getSupabase } from '@/lib/supabase';
import type { Decision, ScanRow } from '@/lib/types';

type RawScanRow = Record<string, unknown>;

const decisions: Decision[] = ['BUY', 'TEST BUY', 'BUY RETEST', 'WATCH', 'DO NOT CHASE', 'HOLD', 'TRIM', 'EXIT'];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecision(value: unknown): Decision {
  return decisions.includes(value as Decision) ? (value as Decision) : 'WATCH';
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeRow(row: RawScanRow): ScanRow {
  return {
    symbol: toText(row.symbol),
    market_date: toText(row.market_date),
    close: toNumber(row.close),
    flow_score: toNumber(row.flow_score ?? row.total_score),
    flow_label: toText(row.flow_label ?? row.score_label, 'LIVE'),
    main_signal: toText(row.main_signal),
    headline_news: typeof row.headline_news === 'string' ? row.headline_news : null,
    entry_low: toNumber(row.entry_low),
    entry_high: toNumber(row.entry_high),
    stop_price: toNumber(row.stop_price),
    stop_distance_pct: toNumber(row.stop_distance_pct),
    one_r: toNumber(row.one_r),
    two_r: toNumber(row.two_r),
    three_r: toNumber(row.three_r),
    decision: toDecision(row.decision),
    invalidation: toText(row.invalidation),
    rs_rating: toNumber(row.rs_rating),
    banker: toNumber(row.banker),
    retailer: toNumber(row.retailer),
    swing_direction: typeof row.swing_direction === 'string' ? row.swing_direction : null,
  };
}

export async function getLatestScanRows() {
  const db = getSupabase();
  if (!db) {
    return { rows: demoRows, dataStatus: 'DEMO', marketDate: null, source: 'demo' as const };
  }

  const { data, error } = await db.from('latest_scan_results').select('*').order('rank', { ascending: true });
  if (error || !data?.length) {
    return { rows: demoRows, dataStatus: 'DEMO', marketDate: null, source: 'demo' as const };
  }

  const rows = data.map(normalizeRow);
  return {
    rows,
    dataStatus: 'LIVE',
    marketDate: rows[0]?.market_date ?? null,
    source: 'live' as const,
  };
}
