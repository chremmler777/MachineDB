import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

const TOOL_COLS = [
  'tool_number', 'description', 'customer', 'program',
  'cavities', 'rated_cycle_time_sec', 'operator_fte', 'raw_material_kg_per_piece',
  'qualified_min_tonnage_t', 'qualified_max_tonnage_t', 'shot_volume_required_cm3',
  'requires_2k', 'requires_mucell', 'requires_variotherm',
  'assigned_machine_id', 'status', 'pdb_tool_ref', 'process_sheet_file_id',
];

const VALID_STATUSES = ['active', 'inactive', 'candidate'];

// pg returns NUMERIC columns as strings — coerce to numbers for the JSON API.
const NUMERIC_COLS = ['cavities', 'rated_cycle_time_sec', 'operator_fte', 'raw_material_kg_per_piece',
  'qualified_min_tonnage_t', 'qualified_max_tonnage_t', 'shot_volume_required_cm3'];
function numerize(row: any) {
  if (!row) return row;
  const out: any = { ...row };
  for (const k of NUMERIC_COLS) if (out[k] != null) out[k] = Number(out[k]);
  return out;
}

// GET /api/im-tools — list all tools
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_tools ORDER BY tool_number');
    res.json(r.rows.map(numerize));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/im-tools/:id — single tool
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_tools WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(numerize(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/im-tools — create tool
router.post('/', async (req: any, res) => {
  try {
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    const cols = TOOL_COLS.filter(c => req.body[c] !== undefined);
    const vals = cols.map((_c, i) => `$${i + 1}`);
    const r = await pool.query(
      `INSERT INTO im_tools (${cols.join(', ')}, last_edited_by)
       VALUES (${vals.join(', ')}, $${cols.length + 1}) RETURNING *`,
      [...cols.map(c => req.body[c]), req.user?.username ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// PUT /api/im-tools/:id — update tool
router.put('/:id', async (req: any, res) => {
  try {
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    const updates = TOOL_COLS.filter(c => req.body[c] !== undefined);
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = updates.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const r = await pool.query(
      `UPDATE im_tools
       SET ${setClause}, last_edited_by = $${updates.length + 1}, updated_at = NOW()
       WHERE id = $${updates.length + 2} RETURNING *`,
      [...updates.map(c => req.body[c]), req.user?.username ?? null, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/im-tools/:id — delete tool
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM im_tools WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
