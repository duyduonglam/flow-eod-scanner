alter table public.early_discoveries
  add column if not exists entry_low numeric,
  add column if not exists entry_high numeric,
  add column if not exists stop_price numeric,
  add column if not exists stop_distance_pct numeric,
  add column if not exists one_r numeric,
  add column if not exists two_r numeric,
  add column if not exists three_r numeric;
