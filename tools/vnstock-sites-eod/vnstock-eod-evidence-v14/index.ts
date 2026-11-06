const base = "https://restv2.fireant.vn";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = Deno.env.get("SUPABASE_URL");

function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function rawBar(quote: Record<string, unknown>) {
  const date = String(quote.date ?? "").slice(0, 10);
  const values = [quote.priceOpen, quote.priceHigh, quote.priceLow, quote.priceClose, quote.totalVolume, quote.adjRatio];
  if (!validDate(date) || values.some(value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)))) {
    throw new Error("INVALID_RAW_BAR");
  }
  const [open, high, low, close, volume, ratio] = values.map(Number);
  if (low <= 0 || low > Math.min(open, close) || high < Math.max(open, close) || volume < 0 || ratio <= 0) {
    throw new Error("INVALID_RAW_BAR");
  }
  return [date, open, high, low, close, volume, ratio, 1000] as const;
}

async function quotes(symbol: string, from: string, date: string, token: string) {
  const url = base + "/symbols/" + symbol + "/historical-quotes?" + new URLSearchParams({
    startDate: from, endDate: date, offset: "0", limit: "40"
  });
  const response = await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("FIREANT_HTTP_" + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("INVALID_FIREANT_PAYLOAD");
  const bars = payload.map(rawBar).filter(bar => bar[0] >= from && bar[0] <= date).sort((a,b) => a[0].localeCompare(b[0]));
  if (new Set(bars.map(bar => bar[0])).size !== bars.length) throw new Error("DUPLICATE_SESSION");
  return { bars, httpStatus: response.status };
}

async function save(date: string, symbol: string, from: string, result: Awaited<ReturnType<typeof quotes>>) {
  const response = await fetch(supabase + "/rest/v1/rpc/record_fireant_eod_evidence_v1", {
    method: "POST",
    headers: { apikey: serviceKey!, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_trading_date: date, p_symbol: symbol, p_window_start: from, p_http_status: result.httpStatus, p_bars: result.bars }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("EVIDENCE_WRITE_FAILED");
  return await response.json();
}

Deno.serve(async request => {
  if (!serviceKey || !supabase) return Response.json({ error: "SERVER_CONFIG_MISSING" }, { status: 503 });
  if (request.headers.get("Authorization") !== "Bearer " + serviceKey) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (request.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });

  const { date, symbols } = (await request.json().catch(() => null)) ?? {};
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!validDate(date) || date > today || !Array.isArray(symbols) || symbols.length < 1 || symbols.length > 12 ||
      symbols.some(symbol => typeof symbol !== "string" || !/^[A-Z0-9]{1,12}$/.test(symbol) || symbol === "VNINDEX") ||
      new Set(symbols).size !== symbols.length) {
    return Response.json({ error: "INVALID_DATE_OR_SYMBOL_BATCH" }, { status: 400 });
  }

  try {
    const login = await fetch(base + "/authentication/anonymous-login", { method: "POST", signal: AbortSignal.timeout(10000) });
    if (!login.ok) throw new Error("FIREANT_LOGIN_FAILED");
    const { accessToken } = await login.json();
    if (!accessToken) throw new Error("FIREANT_LOGIN_FAILED");
    const lookback = new Date(Date.parse(date + "T00:00:00Z") - 28 * 86400000).toISOString().slice(0, 10);
    const benchmark = await quotes("VNINDEX", lookback, date, accessToken);
    const bars = benchmark.bars.slice(-6);
    if (bars.length !== 6 || bars.at(-1)?.[0] !== date) {
      return Response.json({ status: "BLOCKED", error: "VNINDEX_INVALID_OR_STALE", date }, { status: 409 });
    }
    const from = bars[0][0];
    const sessions = bars.map(bar => bar[0]);
    const benchmarkHash = await save(date, "VNINDEX", from, { ...benchmark, bars });
    const results = await Promise.all(symbols.map(async (symbol: string) => {
      try {
        const observation = await quotes(symbol, from, date, accessToken);
        if (observation.bars.some(bar => !sessions.includes(bar[0]))) throw new Error("SESSION_NOT_IN_BENCHMARK");
        const evidenceHash = await save(date, symbol, from, observation);
        return { symbol, evidenceHash, bars: observation.bars.length, latestDate: observation.bars.at(-1)?.[0] ?? null };
      } catch (error) {
        return { symbol, error: error instanceof Error ? error.message : "FETCH_FAILED" };
      }
    }));
    return Response.json({ status: "QA_PARTIAL", date, sessions, benchmarkHash, results });
  } catch (error) {
    return Response.json({ status: "BLOCKED", date, error: error instanceof Error ? error.message : "FETCH_FAILED" }, { status: 502 });
  }
});
