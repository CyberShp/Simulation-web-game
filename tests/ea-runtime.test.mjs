import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeClock, createFrameDiagnostics, createAssetLoader} from '../dist/ea-runtime.mjs';

test('visibility suspension and long scheduling gaps never count absent time as simulation time', () => {
  const clock = createRuntimeClock();
  assert.equal(clock.next(100).dt, 0); assert.equal(clock.next(120).dt, .02);
  clock.suspend(); assert.equal(clock.next(500000).dt, 0);
  clock.resume(500010); assert.equal(clock.next(500030).dt, .02);
  assert.equal(clock.next(501100).dt, 0); assert.equal(clock.next(501120).dt, .02);
  assert.equal(clock.next(501500).dt, .25);
  clock.reset(); assert.equal(clock.next(900000).dt, 0);
  assert.equal(clock.next(NaN).dt, 0);
  assert.equal(clock.next(800000).dt, 0); assert.equal(clock.next(900020).dt, .02);
});

test('performance diagnostics exclude hidden/gap frames and report bounded actual samples', () => {
  const diagnostic = createFrameDiagnostics({sampleLimit: 40});
  diagnostic.record({elapsedMs: 9000, workMs: 2, visible: false});
  diagnostic.record({elapsedMs: 9000, workMs: 2, droppedGap: true});
  assert.equal(diagnostic.snapshot().samples, 0);
  for (let i = 0; i < 38; i++) diagnostic.record({elapsedMs: 20, workMs: 5});
  diagnostic.record({elapsedMs: 70, workMs: 20}); diagnostic.record({elapsedMs: 100, workMs: 40});
  const result = diagnostic.snapshot();
  assert.equal(result.ready, true); assert.equal(result.samples, 40);
  assert.equal(result.frameP95Ms, 20); assert.equal(result.workP95Ms, 5);
  assert.equal(result.slowFrames, 2); assert.ok(result.fps < 50 && result.fps > 40);
  diagnostic.record({elapsedMs: 30, workMs: 8}); assert.equal(diagnostic.snapshot().samples, 40);
  diagnostic.reset(); assert.equal(diagnostic.snapshot().ready, false);
});

test('asset failures settle independently, retry only failures, and coalesce concurrent retries', async () => {
  let groundCalls = 0, peopleCalls = 0;
  const loader = createAssetLoader({loaders: {
    ground: async () => { ++groundCalls; return {asset: 'ground'}; },
    people: async () => { if (++peopleCalls === 1) throw new Error('网络断开'); return {asset: 'people'}; },
  }});
  const first = await loader.load();
  assert.equal(first.ready, false); assert.deepEqual(first.failed, [{id: 'people', message: '网络断开'}]);
  assert.equal(loader.get('ground').asset, 'ground');
  const pending = loader.retry(); assert.equal(loader.retry(), pending);
  assert.equal((await pending).ready, true); assert.equal(groundCalls, 1); assert.equal(peopleCalls, 2);
  assert.equal(loader.get('people').asset, 'people');
  await loader.retry(); assert.equal(peopleCalls, 2);
});

test('timed-out assets cannot overwrite a successful retry with a late response', async () => {
  let lateResolve, calls = 0, signal;
  const loader = createAssetLoader({timeoutMs: 10, loaders: {
    scene: ({signal: s}) => { signal = s; return ++calls === 1 ? new Promise(resolve => { lateResolve = resolve; }) : 'retry-art'; },
  }});
  const first = await loader.load();
  assert.equal(first.failed.length, 1); assert.equal(signal.aborted, true);
  assert.equal((await loader.retry()).ready, true);
  lateResolve('stale-art'); await Promise.resolve(); await Promise.resolve();
  assert.equal(loader.get('scene'), 'retry-art'); assert.equal(loader.snapshot().ready, true);
});
