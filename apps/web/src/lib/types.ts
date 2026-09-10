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

export type MarketRegime = {
  market_date: string;
  market_mode: string;
  index_symbol: string;
  index_close: number | null;
  index_change_pct: number | null;
  breadth_advancers: number | null;
  breadth_decliners: number | null;
  liquidity_value: number | null;
  distribution_flag: boolean;
  summary: string | null;
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
  banker_ma?: number | null;
  hot_money?: number | null;
  hot_money_ma?: number | null;
  volume_buzz?: number | null;
  ud_volume_ratio?: number | null;
  retailer?: number | null;
  swing_direction?: string | null;
};
