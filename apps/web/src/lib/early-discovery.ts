import { getSupabase } from '@/lib/supabase';
export type EarlyRow = {
  symbol:string; market_date:string; stage:'PREPARING'|'NEW_BREAKOUT'; close:number;
  change_pct:number|null; flow_score:number|null; volume_ratio:number; extension_pct:number;
  avg_value_20:number; current_value:number; dema21:number; ema20:number; ema50:number;
  ema200:number; upper_bb:number; adjusted_close:number;
  entry_low:number|null; entry_high:number|null; stop_price:number|null; stop_distance_pct:number|null;
  one_r:number|null; two_r:number|null; three_r:number|null;
  rs_rating:number; ichimoku_priority:number; cloud_green:boolean; cloud_position:string;
};
export async function getEarlyDiscoveries(marketDate:string|null) {
  const db=getSupabase();
  if (!db || !marketDate) return {status:'PENDING',rows:[] as EarlyRow[]};
  const run=await db.from('early_scan_runs').select('status,candidate_count').eq('market_date',marketDate).maybeSingle();
  if (run.error) return {status:'ERROR',rows:[] as EarlyRow[]};
  if (!run.data || run.data.status!=='COMPLETE') return {status:'PENDING',rows:[] as EarlyRow[]};
  const rows:EarlyRow[]=[];
  for(let offset=0;;offset+=1000){
    const result=await db.from('early_discoveries').select('*,symbols!inner(symbol)').eq('market_date',marketDate)
      .order('stage',{ascending:true}).order('rs_rating',{ascending:false}).order('volume_ratio',{ascending:false}).order('symbol_id').range(offset,offset+999);
    if(result.error) return {status:'ERROR',rows:[] as EarlyRow[]};
    const page=result.data??[];
    rows.push(...page.map(r=>({...r,symbol:r.symbols.symbol}) as EarlyRow));
    if(page.length<1000)break;
  }
  if(rows.length!==run.data.candidate_count)return {status:'ERROR',rows:[] as EarlyRow[]};
  return {status:'COMPLETE',rows};
}
