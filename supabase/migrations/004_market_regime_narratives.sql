alter table public.market_regimes
  add column if not exists quick_assessment text,
  add column if not exists exclusion_notes text;
