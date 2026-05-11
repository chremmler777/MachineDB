import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';

const router = Router();

// Plant enum accepted on input, and lowercased on output
const VALID_PLANTS = new Set(['weissenburg', 'solingen', 'serbia', 'usa', 'mexico']);

// Allowed two_k_type values (NULL = 1K machine)
const VALID_TWO_K_TYPES = new Set(['2k_turntable', '2k_no_turntable', 'parallel_injection']);

/**
 * Maps a DB row to the RFQ2 contract shape.
 * - plant lowercased
 * - clamping_force_t (column already renamed; values stored as tonnes)
 * - decimals serialized as strings to preserve precision
 * - is_2k derived from two_k_type (consistent with mirror)
 * - injection_units derived: 2 if iu2 present OR two_k_type set, else 1
 */
function mapRow(row: any) {
  const dec = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    return typeof v === 'string' ? v : String(v);
  };

  const has_iu2 = row.iu2_screw_diameter_mm !== null && row.iu2_screw_diameter_mm !== undefined;
  const has_two_k = row.two_k_type !== null && row.two_k_type !== undefined;

  return {
    id: row.id,
    internal_name: row.internal_name,
    manufacturer: row.manufacturer,
    model: row.model,
    plant: row.plant_location ? String(row.plant_location).toLowerCase() : null,
    clamping_force_t: dec(row.clamping_force_t),
    clearance_horizontal_mm: dec(row.clearance_horizontal_mm),
    clearance_vertical_mm: dec(row.clearance_vertical_mm),
    platen_horizontal_mm: dec(row.platen_horizontal_mm),
    platen_vertical_mm: dec(row.platen_vertical_mm),
    barrel_volume_cm3: dec(row.iu1_shot_volume_cm3),
    barrel_1_g: dec(row.iu1_shot_weight_g),
    screw_diameter_mm: dec(row.iu1_screw_diameter_mm),
    mold_height_min_mm: dec(row.mold_height_min_mm),
    mold_height_max_mm: dec(row.mold_height_max_mm),
    is_2k: has_two_k,
    two_k_type: row.two_k_type ?? null,
    tool_center_distance_horizontal_mm: dec(row.tool_center_distance_horizontal_mm),
    injection_units: has_iu2 || has_two_k ? 2 : 1,
    barrel_2_volume_cm3: dec(row.iu2_shot_volume_cm3),
    barrel_2_g: dec(row.iu2_shot_weight_g),
    screw_2_diameter_mm: dec(row.iu2_screw_diameter_mm),
    remarks: row.remarks,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const SELECT_COLUMNS = `
  id, internal_name, manufacturer, model, plant_location,
  clamping_force_t, clearance_horizontal_mm, clearance_vertical_mm,
  platen_horizontal_mm, platen_vertical_mm,
  iu1_shot_volume_cm3, iu1_shot_weight_g, iu1_screw_diameter_mm,
  mold_height_min_mm, mold_height_max_mm,
  iu2_shot_volume_cm3, iu2_shot_weight_g, iu2_screw_diameter_mm,
  two_k_type, tool_center_distance_horizontal_mm,
  remarks, updated_at
`;

// GET /v1/machines
// Filters: plant, site (MX|US), two_k_type (incl. literal 'null'),
// min_tonnage/max_tonnage, min_platen_x/y, min_barrel_1_g/min_barrel_2_g,
// min_injection_units (=2 selects 2K machines)
router.get('/machines', async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const {
      plant, site, two_k_type,
      min_tonnage, max_tonnage,
      min_platen_x, min_platen_y,
      min_barrel_1_g, min_barrel_2_g,
      min_injection_units,
    } = q;

    if (plant && !VALID_PLANTS.has(plant)) {
      return res.status(400).json({ error: `invalid plant: must be one of ${[...VALID_PLANTS].join(', ')}` });
    }
    if (two_k_type !== undefined && two_k_type !== 'null' && !VALID_TWO_K_TYPES.has(two_k_type)) {
      return res.status(400).json({ error: 'invalid two_k_type' });
    }
    if (site !== undefined && site !== 'MX' && site !== 'US') {
      return res.status(400).json({ error: 'invalid site: must be MX or US' });
    }

    const conditions: string[] = [];
    const params: any[] = [];
    const next = () => `$${params.length + 1}`;

    if (plant) {
      conditions.push(`LOWER(plant_location) = ${next()}`);
      params.push(plant);
    }
    if (site === 'MX') {
      conditions.push(`plant_location = ${next()}`);
      params.push('Mexico');
    } else if (site === 'US') {
      conditions.push(`plant_location = ${next()}`);
      params.push('USA');
    }
    if (two_k_type === 'null') {
      conditions.push(`two_k_type IS NULL`);
    } else if (two_k_type !== undefined) {
      conditions.push(`two_k_type = ${next()}`);
      params.push(two_k_type);
    }
    if (min_tonnage !== undefined && min_tonnage !== '') {
      conditions.push(`clamping_force_t >= ${next()}`);
      params.push(parseFloat(min_tonnage));
    }
    if (max_tonnage !== undefined && max_tonnage !== '') {
      conditions.push(`clamping_force_t <= ${next()}`);
      params.push(parseFloat(max_tonnage));
    }
    if (min_platen_x !== undefined && min_platen_x !== '') {
      conditions.push(`platen_horizontal_mm >= ${next()}`);
      params.push(parseFloat(min_platen_x));
    }
    if (min_platen_y !== undefined && min_platen_y !== '') {
      conditions.push(`platen_vertical_mm >= ${next()}`);
      params.push(parseFloat(min_platen_y));
    }
    if (min_barrel_1_g !== undefined && min_barrel_1_g !== '') {
      conditions.push(`iu1_shot_weight_g >= ${next()}`);
      params.push(parseFloat(min_barrel_1_g));
    }
    if (min_barrel_2_g !== undefined && min_barrel_2_g !== '') {
      conditions.push(`iu2_shot_weight_g >= ${next()}`);
      params.push(parseFloat(min_barrel_2_g));
    }
    if (min_injection_units === '2') {
      conditions.push(`(iu2_screw_diameter_mm IS NOT NULL OR two_k_type IS NOT NULL)`);
    }

    let query = `SELECT ${SELECT_COLUMNS} FROM machines`;
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY clamping_force_t ASC NULLS LAST, id ASC`;

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

    const conditions: string[] = [`clamping_force_t >= $1`];
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
      conditions.push(`(iu2_screw_diameter_mm IS NOT NULL OR two_k_type IS NOT NULL)`);
    }
    if (plant) {
      conditions.push(`LOWER(plant_location) = $${idx++}`);
      params.push(plant);
    }

    const query = `
      SELECT ${SELECT_COLUMNS} FROM machines
      WHERE ${conditions.join(' AND ')}
      ORDER BY clamping_force_t ASC, id ASC
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
