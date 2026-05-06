# 2K Machine Type Identifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `two_k_type` enum column to `machines`, backfill 22 known rows, expose it through filtered list / capacity rollup / vocabulary endpoints, add a UI dropdown, and rename `clamping_force_kn` → `clamping_force_t` (legacy mis-naming).

**Architecture:** Single migration adds the column + index, runs cohort UPDATE, renames `clamping_force_kn` → `clamping_force_t`, and syncs `is_2k`. Backend exposes `two_k_type` as a filterable read/write field on `/v1/machines`, adds a new vocabulary endpoint at `/v1/machine-capabilities/two-k-types`, and extends `/v1/capacity` with a `group_by=two_k_type` rollup. Frontend gains a 4-option dropdown in the machine edit form and a badge in the list view.

**Tech Stack:** PostgreSQL, Node/Express (TypeScript), React + TypeScript, Vitest for backend tests, Playwright/Vitest for frontend.

---

## Spec reference

`docs/superpowers/specs/2026-05-06-two-k-machine-type-design.md`

## Contract fixtures

`docs/contracts/rfq/two-k-vocabulary.json`,
`docs/contracts/rfq/machines-list.json`,
`docs/contracts/rfq/capacity-rollup.json`. Backend integration tests must
produce JSON matching these shapes.

## File map

**Backend (created):**
- `backend/src/routes/v1-capabilities.ts` — new vocabulary endpoint
- `backend/src/__tests__/two-k-type-migration.test.ts`
- `backend/src/__tests__/v1-capabilities.test.ts`
- `backend/src/__tests__/v1-machines-two-k-type.test.ts`
- `backend/src/__tests__/v1-capacity-two-k-rollup.test.ts`

**Backend (modified):**
- `backend/src/db/migrate.ts` — add migration block
- `backend/src/types/index.ts` — `Machine.two_k_type`, rename column field
- `backend/src/routes/v1-machines.ts` — add field to response/write paths and filters
- `backend/src/routes/machines.ts` — accept `two_k_type` on POST/PUT
- `backend/src/routes/v1-capacity.ts` — `group_by=two_k_type` support
- `backend/src/routes/import.ts` — column rename refs
- `backend/src/services/capacity-data.ts` — column rename refs
- `backend/src/services/capacity-engine.ts` — column rename refs
- `backend/src/__tests__/capacity-engine.test.ts` — fixture updates
- `backend/src/__tests__/capacity-engine-lifecycle.test.ts` — fixture updates
- `backend/src/__tests__/machines-route-http.test.ts` — fixture updates
- `backend/src/index.ts` (or equivalent app file) — register `v1-capabilities` route

**Frontend (modified):**
- `frontend/src/types/capacity.ts` — `two_k_type` type addition
- `frontend/src/pages/MachineDetailPage.tsx` — dropdown + read display
- `frontend/src/pages/MachineListPage.tsx` — replace `is_2k` badge with `two_k_type` badge
- `frontend/src/pages/AdminPanel.tsx` — column rename refs
- `frontend/src/components/capacity/ClassCard.tsx` — column rename refs
- `frontend/src/components/MachineSketch.tsx` — column rename refs

---

## Task 1: Backend migration — add `two_k_type`, rename `clamping_force_kn`, backfill cohorts

**Files:**
- Modify: `backend/src/db/migrate.ts` (append new migration step at end of array)
- Test: `backend/src/__tests__/two-k-type-migration.test.ts` (create)

- [ ] **Step 1: Write the failing migration test**

Create `backend/src/__tests__/two-k-type-migration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../db/connection.js';

describe('two_k_type migration', () => {
  beforeAll(async () => {
    const { runMigrations } = await import('../db/migrate.js');
    await runMigrations();
  });

  it('adds two_k_type column with check constraint', async () => {
    const res = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='machines' AND column_name='two_k_type'`);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].data_type).toBe('text');
  });

  it('rejects invalid two_k_type values', async () => {
    await expect(
      pool.query(`UPDATE machines SET two_k_type='invalid' WHERE id=(SELECT id FROM machines LIMIT 1)`)
    ).rejects.toThrow();
  });

  it('renames clamping_force_kn to clamping_force_t', async () => {
    const res = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='machines' AND column_name IN ('clamping_force_kn','clamping_force_t')`);
    const names = res.rows.map((r: { column_name: string }) => r.column_name);
    expect(names).toContain('clamping_force_t');
    expect(names).not.toContain('clamping_force_kn');
  });

  it('backfills MX Arburg 220T cohort to 2k_no_turntable', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type, is_2k FROM machines
      WHERE internal_name IN ('M01','M02','M03','M04','M12','M13','M14','M23')
      ORDER BY internal_name`);
    expect(res.rows.length).toBe(8);
    for (const row of res.rows) {
      expect(row.two_k_type).toBe('2k_no_turntable');
      expect(row.is_2k).toBe(true);
    }
  });

  it('backfills US KM 350-4/550/1300/1600 cohort to 2k_no_turntable', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type FROM machines
      WHERE internal_name IN ('KM 350-4','KM 550-1','KM 550-2','KM 1300-1','KM 1300-2','KM 1300-3','KM 1600-1','KM 1600-2')
      ORDER BY internal_name`);
    expect(res.rows.length).toBe(8);
    for (const row of res.rows) {
      expect(row.two_k_type).toBe('2k_no_turntable');
    }
  });

  it('backfills MX Sumitomo 280 + Nissei DCX600/800 to parallel_injection', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type FROM machines
      WHERE internal_name IN ('M27','M8','M19') ORDER BY internal_name`);
    expect(res.rows.length).toBe(3);
    for (const row of res.rows) {
      expect(row.two_k_type).toBe('parallel_injection');
    }
  });

  it('backfills US KM 1000T to 2k_turntable', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type FROM machines
      WHERE internal_name IN ('KM 1000-1','KM 1000-2','KM 1000-3') ORDER BY internal_name`);
    expect(res.rows.length).toBe(3);
    for (const row of res.rows) {
      expect(row.two_k_type).toBe('2k_turntable');
    }
  });

  it('leaves KM 350-1/-2/-3 as null (1K)', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type FROM machines
      WHERE internal_name IN ('KM 350-1','KM 350-2','KM 350-3')`);
    for (const row of res.rows) {
      expect(row.two_k_type).toBeNull();
    }
  });

  it('leaves M28/M29 as null (1K despite NEX360 model)', async () => {
    const res = await pool.query(`
      SELECT internal_name, two_k_type FROM machines
      WHERE internal_name IN ('M28','M29')`);
    for (const row of res.rows) {
      expect(row.two_k_type).toBeNull();
    }
  });

  it('keeps is_2k in sync with two_k_type', async () => {
    const res = await pool.query(`
      SELECT id, two_k_type, is_2k FROM machines`);
    for (const row of res.rows) {
      expect(row.is_2k).toBe(row.two_k_type !== null);
    }
  });

  it('creates idx_machines_two_k_type partial index', async () => {
    const res = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename='machines' AND indexname='idx_machines_two_k_type'`);
    expect(res.rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd backend && npm test -- two-k-type-migration`
Expected: FAIL — column does not exist.

- [ ] **Step 3: Add migration block to `backend/src/db/migrate.ts`**

Append after the existing lifecycle migration (last entry in the migrations array). Add these as separate string entries in the array:

```typescript
  // Two-K machine type identifier (Phase: two-k-type)
  `ALTER TABLE machines
     ADD COLUMN IF NOT EXISTS two_k_type TEXT
     CHECK (two_k_type IN ('2k_turntable','2k_no_turntable','parallel_injection'))`,

  `CREATE INDEX IF NOT EXISTS idx_machines_two_k_type
     ON machines(two_k_type) WHERE two_k_type IS NOT NULL`,

  // Backfill cohorts (explicit by internal_name; no auto-detection from iu2_*)
  `UPDATE machines SET two_k_type='2k_no_turntable'
     WHERE internal_name IN ('M01','M02','M03','M04','M12','M13','M14','M23')`,
  `UPDATE machines SET two_k_type='2k_no_turntable'
     WHERE internal_name IN ('KM 350-4','KM 550-1','KM 550-2','KM 1300-1','KM 1300-2','KM 1300-3','KM 1600-1','KM 1600-2')`,
  `UPDATE machines SET two_k_type='parallel_injection'
     WHERE internal_name IN ('M27','M8','M19')`,
  `UPDATE machines SET two_k_type='2k_turntable'
     WHERE internal_name IN ('KM 1000-1','KM 1000-2','KM 1000-3')`,

  // Sync is_2k mirror
  `UPDATE machines SET is_2k = (two_k_type IS NOT NULL)`,

  // Rename misnamed column (values were always tons)
  `ALTER TABLE machines RENAME COLUMN clamping_force_kn TO clamping_force_t`,
```

The rename comes AFTER the cohort UPDATEs so that no other code in the migrate file (which uses `clamping_force_kn` in the existing tonnage_class CASE) is affected — those earlier statements ran on prior migration passes. New deploys: the `IF NOT EXISTS` clauses make the column-add and index idempotent; the rename is wrapped in a guard at next step.

- [ ] **Step 4: Make the rename idempotent**

Replace the rename line with a guarded DO block (so re-running the migration doesn't fail when the column is already renamed):

```typescript
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='machines' AND column_name='clamping_force_kn') THEN
       ALTER TABLE machines RENAME COLUMN clamping_force_kn TO clamping_force_t;
     END IF;
   END $$`,
```

- [ ] **Step 5: Run migration test, expect pass**

Run: `cd backend && npm test -- two-k-type-migration`
Expected: PASS — all 10 cases.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/migrate.ts backend/src/__tests__/two-k-type-migration.test.ts
git commit -m "feat(machines): two_k_type column + cohort backfill + clamping_force rename"
```

---

## Task 2: Backend types — add `two_k_type`, swap column field name

**Files:**
- Modify: `backend/src/types/index.ts`

- [ ] **Step 1: Update the `Machine` type**

Open `backend/src/types/index.ts`. Find the `Machine` interface. Replace `clamping_force_kn` with `clamping_force_t`, and add `two_k_type`:

```typescript
export type TwoKType = '2k_turntable' | '2k_no_turntable' | 'parallel_injection';

export interface Machine {
  // ... existing fields, but rename:
  clamping_force_t: number | null;  // was clamping_force_kn
  two_k_type: TwoKType | null;      // new
  // ... rest unchanged
}
```

- [ ] **Step 2: Run typecheck, expect failure in dependent files**

Run: `cd backend && npx tsc --noEmit`
Expected: errors in `routes/v1-machines.ts`, `routes/import.ts`, `routes/machines.ts`, `services/capacity-data.ts`, `services/capacity-engine.ts`, and tests — all referencing the old name.

These will be fixed in subsequent tasks. Do not commit yet.

---

## Task 3: Backend — update column references in non-API code

**Files:**
- Modify: `backend/src/routes/import.ts`
- Modify: `backend/src/services/capacity-data.ts`
- Modify: `backend/src/services/capacity-engine.ts`

- [ ] **Step 1: Replace column references**

In each of the three files, replace every occurrence of `clamping_force_kn` with `clamping_force_t`. Verify count first:

```bash
grep -c clamping_force_kn backend/src/routes/import.ts backend/src/services/capacity-data.ts backend/src/services/capacity-engine.ts
```

Then `sed -i 's/clamping_force_kn/clamping_force_t/g'` on each, or use Edit tool with `replace_all: true`. After:

```bash
grep clamping_force_kn backend/src/routes/import.ts backend/src/services/capacity-data.ts backend/src/services/capacity-engine.ts
```
Expected: no matches.

- [ ] **Step 2: Run typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: errors only in `v1-machines.ts`, `machines.ts`, and tests — handled in next tasks.

- [ ] **Step 3: Commit (partial — do not push)**

```bash
git add backend/src/routes/import.ts backend/src/services/capacity-data.ts backend/src/services/capacity-engine.ts backend/src/types/index.ts
git commit -m "refactor(backend): rename clamping_force_kn to clamping_force_t in services + types"
```

---

## Task 4: Backend — `/v1/machines` exposes `two_k_type` and filter params

**Files:**
- Modify: `backend/src/routes/v1-machines.ts`
- Test: `backend/src/__tests__/v1-machines-two-k-type.test.ts` (create)

- [ ] **Step 1: Write the failing HTTP integration test**

Create `backend/src/__tests__/v1-machines-two-k-type.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import pool from '../db/connection.js';

const SVC_TOKEN = process.env.MACHINEDB_SERVICE_TOKEN!;

describe('GET /v1/machines two_k_type', () => {
  beforeAll(async () => {
    const { runMigrations } = await import('../db/migrate.js');
    await runMigrations();
  });

  it('returns two_k_type in machine objects', async () => {
    const res = await request(app)
      .get('/v1/machines')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    const m = res.body.machines.find((x: { internal_name: string }) => x.internal_name === 'M27');
    expect(m).toBeDefined();
    expect(m.two_k_type).toBe('parallel_injection');
    expect(m.clamping_force_t).toBe(280);
    expect(m.injection_units).toBe(2);
  });

  it('filters by two_k_type=parallel_injection', async () => {
    const res = await request(app)
      .get('/v1/machines?two_k_type=parallel_injection')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    for (const m of res.body.machines) {
      expect(m.two_k_type).toBe('parallel_injection');
    }
    const names = res.body.machines.map((m: { internal_name: string }) => m.internal_name).sort();
    expect(names).toEqual(['M27','M8','M19']);
  });

  it('filters by two_k_type=null (1K only)', async () => {
    const res = await request(app)
      .get('/v1/machines?two_k_type=null')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    for (const m of res.body.machines) {
      expect(m.two_k_type).toBeNull();
    }
  });

  it('strict null on min_barrel_2_g excludes rows with NULL iu2_shot_weight_g', async () => {
    // First insert a machine with two_k_type=parallel_injection and NULL iu2_shot_weight_g
    await pool.query(`
      INSERT INTO machines (internal_name, manufacturer, model, plant_location, two_k_type, is_2k, clamping_force_t)
      VALUES ('TEST-NULL-IU2','TEST','TEST','Mexico','parallel_injection',true,500)`);
    const res = await request(app)
      .get('/v1/machines?two_k_type=parallel_injection&min_barrel_2_g=100')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    const names = res.body.machines.map((m: { internal_name: string }) => m.internal_name);
    expect(names).not.toContain('TEST-NULL-IU2');
    await pool.query(`DELETE FROM machines WHERE internal_name='TEST-NULL-IU2'`);
  });

  it('filters by site, min_tonnage, max_tonnage', async () => {
    const res = await request(app)
      .get('/v1/machines?site=US&min_tonnage=900&max_tonnage=1100')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    const names = res.body.machines.map((m: { internal_name: string }) => m.internal_name).sort();
    expect(names).toEqual(['KM 1000-1','KM 1000-2','KM 1000-3']);
  });

  it('rejects invalid two_k_type filter', async () => {
    const res = await request(app)
      .get('/v1/machines?two_k_type=bogus')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `cd backend && npm test -- v1-machines-two-k-type`
Expected: FAIL — `two_k_type` not in response, filters not honored.

- [ ] **Step 3: Update `backend/src/routes/v1-machines.ts`**

In the row-mapping function, add:

```typescript
return {
  // ... existing fields
  clamping_force_t: dec(row.clamping_force_t),  // column already renamed
  two_k_type: row.two_k_type,
  injection_units: (row.iu2_screw_diameter_mm !== null && row.iu2_screw_diameter_mm !== undefined) || row.two_k_type !== null ? 2 : 1,
  is_2k: row.two_k_type !== null,
};
```

In the SELECT statement, ensure `two_k_type` is included.

In the GET handler's filter-building section, add:

```typescript
const VALID_TWO_K_TYPES = new Set(['2k_turntable','2k_no_turntable','parallel_injection']);

const { site, two_k_type, min_tonnage, max_tonnage,
        min_platen_x, min_platen_y, min_daylight,
        min_barrel_1_g, min_barrel_2_g, min_injection_units } = req.query as Record<string, string | undefined>;

if (two_k_type !== undefined && two_k_type !== 'null' && !VALID_TWO_K_TYPES.has(two_k_type)) {
  return res.status(400).json({ error: 'invalid two_k_type' });
}

const conditions: string[] = [];
const params: unknown[] = [];
const push = (sql: string, val: unknown) => { params.push(val); conditions.push(sql.replace('$$', `$${params.length}`)); };

if (site === 'MX') conditions.push(`plant_location='Mexico'`);
else if (site === 'US') conditions.push(`plant_location='USA'`);

if (two_k_type === 'null') conditions.push(`two_k_type IS NULL`);
else if (two_k_type) push(`two_k_type = $$`, two_k_type);

if (min_tonnage) push(`clamping_force_t >= $$`, Number(min_tonnage));
if (max_tonnage) push(`clamping_force_t <= $$`, Number(max_tonnage));
if (min_platen_x) push(`platen_horizontal_mm >= $$`, Number(min_platen_x));
if (min_platen_y) push(`platen_vertical_mm >= $$`, Number(min_platen_y));
if (min_barrel_1_g) push(`iu1_shot_weight_g >= $$`, Number(min_barrel_1_g));
if (min_barrel_2_g) push(`iu2_shot_weight_g >= $$`, Number(min_barrel_2_g));
if (min_injection_units === '2') conditions.push(`(iu2_screw_diameter_mm IS NOT NULL OR two_k_type IS NOT NULL)`);

// Strict null: min_* filters above use `>=` which already excludes NULL — Postgres semantics. Verify with the unit test in step 1.
```

Daylight column: check the schema. If a daylight column is present, add `if (min_daylight) push(\`<col> >= $$\`, Number(min_daylight));`. If not, omit and document in spec's Open questions.

- [ ] **Step 4: Update POST/PUT path to accept `two_k_type`**

In `backend/src/routes/machines.ts` (the route used by the UI), add `two_k_type` to the accepted writable fields list. Validate against the same `VALID_TWO_K_TYPES` set; reject invalid values with 400. On write, also update `is_2k = (two_k_type IS NOT NULL)`.

- [ ] **Step 5: Run test, expect pass**

Run: `cd backend && npm test -- v1-machines-two-k-type`
Expected: PASS — all 6 cases.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/v1-machines.ts backend/src/routes/machines.ts backend/src/__tests__/v1-machines-two-k-type.test.ts
git commit -m "feat(api): expose two_k_type on /v1/machines with filter params"
```

---

## Task 5: Backend — vocabulary endpoint `/v1/machine-capabilities/two-k-types`

**Files:**
- Create: `backend/src/routes/v1-capabilities.ts`
- Test: `backend/src/__tests__/v1-capabilities.test.ts` (create)
- Modify: `backend/src/index.ts` (or wherever Express routes are registered)

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/v1-capabilities.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

const SVC_TOKEN = process.env.MACHINEDB_SERVICE_TOKEN!;

describe('GET /v1/machine-capabilities/two-k-types', () => {
  it('returns the three enum values with labels and descriptions', async () => {
    const res = await request(app)
      .get('/v1/machine-capabilities/two-k-types')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.two_k_types).toHaveLength(3);
    const values = res.body.two_k_types.map((t: { value: string }) => t.value).sort();
    expect(values).toEqual(['2k_no_turntable','2k_turntable','parallel_injection']);
    for (const t of res.body.two_k_types) {
      expect(typeof t.label).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('rejects without service token', async () => {
    const res = await request(app).get('/v1/machine-capabilities/two-k-types');
    expect(res.status).toBe(401);
  });

  it('matches the contract fixture exactly', async () => {
    const res = await request(app)
      .get('/v1/machine-capabilities/two-k-types')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    const fs = await import('node:fs/promises');
    const fixture = JSON.parse(await fs.readFile('docs/contracts/rfq/two-k-vocabulary.json', 'utf8'));
    delete fixture._comment;
    expect(res.body).toEqual({ two_k_types: fixture.two_k_types });
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `cd backend && npm test -- v1-capabilities`
Expected: FAIL — 404.

- [ ] **Step 3: Create the route**

Create `backend/src/routes/v1-capabilities.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { serviceAuth } from '../middleware/service-auth.js';

const router = Router();

const TWO_K_TYPES = [
  {
    value: '2k_turntable',
    label: '2K — Turntable',
    description: 'Rotating platen, standard overmolding. Tool sits on a turntable; the platen rotates 180 degrees between station 1 and station 2.',
  },
  {
    value: '2k_no_turntable',
    label: '2K — No turntable',
    description: 'Two injection units, no rotation. Index plate, sliding tool, or core-back transfer; the tool itself handles part movement.',
  },
  {
    value: 'parallel_injection',
    label: 'Parallel injection',
    description: 'Two separate tools, two injection units. Each tool can use one or both injection units. Used for high-mix low-volume on large Nissei/Sumitomo machines.',
  },
];

router.get('/two-k-types', serviceAuth, (_req: Request, res: Response) => {
  res.json({ two_k_types: TWO_K_TYPES });
});

export default router;
```

If `serviceAuth` import path differs in this codebase, follow whatever pattern `v1-machines.ts` uses.

- [ ] **Step 4: Register the route in the Express app file**

Find where `v1-machines` is mounted (search: `grep -n "v1-machines\|v1Machines" backend/src/index.ts`) and add nearby:

```typescript
import v1Capabilities from './routes/v1-capabilities.js';
app.use('/v1/machine-capabilities', v1Capabilities);
```

- [ ] **Step 5: Run, expect pass**

Run: `cd backend && npm test -- v1-capabilities`
Expected: PASS — all 3 cases.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/v1-capabilities.ts backend/src/__tests__/v1-capabilities.test.ts backend/src/index.ts
git commit -m "feat(api): add /v1/machine-capabilities/two-k-types vocabulary endpoint"
```

---

## Task 6: Backend — `/v1/capacity?group_by=two_k_type` rollup

**Files:**
- Modify: `backend/src/routes/v1-capacity.ts`
- Modify: `backend/src/services/capacity-engine.ts` (only if rollup logic lives there)
- Test: `backend/src/__tests__/v1-capacity-two-k-rollup.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/v1-capacity-two-k-rollup.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

const SVC_TOKEN = process.env.MACHINEDB_SERVICE_TOKEN!;

describe('GET /v1/capacity?group_by=two_k_type', () => {
  beforeAll(async () => {
    const { runMigrations } = await import('../db/migrate.js');
    await runMigrations();
  });

  it('groups availability by site/period/two_k_type with null bucket', async () => {
    const res = await request(app)
      .get('/v1/capacity?group_by=two_k_type&year=2027')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rollups)).toBe(true);

    const usParallel = res.body.rollups.find(
      (r: { site: string; two_k_type: string | null }) => r.site === 'US' && r.two_k_type === '2k_turntable'
    );
    expect(usParallel).toBeDefined();
    expect(usParallel.machine_count).toBe(3);

    const mxNull = res.body.rollups.find(
      (r: { site: string; two_k_type: string | null }) => r.site === 'MX' && r.two_k_type === null
    );
    expect(mxNull).toBeDefined();
    expect(mxNull.machine_count).toBeGreaterThan(0);
  });

  it('preserves per-machine output for backwards compat', async () => {
    const res = await request(app)
      .get('/v1/capacity?group_by=two_k_type&year=2027')
      .set('Authorization', `Bearer ${SVC_TOKEN}`);
    expect(Array.isArray(res.body.machines)).toBe(true);
    expect(res.body.machines.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `cd backend && npm test -- v1-capacity-two-k-rollup`
Expected: FAIL — `rollups` undefined.

- [ ] **Step 3: Add rollup support to `backend/src/routes/v1-capacity.ts`**

Read the existing handler. After it builds the `machines` array, add:

```typescript
if (req.query.group_by === 'two_k_type') {
  const bySiteYearType = new Map<string, { site: string; period: string; two_k_type: string | null; machine_count: number; available_machine_years: number }>();
  for (const m of machines) {
    const key = `${m.site}|${m.year}|${m.two_k_type ?? '__null__'}`;
    const cur = bySiteYearType.get(key) ?? { site: m.site, period: String(m.year), two_k_type: m.two_k_type ?? null, machine_count: 0, available_machine_years: 0 };
    cur.machine_count += 1;
    cur.available_machine_years += m.available_fraction ?? 0;
    bySiteYearType.set(key, cur);
  }
  return res.json({ rollups: Array.from(bySiteYearType.values()), machines });
}
return res.json({ machines });
```

The exact path depends on the existing handler shape — find where `machines` (array of per-machine availability) is computed and slot in this aggregation.

Make sure each `machines[]` entry includes `two_k_type` (read from the machine row joined in the capacity query). If not, add it to the SELECT.

- [ ] **Step 4: Run test, expect pass**

Run: `cd backend && npm test -- v1-capacity-two-k-rollup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/v1-capacity.ts backend/src/__tests__/v1-capacity-two-k-rollup.test.ts
git commit -m "feat(api): /v1/capacity supports group_by=two_k_type rollup"
```

---

## Task 7: Backend — fixture / existing-test column rename

**Files:**
- Modify: `backend/src/__tests__/capacity-engine.test.ts`
- Modify: `backend/src/__tests__/capacity-engine-lifecycle.test.ts`
- Modify: `backend/src/__tests__/machines-route-http.test.ts`

- [ ] **Step 1: Replace `clamping_force_kn` with `clamping_force_t`**

```bash
grep -l clamping_force_kn backend/src/__tests__/
```

For each match, run an Edit with `replace_all: true` from `clamping_force_kn` to `clamping_force_t`.

- [ ] **Step 2: Run full backend test suite**

Run: `cd backend && npm test`
Expected: PASS — all tests, including pre-existing.

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/
git commit -m "test(backend): rename clamping_force_kn to clamping_force_t in fixtures"
```

---

## Task 8: Frontend — types + edit dropdown + read display

**Files:**
- Modify: `frontend/src/types/capacity.ts`
- Modify: `frontend/src/pages/MachineDetailPage.tsx`

- [ ] **Step 1: Add the type**

In `frontend/src/types/capacity.ts`, add:

```typescript
export type TwoKType = '2k_turntable' | '2k_no_turntable' | 'parallel_injection';
```

And update any `Machine` interface in this file to include `two_k_type: TwoKType | null;` and replace `clamping_force_kn` with `clamping_force_t`.

- [ ] **Step 2: Add the dropdown to the edit form**

In `frontend/src/pages/MachineDetailPage.tsx`, find the section near `is_2k` / `has_mucell` / `has_variotherm` form controls. Add:

```tsx
<label>
  2K Type
  <select
    value={form.two_k_type ?? ''}
    onChange={e => setForm({ ...form, two_k_type: e.target.value === '' ? null : e.target.value as TwoKType })}
  >
    <option value="">1K (single component)</option>
    <option value="2k_turntable">2K — Turntable</option>
    <option value="2k_no_turntable">2K — No turntable</option>
    <option value="parallel_injection">Parallel injection</option>
  </select>
</label>
```

Remove (or hide) the standalone `is_2k` checkbox if the design replaces it. The backend syncs `is_2k` from `two_k_type`, so the checkbox is no longer needed.

- [ ] **Step 3: Manual smoke test**

Start dev server, open machine detail page for `M27` (id 26), confirm the dropdown shows "Parallel injection" selected. Change to "1K (single component)", save, reload — verify persisted as `null`. Restore to `parallel_injection` before continuing.

- [ ] **Step 4: Replace remaining `clamping_force_kn` references**

Find:
```bash
grep -rn clamping_force_kn frontend/src/
```
Replace all with `clamping_force_t` using Edit `replace_all: true`. Files affected per the file map.

- [ ] **Step 5: Frontend typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(machines-ui): two_k_type dropdown and column rename"
```

---

## Task 9: Frontend — list view badge

**Files:**
- Modify: `frontend/src/pages/MachineListPage.tsx`

- [ ] **Step 1: Replace the `is_2k` badge with a `two_k_type` badge**

Find the spot rendering the `is_2k` indicator. Replace with:

```tsx
{m.two_k_type && (
  <span className={`badge two-k-${m.two_k_type}`} title={m.two_k_type}>
    {m.two_k_type === '2k_turntable' ? '2K-T' :
     m.two_k_type === '2k_no_turntable' ? '2K' :
     'Parallel'}
  </span>
)}
```

Add corresponding CSS classes in the same file or the closest stylesheet, distinguishing the three types visually.

- [ ] **Step 2: Smoke test list view**

Reload the machine list. Verify badges appear on M27/M08/M19 (Parallel), the 8 Arburgs and 8 KMs (2K), and KM 1000-1/-2/-3 (2K-T). 1K machines have no badge.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MachineListPage.tsx
git commit -m "feat(machines-ui): two_k_type badge in machine list"
```

---

## Task 10: End-to-end fixture verification

**Files:**
- None (verification only)

- [ ] **Step 1: Compare live API to fixture shape**

Start backend dev server. Run:

```bash
TOKEN=$MACHINEDB_SERVICE_TOKEN
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:<port>/v1/machine-capabilities/two-k-types | jq .
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:<port>/v1/machines?two_k_type=parallel_injection" | jq '.machines[0] | keys'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:<port>/v1/capacity?group_by=two_k_type&year=2027" | jq '.rollups[0] | keys'
```

Compare each against the fixture in `docs/contracts/rfq/`. Differences in fixture-only fields (`_comment`, `_bucket`, `_filter_behavior`) are expected. Real fields must match shape.

- [ ] **Step 2: If any field is missing or mismatched**

Update either the route to match the fixture (preferred — fixture is the contract) or update the fixture and note the change in the spec's "Contract fixtures" section.

- [ ] **Step 3: Final commit if any sync needed**

```bash
git add docs/contracts/rfq/ backend/src/routes/
git commit -m "chore(contracts): sync RFQ fixtures with live API shape"
```

---

## Task 11: Push + notify RFQ

- [ ] **Step 1: Run full test suite one more time**

```bash
cd backend && npm test
cd frontend && npm run build
```
Expected: green.

- [ ] **Step 2: Push branch**

```bash
git push origin master
```
(or open a PR depending on team convention — confirm with user before pushing to master)

- [ ] **Step 3: Send the RFQ confirmation email** (drafted earlier in this thread; fixtures committed at `docs/contracts/rfq/`)

---

## Self-review notes

- Spec coverage: schema (Task 1), backfill (Task 1), is_2k sync (Task 1), rename (Task 1+3+7+8), vocabulary endpoint (Task 5), machines filter API (Task 4), capacity rollup (Task 6), strict-null filter (Task 4 step 1 case), UI dropdown (Task 8), list badge (Task 9), fixtures verified (Task 10).
- Daylight column: handled as conditional in Task 4 step 3; spec already lists this in Open questions.
- `injection_units` derivation uses both `iu2_screw_diameter_mm IS NOT NULL` AND `two_k_type IS NOT NULL` so unpopulated-IU2 2K rows still report `injection_units=2` (matches fixture).
- Daylight column fallback documented in Task 4.
