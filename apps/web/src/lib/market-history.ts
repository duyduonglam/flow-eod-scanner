type Price = {market_date:string;close:number;reference:number|null;volume:number};
type Signal = {market_date:string;flow_score:number|null;score_version:string|null};
export function buildHistoryRows(prices:Price[],signals:Signal[]) {
  const byDate=new Map(signals.map(s=>[s.market_date,s]));
  const ordered=[...signals].sort((a,b)=>a.market_date.localeCompare(b.market_date));
  const deltas=new Map<string,number|null>();
  ordered.forEach((s,i)=>{
    const prev=ordered[i-1];
    deltas.set(s.market_date,prev?.score_version && prev.score_version===s.score_version && prev.flow_score!=null && s.flow_score!=null ? s.flow_score-prev.flow_score : null);
  });
  return [...prices].sort((a,b)=>b.market_date.localeCompare(a.market_date)).map(p=>({
    ...p,changePct:p.reference!=null && p.reference>0 ? (p.close/p.reference-1)*100 : null,
    score:byDate.get(p.market_date)?.flow_score??null,
    scoreChange:deltas.get(p.market_date)??null,
  }));
}
