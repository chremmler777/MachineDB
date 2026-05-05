import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/im-tool-volumes?tool_id=123
// GET /api/im-tool-volumes?year=2026
// GET /api/im-tool-volumes (all rows)
router.get('/', async (req, res) => {
  try {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.tool_id) {
      params.push(req.query.tool_id);
      where.push(`tool_id = $${params.length}`);
    }
    if (req.query.year) {
      params.push(req.query.year);
      where.push(`year = $${params.length}`);
    }
    const sql = `SELECT * FROM im_tool_volumes${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY tool_id, year`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/im-tool-volumes — upsert by composite PK (tool_id, year)
// Body: { tool_id, year, pieces_per_year }
router.put('/', async (req: any, res) => {
  try {
    const { tool_id, year, pieces_per_year } = req.body;
    if (tool_id == null || year == null || pieces_per_year == null) {
      return res.status(400).json({ error: 'tool_id, year, pieces_per_year required' });
    }
    const r = await pool.query(
      `INSERT INTO im_tool_volumes (tool_id, year, pieces_per_year, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tool_id, year)
       DO UPDATE SET
         pieces_per_year = EXCLUDED.pieces_per_year,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [Number(tool_id), Number(year), Number(pieces_per_year), req.user?.username ?? null]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/im-tool-volumes?tool_id=&year=
router.delete('/', async (req, res) => {
  try {
    if (req.query.tool_id == null || req.query.year == null) {
      return res.status(400).json({ error: 'tool_id and year query params required' });
    }
    const r = await pool.query(
      'DELETE FROM im_tool_volumes WHERE tool_id = $1 AND year = $2',
      [req.query.tool_id, req.query.year]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Volume row not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
