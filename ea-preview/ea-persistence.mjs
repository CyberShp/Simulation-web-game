/**
 * Three local worlds, with an exclusive Web Lock held for each play session.
 * Simulation validation/migration is injected; this module never imports it.
 *
 * await store.open(1);                      // read before advancing simulation
 * const result = store.saveNow(state);      // synchronous while lock is held
 * store.close({state});                    // best-effort final save, then release
 *
 * Web Locks arbitrate cooperating windows. Reading and comparing localStorage
 * is only an extra conflict check, NOT a substitute for an atomic lock. Without
 * a lock provider, reads/exports work but writes are explicitly unavailable.
 */
import {PACKED_SAVE_FORMAT,packSave,unpackSave} from './ea-save-codec.mjs?v=ea-160-courtyard-20261008-r8';

export const EA_SAVE_PREFIX = 'xianfu:simulation-web-game:ea:';
export const LEGACY_SAVE_KEY = 'xianfu:simulation-web-game:save';
export const LEGACY_BACKUP_KEY = LEGACY_SAVE_KEY + ':backup';
export const SLOT_IDS = Object.freeze([1, 2, 3]);
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const SAVE_FORMAT = 'xianfu-ea';
const FORMAT_VERSION = 1;
const BACKUP_FORMAT = 'xianfu-ea-backups';
const PRESERVED_FORMAT = 'xianfu-ea-preserved';
const UNREAD = Symbol('unread');

export function slotKeys(slot,namespace=EA_SAVE_PREFIX) {
  const id = Number(slot);
  if (!SLOT_IDS.includes(id)) throw new Error('请选择 1、2 或 3 号世界档。');
  const primary = namespace + 'slot:' + id;
  return {primary, backups: primary + ':backups', preserved: primary + ':preserved', lock: primary + ':writer'};
}

const clone = value => structuredClone(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stateVersion = value => value?.schemaVersion ?? value?.version;
const finiteTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const byteLength = value => new TextEncoder().encode(value).byteLength;
function compactStorage(raw, maxBytes) {
  if (byteLength(raw) <= 256 * 1024 || JSON.parse(raw).format === PACKED_SAVE_FORMAT) return raw;
  const packed = packSave(raw);
  return byteLength(packed) <= maxBytes && byteLength(packed) < byteLength(raw) ? packed : raw;
}
function fingerprint(raw) {
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
function stringify(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('存档包含无效数值。');
    if (['bigint', 'function', 'symbol', 'undefined'].includes(typeof item)) throw new Error('存档包含无法保存的字段。');
    return item;
  });
}
function readableError(error) {
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return {code: 'storage-full', message: '本机存储已满，保存失败；上一份主档仍保留，请导出当前进度。'};
  }
  if (error?.name === 'SecurityError' || error?.name === 'InvalidStateError') {
    return {code: 'storage-unavailable', message: '浏览器禁止或无法使用本机存储，保存失败；请导出当前进度。'};
  }
  return {code: error?.code || 'storage-error', message: error?.message || '本机存储不可用，请导出当前进度。'};
}
function failure(code, message) { return Object.assign(new Error(message), {code}); }

/**
 * Options: getStorage, validate (must return a current-schema clone), locks (Web Locks
 * compatible), gameVersion, dataVersion, now, writerId, onChange, getState,
 * channelFactory (null disables cooperative takeover), eventTarget.
 *
 * No timers advance gameplay or save behind the caller's back. The app owns
 * autosave, visibility/pagehide, and pauses simulation whenever mode != writer.
 */
export function createEAPersistence(options = {}) {
  const {
    getStorage = () => globalThis.localStorage,
    validate,
    locks = globalThis.navigator?.locks,
    gameVersion = '0.5.0-ea',
    dataVersion = 5,
    now = () => Date.now(),
    writerId = globalThis.crypto?.randomUUID?.() || 'window-' + Math.random().toString(36).slice(2),
    onChange,
    getState,
    maxImportBytes = MAX_IMPORT_BYTES,
    takeoverTimeoutMs = 1500,
    eventTarget = typeof window === 'undefined' ? null : window,
    channelFactory = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? name => new BroadcastChannel(name) : null,
  } = options;
  const namespace=options.namespace||EA_SAVE_PREFIX;
  const scopedKeys=slot=>slotKeys(slot,namespace);
  if (typeof validate !== 'function') throw new TypeError('存档模块需要传入模拟器的 validate 函数。');
  const listeners = new Set(typeof onChange === 'function' ? [onChange] : []);
  let activeSlot = null, mode = 'readonly', blocked = true, known = UNREAD;
  let savedAt = null, status = '尚未打开世界档', lastResult = null, closed = false;
  let generation = 0, held = false, heldRelease = null, heldPromise = Promise.resolve();
  let channel = null, preserveCounter = 0;
  const takeoverWaiters = new Map();

  function emit() {
    const event = {slot: activeSlot, mode, blocked, status, savedAt, result: lastResult};
    for (const listener of listeners) { try { listener(event); } catch { /* UI cannot prevent lock release. */ } }
  }
  function result(ok, code, message, extra = {}) {
    lastResult = {ok, code, message, ...extra};
    status = message;
    emit();
    return lastResult;
  }
  function storage() {
    const value = getStorage();
    if (!value || typeof value.getItem !== 'function' || typeof value.setItem !== 'function') {
      throw failure('storage-unavailable', '本机存储不可用，请导出当前进度。');
    }
    return value;
  }
  function validState(input) {
    if (!isObject(input) || !Number.isInteger(stateVersion(input)) || stateVersion(input) < 1 || stateVersion(input) > dataVersion) {
      throw failure('unsupported-version', '不支持这个存档的数据版本。');
    }
    const state = validate(clone(input));
    if (!isObject(state) || stateVersion(state) !== dataVersion || typeof state.then === 'function') {
      throw failure('invalid-state', '模拟器未返回有效的当前版本存档。');
    }
    stringify(state);
    return state;
  }
  function metadata(state, envelope = {}) {
    const master = state.master || {};
    const realmValue = master.realm ?? state.disciples?.[0]?.realm ?? 1;
    return {
      savedAt: envelope.savedAt ?? null,
      leader: typeof master.name === 'string' ? master.name : '掌门',
      sect: typeof state.sect?.name === 'string' ? state.sect.name : '云岫别院',
      realm: typeof master.realmName === 'string' ? master.realmName :
        (Number(realmValue) >= 10 ? (['筑基初期', '筑基中期', '筑基后期'][Number(realmValue) - 10] || '筑基期') : `炼气${realmValue}层`),
      realmValue,
      day: Math.floor((Number(state.time) || 0) / 120) + 1,
      time: Number(state.time) || 0,
      people: Array.isArray(state.disciples) ? state.disciples.length : 0,
      buildings: Array.isArray(state.buildings) ? state.buildings.length : 0,
      gameVersion: typeof envelope.gameVersion === 'string' ? envelope.gameVersion : '旧版',
      dataVersion: envelope.dataVersion ?? stateVersion(state),
      revision: envelope.revision ?? 0,
      checkpoint: envelope.checkpoint || null,
    };
  }
  function decode(raw, {nativeOnly = false, checkSize = true} = {}) {
    if (typeof raw !== 'string' || !raw.trim()) throw failure('invalid-format', '存档为空或格式不正确。');
    if (checkSize && (raw.length > maxImportBytes || byteLength(raw) > maxImportBytes)) {
      throw failure('file-too-large', `存档文件过大，最大允许 ${Math.floor(maxImportBytes / 1024)} KB。`);
    }
    let data;
    try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch { throw failure('invalid-json', '存档不是有效的 JSON 文件。'); }
    if (!isObject(data)) throw failure('invalid-format', '存档必须是完整的游戏档案。');
    if (data.format === PACKED_SAVE_FORMAT) {
      try { data = JSON.parse(unpackSave(data, maxImportBytes)); }
      catch (error) { throw failure(error instanceof RangeError ? 'file-too-large' : 'invalid-format', error.message); }
      if (!isObject(data)) throw failure('invalid-format', '压缩存档不是完整的游戏档案。');
    }
    let input, envelope = {}, sourceFormat;
    if (data.format === SAVE_FORMAT) {
      if (data.formatVersion !== FORMAT_VERSION || !finiteTime(data.savedAt) ||
          !Number.isSafeInteger(data.revision) || data.revision < 0 ||
          !SLOT_IDS.includes(data.slot) || typeof data.writerId !== 'string' || data.writerId.length > 200 ||
          typeof data.gameVersion !== 'string' || data.gameVersion.length > 80 ||
          !Number.isInteger(data.dataVersion) || data.dataVersion !== stateVersion(data.state) ||
          (data.checkpoint !== null && data.checkpoint !== undefined &&
           (typeof data.checkpoint !== 'string' || data.checkpoint.length > 120))) {
        throw failure('invalid-format', 'EA 存档封装或元信息异常。');
      }
      input = data.state; envelope = data; sourceFormat = 'ea';
    } else if (!nativeOnly && data.format === 1) {
      if (!finiteTime(data.savedAt) || !isObject(data.state)) throw failure('invalid-format', '旧存档封装异常。');
      input = data.state; envelope = {savedAt: data.savedAt, dataVersion: stateVersion(data.state)}; sourceFormat = 'legacy';
    } else if (!nativeOnly && data.format === undefined && Number.isInteger(stateVersion(data))) {
      input = data; envelope = {dataVersion: stateVersion(data)}; sourceFormat = 'state';
    } else if (data.format === 'xianfu-ea-recovery') {
      throw failure('recovery-bundle', '这是原始档案恢复资料包，请选择其中的有效游戏档案导入。');
    } else throw failure('invalid-format', '这不是受支持的仙府存档格式。');
    const sourceVersion = stateVersion(input);
    const state = validState(input);
    return {state, meta: metadata(state, envelope), envelope, sourceVersion,
      migrated: sourceVersion !== dataVersion, sourceFormat};
  }
  function tryDecode(raw, config) {
    try { return {valid: true, ...decode(raw, config)}; }
    catch (error) { return {valid: false, error: readableError(error).message, code: error.code || 'invalid-state'}; }
  }
  function readIndex(raw, format) {
    if (raw === null) return {entries: [], corrupt: false};
    try {
      const value = JSON.parse(raw);
      if (!isObject(value) || value.format !== format || value.formatVersion !== FORMAT_VERSION ||
          !Array.isArray(value.entries) || !value.entries.every(entry => isObject(entry) &&
          typeof entry.id === 'string' && entry.id.length < 200 && typeof entry.raw === 'string')) throw new Error();
      if (new Set(value.entries.map(entry => entry.id)).size !== value.entries.length) throw new Error();
      return {entries: value.entries, corrupt: false};
    } catch { return {entries: [], corrupt: true, raw}; }
  }
  function sourceItem(entry, nativeOnly = true) {
    const decoded = tryDecode(entry.raw, {nativeOnly});
    return {id: entry.id, valid: decoded.valid, meta: decoded.meta || null, error: decoded.error || null,
      migrated: decoded.migrated || false, reason: entry.reason || null, createdAt: entry.createdAt ?? null};
  }
  function readLegacy(store) {
    if(namespace!==EA_SAVE_PREFIX)return {entries:[],candidates:[]};
    const entries = [
      {id: 'legacy-primary', raw: store.getItem(LEGACY_SAVE_KEY)},
      {id: 'legacy-backup', raw: store.getItem(LEGACY_BACKUP_KEY)},
    ].filter(item => item.raw !== null);
    return {entries, candidates: entries.map(entry => sourceItem(entry, false))};
  }
  function inspect(slot, {primaryRaw = UNREAD} = {}) {
    slot = Number(slot); const keys = scopedKeys(slot);
    const view = {slot, status: 'empty', state: null, meta: null, backups: [], preserved: [], migration: null, error: null, warning: null};
    try {
      const store = storage(), raw = primaryRaw === UNREAD ? store.getItem(keys.primary) : primaryRaw;
      const backupsRaw = store.getItem(keys.backups), preservedRaw = store.getItem(keys.preserved);
      const backups = readIndex(backupsRaw, BACKUP_FORMAT), preserved = readIndex(preservedRaw, PRESERVED_FORMAT);
      view.backups = backups.entries.map(entry => sourceItem(entry));
      view.preserved = preserved.entries.map(entry => sourceItem(entry, false));
      if (backups.corrupt || preserved.corrupt || view.backups.some(item => !item.valid)) {
        view.warning = '部分备份资料损坏，原文仍保留，可导出恢复资料包。';
      }
      if (raw !== null) {
        const decoded = tryDecode(raw, {nativeOnly: true});
        if (decoded.valid) {
          view.meta = decoded.meta;
          if (decoded.migrated) {
            view.status = 'migration-available';
            view.migration = {kind: 'slot', suggestedSource: 'primary', candidates: [{id: 'primary', valid: true, meta: decoded.meta}]};
          } else { view.status = 'ready'; view.state = decoded.state; }
        } else { view.status = 'recovery-required'; view.error = decoded.error; }
      } else if (backupsRaw !== null || preservedRaw !== null) {
        view.status = 'recovery-required'; view.error = '主档缺失，已保留备份和原始资料；请选择恢复来源。';
      } else if (slot === 1) {
        const legacy = readLegacy(store);
        if (legacy.entries.length) {
          const suggested = legacy.candidates.find(item => item.valid);
          view.migration = {kind: 'legacy', suggestedSource: suggested?.id || null, candidates: legacy.candidates};
          view.meta = suggested?.meta || null;
          view.status = legacy.candidates.some(item => item.valid) ? 'migration-available' : 'recovery-required';
          if (view.status === 'recovery-required') view.error = '旧版主档与备份无法读取，原始内容仍保留，可导出恢复资料包。';
        }
      }
      return view;
    } catch (error) {
      return {...view, status: 'unavailable', error: readableError(error).message};
    }
  }
  function listSlots() { return SLOT_IDS.map(inspect).map(({state: _state, ...view}) => view); }

  // Preserved files are immutable and never rotated out. Failure to preserve
  // (including a full disk) stops replacement/migration before primary changes.
  function preserve(store, slot, raw, reason, source) {
    if (raw === null) return;
    const key = scopedKeys(slot).preserved;
    const current = store.getItem(key), index = readIndex(current, PRESERVED_FORMAT);
    if (index.corrupt) throw failure('archive-corrupt', '原始资料保留区损坏，无法安全替换；请先导出恢复资料包。');
    if (index.entries.some(entry => entry.raw === raw)) return;
    const id = 'preserved-' + now() + '-' + (++preserveCounter) + '-' + fingerprint(raw);
    const next = stringify({format: PRESERVED_FORMAT, formatVersion: FORMAT_VERSION,
      entries: [...index.entries, {id, raw, reason, source, createdAt: now()}]});
    store.setItem(key, next);
    if (store.getItem(key) !== next) throw failure('verification-failed', '原始资料备份未能读回，已停止替换主档。');
  }
  function deactivate(message = '已释放世界，其他窗口可接管') {
    held = false; mode = 'readonly'; blocked = true;
    const releaseLock = heldRelease; heldRelease = null;
    status = message; emit();
    if (releaseLock) releaseLock();
  }
  function conflict(message = '另一窗口已更新这个世界，请重新打开最新档案。') {
    deactivate(message);
    return result(false, 'conflict', message);
  }
  function checkWriter(slot = activeSlot, allowBlocked = false) {
    if (closed) throw failure('closed', '存档服务已经关闭。');
    if (!held || mode !== 'writer' || activeSlot !== Number(slot)) {
      throw failure(mode === 'unsafe' ? 'locks-unavailable' : 'not-writer',
        mode === 'unsafe' ? '此浏览器缺少安全的多窗口写入锁，当前只读；可导出存档。' : '另一窗口正在游玩，当前窗口不能推进或保存。');
    }
    if ((!allowBlocked && blocked) || known === UNREAD) {
      throw failure('recovery-required', '档案需要先迁移或选择恢复来源，尚未允许覆盖。');
    }
    const store = storage();
    if (store.getItem(scopedKeys(slot).primary) !== known) {
      conflict(); throw failure('conflict', '检测到外部更新，已停止写入，请重新打开最新档案。');
    }
    return store;
  }
  function envelope(state, slot, revision, checkpoint = null) {
    if (checkpoint !== null && (typeof checkpoint !== 'string' || checkpoint.length > 120)) {
      throw failure('invalid-checkpoint', '检查点名称无效。');
    }
    const time = now();
    if (!finiteTime(time)) throw failure('invalid-time', '系统保存时间无效。');
    return {format: SAVE_FORMAT, formatVersion: FORMAT_VERSION, slot, savedAt: time,
      dataVersion, gameVersion, revision, writerId, checkpoint, state};
  }
  function commit(input, {allowBlocked = false, reason = null, checkpoint = null, expectedSlot = activeSlot} = {}) {
    try {
      const store = checkWriter(expectedSlot, allowBlocked), keys = scopedKeys(activeSlot), state = validState(input);
      const current = known === null ? null : tryDecode(known, {nativeOnly: true});
      const backupsRaw = store.getItem(keys.backups), backupIndex = readIndex(backupsRaw, BACKUP_FORMAT);
      const validBackups = [], invalidBackups = [];
      for (const entry of backupIndex.entries) {
        (tryDecode(entry.raw, {nativeOnly: true}).valid ? validBackups : invalidBackups).push(entry);
      }
      const revisions = validBackups.map(entry => decode(entry.raw, {nativeOnly: true}).meta.revision);
      const revision = Math.max(0, current?.valid ? current.meta.revision : 0, ...revisions) + 1;
      if (!Number.isSafeInteger(revision)) throw failure('invalid-revision', '档案修订号超出允许范围。');
      const payload = envelope(state, activeSlot, revision, checkpoint);
      const plain = stringify(payload);
      if (byteLength(plain) > maxImportBytes) throw failure('file-too-large', '当前存档过大，无法安全保存；请导出当前进度。');
      const next = compactStorage(plain, maxImportBytes);
      if (byteLength(next) > maxImportBytes) throw failure('file-too-large', '当前存档过大，无法安全保存；请导出当前进度。');

      if (reason && known !== null) preserve(store, activeSlot, known, reason, 'primary');
      if (current && !current.valid) preserve(store, activeSlot, known, 'damaged-primary', 'primary');
      if (backupIndex.corrupt) preserve(store, activeSlot, backupsRaw, 'damaged-backup-index', 'backups');
      for (const entry of invalidBackups) preserve(store, activeSlot, entry.raw, 'damaged-backup', entry.id);
      const entries = [];
      if (current?.valid) entries.push({id: 'backup-' + current.meta.revision + '-' + fingerprint(known), raw: compactStorage(known, maxImportBytes)});
      for (const entry of validBackups) if (!entries.some(item => item.raw === entry.raw)) entries.push(entry);
      entries.splice(3);
      const backupsNext = stringify({format: BACKUP_FORMAT, formatVersion: FORMAT_VERSION, entries});
      // localStorage has no multi-key transaction. Writing recoverable copies
      // first ensures failure never destroys the last committed primary.
      if (backupsNext !== backupsRaw && (entries.length || backupsRaw !== null)) {
        store.setItem(keys.backups, backupsNext);
        if (store.getItem(keys.backups) !== backupsNext) throw failure('verification-failed', '滚动备份未能读回，已停止提交主档。');
      }
      if (!held || mode !== 'writer' || store.getItem(keys.primary) !== known) {
        return conflict('提交前发现存档已改变，已停止写入，请重新打开最新档案。');
      }
      store.setItem(keys.primary, next);
      if (store.getItem(keys.primary) !== next) {
        blocked = true;
        throw failure('verification-failed', '保存后无法确认写入结果，未报告保存成功；请导出当前进度。');
      }
      known = next; blocked = false;
      const meta = metadata(state, payload);
      savedAt = meta.savedAt;
      return result(true, 'saved', '已保存于 ' + new Date(savedAt).toLocaleTimeString(), {meta});
    } catch (error) {
      const detail = readableError(error);
      return result(false, detail.code, detail.message);
    }
  }
  function save(state, config = {}) { return commit(state, {checkpoint: config.checkpoint ?? null}); }

  async function acquire(slot, ticket) {
    let announce;
    const acquired = new Promise(resolve => { announce = resolve; });
    try {
      const request = locks.request(scopedKeys(slot).lock, {mode: 'exclusive', ifAvailable: true}, lock => {
        if (!lock || closed || ticket !== generation) {
          announce({ok: false, code: ticket !== generation ? 'superseded' : 'not-writer'});
          return;
        }
        held = true;
        const lifetime = new Promise(resolve => { heldRelease = resolve; });
        announce({ok: true});
        return lifetime;
      });
      const settled = Promise.resolve(request).catch(error => {
        announce({ok: false, code: 'locks-unavailable', error});
        if (ticket === generation && held) deactivate('窗口写入锁已失效，已停止推进；请重新打开世界。');
      });
      heldPromise = settled;
    } catch (error) { announce({ok: false, code: 'locks-unavailable', error}); }
    return acquired;
  }
  function post(message) { try { channel?.postMessage(message); return Boolean(channel); } catch { return false; } }
  async function requestTakeover(slot, ticket) {
    const id = writerId + ':' + ticket + ':' + now();
    if (!channel) return false;
    let timer;
    const answer = new Promise(resolve => {
      takeoverWaiters.set(id, resolve);
      timer = setTimeout(() => resolve(false), Math.max(10, takeoverTimeoutMs));
    });
    if (!post({type: 'takeover', slot, requestId: id, requester: writerId})) takeoverWaiters.get(id)?.(false);
    const released = await answer;
    clearTimeout(timer); takeoverWaiters.delete(id);
    return released;
  }
  async function open(slot, {takeover = false} = {}) {
    slot = Number(slot); scopedKeys(slot);
    if (closed) return result(false, 'closed', '存档服务已经关闭。', {mode, ...inspect(slot)});
    const ticket = ++generation;
    deactivate('正在读取世界档案');
    const previous = heldPromise;
    activeSlot = slot; known = UNREAD; savedAt = null;
    await previous;
    if (ticket !== generation || closed) return {ok: false, code: 'superseded', mode: 'readonly'};
    if (!locks || typeof locks.request !== 'function') {
      mode = 'unsafe'; blocked = true;
      return result(false, 'locks-unavailable', '此浏览器缺少安全的多窗口写入锁，当前只读；可查看并导出存档。', {mode, ...inspect(slot)});
    }
    let lock = await acquire(slot, ticket);
    if (!lock.ok && takeover && lock.code === 'not-writer') {
      const takeoverResult = await requestTakeover(slot, ticket);
      if (takeoverResult?.code && ticket === generation && !closed) {
        mode = 'readonly'; blocked = true;
        return result(false, takeoverResult.code, takeoverResult.message, {mode, ...inspect(slot)});
      }
      if (ticket === generation && !closed) lock = await acquire(slot, ticket);
    }
    if (ticket !== generation || closed) return {ok: false, code: 'superseded', mode: 'readonly'};
    if (!lock.ok) {
      mode = lock.code === 'locks-unavailable' ? 'unsafe' : 'readonly';
      blocked = true;
      return result(false, lock.code, mode === 'unsafe' ? '浏览器无法取得安全写入锁，当前只读；可导出存档。' :
        '另一窗口正在游玩；请请求接管，或关闭原窗口后重试。', {mode, ...inspect(slot)});
    }
    try { known = storage().getItem(scopedKeys(slot).primary); }
    catch (error) {
      deactivate(); const detail = readableError(error);
      return result(false, detail.code, detail.message, {mode, ...inspect(slot)});
    }
    // Decode the exact head used by subsequent optimistic writes. Another,
    // noncooperating window must not change the head between decode and record.
    const view = inspect(slot, {primaryRaw: known});
    try {
      if (!held || storage().getItem(scopedKeys(slot).primary) !== known) {
        deactivate();
        return result(false, 'conflict', '读取期间档案已被另一窗口更新，请重新打开最新世界。', {mode, ...inspect(slot)});
      }
    } catch (error) {
      deactivate(); const detail = readableError(error);
      return result(false, detail.code, detail.message, {mode, ...view});
    }
    mode = 'writer'; blocked = !['ready', 'empty'].includes(view.status);
    savedAt = view.meta?.savedAt ?? null;
    const message = view.status === 'ready' ? '已恢复本机存档' : view.status === 'empty' ? '世界档案已就绪，等待首次保存' :
      view.status === 'migration-available' ? '发现旧版档案，请先备份迁移' : (view.error || '请选择有效备份恢复');
    return result(!blocked, blocked ? view.status : 'opened', message, {mode, ...view});
  }
  async function ensureWriter(slot) {
    slot = Number(slot); scopedKeys(slot);
    if (activeSlot !== slot || !held || mode !== 'writer') await open(slot);
    return checkWriter(slot, true);
  }
  async function replace(slot, state, {confirmed = false, checkpoint = '替换世界'} = {}) {
    if (!confirmed) return result(false, 'confirmation-required', '请明确确认要替换的世界档案。');
    try { await ensureWriter(slot); }
    catch (error) { const detail = readableError(error); return result(false, detail.code, detail.message); }
    return commit(state, {allowBlocked: true, reason: 'before-replace', checkpoint, expectedSlot: Number(slot)});
  }
  function parseImport(text) {
    try {
      const decoded = decode(text);
      return {ok: true, state: decoded.state, meta: decoded.meta, sourceVersion: decoded.sourceVersion,
        migrated: decoded.migrated, sourceFormat: decoded.sourceFormat};
    } catch (error) { const detail = readableError(error); return {ok: false, ...detail, error: detail.message}; }
  }
  async function importInto(slot, text, {confirmed = false} = {}) {
    const parsed = parseImport(text);
    if (!parsed.ok) return result(false, parsed.code, parsed.message);
    if (!confirmed) return result(false, 'confirmation-required', '请确认目标档位和即将替换的档案。', {meta: parsed.meta});
    try {
      const store = await ensureWriter(slot);
      checkWriter(slot, true);
      if (parsed.migrated) preserve(store, Number(slot), text, 'before-import-migration', 'import');
    } catch (error) { const detail = readableError(error); return result(false, detail.code, detail.message); }
    const saved = commit(parsed.state, {allowBlocked: true, reason: 'before-import', checkpoint: '导入档案', expectedSlot: Number(slot)});
    return saved.ok ? {...saved, state: clone(parsed.state)} : saved;
  }
  async function recover(slot, sourceId) {
    try {
      const store = await ensureWriter(slot), keys = scopedKeys(slot);
      checkWriter(slot, true);
      const backups = readIndex(store.getItem(keys.backups), BACKUP_FORMAT);
      const preserved = readIndex(store.getItem(keys.preserved), PRESERVED_FORMAT);
      const source = [...backups.entries, ...preserved.entries].find(entry => entry.id === sourceId);
      if (!source) throw failure('source-not-found', '所选备份不存在，请重新查看恢复列表。');
      const decoded = decode(source.raw);
      preserve(store, Number(slot), source.raw, decoded.migrated ? 'before-recovery-migration' : 'recovery-source', sourceId);
      const saved = commit(decoded.state, {allowBlocked: true, reason: 'before-recovery', checkpoint: '恢复备份', expectedSlot: Number(slot)});
      return saved.ok ? {...saved, state: decoded.state} : saved;
    } catch (error) { const detail = readableError(error); return result(false, detail.code, detail.message); }
  }
  async function migrateLegacy(slot, {source = 'legacy-primary', confirmed = false} = {}) {
    try {
      const store = await ensureWriter(slot), keys = scopedKeys(slot);
      checkWriter(slot, true);
      const own = store.getItem(keys.primary);
      let sourceRaw;
      if (source === 'primary') {
        sourceRaw = own;
        if (sourceRaw === null) throw failure('source-not-found', '本档位没有可迁移的主档。');
      } else {
        if (!['legacy-primary', 'legacy-backup'].includes(source)) throw failure('source-not-found', '旧档来源无效。');
        if (own !== null && !confirmed) throw failure('confirmation-required', '目标档位已有档案，请确认替换或选择空档位。');
        const legacy = readLegacy(store);
        sourceRaw = legacy.entries.find(entry => entry.id === source)?.raw;
        if (sourceRaw === undefined) throw failure('source-not-found', '所选旧档不存在；可在恢复列表选择另一份。');
        for (const entry of legacy.entries) preserve(store, Number(slot), entry.raw, 'before-migration', entry.id);
      }
      preserve(store, Number(slot), sourceRaw, 'before-migration', source);
      const decoded = decode(sourceRaw);
      const saved = commit(decoded.state, {allowBlocked: true, reason: 'before-migration-replace', checkpoint: '版本迁移', expectedSlot: Number(slot)});
      return saved.ok ? {...saved, state: decoded.state} : saved;
    } catch (error) { const detail = readableError(error); return result(false, detail.code, detail.message); }
  }
  function exportState(state, {slot = activeSlot || 1} = {}) {
    slot = Number(slot); scopedKeys(slot);
    return stringify(envelope(validState(state), slot, 0));
  }
  function exportSlot(slot, {source = 'primary'} = {}) {
    const store = storage(), keys = scopedKeys(slot);
    let raw;
    if (source === 'primary' || source === 'raw') raw = store.getItem(keys.primary);
    else if (source === 'legacy-primary') raw = store.getItem(LEGACY_SAVE_KEY);
    else if (source === 'legacy-backup') raw = store.getItem(LEGACY_BACKUP_KEY);
    else {
      const entries = [...readIndex(store.getItem(keys.backups), BACKUP_FORMAT).entries,
        ...readIndex(store.getItem(keys.preserved), PRESERVED_FORMAT).entries];
      raw = entries.find(entry => entry.id === source)?.raw;
    }
    if (raw === null || raw === undefined) throw failure('source-not-found', '这个档位没有所选的存档内容。');
    return raw;
  }
  function exportBundle(slot) {
    const store = storage(), keys = scopedKeys(slot);
    return JSON.stringify({format: 'xianfu-ea-recovery', formatVersion: FORMAT_VERSION, exportedAt: now(), slot: Number(slot),
      raw: {primary: store.getItem(keys.primary), backups: store.getItem(keys.backups), preserved: store.getItem(keys.preserved)},
      legacy: {primary: store.getItem(LEGACY_SAVE_KEY), backup: store.getItem(LEGACY_BACKUP_KEY)}}, null, 2);
  }
  function release(config = {}) {
    let saved = null;
    if (Object.hasOwn(config, 'state') && held && mode === 'writer' && !blocked) saved = save(config.state);
    ++generation;
    deactivate(config.reason === 'takeover' ? '另一窗口已请求接管，本窗口已暂停' : '已释放世界，其他窗口可接管');
    return saved || {ok: true, code: 'released', message: status};
  }
  function close(config = {}) {
    const outcome = release(config);
    closed = true;
    for (const resolve of takeoverWaiters.values()) resolve(false);
    takeoverWaiters.clear();
    try { channel?.close(); } catch { /* no durable state depends on broadcasts */ }
    eventTarget?.removeEventListener?.('storage', storageChanged);
    listeners.clear();
    return outcome;
  }
  async function channelMessage(event) {
    const message = event?.data;
    if (!isObject(message) || message.requester === writerId) return;
    if (message.type === 'released' && message.recipient === writerId) {
      takeoverWaiters.get(message.requestId)?.(true); return;
    }
    if (message.type === 'takeover-denied' && message.recipient === writerId) {
      takeoverWaiters.get(message.requestId)?.({code: 'takeover-denied', message:
        '原窗口的最新进度未能安全保存，接管已停止。请在原窗口重试保存或导出当前进度。'}); return;
    }
    if (message.type !== 'takeover' || Number(message.slot) !== activeSlot || !held || mode !== 'writer') return;
    let finalState, outcome;
    try {
      if (typeof getState === 'function') finalState = getState();
      if (finalState !== undefined) outcome = save(finalState);
    } catch (error) {
      const detail = readableError(error);
      outcome = result(false, detail.code, detail.message);
    }
    // A cooperative takeover must not discard the owner's only current copy.
    // Keep the lock and memory intact when serialization or durable save fails.
    if (outcome && !outcome.ok) {
      post({type: 'takeover-denied', requestId: message.requestId, recipient: message.requester,
        requester: writerId, slot: activeSlot});
      return;
    }
    release({reason: 'takeover'});
    await heldPromise;
    post({type: 'released', requestId: message.requestId, recipient: message.requester, requester: writerId, slot: activeSlot});
  }
  function storageChanged(event) {
    if (!held || activeSlot === null || (event.key !== null && event.key !== scopedKeys(activeSlot).primary)) return;
    try {
      if (storage().getItem(scopedKeys(activeSlot).primary) !== known) conflict();
    } catch { deactivate('本机存储读取失败，已暂停写入；请导出当前进度。'); }
  }
  try {
    channel = typeof channelFactory === 'function' ? channelFactory(namespace + 'coordination') : null;
    if (channel?.addEventListener) channel.addEventListener('message', channelMessage);
    else if (channel) channel.onmessage = channelMessage;
  } catch { channel = null; }
  eventTarget?.addEventListener?.('storage', storageChanged);

  return {
    listSlots, inspect, open, save, saveNow: save, replace, recover, migrateLegacy,
    parseImport, importInto, exportState, exportSlot, exportBundle, release, close,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get activeSlot() { return activeSlot; },
    get mode() { return mode; },
    get blocked() { return blocked; },
    get canWrite() { return held && mode === 'writer' && !blocked && !closed; },
    get savedAt() { return savedAt; },
    get status() { return status; },
    get lastResult() { return lastResult; },
    // Opaque equality token for restoring a parked BFCache snapshot. Callers
    // must never auto-save old memory over a different head after reopening.
    captureHead() { return known === UNREAD ? null : {slot: activeSlot, raw: known}; },
    matchesHead(token) { return Boolean(token && known !== UNREAD && token.slot === activeSlot && token.raw === known); },
  };
}
