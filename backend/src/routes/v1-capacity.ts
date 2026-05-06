import { Router } from 'express';
import { computeCapacity, monthsActiveInYear, type Modification } from '../services/capacity-engine.js';
import { loadCapacityInputs } from '../services/capacity-data.js';
import pool from '../db/connection.js';

const router = Router();

// Map DB plant_location → site code used by RFQ contract.
function siteFromPlant(plant: string | null): 'US' | 'MX' | null {
  if (!plant) return null;
  if (plant === 'USA') return 'US';
  if (plant === 'Mexico') return 'MX';
  return null;
}

// GET /v1/capacity?year=&group_by=two_k_type
// Returns per-machine availability for the given calendar year, plus optional
// rollup buckets when group_by=two_k_type.
router.get('/', async (req, res) => {
  try {
    const year = Number(req.query.year ?? new Date().getFullYear());
    if (!Number.isFinite(year)) {
      return res.status(400).json({ error: 'invalid year' });
    }

    const result = await pool.query(
      `SELECT id, internal_name, plant_location, two_k_type, clamping_force_t,
              to_char(in_service_from,    'YYYY-MM-DD') AS in_service_from,
              to_char(planned_scrap_from, 'YYYY-MM-DD') AS planned_scrap_from
       FROM machines
       WHERE plant_location IS NOT NULL`,
    );

    type MachineEntry = {
      id: number;
      internal_name: string;
      site: 'US' | 'MX' | null;
      plant: string | null;
      two_k_type: string | null;
      clamping_force_t: number | null;
      year: number;
      available_fraction: number;
    };

    const machines: MachineEntry[] = result.rows.map(r => ({
      id: Number(r.id),
      internal_name: r.internal_name,
      site: siteFromPlant(r.plant_location),
      plant: r.plant_location ? String(r.plant_location).toLowerCase() : null,
      two_k_type: r.two_k_type ?? null,
      clamping_force_t: r.clamping_force_t != null ? Number(r.clamping_force_t) : null,
      year,
      available_fraction:
        monthsActiveInYear(r.in_service_from ?? null, r.planned_scrap_from ?? null, year) / 12,
    }));

    if (req.query.group_by === 'two_k_type') {
      const buckets = new Map<
        string,
        {
          site: 'US' | 'MX' | null;
          period: string;
          two_k_type: string | null;
          machine_count: number;
          available_machine_years: number;
        }
      >();
      for (const m of machines) {
        const key = `${m.site}|${m.year}|${m.two_k_type ?? '__null__'}`;
        const cur = buckets.get(key) ?? {
          site: m.site,
          period: String(m.year),
          two_k_type: m.two_k_type ?? null,
          machine_count: 0,
          available_machine_years: 0,
        };
        cur.machine_count += 1;
        cur.available_machine_years += Number(m.available_fraction ?? 0);
        buckets.set(key, cur);
      }
      return res.json({ rollups: Array.from(buckets.values()), machines });
    }

    return res.json({ machines });
  } catch (e) {
    console.error('GET /v1/capacity failed:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /v1/capacity/overview?year_from=&year_to=&plant=
router.get('/overview', async (req, res) => {
  try {
    const yearFrom = Number(req.query.year_from ?? new Date().getFullYear());
    const yearTo   = Number(req.query.year_to   ?? yearFrom + 5);
    const plant    = req.query.plant as string | undefined;

    if (isNaN(yearFrom) || isNaN(yearTo) || yearFrom > yearTo) {
      return res.status(400).json({ error: 'Invalid year_from / year_to' });
    }

    const inputs = await loadCapacityInputs(yearFrom, yearTo, plant);
    res.json(computeCapacity({ ...inputs, yearFrom, yearTo }));
  } catch (e) {
    console.error('GET /v1/capacity/overview failed:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /v1/capacity/simulate
// Body: { modifications, year_from, year_to, plant }
router.post('/simulate', async (req, res) => {
  try {
    const yearFrom = Number(req.body.year_from ?? new Date().getFullYear());
    const yearTo   = Number(req.body.year_to   ?? yearFrom + 5);
    const plant    = req.body.plant as string | undefined;
    const modifications: Modification[] = req.body.modifications ?? [];

    if (isNaN(yearFrom) || isNaN(yearTo) || yearFrom > yearTo) {
      return res.status(400).json({ error: 'Invalid year_from / year_to' });
    }

    const inputs = await loadCapacityInputs(yearFrom, yearTo, plant);
    const before = computeCapacity({ ...inputs, yearFrom, yearTo });
    const after  = computeCapacity({ ...inputs, yearFrom, yearTo, modifications });

    const delta = before.map(bClass => {
      const aClass = after.find(
        c =>
          c.tonnage_t === bClass.tonnage_t &&
          c.requires_2k === bClass.requires_2k &&
          c.requires_mucell === bClass.requires_mucell &&
          c.requires_variotherm === bClass.requires_variotherm,
      );

      const yearDeltas = bClass.years.map(bCell => {
        const aCell = aClass?.years.find(y => y.year === bCell.year);
        const demand_delta = (aCell?.demand ?? bCell.demand) - bCell.demand;
        const free_delta   = (aCell?.free   ?? bCell.free)   - bCell.free;
        const status_before = bCell.status;
        const status_after  = aCell?.status ?? bCell.status;
        const entry: {
          year: number;
          demand_delta: number;
          free_delta: number;
          status_change?: { before: string; after: string };
        } = { year: bCell.year, demand_delta, free_delta };
        if (status_before !== status_after) {
          entry.status_change = { before: status_before, after: status_after };
        }
        return entry;
      });

      return {
        tonnage_t: bClass.tonnage_t,
        requires_2k: bClass.requires_2k,
        requires_mucell: bClass.requires_mucell,
        requires_variotherm: bClass.requires_variotherm,
        label: bClass.label,
        years: yearDeltas,
      };
    });

    res.json({ before, after, delta });
  } catch (e) {
    console.error('POST /v1/capacity/simulate failed:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
