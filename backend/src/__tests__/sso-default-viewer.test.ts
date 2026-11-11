// Everyone who can log in at the hub reads MachineDB: no machinedb role -> viewer,
// machinedb_Admin -> master. Pure mapping, no database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapRoleToMachineDB } from '../middleware/sso-auth.js';

test('machinedb_Admin maps to master, also when listed after other roles', () => {
  assert.equal(mapRoleToMachineDB([{ name: 'machinedb_Admin', system: 'machinedb' }] as any), 'master');
  assert.equal(
    mapRoleToMachineDB([
      { name: 'twos_Viewer', system: 'twos' },
      { name: 'machinedb_Viewer', system: 'machinedb' },
      { name: 'machinedb_Admin', system: 'machinedb' },
    ] as any),
    'master',
  );
});

test('no machinedb role, or any non-admin machinedb role, is a viewer', () => {
  assert.equal(mapRoleToMachineDB([] as any), 'viewer');
  assert.equal(mapRoleToMachineDB(undefined as any), 'viewer');
  assert.equal(mapRoleToMachineDB([{ name: 'twos_Admin', system: 'twos' }] as any), 'viewer');
  assert.equal(mapRoleToMachineDB([{ name: 'machinedb_Viewer', system: 'machinedb' }] as any), 'viewer');
  assert.equal(mapRoleToMachineDB([{ name: 'machinedb_Operator', system: 'machinedb' }] as any), 'viewer');
});

test('an Admin role of another system does not make a MachineDB master', () => {
  assert.equal(mapRoleToMachineDB([{ name: 'machinedb_Admin', system: 'twos' }] as any), 'viewer');
});
