'use client';

import { useState, type FormEvent } from 'react';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type ManualScanControlProps = {
  defaultDate?: string | null;
};

function dateInputValue(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function messageFromResponse(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }
  return fallback;
}

export function ManualScanControl({ defaultDate }: ManualScanControlProps) {
  const [marketDate, setMarketDate] = useState(dateInputValue(defaultDate));
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('Tự động: 16:00 Asia/Ho_Chi_Minh hằng ngày.');

  async function submitManualScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    setMessage('Đang gửi lệnh quét...');

    try {
      const response = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-manual-scan-secret': secret,
        },
        body: JSON.stringify({ market_date: marketDate || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState('error');
        setMessage(messageFromResponse(payload, 'Không gửi được lệnh quét.'));
        return;
      }
      setState('success');
      setMessage('Đã gửi lệnh quét. Dashboard sẽ cập nhật sau khi workflow hoàn tất.');
    } catch {
      setState('error');
      setMessage('Không kết nối được API quét thủ công.');
    }
  }

  return (
    <section className={`manualScanPanel ${state}`} aria-label="Quét thủ công">
      <div className="manualScanCopy">
        <div className="sectionLabel">Quét thủ công</div>
        <div className="historyHint" aria-live="polite">
          {message}
        </div>
      </div>
      <form className="manualScanForm" onSubmit={submitManualScan} noValidate>
        <input
          className="manualScanInput"
          aria-label="Ngày quét"
          type="date"
          value={marketDate}
          onChange={(event) => setMarketDate(event.currentTarget.value)}
        />
        <div className="secretField">
          <input
            className="manualScanInput manualScanSecret"
            aria-label="Mã kích hoạt"
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={(event) => setSecret(event.currentTarget.value)}
            placeholder="Mã kích hoạt"
            autoComplete="one-time-code"
          />
          <button
            className="secretToggle"
            type="button"
            aria-label={showSecret ? 'Ẩn mã kích hoạt' : 'Hiện mã kích hoạt'}
            aria-pressed={showSecret}
            onClick={() => setShowSecret((value) => !value)}
          >
            {showSecret ? 'Ẩn' : 'Hiện'}
          </button>
        </div>
        <button className="manualScanButton" type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Đang gửi' : 'Quét ngay'}
        </button>
      </form>
    </section>
  );
}
