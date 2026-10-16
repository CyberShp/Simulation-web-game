/** Runtime recovery helpers. None of these functions mutate a game state. */

/** A resumed or stalled tab never converts wall-clock absence into game time. */
export function createRuntimeClock({maxStepSeconds = .25, maxGapMs = 1000} = {}) {
  if (!(maxStepSeconds > 0) || !Number.isFinite(maxStepSeconds) || !(maxGapMs > 0) || !Number.isFinite(maxGapMs)) {
    throw new TypeError('运行时间配置无效。');
  }
  let previous = null, suspended = false;
  return {
    suspend() { suspended = true; previous = null; },
    resume(now) { suspended = false; previous = Number.isFinite(now) ? now : null; },
    reset() { previous = null; },
    next(now) {
      if (!Number.isFinite(now) || suspended) return {dt: 0, elapsedMs: 0, droppedGap: false};
      if (previous !== null && now < previous) return {dt: 0, elapsedMs: 0, droppedGap: false};
      const elapsedMs = previous === null ? 0 : Math.max(0, now - previous);
      previous = now;
      const droppedGap = elapsedMs > maxGapMs;
      return {dt: droppedGap ? 0 : Math.min(maxStepSeconds, elapsedMs / 1000), elapsedMs, droppedGap};
    },
    get suspended() { return suspended; },
  };
}

/** Samples actual visible requestAnimationFrame cadence and CPU work duration. */
export function createFrameDiagnostics({sampleLimit = 180, slowFrameMs = 50, minSamples = 30} = {}) {
  if (!Number.isInteger(sampleLimit) || sampleLimit < 1 || !Number.isInteger(minSamples) || minSamples < 1 || minSamples > sampleLimit) {
    throw new TypeError('性能采样配置无效。');
  }
  const samples = [];
  const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null;
  return {
    record({elapsedMs, workMs = 0, visible = true, droppedGap = false} = {}) {
      if (!visible || droppedGap || !Number.isFinite(elapsedMs) || elapsedMs <= 0 || !Number.isFinite(workMs) || workMs < 0) return;
      samples.push({elapsedMs, workMs});
      if (samples.length > sampleLimit) samples.shift();
    },
    reset() { samples.length = 0; },
    snapshot() {
      const elapsed = samples.map(s => s.elapsedMs), work = samples.map(s => s.workMs);
      const mean = samples.length ? elapsed.reduce((a, b) => a + b, 0) / samples.length : null;
      return {samples: samples.length, ready: samples.length >= minSamples,
        fps: mean ? Math.round(10000 / mean) / 10 : null,
        frameP95Ms: percentile(elapsed, .95), workP95Ms: percentile(work, .95),
        slowFrames: elapsed.filter(ms => ms > slowFrameMs).length};
    },
  };
}

/** Independent assets settle on error/timeout; retries retain successful assets. */
export function createAssetLoader({loaders, timeoutMs = 8000, onChange = () => {}}) {
  if (!loaders || typeof loaders !== 'object' || Array.isArray(loaders) ||
      !Object.values(loaders).every(loader => typeof loader === 'function') || !Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('素材加载配置无效。');
  }
  const records = new Map(Object.keys(loaders).map(id => [id, {status: 'idle', value: null, error: null, attempts: 0}]));
  let pending = null;
  function snapshot() {
    return {loading: [...records.values()].some(r => r.status === 'loading'),
      ready: [...records.values()].every(r => r.status === 'loaded'),
      failed: [...records].filter(([, r]) => r.status === 'failed').map(([id, r]) => ({id, message: r.error})),
      assets: Object.fromEntries([...records].map(([id, r]) => [id, {status: r.status, attempts: r.attempts}]))};
  }
  function emit() { try { onChange(snapshot()); } catch { /* Rendering callbacks cannot fail the loader. */ } }
  async function attempt(id) {
    const record = records.get(id), controller = new AbortController();
    record.status = 'loading'; record.error = null; ++record.attempts;
    let timer;
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new Error('素材加载超时，请重试。'));
      }, timeoutMs); });
      const value = await Promise.race([Promise.resolve().then(() => loaders[id]({signal: controller.signal})), timeout]);
      record.value = value; record.status = 'loaded';
    } catch (error) {
      record.status = 'failed'; record.error = error?.message || '素材加载失败，请重试。';
    } finally { clearTimeout(timer); emit(); }
  }
  function load({retryFailed = false} = {}) {
    if (pending) return pending;
    const ids = [...records].filter(([, r]) => r.status === 'idle' || retryFailed && r.status === 'failed').map(([id]) => id);
    if (!ids.length) return Promise.resolve(snapshot());
    pending = Promise.all(ids.map(attempt)).then(() => snapshot()).finally(() => { pending = null; });
    emit(); return pending;
  }
  return {load, retry: () => load({retryFailed: true}), snapshot, get: id => records.get(id)?.value ?? null};
}
