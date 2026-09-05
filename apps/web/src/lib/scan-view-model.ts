export type SummaryRow = {
  symbol: string;
  market_date: string;
  flow_score: number | null;
  main_signal: string;
  decision: string;
  invalidation: string;
  stop_distance_pct: number | null;
  rs_rating?: number | null;
  banker?: number | null;
};

export type NewsSummaryItem = {
  title: string;
  url: string | null;
  source: string;
  published_at: string | null;
};

export type QuickAssessment = {
  symbol: string;
  market_date: string;
  score: number | null;
  decision: string;
  text: string;
};

export type ExclusionNote = {
  symbol: string;
  market_date: string;
  reason: string;
};

export function normalizeTickerQuery(query: string | null | undefined): string {
  return (query ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
}

function publishedAtValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickHeadlineNews<T extends NewsSummaryItem>(headline: string | null | undefined, items: T[]): T | null {
  if (!items.length) return null;
  const sorted = items.toSorted((a, b) => publishedAtValue(b.published_at) - publishedAtValue(a.published_at));
  const wanted = normalizeTitle(headline ?? '');
  if (!wanted) return sorted[0] ?? null;
  return sorted.find((item) => normalizeTitle(item.title) === wanted) ?? null;
}

export function buildQuickAssessments(rows: SummaryRow[], limit = 4): QuickAssessment[] {
  return rows
    .toSorted((a, b) => (b.flow_score ?? -1) - (a.flow_score ?? -1))
    .slice(0, Math.max(0, limit))
    .map((row) => {
      const facts = [
        row.flow_score == null ? null : `FLOW ${row.flow_score.toFixed(1)}`,
        row.rs_rating == null ? null : `RS ${row.rs_rating.toFixed(1)}`,
        row.banker == null ? null : `Banker ${row.banker.toFixed(1)}%`,
        row.main_signal.trim() || null,
      ].filter((item): item is string => Boolean(item));
      return {
        symbol: row.symbol,
        market_date: row.market_date,
        score: row.flow_score,
        decision: row.decision,
        text: `${facts.join(' · ')} → ${row.decision}`,
      };
    });
}

export function buildExclusions(rows: SummaryRow[], limit = 5): ExclusionNote[] {
  const notes: ExclusionNote[] = [];
  const seen = new Set<string>();
  const add = (row: SummaryRow, reason: string) => {
    const key = `${row.market_date}:${row.symbol}`;
    if (seen.has(key) || notes.length >= limit) return;
    seen.add(key);
    notes.push({ symbol: row.symbol, market_date: row.market_date, reason });
  };

  for (const row of rows) {
    if (row.decision === 'DO NOT CHASE') {
      add(row, 'Đã vào trạng thái DO NOT CHASE; không mở vị thế mới khi giá/điểm vào không còn thuận lợi.');
      continue;
    }
    if (row.decision === 'EXIT') {
      add(row, 'Tín hiệu đã suy yếu đến mức EXIT; ưu tiên bảo toàn vốn thay vì bắt đáy.');
      continue;
    }
    if (row.stop_distance_pct != null && row.stop_distance_pct > 8) {
      add(row, `Stop Distance ${row.stop_distance_pct.toFixed(1)}% quá rộng so với vùng quản trị rủi ro ưu tiên.`);
      continue;
    }
    if (row.flow_score != null && row.flow_score < 55) {
      add(row, `FLOW score ${row.flow_score.toFixed(1)} dưới vùng ưu tiên của watchlist.`);
    }
  }

  return notes;
}

export function dedupeNews<T extends NewsSummaryItem>(items: T[], limit = 5): T[] {
  const sorted = items.toSorted((a, b) => {
    const byDate = publishedAtValue(b.published_at) - publishedAtValue(a.published_at);
    if (byDate !== 0) return byDate;
    return Number(Boolean(b.url)) - Number(Boolean(a.url));
  });
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of sorted) {
    const key = item.url?.trim() || normalizeTitle(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
