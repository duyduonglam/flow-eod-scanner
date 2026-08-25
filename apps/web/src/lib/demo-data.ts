import type { ScanRow } from './types';

// UI-only seed. Values marked N/A/PRE-SCREEN are intentionally not invented.
// HCM/BSR scores are historical validated snapshots from the project, not current-day signals.
export const demoRows: ScanRow[] = [
  {symbol:'HCM', market_date:'historical-snapshot', close:null, flow_score:81.8, flow_label:'PARTIAL*', main_signal:'Historical snapshot · RS 88 · Banker ~57% · Retailer 0% · Swing UP', headline_news:'—', entry_low:null, entry_high:null, stop_price:null, stop_distance_pct:null, one_r:null, two_r:null, three_r:null, decision:'WATCH', invalidation:'Recalculate from validated EOD data before use', rs_rating:88, banker:56.98, retailer:0, swing_direction:'UP'},
  {symbol:'BSR', market_date:'historical-snapshot', close:null, flow_score:63.6, flow_label:'NO*', main_signal:'Historical snapshot · RS 88.6 · Banker ~14% · Swing DOWN', headline_news:'—', entry_low:null, entry_high:null, stop_price:null, stop_distance_pct:null, one_r:null, two_r:null, three_r:null, decision:'WATCH', invalidation:'Recalculate from validated EOD data before use', rs_rating:88.6, banker:14.31, retailer:8.17, swing_direction:'DOWN'},
  {symbol:'PVT', market_date:'demo', close:null, flow_score:null, flow_label:'PRE-SCREEN', main_signal:'Awaiting validated EOD feed', headline_news:'—', entry_low:null, entry_high:null, stop_price:null, stop_distance_pct:null, one_r:null, two_r:null, three_r:null, decision:'WATCH', invalidation:'No deterministic levels until data validation'}
];
