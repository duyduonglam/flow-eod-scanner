import { demoRows } from '@/lib/demo-data';
import { getSupabase } from '@/lib/supabase';
import type { Decision, ScanRow } from '@/lib/types';

type RawScanRow = Record<string, unknown>;
type JoinedScanRow = RawScanRow & {
  symbols?: { symbol?: unknown; exchange?: unknown } | { symbol?: unknown; exchange?: unknown }[];
};

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

function embeddedSymbol(row: JoinedScanRow): string {
  const relation = Array.isArray(row.symbols) ? row.symbols[0] : row.symbols;
  return toText(row.symbol ?? relation?.symbol);
}

function normalizeRow(row: JoinedScanRow): ScanRow {
  return {
    symbol: embeddedSymbol(row),
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

async function getRowsForDate(marketDate: string): Promise<ScanRow[] | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('scan_results')
    .select('*, symbols!inner(symbol, exchange)')
    .eq('market_date', marketDate)
    .order('rank', { ascending: true });

  if (error || !data?.length) return null;
  return data.map((row) => normalizeRow(row as JoinedScanRow));
}

export async function getAvailableScanDates() {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('scan_results')
    .select('market_date')
    .order('market_date', { ascending: false })
    .limit(240);

  if (error || !data?.length) return [];
  return Array.from(new Set(data.map((row) => toText(row.market_date)).filter(Boolean)));
}

export async function getScanRows(marketDate?: string | null) {
  const db = getSupabase();
  const dates = await getAvailableScanDates();
  if (!db) {
    return { rows: demoRows, dataStatus: 'DEMO', marketDate: null, source: 'demo' as const, dates };
  }

  if (marketDate) {
    const selectedRows = await getRowsForDate(marketDate);
    if (selectedRows?.length) {
      return { rows: selectedRows, dataStatus: 'LIVE', marketDate, source: 'live' as const, dates };
    }
  }

  const { data, error } = await db.from('latest_scan_results').select('*').order('rank', { ascending: true });
  if (error || !data?.length) {
    return { rows: demoRows, dataStatus: 'DEMO', marketDate: null, source: 'demo' as const, dates };
  }

  const rows = data.map(normalizeRow);
  return {
    rows,
    dataStatus: 'LIVE',
    marketDate: rows[0]?.market_date ?? null,
    source: 'live' as const,
    dates,
  };
}

export async function getLatestScanRows() {
  return getScanRows();
}
