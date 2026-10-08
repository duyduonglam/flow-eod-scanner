-- Daily price change uses the session reference price; legacy rows remain nullable.
alter table public.stock_signals add column if not exists change_pct numeric;
