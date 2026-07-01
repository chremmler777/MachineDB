# Decision Log

<!-- Format: ## [YYYY-MM-DD HH:MM] Title / Decision / Why / Phase / Impact -->

## [2026-06-29 09:10] Export second format: HTML (replaces PDF); Excel + HTML use bright Machines-tab styling
**Decision**: Replaced the PDF export with a **styled HTML** page and gave both HTML and Excel the colour-grouped look of the Machines tab, with headers that never truncate. HTML (`format=html`) **downloads** as a self-contained `.html` file (`Content-Disposition: attachment`; same blob-download path as xlsx) — open it to view/print/save-as-PDF. It carries the pastel group-header band + column-label row in the same palette, sticky headers, zebra rows, and a "Print / Save as PDF" button (`@media print` → A4 landscape) so users still get a PDF when they want one. Excel: swapped `xlsx` → **`xlsx-js-style`** (drop-in fork with cell styling; plain `xlsx` CE ignores styles on write) to fill group/column headers with the group colours, **wrapText** + label-sized column widths + taller header rows so nothing is cut, plus zebra data rows and thin borders. Group colours pulled from MachineListPage palette; overview columns inherit each field's category colour. Dropped `pdfkit`/`@types/pdfkit`.
**Why**: User asked to replace the cramped, truncating PDF with HTML that looks like the bright Machines tab, and to stop cutting off headers in both HTML and Excel. HTML wraps headers natively and prints to PDF on demand; `xlsx-js-style` is the minimal way to colour Excel headers without ExcelJS. Note: SheetJS CE/`xlsx-js-style` cannot write freeze panes — dropped that (headers themselves are not cut, which was the requirement).
**Phase**: 4 (tooling)
**Impact**: `backend/src/utils/machine-export.ts` rewritten (`buildHtml` added, `streamPdf` removed, `buildWorkbook` now styled). Route `format` is now `xlsx|html` (html inline). Deps: −pdfkit −@types/pdfkit, +xlsx-js-style. Frontend: `ExportDialog` HTML option opens a tab via new `machineService.exportUrl`; `export.html`/`export.htmlDesc` strings (en/es/de), `export.pdf` removed. Verified through nginx: all format×detail combos correct content-types, HTML has pastel group headers + 26 USA rows, Excel styles.xml carries all 10 pastel fills + wrapText + sized widths, no-auth → 401. Column labels still duplicated between the list page and the export module — keep in sync.

## [2026-06-29 08:55] Machine-list export (Excel + PDF) generated server-side
**Decision**: New `GET /api/machines/export?format=xlsx|pdf&detail=overview|full&plant=USA|Mexico` (under existing `ssoAuth`+`verifyToken`; omit/other plant = all facilities). Backend-only generation: Excel via the already-present `xlsx` (SheetJS), PDF via new `pdfkit` dep. Two detail levels — `overview` (flat: name, manufacturer, model, facility, clamping force t, clearance H/V, barrel volume, cylinder Ø, max tool height, opening stroke; +IU2 barrel/Ø columns only when the set has a 2K machine) and `full` (every column, grouped exactly like MachineListPage). PDF is landscape A4 with column **banding** (wide full-list columns split across page-sets, machine-name column repeated per band) + row pagination + zebra striping. Frontend: blue **Export** button next to Clear Filters on the machine list → `ExportDialog` (facility / detail / format), downloads the blob using the `Content-Disposition` filename. Translations added for en/es/de.
**Why**: User wanted to extract machine lists per facility at two detail levels in Excel or PDF. Server-side keeps formatting in one place, reuses auth + the canonical column/label set, and avoids new frontend deps. Banding is the only way ~70 columns stay readable in PDF. Export is facility+detail driven (does NOT apply the page's other ad-hoc filters) — predictable and matches the request.
**Phase**: 4 (tooling)
**Impact**: New `backend/src/utils/machine-export.ts` (column defs + xlsx/pdf builders) and route in `backend/src/routes/machines.ts` (declared before `/:id`). New dep `pdfkit` (+`@types/pdfkit`). New `frontend/src/components/ExportDialog.tsx`, `machineService.exportList` in `services/api.ts`, button + state in `MachineListPage.tsx`, export.* keys in `LanguageContext.tsx`. Column labels live in BOTH the frontend list page and the export module — keep them in sync when columns change. Verified end-to-end through nginx: all 4 format×detail combos return valid files (PK/%PDF), USA filter → 26 rows, no-auth → 401.

## [2026-04-04 21:15] Delete bug fix + FK change to preserve deletion audit
**Decision**: (1) Wrap DELETE /machines/:id in a transaction, INSERT deletion revision BEFORE the DELETE (previously was DELETE then INSERT — FK violation every time, 500 + phantom delete). (2) Change `machine_revisions.machine_id` FK from `ON DELETE CASCADE` to `ON DELETE SET NULL`, drop NOT NULL. Deletion revisions now survive parent removal with machine_id=NULL.
**Why**: User hit "server error" on delete but row was gone. Root cause: handler ran DELETE (auto-commit) then INSERT into machine_revisions referencing the just-deleted id → 23503. Fixing order alone would still lose audit trail via CASCADE. SET NULL preserves the historical record (`previous_data`, `change_summary`) for compliance.
**Phase**: 1
**Impact**: `backend/src/routes/machines.ts:321-362`, migration added in `backend/src/db/migrate.ts`, regression tests in `backend/src/__tests__/delete-machine.test.ts` (run against isolated `machinedb_test` DB). Revision history UI must handle machine_id=NULL rows if it queries across them. Commit 011add5.

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

## [2026-07-01] SSO writes: mirror identity into local users table by username
**Decision**: `ssoAuth` (backend/src/middleware/sso-auth.ts) no longer sets `req.user.userId = parseInt(payload.sub)`. It now resolves the SSO identity to a LOCAL `users.id`: SELECT by username, INSERT (ON CONFLICT username DO UPDATE) if absent, and uses that local id for FK columns.
**Why**: The JWT `sub` is the AdminPanel user id (auth.py sets `sub = str(user.id)`), a DIFFERENT id space than MachineDB's local `users` table (only 3 seeded rows: 1/2/3). Writing raw `sub` into created_by/updated_by/changed_by (all FK → users(id)) threw a foreign-key violation → generic 500 "Internal server error" on ANY write, unless the AdminPanel id coincidentally equalled 1/2/3. Standalone/legacy login worked because it issues a token with a local id. NOT keyed by id because AdminPanel ids collide with the seeded local ids (id 2 = adminpanel user ≠ viewer_usa). Dropping the FKs was rejected: it breaks the machine_comments→users username join.
**Phase**: (SSO / cross-app auth)
**Impact**: SSO users get an auto-created local `users` row (password_hash = 'sso:no-local-login', non-loginable) on first write-authenticated request. Regression test: backend/src/__tests__/sso-auth-fk-user.test.ts. NOT YET DEPLOYED — awaiting approval to rebuild/restart the machinedb-backend container. Code + typecheck done; DB-integration test not run (needs test DB).
