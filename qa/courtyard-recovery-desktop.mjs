/** UXR-07: visible Electron recovery journey using UI controls and real disk writes.
 * Usage: PLAYWRIGHT_MODULE=/installed/playwright node qa/courtyard-recovery-desktop.mjs --output=/absolute/fresh/directory
 * Optional --app=/absolute/App.app exercises a packaged build and its own modules.
 * Native save/open dialog results are supplied by a main-process test stub.
 * This verifies application recovery behavior, not native dialog keyboard/mouse input.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const appPath = option('app');
const sample = path.join(appPath ? path.join(appPath, 'Contents/Resources/app') : repo, 'prototypes/pixel_scene_validation');
const { createSectSession, commandSect, snapshotSect, validateSect } = await import(pathToFileURL(path.join(sample, 'sect-sim.mjs')));
const output = option('output') || await fs.mkdtemp(path.join(os.tmpdir(), 'courtyard-recovery-'));
assert(path.isAbsolute(output) && !output.startsWith(repo + path.sep), 'Evidence directory must be absolute and outside the repository');
await fs.mkdir(output, { recursive: true });
const saveDirectory = path.join(output, 'world'), savePath = path.join(saveDirectory, 'sect-save.json');
await fs.mkdir(saveDirectory, { recursive: false });
const exportPath = path.join(output, 'verified-recovery.json'), badPath = path.join(output, 'invalid-recovery.json');
const checks = [], interactions = [], errors = [], dialogStubs = [], sourceHashes = {};
const started = performance.now(), startedAt = new Date().toISOString();
let electron, page, activePhase = 'prepare', completed = false, directoryLocked = false;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const elapsed = () => Number(((performance.now() - started) / 1000).toFixed(3));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const name of ['courtyard-host.cjs', 'courtyard-preload.cjs', 'courtyard-main.mjs', 'courtyard-recovery.cjs', 'courtyard-persistence.mjs', 'sect-storage.cjs']) sourceHashes[name] = sha(await fs.readFile(path.join(sample, name)));
const record = (name, details = {}) => { checks.push({ name, ok: true, wallSeconds: elapsed(), ...details }); console.log(`PASS ${name}`); };
const status = () => page.evaluate(() => window.courtyardQA?.status() || null);
const snapshot = () => page.evaluate(() => window.courtyardQA.snapshot());
async function click(id) {
  await page.locator(`#${id}`).click();
  interactions.push({ id, wallSeconds: elapsed() });
}
async function capture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  await fs.writeFile(path.join(output, `${name}.txt`), await page.locator('body').innerText());
}
async function report() {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), wallSeconds: elapsed(),
    status: errors.length || checks.some(c => !c.ok) ? 'failed' : completed ? 'passed' : 'running', activePhase, output, saveDirectory, appPath: appPath || null,
    scope: 'Visible macOS Electron application; UI clicks for recovery actions; real filesystem EACCES; actual export readback and process restart.',
    nativeDialogs: 'showSaveDialog and showOpenDialog return specified files/cancellation through an Electron main-process test stub. Native file dialog keyboard/mouse interaction is not covered.',
    simulation: 'Production wall-clock pump; QA hooks only read status/snapshot; no direct in-window simulation mutation.',
    sourceHashes, checks, interactions, dialogStubs, errors }, null, 2) + '\n');
}
function playwright() {
  for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Set PLAYWRIGHT_MODULE to an installed Playwright package.');
}
async function launch({ corrupt = false } = {}) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  electron = await playwright()._electron.launch({ executablePath: appPath ? path.join(appPath, 'Contents/MacOS/Electron') : require(path.join(sample, 'node_modules/electron')),
    args: [...(appPath ? [] : [path.join(sample, 'courtyard-host.cjs')]), `--qa-dir=${saveDirectory}`, '--qa-scenario=native', '--show'], env, timeout: 30000 });
  page = await electron.firstWindow(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push({ phase: activePhase, message: error.message }));
  if (corrupt) await page.locator('#loading-actions').waitFor({ state: 'visible', timeout: 30000 });
  else await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden, null, { timeout: 30000 });
  assert(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => w.isVisible())), 'Window is visible');
}
async function stubDialog(kind, result) {
  dialogStubs.push({ kind, result, phase: activePhase, wallSeconds: elapsed() });
  await electron.evaluate(({ dialog }, { kind, result }) => {
    dialog[kind === 'save' ? 'showSaveDialog' : 'showOpenDialog'] = async () => result;
  }, { kind, result });
}
async function closeNormally() {
  const closing = electron.waitForEvent('close', { timeout: 20000 });
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closing; electron = null; page = null;
}
async function lockDirectory() { await fs.chmod(saveDirectory, 0o500); directoryLocked = true; }
async function unlockDirectory() { await fs.chmod(saveDirectory, 0o700); directoryLocked = false; }
async function chooseRecovery(filename) {
  await stubDialog('open', { canceled: false, filePaths: [filename] });
  await click('recovery-choose');
  await page.waitForFunction(() => !document.getElementById('recovery-choose').disabled);
}
async function restoreSelected() {
  const ready = page.waitForFunction(() => !document.getElementById('loading').hidden || document.getElementById('recovery-dialog').hidden);
  await click('recovery-confirm'); await ready;
  await page.waitForFunction(() => !!window.courtyardQA && document.getElementById('loading').hidden && document.getElementById('recovery-dialog').hidden, null, { timeout: 30000 });
}

try {
  const seed = createSectSession();
  assert(commandSect(seed, { type: 'enable-courtyard-terrain' }).ok);
  assert(commandSect(seed, { type: 'pause', paused: true }).ok);
  const initial = snapshotSect(seed); assert.equal(validateSect(initial), true);
  await fs.writeFile(savePath, JSON.stringify(initial));
  await fs.writeFile(badPath, '{"format":"pixel-sect-session","version":999}\n');
  const originalBytes = await fs.readFile(savePath);
  activePhase = 'save-protection'; await launch();
  assert.equal((await status()).manualPause, true);
  await click('pause');
  await page.waitForFunction(tick => window.courtyardQA.view().tick >= tick + 15, initial.state.worldTick);
  await click('pause');
  const beforeFailure = await snapshot();
  assert(beforeFailure.state.worldTick > initial.state.worldTick);
  await lockDirectory(); await click('save');
  await page.waitForFunction(() => window.courtyardQA.status().persistence.protected);
  assert.match((await status()).persistence.error, /EACCES|permission denied/i);
  assert.equal(await page.locator('#save-protection').isVisible(), true);
  assert.deepEqual(await fs.readFile(savePath), originalBytes, 'Failed atomic save preserves original disk bytes');
  const protectedSnapshot = await snapshot(); await wait(500);
  assert.deepEqual(await snapshot(), protectedSnapshot, 'Protected world does not advance');
  await capture('01-save-protection');
  record('real EACCES activates protection and preserves original disk and paused memory', { tick: protectedSnapshot.state.worldTick, originalHash: sha(originalBytes) });

  activePhase = 'export-cancel';
  await stubDialog('save', { canceled: true }); await click('export-recovery');
  await page.waitForFunction(() => document.getElementById('recovery-note').textContent.includes('取消导出'));
  assert.equal(await page.locator('#exit-recovery').isDisabled(), true);
  assert.equal((await status()).persistence.protected, true);
  assert.deepEqual(await snapshot(), protectedSnapshot);
  await capture('02-export-cancelled'); record('cancelled export keeps memory and save protection');

  activePhase = 'export-verified';
  await stubDialog('save', { canceled: false, filePath: exportPath }); await click('export-recovery');
  await page.waitForFunction(() => !document.getElementById('exit-recovery').disabled);
  const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'));
  assert.equal(validateSect(exported), true);
  assert.deepEqual(exported.state, protectedSnapshot.state);
  assert.equal(exported.state.speed, 0);
  assert.equal((await status()).persistence.protected, true);
  assert.deepEqual(await fs.readFile(savePath), originalBytes);
  await capture('03-export-verified'); record('export writes and rereads complete recoverable memory while retaining protection', { exportedHash: sha(await fs.readFile(exportPath)), tick: exported.state.worldTick });
  const closed = electron.waitForEvent('close', { timeout: 20000 });
  await click('exit-recovery'); await closed; electron = null; page = null;
  const lifecycle = (await fs.readFile(path.join(saveDirectory, 'lifecycle.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert(lifecycle.some(event => event.type === 'close-with-verified-recovery'));
  await unlockDirectory();
  assert.deepEqual(await fs.readFile(savePath), originalBytes);
  record('explicit recovery exit revalidates exported file and closes without overwriting original');

  activePhase = 'preview-and-restore'; await launch();
  assert.equal((await snapshot()).state.worldTick, initial.state.worldTick);
  await click('recovery-open'); await chooseRecovery(badPath);
  assert.equal(await page.locator('#recovery-confirm').isDisabled(), true);
  assert.match(await page.locator('#recovery-preview').innerText(), /无效|版本|格式/);
  assert.deepEqual(await fs.readFile(savePath), originalBytes);
  await capture('04-invalid-preview'); record('invalid recovery preview blocks confirmation and preserves live save');
  await chooseRecovery(exportPath);
  assert.equal(await page.locator('#recovery-confirm').isDisabled(), false);
  assert.match(await page.locator('#recovery-preview').innerText(), /verified-recovery.json/);
  assert.deepEqual(await fs.readFile(savePath), originalBytes, 'Valid preview is read-only');
  await capture('05-valid-preview'); await click('recovery-cancel');
  await page.waitForFunction(() => document.getElementById('recovery-dialog').hidden);
  assert.equal((await status()).manualPause, true);
  assert.equal((await status()).importing, false);
  assert.deepEqual(await fs.readFile(savePath), originalBytes);
  assert.equal((await snapshot()).state.worldTick, initial.state.worldTick);
  record('cancelling a valid preview returns to the same paused world without restoring');
  await click('recovery-open'); await chooseRecovery(exportPath); await restoreSelected();
  assert.deepEqual((await snapshot()).state, exported.state);
  assert.equal((await status()).manualPause, true);
  const restoredTick = (await snapshot()).state.worldTick; await wait(500);
  assert.equal((await snapshot()).state.worldTick, restoredTick);
  const backupNames = (await fs.readdir(saveDirectory)).filter(name => name.startsWith('before-recovery-'));
  const diskBackup = backupNames.find(name => name.startsWith('before-recovery-disk-'));
  const memoryBackup = backupNames.find(name => name.startsWith('before-recovery-memory-'));
  assert(diskBackup && memoryBackup);
  assert.deepEqual(await fs.readFile(path.join(saveDirectory, diskBackup)), originalBytes);
  assert.equal(validateSect(JSON.parse(await fs.readFile(path.join(saveDirectory, memoryBackup), 'utf8'))), true);
  await capture('06-restored'); record('UI restore after process restart preserves manual pause and backs up disk and memory', { tick: restoredTick, backups: backupNames });

  activePhase = 'retry-save'; await lockDirectory(); await click('save');
  await page.waitForFunction(() => window.courtyardQA.status().persistence.protected);
  await unlockDirectory(); await click('retry-save');
  await page.waitForFunction(() => !window.courtyardQA.status().persistence.protected);
  assert.equal((await status()).manualPause, true);
  assert.equal((await snapshot()).state.speed, 0);
  await capture('07-retry-saved'); record('explicit save retry clears protection while preserving manual pause');
  await closeNormally();

  activePhase = 'corrupt-startup';
  const corruptedBytes = Buffer.from('{"broken":');
  await fs.copyFile(savePath, path.join(output, 'before-corrupt-startup.json'));
  await fs.writeFile(savePath, corruptedBytes); await launch({ corrupt: true });
  assert.match(await page.locator('#loading-error').innerText(), /读取失败/);
  assert.deepEqual(await fs.readFile(savePath), corruptedBytes);
  await capture('08-corrupt-startup'); await click('loading-recovery'); await chooseRecovery(exportPath);
  await capture('09-corrupt-recovery-preview'); await restoreSelected();
  assert.deepEqual((await snapshot()).state, exported.state);
  assert.equal((await status()).manualPause, true);
  const freshBackups = (await fs.readdir(saveDirectory)).filter(name => name.startsWith('before-recovery-') && !backupNames.includes(name));
  assert.equal(freshBackups.length, 1, 'Failed startup has no loaded memory to back up');
  assert.deepEqual(await fs.readFile(path.join(saveDirectory, freshBackups[0])), corruptedBytes);
  await capture('10-corrupt-startup-restored'); record('corrupt primary save recovers from startup UI and preserves original damaged bytes', { backups: freshBackups });
  await closeNormally(); completed = true; activePhase = 'complete';
} catch (error) {
  checks.push({ name: activePhase, ok: false, wallSeconds: elapsed(), error: error.stack || String(error) });
  if (page && !page.isClosed()) await capture('failure').catch(() => {});
  console.error(error.stack || error); process.exitCode = 1;
} finally {
  if (directoryLocked) await unlockDirectory().catch(() => {});
  if (electron) { await electron.evaluate(({ app }) => app.exit()).catch(() => {}); electron = null; }
  await report(); console.log(JSON.stringify({ output, passed: checks.filter(c => c.ok).length, failed: checks.filter(c => !c.ok).length, errors: errors.length, completed }));
  if (errors.length) process.exitCode = 1;
}
