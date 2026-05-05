import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coerceLifecycleDates, lifecycleDateOrderError } from '../routes/machines.js';

test('coerce: YYYY-MM-DD passes through', () => {
  const out = coerceLifecycleDates({ in_service_from: '2026-10-01' });
  assert.equal(out.in_service_from, '2026-10-01');
});

test('coerce: empty string → null', () => {
  const out = coerceLifecycleDates({ in_service_from: '', planned_scrap_from: '' });
  assert.equal(out.in_service_from, null);
  assert.equal(out.planned_scrap_from, null);
});

test('coerce: undefined → undefined (untouched)', () => {
  const out = coerceLifecycleDates({});
  assert.equal('in_service_from' in out, false);
});

test('coerce: malformed string → null', () => {
  const out = coerceLifecycleDates({ in_service_from: 'October 2026' });
  assert.equal(out.in_service_from, null);
});

test('order error: scrap > service → null', () => {
  assert.equal(
    lifecycleDateOrderError({ in_service_from: '2026-01-01', planned_scrap_from: '2027-01-01' }),
    null,
  );
});

test('order error: scrap = service → string', () => {
  assert.match(
    lifecycleDateOrderError({ in_service_from: '2026-10-01', planned_scrap_from: '2026-10-01' })!,
    /must be after/,
  );
});

test('order error: scrap < service → string', () => {
  assert.match(
    lifecycleDateOrderError({ in_service_from: '2026-10-01', planned_scrap_from: '2026-04-01' })!,
    /must be after/,
  );
});

test('order error: either null → null', () => {
  assert.equal(lifecycleDateOrderError({ in_service_from: null, planned_scrap_from: '2027-01-01' }), null);
  assert.equal(lifecycleDateOrderError({ in_service_from: '2026-01-01', planned_scrap_from: null }), null);
});
