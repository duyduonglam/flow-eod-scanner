create function public.record_fireant_eod_evidence_v1(
  p_trading_date date, p_symbol text, p_window_start date, p_http_status integer, p_bars jsonb
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  digest text;
begin
  if p_bars is null or jsonb_typeof(p_bars) <> 'array' then
    raise exception 'INVALID_EVIDENCE_BARS';
  end if;
  if jsonb_array_length(p_bars) > 6 then
    raise exception 'INVALID_EVIDENCE_WINDOW';
  end if;
  digest := encode(sha256(convert_to(jsonb_build_array(p_trading_date,p_symbol,p_window_start,p_http_status,p_bars)::text,'UTF8')), 'hex');
  insert into vnstock_eod.fireant_quote_evidence_v1 (trading_date, symbol, payload_sha256, window_start, http_status, bars)
  values (p_trading_date,p_symbol,digest,p_window_start,p_http_status,p_bars)
  on conflict (trading_date,symbol,payload_sha256) do nothing;
  return digest;
end;
$$;
revoke execute on function public.record_fireant_eod_evidence_v1(date,text,date,integer,jsonb) from public, anon, authenticated;
grant execute on function public.record_fireant_eod_evidence_v1(date,text,date,integer,jsonb) to service_role;
comment on function public.record_fireant_eod_evidence_v1(date,text,date,integer,jsonb) is 'Append-only observation with SHA-256 of canonical JSONB envelope; not a QA attestation.';
