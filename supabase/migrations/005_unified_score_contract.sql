alter table stock_signals
  add column if not exists score_version text,
  add column if not exists score_components jsonb;

alter table scan_results
  add column if not exists score_version text,
  add column if not exists score_components jsonb;
