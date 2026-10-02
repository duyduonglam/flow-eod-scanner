import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSessionNews } from './news-fallback.ts';
import type { NewsItem } from './types.ts';

function news(title: string, market_date: string, published_at: string | null): NewsItem {
  return {
    title,
    url: null,
    source: 'FireAnt',
    published_at,
    market_date,
    symbol: null,
    category: null,
    sentiment: 'NEUTRAL',
  };
}

test('keeps the latest saved news when the selected session has no news', () => {
  const result = mergeSessionNews([], [news('Tin cũ', '2026-10-01', '2026-10-01T16:00:00+07:00')]);

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Tin cũ');
});

test('puts new-session news before retained older news', () => {
  const result = mergeSessionNews(
    [news('Tin mới', '2026-10-02', '2026-10-02T16:00:00+07:00')],
    [news('Tin cũ', '2026-10-01', '2026-10-01T16:00:00+07:00')],
  );

  assert.deepEqual(result.map((item) => item.title), ['Tin mới', 'Tin cũ']);
});
