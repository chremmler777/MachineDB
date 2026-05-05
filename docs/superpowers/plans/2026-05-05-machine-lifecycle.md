# Machine Lifecycle Dates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `in_service_from` / `planned_scrap_from` lifecycle dates to machines and have the capacity engine prorate per-machine availability by month, with edit-form fields and a list-view status badge.

**Architecture:** Two nullable `DATE` columns on `machines`. Capacity engine computes `months_active(machine, year) / 12` per machine and sums fractions instead of integer counts. API surfaces the fields on GET/POST/PUT with date-order validation. Frontend adds month-precision pickers and derives a status badge from today's date.

**Tech Stack:** PostgreSQL, Node.js + Express + TypeScript (backend), React + TypeScript (frontend), `node:test` for backend tests.

**Spec:** `docs/superpowers/specs/2026-05-05-machine-lifecycle-design.md`

---

## File Structure

**Backend — modify:**
- `backend/src/db/migrate.ts` — append `ALTER TABLE machines` adding the two columns + check constraint.
- `backend/src/types/index.ts` — extend `Machine` interface with both fields.
- `backend/src/services/capacity-engine.ts` — extend `MachineRow`, add `monthsActiveInYear()` helper, replace integer machine count with fractional sum.
- `backend/src/services/capacity-data.ts` — `SELECT` the two columns and forward into `MachineRow`.
- `backend/src/routes/machines.ts` — add date validation in `validateAndCoerce` and reject invalid date order in POST/PUT handlers.

**Backend — create:**
- `backend/src/__tests__/lifecycle-overlap.test.ts` — month-overlap helper unit tests.
- `backend/src/__tests__/capacity-engine-lifecycle.test.ts` — fractional-count integration tests.
- `backend/src/__tests__/machines-route-lifecycle.test.ts` — POST/PUT validation tests (validator-level, no HTTP).

**Frontend — modify:**
- `frontend/src/pages/MachineDetailPage.tsx` — add "Lifecycle" section with two month-pickers and inline error.
- `frontend/src/pages/MachineListPage.tsx` — render status badge per row.

**Frontend — create:**
- `frontend/src/components/LifecycleBadge.tsx` — pure component that renders the badge from `(in_service_from, planned_scrap_from, today)`.
- `frontend/src/components/MonthPicker.tsx` — small month + year picker that emits `YYYY-MM-01` or null.

---

## Task 1: Database migration

**Files:**
- Modify: `backend/src/db/migrate.ts` (append a new entry to the migrations array, after the existing capacity-related ALTERs near line 175)

- [ ] **Step 1: Add the migration statement**

Append this entry to the migrations array in `backend/src/db/migrate.ts` (place it after the existing `ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_2k ...` block):

```ts
  // Machine lifecycle dates (Phase: machine-lifecycle)
  `ALTER TABLE machines
     ADD COLUMN IF NOT EXISTS in_service_from DATE,
     ADD COLUMN IF NOT EXISTS planned_scrap_from DATE`,

  `ALTER TABLE machines
     DROP CONSTRAINT IF EXISTS machines_lifecycle_order_chk`,

  `ALTER TABLE machines
     ADD CONSTRAINT machines_lifecycle_order_chk
       CHECK (planned_scrap_from IS NULL
              OR in_service_from IS NULL
              OR planned_scrap_from > in_service_from)`,
```

- [ ] **Step 2: Run the migration against the dev DB**

Run: `docker exec claude-machinedb-backend-1 npm run migrate`
Expected: completes without error; the script prints each statement and ends cleanly.

- [ ] **Step 3: Verify the columns and constraint exist**

Run: `docker exec claude-machinedb-db-1 psql -U postgres -d machinedb -c "\d machines" | grep -E "in_service_from|planned_scrap_from|lifecycle_order"`
Expected: three matching lines (two columns + the check constraint).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "feat(machines): add in_service_from / planned_scrap_from columns"
```

---

## Task 2: Month-overlap helper + tests

**Files:**
- Modify: `backend/src/services/capacity-engine.ts`
- Create: `backend/src/__tests__/lifecycle-overlap.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/__tests__/lifecycle-overlap.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/lifecycle-overlap.test.ts`
Expected: FAIL — `monthsActiveInYear` is not exported.

- [ ] **Step 3: Implement the helper**

Add this exported function to `backend/src/services/capacity-engine.ts` (place it just below the `MachineRow` type, before `qualifies`):

```ts
/**
 * Months a machine is active during calendar year `year`, based on month-precision
 * lifecycle dates. Day component is ignored — `2026-10-15` and `2026-10-01` both
 * mean "active starting October".
 *
 * @param inServiceFrom    'YYYY-MM-DD' or null (null = always-on from -∞)
 * @param plannedScrapFrom 'YYYY-MM-DD' or null (null = no scrap planned, +∞)
 * @param year             integer calendar year
 * @returns integer 0..12
 */
export function monthsActiveInYear(
  inServiceFrom: string | null,
  plannedScrapFrom: string | null,
  year: number,
): number {
  // Convert each bound to "month index" = year*12 + (month-1).
  const yearStartIdx = year * 12;       // Jan of `year`
  const yearEndIdx   = (year + 1) * 12; // Jan of `year+1`

  const startIdx = inServiceFrom
    ? Number(inServiceFrom.slice(0, 4)) * 12 + (Number(inServiceFrom.slice(5, 7)) - 1)
    : -Infinity;
  const endIdx = plannedScrapFrom
    ? Number(plannedScrapFrom.slice(0, 4)) * 12 + (Number(plannedScrapFrom.slice(5, 7)) - 1)
    : Infinity;

  if (endIdx <= startIdx) return 0; // defensive: scrap not strictly after in-service

  const overlapStart = Math.max(startIdx, yearStartIdx);
  const overlapEnd   = Math.min(endIdx, yearEndIdx);
  return Math.max(0, overlapEnd - overlapStart);
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/lifecycle-overlap.test.ts`
Expected: PASS — 10/10 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-engine.ts backend/src/__tests__/lifecycle-overlap.test.ts
git commit -m "feat(capacity): monthsActiveInYear helper for machine lifecycle proration"
```

---

## Task 3: Extend MachineRow and load lifecycle dates

**Files:**
- Modify: `backend/src/services/capacity-engine.ts` (the `MachineRow` type at line 7)
- Modify: `backend/src/services/capacity-data.ts` (the machines `SELECT` and the row mapper)

- [ ] **Step 1: Extend `MachineRow`**

In `backend/src/services/capacity-engine.ts`, replace the existing `MachineRow` type with:

```ts
export type MachineRow = {
  id: number;
  clamping_force_kn: number | null;  // value is in tons despite the name
  iu1_shot_volume_cm3: number | null;
  is_2k: boolean;
  has_mucell: boolean;
  has_variotherm: boolean;
  in_service_from: string | null;     // 'YYYY-MM-DD' or null (= always-on)
  planned_scrap_from: string | null;  // 'YYYY-MM-DD' or null (= no scrap)
};
```

- [ ] **Step 2: Update the SELECT and row mapper in `capacity-data.ts`**

Modify `backend/src/services/capacity-data.ts`. In the `pool.query` for machines, change the SELECT to include the two new columns:

```ts
    pool.query(
      `SELECT id,
              clamping_force_kn,
              iu1_shot_volume_cm3,
              COALESCE(is_2k, false) AS is_2k,
              COALESCE(has_mucell, false) AS has_mucell,
              COALESCE(has_variotherm, false) AS has_variotherm,
              to_char(in_service_from,    'YYYY-MM-DD') AS in_service_from,
              to_char(planned_scrap_from, 'YYYY-MM-DD') AS planned_scrap_from
       FROM machines
       ${plantFilter}`,
      machineParams,
    ),
```

(Using `to_char` avoids node-postgres returning a JS `Date` with TZ surprises — we keep the bare `YYYY-MM-DD` string the engine expects.)

Then, in the row mapper that builds `MachineRow`, append the two fields:

```ts
  const machines: MachineRow[] = machinesResult.rows.map(r => ({
    id: Number(r.id),
    clamping_force_kn: r.clamping_force_kn != null ? Number(r.clamping_force_kn) : null,
    iu1_shot_volume_cm3: r.iu1_shot_volume_cm3 != null ? Number(r.iu1_shot_volume_cm3) : null,
    is_2k: Boolean(r.is_2k),
    has_mucell: Boolean(r.has_mucell),
    has_variotherm: Boolean(r.has_variotherm),
    in_service_from: r.in_service_from ?? null,
    planned_scrap_from: r.planned_scrap_from ?? null,
  }));
```

- [ ] **Step 3: Build the backend to check types**

Run: `docker exec claude-machinedb-backend-1 npm run build`
Expected: build succeeds (existing capacity-engine code that constructs `MachineRow` literals — primarily inside tests — may surface type errors; if any test files fail to compile, add `in_service_from: null, planned_scrap_from: null` to those literals as part of this task).

- [ ] **Step 4: Run the full backend test suite**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test 'src/__tests__/**/*.test.ts'`
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-engine.ts backend/src/services/capacity-data.ts backend/src/__tests__/
git commit -m "feat(capacity): load lifecycle dates into MachineRow"
```

---

## Task 4: Capacity engine — fractional active count per year

**Files:**
- Modify: `backend/src/services/capacity-engine.ts` (the per-year loop near lines 269–323 and the per-class summary near line 340)
- Create: `backend/src/__tests__/capacity-engine-lifecycle.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `backend/src/__tests__/capacity-engine-lifecycle.test.ts`:

```ts
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
  id, clamping_force_kn: 80, iu1_shot_volume_cm3: 1000,
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/capacity-engine-lifecycle.test.ts`
Expected: FAIL — current engine returns integer machine counts (e.g., 1 instead of 0.25).

- [ ] **Step 3: Replace integer counts with fractional sums in the engine**

In `backend/src/services/capacity-engine.ts`, locate the per-year loop (currently around line 269: `for (let year = input.yearFrom; year <= input.yearTo; year++) {`). Replace the existing year-cell construction so that `available`, `free`, `utilization_pct`, and the unconstrained branch all use a fractional active count instead of `machines.length`:

```ts
    for (let year = input.yearFrom; year <= input.yearTo; year++) {
      const activeCount = machines.reduce(
        (sum, mm) => sum + monthsActiveInYear(mm.in_service_from, mm.planned_scrap_from, year) / 12,
        0,
      );

      const cc = classCapacity.find(
        c =>
          c.tonnage_t === tonnage_t &&
          c.requires_2k === requires_2k &&
          c.requires_mucell === requires_mucell &&
          c.requires_variotherm === requires_variotherm &&
          c.year === year,
      );

      if (!cc) {
        yearCells.push({
          year,
          hours_per_machine: 0,
          demand: 0,
          available: activeCount,
          free: activeCount,
          utilization_pct: 0,
          status: 'green',
          contributing_tools: [],
        });
        continue;
      }

      const hours_per_machine = cc.shifts_per_week * 8 * (52 - cc.planned_downtime_wk) * (cc.oee_pct / 100);

      const contributing: { tool_number: string; mach_equivalents: number }[] = [];
      let demand = 0;

      for (const tool of classTools) {
        const vol = volumes.find(vv => vv.tool_id === tool.id && vv.year === year);
        if (!vol || vol.pieces_per_year <= 0 || hours_per_machine <= 0) continue;
        if (!tool.cavities || !tool.rated_cycle_time_sec) continue;
        const pph = (tool.cavities * 3600) / tool.rated_cycle_time_sec;
        if (!Number.isFinite(pph) || pph <= 0) continue;
        const hours = vol.pieces_per_year / pph;
        const me = hours / hours_per_machine;
        if (!Number.isFinite(me)) continue;
        demand += me;
        contributing.push({ tool_number: tool.tool_number, mach_equivalents: me });
      }

      const free = activeCount - demand;
      yearCells.push({
        year,
        hours_per_machine,
        demand,
        available: activeCount,
        free,
        utilization_pct: activeCount > 0 ? (demand / activeCount) * 100 : 0,
        status: statusFor(free),
        contributing_tools: contributing,
      });
    }
```

The per-class summary block immediately below this loop currently sets `machines: machines.length`. Leave that as-is — the class-total field still represents physical machine count, while `years[].available` carries the time-prorated count. This matches the spec ("Capacity API … per-class/year machine counts become numeric").

- [ ] **Step 4: Run the new tests, confirm they pass**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/capacity-engine-lifecycle.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test 'src/__tests__/**/*.test.ts'`
Expected: all tests pass. If a pre-existing `capacity-engine.test.ts` test fails because it asserted on `available` as an integer, update its expected value (e.g., a single always-on machine still returns `available: 1`, so most assertions should hold).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/capacity-engine.ts backend/src/__tests__/capacity-engine-lifecycle.test.ts
git commit -m "feat(capacity): prorate per-machine availability by month for each year"
```

---

## Task 5: Backend API — accept and return lifecycle dates

**Files:**
- Modify: `backend/src/types/index.ts` (the `Machine` interface near line 10)
- Modify: `backend/src/routes/machines.ts` (the `validateAndCoerce` function at line 28 and the POST/PUT handlers at lines 206 and 243)
- Create: `backend/src/__tests__/machines-route-lifecycle.test.ts`

- [ ] **Step 1: Add fields to the `Machine` interface**

In `backend/src/types/index.ts`, inside the `Machine` interface, add two fields just before the `// Meta` block:

```ts
  // Lifecycle
  in_service_from?: string | null;     // 'YYYY-MM-DD'
  planned_scrap_from?: string | null;  // 'YYYY-MM-DD'
```

- [ ] **Step 2: Write failing validator-level tests**

Create `backend/src/__tests__/machines-route-lifecycle.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests, confirm they fail**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/machines-route-lifecycle.test.ts`
Expected: FAIL — `coerceLifecycleDates` and `lifecycleDateOrderError` are not exported.

- [ ] **Step 4: Add the helpers and wire them into the route**

In `backend/src/routes/machines.ts`, near the top (just below `validateAndCoerce`), add:

```ts
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function coerceLifecycleDates<T extends { in_service_from?: any; planned_scrap_from?: any }>(input: T): T {
  for (const key of ['in_service_from', 'planned_scrap_from'] as const) {
    if (!(key in input)) continue;
    const v = (input as any)[key];
    if (v === null || v === undefined) {
      (input as any)[key] = v ?? undefined;
      if (v === null) (input as any)[key] = null;
      continue;
    }
    if (typeof v !== 'string' || v === '' || !ISO_DATE_RE.test(v) || isNaN(Date.parse(v))) {
      (input as any)[key] = null;
    }
  }
  return input;
}

export function lifecycleDateOrderError(
  input: { in_service_from?: string | null; planned_scrap_from?: string | null },
): string | null {
  const a = input.in_service_from;
  const b = input.planned_scrap_from;
  if (!a || !b) return null;
  if (b > a) return null; // ISO 'YYYY-MM-DD' is lex-orderable
  return 'planned_scrap_from must be after in_service_from';
}
```

In the POST handler (line ~206), call both helpers right after `validateAndCoerce`:

```ts
    data = validateAndCoerce(data);
    data = coerceLifecycleDates(data);
    const orderErr = lifecycleDateOrderError(data);
    if (orderErr) return res.status(400).json({ error: orderErr });
```

In the PUT handler (line ~243), do the same right after `validateAndCoerce`. Search for `validateAndCoerce(` inside that handler and add the same two lines below it.

- [ ] **Step 5: Run tests, confirm they pass**

Run: `docker exec claude-machinedb-backend-1 npx tsx --test src/__tests__/machines-route-lifecycle.test.ts`
Expected: PASS — 8/8 tests.

- [ ] **Step 6: Build the backend**

Run: `docker exec claude-machinedb-backend-1 npm run build`
Expected: succeeds.

- [ ] **Step 7: Smoke test the round-trip**

Run (replace `<TOKEN>` with a master JWT from your dev cookies, or skip if running locally without auth):
```bash
docker exec claude-machinedb-db-1 psql -U postgres -d machinedb -c "SELECT id, in_service_from, planned_scrap_from FROM machines LIMIT 3"
```
Expected: rows show `NULL` for both columns (no data yet — populated via UI in Task 6).

- [ ] **Step 8: Commit**

```bash
git add backend/src/types/index.ts backend/src/routes/machines.ts backend/src/__tests__/machines-route-lifecycle.test.ts
git commit -m "feat(machines): lifecycle date validation in POST/PUT routes"
```

---

## Task 6: Frontend — month picker + lifecycle section in edit form

**Files:**
- Create: `frontend/src/components/MonthPicker.tsx`
- Modify: `frontend/src/pages/MachineDetailPage.tsx`

- [ ] **Step 1: Create the month picker component**

Create `frontend/src/components/MonthPicker.tsx`:

```tsx
import React from 'react';

interface Props {
  label: string;
  value: string | null;       // 'YYYY-MM-01' or null
  onChange: (v: string | null) => void;
  error?: string;
  disabled?: boolean;
}

export const MonthPicker: React.FC<Props> = ({ label, value, onChange, error, disabled }) => {
  const monthValue = value ? value.slice(0, 7) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, opacity: 0.8 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="month"
          value={monthValue}
          disabled={disabled}
          onChange={e => {
            const v = e.target.value;
            onChange(v ? `${v}-01` : null);
          }}
          style={{ padding: '4px 6px' }}
        />
        {monthValue && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            style={{ fontSize: 11, padding: '2px 6px' }}
          >
            Clear
          </button>
        )}
      </div>
      {error && <span style={{ color: '#d33', fontSize: 11 }}>{error}</span>}
    </div>
  );
};
```

- [ ] **Step 2: Add the Lifecycle section to the machine detail page**

Open `backend/src/routes/machines.ts` and confirm POST/PUT now persist these fields (they will, since `data[key]` is iterated in the dynamic INSERT/UPDATE). Then in `frontend/src/pages/MachineDetailPage.tsx`:

a. Add the import near the top:
```tsx
import { MonthPicker } from '../components/MonthPicker';
```

b. Find where the form section JSX is rendered (search for `internal_name` in the file to locate the existing field markup). Just above the existing "Meta" / "Remarks" section (or wherever sections like "Robot" end), add a new "Lifecycle" section:

```tsx
{/* Lifecycle */}
<div style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
  <h3 style={{ marginTop: 0 }}>Lifecycle</h3>
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <MonthPicker
      label="In service from"
      value={machine.in_service_from ?? null}
      onChange={v => setMachine({ ...machine, in_service_from: v })}
      disabled={!isEditing}
    />
    <MonthPicker
      label="Planned scrap from"
      value={machine.planned_scrap_from ?? null}
      onChange={v => setMachine({ ...machine, planned_scrap_from: v })}
      error={lifecycleOrderError(machine)}
      disabled={!isEditing}
    />
  </div>
</div>
```

c. Add the inline validator helper at the top of the file (just below imports):

```tsx
function lifecycleOrderError(m: { in_service_from?: string | null; planned_scrap_from?: string | null }): string | undefined {
  if (!m.in_service_from || !m.planned_scrap_from) return undefined;
  return m.planned_scrap_from > m.in_service_from ? undefined : 'Must be after In service from';
}
```

d. In the save handler (search for the function that posts/puts to `/api/machines`), gate the submit on the validator:

```tsx
if (lifecycleOrderError(machine)) {
  alert('Planned scrap must be after In service from');
  return;
}
```

(Adapt the variable names — `machine`, `setMachine`, `isEditing` — to whatever the existing component uses. If the component holds state under different names, use the equivalents.)

- [ ] **Step 3: Build and deploy the frontend**

Run:
```bash
cd /home/nitrolinux/claude/machinedb/frontend && VITE_API_URL=/machinedb/api npm run build && docker cp dist/. claude-machinedb-frontend-1:/app/dist/
```
Expected: TypeScript build succeeds, dist files copied into the container.

- [ ] **Step 4: Manual smoke test**

In the browser, open a machine detail page in edit mode. Verify:
- Lifecycle section renders with two empty pickers.
- Setting "In service from" = `2026-10`, save, reload → value persists and round-trips.
- Setting "Planned scrap from" earlier than "In service from" → inline error shown, save blocked.
- Clearing both fields → both store null, no error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MonthPicker.tsx frontend/src/pages/MachineDetailPage.tsx
git commit -m "feat(machines-ui): lifecycle section with month pickers and inline validation"
```

---

## Task 7: Frontend — lifecycle status badge in machine list

**Files:**
- Create: `frontend/src/components/LifecycleBadge.tsx`
- Modify: `frontend/src/pages/MachineListPage.tsx`

- [ ] **Step 1: Create the badge component**

Create `frontend/src/components/LifecycleBadge.tsx`:

```tsx
import React from 'react';

interface Props {
  inServiceFrom?: string | null;     // 'YYYY-MM-DD'
  plannedScrapFrom?: string | null;  // 'YYYY-MM-DD'
  today?: Date;                      // injectable for tests
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(date: string): string {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  return `${MONTHS[m - 1]} ${y}`;
}

export function deriveBadge(
  inServiceFrom: string | null | undefined,
  plannedScrapFrom: string | null | undefined,
  today: Date,
): { text: string; color: string } | null {
  const todayStr = today.toISOString().slice(0, 10);

  if (inServiceFrom && inServiceFrom > todayStr) {
    return { text: `Arriving ${fmt(inServiceFrom)}`, color: '#d4a017' };
  }
  if (plannedScrapFrom && plannedScrapFrom <= todayStr) {
    return { text: `Scrapped ${fmt(plannedScrapFrom)}`, color: '#888' };
  }
  if (plannedScrapFrom) {
    const horizon = new Date(today); horizon.setMonth(horizon.getMonth() + 12);
    const horizonStr = horizon.toISOString().slice(0, 10);
    if (plannedScrapFrom <= horizonStr) {
      return { text: `Scrapping ${fmt(plannedScrapFrom)}`, color: '#d97706' };
    }
  }
  return null;
}

export const LifecycleBadge: React.FC<Props> = ({ inServiceFrom, plannedScrapFrom, today = new Date() }) => {
  const b = deriveBadge(inServiceFrom ?? null, plannedScrapFrom ?? null, today);
  if (!b) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 11,
      background: b.color,
      color: 'white',
      whiteSpace: 'nowrap',
    }}>
      {b.text}
    </span>
  );
};
```

- [ ] **Step 2: Render the badge in the machine list**

In `frontend/src/pages/MachineListPage.tsx`:

a. Add the import near the top:
```tsx
import { LifecycleBadge } from '../components/LifecycleBadge';
```

b. Find where each row's name/title cell is rendered (search for `internal_name` to locate the row JSX). Add the badge next to (or just under) the machine name:

```tsx
<LifecycleBadge
  inServiceFrom={m.in_service_from}
  plannedScrapFrom={m.planned_scrap_from}
/>
```

- [ ] **Step 3: Build and deploy the frontend**

Run:
```bash
cd /home/nitrolinux/claude/machinedb/frontend && VITE_API_URL=/machinedb/api npm run build && docker cp dist/. claude-machinedb-frontend-1:/app/dist/
```
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Browser:
- A machine with `in_service_from = 2026-10-01` (set in Task 6) shows yellow `Arriving Oct 2026` badge.
- Set another machine's `planned_scrap_from = 2026-09-01` (one month from "today" in dev) → orange `Scrapping Sep 2026`.
- Set a third's `planned_scrap_from = 2024-01-01` → gray `Scrapped Jan 2024`.
- Machines with both fields null show no badge.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/LifecycleBadge.tsx frontend/src/pages/MachineListPage.tsx
git commit -m "feat(machines-ui): lifecycle status badge in machine list"
```

---

## Task 8: End-to-end verification with the real USA October 2026 machine

**Files:** none modified — operational/data step.

- [ ] **Step 1: Capture pre-state**

Run:
```bash
docker exec claude-machinedb-backend-1 curl -s 'http://localhost:3000/api/capacity?plant=USA' | jq '.[] | {label, machines, available_2026: .years[0].available, available_2027: .years[1].available}'
```
(Adjust the URL/auth as needed for your dev setup.) Save the output as the baseline.

- [ ] **Step 2: Add the new USA machine via the UI**

In the browser, create the new machine for the USA plant with the appropriate tonnage and capability flags. Set:
- `in_service_from = 2026-10-01`
- `planned_scrap_from = (leave empty)`

- [ ] **Step 3: Verify capacity numbers move correctly**

Re-run the capacity query from Step 1. For the relevant tonnage class:
- 2026 `available` increased by exactly 0.25 vs. baseline.
- 2027 `available` increased by exactly 1.0 vs. baseline.

If both deltas match, the feature is live and correct.

- [ ] **Step 4: Confirm the badge shows up**

In the machine list, the new machine displays the yellow `Arriving Oct 2026` badge.

- [ ] **Step 5: Final commit (if any cleanup needed)**

If everything verifies, no commit needed. Otherwise, commit any small UI/copy fixes encountered during verification.

---

## Self-Review Notes

- **Spec coverage:**
  - DB columns + constraint → Task 1
  - Engine month-precision proration → Tasks 2 & 4
  - API GET/POST/PUT round-trip + validation → Tasks 3 & 5
  - Edit-form fields with inline validation → Task 6
  - List-view badge across the four states → Task 7
  - Rollout step (planner adds USA Oct 2026 machine) → Task 8
- **Type consistency:** `MachineRow` (engine) and `Machine` (API/types) both gain `in_service_from`/`planned_scrap_from` of type `string | null` (`'YYYY-MM-DD'` or null). Frontend pickers emit the same shape (`'YYYY-MM-01'`).
- **No placeholders:** every step contains the code or command needed; no "implement appropriately" stubs.
