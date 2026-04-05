# IM-MachineDB — Project Overview

## End goal
Internal injection-molding machine database for KTX. Browse/filter/search ~50-200 machines across plants. Single source of truth consumed by RFQ2 (and future PLM2) via HTTP API. Users access via SSO from the KTX admin panel.

## Scope
- **Plants supported by enum**: weissenburg, solingen, serbia, usa, mexico
- **Plants with data today**: USA (26), Mexico (27). German/Serbian plants planned but no data yet.
- **Users**: engineers on shop floor look up machines; RFQ2 uses the API for quote sanity-checks.

## Phases (rough)
1. Core DB + React frontend with machine CRUD/search — **done**
2. SSO integration via admin panel shared JWT — **done**
3. External service API (`/v1/*`) for RFQ2 consumption — **done (2026-04-04)**
4. Data quality cleanup — flagged suspicious values in iu1_shot_volume_cm3
5. Onboard remaining 3 plants (weissenburg, solingen, serbia) when data arrives

## Non-negotiables
See `constraints.md`.

## Top-level components
- `machinedb-backend` (Node/Express, TS) on port 3001
- `machinedb-frontend` (Vite/React, TS) on port 5173
- `machinedb-db` (Postgres 16) on port 5432
- All orchestrated from `/home/nitrolinux/claude/docker-compose.yml` on network `claude_ktx-net`
- Nginx reverse proxy routes `/machinedb/` → frontend, `/machinedb/api/` → backend
