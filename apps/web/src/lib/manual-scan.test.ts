import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkflowDispatchRequest,
  normalizeManualScanInput,
  readManualScanConfig,
} from './manual-scan.ts';

test('builds a GitHub workflow dispatch request with an optional market date', () => {
  const request = buildWorkflowDispatchRequest(
    {
      owner: 'duyduonglam',
      repo: 'flow-eod-scanner',
      workflow: 'eod_scan.yml',
      ref: 'main',
      token: 'token-value',
    },
    { marketDate: '2026-09-03' },
  );

  assert.equal(
    request.url,
    'https://api.github.com/repos/duyduonglam/flow-eod-scanner/actions/workflows/eod_scan.yml/dispatches',
  );
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer token-value');
  assert.deepEqual(JSON.parse(request.init.body), {
    ref: 'main',
    inputs: { market_date: '2026-09-03' },
  });
});

test('omits workflow inputs when no market date override is provided', () => {
  const request = buildWorkflowDispatchRequest(
    {
      owner: 'duyduonglam',
      repo: 'flow-eod-scanner',
      workflow: 'eod_scan.yml',
      ref: 'main',
      token: 'token-value',
    },
    {},
  );

  assert.deepEqual(JSON.parse(request.init.body), { ref: 'main', inputs: {} });
});

test('normalizes valid manual scan dates and rejects invalid dates', () => {
  assert.deepEqual(normalizeManualScanInput({ market_date: ' 2026-09-03 ' }), {
    ok: true,
    marketDate: '2026-09-03',
  });
  assert.deepEqual(normalizeManualScanInput({ marketDate: '' }), { ok: true, marketDate: undefined });
  assert.deepEqual(normalizeManualScanInput({ market_date: '2026-99-99' }), {
    ok: false,
    error: 'Ngay quet khong hop le. Dung dinh dang YYYY-MM-DD.',
  });
});

test('reports missing server-side manual scan configuration', () => {
  assert.deepEqual(readManualScanConfig({}), {
    ok: false,
    missing: ['GITHUB_ACTIONS_DISPATCH_TOKEN', 'MANUAL_SCAN_SECRET'],
  });
});
