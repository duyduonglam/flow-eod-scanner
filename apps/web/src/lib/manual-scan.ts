export type ManualScanConfig = {
  owner: string;
  repo: string;
  workflow: string;
  ref: string;
  token: string;
  manualSecret: string;
};

type Env = Record<string, string | undefined>;

export type ManualScanInputResult =
  | { ok: true; marketDate: string | undefined }
  | { ok: false; error: string };

export type ManualScanConfigResult =
  | { ok: true; config: ManualScanConfig }
  | { ok: false; missing: string[] };

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function normalizeManualScanInput(payload: unknown): ManualScanInputResult {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const marketDate = clean(record.market_date ?? record.marketDate);
  if (!marketDate) return { ok: true, marketDate: undefined };
  if (!isRealIsoDate(marketDate)) {
    return { ok: false, error: 'Ngay quet khong hop le. Dung dinh dang YYYY-MM-DD.' };
  }
  return { ok: true, marketDate };
}

export function readManualScanConfig(env: Env): ManualScanConfigResult {
  const token = clean(env.GITHUB_ACTIONS_DISPATCH_TOKEN);
  const manualSecret = clean(env.MANUAL_SCAN_SECRET);
  const missing = [
    token ? null : 'GITHUB_ACTIONS_DISPATCH_TOKEN',
    manualSecret ? null : 'MANUAL_SCAN_SECRET',
  ].filter((item): item is string => Boolean(item));

  if (missing.length) return { ok: false, missing };

  return {
    ok: true,
    config: {
      owner: clean(env.GITHUB_SCAN_OWNER) || 'duyduonglam',
      repo: clean(env.GITHUB_SCAN_REPO) || 'flow-eod-scanner',
      workflow: clean(env.GITHUB_SCAN_WORKFLOW) || 'eod_scan.yml',
      ref: clean(env.GITHUB_SCAN_REF) || 'main',
      token,
      manualSecret,
    },
  };
}

export function buildWorkflowDispatchRequest(
  config: Omit<ManualScanConfig, 'manualSecret'>,
  input: { marketDate?: string },
) {
  const workflow = encodeURIComponent(config.workflow);
  const body = {
    ref: config.ref,
    inputs: input.marketDate ? { market_date: input.marketDate } : {},
  };

  return {
    url: `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${workflow}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      body: JSON.stringify(body),
    },
  };
}
