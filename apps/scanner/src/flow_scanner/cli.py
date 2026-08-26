from __future__ import annotations

import argparse
import json
import os
from datetime import date, timedelta

from flow_scanner.data.providers.factory import build_provider_chain
from flow_scanner.data.repository import SupabaseRepository
from flow_scanner.persistence import build_scan_result_payload, build_stock_signal_payload
from flow_scanner.pipeline import PipelineError, run_eod_pipeline

MIN_SYMBOLS_FOR_MARKET_SCAN = 0


def _env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def _load_symbols(repo: SupabaseRepository, allow_empty: bool = False) -> tuple[list[str], dict[str, int]]:
    active_symbols = repo.list_active_symbols()
    symbol_ids = {
        str(item["symbol"]).upper(): int(item["id"])
        for item in active_symbols
        if item.get("symbol") and item.get("id") is not None
    }
    if not symbol_ids and not allow_empty:
        raise SystemExit("No active stock symbols found in Supabase.")
    return list(symbol_ids.keys()), symbol_ids


def _refresh_symbol_universe(repo: SupabaseRepository, providers: list[object]) -> int:
    for provider in providers:
        list_symbols = getattr(provider, "list_symbols", None)
        if list_symbols is None:
            continue
        rows = list_symbols()
        if rows:
            repo.upsert_symbols(rows)
            return len(rows)
    return 0


def _run_with_fallback(requested_date: date, symbols: list[str], providers: list[object], max_lookback_days: int) -> dict:
    last_error: Exception | None = None
    for offset in range(max_lookback_days + 1):
        market_date = requested_date - timedelta(days=offset)
        try:
            result = run_eod_pipeline(market_date, symbols, providers)
        except PipelineError as exc:
            last_error = exc
            continue
        if result.get("status") == "OK" and result.get("rows"):
            return result
    if last_error:
        raise last_error
    raise PipelineError(f"No validated EOD rows found within {max_lookback_days} days of {requested_date.isoformat()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run FLOW EOD scanner and upsert Supabase results.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Requested market date in YYYY-MM-DD format.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum ranked rows to publish.")
    parser.add_argument("--max-lookback-days", type=int, default=7, help="Fallback window for holidays or delayed data.")
    parser.add_argument("--min-symbols", type=int, default=MIN_SYMBOLS_FOR_MARKET_SCAN, help="Refresh the market universe when Supabase has fewer active symbols. Default keeps the configured Supabase universe to avoid free-provider rate limits.")
    args = parser.parse_args()

    repo = SupabaseRepository(_env("SUPABASE_URL"), _env("SUPABASE_SERVICE_ROLE_KEY"))
    providers = build_provider_chain()
    symbols, symbol_ids = _load_symbols(repo, allow_empty=True)
    refreshed_symbols = 0
    if len(symbols) < args.min_symbols:
        refreshed_symbols = _refresh_symbol_universe(repo, providers)
        if refreshed_symbols:
            symbols, symbol_ids = _load_symbols(repo)
    if not symbols:
        raise SystemExit("No active stock symbols found after attempting universe refresh.")
    result = _run_with_fallback(date.fromisoformat(args.date), symbols, providers, args.max_lookback_days)
    market_date = str(result["market_date"])
    rows = list(result["rows"])

    scan_rows = build_scan_result_payload(rows, symbol_ids, market_date, limit=args.limit)
    signal_rows = build_stock_signal_payload(rows, symbol_ids, market_date)
    repo.upsert_stock_signal_rows(signal_rows)
    repo.upsert_scan_rows(scan_rows)

    print(json.dumps({
        "status": "OK",
        "requested_date": args.date,
        "market_date": market_date,
        "scanned": result.get("scanned", 0),
        "active_symbols": len(symbols),
        "refreshed_symbols": refreshed_symbols,
        "published": len(scan_rows),
        "conflicts": result.get("conflicts", []),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
