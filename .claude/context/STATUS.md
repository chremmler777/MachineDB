# Status

**Phase**: 4 — tooling / data quality
**Last action**: Machine-list **export** — `GET /api/machines/export` (facility US/MX/all, overview/full detail). Formats are now **Excel + HTML** (PDF dropped). Both use the bright Machines-tab colour grouping with non-truncating headers: Excel via `xlsx-js-style` (group-colour fills, wrapText, sized columns); HTML served inline + opened in a new tab with a Print/Save-as-PDF button. Frontend Export dialog + en/es/de strings. Built + deployed via master compose; verified through nginx (content-types, pastel headers, USA→26 rows, no-auth→401). See decisions.md 2026-06-29.
**Next step**: Data-quality cleanup of suspicious `iu1_shot_volume_cm3` values. RFQ2 `/v1/*` integration still awaiting first live request.
**Updated**: 2026-06-29

## Open threads
- **Data quality**: Several `iu1_shot_volume_cm3` values look off by ~25× (e.g. 2377 cm³ on 80-tonne Nissei). Probably Excel import column-mapping glitch. Needs manual review against spec sheets.
- **Column rename** (`clamping_force_kn` → `clamping_force_t`): deferred. The API already exposes it correctly as `clamping_force_t`; the DB rename is a separate, coordinated migration (finder code, UI, import code all reference the current name).
- **3 plants without data**: weissenburg, solingen, serbia enum values accepted but return empty lists. No action needed until data arrives.
