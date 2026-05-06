export type CellStatus = 'green' | 'yellow' | 'orange' | 'red';

export type TwoKType = '2k_turntable' | '2k_no_turntable' | 'parallel_injection';

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

export type Modification =
  | { type: 'add_tool'; tool: unknown; volumes: { year: number; pieces_per_year: number }[] }
  | { type: 'move_tool'; tool_id: number; target_machine_id: number }
  | { type: 'remove_tool'; tool_id: number }
  | { type: 'change_volume'; tool_id: number; year: number; pieces_per_year: number }
  | {
      type: 'change_class_param';
      class_key: {
        tonnage_t: number;
        requires_2k: boolean;
        requires_mucell: boolean;
        requires_variotherm: boolean;
      };
      year_or_all: number | 'all';
      field: 'oee_pct' | 'shifts_per_week' | 'working_days_year' | 'planned_downtime_wk';
      value: number;
    };

export type Tool = {
  id: number;
  tool_number: string;
  description?: string;
  customer?: string;
  program?: string;
  cavities: number;
  rated_cycle_time_sec: number;
  assigned_machine_id: number | null;
  status: 'active' | 'inactive' | 'candidate';
  qualified_min_tonnage_t: number | null;
  qualified_max_tonnage_t: number | null;
  shot_volume_required_cm3: number | null;
  requires_2k: boolean;
  requires_mucell: boolean;
  requires_variotherm: boolean;
};

export type Machine = {
  id: number;
  internal_name: string;
  manufacturer: string | null;
  year_of_construction: number | null;
  clamping_force_t: number | null;
  iu1_shot_volume_cm3: number | null;
  is_2k: boolean;
  two_k_type: TwoKType | null;
  has_mucell: boolean;
  has_variotherm: boolean;
};
