// Local storage uses a compact envelope; downloaded saves stay ordinary JSON.
// Pako 1.0.11 is bundled in vendor/ under its MIT license for synchronous saves.
import './vendor/pako.mjs?v=ea-160-courtyard-20261008-r30';

export const PACKED_SAVE_FORMAT = 'xianfu-ea-storage-deflate';
const codec = globalThis.pako;
const encoder = new TextEncoder();

function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

export function packSave(raw) {
  const compressed = codec.deflate(raw);
  return JSON.stringify({format: PACKED_SAVE_FORMAT, formatVersion: 1,
    uncompressedBytes: encoder.encode(raw).length, data: base64(compressed)});
}

export function unpackSave(value, maxBytes) {
  if (value?.format !== PACKED_SAVE_FORMAT) return null;
  if (value.formatVersion !== 1 || !Number.isSafeInteger(value.uncompressedBytes) ||
      value.uncompressedBytes < 0 || typeof value.data !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)) throw new Error('压缩存档封装异常。');
  if (value.uncompressedBytes > maxBytes) throw new RangeError('压缩存档超过允许大小。');
  const binary = atob(value.data), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const chunks = [];
  let length = 0;
  const inflater = new codec.Inflate({to: 'string', chunkSize: 65536});
  inflater.onData = chunk => {
    length += chunk.length;
    if (length > maxBytes) throw new RangeError('压缩存档超过允许大小。');
    chunks.push(chunk);
  };
  inflater.push(bytes, true);
  if (inflater.err) throw new Error('压缩存档内容损坏。');
  const raw = chunks.join('');
  if (encoder.encode(raw).length !== value.uncompressedBytes) throw new Error('压缩存档长度不一致。');
  return raw;
}
