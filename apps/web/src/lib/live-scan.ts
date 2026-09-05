import { demoRows } from '@/lib/demo-data';
import { dedupeNews, normalizeTickerQuery, pickHeadlineNews } from '@/lib/scan-view-model';
import { getSupabase } from '@/lib/supabase';
import type { Decision, NewsItem, ScanRow } from '@/lib/types';

type RawScanRow = Record<string, unknown>;
type JoinedScanRow = RawScanRow & {
  symbols?: { symbol?: unknown; exchange?: unknown } | { symbol?: unknown; exchange?: unknown }[];
};
type JoinedNewsRow = Record<string, unknown> & {
  symbols?: { symbol?: unknown } | { symbol?: unknown }[];
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

function embeddedNewsSymbol(row: JoinedNewsRow): string | null {
  const relation = Array.isArray(row.symbols) ? row.symbols[0] : row.symbols;
  const symbol = toText(relation?.symbol);
  return symbol || null;
}

function normalizeHeadline(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const headline = value.trim();
  return headline && headline !== '-' && headline !== '—' ? headline : null;
}

function normalizeRow(row: JoinedScanRow): ScanRow {
  return {
    symbol: embeddedSymbol(row),
    symbol_id: toNumber(row.symbol_id),
    market_date: toText(row.market_date),
    close: toNumber(row.close),
    flow_score: toNumber(row.flow_score ?? row.total_score),
    flow_label: toText(row.flow_label ?? row.score_label, 'LIVE'),
    main_signal: toText(row.main_signal),
    headline_news: normalizeHeadline(row.headline_news),
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

function normalizeNews(row: JoinedNewsRow): NewsItem {
  const sentiment = toText(row.sentiment) as NewsItem['sentiment'];
  return {
    title: toText(row.title),
    url: typeof row.url === 'string' && row.url.trim() ? row.url.trim() : null,
    source: toText(row.source, 'Nguồn tin'),
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    market_date: toText(row.market_date),
    symbol: embeddedNewsSymbol(row),
    category: typeof row.category === 'string' ? row.category : null,
    sentiment: sentiment === 'POSITIVE' || sentiment === 'NEUTRAL' || sentiment === 'RISK' ? sentiment : null,
  };
}

async function attachHeadlineNews(rows: ScanRow[]): Promise<ScanRow[]> {
  const db = getSupabase();
  const symbolIds = Array.from(new Set(rows.map((row) => row.symbol_id).filter((id): id is number => id != null)));
  const marketDates = Array.from(new Set(rows.map((row) => row.market_date).filter(Boolean)));
  if (!db || !rows.length || !symbolIds.length || !marketDates.length) return rows;

  const sortedDates = marketDates.toSorted();
  const { data, error } = await db
    .from('news_items')
    .select('symbol_id, market_date, title, url, source, published_at')
    .in('symbol_id', symbolIds)
    .gte('market_date', sortedDates[0])
    .lte('market_date', sortedDates[sortedDates.length - 1])
    .order('published_at', { ascending: false })
    .limit(1000);

  if (error || !data?.length) return rows;

  const newsByKey = new Map<string, NewsItem[]>();
  for (const raw of data) {
    const symbolId = toNumber(raw.symbol_id);
    const marketDate = toText(raw.market_date);
    if (symbolId == null || !marketDate) continue;
    const key = `${marketDate}:${symbolId}`;
    const item: NewsItem = {
      title: toText(raw.title),
      url: typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null,
      source: toText(raw.source, 'Nguồn tin'),
      published_at: typeof raw.published_at === 'string' ? raw.published_at : null,
      market_date: marketDate,
    };
    const current = newsByKey.get(key) ?? [];
    current.push(item);
    newsByKey.set(key, current);
  }

  return rows.map((row) => {
    if (row.symbol_id == null) return row;
    const candidates = newsByKey.get(`${row.market_date}:${row.symbol_id}`) ?? [];
    const selected = pickHeadlineNews(row.headline_news, candidates);
    if (!selected) return row;
    return {
      ...row,
      headline_news: row.headline_news ?? selected.title,
      headline_news_url: selected.url,
      headline_news_source: selected.source,
      headline_news_published_at: selected.published_at,
    };
  });
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
  return attachHeadlineNews(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow)));
}

export async function getAvailableScanDates(): Promise<string[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('scan_results')
    .select('market_date')
    .order('market_date', { ascending: false })
    .limit(240);

  if (error || !data?.length) return [];
  return Array.from(new Set(data.map((row: { market_date?: unknown }) => toText(row.market_date)).filter(Boolean)));
}

export async function getScanHistoryBySymbol(symbol: string): Promise<ScanRow[]> {
  const normalizedSymbol = normalizeTickerQuery(symbol);
  const db = getSupabase();
  if (!normalizedSymbol) return [];
  if (!db) return demoRows.filter((row) => row.symbol.toUpperCase() === normalizedSymbol);

  const { data: symbolRow, error: symbolError } = await db
    .from('symbols')
    .select('id, symbol')
    .eq('symbol', normalizedSymbol)
    .maybeSingle();

  if (symbolError || !symbolRow?.id) return [];

  const { data, error } = await db
    .from('scan_results')
    .select('*, symbols!inner(symbol, exchange)')
    .eq('symbol_id', symbolRow.id)
    .order('market_date', { ascending: false })
    .order('rank', { ascending: true })
    .limit(240);

  if (error || !data?.length) return [];
  return attachHeadlineNews(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow)));
}

export async function getSessionNews(marketDate?: string | null): Promise<NewsItem[]> {
  const db = getSupabase();
  if (!db || !marketDate) return [];

  const { data, error } = await db
    .from('news_items')
    .select('market_date, title, url, source, published_at, category, sentiment, symbols(symbol)')
    .eq('market_date', marketDate)
    .order('published_at', { ascending: false })
    .limit(40);

  if (error || !data?.length) return [];
  return dedupeNews(data.map((row: RawScanRow) => normalizeNews(row as JoinedNewsRow)), 5);
}

export async function getScanRows(marketDate?: string | null, symbolQuery?: string | null) {
  const db = getSupabase();
  const dates = await getAvailableScanDates();
  const normalizedQuery = normalizeTickerQuery(symbolQuery);

  if (!db) {
    const rows = normalizedQuery
      ? demoRows.filter((row) => row.symbol.toUpperCase() === normalizedQuery)
      : demoRows;
    return {
      rows,
      dataStatus: 'DEMO',
      marketDate: rows[0]?.market_date ?? null,
      source: 'demo' as const,
      dates,
      searchSymbol: normalizedQuery || null,
    };
  }

  if (normalizedQuery) {
    const rows = await getScanHistoryBySymbol(normalizedQuery);
    return {
      rows,
      dataStatus: 'LIVE',
      marketDate: rows[0]?.market_date ?? null,
      source: 'live' as const,
      dates,
      searchSymbol: normalizedQuery,
    };
  }

  if (marketDate) {
    const selectedRows = await getRowsForDate(marketDate);
    if (selectedRows?.length) {
      return {
        rows: selectedRows,
        dataStatus: 'LIVE',
        marketDate,
        source: 'live' as const,
        dates,
        searchSymbol: null,
      };
    }
  }

  const { data, error } = await db.from('latest_scan_results').select('*').order('rank', { ascending: true });
  if (error || !data?.length) {
    return {
      rows: demoRows,
      dataStatus: 'DEMO',
      marketDate: null,
      source: 'demo' as const,
      dates,
      searchSymbol: null,
    };
  }

  const rows = await attachHeadlineNews(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow)));
  return {
    rows,
    dataStatus: 'LIVE',
    marketDate: rows[0]?.market_date ?? null,
    source: 'live' as const,
    dates,
    searchSymbol: null,
  };
}

export async function getLatestScanRows() {
  return getScanRows();
}

export async function getScanRowBySymbol(symbol: string, marketDate?: string | null) {
  const normalizedSymbol = normalizeTickerQuery(symbol);
  if (!normalizedSymbol) return null;
  if (!marketDate) {
    const rows = await getScanHistoryBySymbol(normalizedSymbol);
    return rows[0] ?? null;
  }
  const { rows } = await getScanRows(marketDate);
  return rows.find((row) => row.symbol.toUpperCase() === normalizedSymbol) ?? null;
}
