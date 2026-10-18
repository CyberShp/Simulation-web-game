import { FRAME_TABLE, SOURCE_SIZE, CLEAN_PATCHES, OCCLUDERS } from '../../../apps/courtyard/courtyard-layers.mjs';
import { REVIEW_POINTS } from '../../../apps/courtyard/courtyard-space.mjs';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const foot = [480, 400];
const viewpoints = {
  courtyard: { label: '院中石地', sourceFoot: [710, 575] },
  hall: { label: '主殿台阶前', sourceFoot: [680, 465] },
};
const productionReference = {
  nominalHeight: FRAME_TABLE.master.height,
  hallEntrance: [REVIEW_POINTS.hallEntrance.art.x, REVIEW_POINTS.hallEntrance.art.y],
};
const state = { ready: false, playing: false, loop: true, speed: 1, zoom: 1, viewpoint: 'courtyard', effects: true, frame: 0, elapsedMs: 0, completedLoops: 0, error: null };
const controlIds = ['play', 'restart', 'previous', 'next', 'loop', 'speed', 'zoom', 'viewpoint', 'effects', 'frame'];
let manifest, nominalHeight = null, frames = [], background, starts = [], durationMs = 0, lastTime;

function showError(error) {
  state.error = error?.message || String(error);
  state.ready = false; state.playing = false;
  document.body.dataset.status = 'error';
  $('loading').hidden = true;
  $('error').textContent = `样片读取失败：${state.error}\n请检查动作清单与 PNG 文件，再点击“重新读取”。`;
  $('error').hidden = false;
  controlIds.forEach(id => { $(id).disabled = true; });
}

function loadImage(url, name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载 ${name}`));
    image.src = url;
  });
}

function trace(context, polygon) {
  context.beginPath();
  polygon.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
}

// The production renderer restores the approved painting with these same patches.
function makeBackground(original, clean) {
  const plate = document.createElement('canvas');
  plate.width = SOURCE_SIZE.width; plate.height = SOURCE_SIZE.height;
  const context = plate.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(original, 0, 0);
  for (const patch of CLEAN_PATCHES) {
    context.save(); trace(context, patch.polygon); context.clip();
    context.drawImage(clean, 0, 0, plate.width, plate.height); context.restore();
  }
  return plate;
}

function sceneGeometry() {
  const sourceFoot = viewpoints[state.viewpoint].sourceFoot;
  return { sourceFoot: [...sourceFoot], crop: [sourceFoot[0] - foot[0] / state.zoom, sourceFoot[1] - foot[1] / state.zoom, canvas.width / state.zoom, canvas.height / state.zoom],
    sceneTransform: [state.zoom, 0, 0, state.zoom, foot[0] - sourceFoot[0] * state.zoom, foot[1] - sourceFoot[1] * state.zoom] };
}

function paint() {
  if (!state.ready) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { sourceFoot, sceneTransform } = sceneGeometry();
  // One camera transform applies to the painting, shadow, all animation layers and occluders.
  ctx.save(); ctx.setTransform(...sceneTransform);
  ctx.drawImage(background, 0, 0);
  const scale = nominalHeight / manifest.sourceHeight;
  const x = sourceFoot[0] - manifest.anchor[0] * scale;
  const y = sourceFoot[1] - manifest.anchor[1] * scale;
  ctx.fillStyle = '#17282050'; ctx.beginPath();
  const shadowScale = nominalHeight / productionReference.nominalHeight;
  ctx.ellipse(sourceFoot[0] - 5 * shadowScale, sourceFoot[1], 23 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();
  for (const layer of manifest.layerOrder) {
    if (layer.startsWith('effect') && !state.effects) continue;
    ctx.drawImage(frames[state.frame][layer], x, y, manifest.frameSize[0] * scale, manifest.frameSize[1] * scale);
  }
  for (const occluder of OCCLUDERS) {
    if (sourceFoot[1] >= occluder.feetY) continue;
    ctx.save(); trace(ctx, occluder.polygon); ctx.clip(); ctx.drawImage(background, 0, 0); ctx.restore();
  }
  ctx.restore();
  const frame = manifest.frames[state.frame];
  $('frame').value = state.frame;
  $('frame-label').textContent = `${String(state.frame + 1).padStart(2, '0')} / ${frames.length} 帧 · ${(starts[state.frame] / 1000).toFixed(2)} / ${(durationMs / 1000).toFixed(2)} 秒`;
  $('play').textContent = state.playing ? '暂停' : '播放';
  $('play').setAttribute('aria-pressed', String(state.playing));
  $('loop').value = state.loop ? 'loop' : 'once'; $('speed').value = state.speed;
  $('zoom').value = state.zoom; $('viewpoint').value = state.viewpoint; $('effects').checked = state.effects;
  $('phase').textContent = `${frame.phase}　｜　${viewpoints[state.viewpoint].label}`;
  $('metrics').textContent = `场景 ${Math.round(state.zoom * 100)}% · ${state.speed}× · ${state.effects ? '护盾效果开启' : '护盾效果关闭'} · ${frames.length} 帧 / ${(durationMs / 1000).toFixed(2)} 秒`;
  document.body.dataset.frame = state.frame; document.body.dataset.phase = frame.phase;
  document.body.dataset.playing = state.playing; document.body.dataset.zoom = state.zoom; document.body.dataset.viewpoint = state.viewpoint;
}

function snapshot() {
  const rect = canvas.getBoundingClientRect();
  return { ...state, phase: manifest?.frames[state.frame]?.phase ?? null, event: manifest?.frames[state.frame]?.event ?? null,
    frameCount: frames.length, fps: manifest?.fps ?? null, durationMs, frameDurationMs: manifest?.frames[state.frame]?.durationMs ?? null,
    sourceHeight: manifest?.sourceHeight ?? null, frameSize: manifest?.frameSize ?? null, anchor: manifest?.anchor ?? null,
    layerOrder: manifest?.layerOrder ?? null, holdRange: manifest?.holdRange ?? null,
    pressureFrames: manifest?.frames.flatMap((frame, index) => frame.event === 'pressure' ? [index] : []) ?? [],
    manifestPath: manifest?.manifestPath ?? null, nominalHeight, displayedHeight: nominalHeight === null ? null : nominalHeight * state.zoom,
    placement: { kind: 'preview-only', surface: state.viewpoint === 'hall' ? 'flat-ground-before-final-step' : 'courtyard-paving', sourceFoot: [...viewpoints[state.viewpoint].sourceFoot] },
    productionReference: { nominalHeight: productionReference.nominalHeight, hallEntrance: [...productionReference.hallEntrance] },
    actorScale: manifest ? nominalHeight / manifest.sourceHeight * state.zoom : null,
    ...sceneGeometry(), foot: [...foot], canvasCSSSize: [rect.width, rect.height],
    viewport: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio };
}
function pause() { state.playing = false; paint(); return snapshot(); }
function play() {
  if (!state.ready) return snapshot();
  if (state.elapsedMs >= durationMs) { state.elapsedMs = 0; state.frame = 0; }
  state.playing = true; lastTime = performance.now(); paint(); return snapshot();
}
function setFrame(value) {
  if (!state.ready || !Number.isFinite(value)) return snapshot();
  state.playing = false; state.frame = Math.max(0, Math.min(frames.length - 1, Math.round(value)));
  state.elapsedMs = starts[state.frame]; paint(); return snapshot();
}
function restart() {
  if (!state.ready) return snapshot();
  state.frame = 0; state.elapsedMs = 0; state.completedLoops = 0; return play();
}
function step(delta) {
  if (!state.ready || !Number.isFinite(delta)) return snapshot();
  const next = state.frame + Math.sign(delta);
  return setFrame(state.loop ? (next + frames.length) % frames.length : next);
}
function setLoop(value) { state.loop = Boolean(value); paint(); return snapshot(); }
function setSpeed(value) { if ([0.5, 1].includes(value)) { state.speed = value; lastTime = performance.now(); paint(); } return snapshot(); }
function setZoom(value) { if ([1, 1.35, 2].includes(value)) { state.zoom = value; paint(); } return snapshot(); }
function setViewpoint(value) { if (Object.hasOwn(viewpoints, value)) { state.viewpoint = value; paint(); } return snapshot(); }
function setEffects(value) { state.effects = Boolean(value); paint(); return snapshot(); }

function tick(now) {
  const delta = lastTime === undefined ? 0 : Math.max(0, now - lastTime); lastTime = now;
  if (state.ready && state.playing) {
    state.elapsedMs += delta * state.speed;
    if (state.elapsedMs >= durationMs) {
      if (state.loop) { state.completedLoops += Math.floor(state.elapsedMs / durationMs); state.elapsedMs %= durationMs; }
      else { state.elapsedMs = durationMs; state.playing = false; }
    }
    let frame = frames.length - 1;
    for (let i = 0; i < frames.length; i++) {
      if (state.elapsedMs < starts[i] + manifest.frames[i].durationMs) { frame = i; break; }
    }
    if (state.frame !== frame || !state.playing) { state.frame = frame; paint(); }
  }
  requestAnimationFrame(tick);
}

$('play').addEventListener('click', () => state.playing ? pause() : play());
$('restart').addEventListener('click', restart);
$('previous').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('frame').addEventListener('input', () => setFrame(Number($('frame').value)));
$('loop').addEventListener('change', () => setLoop($('loop').value === 'loop'));
$('speed').addEventListener('change', () => setSpeed(Number($('speed').value)));
$('zoom').addEventListener('change', () => setZoom(Number($('zoom').value)));
$('viewpoint').addEventListener('change', () => setViewpoint($('viewpoint').value));
$('effects').addEventListener('change', () => setEffects($('effects').checked));
$('reload').addEventListener('click', () => location.reload());
window.addEventListener('error', event => showError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showError(event.reason));
window.__guardPreview = Object.freeze({ snapshot, play, pause, restart, setFrame, step, setLoop, setSpeed, setZoom, setViewpoint, setEffects, capture: name => window.guardPreview.capture(name) });

try {
  const data = await window.guardPreview.load();
  if (data.error) throw new Error(data.error);
  manifest = data.manifest;
  nominalHeight = manifest.nominalHeight;
  const [original, clean] = await Promise.all([loadImage(data.backgroundURL, '山院母稿'), loadImage(data.cleanURL, '山院补片')]);
  for (const image of [original, clean]) {
    if (image.width !== SOURCE_SIZE.width || image.height !== SOURCE_SIZE.height) throw new Error('山院素材尺寸与正式场景不一致。');
  }
  background = makeBackground(original, clean);
  frames = await Promise.all(manifest.frames.map(async (frame, index) => {
    const entries = await Promise.all(manifest.layerOrder.map(async layer => {
      const image = await loadImage(frame.urls[layer], `第 ${index + 1} 帧 ${layer}`);
      if (image.width !== manifest.frameSize[0] || image.height !== manifest.frameSize[1]) throw new Error(`第 ${index + 1} 帧 ${layer} 尺寸与 frameSize 不一致。`);
      return [layer, image];
    }));
    return Object.fromEntries(entries);
  }));
  starts = manifest.frames.map(frame => { const start = durationMs; durationMs += frame.durationMs; return start; });
  $('frame').max = frames.length - 1; controlIds.forEach(id => { $(id).disabled = false; });
  state.ready = true; $('loading').hidden = true; document.body.dataset.status = 'ready';
  play(); requestAnimationFrame(tick);
} catch (error) { showError(error); }
