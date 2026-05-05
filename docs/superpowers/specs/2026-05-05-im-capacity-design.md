# IM Capacity — Design Spec

**Date:** 2026-05-05
**Author:** Brainstorm session — Claude + Christoph Demmler
**Status:** Approved design, ready for implementation planning
**Phase scope:** USA plant, Phase 1. Mexico onboarded in a later phase. Weissenburg / Solingen / Serbia not in scope.

---

## 1. Goal

Replace the spreadsheet-based capacity tracking (`IM_Capacity_85%OEE_*.xlsb`) with a live capacity module inside MachineDB. Two consumer use cases drive the design:

1. **Internal capacity overview & monthly maintenance.** Engineering and planning staff see how loaded each machine class is across the next 5–6 years, identify overruns early, and update tool forecasts when demand shifts.
2. **RFQ2 simulation.** When quoting a new tool, RFQ2 calls a capacity API to test whether a candidate tool fits a given machine class without overrunning capacity, and surfaces a flag in the quote if it would.

Tool moves and what-if simulations are first-class — the system must answer "if we move tool X from KM 200 to KM 350, what happens?" interactively.

## 2. Non-goals (Phase 1)

- Mexico plant capacity rollout (Phase 2).
- Customer-program / vehicle-take-rate computation that auto-derives tool volumes (deferred — see §5.2).
- EDI integration / automated forecast pull (later phase).
- Sub-year forecast entry per tool (derived; see §5.4).
- Replacing the standalone process-sheet documents with a generated-from-DB workflow (that's PDB's job; this design only links to PDB).

## 3. Architecture overview

```
                         ┌─────────────────────────────┐
RFQ2  ─── HTTP /v1 ────▶ │  MachineDB backend          │
                         │                             │
TWOS  ─── HTTP /v1 ────▶ │  • Capacity engine (calc +  │
                         │    simulation)              │
PDB*  ─── HTTP /pdb ───▶ │  • Tool DB (capacity-       │
(when built)             │    relevant subset)         │
                         │  • Class capacity params    │
Web UI ─── HTTP /api ──▶ │  • Annual tool volumes      │
                         │  • Scenarios                │
                         └──────────┬──────────────────┘
                                    │
                                    ▼
                              Postgres (machinedb)
```

* PDB ("Process Database") module does not exist yet. MachineDB stores a stable capacity-relevant subset of process-sheet data inline; once PDB is built, the relevant fields become read-only mirrors synced via `pdb_tool_ref`.

The capacity engine is one shared codepath, called by both the web UI and the public `/v1/capacity/*` endpoints.

## 4. Data model

Three new tables, plus additions to the existing `machines` table.

### 4.1 `machines` — additions

Capability flags driving the class buckets. Backfilled from current data; admin-editable in machine detail page.

| Column                      | Type    | Notes                                                       |
|-----------------------------|---------|-------------------------------------------------------------|
| `is_2k`                     | bool    | Two-component capable                                       |
| `has_mucell`                | bool    | MuCell-capable                                              |
| `has_variotherm`            | bool    | Variotherm tooling support                                  |
| `tonnage_class`             | text    | Computed display label, e.g. "350T". Used for grouping.     |

Existing relevant columns: `clamping_force_t`, `iu1_shot_volume_cm3`, `id`, etc.

**Machine naming convention (US):** `KM<tonnage>-<NN>`, e.g. `KM350-01`, `KM350-04`, `KM1300-02`. Stored in existing machine identifier field.

### 4.2 `im_tools` — tool master / "tool DB"

One row per physical tool the company owns. Capacity-relevant subset; full process-sheet data lives in PDB once built.

| Column                          | Type      | Notes                                                                 |
|---------------------------------|-----------|-----------------------------------------------------------------------|
| `id`                            | int PK    |                                                                       |
| `tool_number`                   | text UQ   | e.g. "3450", "3129/3317" (composites allowed)                         |
| `description`                   | text      | Short part name                                                       |
| `customer`                      | text      | Free text Phase 1; FK to programs entity in a later phase             |
| `program`                       | text      | Free text Phase 1                                                     |
| `cavities`                      | int       |                                                                       |
| `rated_cycle_time_sec`          | numeric   |                                                                       |
| `operator_fte`                  | numeric   | E.g. 0.5                                                              |
| `raw_material_kg_per_piece`     | numeric   | Optional                                                              |
| **Qualification fields:**       |           |                                                                       |
| `qualified_min_tonnage_t`       | int       |                                                                       |
| `qualified_max_tonnage_t`       | int NULL  | NULL = no upper bound                                                 |
| `shot_volume_required_cm3`      | numeric   | For qualification against `machines.iu1_shot_volume_cm3`              |
| `requires_2k`                   | bool      |                                                                       |
| `requires_mucell`               | bool      |                                                                       |
| `requires_variotherm`           | bool      |                                                                       |
| **Assignment / status:**        |           |                                                                       |
| `assigned_machine_id`           | int FK    | Null for inactive / candidate tools                                   |
| `status`                        | enum      | `active` \| `inactive` \| `candidate`                                 |
| **External refs:**              |           |                                                                       |
| `pdb_tool_ref`                  | text NULL | Points to PDB tool ID once that module exists                         |
| `process_sheet_file_id`         | int NULL  | FK to existing `files` table; bootstrap link                          |
| `process_sheet_imported_at`     | timestamp |                                                                       |
| Audit (`created_at`, `updated_at`, `last_edited_by`) following existing machinedb conventions |

**Qualification rule** (used for drag-drop targets, simulation engine, RFQ2 sims):

```
machine.clamping_force_t          ∈ [tool.qualified_min_tonnage_t, tool.qualified_max_tonnage_t]
machine.iu1_shot_volume_cm3       ≥ tool.shot_volume_required_cm3
machine.is_2k                     ≥ tool.requires_2k
machine.has_mucell                ≥ tool.requires_mucell
machine.has_variotherm            ≥ tool.requires_variotherm
```

A drop target that fails any check is greyed out; simulation API returns a structured qualification error.

### 4.3 `im_tool_volumes` — annual forecast per tool

One row per (tool, year). The "hot" data — most monthly updates touch this table.

| Column            | Type         | Notes               |
|-------------------|--------------|---------------------|
| `tool_id`         | int FK       | → im_tools          |
| `year`            | int          |                     |
| `pieces_per_year` | numeric      |                     |
| `updated_at`      | timestamp    |                     |
| `updated_by`      | text         |                     |

PK = (`tool_id`, `year`).

### 4.4 `im_class_capacity` — capacity inputs per class per year

| Column                | Type      | Notes                                                                |
|-----------------------|-----------|----------------------------------------------------------------------|
| `tonnage_t`           | int       | E.g. 350                                                             |
| `requires_2k`         | bool      | Class-defining flags — same set as `im_tools.requires_*`             |
| `requires_mucell`     | bool      |                                                                      |
| `requires_variotherm` | bool      |                                                                      |
| `year`                | int       |                                                                      |
| `oee_pct`             | numeric   | Default 85                                                           |
| `shifts_per_week`     | numeric   | E.g. 15, 18                                                          |
| `working_days_year`   | int       | Default 240 (US calendar)                                            |
| `planned_downtime_wk` | numeric   | Default 2                                                            |

PK = (`tonnage_t`, `requires_2k`, `requires_mucell`, `requires_variotherm`, `year`).

A row per (class, year) lets shift schedules and OEE evolve year-over-year.

### 4.5 `im_scenarios` — saved what-if scenarios

| Column           | Type      | Notes                                                          |
|------------------|-----------|----------------------------------------------------------------|
| `id`             | int PK    |                                                                |
| `name`           | text      | User-named ("VW Q2 ramp", "G09 absorbs 1300t overrun")         |
| `description`    | text      |                                                                |
| `modifications`  | jsonb     | Array of modification objects (see §6.2)                       |
| `owner`          | text      | User who created                                               |
| `created_at`     | timestamp |                                                                |
| `updated_at`     | timestamp |                                                                |
| `combined_from`  | int[]     | Optional: scenario IDs whose modifications are merged          |

## 5. Capacity calculation

### 5.1 Per-class available capacity

For each `(tonnage_t, capability flags, year)`:

```
hours_per_machine_per_year =
    shifts_per_week × 8h × (52 − planned_downtime_wk)
    × (oee_pct / 100)
```

`shifts_per_week` already encodes the working-day pattern (15 = 3 shifts × 5 days, 18 = 3 × 6 days, 21 = 3 × 7 days). `working_days_year` is stored separately and used only for the day-granularity view in §5.4.

Number of physical machines in the class = `count(machines)` matching `tonnage_t` and capability flags.

### 5.2 Per-tool demand

For each tool with a forecast in that year, currently assigned to a machine in that class:

```
pieces_per_hour       = cavities × 3600 / rated_cycle_time_sec
hours_needed          = pieces_per_year / pieces_per_hour
machine_equivalents   = hours_needed / hours_per_machine_per_year
```

### 5.3 Class rollup

```
demand        = Σ machine_equivalents over assigned tools
available     = count(machines in class)
free          = available − demand
utilization % = demand / available
```

### 5.4 Sub-year granularity (Year / Month / Week / Day views)

Annual is the source of truth. Sub-year derived:
- **Month** = annual ÷ 12 by default
- **Week** = annual ÷ 52
- **Day** = annual ÷ working_days_year
- **Optional per-class seasonality curve** (12 monthly weights summing to 12; default flat = 1.0 each) overrides the flat split. Editable in the Scenarios page; not in Phase 1 first-cut.

No explicit per-month entry per tool in Phase 1.

### 5.5 Color thresholds

Per cell / bar:

| State    | Free machines | Meaning                                            |
|----------|---------------|----------------------------------------------------|
| Green    | ≥ 1.0         | Sellable headroom — at least one full free machine |
| Yellow   | 0.5 to 1.0    | Tight; small/short-cycle tools only                |
| Orange   | 0 to 0.5      | Effectively committed; not bankable                |
| Red      | < 0           | Overcommitted                                      |

Per-class **target buffer** (default 1.0 free machine) configurable per class. Used by RFQ2 to flag candidate tools that would breach the buffer.

## 6. Capacity engine (shared by UI & API)

### 6.1 Inputs

`computeCapacity({ scenarioId?, modifications?, classFilter?, yearRange })` returns the structured grid:

```
[
  {
    class: { tonnage_t, requires_2k, requires_mucell, requires_variotherm, label },
    machines: int,
    years: [
      { year, demand, available, free, utilization_pct, status, contributing_tools: [...] }
    ]
  },
  ...
]
```

### 6.2 Modification objects (overlay on current state)

```
{ type: "add_tool", tool: { tool_number, cavities, rated_cycle_time_sec, qualification_*, target_machine_class }, volumes: [{year, pieces}] }
{ type: "move_tool", tool_id, target_machine_id }
{ type: "remove_tool", tool_id }
{ type: "change_volume", tool_id, year, pieces_per_year }
{ type: "change_class_param", tonnage_t, capability_flags, year_or_all, field, value }    // shifts/OEE/downtime
```

Modifications are pure overlays. They never mutate persisted data.

Combined scenarios = concatenation of their `modifications` arrays. Conflicting modifications (e.g., same tool moved to two classes) flagged.

## 7. UI

### 7.1 Capacity overview page (the mockup we built)

Single page, asymmetric grid:

- **Top bar:** brand mark, breadcrumb (`USA / Injection Molding / Capacity`), scenario tabs (Current + last-used scenarios + "All scenarios →" link to dedicated page), updated-by stamp.
- **Hero intro:** headline ("Capacity outlook 2025—2030") + 1–2 sentence summary. KPI strip on the right: free machines this year, count of tight classes, count of overrun classes.
- **Class cards** (bento, 22px radius, hairline border, diffusion shadow):
  - Header: class name + technology tags (`2K`, `MuCell`, `Variotherm`), press count, shifts/week. **No tonnage numbers, no shot volumes** — that's qualification metadata, not overview content.
  - Collapsed: 6-bar sparkline + headline status dots ("'26 +2.20 free / 45%", "'30 +0.0 ramp-down").
  - Expanded: full year-by-year stacked bar chart (one bar per year, segments per tool, dashed line = available machines), plus a per-machine drill-down table below.
- **Hover any tool segment:** info card with tool number, description (e.g. "3680 — Headlight bezel"), customer/program, cavities, cycle time, pieces/year, hours/year, mach-equiv.
- **Per-machine table inside expanded card:** rows = `KM350-01 / -02 / -03 / -04`, columns = build (Krauss-Maffei '18 etc.), running tools (chips), util bar with target marker. Idle machines highlighted with a `— available —` chip. Technical specs (shot vol, clamping force) deliberately omitted.
- **Right rail:**
  - **View** panel: granularity (Year/Month/Week/Day), date range, group-by toggle.
  - **Production parameters** panel (with SIM badge): apply-to selector (specific class or all), OEE %, shifts/week, working days/year, planned downtime, year scope. "Save as scenario" button.
  - **Active simulation** panel: list of overlaid modifications with op chips (`ADD`, `MOVE`, `SHIFT`) and the resulting class deltas.

### 7.2 Drag and drop

- **Source:** tool chip on a machine row inside an expanded class card.
- **Targets:**
  - Other machine rows in the same class card (intra-class re-balance).
  - Other class card headers (inter-class move; qualification-checked, unqualified targets greyed out).
- During drag, valid drop targets glow with a soft accent ring and show an inline "drop tool here to simulate move" tag.
- Dropping creates an in-memory `move_tool` modification and triggers a live recompute. The user sees the bars rearrange. They can then "Save as scenario" or discard.
- No separate persistent tool board panel — the active expanded class is the workspace.

### 7.3 Scenarios page (dedicated, deferred Phase 1.5)

Full design TBD; captured as a deferred item to avoid scope creep in v1. Required features:

- List view of saved scenarios with name, owner, last modified, count of modifications.
- Individual rename / delete.
- **Combination feature:** select 2+ scenarios, system creates a composite scenario applying all their modifications layered. Conflicts flagged with diff view.
- **Compare view:** side-by-side capacity grids of base vs scenario A vs scenario B vs A+B, with deltas highlighted.
- The overview page's tab strip becomes a quick switcher into the most-recently-used scenarios.

For Phase 1, scenarios can be saved/named/loaded from the overview page itself; the dedicated page lights up when scenario count grows past ~5.

## 8. Public API additions (consumed by RFQ2, TWOS later)

All under existing bearer-token auth on the `/v1` namespace.

### `GET /v1/capacity/overview?year_from=&year_to=&plant=usa`
Read-only current state. Returns the structured grid in §6.1.

### `POST /v1/capacity/simulate`
Body: `{ modifications: [...], year_from, year_to, plant }` (modification shapes from §6.2).
Returns the structured grid with `before`, `after`, `delta` per cell. RFQ2 sends a candidate tool's specs and reads back the impact + qualification result.

### `GET /v1/tools/:tool_number`
Returns the capacity-relevant tool record (cavities, cycle, qualification, current assignment, status). Includes `pdb_tool_ref` once PDB is wired.

## 9. Bootstrap / data import

### 9.1 First-time import (one-shot)

1. Read the canonical Excel (`IM_Capacity_85%OEE_*.xlsb`) — currently in `data/files/Capacity/`.
2. Extract per-tool rows from each per-machine-class sheet (`KM 80`, `KM 200`, …): tool_number, cavities, cycle time, annual piece forecasts, current operator FTE.
3. Extract per-class capacity inputs (OEE, shifts/week) from `Total Overview Capacity`.
4. Cross-reference with uploaded process sheets (PDFs / Excel / Word in existing `files` table) on tool_number. Produce a **reconciliation report**:
   - Tools only in Excel
   - Tools only in process sheets
   - Mismatches in cycle time / cavities / qualified machines / shot volume
5. Engineer reviews & confirms; reconciled set lands in `im_tools`, `im_tool_volumes`, `im_class_capacity`.

### 9.2 Steady-state monthly update

- Tool DB is master.
- Process sheet for a tool can be (re-)attached as a file. "Sync from process sheet" action re-extracts cycle time, cavities, qualified tonnage range, capability requirements, shot volume — shows a diff preview before commit.
- Editing forecasts: open a tool, edit `im_tool_volumes` row(s) for the affected year(s).
- Editing class capacity: open the class header, edit OEE / shifts / days for a specific year.
- Adding a new tool: same form as RFQ2 candidate input, but `status = active` and assigned to a machine.

### 9.3 PDB transition (later phase)

When PDB ships:
- `pdb_tool_ref` is populated for every tool.
- Capacity-relevant fields on `im_tools` become **read-only** mirrors synced via webhook / poll from PDB.
- Edits move to PDB; machinedb listens. RFQ2 / TWOS query PDB directly for full process-sheet data; they only hit machinedb for capacity queries.

## 10. Phasing

| Phase | Scope                                                                                        |
|-------|----------------------------------------------------------------------------------------------|
| 1.0   | USA. Schema + import + overview UI + drag-drop + simulation engine + `/v1/capacity/*` API.   |
| 1.5   | Dedicated Scenarios page (naming, combination, comparison).                                  |
| 2.0   | Mexico onboarding (data import + UI plant filter).                                           |
| 3.0   | PDB integration (read-only mirror mode).                                                     |
| 4.0   | Customer-program / vehicle-take-rate layer; programs entity; volume = Σ(program × take).    |
| 5.0   | EDI integration for automated forecast ingest.                                               |

## 11. Open questions / follow-ups

- **Process sheet field list:** the exact column set to extract during import is pinned to a sample sheet at implementation time.
- **Per-class seasonality curves:** UI for editing the 12-month weight vector — Phase 1 ships flat; full editor with Phase 1.5.
- **Tool number format:** confirmed 4-digit-ish, composites allowed (`3129/3317`). No regex enforcement.
- **Permissions:** assumed all SSO-authenticated KTX users can edit; admin role for class-capacity / OEE adjustments. Detail TBD with existing auth patterns at implementation.
