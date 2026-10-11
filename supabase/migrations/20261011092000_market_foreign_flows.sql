create table if not exists public.market_foreign_flows (
  market_date date primary key,
  buy_value numeric not null check (buy_value >= 0),
  sell_value numeric not null check (sell_value >= 0),
  net_value numeric not null,
  source text not null,
  scope text not null,
  fetched_at timestamptz not null,
  provenance jsonb not null,
  check (abs(net_value - (buy_value - sell_value)) < 0.01)
);
alter table public.market_foreign_flows enable row level security;
create policy market_foreign_flows_public_read on public.market_foreign_flows for select to anon, authenticated using (true);
grant select on public.market_foreign_flows to anon, authenticated;
grant all on public.market_foreign_flows to service_role;
