import { Router, Response } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import pool from '../db/connection.js';
import { verifyToken, requireMaster, AuthRequest } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

const parseValue = (value: any): any => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    // Handle German and English boolean values
    if (trimmed === 'yes' || trimmed === 'ja' || trimmed === 'true' || trimmed.includes('ja') || trimmed.includes('yes')) return true;
    if (trimmed === 'no' || trimmed === 'nein' || trimmed === 'false' || trimmed.includes('nein') || trimmed.includes('no')) return false;
    // Try to parse as number
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
    // Return string for non-numeric values
    return value;
  }
  if (value === true) return true;
  if (value === false) return false;
  return value;
};

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

router.post('/excel', verifyToken, requireMaster, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    let sheetName: string;
    let plant_location: string;

    // Determine which sheet to read based on filename
    if (req.file.originalname.includes('USA')) {
      sheetName = 'Maschinenpark USA';
      plant_location = 'USA';
    } else if (req.file.originalname.includes('Mexico') || req.file.originalname.includes('DataBase')) {
      sheetName = 'KTX Mexico';
      plant_location = 'Mexico';
    } else {
      res.status(400).json({ error: 'Unknown file type. Use USA or Mexico Excel files.' });
      return;
    }

    // Check if sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
      res.status(400).json({ error: `Sheet "${sheetName}" not found in Excel file` });
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Data starts at row 11 (index 10) for both files
    const dataStartRow = 10;
    if (rows.length <= dataStartRow) {
      res.status(400).json({ error: 'No data found in Excel file' });
      return;
    }

    const machines = [];

    // Process rows starting from row 11 (index 10)
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!Array.isArray(row)) continue;

      const internal_name = parseValue(row[0]);
      if (!internal_name) continue;

      let machine: any = { plant_location, internal_name };

      if (plant_location === 'USA') {
        // USA file column mapping
        // Col 0: internal_name, Col 1: model, Col 2: serial, Col 3: order, Col 4: special_controls
        // Col 5-7: length/width/height, Col 8: weight, Col 9: year, Col 10: empty, Col 11-12: centering rings
        const model = parseValue(row[1]);
        let manufacturer = null;
        if (model && typeof model === 'string') {
          const match = model.match(/^([A-Z]+)/);
          manufacturer = match ? match[1] : 'KraussMaffei';
        }
        machine.manufacturer = manufacturer;
        machine.model = model || null;
        machine.serial_number = parseValue(row[2]) || null;
        machine.order_number = parseValue(row[3]) || null;
        machine.special_controls = parseValue(row[4]);
        machine.length_mm = parseValue(row[5]);
        machine.width_mm = parseValue(row[6]);
        machine.height_mm = parseValue(row[7]);
        machine.weight_kg = parseValue(row[8]);
        machine.year_of_construction = parseValue(row[9]);
        // Col 10 is empty in USA file
        machine.centering_ring_nozzle_mm = parseValue(row[11]);
        machine.centering_ring_ejector_mm = parseValue(row[12]);
        machine.fine_centering = parseValue(row[13]);
        machine.mold_height_min_mm = parseValue(row[14]);
        machine.mold_height_max_mm = parseValue(row[15]);
        machine.opening_stroke_mm = parseValue(row[16]);
        machine.clearance_horizontal_mm = parseValue(row[17]);
        machine.clearance_vertical_mm = parseValue(row[18]);
        // Col 19: Max weight - treating as rotary_table indicator for now
        machine.rotary_table = parseValue(row[19]) ? true : null;
        machine.max_weight_nozzle_kg = parseValue(row[20]);
        machine.max_weight_ejector_kg = parseValue(row[21]);
        machine.temperature_control_circuits = parseValue(row[22]);
        machine.hot_runner_integrated = parseValue(row[23]);
        machine.hot_runner_external = parseValue(row[24]);
        machine.cascade_count = parseValue(row[25]);
        machine.core_pulls_nozzle = parseValue(row[26]);
        machine.core_pulls_ejector = parseValue(row[27]);
        machine.pneumatic_nozzle = parseValue(row[28]);
        machine.pneumatic_ejector = parseValue(row[29]);
        machine.ejector_stroke_mm = parseValue(row[30]);
        machine.ejector_thread = parseValue(row[31]);
        machine.ejector_max_travel_mm = parseValue(row[32]);
        machine.mechanical_interface_tool = parseValue(row[33]);
        machine.mechanical_interface_robot = parseValue(row[34]);
        machine.electrical_interface_tool = parseValue(row[35]);
        machine.electrical_interface_hotrunner = parseValue(row[36]);
        machine.electrical_interface_ejector = parseValue(row[37]);
        machine.electrical_interface_corepull = parseValue(row[38]);
        machine.electrical_interface_robot = parseValue(row[39]);
        machine.iu1_screw_diameter_mm = parseValue(row[40]);
        machine.iu1_shot_volume_cm3 = parseValue(row[41]);
        machine.iu1_injection_flow_cm3s = parseValue(row[42]);
        machine.iu1_plasticizing_rate_gs = parseValue(row[43]);
        machine.iu1_ld_ratio = parseValue(row[44]);
        machine.iu1_injection_pressure_bar = parseValue(row[45]);
        machine.iu1_shot_weight_g = parseValue(row[46]);
        machine.iu1_screw_type = parseValue(row[47]);
        machine.iu1_nozzle = parseValue(row[48]);
        machine.iu2_screw_diameter_mm = parseValue(row[49]);
        machine.iu2_shot_volume_cm3 = parseValue(row[50]);
        machine.iu2_injection_flow_cm3s = parseValue(row[51]);
        machine.iu2_plasticizing_rate_gs = parseValue(row[52]);
        machine.iu2_ld_ratio = parseValue(row[53]);
        machine.iu2_injection_pressure_bar = parseValue(row[54]);
        machine.iu2_shot_weight_g = parseValue(row[55]);
        machine.iu2_screw_type = parseValue(row[56]);
        machine.iu2_nozzle = parseValue(row[57]);
        machine.robot_manufacturer = parseValue(row[58]);
        machine.robot_model = parseValue(row[59]);
        machine.robot_serial = parseValue(row[60]);
        machine.robot_vacuum_circuits = parseValue(row[61]);
        machine.remarks = parseValue(row[62]);
      } else if (plant_location === 'Mexico') {
        // Mexico file column mapping
        // Col 0: internal_name, Col 1: manufacturer, Col 2: order, Col 3: model, Col 4: serial
        // Col 5: year, Col 6-8: length/width/height, Col 9: weight, Col 10: clamping_force
        machine.manufacturer = parseValue(row[1]) || null;
        machine.order_number = parseValue(row[2]) || null;
        machine.model = parseValue(row[3]) || null;
        machine.serial_number = parseValue(row[4]) || null;
        machine.year_of_construction = parseValue(row[5]);
        machine.length_mm = parseValue(row[6]);
        machine.width_mm = parseValue(row[7]);
        machine.height_mm = parseValue(row[8]);
        machine.weight_kg = parseValue(row[9]);
        machine.clamping_force_kn = parseValue(row[10]);
        machine.centering_ring_nozzle_mm = parseValue(row[11]);
        machine.centering_ring_ejector_mm = parseValue(row[12]);
        machine.fine_centering = parseValue(row[13]);
        machine.mold_height_min_mm = parseValue(row[14]);
        machine.mold_height_max_mm = parseValue(row[15]);
        machine.opening_stroke_mm = parseValue(row[16]);
        machine.clearance_horizontal_mm = parseValue(row[17]);
        machine.clearance_vertical_mm = parseValue(row[18]);
        machine.rotary_table = parseValue(row[19]);
        machine.max_weight_nozzle_kg = parseValue(row[20]);
        machine.max_weight_ejector_kg = parseValue(row[21]);
        machine.temperature_control_circuits = parseValue(row[22]);
        machine.hot_runner_integrated = parseValue(row[23]);
        machine.hot_runner_external = parseValue(row[24]);
        machine.cascade_count = parseValue(row[25]);
        machine.core_pulls_nozzle = parseValue(row[26]);
        machine.core_pulls_ejector = parseValue(row[27]);
        machine.pneumatic_nozzle = parseValue(row[28]);
        machine.pneumatic_ejector = parseValue(row[29]);
        machine.ejector_stroke_mm = parseValue(row[30]);
        machine.ejector_thread = parseValue(row[31]);
        machine.ejector_max_travel_mm = parseValue(row[32]);
        machine.mechanical_interface_tool = parseValue(row[33]);
        machine.mechanical_interface_robot = parseValue(row[34]);
        machine.electrical_interface_tool = parseValue(row[35]);
        machine.electrical_interface_hotrunner = parseValue(row[36]);
        machine.electrical_interface_ejector = parseValue(row[37]);
        machine.electrical_interface_corepull = parseValue(row[38]);
        machine.electrical_interface_robot = parseValue(row[39]);
        machine.iu1_screw_diameter_mm = parseValue(row[40]);
        machine.iu1_shot_volume_cm3 = parseValue(row[41]);
        machine.iu1_injection_flow_cm3s = parseValue(row[42]);
        machine.iu1_plasticizing_rate_gs = parseValue(row[43]);
        machine.iu1_ld_ratio = parseValue(row[44]);
        machine.iu1_injection_pressure_bar = parseValue(row[45]);
        machine.iu1_shot_weight_g = parseValue(row[46]);
        machine.iu1_screw_type = parseValue(row[47]);
        machine.iu1_nozzle = parseValue(row[48]);
        machine.iu2_screw_diameter_mm = parseValue(row[49]);
        machine.iu2_shot_volume_cm3 = parseValue(row[50]);
        machine.iu2_injection_flow_cm3s = parseValue(row[51]);
        machine.iu2_plasticizing_rate_gs = parseValue(row[52]);
        machine.iu2_ld_ratio = parseValue(row[53]);
        machine.iu2_injection_pressure_bar = parseValue(row[54]);
        machine.iu2_shot_weight_g = parseValue(row[55]);
        machine.iu2_screw_type = parseValue(row[56]);
        machine.iu2_nozzle = parseValue(row[57]);
        machine.robot_manufacturer = parseValue(row[58]);
        machine.robot_model = parseValue(row[59]);
        machine.robot_serial = parseValue(row[60]);
        machine.robot_vacuum_circuits = parseValue(row[61]);
        machine.remarks = parseValue(row[62]);
      }

      // Validate and coerce field types (numeric fields to numbers, boolean fields to booleans)
      validateAndCoerce(machine);

      // Remove null/undefined values to avoid INSERT errors
      Object.keys(machine).forEach(key => {
        if (machine[key] === null || machine[key] === undefined) {
          delete machine[key];
        }
      });

      machines.push(machine);
    }

    // Insert machines
    for (const machine of machines) {
      const columns = Object.keys(machine);
      const values = columns.map((col) => machine[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
      const columnNames = columns.join(',');

      try {
        await pool.query(`INSERT INTO machines (${columnNames}) VALUES (${placeholders})`, values);
      } catch (error) {
        console.error(`Error inserting machine ${machine.internal_name}:`, error);
      }
    }

    res.json({ message: `Imported ${machines.length} machines from Excel file` });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
