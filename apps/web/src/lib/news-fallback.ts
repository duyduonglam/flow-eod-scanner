import type { NewsItem } from './types.ts';

function recency(item: NewsItem): number {
  const published = item.published_at ? Date.parse(item.published_at) : Number.NaN;
  if (Number.isFinite(published)) return published;
  const session = Date.parse(`${item.market_date}T23:59:59+07:00`);
  return Number.isFinite(session) ? session : 0;
}

function identity(item: NewsItem): string {
  return [item.title, item.url ?? '', item.symbol ?? ''].join('|');
}

export function mergeSessionNews(current: NewsItem[], fallback: NewsItem[], limit = 5): NewsItem[] {
  const seen = new Set<string>();
  return [...current, ...fallback]
    .sort((left, right) => recency(right) - recency(left))
    .filter((item) => {
      const key = identity(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
