// HTTP test for /v1/machines two_k_type + filter params.
// Boots Express with the real v1-machines router behind serviceAuth,
// using the dev-env MACHINEDB_SERVICE_TOKEN for bearer auth.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import v1MachinesRouter from '../routes/v1-machines.js';
import { serviceAuth } from '../middleware/service-auth.js';
import pool from '../db/connection.js';

const TOKEN = process.env.MACHINEDB_SERVICE_TOKEN;
if (!TOKEN) {
  throw new Error('MACHINEDB_SERVICE_TOKEN must be set in env for this test');
}

const app = express();
app.use(express.json());
app.use('/v1', serviceAuth, v1MachinesRouter);

const server = http.createServer(app);
await new Promise<void>(r => server.listen(0, r));
const port = (server.address() as any).port;

async function get(path: string, withAuth = true): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: withAuth ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

after(async () => {
  await pool.query("DELETE FROM machines WHERE internal_name = 'TEST-NULL-IU2'");
  server.close();
  await pool.end();
});

test('GET /v1/machines returns two_k_type and clamping_force_t', async () => {
  const r = await get('/v1/machines');
  assert.equal(r.status, 200);
  const m27 = r.body.find((m: any) => m.internal_name === 'M27');
  assert.ok(m27, 'expected M27 in response');
  assert.equal(m27.two_k_type, 'parallel_injection');
  assert.equal(parseFloat(m27.clamping_force_t), 280);
  assert.equal(m27.injection_units, 2);
});

test('GET /v1/machines?two_k_type=parallel_injection filters correctly', async () => {
  const r = await get('/v1/machines?two_k_type=parallel_injection');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0);
  for (const m of r.body) {
    assert.equal(m.two_k_type, 'parallel_injection');
  }
  const names = new Set(r.body.map((m: any) => m.internal_name));
  for (const expected of ['M27', 'M8', 'M19']) {
    assert.ok(names.has(expected), `expected ${expected} in parallel_injection set`);
  }
});

test('GET /v1/machines?two_k_type=null returns only 1K machines', async () => {
  const r = await get('/v1/machines?two_k_type=null');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0);
  for (const m of r.body) {
    assert.equal(m.two_k_type, null);
  }
});

test('min_barrel_2_g excludes rows with NULL iu2_shot_weight_g (strict null)', async () => {
  // Insert synthetic 2K machine with no iu2_shot_weight_g
  await pool.query(
    `INSERT INTO machines (internal_name, manufacturer, model, plant_location, two_k_type, clamping_force_t, is_2k)
     VALUES ('TEST-NULL-IU2', 'TEST', 'TEST', 'Mexico', 'parallel_injection', 500, true)`,
  );
  try {
    const r = await get('/v1/machines?two_k_type=parallel_injection&min_barrel_2_g=100');
    assert.equal(r.status, 200);
    const found = r.body.find((m: any) => m.internal_name === 'TEST-NULL-IU2');
    assert.equal(found, undefined, 'synthetic NULL-iu2 row must not pass min_barrel_2_g filter');
  } finally {
    await pool.query("DELETE FROM machines WHERE internal_name = 'TEST-NULL-IU2'");
  }
});

test('site=US&min_tonnage=950&max_tonnage=1050 returns the three KM 1000 machines', async () => {
  const r = await get('/v1/machines?site=US&min_tonnage=950&max_tonnage=1050');
  assert.equal(r.status, 200);
  const names = r.body.map((m: any) => m.internal_name).sort();
  assert.deepEqual(names, ['KM 1000-1', 'KM 1000-2', 'KM 1000-3']);
});

test('GET /v1/machines?two_k_type=bogus returns 400', async () => {
  const r = await get('/v1/machines?two_k_type=bogus');
  assert.equal(r.status, 400);
});
