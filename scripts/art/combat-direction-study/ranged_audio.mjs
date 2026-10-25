/** Event-driven audio for the isolated ranged study. Assets are embedded WAV data URIs. */
export const RANGED_CUE_FILES = Object.freeze({
  swordRelease: 'sword-release.wav', lightHit: 'light-hit.wav', heavyCharge: 'heavy-charge.wav',
  heavyImpact: 'heavy-impact.wav', dodge: 'dodge.wav', enemySlam: 'enemy-slam.wav',
  playerHit: 'player-hit.wav', groundStrike: 'ground-strike.wav',
});

export function createRangedAudio({ assets = {}, volume = .35, muted = false,
  createContext = null, maxEventAgeMs = 120, maxVoices = 8 } = {}) {
  let context = null, master = null, limiter = null, raw = null, decoded = null, preparing = null;
  let unlocked = false, disposed = false, error = null, epoch = null, lastId = -1, lastClock = 0;
  let played = 0, dropped = 0;
  volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : .35;
  maxVoices = Number.isFinite(maxVoices) ? Math.max(1, Math.min(32, Math.floor(maxVoices))) : 8;
  maxEventAgeMs = Number.isFinite(maxEventAgeMs) ? Math.max(0, maxEventAgeMs) : 120;
  muted = !!muted;
  const voices = new Set();
  const ids = snapshot => (snapshot.events || []).filter(e => Number.isSafeInteger(e.id) && e.id >= 0);
  const validClock = snapshot => Number.isFinite(snapshot.clock) ? snapshot.clock : 0;

  function status() {
    return { ready: !!decoded, unlocked: unlocked && context?.state === 'running', muted, volume,
      activeVoices: voices.size, epoch, lastEventId: lastId, played, dropped, error, disposed };
  }
  function preload() {
    if (raw) return Promise.resolve(true);
    try {
      raw = Object.fromEntries(Object.keys(RANGED_CUE_FILES).map(key => {
        const uri = assets[key];
        if (typeof uri !== 'string' || !uri.startsWith('data:audio/wav;base64,')) throw Error('Missing embedded WAV: ' + key);
        const bytes = atob(uri.slice(uri.indexOf(',') + 1));
        return [key, Uint8Array.from(bytes, c => c.charCodeAt(0)).buffer];
      }));
      return Promise.resolve(true);
    } catch (cause) { raw = null; error = String(cause?.message || cause); return Promise.resolve(false); }
  }
  function gain() {
    if (!master) return;
    const at = context.currentTime, value = muted ? 0 : volume;
    master.gain.cancelScheduledValues(at);
    master.gain.setTargetAtTime(value, at, .012);
  }
  function remove(voice) {
    voices.delete(voice);
    try { voice.source.disconnect(); voice.panner?.disconnect(); } catch { /* Node may already be detached. */ }
  }
  function stopVoice(voice) {
    try { voice.source.stop(); } catch { /* A completed source is already silent. */ }
    remove(voice);
  }
  function stopAll() { for (const voice of [...voices]) stopVoice(voice); }
  function stopCharge() { for (const voice of [...voices]) if (voice.cue === 'heavyCharge') stopVoice(voice); }

  /** Call directly from a user gesture; resume begins before any await. */
  function unlock() {
    if (disposed) return Promise.resolve(false);
    try {
      if (!context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        context = createContext ? createContext() : Context ? new Context() : null;
        if (!context) throw Error('WebAudio unavailable');
        master = context.createGain(); master.gain.value = muted ? 0 : volume;
        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
        limiter.attack.value = .001; limiter.release.value = .060;
        master.connect(limiter); limiter.connect(context.destination);
      }
      const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      if (!preparing) {
        preparing = preload().then(ok => {
          if (!ok) return false;
          return Promise.all(Object.entries(raw).map(async ([key, bytes]) => [key, await context.decodeAudioData(bytes.slice(0))]))
            .then(entries => { decoded = Object.fromEntries(entries); return true; });
        }).catch(cause => { error = String(cause?.message || cause); preparing = null; return false; });
      }
      return Promise.all([resumed, preparing]).then(([, ready]) => {
        unlocked = !!ready && !disposed && context.state === 'running'; return unlocked;
      }).catch(cause => { error = String(cause?.message || cause); unlocked = false; return false; });
    } catch (cause) { error = String(cause?.message || cause); return Promise.resolve(false); }
  }
  function cueFor(event) {
    if (event.type === 'projectile-release') return 'swordRelease';
    if (event.type === 'enemy-hit') return event.kind === 'heavy' ? 'heavyImpact' : 'lightHit';
    if (event.type === 'heavy-start') return 'heavyCharge';
    if (event.type === 'heavy-land' && event.hit === false) return 'groundStrike';
    if (event.type === 'dodge') return 'dodge';
    if (event.type === 'enemy-swing' || event.type === 'enemy-release') return 'enemySlam';
    if (event.type === 'player-hit') return 'playerHit';
    return null;
  }
  function play(cue, event, snapshot) {
    if (!decoded || !unlocked || context.state !== 'running' || muted || volume <= 0 || disposed) { dropped++; return; }
    try {
      while (voices.size >= maxVoices) stopVoice(voices.values().next().value);
      const source = context.createBufferSource(); source.buffer = decoded[cue];
      let panner = null;
      if (context.createStereoPanner) {
        panner = context.createStereoPanner();
        const at = Number.isFinite(event.x) ? event.x : cue === 'playerHit' || cue === 'dodge' ? snapshot.player?.x : snapshot.enemy?.x;
        const origin = snapshot.player?.x;
        panner.pan.value = Number.isFinite(at) && Number.isFinite(origin) ? Math.max(-.55, Math.min(.55, (at - origin) / 400)) : 0;
        source.connect(panner); panner.connect(master);
      } else source.connect(master);
      const voice = { source, panner, cue }; voices.add(voice);
      source.onended = () => remove(voice); source.start(context.currentTime); played++;
    } catch (cause) { error = String(cause?.message || cause); dropped++; }
  }
  function baseline(snapshot) {
    epoch = snapshot.epoch ?? 0;
    lastId = ids(snapshot).reduce((max, e) => Math.max(max, e.id), -1);
    lastClock = validClock(snapshot);
  }
  /** New IDs are consumed even while muted/loading; effects are never queued. */
  function sync(snapshot) {
    if (!snapshot || disposed) return status();
    const now = validClock(snapshot), nextEpoch = snapshot.epoch ?? 0;
    if (epoch === null || epoch !== nextEpoch || now < lastClock) { stopAll(); baseline(snapshot); return status(); }
    lastClock = now;
    for (const event of ids(snapshot).sort((a, b) => a.id - b.id)) {
      if (event.id <= lastId) continue;
      lastId = event.id;
      if (Number.isFinite(event.at) && (event.at > now || now - event.at > maxEventAgeMs)) { dropped++; continue; }
      if (['heavy-release', 'dodge', 'player-hit'].includes(event.type)) stopCharge();
      const cue = cueFor(event); if (cue) play(cue, event, snapshot);
    }
    return status();
  }
  function reset(nextEpoch) {
    stopAll(); epoch = nextEpoch ?? epoch ?? 0; lastId = -1; lastClock = 0; played = 0; dropped = 0;
    return status();
  }
  function setMuted(value) { muted = !!value; if (muted) stopAll(); gain(); return status(); }
  function setVolume(value) { if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value)); gain(); return status(); }
  function dispose() {
    stopAll(); disposed = true; unlocked = false;
    try { const closed = context?.close(); if (closed?.catch) closed.catch(() => {}); } catch { /* Context may already be closed. */ }
  }
  preload();
  return { preload, unlock, sync, setMuted, setVolume, reset, status, dispose };
}
