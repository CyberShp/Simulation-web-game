const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createArenaStorage, SAVE_FILENAME, MAX_SAVE_BYTES } = require('../../../archive/prototypes/pixel_scene_validation/arena-storage.cjs');

const validate = state => {
  if (state?.schema !== 1 || !Number.isInteger(state.tick) || state.tick < 0) throw new Error('Invalid arena schema or tick');
  return true;
};
const state = tick => ({ schema: 1, tick, actor: { id: 'master', hp: 100 } });
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arena-storage-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, storage: createArenaStorage({ directory, validate, ...options }) };
}

test('missing save and persisted snapshot survive a new storage instance unchanged', async t => {
  const { directory, storage } = await fixture(t);
  assert.deepEqual(await storage.load(), { ok: true, found: false });
  const snapshot = state(31);
  assert.deepEqual(await storage.save(snapshot), { ok: true });
  const reopened = createArenaStorage({ directory, validate });
  assert.deepEqual(await reopened.load(), { ok: true, found: true, data: snapshot });
  assert.deepEqual(await fs.readdir(directory), [SAVE_FILENAME]);
  assert.deepEqual(snapshot, state(31));
});

test('validation failures preserve a good save and do not poison the queue', async t => {
  const { storage } = await fixture(t);
  await storage.save(state(12));
  const before = await fs.readFile(storage.filename);
  const result = await storage.save({ ...state(99), schema: 2 });
  assert.equal(result.ok, false);
  assert.match(result.error, /schema/);
  assert.deepEqual(await fs.readFile(storage.filename), before);
  assert.deepEqual(await storage.save(state(13)), { ok: true });
  assert.equal((await storage.load()).data.tick, 13);
});

test('invalid JSON and unknown saved versions report errors without rewriting bytes', async t => {
  const { storage } = await fixture(t);
  for (const bytes of ['{interrupted', JSON.stringify({ ...state(5), schema: 42 })]) {
    await fs.writeFile(storage.filename, bytes);
    assert.equal((await storage.load()).ok, false);
    assert.equal(await fs.readFile(storage.filename, 'utf8'), bytes);
  }
});

test('oversized saves and loads are rejected without replacing their files', async t => {
  const { storage } = await fixture(t);
  await storage.save(state(1));
  const before = await fs.readFile(storage.filename);
  assert.equal((await storage.save({ ...state(2), text: 'x'.repeat(MAX_SAVE_BYTES) })).ok, false);
  assert.deepEqual(await fs.readFile(storage.filename), before);
  const huge = Buffer.alloc(MAX_SAVE_BYTES + 1, 32);
  await fs.writeFile(storage.filename, huge);
  assert.equal((await storage.load()).ok, false);
  assert.deepEqual(await fs.readFile(storage.filename), huge);
});

test('failed atomic replacement retains the prior save and cleans the temporary file', async t => {
  const { directory, storage } = await fixture(t);
  await storage.save(state(10));
  const broken = createArenaStorage({ directory, validate, io: {
    ...fs, rename: async () => { throw new Error('disk rename failed'); }
  } });
  assert.deepEqual(await broken.save(state(11)), { ok: false, error: 'disk rename failed' });
  assert.equal((await storage.load()).data.tick, 10);
  assert.deepEqual(await fs.readdir(directory), [SAVE_FILENAME]);
});

test('failed temporary write retains the prior save and cleans the temporary file', async t => {
  const { directory, storage } = await fixture(t);
  await storage.save(state(20));
  const broken = createArenaStorage({ directory, validate, io: {
    ...fs,
    open: async (filename, flags, mode) => {
      const handle = await fs.open(filename, flags, mode);
      if (flags !== 'wx') return handle;
      return {
        close: () => handle.close(),
        writeFile: async bytes => {
          await handle.write(bytes.subarray(0, 8));
          throw new Error('disk write failed');
        }
      };
    }
  } });
  assert.equal((await broken.save(state(21))).ok, false);
  assert.equal((await storage.load()).data.tick, 20);
  assert.deepEqual(await fs.readdir(directory), [SAVE_FILENAME]);
});

test('queued writes keep invocation order and capture state before caller mutation', async t => {
  let release;
  let first = true;
  const gate = new Promise(resolve => { release = resolve; });
  const { storage } = await fixture(t, { validate: async snapshot => {
    if (first) { first = false; await gate; }
    return validate(snapshot);
  } });
  const initial = state(1);
  const later = state(2);
  const firstWrite = storage.save(initial);
  const secondWrite = storage.save(later);
  const pendingRead = storage.load();
  initial.tick = 80;
  later.tick = 90;
  release();
  assert.deepEqual(await firstWrite, { ok: true });
  assert.deepEqual(await secondWrite, { ok: true });
  assert.equal((await pendingRead).data.tick, 2);
});

test('unserializable snapshots reject cleanly and later valid writes still succeed', async t => {
  const { storage } = await fixture(t);
  assert.equal((await storage.save({ ...state(1), callback: () => {} })).ok, false);
  assert.deepEqual(await storage.save(state(2)), { ok: true });
});

test('real battle snapshot passes the host validator and resumes from saved facts', async t => {
  const { createBattle, validateBattle } = await import('../../../archive/prototypes/pixel_scene_validation/arena-sim.mjs');
  const { directory, storage } = await fixture(t, { validate: validateBattle });
  const original = createBattle({ mode: 'team', seed: 17 });
  assert.deepEqual(await storage.save(original), { ok: true });
  const reopened = createArenaStorage({ directory, validate: validateBattle });
  assert.deepEqual(await reopened.load(), { ok: true, found: true, data: original });
});
