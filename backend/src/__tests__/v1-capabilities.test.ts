// HTTP test for /v1/machine-capabilities/two-k-types vocabulary endpoint.
// Boots Express with the v1-capabilities router behind serviceAuth.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import v1CapabilitiesRouter from '../routes/v1-capabilities.js';
import { serviceAuth } from '../middleware/service-auth.js';

const TOKEN = process.env.MACHINEDB_SERVICE_TOKEN;
if (!TOKEN) {
  throw new Error('MACHINEDB_SERVICE_TOKEN must be set in env for this test');
}

const app = express();
app.use(express.json());
app.use('/v1/machine-capabilities', serviceAuth, v1CapabilitiesRouter);

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

after(() => {
  server.close();
});

test('GET /v1/machine-capabilities/two-k-types returns 3 entries with value/label/description', async () => {
  const r = await get('/v1/machine-capabilities/two-k-types');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.two_k_types));
  assert.equal(r.body.two_k_types.length, 3);
  for (const entry of r.body.two_k_types) {
    assert.equal(typeof entry.value, 'string');
    assert.ok(entry.value.length > 0);
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.length > 0);
    assert.equal(typeof entry.description, 'string');
    assert.ok(entry.description.length > 0);
  }
  const values = r.body.two_k_types.map((e: any) => e.value).sort();
  assert.deepEqual(values, ['2k_no_turntable', '2k_turntable', 'parallel_injection']);
});

test('GET /v1/machine-capabilities/two-k-types without service token returns 401', async () => {
  const r = await get('/v1/machine-capabilities/two-k-types', false);
  assert.equal(r.status, 401);
});

test('GET /v1/machine-capabilities/two-k-types matches contract fixture exactly', async () => {
  const fixturePath = path.resolve(
    process.cwd(),
    '../docs/contracts/rfq/two-k-vocabulary.json',
  );
  // The backend container mounts /app, so cwd is /app — fixture lives outside.
  // Try multiple locations to find the fixture.
  const candidates = [
    fixturePath,
    path.resolve(process.cwd(), 'docs/contracts/rfq/two-k-vocabulary.json'),
    '/app/docs/contracts/rfq/two-k-vocabulary.json',
    '/home/nitrolinux/claude/machinedb/docs/contracts/rfq/two-k-vocabulary.json',
  ];
  let fixtureRaw: string | null = null;
  for (const p of candidates) {
    try {
      fixtureRaw = fs.readFileSync(p, 'utf8');
      break;
    } catch {}
  }
  if (!fixtureRaw) throw new Error('Could not locate two-k-vocabulary.json fixture');
  const fixture = JSON.parse(fixtureRaw);
  delete fixture._comment;

  const r = await get('/v1/machine-capabilities/two-k-types');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { two_k_types: fixture.two_k_types });
});
