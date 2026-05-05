import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifies, computeCapacity } from '../services/capacity-engine.js';
import type { MachineRow, Tool, ClassCapacityRow } from '../services/capacity-engine.js';

// ── Task 5: qualifies() ──────────────────────────────────────────────────────

test('qualifies: tonnage in range, no flags required, all OK', () => {
  const machine = { id: 1, clamping_force_kn: 350, iu1_shot_volume_cm3: 800, is_2k: false, has_mucell: false, has_variotherm: true, in_service_from: null, planned_scrap_from: null };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: 400, shot_volume_required_cm3: 600,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  assert.equal(qualifies(machine, tool).ok, true);
});

test('qualifies: tonnage below min → fails with reason', () => {
  const machine = { id: 1, clamping_force_kn: 200, iu1_shot_volume_cm3: 800, is_2k: false, has_mucell: false, has_variotherm: false, in_service_from: null, planned_scrap_from: null };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 100,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  const r = qualifies(machine, tool);
  assert.equal(r.ok, false);
  assert.match(r.reason!, /tonnage/i);
});

test('qualifies: shot volume insufficient → fails', () => {
  const machine = { id: 1, clamping_force_kn: 350, iu1_shot_volume_cm3: 500, is_2k: false, has_mucell: false, has_variotherm: false, in_service_from: null, planned_scrap_from: null };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 800,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  assert.equal(qualifies(machine, tool).ok, false);
});

test('qualifies: requires_2k but machine lacks → fails', () => {
  const machine = { id: 1, clamping_force_kn: 1300, iu1_shot_volume_cm3: 5000, is_2k: false, has_mucell: false, has_variotherm: false, in_service_from: null, planned_scrap_from: null };
  const tool = { qualified_min_tonnage_t: 1300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 100,
                 requires_2k: true, requires_mucell: false, requires_variotherm: false };
  const r = qualifies(machine, tool);
  assert.equal(r.ok, false);
  assert.match(r.reason!, /2k/i);
});

// ── Task 6: computeCapacity() ────────────────────────────────────────────────

const machinesFixture: MachineRow[] = [
  { id: 1, clamping_force_kn: 350, iu1_shot_volume_cm3: 1000, is_2k: false, has_mucell: false, has_variotherm: true, in_service_from: null, planned_scrap_from: null },
  { id: 2, clamping_force_kn: 350, iu1_shot_volume_cm3: 1000, is_2k: false, has_mucell: false, has_variotherm: true, in_service_from: null, planned_scrap_from: null },
];

const classCapacityFixture: ClassCapacityRow[] = [
  { tonnage_t: 350, requires_2k: false, requires_mucell: false, requires_variotherm: true,
    year: 2026, oee_pct: 85, shifts_per_week: 15, working_days_year: 240, planned_downtime_wk: 2 },
];

test('computeCapacity: hours_per_machine_per_year = shifts*8*(52-downtime)*OEE', () => {
  const expected = 15 * 8 * (52 - 2) * 0.85; // 5100
  const grid = computeCapacity({
    machines: machinesFixture, tools: [], volumes: [], classCapacity: classCapacityFixture,
    yearFrom: 2026, yearTo: 2026,
  });
  assert.equal(grid.length, 1);
  assert.equal(grid[0].years[0].hours_per_machine, expected);
});

test('computeCapacity: one tool 2 cav 45s 750k pcs/yr → demand ≈ 0.92 mach', () => {
  const tool: Tool = {
    id: 100, tool_number: '3450', cavities: 2, rated_cycle_time_sec: 45,
    qualified_min_tonnage_t: 300, qualified_max_tonnage_t: 400, shot_volume_required_cm3: 0,
    requires_2k: false, requires_mucell: false, requires_variotherm: true,
    assigned_machine_id: 1, status: 'active',
  };
  const grid = computeCapacity({
    machines: machinesFixture, tools: [tool],
    volumes: [{ tool_id: 100, year: 2026, pieces_per_year: 750000 }],
    classCapacity: classCapacityFixture,
    yearFrom: 2026, yearTo: 2026,
  });
  const cell = grid[0].years[0];
  // pieces_per_hour = 2*3600/45 = 160; hours = 750000/160 = 4687.5; mach_eq = 4687.5/5100 ≈ 0.919
  assert.ok(Math.abs(cell.demand - 0.919) < 0.01, `expected ~0.919 demand, got ${cell.demand}`);
  assert.equal(cell.available, 2);
  assert.ok(Math.abs(cell.free - (2 - 0.919)) < 0.01);
});

test('computeCapacity: status from free machines', () => {
  const grid = computeCapacity({
    machines: machinesFixture, tools: [], volumes: [], classCapacity: classCapacityFixture,
    yearFrom: 2026, yearTo: 2026,
  });
  assert.equal(grid[0].years[0].status, 'green');
});

test('computeCapacity: modification add_tool overlays without mutating input', () => {
  const baseTools: Tool[] = [];
  const grid = computeCapacity({
    machines: machinesFixture, tools: baseTools, volumes: [],
    classCapacity: classCapacityFixture,
    yearFrom: 2026, yearTo: 2026,
    modifications: [{
      type: 'add_tool',
      tool: {
        tool_number: '9999', cavities: 4, rated_cycle_time_sec: 38,
        qualified_min_tonnage_t: 300, qualified_max_tonnage_t: 400, shot_volume_required_cm3: 0,
        requires_2k: false, requires_mucell: false, requires_variotherm: true,
        target_machine_id: 1,
      },
      volumes: [{ year: 2026, pieces_per_year: 250000 }],
    }],
  });
  assert.ok(grid[0].years[0].demand > 0, 'demand should reflect overlay');
  assert.equal(baseTools.length, 0, 'input array must not be mutated');
});
