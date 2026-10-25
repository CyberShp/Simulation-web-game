/** Text is only a bridge transport. The original storage owns validation/write. */
const { MAX_SAVE_BYTES } = require('./sect-storage.cjs');

function saveSerializedSect(storage, text) {
  try {
    if (typeof text !== 'string') throw new TypeError('Serialized sect save must be a string');
    if (Buffer.byteLength(text, 'utf8') > MAX_SAVE_BYTES) throw new Error('Sect save exceeds 8 MiB');
    return storage.save(JSON.parse(text));
  } catch (error) {
    return Promise.resolve({ ok: false, error: error?.message || String(error) });
  }
}

module.exports = { saveSerializedSect };
