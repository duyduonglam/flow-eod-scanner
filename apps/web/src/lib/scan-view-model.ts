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

export const decisionValues = ['BUY', 'TEST BUY', 'BUY RETEST', 'WATCH', 'DO NOT CHASE', 'HOLD', 'TRIM', 'EXIT'] as const;
export type DecisionFilter = (typeof decisionValues)[number];

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

export function normalizeDecisionFilter(query: string | null | undefined): DecisionFilter | null {
  const normalized = (query ?? '').trim().toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return decisionValues.find((decision) => decision === normalized) ?? null;
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
}

const verifiedHeadlineUrlOverrides = new Map(
  [
    [
      'Một cổ phiếu ngân hàng tăng kịch trần 2 phiên liên tiếp',
      'https://antt.nguoiduatin.vn/mot-co-phieu-ngan-hang-tang-kich-tran-2-phien-lien-tiep-20526090314140239.htm',
    ],
    [
      'PVP: Thông báo và Quyết định về việc bổ nhiệm chức vụ Phó Giám đốc',
      'https://web.stockbiz.vn/News/2026/9/7/1904469/pvp-thong-bao-va-quyet-dinh-ve-viec-bo-nhiem-chuc-vu-pho-giam-doc.aspx',
    ],
    [
      'PVT: Thông báo thay đổi nhân sự - TV HĐQT kiêm TGĐ (kèm Nghị quyết)',
      'https://web.stockbiz.vn/News/2026/9/3/1903591/pvt-thong-bao-thay-doi-nhan-su-tv-hdqt-kiem-tgd-kem-nghi-quyet.aspx',
    ],
    [
      'HHP: Nhận công văn của UBCKNN về tài liệu báo cáo kết quả phát hành CP để trả cổ tức',
      'https://web.stockbiz.vn/News/2026/9/4/1904083/hhp-nhan-duoc-cong-van-cua-ubcknn-ve-tai-lieu-bao-cao-ket-qua-phat-hanh-cp-de-tra-co-tuc.aspx',
    ],
    [
      'PVS: Ngày đăng ký cuối cùng trả cổ tức bằng cổ phiếu cho cổ đông hiện hữu',
      'https://web.stockbiz.vn/News/2026/9/3/1903698/pvs-ngay-dang-ky-cuoi-cung-tra-co-tuc-bang-co-phieu-cho-co-dong-hien-huu.aspx',
    ],
    [
      'AAS: Báo cáo tài chính bán niên năm 2026',
      'https://web.stockbiz.vn/News/2026/8/19/1901593/aas-bao-cao-tai-chinh-ban-nien-nam-2026.aspx',
    ],
    [
      'SJS: ‘Chuyện lạ’ nhà SJ Group: ‘Còng lưng’ trả lãi vay vẫn tạm ứng cho nhân viên hàng trăm tỷ',
      'https://vietnamfinance.vn/chuyen-la-nha-sj-group-cong-lung-tra-lai-vay-van-tam-ung-cho-nhan-vien-hang-tram-ty-d150096.html',
    ],
    [
      'BSR: CBTT giao dịch với người có liên quan PVOIL',
      'https://web.stockbiz.vn/News/2026/9/8/1904687/bsr-cbtt-giao-dich-voi-nguoi-co-lien-quan-pvoil.aspx',
    ],
    [
      'GAS: Nghị quyết HĐQT số 87 ngày 27/08/2026',
      'https://web.stockbiz.vn/News/2026/9/3/1903809/gas-nghi-quyet-hdqt-so-87-ngay-27-08-2026.aspx',
    ],
  ].map(([title, url]) => [normalizeTitle(title), url]),
);

const trustedNewsSources = [
  'fireant',
  'cafef',
  'vietstock',
  'ssi',
  'fiintrade',
  'vndirect',
  'hsc',
  'bsc',
  'ndh',
  'vneconomy',
  'vietnamfinance',
  'vietnambiz',
  'tinnhanhchungkhoan',
  'dtck',
  'bao dau tu',
  'baodautu',
];

function trustedSourceRank(source: string): number {
  const normalized = normalizeTitle(source)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D');
  const index = trustedNewsSources.findIndex((trusted) => normalized.includes(trusted));
  return index === -1 ? trustedNewsSources.length : index;
}

function publishedAtValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newsPriority<T extends NewsSummaryItem>(a: T, b: T): number {
  const sourceRank = trustedSourceRank(a.source) - trustedSourceRank(b.source);
  if (sourceRank !== 0) return sourceRank;
  const byDate = publishedAtValue(b.published_at) - publishedAtValue(a.published_at);
  if (byDate !== 0) return byDate;
  return Number(Boolean(b.url)) - Number(Boolean(a.url));
}

export function verifiedNewsUrl(url: string | null | undefined, title: string): string | null {
  const verifiedOverride = verifiedHeadlineUrlOverrides.get(normalizeTitle(title));
  if (verifiedOverride) return verifiedOverride;
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const meaningfulPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (!meaningfulPath && !parsed.search) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function pickHeadlineNews<T extends NewsSummaryItem>(headline: string | null | undefined, items: T[]): T | null {
  if (!items.length) return null;
  const sorted = items.toSorted(newsPriority);
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
  const sorted = items.toSorted(newsPriority);
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
