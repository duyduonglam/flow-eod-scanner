import { demoRows } from '@/lib/demo-data';
import {
  decisionValues,
  dedupeNews,
  findNewsUrlInHtml,
  normalizeDecisionFilter,
  normalizeTickerQuery,
  pickHeadlineNews,
  verifiedNewsUrl,
  type DecisionFilter,
} from '@/lib/scan-view-model';
import { getSupabase } from '@/lib/supabase';
import type { Decision, MarketRegime, NewsItem, ScanRow } from '@/lib/types';

type RawScanRow = Record<string, unknown>;
type JoinedScanRow = RawScanRow & {
  symbols?: { symbol?: unknown; exchange?: unknown } | { symbol?: unknown; exchange?: unknown }[];
};
type JoinedNewsRow = Record<string, unknown> & {
  symbols?: { symbol?: unknown } | { symbol?: unknown }[];
};

const decisions: Decision[] = [...decisionValues];
const cafefArticleCache = new Map<string, Promise<string | null>>();

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
    banker_ma: toNumber(row.banker_ma),
    hot_money: toNumber(row.hot_money),
    hot_money_ma: toNumber(row.hot_money_ma),
    volume_buzz: toNumber(row.volume_buzz),
    ud_volume_ratio: toNumber(row.ud_volume_ratio),
    retailer: toNumber(row.retailer),
    swing_direction: typeof row.swing_direction === 'string' ? row.swing_direction : null,
  };
}

function normalizeNews(row: JoinedNewsRow): NewsItem {
  const sentiment = toText(row.sentiment) as NewsItem['sentiment'];
  const title = toText(row.title);
  const rawUrl = typeof row.url === 'string' && row.url.trim() ? row.url.trim() : null;
  return {
    title,
    url: verifiedNewsUrl(rawUrl, title),
    source: toText(row.source, 'Nguồn tin'),
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    market_date: toText(row.market_date),
    symbol: embeddedNewsSymbol(row),
    category: typeof row.category === 'string' ? row.category : null,
    sentiment: sentiment === 'POSITIVE' || sentiment === 'NEUTRAL' || sentiment === 'RISK' ? sentiment : null,
  };
}

async function resolveCafeFArticleUrl(symbol: string | null | undefined, title: string): Promise<string | null> {
  if (!symbol || !title.trim()) return null;
  const ticker = normalizeTickerQuery(symbol);
  if (!ticker) return null;
  const key = `${ticker}:${title}`;
  const cached = cafefArticleCache.get(key);
  if (cached) return cached;

  const task = (async () => {
    const sourceUrl = `https://cafef.vn/du-lieu/tin-doanh-nghiep/${ticker.toLowerCase()}/event.chn`;
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'VNStock Market Intelligence link resolver' },
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(3500),
      });
      if (!response.ok) return null;
      return findNewsUrlInHtml(await response.text(), title, sourceUrl);
    } catch {
      return null;
    }
  })();

  cafefArticleCache.set(key, task);
  return task;
}

async function resolveStoredNewsUrl(
  url: string | null | undefined,
  title: string,
  symbol: string | null | undefined,
  alternateTitle?: string | null,
): Promise<string | null> {
  return (
    verifiedNewsUrl(url, title)
    ?? (alternateTitle ? verifiedNewsUrl(url, alternateTitle) : null)
    ?? (await resolveCafeFArticleUrl(symbol, title))
  );
}

function normalizeMarketRegime(row: RawScanRow): MarketRegime {
  return {
    market_date: toText(row.market_date),
    market_mode: toText(row.market_mode, 'Đang chờ'),
    index_symbol: toText(row.index_symbol, 'VNINDEX'),
    index_close: toNumber(row.index_close),
    index_change_pct: toNumber(row.index_change_pct),
    breadth_advancers: toNumber(row.breadth_advancers),
    breadth_decliners: toNumber(row.breadth_decliners),
    liquidity_value: toNumber(row.liquidity_value),
    distribution_flag: Boolean(row.distribution_flag),
    summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : null,
  };
}

export async function getMarketRegime(marketDate?: string | null): Promise<MarketRegime | null> {
  const db = getSupabase();
  if (!db || !marketDate) return null;

  const { data, error } = await db
    .from('market_regimes')
    .select(
      'market_date, market_mode, index_symbol, index_close, index_change_pct, breadth_advancers, breadth_decliners, liquidity_value, distribution_flag, summary',
    )
    .eq('market_date', marketDate)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeMarketRegime(data as RawScanRow);
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
      url: verifiedNewsUrl(typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null, toText(raw.title)),
      source: toText(raw.source, 'Nguồn tin'),
      published_at: typeof raw.published_at === 'string' ? raw.published_at : null,
      market_date: marketDate,
    };
    const current = newsByKey.get(key) ?? [];
    current.push(item);
    newsByKey.set(key, current);
  }

  return Promise.all(rows.map(async (row) => {
    if (row.symbol_id == null) return row;
    const candidates = newsByKey.get(`${row.market_date}:${row.symbol_id}`) ?? [];
    const selected = pickHeadlineNews(row.headline_news, candidates);
    if (!selected) return row;
    const headlineTitle = row.headline_news ?? selected.title;
    const url = await resolveStoredNewsUrl(selected.url, headlineTitle, row.symbol, selected.title);
    return {
      ...row,
      headline_news: row.headline_news ?? selected.title,
      headline_news_url: url,
      headline_news_source: selected.source,
      headline_news_published_at: selected.published_at,
    };
  }));
}

async function attachSignalMetrics(rows: ScanRow[]): Promise<ScanRow[]> {
  const db = getSupabase();
  const symbolIds = Array.from(new Set(rows.map((row) => row.symbol_id).filter((id): id is number => id != null)));
  const marketDates = Array.from(new Set(rows.map((row) => row.market_date).filter(Boolean)));
  if (!db || !rows.length || !symbolIds.length || !marketDates.length) return rows;

  const sortedDates = marketDates.toSorted();
  const { data, error } = await db
    .from('stock_signals')
    .select('symbol_id, market_date, close, rs_rating, banker, banker_ma, hot_money, hot_money_ma, volume_buzz, ud_volume_ratio')
    .in('symbol_id', symbolIds)
    .gte('market_date', sortedDates[0])
    .lte('market_date', sortedDates[sortedDates.length - 1])
    .limit(1000);

  if (error || !data?.length) return rows;

  const metricsByKey = new Map<string, {
    close: number | null;
    rs_rating: number | null;
    banker: number | null;
    banker_ma: number | null;
    hot_money: number | null;
    hot_money_ma: number | null;
    volume_buzz: number | null;
    ud_volume_ratio: number | null;
  }>();
  for (const raw of data) {
    const symbolId = toNumber(raw.symbol_id);
    const marketDate = toText(raw.market_date);
    if (symbolId == null || !marketDate) continue;
    metricsByKey.set(`${marketDate}:${symbolId}`, {
      close: toNumber(raw.close),
      rs_rating: toNumber(raw.rs_rating),
      banker: toNumber(raw.banker),
      banker_ma: toNumber(raw.banker_ma),
      hot_money: toNumber(raw.hot_money),
      hot_money_ma: toNumber(raw.hot_money_ma),
      volume_buzz: toNumber(raw.volume_buzz),
      ud_volume_ratio: toNumber(raw.ud_volume_ratio),
    });
  }

  return rows.map((row) => {
    if (row.symbol_id == null) return row;
    const metrics = metricsByKey.get(`${row.market_date}:${row.symbol_id}`);
    if (!metrics) return row;
    return {
      ...row,
      close: row.close ?? metrics.close,
      rs_rating: row.rs_rating ?? metrics.rs_rating,
      banker: row.banker ?? metrics.banker,
      banker_ma: row.banker_ma ?? metrics.banker_ma,
      hot_money: row.hot_money ?? metrics.hot_money,
      hot_money_ma: row.hot_money_ma ?? metrics.hot_money_ma,
      volume_buzz: row.volume_buzz ?? metrics.volume_buzz,
      ud_volume_ratio: row.ud_volume_ratio ?? metrics.ud_volume_ratio,
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
  return attachHeadlineNews(await attachSignalMetrics(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow))));
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
  return attachHeadlineNews(await attachSignalMetrics(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow))));
}

export async function getScanHistoryByDecision(decision: DecisionFilter): Promise<ScanRow[]> {
  const db = getSupabase();
  if (!db) return demoRows.filter((row) => row.decision === decision);

  const { data, error } = await db
    .from('scan_results')
    .select('*, symbols!inner(symbol, exchange)')
    .eq('decision', decision)
    .order('market_date', { ascending: false })
    .order('rank', { ascending: true })
    .limit(500);

  if (error || !data?.length) return [];
  return attachHeadlineNews(await attachSignalMetrics(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow))));
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
  const news = dedupeNews(data.map((row: RawScanRow) => normalizeNews(row as JoinedNewsRow)), 5);
  return Promise.all(
    news.map(async (item) => ({
      ...item,
      url: await resolveStoredNewsUrl(item.url, item.title, item.symbol),
    })),
  );
}

export async function getScanRows(marketDate?: string | null, symbolQuery?: string | null, decisionQuery?: string | null) {
  const db = getSupabase();
  const dates = await getAvailableScanDates();
  const normalizedQuery = normalizeTickerQuery(symbolQuery);
  const decisionFilter = normalizeDecisionFilter(decisionQuery);

  if (!db) {
    const rows = (normalizedQuery
      ? demoRows.filter((row) => row.symbol.toUpperCase() === normalizedQuery)
      : demoRows
    ).filter((row) => !decisionFilter || row.decision === decisionFilter);
    return {
      rows,
      dataStatus: 'DEMO',
      marketDate: rows[0]?.market_date ?? null,
      source: 'demo' as const,
      dates,
      searchSymbol: normalizedQuery || null,
      decisionFilter,
      marketRegime: null,
    };
  }

  if (normalizedQuery) {
    const rows = (await getScanHistoryBySymbol(normalizedQuery)).filter(
      (row) => !decisionFilter || row.decision === decisionFilter,
    );
    return {
      rows,
      dataStatus: 'LIVE',
      marketDate: rows[0]?.market_date ?? null,
      source: 'live' as const,
      dates,
      searchSymbol: normalizedQuery,
      decisionFilter,
      marketRegime: null,
    };
  }

  if (marketDate) {
    const selectedRows = await getRowsForDate(marketDate);
    if (selectedRows?.length) {
      const rows = selectedRows.filter((row) => !decisionFilter || row.decision === decisionFilter);
      return {
        rows,
        dataStatus: 'LIVE',
        marketDate,
        source: 'live' as const,
        dates,
        searchSymbol: null,
        decisionFilter,
        marketRegime: await getMarketRegime(marketDate),
      };
    }
  }

  if (decisionFilter) {
    const rows = await getScanHistoryByDecision(decisionFilter);
    return {
      rows,
      dataStatus: 'LIVE',
      marketDate: rows[0]?.market_date ?? null,
      source: 'live' as const,
      dates,
      searchSymbol: null,
      decisionFilter,
      marketRegime: null,
    };
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
      decisionFilter: null,
      marketRegime: null,
    };
  }

  const rows = await attachHeadlineNews(await attachSignalMetrics(data.map((row: RawScanRow) => normalizeRow(row as JoinedScanRow))));
  const latestMarketDate = rows[0]?.market_date ?? null;
  return {
    rows,
    dataStatus: 'LIVE',
    marketDate: latestMarketDate,
    source: 'live' as const,
    dates,
    searchSymbol: null,
    decisionFilter: null,
    marketRegime: await getMarketRegime(latestMarketDate),
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
