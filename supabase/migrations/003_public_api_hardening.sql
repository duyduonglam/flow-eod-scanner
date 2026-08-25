-- Keep public dashboard reads explicit while avoiding security-definer views.
alter view public.latest_scan_results set (security_invoker = true);
alter view public.latest_stock_signals set (security_invoker = true);

grant usage on schema public to anon;
grant select on table public.symbols to anon;
grant select on table public.market_regimes to anon;
grant select on table public.stock_signals to anon;
grant select on table public.scan_results to anon;
grant select on table public.news_items to anon;
grant select on table public.latest_scan_results to anon;
grant select on table public.latest_stock_signals to anon;

create index if not exists idx_stock_signals_symbol_id on public.stock_signals(symbol_id);
create index if not exists idx_scan_results_symbol_id on public.scan_results(symbol_id);
create index if not exists idx_news_items_symbol_id on public.news_items(symbol_id);
