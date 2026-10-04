import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { normalRun } from './ea-normal-play.mjs';
import { sim, summary } from './ea-player.mjs';
import { createEAPersistence } from '../dist/ea-persistence.mjs';
import { memoryStorage, memoryLocks } from './ea-storage-fixture.mjs';

const player = normalRun({ reference: true }), state = player.state;
const initial = summary(state), startBytes = Buffer.byteLength(JSON.stringify(state));
const samples = [], saveSamples = [], days = [], duration = 21600;
const storage = memoryStorage(), locks = memoryLocks();
const store = createEAPersistence({ getStorage: () => storage, locks, validate: sim.validateSave, channelFactory: null });
await store.open(1);
for (let second = 0; second < duration; second++) {
  const start = performance.now();
  sim.tick(state, 1);
  samples.push(performance.now() - start);
  if ((second + 1) % 120 === 0) {
    assert.deepEqual(sim.validateSave(state), state);
    const ids = state.disciples.map(d => d.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 30);
    const jobs = state.disciples.filter(d => d.job && state.buildings.find(b => b.id === d.job)?.type !== 'hall').map(d => d.job);
    assert.equal(new Set(jobs).size, jobs.length, 'A production or meditation seat cannot have two workers');
    days.push({ time: state.time, people: ids.length, food: state.resources.food, jade: state.resources.jade, activePeaks: state.society.peaks.filter(p => p.active).length });
    const saveStart = performance.now();
    assert.equal(store.saveNow(state).ok, true);
    saveSamples.push(performance.now() - saveStart);
  }
}
const continuation = sim.validateSave(state), uninterrupted = structuredClone(state);
sim.tick(continuation, 120);
for (let second = 0; second < 120; second++) sim.tick(uninterrupted, 1);
assert.deepEqual(continuation, uninterrupted);
assert.ok(state.logs.length <= 100);
assert.equal(store.inspect(1).backups.length, 3);
store.close();
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
const report = {
  runtime: process.version,
  limitation: 'Node deterministic simulation and in-memory Web Locks/storage. This is not a six-hour human session or rendered browser performance.',
  normalSetup: { initial, playerCommands: player.operations.length },
  simulatedSeconds: duration, simulatedHours: duration / 3600,
  final: summary(state), startBytes, finalBytes: Buffer.byteLength(JSON.stringify(state)),
  tickMilliseconds: { p50: percentile(samples, .5), p95: percentile(samples, .95), p99: percentile(samples, .99), max: Math.max(...samples) },
  saveMilliseconds: { p50: percentile(saveSamples, .5), p95: percentile(saveSamples, .95), max: Math.max(...saveSamples) },
  maxImportantMemories: Math.max(...state.disciples.map(d => d.mind.memories.filter(m => m.important).length)),
  peakActiveDaySamples: days.filter(d => d.activePeaks === 2).length,
  daysSampled: days.length,
  logEntries: state.logs.length,
};
await writeFile(new URL('./ea-long-session-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
