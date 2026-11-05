// Data Acquisition v1.2.4 §61. The caller validates event and cache provenance.
const sameQuote = (a, b) =>
  [1, 2, 3, 4, 5, 7].every(index => a[index] === b[index]) &&
  Math.abs(a[6] - b[6]) <= 1e-6;

function validBar(bar, unit) {
  if (!Array.isArray(bar) || bar.length !== 8 || typeof bar[0] !== 'string') return false;
  const [, open, high, low, close, volume, ratio, scale] = bar;
  return [open, high, low, close, volume, ratio].every(Number.isFinite) &&
    low > 0 && high >= Math.max(open, close, low) &&
    low <= Math.min(open, close) && volume >= 0 && ratio > 0 && scale === unit;
}

export function decideIncrementalInput({ marketSessions, cached, observed, cacheEvidence, eventEvidence }) {
  const dates = marketSessions.slice(-6);
  if (dates.length !== 6 || dates.some((date, i) => i > 0 && date <= dates[i - 1])) {
    throw new Error('INVALID_BENCHMARK_SESSIONS');
  }
  if (observed.some(bar => !validBar(bar, 1000) || !dates.includes(bar[0]))) {
    return { action: 'BLOCK', reason: 'INVALID_RAW_BAR' };
  }
  const byDate = new Map(observed.map(bar => [bar[0], bar]));
  if (byDate.size !== observed.length) return { action: 'BLOCK', reason: 'DUPLICATE_SESSION' };
  if (!byDate.has(dates.at(-1))) return { action: 'BLOCK', reason: 'STALE' };
  const historical = new Map(cached.map(bar => [bar[0], bar]));
  if (cached.length < 261 || historical.size !== cached.length ||
      dates.slice(0, -1).some(date => !historical.has(date) || !byDate.has(date))) {
    return { action: 'REFETCH', reason: 'HISTORY_OR_OVERLAP_GAP' };
  }
  if (dates.some(date => historical.has(date) && !sameQuote(historical.get(date), byDate.get(date)))) {
    return { action: 'REFETCH', reason: 'DIRTY_SYMBOL' };
  }
  if (!eventEvidence?.verified || !eventEvidence.digest || !cacheEvidence?.eventDigest ||
      eventEvidence.checkedThrough !== dates.at(-1) || eventEvidence.checkedFrom > dates[0] ||
      typeof eventEvidence.checkedFrom !== 'string') {
    return { action: 'BLOCK', reason: 'CA_COVERAGE_GAP' };
  }
  if (cacheEvidence.eventDigest !== eventEvidence.digest) {
    return { action: 'REFETCH', reason: 'EVENT_DIGEST_CHANGED' };
  }
  if (!cacheEvidence.verified || cacheEvidence.adjustmentPolicy !== 'DIVIDE_BY_ADJRATIO' ||
      cacheEvidence.referenceAsOf !== eventEvidence.referenceAsOf || !eventEvidence.referenceAsOf ||
      cached.some(bar => !validBar(bar, 1000))) {
    return { action: 'REFETCH', reason: 'CACHE_BASIS_UNVERIFIED' };
  }
  return { action: 'REUSE', bar: byDate.get(dates.at(-1)) };
}
