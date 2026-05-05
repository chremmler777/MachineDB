import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

const KEY_COLS = ['tonnage_t', 'requires_2k', 'requires_mucell', 'requires_variotherm', 'year'];
const VAL_COLS = ['oee_pct', 'shifts_per_week', 'working_days_year', 'planned_downtime_wk'];

// GET /api/im-class-capacity — list all rows
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM im_class_capacity ORDER BY tonnage_t, year');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/im-class-capacity — upsert by composite PK
// Body: { tonnage_t, requires_2k, requires_mucell, requires_variotherm, year, oee_pct, shifts_per_week, working_days_year, planned_downtime_wk }
router.put('/', async (req, res) => {
  try {
    const missingKeys = KEY_COLS.filter(c => req.body[c] === undefined);
    if (missingKeys.length > 0) {
      return res.status(400).json({ error: `Required key fields: ${KEY_COLS.join(', ')}` });
    }
    const keys = KEY_COLS.map(c => req.body[c]);
    const vals = VAL_COLS.map(c => req.body[c] ?? null);
    const r = await pool.query(
      `INSERT INTO im_class_capacity (${KEY_COLS.join(', ')}, ${VAL_COLS.join(', ')})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tonnage_t, requires_2k, requires_mucell, requires_variotherm, year)
       DO UPDATE SET
         ${VAL_COLS.map((c, i) => `${c} = $${i + 6}`).join(', ')},
         updated_at = NOW()
       RETURNING *`,
      [...keys, ...vals]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/im-class-capacity — delete by composite key (query params)
// ?tonnage_t=&requires_2k=&requires_mucell=&requires_variotherm=&year=
router.delete('/', async (req, res) => {
  try {
    const missingKeys = KEY_COLS.filter(c => req.query[c] === undefined);
    if (missingKeys.length > 0) {
      return res.status(400).json({ error: `Required query params: ${KEY_COLS.join(', ')}` });
    }
    const r = await pool.query(
      'DELETE FROM im_class_capacity WHERE tonnage_t = $1 AND requires_2k = $2 AND requires_mucell = $3 AND requires_variotherm = $4 AND year = $5',
      KEY_COLS.map(c => req.query[c])
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Class capacity row not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
