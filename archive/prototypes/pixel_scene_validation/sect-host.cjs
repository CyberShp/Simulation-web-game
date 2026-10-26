const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createSectStorage } = require('../../../apps/courtyard/sect-storage.cjs');

const root = __dirname;
const distRoot = path.resolve(root, '../../dist');
const args = process.argv.slice(1);
const option = (key, fallback) => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
const qaDir = option('--qa-dir', '');
const title = '云岫山院·宗门经营';
if (qaDir && !path.isAbsolute(qaDir)) throw new Error('--qa-dir must be an absolute path');
app.setName(title);
app.setAppUserModelId('games.xianfu.pixel-sect');
const profileDirectory = qaDir ? path.join(qaDir, 'electron-profile') : path.join(app.getPath('appData'), 'pixel-sect');
fs.mkdirSync(profileDirectory, { recursive: true });
app.setPath('userData', profileDirectory);
// A profile has one writer; a second launch brings its existing world forward.
const ownsProfile = app.requestSingleInstanceLock();
let sceneWindow, server, origin, closeTimeout;
let ready = false, closeAllowed = false, closePending = false, closeRequested = false;
let suspended = false, powerSequence = 0;
const lifecycle = [];
const storage = createSectStorage({
  directory: qaDir || profileDirectory,
  validate: async state => (await import('../../../apps/courtyard/sect-sim.mjs')).validateSect(state)
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
  const relative = official ? requested.slice('/dist/'.length) : requested === '/' ? 'sect.html' : requested.slice(1);
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
      width: 1600, height: 900, useContentSize: true,
      show: args.includes('--show') || !qaDir, title, backgroundColor: '#182b31',
      webPreferences: { preload: path.join(root, 'sect-preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, backgroundThrottling: false }
    });
    sceneWindow.setMenuBarVisibility(false);
    sceneWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    sceneWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== `${origin}/` && url !== `${origin}/sect.html`) event.preventDefault();
    });
    sceneWindow.webContents.on('will-redirect', event => event.preventDefault());
    sceneWindow.webContents.on('console-message', event => console.log(event.message));
    sceneWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('SECT_RENDERER_GONE', details); app.exit(1);
    });
    for (const event of ['focus', 'blur', 'minimize', 'restore', 'show', 'hide']) sceneWindow.on(event, sendActivity);
    powerMonitor.on('suspend', () => sendPower('suspend'));
    powerMonitor.on('resume', () => sendPower('resume'));
    const authorized = event => event.sender === sceneWindow?.webContents
      && event.senderFrame === sceneWindow.webContents.mainFrame
      && [`${origin}/`, `${origin}/sect.html`].includes(event.senderFrame.url);
    const handle = (name, fn) => ipcMain.handle(name, (event, ...parameters) => authorized(event)
      ? fn(...parameters) : { ok: false, error: 'Unknown sect window' });
    handle('sect:settings', () => {
      ready = true;
      return { qa: Boolean(qaDir), qaDir: qaDir || null, qaScenario: option('--qa-scenario', null),
        savePath: storage.filename, ...windowState(), suspended, powerSequence };
    });
    handle('sect:load', () => storage.load());
    handle('sect:save', state => storage.save(state));
    handle('sect:close-ready', async () => {
      if (!closeRequested) return false;
      await storage.flush(); clearTimeout(closeTimeout);
      closeAllowed = true; sceneWindow.close(); return true;
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
      console.log('SECT_METRICS', JSON.stringify(result)); return true;
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
      if (!qaDir) return false;
      setTimeout(() => options?.failed ? app.exit(1) : app.quit(), 250); return true;
    });
    sceneWindow.on('closed', () => { clearTimeout(closeTimeout); recordLifecycle('closed'); app.quit(); });
    await sceneWindow.loadURL(`${origin}/`);
    if (args.includes('--show') || !qaDir) { sceneWindow.show(); sceneWindow.focus(); app.focus({ steal: true }); }
  }).catch(error => { console.error('SECT_START_FAILED', error); app.exit(1); });
}
app.on('will-quit', () => server?.close());
