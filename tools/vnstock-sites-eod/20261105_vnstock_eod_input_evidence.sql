-- VNStock Sites / flow-fireant-sandbox only. Evidence is not a score or a release gate.
create schema if not exists vnstock_eod;
revoke all on schema vnstock_eod from public, anon, authenticated;
grant usage on schema vnstock_eod to service_role;

create table vnstock_eod.fireant_quote_evidence_v1 (
  trading_date date not null,
  symbol text not null check (symbol ~ '^[A-Z0-9]+$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  window_start date not null,
  http_status integer not null check (http_status between 100 and 599),
  bars jsonb not null check (jsonb_typeof(bars) = 'array'),
  received_at timestamptz not null default now(),
  primary key (trading_date, symbol, payload_sha256),
  check (window_start <= trading_date)
);

comment on column vnstock_eod.fireant_quote_evidence_v1.received_at is
  'Time evidence was persisted. The original provider request timestamp is not inferred from this column.';
comment on column vnstock_eod.fireant_quote_evidence_v1.bars is
  'Observed raw fields only: date, open, high, low, close, totalVolume, adjRatio, unit. Event QA is separate.';
alter table vnstock_eod.fireant_quote_evidence_v1 enable row level security;
revoke all on table vnstock_eod.fireant_quote_evidence_v1 from public, anon, authenticated, service_role;
grant select, insert on table vnstock_eod.fireant_quote_evidence_v1 to service_role;
