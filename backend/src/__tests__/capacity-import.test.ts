import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseClassCapacity, parseToolSheet } from '../services/capacity-import.js';

// ── Task 13: parseClassCapacity ───────────────────────────────────────────────

test('parseClassCapacity: extracts rows from Total Overview Capacity sheet', () => {
  // Build a minimal in-memory workbook matching the real sheet's layout:
  //   row 2: header with "No Flex" at col 1, "OEE %" at col 2, years at col 6+
  //   row 3: blank
  //   row 4: class row with label at col 1, OEE at col 2, shifts at col 4, values at col 6+
  const ws = XLSX.utils.aoa_to_sheet([
    [],  // row 0
    [],  // row 1
    [null, 'No Flex', 'OEE %', null, 'Shifts / week', null, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
    [],  // row 3 blank
    [null, 'KM 80', 85, '%', 15, null, 0.03, 0.18, 0.18, 0.19, 1.90, 1.32, 1.25, 0.88, 1.11, 0.83, 0.70, 0.10, 0.0],
    [null, 'Utilization'],
    [],  // blank
    [null, null, 'OEE %', null, 'Shifts / week', null, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
    [],  // blank
    [null, 'KM 200', 85, '%', 15, null, 0.08, 1.80, 2.26, 2.22, 2.54, 2.72, 2.23, 1.90, 1.76, 1.74, 1.15, 0.32, 0.04],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Total Overview Capacity');

  const rows = parseClassCapacity(wb, 2025, 2027);

  // Expect KM 80 entries for 2025, 2026, 2027 with OEE=85, shifts=15
  const km80 = rows.filter(r => r.label === 'KM 80');
  assert.equal(km80.length, 3, `Expected 3 KM 80 rows, got ${km80.length}`);
  assert.equal(km80[0].oee_pct, 85);
  assert.equal(km80[0].shifts_per_week, 15);
  assert.equal(km80[0].tonnage_t, 80);
  assert.equal(km80[0].requires_2k, false);

  // Expect KM 200 entries for 2025, 2026, 2027
  const km200 = rows.filter(r => r.label === 'KM 200');
  assert.equal(km200.length, 3, `Expected 3 KM 200 rows, got ${km200.length}`);
  assert.equal(km200[0].tonnage_t, 200);
});

test('parseClassCapacity: year filter works — only returns requested years', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [null, 'No Flex', 'OEE %', null, 'Shifts / week', null, 2024, 2025, 2026, 2027, 2028],
    [],
    [null, 'KM 350', 85, '%', 15, null, 1.0, 1.2, 1.3, 1.1, 0.9],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Total Overview Capacity');

  const rows = parseClassCapacity(wb, 2026, 2027);
  assert.equal(rows.length, 2);
  const years = rows.map(r => r.year).sort();
  assert.deepEqual(years, [2026, 2027]);
});

test('parseClassCapacity: 2K flag parsed from label', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [null, 'No Flex', 'OEE %', null, 'Shifts / week', null, 2026],
    [],
    [null, 'KM 350 2K', 85, '%', 15, null, 1.0],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Total Overview Capacity');

  const rows = parseClassCapacity(wb, 2026, 2026);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requires_2k, true);
  assert.equal(rows[0].tonnage_t, 350);
});

test('parseClassCapacity: throws if sheet is missing', () => {
  const wb = XLSX.utils.book_new();
  assert.throws(() => parseClassCapacity(wb, 2025, 2026), /Total Overview Capacity/);
});

// ── Task 14: parseToolSheet ───────────────────────────────────────────────────

test('parseToolSheet: extracts tools + cavity + cycle from a KM-XXX sheet', () => {
  // Matches the actual layout: col 0 = null for KM 200-style
  const ws = XLSX.utils.aoa_to_sheet([
    [], [], [], [], [], [], [], [],  // rows 0-7
    // row 8: Tool # header
    [null, 'Tool #', 820, null, null, null, 'Tool #', 821, null, null, null, 'Tool #', 822],
    // row 9: Pieces header
    [null, 'Pieces', null, 'Operator', 'Raw Matrial', null, 'Pieces', null, 'Operator', 'Raw Matrial', null, 'Pieces', null, 'Operator', 'Raw Matrial',
     null, null, 'Tool #', 2025, 2026, 2027],
    // row 10: cavity
    [null, 'cavity', 2, null, null, null, 'cavity', 1, null, null, null, 'cavity', 1,
     null, null, null, null, null],
    // row 11: cycle time
    [null, 'cycle time sec.', 45, null, null, null, 'cycle time sec.', 45, null, null, null, 'cycle time sec.', 45,
     null, null, null, null, 820, 0.12, 0.13, 0.0],
    // row 12: piece/hr
    [null, 'piece/hr. ', 136, 0.5, 4.88, null, 'piece/hr. ', 68, 0.5, 2.15, null, 'piece/hr. ', 68, 0.5, 2.20,
     null, null, 821, 0.24, 0.25, 0.0],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KM 200');

  const { tools, volumes } = parseToolSheet(wb, 'KM 200');

  assert.equal(tools.length, 3, `Expected 3 tools, got ${tools.length}`);
  assert.equal(tools[0].tool_number, '820');
  assert.equal(tools[0].cavities, 2);
  assert.equal(tools[0].rated_cycle_time_sec, 45);
  assert.equal(tools[1].tool_number, '821');
  assert.equal(tools[1].cavities, 1);
  assert.equal(tools[2].tool_number, '822');
});

test('parseToolSheet: handles composite tool numbers like "3129 / 3317"', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [], [], [], [], [], [], [], [],
    [null, 'Tool #', '3129 / 3317', null, null, null, 'Tool #', 820],
    [null, 'Pieces', null, 'Operator', 'Raw Matrial', null, 'Pieces', null, 'Operator', 'Raw Matrial',
     null, null, null, null, null, null, null, 'Tool #', 2026],
    [null, 'cavity', 2, null, null, null, 'cavity', 1],
    [null, 'cycle time sec.', 45, null, null, null, 'cycle time sec.', 30,
     null, null, null, null, null, null, null, null, null, '3129 / 3317', 0.5],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KM 80');

  const { tools, volumes } = parseToolSheet(wb, 'KM 80');

  // Composite tool number stored as full string
  const composite = tools.find(t => t.tool_number === '3129 / 3317');
  assert.ok(composite, 'Should find composite tool number');
  assert.equal(composite!.cavities, 2);

  // Volumes from forecast table
  assert.ok(volumes.length > 0, 'Should have volumes');
  const compositeVol = volumes.find(v => v.tool_number === '3129 / 3317');
  assert.ok(compositeVol, 'Should have volume for composite tool');
  assert.equal(compositeVol!.year, 2026);
  assert.ok(compositeVol!.machine_equivalents > 0);
});

test('parseToolSheet: throws if sheet is missing', () => {
  const wb = XLSX.utils.book_new();
  assert.throws(() => parseToolSheet(wb, 'KM 999'), /KM 999/);
});

test('parseToolSheet: no volumes emitted for zero machine_equivalents', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [], [], [], [], [], [], [], [],
    [null, 'Tool #', 820],
    [null, 'Pieces', null, 'Operator', 'Raw Matrial',
     null, null, null, null, null, null, null, null, null, null, null, null, 'Tool #', 2026, 2027],
    [null, 'cavity', 2],
    [null, 'cycle time sec.', 45,
     null, null, null, null, null, null, null, null, null, null, null, null, null, null, 820, 0, 0],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KM 200');

  const { volumes } = parseToolSheet(wb, 'KM 200');
  assert.equal(volumes.length, 0, 'Should emit no volumes for zero values');
});
