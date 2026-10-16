/** R-44 / U-141: one visible Electron world, old courtyard to east residence.
 * node tests/acceptance/courtyard-east-desktop.mjs --output=/absolute/fresh/directory
 * Optional --app=/absolute/App.app loads that bundle's modules and executable.
 * Full bundle runs also take --source=/absolute/initial-world.json from a run.
 * --mode=package --source=/absolute/finished-save.json checks a delivered bundle
 * from the same completed world. Gameplay uses visible UI and real elapsed time.
 * --mode=resume --source=/absolute/carrying-save.json --prior-run=/absolute/run
 * continues the same recorded carrying checkpoint after a harness interruption.
 * --mode=inspect --source=/absolute/save.json --expected-stage=available|building|complete
 * records the actual scene for a paused checkpoint without advancing gameplay.
 * QA hooks supply read-only observations; no virtual clock or state injection.
 */
import assert from 'node:assert/strict';
import { desktopTarget, repositoryRoot } from './desktop-target.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const appPath = option('app'), mode = option('mode') || 'full', source = option('source'), priorRun = option('prior-run'), expectedStage = option('expected-stage');
assert(['full', 'package', 'resume', 'inspect'].includes(mode), '--mode must be full, package, resume, or inspect');
assert(mode !== 'package' || appPath && source, 'package mode requires --app and --source');
assert(mode !== 'resume' || source && priorRun, 'resume mode requires --source and --prior-run');
assert(mode !== 'inspect' || source && ['available', 'building', 'complete'].includes(expectedStage), 'inspect mode requires --source and --expected-stage');
assert(!appPath || source, 'bundle acceptance requires --source from the same recorded world');
const target = desktopTarget(appPath), artifactRoot = target.root, sample = target.sample;
const { createSectSession, commandSect, snapshotSect, restoreSect, validateSect } = await import(pathToFileURL(path.join(sample, 'sect-sim.mjs')));
const { inspectCourtyard } = await import(pathToFileURL(path.join(sample, 'courtyard-inspection.mjs')));
const { toArt, toWorld, isArtWalkable } = await import(pathToFileURL(path.join(sample, 'courtyard-space.mjs')));
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-east-'));
assert(path.isAbsolute(output) && !output.startsWith(repo + path.sep), 'Evidence must be outside the repository');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world'), savePath = path.join(saveDirectory, 'sect-save.json');
const SITE = 'site:domain:east-residence-1', MASTER = 'person:master', CARRIED = 'stockpile:carried:master';
const startedAt = new Date().toISOString(), started = performance.now();
const checks = [], errors = [], observations = [], preparations = [], interactions = [], journey = [], sourceHashes = {};
let electron, page, windowStarted = false, completed = false, activePhase = 'prepare';
let initial, farmId, constructionId, beforeBuild, lastJourneyTick = -1, firstConstructionView;
const windowSessions = [];
const seamScreens = new Set();
let windowSessionStart = null;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const elapsed = () => Number(((performance.now() - started) / 1000).toFixed(3));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const master = view => view.people.find(person => person.id === MASTER);
const total = values => Object.values(values || {}).reduce((sum, amount) => sum + amount, 0);
const record = (name, detail = {}) => { checks.push({ name, ok: true, wallSeconds: elapsed(), ...detail }); console.log(`PASS ${name}`); };
const readView = () => page.evaluate(() => window.courtyardQA.view());
const readSnapshot = () => page.evaluate(() => window.courtyardQA.snapshot());
const readStatus = () => page.evaluate(() => window.courtyardQA.status());
const readPresentation = () => page.evaluate(() => ({ camera: { ...window.courtyardQA.renderer.camera }, route: window.courtyardQA.route() }));
const assertPoint = (actual, expected, message) => assert(actual && expected && Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-6, message);
function assertCamera(actual, expected, message) { assertPoint(actual, expected, message); assert.equal(actual.zoom, expected.zoom, message); }
const keyed = value => page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(value)}]`);
const clickKey = key => click(keyed(key), key);
const tab = name => click(page.locator(`#${name}`), name);
async function click(locator, label) {
  await locator.click();
  interactions.push({ label, wallSeconds: elapsed(), tick: (await readView()).tick });
}
async function capture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  await fs.writeFile(path.join(output, `${name}.txt`), await page.locator('body').innerText());
  observations.push({ name: `${name}-camera`, wallSeconds: elapsed(), ...await page.evaluate(() => ({
    tick: window.courtyardQA.view().tick, camera: { ...window.courtyardQA.renderer.camera },
    mode: window.courtyardQA.renderer.mode, viewport: { width: innerWidth, height: innerHeight }
  })) });
}
async function checkpoint(name) {
  const state = await readSnapshot(); assert.equal(validateSect(state), true);
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(state) + '\n');
  observations.push({ name, wallSeconds: elapsed(), tick: state.state.worldTick, stateHash: sha(JSON.stringify(state)) });
  return state;
}
async function report() {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), wallSeconds: elapsed(),
    windowWallSeconds: Number((windowSessions.reduce((sum, session) => sum + session.seconds, 0) +
      (windowSessionStart === null ? 0 : (performance.now() - windowSessionStart) / 1000)).toFixed(3)), windowSessions,
    status: checks.some(item => !item.ok) || errors.length ? 'failed' : completed ? 'passed' : windowStarted ? 'running' : 'not_run',
    mode, activePhase, priorRun: priorRun || null, executable: appPath || path.join(sample, 'courtyard-host.cjs'), source: source || 'sect-seed public-command checkpoint',
    sourceHashes, saveDirectory, scope: 'Visible macOS Electron, production world pump and disk storage; UI actions and read-only QA observations.',
    waitMode: 'Real elapsed wall time. Tick count describes game state, not claimed human play time.',
    preparations, interactions, observations, checks, errors }, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'journey.json'), JSON.stringify(journey, null, 2) + '\n');
}
function loadPlaywright() {
  for (const entry of [process.env.PLAYWRIGHT_MODULE, 'playwright', process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright')].filter(Boolean)) {
    try { return require(entry); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright is unavailable; set PLAYWRIGHT_MODULE to its installed package.');
}
async function launch() {
  const { _electron } = loadPlaywright();
  const executablePath = target.executable;
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath, env,
    args: [...target.args, `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], timeout: 30000 });
  page = await electron.firstWindow(); windowStarted = true; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 30000 });
  assert.equal(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(win => win.isVisible())), true);
  windowSessionStart = performance.now();
}
async function closeNormally() {
  const closed = electron.waitForEvent('close', { timeout: 20000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed;
  if (windowSessionStart !== null) windowSessions.push({ startWallSeconds: Number(((windowSessionStart - started) / 1000).toFixed(3)),
    endWallSeconds: elapsed(), seconds: Number(((performance.now() - windowSessionStart) / 1000).toFixed(3)) });
  windowSessionStart = null; electron = null; page = null;
}
async function setManualPause(wanted) {
  if ((await readStatus()).manualPause !== wanted) await click(page.locator('#pause'), wanted ? '手动暂停' : '手动继续');
}
async function closeManagement() {
  if (await page.locator('#management').isVisible()) await click(page.locator('#close-management'), '收起管理');
}
async function renewControl() {
  await tab('affairs'); await clickKey('affairs:policy'); await clickKey('policy:manual'); await closeManagement();
}
function observeJourney(view) {
  if (view.tick === lastJourneyTick) return;
  const person = master(view), construction = view.construction, flow = construction?.materialFlow;
  journey.push({ segment: output, wallSeconds: elapsed(), tick: view.tick, sceneId: view.sceneId,
    person: { id: person.id, x: person.x, y: person.y, art: toArt(person.x, person.y), activityId: person.activityId, phase: person.activityDetail?.phase },
    construction: construction && { workOrderId: construction.workOrderId, progressTicks: construction.progressTicks,
      durationTicks: construction.durationTicks, phase: construction.phase, flowPhase: flow?.phase,
      cargo: flow?.cargo, trips: flow?.trips, usedCost: construction.usedCost } });
  lastJourneyTick = view.tick;
}
async function waitFor(predicate, label, seconds = 120, { renew = true, track = false } = {}) {
  const begin = performance.now(); let renewed = begin, announced = begin;
  while (performance.now() - begin < seconds * 1000) {
    const view = await readView();
    if (track) {
      observeJourney(view);
      const art = toArt(master(view).x, master(view).y);
      if (view.construction?.materialFlow.phase === 'carrying' || mode === 'package') for (const seam of [1672, 3344, 5016]) {
        if (art.x >= seam && !seamScreens.has(seam)) { await capture(`seam-${seam}`); seamScreens.add(seam); }
      }
    }
    if (predicate(view)) { observations.push({ name: label, waitWallSeconds: Number(((performance.now() - begin) / 1000).toFixed(3)), tick: view.tick }); return view; }
    if (renew && performance.now() - renewed > 18000) { await renewControl(); renewed = performance.now(); }
    if (performance.now() - announced > 30000) {
      console.log(`WAIT ${label}: ${Math.round((performance.now() - begin) / 1000)}s, tick ${view.tick}, x ${master(view).x.toFixed(2)}, ${view.construction?.reason || master(view).activityDetail?.reason || ''}`);
      await report(); announced = performance.now();
    }
    await wait(120);
  }
  throw Error(`Timed out: ${label}`);
}
async function saveAndReopen(name) {
  await setManualPause(true); await closeManagement();
  const before = await checkpoint(`${name}-before`); await capture(name);
  const presentation = await readPresentation();
  await click(page.locator('#save'), '手动保存');
  let stored;
  for (let i = 0; i < 100; i++) {
    stored = JSON.parse(await fs.readFile(savePath, 'utf8'));
    if (stored.state.worldTick === before.state.worldTick && stored.state.speed === 0) break;
    await wait(50);
  }
  assert.deepEqual(stored.state, before.state, 'save writes the observed official world');
  assert.equal(stored.courtyardPresentation.version, 2);
  assertPoint(stored.courtyardPresentation.camera, toWorld(presentation.camera.x, presentation.camera.y), 'saved camera uses official world coordinates');
  await closeNormally(); assert.deepEqual(JSON.parse(await fs.readFile(savePath, 'utf8')).state, before.state);
  await wait(1200); await launch();
  const reopened = await checkpoint(`${name}-reopened`);
  assert.deepEqual(reopened.state, before.state, 'normal restart preserves exact world without offline progress');
  assert.equal((await readStatus()).manualPause, true);
  const restored = await readPresentation();
  assertCamera(restored.camera, presentation.camera, 'normal restart preserves the visible camera');
  assert.equal(restored.route.remaining, presentation.route.remaining, 'normal restart preserves remaining route length');
  for (let i = 0; i < presentation.route.waypoints.length; i++) assertPoint(restored.route.waypoints[i], presentation.route.waypoints[i], 'normal restart preserves route waypoints');
  if (presentation.route.destination) assertPoint(restored.route.destination, presentation.route.destination, 'normal restart preserves the chosen destination');
  else assert.equal(restored.route.destination, null);
  await capture(`${name}-reopened`);
  record(name, { tick: before.state.worldTick, saveSha256: sha(await fs.readFile(savePath)), constructionId: before.state.personsById[MASTER].activityId,
    cameraBefore: presentation.camera, cameraAfter: restored.camera, presentationVersion: stored.courtyardPresentation.version, remainingRoutePoints: restored.route.remaining });
}
async function checkEastGroundClick() {
  activePhase = 'package-east-ground-camera';
  await tab('affairs'); await clickKey(`domain:site:${SITE}`); await clickKey('domain:focus'); await closeManagement();
  const candidates = [[135,49],[134,49],[136,49],[135,50],[134,50]].map(([x,y]) => ({ world: { x,y }, art: toArt(x,y) })).filter(p => isArtWalkable(p.art.x,p.art.y));
  const target = await page.evaluate(candidates => {
    const renderer = window.courtyardQA.renderer, rect = document.getElementById('scene').getBoundingClientRect();
    for (const point of candidates) {
      const screen = renderer.artToScreen(point.art);
      if (screen.x > 30 && screen.y > 110 && screen.x < rect.width - 30 && screen.y < rect.height - 65 &&
          !renderer.pickPeople(screen.x,screen.y).length && !renderer.pickBuilding(screen.x,screen.y) && !renderer.pickDomainSite(screen.x,screen.y))
        return { ...point, screen: { x: screen.x + rect.left, y: screen.y + rect.top } };
    }
    return null;
  }, candidates);
  assert(target, 'a visible walkable east forecourt point is available outside interactive objects');
  const before = await readPresentation(); await capture('08-east-before-ground-click');
  await page.mouse.click(target.screen.x,target.screen.y);
  interactions.push({ label: '东台可见地面点击', target, wallSeconds: elapsed(), tick: (await readView()).tick });
  const after = await readPresentation();
  assertCamera(after.camera, before.camera, 'clicking east forecourt preserves the current camera');
  assertPoint(after.route.destination, target.art, 'visible ground click selects the actual east destination');
  assert.equal(after.route.failure, null);
  await capture('08-east-after-ground-click');
  record('东台可见地面点选保持当前镜头并建立正式行走路径', { target, cameraBefore: before.camera, cameraAfter: after.camera });
  await saveAndReopen('08-east-click-restart');
  await setManualPause(false);
  await waitFor(view => Math.hypot(master(view).x-target.world.x,master(view).y-target.world.y)<.35 && !master(view).path.length, '最终包读档后实走到所点东台地面', 25, { track: true });
  await setManualPause(true); const reached = await readView();
  assertCamera((await readPresentation()).camera, before.camera, 'east ground arrival keeps the same static camera');
  await capture('08-east-ground-arrived');
  record('最终包读档后沿所存路径实际到达东台点选位置', { target: target.world, position: master(reached), tick: reached.tick });
}
async function openFarm() { await tab('affairs'); await clickKey(`building:${farmId}`); }
async function openStock(id) {
  await tab('supply'); await clickKey('subtab:stocks'); await keyed('stocks:owner').selectOption('all'); await clickKey(`stock:${id}`);
}
async function prepareMaterials() {
  activePhase = 'prepare-materials'; await renewControl();
  let batches = 0;
  while ((await readView()).resources.wood < 40) {
    assert(batches++ < 4, 'expected a bounded number of normal wood harvests');
    await setManualPause(true); const before = await readView();
    await tab('supply'); await clickKey('subtab:sources'); await clickKey('source:wood'); await clickKey('source:harvest:wood');
    assert.equal((await readView()).operations.master.activity.kind, 'sr-harvest');
    await closeManagement(); await setManualPause(false);
    await waitFor(view => (view.operations.inventory.stockpiles.find(stock => stock.id === CARRIED)?.resources.wood || 0) >= 12,
      `第${batches}批木材实际采得`, 100);
    await setManualPause(true); const gathered = await readView();
    assert.equal(gathered.resources.wood, before.resources.wood, 'gathered wood remains carried until delivered');
    await openStock(CARRIED); await clickKey('stock:transfer:wood'); await clickKey('transfer:submit');
    const shipment = (await readView()).transports.at(-1);
    await closeManagement(); await setManualPause(false);
    await waitFor(view => view.transports.find(order => order.id === shipment.id)?.phase === 'delivered', `第${batches}批木材实际送入公库`, 100);
    await setManualPause(true); const delivered = await readView();
    assert.equal(delivered.resources.wood, before.resources.wood + shipment.cargo.wood);
    record('正常采集木材并实际搬入公库', { batch: batches, shipmentId: shipment.id, quantity: shipment.cargo.wood, publicBefore: before.resources.wood, publicAfter: delivered.resources.wood });
  }
  await checkpoint('02-materials-ready');
}
async function openRoadAndBuild() {
  activePhase = 'east-opening'; await setManualPause(true);
  const before = await readSnapshot(); await tab('affairs'); await clickKey(`domain:site:${SITE}`); await clickKey('domain:enable');
  const opened = await readSnapshot(), view = await readView();
  assert.equal(view.domain.enabled, true); assert.equal(view.width, 160);
  assert.equal(opened.state.worldTick, before.state.worldTick);
  assert.deepEqual(opened.state.buildingsById, before.state.buildingsById);
  assert.deepEqual(opened.state.stockpilesById, before.state.stockpilesById);
  assert.deepEqual(opened.state.personsById, before.state.personsById);
  for (const id of initial.state.homeMemberIds) assert(opened.state.personsById[id]);
  await capture('01-east-road-open'); record('开启东路保留旧院建筑物资人物与同一时钟');
  await tab('affairs'); await clickKey(`domain:site:${SITE}`);
  assert.equal(await keyed(`domain:build:${SITE}`).isDisabled(), true, 'insufficient construction wood is visible and blocks the build control');
  assert.equal((await readView()).construction, null);
  await capture('01-materials-needed');
  record('公库木材不足时营造入口明确不可执行', { publicWood: (await readView()).resources.wood, requiredWood: 40 });
  await clickKey('domain:focus'); await closeManagement(); await capture('01-east-terrace-available');
  await prepareMaterials();
  await tab('affairs'); await clickKey(`domain:site:${SITE}`);
  beforeBuild = await readSnapshot(); await capture('03-east-site-ready');
  await clickKey(`domain:build:${SITE}`);
  firstConstructionView = (await readView()).construction;
  assert(firstConstructionView, 'UI starts the official construction order');
  constructionId = firstConstructionView.workOrderId;
  assert.equal(firstConstructionView.progressTicks, 0);
  assert.equal(firstConstructionView.materialFlow.phase, 'to-source');
  const started = await readSnapshot(), order = started.state.workOrdersById[constructionId];
  assert.equal(order.domainSiteId, SITE);
  assert.equal(started.state.stockpilesById[firstConstructionView.materialFlow.sourceStockpileId].resources.wood, 40);
  assert.equal(started.state.stockpilesById[firstConstructionView.materialFlow.sourceStockpileId].resources.stone, 20);
  assert.equal((await readView()).resources.wood, beforeBuild.state.stockpilesById['stockpile:yunxiu'].resources.wood - 40);
  assert.equal((await readView()).resources.stone, beforeBuild.state.stockpilesById['stockpile:yunxiu'].resources.stone - 20);
  record('东台营造预留40木20石并创建同一正式工单', { constructionId, sourceStockpileId: firstConstructionView.materialFlow.sourceStockpileId });
  await closeManagement(); await click(page.locator('#follow'), '跟随掌门'); await setManualPause(false);
  activePhase = 'east-delivery';
  await waitFor(v => v.construction?.materialFlow.phase === 'carrying' && master(v).x >= 98 && master(v).x <= 117,
    '首趟实际携货进入东路', 180, { track: true });
  await setManualPause(true); const crossing = await readView();
  assert.equal(crossing.construction.progressTicks, 0);
  assert.equal(total(crossing.construction.materialFlow.cargo), 40);
  await checkpoint('04-first-carry-on-road'); await capture('04-first-carry-on-road');
  record('首趟40份建材由掌门实际携出旧院', { position: master(crossing), cargo: crossing.construction.materialFlow.cargo });
  await saveAndReopen('05-carrying-restart');
  await finishConstruction();
}
async function finishConstruction() {
  activePhase = 'east-delivery';
  assert.equal((await readView()).construction.workOrderId, constructionId);
  await click(page.locator('#follow'), '续档跟随掌门'); await setManualPause(false);
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  let minimized = false;
  for (let attempt = 0; attempt < 50 && !minimized; attempt++) {
    minimized = await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized());
    if (!minimized) await wait(100);
  }
  assert.equal(minimized, true, 'native window reached its minimized state');
  const backgroundBefore = await readView();
  const backgroundStart = performance.now(); await wait(5000);
  const backgroundAfter = await readView(), backgroundWall = (performance.now() - backgroundStart) / 1000;
  await electron.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.restore(); win.show(); });
  assert(backgroundAfter.tick > backgroundBefore.tick);
  assert(Math.hypot(master(backgroundAfter).x - master(backgroundBefore).x, master(backgroundAfter).y - master(backgroundBefore).y) > .1);
  assert.equal(backgroundAfter.construction.workOrderId, constructionId);
  record('携货途中最小化五秒仍按同一工单实际前进', { actualWallSeconds: backgroundWall,
    before: { tick: backgroundBefore.tick, x: master(backgroundBefore).x, y: master(backgroundBefore).y },
    after: { tick: backgroundAfter.tick, x: master(backgroundAfter).x, y: master(backgroundAfter).y } });
  await waitFor(v => master(v).x >= 123 && v.construction?.materialFlow.phase === 'carrying', '首趟实际抵达东台画面', 100, { track: true });
  await setManualPause(true); await capture('06-carrying-east-terrace'); await checkpoint('06-carrying-east-terrace');
  record('同一人物携货连续通过东路并进入东台', { position: master(await readView()), sceneId: (await readView()).sceneId });
  await setManualPause(false);
  await waitFor(v => v.construction?.progressTicks > 0 && v.construction.progressTicks < v.construction.durationTicks,
    '分趟建材到齐并开始真实施工', 240, { track: true });
  await setManualPause(true); const working = await readView(), flow = working.construction.materialFlow;
  assert.equal(flow.phase, 'ready'); assert.equal(total(flow.cargo), 0);
  assert.equal(flow.trips.length, 2); assert(flow.trips.every(trip => trip.phase === 'delivered' && total(trip.cargo) <= 40));
  assert.equal(flow.trips.reduce((sum, trip) => sum + (trip.cargo.wood || 0), 0), 40);
  assert.equal(flow.trips.reduce((sum, trip) => sum + (trip.cargo.stone || 0), 0), 20);
  assert(master(working).x > 120);
  record('60份建材分两趟送达后到场施工', { trips: flow.trips, progressTicks: working.construction.progressTicks });
  activePhase = 'east-construction'; await saveAndReopen('07-construction-restart');
  assert.equal((await readView()).construction.workOrderId, constructionId);
  await click(page.locator('#follow'), '继续跟随施工'); await setManualPause(false);
  await waitFor(v => v.domain.sites.find(site => site.id === SITE)?.status === 'complete', '同一工单完成门人居', 100, { track: true });
  await setManualPause(true); const finished = await checkpoint('08-residence-complete');
  const receipt = finished.state.spatial.completedOrders.find(order => order.id === constructionId);
  assert.equal(receipt.phase, 'completed'); assert.equal(receipt.domainSiteId, SITE);
  assert.equal(receipt.materialTrips.length, 2); assert.equal(receipt.usedCost.wood, 40); assert.equal(receipt.usedCost.stone, 20); assert.equal(receipt.usedCost.jade, 45);
  assert.deepEqual([...new Set(journey.map(sample => sample.sceneId))], ['scene:yunxiu-courtyard']);
  assert(journey.some(sample => sample.person.x < 96) && journey.some(sample => sample.person.x > 120));
  record('真实施工完成且木石灵石结算可核对', { receipt });
}
async function inspectResidenceAndReturn() {
  activePhase = 'residence-and-return'; await setManualPause(true);
  const saved = await readSnapshot(), projection = inspectCourtyard(restoreSect(saved)), site = (await readView()).domain.sites.find(site => site.id === SITE);
  const official = saved.state.buildingsById[site.buildingId]; assert(official);
  const residence = projection.buildings.find(building => building.id === String(official.id)); assert(residence);
  assert.equal(residence.slots.filter(slot => slot.kind === 'rest').length, 4);
  assert.equal(official.enabled, true); assert.equal(official.spatialLock, undefined);
  await tab('affairs'); await clickKey(`building:${residence.id}`);
  const text = await page.locator('#management-body').innerText(); assert.match(text, /实际席位/); assert.match(text, /可用空席|正在使用|已预约/);
  await clickKey('building:focus'); await capture('09-four-beds');
  record('落成门人居四个真实床位可用且建筑详情可查看', { buildingId: official.instanceId, slots: residence.slots });
  const farmEntrance = projection.buildings.find(building => building.id === farmId)?.location.focus;
  assert(farmEntrance, 'the original farm has a real entrance');
  await closeManagement(); await capture('09-residence-complete-scene');
  await openFarm(); await clickKey('building:walk'); await closeManagement();
  await click(page.locator('#follow'), '跟随掌门返回旧院'); await setManualPause(false);
  await waitFor(v => Math.hypot(master(v).x - farmEntrance.x, master(v).y - farmEntrance.y) < .35 && !master(v).path.length,
    '从东台实际返回旧院药田', 180, { track: true });
  await setManualPause(true); const returned = await checkpoint('10-returned-courtyard');
  for (const id of initial.state.homeMemberIds) assert(returned.state.personsById[id]);
  const originalFarm = Object.values(initial.state.buildingsById).find(building => building.type === 'farm');
  const keptFarm = returned.state.buildingsById[originalFarm.instanceId];
  assert(keptFarm); assert.deepEqual(keptFarm.transform, originalFarm.transform);
  assert(returned.state.stockpilesById[`stockpile:${originalFarm.instanceId}`]);
  await openFarm(); await clickKey('building:focus'); await capture('10-old-farm-preserved');
  record('沿原路实走返院，原药田位置货位与人物身份保留', { farmId: originalFarm.instanceId, masterPosition: master(await readView()), homeMemberIds: initial.state.homeMemberIds });
  await closeManagement(); await saveAndReopen('11-complete-world-restart');
  await checkpoint('final-world');
}

try {
  assert.equal(process.platform, 'darwin', 'This acceptance requires macOS');
  await fs.mkdir(saveDirectory, { recursive: false });
  for (const name of ['courtyard-host.cjs', 'courtyard-main.mjs', 'courtyard-panels.mjs', 'courtyard-space.mjs', 'courtyard-renderer.mjs', 'courtyard-east-layout.mjs', 'sect-sim.mjs',
    'assets/east-path-a.png', 'assets/east-path-b.png', 'assets/east-terrace-v2.png', 'assets/east-terrace-clean.png', 'assets/east-terrace-empty.png', 'assets/east-terrace-construction.png'])
    sourceHashes[name] = sha(await fs.readFile(name.startsWith('assets/') ? path.join(target.assets, name.slice(7)) : path.join(sample, name)));
  for (const seam of [1672, 3344, 5016]) sourceHashes[`assets/east-seam-${seam}.png`] = sha(await fs.readFile(path.join(target.assets, `east-seam-${seam}.png`)));
  for (const name of ['ea-sect-domain.mjs', 'ea-sr-spatial.mjs']) sourceHashes[`simulation/${name}`] = sha(await fs.readFile(path.join(target.simulation, name)));
  if (source) {
    initial = JSON.parse(await fs.readFile(source, 'utf8')); assert.equal(validateSect(initial), true);
    preparations.push({ kind: 'same-world-source', source, sourceSha256: sha(await fs.readFile(source)), tick: initial.state.worldTick });
    if (mode === 'resume') {
      const previous = JSON.parse(await fs.readFile(path.join(priorRun, 'report.json'), 'utf8'));
      const priorSnapshot = path.join(priorRun, '05-carrying-restart-reopened.json');
      assert.deepEqual(initial, JSON.parse(await fs.readFile(priorSnapshot, 'utf8')), 'continuation loads the exact verified checkpoint');
      assert(previous.checks.some(check => check.name === '05-carrying-restart' && check.ok));
      preparations.push({ kind: 'verified-continuation', priorReport: path.join(priorRun, 'report.json'), priorStatus: previous.status,
        priorSnapshot, priorSnapshotSha256: sha(await fs.readFile(priorSnapshot)) });
      journey.push(...JSON.parse(await fs.readFile(path.join(priorRun, 'journey.json'), 'utf8')).map(sample => ({ ...sample, segment: priorRun })));
      for (const seam of [1672, 3344, 5016]) if (journey.some(sample => sample.person.art?.x >= seam)) seamScreens.add(seam);
    }
  } else {
    const { buildSectSeed } = await import(pathToFileURL(path.join(sample, 'sect-seed-build.mjs')));
    const session = createSectSession({ source: buildSectSeed({ enableDomain: false }) });
    for (const command of [{ type: 'enable-courtyard-terrain' }, { type: 'pause', paused: true }]) {
      const result = commandSect(session, command); assert.equal(result.ok, true, result.error);
      preparations.push({ command, result, tick: session.state.worldTick });
    }
    initial = snapshotSect(session); assert.equal(validateSect(initial), true);
    preparations.push({ kind: 'public-command-checkpoint', provenance: initial.provenance, stateHash: sha(JSON.stringify(initial)), tick: initial.state.worldTick });
  }
  farmId = String(Object.values(initial.state.buildingsById).find(building => building.type === 'farm').id);
  await fs.writeFile(path.join(output, 'initial-world.json'), JSON.stringify(initial) + '\n');
  await fs.writeFile(savePath, JSON.stringify(initial) + '\n', { flag: 'wx' });
  await launch(); await setManualPause(true); await checkpoint('00-loaded'); await capture('00-loaded');
  record('可见macOS桌面从同一公开命令来源档进入', { tick: initial.state.worldTick, farmId });
  if (mode === 'full') await openRoadAndBuild();
  else if (mode === 'resume') {
    constructionId = (await readView()).construction?.workOrderId;
    assert(constructionId); assert.equal((await readView()).construction.materialFlow.phase, 'carrying');
    await finishConstruction();
  }
  else if (mode === 'inspect') {
    activePhase = 'phase-inspection';
    await tab('affairs'); await clickKey(`domain:site:${SITE}`); await clickKey('domain:focus'); await closeManagement();
    await page.waitForFunction(stage => window.courtyardQA.renderer.eastStage() === stage, expectedStage);
    const stage = await page.evaluate(() => window.courtyardQA.renderer.eastStage()), view = await readView();
    assert.equal(stage, expectedStage); assert.equal(view.tick, initial.state.worldTick);
    assert.deepEqual((await readSnapshot()).state, initial.state, 'phase inspection preserves the complete checkpoint');
    await capture(`phase-${stage}`); await checkpoint(`phase-${stage}`);
    record('同源暂停检查点按实际交付和施工进度显示东台阶段', { stage, tick: view.tick,
      progressTicks: view.construction?.progressTicks, deliveredQuantity: view.construction?.materialFlow.deliveredQuantity });
  }
  else {
    activePhase = 'package-east-arrival';
    const entrance = (await readView()).domain.sites.find(site => site.id === SITE).entrance;
    await tab('affairs'); await clickKey(`domain:site:${SITE}`); await clickKey('domain:walk');
    await closeManagement(); await click(page.locator('#follow'), '最终包跟随掌门前往东台'); await setManualPause(false);
    await waitFor(view => Math.hypot(master(view).x - entrance.x, master(view).y - entrance.y) < .35 && !master(view).path.length,
      '最终包沿东路实际走到门人居', 180, { track: true });
    await setManualPause(true); await capture('08-package-east-arrival');
    record('最终包载入同一世界并沿东路实走抵达门人居', { position: master(await readView()) });
    await checkEastGroundClick();
  }
  if (mode !== 'inspect') await inspectResidenceAndReturn();
  const metrics = await page.evaluate(() => window.courtyardQA.metrics());
  await fs.writeFile(path.join(output, 'runtime-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  assert.deepEqual(metrics.errors, []); assert.deepEqual(errors, []);
  record('正式泵与画面运行无未捕获错误', { renderedFrames: metrics.renderedFrames, viewport: metrics.viewport });
  completed = true;
} catch (error) {
  checks.push({ name: activePhase, ok: false, error: error.stack, wallSeconds: elapsed() }); console.error(error.stack); process.exitCode = 1;
  if (page) { await capture('failure').catch(() => {}); await checkpoint('failure-state').catch(() => {}); }
} finally {
  if (electron) await closeNormally().catch(async error => { errors.push(`close: ${error.message}`); process.exitCode = 1; await electron?.close().catch(() => {}); });
  await report(); console.log(`Evidence: ${output}`);
}
