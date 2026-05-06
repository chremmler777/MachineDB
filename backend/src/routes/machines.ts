import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { verifyToken, requireMaster, AuthRequest } from '../middleware/auth.js';
import { Machine } from '../types/index.js';

const router = Router();

// Define field types for validation
const numericFields = new Set([
  'year_of_construction', 'length_mm', 'width_mm', 'height_mm', 'weight_kg', 'clamping_force_t',
  'centering_ring_nozzle_mm', 'centering_ring_ejector_mm', 'mold_height_min_mm', 'mold_height_max_mm',
  'opening_stroke_mm', 'clearance_horizontal_mm', 'clearance_vertical_mm',
  'max_weight_nozzle_kg', 'max_weight_ejector_kg', 'temperature_control_circuits', 'cascade_count',
  'core_pulls_nozzle', 'core_pulls_ejector', 'ejector_stroke_mm', 'ejector_max_travel_mm',
  'iu1_screw_diameter_mm', 'iu1_shot_volume_cm3', 'iu1_injection_flow_cm3s', 'iu1_plasticizing_rate_gs',
  'iu1_ld_ratio', 'iu1_injection_pressure_bar', 'iu1_shot_weight_g',
  'iu2_screw_diameter_mm', 'iu2_shot_volume_cm3', 'iu2_injection_flow_cm3s', 'iu2_plasticizing_rate_gs',
  'iu2_ld_ratio', 'iu2_injection_pressure_bar', 'iu2_shot_weight_g',
  'robot_vacuum_circuits'
]);

const booleanFields = new Set([
  'fine_centering', 'rotary_table', 'hot_runner_integrated', 'hot_runner_external',
  'pneumatic_nozzle', 'pneumatic_ejector'
]);

// Allowed two_k_type values (matches DB CHECK constraint). NULL = 1K machine.
const VALID_TWO_K_TYPES = new Set(['2k_turntable', '2k_no_turntable', 'parallel_injection']);

export function validateTwoKType(input: any): string | null {
  if (!('two_k_type' in input)) return null;
  const v = input.two_k_type;
  if (v === null || v === undefined || v === '') {
    input.two_k_type = null;
    return null;
  }
  if (typeof v !== 'string' || !VALID_TWO_K_TYPES.has(v)) {
    return 'invalid two_k_type';
  }
  return null;
}

// Validate and coerce field types
const validateAndCoerce = (machine: any): any => {
  Object.keys(machine).forEach(key => {
    const value = machine[key];

    // For numeric fields, ensure value is a number or null
    if (numericFields.has(key) && value !== null && value !== undefined && value !== '') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      machine[key] = isNaN(num) ? null : num;
    }

    // For boolean fields, ensure value is a boolean or null
    if (booleanFields.has(key) && value !== null && value !== undefined && value !== '') {
      if (typeof value === 'boolean') {
        // Already a boolean, keep it
      } else if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        // Try to match boolean patterns
        if (trimmed === 'yes' || trimmed === 'ja' || trimmed === 'true' || trimmed === '1' || trimmed.includes('ja') || trimmed.includes('yes')) {
          machine[key] = true;
        } else if (trimmed === 'no' || trimmed === 'nein' || trimmed === 'false' || trimmed === '0' || trimmed.includes('nein') || trimmed.includes('no')) {
          machine[key] = false;
        } else {
          // Unknown string value, set to null
          machine[key] = null;
        }
      } else if (value === 1 || value === '1') {
        machine[key] = true;
      } else if (value === 0 || value === '0') {
        machine[key] = false;
      } else {
        // Unknown type/value, set to null
        machine[key] = null;
      }
    }
  });
  return machine;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function coerceLifecycleDates<T extends { in_service_from?: any; planned_scrap_from?: any }>(input: T): T {
  for (const key of ['in_service_from', 'planned_scrap_from'] as const) {
    if (!(key in input)) continue;
    const v = (input as any)[key];
    if (v === null || v === undefined) {
      (input as any)[key] = v ?? undefined;
      if (v === null) (input as any)[key] = null;
      continue;
    }
    if (typeof v !== 'string' || v === '' || !ISO_DATE_RE.test(v) || isNaN(Date.parse(v))) {
      (input as any)[key] = null;
    }
  }
  return input;
}

export function lifecycleDateOrderError(
  input: { in_service_from?: string | null; planned_scrap_from?: string | null },
): string | null {
  const a = input.in_service_from;
  const b = input.planned_scrap_from;
  if (!a || !b) return null;
  if (b > a) return null; // ISO 'YYYY-MM-DD' is lex-orderable
  return 'planned_scrap_from must be after in_service_from';
}

// List machines with search, filter, sort
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search, manufacturer, plant, clamping_force_min, clamping_force_max, year_min, year_max, limit = 50, offset = 0 } = req.query;

    let query = `SELECT m.*,
      (SELECT f.id FROM machine_files f WHERE f.machine_id = m.id AND f.file_type = 'wam' ORDER BY f.uploaded_at DESC LIMIT 1) as wam_file_id,
      (SELECT f.file_name FROM machine_files f WHERE f.machine_id = m.id AND f.file_type = 'wam' ORDER BY f.uploaded_at DESC LIMIT 1) as wam_file_name
      FROM machines m WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (m.internal_name ILIKE $${paramIndex} OR m.manufacturer ILIKE $${paramIndex} OR m.model ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (manufacturer) {
      query += ` AND m.manufacturer = $${paramIndex}`;
      params.push(manufacturer);
      paramIndex++;
    }

    if (plant) {
      query += ` AND m.plant_location = $${paramIndex}`;
      params.push(plant);
      paramIndex++;
    }

    if (clamping_force_min) {
      query += ` AND m.clamping_force_t >= $${paramIndex}`;
      params.push(parseFloat(clamping_force_min as string));
      paramIndex++;
    }

    if (clamping_force_max) {
      query += ` AND m.clamping_force_t <= $${paramIndex}`;
      params.push(parseFloat(clamping_force_max as string));
      paramIndex++;
    }

    if (year_min) {
      query += ` AND m.year_of_construction >= $${paramIndex}`;
      params.push(parseInt(year_min as string));
      paramIndex++;
    }

    if (year_max) {
      query += ` AND m.year_of_construction <= $${paramIndex}`;
      params.push(parseInt(year_max as string));
      paramIndex++;
    }

    query += ` ORDER BY m.internal_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const result = await pool.query(query, params);

    // Build count query with the same filters as the main query
    let countQuery = 'SELECT COUNT(*) FROM machines WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (internal_name ILIKE $${countParamIndex} OR manufacturer ILIKE $${countParamIndex} OR model ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (manufacturer) {
      countQuery += ` AND manufacturer = $${countParamIndex}`;
      countParams.push(manufacturer);
      countParamIndex++;
    }

    if (plant) {
      countQuery += ` AND plant_location = $${countParamIndex}`;
      countParams.push(plant);
      countParamIndex++;
    }

    if (clamping_force_min) {
      countQuery += ` AND clamping_force_t >= $${countParamIndex}`;
      countParams.push(parseFloat(clamping_force_min as string));
      countParamIndex++;
    }

    if (clamping_force_max) {
      countQuery += ` AND clamping_force_t <= $${countParamIndex}`;
      countParams.push(parseFloat(clamping_force_max as string));
      countParamIndex++;
    }

    if (year_min) {
      countQuery += ` AND year_of_construction >= $${countParamIndex}`;
      countParams.push(parseInt(year_min as string));
      countParamIndex++;
    }

    if (year_max) {
      countQuery += ` AND year_of_construction <= $${countParamIndex}`;
      countParams.push(parseInt(year_max as string));
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      machines: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('List machines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single machine
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get machine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create machine
router.post('/', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    let data: Machine = req.body;

    // Validate and coerce field types
    data = validateAndCoerce(data);
    data = coerceLifecycleDates(data);
    const orderErr = lifecycleDateOrderError(data);
    if (orderErr) return res.status(400).json({ error: orderErr });
    const twoKErr = validateTwoKType(data);
    if (twoKErr) return res.status(400).json({ error: twoKErr });
    if ('two_k_type' in (data as any)) {
      (data as any).is_2k = (data as any).two_k_type !== null;
    }

    const columns = Object.keys(data).filter((key) => data[key as keyof Machine] !== undefined && data[key as keyof Machine] !== null);
    const values = columns.map((col) => {
      const v = data[col as keyof Machine];
      return Array.isArray(v) ? JSON.stringify(v) : v;
    });

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
    const columnNames = columns.join(',');

    const query = `INSERT INTO machines (${columnNames}, created_by) VALUES (${placeholders}, $${columns.length + 1}) RETURNING *`;
    values.push(req.user?.userId);

    const result = await pool.query(query, values);
    const machine = result.rows[0];

    // Create initial revision
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, new_data, change_summary)
       VALUES ($1, 1, $2, 'create', $3, $4)`,
      [machine.id, req.user?.userId, JSON.stringify(machine), `Created by ${req.user?.username || 'Unknown'}`]
    );

    res.status(201).json(machine);
  } catch (error) {
    console.error('Create machine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update machine
router.put('/:id', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    let data: Machine = req.body;

    // Validate and coerce field types
    data = validateAndCoerce(data);
    data = coerceLifecycleDates(data);
    const orderErr = lifecycleDateOrderError(data);
    if (orderErr) return res.status(400).json({ error: orderErr });
    const twoKErr = validateTwoKType(data);
    if (twoKErr) return res.status(400).json({ error: twoKErr });
    if ('two_k_type' in (data as any)) {
      (data as any).is_2k = (data as any).two_k_type !== null;
    }

    // Get previous data
    const previousResult = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);
    if (previousResult.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(Array.isArray(value) ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    updates.push(`updated_by = $${paramIndex}`);
    values.push(req.user?.userId);
    paramIndex++;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `UPDATE machines SET ${updates.join(',')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, values);
    const machine = result.rows[0];

    // Compute changed fields for summary
    const prev = previousResult.rows[0];
    const dataAny = data as any;
    // Normalize values: parse floats so "1500.00" (from pg) === 1500 (from form)
    const norm = (v: any): string => {
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'boolean') return String(v);
      const n = parseFloat(String(v));
      if (!isNaN(n) && String(v).trim() !== '') return String(n);
      return String(v).trim();
    };
    const changedKeys = Object.keys(data).filter(k => {
      if (k === 'suspicious_fields') return false;
      return norm(prev[k]) !== norm(dataAny[k]);
    });
    const changedLines = changedKeys.map(k => {
      const oldV = prev[k] ?? '—';
      const newV = dataAny[k] ?? '—';
      return `${k}: ${oldV} → ${newV}`;
    });
    const suspChanged = norm(JSON.stringify(prev.suspicious_fields)) !== norm(JSON.stringify(dataAny.suspicious_fields));
    if (suspChanged) changedLines.push('Suspicious flags updated');
    const changedDetails = changedLines.length ? changedLines.join('\n') : 'No changes';
    const changeSummary = `By ${req.user?.username || 'Unknown'}\n${changedDetails}`;

    // Get next revision number
    const revResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [id]);
    const nextRevision = (revResult.rows[0].max_rev || 0) + 1;

    // Create revision
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, new_data, change_summary)
       VALUES ($1, $2, $3, 'update', $4, $5, $6)`,
      [id, nextRevision, req.user?.userId, JSON.stringify(previousResult.rows[0]), JSON.stringify(machine), changeSummary]
    );

    res.json(machine);
  } catch (error) {
    console.error('Update machine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete machine (soft delete by setting updated_at)
router.delete('/:id', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const previousResult = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);
    if (previousResult.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    // Write the deletion revision BEFORE the DELETE, in a single transaction.
    // Previously this ran DELETE first then INSERT — which violated the FK
    // (machine_revisions.machine_id REFERENCES machines(id)) because the parent
    // row was already gone. That caused a 500 response while the DELETE had
    // already auto-committed, leaving the DB in an inconsistent state.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const revResult = await client.query(
        'SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1',
        [id]
      );
      const nextRevision = (revResult.rows[0].max_rev || 0) + 1;

      await client.query(
        `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, change_summary)
         VALUES ($1, $2, $3, 'delete', $4, 'Machine deleted')`,
        [id, nextRevision, req.user?.userId, JSON.stringify(previousResult.rows[0])]
      );

      await client.query('DELETE FROM machines WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Machine deleted' });
  } catch (error) {
    console.error('Delete machine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get machine revisions
router.get('/:id/revisions', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.* FROM machine_revisions r
       WHERE r.machine_id = $1
       ORDER BY r.changed_at DESC`,
      [id]
    );

    // Extract username from change_summary ("By <username>\n...")
    result.rows.forEach((row: any) => {
      const match = row.change_summary?.match(/^(?:By|Created by) (.+?)$/m);
      row.username = match ? match[1] : null;
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Get revisions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compare machines
router.get('/compare/:ids', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.params;
    const machineIds = ids.split(',').map((id) => parseInt(id));

    const result = await pool.query('SELECT * FROM machines WHERE id = ANY($1) ORDER BY id', [machineIds]);

    res.json(result.rows);
  } catch (error) {
    console.error('Compare machines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a revision (logs the deletion as a new audit entry)
router.delete('/:id/revisions/:revId', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id, revId } = req.params;
    const revResult = await pool.query('SELECT * FROM machine_revisions WHERE id = $1 AND machine_id = $2', [revId, id]);
    if (revResult.rows.length === 0) { res.status(404).json({ error: 'Revision not found' }); return; }
    const rev = revResult.rows[0];

    await pool.query('DELETE FROM machine_revisions WHERE id = $1', [revId]);

    const nextRevResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [id]);
    const nextRevision = (nextRevResult.rows[0].max_rev || 0) + 1;
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, change_summary)
       VALUES ($1, $2, $3, 'log', $4)`,
      [id, nextRevision, req.user?.userId, `Revision ${rev.revision_number} (${rev.change_type}) removed from history`]
    );

    res.json({ message: 'Revision deleted and logged' });
  } catch (error) {
    console.error('Delete revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revert machine to a specific revision
router.post('/:id/revisions/:revId/revert', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id, revId } = req.params;

    const revResult = await pool.query('SELECT * FROM machine_revisions WHERE id = $1 AND machine_id = $2', [revId, id]);
    if (revResult.rows.length === 0) { res.status(404).json({ error: 'Revision not found' }); return; }
    const targetRevision = revResult.rows[0];
    const targetState: any = { ...targetRevision.new_data };
    ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].forEach(f => delete targetState[f]);

    const currentResult = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) { res.status(404).json({ error: 'Machine not found' }); return; }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(targetState).forEach(([key, value]) => {
      updates.push(`${key} = $${paramIndex}`);
      values.push(Array.isArray(value) ? JSON.stringify(value) : value);
      paramIndex++;
    });
    updates.push(`updated_by = $${paramIndex}`); values.push(req.user?.userId); paramIndex++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const updateQuery = `UPDATE machines SET ${updates.join(',')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);
    const machine = result.rows[0];

    const nextRevResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [id]);
    const nextRevision = (nextRevResult.rows[0].max_rev || 0) + 1;
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, new_data, change_summary)
       VALUES ($1, $2, $3, 'revert', $4, $5, $6)`,
      [id, nextRevision, req.user?.userId, JSON.stringify(currentResult.rows[0]), JSON.stringify(machine), `Reverted to revision ${targetRevision.revision_number}`]
    );

    res.json(machine);
  } catch (error) {
    console.error('Revert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a machine
router.get('/:id/comments', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, u.username FROM machine_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.machine_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to a machine
router.post('/:id/comments', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    if (!comment?.trim()) {
      res.status(400).json({ error: 'Comment cannot be empty' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO machine_comments (machine_id, user_id, comment) VALUES ($1, $2, $3)
       RETURNING *, (SELECT username FROM users WHERE id = $2) as username`,
      [id, req.user?.userId, comment.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Machine Finder - Find machines matching tool requirements
router.post('/finder/search', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const requirements = req.body;

    // Fetch all machines
    const result = await pool.query('SELECT * FROM machines');
    const machines = result.rows;

    // Score machines based on requirements
    const scored = machines.map((machine) => {
      const gaps: string[] = [];
      let matchScore = 100;

      if (requirements.clamping_force_t && machine.clamping_force_t) {
        const diff = requirements.clamping_force_t - machine.clamping_force_t;
        if (diff > 0) {
          matchScore -= Math.min(50, diff);
          gaps.push(`gap.clampingForce:${diff.toFixed(0)}`);
        }
      }

      if (requirements.mold_width && machine.clearance_horizontal_mm) {
        if (machine.clearance_horizontal_mm < requirements.mold_width) {
          const diff = (requirements.mold_width - machine.clearance_horizontal_mm).toFixed(0);
          matchScore -= 20;
          gaps.push(`gap.moldWidth:${diff}`);
        }
      }

      if (requirements.mold_height && machine.mold_height_max_mm) {
        if (machine.mold_height_max_mm < requirements.mold_height) {
          const diff = (requirements.mold_height - machine.mold_height_max_mm).toFixed(0);
          matchScore -= 20;
          gaps.push(`gap.moldHeight:${diff}`);
        }
      }

      if (requirements.shot_weight_g && machine.iu1_shot_weight_g) {
        const diff = requirements.shot_weight_g - machine.iu1_shot_weight_g;
        if (diff > 0) {
          matchScore -= Math.min(30, diff / 50);
          gaps.push(`gap.shotWeight:${diff.toFixed(0)}`);
        }
      }

      if (requirements.core_pulls_nozzle && machine.core_pulls_nozzle) {
        const diff = requirements.core_pulls_nozzle - machine.core_pulls_nozzle;
        if (diff > 0) {
          matchScore -= diff * 10;
          gaps.push(`gap.corePulls:${diff}`);
        }
      }

      if (requirements.centering_ring_nozzle_mm && machine.centering_ring_nozzle_mm) {
        const diff = Math.abs(requirements.centering_ring_nozzle_mm - machine.centering_ring_nozzle_mm);
        if (diff > 5) {
          matchScore -= Math.min(10, diff / 5);
          gaps.push(`gap.centeringRing:${diff.toFixed(0)}`);
        }
      }

      if (requirements.two_shot) {
        if (!machine.iu2_screw_diameter_mm) {
          matchScore -= 40;
          gaps.push('gap.twoShot');
        }
      }

      if (requirements.rotary_table) {
        if (!machine.rotary_table) {
          matchScore -= 30;
          gaps.push('gap.rotaryTable');
        }
      }

      const suitability = matchScore >= 75 ? 'full' : matchScore >= 50 ? 'near' : 'unsuitable';

      return {
        ...machine,
        matchScore: Math.max(0, matchScore),
        gaps,
        suitability,
      };
    });

    // Sort by suitability, then by clamping force proximity (closest sufficient first), then score
    const sorted = scored.sort((a, b) => {
      const suitabilityOrder = { full: 0, near: 1, unsuitable: 2 };
      const aSuit = suitabilityOrder[a.suitability as keyof typeof suitabilityOrder];
      const bSuit = suitabilityOrder[b.suitability as keyof typeof suitabilityOrder];
      if (aSuit !== bSuit) return aSuit - bSuit;

      if (requirements.clamping_force_t) {
        const aForce = a.clamping_force_t ?? Infinity;
        const bForce = b.clamping_force_t ?? Infinity;
        const aDiff = Math.abs(aForce - requirements.clamping_force_t);
        const bDiff = Math.abs(bForce - requirements.clamping_force_t);
        if (Math.abs(aDiff - bDiff) > 1) return aDiff - bDiff;
      }

      return b.matchScore - a.matchScore;
    });

    res.json(sorted);
  } catch (error) {
    console.error('Machine finder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
