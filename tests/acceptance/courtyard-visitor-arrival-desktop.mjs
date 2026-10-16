/** Visible desktop visitor arrival from one ordinary empty QA save.
 * node tests/acceptance/courtyard-visitor-arrival-desktop.mjs --output=/absolute/new-directory [--app=/path/to/app]
 * Public controls perform world changes. courtyardQA is used only for observations.
 * Isolated copies check the public-command gate; they never replace the desktop save.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { desktopTarget, repositoryRoot } from './desktop-target.mjs';

const require = createRequire(import.meta.url);
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const appPath = option('app'), target = desktopTarget(appPath);
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-visitors-'));
const relative = path.relative(repositoryRoot, output);
assert(path.isAbsolute(output) && (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)), 'Use an absolute evidence path outside the repository');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world');
await fs.mkdir(saveDirectory, { recursive: false });
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SIM = await import(pathToFileURL(path.join(target.simulation, 'ea-opening-sim.mjs')));
const { projectGodotWorld } = await import(pathToFileURL(path.join(target.simulation, 'ea-godot-bridge.mjs')));
const { toArt, isArtWalkable } = await import(pathToFileURL(path.join(target.sample, 'courtyard-space.mjs')));
const LU = 'person:lu-zhiwei', MASTER = 'person:master';
const checks = [], errors = [], interactions = [], captures = [], trajectory = [], commandChecks = [], restarts = [];
const startedAt = new Date().toISOString(), started = performance.now();
let electron, page, completed = false, sampling = false, sampleTimer, firstRoadObservation = null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const wallSeconds = () => (performance.now() - started) / 1000;
const read = () => page.evaluate(() => window.courtyardQA.snapshot());
const view = () => page.evaluate(() => window.courtyardQA.view());
const record = name => { checks.push({ name, ok: true }); console.log(`PASS ${name}`); };
const stateFacts = snapshot => { const state = structuredClone(snapshot.state); delete state.speed; return state; };
const stage = name => page.waitForFunction(value => window.courtyardQA.view().opening.stage === value, name, { timeout: 60000 });
const bodyOf = snapshot => snapshot.state.personsById[LU].mind.scenic;

async function sample() {
  if (sampling || !page || page.isClosed()) return;
  sampling = true;
  try {
    const value = await page.evaluate(() => {
      const q = window.courtyardQA, v = q.view();
      return { tick: v.tick, paused: v.paused, people: v.people.map(p => ({ id: p.id, x: p.x, y: p.y,
        moving: p.moving, indoor: p.indoor, path: p.path, visit: p.visit,
        screen: q.renderer.worldToScreen(p.x, p.y) })) };
    });
    trajectory.push({ wallSeconds: wallSeconds(), ...value });
  } catch (error) { if (page && !page.isClosed()) errors.push(`observation: ${error.message}`); }
  finally { sampling = false; }
}
async function capture(name) {
  const snapshot = await read(), projected = await view();
  const visible = projected.people.find(p => p.id === LU);
  captures.push({ name, wallSeconds: wallSeconds(), tick: snapshot.state.worldTick, visitor: visible || null });
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify({ snapshot, view: projected }, null, 2) + '\n');
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  return snapshot;
}
async function click(selector) {
  await page.locator(selector).click();
  await page.waitForFunction(() => !window.courtyardQA.status().persistence.saving && window.courtyardQA.status().persistence.pending === 0);
  interactions.push({ selector, wallSeconds: wallSeconds(), tick: (await read()).state.worldTick });
}
const openingClick = action => click(`[data-opening-action="${action}"]`);
async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath: target.executable,
    args: [...target.args, `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], env, timeout: 30000 });
  page = await electron.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 40000 });
  assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())));
  assert.deepEqual(await page.evaluate(() => window.courtyardQA.metrics().errors), []);
  sampleTimer = setInterval(() => void sample(), 100);
  await sample();
}
async function close() {
  clearInterval(sampleTimer);
  while (sampling) await wait(10);
  const closed = electron.waitForEvent('close', { timeout: 25000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed; electron = null; page = null;
}
function commandGate(snapshot, expectedReady) {
  const state = SIM.validateSave(snapshot.state), before = JSON.stringify(snapshot.state);
  const visitor = projectGodotWorld(state).openingStory.visitor;
  const result = { tick: state.worldTick, phase: state.personsById[LU].courtyardVisit.phase,
    scope: 'public command on isolated copy of this desktop observation', projectedCanTalk: visitor.canTalk };
  assert.equal(visitor.canTalk, expectedReady);
  try {
    const committed = SIM.dispatchCommand(state, { name: 'advanceStory', args: ['gift'],
      id: `command:${state.transactions.nextCommandId}`, expectedRevision: state.revision });
    result.accepted = true;
    result.giftFact = committed.state.factsById['fact:opening:gift'];
    assert(expectedReady, 'arrival must finish before gift can commit');
    assert.equal(result.giftFact.recipientId, LU);
  } catch (error) {
    if (expectedReady) throw error;
    result.accepted = false; result.reason = error.message;
    assert.match(error.message, /尚未抵达|山路/);
  }
  assert.equal(JSON.stringify(snapshot.state), before);
  commandChecks.push(result);
}
async function clickVisitor() {
  const point = await page.evaluate(id => {
    const q = window.courtyardQA, p = q.view().people.find(p => p.id === id);
    if (!p) throw Error('Visitor is not visible');
    const foot = q.renderer.artToScreen(q.renderer.displayPoint(p)), box = q.canvas.getBoundingClientRect();
    return { x: box.left + foot.x, y: box.top + foot.y - 24, foot, viewport: { width: box.width, height: box.height } };
  }, LU);
  assert(point.x > 0 && point.x < point.viewport.width && point.y > 0 && point.y < point.viewport.height);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => !document.getElementById('dialog').hidden || !document.getElementById('management').hidden);
  if (!(await page.locator('#dialog').isVisible())) {
    await click(`[data-ui-key="person:${LU}"]`);
    await click(`[data-ui-key="person:inspect:${LU}"]`);
  }
  await page.locator('#dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#person-name').textContent(), '陆知微');
  interactions.push({ action: 'canvas-select-visitor', point, tick: (await read()).state.worldTick });
}

try {
  await launch();
  await stage('intro');
  const initial = await capture('01-new-world');
  assert.equal(initial.provenance.kind, 'official-initial-opening');
  assert.equal(initial.state.worldTick, 0);
  assert.equal(initial.state.personsById[LU].courtyardVisit.phase, 'waiting');
  assert.deepEqual((await view()).people.map(p => p.id), [MASTER]);
  for (let frame = 0; frame < 6; frame++) {
    await page.waitForFunction(value => document.getElementById('courtyard-opening')?.dataset.frame === String(value), frame);
    await openingClick('intro-next');
  }
  await stage('shelter'); await capture('02-shelter');
  await openingClick('heal'); await stage('inheritance');
  await openingClick('bundle-open');
  await page.waitForFunction(() => document.getElementById('courtyard-opening')?.dataset.bundlePhase === 'open', null, { timeout: 15000 });
  await openingClick('choose-inheritance'); await stage('recovering');
  await stage('hall-ready'); await capture('03-hall-ready');
  assert(!(await view()).people.some(p => p.id === LU));
  await openingClick('establish-hall'); await stage('hall-building');
  await capture('04-hall-construction');
  await stage('complete');
  await capture('05-hall-complete');
  await openingClick('complete');
  await page.waitForFunction(id => window.courtyardQA.view().people.some(p => p.id === id && p.visit?.phase === 'arriving'), LU, { timeout: 15000 });
  await click('#pause');
  const entry = await capture('06-road-entry');
  const arrival = entry.state.personsById[LU].courtyardVisit;
  assert.equal(arrival.phase, 'arriving');
  assert.equal(arrival.source, 'south-mountain-road');
  firstRoadObservation = trajectory.map(frame => ({ tick: frame.tick, person: frame.people.find(p => p.id === LU) })).find(frame => frame.person);
  assert(firstRoadObservation && firstRoadObservation.tick - arrival.startedTick <= 5, 'continuous observations begin at the first few world steps of arrival');
  assert(Math.hypot(firstRoadObservation.person.x - arrival.entry.x, firstRoadObservation.person.y - arrival.entry.y) < 1.5);
  assert.deepEqual(entry.state.personsById[LU].appearance, initial.state.personsById[LU].appearance);
  assert.deepEqual(entry.state.homeMemberIds, []);
  assert.equal(entry.state.story.opening.gifted, false);
  commandGate(entry, false);
  record('one ordinary new world completes prologue, healing, inheritance and hall construction before Lu Zhiwei enters from the southern road');

  await wait(800);
  assert.deepEqual((await read()).state, entry.state, 'manual pause freezes world time, position and remaining visitor path');
  await click('#save');
  const beforeClose = await read();
  await close();
  const stored = JSON.parse(await fs.readFile(path.join(saveDirectory, 'sect-save.json'), 'utf8'));
  assert.deepEqual(stateFacts(stored), stateFacts(beforeClose));
  await wait(1200);
  await launch();
  assert.equal(await page.evaluate(() => window.courtyardQA.status().manualPause), true);
  assert.deepEqual(stateFacts(await read()), stateFacts(stored));
  await wait(600);
  assert.deepEqual(stateFacts(await read()), stateFacts(stored));
  restarts.push({ tick: stored.state.worldTick, position: stored.state.personsById[LU].position,
    visit: stored.state.personsById[LU].courtyardVisit, path: stored.state.personsById[LU].mind.scenic.path,
    closedWallMilliseconds: 1200, stateExact: true });
  await capture('07-road-restored');
  record('manual pause and a new desktop process retain this visitor, world tick, position and remaining route exactly');

  await click('#pause');
  for (const [index, waypoint] of [2, 4, 6].entries()) {
    await page.waitForFunction(({ id, waypoint }) => window.courtyardQA.view().people.find(p => p.id === id)?.visit?.waypointIndex >= waypoint,
      { id: LU, waypoint }, { timeout: 20000 });
    await capture(`08-road-${index + 1}`);
  }
  await page.waitForFunction(id => window.courtyardQA.view().people.find(p => p.id === id)?.visit?.phase === 'present', LU, { timeout: 30000 });
  await click('#pause');
  const arrived = await capture('09-arrived'), finalVisit = arrived.state.personsById[LU].courtyardVisit;
  const finalFeet = bodyOf(arrived);
  assert(finalVisit.arrivedTick > finalVisit.startedTick);
  assert(Math.hypot(finalFeet.x - finalVisit.target.x, finalFeet.y - finalVisit.target.y) < .02);
  assert.deepEqual(finalFeet.path, []);
  const samples = trajectory.flatMap(frame => frame.people.filter(p => p.id === LU).map(p => ({ tick: frame.tick, ...p })));
  const walking = samples.filter(p => p.visit?.phase === 'arriving');
  assert(new Set(walking.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size >= 3);
  for (const p of walking) {
    const art = toArt(p.x, p.y);
    assert(isArtWalkable(art.x, art.y, { terrain: !!arrived.state.spatial.courtyardTerrain, domain: !!arrived.state.spatial.domain }),
      `visitor feet remain on drawn walkable ground at ${p.x},${p.y} / ${art.x},${art.y}`);
  }
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], ticks = b.tick - a.tick;
    if (ticks < 0) continue;
    assert(Math.hypot(b.x - a.x, b.y - a.y) <= ticks * .5 + .02, 'observed route is continuous across world steps and restart');
  }
  record('visitor walks through at least three distinct road positions to the courtyard destination on visible walkable ground');

  await clickVisitor(); await capture('10-person-observation');
  const dialogPaused = await read(); await wait(500);
  assert.deepEqual((await read()).state, dialogPaused.state);
  await click('#approach-person');
  await click('#pause');
  await page.waitForFunction(id => {
    const v = window.courtyardQA.view(), m = v.people.find(p => p.id === 'person:master'), p = v.people.find(p => p.id === id);
    return m && p && Math.hypot(m.x - p.x, m.y - p.y) <= 1.4;
  }, LU, { timeout: 30000 });
  await click('#pause');
  const near = await capture('11-master-near-visitor');
  commandGate(near, true);
  assert.equal(near.state.story.opening.gifted, false, 'command-copy checks do not change the actual desktop gift state');
  await clickVisitor(); await capture('12-near-person-window');
  await click('#close-person'); await click('#save');
  assert.deepEqual(await page.evaluate(() => window.courtyardQA.metrics().errors), []);
  record('the arriving identity can be selected on Canvas; public approach reaches her; isolated public gift commands are gated by completed arrival and distance');
  await close();
  assert.deepEqual(errors, []);
  completed = true;
} catch (error) {
  errors.push(error.stack || String(error)); process.exitCode = 1;
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify(await read().catch(() => null), null, 2)).catch(() => {});
    await fs.writeFile(path.join(output, 'failure-page.txt'), await page.locator('body').innerText({ timeout: 5000 }).catch(() => page.url())).catch(() => {});
  }
} finally {
  clearInterval(sampleTimer);
  if (electron) await electron.close().catch(error => errors.push(String(error)));
  const sourceFiles = ['apps/courtyard/sect-sim.mjs', 'apps/courtyard/courtyard-main.mjs', 'apps/courtyard/courtyard-space.mjs',
    'src/simulation/ea-opening-sim.mjs', 'src/simulation/ea-courtyard-visitors.mjs', 'src/simulation/ea-godot-bridge.mjs', 'src/simulation/ea-scene-state.mjs'];
  const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file,
    createHash('sha256').update(await fs.readFile(path.join(target.root, file))).digest('hex')])));
  await fs.writeFile(path.join(output, 'trajectory.json'), JSON.stringify(trajectory, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: completed ? 'passed' : 'failed',
    startedAt, wallSeconds: wallSeconds(), app: appPath || null, saveDirectory, checks, interactions, captures,
    restarts, commandChecks, firstRoadObservation, errors, sourceHashes, recording: false,
    scope: 'Visible macOS Electron desktop, one ordinary new save and public UI through hall construction, Lu Zhiwei road arrival, pause, fresh-process restore, Canvas selection and approach.',
    boundaries: ['Gift command checks operate on isolated copies of this same save; the desktop character window offers observation and approach.',
      'Other visitors, Windows hardware and first-time human play are outside this ordinary-new-save run.'] }, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
  if (errors.length) console.error(errors.join('\n'));
}
