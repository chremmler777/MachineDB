# 2K Machine Type Identifier — Design Spec

**Date:** 2026-05-06
**Status:** Approved (ready for plan)
**Owner:** machinedb
**Consumer:** rfq

## Problem

MachineDB has an `is_2k` boolean, but RFQ needs to distinguish between
physically different 2K mechanisms when matching parts to machines. The three
mechanisms in our fleet are not interchangeable: a tool built for an index
plate cannot run on a turntable, and parallel-injection tools require two
separate molds. RFQ must filter machines by exact mechanism, not by a generic
"2K capable" flag.

## Scope

In scope:
- New `two_k_type` enum column on `machines`
- One-shot backfill of the existing fleet
- UI dropdown for manual edits
- Filtering on `GET /v1/machines`
- Rollup on `GET /v1/capacity` grouped by `two_k_type`
- Public capability endpoint so RFQ can pull the enum vocabulary at runtime
  instead of hardcoding it

Out of scope (V1):
- Independent `has_turntable` flag (derivable from `two_k_type`)
- Fuzzy substitution between 2K mechanisms
- 2K-runs-1K fallback logic in MachineDB (RFQ handles via filter relaxation)
- Tandem-molding and pick-and-place as machine-level attributes (P&P is a tool
  config; compatibility is `injection_units >= 2`, already implied)

## Data model

### Schema change

```sql
ALTER TABLE machines
  ADD COLUMN two_k_type TEXT
  CHECK (two_k_type IN ('2k_turntable', '2k_no_turntable', 'parallel_injection'));

CREATE INDEX idx_machines_two_k_type
  ON machines(two_k_type)
  WHERE two_k_type IS NOT NULL;
```

`NULL` means 1K (single-component) machine. This is the default for all
existing rows and the only "fourth" state.

### Relationship to `is_2k`

- `is_2k` is kept for backwards-compat and updated by the same migration to
  `(two_k_type IS NOT NULL)`.
- All write paths (POST/PUT machine, backfill) set both columns from
  `two_k_type`. Application code never writes `is_2k` independently.
- `is_2k` is a read-only mirror going forward; deprecation tracked separately,
  not removed in this change.

### Enum values

| Value | Meaning | Mechanism |
|---|---|---|
| `2k_turntable` | Standard overmolding with rotating platen | Tool sits on a turntable; the platen rotates 180° between station 1 and station 2. |
| `2k_no_turntable` | 2 injection units, no rotation | Index plate, sliding tool, or core-back transfer. Tool itself handles part movement. |
| `parallel_injection` | 2 separate tools, 2 injection units | Each component runs in its own tool; either tool can use one or both injection units. Used for high-mix low-volume on large Nissei/Sumitomo machines. |
| `NULL` | 1K | Single-component machine. |

## Backfill

Explicit cohort assignment by `internal_name`. No auto-detection from
`iu2_*` columns — IU2 presence does not reliably correlate with 2K
classification (e.g. `KM 350-1/-2/-3` are 1K despite being adjacent to the 2K
`KM 350-4`), so explicit cohort assignment is the only safe approach.

| Cohort | `internal_name`s | `two_k_type` |
|---|---|---|
| MX Arburg Allrounder 220T | `M01, M02, M03, M04, M12, M13, M14, M23` | `2k_no_turntable` |
| US KM 350/550/1300/1600 with 2 IU | `KM 350-4, KM 550-1, KM 550-2, KM 1300-1, KM 1300-2, KM 1300-3, KM 1600-1, KM 1600-2` | `2k_no_turntable` |
| MX Sumitomo 280 + Nissei DCX600/800 | `M27, M08, M19` | `parallel_injection` |
| US KM 1000T | `KM 1000-1, KM 1000-2, KM 1000-3` | `2k_turntable` |

Total: 22 machines. Machines outside these cohorts are left `NULL` and edited
per-machine via the UI as needed.

Notable exclusions: `KM 350-1/-2/-3` are 1K (no IU2) — only `KM 350-4` is 2K.
`M28`/`M29` (Nissei NEX360) are 1K despite the 2K-adjacent model naming.

The migration prints the matched rows before committing, so the assignment is
auditable in the migration log.

## API surface

### 1. Capability vocabulary endpoint (new)

```
GET /v1/machine-capabilities/two-k-types
```

Returns the enum values, display labels, and descriptions. RFQ pulls this at
startup (or on cache refresh) and uses it to populate its `tooling_mode →
two_k_type` mapping. No hardcoded enum on the RFQ side.

Response:
```json
{
  "two_k_types": [
    {
      "value": "2k_turntable",
      "label": "2K — Turntable",
      "description": "Rotating platen, standard overmolding."
    },
    {
      "value": "2k_no_turntable",
      "label": "2K — No turntable (index plate / core-back / sliding tool)",
      "description": "Two injection units, transfer handled within the tool."
    },
    {
      "value": "parallel_injection",
      "label": "Parallel injection",
      "description": "Two separate tools sharing two injection units; each tool can use one or both units."
    }
  ]
}
```

Auth: same as `/v1/machines` (service token).

### 2. Machine list filtering (extension of existing endpoint)

```
GET /v1/machines
```

New optional query parameters:

| Param | Type | Notes |
|---|---|---|
| `two_k_type` | enum or `null` | Exact match. `null` (literal string) matches 1K machines. |
| `site` | enum | Already exists if present; reused. Maps to `plant_location`. |
| `min_tonnage` | number | Filter on `clamping_force_kn` (legacy column name; values are tons). |
| `max_tonnage` | number | Same column. |
| `min_platen_x` | number | `platen_horizontal_mm` |
| `min_platen_y` | number | `platen_vertical_mm` |
| `min_daylight` | number | Daylight column (verify exact name during impl) |
| `min_barrel_1_g` | number | `iu1_shot_weight_g` |
| `min_barrel_2_g` | number | `iu2_shot_weight_g` |
| `min_injection_units` | int | `1` or `2`. `2` filters for any 2K + parallel. |

Response includes (in addition to existing fields): `two_k_type`,
`platen_horizontal_mm`, `platen_vertical_mm`, daylight, `iu1_shot_weight_g`,
`iu2_shot_weight_g`, derived `injection_units` (`2` if `iu2_*` populated or
`two_k_type IS NOT NULL`, else `1`).

### 3. Capacity rollup (extension of existing endpoint)

```
GET /v1/capacity?group_by=two_k_type
```

Groups availability at site + period + `two_k_type`, including a bucket for
`NULL` (1K-only). Per-machine availability remains in the response so existing
consumers are unaffected.

Response shape additions:
```json
{
  "rollups": [
    {
      "site": "MX",
      "period": "2027",
      "two_k_type": "parallel_injection",
      "available_machine_years": 2.83
    }
  ],
  "machines": [ /* existing per-machine output */ ]
}
```

## UI

Edit machine form: a 4-option dropdown.

- "1K (single component)" → `null`
- "2K — Turntable" → `2k_turntable`
- "2K — No turntable" → `2k_no_turntable`
- "Parallel injection" → `parallel_injection`

The dropdown sits in the existing capability section near `mucell` /
`variotherm`. No bulk-edit UI in V1.

Machine list (read view): show the value as a small badge next to the existing
2K indicator, or replace it (decision: replace, since `is_2k` is deprecated).

## Substitution and matching rules

**MachineDB does not implement substitution.** A query for
`two_k_type=parallel_injection` returns only parallel-injection machines.
Cross-2K substitution is not allowed (different physical mechanisms).

**1K-on-2K is allowed but RFQ-driven.** When RFQ queries for a 1K part, it
omits the `two_k_type` filter rather than passing `null`. MachineDB returns
all machines that meet the sizing constraints, regardless of `two_k_type`.
RFQ ranks the results so 1K machines win unless a 2K machine is explicitly
preferred.

## Testing

- Unit: enum check constraint rejects unknown values; backfill SQL is
  idempotent (re-running does not change results).
- Integration: HTTP round-trip — POST/PUT a machine with each `two_k_type`,
  read it back via `GET /v1/machines`, assert filter behavior for each enum
  value plus `null`.
- Capacity: existing capacity tests extended with one rollup assertion per
  `two_k_type` bucket using a fixture with at least one machine of each type.
- Capability endpoint: response shape and auth.

## Migration / rollout

1. Single migration adds column, index, runs cohort UPDATE, syncs `is_2k`.
2. Backend deployed with new field exposed in machine read/write paths and new
   filter params.
3. Frontend deployed with the dropdown.
4. RFQ team notified that capability and filter endpoints are live.
5. Manual review of any 2K machines outside the listed cohorts (none expected,
   but the UI handles exceptions).

No data migration is destructive. Rollback: drop the column; `is_2k` was
already there.

## Open questions

None blocking. Daylight column exact name to be verified during
implementation; if not present, omit the `min_daylight` filter from V1.
