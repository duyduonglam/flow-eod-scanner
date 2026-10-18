-- VNSUPERSTOCK Vercel only. Additive; existing score/publication gates unchanged.
alter table public.daily_prices add column if not exists adj_ratio numeric not null default 1;

create table public.price_history_state (
  symbol_id bigint primary key references public.symbols(id),
  range_start date not null,
  checked_through date not null,
  full_refresh_date date not null,
  bar_count integer not null check (bar_count >= 0)
);
create table public.price_history_revisions (
  id bigint generated always as identity primary key,
  symbol_id bigint not null references public.symbols(id),
  market_date date not null,
  previous_value jsonb not null,
  revised_at timestamptz not null default now()
);
create table public.early_scan_runs (
  market_date date primary key,
  status text not null check (status in ('RUNNING','COMPLETE')),
  formula_version text not null,
  candidate_count integer,
  cache_stats jsonb
);
create table public.early_discoveries (
  market_date date not null,
  symbol_id bigint not null references public.symbols(id),
  formula_version text not null,
  stage text not null check (stage in ('PREPARING','NEW_BREAKOUT')),
  close numeric not null,
  change_pct numeric,
  flow_score numeric,
  dema21 numeric not null,
  ema20 numeric not null,
  ema50 numeric not null,
  ema200 numeric not null,
  upper_bb numeric not null,
  adjusted_close numeric not null,
  price_basis text not null,
  volume_ratio numeric not null,
  extension_pct numeric not null,
  avg_value_20 numeric not null,
  current_value numeric not null,
  primary key (market_date,symbol_id)
);
create index early_discoveries_symbol_date on public.early_discoveries(symbol_id,market_date desc);
alter table public.price_history_state enable row level security;
alter table public.price_history_revisions enable row level security;
alter table public.early_scan_runs enable row level security;
alter table public.early_discoveries enable row level security;
create policy "public read completed early runs" on public.early_scan_runs for select to anon using (true);
create policy "public read completed early discoveries" on public.early_discoveries for select to anon
  using (exists (select 1 from public.early_scan_runs r where r.market_date=early_discoveries.market_date and r.status='COMPLETE'));
create policy "public read canonical price history" on public.daily_prices for select to anon
  using (source='fireant' and validation_status='VALID');
grant select on public.early_scan_runs, public.early_discoveries, public.daily_prices to anon;
grant all on public.price_history_state, public.price_history_revisions, public.early_scan_runs, public.early_discoveries to service_role;
grant usage, select on sequence public.price_history_revisions_id_seq to service_role;

alter table public.stock_signals add column if not exists decision text;
alter table public.stock_signals add column if not exists main_signal text;
create index price_history_revisions_symbol_date on public.price_history_revisions(symbol_id, market_date);
