# Phase 3 — External Service API for RFQ2

## Goal
Expose MachineDB as HTTP source-of-truth for RFQ2 (and later PLM2). RFQ2 drops its local `machine_db` table and always reads live from us.

## Delivered
- **Endpoints**: `GET /v1/machines?plant=`, `GET /v1/machines/{id}`, `GET /v1/machines/suggest?clamping_t=&shot_volume_cm3=&need_2k=&plant=`, `GET /health`
- **Auth**: Bearer token (`MACHINEDB_SERVICE_TOKEN`) via `middleware/service-auth.ts`, constant-time compare
- **Field mapping**: contract-level names, decimals as strings, plant lowercased, `is_2k` derived — see `routes/v1-machines.ts` `mapRow()`
- **Ordering**: ASC by `clamping_force_t`
- **Errors**: 401 bad/missing token, 400 invalid plant/missing clamping_t, 404 not-found
- **Suggest semantics**: smallest machine where clamping_force_t ≥ N, barrel_volume_cm3 ≥ shot_vol, is_2k matches, plant matches; `null` if no match
- **Plant enum**: `weissenburg|solingen|serbia|usa|mexico` accepted; output lowercased

## Not included (deferred)
- Pagination (≤53 rows, not needed yet)
- Write endpoints (RFQ2 is read-only consumer)
- mTLS or JWT with claims (plain bearer is fine on internal docker network)

## Contract final — as shipped
```json
{
  "id": 42,
  "internal_name": "KM 80-1",
  "manufacturer": "Krauss Maffei",
  "model": "CX 80-380",
  "plant": "usa",
  "clamping_force_t": "80.00",
  "clearance_horizontal_mm": "420.00",
  "clearance_vertical_mm": "420.00",
  "barrel_volume_cm3": "64.00",
  "screw_diameter_mm": "30.00",
  "mold_height_min_mm": "200.00",
  "mold_height_max_mm": "500.00",
  "is_2k": false,
  "barrel_2_volume_cm3": null,
  "screw_2_diameter_mm": null,
  "remarks": "shop 1, bay 3",
  "updated_at": "2026-03-26T19:12:31.660Z"
}
```

## Incident during this phase
Active Postgres volume `claude_machinedb_postgres_data` ended up empty mid-session. Traced to a past compose invocation from inside `./machinedb/` which created a parallel project + volume (`machinedb_postgres_data`). Recovered by spinning up postgres:16 against the old volume and pg_dump → restore. See decisions.md entry from 20:41.

## Open questions for next phase
- Which `iu1_shot_volume_cm3` values are wrong vs. genuinely unusual?
- Do we want to add a `suspicious_fields`-style annotation to service API output, or is that internal-only?
