const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../..');
const args = process.argv.slice(1);
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
const qaDirectory = option('--qa-dir') || path.join(os.tmpdir(), 'immortal-shen-yan-guard-preview');
if (!path.isAbsolute(qaDirectory)) throw new Error('--qa-dir 必须是绝对路径。');
fs.mkdirSync(path.join(qaDirectory, 'profiles'), { recursive: true });
app.setName('沈砚·掐诀护身');
app.setPath('userData', fs.mkdtempSync(path.join(qaDirectory, 'profiles', 'session-')));
const previewURL = pathToFileURL(path.join(__dirname, 'preview.html')).href;
const errors = [];

function readManifest() {
  const filename = option('--manifest') || path.join(root, 'assets/characters/shen-yan/guard-study-v1/sprites/manifest.json');
  if (!path.isAbsolute(filename)) throw new Error('--manifest 必须是绝对路径。');
  if (!fs.existsSync(filename)) throw new Error(`找不到动作清单：${filename}`);
  if (fs.statSync(filename).size > 2 * 1024 * 1024) throw new Error('动作清单超过 2 MiB。');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const pair = value => Array.isArray(value) && value.length === 2 && value.every(finite);
  if (!Array.isArray(manifest.frames) || !manifest.frames.length || manifest.frames.length > 512) throw new Error('frames 需要包含 1–512 帧。');
  if (manifest.frameCount !== manifest.frames.length) throw new Error('frameCount 与 frames 数量不一致。');
  if (!finite(manifest.fps) || manifest.fps <= 0 || manifest.fps > 120) throw new Error('fps 必须大于 0 且不超过 120。');
  if (!pair(manifest.frameSize) || !manifest.frameSize.every(n => Number.isInteger(n) && n > 0 && n <= 4096)) throw new Error('frameSize 需要两个 1–4096 的整数。');
  if (!pair(manifest.anchor) || !manifest.anchor.every((n, i) => n >= 0 && n <= manifest.frameSize[i])) throw new Error('anchor 必须是帧内脚点。');
  if (!finite(manifest.sourceHeight) || manifest.sourceHeight <= 0 || manifest.sourceHeight > manifest.frameSize[1]) throw new Error('sourceHeight 必须是帧内有效人物高度。');
  if (!finite(manifest.nominalHeight) || manifest.nominalHeight <= 0) throw new Error('nominalHeight 需要有效的样片人物高度。');
  const requiredLayers = ['effectBehind', 'equipment', 'body', 'effectFront'];
  const layerOrder = manifest.layerOrder;
  if (!Array.isArray(layerOrder) || layerOrder.length !== requiredLayers.length || !requiredLayers.every((layer, i) => layerOrder[i] === layer)) throw new Error('layerOrder 需要依次为 effectBehind、equipment、body、effectFront。');
  if (manifest.holdRange !== undefined && (!pair(manifest.holdRange) || !manifest.holdRange.every(n => Number.isInteger(n) && n >= 0 && n < manifest.frames.length) || manifest.holdRange[0] > manifest.holdRange[1])) throw new Error('holdRange 需要有效的首尾帧号。');
  const directory = fs.realpathSync(path.dirname(filename));
  const frames = manifest.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object') throw new Error(`第 ${index + 1} 帧格式无效。`);
    const durationMs = frame.durationMs ?? 1000 / manifest.fps;
    if (!finite(durationMs) || durationMs <= 0 || durationMs > 30000) throw new Error(`第 ${index + 1} 帧 durationMs 无效。`);
    if (typeof frame.phase !== 'string' || !frame.phase.trim() || frame.phase.length > 80) throw new Error(`第 ${index + 1} 帧需要 phase。`);
    if (frame.event !== undefined && !['guard-start', 'pressure', 'guard-end'].includes(frame.event)) throw new Error(`第 ${index + 1} 帧 event 无效。`);
    const urls = Object.fromEntries(layerOrder.map(layer => {
      const value = frame[layer];
      if (typeof value !== 'string' || path.isAbsolute(value) || path.extname(value).toLowerCase() !== '.png') throw new Error(`第 ${index + 1} 帧 ${layer} 需要清单目录内的 PNG。`);
      const candidate = path.resolve(directory, value);
      if (!candidate.startsWith(directory + path.sep)) throw new Error(`第 ${index + 1} 帧 ${layer} 超出清单目录。`);
      if (!fs.existsSync(candidate)) throw new Error(`找不到第 ${index + 1} 帧 ${layer}：${value}`);
      const resolved = fs.realpathSync(candidate);
      if (!resolved.startsWith(directory + path.sep)) throw new Error(`第 ${index + 1} 帧 ${layer} 超出清单目录。`);
      return [layer, pathToFileURL(resolved).href];
    }));
    return { ...frame, durationMs, urls };
  });
  return { ...manifest, frames, layerOrder, manifestPath: filename };
}

function bootData() {
  try {
    return { manifest: readManifest(),
      backgroundURL: pathToFileURL(path.join(root, 'assets/courtyard/courtyard-master-v2.png')).href,
      cleanURL: pathToFileURL(path.join(root, 'assets/courtyard/courtyard-clean-v2.png')).href };
  } catch (error) { return { error: error.message }; }
}

async function runSmoke(win) {
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = await win.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const checks = [], screenshots = [];
      const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); if (!pass) throw new Error(name); };
      const click = id => document.getElementById(id).click();
      const select = (id, value) => { const el = document.getElementById(id); el.value = String(value); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const capture = async name => { await wait(80); const filename = await window.guardPreview.capture(name); check('截图 ' + name, Boolean(filename), filename); screenshots.push(filename); };
      let state;
      try {
        for (let i = 0; i < 200 && !window.__guardPreview?.snapshot().ready && !window.__guardPreview?.snapshot().error; i++) await wait(50);
        const api = window.__guardPreview;
        state = api?.snapshot();
        if (${args.includes('--expect-load-error')}) {
          check('缺失素材显示明确错误', !state?.ready && Boolean(state?.error) && !document.getElementById('error').hidden, state);
          check('加载失败后播放控件停用', ['play','restart','previous','next','loop','speed','zoom','viewpoint','effects','frame'].every(id => document.getElementById(id).disabled), state);
          check('加载失败保留重新读取', !document.getElementById('reload').disabled, state);
          await capture('missing-assets.png');
          return { passed: true, expectedLoadError: true, checks, screenshots, state };
        }
        check('加载掐诀护身和山院', state?.ready && state.frameCount === 12 && state.durationMs === 1760 && state.nominalHeight === 80 && state.holdRange?.[0] === 5 && state.holdRange?.[1] === 8, state);
        check('画布原尺寸显示', state.canvasCSSSize[0] === 1180 && state.canvasCSSSize[1] === 570, state);
        if (state.playing) click('play');
        const paused = api.snapshot(); await wait(160);
        check('暂停保持帧与时间', !api.snapshot().playing && api.snapshot().frame === paused.frame && api.snapshot().elapsedMs === paused.elapsedMs, api.snapshot());
        api.setFrame(0); click('next');
        check('下一帧', api.snapshot().frame === 1 && !api.snapshot().playing, api.snapshot());
        click('previous'); check('上一帧', api.snapshot().frame === 0, api.snapshot());
        click('restart'); check('重播从第一帧开始', api.snapshot().frame === 0 && api.snapshot().playing, api.snapshot());
        click('play');
        const pressure = api.snapshot().pressureFrames[0];
        check('完整护盾承压帧', pressure === 7, api.snapshot());
        api.setFrame(pressure);
        for (const viewpoint of ['courtyard', 'hall']) {
          select('viewpoint', viewpoint);
          let previousImage;
          for (const zoom of [1, 1.35, 2]) {
            select('zoom', zoom); state = api.snapshot();
            const [a,b,c,d,e,f] = state.sceneTransform;
            const pixelImage = document.getElementById('stage').toDataURL();
            check('场景共同缩放 ' + viewpoint + ' ' + zoom, state.zoom === zoom && a === zoom && d === zoom && state.displayedHeight === 80 * zoom && Math.abs(state.sourceFoot[0] * a + e - state.foot[0]) < 1e-6 && Math.abs(state.sourceFoot[1] * d + f - state.foot[1]) < 1e-6 && (!previousImage || previousImage !== pixelImage), state);
            previousImage = pixelImage;
            await capture(viewpoint + '-' + Math.round(zoom * 100) + '.png');
          }
        }
        api.setFrame(5);
        check('护盾合顶帧', api.snapshot().event === 'guard-start', api.snapshot());
        await capture('hall-200-formed.png');
        api.setFrame(pressure);
        const withEffect = document.getElementById('stage').toDataURL(); click('effects');
        check('关闭前后护盾层', !api.snapshot().effects && document.getElementById('stage').toDataURL() !== withEffect, api.snapshot());
        await capture('hall-200-body.png'); click('effects');
        check('恢复前后护盾层', api.snapshot().effects && document.getElementById('stage').toDataURL() === withEffect, api.snapshot());
        select('speed', 0.5); check('半速选项', api.snapshot().speed === 0.5, api.snapshot());
        select('loop', 'once'); click('restart'); await wait(150);
        const slowElapsed = api.snapshot().elapsedMs;
        check('半速实际推进', slowElapsed > 25 && slowElapsed < 130, { elapsedMs: slowElapsed });
        click('play'); select('speed', 1); check('原速选项', api.snapshot().speed === 1, api.snapshot());
        click('restart'); await wait(api.snapshot().durationMs + 160); state = api.snapshot();
        check('单次停在末帧', !state.playing && state.frame === state.frameCount - 1 && state.elapsedMs === state.durationMs, state);
        select('loop', 'loop'); click('restart'); await wait(api.snapshot().durationMs + 80); state = api.snapshot();
        check('循环继续播放', state.playing && state.completedLoops >= 1, state);
        click('play'); api.setFrame(pressure); select('zoom', 1); select('viewpoint', 'courtyard');
        await capture('preview-ready.png'); click('restart'); state = api.snapshot();
        return { passed: true, checks, screenshots, state };
      } catch (error) {
        try { await capture('smoke-failure.png'); } catch {}
        return { passed: false, checks, screenshots, error: error.message, state: window.__guardPreview?.snapshot() };
      }
    })()`);
  } catch (error) { result = { passed: false, error: error.message, checks: [] }; }
  const report = { startedAt, finishedAt: new Date().toISOString(), ...result, errors,
    host: { platform: process.platform, electron: process.versions.electron, contentBounds: win.getContentBounds(), userData: app.getPath('userData'), qaDirectory, protocol: 'file:' } };
  report.passed = report.passed && errors.length === 0;
  const reportPath = path.join(qaDirectory, 'smoke-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('GUARD_PREVIEW_SMOKE', JSON.stringify({ passed: report.passed, checks: report.checks.length, report: reportPath }));
  if (args.includes('--quit-after-smoke')) app.exit(report.passed ? 0 : 1);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 880, minWidth: 760, minHeight: 560,
    title: '沈砚·掐诀护身', backgroundColor: '#152320',
    webPreferences: { preload: path.join(__dirname, 'preview-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  const authorized = event => event.sender === win.webContents && event.senderFrame?.url === previewURL;
  ipcMain.handle('guard-preview:boot', event => authorized(event) ? bootData() : { error: '预览来源无效。' });
  ipcMain.handle('guard-preview:capture', async (event, name) => {
    if (!authorized(event) || typeof name !== 'string' || !/^[a-z0-9_-]+\.png$/.test(name)) return false;
    const image = await win.webContents.capturePage(); const filename = path.join(qaDirectory, name);
    fs.writeFileSync(filename, image.toPNG()); return filename;
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== previewURL) event.preventDefault(); });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  win.webContents.on('render-process-gone', (_event, details) => errors.push(`renderer: ${details.reason}`));
  win.webContents.setZoomFactor(1); win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '-', '=', '0'].includes(input.key)) event.preventDefault();
  });
  await win.loadFile(path.join(__dirname, 'preview.html')); win.show(); win.focus();
  if (args.includes('--smoke')) await runSmoke(win);
}).catch(error => { console.error('GUARD_PREVIEW_FAILED', error); app.exit(1); });
app.on('window-all-closed', () => app.quit());
