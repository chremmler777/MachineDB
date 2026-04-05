import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';

const router = Router();

// Plant enum accepted on input, and lowercased on output
const VALID_PLANTS = new Set(['weissenburg', 'solingen', 'serbia', 'usa', 'mexico']);

/**
 * Maps a DB row to the RFQ2 contract shape.
 * - plant lowercased
 * - clamping_force_kn renamed to clamping_force_t (values already stored as tonnes — column misnamed)
 * - decimals serialized as strings to preserve precision
 * - is_2k derived from iu2_screw_diameter_mm
 */
function mapRow(row: any) {
  const dec = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    // numeric columns already come back as strings from pg for DECIMAL types,
    // but normalize just in case
    return typeof v === 'string' ? v : String(v);
  };

  return {
    id: row.id,
    internal_name: row.internal_name,
    manufacturer: row.manufacturer,
    model: row.model,
    plant: row.plant_location ? String(row.plant_location).toLowerCase() : null,
    clamping_force_t: dec(row.clamping_force_kn),
    clearance_horizontal_mm: dec(row.clearance_horizontal_mm),
    clearance_vertical_mm: dec(row.clearance_vertical_mm),
    barrel_volume_cm3: dec(row.iu1_shot_volume_cm3),
    screw_diameter_mm: dec(row.iu1_screw_diameter_mm),
    mold_height_min_mm: dec(row.mold_height_min_mm),
    mold_height_max_mm: dec(row.mold_height_max_mm),
    is_2k: row.iu2_screw_diameter_mm !== null && row.iu2_screw_diameter_mm !== undefined,
    barrel_2_volume_cm3: dec(row.iu2_shot_volume_cm3),
    screw_2_diameter_mm: dec(row.iu2_screw_diameter_mm),
    remarks: row.remarks,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const SELECT_COLUMNS = `
  id, internal_name, manufacturer, model, plant_location,
  clamping_force_kn, clearance_horizontal_mm, clearance_vertical_mm,
  iu1_shot_volume_cm3, iu1_screw_diameter_mm,
  mold_height_min_mm, mold_height_max_mm,
  iu2_shot_volume_cm3, iu2_screw_diameter_mm,
  remarks, updated_at
`;

// GET /v1/machines?plant=<plant>
router.get('/machines', async (req: Request, res: Response) => {
  try {
    const plant = req.query.plant as string | undefined;

    if (plant && !VALID_PLANTS.has(plant)) {
      return res.status(400).json({ error: `invalid plant: must be one of ${[...VALID_PLANTS].join(', ')}` });
    }

    let query = `SELECT ${SELECT_COLUMNS} FROM machines`;
    const params: any[] = [];
    if (plant) {
      // strict equality, case-insensitive since stored values may be capitalized
      query += ` WHERE LOWER(plant_location) = $1`;
      params.push(plant);
    }
    query += ` ORDER BY clamping_force_kn ASC NULLS LAST, id ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows.map(mapRow));
  } catch (err: any) {
    console.error('GET /v1/machines failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /v1/machines/suggest?clamping_t=&shot_volume_cm3=&need_2k=&plant=
// NOTE: must come before /machines/:id so Express doesn't match 'suggest' as an id
router.get('/machines/suggest', async (req: Request, res: Response) => {
  try {
    const clampingTRaw = req.query.clamping_t as string | undefined;
    const shotVolRaw = req.query.shot_volume_cm3 as string | undefined;
    const need2kRaw = req.query.need_2k as string | undefined;
    const plant = req.query.plant as string | undefined;

    if (!clampingTRaw) {
      return res.status(400).json({ error: 'clamping_t is required' });
    }
    const clampingT = parseFloat(clampingTRaw);
    if (isNaN(clampingT)) {
      return res.status(400).json({ error: 'clamping_t must be a number' });
    }

    if (plant && !VALID_PLANTS.has(plant)) {
      return res.status(400).json({ error: `invalid plant: must be one of ${[...VALID_PLANTS].join(', ')}` });
    }

    const need2k = need2kRaw === 'true' || need2kRaw === '1';

    const conditions: string[] = [`clamping_force_kn >= $1`];
    const params: any[] = [clampingT];
    let idx = 2;

    if (shotVolRaw !== undefined && shotVolRaw !== '') {
      const shotVol = parseFloat(shotVolRaw);
      if (isNaN(shotVol)) {
        return res.status(400).json({ error: 'shot_volume_cm3 must be a number' });
      }
      conditions.push(`iu1_shot_volume_cm3 >= $${idx++}`);
      params.push(shotVol);
    }
    if (need2k) {
      conditions.push(`iu2_screw_diameter_mm IS NOT NULL`);
    }
    if (plant) {
      conditions.push(`LOWER(plant_location) = $${idx++}`);
      params.push(plant);
    }

    const query = `
      SELECT ${SELECT_COLUMNS} FROM machines
      WHERE ${conditions.join(' AND ')}
      ORDER BY clamping_force_kn ASC, id ASC
      LIMIT 1
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(mapRow(result.rows[0]));
  } catch (err: any) {
    console.error('GET /v1/machines/suggest failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /v1/machines/:id
router.get('/machines/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }

    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM machines WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'machine not found' });
    }
    res.json(mapRow(result.rows[0]));
  } catch (err: any) {
    console.error('GET /v1/machines/:id failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

export default router;
