export type Decision = 'BUY' | 'TEST BUY' | 'BUY RETEST' | 'WATCH' | 'DO NOT CHASE' | 'HOLD' | 'TRIM' | 'EXIT';

export type NewsItem = {
  title: string;
  url: string | null;
  source: string;
  published_at: string | null;
  market_date: string;
  symbol?: string | null;
  category?: string | null;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'RISK' | null;
};

export type ScanRow = {
  symbol: string;
  symbol_id?: number | null;
  market_date: string;
  close: number | null;
  flow_score: number | null;
  flow_label: string;
  main_signal: string;
  headline_news?: string | null;
  headline_news_url?: string | null;
  headline_news_source?: string | null;
  headline_news_published_at?: string | null;
  entry_low: number | null;
  entry_high: number | null;
  stop_price: number | null;
  stop_distance_pct: number | null;
  one_r: number | null;
  two_r: number | null;
  three_r: number | null;
  decision: Decision;
  invalidation: string;
  rs_rating?: number | null;
  banker?: number | null;
  retailer?: number | null;
  swing_direction?: string | null;
};
