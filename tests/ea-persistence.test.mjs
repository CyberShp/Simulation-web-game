import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEAPersistence, slotKeys, SLOT_IDS, LEGACY_SAVE_KEY, LEGACY_BACKUP_KEY, SAVE_FORMAT,
} from '../dist/ea-persistence.mjs';

// These tests isolate the storage protocol with an injected miniature simulator.
// The integration suite also exercises the real version-5 simulation validator.
function world(jade = 100, version = 5) {
  return {version, time: 37, resources: {jade}, master: {name: '沈青岚', realm: 6},
    sect: {name: '云岫山院'}, buildings: [{id: 1, type: 'hall'}], disciples: [{id: 1, name: '陆知微'}],
    claimed: ['intro'], sim: {seed: 654321, carry: .25}, activity: {kind: 'encounter', resolved: false}};
}
function validate(input) {
  if (!input || ![1, 2, 3, 4, 5].includes(input.version) || !Number.isFinite(input.resources?.jade) ||
      input.resources.jade < 0 || !Number.isFinite(input.time) || !input.master || !Array.isArray(input.buildings) ||
      !Array.isArray(input.disciples) || !Array.isArray(input.claimed) || !Number.isSafeInteger(input.sim?.seed)) {
    throw new Error('测试模拟器拒绝损坏状态');
  }
  const state = structuredClone(input);
  if (state.version < 5) state.migration = {from: state.version};
  state.version = 5;
  return state;
}
function memoryStorage() {
  const data = new Map();
  return {data, fail: null, getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { this.fail?.(key, value); data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }};
}
function memoryLocks() {
  const held = new Map();
  return {held, calls: [], request(name, options, callback) {
    this.calls.push({name, options});
    assert.equal(options.mode, 'exclusive');
    assert.equal(options.ifAvailable, true);
    assert.equal(options.steal, undefined);
    return new Promise((resolve, reject) => queueMicrotask(() => {
      if (held.has(name)) { Promise.resolve(callback(null)).then(resolve, reject); return; }
      const token = {name, mode: 'exclusive'}; held.set(name, token);
      let lifetime;
      try { lifetime = callback(token); } catch (error) { held.delete(name); reject(error); return; }
      Promise.resolve(lifetime).then(value => { held.delete(name); resolve(value); }, error => { held.delete(name); reject(error); });
    }));
  }};
}
function broadcasts() {
  const peers = new Set();
  return () => {
    const handlers = new Set();
    const channel = {
      addEventListener(type, handler) { if (type === 'message') handlers.add(handler); },
      postMessage(data) { for (const peer of peers) if (peer !== channel) queueMicrotask(() => peer.deliver(structuredClone(data))); },
      deliver(data) { for (const handler of handlers) handler({data}); },
      close() { peers.delete(channel); },
    };
    peers.add(channel); return channel;
  };
}
function setup(options = {}) {
  const storage = options.storage || memoryStorage(), locks = options.locks ?? memoryLocks();
  let clock = 1800000000000;
  const make = config => createEAPersistence({getStorage: () => storage, validate, locks, channelFactory: null,
    now: () => ++clock, ...config});
  return {storage, locks, make, p: make(options.config)};
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const quota = () => Object.assign(new Error('storage full'), {name: 'QuotaExceededError'});

test('three independent world slots retain separate state and rolling backups', async () => {
  const {p} = setup();
  assert.deepEqual(p.listSlots().map(slot => slot.status), ['empty', 'empty', 'empty']);
  for (const slot of SLOT_IDS) {
    assert.equal((await p.open(slot)).mode, 'writer');
    assert.equal(p.save(world(slot * 100)).ok, true);
    assert.equal(p.save(world(slot * 100 + 1)).ok, true);
  }
  for (const slot of SLOT_IDS) {
    const loaded = await p.open(slot);
    assert.equal(loaded.state.resources.jade, slot * 100 + 1);
    assert.equal(loaded.backups.length, 1);
    assert.equal(p.parseImport(p.exportSlot(slot, {source: loaded.backups[0].id})).state.resources.jade, slot * 100);
  }
  p.close();
});

test('saveNow is synchronous, snapshots state, and updates visible metadata only after commit', async () => {
  const {p} = setup();
  await p.open(1);
  const state = world(), saved = p.saveNow(state, {checkpoint: '筑基'});
  assert.equal(saved instanceof Promise, false);
  assert.equal(saved.ok, true);
  assert.equal(saved.meta.leader, '沈青岚');
  assert.equal(saved.meta.realm, '炼气6层');
  assert.equal(saved.meta.sect, '云岫山院');
  assert.equal(saved.meta.day, 1);
  assert.equal(saved.meta.dataVersion, 5);
  assert.equal(saved.meta.checkpoint, '筑基');
  assert.equal(p.savedAt, saved.meta.savedAt);
  state.resources.jade = 999;
  const read = p.inspect(1);
  assert.equal(read.state.resources.jade, 100);
  assert.equal(read.state.time, 37);
  assert.deepEqual(read.state.sim, {seed: 654321, carry: .25});
  assert.equal(read.meta.savedAt, saved.meta.savedAt);
  p.close();
});

test('each slot keeps exactly the three preceding valid committed snapshots', async () => {
  const {p} = setup(); await p.open(2);
  for (let jade = 1; jade <= 6; jade++) assert.equal(p.save(world(jade), {checkpoint: jade === 3 ? '立派' : null}).ok, true);
  const view = p.inspect(2);
  assert.equal(view.meta.revision, 6);
  assert.deepEqual(view.backups.map(item => p.parseImport(p.exportSlot(2, {source: item.id})).state.resources.jade), [5, 4, 3]);
  assert.equal(view.backups[2].meta.checkpoint, '立派');
  p.close();
});

test('corrupt primary requires a selected recovery and retains the original broken bytes', async () => {
  const {storage, p, make} = setup(); await p.open(1);
  p.save(world(20)); p.save(world(30)); p.close(); await flush();
  const broken = '{bad primary'; storage.setItem(slotKeys(1).primary, broken);
  const next = make(), opened = await next.open(1);
  assert.equal(opened.status, 'recovery-required');
  assert.equal(opened.state, null);
  assert.equal(next.save(world(90)).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), broken);
  const recovered = await next.recover(1, opened.backups[0].id);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.resources.jade, 20);
  const retained = next.inspect(1).preserved.find(item => !item.valid);
  assert.equal(next.exportSlot(1, {source: retained.id}), broken);
  assert.equal(next.inspect(1).state.resources.jade, 20);
  next.close();
});

test('primary and backups both damaged never silently become an empty writable world', async () => {
  const {storage, p} = setup(), keys = slotKeys(1);
  storage.setItem(keys.primary, 'damaged primary'); storage.setItem(keys.backups, 'damaged backups');
  const opened = await p.open(1);
  assert.equal(opened.status, 'recovery-required');
  assert.equal(p.save(world()).ok, false);
  assert.equal((await p.recover(1, 'missing')).ok, false);
  const bundle = JSON.parse(p.exportBundle(1));
  assert.equal(bundle.raw.primary, 'damaged primary');
  assert.equal(bundle.raw.backups, 'damaged backups');
  assert.equal(p.parseImport(JSON.stringify(bundle)).code, 'recovery-bundle');
  assert.equal(storage.getItem(keys.primary), 'damaged primary');
  p.close();
});

test('missing primary with surviving backup offers recovery instead of overwriting', async () => {
  const {storage, p, make} = setup(); await p.open(1); p.save(world(10)); p.save(world(11)); p.close(); await flush();
  storage.removeItem(slotKeys(1).primary);
  const next = make(), view = await next.open(1);
  assert.equal(view.status, 'recovery-required');
  assert.equal(next.save(world(50)).ok, false);
  assert.equal((await next.recover(1, view.backups[0].id)).state.resources.jade, 10);
  next.close();
});

test('v1–v4 legacy storage migrates via the injected validator after keeping pre-migration copies', async () => {
  for (const version of [1, 2, 3, 4]) {
    const {storage, p} = setup();
    const old = world(70 + version, version), oldBackup = world(50 + version, version);
    const raw = JSON.stringify({format: 1, savedAt: 1500000000000, state: old});
    const backupRaw = JSON.stringify({format: 1, savedAt: 1499999999999, state: oldBackup});
    storage.setItem(LEGACY_SAVE_KEY, raw); storage.setItem(LEGACY_BACKUP_KEY, backupRaw);
    const slots = p.listSlots();
    assert.equal(slots[0].status, 'migration-available');
    assert.equal(slots[1].status, 'empty');
    assert.equal(slots[0].migration.candidates[0].meta.dataVersion, version);
    const opened = await p.open(1);
    assert.equal(opened.state, null);
    assert.equal(p.save(world()).ok, false);
    const migrated = await p.migrateLegacy(1);
    assert.equal(migrated.ok, true);
    assert.equal(migrated.state.version, 5);
    assert.equal(migrated.state.migration.from, version);
    for (const field of ['resources', 'master', 'disciples', 'buildings', 'claimed', 'sim', 'activity']) {
      assert.deepEqual(migrated.state[field], old[field]);
    }
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), raw);
    assert.equal(storage.getItem(LEGACY_BACKUP_KEY), backupRaw);
    const originals = p.inspect(1).preserved.map(item => p.exportSlot(1, {source: item.id}));
    assert.ok(originals.includes(raw)); assert.ok(originals.includes(backupRaw));
    p.close();
  }
});

test('a failed migration preserves originals and requires explicitly choosing a valid legacy backup', async () => {
  const {storage, p} = setup();
  storage.setItem(LEGACY_SAVE_KEY, '{broken-old');
  const backup = JSON.stringify({format: 1, savedAt: 500, state: world(42, 3)});
  storage.setItem(LEGACY_BACKUP_KEY, backup);
  await p.open(1);
  assert.equal((await p.migrateLegacy(1)).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), null);
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), '{broken-old');
  const recovered = await p.migrateLegacy(1, {source: 'legacy-backup'});
  assert.equal(recovered.ok, true); assert.equal(recovered.state.resources.jade, 42);
  p.close();
});

test('an older native envelope also requires migration and retains its source bytes', async () => {
  const {storage, p, make} = setup(); await p.open(1); p.save(world()); p.close(); await flush();
  const envelope = JSON.parse(storage.getItem(slotKeys(1).primary));
  envelope.state.version = 4; envelope.dataVersion = 4;
  const original = JSON.stringify(envelope); storage.setItem(slotKeys(1).primary, original);
  const next = make();
  assert.equal((await next.open(1)).status, 'migration-available');
  assert.equal((await next.migrateLegacy(1, {source: 'primary'})).ok, true);
  assert.ok(next.inspect(1).preserved.some(item => next.exportSlot(1, {source: item.id}) === original));
  next.close();
});

test('imports reject illegal, oversized and unsupported data without changing an existing slot', async () => {
  const {storage, p} = setup({config: {maxImportBytes: 4096}}); await p.open(1); p.save(world(19));
  const primary = storage.getItem(slotKeys(1).primary);
  const malformed = [{}, [], {version: 6}, {...world(), resources: {jade: -1}}, {format: 1, savedAt: 'yesterday', state: world(1, 4)}];
  for (const input of malformed) {
    const text = JSON.stringify(input);
    assert.equal(p.parseImport(text).ok, false);
    assert.equal((await p.importInto(1, text, {confirmed: true})).ok, false);
  }
  assert.equal(p.parseImport('{incomplete').code, 'invalid-json');
  assert.equal(p.parseImport(' '.repeat(5000) + '{}').code, 'file-too-large');
  const tampered = JSON.parse(primary); tampered.dataVersion = 4;
  assert.equal(p.parseImport(JSON.stringify(tampered)).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), primary);
  p.close();
});

test('confirmed import round-trips gameplay and retains the replaced world beyond rolling backups', async () => {
  const {p} = setup(); await p.open(1); p.save(world(10));
  const importedState = world(88), text = p.exportState(importedState);
  assert.equal((await p.importInto(1, text)).code, 'confirmation-required');
  assert.equal(p.inspect(1).state.resources.jade, 10);
  const loaded = await p.importInto(1, text, {confirmed: true});
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, importedState);
  assert.deepEqual(p.parseImport(p.exportSlot(1)).state, importedState);
  for (let value = 100; value < 106; value++) p.save(world(value));
  const oldWorld = p.inspect(1).preserved.find(item => item.reason === 'before-import');
  assert.equal(p.parseImport(p.exportSlot(1, {source: oldWorld.id})).state.resources.jade, 10);
  p.close();
});

test('quota exhaustion during backup or primary write never claims success or replaces the last primary', async () => {
  for (const failedKey of ['backups', 'primary']) {
    const {storage, p} = setup(); await p.open(1); p.save(world(10));
    const old = storage.getItem(slotKeys(1).primary), savedAt = p.savedAt;
    storage.fail = key => { if (key === slotKeys(1)[failedKey]) throw quota(); };
    const failed = p.save(world(11));
    assert.equal(failed.ok, false); assert.equal(failed.code, 'storage-full');
    assert.equal(p.savedAt, savedAt);
    assert.equal(storage.getItem(slotKeys(1).primary), old);
    assert.equal(p.parseImport(p.exportState(world(11))).state.resources.jade, 11);
    p.close();
  }
});

test('disabled storage and a failing write-readback report failure rather than successful saving', async () => {
  const denied = createEAPersistence({getStorage() { throw Object.assign(new Error('blocked'), {name: 'SecurityError'}); },
    validate, locks: memoryLocks(), channelFactory: null});
  assert.equal(denied.listSlots()[0].status, 'unavailable');
  assert.equal((await denied.open(1)).ok, false);
  assert.equal(denied.save(world()).ok, false); denied.close();

  const {storage, p} = setup(); await p.open(1); p.save(world(22)); const savedAt = p.savedAt;
  const set = storage.setItem;
  storage.setItem = function (key, value) { if (key !== slotKeys(1).primary) set.call(this, key, value); };
  const outcome = p.save(world(23));
  assert.equal(outcome.ok, false); assert.equal(outcome.code, 'verification-failed');
  assert.equal(p.savedAt, savedAt); assert.equal(p.blocked, true);
  assert.equal(p.inspect(1).state.resources.jade, 22);
  p.close();
});

test('simultaneous asynchronous lock claims grant exactly one writer and reject the losing save', async () => {
  const {make, storage, locks, p: a} = setup(), b = make();
  const opened = await Promise.all([a.open(1), b.open(1)]);
  assert.equal(opened.filter(value => value.mode === 'writer').length, 1);
  assert.equal(locks.held.size, 1);
  const outcomes = await Promise.all([Promise.resolve().then(() => a.save(world(15))), Promise.resolve().then(() => b.save(world(25)))]);
  assert.equal(outcomes.filter(value => value.ok).length, 1);
  const winner = outcomes[0].ok ? 15 : 25;
  assert.equal(JSON.parse(storage.getItem(slotKeys(1).primary)).state.resources.jade, winner);
  assert.equal(JSON.parse(storage.getItem(slotKeys(1).primary)).revision, 1);
  a.close(); b.close(); await flush(); assert.equal(locks.held.size, 0);
});

test('independent slots can have simultaneous exclusive owners', async () => {
  const {p: a, make, locks} = setup(), b = make(), c = make();
  const opened = await Promise.all([a.open(1), b.open(2), c.open(3)]);
  assert.equal(opened.every(value => value.ok), true);
  assert.equal(locks.held.size, 3);
  assert.equal(a.save(world(1)).ok && b.save(world(2)).ok && c.save(world(3)).ok, true);
  assert.deepEqual(a.listSlots().map(slot => slot.meta.revision), [1, 1, 1]);
  a.close(); b.close(); c.close();
});

test('without Web Locks the module explicitly refuses writes instead of using racy localStorage claims', async () => {
  const {storage} = setup();
  const p = createEAPersistence({getStorage: () => storage, validate, locks: null, channelFactory: null});
  const opened = await p.open(1);
  assert.equal(opened.mode, 'unsafe'); assert.equal(opened.code, 'locks-unavailable');
  assert.equal(p.save(world()).ok, false);
  assert.equal((await p.replace(1, world(), {confirmed: true})).ok, false);
  assert.equal(storage.data.size, 0);
  assert.deepEqual(p.parseImport(p.exportState(world())).state, world());
  p.close();
});

test('close commits synchronously before release, and a later window can resume without stale-owner writes', async () => {
  const {p: a, make, storage} = setup(), b = make();
  await a.open(1); a.save(world(10));
  assert.equal((await b.open(1)).mode, 'readonly');
  assert.equal(a.close({state: world(44)}).ok, true);
  assert.equal(JSON.parse(storage.getItem(slotKeys(1).primary)).state.resources.jade, 44);
  await flush();
  const continued = await b.open(1);
  assert.equal(continued.ok, true); assert.equal(continued.state.resources.jade, 44);
  assert.equal(a.save(world(99)).ok, false);
  assert.equal(b.save(world(45)).ok, true);
  b.close();
});

test('cooperative takeover saves the owner snapshot, stops it, and obtains a fresh real lock', async () => {
  const {make, locks} = setup(), channelFactory = broadcasts();
  const changes = [];
  const a = make({channelFactory, getState: () => world(63), onChange: event => changes.push(event.mode)});
  const b = make({channelFactory, takeoverTimeoutMs: 50});
  await a.open(1); a.save(world(60));
  const takeover = await b.open(1, {takeover: true});
  assert.equal(takeover.ok, true); assert.equal(takeover.state.resources.jade, 63);
  assert.equal(a.mode, 'readonly'); assert.equal(changes.at(-1), 'readonly');
  assert.equal(a.save(world(999)).ok, false);
  assert.equal(locks.held.size, 1); assert.equal(b.save(world(64)).ok, true);
  a.close(); b.close();
});

test('without a cooperation channel takeover never steals an active writer lock', async () => {
  const {p: a, make} = setup(), b = make();
  await a.open(1); a.save(world(71));
  const takeover = await b.open(1, {takeover: true});
  assert.equal(takeover.ok, false); assert.equal(takeover.mode, 'readonly');
  assert.equal(a.canWrite, true); assert.equal(b.save(world(80)).ok, false);
  a.close(); b.close();
});

test('a takeover refuses to release the only current snapshot when its final durable save fails', async () => {
  const {make, storage, locks} = setup(), channelFactory = broadcasts();
  const a = make({channelFactory, getState: () => world(63)});
  const b = make({channelFactory, takeoverTimeoutMs: 50});
  await a.open(1); a.save(world(60));
  storage.fail = key => { if (key === slotKeys(1).primary) throw quota(); };
  const takeover = await b.open(1, {takeover: true});
  assert.equal(takeover.ok, false); assert.equal(takeover.code, 'takeover-denied');
  assert.equal(a.mode, 'writer'); assert.equal(a.canWrite, true);
  assert.equal(a.lastResult.code, 'storage-full'); assert.equal(locks.held.size, 1);
  assert.equal(a.inspect(1).state.resources.jade, 60);
  assert.equal(b.save(world(900)).ok, false);
  storage.fail = null;
  const retried = await b.open(1, {takeover: true});
  assert.equal(retried.ok, true); assert.equal(retried.state.resources.jade, 63);
  a.close(); b.close();
});

test('an owner snapshot callback error never silently hands off an outdated primary', async () => {
  const {make} = setup(), channelFactory = broadcasts();
  const a = make({channelFactory, getState: () => { throw new Error('当前状态不可读取'); }});
  const b = make({channelFactory, takeoverTimeoutMs: 50});
  await a.open(1); a.save(world(60));
  assert.equal((await b.open(1, {takeover: true})).code, 'takeover-denied');
  assert.equal(a.canWrite, true); assert.equal(a.inspect(1).state.resources.jade, 60);
  a.close(); b.close();
});

test('BFCache head tokens detect a newer writer after a failed departure save', async () => {
  const {p: a, make, storage} = setup(); await a.open(1); a.save(world(60));
  const parked = a.captureHead();
  storage.fail = key => { if (key === slotKeys(1).primary) throw quota(); };
  assert.equal(a.release({state: world(63)}).ok, false);
  await flush(); storage.fail = null;
  const b = make(); await b.open(1); b.save(world(70)); b.release(); await flush();
  const reopened = await a.open(1);
  assert.equal(reopened.state.resources.jade, 70);
  assert.equal(a.matchesHead(parked), false);
  assert.equal(a.parseImport(a.exportState(world(63))).state.resources.jade, 63);
  assert.equal(a.inspect(1).state.resources.jade, 70);
  a.close(); b.close();
});

test('a failed departure with unchanged head permits retry without replaying activity or claims', async () => {
  const {p, storage} = setup(); await p.open(1); p.save(world(60));
  const parked = p.captureHead();
  storage.fail = key => { if (key === slotKeys(1).primary) throw quota(); };
  assert.equal(p.release({state: world(63)}).ok, false); await flush(); storage.fail = null;
  await p.open(1); assert.equal(p.matchesHead(parked), true);
  assert.equal(p.save(world(63)).ok, true); assert.equal(p.matchesHead(parked), false);
  const restored = p.inspect(1).state;
  assert.deepEqual(restored.claimed, ['intro']); assert.deepEqual(restored.activity, world().activity);
  p.close();
});

test('closing during asynchronous open cancels the late grant without an orphan lock', async () => {
  const {p, locks} = setup();
  const pending = p.open(1); p.close();
  assert.equal((await pending).ok, false);
  await flush(); assert.equal(locks.held.size, 0);
  assert.equal(p.mode, 'readonly');
});

test('noncooperating external writes are detected and never overwritten by a stale owner', async () => {
  const {p, storage} = setup(); await p.open(1); p.save(world(20));
  const foreign = p.exportState(world(900)); storage.setItem(slotKeys(1).primary, foreign);
  const saved = p.save(world(21));
  assert.equal(saved.ok, false); assert.equal(saved.code, 'conflict');
  assert.equal(p.mode, 'readonly'); assert.equal(storage.getItem(slotKeys(1).primary), foreign);
  p.close();
});

test('a noncooperating write during open never pairs old state with a newer writable head', async () => {
  const {p, storage, make} = setup(); await p.open(1); p.save(world(20)); p.close(); await flush();
  const foreign = p.exportState(world(900)), originalGet = storage.getItem;
  let changed = false;
  storage.getItem = function(key) {
    const raw = originalGet.call(this, key);
    if (!changed && key === slotKeys(1).primary) { changed = true; this.data.set(key, foreign); }
    return raw;
  };
  const next = make(), opened = await next.open(1);
  assert.equal(opened.ok, false); assert.equal(opened.code, 'conflict');
  assert.equal(next.canWrite, false); assert.equal(next.save(world(21)).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), foreign);
  storage.getItem = originalGet;
  assert.equal((await next.open(1)).state.resources.jade, 900);
  next.close();
});

test('storage events stop the active simulation owner on an unexpected primary change', async () => {
  const handlers = new Map(), eventTarget = {addEventListener: (name, callback) => handlers.set(name, callback),
    removeEventListener: name => handlers.delete(name)};
  const {p, storage} = setup({config: {eventTarget}}); await p.open(1); p.save(world());
  storage.setItem(slotKeys(1).primary, 'external');
  handlers.get('storage')({key: slotKeys(1).primary});
  assert.equal(p.mode, 'readonly'); assert.equal(p.canWrite, false);
  p.close(); assert.equal(handlers.size, 0);
});

test('replacement never proceeds when it cannot first preserve the old world', async () => {
  const {p, storage} = setup(); await p.open(1); p.save(world(15));
  const old = storage.getItem(slotKeys(1).primary);
  storage.fail = key => { if (key === slotKeys(1).preserved) throw quota(); };
  const outcome = await p.replace(1, world(90), {confirmed: true});
  assert.equal(outcome.ok, false); assert.equal(outcome.code, 'storage-full');
  assert.equal(storage.getItem(slotKeys(1).primary), old);
  storage.fail = null;
  storage.setItem(slotKeys(1).preserved, 'broken archive');
  assert.equal((await p.replace(1, world(90), {confirmed: true})).code, 'archive-corrupt');
  assert.equal(storage.getItem(slotKeys(1).primary), old);
  p.close();
});

test('saving a valid primary repairs a corrupt backup index only after preserving its original bytes', async () => {
  const {p, storage} = setup(); await p.open(1); p.save(world(30));
  storage.setItem(slotKeys(1).backups, 'broken backup index');
  assert.match(p.inspect(1).warning, /损坏/);
  assert.equal(p.save(world(31)).ok, true);
  const retained = p.inspect(1).preserved.find(item => item.reason === 'damaged-backup-index');
  assert.equal(p.exportSlot(1, {source: retained.id}), 'broken backup index');
  assert.equal(p.inspect(1).backups[0].valid, true);
  p.close();
});

test('a rejected platform lock API exposes unsafe mode and does not write storage', async () => {
  const {storage} = setup();
  const p = createEAPersistence({getStorage: () => storage, validate, channelFactory: null,
    locks: {request() { return Promise.reject(new Error('Lock API blocked')); }}});
  assert.equal((await p.open(1)).mode, 'unsafe');
  assert.equal(p.save(world()).ok, false); assert.equal(storage.data.size, 0); p.close();
});

test('newly exported files contain an explicitly validated EA envelope', () => {
  const {p} = setup(); const exported = JSON.parse(p.exportState(world()));
  assert.equal(exported.format, SAVE_FORMAT); assert.equal(exported.formatVersion, 1);
  assert.equal(exported.dataVersion, 5); assert.equal(exported.slot, 1);
  assert.throws(() => p.exportState({...world(), resources: {jade: NaN}}));
  p.close();
});

test('acceptance worlds have independent slots, locks and recovery from production', async () => {
  const storage=memoryStorage(),locks=memoryLocks();
  const prod=createEAPersistence({getStorage:()=>storage,validate,locks,channelFactory:null,eventTarget:null});
  const preview=createEAPersistence({getStorage:()=>storage,validate,locks,namespace:'xianfu:test-acceptance:',channelFactory:null,eventTarget:null});
  await prod.open(1);await preview.open(1);
  assert.equal((await prod.replace(1,world(777),{confirmed:true})).ok,true);
  assert.equal((await preview.replace(1,world(123),{confirmed:true})).ok,true);
  assert.equal(prod.inspect(1).state.resources.jade,777);
  assert.equal(preview.inspect(1).state.resources.jade,123);
  assert.notEqual(locks.calls[0].name,locks.calls[1].name);
  prod.close();preview.close();
});
