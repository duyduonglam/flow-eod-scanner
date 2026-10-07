import { NextResponse } from 'next/server';
import {
  buildWorkflowDispatchRequest,
  normalizeManualScanInput,
  readManualScanConfig,
  todayInVietnam,
} from '@/lib/manual-scan';

export const dynamic = 'force-dynamic';

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function submittedSecret(request: Request, payload: unknown): string {
  const headerValue = request.headers.get('x-manual-scan-secret')?.trim();
  if (headerValue) return headerValue;
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const value = record.secret ?? record.manualSecret;
  return typeof value === 'string' ? value.trim() : '';
}

function isSameOriginDashboardRequest(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (origin) return origin === requestOrigin;
  return Boolean(referer?.startsWith(`${requestOrigin}/`));
}

export async function POST(request: Request) {
  const payload = await readJson(request);
  const configResult = readManualScanConfig(process.env);
  if (!configResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Quét thủ công chưa được cấu hình: thiếu ${configResult.missing.join(', ')}.`,
      },
      { status: 503 },
    );
  }

  const secret = submittedSecret(request, payload);
  if (secret && configResult.config.manualSecret && secret !== configResult.config.manualSecret) {
    return NextResponse.json({ ok: false, error: 'Mã kích hoạt không đúng.' }, { status: 401 });
  }
  if (!secret && !isSameOriginDashboardRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Lệnh quét cần được gửi từ dashboard.' }, { status: 403 });
  }

  const input = normalizeManualScanInput(payload);
  if (!input.ok) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  }

  const marketDate = input.marketDate ?? todayInVietnam();
  const dispatch = buildWorkflowDispatchRequest(configResult.config, { marketDate });
  const response = await fetch(dispatch.url, dispatch.init);

  if (response.ok) {
    return NextResponse.json({
      ok: true,
      status: 'queued',
      market_date: marketDate,
      message: 'Đã gửi lệnh quét tới GitHub Actions.',
    });
  }

  const body = await response.text();
  return NextResponse.json(
    {
      ok: false,
      error: 'GitHub chưa nhận lệnh quét.',
      details: body.slice(0, 500),
    },
    { status: 502 },
  );
}
