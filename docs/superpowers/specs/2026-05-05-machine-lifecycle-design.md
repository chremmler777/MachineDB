# Machine Lifecycle Dates — Design

**Status:** Draft
**Date:** 2026-05-05
**Author:** christoph.demmler@gmail.com (with Claude)

## Problem

`machines` rows are treated by the capacity engine as available 100% of every year. Real plants add and retire machines mid-year (e.g., a new USA machine arriving October 2026), which the current model can't represent. Planners need to capture when a machine becomes available and when it's planned for scrap, and the capacity calculations should reflect those transition years honestly.

## Scope

In:
- Two lifecycle date fields on machines (`in_service_from`, `planned_scrap_from`).
- Per-machine month-precision proration in the capacity engine.
- Edit-form fields and list-view status badge.

Out (parked):
- Capacity-page timeline/Gantt of machine in/out events.
- Explicit `lifecycle_status` enum or free-text lifecycle notes.
- Day-precision proration.

## Data model

Add two nullable columns to `machines`:

| Column                | Type   | Meaning                                                 |
|-----------------------|--------|---------------------------------------------------------|
| `in_service_from`     | `DATE` | First day machine is available. NULL = always available |
| `planned_scrap_from`  | `DATE` | First day machine is no longer available. NULL = none   |

- Stored as `DATE`; UI collects/displays month + year (day = 1).
- Constraint: if both set, `planned_scrap_from > in_service_from`.
- Backfill: existing rows get NULL for both — current capacity numbers are unchanged.

## Capacity engine

For each machine and year Y, compute the active fraction:

```
start  = in_service_from    or -∞
end    = planned_scrap_from or +∞
window = [Jan 1 Y, Jan 1 Y+1)
months_active = overlap_months(start, end, window)   // 0..12
fraction      = months_active / 12
```

Aggregation by `(tonnage_class, flags, year)`:
- Replace integer `COUNT(machines)` with `SUM(fraction)`.
- Pass that sum through the existing `available_machine_hours` formula (× per-machine hours/year from `im_class_capacity`).

Downstream consumers (% utilized, contributing-tools logic, bar chart available-line) are unchanged; they just see a fractional machine count.

Edge cases:
- Arrives Oct 2026 → 0.25 in 2026, 1.0 in 2027+.
- Scrapped Mar 2027 → 1.0 in 2026, 0.1667 in 2027 (Jan+Feb), 0 thereafter.
- Both NULL → 1.0 every year (current behavior).
- `planned_scrap_from <= in_service_from` rejected at write time; engine never sees it.

## API

- `GET /api/machines` (list) and `GET /api/machines/:id` include `in_service_from`, `planned_scrap_from`.
- `POST /api/machines` and `PUT /api/machines/:id` accept both fields (`YYYY-MM-DD` or null). Validation:
  - Date parsable, or null.
  - If both present, `planned_scrap_from > in_service_from`.
  - 400 with a clear message on violation.
- Capacity endpoints (`/api/capacity/...`) keep their existing shape; per-class/year machine counts become `numeric` (e.g., `4.25`) instead of integer.

## Frontend

### Machine edit form
New "Lifecycle" section with two month-pickers (month + year, clearable → null):
- **In service from**
- **Planned scrap from**

Inline validation error when `planned_scrap_from <= in_service_from`.

### Machine list
Status badge derived from today's date and the two fields:

| Condition                                                | Badge text             | Color  |
|----------------------------------------------------------|------------------------|--------|
| `in_service_from > today`                                | `Arriving <Mon YYYY>`  | yellow |
| `planned_scrap_from` set, within next 12 months          | `Scrapping <Mon YYYY>` | orange |
| `planned_scrap_from <= today`                            | `Scrapped <Mon YYYY>`  | gray   |
| else                                                     | (no badge)             | —      |

### Capacity page
No UI change this iteration. Bar chart numbers shift automatically via the engine.

## Testing

- **Engine unit tests** for the month-overlap helper: full year, partial start, partial end, both partial, machine entirely outside year.
- **Capacity integration test**: class with one always-on machine + one arriving Oct 2026 → 2026 count = 1.25, 2027 = 2.0.
- **API tests**: invalid date order → 400; valid pairs round-trip via POST/PUT/GET.
- **Frontend test** for badge derivation across the four states.

## Rollout

1. Migration: add two nullable columns. No data backfill.
2. Ship engine + API + UI together on a feature branch.
3. After deploy: planner adds the new USA October 2026 machine with `in_service_from = 2026-10-01`. Verify 2026 USA capacity for the relevant tonnage class drops to ~the expected fractional value and 2027 returns to full.

## Open questions

None at design time.
