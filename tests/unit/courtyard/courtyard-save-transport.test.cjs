const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createSectStorage, MAX_SAVE_BYTES } = require('../../../apps/courtyard/sect-storage.cjs');
const { saveSerializedSect } = require('../../../apps/courtyard/courtyard-save-transport.cjs');
const world = tick => ({ version: 2, state: { worldTick: tick, person: { id: 'person:master', hp: 100 } }, courtyardPresentation: { manualPause: true } });
const valid = value => value?.version === 2 && Number.isSafeInteger(value?.state?.worldTick);
async function storage(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-text-save-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return createSectStorage({ directory, validate: valid, ...options });
}

test('serialized transport retains exact bytes and both existing storage validations', async t => {
  const checked = [], disk = await storage(t, { validate: value => { checked.push(structuredClone(value)); return valid(value); } }), snapshot = world(31);
  assert.equal((await disk.save(snapshot)).ok, true);
  const before = await fs.readFile(disk.filename);
  checked.length = 0;
  const serialized = JSON.stringify(snapshot);
  snapshot.state.worldTick = 99;
  assert.equal((await saveSerializedSect(disk, serialized)).ok, true);
  assert.equal(checked.length, 2, 'original pre-write and JSON-roundtrip checks both execute');
  assert.deepEqual(checked, [world(31), world(31)]);
  assert.deepEqual(await fs.readFile(disk.filename), before);
  assert.deepEqual((await disk.load()).data, world(31));
});

test('wrong types, malformed JSON, UTF-8 byte overflow and invalid worlds preserve the last good file', async t => {
  const disk = await storage(t);
  await disk.save(world(4));
  const before = await fs.readFile(disk.filename);
  for (const value of [null, {}, '{broken', '"'+ '界'.repeat(Math.floor(MAX_SAVE_BYTES / 3) + 1) +'"', JSON.stringify({ version: 999 })]) {
    assert.equal((await saveSerializedSect(disk, value)).ok, false);
    assert.deepEqual(await fs.readFile(disk.filename), before);
  }
  assert.equal((await saveSerializedSect(disk, JSON.stringify(world(5)))).ok, true);
  assert.equal((await disk.load()).data.state.worldTick, 5);
});

test('serialized writes share the original storage queue and atomic failure protection', async t => {
  let fail = false, release, enter;
  const gate = new Promise(r => { release = r; }), entered = new Promise(r => { enter = r; });
  const disk = await storage(t, { validate: async value => { if (value.state?.worldTick === 2) { enter(); await gate; } return valid(value); },
    io: { ...fs, rename: async (...args) => { if (fail) throw Error('disk full'); return fs.rename(...args); } }
  });
  await disk.save(world(1));
  const first = saveSerializedSect(disk, JSON.stringify(world(2)));
  await entered;
  const second = saveSerializedSect(disk, JSON.stringify(world(3)));
  release();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.ok), [true, true]);
  assert.equal((await disk.load()).data.state.worldTick, 3);
  const before = await fs.readFile(disk.filename); fail = true;
  assert.equal((await saveSerializedSect(disk, JSON.stringify(world(4)))).ok, false);
  assert.deepEqual(await fs.readFile(disk.filename), before);
});

test('preload keeps the object/recovery APIs and exposes only the fixed text channel', async () => {
  const exposed = {}, calls = [];
  const code = await fs.readFile(path.resolve(__dirname, '../../../apps/courtyard/courtyard-preload.cjs'), 'utf8');
  vm.runInNewContext(code, { require: name => { assert.equal(name, 'electron'); return {
    contextBridge: { exposeInMainWorld: (name, api) => { exposed[name] = api; } },
    ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve({ ok: true }); }, on() {}, removeListener() {} }
  }; } });
  const snapshot = world(9), text = JSON.stringify(snapshot);
  await exposed.sectHost.save(snapshot); await exposed.sectHost.saveSerialized(text); await exposed.sectHost.exportRecovery(snapshot);
  assert.equal(calls[0][0], 'sect:save'); assert.strictEqual(calls[0][1], snapshot);
  assert.equal(calls[1][0], 'sect:save-serialized'); assert.equal(calls[1][1], text);
  assert.equal(calls[2][0], 'sect:export-recovery'); assert.strictEqual(calls[2][1], snapshot);
});

test('main selects text transport, measures serialization and retains old-host fallback', async () => {
  const main = await fs.readFile(path.resolve(__dirname, '../../../apps/courtyard/courtyard-main.mjs'), 'utf8');
  const code = main.slice(main.indexOf('function submitSave(data){'), main.indexOf('\nlet persistence;'));
  const snapshot = world(11), kinds = [], calls = [];
  const context = { host: { saveSerialized: text => { calls.push(text); return { ok: true }; }, save: () => { throw Error('unexpected object channel'); } },
    qaSaveTiming: false, saveJS: (kind, callback) => { kinds.push(kind); return callback(); } };
  vm.createContext(context); vm.runInContext(code, context);
  assert.equal(context.submitSave(snapshot).ok, true);
  assert.equal(calls[0], JSON.stringify(snapshot));
  assert.deepEqual(kinds, ['save-serialize-js', 'host-save-submit-js']);
  let object;
  context.host = { save: value => { object = value; return { ok: true }; } };
  assert.equal(context.submitSave(snapshot).ok, true); assert.strictEqual(object, snapshot);
  const cyclic = {}; cyclic.self = cyclic;
  context.host = { saveSerialized: () => { throw Error('serialization must fail first'); } };
  assert.throws(() => context.submitSave(cyclic), /circular/i);
});

test('main owned snapshots detach both the world and active-waypoint presentation', async () => {
  const main = await fs.readFile(path.resolve(__dirname, '../../../apps/courtyard/courtyard-main.mjs'), 'utf8');
  const code = main.slice(main.indexOf('function saveSnapshot(){'), main.indexOf('\nasync function save('));
  const context = { structuredClone, session: world(12), snapshotSect: value => structuredClone(value),
    saveJS: (_kind, callback) => callback(), manualPause: true, openingReading: false,
    opening: { snapshotPresentation: () => ({ version: 1, bundle: { phase: 'closed' } }) },
    route: [{ x: 1, y: 2 }], activeWaypoint: { world: { x: 3, y: 4 }, tick: 12, exit: true },
    destination: { x: 5, y: 6 }, renderer: { camera: { x: 7, y: 8, zoom: 1 } }, toWorld: (x, y) => ({ x, y }) };
  vm.createContext(context); vm.runInContext(code, context);
  const snapshot = context.saveSnapshot(), expected = JSON.stringify(snapshot);
  context.session.state.person.hp = 1; context.activeWaypoint.world.x = 99; context.route[0].x = 99;
  context.destination.x = 99; context.renderer.camera.x = 99;
  assert.equal(JSON.stringify(snapshot), expected);
});
