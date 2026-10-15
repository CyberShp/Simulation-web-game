const fs = require('node:fs/promises');
const path = require('node:path');

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
module.exports = { exportCourtyardRecovery };
