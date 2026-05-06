import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCapacity } from '../services/capacity-engine.js';
import type { MachineRow, Tool, ClassCapacityRow } from '../services/capacity-engine.js';

const baseCC: ClassCapacityRow = {
  tonnage_t: 80, requires_2k: false, requires_mucell: false, requires_variotherm: false,
  year: 2026, oee_pct: 100, shifts_per_week: 15,
  working_days_year: 240, planned_downtime_wk: 2,
};

const m = (id: number, opts: Partial<MachineRow> = {}): MachineRow => ({
  id, clamping_force_t: 80, iu1_shot_volume_cm3: 1000,
  is_2k: false, has_mucell: false, has_variotherm: false,
  in_service_from: null, planned_scrap_from: null, ...opts,
});

test('lifecycle: always-on machine contributes 1.0 in every year', () => {
  const out = computeCapacity({
    machines: [m(1)],
    tools: [],
    volumes: [],
    classCapacity: [baseCC, { ...baseCC, year: 2027 }],
    yearFrom: 2026, yearTo: 2027,
  });
  const cls = out.find(c => c.tonnage_t === 80)!;
  assert.equal(cls.machines, 1);                       // class total
  assert.equal(cls.years[0].available, 1);             // 2026
  assert.equal(cls.years[1].available, 1);             // 2027
});

test('lifecycle: machine arriving Oct 2026 counts 0.25 in 2026, 1.0 in 2027', () => {
  const out = computeCapacity({
    machines: [m(1, { in_service_from: '2026-10-01' })],
    tools: [],
    volumes: [],
    classCapacity: [baseCC, { ...baseCC, year: 2027 }],
    yearFrom: 2026, yearTo: 2027,
  });
  const cls = out.find(c => c.tonnage_t === 80)!;
  assert.equal(cls.years[0].year, 2026);
  assert.equal(cls.years[0].available, 0.25);
  assert.equal(cls.years[1].available, 1);
});

test('lifecycle: two machines, one always-on + one arriving Oct 2026 → 1.25 / 2.0', () => {
  const out = computeCapacity({
    machines: [m(1), m(2, { in_service_from: '2026-10-01' })],
    tools: [],
    volumes: [],
    classCapacity: [baseCC, { ...baseCC, year: 2027 }],
    yearFrom: 2026, yearTo: 2027,
  });
  const cls = out.find(c => c.tonnage_t === 80)!;
  assert.equal(cls.years[0].available, 1.25);
  assert.equal(cls.years[1].available, 2);
});

test('lifecycle: machine scrapped Mar 2027 → 1.0 in 2026, ~0.1667 in 2027', () => {
  const out = computeCapacity({
    machines: [m(1, { planned_scrap_from: '2027-03-01' })],
    tools: [],
    volumes: [],
    classCapacity: [baseCC, { ...baseCC, year: 2027 }],
    yearFrom: 2026, yearTo: 2027,
  });
  const cls = out.find(c => c.tonnage_t === 80)!;
  assert.equal(cls.years[0].available, 1);
  assert.ok(Math.abs(cls.years[1].available - 2 / 12) < 1e-9);
});
