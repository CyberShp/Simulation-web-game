/** Real courtyard UI regression. No alternate SIM, resource grants, or state patches.
 * Usage: node tests/acceptance/courtyard-operations-browser.mjs --output=/absolute/scratch/path
 * Optional PLAYWRIGHT_MODULE / CHROMIUM_PATH override installed dependencies.
 * Action waits use Playwright's browser clock after the real-time smoke check;
 * it runs the production pump and official SIM. This is not wall-clock soak QA.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { validateSect } from '../../apps/courtyard/sect-sim.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright',
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright')].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright is unavailable. Install playwright locally or set PLAYWRIGHT_MODULE / CODEX_PRIMARY_RUNTIME_NODE_MODULES.');
}
const { chromium } = loadPlaywright();
const { createSectStorage } = require('../../apps/courtyard/sect-storage.cjs');
const { exportCourtyardRecovery } = require('../../apps/courtyard/courtyard-recovery.cjs');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9) || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-browser-'));
assert(path.isAbsolute(output), '--output must be an absolute scratch directory');
await fs.mkdir(output, { recursive: true });
const saveDirectory = await fs.mkdtemp(path.join(output, 'storage-'));
const storage = createSectStorage({ directory: saveDirectory, validate: validateSect });
const checks = [], errors = [], writes = [];
let fault = false, delayNextWrite = false, releaseWrite, inFlight = 0, maximumInFlight = 0, closed = 0, cancelledCloses = 0;
let browser, page, virtual = false, browserStarted = false;
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname.startsWith('/apps/courtyard/assets/')
      ? '/assets/courtyard/' + pathname.slice('/apps/courtyard/assets/'.length) : pathname;
    const filename = path.resolve(repo, `.${relative}`);
    if (!filename.startsWith(repo + path.sep)) throw Error('outside repository');
    const bytes = await fs.readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/apps/courtyard/courtyard.html`;
const record = (name, detail = {}) => { checks.push({ name, ok: true, ...detail }); console.log(`PASS ${name}`); };
const view = () => page.evaluate(() => window.courtyardQA.view());
const snapshot = () => page.evaluate(() => window.courtyardQA.snapshot());
const tab = name => page.locator(`#${name}`).click();
const body = () => page.locator('#management-body');
const button = name => body().getByRole('button', { name, exact: true });
async function hostUntil(predicate, label) {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error(`Host did not finish: ${label}`);
}
const pause = async paused => {
  if ((await view()).paused !== paused) await page.locator('#pause').click();
  assert.equal((await view()).paused, paused);
};
async function advance(milliseconds) {
  assert(virtual, 'virtual wait must be explicitly enabled');
  await page.clock.fastForward(milliseconds);
}
async function until(predicate, label, seconds = 240) {
  for (let i = 0; i < seconds; i++) {
    const current = await view();
    if (predicate(current)) return current;
    if (i % 10 === 0) { await tab('affairs'); await button('亲自安排').click(); }
    await advance(1000);
  }
  throw Error(`Timed out through production pump: ${label}`);
}
async function open() {
  page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeBinding('__sectSettings', () => ({ qa: true, qaScenario: 'native', suspended: false }));
  await page.exposeBinding('__sectLoad', () => storage.load());
  await page.exposeBinding('__sectSave', async (_source, state) => {
    inFlight++; maximumInFlight = Math.max(maximumInFlight, inFlight);
    const entry = { tick: state.state.worldTick, speed: state.state.speed, phase: 'started' }; writes.push(entry);
    try {
      if (delayNextWrite) { delayNextWrite = false; await new Promise(resolve => { releaseWrite = resolve; }); }
      if (fault) { entry.phase = 'failed'; return { ok: false, error: 'QA injected disk failure' }; }
      const result = await storage.save(state); entry.phase = result.ok ? 'saved' : 'failed'; return result;
    } finally { inFlight--; }
  });
  await page.exposeBinding('__sectExport', (_source, state) => exportCourtyardRecovery({ filename: path.join(saveDirectory, 'recovery.json'), state, saveFilename: storage.filename, validate: validateSect }));
  await page.exposeBinding('__sectCloseReady', async () => { await storage.flush(); closed++; return true; });
  await page.exposeBinding('__sectCancelClose', () => { cancelledCloses++; return true; });
  await page.addInitScript(() => {
    window.__qaClosePending = false;
    window.sectHost = {
      settings: () => window.__sectSettings(), load: () => window.__sectLoad(), save: data => window.__sectSave(data),
      exportRecovery: data => window.__sectExport(data), closeReady: () => window.__sectCloseReady(),
      cancelClose: async () => { const result = await window.__sectCancelClose(); window.__qaClosePending = false; return result; },
      onClosing: callback => { window.__qaClose = event => {
        if (event?.reason === 'close') {
          if (window.__qaClosePending) return false;
          window.__qaClosePending = true;
        }
        return callback(event);
      }; },
      onPower: callback => { window.__qaPower = callback; },
    };
    window.sceneHost = { settings: () => window.__sectSettings() };
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.courtyardQA, null, { timeout: 30000 });
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), args: ['--no-sandbox'] });
  browserStarted = true;
  await open();
  const firstTick = (await view()).tick;
  await page.waitForTimeout(1150);
  assert((await view()).tick > firstTick, 'real time advances the official world');
  await pause(true);
  record('real-time official world and explicit pause', { firstTick, tick: (await view()).tick });
  await page.screenshot({ path: path.join(output, '01-courtyard-1672.png') });

  // Find an actual overlap in drawn hit regions; do not manufacture duplicate actors.
  const overlap = await page.evaluate(() => {
    const renderer = window.courtyardQA.renderer;
    for (const h of renderer.hitRegions) {
      const start = renderer.artToScreen({ x: h.x, y: h.y }), end = renderer.artToScreen({ x: h.x + h.w, y: h.y + h.h });
      for (let x = start.x; x <= end.x; x += 2) for (let y = start.y; y <= end.y; y += 2) {
        const people = renderer.pickPeople(x, y);
        if (people.length > 1) return { x, y, names: people.map(p => p.name) };
      }
    }
    return null;
  });
  assert(overlap, 'starting actors provide a real overlapping click target');
  await page.mouse.click(overlap.x, overlap.y);
  assert.match(await body().innerText(), /多位人物/);
  for (const name of overlap.names) assert.match(await body().innerText(), new RegExp(name));
  record('overlapping people open explicit candidates', overlap);

  await tab('people');
  const people = (await view()).people;
  assert.equal(people.length, 4);
  for (const person of people) assert.match(await body().innerText(), new RegExp(person.name));
  assert.equal(await body().getByRole('button', { name: '查看近况', exact: true }).count(), 4);
  record('four distinct people and building inspection entries');
  await body().getByRole('button', { name: '查看工位', exact: true }).first().click();
  assert.match(await page.locator('#building-detail').innerText(), /实际床位／工位/);
  assert((await page.locator('#building-slots p').count()) > 0);
  await page.screenshot({ path: path.join(output, '02-building-slots-1672.png') });
  await page.locator('#close-building').click();

  await tab('affairs');
  await body().locator('[name=herbTarget]').fill('42');
  await body().locator('[name=spendingCap]').fill('16');
  await body().locator('[name=risk]').selectOption('balanced');
  await button('保存安排').click();
  assert.deepEqual((await view()).policy, { herbTarget: 42, spendingCap: 16, risk: 'balanced' });
  await body().locator('[name=herbTarget]').fill('501');
  await button('保存安排').click();
  assert.equal((await view()).policy.herbTarget, 42, 'invalid form leaves real policy unchanged');
  await body().locator('[name=herbTarget]').fill('42');
  await button('保存安排').click();
  await page.locator('#people').focus();
  await page.keyboard.press('Space');
  assert.equal((await view()).paused, true, 'focused button does not trigger global pause');
  assert.equal(await page.locator('[data-tab=people]').getAttribute('aria-selected'), 'true');
  record('policy validation and keyboard Space on focused controls');

  await tab('growth');
  assert.equal(await body().getByRole('button', { name: /^研习/ }).count(), 3);
  assert(await button('灵草疗伤').isDisabled(), 'healthy master cannot spend unnecessary medicine');
  const beforeStudy = await view();
  await body().getByRole('button', { name: /^研习/ }).first().click();
  const studying = await view();
  assert(studying.operations.study, 'real study order created');
  assert.equal(studying.resources.food, beforeStudy.resources.food - 2);
  assert.equal(studying.operations.arts[0].understanding, beforeStudy.operations.arts[0].understanding);
  await button('中止当前事务').click();
  assert.equal((await view()).resources.food, beforeStudy.resources.food, 'unstarted study meal refunded');
  record('growth UI creates a priced study order and cancellation refunds reservation');

  await tab('supply');
  assert.match(await body().innerText(), /山院公库/);
  const foodCard = body().locator('.management-card').filter({ has: page.locator('h3', { hasText: /^口粮$/ }) });
  await foodCard.getByRole('button', { name: '亲自采集', exact: true }).click();
  assert.equal((await view()).operations.master.activity.kind, 'sr-harvest');
  await tab('growth'); await button('中止当前事务').click();
  assert.equal((await view()).resources.food, beforeStudy.resources.food);
  record('supply UI dispatches real harvest without instantly granting stock');

  // Virtual waiting starts only here: the real UI still makes every command.
  await page.clock.install(); virtual = true;
  await tab('growth'); await body().getByRole('button', { name: /^研习/ }).first().click();
  await pause(false);
  const completed = await until(v => v.operations.arts[0].understanding > beforeStudy.operations.arts[0].understanding, 'actual study desk completion');
  assert.equal(completed.operations.arts[0].understanding, beforeStudy.operations.arts[0].understanding + 12);
  assert.equal(completed.operations.arts[0].mastery, beforeStudy.operations.arts[0].mastery);
  await pause(true);
  await tab('people');
  assert.match(await body().innerText(), /主殿内/);
  assert(!(await page.evaluate(() => window.courtyardQA.renderer.hitRegions.some(h => h.person.id === 'person:master'))), 'indoor master is inspected through building, not painted outside');
  await page.screenshot({ path: path.join(output, '03-people-indoor-1672.png') });
  record('actual arrival and study completion, indoor roster remains visible', { waitMode: 'browser clock through production pump', tick: completed.tick });

  await tab('growth'); await button('修炼').click();
  const xpBefore = (await view()).operations.master.xp;
  await pause(false);
  const cultivated = await until(v => v.operations.master.xp > xpBefore, 'actual cultivation progress');
  await pause(true);
  record('cultivation UI grows the same master', { xpBefore, xpAfter: cultivated.operations.master.xp, waitMode: 'browser clock through production pump' });

  await tab('affairs');
  await page.screenshot({ path: path.join(output, '04-affairs-1672.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await advance(100);
  assert(await page.locator('#close-management').isVisible());
  const bounds = await page.locator('#management').boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'narrow panel stays within viewport');
  assert(await button('保存安排').isVisible());
  await page.screenshot({ path: path.join(output, '05-affairs-390.png') });
  record('narrow 390x844 management panel remains reachable');
  await page.setViewportSize({ width: 1672, height: 941 });
  await advance(100);

  const baselineWrite = writes.length;
  await page.locator('#save').click();
  await hostUntil(() => writes.length > baselineWrite && !inFlight && writes.at(-1).phase === 'saved', 'baseline manual save');
  const savedBytes = await fs.readFile(storage.filename, 'utf8');
  fault = true;
  await page.locator('#save').click();
  await page.locator('#save-protection').waitFor({ state: 'visible' });
  const frozen = await snapshot();
  await advance(3500);
  await button('交回自主').click();
  await body().locator('[name=herbTarget]').fill('88');
  await button('保存安排').click();
  assert.deepEqual(await snapshot(), frozen, 'failed-save protection blocks time and management changes');
  assert.equal(await fs.readFile(storage.filename, 'utf8'), savedBytes, 'last good file retained');
  await page.screenshot({ path: path.join(output, '06-save-protection-1672.png') });
  record('save failure freezes world and commands while retaining previous disk save');

  await page.locator('#export-recovery').click();
  await page.waitForFunction(() => document.getElementById('recovery-note').textContent.includes('已导出'));
  assert(await page.locator('#save-protection').isVisible());
  const recovery = JSON.parse(await fs.readFile(path.join(saveDirectory, 'recovery.json'), 'utf8'));
  assert.equal(validateSect(recovery), true);
  assert.equal(recovery.state.worldTick, frozen.state.worldTick);
  assert.equal(await fs.readFile(storage.filename, 'utf8'), savedBytes);
  record('separate recovery export validates and does not unlock protection');
  fault = false;
  await page.locator('#retry-save').click();
  await page.locator('#save-protection').waitFor({ state: 'hidden' });
  assert((await view()).paused, 'retry preserves explicit user pause');
  const retryTick = (await view()).tick;
  await advance(1200);
  assert.equal((await view()).tick, retryTick);
  record('successful retry removes protection while preserving manual pause');

  fault = true;
  await page.evaluate(() => window.__qaClose({ reason: 'close' }));
  assert.equal(closed, 0);
  assert.equal(cancelledCloses, 1, 'failed close explicitly releases host close-pending latch');
  assert.equal(await page.evaluate(() => window.__qaClosePending), false);
  assert(await page.locator('#save-protection').isVisible());
  fault = false;
  await page.locator('#retry-save').click();
  await page.locator('#save-protection').waitFor({ state: 'hidden' });
  assert((await view()).paused);
  record('failed closing save cancels host pending state before retry and another close');

  // Hold the host write, then deliver the actual host close notification.
  delayNextWrite = true;
  await page.locator('#save').click();
  await hostUntil(() => !!releaseWrite, 'delayed write entry');
  assert(releaseWrite, 'manual save reached real host binding');
  await page.evaluate(() => { window.__qaClosingPromise = window.__qaClose({ reason: 'close' }); });
  assert.equal(closed, 0);
  const count = writes.length;
  releaseWrite(); releaseWrite = null;
  await page.evaluate(() => window.__qaClosingPromise);
  assert.equal(closed, 1);
  assert.equal(writes.length, count + 1, 'close gets its own queued snapshot');
  assert.equal(maximumInFlight, 1, 'host writes never overlap');
  const closeSave = JSON.parse(await fs.readFile(storage.filename, 'utf8'));
  record('close waits for in-flight write then saves a serial final snapshot', { writes: writes.slice(-2), maximumInFlight });
  await page.close(); virtual = false;
  await new Promise(resolve => setTimeout(resolve, 600));
  await open();
  assert.equal((await view()).tick, closeSave.state.worldTick);
  assert.deepEqual((await view()).policy, closeSave.policy);
  assert((await view()).paused);
  assert.equal((await snapshot()).state.personsById['person:master'].personId, 'person:master');
  record('reopen restores identity, policy and exact frozen tick without offline progress');
  assert.deepEqual(errors, []);
  record('browser has no uncaught runtime errors');
} catch (error) {
  checks.push({ name: browserStarted ? 'failure' : 'browser unavailable; UI checks not run', ok: false, error: error.stack });
  console.error(error.stack);
  if (page) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure-body.txt'), await page.locator('body').innerText().catch(() => 'unavailable'));
  }
  process.exitCode = 1;
} finally {
  const report = { generatedAt: new Date().toISOString(), status: !browserStarted ? 'not_run' : checks.every(check => check.ok) ? 'passed' : 'failed', entry: url, saveDirectory,
    scope: 'Chromium loads official courtyard.html; real createSectStorage and recovery writer through injected host bindings. Native Electron OS dialogs/power/process shutdown are outside this browser test.',
    waitMode: 'Initial real-time smoke; explicit browser virtual clock for long action waits and protection checks. No simulator replacement or state/resource mutation.',
    checks, errors, writes, maximumInFlight, cancelledCloses };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  console.log(`Evidence: ${output}`);
}
