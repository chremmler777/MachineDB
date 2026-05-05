// Shared data-loading helper for capacity routes.
// Both /api/capacity and /v1/capacity use this to fetch machine/tool/volume/class data.

import pool from '../db/connection.js';
import type { MachineRow, Tool, Volume, ClassCapacityRow } from './capacity-engine.js';

export type CapacityInputs = {
  machines: MachineRow[];
  tools: Tool[];
  volumes: Volume[];
  classCapacity: ClassCapacityRow[];
};

export async function loadCapacityInputs(
  yearFrom: number,
  yearTo: number,
  plant?: string,
): Promise<CapacityInputs> {
  const plantFilter = plant
    ? `WHERE LOWER(plant_location) = LOWER($1)`
    : `WHERE plant_location IS NOT NULL`;

  const machineParams = plant ? [plant] : [];

  const [machinesResult, toolsResult, volumesResult, classCapResult] = await Promise.all([
    pool.query(
      `SELECT id,
              clamping_force_kn,
              iu1_shot_volume_cm3,
              COALESCE(is_2k, false) AS is_2k,
              COALESCE(has_mucell, false) AS has_mucell,
              COALESCE(has_variotherm, false) AS has_variotherm
       FROM machines
       ${plantFilter}`,
      machineParams,
    ),
    pool.query(
      `SELECT id, tool_number, description, customer, program,
              cavities, rated_cycle_time_sec,
              qualified_min_tonnage_t, qualified_max_tonnage_t, shot_volume_required_cm3,
              requires_2k, requires_mucell, requires_variotherm,
              assigned_machine_id, status
       FROM im_tools
       WHERE status IN ('active', 'candidate')
         AND assigned_machine_id IS NOT NULL`,
    ),
    pool.query(
      `SELECT tool_id, year, pieces_per_year
       FROM im_tool_volumes
       WHERE year BETWEEN $1 AND $2`,
      [yearFrom, yearTo],
    ),
    pool.query(
      `SELECT tonnage_t, requires_2k, requires_mucell, requires_variotherm,
              year, oee_pct, shifts_per_week, working_days_year, planned_downtime_wk
       FROM im_class_capacity
       WHERE year BETWEEN $1 AND $2`,
      [yearFrom, yearTo],
    ),
  ]);

  const machines: MachineRow[] = machinesResult.rows.map(r => ({
    id: Number(r.id),
    clamping_force_kn: r.clamping_force_kn != null ? Number(r.clamping_force_kn) : null,
    iu1_shot_volume_cm3: r.iu1_shot_volume_cm3 != null ? Number(r.iu1_shot_volume_cm3) : null,
    is_2k: Boolean(r.is_2k),
    has_mucell: Boolean(r.has_mucell),
    has_variotherm: Boolean(r.has_variotherm),
  }));

  const tools: Tool[] = toolsResult.rows.map(r => ({
    id: Number(r.id),
    tool_number: r.tool_number,
    description: r.description ?? undefined,
    customer: r.customer ?? undefined,
    program: r.program ?? undefined,
    cavities: Number(r.cavities),
    rated_cycle_time_sec: Number(r.rated_cycle_time_sec),
    qualified_min_tonnage_t: r.qualified_min_tonnage_t != null ? Number(r.qualified_min_tonnage_t) : null,
    qualified_max_tonnage_t: r.qualified_max_tonnage_t != null ? Number(r.qualified_max_tonnage_t) : null,
    shot_volume_required_cm3: r.shot_volume_required_cm3 != null ? Number(r.shot_volume_required_cm3) : null,
    requires_2k: Boolean(r.requires_2k),
    requires_mucell: Boolean(r.requires_mucell),
    requires_variotherm: Boolean(r.requires_variotherm),
    assigned_machine_id: r.assigned_machine_id != null ? Number(r.assigned_machine_id) : null,
    status: r.status as 'active' | 'inactive' | 'candidate',
  }));

  const volumes: Volume[] = volumesResult.rows.map(r => ({
    tool_id: Number(r.tool_id),
    year: Number(r.year),
    pieces_per_year: Number(r.pieces_per_year),
  }));

  const classCapacity: ClassCapacityRow[] = classCapResult.rows.map(r => ({
    tonnage_t: Number(r.tonnage_t),
    requires_2k: Boolean(r.requires_2k),
    requires_mucell: Boolean(r.requires_mucell),
    requires_variotherm: Boolean(r.requires_variotherm),
    year: Number(r.year),
    oee_pct: Number(r.oee_pct),
    shifts_per_week: Number(r.shifts_per_week),
    working_days_year: Number(r.working_days_year),
    planned_downtime_wk: Number(r.planned_downtime_wk),
  }));

  return { machines, tools, volumes, classCapacity };
}
