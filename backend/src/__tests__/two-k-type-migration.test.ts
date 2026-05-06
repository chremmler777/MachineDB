import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db/connection.js';

before(async () => {
  const { runMigrations } = await import('../db/migrate.js');
  await runMigrations();
});

test('two_k_type migration: adds two_k_type column with check constraint', async () => {
  const res = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name='machines' AND column_name='two_k_type'`);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].data_type, 'text');
});

test('two_k_type migration: rejects invalid two_k_type values', async () => {
  await assert.rejects(
    pool.query(`UPDATE machines SET two_k_type='invalid' WHERE id=(SELECT id FROM machines LIMIT 1)`),
  );
});

test('two_k_type migration: renames clamping_force_t to clamping_force_t', async () => {
  const res = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='machines' AND column_name IN ('clamping_force_t','clamping_force_t')`);
  const names = res.rows.map((r: { column_name: string }) => r.column_name);
  assert.ok(names.includes('clamping_force_t'), 'expected clamping_force_t to exist');
  assert.ok(!names.includes('clamping_force_t'), 'expected clamping_force_t to be gone');
});

test('two_k_type migration: backfills MX Arburg 220T cohort to 2k_no_turntable', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type, is_2k FROM machines
    WHERE internal_name IN ('M01','M02','M03','M04','M12','M13','M14','M23')
    ORDER BY internal_name`);
  assert.equal(res.rows.length, 8);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, '2k_no_turntable');
    assert.equal(row.is_2k, true);
  }
});

test('two_k_type migration: backfills US KM 350-4/550/1300/1600 cohort to 2k_no_turntable', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type FROM machines
    WHERE internal_name IN ('KM 350-4','KM 550-1','KM 550-2','KM 1300-1','KM 1300-2','KM 1300-3','KM 1600-1','KM 1600-2')
    ORDER BY internal_name`);
  assert.equal(res.rows.length, 8);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, '2k_no_turntable');
  }
});

test('two_k_type migration: backfills MX Sumitomo 280 + Nissei DCX600/800 to parallel_injection', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type FROM machines
    WHERE internal_name IN ('M27','M8','M19') ORDER BY internal_name`);
  assert.equal(res.rows.length, 3);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, 'parallel_injection');
  }
});

test('two_k_type migration: backfills US KM 1000T to 2k_turntable', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type FROM machines
    WHERE internal_name IN ('KM 1000-1','KM 1000-2','KM 1000-3') ORDER BY internal_name`);
  assert.equal(res.rows.length, 3);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, '2k_turntable');
  }
});

test('two_k_type migration: leaves KM 350-1/-2/-3 as null (1K)', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type FROM machines
    WHERE internal_name IN ('KM 350-1','KM 350-2','KM 350-3')`);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, null);
  }
});

test('two_k_type migration: leaves M28/M29 as null (1K despite NEX360 model)', async () => {
  const res = await pool.query(`
    SELECT internal_name, two_k_type FROM machines
    WHERE internal_name IN ('M28','M29')`);
  for (const row of res.rows) {
    assert.equal(row.two_k_type, null);
  }
});

test('two_k_type migration: keeps is_2k in sync with two_k_type', async () => {
  const res = await pool.query(`SELECT id, two_k_type, is_2k FROM machines`);
  for (const row of res.rows) {
    assert.equal(row.is_2k, row.two_k_type !== null);
  }
});

test('two_k_type migration: creates idx_machines_two_k_type partial index', async () => {
  const res = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename='machines' AND indexname='idx_machines_two_k_type'`);
  assert.equal(res.rows.length, 1);
});
