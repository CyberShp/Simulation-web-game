import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bootGodotHost} from '../dist/ea-godot-host.mjs';
import {MAX_IMPORT_BYTES} from '../dist/ea-persistence.mjs';
import {PACKED_SAVE_FORMAT, unpackSave} from '../dist/ea-save-codec.mjs';

// A small Node stand-in for the Web host. These checks exercise storage and
// lifecycle callbacks; Godot canvas, file pickers and browser rendering need
// separate Web acceptance.
const PREVIEW_KEY = 'xianfu:simulation-web-game:godot-preview:world:slot:1';
const FORMAL_KEY = 'xianfu:simulation-web-game:ea:slot:1';
const LEGACY_TEXT = readFileSync(new URL('../qa/ea-reference-world.json', import.meta.url), 'utf8');

function restoreProperty(object, key, descriptor) {
  if (descriptor) Object.defineProperty(object, key, descriptor);
  else delete object[key];
}

async function fixture(t, {primary = null} = {}) {
  const data = new Map(primary === null ? [] : [[PREVIEW_KEY, primary]]);
  const handlers = new Map();
  const held = new Set();
  const downloads = [];
  let failWrites = false;
  let fileText = null;
  let fileChangeDone = Promise.resolve();
  let currentBlob = null;
  const on = (type, listener) => handlers.set(type, [...(handlers.get(type) || []), listener]);
  const storage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) {
      if (failWrites) throw Object.assign(new Error('full'), {name: 'QuotaExceededError'});
      data.set(key, String(value));
    },
  };
  const locks = {
    request(name, _options, callback) {
      return new Promise((resolve, reject) => queueMicrotask(() => {
        if (held.has(name)) {
          Promise.resolve(callback(null)).then(resolve, reject);
          return;
        }
        held.add(name);
        let lifetime;
        try { lifetime = callback({name}); }
        catch (error) { held.delete(name); reject(error); return; }
        Promise.resolve(lifetime).then(
          value => { held.delete(name); resolve(value); },
          error => { held.delete(name); reject(error); },
        );
      }));
    },
  };
  const document = {
    hidden: false,
    addEventListener: on,
    body: {append() {}},
    createElement(kind) {
      if (kind === 'a') return {
        click() { downloads.push({name: this.download, blob: currentBlob}); },
      };
      assert.equal(kind, 'input');
      const inputHandlers = new Map();
      return {
        files: fileText === null ? [] : [{size: Buffer.byteLength(fileText), text: async () => fileText}],
        addEventListener(type, listener) { inputHandlers.set(type, listener); },
        click() { fileChangeDone = Promise.resolve().then(() => inputHandlers.get('change')?.()); },
        remove() {},
      };
    },
  };
  const replacements = {
    window: {addEventListener: on, confirm: () => true},
    document,
    location: {search: ''},
    navigator: {locks},
    localStorage: storage,
    BroadcastChannel: undefined,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    xianfuGodot: undefined,
  };
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const createObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  for (const [key, value] of Object.entries(replacements)) {
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  }
  Object.defineProperty(URL, 'createObjectURL', {configurable: true, value(blob) { currentBlob = blob; return 'blob:godot-host-test'; }});
  Object.defineProperty(URL, 'revokeObjectURL', {configurable: true, value() {}});
  t.after(() => {
    for (const [key, descriptor] of Object.entries(originals)) restoreProperty(globalThis, key, descriptor);
    restoreProperty(URL, 'createObjectURL', createObjectURL);
    restoreProperty(URL, 'revokeObjectURL', revokeObjectURL);
  });

  const api = await bootGodotHost();
  return {
    api, data, held, downloads,
    state: () => JSON.parse(api.export_save()),
    view: () => JSON.parse(api.snapshot_json()),
    send(command) {
      const request = command.type === 'select' ? command : {...command, ...JSON.parse(api.command_context())};
      return {request, receipt: JSON.parse(api.command(JSON.stringify(request)))};
    },
    emit(type, event = {}) { for (const listener of handlers.get(type) || []) listener(event); },
    setFailWrites(value) { failWrites = value; },
    async selectFile(text) {
      fileText = text;
      api.import_save();
      await fileChangeDone;
    },
    async latestDownload() {
      const item = downloads.at(-1);
      assert.ok(item, 'expected a download');
      return {name: item.name, text: await item.blob.text()};
    },
  };
}

function envelope(raw) {
  let value = JSON.parse(raw);
  if (value.format === PACKED_SAVE_FORMAT) value = JSON.parse(unpackSave(value, MAX_IMPORT_BYTES));
  return value;
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Godot host saves a pending move before immediate reload', async t => {
  const host = await fixture(t);
  const {receipt} = host.send({type: 'move', x: 32, y: 38});
  assert.equal(receipt.ok, true, receipt.error);
  const before = host.state();
  assert.equal(before.personsById['person:master'].scenic.path.length > 0, true);
  await host.api.reload_slot();
  assert.equal(JSON.stringify(host.state()), JSON.stringify(before));
  assert.equal(envelope(host.data.get(PREVIEW_KEY)).state.revision, before.revision);
});

test('Godot host imports a v5 file after preserving pending progress and source bytes', async t => {
  const host = await fixture(t);
  host.data.set(FORMAL_KEY, 'formal-world-sentinel');
  assert.equal(host.send({type: 'move', x: 32, y: 38}).receipt.ok, true);
  const pending = host.state();
  await host.selectFile(LEGACY_TEXT);
  assert.match(host.api.notice(), /旧档已迁入预览/);
  assert.equal(host.state().schemaVersion, 6);
  assert.equal(host.view().people.length, 31);
  const preserved = JSON.parse(host.data.get(PREVIEW_KEY + ':preserved')).entries;
  assert.equal(preserved.find(entry => entry.reason === 'before-import-migration')?.raw, LEGACY_TEXT);
  const prior = envelope(preserved.find(entry => entry.reason === 'before-import').raw).state;
  assert.equal(prior.revision, pending.revision);
  assert.deepEqual(prior.personsById['person:master'].scenic.path, pending.personsById['person:master'].scenic.path);
  assert.equal(host.data.get(FORMAL_KEY), 'formal-world-sentinel');
});

test('Godot host exports the original recovery bundle for a damaged primary', async t => {
  const raw = '{"format":"xianfu-ea","broken":true}';
  const host = await fixture(t, {primary: raw});
  assert.equal(host.api.diagnostics().canWrite, false);
  host.api.download_save();
  const file = await host.latestDownload();
  const bundle = JSON.parse(file.text);
  assert.equal(bundle.format, 'xianfu-ea-recovery');
  assert.equal(bundle.raw.primary, raw);
  assert.equal(host.data.get(PREVIEW_KEY), raw);
  assert.match(file.name, /恢复资料/);
});

test('Godot host exposes a lost writer as paused with the storage conflict reason', async t => {
  const host = await fixture(t);
  host.api.start();
  host.data.set(PREVIEW_KEY, host.data.get(PREVIEW_KEY) + ' ');
  host.emit('storage', {key: PREVIEW_KEY});
  assert.equal(host.api.diagnostics().canWrite, false);
  assert.equal(host.view().paused, true);
  assert.match(host.api.notice(), /另一窗口已更新/);
});

test('Godot host retains pending progress across BFCache when pagehide save fails', async t => {
  const host = await fixture(t);
  host.api.start();
  assert.equal(host.send({type: 'move', x: 32, y: 38}).receipt.ok, true);
  const disk = host.data.get(PREVIEW_KEY);
  host.setFailWrites(true);
  host.emit('pagehide', {persisted: true});
  host.setFailWrites(false);
  assert.equal(host.data.get(PREVIEW_KEY), disk);
  host.emit('pageshow', {persisted: true});
  await settle();
  assert.equal(host.state().personsById['person:master'].scenic.path.length > 0, true);
  assert.match(host.api.notice(), /未保存进度已恢复/);
  assert.equal(host.api.diagnostics().canWrite, true);
});

test('Godot host keeps a changed-head BFCache copy exportable and releases its lock', async t => {
  const host = await fixture(t);
  host.api.start();
  assert.equal(host.send({type: 'move', x: 32, y: 38}).receipt.ok, true);
  host.setFailWrites(true);
  host.emit('pagehide', {persisted: true});
  host.setFailWrites(false);
  const newerHead = host.data.get(PREVIEW_KEY) + ' ';
  host.data.set(PREVIEW_KEY, newerHead);
  host.emit('pageshow', {persisted: true});
  await settle();
  assert.equal(host.state().personsById['person:master'].scenic.path.length > 0, true);
  assert.equal(host.api.diagnostics().recoveryOnly, true);
  assert.equal(host.api.diagnostics().canWrite, false);
  assert.equal(host.held.size, 0);
  assert.equal(host.data.get(PREVIEW_KEY), newerHead);
  host.api.download_save();
  assert.equal(JSON.parse((await host.latestDownload()).text).personsById['person:master'].scenic.path.length > 0, true);
});

test('Godot host replays one confirmed healing request without charging twice', async t => {
  const host = await fixture(t);
  const herb = host.view().resources.herb;
  const {request, receipt} = host.send({name: 'masterAction', args: ['heal']});
  assert.equal(receipt.ok, true, receipt.error);
  const committed = host.api.export_save();
  const replay = JSON.parse(host.api.command(JSON.stringify(request)));
  assert.equal(replay.ok, true, replay.error);
  assert.equal(replay.replayed, true);
  assert.equal(host.api.export_save(), committed);
  assert.equal(host.view().resources.herb, herb - 6);
});
