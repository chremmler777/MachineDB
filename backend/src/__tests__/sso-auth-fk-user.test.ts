// Regression test for the SSO write bug:
//   "Internal server error" on any MachineDB write when logged in via AdminPanel SSO.
//
// Root cause: the JWT `sub` is an AdminPanel user id, from a different id space than
// MachineDB's local `users` table. Writing it straight into created_by/updated_by
// (FK -> users(id)) throws a foreign-key violation -> 500 whenever the SSO id isn't
// coincidentally one of the 3 seeded local ids (1/2/3).
//
// The fix: ssoAuth mirrors the SSO identity into local `users` keyed by username and
// sets req.user.userId to the LOCAL id, so FK columns stay valid.
//
// This test boots the REAL ssoAuth middleware + machines router (as production wires
// them) and drives a write as an SSO user whose `sub` does NOT exist locally.
// Needs a live test DB (DATABASE_URL) + migrations, like the other __tests__.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { ssoAuth } from '../middleware/sso-auth.js';
import machinesRouter from '../routes/machines.js';
import pool from '../db/connection.js';

// An AdminPanel user id that is NOT a local users.id (local seed is 1/2/3).
const EXTERNAL_SUB = '987654';
const EXTERNAL_USERNAME = 'sso_fk_regression_user';

const token = jwt.sign(
  {
    sub: EXTERNAL_SUB,
    username: EXTERNAL_USERNAME,
    roles: [{ name: 'machinedb_Admin', system: 'machinedb' }],
  },
  process.env.JWT_SECRET as string,
  { expiresIn: '1h' }
);

const app = express();
app.use(express.json());
// Production wiring: ssoAuth runs first, then the router (whose verifyToken passes
// through because req.user is already set).
app.use('/api/machines', ssoAuth, machinesRouter);

const server = http.createServer(app);

before(async () => {
  const { runMigrations } = await import('../db/migrate.js');
  await runMigrations();
  await new Promise<void>((r) => server.listen(0, r));
});

after(async () => {
  await pool.query("DELETE FROM machine_revisions WHERE machine_id IN (SELECT id FROM machines WHERE internal_name = 'TEST_SSO_FK')");
  await pool.query("DELETE FROM machines WHERE internal_name = 'TEST_SSO_FK'");
  await pool.query('DELETE FROM users WHERE username = $1', [EXTERNAL_USERNAME]);
  server.close();
  await pool.end();
});

function post(path: string, body: any): Promise<{ status: number; body: any }> {
  return fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.text().then((t) => (t ? JSON.parse(t) : null)) }));
}

test('SSO write with a non-local sub succeeds (no FK 500) and attributes to a local user', async () => {
  const r = await post('/api/machines', {
    internal_name: 'TEST_SSO_FK',
    plant_location: 'USA',
    clamping_force_t: 80,
  });

  // Before the fix this was 500 (foreign_key_violation on created_by).
  assert.equal(r.status, 201);

  // created_by must reference a real local users row keyed by the SSO username,
  // NOT the raw AdminPanel sub.
  const localUser = await pool.query('SELECT id FROM users WHERE username = $1', [EXTERNAL_USERNAME]);
  assert.equal(localUser.rows.length, 1, 'a local user row was created for the SSO identity');
  assert.notEqual(localUser.rows[0].id, Number(EXTERNAL_SUB), 'local id is not the AdminPanel sub');
  assert.equal(r.body.created_by, localUser.rows[0].id, 'created_by points at the local user id');
});
