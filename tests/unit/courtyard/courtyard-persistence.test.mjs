import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createCourtyardPersistence } from '../../../apps/courtyard/courtyard-persistence.mjs';

const { createSectStorage } = createRequire(import.meta.url)('../../../apps/courtyard/sect-storage.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const world = tick => ({ state: { worldTick: tick, resources: { herb: 20 } }, route: [{ x: 1, y: 2 }] });

test('PERSIST-02: a real failed replacement preserves disk and memory until an explicit successful retry', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-protection-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let broken = false;
  const storage = createSectStorage({ directory,
    validate: value => Number.isSafeInteger(value?.state?.worldTick),
    io: { ...fs, rename: async (...args) => { if (broken) throw Error('disk full'); return fs.rename(...args); } }
  });
  const current = world(14), states = [];
  const persistence = createCourtyardPersistence({ getSnapshot: () => current, saveSnapshot: value => storage.save(value), onStateChange: s => states.push(s) });
  assert.equal((await persistence.save()).ok, true);
  const savedBytes = await fs.readFile(storage.filename);
  current.state.worldTick = 17; current.state.resources.herb = 12;
  const unsaved = structuredClone(current);
  broken = true;
  assert.equal((await persistence.save({ reason: 'auto' })).protected, true);
  assert.equal(persistence.status().lastSavedTick, 14);
  assert.deepEqual(await fs.readFile(storage.filename), savedBytes);
  assert.deepEqual(current, unsaved);
  for (const reason of ['auto', 'manual', 'closing']) assert.equal((await persistence.save({ reason })).protected, true);
  assert.equal((await persistence.retry()).ok, false);
  assert.equal(persistence.status().protected, true);
  broken = false;
  assert.equal((await persistence.save()).protected, true, 'ordinary save cannot silently resume after storage recovers');
  assert.deepEqual(await fs.readFile(storage.filename), savedBytes);
  assert.equal((await persistence.retry()).ok, true);
  assert.equal(persistence.status().protected, false);
  assert.equal(persistence.status().error, null);
  assert.deepEqual((await storage.load()).data, unsaved);
  assert.ok(states.some(s => s.protected));
  assert.equal(states.at(-1).pending, 0);
  assert.deepEqual(current, unsaved);
});

test('concurrent autosave/manual/close writes serialize and close captures the latest world', async () => {
  const gate = deferred(), entered = deferred(), current = world(1), writes = [];
  const persistence = createCourtyardPersistence({ getSnapshot: () => current, saveSnapshot: async snapshot => {
    writes.push(snapshot);
    if (writes.length === 1) { entered.resolve(); await gate.promise; }
    return { ok: true };
  } });
  const automatic = persistence.save({ reason: 'auto' });
  await entered.promise;
  assert.deepEqual(await persistence.save({ reason: 'auto' }), { ok: false, busy: true });
  const manual = persistence.save(), closing = persistence.save({ reason: 'closing' });
  current.state.worldTick = 5; current.route[0].x = 3;
  gate.resolve();
  assert.deepEqual((await Promise.all([automatic, manual, closing])).map(r => r.ok), [true, true, true]);
  await persistence.waitForIdle();
  assert.deepEqual(writes.map(w => w.state.worldTick), [1, 5, 5]);
  assert.equal(writes[0].route[0].x, 1, 'queued I/O never retains references into current memory');
  assert.equal(persistence.status().lastSavedTick, 5);
  assert.equal(persistence.status().pending, 0);
});

test('a failed in-flight autosave blocks queued manual and close writes instead of silently retrying', async () => {
  const gate = deferred(), entered = deferred(); let writes = 0;
  const persistence = createCourtyardPersistence({ getSnapshot: () => world(7), saveSnapshot: async () => {
    writes++; entered.resolve(); await gate.promise; throw Error('write interrupted');
  } });
  const automatic = persistence.save({ reason: 'auto' });
  await entered.promise;
  const manual = persistence.save(), close = persistence.save({ reason: 'closing' });
  gate.resolve();
  for (const result of await Promise.all([automatic, manual, close])) assert.equal(result.protected, true);
  await persistence.waitForIdle();
  assert.equal(writes, 1);
  assert.equal(persistence.status().pending, 0);
  assert.equal(persistence.status().saving, false);
  assert.equal(persistence.status().lastSavedTick, null);
});

test('recovery export captures unsaved memory once and never clears primary protection', async () => {
  const gate = deferred(), entered = deferred(), current = world(9); let exports = 0, exported;
  const persistence = createCourtyardPersistence({ getSnapshot: () => current,
    saveSnapshot: async () => ({ ok: false, error: 'permission denied' }),
    exportSnapshot: async snapshot => { exports++; exported = snapshot; entered.resolve(); await gate.promise; return { ok: true, path: '/selected/recovery.json' }; }
  });
  await persistence.save();
  const first = persistence.exportRecovery(), second = persistence.exportRecovery();
  assert.strictEqual(first, second);
  await entered.promise;
  current.state.worldTick = 10;
  gate.resolve();
  assert.equal((await first).ok, true);
  assert.equal(exports, 1);
  assert.equal(exported.state.worldTick, 9);
  assert.equal(persistence.status().protected, true);
  assert.equal(persistence.status().lastSavedTick, null);
  assert.equal(persistence.status().recoveryPath, '/selected/recovery.json');
  assert.equal(persistence.status().exporting, false);
});

test('cancelled or failed recovery export preserves the save error and never claims recovery success', async () => {
  let attempt = 0;
  const persistence = createCourtyardPersistence({ getSnapshot: () => world(8), saveSnapshot: async () => ({ ok: false, error: 'disk full' }),
    exportSnapshot: async () => { if (!attempt++) return { ok: false, cancelled: true }; throw Error('recovery destination failed'); }
  });
  await persistence.save();
  assert.deepEqual(await persistence.exportRecovery(), { ok: false, cancelled: true });
  assert.equal((await persistence.exportRecovery()).error, 'recovery destination failed');
  assert.equal(persistence.status().protected, true);
  assert.equal(persistence.status().error, 'disk full');
  assert.equal(persistence.status().recoveryExportedAt, null);
});

test('snapshot and host errors protect memory; view callback failure cannot turn a successful write into failure', async () => {
  let invalid = true, writes = 0;
  const persistence = createCourtyardPersistence({ getSnapshot: () => { if (invalid) throw Error('snapshot unavailable'); return world(11); },
    saveSnapshot: async () => { writes++; return { ok: true }; }, onStateChange: () => { throw Error('display unavailable'); }
  });
  assert.equal((await persistence.save()).protected, true);
  assert.equal(writes, 0);
  invalid = false;
  assert.equal((await persistence.retry()).ok, true);
  assert.equal(writes, 1);
  assert.equal(persistence.status().protected, false);
  assert.equal(persistence.status().lastSavedTick, 11);
});

test('owned detached snapshots retain execution-time queue capture and world isolation', async () => {
  const gate = deferred(), entered = deferred(), current = world(1), produced = [], writes = [];
  const persistence = createCourtyardPersistence({ snapshotOwnership: 'owned',
    getSnapshot: () => { const snapshot = structuredClone(current); produced.push(snapshot); return snapshot; },
    saveSnapshot: async snapshot => {
      assert.strictEqual(snapshot, produced.at(-1), 'the detached producer transfers this snapshot without a second copy');
      writes.push(snapshot);
      if (writes.length === 1) { entered.resolve(); await gate.promise; }
      return { ok: true };
    }
  });
  const automatic = persistence.save({ reason: 'auto' });
  await entered.promise;
  const manual = persistence.save(), closing = persistence.save({ reason: 'closing' });
  current.state.worldTick = 5; current.route[0].x = 3;
  assert.equal(writes[0].state.worldTick, 1);
  gate.resolve();
  assert.deepEqual((await Promise.all([automatic, manual, closing])).map(r => r.ok), [true, true, true]);
  assert.deepEqual(writes.map(w => w.state.worldTick), [1, 5, 5]);
  assert.equal(writes[0].route[0].x, 1);
  assert.equal(persistence.status().lastSavedTick, 5);
});

test('owned serialization failure protects the primary save and recovery export still copies', async () => {
  const current = world(8), detached = structuredClone(current); let writes = 0, exported;
  const persistence = createCourtyardPersistence({ snapshotOwnership: 'owned', getSnapshot: () => detached,
    saveSnapshot: async () => { writes++; throw Error('serialization failed'); },
    exportSnapshot: async snapshot => { exported = snapshot; return { ok: true, path: '/selected/recovery.json' }; }
  });
  assert.equal((await persistence.save()).protected, true);
  assert.equal((await persistence.save({ reason: 'closing' })).protected, true);
  assert.equal(writes, 1);
  assert.equal((await persistence.exportRecovery()).ok, true);
  assert.notStrictEqual(exported, detached, 'recovery export retains its defensive copy contract');
  detached.state.worldTick = 9;
  assert.equal(exported.state.worldTick, 8);
  assert.equal(persistence.status().protected, true);
  assert.deepEqual(current, world(8));
  assert.throws(() => createCourtyardPersistence({ getSnapshot: () => current, saveSnapshot: () => ({}), snapshotOwnership: 'unknown' }), /ownership/);
});
