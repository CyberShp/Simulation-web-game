import { FRAME_TABLE, CLEAN_PATCHES } from '../../../apps/courtyard/courtyard-layers.mjs';

const $ = id => document.getElementById(id);
const crop = [435, 200, 600, 500];
const foot = [300, 360];
const state = { ready: false, playing: false, loop: true, travel: false, height: 111, frame: 0, elapsed: 0 };
let manifest, frames, reference, background, lastTime;
const controls = ['height', 'play', 'previous', 'next', 'loop', 'frame'];
function showError(error) {
  state.ready = false;
  state.playing = false;
  document.body.dataset.status = 'error';
  $('loading').hidden = true;
  $('error').textContent = `样片读取失败：${error.message || error}\n请检查动作清单与 PNG 文件后重新读取。`;
  $('error').hidden = false;
  [...controls, 'travel'].forEach(id => { $(id).disabled = true; });
}
const loadImage = (url, name) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`无法加载 ${name}`));
  image.src = url;
});
function makeBackground(master, clean) {
  const plate = document.createElement('canvas');
  plate.width = master.width; plate.height = master.height;
  const ctx = plate.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(master, 0, 0);
  for (const patch of CLEAN_PATCHES) {
    ctx.save(); ctx.beginPath();
    patch.polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.clip(); ctx.drawImage(clean, 0, 0); ctx.restore();
  }
  return plate;
}
function marker(ctx, x, y) {
  ctx.strokeStyle = '#f1dfb67a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 6, y + .5); ctx.lineTo(x + 6, y + .5); ctx.moveTo(x + .5, y - 3); ctx.lineTo(x + .5, y + 3); ctx.stroke();
}
function shadow(ctx, x, y) {
  const scale = state.height / FRAME_TABLE.master.height;
  ctx.fillStyle = '#17282050'; ctx.beginPath();
  ctx.ellipse(x - 5 * scale, y, 23 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
}
function drawReference() {
  const ctx = $('reference').getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(background, ...crop, 0, 0, 600, 500);
  const frame = FRAME_TABLE.master.idle, scale = state.height / frame.sourceHeight;
  shadow(ctx, ...foot);
  ctx.drawImage(reference, ...frame.crop, foot[0] - frame.foot[0] * scale, foot[1] - frame.foot[1] * scale, frame.crop[2] * scale, frame.crop[3] * scale);
  marker(ctx, ...foot);
}
function drawCandidate() {
  const ctx = $('candidate').getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(background, ...crop, 0, 0, 600, 500);
  const scale = state.height / manifest.sourceHeight;
  let x = foot[0], y = foot[1];
  if (state.travel && manifest.stridePixels) {
    const phase = state.frame / frames.length;
    x += manifest.stridePixels[0] * scale * phase;
    y += manifest.stridePixels[1] * scale * phase;
  }
  shadow(ctx, x, y);
  ctx.drawImage(frames[state.frame], x - manifest.pivot[0] * scale, y - manifest.pivot[1] * scale, manifest.frameSize[0] * scale, manifest.frameSize[1] * scale);
  marker(ctx, x, y);
}
function paint() {
  if (!state.ready) return;
  drawReference(); drawCandidate();
  $('frame').value = state.frame;
  $('frame-label').textContent = `${state.frame + 1} / ${frames.length} 帧 · ${(state.frame / manifest.fps).toFixed(2)} s`;
  $('play').textContent = state.playing ? '暂停' : '播放';
  $('play').setAttribute('aria-pressed', String(state.playing));
  $('travel').textContent = state.travel ? '沿路位移' : '原地';
  $('travel').setAttribute('aria-pressed', String(state.travel));
  $('metrics').textContent = `标称人物高度 ${state.height} px · ${manifest.fps.toFixed(2)} 帧/秒 · ${frames.length} 帧 / ${(frames.length / manifest.fps).toFixed(2)} 秒 · 1 背景源像素 = 1 画布逻辑像素 · 屏幕 DPR ${window.devicePixelRatio}`;
  document.body.dataset.frame = state.frame;
  document.body.dataset.playing = state.playing;
  document.body.dataset.height = state.height;
}
function setFrame(frame) {
  state.playing = false;
  state.frame = state.loop ? (frame + frames.length) % frames.length : Math.max(0, Math.min(frames.length - 1, frame));
  state.elapsed = state.frame / manifest.fps;
  paint();
}
function tick(now) {
  if (lastTime === undefined) lastTime = now;
  const seconds = (now - lastTime) / 1000;
  lastTime = now;
  if (state.ready && state.playing) {
    state.elapsed += seconds;
    const index = Math.floor(state.elapsed * manifest.fps + 1e-7);
    if (!state.loop && index >= frames.length) {
      state.frame = frames.length - 1; state.playing = false; state.elapsed = state.frame / manifest.fps;
      paint();
    } else {
      const frame = index % frames.length;
      if (frame !== state.frame) { state.frame = frame; paint(); }
    }
  }
  requestAnimationFrame(tick);
}
$('height').addEventListener('change', () => { state.height = Number($('height').value); paint(); });
$('play').addEventListener('click', () => {
  if (!state.playing && !state.loop && state.frame === frames.length - 1) { state.elapsed = 0; state.frame = 0; }
  state.playing = !state.playing; lastTime = performance.now(); paint();
});
$('previous').addEventListener('click', () => setFrame(state.frame - 1));
$('next').addEventListener('click', () => setFrame(state.frame + 1));
$('frame').addEventListener('input', () => setFrame(Number($('frame').value)));
$('loop').addEventListener('change', () => { state.loop = $('loop').checked; state.elapsed = state.frame / manifest.fps; });
$('travel').addEventListener('click', () => { state.travel = !state.travel; state.elapsed = 0; state.frame = 0; paint(); });
$('reload').addEventListener('click', () => location.reload());
window.addEventListener('error', event => showError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showError(event.reason));
window.motionPreviewSnapshot = () => ({ ...state, frameCount: frames?.length || 0, fps: manifest?.fps, sourceHeight: manifest?.sourceHeight, stridePixels: manifest?.stridePixels, crop: [...crop], foot: [...foot], canvasCSSSize: [$('candidate').getBoundingClientRect().width, $('candidate').getBoundingClientRect().height] });

try {
  const data = await window.motionPreview.load();
  if (data.error) throw new Error(data.error);
  manifest = data.manifest;
  const loaded = await Promise.all([
    loadImage(data.assets['courtyard-master-v2.png'], '山院母稿'),
    loadImage(data.assets['courtyard-clean-v2.png'], '山院补地'),
    loadImage(data.assets['cultivator-v1.png'], '原参考人物'),
    ...manifest.frameURLs.map((url, i) => loadImage(url, `动作第 ${i + 1} 帧`)),
  ]);
  const [master, clean, original, ...animation] = loaded;
  for (const [index, image] of animation.entries()) {
    if (image.width !== manifest.frameSize[0] || image.height !== manifest.frameSize[1]) throw new Error(`第 ${index + 1} 帧尺寸与 frameSize 不一致。`);
  }
  background = makeBackground(master, clean); reference = original; frames = animation;
  $('frame').max = frames.length - 1;
  controls.forEach(id => { $(id).disabled = false; });
  const hasStride = manifest.stridePixels && Math.hypot(...manifest.stridePixels) > 0;
  $('travel').disabled = !hasStride;
  $('travel-note').textContent = hasStride ? '位移按清单中的周期投影参数显示；循环边界回到起点。十字标记为脚点。' : '当前为原地动作；收到周期屏幕位移参数后可检查沿路位移。十字标记为脚点。';
  $('source').textContent = `动作清单：${manifest.manifestPath}`;
  if (manifest.label) $('candidate-label').textContent = String(manifest.label);
  state.ready = true; state.playing = true;
  $('loading').hidden = true; document.body.dataset.status = 'ready';
  paint(); requestAnimationFrame(tick);
} catch (error) { showError(error); }
