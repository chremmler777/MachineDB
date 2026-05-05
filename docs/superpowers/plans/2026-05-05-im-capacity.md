# IM Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tool-level capacity module to MachineDB: schema, capacity engine, public API, Excel bootstrap import, and an interactive overview UI with drag-drop tool moves and what-if simulation. Phase 1 = USA plant.

**Architecture:** Five new Postgres tables (capability flags on `machines`, plus `im_tools`, `im_tool_volumes`, `im_class_capacity`, `im_scenarios`). One pure-function capacity engine consumed by both internal `/api/capacity/*` and public `/v1/capacity/*` routes. Vite/React overview page with Tailwind, expandable bento-style class cards, SVG bar charts, and HTML5 drag-drop for tool moves.

**Tech Stack:** TypeScript, Node 20, Express 4, `pg`, `xlsx` (already a dep), `node:test` for backend tests, React 18, Vite, Tailwind 3, axios. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-05-im-capacity-design.md` — read before starting.

**Caveat:** the existing schema column is `clamping_force_kn`. The `/v1` API already exposes it as `clamping_force_t` (kN ÷ 9.80665, rounded). All capacity queries must do the same conversion. Do **not** rename the column — that's a separate, deferred migration.

---

## File Structure

**Create (backend):**
- `backend/src/services/capacity-engine.ts` — pure compute + qualification rules + modification overlay
- `backend/src/routes/im-tools.ts` — CRUD for tools
- `backend/src/routes/im-tool-volumes.ts` — CRUD for annual volumes
- `backend/src/routes/im-class-capacity.ts` — CRUD for class capacity params
- `backend/src/routes/im-scenarios.ts` — CRUD for saved scenarios
- `backend/src/routes/capacity.ts` — internal `/api/capacity/{overview,simulate}`
- `backend/src/routes/v1-capacity.ts` — public `/v1/capacity/{overview,simulate}` (bearer auth)
- `backend/src/services/capacity-import.ts` — Excel + process-sheet reconciliation importer
- `backend/src/__tests__/capacity-engine.test.ts`
- `backend/src/__tests__/capacity-routes.test.ts`

**Create (frontend):**
- `frontend/src/pages/CapacityOverviewPage.tsx`
- `frontend/src/components/capacity/ClassCard.tsx`
- `frontend/src/components/capacity/StackedBarChart.tsx`
- `frontend/src/components/capacity/ToolInfoCard.tsx`
- `frontend/src/components/capacity/MachineRow.tsx`
- `frontend/src/components/capacity/SimPanel.tsx`
- `frontend/src/components/capacity/Sparkline.tsx`
- `frontend/src/services/capacityApi.ts`
- `frontend/src/types/capacity.ts`

**Modify:**
- `backend/src/db/migrate.ts` — append migrations
- `backend/src/index.ts` — register new route mounts
- `frontend/src/App.tsx` — add route + nav entry

---

## Task 1: Schema migration — capability flags on `machines`

**Files:**
- Modify: `backend/src/db/migrate.ts` (append a new SQL string to the `migrations` array)

- [ ] **Step 1: Append migration block**

Open `backend/src/db/migrate.ts`. After the last entry in the `migrations` array (find the closing `];`), insert before it:

```ts
  // IM Capacity — capability flags (Phase 1)
  `ALTER TABLE machines
     ADD COLUMN IF NOT EXISTS is_2k BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS has_mucell BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS has_variotherm BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS tonnage_class TEXT`,

  // Backfill tonnage_class label from clamping_force_kn (kN → t bucket label)
  `UPDATE machines SET tonnage_class =
     CASE
       WHEN clamping_force_kn IS NULL THEN NULL
       WHEN clamping_force_kn / 9.80665 < 100  THEN '80T'
       WHEN clamping_force_kn / 9.80665 < 250  THEN '200T'
       WHEN clamping_force_kn / 9.80665 < 450  THEN '350T'
       WHEN clamping_force_kn / 9.80665 < 600  THEN '550T'
       WHEN clamping_force_kn / 9.80665 < 750  THEN '650T'
       WHEN clamping_force_kn / 9.80665 < 950  THEN '900T'
       WHEN clamping_force_kn / 9.80665 < 1150 THEN '1000T'
       WHEN clamping_force_kn / 9.80665 < 1450 THEN '1300T'
       WHEN clamping_force_kn / 9.80665 < 1950 THEN '1600T'
       WHEN clamping_force_kn / 9.80665 < 2750 THEN '2300T'
       ELSE '3200T'
     END
     WHERE tonnage_class IS NULL`,
```

- [ ] **Step 2: Run migration in dev**

```bash
cd backend && npm run migrate
```

Expected: prints "All migrations completed successfully" or similar, no errors.

- [ ] **Step 3: Verify schema**

```bash
docker exec -it machinedb-db psql -U postgres -d machinedb -c "\d machines" | grep -E "(is_2k|has_mucell|has_variotherm|tonnage_class)"
```

Expected: four lines listing the new columns.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "schema: add capability flags + tonnage_class to machines"
```

---

## Task 2: Schema migration — `im_tools` table

**Files:**
- Modify: `backend/src/db/migrate.ts`

- [ ] **Step 1: Append migration**

Add to the `migrations` array (after Task 1's blocks, before the closing `];`):

```ts
  `CREATE TABLE IF NOT EXISTS im_tools (
    id SERIAL PRIMARY KEY,
    tool_number TEXT UNIQUE NOT NULL,
    description TEXT,
    customer TEXT,
    program TEXT,

    cavities INT,
    rated_cycle_time_sec NUMERIC,
    operator_fte NUMERIC,
    raw_material_kg_per_piece NUMERIC,

    qualified_min_tonnage_t INT,
    qualified_max_tonnage_t INT,
    shot_volume_required_cm3 NUMERIC,
    requires_2k BOOLEAN DEFAULT FALSE,
    requires_mucell BOOLEAN DEFAULT FALSE,
    requires_variotherm BOOLEAN DEFAULT FALSE,

    assigned_machine_id INT REFERENCES machines(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','inactive','candidate')),

    pdb_tool_ref TEXT,
    process_sheet_file_id INT REFERENCES files(id) ON DELETE SET NULL,
    process_sheet_imported_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_edited_by TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_im_tools_assigned ON im_tools(assigned_machine_id)`,
  `CREATE INDEX IF NOT EXISTS idx_im_tools_status ON im_tools(status)`,
```

- [ ] **Step 2: Run + verify**

```bash
cd backend && npm run migrate
docker exec -it machinedb-db psql -U postgres -d machinedb -c "\d im_tools"
```

Expected: table listed with all columns.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "schema: add im_tools master table"
```

---

## Task 3: Schema migration — `im_tool_volumes` and `im_class_capacity`

**Files:**
- Modify: `backend/src/db/migrate.ts`

- [ ] **Step 1: Append migrations**

```ts
  `CREATE TABLE IF NOT EXISTS im_tool_volumes (
    tool_id INT NOT NULL REFERENCES im_tools(id) ON DELETE CASCADE,
    year INT NOT NULL,
    pieces_per_year NUMERIC NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    PRIMARY KEY (tool_id, year)
  )`,

  `CREATE TABLE IF NOT EXISTS im_class_capacity (
    tonnage_t INT NOT NULL,
    requires_2k BOOLEAN NOT NULL DEFAULT FALSE,
    requires_mucell BOOLEAN NOT NULL DEFAULT FALSE,
    requires_variotherm BOOLEAN NOT NULL DEFAULT FALSE,
    year INT NOT NULL,
    oee_pct NUMERIC NOT NULL DEFAULT 85,
    shifts_per_week NUMERIC NOT NULL DEFAULT 15,
    working_days_year INT NOT NULL DEFAULT 240,
    planned_downtime_wk NUMERIC NOT NULL DEFAULT 2,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year)
  )`,
```

- [ ] **Step 2: Run + verify**

```bash
cd backend && npm run migrate
docker exec -it machinedb-db psql -U postgres -d machinedb -c "\dt im_*"
```

Expected: `im_tools`, `im_tool_volumes`, `im_class_capacity` listed.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "schema: add im_tool_volumes and im_class_capacity"
```

---

## Task 4: Schema migration — `im_scenarios`

**Files:**
- Modify: `backend/src/db/migrate.ts`

- [ ] **Step 1: Append migration**

```ts
  `CREATE TABLE IF NOT EXISTS im_scenarios (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    modifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner TEXT,
    combined_from INT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
```

- [ ] **Step 2: Run + verify**

```bash
cd backend && npm run migrate
docker exec -it machinedb-db psql -U postgres -d machinedb -c "\d im_scenarios"
```

Expected: table listed.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrate.ts
git commit -m "schema: add im_scenarios"
```

---

## Task 5: Capacity engine — types and qualification

**Files:**
- Create: `backend/src/services/capacity-engine.ts`
- Create: `backend/src/__tests__/capacity-engine.test.ts`

This task introduces the type set and the pure qualification function. The engine itself comes in Task 6.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/capacity-engine.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifies } from '../services/capacity-engine.js';

test('qualifies: tonnage in range, no flags required, all OK', () => {
  const machine = { id: 1, clamping_force_kn: 3434, iu1_shot_volume_cm3: 800, is_2k: false, has_mucell: false, has_variotherm: true };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: 400, shot_volume_required_cm3: 600,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  assert.equal(qualifies(machine, tool).ok, true);
});

test('qualifies: tonnage below min → fails with reason', () => {
  const machine = { id: 1, clamping_force_kn: 1960, iu1_shot_volume_cm3: 800, is_2k: false, has_mucell: false, has_variotherm: false };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 100,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  const r = qualifies(machine, tool);
  assert.equal(r.ok, false);
  assert.match(r.reason!, /tonnage/i);
});

test('qualifies: shot volume insufficient → fails', () => {
  const machine = { id: 1, clamping_force_kn: 3434, iu1_shot_volume_cm3: 500, is_2k: false, has_mucell: false, has_variotherm: false };
  const tool = { qualified_min_tonnage_t: 300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 800,
                 requires_2k: false, requires_mucell: false, requires_variotherm: false };
  assert.equal(qualifies(machine, tool).ok, false);
});

test('qualifies: requires_2k but machine lacks → fails', () => {
  const machine = { id: 1, clamping_force_kn: 12750, iu1_shot_volume_cm3: 5000, is_2k: false, has_mucell: false, has_variotherm: false };
  const tool = { qualified_min_tonnage_t: 1300, qualified_max_tonnage_t: null, shot_volume_required_cm3: 100,
                 requires_2k: true, requires_mucell: false, requires_variotherm: false };
  const r = qualifies(machine, tool);
  assert.equal(r.ok, false);
  assert.match(r.reason!, /2k/i);
});
```

- [ ] **Step 2: Run test, expect failures**

```bash
cd backend && npx tsx --test src/__tests__/capacity-engine.test.ts
```

Expected: fails on import — module not found.

- [ ] **Step 3: Implement the engine module skeleton + qualifies()**

Create `backend/src/services/capacity-engine.ts`:

```ts
// Capacity engine — pure functions, no DB access.
// All inputs are passed in; the route layer is responsible for fetching data.

const KN_TO_T = 1 / 9.80665;

export type MachineRow = {
  id: number;
  clamping_force_kn: number | null;
  iu1_shot_volume_cm3: number | null;
  is_2k: boolean;
  has_mucell: boolean;
  has_variotherm: boolean;
};

export type ToolQualification = {
  qualified_min_tonnage_t: number | null;
  qualified_max_tonnage_t: number | null;
  shot_volume_required_cm3: number | null;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
};

export type QualResult = { ok: boolean; reason?: string };

export function qualifies(m: MachineRow, t: ToolQualification): QualResult {
  const tonnage_t = m.clamping_force_kn != null ? m.clamping_force_kn * KN_TO_T : null;

  if (t.qualified_min_tonnage_t != null && (tonnage_t == null || tonnage_t < t.qualified_min_tonnage_t))
    return { ok: false, reason: `Machine tonnage ${tonnage_t?.toFixed(0)}t < required min ${t.qualified_min_tonnage_t}t` };

  if (t.qualified_max_tonnage_t != null && tonnage_t != null && tonnage_t > t.qualified_max_tonnage_t)
    return { ok: false, reason: `Machine tonnage ${tonnage_t.toFixed(0)}t > allowed max ${t.qualified_max_tonnage_t}t` };

  if (t.shot_volume_required_cm3 != null && (m.iu1_shot_volume_cm3 == null || m.iu1_shot_volume_cm3 < t.shot_volume_required_cm3))
    return { ok: false, reason: `Machine shot volume ${m.iu1_shot_volume_cm3 ?? '?'} cm³ < required ${t.shot_volume_required_cm3} cm³` };

  if (t.requires_2k && !m.is_2k)         return { ok: false, reason: 'Machine not 2K-capable' };
  if (t.requires_mucell && !m.has_mucell)     return { ok: false, reason: 'Machine not MuCell-capable' };
  if (t.requires_variotherm && !m.has_variotherm) return { ok: false, reason: 'Machine lacks Variotherm' };

  return { ok: true };
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
cd backend && npx tsx --test src/__tests__/capacity-engine.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-engine.ts backend/src/__tests__/capacity-engine.test.ts
git commit -m "feat(capacity): qualification rules + engine types"
```

---

## Task 6: Capacity engine — compute() + modification overlay

**Files:**
- Modify: `backend/src/services/capacity-engine.ts`
- Modify: `backend/src/__tests__/capacity-engine.test.ts`

- [ ] **Step 1: Add failing tests for the compute function**

Append to `backend/src/__tests__/capacity-engine.test.ts`:

```ts
import { computeCapacity } from '../services/capacity-engine.js';
import type { Tool, ClassCapacityRow } from '../services/capacity-engine.js';

const machinesFixture: MachineRow[] = [
  { id: 1, clamping_force_kn: 3434, iu1_shot_volume_cm3: 1000, is_2k: false, has_mucell: false, has_variotherm: true },
  { id: 2, clamping_force_kn: 3434, iu1_shot_volume_cm3: 1000, is_2k: false, has_mucell: false, has_variotherm: true },
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
```

- [ ] **Step 2: Run, expect failure (`computeCapacity` not exported)**

```bash
cd backend && npx tsx --test src/__tests__/capacity-engine.test.ts
```

- [ ] **Step 3: Implement `computeCapacity`**

Append to `backend/src/services/capacity-engine.ts`:

```ts
export type Tool = ToolQualification & {
  id: number;
  tool_number: string;
  description?: string;
  customer?: string;
  program?: string;
  cavities: number;
  rated_cycle_time_sec: number;
  assigned_machine_id: number | null;
  status: 'active' | 'inactive' | 'candidate';
};

export type Volume = { tool_id: number; year: number; pieces_per_year: number };

export type ClassCapacityRow = {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  year: number;
  oee_pct: number;
  shifts_per_week: number;
  working_days_year: number;
  planned_downtime_wk: number;
};

export type Modification =
  | { type: 'add_tool'; tool: Omit<Tool,'id'|'status'|'assigned_machine_id'> & { target_machine_id: number }; volumes: { year: number; pieces_per_year: number }[] }
  | { type: 'move_tool'; tool_id: number; target_machine_id: number }
  | { type: 'remove_tool'; tool_id: number }
  | { type: 'change_volume'; tool_id: number; year: number; pieces_per_year: number }
  | { type: 'change_class_param';
      class_key: { tonnage_t: number; requires_2k: boolean; requires_mucell: boolean; requires_variotherm: boolean };
      year_or_all: number | 'all';
      field: 'oee_pct' | 'shifts_per_week' | 'working_days_year' | 'planned_downtime_wk';
      value: number; };

export type CellStatus = 'green' | 'yellow' | 'orange' | 'red';

export type CapacityCell = {
  year: number;
  hours_per_machine: number;
  demand: number;
  available: number;
  free: number;
  utilization_pct: number;
  status: CellStatus;
  contributing_tools: { tool_number: string; mach_equivalents: number }[];
};

export type CapacityClass = {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  label: string;
  machines: number;
  shifts_per_week: number;
  years: CapacityCell[];
};

function classifyMachine(m: MachineRow): { tonnage_t: number | null; key: string } {
  const t = m.clamping_force_kn != null ? Math.round(m.clamping_force_kn * KN_TO_T) : null;
  if (t == null) return { tonnage_t: null, key: 'unknown' };
  // bucket label thresholds match the migration
  let bucket = 3200;
  for (const v of [80,200,350,550,650,900,1000,1300,1600,2300]) {
    if (t < v + (v * 0.3)) { bucket = v; break; }
  }
  return { tonnage_t: bucket, key: `${bucket}-${m.is_2k}-${m.has_mucell}-${m.has_variotherm}` };
}

function classifyTool(req: ToolQualification, allMachines: MachineRow[]): string | null {
  const matched = allMachines.find(m => qualifies(m, req).ok);
  if (!matched) return null;
  return classifyMachine(matched).key;
}

function statusFor(free: number): CellStatus {
  if (free < 0) return 'red';
  if (free < 0.5) return 'orange';
  if (free < 1.0) return 'yellow';
  return 'green';
}

function classLabel(c: { tonnage_t: number; requires_2k: boolean; requires_mucell: boolean; requires_variotherm: boolean }): string {
  const parts = [`KM ${c.tonnage_t}`];
  if (c.requires_2k) parts.push('2K');
  if (c.requires_mucell) parts.push('MuCell');
  if (c.requires_variotherm) parts.push('Variotherm');
  return parts.join(' · ');
}

export function computeCapacity(input: {
  machines: MachineRow[];
  tools: Tool[];
  volumes: Volume[];
  classCapacity: ClassCapacityRow[];
  yearFrom: number;
  yearTo: number;
  modifications?: Modification[];
}): CapacityClass[] {
  // 1. Apply modifications to working copies (no mutation of inputs).
  let tools = input.tools.slice();
  let volumes = input.volumes.slice();
  let classCapacity = input.classCapacity.slice();

  for (const mod of input.modifications ?? []) {
    if (mod.type === 'add_tool') {
      const tempId = -1 - tools.length;
      tools.push({
        id: tempId,
        tool_number: mod.tool.tool_number,
        cavities: mod.tool.cavities,
        rated_cycle_time_sec: mod.tool.rated_cycle_time_sec,
        qualified_min_tonnage_t: mod.tool.qualified_min_tonnage_t,
        qualified_max_tonnage_t: mod.tool.qualified_max_tonnage_t,
        shot_volume_required_cm3: mod.tool.shot_volume_required_cm3,
        requires_2k: mod.tool.requires_2k,
        requires_mucell: mod.tool.requires_mucell,
        requires_variotherm: mod.tool.requires_variotherm,
        assigned_machine_id: mod.tool.target_machine_id,
        status: 'candidate',
      });
      for (const v of mod.volumes) volumes.push({ tool_id: tempId, year: v.year, pieces_per_year: v.pieces_per_year });
    } else if (mod.type === 'move_tool') {
      tools = tools.map(t => t.id === mod.tool_id ? { ...t, assigned_machine_id: mod.target_machine_id } : t);
    } else if (mod.type === 'remove_tool') {
      tools = tools.filter(t => t.id !== mod.tool_id);
      volumes = volumes.filter(v => v.tool_id !== mod.tool_id);
    } else if (mod.type === 'change_volume') {
      const idx = volumes.findIndex(v => v.tool_id === mod.tool_id && v.year === mod.year);
      if (idx >= 0) volumes[idx] = { ...volumes[idx], pieces_per_year: mod.pieces_per_year };
      else volumes.push({ tool_id: mod.tool_id, year: mod.year, pieces_per_year: mod.pieces_per_year });
    } else if (mod.type === 'change_class_param') {
      classCapacity = classCapacity.map(c =>
        c.tonnage_t === mod.class_key.tonnage_t &&
        c.requires_2k === mod.class_key.requires_2k &&
        c.requires_mucell === mod.class_key.requires_mucell &&
        c.requires_variotherm === mod.class_key.requires_variotherm &&
        (mod.year_or_all === 'all' || c.year === mod.year_or_all)
        ? { ...c, [mod.field]: mod.value } : c
      );
    }
  }

  // 2. Group machines by class key.
  const machineByClassKey = new Map<string, MachineRow[]>();
  for (const m of input.machines) {
    const key = classifyMachine(m).key;
    if (!machineByClassKey.has(key)) machineByClassKey.set(key, []);
    machineByClassKey.get(key)!.push(m);
  }

  // 3. For each class capacity row, compute the cell.
  const out: CapacityClass[] = [];
  const seenClasses = new Set<string>();

  // Iterate over the cross-product of (class found in machines) × (year in range)
  for (const [classKey, machines] of machineByClassKey) {
    if (seenClasses.has(classKey)) continue;
    const [tonStr, k2, kMu, kVa] = classKey.split('-');
    const tonnage_t = Number(tonStr);
    const requires_2k = k2 === 'true';
    const requires_mucell = kMu === 'true';
    const requires_variotherm = kVa === 'true';
    seenClasses.add(classKey);

    const yearCells: CapacityCell[] = [];
    for (let year = input.yearFrom; year <= input.yearTo; year++) {
      const cc = classCapacity.find(c =>
        c.tonnage_t === tonnage_t && c.requires_2k === requires_2k &&
        c.requires_mucell === requires_mucell && c.requires_variotherm === requires_variotherm &&
        c.year === year);
      if (!cc) {
        // No params yet for this year → use defaults
        yearCells.push({ year, hours_per_machine: 0, demand: 0, available: machines.length, free: machines.length,
                         utilization_pct: 0, status: 'green', contributing_tools: [] });
        continue;
      }
      const hours_per_machine = cc.shifts_per_week * 8 * (52 - cc.planned_downtime_wk) * (cc.oee_pct / 100);

      // Find tools assigned to a machine in this class.
      const machineIds = new Set(machines.map(m => m.id));
      const classTools = tools.filter(t => t.assigned_machine_id != null && machineIds.has(t.assigned_machine_id));
      const contributing: { tool_number: string; mach_equivalents: number }[] = [];
      let demand = 0;
      for (const t of classTools) {
        const v = volumes.find(vv => vv.tool_id === t.id && vv.year === year);
        if (!v || v.pieces_per_year <= 0) continue;
        const pph = (t.cavities * 3600) / t.rated_cycle_time_sec;
        const hours = v.pieces_per_year / pph;
        const me = hours / hours_per_machine;
        demand += me;
        contributing.push({ tool_number: t.tool_number, mach_equivalents: me });
      }
      const free = machines.length - demand;
      yearCells.push({
        year, hours_per_machine, demand, available: machines.length, free,
        utilization_pct: machines.length > 0 ? (demand / machines.length) * 100 : 0,
        status: statusFor(free), contributing_tools: contributing,
      });
    }

    out.push({
      tonnage_t, requires_2k, requires_mucell, requires_variotherm,
      label: classLabel({ tonnage_t, requires_2k, requires_mucell, requires_variotherm }),
      machines: machines.length,
      shifts_per_week: classCapacity.find(c => c.tonnage_t === tonnage_t)?.shifts_per_week ?? 15,
      years: yearCells,
    });
  }

  out.sort((a, b) => a.tonnage_t - b.tonnage_t);
  return out;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
cd backend && npx tsx --test src/__tests__/capacity-engine.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-engine.ts backend/src/__tests__/capacity-engine.test.ts
git commit -m "feat(capacity): computeCapacity engine with modification overlay"
```

---

## Task 7: CRUD route — `im_tools`

**Files:**
- Create: `backend/src/routes/im-tools.ts`
- Modify: `backend/src/index.ts` (mount the router)

- [ ] **Step 1: Create the router**

Create `backend/src/routes/im-tools.ts`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

const TOOL_COLS = [
  'tool_number','description','customer','program',
  'cavities','rated_cycle_time_sec','operator_fte','raw_material_kg_per_piece',
  'qualified_min_tonnage_t','qualified_max_tonnage_t','shot_volume_required_cm3',
  'requires_2k','requires_mucell','requires_variotherm',
  'assigned_machine_id','status','pdb_tool_ref','process_sheet_file_id',
];

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_tools ORDER BY tool_number');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_tools WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/', async (req: any, res) => {
  try {
    const cols = TOOL_COLS.filter(c => req.body[c] !== undefined);
    const vals = cols.map((c, i) => `$${i+1}`);
    const r = await pool.query(
      `INSERT INTO im_tools (${cols.join(',')}, last_edited_by)
       VALUES (${vals.join(',')}, $${cols.length+1}) RETURNING *`,
      [...cols.map(c => req.body[c]), req.user?.username ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

router.put('/:id', async (req: any, res) => {
  try {
    const updates = TOOL_COLS.filter(c => req.body[c] !== undefined);
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = updates.map((c, i) => `${c} = $${i+1}`).join(', ');
    const r = await pool.query(
      `UPDATE im_tools SET ${setClause}, last_edited_by = $${updates.length+1}, updated_at = NOW()
       WHERE id = $${updates.length+2} RETURNING *`,
      [...updates.map(c => req.body[c]), req.user?.username ?? null, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM im_tools WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
```

- [ ] **Step 2: Mount in `index.ts`**

Open `backend/src/index.ts`. Add import near the others:

```ts
import imToolsRoutes from './routes/im-tools.js';
```

And mount with the other protected routes:

```ts
app.use('/api/im-tools', ssoAuth, imToolsRoutes);
```

- [ ] **Step 3: Smoke test manually**

```bash
cd backend && npm run dev &
# (use the dev SSO bypass cookie or hit through nginx; project-specific)
curl -s http://localhost:3001/api/im-tools | head
```

Expected: empty array `[]`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/im-tools.ts backend/src/index.ts
git commit -m "feat(capacity): im-tools CRUD"
```

---

## Task 8: CRUD route — `im_tool_volumes`

**Files:**
- Create: `backend/src/routes/im-tool-volumes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the router**

Create `backend/src/routes/im-tool-volumes.ts`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/tool-volumes?tool_id=123  → all years for one tool
// GET /api/tool-volumes?year=2026    → all tools for one year
router.get('/', async (req, res) => {
  try {
    const where: string[] = [], params: any[] = [];
    if (req.query.tool_id) { params.push(req.query.tool_id); where.push(`tool_id = $${params.length}`); }
    if (req.query.year)    { params.push(req.query.year);    where.push(`year = $${params.length}`); }
    const sql = `SELECT * FROM im_tool_volumes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY tool_id, year`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// PUT /api/tool-volumes  body: { tool_id, year, pieces_per_year }  (upsert)
router.put('/', async (req: any, res) => {
  try {
    const { tool_id, year, pieces_per_year } = req.body;
    if (tool_id == null || year == null || pieces_per_year == null)
      return res.status(400).json({ error: 'tool_id, year, pieces_per_year required' });
    const r = await pool.query(
      `INSERT INTO im_tool_volumes (tool_id, year, pieces_per_year, updated_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tool_id, year)
       DO UPDATE SET pieces_per_year = EXCLUDED.pieces_per_year, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING *`,
      [tool_id, year, pieces_per_year, req.user?.username ?? null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

// DELETE /api/tool-volumes?tool_id=&year=
router.delete('/', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM im_tool_volumes WHERE tool_id = $1 AND year = $2',
      [req.query.tool_id, req.query.year]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Volume row not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
```

- [ ] **Step 2: Mount in `index.ts`**

Add import + mount alongside the existing protected routes:

```ts
import imToolVolumesRoutes from './routes/im-tool-volumes.js';
// ...
app.use('/api/tool-volumes', ssoAuth, imToolVolumesRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/im-tool-volumes.ts backend/src/index.ts
git commit -m "feat(capacity): tool-volumes upsert CRUD"
```

---

## Task 9: CRUD route — `im_class_capacity`

**Files:**
- Create: `backend/src/routes/im-class-capacity.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the router**

Create `backend/src/routes/im-class-capacity.ts`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

const KEY_COLS = ['tonnage_t','requires_2k','requires_mucell','requires_variotherm','year'];
const VAL_COLS = ['oee_pct','shifts_per_week','working_days_year','planned_downtime_wk'];

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_class_capacity ORDER BY tonnage_t, year');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// Upsert by composite key
router.put('/', async (req, res) => {
  try {
    const keys = KEY_COLS.map(c => req.body[c]);
    const vals = VAL_COLS.map(c => req.body[c]);
    if (keys.some(v => v === undefined))
      return res.status(400).json({ error: `Required key fields: ${KEY_COLS.join(', ')}` });
    const r = await pool.query(
      `INSERT INTO im_class_capacity (${KEY_COLS.join(',')}, ${VAL_COLS.join(',')})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year)
       DO UPDATE SET ${VAL_COLS.map((c,i) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()
       RETURNING *`,
      [...keys, ...vals]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

export default router;
```

- [ ] **Step 2: Mount**

```ts
import imClassCapacityRoutes from './routes/im-class-capacity.js';
// ...
app.use('/api/class-capacity', ssoAuth, imClassCapacityRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/im-class-capacity.ts backend/src/index.ts
git commit -m "feat(capacity): class-capacity upsert CRUD"
```

---

## Task 10: CRUD route — `im_scenarios`

**Files:**
- Create: `backend/src/routes/im-scenarios.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the router**

Create `backend/src/routes/im-scenarios.ts`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, description, owner, combined_from, jsonb_array_length(modifications) AS mod_count, created_at, updated_at FROM im_scenarios ORDER BY updated_at DESC'
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_scenarios WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/', async (req: any, res) => {
  try {
    const { name, description, modifications, combined_from } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(
      `INSERT INTO im_scenarios (name, description, modifications, owner, combined_from)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *`,
      [name, description ?? null, JSON.stringify(modifications ?? []), req.user?.username ?? null, combined_from ?? []]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, modifications } = req.body;
    const r = await pool.query(
      `UPDATE im_scenarios SET name = COALESCE($1,name),
                                description = COALESCE($2,description),
                                modifications = COALESCE($3::jsonb, modifications),
                                updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name ?? null, description ?? null, modifications != null ? JSON.stringify(modifications) : null, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM im_scenarios WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
```

- [ ] **Step 2: Mount**

```ts
import imScenariosRoutes from './routes/im-scenarios.js';
// ...
app.use('/api/scenarios', ssoAuth, imScenariosRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/im-scenarios.ts backend/src/index.ts
git commit -m "feat(capacity): scenarios CRUD"
```

---

## Task 11: Capacity overview + simulate routes (internal `/api`)

**Files:**
- Create: `backend/src/routes/capacity.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the router**

Create `backend/src/routes/capacity.ts`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';
import { computeCapacity, type Modification } from '../services/capacity-engine.js';

const router = Router();

async function loadInputs(yearFrom: number, yearTo: number) {
  const [machines, tools, volumes, classCapacity] = await Promise.all([
    pool.query(`SELECT id, clamping_force_kn, iu1_shot_volume_cm3,
                       COALESCE(is_2k,false) AS is_2k,
                       COALESCE(has_mucell,false) AS has_mucell,
                       COALESCE(has_variotherm,false) AS has_variotherm
                FROM machines WHERE plant_location = 'usa'`),
    pool.query(`SELECT id, tool_number, description, customer, program,
                       cavities, rated_cycle_time_sec,
                       qualified_min_tonnage_t, qualified_max_tonnage_t, shot_volume_required_cm3,
                       requires_2k, requires_mucell, requires_variotherm,
                       assigned_machine_id, status
                FROM im_tools WHERE status IN ('active','candidate') AND assigned_machine_id IS NOT NULL`),
    pool.query(`SELECT tool_id, year, pieces_per_year FROM im_tool_volumes
                WHERE year BETWEEN $1 AND $2`, [yearFrom, yearTo]),
    pool.query(`SELECT * FROM im_class_capacity WHERE year BETWEEN $1 AND $2`, [yearFrom, yearTo]),
  ]);
  return {
    machines: machines.rows, tools: tools.rows.map(t => ({ ...t, cavities: Number(t.cavities), rated_cycle_time_sec: Number(t.rated_cycle_time_sec) })),
    volumes: volumes.rows.map(v => ({ ...v, pieces_per_year: Number(v.pieces_per_year) })),
    classCapacity: classCapacity.rows.map(c => ({
      ...c,
      oee_pct: Number(c.oee_pct), shifts_per_week: Number(c.shifts_per_week),
      working_days_year: Number(c.working_days_year), planned_downtime_wk: Number(c.planned_downtime_wk),
    })),
  };
}

router.get('/overview', async (req, res) => {
  try {
    const yearFrom = Number(req.query.year_from ?? new Date().getFullYear());
    const yearTo = Number(req.query.year_to ?? yearFrom + 5);
    const inputs = await loadInputs(yearFrom, yearTo);
    res.json(computeCapacity({ ...inputs, yearFrom, yearTo }));
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/simulate', async (req, res) => {
  try {
    const yearFrom = Number(req.body.year_from ?? new Date().getFullYear());
    const yearTo = Number(req.body.year_to ?? yearFrom + 5);
    const modifications: Modification[] = req.body.modifications ?? [];
    const inputs = await loadInputs(yearFrom, yearTo);
    const before = computeCapacity({ ...inputs, yearFrom, yearTo });
    const after = computeCapacity({ ...inputs, yearFrom, yearTo, modifications });
    res.json({ before, after });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
```

- [ ] **Step 2: Mount**

```ts
import capacityRoutes from './routes/capacity.js';
// ...
app.use('/api/capacity', ssoAuth, capacityRoutes);
```

- [ ] **Step 3: Smoke test**

```bash
curl -s http://localhost:3001/api/capacity/overview?year_from=2025\&year_to=2030 | head
```

Expected: JSON array of class objects, even if mostly empty.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/capacity.ts backend/src/index.ts
git commit -m "feat(capacity): /api/capacity overview + simulate"
```

---

## Task 12: Public `/v1/capacity` routes (bearer auth)

**Files:**
- Create: `backend/src/routes/v1-capacity.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the router**

Create `backend/src/routes/v1-capacity.ts`. Identical handlers to Task 11, but the router is mounted under `/v1` with `serviceAuth`:

```ts
import { Router } from 'express';
import pool from '../db/connection.js';
import { computeCapacity, type Modification } from '../services/capacity-engine.js';

const router = Router();

async function loadInputs(yearFrom: number, yearTo: number) {
  const [machines, tools, volumes, classCapacity] = await Promise.all([
    pool.query(`SELECT id, clamping_force_kn, iu1_shot_volume_cm3,
                       COALESCE(is_2k,false) AS is_2k,
                       COALESCE(has_mucell,false) AS has_mucell,
                       COALESCE(has_variotherm,false) AS has_variotherm
                FROM machines WHERE plant_location = 'usa'`),
    pool.query(`SELECT id, tool_number, description, customer, program,
                       cavities, rated_cycle_time_sec,
                       qualified_min_tonnage_t, qualified_max_tonnage_t, shot_volume_required_cm3,
                       requires_2k, requires_mucell, requires_variotherm,
                       assigned_machine_id, status
                FROM im_tools WHERE status IN ('active','candidate') AND assigned_machine_id IS NOT NULL`),
    pool.query(`SELECT tool_id, year, pieces_per_year FROM im_tool_volumes WHERE year BETWEEN $1 AND $2`, [yearFrom, yearTo]),
    pool.query(`SELECT * FROM im_class_capacity WHERE year BETWEEN $1 AND $2`, [yearFrom, yearTo]),
  ]);
  return {
    machines: machines.rows,
    tools: tools.rows.map(t => ({ ...t, cavities: Number(t.cavities), rated_cycle_time_sec: Number(t.rated_cycle_time_sec) })),
    volumes: volumes.rows.map(v => ({ ...v, pieces_per_year: Number(v.pieces_per_year) })),
    classCapacity: classCapacity.rows.map(c => ({
      ...c,
      oee_pct: Number(c.oee_pct), shifts_per_week: Number(c.shifts_per_week),
      working_days_year: Number(c.working_days_year), planned_downtime_wk: Number(c.planned_downtime_wk),
    })),
  };
}

router.get('/capacity/overview', async (req, res) => {
  const yearFrom = Number(req.query.year_from ?? new Date().getFullYear());
  const yearTo = Number(req.query.year_to ?? yearFrom + 5);
  const inputs = await loadInputs(yearFrom, yearTo);
  res.json(computeCapacity({ ...inputs, yearFrom, yearTo }));
});

router.post('/capacity/simulate', async (req, res) => {
  const yearFrom = Number(req.body.year_from ?? new Date().getFullYear());
  const yearTo = Number(req.body.year_to ?? yearFrom + 5);
  const modifications: Modification[] = req.body.modifications ?? [];
  const inputs = await loadInputs(yearFrom, yearTo);
  const before = computeCapacity({ ...inputs, yearFrom, yearTo });
  const after = computeCapacity({ ...inputs, yearFrom, yearTo, modifications });
  res.json({ before, after });
});

export default router;
```

NOTE: To avoid the duplicated `loadInputs`, both routers can later import from a shared module. Keep duplication for now — refactor only if a third caller appears (YAGNI).

- [ ] **Step 2: Mount under existing `/v1` prefix**

In `backend/src/index.ts`:

```ts
import v1CapacityRoutes from './routes/v1-capacity.js';
// ...
app.use('/v1', serviceAuth, v1CapacityRoutes);  // already covers /v1/* via serviceAuth
```

If `app.use('/v1', serviceAuth, v1MachinesRoutes)` already exists, add the capacity router after it the same way.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/v1-capacity.ts backend/src/index.ts
git commit -m "feat(capacity): /v1/capacity public endpoints (RFQ2)"
```

---

## Task 13: Excel bootstrap importer — class capacity sheet

**Files:**
- Create: `backend/src/services/capacity-import.ts`
- Create: `backend/src/__tests__/capacity-import.test.ts`

The Excel file (`data/files/Capacity/IM_Capacity_85%OEE_*.xlsb`) has a sheet `Total Overview Capacity` with rows like:

```
KM 80   85%   15 sh/wk   2018=...  2019=...  ...  2030=...
```

This task imports the class capacity rows for years in range.

- [ ] **Step 1: Add a failing test using a tiny xlsx fixture**

Create `backend/src/__tests__/capacity-import.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseClassCapacity } from '../services/capacity-import.js';

test('parseClassCapacity: extracts rows from Total Overview Capacity sheet', () => {
  // Build a minimal in-memory workbook
  const ws = XLSX.utils.aoa_to_sheet([
    [],                              // row 0
    [],                              // row 1
    [null,'No Flex','OEE %',null,'Shifts / week',null, 2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030],
    [],
    [null,'KM 80', 85, '%', 15, null, 0.03, 0.18, 0.18, 0.19, 1.90, 1.32, 1.25, 0.88, 1.11, 0.83, 0.70, 0.10, 0.0],
    [null,'Utilization'],
    [],
    [null,null,'OEE %',null,'Shifts / week',null, 2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030],
    [],
    [null,'KM 200', 85, '%', 15],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Total Overview Capacity');

  const rows = parseClassCapacity(wb, 2025, 2027);
  // Expect KM 80 entries for 2025, 2026, 2027 with OEE=85, shifts=15
  const km80 = rows.filter(r => r.label === 'KM 80');
  assert.equal(km80.length, 3);
  assert.equal(km80[0].oee_pct, 85);
  assert.equal(km80[0].shifts_per_week, 15);
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npx tsx --test src/__tests__/capacity-import.test.ts
```

- [ ] **Step 3: Implement `parseClassCapacity`**

Create `backend/src/services/capacity-import.ts`:

```ts
import * as XLSX from 'xlsx';

export type ParsedClassRow = {
  label: string;          // e.g. "KM 80", "KM 350 2K"
  tonnage_t: number;      // parsed from label
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  year: number;
  oee_pct: number;
  shifts_per_week: number;
};

function parseClassLabel(raw: string): { tonnage_t: number; flags: { requires_2k: boolean; requires_mucell: boolean; requires_variotherm: boolean } } | null {
  const m = String(raw).match(/KM\s*(\d+)/i);
  if (!m) return null;
  const tonnage_t = Number(m[1]);
  const upper = raw.toUpperCase();
  return { tonnage_t,
    flags: {
      requires_2k: /\b2K\b/.test(upper),
      requires_mucell: /MUCELL/.test(upper),
      requires_variotherm: /VARIO/.test(upper),
    } };
}

export function parseClassCapacity(wb: XLSX.WorkBook, yearFrom: number, yearTo: number): ParsedClassRow[] {
  const sh = wb.Sheets['Total Overview Capacity'];
  if (!sh) throw new Error('Sheet "Total Overview Capacity" not found');
  const aoa: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true });
  const out: ParsedClassRow[] = [];

  // Find header rows (those containing year columns 2018..) and the immediately
  // following class row. Year header row has 'OEE %' or 'No Flex' in column 1 or 2.
  for (let i = 0; i < aoa.length - 2; i++) {
    const row = aoa[i] ?? [];
    // Year columns start at index 6 in the source sheet
    if (typeof row[6] !== 'number' || row[6] < 2010) continue;
    const yearCols: { col: number; year: number }[] = [];
    for (let c = 6; c < row.length; c++) if (typeof row[c] === 'number' && row[c] >= 2010 && row[c] <= 2050) {
      yearCols.push({ col: c, year: row[c] });
    }
    // Class row is two rows down (skip blank row)
    const classRow = aoa[i + 2];
    if (!classRow || typeof classRow[1] !== 'string') continue;
    const parsed = parseClassLabel(classRow[1]);
    if (!parsed) continue;
    const oee = Number(classRow[2]);
    const shifts = Number(classRow[4]);
    if (!Number.isFinite(oee) || !Number.isFinite(shifts)) continue;
    for (const { year } of yearCols) {
      if (year < yearFrom || year > yearTo) continue;
      out.push({
        label: classRow[1].trim(),
        tonnage_t: parsed.tonnage_t,
        requires_2k: parsed.flags.requires_2k,
        requires_mucell: parsed.flags.requires_mucell,
        requires_variotherm: parsed.flags.requires_variotherm,
        year, oee_pct: oee, shifts_per_week: shifts,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && npx tsx --test src/__tests__/capacity-import.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-import.ts backend/src/__tests__/capacity-import.test.ts
git commit -m "feat(capacity): parse class capacity sheet from xlsx"
```

---

## Task 14: Excel bootstrap importer — per-tool data

**Files:**
- Modify: `backend/src/services/capacity-import.ts`
- Modify: `backend/src/__tests__/capacity-import.test.ts`

Per-machine-class sheets (`KM 80`, `KM 200`, …) have repeating tool blocks. Each block:

```
Row N+0:  Tool #     <num>      Tool #     <num>      Tool #     <num>
Row N+1:  Pieces     Operator   Raw Material  ... (per tool)
Row N+2:  cavity     <n>
Row N+3:  cycle time sec.  <s>
Row N+4:  piece/hr.  <pcs>     ...
Row N+5–8: piece/day, /week, /month, /year
```

Plus a forecast table (right side of the sheet) mapping tool # → annual machine-equivalents per year.

Phase 1 imports the per-tool spec (cavities, cycle time) and uses the forecast table to derive `pieces_per_year` per tool per year via inverse calc:
`pieces_per_year = mach_equiv × hours_per_machine × pieces_per_hour`.

- [ ] **Step 1: Add failing test**

Append to `backend/src/__tests__/capacity-import.test.ts`:

```ts
import { parseToolSheet } from '../services/capacity-import.js';

test('parseToolSheet: extracts tools + cavity + cycle from a KM-XXX sheet', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [], [], [], [], [], [], [], [],
    ['Tool #', 820,, , , 'Tool #', 821, , , , 'Tool #', 822],            // row 8
    ['Pieces','','Operator','Raw Material','','Pieces','','Operator','Raw Material','','Pieces','','Operator','Raw Material'],
    ['cavity', 2, , , , 'cavity', 1, , , , 'cavity', 1],                 // row 10
    ['cycle time sec.', 45, , , , 'cycle time sec.', 45, , , , 'cycle time sec.', 45], // row 11
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KM 200');
  const tools = parseToolSheet(wb, 'KM 200');
  assert.equal(tools.length, 3);
  assert.equal(tools[0].tool_number, '820');
  assert.equal(tools[0].cavities, 2);
  assert.equal(tools[0].rated_cycle_time_sec, 45);
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npx tsx --test src/__tests__/capacity-import.test.ts
```

- [ ] **Step 3: Implement `parseToolSheet`**

Append to `backend/src/services/capacity-import.ts`:

```ts
export type ParsedTool = {
  tool_number: string;
  cavities: number;
  rated_cycle_time_sec: number;
  source_sheet: string;
};

export function parseToolSheet(wb: XLSX.WorkBook, sheetName: string): ParsedTool[] {
  const sh = wb.Sheets[sheetName];
  if (!sh) throw new Error(`Sheet "${sheetName}" not found`);
  const aoa: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true });
  const out: ParsedTool[] = [];

  // The tool blocks repeat in groups of 3 columns. A block starts at any row where
  // column-A or other column has the literal "Tool #" and the next column is a number/string.
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'Tool #') continue;
      const numCell = row[c + 1];
      if (numCell == null || numCell === '') continue;
      // Look downward for cavity + cycle time at known offsets (+2, +3 in sample).
      // In the real Excel "cavity" is two rows below the Tool # row in the same column block.
      // Be liberal: scan rows r+1..r+8 for the labels in column c.
      let cavities: number | undefined, cycle: number | undefined;
      for (let dr = 1; dr <= 8; dr++) {
        const r2 = aoa[r + dr];
        if (!r2) continue;
        if (r2[c] === 'cavity' && typeof r2[c + 1] === 'number') cavities = r2[c + 1];
        if (typeof r2[c] === 'string' && /cycle time/i.test(r2[c]) && typeof r2[c + 1] === 'number') cycle = r2[c + 1];
      }
      if (cavities && cycle) {
        out.push({
          tool_number: String(numCell).trim(),
          cavities, rated_cycle_time_sec: cycle,
          source_sheet: sheetName,
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && npx tsx --test src/__tests__/capacity-import.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-import.ts backend/src/__tests__/capacity-import.test.ts
git commit -m "feat(capacity): parse per-tool data from KM-XXX sheets"
```

---

## Task 15: Bootstrap import script — apply parsed data to DB

**Files:**
- Create: `backend/src/services/capacity-bootstrap.ts`
- Create: `backend/scripts/run-capacity-bootstrap.ts`

Read the actual `.xlsb`, run the parsers, write to DB. This is a one-shot script invoked manually.

- [ ] **Step 1: Implement the bootstrap orchestration**

Create `backend/src/services/capacity-bootstrap.ts`:

```ts
import * as XLSX from 'xlsx';
import pool from '../db/connection.js';
import { parseClassCapacity, parseToolSheet, type ParsedTool, type ParsedClassRow } from './capacity-import.js';

export async function runCapacityBootstrap(opts: {
  xlsxPath: string;
  yearFrom: number;
  yearTo: number;
  toolSheetNames: string[];   // e.g. ['KM 80', 'KM 200 ', 'KM 350', ...]
  dryRun: boolean;
}): Promise<{ classRows: number; tools: number; conflicts: { tool_number: string; existing_id: number }[] }> {
  const wb = XLSX.readFile(opts.xlsxPath);
  const classRows = parseClassCapacity(wb, opts.yearFrom, opts.yearTo);
  const tools: ParsedTool[] = [];
  for (const name of opts.toolSheetNames) tools.push(...parseToolSheet(wb, name));

  if (opts.dryRun) return { classRows: classRows.length, tools: tools.length, conflicts: [] };

  // 1. Upsert class capacity
  for (const row of classRows) {
    await pool.query(
      `INSERT INTO im_class_capacity (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year, oee_pct, shifts_per_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year)
       DO UPDATE SET oee_pct = EXCLUDED.oee_pct, shifts_per_week = EXCLUDED.shifts_per_week, updated_at = NOW()`,
      [row.tonnage_t, row.requires_2k, row.requires_mucell, row.requires_variotherm, row.year, row.oee_pct, row.shifts_per_week]
    );
  }

  // 2. Insert tools, skipping existing tool_numbers (report conflicts).
  const conflicts: { tool_number: string; existing_id: number }[] = [];
  for (const t of tools) {
    const existing = await pool.query('SELECT id FROM im_tools WHERE tool_number = $1', [t.tool_number]);
    if (existing.rowCount! > 0) {
      conflicts.push({ tool_number: t.tool_number, existing_id: existing.rows[0].id });
      continue;
    }
    // Tonnage qualification inferred from source sheet name (e.g. "KM 200" → 200)
    const m = t.source_sheet.match(/KM\s*(\d+)/i);
    const tonnage = m ? Number(m[1]) : null;
    await pool.query(
      `INSERT INTO im_tools (tool_number, cavities, rated_cycle_time_sec,
                             qualified_min_tonnage_t, qualified_max_tonnage_t,
                             requires_2k, requires_mucell, requires_variotherm, status)
       VALUES ($1,$2,$3,$4,$4, $5,$6,$7, 'inactive')`,
      [t.tool_number, t.cavities, t.rated_cycle_time_sec, tonnage,
       /2K/i.test(t.source_sheet), /MUCELL/i.test(t.source_sheet), /VARIO/i.test(t.source_sheet)]
    );
  }

  return { classRows: classRows.length, tools: tools.length - conflicts.length, conflicts };
}
```

NOTE: tools are inserted with `status = 'inactive'` until the engineer manually assigns each to a machine and confirms cycle time / qualification. This avoids importing junk into the live capacity calc.

- [ ] **Step 2: Create the runner script**

Create `backend/scripts/run-capacity-bootstrap.ts`:

```ts
#!/usr/bin/env tsx
import { runCapacityBootstrap } from '../src/services/capacity-bootstrap.js';

const xlsxPath = process.argv[2] ?? '/app/data/files/Capacity/IM_Capacity_85%OEE_No Flex_Current +G6X_G45 UBV_G45WAL2300+VW426Grill1600_WB_2-12-26_3200.xlsb';
const dryRun = process.argv.includes('--dry-run');

const TOOL_SHEETS = [
  'KM 80','KM 200 ','KM 350','KM 350 2K','KM 550 2k','KM 650',
  'KM 900-5','KM 900 1-3','KM 1000 2k','KM 1300 2k','KM 1600 2k',
  'KM 1600-3 (New)','KM 2300','KM 3200',
];

(async () => {
  const result = await runCapacityBootstrap({
    xlsxPath, yearFrom: 2025, yearTo: 2030,
    toolSheetNames: TOOL_SHEETS, dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
```

- [ ] **Step 3: Run dry-run inside the backend container**

```bash
docker exec machinedb-backend npx tsx scripts/run-capacity-bootstrap.ts --dry-run
```

Expected: JSON with `classRows` ≥ ~60 (10 classes × 6 years) and `tools` ≥ ~30, no DB writes yet.

- [ ] **Step 4: Run for real**

```bash
docker exec machinedb-backend npx tsx scripts/run-capacity-bootstrap.ts
```

Expected: DB rows inserted; `conflicts` should be empty on a fresh DB.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/capacity-bootstrap.ts backend/scripts/run-capacity-bootstrap.ts
git commit -m "feat(capacity): bootstrap importer one-shot script"
```

---

## Task 16: Frontend — types and API client

**Files:**
- Create: `frontend/src/types/capacity.ts`
- Create: `frontend/src/services/capacityApi.ts`

- [ ] **Step 1: Create types**

Create `frontend/src/types/capacity.ts`:

```ts
export type CellStatus = 'green' | 'yellow' | 'orange' | 'red';

export type CapacityCell = {
  year: number;
  hours_per_machine: number;
  demand: number;
  available: number;
  free: number;
  utilization_pct: number;
  status: CellStatus;
  contributing_tools: { tool_number: string; mach_equivalents: number }[];
};

export type CapacityClass = {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  label: string;
  machines: number;
  shifts_per_week: number;
  years: CapacityCell[];
};

export type Modification =
  | { type: 'add_tool'; tool: any; volumes: { year: number; pieces_per_year: number }[] }
  | { type: 'move_tool'; tool_id: number; target_machine_id: number }
  | { type: 'remove_tool'; tool_id: number }
  | { type: 'change_volume'; tool_id: number; year: number; pieces_per_year: number }
  | { type: 'change_class_param';
      class_key: { tonnage_t: number; requires_2k: boolean; requires_mucell: boolean; requires_variotherm: boolean };
      year_or_all: number | 'all';
      field: 'oee_pct' | 'shifts_per_week' | 'working_days_year' | 'planned_downtime_wk';
      value: number };

export type Tool = {
  id: number;
  tool_number: string;
  description?: string;
  customer?: string;
  program?: string;
  cavities: number;
  rated_cycle_time_sec: number;
  assigned_machine_id: number | null;
  status: 'active' | 'inactive' | 'candidate';
  qualified_min_tonnage_t: number | null;
  qualified_max_tonnage_t: number | null;
  shot_volume_required_cm3: number | null;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
};

export type Machine = {
  id: number;
  internal_name: string;
  manufacturer: string | null;
  year_of_construction: number | null;
  clamping_force_kn: number | null;
  iu1_shot_volume_cm3: number | null;
  is_2k: boolean;
  has_mucell: boolean;
  has_variotherm: boolean;
};
```

- [ ] **Step 2: Create the API client**

Create `frontend/src/services/capacityApi.ts`:

```ts
import axios from 'axios';
import type { CapacityClass, Modification, Tool, Machine } from '../types/capacity';

const api = axios.create({ baseURL: '/api', withCredentials: true });

export async function fetchOverview(yearFrom: number, yearTo: number): Promise<CapacityClass[]> {
  const r = await api.get('/capacity/overview', { params: { year_from: yearFrom, year_to: yearTo } });
  return r.data;
}

export async function simulateOverview(
  modifications: Modification[], yearFrom: number, yearTo: number
): Promise<{ before: CapacityClass[]; after: CapacityClass[] }> {
  const r = await api.post('/capacity/simulate', { modifications, year_from: yearFrom, year_to: yearTo });
  return r.data;
}

export async function fetchTools(): Promise<Tool[]> { return (await api.get('/im-tools')).data; }
export async function fetchMachines(): Promise<Machine[]> { return (await api.get('/machines')).data; }

export async function moveTool(toolId: number, machineId: number): Promise<Tool> {
  return (await api.put(`/im-tools/${toolId}`, { assigned_machine_id: machineId })).data;
}

export async function saveScenario(name: string, modifications: Modification[]) {
  return (await api.post('/scenarios', { name, modifications })).data;
}
export async function listScenarios() { return (await api.get('/scenarios')).data; }
export async function loadScenario(id: number) { return (await api.get(`/scenarios/${id}`)).data; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/capacity.ts frontend/src/services/capacityApi.ts
git commit -m "feat(capacity): frontend types + API client"
```

---

## Task 17: Frontend — Sparkline + ClassCard collapsed

**Files:**
- Create: `frontend/src/components/capacity/Sparkline.tsx`
- Create: `frontend/src/components/capacity/ClassCard.tsx`

- [ ] **Step 1: Create Sparkline**

Create `frontend/src/components/capacity/Sparkline.tsx`:

```tsx
import type { CapacityCell } from '../../types/capacity';

const COLOR_FILL = { green: '#e9f2ec', yellow: '#f5edda', orange: '#f4e4d6', red: '#f3dada' } as const;
const COLOR_STROKE = { green: '#2f6f4f', yellow: '#b8862a', orange: '#b06a3a', red: '#a84040' } as const;

export function Sparkline({ cells }: { cells: CapacityCell[] }) {
  const maxAvail = Math.max(...cells.map(c => c.available), 1);
  const barW = 38, gap = 8, h = 38;
  return (
    <svg className="w-full" style={{ height: h }} viewBox={`0 0 ${cells.length * (barW + gap)} ${h}`} preserveAspectRatio="none">
      <line x1={0} y1={5} x2={cells.length * (barW + gap)} y2={5} stroke="#1a1a1a" strokeDasharray="2 3" strokeWidth={1} />
      {cells.map((c, i) => {
        const value = Math.max(c.demand, 0);
        const height = Math.min(value / maxAvail, 1) * (h - 6);
        return (
          <rect key={c.year} x={i * (barW + gap) + 6} y={h - height} width={barW} height={height}
            fill={COLOR_FILL[c.status]} stroke={COLOR_STROKE[c.status]} rx={2} />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Create ClassCard with collapsed/expanded toggle (collapsed body for now)**

Create `frontend/src/components/capacity/ClassCard.tsx`:

```tsx
import { useState } from 'react';
import type { CapacityClass } from '../../types/capacity';
import { Sparkline } from './Sparkline';

const DOT = { green: '#2f6f4f', yellow: '#b8862a', orange: '#b06a3a', red: '#a84040' } as const;

export function ClassCard({ cls }: { cls: CapacityClass }) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const headlineCell = cls.years.find(y => y.year === thisYear) ?? cls.years[0];
  const worst = cls.years.reduce((a, b) => (a.free < b.free ? a : b), cls.years[0]);

  return (
    <div className="bg-white border border-[#ececea] rounded-[22px] mb-3.5 overflow-hidden"
         style={{ boxShadow: '0 1px 0 rgba(20,20,30,0.02), 0 14px 32px -22px rgba(20,20,30,0.08)' }}>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] items-center gap-6 p-6 cursor-pointer"
           onClick={() => setOpen(!open)}>
        <div>
          <div className="text-base font-medium tracking-tight">
            <span className="text-[#8a8a8e] mr-2 font-mono text-xs">{open ? '▾' : '▸'}</span>{cls.label}
          </div>
          <div className="text-xs text-[#8a8a8e] mt-1 flex gap-2.5">
            <span>{cls.machines} presses</span>
            {cls.requires_2k && <span>2K</span>}
            {cls.requires_mucell && <span>MuCell</span>}
            {cls.requires_variotherm && <span>Variotherm</span>}
            <span>{cls.shifts_per_week} sh / week</span>
          </div>
        </div>
        <div><Sparkline cells={cls.years} /></div>
        <div className="flex flex-col items-end gap-1 text-[12.5px]">
          <div className="flex items-center gap-2 text-[#5a5a5e]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: DOT[headlineCell.status] }} />
            '{String(headlineCell.year).slice(2)} <b className="font-mono font-medium text-[#1a1a1a]">{headlineCell.free >= 0 ? '+' : ''}{headlineCell.free.toFixed(2)}</b> free
            <span className="text-[#8a8a8e]">/ {headlineCell.utilization_pct.toFixed(0)}%</span>
          </div>
          {worst.year !== headlineCell.year && (
            <div className="flex items-center gap-2 text-[#5a5a5e]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: DOT[worst.status] }} />
              '{String(worst.year).slice(2)} <b className="font-mono font-medium text-[#1a1a1a]">{worst.free >= 0 ? '+' : ''}{worst.free.toFixed(2)}</b>
            </div>
          )}
        </div>
      </div>
      {open && <ClassCardExpanded cls={cls} />}
    </div>
  );
}

function ClassCardExpanded({ cls }: { cls: CapacityClass }) {
  // Filled in Task 18.
  return <div className="border-t border-[#ececea] p-6 text-sm text-[#5a5a5e]">Expanded view coming in Task 18.</div>;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/capacity/
git commit -m "feat(capacity): collapsed class card + sparkline"
```

---

## Task 18: Frontend — StackedBarChart + ClassCardExpanded

**Files:**
- Create: `frontend/src/components/capacity/StackedBarChart.tsx`
- Modify: `frontend/src/components/capacity/ClassCard.tsx` (replace placeholder)

- [ ] **Step 1: Create StackedBarChart**

Create `frontend/src/components/capacity/StackedBarChart.tsx`:

```tsx
import type { CapacityCell } from '../../types/capacity';

const SEG_FILLS = ['#d6e8de', '#c3ddcd', '#b0d2bc', '#9dc7ab', '#88baa0'];

export function StackedBarChart({ cells }: { cells: CapacityCell[] }) {
  return (
    <div className="grid grid-cols-6 gap-4 pt-5">
      {cells.map(cell => {
        const scale = (cell.available || 1) > 0 ? 152 / cell.available : 152;
        let cumulative = 0;
        return (
          <div key={cell.year} className="relative">
            <div className="flex justify-between items-baseline mb-2 text-[11px] text-[#8a8a8e] uppercase tracking-wider">
              <span className="font-mono text-xs text-[#1a1a1a] normal-case tracking-normal">{cell.year}</span>
              <span className="font-mono">{cell.demand.toFixed(2)}</span>
            </div>
            <div className="relative h-[152px] rounded-md overflow-visible"
                 style={{ background: 'repeating-linear-gradient(to top, transparent 0, transparent 24px, #ececea 24px, #ececea 25px)' }}>
              <div className="absolute -left-1 -right-1 border-t-[1.5px] border-dashed border-[#1a1a1a] z-[5]" style={{ bottom: '100%' }} />
              {cell.contributing_tools.map((t, i) => {
                const segHeight = Math.max(t.mach_equivalents * scale, 0);
                const segBottom = cumulative;
                cumulative += segHeight;
                return (
                  <div key={t.tool_number}
                       className="absolute left-1 right-1 rounded-sm cursor-pointer"
                       style={{ bottom: segBottom, height: segHeight, background: SEG_FILLS[i % SEG_FILLS.length] }}
                       title={`${t.tool_number} · ${t.mach_equivalents.toFixed(2)} mach`}>
                    <span className="absolute left-1.5 right-1.5 bottom-[3px] text-[10.5px] font-mono text-black/60 truncate block">
                      {t.tool_number}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex justify-between items-baseline text-[11.5px]">
              <span className={`font-mono font-medium ${cell.status === 'red' ? 'text-[#a84040]' : cell.status === 'orange' ? 'text-[#b06a3a]' : cell.status === 'yellow' ? 'text-[#b8862a]' : 'text-[#2f6f4f]'}`}>
                {cell.free >= 0 ? '+' : ''}{cell.free.toFixed(2)} free
              </span>
              <span className="font-mono text-[11px] text-[#8a8a8e]">{cell.utilization_pct.toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Replace `ClassCardExpanded` placeholder**

In `frontend/src/components/capacity/ClassCard.tsx`, replace the placeholder body of `ClassCardExpanded` with:

```tsx
function ClassCardExpanded({ cls }: { cls: CapacityClass }) {
  return (
    <div className="border-t border-[#ececea] px-6 pb-6"
         style={{ background: 'linear-gradient(180deg, #fbfbfa, #ffffff)' }}>
      <StackedBarChart cells={cls.years} />
      {/* MachineRow drilldown table comes in Task 19 */}
    </div>
  );
}
```

And add the import at top of `ClassCard.tsx`:

```tsx
import { StackedBarChart } from './StackedBarChart';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/capacity/
git commit -m "feat(capacity): expanded class card with stacked bar chart"
```

---

## Task 19: Frontend — Per-machine drilldown row

**Files:**
- Create: `frontend/src/components/capacity/MachineRow.tsx`
- Modify: `frontend/src/components/capacity/ClassCard.tsx`

- [ ] **Step 1: Create MachineRow**

Create `frontend/src/components/capacity/MachineRow.tsx`:

```tsx
import type { Tool, Machine } from '../../types/capacity';

export function MachineRow({ machine, tools, utilPct }: { machine: Machine; tools: Tool[]; utilPct: number }) {
  const fillColor = utilPct > 95 ? '#a84040' : utilPct > 85 ? '#b8862a' : '#2f6f4f';
  return (
    <div className="grid grid-cols-[220px_160px_1fr_180px] py-4 px-1 items-center border-b border-[#ececea] hover:bg-[#fafaf8]">
      <div className="text-[13px] font-medium tracking-tight">{machine.internal_name}</div>
      <div className="text-xs text-[#5a5a5e]">
        {machine.manufacturer ?? '—'} <span className="font-mono text-[#8a8a8e] ml-1">'{String(machine.year_of_construction ?? '').slice(2)}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {tools.length === 0 ? (
          <span className="px-2.5 py-0.5 border border-dashed border-[#ececea] rounded-full text-[11px] text-[#8a8a8e]">— available —</span>
        ) : tools.map(t => (
          <span key={t.id} draggable className="px-2.5 py-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-full text-[11px] font-mono text-[#5a5a5e] cursor-grab hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
                onDragStart={(e) => e.dataTransfer.setData('application/x-tool-id', String(t.id))}>
            {t.tool_number}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2.5 justify-end">
        <div className="relative w-24 h-[5px] bg-[#ececea] rounded-full overflow-hidden">
          <div className="absolute inset-0 right-auto rounded-full" style={{ width: `${Math.min(utilPct, 100)}%`, background: fillColor }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-px bg-[#8a8a8e]" style={{ left: '85%' }} />
        </div>
        <div className="font-mono text-xs min-w-[38px] text-right">{utilPct.toFixed(0)}%</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in ClassCardExpanded**

Modify `frontend/src/components/capacity/ClassCard.tsx`. Pass machines + tools as props and render the table:

Update the `ClassCard` component signature:

```tsx
export function ClassCard({ cls, machines, tools, year }: { cls: CapacityClass; machines: Machine[]; tools: Tool[]; year: number }) {
```

(Add `import type { Machine, Tool } from '../../types/capacity';` at top.)

Pass them through to `ClassCardExpanded`:

```tsx
{open && <ClassCardExpanded cls={cls} machines={machines} tools={tools} year={year} />}
```

Replace `ClassCardExpanded` with:

```tsx
function ClassCardExpanded({ cls, machines, tools, year }: {
  cls: CapacityClass; machines: Machine[]; tools: Tool[]; year: number
}) {
  // Filter to machines belonging to this class (rough match: tonnage_t bucket via existing label)
  const classMachines = machines.filter(m => {
    const t = m.clamping_force_kn != null ? m.clamping_force_kn / 9.80665 : null;
    if (t == null) return false;
    return Math.abs(t - cls.tonnage_t) / cls.tonnage_t < 0.3
      && (m.is_2k || !cls.requires_2k)
      && (m.has_mucell || !cls.requires_mucell)
      && (m.has_variotherm || !cls.requires_variotherm);
  });
  const cell = cls.years.find(y => y.year === year);
  return (
    <div className="border-t border-[#ececea] px-6 pb-6" style={{ background: 'linear-gradient(180deg, #fbfbfa, #ffffff)' }}>
      <StackedBarChart cells={cls.years} />
      <div className="border-t border-[#ececea] mt-6">
        <div className="grid grid-cols-[220px_160px_1fr_180px] py-3.5 px-1 text-[10.5px] text-[#8a8a8e] uppercase tracking-wider border-b border-[#ececea]">
          <div>Press</div><div>Build</div><div>Tools running '{String(year).slice(2)}</div><div className="text-right">Util '{String(year).slice(2)}</div>
        </div>
        {classMachines.map(m => {
          const machineTools = tools.filter(t => t.assigned_machine_id === m.id);
          // Per-machine util = sum of mach-equiv of its tools / 1
          const me = cell ? cell.contributing_tools
                .filter(ct => machineTools.some(mt => mt.tool_number === ct.tool_number))
                .reduce((s, ct) => s + ct.mach_equivalents, 0) : 0;
          return <MachineRow key={m.id} machine={m} tools={machineTools} utilPct={me * 100} />;
        })}
      </div>
    </div>
  );
}
```

Add `import { MachineRow } from './MachineRow';` at top.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/capacity/
git commit -m "feat(capacity): per-machine drilldown table"
```

---

## Task 20: Frontend — CapacityOverviewPage shell + data wiring

**Files:**
- Create: `frontend/src/pages/CapacityOverviewPage.tsx`
- Modify: `frontend/src/App.tsx` (add route + nav entry)

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/CapacityOverviewPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { CapacityClass, Tool, Machine } from '../types/capacity';
import { fetchOverview, fetchTools, fetchMachines } from '../services/capacityApi';
import { ClassCard } from '../components/capacity/ClassCard';

const THIS_YEAR = new Date().getFullYear();

export function CapacityOverviewPage() {
  const [grid, setGrid] = useState<CapacityClass[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(THIS_YEAR);

  useEffect(() => {
    (async () => {
      try {
        const [g, t, m] = await Promise.all([
          fetchOverview(THIS_YEAR, THIS_YEAR + 5),
          fetchTools(),
          fetchMachines(),
        ]);
        setGrid(g); setTools(t); setMachines(m);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <SkeletonGrid />;
  if (error) return <div className="p-8 text-[#a84040]">Error: {error}</div>;

  const totalFreeThisYear = grid.reduce((s, c) => s + (c.years.find(y => y.year === year)?.free ?? 0), 0);
  const tightCount = grid.filter(c => {
    const y = c.years.find(yr => yr.year === year);
    return y && y.status === 'orange';
  }).length;
  const overrunCount = grid.filter(c => c.years.some(y => y.status === 'red')).length;

  return (
    <div className="max-w-[1400px] mx-auto px-8 pt-7 pb-16 font-sans" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      <header className="flex items-center gap-4 pb-6 mb-6 border-b border-[#ececea]">
        <span className="font-semibold tracking-tight">MachineDB</span>
        <span className="text-xs text-[#8a8a8e]">USA / Injection Molding / <span className="text-[#5a5a5e]">Capacity</span></span>
        <div className="ml-auto text-xs text-[#8a8a8e] font-mono">Updated {new Date().toISOString().slice(0,10)}</div>
      </header>

      <div className="grid grid-cols-[1fr_auto] items-end gap-6 mb-7">
        <div>
          <h1 className="text-3xl font-medium tracking-tight leading-none">
            Capacity outlook<br/><span className="text-[#2f6f4f]">{THIS_YEAR} — {THIS_YEAR + 5}</span>
          </h1>
          <p className="text-sm text-[#5a5a5e] max-w-[56ch] mt-2 leading-relaxed">
            {grid.length} machine classes · {machines.length} US presses · 85% OEE baseline.
            {overrunCount > 0 && <> <b>{overrunCount}</b> classes overrun in the forecast horizon.</>}
          </p>
        </div>
        <div className="flex gap-9 pb-1">
          <div className="text-right"><div className="font-mono text-[22px] text-[#2f6f4f] font-medium">{totalFreeThisYear >= 0 ? '+' : ''}{totalFreeThisYear.toFixed(1)}</div><div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">free '{String(year).slice(2)}</div></div>
          <div className="text-right"><div className="font-mono text-[22px] text-[#b8862a] font-medium">{tightCount}</div><div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">tight classes</div></div>
          <div className="text-right"><div className="font-mono text-[22px] text-[#a84040] font-medium">{overrunCount}</div><div className="text-[11px] uppercase tracking-wider text-[#8a8a8e] mt-0.5">overrun</div></div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div>
          {grid.map(cls => (
            <ClassCard key={cls.label} cls={cls} machines={machines} tools={tools} year={year} />
          ))}
          {grid.length === 0 && (
            <div className="bg-white border border-[#ececea] rounded-[18px] p-10 text-center text-[#5a5a5e]">
              <div className="font-medium mb-1">No capacity data yet</div>
              <div className="text-sm">Run the bootstrap importer (<span className="font-mono text-xs">scripts/run-capacity-bootstrap.ts</span>) to populate from the Excel source.</div>
            </div>
          )}
        </div>
        <aside className="sticky top-6">
          {/* SimPanel goes here in Task 21 */}
        </aside>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="max-w-[1400px] mx-auto px-8 pt-7">
      {[1,2,3,4].map(i => <div key={i} className="bg-white border border-[#ececea] rounded-[22px] h-[88px] mb-3.5 animate-pulse" />)}
    </div>
  );
}
```

- [ ] **Step 2: Wire route in App.tsx**

Open `frontend/src/App.tsx`, add an import and a route. The exact route mechanism is whatever the existing app uses (the codebase does its own routing — match the existing pattern). Conceptually:

```tsx
import { CapacityOverviewPage } from './pages/CapacityOverviewPage';
// ... add a nav link to "Capacity"
// ... render <CapacityOverviewPage /> when path is /capacity
```

If `App.tsx` uses path-based switching, add a case for `/capacity`. If it uses tab state, add a "Capacity" tab.

- [ ] **Step 3: Smoke test in browser**

```bash
cd frontend && npm run dev
```

Navigate to the Capacity page. Expected: skeleton, then either the grid or the empty state ("Run the bootstrap importer…") if no data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CapacityOverviewPage.tsx frontend/src/App.tsx
git commit -m "feat(capacity): overview page wired to API"
```

---

## Task 21: Frontend — Right-rail SimPanel (basic, no save yet)

**Files:**
- Create: `frontend/src/components/capacity/SimPanel.tsx`
- Modify: `frontend/src/pages/CapacityOverviewPage.tsx`

- [ ] **Step 1: Create the panel**

Create `frontend/src/components/capacity/SimPanel.tsx`:

```tsx
import { useState } from 'react';
import type { Modification } from '../../types/capacity';

export function SimPanel({
  granularity, onGranularityChange,
  modifications, onClearModifications, onSaveScenario,
}: {
  granularity: 'year' | 'month' | 'week' | 'day';
  onGranularityChange: (g: 'year' | 'month' | 'week' | 'day') => void;
  modifications: Modification[];
  onClearModifications: () => void;
  onSaveScenario: (name: string) => Promise<void>;
}) {
  const [scenarioName, setScenarioName] = useState('');
  return (
    <div className="flex flex-col gap-3.5">
      <Panel title="View">
        <Field label="Granularity">
          <Seg options={['year','month','week','day'] as const} value={granularity} onChange={onGranularityChange} />
        </Field>
      </Panel>

      <Panel title="Active simulation" right={<span className="font-mono text-[11px] text-[#8a8a8e]">{modifications.length} change{modifications.length === 1 ? '' : 's'}</span>}>
        {modifications.length === 0 ? (
          <div className="text-xs text-[#8a8a8e] py-2">No modifications. Drag tools between machines or classes to simulate moves.</div>
        ) : (
          <div className="flex flex-col">
            {modifications.map((m, i) => <ModItem key={i} mod={m} />)}
            <div className="flex gap-2 pt-3 border-t border-[#ececea] mt-3">
              <input
                value={scenarioName} onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Scenario name"
                className="flex-1 border border-[#ececea] rounded-md px-2.5 py-1.5 text-sm font-mono"
              />
              <button
                onClick={async () => { if (scenarioName.trim()) { await onSaveScenario(scenarioName.trim()); setScenarioName(''); } }}
                className="bg-[#1a1a1a] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#2a2a2a]">
                Save
              </button>
              <button onClick={onClearModifications}
                      className="border border-[#ececea] text-xs px-3 py-1.5 rounded-md text-[#5a5a5e] hover:border-[#1a1a1a]">
                Clear
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#ececea] rounded-[18px] overflow-hidden">
      <div className="px-4.5 pt-4 pb-3 text-[10.5px] uppercase tracking-widest text-[#8a8a8e] flex justify-between items-center">
        <span>{title}</span>{right}
      </div>
      <div className="px-4.5 pb-4.5 pt-1">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-t border-[#ececea] first:border-t-0 first:pt-1">
      <label className="text-[11px] uppercase tracking-wider text-[#8a8a8e]">{label}</label>
      {children}
    </div>
  );
}

function Seg<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-md">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
                className={`px-3 py-1 rounded-sm text-xs font-mono ${value === o ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#5a5a5e]'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ModItem({ mod }: { mod: Modification }) {
  const op = mod.type.toUpperCase().replace('_', ' ');
  let body = '';
  if (mod.type === 'move_tool') body = `tool #${mod.tool_id} → machine #${mod.target_machine_id}`;
  if (mod.type === 'add_tool') body = `${(mod.tool as any).tool_number} (${(mod.tool as any).cavities} cav, ${(mod.tool as any).rated_cycle_time_sec}s)`;
  if (mod.type === 'remove_tool') body = `tool #${mod.tool_id}`;
  if (mod.type === 'change_volume') body = `tool #${mod.tool_id} ${mod.year}: ${mod.pieces_per_year.toLocaleString()} pcs`;
  if (mod.type === 'change_class_param') body = `${mod.field}=${mod.value} on ${mod.class_key.tonnage_t}t (${mod.year_or_all})`;
  return (
    <div className="py-3 border-t border-[#ececea] first:border-t-0 first:pt-1 text-[12.5px]">
      <div className="flex items-center gap-2 font-medium">
        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#e6edf6] text-[#2c5fa0]">{op}</span>
        <span className="font-mono">{body}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `frontend/src/pages/CapacityOverviewPage.tsx`:

Add to imports:

```tsx
import { useMemo } from 'react';
import type { Modification } from '../types/capacity';
import { simulateOverview, saveScenario } from '../services/capacityApi';
import { SimPanel } from '../components/capacity/SimPanel';
```

Add state:

```tsx
const [granularity, setGranularity] = useState<'year' | 'month' | 'week' | 'day'>('year');
const [modifications, setModifications] = useState<Modification[]>([]);
```

Re-run simulate when modifications change:

```tsx
useEffect(() => {
  if (modifications.length === 0) return;
  (async () => {
    const { after } = await simulateOverview(modifications, THIS_YEAR, THIS_YEAR + 5);
    setGrid(after);
  })();
}, [modifications]);
```

Replace the `<aside>` content:

```tsx
<aside className="sticky top-6">
  <SimPanel
    granularity={granularity} onGranularityChange={setGranularity}
    modifications={modifications}
    onClearModifications={() => { setModifications([]); fetchOverview(THIS_YEAR, THIS_YEAR + 5).then(setGrid); }}
    onSaveScenario={async (name) => { await saveScenario(name, modifications); setModifications([]); fetchOverview(THIS_YEAR, THIS_YEAR + 5).then(setGrid); }}
  />
</aside>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/capacity/SimPanel.tsx frontend/src/pages/CapacityOverviewPage.tsx
git commit -m "feat(capacity): right-rail simulation panel + scenario save"
```

---

## Task 22: Frontend — drag-drop tool moves

**Files:**
- Modify: `frontend/src/components/capacity/MachineRow.tsx` (add `onDropTool` prop)
- Modify: `frontend/src/components/capacity/ClassCard.tsx` (forward drop events to a class-level handler)
- Modify: `frontend/src/pages/CapacityOverviewPage.tsx` (build the modification on drop)

- [ ] **Step 1: Add drop handlers to MachineRow**

Replace the entire `MachineRow` component in `frontend/src/components/capacity/MachineRow.tsx`:

```tsx
import { useState } from 'react';
import type { Tool, Machine } from '../../types/capacity';

export function MachineRow({ machine, tools, utilPct, onDropTool }: {
  machine: Machine; tools: Tool[]; utilPct: number;
  onDropTool: (toolId: number, targetMachineId: number) => void;
}) {
  const [over, setOver] = useState(false);
  const fillColor = utilPct > 95 ? '#a84040' : utilPct > 85 ? '#b8862a' : '#2f6f4f';
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const id = e.dataTransfer.getData('application/x-tool-id');
        if (id) onDropTool(Number(id), machine.id);
      }}
      className={`grid grid-cols-[220px_160px_1fr_180px] py-4 px-1 items-center border-b border-[#ececea] transition-colors
                  ${over ? 'bg-[#e6edf6]' : 'hover:bg-[#fafaf8]'}`}
    >
      <div className="text-[13px] font-medium tracking-tight">{machine.internal_name}</div>
      <div className="text-xs text-[#5a5a5e]">
        {machine.manufacturer ?? '—'} <span className="font-mono text-[#8a8a8e] ml-1">'{String(machine.year_of_construction ?? '').slice(2)}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {tools.length === 0 ? (
          <span className="px-2.5 py-0.5 border border-dashed border-[#ececea] rounded-full text-[11px] text-[#8a8a8e]">— available —</span>
        ) : tools.map(t => (
          <span key={t.id} draggable className="px-2.5 py-0.5 bg-[#f7f7f5] border border-[#ececea] rounded-full text-[11px] font-mono text-[#5a5a5e] cursor-grab hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
                onDragStart={(e) => e.dataTransfer.setData('application/x-tool-id', String(t.id))}>
            {t.tool_number}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2.5 justify-end">
        <div className="relative w-24 h-[5px] bg-[#ececea] rounded-full overflow-hidden">
          <div className="absolute inset-0 right-auto rounded-full" style={{ width: `${Math.min(utilPct, 100)}%`, background: fillColor }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-px bg-[#8a8a8e]" style={{ left: '85%' }} />
        </div>
        <div className="font-mono text-xs min-w-[38px] text-right">{utilPct.toFixed(0)}%</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Forward `onDropTool` through ClassCard**

In `frontend/src/components/capacity/ClassCard.tsx`, add `onMoveTool` to props:

```tsx
export function ClassCard({ cls, machines, tools, year, onMoveTool }: {
  cls: CapacityClass; machines: Machine[]; tools: Tool[]; year: number;
  onMoveTool: (toolId: number, targetMachineId: number) => void;
}) {
```

Pass it down: `<ClassCardExpanded ... onMoveTool={onMoveTool} />`

In `ClassCardExpanded`'s `MachineRow` call: `onDropTool={onMoveTool}`.

- [ ] **Step 3: Build modification in the page**

In `frontend/src/pages/CapacityOverviewPage.tsx`:

```tsx
const handleMoveTool = (toolId: number, targetMachineId: number) => {
  setModifications(prev => [...prev.filter(m => !(m.type === 'move_tool' && m.tool_id === toolId)),
                            { type: 'move_tool', tool_id: toolId, target_machine_id: targetMachineId }]);
};
```

Pass to each ClassCard: `<ClassCard ... onMoveTool={handleMoveTool} />`.

- [ ] **Step 4: Smoke test manually**

In the browser, expand a class card with tools, drag a chip to another machine row in the same class. Expected: the row briefly highlights; drop adds a `MOVE` mod to the right rail; the bars recompute via `simulate`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/capacity/ frontend/src/pages/
git commit -m "feat(capacity): drag-drop tool moves into modification overlay"
```

---

## Task 23: Frontend — Tool info card on hover

**Files:**
- Create: `frontend/src/components/capacity/ToolInfoCard.tsx`
- Modify: `frontend/src/components/capacity/StackedBarChart.tsx`

- [ ] **Step 1: Create ToolInfoCard**

Create `frontend/src/components/capacity/ToolInfoCard.tsx`:

```tsx
import type { Tool } from '../../types/capacity';

export function ToolInfoCard({ tool, machEquiv, year, piecesPerYear }: {
  tool: Tool; machEquiv: number; year: number; piecesPerYear: number | undefined;
}) {
  return (
    <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-20 w-[232px]
                    bg-white border border-[#ececea] rounded-xl p-3.5 shadow-[0_12px_32px_-12px_rgba(20,20,30,0.18)] text-xs">
      <div className="text-[13px] font-medium">{tool.tool_number}{tool.description ? ` — ${tool.description}` : ''}</div>
      {tool.customer && <div className="text-[#8a8a8e] text-[11px] mt-0.5">{tool.customer} {tool.program ? ` / ${tool.program}` : ''}</div>}
      <div className="mt-2.5 pt-2.5 border-t border-[#ececea] flex flex-col gap-1.5 text-[#5a5a5e] text-[11.5px]">
        <Row label="Cavities" value={tool.cavities.toString()} />
        <Row label="Cycle time" value={`${tool.rated_cycle_time_sec.toFixed(0)} s`} />
        <Row label={`Pieces ${year}`} value={piecesPerYear ? piecesPerYear.toLocaleString() : '—'} />
        <Row label="Mach. equiv." value={machEquiv.toFixed(2)} />
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><b className="font-mono font-medium text-[#1a1a1a]">{value}</b></div>;
}
```

- [ ] **Step 2: Use it inside StackedBarChart**

In `frontend/src/components/capacity/StackedBarChart.tsx`, change the prop signature so it receives the tool list too:

```tsx
import { useState } from 'react';
import type { CapacityCell, Tool } from '../../types/capacity';
import { ToolInfoCard } from './ToolInfoCard';

export function StackedBarChart({ cells, tools }: { cells: CapacityCell[]; tools: Tool[] }) {
```

Add hover state and the card:

```tsx
const [hover, setHover] = useState<{ year: number; toolNumber: string } | null>(null);
```

In the segment loop, add `onMouseEnter` and `onMouseLeave`:

```tsx
onMouseEnter={() => setHover({ year: cell.year, toolNumber: t.tool_number })}
onMouseLeave={() => setHover(null)}
```

Inside each segment div, render the card when hovered:

```tsx
{hover?.year === cell.year && hover.toolNumber === t.tool_number && (
  (() => {
    const realTool = tools.find(tt => tt.tool_number === t.tool_number);
    if (!realTool) return null;
    return <ToolInfoCard tool={realTool} machEquiv={t.mach_equivalents} year={cell.year} piecesPerYear={undefined} />;
  })()
)}
```

(The `pieces_per_year` for the hover card requires fetching `im_tool_volumes` — defer to a follow-up; pass `undefined` for now.)

- [ ] **Step 3: Update ClassCardExpanded to pass tools**

In `ClassCard.tsx`, change the StackedBarChart call to:

```tsx
<StackedBarChart cells={cls.years} tools={tools} />
```

- [ ] **Step 4: Smoke test**

Hover a tool segment in an expanded class. Expected: info card appears above with tool info.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/capacity/
git commit -m "feat(capacity): tool info card on hover"
```

---

## Task 24: End-to-end smoke + spec coverage check

**Files:**
- Modify: `docs/superpowers/specs/2026-05-05-im-capacity-design.md` (mark Phase 1 items shipped)

- [ ] **Step 1: Run all tests**

```bash
cd backend && npx tsx --test src/__tests__/*.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Re-run bootstrap on a fresh DB**

```bash
docker exec machinedb-backend npx tsx scripts/run-capacity-bootstrap.ts --dry-run
docker exec machinedb-backend npx tsx scripts/run-capacity-bootstrap.ts
```

Expected: report shows ≥10 class rows × 6 years and several dozen tools imported.

- [ ] **Step 3: Manual UI check against the v4 mockup**

Walk through the live page and compare to `.superpowers/brainstorm/*/content/overview-v4.html`:
- Header bar, KPI strip, class cards with sparklines, expand toggle
- Expanded card: stacked bars, year labels, free machines, util %
- Per-machine rows with tool chips, idle indicator, util bar
- Drag a chip to another machine → modification appears, bars update
- Save the scenario from the right rail

Note any visual deltas in a follow-up issue (don't fix here unless trivial).

- [ ] **Step 4: Commit any final tweaks**

```bash
git add -A
git commit -m "docs(capacity): mark Phase 1 shipped"
```

---

## Self-review notes (for the implementing engineer)

1. **`/v1/capacity` and `/api/capacity` duplicate `loadInputs`.** Refactor only when a third caller appears.
2. **The hover card's `pieces_per_year`** is wired as `undefined` in Task 23. A follow-up task should add an endpoint or expand the engine response so the value flows through.
3. **Per-machine util** in Task 19 is a rough heuristic (sum mach-equiv of tools assigned to that physical machine, divided by 1.0 = one machine's worth). This is correct for single-tool machines and acceptable for shared ones; a more rigorous per-machine accounting can come later.
4. **`tonnage_class` bucketing thresholds** in Task 1 use ±30% windows. If you find KTX machines straddling the boundaries, edit the migration's CASE expression rather than the engine — keep the logic in one place.
5. **No SimPanel "production parameters" form** (OEE / shifts / days override) is implemented in Phase 1. The mockup shows it; deferred to Phase 1.5 when the dedicated Scenarios page lands. Drag-drop + save scenario covers the most common what-if case.
6. **Scenario load/replay UI** is not implemented (you can list and save, but not click to load a saved scenario back into the modifications panel). Add a follow-up task in Phase 1.5.
