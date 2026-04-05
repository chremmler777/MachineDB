# IM-MachineDB

## Context
This project uses `.claude/context/` for persistent memory across sessions.
At the start of every session, read these files before doing anything:
1. `.claude/context/OVERVIEW.md` — project goal + scope
2. `.claude/context/STATUS.md` — current phase, last action, next steps
3. `.claude/context/constraints.md` — hard constraints (read carefully, these bite)
4. `.claude/context/decisions.md` — last ~20 decisions with *why*
5. `.claude/context/phases/phase-N.md` — current phase notes

Log new significant decisions to `decisions.md` immediately, without being asked.
Update `STATUS.md` on phase transitions or when stopping a session.

## Key locations
- Master docker-compose: `/home/nitrolinux/claude/docker-compose.yml` (NOT inside this dir)
- Env file: `/home/nitrolinux/claude/.env`
- Excel source data: `/home/nitrolinux/claude/Machinelist/`
