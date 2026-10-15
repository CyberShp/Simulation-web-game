const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { exportCourtyardRecovery } = require('./courtyard-recovery.cjs');

test('recovery export preserves the complete current session and existing save', async t => {
  const { createSectSession, snapshotSect, restoreSect, validateSect, commandSect } = await import('./sect-sim.mjs');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-recovery-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const saveFilename = path.join(directory, 'sect-save.json'), filename = path.join(directory, 'recovery.json');
  await fs.writeFile(saveFilename, 'original save');
  const session = createSectSession(); commandSect(session, { type: 'policy', policy: { herbTarget: 42 } });
  const state = snapshotSect(session);
  assert.equal((await exportCourtyardRecovery({ filename, saveFilename, state, validate: validateSect })).ok, true);
  assert.deepEqual(restoreSect(await fs.readFile(filename, 'utf8')), state);
  assert.equal(await fs.readFile(saveFilename, 'utf8'), 'original save');
  assert.deepEqual(snapshotSect(session), state);
  assert.equal((await exportCourtyardRecovery({ filename: saveFilename, saveFilename, state, validate: validateSect })).ok, false);
  assert.equal((await exportCourtyardRecovery({ filename, saveFilename, state, validate: validateSect })).ok, false);
  assert.deepEqual(restoreSect(await fs.readFile(filename, 'utf8')), state);
});

test('invalid or oversized exports create no file and leave the source intact', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-recovery-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'recovery.json'), saveFilename = path.join(directory, 'sect-save.json');
  const invalid = await exportCourtyardRecovery({ filename, saveFilename, state: { invalid: true }, validate: () => false });
  assert.equal(invalid.ok, false);
  const oversized = await exportCourtyardRecovery({ filename, saveFilename, state: { text: 'x'.repeat(8 * 1024 * 1024) }, validate: () => true });
  assert.equal(oversized.ok, false);
  await assert.rejects(fs.access(filename));
});

test('an interrupted export removes only its newly created partial file', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-recovery-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'recovery.json'), saveFilename = path.join(directory, 'sect-save.json');
  await fs.writeFile(saveFilename, 'keep');
  const io = { ...fs, open: async (...args) => {
    const handle = await fs.open(...args);
    return { writeFile: async () => { await handle.writeFile('partial'); throw Error('disk full'); }, sync: () => handle.sync(), close: () => handle.close() };
  } };
  const result = await exportCourtyardRecovery({ filename, saveFilename, state: {}, validate: () => true, io });
  assert.equal(result.ok, false); assert.match(result.error, /disk full/);
  await assert.rejects(fs.access(filename));
  assert.equal(await fs.readFile(saveFilename, 'utf8'), 'keep');
});
