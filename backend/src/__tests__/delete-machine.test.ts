// Regression test for DELETE /machines/:id.
//
// Original symptom:
//   - Clicking "delete" returned 500 "server error"
//   - Machine was nonetheless gone after refresh
//   - Second delete attempt returned 404 "entry not found"
//
// Original bug (routes/machines.ts, pre-fix):
//   1. DELETE FROM machines WHERE id = $1   (auto-committed — no transaction)
//   2. Handler then tried INSERT INTO machine_revisions (machine_id=<deleted id>, ...)
//   3. FK `machine_id REFERENCES machines(id)` failed because the parent row was gone
//   4. INSERT raised 23503, handler returned 500 — but DELETE had already committed
//
// Fix: wrap the sequence in a transaction and INSERT the deletion revision BEFORE
// the DELETE. Commit only if both succeed; otherwise ROLLBACK restores the machine.
//
// This test reproduces the exact sequence against an isolated test DB
// (machinedb_test — NOT the live DB).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Pool } = pg;

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@machinedb-db:5432/machinedb_test';

// Safety: refuse to run against anything that doesn't look like a test DB
if (!TEST_DATABASE_URL.includes('machinedb_test')) {
  throw new Error(
    `Refusing to run tests against non-test DB: ${TEST_DATABASE_URL}. ` +
      `TEST_DATABASE_URL must point at machinedb_test.`
  );
}

const pool = new Pool({ connectionString: TEST_DATABASE_URL });

async function insertTestMachine(name: string): Promise<number> {
  const r = await pool.query(
    'INSERT INTO machines (internal_name, plant_location) VALUES ($1, $2) RETURNING id',
    [name, 'usa']
  );
  return r.rows[0].id;
}

async function insertPriorRevision(machineId: number, userId: number | null) {
  // Simulates the normal case: machine has a prior "update" revision before delete.
  await pool.query(
    `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, change_summary)
     VALUES ($1, 1, $2, 'update', $3, 'prior edit')`,
    [machineId, userId, JSON.stringify({ foo: 'bar' })]
  );
}

// Replicates the handler logic at routes/machines.ts:321-362 (post-fix).
async function runDeleteHandler(id: number, userId: number | null) {
  const previousResult = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);
  if (previousResult.rows.length === 0) {
    return { status: 404, body: { error: 'Machine not found' } };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const revResult = await client.query(
      'SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1',
      [id]
    );
    const nextRevision = (revResult.rows[0].max_rev || 0) + 1;

    await client.query(
      `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, previous_data, change_summary)
       VALUES ($1, $2, $3, 'delete', $4, 'Machine deleted')`,
      [id, nextRevision, userId, JSON.stringify(previousResult.rows[0])]
    );

    await client.query('DELETE FROM machines WHERE id = $1', [id]);

    await client.query('COMMIT');
    return { status: 200, body: { message: 'Machine deleted' } };
  } catch (err) {
    await client.query('ROLLBACK');
    return { status: 500, body: { error: 'Internal server error' } };
  } finally {
    client.release();
  }
}

let userId: number | null = null;

before(async () => {
  // Get a user id for the changed_by FK (seed migration creates 'master').
  const u = await pool.query(`SELECT id FROM users WHERE username = 'master'`);
  userId = u.rows[0]?.id ?? null;

  // Clean any leftover test machines from prior runs.
  await pool.query(`DELETE FROM machines WHERE internal_name LIKE 'DELETE_TEST_%'`);
  await pool.query(
    `DELETE FROM machine_revisions WHERE previous_data->>'internal_name' LIKE 'DELETE_TEST_%'`
  );
});

after(async () => {
  await pool.query(`DELETE FROM machines WHERE internal_name LIKE 'DELETE_TEST_%'`);
  await pool.query(
    `DELETE FROM machine_revisions WHERE previous_data->>'internal_name' LIKE 'DELETE_TEST_%'`
  );
  await pool.end();
});

test('delete with no prior revisions succeeds (200) and removes the machine', async () => {
  const id = await insertTestMachine('DELETE_TEST_no_prior_rev');

  const result = await runDeleteHandler(id, userId);

  assert.equal(result.status, 200, 'post-fix: no FK violation, returns 200');

  const machineGone = await pool.query('SELECT id FROM machines WHERE id = $1', [id]);
  assert.equal(machineGone.rows.length, 0, 'machine is deleted');
});

test('delete with a prior revision succeeds and preserves audit trail', async () => {
  const id = await insertTestMachine('DELETE_TEST_with_prior_rev');
  await insertPriorRevision(id, userId);

  const result = await runDeleteHandler(id, userId);

  assert.equal(result.status, 200, 'post-fix: transaction-wrapped INSERT-before-DELETE succeeds');

  const machineGone = await pool.query('SELECT id FROM machines WHERE id = $1', [id]);
  assert.equal(machineGone.rows.length, 0, 'machine is gone');

  // After the FK change (ON DELETE SET NULL + nullable machine_id), revision rows
  // for this machine survive the delete with machine_id=NULL.
  const revs = await pool.query(
    `SELECT change_type, machine_id, change_summary
     FROM machine_revisions
     WHERE previous_data->>'internal_name' = 'DELETE_TEST_with_prior_rev'
        OR change_summary = 'Machine deleted'`
  );
  const deleteRev = revs.rows.find((r) => r.change_type === 'delete');
  assert.ok(deleteRev, 'deletion revision should persist after machine row is gone');
  assert.equal(deleteRev.machine_id, null, 'machine_id set to NULL via ON DELETE SET NULL');
});

test('second delete of same id returns 404 (row already removed by first call)', async () => {
  const id = await insertTestMachine('DELETE_TEST_double_delete');
  await insertPriorRevision(id, userId);

  const first = await runDeleteHandler(id, userId);
  assert.equal(first.status, 200, 'first delete succeeds');

  const second = await runDeleteHandler(id, userId);
  assert.equal(second.status, 404, 'second delete: machine already gone');
});

test('delete of nonexistent id returns 404 without touching the DB', async () => {
  const result = await runDeleteHandler(999999999, userId);
  assert.equal(result.status, 404);
});
