// Capacity engine — pure functions, no DB access.
// All inputs are passed in; the route layer is responsible for fetching data.
//
// Note: machines.clamping_force_kn historically stores tons (legacy column name).
// Treat the field as tons directly; no kN→t conversion is performed.

export type MachineRow = {
  id: number;
  clamping_force_kn: number | null;  // value is in tons despite the name
  iu1_shot_volume_cm3: number | null;
  is_2k: boolean;
  has_mucell: boolean;
  has_variotherm: boolean;
  in_service_from: string | null;     // 'YYYY-MM-DD' or null (= always-on)
  planned_scrap_from: string | null;  // 'YYYY-MM-DD' or null (= no scrap)
};

export type ToolQualification = {
  qualified_min_tonnage_t: number | null;
  qualified_max_tonnage_t: number | null;
  shot_volume_required_cm3: number | null;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
};

export type QualResult = { ok: boolean; reason?: string };

/**
 * Months a machine is active during calendar year `year`, based on month-precision
 * lifecycle dates. Day component is ignored — `2026-10-15` and `2026-10-01` both
 * mean "active starting October".
 *
 * @param inServiceFrom    'YYYY-MM-DD' or null (null = always-on from -∞)
 * @param plannedScrapFrom 'YYYY-MM-DD' or null (null = no scrap planned, +∞)
 * @param year             integer calendar year
 * @returns integer 0..12
 */
export function monthsActiveInYear(
  inServiceFrom: string | null,
  plannedScrapFrom: string | null,
  year: number,
): number {
  // Convert each bound to "month index" = year*12 + (month-1).
  const yearStartIdx = year * 12;       // Jan of `year`
  const yearEndIdx   = (year + 1) * 12; // Jan of `year+1`

  const startIdx = inServiceFrom
    ? Number(inServiceFrom.slice(0, 4)) * 12 + (Number(inServiceFrom.slice(5, 7)) - 1)
    : -Infinity;
  const endIdx = plannedScrapFrom
    ? Number(plannedScrapFrom.slice(0, 4)) * 12 + (Number(plannedScrapFrom.slice(5, 7)) - 1)
    : Infinity;

  if (endIdx <= startIdx) return 0; // defensive: scrap not strictly after in-service

  const overlapStart = Math.max(startIdx, yearStartIdx);
  const overlapEnd   = Math.min(endIdx, yearEndIdx);
  return Math.max(0, overlapEnd - overlapStart);
}

export function qualifies(m: MachineRow, t: ToolQualification): QualResult {
  const tonnage_t = m.clamping_force_kn;

  if (t.qualified_min_tonnage_t != null && (tonnage_t == null || tonnage_t < t.qualified_min_tonnage_t))
    return { ok: false, reason: `Machine tonnage ${tonnage_t ?? '?'}t < required min ${t.qualified_min_tonnage_t}t` };

  if (t.qualified_max_tonnage_t != null && tonnage_t != null && tonnage_t > t.qualified_max_tonnage_t)
    return { ok: false, reason: `Machine tonnage ${tonnage_t}t > allowed max ${t.qualified_max_tonnage_t}t` };

  if (t.shot_volume_required_cm3 != null && (m.iu1_shot_volume_cm3 == null || m.iu1_shot_volume_cm3 < t.shot_volume_required_cm3))
    return { ok: false, reason: `Machine shot volume ${m.iu1_shot_volume_cm3 ?? '?'} cm³ < required ${t.shot_volume_required_cm3} cm³` };

  if (t.requires_2k && !m.is_2k)               return { ok: false, reason: 'Machine not 2K-capable' };
  if (t.requires_mucell && !m.has_mucell)      return { ok: false, reason: 'Machine not MuCell-capable' };
  if (t.requires_variotherm && !m.has_variotherm) return { ok: false, reason: 'Machine lacks Variotherm' };

  return { ok: true };
}

// ── computeCapacity types ────────────────────────────────────────────────────

export type Tool = ToolQualification & {
  id: number;
  tool_number: string;
  description?: string;
  customer?: string;
  program?: string;
  cavities: number;
  rated_cycle_time_sec: number;
  assigned_machine_id: number | null;
  status: 'active' | 'inactive' | 'candidate';
};

export type Volume = { tool_id: number; year: number; pieces_per_year: number };

export type ClassCapacityRow = {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  year: number;
  oee_pct: number;
  shifts_per_week: number;
  working_days_year: number;
  planned_downtime_wk: number;
};

export type Modification =
  | {
      type: 'add_tool';
      tool: Omit<Tool, 'id' | 'status' | 'assigned_machine_id'> & { target_machine_id: number };
      volumes: { year: number; pieces_per_year: number }[];
    }
  | { type: 'move_tool'; tool_id: number; target_machine_id: number }
  | { type: 'remove_tool'; tool_id: number }
  | { type: 'change_volume'; tool_id: number; year: number; pieces_per_year: number }
  | {
      type: 'change_class_param';
      class_key: { tonnage_t: number; requires_2k: boolean; requires_mucell: boolean; requires_variotherm: boolean };
      year_or_all: number | 'all';
      field: 'oee_pct' | 'shifts_per_week' | 'working_days_year' | 'planned_downtime_wk';
      value: number;
    };

export type CellStatus = 'green' | 'yellow' | 'orange' | 'red';

export type CapacityCell = {
  year: number;
  hours_per_machine: number;
  demand: number;
  available: number;
  free: number;
  utilization_pct: number;
  status: CellStatus;
  contributing_tools: { tool_number: string; mach_equivalents: number }[];
};

export type CapacityClass = {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
  label: string;
  machines: number;
  shifts_per_week: number;
  years: CapacityCell[];
};

// ── Internal helpers ─────────────────────────────────────────────────────────

// Machine class key: groups machines that share identical capability profile.
// tonnage_t comes from clamping_force_kn directly (already in tons).
function classKey(m: MachineRow): string {
  const t = m.clamping_force_kn ?? 'null';
  return `${t}-${m.is_2k}-${m.has_mucell}-${m.has_variotherm}`;
}

function statusFor(free: number): CellStatus {
  if (free < 0) return 'red';
  if (free < 0.5) return 'orange';
  if (free < 1.0) return 'yellow';
  return 'green';
}

function classLabel(c: {
  tonnage_t: number;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
}): string {
  const parts = [`KM ${c.tonnage_t}`];
  if (c.requires_2k) parts.push('2K');
  if (c.requires_mucell) parts.push('MuCell');
  if (c.requires_variotherm) parts.push('Variotherm');
  return parts.join(' · ');
}

function applyModifications(
  tools: Tool[],
  volumes: Volume[],
  classCapacity: ClassCapacityRow[],
  modifications: Modification[],
): { tools: Tool[]; volumes: Volume[]; classCapacity: ClassCapacityRow[] } {
  // Work on shallow copies — never mutate the originals.
  let t = tools.slice();
  let v = volumes.slice();
  let cc = classCapacity.slice();

  for (const mod of modifications) {
    if (mod.type === 'add_tool') {
      const tempId = -(t.length + 1);
      t = [
        ...t,
        {
          id: tempId,
          tool_number: mod.tool.tool_number,
          description: (mod.tool as any).description,
          customer: (mod.tool as any).customer,
          program: (mod.tool as any).program,
          cavities: mod.tool.cavities,
          rated_cycle_time_sec: mod.tool.rated_cycle_time_sec,
          qualified_min_tonnage_t: mod.tool.qualified_min_tonnage_t,
          qualified_max_tonnage_t: mod.tool.qualified_max_tonnage_t,
          shot_volume_required_cm3: mod.tool.shot_volume_required_cm3,
          requires_2k: mod.tool.requires_2k,
          requires_mucell: mod.tool.requires_mucell,
          requires_variotherm: mod.tool.requires_variotherm,
          assigned_machine_id: mod.tool.target_machine_id,
          status: 'candidate',
        },
      ];
      v = [...v, ...mod.volumes.map(vol => ({ tool_id: tempId, year: vol.year, pieces_per_year: vol.pieces_per_year }))];
    } else if (mod.type === 'move_tool') {
      t = t.map(tool => tool.id === mod.tool_id ? { ...tool, assigned_machine_id: mod.target_machine_id } : tool);
    } else if (mod.type === 'remove_tool') {
      t = t.filter(tool => tool.id !== mod.tool_id);
      v = v.filter(vol => vol.tool_id !== mod.tool_id);
    } else if (mod.type === 'change_volume') {
      const idx = v.findIndex(vol => vol.tool_id === mod.tool_id && vol.year === mod.year);
      if (idx >= 0) {
        v = v.map((vol, i) => i === idx ? { ...vol, pieces_per_year: mod.pieces_per_year } : vol);
      } else {
        v = [...v, { tool_id: mod.tool_id, year: mod.year, pieces_per_year: mod.pieces_per_year }];
      }
    } else if (mod.type === 'change_class_param') {
      cc = cc.map(row =>
        row.tonnage_t === mod.class_key.tonnage_t &&
        row.requires_2k === mod.class_key.requires_2k &&
        row.requires_mucell === mod.class_key.requires_mucell &&
        row.requires_variotherm === mod.class_key.requires_variotherm &&
        (mod.year_or_all === 'all' || row.year === mod.year_or_all)
          ? { ...row, [mod.field]: mod.value }
          : row
      );
    }
  }

  return { tools: t, volumes: v, classCapacity: cc };
}

// ── computeCapacity ──────────────────────────────────────────────────────────

export function computeCapacity(input: {
  machines: MachineRow[];
  tools: Tool[];
  volumes: Volume[];
  classCapacity: ClassCapacityRow[];
  yearFrom: number;
  yearTo: number;
  modifications?: Modification[];
}): CapacityClass[] {
  // Apply modifications to working copies — inputs are never mutated.
  const { tools, volumes, classCapacity } = applyModifications(
    input.tools,
    input.volumes,
    input.classCapacity,
    input.modifications ?? [],
  );

  // Group machines by their capability class key.
  const machinesByKey = new Map<string, MachineRow[]>();
  for (const m of input.machines) {
    const key = classKey(m);
    if (!machinesByKey.has(key)) machinesByKey.set(key, []);
    machinesByKey.get(key)!.push(m);
  }

  // Build a lookup: machine id → class key.
  const machineKeyById = new Map<number, string>();
  for (const [key, machines] of machinesByKey) {
    for (const m of machines) machineKeyById.set(m.id, key);
  }

  const out: CapacityClass[] = [];

  for (const [key, machines] of machinesByKey) {
    // Decode the key back to capability dimensions.
    const firstM = machines[0];
    const tonnage_t = firstM.clamping_force_kn!;
    const requires_2k = firstM.is_2k;
    const requires_mucell = firstM.has_mucell;
    const requires_variotherm = firstM.has_variotherm;

    const machineIds = new Set(machines.map(m => m.id));

    // Collect tools belonging to this class:
    //   • Explicitly assigned to a machine in this class, OR
    //   • Unassigned but qualified to this exact class (qualified_min == qualified_max == tonnage_t,
    //     and capability flags match). Importer sets min==max==sheet-class for class-level data.
    const classTools = tools.filter(t => {
      if (t.assigned_machine_id != null) return machineIds.has(t.assigned_machine_id);
      return (
        t.qualified_min_tonnage_t === tonnage_t &&
        t.qualified_max_tonnage_t === tonnage_t &&
        t.requires_2k === requires_2k &&
        t.requires_mucell === requires_mucell &&
        t.requires_variotherm === requires_variotherm
      );
    });

    const yearCells: CapacityCell[] = [];

    for (let year = input.yearFrom; year <= input.yearTo; year++) {
      const cc = classCapacity.find(
        c =>
          c.tonnage_t === tonnage_t &&
          c.requires_2k === requires_2k &&
          c.requires_mucell === requires_mucell &&
          c.requires_variotherm === requires_variotherm &&
          c.year === year,
      );

      if (!cc) {
        // No capacity params for this year — report as unconstrained.
        yearCells.push({
          year,
          hours_per_machine: 0,
          demand: 0,
          available: machines.length,
          free: machines.length,
          utilization_pct: 0,
          status: 'green',
          contributing_tools: [],
        });
        continue;
      }

      const hours_per_machine = cc.shifts_per_week * 8 * (52 - cc.planned_downtime_wk) * (cc.oee_pct / 100);

      const contributing: { tool_number: string; mach_equivalents: number }[] = [];
      let demand = 0;

      for (const tool of classTools) {
        const vol = volumes.find(vv => vv.tool_id === tool.id && vv.year === year);
        if (!vol || vol.pieces_per_year <= 0 || hours_per_machine <= 0) continue;
        if (!tool.cavities || !tool.rated_cycle_time_sec) continue;
        const pph = (tool.cavities * 3600) / tool.rated_cycle_time_sec;
        if (!Number.isFinite(pph) || pph <= 0) continue;
        const hours = vol.pieces_per_year / pph;
        const me = hours / hours_per_machine;
        if (!Number.isFinite(me)) continue;
        demand += me;
        contributing.push({ tool_number: tool.tool_number, mach_equivalents: me });
      }

      const free = machines.length - demand;
      yearCells.push({
        year,
        hours_per_machine,
        demand,
        available: machines.length,
        free,
        utilization_pct: machines.length > 0 ? (demand / machines.length) * 100 : 0,
        status: statusFor(free),
        contributing_tools: contributing,
      });
    }

    // Find the representative shifts_per_week (first matching cc row for any year).
    const anyCC = classCapacity.find(
      c =>
        c.tonnage_t === tonnage_t &&
        c.requires_2k === requires_2k &&
        c.requires_mucell === requires_mucell &&
        c.requires_variotherm === requires_variotherm,
    );

    out.push({
      tonnage_t,
      requires_2k,
      requires_mucell,
      requires_variotherm,
      label: classLabel({ tonnage_t, requires_2k, requires_mucell, requires_variotherm }),
      machines: machines.length,
      shifts_per_week: anyCC?.shifts_per_week ?? 0,
      years: yearCells,
    });
  }

  out.sort((a, b) => a.tonnage_t - b.tonnage_t);
  return out;
}
