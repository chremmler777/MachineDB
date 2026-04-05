# Status

**Phase**: 3 — External service API for RFQ2 (complete, awaiting consumer wire-up)
**Last action**: Deployed `/v1/machines`, `/v1/machines/{id}`, `/v1/machines/suggest`, `/health` under bearer-token auth. Sent token + sample responses to RFQ2 chat. Restored 53 machines from orphaned Postgres volume.
**Next step**: Wait for RFQ2 to confirm successful integration (first live request hits). Then start Phase 4: data-quality cleanup (suspicious `iu1_shot_volume_cm3` values).
**Updated**: 2026-04-04

## Open threads
- **Data quality**: Several `iu1_shot_volume_cm3` values look off by ~25× (e.g. 2377 cm³ on 80-tonne Nissei). Probably Excel import column-mapping glitch. Needs manual review against spec sheets.
- **Column rename** (`clamping_force_kn` → `clamping_force_t`): deferred. The API already exposes it correctly as `clamping_force_t`; the DB rename is a separate, coordinated migration (finder code, UI, import code all reference the current name).
- **3 plants without data**: weissenburg, solingen, serbia enum values accepted but return empty lists. No action needed until data arrives.
