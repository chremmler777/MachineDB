// HTTP test for GET /v1/capacity with group_by=two_k_type rollup.
// Boots Express with the real v1-capacity router behind serviceAuth.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import v1CapacityRouter from '../routes/v1-capacity.js';
import { serviceAuth } from '../middleware/service-auth.js';
import pool from '../db/connection.js';

const TOKEN = process.env.MACHINEDB_SERVICE_TOKEN;
if (!TOKEN) {
  throw new Error('MACHINEDB_SERVICE_TOKEN must be set in env for this test');
}

const app = express();
app.use(express.json());
app.use('/v1/capacity', serviceAuth, v1CapacityRouter);

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
  server.close();
  await pool.end();
});

test('GET /v1/capacity?group_by=two_k_type&year=2027 returns rollups array', async () => {
  const r = await get('/v1/capacity?group_by=two_k_type&year=2027');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.rollups), 'rollups should be array');
  assert.ok(r.body.rollups.length > 0, 'rollups should be non-empty');

  for (const entry of r.body.rollups) {
    assert.ok(entry.site === 'US' || entry.site === 'MX', `unexpected site: ${entry.site}`);
    assert.equal(typeof entry.machine_count, 'number');
    assert.equal(typeof entry.available_machine_years, 'number');
    assert.ok(
      entry.two_k_type === null ||
        ['2k_turntable', '2k_no_turntable', 'parallel_injection'].includes(entry.two_k_type),
      `unexpected two_k_type: ${entry.two_k_type}`,
    );
  }
});

test('US 2k_turntable rollup has machine_count === 3 (KM 1000-1/-2/-3) for 2027', async () => {
  const r = await get('/v1/capacity?group_by=two_k_type&year=2027');
  assert.equal(r.status, 200);
  const usTurntable = r.body.rollups.find(
    (e: any) => e.site === 'US' && e.two_k_type === '2k_turntable',
  );
  assert.ok(usTurntable, 'expected US 2k_turntable rollup entry');
  assert.equal(usTurntable.machine_count, 3);
});

test('MX null bucket exists with machine_count > 0', async () => {
  const r = await get('/v1/capacity?group_by=two_k_type&year=2027');
  assert.equal(r.status, 200);
  const mxNull = r.body.rollups.find(
    (e: any) => e.site === 'MX' && e.two_k_type === null,
  );
  assert.ok(mxNull, 'expected MX null rollup entry');
  assert.ok(mxNull.machine_count > 0, 'MX null bucket should have machines');
});

test('per-machine machines[] is preserved when group_by=two_k_type', async () => {
  const r = await get('/v1/capacity?group_by=two_k_type&year=2027');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.machines), 'machines should be array');
  assert.ok(r.body.machines.length > 0, 'machines should be non-empty');
  // each entry should expose two_k_type so RFQ can read it
  const m = r.body.machines[0];
  assert.ok('two_k_type' in m, 'machine entry should include two_k_type');
  assert.ok('site' in m, 'machine entry should include site');
  assert.ok('available_fraction' in m, 'machine entry should include available_fraction');
});

test('GET /v1/capacity without group_by returns machines list (default shape)', async () => {
  const r = await get('/v1/capacity?year=2027');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.machines));
  assert.equal(r.body.rollups, undefined, 'rollups should not be present without group_by');
});
