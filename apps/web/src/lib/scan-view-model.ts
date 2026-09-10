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
  banker_ma?: number | null;
  hot_money?: number | null;
  hot_money_ma?: number | null;
  volume_buzz?: number | null;
  ud_volume_ratio?: number | null;
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

function stripVietnameseMarks(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function articleMatchTokens(value: string): Set<string> {
  const normalized = stripVietnameseMarks(value)
    .toLocaleLowerCase('vi-VN')
    .replace(/^[a-z0-9]{2,5}\s*:\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const stopWords = new Set(['ve', 'viec', 'va', 'cua', 'cho', 'co', 'phieu', 'nam', 'ngay']);
  return new Set(normalized.split(/\s+/).filter((token) => token.length > 1 && !stopWords.has(token)));
}

function isCloseTitleMatch(sourceTitle: string, wantedTitle: string): boolean {
  const source = articleMatchTokens(sourceTitle);
  const wanted = articleMatchTokens(wantedTitle);
  if (!source.size || !wanted.size) return false;
  const hits = [...wanted].filter((token) => source.has(token)).length;
  return hits / wanted.size >= 0.62;
}

export function findNewsUrlInHtml(html: string, title: string, baseUrl: string): string | null {
  const anchorPattern = /<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = decodeHtmlEntities(match[2] ?? '').trim();
    const rawAnchor = match[0] ?? '';
    const titleAttr = rawAnchor.match(/\btitle=(['"])(.*?)\1/i)?.[2] ?? '';
    const text = decodeHtmlEntities(`${titleAttr} ${match[3] ?? ''}`.replace(/<[^>]+>/g, ' '));
    if (!href || !isCloseTitleMatch(text, title)) continue;
    try {
      const parsed = new URL(href, baseUrl);
      parsed.search = '';
      return parsed.href;
    } catch {
      continue;
    }
  }
  return null;
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
      'Công ty chứng khoán khuyến nghị theo dõi PVT, NLG và ACB',
      'https://bnews.vn/cong-ty-chung-khoan-khuyen-nghi-mua-pvt-nlg-va-acb/436030.html',
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
      'SJS: Bài viết về áp lực lãi vay và tạm ứng nội bộ; cần xác minh thêm',
      'https://vietnamfinance.vn/chuyen-la-nha-sj-group-cong-lung-tra-lai-vay-van-tam-ung-cho-nhan-vien-hang-tram-ty-d150096.html',
    ],
    [
      'Bài viết về áp lực lãi vay và tạm ứng nội bộ; cần xác minh thêm',
      'https://vietnamfinance.vn/chuyen-la-nha-sj-group-cong-lung-tra-lai-vay-van-tam-ung-cho-nhan-vien-hang-tram-ty-d150096.html',
    ],
    [
      'Hạt nhựa biến động, biên lợi nhuận doanh nghiệp ống nhựa gia tăng',
      'https://nhadautu.vn/hat-nhua-bien-dong-bien-loi-nhuan-doanh-nghiep-ong-nhua-gia-tang-d107355.html',
    ],
    [
      'STB: Sacombank tiếp tục vượt đỉnh lịch sử',
      'https://stockbiz.vn/tin-tuc/stb-sacombank-tiep-tuc-vuot-dinh-lich-su/41733338',
    ],
    [
      'Sacombank tiếp tục vượt đỉnh lịch sử',
      'https://stockbiz.vn/tin-tuc/stb-sacombank-tiep-tuc-vuot-dinh-lich-su/41733338',
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
  const exact = sorted.find((item) => normalizeTitle(item.title) === wanted);
  if (exact) return exact;

  const wantedTokens = articleMatchTokens(headline ?? '');
  if (!wantedTokens.size) return sorted.length === 1 ? sorted[0] : null;

  const scored = sorted
    .map((item, index) => {
      const candidateTokens = articleMatchTokens(item.title);
      const hits = [...wantedTokens].filter((token) => candidateTokens.has(token)).length;
      const coverage = hits / wantedTokens.size;
      const precision = candidateTokens.size ? hits / candidateTokens.size : 0;
      return { item, index, score: coverage * 0.75 + precision * 0.25 };
    })
    .filter((entry) => entry.score >= 0.58)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return scored[0]?.item ?? (sorted.length === 1 ? sorted[0] : null);
}

export function buildQuickAssessments(rows: SummaryRow[], limit = 4): QuickAssessment[] {
  if (rows.length >= 4) {
    const ranked = rows.toSorted((a, b) => (b.flow_score ?? -1) - (a.flow_score ?? -1));
    const strongest = ranked.filter((row) => /breakout/i.test(row.main_signal)).slice(0, 3);
    const pullback = [
      ...strongest,
      ...ranked.filter(
        (row) =>
          !strongest.some((item) => item.symbol === row.symbol) &&
          row.rs_rating != null &&
          row.rs_rating >= 16 &&
          (row.volume_buzz ?? 0) >= 0,
      ),
    ].slice(0, 4);
    const noChase = ranked.filter((row) => row.decision === 'DO NOT CHASE');
    const moneyWatch = ranked.filter(
      (row) =>
        row.flow_score != null &&
        row.flow_score < 75 &&
        row.banker != null &&
        row.banker_ma != null &&
        row.banker > row.banker_ma &&
        (row.volume_buzz == null || row.volume_buzz > -50),
    );
    const label = (name: string, symbols: SummaryRow[], detail: string): QuickAssessment => ({
      symbol: name,
      market_date: rows[0]?.market_date ?? '',
      score: null,
      decision: '',
      text: `${symbols.map((row) => row.symbol).join(', ')}${detail}`,
    });

    return [
      label('Mạnh nhất', strongest, '; đều có breakout và volume xác nhận tốt hơn nhóm còn lại.'),
      label('Chờ pullback', pullback, '.'),
      label('Không mua đuổi', noChase, ' do giá đã cao hoặc Hot Money quá nóng.'),
      label('Theo dõi dòng tiền', moneyWatch, '.'),
    ].filter((item) => item.text.trim().length > 1);
  }

  return rows
    .toSorted((a, b) => (b.flow_score ?? -1) - (a.flow_score ?? -1))
    .slice(0, Math.max(0, limit))
    .map((row) => {
      const facts = [
        row.flow_score == null ? null : `FLOW ${row.flow_score.toFixed(1)}`,
        row.rs_rating == null ? null : `RS ${row.rs_rating.toFixed(1)}`,
        row.banker == null ? null : `Banker ${row.banker.toFixed(1)}%`,
        row.banker != null && row.banker_ma != null ? `Banker ${row.banker.toFixed(1)} vs MA10 ${row.banker_ma.toFixed(1)}` : null,
        row.volume_buzz == null ? null : `volume ${((100 + row.volume_buzz) / 100).toFixed(2)}x`,
        row.hot_money == null ? null : `Hot Money ${row.hot_money.toFixed(0)}`,
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

  const ranked = rows.toSorted((a, b) => (b.flow_score ?? -1) - (a.flow_score ?? -1));
  const strongest = new Set(
    ranked
      .filter((row) => /breakout/i.test(row.main_signal))
      .slice(0, 3)
      .map((row) => row.symbol),
  );

  for (const row of rows) {
    if (row.volume_buzz != null && row.volume_buzz < -50) {
      add(row, `Volume chỉ ${(Math.max(0, 1 + row.volume_buzz / 100)).toFixed(2)}x bình quân; thanh khoản chưa xác nhận.`);
      if (notes.length >= limit) return notes;
    }
  }

  for (const row of rows) {
    if (row.banker != null && row.banker_ma != null && row.banker < row.banker_ma && !strongest.has(row.symbol)) {
      add(row, `Banker ${row.banker.toFixed(1)}% nằm dưới MA10 ${row.banker_ma.toFixed(1)}%; dòng tiền lớn chưa xác nhận đầy đủ.`);
    }
  }

  for (const row of ranked) {
    if (row.hot_money != null && row.hot_money >= 95 && !strongest.has(row.symbol) && row.volume_buzz != null && row.volume_buzz > -50) {
      add(row, `Hot Money ở mức ${row.hot_money.toFixed(0)}; cần thận trọng với trạng thái quá nóng.`);
    }
  }

  if (notes.length && rows.length >= 4) return notes.slice(0, limit);

  for (const row of rows) {
    if (row.volume_buzz != null && row.volume_buzz < -50) add(row, `Volume chỉ ${(Math.max(0, 1 + row.volume_buzz / 100)).toFixed(2)}x bình quân; thanh khoản chưa xác nhận.`);
    else if (row.banker != null && row.banker_ma != null && row.banker < row.banker_ma) add(row, `Banker ${row.banker.toFixed(1)}% nằm dưới MA10 ${row.banker_ma.toFixed(1)}%; dòng tiền lớn chưa xác nhận đầy đủ.`);
    else if (row.hot_money != null && row.hot_money >= 95) add(row, `Hot Money ở mức ${row.hot_money.toFixed(0)}; cần thận trọng với trạng thái quá nóng.`);
    else if (row.decision === 'DO NOT CHASE') add(row, 'Đã vào trạng thái DO NOT CHASE; không mở vị thế mới khi giá/điểm vào không còn thuận lợi.');
    else if (row.decision === 'EXIT') add(row, 'Tín hiệu đã suy yếu đến mức EXIT; ưu tiên bảo toàn vốn thay vì bắt đáy.');
    else if (row.stop_distance_pct != null && row.stop_distance_pct > 8) add(row, `Stop Distance ${row.stop_distance_pct.toFixed(1)}% quá rộng so với vùng quản trị rủi ro ưu tiên.`);
    else if (row.flow_score != null && row.flow_score < 55) add(row, `FLOW score ${row.flow_score.toFixed(1)} dưới vùng ưu tiên của watchlist.`);
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
