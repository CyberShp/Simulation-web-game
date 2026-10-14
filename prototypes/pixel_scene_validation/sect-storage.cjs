const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const SAVE_FILENAME = 'sect-save.json';
const MAX_SAVE_BYTES = 8 * 1024 * 1024;

function createSectStorage({ directory, validate, io = fs }) {
  if (!path.isAbsolute(directory)) throw new Error('Save directory must be absolute');
  if (typeof validate !== 'function') throw new Error('Save validator is required');
  const filename = path.join(directory, SAVE_FILENAME);
  let queue = Promise.resolve();

  const enqueue = operation => {
    const result = queue.then(operation).catch(error => ({ ok: false, error: error?.message || String(error) }));
    queue = result.then(() => undefined);
    return result;
  };
  const check = async state => {
    const result = await validate(state);
    if (result !== true && result?.ok !== true) throw new Error('Invalid sect save');
  };

  return {
    filename,
    flush: () => queue,
    load: () => enqueue(async () => {
      let handle;
      let bytes;
      try {
        handle = await io.open(filename, 'r');
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error('Sect save is not a regular file');
        if (stat.size > MAX_SAVE_BYTES) throw new Error('Sect save exceeds 8 MiB');
        const buffer = Buffer.alloc(MAX_SAVE_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
          const read = await handle.read(buffer, length, buffer.length - length, null);
          if (!read.bytesRead) break;
          length += read.bytesRead;
        }
        if (length > MAX_SAVE_BYTES) throw new Error('Sect save exceeds 8 MiB');
        bytes = buffer.subarray(0, length);
      } catch (error) {
        if (error.code === 'ENOENT' && !handle) return { ok: true, found: false };
        throw error;
      } finally {
        if (handle) await handle.close();
      }
      const data = JSON.parse(bytes.toString('utf8'));
      await check(data);
      return { ok: true, found: true, data };
    }),
    save: state => {
      // Capture the invocation state before an earlier disk write can delay this save.
      let snapshot;
      let captureError;
      try { snapshot = structuredClone(state); } catch (error) { captureError = error; }
      return enqueue(async () => {
        if (captureError) throw captureError;
        await check(snapshot);
        const serialized = JSON.stringify(snapshot);
        if (typeof serialized !== 'string') throw new Error('Sect save is not serializable');
        const bytes = Buffer.from(serialized, 'utf8');
        if (bytes.length > MAX_SAVE_BYTES) throw new Error('Sect save exceeds 8 MiB');
        // The file must validate after the same JSON conversion used on the next load.
        await check(JSON.parse(serialized));
        await io.mkdir(directory, { recursive: true });
        const temporary = path.join(directory, `.sect-save.${randomUUID()}.tmp`);
        let handle;
        try {
          handle = await io.open(temporary, 'wx', 0o600);
          await handle.writeFile(bytes);
          await handle.sync();
          await handle.close();
          handle = undefined;
          await io.rename(temporary, filename);
        } finally {
          if (handle) await handle.close().catch(() => {});
          await io.unlink(temporary).catch(() => {});
        }
        return { ok: true };
      });
    }
  };
}

module.exports = { createSectStorage, SAVE_FILENAME, MAX_SAVE_BYTES };
