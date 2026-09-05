import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExclusions,
  buildQuickAssessments,
  dedupeNews,
  normalizeTickerQuery,
  pickHeadlineNews,
} from './scan-view-model.ts';

const baseRow = {
  symbol: 'AAA',
  market_date: '2026-09-03',
  flow_score: 80,
  main_signal: 'RS mạnh, dòng tiền xác nhận',
  decision: 'WATCH',
  invalidation: '',
  stop_distance_pct: 4,
  rs_rating: 92,
  banker: 95,
};

test('normalizes ticker search for all-history lookup', () => {
  assert.equal(normalizeTickerQuery('  vpi '), 'VPI');
  assert.equal(normalizeTickerQuery('gmd.vn'), 'GMDVN');
  assert.equal(normalizeTickerQuery(''), '');
});

test('only links a stored headline when the title matches a real news item', () => {
  const items = [
    { title: 'Tin mới hơn', url: 'https://example.com/latest', source: 'Source A', published_at: '2026-09-03T10:00:00Z' },
    { title: 'KQKD quý 2 tăng mạnh', url: 'https://example.com/earnings', source: 'Source B', published_at: '2026-09-03T09:00:00Z' },
  ];
  assert.equal(pickHeadlineNews('KQKD quý 2 tăng mạnh', items)?.url, 'https://example.com/earnings');
  assert.equal(pickHeadlineNews('Không khớp', items), null);
  assert.equal(pickHeadlineNews(null, items)?.url, 'https://example.com/latest');
});

test('quick assessments prioritize the highest FLOW scores', () => {
  const rows = [
    baseRow,
    { ...baseRow, symbol: 'BBB', flow_score: 91, decision: 'BUY', main_signal: 'Breakout xác nhận' },
    { ...baseRow, symbol: 'CCC', flow_score: 72, decision: 'WATCH' },
  ];
  const assessments = buildQuickAssessments(rows, 2);
  assert.deepEqual(assessments.map((item) => item.symbol), ['BBB', 'AAA']);
  assert.match(assessments[0].text, /FLOW 91\.0/);
  assert.match(assessments[0].text, /BUY/);
});

test('exclusions surface no-chase, exit and overly wide stops without duplicating a symbol', () => {
  const rows = [
    { ...baseRow, symbol: 'AAA', decision: 'DO NOT CHASE' },
    { ...baseRow, symbol: 'BBB', decision: 'EXIT', stop_distance_pct: 12 },
    { ...baseRow, symbol: 'CCC', decision: 'WATCH', stop_distance_pct: 10 },
  ];
  const exclusions = buildExclusions(rows);
  assert.deepEqual(exclusions.map((item) => item.symbol), ['AAA', 'BBB', 'CCC']);
  assert.match(exclusions[0].reason, /DO NOT CHASE/);
  assert.match(exclusions[1].reason, /EXIT/);
  assert.match(exclusions[2].reason, /10\.0%/);
});

test('general news is de-duplicated and keeps linked, newest items first', () => {
  const items = [
    { title: 'Tin A', url: 'https://example.com/a', source: 'A', published_at: '2026-09-03T08:00:00Z' },
    { title: 'Tin A bản sao', url: 'https://example.com/a', source: 'A2', published_at: '2026-09-03T09:00:00Z' },
    { title: 'Tin B', url: null, source: 'B', published_at: '2026-09-03T10:00:00Z' },
    { title: 'Tin C', url: 'https://example.com/c', source: 'C', published_at: '2026-09-03T11:00:00Z' },
  ];
  const result = dedupeNews(items, 3);
  assert.equal(result.length, 3);
  assert.equal(result[0].title, 'Tin C');
  assert.equal(result.filter((item) => item.url === 'https://example.com/a').length, 1);
});
