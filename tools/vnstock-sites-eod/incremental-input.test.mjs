import assert from 'node:assert/strict';
import test from 'node:test';
import { decideIncrementalInput } from './incremental-input.mjs';

const dates = Array.from({length: 262}, (_, i) => new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10));
const bar = date => [date, 30, 31, 29, 30.5, 100_000, 1, 1000];
const fixture = () => ({
  marketSessions: dates,
  cached: dates.slice(0, -1).map(bar),
  observed: dates.slice(-6).map(bar),
  eventEvidence: {verified: true, digest: 'event-v1', checkedThrough: dates.at(-1),
    checkedFrom: dates.at(-6), referenceAsOf: 'revision-1'},
  cacheEvidence: {verified: true, adjustmentPolicy: 'DIVIDE_BY_ADJRATIO', eventDigest: 'event-v1',
    referenceAsOf: 'revision-1'},
});

test('valid overlap reuses history and returns only T', () => {
  assert.deepEqual(decideIncrementalInput(fixture()), {action: 'REUSE', bar: bar(dates.at(-1))});
});
test('BAF-like change in the historical ratio forces refetch even when T has ratio 1', () => {
  const input = fixture();
  input.observed[0][6] = 1.0549376475;
  assert.deepEqual(decideIncrementalInput(input), {action: 'REFETCH', reason: 'DIRTY_SYMBOL'});
});
test('a source timeout is not proof of no corporate events', () => {
  const input = fixture();
  input.eventEvidence = null;
  assert.equal(decideIncrementalInput(input).reason, 'CA_COVERAGE_GAP');
});
test('event digest or adjustment reference changes force refetch', () => {
  const changed = fixture();
  changed.eventEvidence.digest = 'event-v2';
  assert.equal(decideIncrementalInput(changed).reason, 'EVENT_DIGEST_CHANGED');
  const reference = fixture();
  reference.eventEvidence.referenceAsOf = 'revision-2';
  assert.equal(decideIncrementalInput(reference).reason, 'CACHE_BASIS_UNVERIFIED');
});
test('stale and invalid data never reuse cache', () => {
  const stale = fixture();
  stale.observed.pop();
  assert.equal(decideIncrementalInput(stale).reason, 'STALE');
  const invalid = fixture();
  invalid.observed.at(-1)[6] = 0;
  assert.equal(decideIncrementalInput(invalid).reason, 'INVALID_RAW_BAR');
});
