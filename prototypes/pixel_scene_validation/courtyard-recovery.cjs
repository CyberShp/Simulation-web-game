const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const LIMIT = 8 * 1024 * 1024;

/** Write a separate recovery file; never overwrite the live save or another file. */
async function exportCourtyardRecovery({ filename, state, saveFilename, validate, io = fs }) {
  if (!path.isAbsolute(filename) || path.resolve(filename) === path.resolve(saveFilename)) {
    return { ok: false, error: '恢复文件须另存到新的文件，不能覆盖当前存档。' };
  }
  let handle;
  try {
    if (await validate(state) !== true) throw Error('恢复文件内容无效。');
    const bytes = Buffer.from(JSON.stringify(state, null, 2) + '\n');
    if (bytes.byteLength > 8 * 1024 * 1024) throw Error('恢复文件超过8 MiB限制。');
    handle = await io.open(filename, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close(); handle = null;
    return { ok: true, path: filename };
  } catch (error) {
    if (handle) { await handle.close().catch(() => {}); await io.unlink(filename).catch(() => {}); }
    return { ok: false, error: error.code === 'EEXIST' ? '该文件已存在，请选择新文件名，避免覆盖已有进度。' : error.message };
  }
}
/** Preview a bounded, validated session without touching the current save. */
async function readCourtyardRecovery({ filename, validate, io = fs }) {
  let handle;
  try {
    handle = await io.open(filename, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > LIMIT) throw Error('请选择8 MiB以内的山院恢复文件。');
    const buffer = Buffer.alloc(LIMIT + 1);
    let length = 0;
    while (length < buffer.length) {
      const chunk = await handle.read(buffer, length, buffer.length - length, null);
      if (!chunk.bytesRead) break;
      length += chunk.bytesRead;
    }
    if (length > LIMIT) throw Error('恢复文件超过8 MiB限制。');
    const data = JSON.parse(buffer.subarray(0, length).toString('utf8'));
    if (await validate(data) !== true) throw Error('恢复文件内容或版本无效。');
    return { ok: true, data };
  } catch (error) { return { ok: false, error: error.message }; }
  finally { if (handle) await handle.close().catch(() => {}); }
}

/** Preserve both disk and unsaved memory before the explicit restore commits. */
async function restoreCourtyardRecovery({ data, previousState, storage, validate, io = fs }) {
  const backups = [];
  try {
    if (await validate(data) !== true) throw Error('恢复文件内容或版本无效。');
    const directory = path.dirname(storage.filename), suffix = `${Date.now()}-${randomUUID()}`;
    await io.mkdir(directory, { recursive: true });
    await storage.flush();
    if (previousState) {
      const memory = path.join(directory, `before-recovery-memory-${suffix}.json`);
      const result = await exportCourtyardRecovery({ filename: memory, state: previousState,
        saveFilename: storage.filename, validate, io });
      if (!result.ok) throw Error('当前进度备份失败：'+result.error);
      backups.push(memory);
    }
    const disk = path.join(directory, `before-recovery-disk-${suffix}.json`);
    try { await io.copyFile(storage.filename, disk, 1); backups.push(disk); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const result = await storage.save(data);
    if (!result.ok) throw Error(result.error || '恢复存档写入失败。');
    return { ok: true, data, backups };
  } catch (error) { return { ok: false, error: error.message, backups }; }
}

module.exports = { exportCourtyardRecovery, readCourtyardRecovery, restoreCourtyardRecovery };
