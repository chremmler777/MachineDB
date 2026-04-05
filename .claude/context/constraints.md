# Hard Constraints

## Architecture
- **Master docker-compose** is `/home/nitrolinux/claude/docker-compose.yml`, NOT `./machinedb/docker-compose.yml`. All deploys go through the master. Running compose from inside `/machinedb/` creates a separate project with a separate DB volume (`machinedb_postgres_data` vs `claude_machinedb_postgres_data`) — causes data-loss scares. Always `cd /home/nitrolinux/claude` before compose commands.
- Backend code changes require `docker compose build machinedb-backend --no-cache && docker compose up -d machinedb-backend`. Local `npm run dev` on the host does NOT affect the running Docker container.
- Same for frontend (`machinedb-frontend`).

## SSO (shared with admin panel)
- Shared `JWT_SECRET` env var: `ktx-shared-secret-change-in-production-2024` (defined in `/home/nitrolinux/claude/.env`).
- Cookie-based: admin panel sets `access_token` HttpOnly cookie at path `/`, MachineDB reads it via `ssoAuth` middleware.
- Role mapping: `machinedb_Admin` → `master` (full access), `machinedb_Viewer` → `viewer` (read-only).
- User identity for revision history is stored in `change_summary` text (parsed on read) — SSO user IDs don't map to local users table.

## Column naming quirks (don't "fix" these casually)
- `clamping_force_kn` actually stores **tonnes**, not kN. Column is misnamed. Finder code and UI both treat it as tonnes. Any rename requires a coordinated migration.
- `iu1_shot_volume_cm3` — some values look off (e.g. 2377.00 on an 80-tonne Nissei). Data-quality issue pending cleanup, not a code issue.

## Service API (`/v1/*`)
- Bearer-token auth via `MACHINEDB_SERVICE_TOKEN` env var (separate from user JWT).
- Field-mapping layer is in `backend/src/routes/v1-machines.ts` — DO NOT expose raw DB column names. Contract field names differ from DB column names.
- Decimals serialized as strings in JSON to preserve precision.
- `plant` lowercased on output.

## Files on disk
- File uploads go to `$FILES_DIR` (default `$HOME/.machinedb/data/files`, NOT `/data/files` at system root).
