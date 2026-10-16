const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { exportCourtyardRecovery, readCourtyardRecovery, restoreCourtyardRecovery } = require('../../../apps/courtyard/courtyard-recovery.cjs');
const { createSectStorage } = require('../../../apps/courtyard/sect-storage.cjs');

test('recovery export preserves the complete current session and existing save', async t => {
  const { createSectSession, snapshotSect, restoreSect, validateSect, commandSect } = await import('../../../apps/courtyard/sect-sim.mjs');
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

test('import preview rejects damaged, unsupported and oversized files without touching the save', async t => {
  const { createSectSession, snapshotSect, validateSect } = await import('../../../apps/courtyard/sect-sim.mjs');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-import-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'candidate.json'), saveFilename = path.join(directory, 'sect-save.json');
  await fs.writeFile(saveFilename, 'preserve me');
  for (const contents of ['{', JSON.stringify({version:999}), 'x'.repeat(8*1024*1024+1)]) {
    await fs.writeFile(filename, contents);
    assert.equal((await readCourtyardRecovery({filename, validate:validateSect})).ok, false);
    assert.equal(await fs.readFile(saveFilename,'utf8'), 'preserve me');
  }
  const state = snapshotSect(createSectSession());
  await fs.writeFile(filename, JSON.stringify(state));
  const result = await readCourtyardRecovery({filename, validate:validateSect});
  assert.equal(result.ok, true); assert.deepEqual(result.data, state);
  assert.equal(await fs.readFile(saveFilename,'utf8'), 'preserve me');
});

test('explicit restore preserves corrupt disk and unsaved memory before replacing the primary save', async t => {
  const { createSectSession, snapshotSect, validateSect, commandSect } = await import('../../../apps/courtyard/sect-sim.mjs');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-import-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storage = createSectStorage({directory, validate:validateSect});
  await fs.writeFile(storage.filename, 'damaged disk still preserved');
  const incoming = createSectSession(), previous = createSectSession();
  commandSect(incoming,{type:'policy',policy:{herbTarget:42}});
  commandSect(previous,{type:'policy',policy:{herbTarget:24}});
  const data=snapshotSect(incoming), previousState=snapshotSect(previous);
  const result=await restoreCourtyardRecovery({data,previousState,storage,validate:validateSect});
  assert.equal(result.ok,true); assert.equal(result.backups.length,2);
  assert.deepEqual(JSON.parse(await fs.readFile(result.backups[0],'utf8')),previousState);
  assert.equal(await fs.readFile(result.backups[1],'utf8'),'damaged disk still preserved');
  assert.deepEqual((await storage.load()).data,data);
  assert.deepEqual(snapshotSect(previous),previousState);
});

test('restore refuses backup failure and retains the original on an atomic write failure', async t => {
  const { createSectSession, snapshotSect, validateSect } = await import('../../../apps/courtyard/sect-sim.mjs');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-import-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename=path.join(directory,'sect-save.json'), data=snapshotSect(createSectSession());
  await fs.writeFile(filename,'original');
  let writes=0;
  const storage={filename,flush:async()=>{},save:async()=>{writes++;return{ok:false,error:'write interrupted'};}};
  const backupFailure=await restoreCourtyardRecovery({data,storage,validate:validateSect,
    io:{...fs,copyFile:async()=>{throw Error('backup denied');}}});
  assert.equal(backupFailure.ok,false); assert.equal(writes,0);
  const writeFailure=await restoreCourtyardRecovery({data,storage,validate:validateSect});
  assert.equal(writeFailure.ok,false); assert.equal(writes,1);
  assert.equal(await fs.readFile(filename,'utf8'),'original');
  assert.equal(await fs.readFile(writeFailure.backups[0],'utf8'),'original');
});
