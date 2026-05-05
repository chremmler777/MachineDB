import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/im-scenarios — list all scenarios (summary, no modifications blob)
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, description, owner, combined_from,
              jsonb_array_length(COALESCE(modifications, '[]'::jsonb)) AS mod_count,
              created_at, updated_at
       FROM im_scenarios
       ORDER BY updated_at DESC`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/im-scenarios/:id — single scenario with full modifications
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_scenarios WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/im-scenarios — create scenario
// Body: { name (required), description?, modifications?, combined_from? }
router.post('/', async (req: any, res) => {
  try {
    const { name, description, modifications, combined_from } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(
      `INSERT INTO im_scenarios (name, description, modifications, owner, combined_from)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING *`,
      [
        name,
        description ?? null,
        JSON.stringify(modifications ?? []),
        req.user?.username ?? null,
        combined_from ?? [],
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// PUT /api/im-scenarios/:id — update scenario fields (patch-style)
// Body: { name?, description?, modifications? }
router.put('/:id', async (req, res) => {
  try {
    const { name, description, modifications } = req.body;
    const r = await pool.query(
      `UPDATE im_scenarios
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           modifications = COALESCE($3::jsonb, modifications),
           updated_at  = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        modifications != null ? JSON.stringify(modifications) : null,
        req.params.id,
      ]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/im-scenarios/:id — delete scenario
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM im_scenarios WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Scenario not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
