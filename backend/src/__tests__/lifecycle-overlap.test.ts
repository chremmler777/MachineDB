import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsActiveInYear } from '../services/capacity-engine.js';

test('monthsActiveInYear: both null → 12', () => {
  assert.equal(monthsActiveInYear(null, null, 2026), 12);
});

test('monthsActiveInYear: in_service_from before year → 12', () => {
  assert.equal(monthsActiveInYear('2020-03-01', null, 2026), 12);
});

test('monthsActiveInYear: in_service_from = Oct of target year → 3', () => {
  assert.equal(monthsActiveInYear('2026-10-01', null, 2026), 3);
});

test('monthsActiveInYear: in_service_from = Jan 1 of next year → 0', () => {
  assert.equal(monthsActiveInYear('2027-01-01', null, 2026), 0);
});

test('monthsActiveInYear: scrap = Mar of target year → 2 (Jan+Feb)', () => {
  assert.equal(monthsActiveInYear(null, '2027-03-01', 2027), 2);
});

test('monthsActiveInYear: scrap before year → 0', () => {
  assert.equal(monthsActiveInYear(null, '2025-06-01', 2026), 0);
});

test('monthsActiveInYear: scrap after year → 12', () => {
  assert.equal(monthsActiveInYear(null, '2030-01-01', 2026), 12);
});

test('monthsActiveInYear: in_service Apr, scrap Oct same year → 6', () => {
  assert.equal(monthsActiveInYear('2026-04-01', '2026-10-01', 2026), 6);
});

test('monthsActiveInYear: in_service after scrap → 0 (defensive)', () => {
  assert.equal(monthsActiveInYear('2026-10-01', '2026-04-01', 2026), 0);
});

test('monthsActiveInYear: day-of-month ignored, only month matters', () => {
  assert.equal(monthsActiveInYear('2026-10-15', null, 2026), 3);
  assert.equal(monthsActiveInYear('2026-10-31', null, 2026), 3);
});
