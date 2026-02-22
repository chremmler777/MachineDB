import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { verifyToken, requireMaster, AuthRequest } from '../middleware/auth.js';
import { Machine } from '../types/index.js';

const router = Router();

// Define field types for validation
const numericFields = new Set([
  'year_of_construction', 'length_mm', 'width_mm', 'height_mm', 'weight_kg', 'clamping_force_kn',
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

// List machines with search, filter, sort
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search, manufacturer, plant, clamping_force_min, clamping_force_max, year_min, year_max, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM machines WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (internal_name ILIKE $${paramIndex} OR manufacturer ILIKE $${paramIndex} OR model ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (manufacturer) {
      query += ` AND manufacturer = $${paramIndex}`;
      params.push(manufacturer);
      paramIndex++;
    }

    if (plant) {
      query += ` AND plant_location = $${paramIndex}`;
      params.push(plant);
      paramIndex++;
    }

    if (clamping_force_min) {
      query += ` AND clamping_force_kn >= $${paramIndex}`;
      params.push(parseFloat(clamping_force_min as string));
      paramIndex++;
    }

    if (clamping_force_max) {
      query += ` AND clamping_force_kn <= $${paramIndex}`;
      params.push(parseFloat(clamping_force_max as string));
      paramIndex++;
    }

    if (year_min) {
      query += ` AND year_of_construction >= $${paramIndex}`;
      params.push(parseInt(year_min as string));
      paramIndex++;
    }

    if (year_max) {
      query += ` AND year_of_construction <= $${paramIndex}`;
      params.push(parseInt(year_max as string));
      paramIndex++;
    }

    query += ` ORDER BY internal_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
      countQuery += ` AND clamping_force_kn >= $${countParamIndex}`;
      countParams.push(parseFloat(clamping_force_min as string));
      countParamIndex++;
    }

    if (clamping_force_max) {
      countQuery += ` AND clamping_force_kn <= $${countParamIndex}`;
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

    const columns = Object.keys(data).filter((key) => data[key as keyof Machine] !== undefined && data[key as keyof Machine] !== null);
    const values = columns.map((col) => data[col as keyof Machine]);

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
    const columnNames = columns.join(',');

    const query = `INSERT INTO machines (${columnNames}, created_by) VALUES (${placeholders}, $${columns.length + 1}) RETURNING *`;
    values.push(req.user?.userId);

    const result = await pool.query(query, values);
    const machine = result.rows[0];

    // Create initial revision
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, new_data, change_summary)
       VALUES ($1, 1, $2, 'create', $3, 'Machine created')`,
      [machine.id, req.user?.userId, JSON.stringify(machine)]
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
    const data: Machine = req.body;

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
        values.push(value);
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

    // Get next revision number
    const revResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [id]);
    const nextRevision = (revResult.rows[0].max_rev || 0) + 1;

    // Create revision
    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, new_data, change_summary)
       VALUES ($1, $2, $3, 'update', $4, $5, 'Machine updated')`,
      [id, nextRevision, req.user?.userId, JSON.stringify(previousResult.rows[0]), JSON.stringify(machine)]
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

    await pool.query('DELETE FROM machines WHERE id = $1', [id]);

    // Create deletion revision
    const revResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [id]);
    const nextRevision = (revResult.rows[0].max_rev || 0) + 1;

    await pool.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, change_summary)
       VALUES ($1, $2, $3, 'delete', $4, 'Machine deleted')`,
      [id, nextRevision, req.user?.userId, JSON.stringify(previousResult.rows[0])]
    );

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
      `SELECT r.*, u.username FROM machine_revisions r
       LEFT JOIN users u ON r.changed_by = u.id
       WHERE r.machine_id = $1
       ORDER BY r.changed_at DESC`,
      [id]
    );

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

      if (requirements.clamping_force_kn && machine.clamping_force_kn) {
        const diff = requirements.clamping_force_kn - machine.clamping_force_kn;
        if (diff > 0) {
          matchScore -= Math.min(50, diff / 10);
          gaps.push(`Clamping force: ${diff.toFixed(0)}kN short`);
        }
      }

      if (requirements.mold_width && machine.clearance_horizontal_mm) {
        if (machine.clearance_horizontal_mm < requirements.mold_width) {
          matchScore -= 20;
          gaps.push(`Mold width: ${(requirements.mold_width - machine.clearance_horizontal_mm).toFixed(0)}mm short`);
        }
      }

      if (requirements.mold_height && machine.mold_height_max_mm) {
        if (machine.mold_height_max_mm < requirements.mold_height) {
          matchScore -= 20;
          gaps.push(`Mold height: ${(requirements.mold_height - machine.mold_height_max_mm).toFixed(0)}mm short`);
        }
      }

      if (requirements.shot_weight_g && machine.iu1_shot_weight_g) {
        const diff = requirements.shot_weight_g - machine.iu1_shot_weight_g;
        if (diff > 0) {
          matchScore -= Math.min(30, diff / 50);
          gaps.push(`Shot weight: ${diff.toFixed(0)}g short`);
        }
      }

      if (requirements.core_pulls_nozzle && machine.core_pulls_nozzle) {
        const diff = requirements.core_pulls_nozzle - machine.core_pulls_nozzle;
        if (diff > 0) {
          matchScore -= diff * 10;
          gaps.push(`Core pulls (nozzle): ${diff} more needed`);
        }
      }

      if (requirements.centering_ring_nozzle_mm && machine.centering_ring_nozzle_mm) {
        const diff = Math.abs(requirements.centering_ring_nozzle_mm - machine.centering_ring_nozzle_mm);
        if (diff > 5) {
          matchScore -= Math.min(10, diff / 5);
          gaps.push(`Centering ring (nozzle): ${diff.toFixed(0)}mm mismatch`);
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

    // Sort by suitability and score
    const sorted = scored.sort((a, b) => {
      const suitabilityOrder = { full: 0, near: 1, unsuitable: 2 };
      if (suitabilityOrder[a.suitability as keyof typeof suitabilityOrder] !== suitabilityOrder[b.suitability as keyof typeof suitabilityOrder]) {
        return suitabilityOrder[a.suitability as keyof typeof suitabilityOrder] - suitabilityOrder[b.suitability as keyof typeof suitabilityOrder];
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
