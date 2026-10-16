/** Source-layout acceptance using an independent copy of one existing desktop save.
 * node tests/acceptance/courtyard-migration-desktop.mjs --source=/absolute/sect-save.json
 * Optional --app=/absolute/package.app --output=/absolute/fresh/evidence-directory.
 * Every state-changing action goes through the visible UI; QA reads observations only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { desktopTarget, repositoryRoot } from './desktop-target.mjs';

const require = createRequire(import.meta.url);
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option('source-save') || option('source'), appPath = option('app');
assert(source && path.isAbsolute(source), '--source must be an existing absolute desktop save path');
const target = desktopTarget(appPath);
const { restoreSect, validateSect, snapshotSect } = await import(pathToFileURL(path.join(target.sample, 'sect-sim.mjs')));
const originalBytes = await fs.readFile(source), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const initial = snapshotSect(restoreSect(originalBytes.toString('utf8')));
assert(validateSect(initial));
assert.equal(initial.state.speed, 0, 'Use a paused checkpoint so its exact restored state can be compared');
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-migration-'));
const relativeOutput = path.relative(repositoryRoot, output);
assert(path.isAbsolute(output) && (relativeOutput === '..' || relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput)),
  'Evidence directory must be absolute and outside the repository');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world');
await fs.mkdir(saveDirectory, { recursive: false });
const savePath = path.join(saveDirectory, 'sect-save.json');
await fs.writeFile(savePath, originalBytes, { flag: 'wx' });
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const checks = [], errors = [], interactions = [];
let electron, page, completed = false;
const startedAt = new Date().toISOString(), started = performance.now();
const read = () => page.evaluate(() => window.courtyardQA.snapshot());
const record = name => { checks.push({ name, ok: true }); console.log(`PASS ${name}`); };
const click = async id => { await page.locator(`#${id}`).click(); interactions.push({ id, wallSeconds: (performance.now() - started) / 1000 }); };

async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ executablePath: target.executable,
    args: [...target.args, `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], env, timeout: 30000 });
  page = await electron.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => window.courtyardQA.metrics().errors), []);
  assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())));
}
async function close() {
  const closed = electron.waitForEvent('close', { timeout: 20000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed; electron = null; page = null;
}

try {
  await launch();
  assert.deepEqual((await read()).state, initial.state);
  assert.equal(await page.evaluate(() => window.courtyardQA.status().manualPause), true);
  record('existing save loads with identical simulation state and pause');
  for (const id of ['affairs', 'people', 'growth', 'supply']) {
    await click(id);
    assert(await page.locator('#management').isVisible(), `${id} opens management`);
    await click('close-management');
  }
  assert.deepEqual((await read()).state, initial.state);
  record('four management entrances open without changing paused state');
  await click('pause');
  await page.waitForFunction(tick => window.courtyardQA.view().tick >= tick + 20, initial.state.worldTick);
  await click('pause');
  const advanced = await read();
  assert(advanced.state.worldTick > initial.state.worldTick);
  await click('save');
  await page.waitForFunction(() => window.courtyardQA.status().persistence.pending === 0 && !window.courtyardQA.status().persistence.saving);
  assert.deepEqual(JSON.parse(await fs.readFile(savePath, 'utf8')).state, advanced.state);
  await page.screenshot({ path: path.join(output, 'before-restart.png') });
  record('real elapsed time advances the copied world and UI save persists it');
  await close();
  const closedSave = JSON.parse(await fs.readFile(savePath, 'utf8'));
  assert.deepEqual(closedSave.state, advanced.state);
  await launch();
  assert.deepEqual((await read()).state, closedSave.state);
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.deepEqual((await read()).state, closedSave.state);
  await page.screenshot({ path: path.join(output, 'after-restart.png') });
  await close();
  record('normal close and fresh process reopen retain state without elapsed offline progress');
  assert.deepEqual(await fs.readFile(source), originalBytes);
  assert.deepEqual(errors, []);
  record('source save remains byte-identical and runtime has no page or resource errors');
  completed = true;
} catch (error) {
  errors.push(error.stack || String(error)); process.exitCode = 1;
} finally {
  if (electron) await electron.close().catch(error => errors.push(String(error)));
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: completed ? 'passed' : 'failed', startedAt,
    wallSeconds: (performance.now() - started) / 1000, source, sourceSha256: sha(originalBytes), app: appPath || null,
    saveDirectory, checks, interactions, errors,
    scope: 'Visible desktop source-layout migration; one copied paused save, UI panels, real-time progress, save and process restart.' }, null, 2) + '\n');
  console.log(`Evidence: ${output}`);
  if (errors.length) console.error(errors.join('\n'));
}
