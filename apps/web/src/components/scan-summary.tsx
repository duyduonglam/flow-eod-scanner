import { buildExclusions, buildQuickAssessments } from '@/lib/scan-view-model';
import type { MarketRegime, NewsItem, ScanRow } from '@/lib/types';

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

type Props = {
  rows: ScanRow[];
  news: NewsItem[];
  marketDate?: string | null;
  marketRegime?: MarketRegime | null;
};

export function ScanSummary({ rows, news, marketDate, marketRegime }: Props) {
  const assessments = buildQuickAssessments(rows, 4);
  const exclusions = buildExclusions(rows, 5);

  if (!marketRegime?.quick_assessment && !marketRegime?.exclusion_notes && !assessments.length && !exclusions.length && !news.length) return null;

  return (
    <section className="summarySection" aria-label="Tổng kết phiên FLOW">
      {marketRegime?.quick_assessment || assessments.length ? (
        <article className="summaryPanel assessmentPanel">
          <div className="summaryHeading">
            <div>
              <div className="sectionLabel">Đánh giá nhanh mã nổi bật</div>
              <div className="summaryHint">Nhận xét được lưu riêng theo phiên dữ liệu đang chọn.</div>
            </div>
            {marketDate ? <span className="summaryDate">{marketDate}</span> : null}
          </div>
          {marketRegime?.quick_assessment ? (
            <p className="summaryNarrative">{marketRegime.quick_assessment}</p>
          ) : (
            <div className="assessmentList">
              {assessments.map((item) => (
                <div className="assessmentItem" key={`${item.symbol}-${item.market_date}`}>
                  <div className="assessmentSymbol">{item.symbol}</div>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {marketRegime?.exclusion_notes || exclusions.length ? (
        <article className="summaryPanel exclusionPanel">
          <div className="summaryHeading">
            <div className="sectionLabel">Loại trừ đáng chú ý</div>
            {marketDate ? <span className="summaryDate">{marketDate}</span> : null}
          </div>
          {marketRegime?.exclusion_notes ? (
            <p className="summaryNarrative">{marketRegime.exclusion_notes}</p>
          ) : (
            <div className="assessmentList">
              {exclusions.map((item) => (
                <div className="assessmentItem" key={`${item.symbol}-${item.market_date}`}>
                  <div className="assessmentSymbol exclusionSymbol">{item.symbol}</div>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {news.length ? (
        <article className="summaryPanel newsPanel">
          <div className="sectionLabel">Tin tức nổi bật chung</div>
          <div className="generalNewsList">
            {news.map((item) => {
              const meta = [item.symbol, item.source, publishedLabel(item.published_at)].filter(Boolean).join(' · ');
              return (
                <div className="generalNewsItem" key={item.url ?? `${item.title}-${item.published_at ?? ''}`}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title} <span aria-hidden="true">↗</span>
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
