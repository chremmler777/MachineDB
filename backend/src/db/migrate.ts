import pool from './connection.js';
import bcrypt from 'bcrypt';

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    plant VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Machines table
  `CREATE TABLE IF NOT EXISTS machines (
    id SERIAL PRIMARY KEY,
    internal_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    order_number VARCHAR(255),
    year_of_construction INTEGER,
    plant_location VARCHAR(100),

    -- Dimensions
    length_mm DECIMAL(10,2),
    width_mm DECIMAL(10,2),
    height_mm DECIMAL(10,2),
    weight_kg DECIMAL(10,2),

    -- Clamping Unit
    clamping_force_kn DECIMAL(10,2),
    centering_ring_nozzle_mm DECIMAL(10,2),
    centering_ring_ejector_mm DECIMAL(10,2),
    fine_centering BOOLEAN,
    mold_height_min_mm DECIMAL(10,2),
    mold_height_max_mm DECIMAL(10,2),
    opening_stroke_mm DECIMAL(10,2),
    clearance_horizontal_mm DECIMAL(10,2),
    clearance_vertical_mm DECIMAL(10,2),
    rotary_table BOOLEAN,
    max_weight_nozzle_kg DECIMAL(10,2),
    max_weight_ejector_kg DECIMAL(10,2),

    -- Tool Connections
    temperature_control_circuits INTEGER,
    cascade_count INTEGER,
    hot_runner_integrated BOOLEAN,
    hot_runner_external BOOLEAN,
    core_pulls_nozzle INTEGER,
    core_pulls_ejector INTEGER,
    pneumatic_nozzle BOOLEAN,
    pneumatic_ejector BOOLEAN,

    -- Ejector
    ejector_stroke_mm DECIMAL(10,2),
    ejector_thread VARCHAR(100),
    ejector_max_travel_mm DECIMAL(10,2),

    -- Interfaces
    mechanical_interface_tool VARCHAR(255),
    mechanical_interface_robot VARCHAR(255),
    electrical_interface_tool VARCHAR(255),
    electrical_interface_hotrunner VARCHAR(255),
    electrical_interface_ejector VARCHAR(255),
    electrical_interface_corepull VARCHAR(255),
    electrical_interface_robot VARCHAR(255),

    -- Injection Unit 1
    iu1_screw_diameter_mm DECIMAL(10,2),
    iu1_shot_volume_cm3 DECIMAL(10,2),
    iu1_injection_flow_cm3s DECIMAL(10,2),
    iu1_plasticizing_rate_gs DECIMAL(10,2),
    iu1_ld_ratio DECIMAL(10,2),
    iu1_injection_pressure_bar DECIMAL(10,2),
    iu1_shot_weight_g DECIMAL(10,2),
    iu1_screw_type VARCHAR(255),
    iu1_nozzle VARCHAR(255),

    -- Injection Unit 2
    iu2_screw_diameter_mm DECIMAL(10,2),
    iu2_shot_volume_cm3 DECIMAL(10,2),
    iu2_injection_flow_cm3s DECIMAL(10,2),
    iu2_plasticizing_rate_gs DECIMAL(10,2),
    iu2_ld_ratio DECIMAL(10,2),
    iu2_injection_pressure_bar DECIMAL(10,2),
    iu2_shot_weight_g DECIMAL(10,2),
    iu2_screw_type VARCHAR(255),
    iu2_nozzle VARCHAR(255),

    -- Robot
    robot_manufacturer VARCHAR(255),
    robot_model VARCHAR(255),
    robot_serial VARCHAR(255),
    robot_vacuum_circuits INTEGER,
    robot_air_circuits INTEGER,
    robot_electrical_signals INTEGER,

    -- Meta
    special_controls TEXT,
    mucell BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
  )`,

  // Revisions table
  `CREATE TABLE IF NOT EXISTS machine_revisions (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_type VARCHAR(50) NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    change_summary TEXT
  )`,

  // Files table
  `CREATE TABLE IF NOT EXISTS machine_files (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
  )`,

  // Add suspicious_fields column (idempotent)
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS suspicious_fields JSONB DEFAULT '[]'`,

  // Platen sketch fields (for 2D overlay vs RFQ tool footprint)
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS platen_horizontal_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS platen_vertical_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS min_mold_horizontal_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS min_mold_vertical_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS bolt_pattern_json JSONB`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS tiebar_diameter_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS ejector_hole_diameter_mm DECIMAL(10,2)`,
  `ALTER TABLE machines ADD COLUMN IF NOT EXISTS knockout_pattern_json JSONB`,

  // Comments table
  `CREATE TABLE IF NOT EXISTS machine_comments (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Preserve deletion revisions: drop ON DELETE CASCADE on machine_revisions.machine_id,
  // allow machine_id to go NULL when the parent machine is deleted. This keeps the
  // audit trail (previous_data, change_summary) after a machine is removed.
  `ALTER TABLE machine_revisions ALTER COLUMN machine_id DROP NOT NULL`,
  `ALTER TABLE machine_revisions DROP CONSTRAINT IF EXISTS machine_revisions_machine_id_fkey`,
  `ALTER TABLE machine_revisions ADD CONSTRAINT machine_revisions_machine_id_fkey
     FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL`,

  // Create indices
  `CREATE INDEX IF NOT EXISTS idx_machines_plant ON machines(plant_location)`,
  `CREATE INDEX IF NOT EXISTS idx_machines_manufacturer ON machines(manufacturer)`,
  `CREATE INDEX IF NOT EXISTS idx_revisions_machine ON machine_revisions(machine_id)`,
  `CREATE INDEX IF NOT EXISTS idx_files_machine ON machine_files(machine_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_machine ON machine_comments(machine_id)`,

  // IM Capacity — capability flags (Phase 1)
  `ALTER TABLE machines
     ADD COLUMN IF NOT EXISTS is_2k BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS has_mucell BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS has_variotherm BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS tonnage_class TEXT`,

  // Backfill tonnage_class label from clamping_force_kn (kN → t bucket label)
  `UPDATE machines SET tonnage_class =
     CASE
       WHEN clamping_force_kn IS NULL THEN NULL
       WHEN clamping_force_kn / 9.80665 < 100  THEN '80T'
       WHEN clamping_force_kn / 9.80665 < 250  THEN '200T'
       WHEN clamping_force_kn / 9.80665 < 450  THEN '350T'
       WHEN clamping_force_kn / 9.80665 < 600  THEN '550T'
       WHEN clamping_force_kn / 9.80665 < 750  THEN '650T'
       WHEN clamping_force_kn / 9.80665 < 950  THEN '900T'
       WHEN clamping_force_kn / 9.80665 < 1150 THEN '1000T'
       WHEN clamping_force_kn / 9.80665 < 1450 THEN '1300T'
       WHEN clamping_force_kn / 9.80665 < 1950 THEN '1600T'
       WHEN clamping_force_kn / 9.80665 < 2750 THEN '2300T'
       ELSE '3200T'
     END
     WHERE tonnage_class IS NULL`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const migration of migrations) {
      await client.query(migration);
      console.log('✓ Migration applied');
    }
    console.log('✓ All migrations completed');

    // Seed users if they don't exist
    const userCheckResult = await client.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCheckResult.rows[0].count);

    if (userCount === 0) {
      const masterPasswordHash = await bcrypt.hash('master123', 10);
      const viewerPasswordHash = await bcrypt.hash('viewer123', 10);

      await client.query(
        'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
        ['master', masterPasswordHash, 'master', 'USA']
      );

      await client.query(
        'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
        ['viewer_usa', viewerPasswordHash, 'viewer', 'USA']
      );

      await client.query(
        'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
        ['viewer_mexico', viewerPasswordHash, 'viewer', 'Mexico']
      );

      console.log('✓ Users seeded successfully');
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
