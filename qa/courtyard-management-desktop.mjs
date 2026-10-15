/** UXR-01/02/06: visible macOS Electron management flow with one isolated save.
 * Usage: node qa/courtyard-management-desktop.mjs --output=/absolute/scratch/path
 * Optional --app=/absolute/App.app selects a packaged build; PLAYWRIGHT_MODULE
 * selects the installed Playwright package. The app uses its real host/storage.
 * All in-window commands use visible controls. QA hooks are read-only observations.
 * Action waits use wall time and the production pump; no browser virtual clock.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createSectSession, commandSect, snapshotSect, validateSect } from '../prototypes/pixel_scene_validation/sect-sim.mjs';

const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = path.join(repo, 'prototypes/pixel_scene_validation');
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-management-'));
assert(path.isAbsolute(output), '--output must be absolute');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world');
const savePath = path.join(saveDirectory, 'sect-save.json');
const appPath = option('app');
const mode = option('mode') || 'full';
assert(['full', 'smoke'].includes(mode), '--mode is full or smoke');
const startedAt = new Date().toISOString(), started = performance.now();
const checks = [], errors = [], observations = [], preparations = [], interactions = [];
let electron, page, windowStarted = false, completed = false, activePhase = 'prepare';
const sha = value => createHash('sha256').update(value).digest('hex');
const elapsed = () => Number(((performance.now() - started) / 1000).toFixed(3));
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const record = (name, detail = {}) => { checks.push({ name, ok: true, wallSeconds: elapsed(), ...detail }); console.log(`PASS ${name}`); };
const readView = () => page.evaluate(() => window.courtyardQA.view());
const readSnapshot = () => page.evaluate(() => window.courtyardQA.snapshot());
const readStatus = () => page.evaluate(() => window.courtyardQA.status?.() || null);
const body = () => page.locator('#management-body');
const keyed = value => body().locator(`[data-ui-key=${JSON.stringify(value)}]`);
const clickKey = value => click(keyed(value), value);
async function click(locator, label) {
  await locator.click();
  interactions.push({ label, wallSeconds: elapsed(), tick: (await readView()).tick });
}
const tab = name => click(page.locator(`#${name}`), `打开${name}`);
async function capture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  await fs.writeFile(path.join(output, `${name}.txt`), await page.locator('body').innerText());
}
async function checkpoint(name) {
  const state = await readSnapshot();
  assert.equal(validateSect(state), true);
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(state) + '\n');
  observations.push({ name, wallSeconds: elapsed(), tick: state.state.worldTick, stateHash: sha(JSON.stringify(state)) });
  return state;
}
async function report() {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), wallSeconds: elapsed(),
    status: checks.some(check => !check.ok) || errors.length ? 'failed' : completed ? 'passed' : windowStarted ? 'running' : 'not_run', mode, activePhase,
    executable: appPath || path.join(sample, 'courtyard-host.cjs'), saveDirectory,
    scope: 'Visible macOS Electron window, production host and disk storage, UI controls for state-changing actions, read-only QA observations.',
    waitMode: 'Real elapsed wall time through the production pump. No virtual clock or direct simulation advance in the window.',
    preparations, interactions, observations, checks, errors }, null, 2) + '\n');
}
function loadPlaywright() {
  for (const value of [process.env.PLAYWRIGHT_MODULE, 'playwright',
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright')].filter(Boolean)) {
    try { return require(value); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright is unavailable; set PLAYWRIGHT_MODULE to its installed package.');
}
async function launch() {
  const { _electron } = loadPlaywright();
  const executablePath = appPath ? path.join(appPath, 'Contents/MacOS/Electron') : require(path.join(sample, 'node_modules/electron'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath, env,
    args: [...(appPath ? [] : [path.join(sample, 'courtyard-host.cjs')]), `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'],
    timeout: 30000 });
  page = await electron.firstWindow(); windowStarted = true; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 30000 });
  const visible = await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(win => win.isVisible()));
  assert.equal(visible, true, 'Electron window is actually visible');
}
async function closeNormally() {
  const closed = electron.waitForEvent('close', { timeout: 20000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed; electron = null; page = null;
}
async function setManualPause(wanted) {
  const state = await readStatus();
  const actual = typeof state?.manualPause === 'boolean' ? state.manualPause : (await page.locator('#pause').innerText()).includes('继续');
  if (actual !== wanted) await click(page.locator('#pause'), wanted ? '手动暂停' : '手动继续');
}
async function waitFor(predicate, label, limitSeconds = 90, renewManual = false) {
  const begin = performance.now(); let renewed = begin, announced = begin;
  while (performance.now() - begin < limitSeconds * 1000) {
    const view = await readView();
    if (predicate(view)) {
      observations.push({ name: label, waitWallSeconds: Number(((performance.now() - begin) / 1000).toFixed(3)), tick: view.tick });
      return view;
    }
    if (renewManual && performance.now() - renewed > 18000) { await renewControl(); renewed = performance.now(); }
    if (performance.now() - announced > 30000) {
      console.log(`WAIT ${label}: ${Math.round((performance.now() - begin) / 1000)}s, tick ${view.tick}, field ${view.operations.farms[0]?.herbOnSite}`);
      await report(); announced = performance.now();
    }
    await wait(100);
  }
  throw Error(`Timed out: ${label}`);
}

// Page navigation helpers are defined from the management controls, keeping all
// gameplay commands on the same user-facing path as a desktop interaction.
async function renewControl() {
  await tab('affairs');
  await clickKey('affairs:policy');
  await clickKey('policy:manual');
  await page.keyboard.press('Escape');
}
async function openFarm() {
  await tab('affairs');
  const farm = (await readView()).buildings.find(building => building.type === 'farm');
  await clickKey(`building:${farm.id}`);
}
async function cancelCurrent() {
  await tab('growth'); await clickKey('subtab:current'); await clickKey('growth:cancel');
  if (await keyed('confirm-action').isVisible()) await clickKey('confirm-action');
}
async function openStock(id) {
  await tab('supply'); await clickKey('subtab:stocks');
  await keyed('stocks:owner').selectOption('all');
  await clickKey(`stock:${id}`);
}
async function saveAndReopen(label) {
  await setManualPause(true);
  const before = await checkpoint(`${label}-before-save`);
  await click(page.locator('#save'), '手动保存');
  let stored;
  for (let i = 0; i < 100; i++) {
    stored = JSON.parse(await fs.readFile(savePath, 'utf8'));
    if (stored.state.worldTick === before.state.worldTick && stored.state.speed === 0) break;
    await wait(50);
  }
  assert.deepEqual(stored.state, before.state, 'manual save writes current official world');
  await closeNormally();
  const afterClose = JSON.parse(await fs.readFile(savePath, 'utf8'));
  assert.deepEqual(afterClose.state, before.state);
  await wait(1200); await launch();
  const reopened = await readSnapshot();
  assert.deepEqual(reopened.state, before.state, 'process restart preserves exact world without offline progress');
  assert((await readView()).paused, 'manual pause persists across process restart');
  record(label, { tick: before.state.worldTick, saveSha256: sha(await fs.readFile(savePath)), stockpileCount: Object.keys(before.state.stockpilesById).length });
}

async function runInterfaceChecks() {
  activePhase = 'interface';
  await setManualPause(false);
  const before = (await readView()).tick;
  await tab('affairs'); await wait(1200);
  assert((await readView()).tick > before, 'ordinary management keeps world running');
  const statusBounds = await page.locator('#simulation-status').boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert(statusBounds && statusBounds.x >= 0 && statusBounds.y >= 0 && statusBounds.x + statusBounds.width <= viewport.width
    && statusBounds.y + statusBounds.height <= viewport.height, 'world pause status is visible inside the viewport');
  await capture('01-affairs');
  record('管理总览沿真实时间运行');
  await clickKey('affairs:policy');
  await keyed('policy:manual').focus();
  await wait(1300);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.uiKey), 'policy:manual');
  await page.keyboard.press('Space');
  assert.equal((await readView()).paused, false, 'Space activates the focused button without global pause');
  await page.keyboard.press('Escape');
  record('运行中刷新保持按钮键盘焦点且空格执行对应按钮');
  await setManualPause(true);
  await openFarm();
  const frozen = (await readView()).tick;
  await wait(1100); assert.equal((await readView()).tick, frozen);
  assert.match(await page.locator('#simulation-status').innerText(), /手动暂停.*建筑详情|建筑详情.*手动暂停/);
  await page.keyboard.press('Escape');
  assert(await page.locator('#management').isVisible(), 'Escape returns one management layer');
  assert((await readView()).paused, 'manual pause survives detail close');
  await page.keyboard.press('Escape'); assert(await page.locator('#management').isHidden());
  await setManualPause(false); await openFarm();
  const readingTick = (await readView()).tick;
  await wait(1000); assert.equal((await readView()).tick, readingTick);
  assert.deepEqual((await readStatus()).pauseReasons, ['建筑详情']);
  await page.keyboard.press('Escape'); await wait(350);
  assert((await readView()).tick > readingTick, 'leaving reading resumes the previously running world');
  await setManualPause(true);
  record('详情阅读、逐层Escape与手动暂停分别保持');
  await tab('people');
  const search = keyed('people:query');
  await search.fill('陆知微');
  assert.match(await body().innerText(), /陆知微/);
  await search.fill('此人不存在');
  assert.match(await body().innerText(), /没有|暂无|未找到/);
  await search.fill('');
  await setManualPause(false);
  await clickKey('person:person:lu-zhiwei');
  await clickKey('person:inspect:person:lu-zhiwei');
  const observedTick = (await readView()).tick;
  await wait(1000); assert.equal((await readView()).tick, observedTick);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.uiKey), 'person:inspect:person:lu-zhiwei');
  assert.equal((await readView()).paused, false);
  await setManualPause(true);
  record('人物观察暂停、关闭恢复运行并返还原按钮焦点');
  await capture('01-people');
  await tab('growth'); assert.match(await body().innerText(), /修为|修行/);
  await clickKey('subtab:arts');
  await keyed('arts:query').fill('此法不存在');
  assert.match(await body().innerText(), /没有|暂无|未找到/);
  await keyed('arts:query').fill('');
  await capture('01-growth');
  await tab('supply'); assert.match(await body().innerText(), /公用|公库/);
  await capture('01-navigation');
  record('四页入口与人物搜索空结果可用');
}

async function runProduction() {
  activePhase = 'production';
  await setManualPause(true); await openFarm();
  const initial = await readView();
  assert.equal(initial.operations.farms[0].seedNeeded, 2);
  await clickKey('farm:seed');
  assert.equal(await keyed('transfer:quantity').inputValue(), '2');
  await clickKey('transfer:submit');
  const cancelledSeeds = (await readView()).transports.at(-1);
  assert.equal(cancelledSeeds.phase, 'to-source');
  await cancelCurrent();
  const cancelled = (await readView()).transports.find(order => order.id === cancelledSeeds.id);
  assert.equal(cancelled.phase, 'cancelled'); assert.equal(cancelled.returnedTo, 'stockpile:yunxiu');
  assert.equal((await readView()).resources.herb, initial.resources.herb);
  record('取货前中止把2份种苗退回原公库', { shipmentId: cancelledSeeds.id, returnedTo: cancelled.returnedTo });
  await openFarm(); await clickKey('farm:seed'); await clickKey('transfer:submit');
  const seeds = (await readView()).transports.at(-1);
  assert.equal(seeds.cargo.herb, 2);
  assert.equal((await readView()).operations.farms[0].herbOnSite, 0);
  await setManualPause(false);
  await waitFor(v => v.transports.find(t => t.id === seeds.id)?.phase === 'delivered', '种苗实际送达', 60, true);
  await openFarm();
  await clickKey('farm:invite:person:lu-zhiwei');
  assert.equal((await readView()).operations.farms[0].invites[0].lastResult.accepted, true);
  await clickKey('building:continue');
  record('同田送苗完成后本人接受照料', { shipmentId: seeds.id, farmId: initial.operations.farms[0].id });
  const grown = await waitFor(v => v.operations.farms[0].herbOnSite > 42, '同田正常收成超过42份', 420, true);
  await openFarm(); await clickKey('farm:toggle');
  const fieldBefore = (await readView()).operations.farms[0].herbOnSite;
  await clickKey('farm:harvest');
  assert.match(await body().innerText(), /40/);
  assert.equal(await keyed('transfer:quantity').inputValue(), '40');
  await clickKey('transfer:submit');
  const harvest = (await readView()).transports.at(-1);
  assert.equal(harvest.cargo.herb, 40);
  const publicBefore = (await readView()).resources.herb;
  await waitFor(v => v.transports.find(t => t.id === harvest.id)?.phase === 'delivered', '40份收成实际入库', 90, true);
  const delivered = await readView();
  assert(delivered.operations.farms[0].herbOnSite >= 2);
  assert.equal(delivered.operations.farms[0].herbOnSite, fieldBefore - 40);
  assert.equal(delivered.resources.herb, publicBefore + 40);
  await setManualPause(true); await checkpoint('02-harvest-complete'); await capture('02-harvest-complete');
  record('超过42份收成按单趟40份实际入库并留苗', { fieldBefore, fieldAfter: delivered.operations.farms[0].herbOnSite,
    publicBefore, publicAfter: delivered.resources.herb, harvestTick: grown.tick, shipmentId: harvest.id });
}

async function runDroppedRecovery() {
  activePhase = 'dropped-recovery';
  await setManualPause(true);
  await tab('supply'); await clickKey('subtab:sources'); await clickKey('source:wood');
  const initialPublicWood = (await readView()).resources.wood;
  await clickKey('source:harvest:wood');
  assert.equal((await readView()).operations.master.activity.kind, 'sr-harvest');
  await setManualPause(false);
  await waitFor(v => v.operations.inventory.stockpiles.find(stock => stock.id === 'stockpile:carried:master')?.resources.wood === 12, '亲自采得12份木材', 90, true);
  await setManualPause(true);
  assert.equal((await readView()).resources.wood, initialPublicWood, 'gathered wood remains carried');
  await openStock('stockpile:carried:master'); await clickKey('stock:transfer:wood');
  assert.equal(await keyed('transfer:quantity').inputValue(), '12');
  await clickKey('transfer:submit');
  const order = (await readView()).transports.at(-1);
  await setManualPause(false);
  await waitFor(v => v.transports.find(item => item.id === order.id)?.phase === 'carrying', '12份木材实际取货', 45);
  await setManualPause(true);
  await cancelCurrent();
  const cancelled = (await readView()).transports.find(item => item.id === order.id);
  assert.equal(cancelled.phase, 'cancelled'); assert.match(cancelled.returnedTo, /^stockpile:dropped:/);
  const droppedId = cancelled.returnedTo;
  const dropped = (await readView()).operations.inventory.stockpiles.find(stock => stock.id === droppedId);
  assert.equal(dropped.resources.wood, 12); assert.equal(dropped.dropped, true);
  assert.equal((await readView()).resources.wood, initialPublicWood);
  assert.match(await body().innerText(), /落地|落在|回收/);
  record('亲采12木取货后中止，真实物资落在原位置', { shipmentId: order.id, droppedId, position: dropped.position });
  await tab('affairs'); await clickKey(`todo:stock:${droppedId}`);
  assert.match(await body().innerText(), /回收落地物资/);
  assert(!(await body().innerText()).includes(droppedId), 'internal dropped-stock id is not shown as its name');
  await clickKey(`stock:focus:${droppedId}`);
  await capture('03-dropped-stock');
  await saveAndReopen('落地12木跨进程存读保持同一账目与暂停');
  await openStock(droppedId); await clickKey('stock:transfer:wood');
  assert.equal(await keyed('transfer:quantity').inputValue(), '12');
  await clickKey('transfer:submit');
  const recoveredOrder = (await readView()).transports.at(-1);
  assert.equal(recoveredOrder.sourceStockpileId, droppedId);
  await setManualPause(false);
  await waitFor(v => v.transports.find(item => item.id === recoveredOrder.id)?.phase === 'carrying', '从落地点实际取回木材', 60);
  await setManualPause(true);
  await saveAndReopen('回收运输途中跨进程存读保持货物与行程');
  await setManualPause(false);
  await waitFor(v => v.transports.find(item => item.id === recoveredOrder.id)?.phase === 'delivered', '回收12木实际送达公库', 90, true);
  await setManualPause(true);
  const final = await readView();
  assert.equal(final.resources.wood, initialPublicWood + 12);
  assert.equal(final.operations.inventory.stockpiles.find(stock => stock.id === droppedId).resources.wood, 0);
  await checkpoint('04-recovered'); await capture('04-recovered');
  record('落地货位定位与真实回收完成，公库恰增12木', { droppedId, shipmentId: recoveredOrder.id,
    publicBefore: initialPublicWood, publicAfter: final.resources.wood });
}

try {
  assert.equal(process.platform, 'darwin', 'This acceptance requires macOS');
  await fs.mkdir(saveDirectory, { recursive: false });
  const session = createSectSession();
  for (const command of [{ type: 'enable-courtyard-terrain' }, { type: 'pause', paused: true }]) {
    const result = commandSect(session, command); assert.equal(result.ok, true, result.error);
    preparations.push({ command, result, tick: session.state.worldTick });
  }
  const initial = snapshotSect(session); assert.equal(validateSect(initial), true);
  await fs.writeFile(savePath, JSON.stringify(initial) + '\n', { flag: 'wx' });
  preparations.push({ kind: 'existing-normal-public-command-checkpoint', stateHash: sha(JSON.stringify(initial)), tick: initial.state.worldTick });
  await launch();
  record('macOS可见Electron加载独立测试档');
  await runInterfaceChecks();
  if (mode === 'full') await runProduction();
  if (mode !== 'smoke') await runDroppedRecovery();
  else await saveAndReopen('打包应用独立档真实保存关闭重开');
  const metrics = await page.evaluate(() => window.courtyardQA.metrics());
  await fs.writeFile(path.join(output, 'runtime-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  assert.deepEqual(metrics.errors, [], 'production pump and rendering report no runtime errors');
  assert.deepEqual(errors, []); record('窗口运行无未捕获错误');
  completed = true;
} catch (error) {
  checks.push({ name: activePhase, ok: false, error: error.stack, wallSeconds: elapsed() });
  console.error(error.stack); process.exitCode = 1;
  if (page) {
    await capture('failure').catch(() => {});
    await checkpoint('failure-state').catch(() => {});
  }
} finally {
  if (electron) await closeNormally().catch(async error => {
    errors.push(`close: ${error.message}`); process.exitCode = 1; await electron?.close().catch(() => {});
  });
  await report(); console.log(`Evidence: ${output}`);
}
