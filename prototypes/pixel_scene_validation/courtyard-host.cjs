const { app, BrowserWindow, ipcMain, powerMonitor, dialog } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createSectStorage } = require('./sect-storage.cjs');
const { exportCourtyardRecovery, readCourtyardRecovery, restoreCourtyardRecovery } = require('./courtyard-recovery.cjs');
const { createHash, randomUUID } = require('node:crypto');

const root = __dirname;
const distRoot = path.resolve(root, '../../dist');
const args = process.argv.slice(1);
const option = (key, fallback) => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
const qaDir = option('--qa-dir', '');
const title = '云岫山院·山院实景';
if (qaDir && !path.isAbsolute(qaDir)) throw new Error('--qa-dir must be an absolute path');
app.setName(title);
app.setAppUserModelId('games.xianfu.courtyard-master');
const profileDirectory = qaDir ? path.join(qaDir, 'electron-profile') : path.join(app.getPath('appData'), 'yunxiu-courtyard-master');
fs.mkdirSync(profileDirectory, { recursive: true });
app.setPath('userData', profileDirectory);
// A profile has one writer; a second launch brings its existing world forward.
const ownsProfile = app.requestSingleInstanceLock();
let sceneWindow, server, origin, closeTimeout;
let ready = false, closeAllowed = false, closePending = false, closeRequested = false;
let suspended = false, powerSequence = 0;
let recoveryPreview = null, verifiedExport = null;
const validateRecovery = async value => (await import('./sect-sim.mjs')).validateSect(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lifecycle = [];
const storage = createSectStorage({
  directory: qaDir || profileDirectory,
  validate: async state => (await import('./sect-sim.mjs')).validateSect(state)
});
const windowState = () => ({
  active: Boolean(sceneWindow && !sceneWindow.isDestroyed() && sceneWindow.isFocused()
    && !sceneWindow.isMinimized() && sceneWindow.isVisible()),
  minimized: Boolean(sceneWindow && !sceneWindow.isDestroyed() && sceneWindow.isMinimized()),
  visible: Boolean(sceneWindow && !sceneWindow.isDestroyed() && sceneWindow.isVisible())
});
const recordLifecycle = (type, detail = {}) => {
  const entry = { type, at: new Date().toISOString(), ...detail };
  lifecycle.push(entry);
  if (lifecycle.length > 256) lifecycle.shift();
  if (qaDir) fs.appendFileSync(path.join(qaDir, 'lifecycle.jsonl'), `${JSON.stringify(entry)}\n`);
};
const sendActivity = () => {
  if (!sceneWindow || sceneWindow.isDestroyed()) return;
  const state = windowState();
  sceneWindow.webContents.send('sect:activity', state);
  recordLifecycle('activity', state);
};
const sendPower = type => {
  suspended = type === 'suspend';
  const payload = { type, suspended, sequence: ++powerSequence };
  recordLifecycle('power', payload);
  if (sceneWindow && !sceneWindow.isDestroyed()) sceneWindow.webContents.send('sect:power', payload);
};
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webm': 'video/webm'
};
const inside = (filename, directory) => filename.startsWith(`${directory}${path.sep}`);
function serveFile(req, res) {
  if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, origin).pathname); }
  catch { res.writeHead(400).end(); return; }
  if (requested.includes('\0') || requested.includes('\\')) { res.writeHead(400).end(); return; }
  const official = requested.startsWith('/dist/');
  const base = official ? distRoot : root;
  const relative = official ? requested.slice('/dist/'.length) : requested === '/' ? 'courtyard.html' : requested.slice(1);
  const file = path.resolve(base, relative), extension = path.extname(file).toLowerCase();
  if (!inside(file, base) || !mimeTypes[extension] || (official && !['.mjs', '.js', '.json'].includes(extension))) {
    res.writeHead(403).end(); return;
  }
  fs.realpath(file, (error, resolved) => {
    if (error) { res.writeHead(404).end(); return; }
    if (!inside(resolved, fs.realpathSync(base))) { res.writeHead(403).end(); return; }
    fs.readFile(resolved, (readError, bytes) => {
      if (readError) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': mimeTypes[extension], 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    });
  });
}

if (!ownsProfile) app.quit();
else {
  app.on('second-instance', () => {
    if (!sceneWindow || sceneWindow.isDestroyed()) return;
    sceneWindow.restore(); sceneWindow.show(); sceneWindow.focus();
  });
  app.whenReady().then(async () => {
    if (qaDir) fs.mkdirSync(qaDir, { recursive: true });
    server = http.createServer(serveFile);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
    sceneWindow = new BrowserWindow({
      width: 1672, height: 941, useContentSize: true,
      show: args.includes('--show') || !qaDir, title, backgroundColor: '#182b31',
      webPreferences: { preload: path.join(root, 'courtyard-preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, backgroundThrottling: false }
    });
    sceneWindow.setMenuBarVisibility(false);
    sceneWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    sceneWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== `${origin}/` && url !== `${origin}/courtyard.html`) event.preventDefault();
    });
    sceneWindow.webContents.on('will-redirect', event => event.preventDefault());
    sceneWindow.webContents.on('console-message', event => console.log(event.message));
    sceneWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('COURTYARD_RENDERER_GONE', details); app.exit(1);
    });
    for (const event of ['focus', 'blur', 'minimize', 'restore', 'show', 'hide']) sceneWindow.on(event, sendActivity);
    powerMonitor.on('suspend', () => sendPower('suspend'));
    powerMonitor.on('resume', () => sendPower('resume'));
    const authorized = event => event.sender === sceneWindow?.webContents
      && event.senderFrame === sceneWindow.webContents.mainFrame
      && [`${origin}/`, `${origin}/courtyard.html`].includes(event.senderFrame.url);
    const handle = (name, fn) => ipcMain.handle(name, (event, ...parameters) => authorized(event)
      ? fn(...parameters) : { ok: false, error: 'Unknown courtyard window' });
    handle('sect:settings', () => {
      ready = true;
      return { qa: Boolean(qaDir), qaDir: qaDir || null, qaScenario: option('--qa-scenario', null),
        savePath: storage.filename, ...windowState(), suspended, powerSequence };
    });
    handle('sect:load', () => storage.load());
    handle('sect:save', state => storage.save(state));
    handle('sect:export-recovery', async state => {
      const chosen = await dialog.showSaveDialog(sceneWindow, { title: '另存山院恢复文件',
        defaultPath: path.join(app.getPath('documents'), `云岫山院-恢复-${Date.now()}.json`),
        filters: [{ name: '山院恢复文件', extensions: ['json'] }] });
      if (chosen.canceled || !chosen.filePath) return { ok: false, cancelled: true };
      const result = await exportCourtyardRecovery({ filename: chosen.filePath, state, saveFilename: storage.filename,
        validate: validateRecovery });
      if (!result.ok) return result;
      const readback = await readCourtyardRecovery({ filename: result.path, validate: validateRecovery });
      if (!readback.ok || digest(readback.data) !== digest(state)) return { ok: false, error: '恢复文件写后校验未通过，请重新导出。' };
      verifiedExport = { path: result.path, digest: digest(state) };
      return { ...result, verified: true };
    });
    handle('sect:preview-recovery', async () => {
      recoveryPreview = null;
      const chosen = await dialog.showOpenDialog(sceneWindow, { title: '选择山院恢复文件',
        properties: ['openFile'], filters: [{ name: '山院恢复文件', extensions: ['json'] }] });
      if (chosen.canceled || !chosen.filePaths[0]) return { ok: false, cancelled: true };
      const result = await readCourtyardRecovery({ filename: chosen.filePaths[0], validate: validateRecovery });
      if (!result.ok) return result;
      recoveryPreview = { token: randomUUID(), data: result.data };
      return { ok: true, token: recoveryPreview.token, data: result.data, filename: path.basename(chosen.filePaths[0]) };
    });
    handle('sect:cancel-recovery', () => { recoveryPreview = null; return true; });
    handle('sect:restore-recovery', async ({ token, previousState } = {}) => {
      if (!token || recoveryPreview?.token !== token) return { ok: false, error: '请重新选择并预检恢复文件。' };
      const preview = recoveryPreview;
      recoveryPreview = null;
      const result = await restoreCourtyardRecovery({ data: preview.data, previousState, storage, validate: validateRecovery });
      if (result.ok) verifiedExport = null;
      return result;
    });
    handle('sect:exit-recovery', async state => {
      if (!verifiedExport || digest(state) !== verifiedExport.digest) return { ok: false, error: '当前进度已有变化，请重新导出恢复文件后退出。' };
      const readback = await readCourtyardRecovery({ filename: verifiedExport.path, validate: validateRecovery });
      if (!readback.ok || digest(readback.data) !== verifiedExport.digest) return { ok: false, error: '恢复文件无法通过校验，请重新导出后退出。' };
      await storage.flush();
      recordLifecycle('close-with-verified-recovery', { path: verifiedExport.path });
      clearTimeout(closeTimeout); closeAllowed = true; sceneWindow.close();
      return { ok: true };
    });
    handle('sect:close-ready', async () => {
      if (!closeRequested) return false;
      await storage.flush(); clearTimeout(closeTimeout);
      closeAllowed = true; sceneWindow.close(); return true;
    });
    handle('sect:cancel-close', () => {
      if (!closeRequested || closeAllowed) return false;
      clearTimeout(closeTimeout);
      closePending = false; closeRequested = false;
      recordLifecycle('close-cancelled-after-save-failure');
      return true;
    });
    sceneWindow.on('close', event => {
      if (!ready || closeAllowed) return;
      event.preventDefault();
      if (closePending) return;
      closeRequested = true; closePending = true;
      recordLifecycle('close-requested');
      sceneWindow.webContents.send('sect:closing', { reason: 'close' });
      closeTimeout = setTimeout(() => {
        closePending = false;
        if (!sceneWindow.isDestroyed()) sceneWindow.webContents.send('sect:closing', { reason: 'timeout' });
      }, 10000);
    });
    handle('scene:settings', () => ({ qa: Boolean(qaDir), qaDir: qaDir || null,
      qaScenario: option('--qa-scenario', null), record: args.includes('--record'),
      duration: Number(option('--duration', '0')) }));
    handle('scene:capture', async name => {
      if (!qaDir || typeof name !== 'string' || !/^[a-z0-9_-]+\.png$/.test(name)) return false;
      const image = await sceneWindow.webContents.capturePage();
      fs.writeFileSync(path.join(qaDir, name), image.toPNG()); return true;
    });
    handle('scene:metrics', data => {
      if (!qaDir) return false;
      const result = { ...data, host: { lifecycle: [...lifecycle], ...windowState(), suspended } };
      fs.writeFileSync(path.join(qaDir, 'metrics.json'), `${JSON.stringify(result, null, 2)}\n`);
      console.log('COURTYARD_METRICS', JSON.stringify(result)); return true;
    });
    handle('scene:recording', data => {
      if (!qaDir || !data || typeof data.filename !== 'string' || !/^[a-z0-9_-]+\.webm$/.test(data.filename)) return false;
      if (!(data.bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(data.bytes)) return false;
      const bytes = data.bytes instanceof ArrayBuffer ? Buffer.from(data.bytes)
        : Buffer.from(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength);
      fs.writeFileSync(path.join(qaDir, data.filename), bytes); return true;
    });
    handle('scene:window-control', action => {
      if (!qaDir || !['minimize', 'restore', 'blur', 'focus', 'hide', 'show'].includes(action)) return false;
      sceneWindow[action]();
      if (action === 'restore' || action === 'show') sceneWindow.focus();
      recordLifecycle('qa-window', { action });
      return windowState();
    });
    handle('scene:finish', options => {
      if (!qaDir || option('--qa-scenario', null) === 'native') return false;
      setTimeout(() => options?.failed ? app.exit(1) : app.quit(), 250); return true;
    });
    sceneWindow.on('closed', () => { clearTimeout(closeTimeout); recordLifecycle('closed'); app.quit(); });
    await sceneWindow.loadURL(`${origin}/`);
    if (args.includes('--show') || !qaDir) { sceneWindow.show(); sceneWindow.focus(); app.focus({ steal: true }); }
  }).catch(error => { console.error('COURTYARD_START_FAILED', error); app.exit(1); });
}
app.on('will-quit', () => server?.close());
