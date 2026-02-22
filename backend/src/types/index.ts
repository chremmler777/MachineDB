export interface User {
  id: number;
  username: string;
  role: 'master' | 'viewer';
  plant?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Machine {
  id: number;
  internal_name: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  order_number?: string;
  year_of_construction?: number;
  plant_location?: string;

  // Dimensions
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  weight_kg?: number;

  // Clamping Unit
  clamping_force_kn?: number;
  centering_ring_nozzle_mm?: number;
  centering_ring_ejector_mm?: number;
  fine_centering?: boolean;
  mold_height_min_mm?: number;
  mold_height_max_mm?: number;
  opening_stroke_mm?: number;
  clearance_horizontal_mm?: number;
  clearance_vertical_mm?: number;
  rotary_table?: boolean;
  max_weight_nozzle_kg?: number;
  max_weight_ejector_kg?: number;

  // Tool Connections
  temperature_control_circuits?: number;
  cascade_count?: number;
  hot_runner_integrated?: boolean;
  hot_runner_external?: boolean;
  core_pulls_nozzle?: number;
  core_pulls_ejector?: number;
  pneumatic_nozzle?: boolean;
  pneumatic_ejector?: boolean;

  // Ejector
  ejector_stroke_mm?: number;
  ejector_thread?: string;
  ejector_max_travel_mm?: number;

  // Interfaces
  mechanical_interface_tool?: string;
  mechanical_interface_robot?: string;
  electrical_interface_tool?: string;
  electrical_interface_hotrunner?: string;
  electrical_interface_ejector?: string;
  electrical_interface_corepull?: string;
  electrical_interface_robot?: string;

  // Injection Unit 1
  iu1_screw_diameter_mm?: number;
  iu1_shot_volume_cm3?: number;
  iu1_injection_flow_cm3s?: number;
  iu1_plasticizing_rate_gs?: number;
  iu1_ld_ratio?: number;
  iu1_injection_pressure_bar?: number;
  iu1_shot_weight_g?: number;
  iu1_screw_type?: string;
  iu1_nozzle?: string;

  // Injection Unit 2
  iu2_screw_diameter_mm?: number;
  iu2_shot_volume_cm3?: number;
  iu2_injection_flow_cm3s?: number;
  iu2_plasticizing_rate_gs?: number;
  iu2_ld_ratio?: number;
  iu2_injection_pressure_bar?: number;
  iu2_shot_weight_g?: number;
  iu2_screw_type?: string;
  iu2_nozzle?: string;

  // Robot
  robot_manufacturer?: string;
  robot_model?: string;
  robot_serial?: string;
  robot_vacuum_circuits?: number;
  robot_air_circuits?: number;
  robot_electrical_signals?: number;

  // Meta
  special_controls?: string;
  remarks?: string;
  created_at?: Date;
  updated_at?: Date;
  created_by?: number;
  updated_by?: number;
}

export interface MachineFile {
  id: number;
  machine_id: number;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size: number;
  uploaded_by?: number;
  uploaded_at: Date;
  description?: string;
}

export interface MachineRevision {
  id: number;
  machine_id: number;
  revision_number: number;
  changed_by?: number;
  changed_at: Date;
  change_type: string;
  previous_data?: Record<string, any>;
  new_data?: Record<string, any>;
  change_summary?: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}
