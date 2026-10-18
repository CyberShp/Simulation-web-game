/** Sustained courtyard food supply: one recorded world and 20 real minutes.
 * node tests/acceptance/courtyard-food-desktop.mjs --source=/absolute/final-world.json
 * --output=/absolute/fresh/evidence [--app=/absolute/App.app]
 * Gameplay uses visible controls; courtyardQA is used only for observations.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { desktopTarget, repositoryRoot } from './desktop-target.mjs';

const require = createRequire(import.meta.url);
const option = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const app = option('app'), source = option('source'), output = option('output');
assert(source && output && [source, output, ...(app ? [app] : [])].every(path.isAbsolute));
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot) + path.sep), 'evidence belongs outside the repository');
const target = desktopTarget(app);
const { restoreSect, validateSect } = await import(pathToFileURL(path.join(target.sample, 'sect-sim.mjs')));
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sourceBytes = await fs.readFile(source), original = JSON.parse(sourceBytes);
const initial = restoreSect(original);
assert.deepEqual(initial.state, original.state, 'restoration preserves the recorded world');
assert.deepEqual(initial.policy, { ...original.policy, foodTarget: original.policy.foodTarget ?? 32 });
assert.equal(initial.state.speed, 0, 'source is paused');
assert.equal(initial.provenance.kind, 'normal-public-command-checkpoint');
assert(initial.state.economy.starvation > 0, 'source is the recorded food-shortage world');
const policy = { herbTarget: 30, foodTarget: 32, spendingCap: Math.floor(initial.state.stockpilesById['stockpile:yunxiu'].resources.jade), risk: 'balanced' };
const saveDirectory = path.join(output, 'world'), savePath = path.join(saveDirectory, 'sect-save.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const harnessBytes = await fs.readFile(new URL(import.meta.url));
const started = performance.now(), startedAt = new Date().toISOString();
const wall = () => Number(((performance.now() - started) / 1000).toFixed(3));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], errors = [], samples = [], interactions = [], checkpoints = [], sessions = [], background = [];
const events = new Map(), facts = new Map(), transports = new Map(), sourceHashes = {};
const initialFactIds = new Set(Object.keys(initial.state.factsById));
const initialTransportIds = new Set(Object.values(initial.state.workOrdersById).filter(order => order.kind === 'transport').map(order => order.id));
const runtimeFiles = ['courtyard-host.cjs', 'courtyard-main.mjs', 'courtyard-panels.mjs', 'sect-sim.mjs'];
let electron, page, previous, sessionStarted, phase = 'prepare', completed = false;
let runningSeconds = 0, autonomousSeconds = 0, lastReport = 0, lastCheckpoint = 0;
let minimizedStart, minimizedBefore, minimizedDone = false, recoveryRecorded = false, carriedRecorded = false, deliveredRecorded = false;
let finalSummary = null;
const read = () => page.evaluate(() => window.courtyardQA.view());
const snapshot = () => page.evaluate(() => window.courtyardQA.snapshot());
const status = () => page.evaluate(() => window.courtyardQA.status());
const key = name => page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record = (name, detail = {}) => { checks.push({ name, ok: true, wallSeconds: wall(), autonomousSeconds, ...detail }); console.log(`PASS ${name}`); };
async function click(locator, label) {
  previous = null;
  await locator.click();
  interactions.push({ label, wallSeconds: wall(), tick: (await read()).tick });
}
async function pause(wanted) {
  if ((await status()).manualPause !== wanted) await click(page.locator('#pause'), wanted ? '手动暂停' : '继续世界');
  previous = null;
}
async function closePanel() {
  if (await page.locator('#management').isVisible()) await click(page.locator('#close-management'), '收起管理');
}
async function capture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  await fs.writeFile(path.join(output, `${name}.txt`), await page.locator('body').innerText());
}
async function checkpoint(name) {
  const data = await snapshot();
  assert.equal(validateSect(data), true);
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(data) + '\n');
  checkpoints.push({ name, tick: data.state.worldTick, wallSeconds: wall(), autonomousSeconds, sha256: hash(JSON.stringify(data)) });
  return data;
}
async function report() {
  const result = {
    startedAt, updatedAt: new Date().toISOString(), status: checks.some(check => !check.ok) || errors.length ? 'failed' : completed ? 'passed' : 'running', phase,
    source, sourceSha256: hash(sourceBytes), sourceWorldTick: original.state.worldTick,
    app: app || null, desktopTarget: app ? 'provided desktop package' : 'local source Electron', platform: process.platform,
    harnessSha256: hash(harnessBytes), sourceHashes, saveDirectory, policy,
    wallSeconds: wall(), runningSeconds, autonomousSeconds, minimumAutonomousSeconds: 1200,
    timeMethod: 'Monotonic time between read-only samples, both unpaused and automatic with advancing ticks; intervals above three seconds and UI interventions are excluded. Native minimization is included while ticks advance.',
    checks, errors, interactions, sessions, background, checkpoints, summary: finalSummary,
    scope: 'Same recorded shortage world; visible policy controls; real-time collection, carried stock, delivery and daily food use; native macOS minimization and exact paused close/reopen.',
    boundaries: ['Windows hardware', 'new-save opening', 'three or more residents', 'food-source restoration spending when its source and resources meet the conditions'],
  };
  await Promise.all([
    fs.writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n'),
    fs.writeFile(path.join(output, 'samples.json'), JSON.stringify(samples, null, 2) + '\n'),
    fs.writeFile(path.join(output, 'events.json'), JSON.stringify([...events.values()], null, 2) + '\n'),
    fs.writeFile(path.join(output, 'facts.json'), JSON.stringify([...facts.values()], null, 2) + '\n'),
    fs.writeFile(path.join(output, 'transports.json'), JSON.stringify([...transports.values()], null, 2) + '\n'),
  ]);
}
async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath: target.executable, args: [...target.args, `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], env, timeout: 30000 });
  page = await electron.firstWindow(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push({ message: error.message, wallSeconds: wall() }));
  await page.waitForFunction(() => window.courtyardQA && document.getElementById('loading').hidden);
  assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()));
  sessionStarted = performance.now(); previous = null;
}
async function closeNormally() {
  const closed = electron.waitForEvent('close', { timeout: 20000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await closed;
  sessions.push({ seconds: (performance.now() - sessionStarted) / 1000, endedAtWallSeconds: wall() });
  electron = null; page = null; previous = null;
}
async function observe() {
  const observation = await page.evaluate(() => {
    const v = window.courtyardQA.view(), s = window.courtyardQA.snapshot(), metrics = window.courtyardQA.metrics();
    return {
      v, metrics,
      supplyDay: s.state.economy.lastSupplyDay,
      facts: Object.values(s.state.factsById).filter(f => f.operation === 'manual-harvest' && f.resource === 'food' || f.kind === 'daily-supply-relation' || f.operation === 'transport-delivery' && f.cargo?.food > 0),
    };
  });
  const { v, metrics } = observation, now = performance.now();
  assert.deepEqual(metrics.errors, [], 'runtime error collection stays empty');
  assert.deepEqual(errors, [], 'page errors stay empty');
  assert.deepEqual(v.policy, policy, 'policy remains unchanged while autonomous');
  assert.equal(v.people.filter(p => p.resident).length, 2);
  assert.equal(v.sceneId, 'scene:yunxiu-courtyard');
  assert(v.budget.spent <= policy.spendingCap, 'cumulative preparation allowance is respected');
  if (previous) {
    const elapsed = (now - previous.now) / 1000;
    if (elapsed <= 3 && !previous.paused && !v.paused && v.tick > previous.tick) {
      runningSeconds += elapsed;
      if (previous.mode === 'auto' && v.control.mode === 'auto') autonomousSeconds += elapsed;
    }
  }
  previous = { now, tick: v.tick, paused: v.paused, mode: v.control.mode };
  for (const event of v.ledger) if (event.id >= initial.nextLedgerId && !events.has(event.id)) events.set(event.id, { ...event, firstObservedWallSeconds: wall(), observedPolicy: { ...v.policy } });
  for (const fact of observation.facts) if (!initialFactIds.has(fact.id) && !facts.has(fact.id)) facts.set(fact.id, { ...fact, firstObservedWallSeconds: wall(), publicFood: v.resources.food, carriedFood: v.foodSupply.carried });
  for (const order of v.transports) if (!initialTransportIds.has(order.id)) {
    const old = transports.get(order.id);
    transports.set(order.id, { ...order, firstObservedWallSeconds: old?.firstObservedWallSeconds ?? wall(), lastObservedWallSeconds: wall(), observedTick: v.tick,
      phases: [...new Set([...(old?.phases || []), order.phase])] });
  }
  samples.push({ wallSeconds: wall(), runningSeconds, autonomousSeconds, tick: v.tick, paused: v.paused, policy: v.policy, control: v.control,
    resources: v.resources, foodSupply: v.foodSupply, budget: v.budget, economy: v.economy, supplyDay: observation.supplyDay,
    people: v.people.filter(p => p.resident).map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, energy: p.energy, wound: p.wound, activity: p.activity, activityId: p.activityId, detail: p.activityDetail })), reason: v.reason });
  return v;
}
async function lifecycle() {
  phase = 'pause-save-reopen'; await pause(true); await closePanel();
  const paused = await checkpoint('06-paused-world'); await wait(2500);
  assert.deepEqual(await snapshot(), paused, 'manual pause holds the entire session'); record('手动暂停保持完整世界');
  await click(page.locator('#save'), '保存院务');
  for (let i = 0; i < 100; i++) {
    const disk = JSON.parse(await fs.readFile(savePath, 'utf8'));
    if (disk.state.worldTick === paused.state.worldTick && disk.state.speed === 0 && JSON.stringify(disk.policy) === JSON.stringify(paused.policy)) break;
    await wait(50);
  }
  const saved = JSON.parse(await fs.readFile(savePath, 'utf8'));
  for (const field of ['state', 'policy', 'control', 'budget', 'automation', 'ledger', 'totals', 'carrySeconds']) assert.deepEqual(saved[field], paused[field], `${field} saved exactly`);
  await capture('06-paused-saved'); await closeNormally();
  const closedDisk = JSON.parse(await fs.readFile(savePath, 'utf8'));
  for (const field of ['state', 'policy', 'control', 'budget', 'automation', 'ledger', 'totals', 'carrySeconds']) assert.deepEqual(closedDisk[field], paused[field], `${field} remains exact on normal close`);
  const closedAt = performance.now(); await wait(5000); await launch();
  const reopened = await checkpoint('07-reopened-world');
  for (const field of ['state', 'policy', 'control', 'budget', 'automation', 'ledger', 'totals', 'carrySeconds', 'nextLedgerId', 'reason', 'baseline', 'provenance']) assert.deepEqual(reopened[field], closedDisk[field], `${field} survives reopening exactly`);
  assert.equal((await status()).manualPause, true); await capture('07-reopened');
  record('正常保存关闭五秒后重开，世界与口粮策略精确恢复', { tick: reopened.state.worldTick, closedWallSeconds: (performance.now() - closedAt) / 1000 });
  return reopened;
}

try {
  await fs.mkdir(saveDirectory, { recursive: true });
  await fs.writeFile(savePath, JSON.stringify(initial) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(output, 'executed-harness.mjs'), harnessBytes);
  await fs.writeFile(path.join(output, 'initial-world.json'), JSON.stringify(initial) + '\n');
  for (const filename of runtimeFiles) sourceHashes[filename] = hash(await fs.readFile(path.join(target.sample, filename)));
  await launch(); assert.deepEqual((await snapshot()).state, original.state);
  const first = await read(); assert.equal(first.foodSupply.target, 32); assert.equal(first.foodSupply.available, 3); assert.equal(first.economy.starvation, 3);
  await capture('00-source-world'); record('同源缺粮暂停档载入，正式世界保持', { sourceSha256: hash(sourceBytes), tick: first.tick, foodSupply: first.foodSupply, economy: first.economy });
  await click(page.locator('#affairs'), '院务'); await click(key('affairs:policy'), '自主安排');
  for (const name of ['foodTarget', 'herbTarget', 'spendingCap']) await key(`policy:${name}`).fill(String(policy[name]));
  await key('policy:risk').selectOption(policy.risk); await click(key('policy:save'), '保存自主安排');
  assert.deepEqual((await read()).policy, policy); await capture('01-food-policy');
  await click(key('policy:auto'), '交回自主'); await closePanel(); await pause(false);
  phase = 'autonomous-food-supply'; await observe(); record('界面保存口粮32、灵草30及实际余额内累计额度，交回自主', { policy, initialJade: first.resources.jade });
  while (autonomousSeconds < 1200 || !minimizedDone) {
    await wait(650); const v = await observe();
    if (!carriedRecorded && v.foodSupply.carried >= 16) {
      await checkpoint('02-food-carried'); if (!minimizedStart) await capture('02-food-carried');
      record('自主采粮先进入随身货位', { tick: v.tick, foodSupply: v.foodSupply }); carriedRecorded = true;
    }
    if (!deliveredRecorded && [...transports.values()].some(order => order.phase === 'delivered' && order.cargo.food >= 16 && order.sourceStockpileId === 'stockpile:carried:master' && order.targetStockpileId === 'stockpile:yunxiu')) {
      await checkpoint('03-food-delivered'); if (!minimizedStart) await capture('03-food-delivered');
      record('首批口粮经实际运输送入公库', { tick: v.tick, foodSupply: v.foodSupply }); deliveredRecorded = true;
    }
    if (!recoveryRecorded && v.economy.starvation === 0) {
      await checkpoint('04-supply-recovered'); if (!minimizedStart) await capture('04-supply-recovered');
      record('正式日常供给解除原有饥荒', { tick: v.tick, foodSupply: v.foodSupply, economy: v.economy }); recoveryRecorded = true;
    }
    if (minimizedStart) {
      const elapsed = (performance.now() - minimizedStart) / 1000;
      if (elapsed >= 180) {
        await electron.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.restore(); window.show(); });
        assert(v.tick - minimizedBefore.tick >= elapsed * 8.5); assert(v.tick - minimizedBefore.tick <= elapsed * 11.5);
        background.push({ startTick: minimizedBefore.tick, endTick: v.tick, wallSeconds: elapsed, startFood: minimizedBefore.resources.food, endFood: v.resources.food });
        await capture('05-minimized-return'); record('原生最小化三分钟期间世界和供粮继续', background.at(-1)); minimizedStart = null; minimizedDone = true;
      }
    } else if (!minimizedDone && autonomousSeconds >= 60) {
      await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
      await page.waitForTimeout(250);
      assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()));
      minimizedBefore = await read(); minimizedStart = performance.now(); console.log('NATIVE MINIMIZATION STARTED');
    }
    if (wall() - lastCheckpoint >= 60) { await checkpoint(`minute-${Math.floor(autonomousSeconds / 60)}`); lastCheckpoint = wall(); }
    if (wall() - lastReport >= 30) {
      const delivered = [...transports.values()].filter(order => order.phase === 'delivered' && order.cargo.food > 0).length;
      console.log(`RUN auto=${autonomousSeconds.toFixed(1)}s tick=${v.tick} food=${v.foodSupply.available} carried=${v.foodSupply.carried} source=${v.foodSupply.sourceRemaining} starvation=${v.economy.starvation} deliveries=${delivered}`);
      await report(); lastReport = wall();
    }
    assert(wall() < 1500, 'bounded twenty-five-minute acceptance window');
  }
  await pause(true); const final = await checkpoint('final-world'), finalView = await read(); await capture('08-twenty-minutes');
  const harvests = [...facts.values()].filter(fact => fact.operation === 'manual-harvest' && fact.resource === 'food');
  const deliveries = [...transports.values()].filter(order => order.phase === 'delivered' && order.cargo.food === 16 && order.sourceStockpileId === 'stockpile:carried:master' && order.targetStockpileId === 'stockpile:yunxiu');
  const supplied = [...facts.values()].filter(fact => fact.kind === 'daily-supply-relation' && fact.source === 'economy.daily-supply' && fact.supplied);
  assert(harvests.length >= 2); assert(harvests.every(fact => fact.quantity === 16 && fact.targetStockpileId === 'stockpile:carried:master'));
  assert(deliveries.length >= 2); assert(carriedRecorded); assert(deliveredRecorded); assert(recoveryRecorded);
  assert(new Set(supplied.map(fact => fact.dayIndex)).size >= 2);
  const foodDrops = samples.slice(1).flatMap((sample, index) => {
    const before = samples[index]; return sample.supplyDay > before.supplyDay && before.resources.food - sample.resources.food === sample.foodSupply.dailyDemand ? [{ day: sample.supplyDay, beforeTick: before.tick, tick: sample.tick, beforeFood: before.resources.food, afterFood: sample.resources.food, consumed: sample.foodSupply.dailyDemand }] : [];
  });
  assert(foodDrops.length >= 2, 'multiple formal daily food deductions are observed');
  assert.equal(finalView.economy.starvation, 0); assert(finalView.resources.food > 0);
  const startHarvests = [...events.values()].filter(event => event.action === 'startMasterHarvest' && event.autonomous);
  for (const fact of harvests) assert(startHarvests.some(event => `fact:manual-harvest:${event.result?.id}` === fact.id), 'each new harvest links to an autonomous action');
  record('至少两批自主采粮与运输完成，且多次正式供给持续扣粮', { harvests, deliveries, foodDrops });
  record('同一世界累计二十分钟真实自主运行', { autonomousSeconds, runningSeconds, wallSeconds: wall(), initialTick: initial.state.worldTick, finalTick: final.state.worldTick });
  finalSummary = { initialFood: first.resources.food, finalFood: finalView.resources.food, harvestCount: harvests.length, harvestedFood: harvests.reduce((sum, fact) => sum + fact.quantity, 0), deliveredFood: deliveries.reduce((sum, order) => sum + order.cargo.food, 0), foodDrops, initialStarvation: first.economy.starvation, finalStarvation: finalView.economy.starvation, initialSource: first.foodSupply.sourceRemaining, finalSource: finalView.foodSupply.sourceRemaining, budget: finalView.budget };
  await lifecycle();
  const metrics = await page.evaluate(() => window.courtyardQA.metrics());
  assert.deepEqual(metrics.errors, []); assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'runtime-metrics.json'), JSON.stringify(metrics, null, 2) + '\n'); record('各次页面和运行错误均为零');
  for (const filename of runtimeFiles) assert.equal(hash(await fs.readFile(path.join(target.sample, filename))), sourceHashes[filename], `${filename} remained unchanged during acceptance`);
  assert.equal(hash(await fs.readFile(source)), hash(sourceBytes), 'recorded source remains unchanged');
  completed = true; phase = 'complete';
} catch (error) {
  checks.push({ name: phase, ok: false, error: error.stack, wallSeconds: wall(), autonomousSeconds }); console.error(error.stack); process.exitCode = 1;
  if (page) { await capture('failure').catch(() => {}); await checkpoint('failure-world').catch(() => {}); }
} finally {
  if (electron) await closeNormally().catch(async error => { errors.push({ message: error.message }); process.exitCode = 1; await electron?.close().catch(() => {}); });
  await report(); console.log(`Evidence: ${output}`);
}
