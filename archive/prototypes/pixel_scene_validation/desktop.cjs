const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createArenaStorage } = require('./arena-storage.cjs');

const root = __dirname;
const args = process.argv.slice(1);
const option = (key, fallback) => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
const qaDir = option('--qa-dir', '');
const sceneMode = args.includes('--scene');
const title = sceneMode ? '云岫山院·像素场景' : '云岫山院·近山试行';
let sceneWindow;
let server;
let closeAllowed = false;
let closePending = false;
let closeRequested = false;
let closeTimeout;
let arenaReady = false;

if (qaDir && !path.isAbsolute(qaDir)) throw new Error('--qa-dir must be an absolute path');
app.setName(title);
app.setAppUserModelId(sceneMode ? 'games.xianfu.pixel-scene' : 'games.xianfu.pixel-arena');
const profileDirectory = qaDir ? path.join(qaDir, 'electron-profile') : path.join(app.getPath('appData'), 'pixel-arena');
fs.mkdirSync(profileDirectory, { recursive: true });
app.setPath('userData', profileDirectory);
const storage = createArenaStorage({
  directory: qaDir || profileDirectory,
  validate: async state => (await import('./arena-sim.mjs')).validateBattle(state)
});
const windowActive = () => Boolean(sceneWindow && !sceneWindow.isDestroyed()
  && sceneWindow.isFocused() && !sceneWindow.isMinimized() && sceneWindow.isVisible());
const sendActivity = () => {
  if (sceneWindow && !sceneWindow.isDestroyed()) {
    sceneWindow.webContents.send('arena:activity', { active: windowActive() });
  }
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm'
};

function serveFile(req, res) {
  let requested;
  try {
    requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const sharedRuntime = requested === '/shared/ea-runtime.mjs';
  const file = sharedRuntime
    ? (fs.existsSync(path.join(root, 'shared/ea-runtime.mjs')) ? path.join(root, 'shared/ea-runtime.mjs') : path.resolve(root, '../../../src/simulation/ea-runtime.mjs'))
    : path.resolve(root, `.${requested === '/' ? (sceneMode ? '/index.html' : '/arena.html') : requested}`);
  if (!sharedRuntime && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

app.whenReady().then(async () => {
  if (qaDir) fs.mkdirSync(qaDir, { recursive: true });
  server = http.createServer(serveFile);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  sceneWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    useContentSize: true,
    show: args.includes('--show') || !qaDir,
    title,
    backgroundColor: '#182b31',
    webPreferences: {
      preload: path.join(root, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  sceneWindow.setMenuBarVisibility(false);
  sceneWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  sceneWindow.webContents.on('console-message', event => console.log(event.message));
  sceneWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('SCENE_RENDERER_GONE', details);
    app.exit(1);
  });

  for (const event of ['focus', 'blur', 'minimize', 'restore', 'show', 'hide']) {
    sceneWindow.on(event, sendActivity);
  }
  const authorized = event => event.sender === sceneWindow?.webContents;
  ipcMain.handle('arena:settings', () => {arenaReady = true; return ({
    active: windowActive(),
    qa: Boolean(qaDir),
    autoplay: args.includes('--autoplay'),
    trail: args.includes('--trail')||args.includes('--trail32'),
    trail32: args.includes('--trail32'),
    qaScenario: option('--qa-scenario', null)
  });});
  ipcMain.handle('arena:load', event => authorized(event)
    ? storage.load() : { ok: false, error: 'Unknown arena window' });
  ipcMain.handle('arena:save', (event, state) => authorized(event)
    ? storage.save(state) : { ok: false, error: 'Unknown arena window' });
  ipcMain.handle('arena:close-ready', async event => {
    if (!authorized(event) || !closeRequested) return false;
    await storage.flush();
    clearTimeout(closeTimeout);
    closeAllowed = true;
    sceneWindow.close();
    return true;
  });
  sceneWindow.on('close', event => {
    const viewingScene = sceneWindow.webContents.getURL().endsWith('/index.html');
    if (sceneMode || viewingScene || !arenaReady || closeAllowed) return;
    event.preventDefault();
    if (closePending) return;
    closeRequested = true;
    closePending = true;
    sceneWindow.webContents.send('arena:closing', { reason: 'close' });
    closeTimeout = setTimeout(() => {
      closePending = false;
      if (!sceneWindow.isDestroyed()) sceneWindow.webContents.send('arena:closing', { reason: 'timeout' });
    }, 10000);
  });

  ipcMain.handle('scene:settings', () => ({
    qa: Boolean(qaDir),
    record: args.includes('--record'),
    duration: Number(option('--duration', '0')),
    start: Number(option('--start', '0'))
  }));
  ipcMain.handle('scene:capture', async (_event, name) => {
    if (!qaDir || typeof name !== 'string' || !/^[a-z0-9_-]+\.png$/.test(name)) return false;
    const image = await sceneWindow.webContents.capturePage();
    fs.writeFileSync(path.join(qaDir, name), image.toPNG());
    return true;
  });
  ipcMain.handle('scene:metrics', (_event, data) => {
    const serialized = JSON.stringify(data, null, 2);
    console.log('SCENE_METRICS', JSON.stringify(data));
    if (qaDir) fs.writeFileSync(path.join(qaDir, 'metrics.json'), `${serialized}\n`);
    return true;
  });
  ipcMain.handle('scene:recording', (_event, data) => {
    if (!qaDir || !data || typeof data.filename !== 'string' || !/^[a-z0-9_-]+\.webm$/.test(data.filename)) return false;
    if (!(data.bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(data.bytes)) return false;
    const bytes = data.bytes instanceof ArrayBuffer
      ? Buffer.from(data.bytes)
      : Buffer.from(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength);
    fs.writeFileSync(path.join(qaDir, data.filename), bytes);
    return true;
  });
  ipcMain.handle('scene:finish', (_event, options) => {
    setTimeout(() => options?.failed ? app.exit(1) : app.quit(), 250);
    return true;
  });

  sceneWindow.on('closed', () => {
    clearTimeout(closeTimeout);
    app.quit();
  });
  await sceneWindow.loadURL(`http://127.0.0.1:${server.address().port}/`);
  if (args.includes('--show') || !qaDir) {
    sceneWindow.show();
    sceneWindow.focus();
    app.focus({ steal: true });
  }
}).catch(error => {
  console.error('SCENE_START_FAILED', error);
  app.exit(1);
});

app.on('will-quit', () => server?.close());
