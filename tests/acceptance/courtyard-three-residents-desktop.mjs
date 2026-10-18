/** Three residents: visible admission, real-time operation and exact desktop recovery.
 * node tests/acceptance/courtyard-three-residents-desktop.mjs
 * --source=/absolute/source-world.json --output=/absolute/fresh/evidence
 * [--seconds=1200] [--minimize-seconds=180] [--app=/absolute/App.app]
 * Only visible gameplay controls mutate the world; courtyardQA reads observations.
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
const minimumSeconds = Number(option('seconds') ?? 1200), minimumMinimized = Number(option('minimize-seconds') ?? 180);
assert(source && output && [source, output, ...(app ? [app] : [])].every(path.isAbsolute));
assert(Number.isFinite(minimumSeconds) && minimumSeconds >= 10 && minimumSeconds <= 1800);
assert(Number.isFinite(minimumMinimized) && minimumMinimized >= 0 && minimumMinimized <= minimumSeconds);
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot) + path.sep), 'evidence belongs outside the repository');
const target = desktopTarget(app);
const { restoreSect, validateSect } = await import(pathToFileURL(path.join(target.sample, 'sect-sim.mjs')));
const { slotById } = await import(pathToFileURL(path.join(target.simulation, 'ea-facility-slots.mjs')));
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceBytes = await fs.readFile(source), original = JSON.parse(sourceBytes), initial = restoreSect(original);
assert.deepEqual(initial.state, original.state, 'restoration preserves the recorded world');
assert.equal(initial.state.speed, 0, 'source is paused');
assert.equal(initial.provenance.kind, 'normal-public-command-checkpoint');
const MASTER = 'person:master', LU = 'person:lu-zhiwei', LIN = 'person:lin-changfeng';
const expectedIds = [MASTER, LU, LIN].sort();
assert(initial.state.homeMemberIds.includes(LU));
const startsWithThree = initial.state.homeMemberIds.includes(LIN);
const identity = Object.fromEntries(expectedIds.map(id => {
  const person = initial.state.personsById[id]; assert(person, `${id} is a persistent source person`);
  return [id, { name: person.name, appearance: person.appearance }];
}));
const policy = { herbTarget: 30, foodTarget: 32, spendingCap: 12, risk: 'balanced' };
const saveDirectory = path.join(output, 'world'), savePath = path.join(saveDirectory, 'sect-save.json');
const harnessBytes = await fs.readFile(new URL(import.meta.url));
const started = performance.now(), startedAt = new Date().toISOString();
const wall = () => Number(((performance.now() - started) / 1000).toFixed(3));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], errors = [], samples = [], interactions = [], checkpoints = [], sessions = [], background = [];
const events = new Map(), facts = new Map(), transports = new Map(), sourceHashes = {};
const restEvidence = new Map(), workEvidence = new Map(), activityHistory = new Map();
const initialFactIds = new Set(Object.keys(initial.state.factsById));
const initialTransportIds = new Set(Object.values(initial.state.workOrdersById).filter(order => order.kind === 'transport').map(order => order.id));
let electron, page, previous, sessionStarted, phase = 'prepare', completed = false, finalSummary = null;
let runningSeconds = 0, autonomousSeconds = 0, lastReport = 0, lastCheckpoint = 0, postAdmissionStart = null;
let minimizedStart, minimizedBefore, minimizedDone = minimumMinimized === 0, carriedRecorded = false, deliveredRecorded = false, woodDelivered = false;
const read = () => page.evaluate(() => window.courtyardQA.view());
const snapshot = async () => restoreSect(await page.evaluate(() => window.courtyardQA.snapshot()));
const status = () => page.evaluate(() => window.courtyardQA.status());
const key = name => page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const personKey = name => page.locator('#dialog').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record = (name, detail = {}) => { checks.push({ name, ok: true, wallSeconds: wall(), autonomousSeconds, ...detail }); console.log(`PASS ${name}`); };
async function click(locator, label) {
  previous = null; await locator.click();
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
  const data = await snapshot(); assert.equal(validateSect(data), true);
  await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(data) + '\n');
  checkpoints.push({ name, tick: data.state.worldTick, wallSeconds: wall(), autonomousSeconds, sha256: hash(JSON.stringify(data)) });
  return data;
}
async function hashRuntime() {
  const files = [];
  for (const directory of [target.sample, target.simulation]) {
    for (const filename of await fs.readdir(directory)) {
      if (/\.(mjs|cjs|js|html|css|json)$/.test(filename)) files.push(path.join(directory, filename));
    }
  }
  return Object.fromEntries(await Promise.all(files.map(async filename => [path.relative(target.root, filename), hash(await fs.readFile(filename))])));
}
async function report() {
  const result = {
    startedAt, updatedAt: new Date().toISOString(), status: checks.some(check => !check.ok) || errors.length ? 'failed' : completed ? 'passed' : 'running', phase,
    source, sourceSha256: hash(sourceBytes), sourceWorldTick: original.state.worldTick, startsWithThree,
    app: app || null, desktopTarget: app ? 'provided desktop package' : 'local source Electron', platform: process.platform,
    harnessSha256: hash(harnessBytes), sourceHashes, saveDirectory, policy,
    wallSeconds: wall(), runningSeconds, autonomousSeconds, minimumAutonomousSeconds: minimumSeconds,
    isTwentyMinuteAcceptance: minimumSeconds >= 1200,
    timeMethod: 'Monotonic intervals between read-only samples, unpaused automatic mode with advancing ticks. Intervals above three seconds and UI interventions are excluded. Native minimization is included while ticks advance.',
    checks, errors, interactions, sessions, background, checkpoints, summary: finalSummary,
    scope: 'One recorded normal-command courtyard; visible construction and admission when starting with two residents; autonomous work, physical slots, food collection and delivery; pause, save and exact close/reopen.',
    boundaries: ['Windows hardware', 'visitor route before the recorded source', 'four or five residents', 'complete new-save campaign'],
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
async function until(predicate, label, timeout = 90000) {
  const began = performance.now();
  while (performance.now() - began < timeout) {
    const value = await snapshot(); if (predicate(value)) return value;
    const metrics = await page.evaluate(() => window.courtyardQA.metrics());
    assert.deepEqual(metrics.errors, []); assert.deepEqual(errors, []);
    await wait(400);
  }
  throw Error(`${label} did not finish within ${timeout / 1000} real seconds`);
}
function auditResidents(s) {
  assert.deepEqual([MASTER, ...s.homeMemberIds].sort(), expectedIds, 'exactly the three expected residents remain');
  for (const [id, expected] of Object.entries(identity)) {
    const p = s.personsById[id]; assert.deepEqual({ name: p.name, appearance: p.appearance }, expected, `${id} identity remains`);
  }
}
async function observe() {
  const observation = await page.evaluate(() => ({ v: window.courtyardQA.view(), s: window.courtyardQA.snapshot(), metrics: window.courtyardQA.metrics() }));
  const { v, metrics } = observation, s = restoreSect(observation.s), state = s.state, now = performance.now();
  assert.deepEqual(metrics.errors, [], 'runtime error collection stays empty'); assert.deepEqual(errors, [], 'page errors stay empty');
  assert.deepEqual(v.policy, policy, 'policy remains unchanged'); auditResidents(state);
  assert.equal(v.sceneId, 'scene:yunxiu-courtyard'); assert.equal(v.foodSupply.dailyDemand, 6, 'three residents consume six daily food');
  assert.equal(v.economy.starvation, 0, 'regular supply prevents starvation');
  assert(v.budget.spent <= policy.spendingCap, 'preparation allowance is respected');
  if (previous) {
    const elapsed = (now - previous.now) / 1000;
    if (elapsed <= 3 && !previous.paused && !v.paused && v.tick > previous.tick) {
      runningSeconds += elapsed;
      if (previous.mode === 'auto' && v.control.mode === 'auto') autonomousSeconds += elapsed;
    }
  }
  previous = { now, tick: v.tick, paused: v.paused, mode: v.control.mode };
  const slots = Object.values(state.reservationsById).filter(r => ['slot', 'sr-slot'].includes(r.kind));
  const physicalReservations = [];
  for (const reservation of slots) {
    const slot = slotById(state, reservation.slotId); assert(slot, 'reservation references a physical slot');
    assert(!physicalReservations.some(old => Math.hypot(old.x - slot.position.x, old.y - slot.position.y) < .01), 'physical stations and beds have one holder');
    physicalReservations.push({ id: reservation.id, personId: reservation.personId, slotId: reservation.slotId, ...slot.position });
  }
  const people = expectedIds.map(id => {
    const p = state.personsById[id], position = p.scenic || p.mind.scenic, activity = state.activitiesById[p.activityId];
    if (activity?.kind === 'facility' && activity.phase === 'executing') {
      const slot = slotById(state, activity.slotId), reservation = state.reservationsById[activity.reservationId];
      assert(slot); assert.equal(reservation?.personId, id); assert.equal(reservation?.slotId, slot.id);
      assert(Math.hypot(position.x - slot.position.x, position.y - slot.position.y) < .05, `${id} reaches the actual facility slot`);
      const proof = { personId: id, tick: state.worldTick, activity: activity.action, slotId: slot.id, position: { x: position.x, y: position.y }, slotPosition: slot.position, energy: p.energy };
      if (activity.action === 'rest' && !restEvidence.has(id)) restEvidence.set(id, proof);
      if (activity.action === 'work' && !workEvidence.has(id)) workEvidence.set(id, proof);
    }
    const kinds = activityHistory.get(id) || new Set(); kinds.add(activity?.action || activity?.kind || 'idle'); activityHistory.set(id, kinds);
    return { id, name: p.name, x: position.x, y: position.y, energy: p.energy, wound: p.wound, activity: activity ? structuredClone(activity) : null, membership: p.membership, path: position.path || [], reason: p.mind?.reason || s.reason };
  });
  for (const event of v.ledger) if (event.id >= initial.nextLedgerId && !events.has(event.id)) events.set(event.id, { ...event, firstObservedWallSeconds: wall() });
  for (const fact of Object.values(state.factsById)) if (!initialFactIds.has(fact.id) && !facts.has(fact.id)) facts.set(fact.id, { ...fact, firstObservedWallSeconds: wall() });
  for (const order of v.transports) if (!initialTransportIds.has(order.id)) {
    const old = transports.get(order.id);
    transports.set(order.id, { ...order, firstObservedWallSeconds: old?.firstObservedWallSeconds ?? wall(), lastObservedWallSeconds: wall(), observedTick: v.tick, phases: [...new Set([...(old?.phases || []), order.phase])] });
  }
  samples.push({ wallSeconds: wall(), runningSeconds, autonomousSeconds, tick: v.tick, paused: v.paused, policy: v.policy, control: v.control,
    resources: v.resources, foodSupply: v.foodSupply, budget: v.budget, economy: v.economy, supplyDay: state.economy.lastSupplyDay, people, slots: physicalReservations, reason: v.reason });
  return v;
}
async function openLin() {
  await click(page.locator('#people'), '人物'); await click(key(`person:${LIN}`), '选择林长风'); await click(key(`person:inspect:${LIN}`), '查看林长风近况');
  assert.equal(await page.locator('#person-name').innerText(), '林长风');
}
async function prepareThreeResidents() {
  // Visible controls are matched to the implemented public management entries.
  phase = 'visible-construction-and-admission';
  await click(page.locator('#affairs'), '院务营造');
  await click(key('growth:building:lumber'), '查看伐木场营造');
  await click(key('growth:build:lumber'), '营造伐木场');
  await closePanel(); await pause(false);
  await until(s => s.state.buildings.some(b => b.type === 'lumber'), 'physical lumber construction');
  await pause(true); const built = await checkpoint('01-lumber-complete'); await capture('01-lumber-complete');
  assert.equal(built.state.buildings.filter(b => b.type === 'lumber').length, 1);
  assert.equal(built.state.stockpilesById['stockpile:yunxiu'].resources.wood, initial.state.stockpilesById['stockpile:yunxiu'].resources.wood - 20);
  assert.equal(built.state.stockpilesById['stockpile:yunxiu'].resources.stone, initial.state.stockpilesById['stockpile:yunxiu'].resources.stone - 8);
  record('实际营造伐木场，材料按正式工单扣除');
  await openLin(); await click(page.locator('#approach-person'), '走近林长风'); await pause(false);
  await until(s => {
    const a = s.state.master.scenic, b = s.state.personsById[LIN].mind.scenic;
    return Math.hypot(a.x - b.x, a.y - b.y) <= 2.4 && a.path.length === 0;
  }, 'walk to Lin Changfeng');
  if (await page.locator('#dialog').isVisible()) await click(page.locator('#close-person'), '收起到场交谈');
  await pause(true); await openLin(); await capture('02-admission-ready');
  const before = await snapshot();
  await click(personKey('person:admission'), '商议门籍');
  await personKey('person:rank').selectOption('outer');
  await click(personKey('person:admission-cancel'), '取消本次商议');
  assert.deepEqual(await snapshot(), before, 'canceling the membership form preserves the exact session');
  record('取消门籍表单保持完整世界');
  await click(personKey('person:admission'), '再次商议门籍');
  await personKey('person:rank').selectOption('outer');
  await click(personKey('person:admission-confirm'), '确认外门门籍');
  const admitted = await checkpoint('03-admitted-world');
  auditResidents(admitted.state); assert.equal(admitted.state.story.step, 3);
  assert.equal(new Set(admitted.state.homeMemberIds).size, admitted.state.homeMemberIds.length);
  const admission = admitted.state.courtyardAdmissions.recordsByPersonId[LIN];
  assert.equal(admission.rank, 'outer'); assert.equal(admission.mentorId, null);
  assert.equal(admission.affiliationId, 'scene:yunxiu-courtyard');
  assert.equal(admitted.state.factsById[admission.factId].kind, 'courtyard-admission');
  assert.deepEqual(admitted.state.stockpilesById['stockpile:yunxiu'].resources, before.state.stockpilesById['stockpile:yunxiu'].resources);
  await capture('03-three-residents');
  record('走近林长风并确认门籍，保留同一身份与三人世界', { tick: admitted.state.worldTick, memberIds: admitted.state.homeMemberIds });
  if (await page.locator('#dialog').isVisible()) await click(page.locator('#close-person'), '收起人物交谈');
  await closePanel();
}
async function deliverLumber() {
  phase = 'visible-lumber-delivery'; await pause(true);
  const before = await snapshot(), lumber = before.state.buildings.find(b => b.type === 'lumber');
  const stockId = `stockpile:${lumber.instanceId}`, quantity = 18;
  assert(before.state.stockpilesById[stockId].resources.wood >= quantity);
  await click(page.locator('#supply'), '物资'); await click(key('subtab:stocks'), '各处货位');
  await click(key(`stock:${stockId}`), '查看伐木场边货位'); await click(key('stock:transfer:wood'), '搬运木材');
  await key('transfer:quantity').fill(String(quantity)); await click(key('transfer:submit'), '安排十八份木材搬回公库');
  const started = await snapshot();
  const order = Object.values(started.state.workOrdersById).find(o => o.kind === 'transport' && o.sourceStockpileId === stockId && !['delivered', 'cancelled'].includes(o.phase));
  assert(order); assert.equal(order.cargo.wood, quantity);
  await closePanel(); await pause(false);
  await until(s => s.state.workOrdersById[order.id]?.phase === 'carrying', 'collect lumber at its real stockpile');
  await pause(true); await checkpoint('wood-in-transit'); await capture('wood-in-transit');
  await pause(false);
  await until(s => s.state.workOrdersById[order.id]?.phase === 'delivered', 'deliver lumber to public storage');
  await pause(true); const delivered = await checkpoint('wood-delivered'); await capture('wood-delivered');
  assert.equal(delivered.state.stockpilesById['stockpile:yunxiu'].resources.wood, before.state.stockpilesById['stockpile:yunxiu'].resources.wood + quantity);
  record('场边实产木材十八份由掌门取货并运回公库', { orderId: order.id, quantity, beforePublicWood: before.state.stockpilesById['stockpile:yunxiu'].resources.wood, afterPublicWood: delivered.state.stockpilesById['stockpile:yunxiu'].resources.wood });
  woodDelivered = true;
  await click(page.locator('#affairs'), '院务'); await click(key('affairs:policy'), '自主安排'); await click(key('policy:auto'), '搬运完成后交回自主');
  await closePanel(); await pause(false); phase = 'three-resident-autonomy'; previous = null;
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
  const fields = ['state', 'policy', 'control', 'budget', 'automation', 'ledger', 'totals', 'carrySeconds'];
  for (const field of fields) assert.deepEqual(saved[field], paused[field], `${field} saved exactly`);
  await capture('06-paused-saved'); await closeNormally();
  const closedDisk = JSON.parse(await fs.readFile(savePath, 'utf8'));
  for (const field of fields) assert.deepEqual(closedDisk[field], paused[field], `${field} remains exact on close`);
  const closedAt = performance.now(); await wait(5000); await launch();
  const reopened = await checkpoint('07-reopened-world');
  for (const field of [...fields, 'nextLedgerId', 'reason', 'baseline', 'provenance']) assert.deepEqual(reopened[field], closedDisk[field], `${field} survives reopening exactly`);
  auditResidents(reopened.state); assert.equal((await status()).manualPause, true); await capture('07-reopened');
  record('保存关闭五秒后重开，三人身份、物资、工位与世界精确恢复', { tick: reopened.state.worldTick, closedWallSeconds: (performance.now() - closedAt) / 1000 });
}

try {
  await fs.mkdir(saveDirectory, { recursive: true });
  await fs.writeFile(savePath, JSON.stringify(initial) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(output, 'executed-harness.mjs'), harnessBytes);
  await fs.writeFile(path.join(output, 'initial-world.json'), JSON.stringify(initial) + '\n');
  Object.assign(sourceHashes, await hashRuntime());
  await launch(); assert.deepEqual((await snapshot()).state, original.state);
  await capture('00-source-world'); record('载入固定来源暂停档，正式世界保持', { sourceSha256: hash(sourceBytes), tick: initial.state.worldTick });
  if (!startsWithThree) await prepareThreeResidents();
  else { auditResidents((await snapshot()).state); record('同源三人结束档载入'); }
  await click(page.locator('#affairs'), '院务'); await click(key('affairs:policy'), '自主安排');
  for (const name of ['foodTarget', 'herbTarget', 'spendingCap']) await key(`policy:${name}`).fill(String(policy[name]));
  await key('policy:risk').selectOption(policy.risk); await click(key('policy:save'), '保存自主安排');
  assert.deepEqual((await read()).policy, policy); await capture('04-autonomy-policy');
  await click(key('policy:auto'), '交回自主'); await closePanel(); await pause(false);
  postAdmissionStart = await snapshot(); phase = 'three-resident-autonomy'; await observe();
  record('界面保存口粮32、灵草30与整备额度12，三人开始自主经营', { policy, tick: postAdmissionStart.state.worldTick });
  while (autonomousSeconds < minimumSeconds || !minimizedDone) {
    await wait(650); const v = await observe();
    if (!carriedRecorded && v.foodSupply.carried >= 16) {
      await checkpoint('food-carried'); if (!minimizedStart) await capture('food-carried'); carriedRecorded = true;
      record('自主实采口粮进入随身货位', { tick: v.tick, foodSupply: v.foodSupply });
    }
    if (!deliveredRecorded && [...transports.values()].some(order => order.phase === 'delivered' && order.cargo.food >= 16 && order.sourceStockpileId === 'stockpile:carried:master' && order.targetStockpileId === 'stockpile:yunxiu')) {
      await checkpoint('food-delivered'); if (!minimizedStart) await capture('food-delivered'); deliveredRecorded = true;
      record('随身口粮经实际运输送入公库', { tick: v.tick, foodSupply: v.foodSupply });
    }
    if (minimizedStart) {
      const elapsed = (performance.now() - minimizedStart) / 1000;
      if (elapsed >= minimumMinimized) {
        await electron.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.restore(); window.show(); });
        assert(v.tick - minimizedBefore.tick >= elapsed * 8.5); assert(v.tick - minimizedBefore.tick <= elapsed * 11.5);
        background.push({ startTick: minimizedBefore.tick, endTick: v.tick, wallSeconds: elapsed, startFood: minimizedBefore.resources.food, endFood: v.resources.food });
        await capture('05-minimized-return'); record('原生最小化期间三人世界继续推进', background.at(-1)); minimizedStart = null; minimizedDone = true;
      }
    } else if (!minimizedDone && autonomousSeconds >= 60) {
      await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize()); await wait(250);
      assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()));
      minimizedBefore = await read(); minimizedStart = performance.now(); console.log('NATIVE MINIMIZATION STARTED');
    }
    if (!woodDelivered && minimizedDone && autonomousSeconds >= Math.min(260, minimumSeconds * .6) && v.operations.canTransport.available && v.stockpiles.some(stock => stock.id.startsWith('stockpile:building:') && stock.resources.wood >= 18)) await deliverLumber();
    if (wall() - lastCheckpoint >= 60) { await checkpoint(`minute-${Math.floor(autonomousSeconds / 60)}`); lastCheckpoint = wall(); }
    if (wall() - lastReport >= 30) {
      console.log(`RUN auto=${autonomousSeconds.toFixed(1)}s tick=${v.tick} food=${v.resources.food} starvation=${v.economy.starvation} work=${[...workEvidence.keys()].join(',')} rest=${[...restEvidence.keys()].join(',')}`);
      await report(); lastReport = wall();
    }
    assert(wall() < minimumSeconds + 360, 'bounded acceptance window');
  }
  await pause(true); const final = await checkpoint('final-world'), finalView = await read(); await capture('08-operation-finished');
  const production = [...facts.values()].filter(f => f.operation === 'production');
  const harvests = [...facts.values()].filter(f => f.operation === 'manual-harvest' && f.resource === 'food');
  const deliveries = [...transports.values()].filter(order => order.phase === 'delivered' && order.cargo.food === 16 && order.sourceStockpileId === 'stockpile:carried:master' && order.targetStockpileId === 'stockpile:yunxiu');
  const foodDrops = samples.slice(1).flatMap((sample, index) => {
    const before = samples[index]; return sample.supplyDay > before.supplyDay && before.resources.food - sample.resources.food === sample.foodSupply.dailyDemand ? [{ day: sample.supplyDay, beforeTick: before.tick, tick: sample.tick, beforeFood: before.resources.food, afterFood: sample.resources.food, consumed: sample.foodSupply.dailyDemand }] : [];
  });
  if (minimumSeconds >= 1200) {
    assert(woodDelivered, 'visible physical lumber delivery completes');
    assert(production.some(f => f.participantIds?.includes(LIN)), 'Lin contributes to actual production');
    assert(production.some(f => f.participantIds?.includes(LU)), 'Lu contributes to actual production');
    assert(workEvidence.has(LIN)); assert(workEvidence.has(LU));
    assert(restEvidence.has(LIN)); assert(restEvidence.has(LU));
    assert(harvests.length >= 2); assert(deliveries.length >= 2); assert(carriedRecorded); assert(deliveredRecorded); assert(foodDrops.length >= 2);
    record('两名门人自愿参与实际产出并使用真实床位休憩', { productionCount: production.length, workEvidence: [...workEvidence.values()], restEvidence: [...restEvidence.values()] });
    record('三人口粮持续实采、运输和按日消耗，饥荒保持为零', { harvests, deliveryCount: deliveries.length, foodDrops });
  }
  record('同一三人世界达到本轮真实自主运行时长', { autonomousSeconds, runningSeconds, minimumSeconds, initialTick: postAdmissionStart.state.worldTick, finalTick: final.state.worldTick });
  finalSummary = { initialFood: postAdmissionStart.state.stockpilesById['stockpile:yunxiu'].resources.food, finalFood: finalView.resources.food,
    harvestCount: harvests.length, harvestedFood: harvests.reduce((sum, f) => sum + f.quantity, 0), deliveredFood: deliveries.reduce((sum, o) => sum + o.cargo.food, 0), foodDrops,
    woodDelivered, productionCount: production.length, production, restEvidence: [...restEvidence.values()], workEvidence: [...workEvidence.values()],
    activityHistory: Object.fromEntries([...activityHistory].map(([id, values]) => [id, [...values]])), finalStarvation: finalView.economy.starvation, budget: finalView.budget };
  await lifecycle();
  const metrics = await page.evaluate(() => window.courtyardQA.metrics());
  assert.deepEqual(metrics.errors, []); assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'runtime-metrics.json'), JSON.stringify(metrics, null, 2) + '\n'); record('各次页面和运行错误均为零');
  assert.deepEqual(await hashRuntime(), sourceHashes, 'runtime files remained unchanged throughout acceptance');
  assert.equal(hash(await fs.readFile(source)), hash(sourceBytes), 'recorded source remains unchanged');
  completed = true; phase = 'complete';
} catch (error) {
  checks.push({ name: phase, ok: false, error: error.stack, wallSeconds: wall(), autonomousSeconds }); console.error(error.stack); process.exitCode = 1;
  if (page) { await capture('failure').catch(() => {}); await checkpoint('failure-world').catch(() => {}); }
} finally {
  if (electron) await closeNormally().catch(async error => { errors.push({ message: error.message }); process.exitCode = 1; await electron?.close().catch(() => {}); });
  await report(); console.log(`Evidence: ${output}`);
}
