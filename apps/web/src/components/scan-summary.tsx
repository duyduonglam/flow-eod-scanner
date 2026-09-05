import { buildExclusions, buildQuickAssessments } from '@/lib/scan-view-model';
import type { NewsItem, ScanRow } from '@/lib/types';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function publishedLabel(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dateTimeFormatter.format(parsed);
}

export function ScanSummary({ rows, news, marketDate }: { rows: ScanRow[]; news: NewsItem[]; marketDate?: string | null }) {
  const assessments = buildQuickAssessments(rows, 4);
  const exclusions = buildExclusions(rows, 5);

  if (!assessments.length && !exclusions.length && !news.length) return null;

  return (
    <section className="summarySection" aria-label="Tổng kết phiên FLOW">
      {assessments.length ? (
        <article className="summaryPanel">
          <div className="summaryHeading">
            <div>
              <div className="sectionLabel">Đánh giá nhanh các mã nổi bật</div>
              <div className="summaryHint">Ưu tiên theo FLOW score, RS, Banker và tín hiệu chính của phiên.</div>
            </div>
            {marketDate ? <span className="summaryDate">{marketDate}</span> : null}
          </div>
          <div className="assessmentList">
            {assessments.map((item) => (
              <div className="assessmentItem" key={`${item.symbol}-${item.market_date}`}>
                <div className="assessmentSymbol">{item.symbol}</div>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {exclusions.length ? (
        <article className="summaryPanel exclusionPanel">
          <div className="sectionLabel">Loại trừ đáng chú ý</div>
          <div className="summaryHint">Chỉ hiển thị khi có lý do rủi ro rõ ràng từ chính kết quả scan.</div>
          <div className="assessmentList">
            {exclusions.map((item) => (
              <div className="assessmentItem" key={`${item.symbol}-${item.market_date}`}>
                <div className="assessmentSymbol exclusionSymbol">{item.symbol}</div>
                <p>{item.reason}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {news.length ? (
        <article className="summaryPanel newsPanel">
          <div className="sectionLabel">Tin tức nổi bật chung</div>
          <div className="summaryHint">Tin được khóa theo đúng market_date; bấm tiêu đề để mở nguồn và tự xác minh.</div>
          <div className="generalNewsList">
            {news.map((item) => {
              const meta = [item.symbol, item.source, publishedLabel(item.published_at)].filter(Boolean).join(' · ');
              return (
                <div className="generalNewsItem" key={item.url ?? `${item.title}-${item.published_at ?? ''}`}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  {meta ? <span>{meta}</span> : null}
                </div>
              );
            })}
          </div>
        </article>
      ) : null}
    </section>
  );
}
