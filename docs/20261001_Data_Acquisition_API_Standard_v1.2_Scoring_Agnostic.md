---
title: "FLOW Vietnam — Data Acquisition & API Standard"
version: "1.2"
status: "CANONICAL DATA CONTRACT"
effective_date: "2026-10-01"
language: "vi"
architecture: "SCORING-AGNOSTIC"
intended_for:
  - ChatGPT
  - Codex
  - Claude
  - coding agents
  - scheduled EOD agents
scope:
  - FLOW Vietnam Market Intelligence
  - FLOW Daily Scan
  - VNStock dashboards
  - historical backfill
  - EOD data acquisition
  - intraday snapshots
  - data validation
  - source provenance
  - fallback/conflict resolution
scoring_contract:
  ownership: "EXTERNAL"
  formula: null
  thresholds: null
  publication_buckets: null
supersedes:
  - "FLOW_Data_Acquisition_API_Standard_v1.1"
---

# FLOW Vietnam — Data Acquisition & API Standard v1.2

> **CANONICAL DATA CONTRACT — SCORING AGNOSTIC**
>
> File này chỉ quyết định:
> - lấy dữ liệu ở đâu;
> - chuẩn hóa dữ liệu như thế nào;
> - kiểm tra dữ liệu ra sao;
> - fallback/cross-check theo domain nào;
> - provenance, timestamp, conflict, snapshot và backfill.
>
> File này **không sở hữu công thức FLOW, trọng số, ngưỡng điểm, Quality/Watch, Risk score, Stop score hoặc bất kỳ business scoring formula nào**.
>
> Khi công thức FLOW thay đổi V5 → V6 → V7, **không sửa data source/pipeline chỉ vì scoring thay đổi**. Scoring engine phải đọc raw/canonical data từ contract này và áp dụng một `scoring_contract` bên ngoài.

---

# 0. Mục tiêu kiến trúc v1.2

v1.1 còn trộn data acquisition với scoring/business rules cũ. v1.2 tách thành bốn lớp độc lập:

```text
SOURCE ADAPTERS
    ↓
CANONICAL DATA + DATA QUALITY
    ↓
FEATURE / DERIVED DATA
    ↓
EXTERNAL SCORING / POSITION / UI
```

## 0.1. Quy tắc tách lớp

### Data Acquisition sở hữu

- provider adapters;
- authentication;
- pagination;
- OHLCV;
- universe;
- benchmark;
- fundamentals;
- news/event raw data;
- corporate actions;
- order/flow data;
- sector data;
- normalization;
- unit conversion;
- data quality;
- stale detection;
- provenance;
- fallback/conflict;
- point-in-time constraints;
- cache/staging/snapshot.

### Scoring engine bên ngoài sở hữu

- formula version;
- component weights;
- thresholds;
- strategy eligibility;
- liquidity threshold;
- minimum history required by formula;
- RS population definition;
- News/KQKD scoring;
- Quality/Watch thresholds;
- Entry/Stop/R logic nếu formula/strategy thay đổi;
- Position Management;
- Anti-chase.

**Không hard-code scoring rule vào file này.**

---

# 1. Interface giữa Data Layer và Scoring Layer

Scoring engine gửi một `feature_requirement_profile` vào data layer.

Ví dụ:

```yaml
feature_requirement_profile:
  consumer: FLOW
  formula_version: "external"
  price_frequency: "1D"
  benchmark: "VNINDEX"
  required_history_bars: 260
  requested_features:
    - ohlcv
    - benchmark_ohlcv
    - corporate_actions
    - financials
    - news
  requested_derived_metrics:
    - avg_trade_value_20_vnd
    - returns
    - moving_averages
```

Data layer:
1. không biết trọng số score;
2. không biết ngưỡng Quality/Watch;
3. chỉ đảm bảo dữ liệu đủ cho profile;
4. trả `data_readiness` và raw/derived values.

Nếu công thức mới cần 500 bars thay vì 260:
- sửa `feature_requirement_profile`;
- không sửa source hierarchy;
- không sửa canonical schema;
- không đổi provider adapters nếu provider vẫn cấp được dữ liệu.

---

# 2. Hai loại eligibility phải tách biệt

## 2.1. Data-quality eligibility

Data layer được phép kết luận:

```text
DATA_READY
DATA_INCOMPLETE
STALE
INVALID_OHLC
DUPLICATE_UNRESOLVED
CORPORATE_ACTION_PENDING
NO_VALID_SOURCE
CONFLICT
```

Ví dụ:

```yaml
data_quality:
  status: DATA_READY
  valid_bars: 632
  latest_trading_date: 2026-10-01
  source: FireAnt
```

## 2.2. Strategy eligibility

Do scoring/strategy layer quyết định, ví dụ:
- minimum history;
- liquidity threshold;
- exchange filter;
- score threshold;
- market-cap threshold;
- price threshold;
- sector restrictions.

**Data layer chỉ cung cấp các biến cần thiết, không tự áp chiến lược.**

Ví dụ data layer tính:

```text
avg_trade_value_20_vnd = 12_345_678_901
```

nhưng không tự kết luận pass/fail nếu scoring contract chưa yêu cầu.

---

# 3. Quy tắc bất biến

## 3.1. Không bịa dữ liệu

Không được tự tạo:
- giá;
- OHLCV;
- VNINDEX;
- fundamentals;
- news;
- corporate actions;
- order flow;
- timestamp;
- source;
- derived metric không có input hợp lệ.

Nếu thiếu:

```text
null
N/A
DATA_PENDING
PARTIAL
CONFLICT
```

## 3.2. Không look-ahead

Khi backfill ngày `T`:
- price date <= T;
- news publication time <= T;
- financial publication time <= T;
- corporate-action information chỉ dùng theo chế độ backtest point-in-time nếu thực sự public tại T.

## 3.3. Một ticker lỗi không làm hỏng toàn run

Ticker-level lỗi:

```yaml
symbol: ABC
data_quality_status: NO_VALID_SOURCE
strategy_score: null
```

Pipeline vẫn tiếp tục.

Chỉ lỗi hệ thống/benchmark/full coverage mới block `VERIFIED`.

## 3.4. VERIFIED snapshot bất biến

Không ghi đè snapshot VERIFIED một cách âm thầm.

Correction phải có:
- revision id;
- reason;
- old snapshot preserved;
- corrected_at;
- provenance.

---

# 4. Source Registry v1.2

Không tồn tại một thứ tự "nguồn A luôn đáng tin hơn nguồn B" cho mọi domain.

**Priority phải theo loại dữ liệu.**

## 4.1. Capability matrix

| Provider | Universe | EOD OHLCV | Intraday/Snapshot | Benchmark | Financials | News | Corp Action | Order/Active Flow | Sector Flow | Foreign Flow | Role |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FireAnt | ✅ | ✅ Primary | △ | ✅ Primary | ✅/△ | ✅ | ✅ | △ | △ | △ | Core primary |
| vnstock VCI | ✅/△ | ✅ Fallback | △ | ✅ Fallback | ✅ | △ | △ | — | — | — | OHLCV fallback |
| vnstock KBS | ✅/△ | ✅ Fallback | △ | ✅ Fallback | ✅ | △ | △ | — | — | — | OHLCV/financial fallback |
| SSI iBoard | ✅ Cross-check | △ snapshot | ✅ Primary intraday | △ | — | — | — | ✅ depth/snapshot | — | △ | Intraday/reference |
| Vietcap IQ | △ | △ current | △ | — | ✅ enrichment | — | — | — | — | — | Screener/enrichment |
| Cophieu68 | ✅ Cross-check | ✅ Secondary bulk | △ | △ | ✅ | △ | △ | — | — | ✅ | Bulk fallback/reference |
| 24HMoney | △ | △ | ✅/△ | ✅/△ | ✅ | △ | △ | ✅ | ✅ | ✅ | Flow/enrichment |
| SieuCoPhieu | — | — | △ board | — | — | △ articles | — | — | ✅ Primary sector-flow | — | Sector enrichment |
| Vietstock Finance | ✅/△ | ✅/△ | △ | △ | ✅ | △ | △ | ✅ order stats | ✅/△ | △ | On-demand reference |
| CafeF | — | — | — | — | ✅ Historical | ✅/△ | ✅/△ | — | — | — | Financial/news fallback |
| Official exchange / company IR | △ | — | — | — | ✅ verification | ✅ | ✅ Authoritative | — | — | — | Event/fundamental authority |
| VN Market News | — | — | — | △ | — | ✅ Aggregator | △ | — | △ | — | News aggregation |

Legend:
- ✅ preferred/usable
- △ supplemental/cross-check
- — not intended

---

# 5. Domain-specific source priority

## 5.1. Universe

```text
FireAnt /instruments
    ↓ cross-check
SSI iBoard stock-info
    ↓ cross-check/fallback
vnstock Listing (VCI/KBS)
    ↓ secondary
Cophieu68 exchange lists
```

Canonical exchanges:

```text
HOSE
HNX
UPCOM
```

Normalize:

```text
HSX → HOSE
```

Exclude non-stock asset classes at adapter/normalization layer:
- index;
- ETF;
- derivative;
- CW;
- bond.

Do not infer asset type from exchange alone.

---

## 5.2. EOD OHLCV

```text
FireAnt
    ↓ only if missing/stale/invalid
vnstock VCI
    ↓
vnstock KBS
    ↓
Cophieu68 bulk/history
```

Do not call all providers for every ticker when FireAnt is healthy.

Cross-check is triggered by anomaly, stale date, provider error, corporate action or spot QA.

---

## 5.3. Intraday/current snapshot

```text
SSI iBoard group snapshot
    ↓ cross-check
FireAnt current data if available
    ↓ cross-check
24HMoney board
    ↓ optional
Vietstock / SieuCoPhieu board
```

Intraday data must never overwrite final EOD bars.

---

## 5.4. Benchmark VNINDEX

```text
FireAnt
    ↓
vnstock VCI
    ↓
vnstock KBS
    ↓ cross-check only
24HMoney / Vietstock / Cophieu68
```

Benchmark mismatch that cannot be explained blocks VERIFIED scoring runs that depend on benchmark.

---

## 5.5. Fundamentals / KQKD

Preferred retrieval:

```text
vnstock KBS Financial
    ↓
vnstock VCI Financial
    ↓
FireAnt financial-reports / financial-indicators
    ↓
CafeF historical BCTC
    ↓
24HMoney financial reports
    ↓
Vietstock Finance
    ↓
Cophieu68 financial pages
```

Verification priority:

```text
official disclosure / exchange / company IR
```

Publication date matters for backfill.

---

## 5.6. News

```text
official disclosure / company IR
    ↓
VN Market News aggregator
    ↓
FireAnt posts
    ↓
CafeF / Vietstock / 24HMoney / original publisher
```

A headline is raw evidence, not automatically a score.

---

## 5.7. Corporate actions

Authority order:

```text
official exchange/company disclosure
    ↓
FireAnt events/timescale/dividend endpoints
    ↓
CafeF / Vietstock / Cophieu68 cross-check
```

Unresolved adjustment:

```text
CORPORATE_ACTION_PENDING
```

---

## 5.8. Order / active buy-sell flow

Use as enrichment, not as replacement for OHLCV.

```text
24HMoney transaction history
    ↓
Vietstock buy/sell order statistics
    ↓
SSI iBoard market depth/snapshot
```

---

## 5.9. Sector / industry money flow

```text
SieuCoPhieu public industry_cashflow API
    ↓
24HMoney sector money flow
    ↓
Vietstock industry data
```

Do not mix sector-flow values into stock score unless external scoring contract explicitly requests it.

---

# 6. FireAnt — Primary core provider

Swagger:
- title: `FireAnt RESTFUL API`
- host: `api.fireant.vn`
- scheme: HTTPS

Core endpoints:

```http
POST /authentication/anonymous-login
GET  /instruments
GET  /symbols/{symbol}
GET  /symbols/{symbol}/historical-quotes
GET  /posts
GET  /symbols/{symbol}/posts
GET  /symbols/{symbol}/financial-reports
GET  /symbols/{symbol}/full-financial-reports
GET  /symbols/{symbol}/financial-indicators
GET  /symbols/{symbol}/fundamental
GET  /symbols/{symbol}/timescale-marks
GET  /symbols/{symbol}/dividends
GET  /events/search
```

## 6.1. Authentication

```python
import requests

BASE = "https://api.fireant.vn"

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "FLOW-Vietnam-DataLayer/1.2",
})

r = session.post(
    f"{BASE}/authentication/anonymous-login",
    timeout=30,
)
r.raise_for_status()

payload = r.json() if r.content else {}

token = None
if isinstance(payload, dict):
    for key in ("access_token", "accessToken", "token"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            token = value
            break

if token:
    session.headers["Authorization"] = f"Bearer {token}"
```

Do not log/store tokens.

## 6.2. Universe

```http
GET https://api.fireant.vn/instruments
```

Normalize:
- symbol uppercase
- HSX -> HOSE
- provider type -> canonical asset type

## 6.3. Historical quotes

```http
GET /symbols/{symbol}/historical-quotes
```

Parameters:
- `startDate`
- `endDate`
- `offset`
- `limit`

Core mapping:

```yaml
time: date
open_provider: priceOpen
high_provider: priceHigh
low_provider: priceLow
close_provider: priceClose
reference_price_provider: priceBasic
volume_total: totalVolume
volume_matched: dealVolume
volume_putthrough: putthroughVolume
average_price_provider: priceAverage
```

Pagination must continue until complete.

---

# 7. Canonical price units — critical v1.2 change

Providers use different price units:
- some return VND;
- some display thousand VND;
- some may use adjusted/raw values.

Never let scoring code contain provider-specific `×1000`.

Store both provider raw and canonical VND.

```yaml
close_provider: 17.5
provider_price_unit: "1000_VND"
price_scale_to_vnd: 1000
close_vnd: 17500
```

For provider returning 92,000 VND:

```yaml
close_provider: 92000
provider_price_unit: "VND"
price_scale_to_vnd: 1
close_vnd: 92000
```

Canonical trade value:

```text
trade_value_vnd = close_vnd × volume
```

This makes future liquidity rules independent of provider.

---

# 8. Canonical volume model

Keep distinct fields:

```yaml
volume_total:
volume_matched:
volume_putthrough:
volume_provider:
technical_volume:
technical_volume_policy:
```

Default FireAnt technical-volume policy remains:

```text
technical_volume = totalVolume
```

But policy is stored/versioned rather than hard-coded in scoring.

---

# 9. SSI iBoard adapter

Base:
`https://iboard.ssi.com.vn/`

Reference endpoints:

```http
GET https://iboard-query.ssi.com.vn/stock/stock-info
GET https://iboard-query.ssi.com.vn/stock/group/{GROUP}
```

Groups include:
- VN30
- HOSE
- HNX
- UPCOM
- VN100

Use cases:
- symbol master cross-check;
- fast market snapshot;
- portfolio/hot-stock intraday monitoring;
- price/volume sanity check.

Real-time stream documented as MQTT over WebSocket:

```text
wss://price-streaming.ssi.com.vn/mqtt
```

Do not depend on undocumented MQTT topic semantics unless separately verified.

Canonical mapping example:

```yaml
symbol: stockSymbol
current_price_vnd: matchedPrice
price_change_vnd: priceChange
pct_change: priceChangePercent
volume_total: totalVolume
```

Required public-request headers may include browser-like `User-Agent`, `Referer`, `Origin`.

---

# 10. Vietcap IQ Screener adapter

Screening endpoint:

```http
POST https://iq.vietcap.com.vn/api/iq-insight-service/v1/screening/paging
```

Criteria endpoint:

```http
GET/POST https://iq.vietcap.com.vn/api/iq-insight-service/v1/screening/criteria
```

Useful fields:
- `symbol`
- `marketPrice`
- `marketCap`
- `dailyPriceChangePercent`
- `stockStrength`
- `accumulatedVolume`
- `accumulatedValue`
- `tradingValueAdtv10Days`
- `pe`
- `pb`
- `roe`
- other available growth/valuation metrics

Role:
- screener enrichment;
- liquidity/ADTV cross-check;
- provider-specific strength cross-check;
- valuation/fundamental enrichment.

**Do not substitute Vietcap `stockStrength` for internal RS unless scoring contract explicitly says so.**

**Do not use current screener fields for historical point-in-time backfill unless historical timestamp semantics are verified.**

---

# 11. Cophieu68 adapter

Best bulk endpoint:

```text
https://www.cophieu68.vn/download/historydaily.php
```

Useful fields:
- symbol
- close
- change
- matched volume
- open/high/low
- foreign buy/sell
- foreign net value

Other endpoints:

```text
/signal/filter_financial.php
/quote/history.php?id={SYMBOL}
/quote/financial_detail.php?id={SYMBOL}&type={quarter|year}
/stats/foreigner.php
/stats/volume_buzz.php
/market/markets.php?id={exchange_id}&vt={type}
```

Exchange IDs:
- `^vnindex` = HOSE
- `^hastc` = HNX
- `^upcom` = UPCOM

Role:
- secondary bulk daily fallback;
- sanity check;
- foreign activity;
- financial fallback;
- volume-anomaly enrichment.

Cophieu68 price is documented in thousand-VND on some pages; adapter must normalize to `*_vnd`.

---

# 12. 24HMoney adapter

Base:
`https://24hmoney.vn/`

Useful pages:
- real-time board
- financial reports
- financial indicators
- stock transactions
- indices
- industry money flow
- foreign trading

Technical screener endpoint:

```http
GET https://api-finance-t19.24hmoney.vn/v1/ios/company/technical-filter
```

Useful fields:
- `symbol`
- `match_price`
- `pe4Q`
- `pb4Q`
- `eps4Q`
- `roe`
- `roa`
- `market_cap`
- `rs1m`
- `rs3m`
- `rs52w`
- `ev_per_ebit`
- `ev_per_ebitda`
- `the_beta4Q`

Role:
- active buy/sell flow;
- sector money flow;
- foreign activity;
- financial enrichment;
- independent RS/valuation cross-check.

Provider RS fields are **not** automatically the FLOW RS.

If API requires browser/device identifiers, adapter may use documented/public request semantics; do not bypass authentication or access controls.

---

# 13. SieuCoPhieu adapter

Public industry cashflow:

```http
GET https://sieucophieu.vn/api/v1/stock/industry_cashflow/
```

Fields:
- `stock_list_name`
- `cashflow`
- `roc`
- `rs_short`
- `rs_mid`
- `rs_relative`

Role:
- sector/industry cashflow;
- sector-relative-strength enrichment.

Stock-level proprietary/login-only ranking/analysis:
- do not scrape/bypass login;
- treat as unavailable unless user supplies authorized access and terms permit.

Public smart board may be used as supplemental current-price reference if accessible.

---

# 14. Vietstock Finance adapter

Base:
`https://finance.vietstock.vn/`

Useful:
- company overview
- financial statements
- market-wide prices
- industry data
- buy/sell order statistics
- per-stock transaction statistics

Order statistics:

```text
/ket-qua-giao-dich?tab=thong-ke-dat-lenh
```

Financial:

```text
/{TICKER}/tai-chinh.htm
?tab=BCTT
?tab=CDKT
?tab=KQKD
?tab=LC
```

Role:
- order-flow reference;
- financial reference;
- secondary market-data cross-check.

Because it is JS-heavy / login-friction:
- do not make core EOD pipeline depend on Vietstock HTML;
- use browser only for public pages when necessary;
- do not bypass login/anti-bot controls.

---

# 15. CafeF adapter

Base:
`https://s.cafef.vn`

Financial URL pattern:

```text
/bao-cao-tai-chinh/{SYMBOL}/{REPORT_TYPE}/{YEAR}/{PERIOD}/{FROM_YEAR}/{TO_YEAR}/{SLUG}.chn
```

Report types:
- `IncSta`
- `BSheet`
- `CashFlow`
- `CashFlowDirect`

Period:
- 0 yearly
- 1 quarterly
- 2 6-month cumulative

Role:
- historical financial fallback;
- detailed BCTC;
- manual financial verification.

Prefer official disclosure / KBS / VCI when available for point-in-time automated scoring.

---

# 16. VN Market News / supplemental news

Keep existing v1.1 news adapter if operational.

Expected capabilities:
- daily news
- ticker lookup
- search
- market intelligence
- live poll
- health

News record canonical schema:

```yaml
symbol:
title:
url:
published_at:
source_name:
source_names:
source_count:
snippet:
summary_vi:
confirmation_level:
confirmation_label:
fetched_at:
```

Always validate relevance:
- ticker;
- company name;
- context;
- timestamp;
- duplicate URL/article cluster.

---

# 17. Canonical instrument schema

```yaml
symbol: FPT
exchange: HOSE
name: "..."
asset_type: stock

provider_symbol: FPT
provider_exchange: HSX
provider_type: "..."

primary_source: FireAnt
source_timestamp: null
fetched_at: "ISO-8601"
```

---

# 18. Canonical OHLCV schema v1.2

```yaml
symbol: FPT
trading_date: 2026-10-01

open_provider: 0
high_provider: 0
low_provider: 0
close_provider: 0
provider_price_unit: "VND|1000_VND|OTHER"
price_scale_to_vnd: 1

open_vnd: 0
high_vnd: 0
low_vnd: 0
close_vnd: 0

volume_total: 0
volume_matched: null
volume_putthrough: null
technical_volume: 0
technical_volume_policy: "provider_total"

reference_price_vnd: null

source: FireAnt
source_timestamp: null
fetched_at: "ISO-8601"

adjustment_status: VERIFIED
validation_status: VERIFIED
```

---

# 19. Canonical derived market metrics

These are data/feature values, not scoring rules.

Recommended generic metrics:

```yaml
trade_value_vnd:
avg_trade_value_5_vnd:
avg_trade_value_10_vnd:
avg_trade_value_20_vnd:
avg_trade_value_50_vnd:

return_1d:
return_5d:
return_20d:
return_50d:
return_63d:
return_126d:
return_189d:
return_252d:

volume_ma10:
volume_ma20:
volume_ma50:

price_ma10:
price_ma20:
price_ma50:
price_ma150:
price_ma200:

high_52w:
low_52w:
```

The data layer can compute these generically.

**No pass/fail threshold is defined here.**

---

# 20. History retention

v1.1 hard-coded target 320 / minimum 260. v1.2 changes this:

## 20.1. Storage policy

Prefer:
- persist full available daily history;
- incremental daily update;
- do not truncate archive to 320.

## 20.2. Working fetch policy

If full archive is not available:
- default fetch target: configurable, e.g. 600 trading bars;
- scoring consumer declares `required_history_bars`;
- acquisition must fetch at least that many valid bars plus warm-up buffer where feasible.

Example:

```yaml
history_policy:
  retain: "full_available"
  default_fetch_bars: 600
  minimum_required_bars: "consumer_supplied"
```

Thus future formulas can request more history without source-contract changes.

---

# 21. Valid bar rules

Daily bar valid if:
- date exists;
- O/H/L/C finite;
- close > 0;
- high >= max(open, close, low);
- low <= min(open, close, high);
- volume >= 0.

Do not automatically remove a legitimate zero-volume trading day without provider-specific validation.

---

# 22. Deduplication

Key:

```text
(symbol, trading_date)
```

If duplicate:
1. compare source timestamp;
2. compare provider semantics;
3. preserve raw records if needed;
4. resolve deterministically;
5. otherwise `DUPLICATE_UNRESOLVED`.

Never randomly choose one row.

---

# 23. Sorting

Always ascending by `trading_date` before:
- returns;
- moving averages;
- rolling metrics;
- benchmark alignment;
- consumer feature computation.

---

# 24. Stale detection

For requested date `T`:

```text
latest_data_date < T
    => STALE or DATA_PENDING
```

Do not relabel yesterday's bar as today's bar.

On weekends/holidays:
- resolve actual latest trading session first;
- report `NO_NEW_TRADING_SESSION` if appropriate.

---

# 25. Corporate-action handling

Triggers:
- large unexplained gap;
- stock dividend;
- cash dividend;
- rights issue;
- split/consolidation;
- unusual reference-price change.

Store:

```yaml
adjustment_status:
  - VERIFIED
  - ADJUSTED
  - UNADJUSTED_CONFIRMED
  - CORPORATE_ACTION_PENDING
```

If unresolved:
- do not silently treat the gap as normal technical price movement.

---

# 26. Fallback algorithm — domain aware

```python
def acquire_market_history(symbol, trading_date, requirement):
    fa = try_fireant(symbol, requirement)

    if fa.is_valid_for(trading_date, requirement):
        return fa

    for provider in (
        try_vnstock_vci,
        try_vnstock_kbs,
        try_cophieu68,
    ):
        candidate = provider(symbol, requirement)

        if candidate.is_valid_for(trading_date, requirement):
            return candidate.with_provenance(
                primary_source="FireAnt",
                fallback_source=candidate.provider,
                fallback_reason=fa.failure_reason,
            )

    return DataError(
        symbol=symbol,
        reason="NO_VALID_SOURCE",
    )
```

Fallback changes source, **not formula**.

---

# 27. Conflict resolution v1.2

**Do not average market prices from multiple providers.**

Old generic rule such as "average if within ±5%" is removed.

Correct process:
1. normalize units;
2. align exact trading date/time;
3. compare adjusted/unadjusted semantics;
4. inspect corporate action;
5. inspect total vs matched volume definition;
6. compare primary to secondary source;
7. if explainable, keep primary + provenance note;
8. if not explainable, flag `CONFLICT`.

Example:

```yaml
conflict:
  field: close_vnd
  primary:
    source: FireAnt
    value: 21500
  secondary:
    source: SSI
    value: 21800
  status: CONFLICT
  resolution: null
```

No silent overwrite.

---

# 28. Cross-check triggers

Do not cross-check every ticker unconditionally.

Trigger when:
- FireAnt missing;
- stale;
- API error;
- invalid OHLC;
- abnormal one-day move;
- extreme volume jump;
- suspected corporate action;
- random QA sample;
- held position / high-priority ticker if desired.

---

# 29. Provenance schema v1.2

```yaml
symbol: FPT
trading_date: 2026-10-01

canonical_dataset: OHLCV_DAILY
primary_source: FireAnt
actual_source: FireAnt
fallback_source: null
fallback_reason: null

provider_request:
  endpoint: "/symbols/FPT/historical-quotes"
  params: {}

provider_price_unit: "1000_VND"
price_scale_to_vnd: 1000

source_timestamp: null
fetched_at: "2026-10-01T16:05:00+07:00"

validation_status: VERIFIED
adjustment_status: VERIFIED

raw_payload_hash: "..."
adapter_version: "fireant_adapter_v1"
data_contract_version: "1.2"
```

---

# 30. Feature provenance

Every derived field should be reproducible.

Example:

```yaml
avg_trade_value_20_vnd:
  value: 12345678901
  source_fields:
    - close_vnd
    - volume_total
  window: 20
  derived_at: "..."
  feature_version: "generic_market_features_v1"
```

Scoring output belongs in another table/namespace.

---

# 31. Suggested storage separation

```text
raw_provider_payloads
canonical_instruments
canonical_ohlcv_daily
canonical_intraday_snapshots
canonical_financials
canonical_news
canonical_events
canonical_order_flow
canonical_sector_flow

derived_market_features

strategy_outputs
scoring_outputs
portfolio_outputs
```

This separation is the core future-proofing rule.

---

# 32. Full-universe persistence

For each trading date, preserve all symbols in the universe where possible.

Data layer record:

```yaml
symbol:
exchange:
trading_date:
data_quality_status:
latest_data_date:
valid_bars:
actual_source:
fallback_source:
```

Do not use `total_score` or score-band fields as mandatory data-layer columns.

---

# 33. Cache policy

Canonical cache key examples:

```text
provider + symbol + trading_date + dataset_type
```

or:

```text
symbol + trading_date + canonical_dataset + data_version
```

VERIFIED data can be incrementally updated only for new dates.

Corrections must create revisions.

---

# 34. EOD run flow

```text
TRADING-DAY CHECK
    ↓
SOURCE HEALTH CHECK
    ↓
FIREANT LOGIN / SESSION
    ↓
UNIVERSE
    ↓
BENCHMARK
    ↓
FETCH EOD HISTORY / LATEST BARS
    ↓
NORMALIZE UNITS
    ↓
VALIDATE / DEDUPE / STALE CHECK
    ↓
FALLBACK WHERE NEEDED
    ↓
CORPORATE-ACTION CHECK
    ↓
PERSIST CANONICAL DATA
    ↓
DERIVE GENERIC FEATURES
    ↓
FULL COVERAGE VALIDATION
    ↓
DATA SNAPSHOT VERIFIED
    ↓
HAND OFF TO EXTERNAL SCORING ENGINE
```

Data layer ends before score calculation.

---

# 35. Intraday flow

```text
SSI iBoard snapshot
    ↓
normalize
    ↓
staging/intraday table
    ↓
optional FireAnt/24HMoney cross-check
    ↓
PRELIMINARY snapshot
```

Never merge intraday partial volume into final EOD bar without explicit EOD reconciliation.

---

# 36. Run coverage

Data run summary:

```yaml
trading_date:
data_date:
universe_count:
processed_count:
data_ready_count:
data_incomplete_count:
fallback_count:
conflict_count:
error_count:
successful_batches:
total_batches:
missing_offsets:
pipeline_status:
```

No score-band counts are required in the data contract.

Those belong to downstream scoring/reporting.

---

# 37. Pipeline status

Allowed:

```text
VERIFIED
PRELIMINARY
DATA_PENDING
PARTIAL
CONFLICT
RUNTIME_ERROR
NO_NEW_TRADING_SESSION
```

`VERIFIED` requires:
- benchmark valid;
- requested data date correct;
- universe processing complete;
- no unresolved systemic error;
- persistence successful.

Scoring verification is a separate downstream state.

---

# 38. Publication status is separate

```yaml
data_pipeline_status: VERIFIED
scoring_status: NOT_RUN
publish_status: NOT_PUBLISHED
```

Do not conflate:
- data ready;
- score ready;
- website published.

---

# 39. Retry standard

Recommended baseline:

```yaml
timeout_seconds: 30
max_retries: 3
backoff_seconds: [1, 2, 4]
retry_on:
  - timeout
  - connection_error
  - HTTP_429
  - HTTP_500
  - HTTP_502
  - HTTP_503
  - HTTP_504
```

Honor `Retry-After`.

No infinite retries.

---

# 40. Rate-limit and access policy

- use cache;
- lower concurrency on 429;
- use public documented endpoints where possible;
- do not bypass login/access controls;
- do not use proxy rotation to circumvent provider restrictions;
- respect terms and service load;
- use browser automation only for public pages that legitimately require JavaScript.

---

# 41. Concurrency

Configurable.

Example:

```yaml
fetch:
  batch_size: 40
  concurrency: 8
```

These are operational values, not business rules.

Do not encode assumptions about exact universe size.

Expected offsets must be computed dynamically:

```python
offsets = list(range(0, universe_count, batch_size))
```

---

# 42. Secrets

Never store in this file:
- FireAnt token;
- passwords;
- database secrets;
- cookies;
- private API keys.

Use:
- environment variables;
- secret manager;
- platform secret storage.

---

# 43. Point-in-time financial/news backfill

For historical date `T`:

```text
financial_publication_time <= T
news_published_at <= T
event_publication_time <= T
```

If publication time cannot be proven:
- mark `PUBLICATION_TIME_UNVERIFIED`;
- downstream historical scoring must decide whether to exclude it.

---

# 44. Source-specific normalized schemas

## 44.1. Financial record

```yaml
symbol:
report_type:
period_type:
period_end:
published_at:
currency:
unit:
metric_code:
metric_name:
value:
source:
fetched_at:
verification_status:
```

## 44.2. News record

```yaml
symbol:
title:
url:
published_at:
source_name:
body_snippet:
canonical_url:
cluster_id:
fetched_at:
relevance_status:
```

## 44.3. Order-flow record

```yaml
symbol:
trading_date:
timestamp:
price_vnd:
volume:
side:
active_buy_volume:
active_sell_volume:
source:
fetched_at:
```

## 44.4. Sector-flow record

```yaml
trading_date:
sector_id:
sector_name:
cashflow:
roc:
rs_short:
rs_mid:
rs_relative:
source:
fetched_at:
```

---

# 45. Adapter design rule

Every provider adapter must expose the same interface where applicable:

```python
class ProviderAdapter:
    def health(self): ...
    def universe(self): ...
    def ohlcv(self, symbol, start, end): ...
    def snapshot(self, symbols=None): ...
    def financials(self, symbol, **kwargs): ...
    def news(self, symbol=None, **kwargs): ...
    def events(self, symbol=None, **kwargs): ...
```

A provider may return `NotSupported` for unsupported domains.

Scoring code must never call provider-specific endpoint directly.

---

# 46. Source registry config example

```yaml
providers:
  fireant:
    enabled: true
    roles:
      universe: 1
      eod_ohlcv: 1
      benchmark: 1
      corporate_action: 2
      news: 3
      fundamentals: 3

  vnstock_vci:
    enabled: true
    roles:
      eod_ohlcv: 2
      benchmark: 2
      universe_crosscheck: 3
      fundamentals: 2

  vnstock_kbs:
    enabled: true
    roles:
      eod_ohlcv: 3
      benchmark: 3
      fundamentals: 1

  ssi_iboard:
    enabled: true
    roles:
      intraday_snapshot: 1
      universe_crosscheck: 2
      market_depth: 1

  vietcap:
    enabled: true
    roles:
      screener_enrichment: 1
      adtv_crosscheck: 1
      strength_crosscheck: 1

  cophieu68:
    enabled: true
    roles:
      eod_bulk_fallback: 1
      foreign_flow: 2
      financial_fallback: 3

  24hmoney:
    enabled: true
    roles:
      active_flow: 1
      sector_flow: 2
      foreign_flow: 1
      screener_enrichment: 2

  sieucophieu:
    enabled: true
    roles:
      sector_flow: 1

  vietstock:
    enabled: true
    roles:
      order_flow: 2
      financial_reference: 3

  cafef:
    enabled: true
    roles:
      historical_financials: 1
      financial_reference: 2
```

Priority numbers are per domain, not global provider rankings.

---

# 47. API/source change policy

If endpoint/provider changes:
1. do not change scoring;
2. identify failing adapter;
3. verify current provider docs/runtime;
4. update only adapter;
5. keep canonical schema;
6. keep provenance;
7. run adapter tests;
8. bump adapter version;
9. bump data contract only if canonical behavior changes.

This is the key rule that makes scoring evolution independent.

---

# 48. Acceptance tests — provider adapters

## FireAnt
- anonymous login graceful;
- instruments works;
- historical pagination complete;
- price-unit normalization correct;
- VNINDEX same-date alignment works.

## SSI iBoard
- symbol list maps correctly;
- HOSE/HNX/UPCOM group snapshot parses;
- VND price unit confirmed at runtime;
- missing headers fail gracefully.

## Vietcap
- paging complete;
- symbol/marketPrice/ADTV fields map;
- current-only fields are not used as historical point-in-time data.

## Cophieu68
- bulk daily parse;
- thousand-VND normalization;
- exchange pages parse;
- foreign flow parse.

## 24HMoney
- screener pagination;
- financial/transaction parsing;
- active flow fields retain timestamp;
- provider RS remains provider-native field.

## SieuCoPhieu
- public industry cashflow endpoint parses;
- login-only endpoints are not scraped.

## Vietstock
- browser/public page adapter optional;
- core EOD run works even if Vietstock unavailable.

## CafeF
- financial URL generator;
- report period parsing;
- Vietnamese number normalization.

---

# 49. Acceptance tests — data quality

- OHLC relation valid.
- price unit converts correctly.
- VND trade value equals `close_vnd × volume`.
- duplicate date handling deterministic.
- stale requested date detected.
- fallback provenance records actual source.
- unresolved conflict not silently overwritten.
- corporate-action pending preserved.
- intraday does not overwrite EOD.
- correction creates revision.
- secrets not logged.

---

# 50. Acceptance tests — scoring independence

The following changes must **not** require editing this file or provider adapters:
- component weight changes;
- total score changes;
- News score changes;
- risk weighting changes;
- Quality/Watch thresholds change;
- liquidity threshold changes;
- RS percentile scoring thresholds change;
- Entry/Stop formula change;
- different strategy formula entirely.

Test:

```text
Given identical canonical data,
swap scoring_contract V5 → V6,
data acquisition output remains byte-for-byte equivalent
except consumer-requested feature depth if V6 requires more history.
```

---

# 51. Migration from v1.1

Remove/deprecate from data layer:
- `canonical_score_version`;
- hard-coded FLOW formula;
- hard-coded component weights;
- `risk_score`;
- mandatory `total_score`;
- Quality/Watch threshold logic;
- `<75 hidden` logic;
- score-based publication filtering;
- score-band counts in data run summary;
- strategy-specific `eligible` meaning.

Replace:
- `eligible` → `data_quality_status` + downstream `strategy_eligible`;
- `score_version` → downstream scoring table;
- `total_score` → downstream scoring table;
- `risk_score` → downstream risk/strategy table.

Retain:
- FireAnt primary;
- VCI/KBS fallback;
- no-look-ahead;
- canonical schemas;
- full-universe persistence;
- provenance;
- retry;
- point-in-time;
- snapshot immutability;
- corporate-action validation;
- source security.

---

# 52. Recommended downstream tables

## data layer

```text
canonical_ohlcv_daily
canonical_instruments
canonical_financials
canonical_news
canonical_events
canonical_intraday
canonical_order_flow
canonical_sector_flow
derived_market_features
```

## scoring layer

```text
strategy_eligibility
flow_score_components
flow_total_scores
entry_stop_targets
portfolio_position_status
```

Foreign keys:
- symbol
- trading_date
- data_snapshot_id

---

# 53. Handoff prompt — ChatGPT/Codex

```text
Use FLOW_Data_Acquisition_API_Standard_v1.2 as the canonical DATA contract.

Important:
- This file does NOT define the FLOW scoring formula.
- Read scoring from the separate current scoring/handoff file.
- Do not change data sources, normalization, fallback or data-quality rules merely because scoring weights/thresholds change.
- FireAnt remains primary for core EOD OHLCV/universe/benchmark.
- Use provider priority by DATA DOMAIN, not one global source ranking.
- Preserve provenance and price units.
- Never average conflicting market prices silently.
- Intraday and EOD must remain separate.
- Do not look ahead in historical backfills.
- Do not scrape login-only/private endpoints without authorized access.
- Any strategy liquidity/history/score threshold belongs in the external scoring/strategy contract.

Before implementation:
1. audit current adapters;
2. verify provider runtime schemas;
3. map all provider fields to canonical schemas;
4. run data-quality and fallback tests;
5. report unresolved source/API issues.

Do not modify scoring formula unless explicitly asked.
```

---

# 54. Current source documents incorporated in v1.2

- `20260920_Data_Acquisition_API_Standard_v1.1`
- FireAnt Swagger `v1.json`
- Vietcap Screener documentation
- SSI iBoard documentation
- Vietstock Finance documentation
- SieuCoPhieu documentation
- Cophieu68 documentation
- CafeF documentation
- 24HMoney documentation
- data_sources_overview
- existing vnstock / VN Market News notes from v1.1

---

# 55. Changelog

## v1.2 — 2026-10-01

Major architectural change:
- **scoring-agnostic data contract**

Added:
- domain-specific source registry;
- SSI iBoard;
- Vietcap IQ;
- expanded 24HMoney role;
- SieuCoPhieu industry cashflow;
- expanded Cophieu68 role;
- Vietstock role;
- CafeF role;
- provider price-unit normalization;
- VND canonical price fields;
- source-specific conflict rules;
- feature requirement interface;
- separate data-quality vs strategy eligibility;
- separate data/scoring tables;
- future-proof history requirement;
- scoring-independence acceptance test.

Removed from data contract:
- FLOW v4 formula;
- any FLOW formula ownership;
- fixed score weights;
- fixed Quality/Watch thresholds;
- score-based publication filtering;
- risk score;
- strategy liquidity threshold;
- strategy score eligibility.

Changed:
- no global provider ranking across all domains;
- no averaging prices across providers;
- provider priority now depends on data type;
- history minimum is consumer-supplied rather than hard-coded;
- full history retention preferred;
- current consumer can request any required bars/features.

---

# 56. Version stamp

```text
FLOW_DATA_ACQUISITION_API_STANDARD_v1.2
SCORING_AGNOSTIC
2026-10-01
```

This file is the canonical DATA contract.
The scoring formula must live in a separate versioned scoring contract.
