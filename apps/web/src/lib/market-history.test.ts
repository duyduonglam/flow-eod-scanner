import test from 'node:test';
import assert from 'node:assert/strict';

test('history uses reference and does not invent old scores', async () => {
  const { buildHistoryRows } = await import('./market-history.ts');
  const result = buildHistoryRows([
    {market_date:'2026-10-19',close:20,reference:19,volume:100},
    {market_date:'2026-10-20',close:21,reference:20,volume:200},
    {market_date:'2026-10-21',close:22,reference:21,volume:300},
  ],[
    {market_date:'2026-10-20',flow_score:70,score_version:'v1'},
    {market_date:'2026-10-21',flow_score:75,score_version:'v1'},
  ]);
  assert.equal(result[0].scoreChange,5);
  assert.equal(result[1].scoreChange,null);
  assert.equal(result[2].score,null);
  assert.ok(Math.abs(result[1].changePct!-5)<1e-9);
});

test('score delta is unavailable across formula versions', async () => {
  const { buildHistoryRows } = await import('./market-history.ts');
  const result = buildHistoryRows([{market_date:'2026-10-20',close:20,reference:null,volume:1}], [
    {market_date:'2026-10-19',flow_score:90,score_version:'old'},
    {market_date:'2026-10-20',flow_score:70,score_version:'new'},
  ]);
  assert.equal(result[0].scoreChange,null);
  assert.equal(result[0].changePct,null);
});
