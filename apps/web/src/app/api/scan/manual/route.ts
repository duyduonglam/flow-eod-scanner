import { NextResponse } from 'next/server';
import {
  buildWorkflowDispatchRequest,
  normalizeManualScanInput,
  readManualScanConfig,
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

  if (submittedSecret(request, payload) !== configResult.config.manualSecret) {
    return NextResponse.json({ ok: false, error: 'Mã kích hoạt không đúng.' }, { status: 401 });
  }

  const input = normalizeManualScanInput(payload);
  if (!input.ok) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  }

  const dispatch = buildWorkflowDispatchRequest(configResult.config, { marketDate: input.marketDate });
  const response = await fetch(dispatch.url, dispatch.init);

  if (response.ok) {
    return NextResponse.json({
      ok: true,
      status: 'queued',
      market_date: input.marketDate ?? null,
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
