# Decision Log

<!-- Format: ## [YYYY-MM-DD HH:MM] Title / Decision / Why / Phase / Impact -->

## [2026-04-04 16:50] Visual overhaul of frontend
**Decision**: Added colored left-accent stat cards on dashboard, gradient buttons, colored section headers on detail page matching table column groups, Inter font, custom dark scrollbars. Kept dark mode as default.
**Why**: User asked for "more visually pleasing". Color system already existed for table column groups (blue=machine info, yellow=clamping, green=IU1, etc.) — extended that visual language to other pages for coherence.
**Phase**: 1
**Impact**: Touches DashboardPage.tsx, MachineDetailPage.tsx, MachineListPage.tsx, MachineFinder.tsx, index.css, App.tsx, index.html. No functional changes.

## [2026-04-04 16:53] KTX logo paths use Vite BASE_URL
**Decision**: `<img src={import.meta.env.BASE_URL + 'logo.png'}>` instead of hardcoded `/logo.png`.
**Why**: App is served at `/machinedb/` via nginx. A raw `/logo.png` resolves to the admin panel root (wrong container). BASE_URL is `/machinedb/` (set in vite.config.ts), so it builds the correct proxied path.
**Phase**: 1
**Impact**: Any new public asset must use `BASE_URL` prefix. Two logos in `frontend/public/`: `logo.png` (black, light mode) and `logo-white.png` (dark mode, default).

## [2026-04-04 20:30] External service API uses bearer-token auth, separate from user SSO
**Decision**: New `/v1/*` routes under `serviceAuth` middleware validating `Authorization: Bearer <token>` against `MACHINEDB_SERVICE_TOKEN` env var (constant-time comparison). Completely separate from the SSO JWT used by browser users.
**Why**: Service-to-service (RFQ2 → MachineDB) shouldn't need a user session. Cookie auth wouldn't work across container boundaries anyway. Keep the concerns separate: cookie JWT for humans, bearer token for services.
**Phase**: 3
**Impact**: New middleware `backend/src/middleware/service-auth.ts`. Token stored in `/home/nitrolinux/claude/.env`. Rotate by regenerating + restarting backend.

## [2026-04-04 20:35] Field mapping layer at API boundary (don't expose DB column names)
**Decision**: `/v1/*` responses use contract-specified field names, mapped from DB columns:
- `clamping_force_kn` → `clamping_force_t` (values are already tonnes)
- `iu1_shot_volume_cm3` → `barrel_volume_cm3`
- `iu1_screw_diameter_mm` → `screw_diameter_mm`
- `iu2_shot_volume_cm3` → `barrel_2_volume_cm3`
- `iu2_screw_diameter_mm` → `screw_2_diameter_mm`
- `mold_height_min/max_mm` → `mold_height_min/max_mm` (kept)
- `clearance_horizontal/vertical_mm` → `clearance_horizontal/vertical_mm` (kept)
- `plant_location` → `plant` (lowercased)
- `is_2k` derived from `iu2_screw_diameter_mm IS NOT NULL`
- Decimals serialized as strings
**Why**: Decouple consumers from our internal schema. Lets us rename DB columns later without breaking external callers. Also hides our quirks (kN column that isn't kN).
**Phase**: 3
**Impact**: All mapping lives in `backend/src/routes/v1-machines.ts` → `mapRow()`. Breaking this mapping breaks RFQ2.

## [2026-04-04 20:38] No pagination on /v1/machines
**Decision**: Return all machines in a single array, ordered ASC by `clamping_force_t`.
**Why**: ~53 rows today, plans cap at ~200. Pagination adds consumer complexity for no win at this scale. If we grow past 200, add `?limit=&offset=` with `X-Total-Count` header (non-breaking addition).
**Phase**: 3
**Impact**: RFQ2 HTTP client does one GET per query, caches 30s.

## [2026-04-04 20:41] DB data restored from orphaned volume
**Decision**: Recovered 53 machines from `machinedb_postgres_data` (orphaned volume from when compose was run inside `./machinedb/`). Dumped with temp pg container, loaded into active `claude_machinedb_postgres_data`.
**Why**: Active DB was empty after recent rebuilds. Data loss scare. Recovery path: `docker run -d -v machinedb_postgres_data:/var/lib/postgresql/data postgres:16` → pg_dump --data-only --table=machines --table=machine_revisions --table=files → copy + psql into active container.
**Phase**: 3
**Impact**: DO NOT DELETE the `machinedb_postgres_data` volume until we're 100% sure the active one has everything. Keep both until next backup strategy is defined.
