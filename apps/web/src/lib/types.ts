export type Decision = 'BUY' | 'TEST BUY' | 'BUY RETEST' | 'WATCH' | 'DO NOT CHASE' | 'HOLD' | 'TRIM' | 'EXIT';

export type ScanRow = {
  symbol: string;
  market_date: string;
  close: number | null;
  flow_score: number | null;
  flow_label: string;
  main_signal: string;
  headline_news?: string | null;
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
