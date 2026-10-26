const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const args = process.argv.slice(1);
const option = (key, fallback) => args.find(a => a.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
const qaDir = option('--qa-dir', '');
let window, server;
const configPath=path.join(root,'showcase-config.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
const assets=config.scene==='assets' || args.includes('--assets') || option('--scene','')==='assets';
const reference=config.scene==='reference' || args.includes('--reference') || option('--scene','')==='reference';
const compare=option('--style','both')==='both';
let currentStyle=compare?'d':option('--style','d');
app.setName(assets?'云岫 · 资产图鉴':'云岫山院 · Three.js 样板');
app.whenReady().then(async () => {
  if (qaDir) fs.mkdirSync(qaDir, { recursive: true });
  server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  window = new BrowserWindow({ width: 1600, height: 900, useContentSize: true, show: args.includes('--show') || !qaDir, backgroundColor: '#10202b', title: '云岫山院 · Three.js 样板', webPreferences: { preload: path.join(root, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  window.setMenuBarVisibility(false);
  window.webContents.on('console-message', event => console.log(event.message));
  window.webContents.on('render-process-gone', (_event, details) => { console.error('RENDERER_GONE', details); app.exit(1); });
  ipcMain.handle('showcase:settings', () => ({ qa: Boolean(qaDir), record: args.includes('--record'), style: currentStyle, assets, asset:option('--asset',config.asset||'hall'), focus:args.includes('--focus')||Boolean(config.focus), view:option('--view','hero'), reviewAll:args.includes('--review-all'), reference, camera:option('--camera','reference'), autoCompare:compare, duration: Number(option('--duration', '0')), start: Number(option('--start', '0')) }));
  ipcMain.handle('showcase:capture', async (_event, name) => {
    if (!qaDir || !/^[a-z0-9_-]+\.png$/.test(name)) return false;
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(qaDir, name), image.toPNG());
    return true;
  });
  ipcMain.handle('showcase:recording', (_event, { style, buffer }) => {
    if (!qaDir || !['d', 'pixel', 'reference', 'assets'].includes(style)) return false;
    fs.writeFileSync(path.join(qaDir, `${style}-autoplay.webm`), Buffer.from(buffer));
    return true;
  });
  ipcMain.handle('showcase:metrics', (_event, data) => {
    console.log('SHOWCASE_METRICS', JSON.stringify(data));
    if (qaDir && ['d', 'pixel', 'reference', 'assets'].includes(data.style)) fs.writeFileSync(path.join(qaDir, `${data.style}-metrics.json`), JSON.stringify(data, null, 2));
    return true;
  });
  ipcMain.handle('showcase:next', () => { currentStyle=currentStyle==='d'?'pixel':'d'; window.reload(); });
  ipcMain.handle('showcase:finish', (_event, options) => { setTimeout(() => options?.failed?app.exit(1):app.quit(), 250); return true; });
  window.on('closed', () => app.quit());
  await window.loadURL(`http://127.0.0.1:${server.address().port}/${assets?'asset-review.html':reference?'reference.html':''}`);
});
app.on('will-quit', () => server?.close());
