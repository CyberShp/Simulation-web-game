const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const crop = [230, 175, 1180, 570];
const foot = [480, 400];
const state = { ready: false, playing: false, loop: true, speed: 1, height: 111, effects: true, frame: 0, elapsedMs: 0, completedLoops: 0, error: null };
const controlIds = ['play', 'restart', 'previous', 'next', 'loop', 'speed', 'height', 'effects', 'frame'];
let manifest, frames = [], background, starts = [], durationMs = 0, lastTime;

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

function paint() {
  if (!state.ready) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, ...crop, 0, 0, canvas.width, canvas.height);
  const scale = state.height / manifest.sourceHeight;
  const x = foot[0] - manifest.anchor[0] * scale;
  const y = foot[1] - manifest.anchor[1] * scale;
  ctx.fillStyle = '#17282050';
  ctx.beginPath(); ctx.ellipse(foot[0] - 3, foot[1], state.height * .19, state.height * .045, 0, 0, Math.PI * 2); ctx.fill();
  for (const layer of manifest.layerOrder) {
    if (layer === 'effect' && !state.effects) continue;
    ctx.drawImage(frames[state.frame][layer], x, y, manifest.frameSize[0] * scale, manifest.frameSize[1] * scale);
  }
  const frame = manifest.frames[state.frame];
  $('frame').value = state.frame;
  $('frame-label').textContent = `${String(state.frame + 1).padStart(2, '0')} / ${frames.length} 帧 · ${(starts[state.frame] / 1000).toFixed(2)} / ${(durationMs / 1000).toFixed(2)} 秒`;
  $('play').textContent = state.playing ? '暂停' : '播放';
  $('play').setAttribute('aria-pressed', String(state.playing));
  $('loop').value = state.loop ? 'loop' : 'once';
  $('speed').value = state.speed;
  $('height').value = state.height;
  $('effects').checked = state.effects;
  $('phase').textContent = `${frame.phase}　｜　右手持剑 · 左手引诀`;
  $('metrics').textContent = `${state.height} px 人物身高 · ${state.speed}× · ${state.effects ? '法术效果开启' : '法术效果关闭'} · ${frames.length} 帧 / ${(durationMs / 1000).toFixed(2)} 秒`;
  document.body.dataset.frame = state.frame;
  document.body.dataset.phase = frame.phase;
  document.body.dataset.playing = state.playing;
  document.body.dataset.height = state.height;
}

function snapshot() {
  const rect = canvas.getBoundingClientRect();
  return { ...state, phase: manifest?.frames[state.frame]?.phase ?? null, event: manifest?.frames[state.frame]?.event ?? null,
    frameCount: frames.length, fps: manifest?.fps ?? null, durationMs, frameDurationMs: manifest?.frames[state.frame]?.durationMs ?? null,
    sourceHeight: manifest?.sourceHeight ?? null, frameSize: manifest?.frameSize ?? null, anchor: manifest?.anchor ?? null,
    layerOrder: manifest?.layerOrder ?? null, releaseFrames: manifest?.frames.flatMap((frame, index) => frame.event === 'release' ? [index] : []) ?? [],
    manifestPath: manifest?.manifestPath ?? null, crop: [...crop], foot: [...foot], canvasCSSSize: [rect.width, rect.height],
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
  state.playing = false;
  state.frame = Math.max(0, Math.min(frames.length - 1, Math.round(value)));
  state.elapsedMs = starts[state.frame];
  paint(); return snapshot();
}
function restart() {
  if (!state.ready) return snapshot();
  state.frame = 0; state.elapsedMs = 0; state.completedLoops = 0;
  return play();
}
function step(delta) {
  if (!state.ready || !Number.isFinite(delta)) return snapshot();
  const next = state.frame + Math.sign(delta);
  return setFrame(state.loop ? (next + frames.length) % frames.length : next);
}
function setLoop(value) { state.loop = Boolean(value); paint(); return snapshot(); }
function setSpeed(value) { if ([0.5, 1].includes(value)) { state.speed = value; lastTime = performance.now(); paint(); } return snapshot(); }
function setHeight(value) { if ([111, 150, 222].includes(value)) { state.height = value; paint(); } return snapshot(); }
function setEffects(value) { state.effects = Boolean(value); paint(); return snapshot(); }

function tick(now) {
  const delta = lastTime === undefined ? 0 : Math.max(0, now - lastTime);
  lastTime = now;
  if (state.ready && state.playing) {
    state.elapsedMs += delta * state.speed;
    if (state.elapsedMs >= durationMs) {
      if (state.loop) {
        state.completedLoops += Math.floor(state.elapsedMs / durationMs);
        state.elapsedMs %= durationMs;
      } else {
        state.elapsedMs = durationMs; state.playing = false;
      }
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
$('height').addEventListener('change', () => setHeight(Number($('height').value)));
$('effects').addEventListener('change', () => setEffects($('effects').checked));
$('reload').addEventListener('click', () => location.reload());
window.addEventListener('error', event => showError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showError(event.reason));
window.__castPreview = Object.freeze({ snapshot, play, pause, restart, setFrame, step, setLoop, setSpeed, setHeight, setEffects, capture: name => window.castPreview.capture(name) });

try {
  const data = await window.castPreview.load();
  if (data.error) throw new Error(data.error);
  manifest = data.manifest;
  background = await loadImage(data.backgroundURL, '山院背景');
  if (crop[0] + crop[2] > background.width || crop[1] + crop[3] > background.height) throw new Error('山院背景尺寸不足以容纳预览区域。');
  frames = await Promise.all(manifest.frames.map(async (frame, index) => {
    const entries = await Promise.all(manifest.layerOrder.map(async layer => {
      const image = await loadImage(frame.urls[layer], `第 ${index + 1} 帧 ${layer}`);
      if (image.width !== manifest.frameSize[0] || image.height !== manifest.frameSize[1]) throw new Error(`第 ${index + 1} 帧 ${layer} 尺寸与 frameSize 不一致。`);
      return [layer, image];
    }));
    return Object.fromEntries(entries);
  }));
  starts = manifest.frames.map(frame => { const start = durationMs; durationMs += frame.durationMs; return start; });
  $('frame').max = frames.length - 1;
  controlIds.forEach(id => { $(id).disabled = false; });
  state.ready = true;
  $('loading').hidden = true; document.body.dataset.status = 'ready';
  play(); requestAnimationFrame(tick);
} catch (error) { showError(error); }
