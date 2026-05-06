// HTTP-level round-trip test for machine lifecycle dates.
// Boots an Express app with the real machines router (auth bypassed)
// to confirm that POST → GET → PUT → GET persists in_service_from /
// planned_scrap_from end-to-end through validateAndCoerce, the
// lifecycle helpers, and the dynamic INSERT/UPDATE SQL.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import machinesRouter from '../routes/machines.js';
import pool from '../db/connection.js';

const app = express();
app.use(express.json());
// Bypass auth: inject a fake admin user.
app.use((req: any, _res, next) => {
  req.user = { userId: 1, username: 'test', role: 'master' };
  next();
});
app.use('/api/machines', machinesRouter);

const server = http.createServer(app);
await new Promise<void>(r => server.listen(0, r));
const port = (server.address() as any).port;

async function req(method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

after(async () => {
  await pool.query("DELETE FROM machine_revisions WHERE machine_id IN (SELECT id FROM machines WHERE internal_name LIKE 'TEST_LIFECYCLE_%')");
  await pool.query("DELETE FROM machines WHERE internal_name LIKE 'TEST_LIFECYCLE_%'");
  server.close();
  await pool.end();
});

test('POST persists in_service_from and planned_scrap_from', async () => {
  const r = await req('POST', '/api/machines', {
    internal_name: 'TEST_LIFECYCLE_POST',
    plant_location: 'USA',
    clamping_force_kn: 80,
    in_service_from: '2026-10-01',
    planned_scrap_from: '2030-06-01',
  });
  assert.equal(r.status, 201);
  const got = await pool.query('SELECT in_service_from, planned_scrap_from FROM machines WHERE id = $1', [r.body.id]);
  assert.equal(got.rows[0].in_service_from?.toISOString().slice(0, 10), '2026-10-01');
  assert.equal(got.rows[0].planned_scrap_from?.toISOString().slice(0, 10), '2030-06-01');
});

test('PUT sets in_service_from on a machine that had NULL', async () => {
  const created = await req('POST', '/api/machines', {
    internal_name: 'TEST_LIFECYCLE_PUT',
    plant_location: 'USA',
    clamping_force_kn: 80,
  });
  assert.equal(created.status, 201);

  const r = await req('PUT', `/api/machines/${created.body.id}`, {
    internal_name: 'TEST_LIFECYCLE_PUT',
    in_service_from: '2026-10-01',
  });
  assert.equal(r.status, 200);

  const got = await pool.query('SELECT in_service_from FROM machines WHERE id = $1', [created.body.id]);
  assert.equal(got.rows[0].in_service_from?.toISOString().slice(0, 10), '2026-10-01');
});

test('PUT rejects scrap-before-service with 400', async () => {
  const created = await req('POST', '/api/machines', {
    internal_name: 'TEST_LIFECYCLE_BAD_ORDER',
    plant_location: 'USA',
    clamping_force_kn: 80,
  });
  assert.equal(created.status, 201);

  const r = await req('PUT', `/api/machines/${created.body.id}`, {
    internal_name: 'TEST_LIFECYCLE_BAD_ORDER',
    in_service_from: '2026-10-01',
    planned_scrap_from: '2026-05-01',
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /must be after/);
});
