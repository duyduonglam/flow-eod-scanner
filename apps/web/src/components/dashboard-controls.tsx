'use client';

import { useState, type FormEvent } from 'react';
import { decisionValues, type DecisionFilter } from '@/lib/scan-view-model';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type DashboardControlsProps = {
  dates: string[];
  selectedDate?: string | null;
  query?: string | null;
  decision?: DecisionFilter | null;
};

function messageFromResponse(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }
  return fallback;
}

export function DashboardControls({ dates, selectedDate, query, decision }: DashboardControlsProps) {
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  function selectDate(value: string) {
    if (!value) return;
    const params = new URLSearchParams(window.location.search);
    params.set('date', value);
    if (query) params.set('q', query);
    if (decision) params.set('decision', decision);
    window.location.assign(`/?${params.toString()}`);
  }

  function selectDecision(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set('decision', value);
      params.delete('date');
    } else {
      params.delete('decision');
    }
    if (query) params.set('q', query);
    window.location.assign(params.toString() ? `/?${params.toString()}` : '/');
  }

  async function submitManualScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    setMessage('Đang gửi lệnh quét ngày hiện tại...');

    try {
      const response = await fetch('/api/scan/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState('error');
        setMessage(messageFromResponse(payload, 'Không gửi được lệnh quét.'));
        return;
      }
      setState('success');
      setMessage(messageFromResponse(payload, 'Đã gửi lệnh quét. Dashboard sẽ cập nhật sau khi workflow hoàn tất.'));
    } catch {
      setState('error');
      setMessage('Không kết nối được API quét thủ công.');
    }
  }

  return (
    <section className={`controlBar ${state}`} aria-label="Điều khiển dashboard">
      <div className="controlGroup searchControl">
        <form className="searchForm" action="/" method="get" role="search" noValidate>
          <div className="searchField">
            <input
              id="ticker-search"
              className="searchInput"
              aria-label="Tên mã cổ phiếu"
              name="q"
              defaultValue={query ?? ''}
              placeholder="VD: VPI, GMD, TCB..."
              autoComplete="off"
              inputMode="text"
              maxLength={12}
            />
            {query ? (
              <a className="searchClearIcon" href="/" aria-label="Xóa tìm kiếm">
                ×
              </a>
            ) : null}
          </div>
          <button className="searchButton" type="submit">
            Tìm mã
          </button>
          {decision ? <input type="hidden" name="decision" value={decision} /> : null}
        </form>
      </div>

      <div className="controlGroup decisionControl">
        <div>
          <label className="sectionLabel" htmlFor="decision-filter-select">
            Decision
          </label>
        </div>
        <select
          id="decision-filter-select"
          className="decisionSelect"
          aria-label="Lọc Decision toàn lịch sử"
          value={decision ?? ''}
          onChange={(event) => selectDecision(event.currentTarget.value)}
        >
          <option value="">Tất cả</option>
          {decisionValues.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="controlGroup dateControl">
        <div>
          <label className="sectionLabel" htmlFor="scan-date-select">
            Lịch sử
          </label>
        </div>
        <select
          id="scan-date-select"
          className="dateSelect"
          aria-label="Chọn ngày scan"
          value={selectedDate ?? ''}
          onChange={(event) => selectDate(event.currentTarget.value)}
          disabled={!dates.length}
        >
          {dates.length ? null : <option value="">Chưa có dữ liệu</option>}
          {dates.map((date) => (
            <option value={date} key={date}>
              {date}
            </option>
          ))}
        </select>
      </div>

      <form className="controlGroup scanControl" onSubmit={submitManualScan} noValidate>
        <div>
          <div className="sectionLabel">Quét thủ công</div>
          {message ? (
            <div className="historyHint" aria-live="polite">
              {message}
            </div>
          ) : null}
        </div>
        <button className="manualScanButton" type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Đang gửi' : 'Quét ngay'}
        </button>
      </form>
    </section>
  );
}
