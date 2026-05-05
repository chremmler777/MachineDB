import { Router } from 'express';
import { computeCapacity, type Modification } from '../services/capacity-engine.js';
import { loadCapacityInputs } from '../services/capacity-data.js';

const router = Router();

// GET /api/capacity/overview?year_from=&year_to=&plant=
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
    console.error('GET /api/capacity/overview failed:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/capacity/simulate
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

    // Build per-cell delta
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
    console.error('POST /api/capacity/simulate failed:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
