-- Public dashboard is read-only. Scheduled scanner writes with the service role.
alter table symbols enable row level security;
alter table daily_prices enable row level security;
alter table market_regimes enable row level security;
alter table stock_signals enable row level security;
alter table scan_results enable row level security;
alter table news_items enable row level security;

create policy "public read symbols" on symbols for select to anon using (true);
create policy "public read market regimes" on market_regimes for select to anon using (true);
create policy "public read stock signals" on stock_signals for select to anon using (true);
create policy "public read scan results" on scan_results for select to anon using (true);
create policy "public read news" on news_items for select to anon using (true);

-- Raw daily prices remain service-role only in V1; the public UI consumes scan results.

create or replace view latest_scan_results as
select sr.*, s.symbol, s.exchange
from scan_results sr
join symbols s on s.id = sr.symbol_id
where sr.market_date = (select max(market_date) from scan_results);

create or replace view latest_stock_signals as
select ss.*, s.symbol, s.exchange
from stock_signals ss
join symbols s on s.id = ss.symbol_id
where ss.market_date = (select max(market_date) from stock_signals);
