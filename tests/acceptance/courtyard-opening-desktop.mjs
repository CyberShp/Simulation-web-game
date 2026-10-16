/** Visible desktop opening from an empty independent save directory.
 * --output=/absolute/new-directory [--app=/absolute/package.app] [--record]
 * Recording needs the current encoder: npx playwright install ffmpeg.
 * Recording runs continuously; acceptance also checks process restarts mid-opening.
 * State changes use visible controls. courtyardQA supplies read-only observations.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { desktopTarget, repositoryRoot } from './desktop-target.mjs';

const require = createRequire(import.meta.url);
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const recording = process.argv.includes('--record'), appPath = option('app'), target = desktopTarget(appPath);
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-opening-'));
const relative = path.relative(repositoryRoot, output);
assert(path.isAbsolute(output) && (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)), 'Use an absolute evidence path outside the repository');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world');
await fs.mkdir(saveDirectory, { recursive: false });
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const checks = [], errors = [], interactions = [], snapshots = [], videoPaths = [];
const startedAt = new Date().toISOString(), started = performance.now();
let electron, page, completed = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const hold = seconds => wait(recording ? seconds * 1000 : 100);
const read = () => page.evaluate(() => window.courtyardQA.snapshot());
const view = () => page.evaluate(() => window.courtyardQA.view());
const home = state => state.stockpilesById['stockpile:yunxiu'].resources;
const master = state => state.personsById['person:master'];
const record = name => { checks.push({ name, ok: true }); console.log(`PASS ${name}`); };
const stateFacts = snapshot => { const state = structuredClone(snapshot.state); delete state.speed; return state; };
const stage = name => page.waitForFunction(value => window.courtyardQA.view().opening.stage === value, name, { timeout: 60000 });
async function capture(name) {
  await wait(700);
  const data = await read();
  snapshots.push({ name, wallSeconds: (performance.now() - started) / 1000, tick: data.state.worldTick });
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  return data;
}
async function click(action, hud = false) {
  const selector = hud ? `#${action}` : `[data-opening-action="${action}"]`;
  await page.locator(selector).click();
  await page.waitForFunction(() => !window.courtyardQA.status().persistence.saving && window.courtyardQA.status().persistence.pending === 0);
  await page.waitForFunction(() => !document.querySelector('#courtyard-opening .opening-button-primary:disabled'));
  assert.equal(await page.locator('.opening-feedback').isVisible(), false, await page.locator('.opening-feedback').textContent());
  interactions.push({ action, wallSeconds: (performance.now() - started) / 1000, tick: (await read()).state.worldTick });
}
async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath: target.executable,
    args: [...target.args, `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], env, timeout: 30000,
    ...(recording ? { recordVideo: { dir: path.join(output, 'raw-video'), size: { width: 1672, height: 942 }, fps: 30 } } : {}) });
  page = await electron.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 40000 });
  assert.deepEqual(await page.evaluate(() => window.courtyardQA.metrics().errors), []);
  assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())));
  if (recording) videoPaths.push(await page.video().path());
}
async function close() {
  const closed = electron.waitForEvent('close', { timeout: 25000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed; electron = null; page = null;
}
async function restart(name) {
  const before = await read();
  await close();
  const stored = JSON.parse(await fs.readFile(path.join(saveDirectory, 'sect-save.json'), 'utf8'));
  assert.deepEqual(stateFacts(stored), stateFacts(before), `${name}: close persists facts`);
  await launch();
  assert.deepEqual(stateFacts(await read()), stateFacts(stored), `${name}: process restart preserves facts`);
  await wait(600);
  assert.deepEqual(stateFacts(await read()), stateFacts(stored), `${name}: reading or manual pause remains frozen`);
  record(`${name}: save and fresh process retain the same world`);
}

try {
  await launch();
  const initial = await capture('01-rain-night');
  assert.equal(initial.provenance.kind, 'official-initial-opening');
  assert.equal(initial.state.worldTick, 0);
  assert.equal(Object.keys(initial.state.buildingsById).length, 1);
  assert.deepEqual(initial.state.homeMemberIds, []);
  assert.equal(initial.state.story.opening.hallPhase, 'shelter');
  await hold(8); await wait(600);
  assert.equal((await read()).state.worldTick, 0);
  record('empty save opens the rain-night prologue with the official initial world');
  await click('intro-next');
  await capture('02-parents');
  if (!recording) await restart('prologue');
  await hold(10); await click('intro-next'); await hold(7);
  await click('intro-next'); await stage('shelter'); await capture('03-shelter'); await hold(7);
  assert.equal((await read()).state.worldTick, 0);
  await click('heal'); await stage('inheritance');
  const pending = await capture('04-inheritance');
  assert.equal(home(pending.state).herb, 16);
  for (const lineage of ['qinglan', 'chiyang', 'hanquan', 'houttu', 'jinfeng', 'qinglan']) {
    await click(`lineage:${lineage}`); await hold(2.5);
    assert.deepEqual((await read()).state, pending.state, 'inheritance previews are read-only');
  }
  if (!recording) {
    await restart('pending inheritance');
    assert.equal(await page.evaluate(() => window.courtyardQA.status().manualPause), false);
    assert.equal((await read()).state.speed, 0);
  }
  record('first heal costs six herbs once; five inheritance previews and pending save preserve the world');
  await click('choose-inheritance'); await stage('recovering');
  await page.waitForFunction(() => window.courtyardQA.view().opening.wound < 28, null, { timeout: 15000 });
  await capture('05-recovering');
  if (!recording) { await click('pause', true); await restart('healing'); await click('pause', true); }
  await stage('hall-ready');
  if (!recording) {
    await click('defer-hall');
    assert.equal(await page.evaluate(() => window.courtyardQA.status().openingReading), false);
    await click('review-hall');
    assert.equal(await page.evaluate(() => window.courtyardQA.status().openingReading), true);
  }
  const ready = await capture('06-hall-ready');
  assert.equal(master(ready.state).wound, 0);
  assert.equal(home(ready.state).herb, 16);
  await hold(7);
  assert.deepEqual((await read()).state, ready.state, 'construction confirmation pauses without charging');
  record('chosen inheritance resumes real-time healing and waits for explicit hall construction');
  await click('establish-hall'); await stage('hall-building');
  const building = await capture('07-foundation');
  for (const [resource, cost] of Object.entries({ jade: 20, wood: 15, stone: 10 })) {
    assert.equal(home(building.state)[resource], home(ready.state)[resource] - cost);
  }
  assert.equal(building.state.story.step, 1);
  await page.waitForFunction(() => window.courtyardQA.view().opening.construction?.progressTicks >= 55, null, { timeout: 30000 });
  if (!recording) { await click('pause', true); await restart('hall construction'); await click('pause', true); }
  await page.waitForFunction(() => window.courtyardQA.view().buildings.some(b => b.type === 'hall' && b.stage === 'structure'), null, { timeout: 30000 });
  await capture('08-structure');
  await page.waitForFunction(() => window.courtyardQA.view().buildings.some(b => b.type === 'hall' && b.stage === 'finishing'), null, { timeout: 30000 });
  await capture('09-finishing');
  await stage('complete'); await hold(2);
  const complete = await capture('10-hall-complete');
  assert.equal(complete.state.story.opening.inheritance.selected, 'qinglan');
  assert.equal(complete.state.story.opening.hallPhase, 'complete');
  assert.deepEqual(Object.keys(complete.state.personsById), Object.keys(initial.state.personsById));
  assert.deepEqual(complete.state.homeMemberIds, []);
  assert.equal(home(complete.state).herb, 16);
  record('one world carries materials and finishes all actual hall stages with identities and costs retained');
  await hold(8); await click('complete');
  await click('pause', true); await click('save', true);
  if (!recording) await restart('finished hall');
  await capture('11-saved-courtyard'); await hold(5);
  assert.deepEqual(await page.evaluate(() => window.courtyardQA.metrics().errors), []);
  await close();
  assert.deepEqual(errors, []);
  record('desktop controls and resources complete without runtime errors');
  completed = true;
} catch (error) {
  errors.push(error.stack || String(error)); process.exitCode = 1;
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure-page.txt'), await page.locator('body').innerText({timeout:5000}).catch(() => page.url())).catch(() => {});
  }
} finally {
  if (electron) await electron.close().catch(error => errors.push(String(error)));
  const sourceFiles = ['courtyard-main.mjs', 'courtyard-opening.mjs', 'courtyard-opening.css', 'sect-sim.mjs', 'sect-opening.mjs', 'courtyard-renderer.mjs', 'courtyard-layers.mjs', 'courtyard-space.mjs'];
  const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(path.join(target.sample, file))).digest('hex')])));
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: completed ? 'passed' : 'failed', startedAt,
    wallSeconds: (performance.now() - started) / 1000, app: appPath || null, saveDirectory, checks, interactions, snapshots, errors,
    recording: { enabled: recording, continuous: recording, videoPaths }, sourceHashes,
    scope: 'Visible macOS desktop from one ordinary empty save through prologue, inheritance, real-time recovery and first hall construction.' }, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
  if (errors.length) console.error(errors.join('\n'));
}
