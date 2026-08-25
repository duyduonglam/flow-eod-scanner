create table if not exists symbols (
  id bigserial primary key,
  symbol text not null unique,
  exchange text not null check (exchange in ('HOSE','HNX','UPCOM','INDEX')),
  asset_type text not null default 'stock',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists daily_prices (
  id bigserial primary key,
  symbol_id bigint not null references symbols(id) on delete cascade,
  market_date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  reference numeric,
  volume bigint not null check (volume >= 0),
  source text not null,
  fetched_at timestamptz not null,
  validation_status text not null default 'VALID',
  unique(symbol_id, market_date, source)
);
create index if not exists idx_daily_prices_symbol_date on daily_prices(symbol_id, market_date desc);

create table if not exists market_regimes (
  id bigserial primary key,
  market_date date not null unique,
  market_mode text not null check (market_mode in ('RISK ON','NORMAL','CAUTION','RISK OFF')),
  index_symbol text not null default 'VNINDEX',
  index_close numeric,
  index_change_pct numeric,
  breadth_advancers integer,
  breadth_decliners integer,
  liquidity_value numeric,
  distribution_flag boolean not null default false,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists stock_signals (
  id bigserial primary key,
  market_date date not null,
  symbol_id bigint not null references symbols(id) on delete cascade,
  close numeric,
  flow_score numeric,
  flow_label text,
  pass_count integer,
  total_count integer not null default 11,
  rs_rating numeric,
  banker numeric,
  banker_ma numeric,
  hot_money numeric,
  hot_money_ma numeric,
  retailer numeric,
  retailer_ma numeric,
  swing_direction text,
  volume_buzz numeric,
  ud_volume_ratio numeric,
  chase_risk text,
  t_plus_two_risk text,
  risk_class text,
  data_status text not null default 'VALID',
  created_at timestamptz not null default now(),
  unique(market_date, symbol_id)
);

create table if not exists scan_results (
  id bigserial primary key,
  market_date date not null,
  symbol_id bigint not null references symbols(id) on delete cascade,
  rank integer,
  total_score numeric,
  score_label text,
  main_signal text,
  headline_news text,
  entry_low numeric,
  entry_high numeric,
  stop_price numeric,
  stop_distance_pct numeric,
  one_r numeric,
  two_r numeric,
  three_r numeric,
  decision text not null check (decision in ('BUY','TEST BUY','BUY RETEST','WATCH','DO NOT CHASE','HOLD','TRIM','EXIT')),
  invalidation text,
  is_existing_leader boolean not null default false,
  is_new_candidate boolean not null default false,
  is_deteriorating boolean not null default false,
  created_at timestamptz not null default now(),
  unique(market_date, symbol_id)
);
create index if not exists idx_scan_results_date_rank on scan_results(market_date desc, rank asc);

create table if not exists news_items (
  id bigserial primary key,
  market_date date not null,
  symbol_id bigint references symbols(id) on delete cascade,
  title text not null,
  url text,
  category text,
  sentiment text check (sentiment is null or sentiment in ('POSITIVE','NEUTRAL','RISK')),
  source text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
