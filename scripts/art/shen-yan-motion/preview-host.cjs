const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../..');
const args = process.argv.slice(1);
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
const qaDirectory = option('--qa-dir') || '/Volumes/Media/immortal-qa/shen-yan-motion-study-20261017/preview';
if (!path.isAbsolute(qaDirectory)) throw new Error('--qa-dir must be absolute');
fs.mkdirSync(path.join(qaDirectory, 'profiles'), { recursive: true });
app.setName('沈砚·离线动作样片');
app.setPath('userData', fs.mkdtempSync(path.join(qaDirectory, 'profiles', 'session-')));

function readManifest() {
  const filename = option('--manifest');
  if (!filename || !path.isAbsolute(filename)) throw new Error('请用 --manifest 指定动作清单的绝对路径。');
  if (fs.statSync(filename).size > 2 * 1024 * 1024) throw new Error('动作清单超过 2 MiB。');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const pair = value => Array.isArray(value) && value.length === 2 && value.every(finite);
  if (!Array.isArray(manifest.frames) || !manifest.frames.length || manifest.frames.length > 512) throw new Error('frames 需要包含 1–512 张 PNG。');
  if (!finite(manifest.fps) || manifest.fps <= 0 || manifest.fps > 120) throw new Error('fps 必须大于 0 且不超过 120。');
  if (!pair(manifest.frameSize) || !manifest.frameSize.every(n => Number.isInteger(n) && n > 0 && n <= 4096)) throw new Error('frameSize 需要两个 1–4096 的整数。');
  if (!pair(manifest.pivot) || !manifest.pivot.every((n, i) => n >= 0 && n <= manifest.frameSize[i])) throw new Error('pivot 必须位于帧尺寸内。');
  if (!finite(manifest.sourceHeight) || manifest.sourceHeight <= 0 || manifest.sourceHeight > manifest.frameSize[1]) throw new Error('sourceHeight 必须是帧内有效人物高度。');
  if (manifest.duration !== undefined && (!finite(manifest.duration) || manifest.duration <= 0)) throw new Error('duration 必须大于 0。');
  const directory = fs.realpathSync(path.dirname(filename));
  const frameURLs = manifest.frames.map((frame, index) => {
    if (typeof frame !== 'string' || path.isAbsolute(frame) || path.extname(frame).toLowerCase() !== '.png') throw new Error(`第 ${index + 1} 帧必须是清单目录内的相对 PNG 路径。`);
    const resolved = fs.realpathSync(path.resolve(directory, frame));
    if (!resolved.startsWith(directory + path.sep)) throw new Error(`第 ${index + 1} 帧超出清单目录。`);
    return pathToFileURL(resolved).href;
  });
  let stridePixels = null;
  if (manifest.stridePixels !== undefined) {
    if (!pair(manifest.stridePixels)) throw new Error('stridePixels 需要 [dx, dy]。');
    stridePixels = manifest.stridePixels;
  } else if (manifest.forwardScreenPerWorld !== undefined && manifest.strideWorld !== undefined) {
    if (!pair(manifest.forwardScreenPerWorld) || !finite(manifest.strideWorld) || manifest.strideWorld <= 0) throw new Error('位移需要有效的 forwardScreenPerWorld 与正 strideWorld。');
    stridePixels = manifest.forwardScreenPerWorld.map(n => n * manifest.strideWorld);
  }
  return { ...manifest, frameURLs, stridePixels, manifestPath: filename };
}

function bootData() {
  try {
    return {
      manifest: readManifest(),
      assets: Object.fromEntries(['courtyard-master-v2.png', 'courtyard-clean-v2.png', 'cultivator-v1.png'].map(name => [name, pathToFileURL(path.join(root, 'assets/courtyard', name)).href])),
    };
  } catch (error) { return { error: error.message }; }
}

app.whenReady().then(() => {
  ipcMain.handle('motion-preview:boot', bootData);
  const win = new BrowserWindow({
    width: 1280, height: 810, minWidth: 680, minHeight: 480,
    title: '沈砚·离线动作样片', backgroundColor: '#152320',
    webPreferences: { preload: path.join(__dirname, 'preview-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const previewURL = pathToFileURL(path.join(__dirname, 'preview.html')).href;
  win.webContents.on('will-navigate', (event, url) => { if (url !== previewURL) event.preventDefault(); });
  win.webContents.setZoomFactor(1);
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '-', '=', '0'].includes(input.key)) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, 'preview.html'));
});
app.on('window-all-closed', () => app.quit());
