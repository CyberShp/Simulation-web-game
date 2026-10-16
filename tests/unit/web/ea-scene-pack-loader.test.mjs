import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installScenePackLoader} from '../../../archive/godot/estate_3d/web/scene-pack-loader.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const bytes = Uint8Array.from([0, 71, 68, 80, 255, 2, 128, 9, 17]);
  const chunks = [bytes.slice(0, 4), bytes.slice(4, 7), bytes.slice(7)];
  const mainPack = 'scene-test.pck';
  return {
    bytes, chunks,
    configuration: {mainPack, scenePack: {
      byteLength: bytes.byteLength, sha256: sha256(bytes),
      parts: chunks.map((chunk, index) => ({
        url: `${mainPack}.part${index}`, byteLength: chunk.byteLength, sha256: sha256(chunk),
      })),
    }},
  };
}

test('verified scene parts reach the engine as identical bytes at the main pack path', async t => {
  const {bytes, chunks, configuration} = fixture();
  const fetched = [], calls = [], progress = [], result = {preloaded: true};
  const engine = {
    async preloadFile(file, path) {
      assert.equal(this, engine);
      calls.push({file, path});
      return result;
    },
  };
  t.mock.method(globalThis, 'fetch', async url => {
    fetched.push(url);
    const index = configuration.scenePack.parts.findIndex(part => part.url === url);
    assert.ok(index >= 0, 'fetch uses the listed static parts');
    return new Response(chunks[index]);
  });
  installScenePackLoader(engine, configuration, (loaded, total) => progress.push([loaded, total]));

  assert.equal(await engine.preloadFile(configuration.mainPack, configuration.mainPack), result);
  assert.deepEqual(fetched, configuration.scenePack.parts.map(part => part.url));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].file instanceof ArrayBuffer);
  assert.deepEqual(new Uint8Array(calls[0].file), bytes);
  assert.equal(calls[0].path, configuration.mainPack);
  assert.deepEqual(progress.at(-1), [bytes.byteLength, bytes.byteLength]);
});

test('damaged, missing, or incomplete scene parts reject before engine preload', async t => {
  let reply;
  t.mock.method(globalThis, 'fetch', (...args) => reply(...args));
  for (const failure of ['part-hash', 'part-size', 'missing-part', 'whole-hash', 'whole-size']) {
    const {chunks, configuration} = fixture();
    let preloadCalls = 0;
    const engine = {async preloadFile() { preloadCalls++; }};
    if (failure === 'whole-hash') configuration.scenePack.sha256 = '0'.repeat(64);
    if (failure === 'whole-size') configuration.scenePack.byteLength++;
    reply = async url => {
      const index = configuration.scenePack.parts.findIndex(part => part.url === url);
      assert.ok(index >= 0);
      if (failure === 'missing-part' && index === 1) return new Response(null, {status: 404});
      const bytes = chunks[index].slice();
      if (failure === 'part-hash' && index === 1) bytes[0] ^= 0xff;
      if (failure === 'part-size' && index === 1) return new Response(bytes.slice(1));
      return new Response(bytes);
    };
    installScenePackLoader(engine, configuration);
    await assert.rejects(engine.preloadFile(configuration.mainPack, configuration.mainPack), /山院画卷/, failure);
    assert.equal(preloadCalls, 0, `${failure} must not reach the engine`);
  }
});

test('unconfigured engines and additional preloads retain the original method and arguments', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('pass-through must not fetch scene parts'); });
  const calls = [], result = {original: true};
  const engine = {
    async preloadFile(file, path) {
      assert.equal(this, engine);
      calls.push([file, path]);
      return result;
    },
  };
  const original = engine.preloadFile;
  installScenePackLoader(engine, {mainPack: 'legacy.pck'});
  assert.equal(engine.preloadFile, original);
  assert.equal(await engine.preloadFile('legacy.pck', 'legacy.pck'), result);

  installScenePackLoader(engine, fixture().configuration);
  const extraBuffer = Uint8Array.from([5, 9]).buffer;
  assert.equal(await engine.preloadFile('extra.bin', 'data/extra.bin'), result);
  assert.equal(await engine.preloadFile(extraBuffer, 'data/memory.bin'), result);
  assert.deepEqual(calls, [
    ['legacy.pck', 'legacy.pck'], ['extra.bin', 'data/extra.bin'], [extraBuffer, 'data/memory.bin'],
  ]);
});
