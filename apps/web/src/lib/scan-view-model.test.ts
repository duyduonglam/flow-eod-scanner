import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExclusions,
  buildQuickAssessments,
  dedupeNews,
  findNewsUrlInHtml,
  normalizeTickerQuery,
  normalizeDecisionFilter,
  pickHeadlineNews,
  verifiedNewsUrl,
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

test('normalizes decision filters from URL params', () => {
  assert.equal(normalizeDecisionFilter(' buy '), 'BUY');
  assert.equal(normalizeDecisionFilter('buy-retest'), 'BUY RETEST');
  assert.equal(normalizeDecisionFilter('do_not_chase'), 'DO NOT CHASE');
  assert.equal(normalizeDecisionFilter('random'), null);
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

test('keeps safe news urls even when the route is opaque', () => {
  assert.equal(
    verifiedNewsUrl('https://example.com/co-phieu-gmd-vuot-dinh-thanh-khoan-tang', 'Cổ phiếu GMD vượt đỉnh, thanh khoản tăng'),
    'https://example.com/co-phieu-gmd-vuot-dinh-thanh-khoan-tang',
  );
  assert.equal(
    verifiedNewsUrl(
      'https://example.com/gemadept-mo-rong-cang-nam-dinh-vu-giai-doan-2',
      'Gemadept mở rộng cảng Nam Đình Vũ giai đoạn 2',
    ),
    'https://example.com/gemadept-mo-rong-cang-nam-dinh-vu-giai-doan-2',
  );
  assert.equal(
    verifiedNewsUrl('https://example.com/news/20260904/123456', 'Gemadept mở rộng cảng Nam Đình Vũ giai đoạn 2'),
    'https://example.com/news/20260904/123456',
  );
  assert.equal(
    verifiedNewsUrl('https://antt.vn/', 'Một cổ phiếu ngân hàng tăng kịch trần 2 phiên liên tiếp'),
    'https://antt.nguoiduatin.vn/mot-co-phieu-ngan-hang-tang-kich-tran-2-phien-lien-tiep-20526090314140239.htm',
  );
  assert.equal(
    verifiedNewsUrl('https://vietnamfinance.vn/', 'Một bài viết chưa xác minh'),
    null,
  );
  assert.equal(
    verifiedNewsUrl('javascript:alert(1)', 'GMD mở rộng cảng Nam Đình Vũ'),
    null,
  );
});

test('finds a matching article url from source html', () => {
  const html = `
    <a class='docnhanhTitle'
      href="/du-lieu/HDB-2972867/hdb-nghi-quyet-hdqt-ve-viec-phat-hanh-va-chao-ban-trai-phieu-hdbank-ra-thi-truong-quoc-te-nam-2026.chn?utm_source=du-lieu"
      title="HDB: Nghị quyết HĐQT về việc ph&#225;t h&#224;nh v&#224; ch&#224;o b&#225;n tr&#225;i phiếu HDBank ra thị trường quốc tế năm 2026">
      HDB: Nghị quyết HĐQT về việc phát hành và chào bán trái phiếu HDBank ra thị trường quốc tế năm 2026
    </a>
  `;

  assert.equal(
    findNewsUrlInHtml(
      html,
      'HDB: Nghị quyết HĐQT về phát hành và chào bán trái phiếu quốc tế năm 2026',
      'https://cafef.vn/du-lieu/tin-doanh-nghiep/hdb/event.chn',
    ),
    'https://cafef.vn/du-lieu/HDB-2972867/hdb-nghi-quyet-hdqt-ve-viec-phat-hanh-va-chao-ban-trai-phieu-hdbank-ra-thi-truong-quoc-te-nam-2026.chn',
  );
});

test('prioritizes reputable news sources for related market news', () => {
  const items = [
    { title: 'Tin diễn đàn mới hơn', url: 'https://example.com/forum', source: 'Blog cá nhân', published_at: '2026-09-03T10:00:00Z' },
    { title: 'Tin CafeF cũ hơn', url: 'https://cafef.vn/a', source: 'CafeF', published_at: '2026-09-03T08:00:00Z' },
    { title: 'Tin Vietstock', url: 'https://vietstock.vn/b', source: 'Vietstock', published_at: '2026-09-03T09:00:00Z' },
  ];

  assert.equal(pickHeadlineNews(null, items)?.source, 'CafeF');
  assert.deepEqual(dedupeNews(items, 3).map((item) => item.source), ['CafeF', 'Vietstock', 'Blog cá nhân']);
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
