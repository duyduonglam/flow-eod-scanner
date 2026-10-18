-- Independent early screen v2; main FLOW score and liquidity gates unchanged.
alter table public.early_discoveries
  add column rs_rating numeric,
  add column ichimoku_priority smallint not null default 0,
  add column cloud_green boolean,
  add column cloud_position text,
  add column cloud_top numeric,
  add column cloud_bottom numeric;
