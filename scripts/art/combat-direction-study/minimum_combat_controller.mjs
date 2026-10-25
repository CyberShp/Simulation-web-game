export function createCombat(config) {
  let s;
  function reset() { s = { x: config.startX, held: false, phase: 'idle', time: 0, runTime: 0, hp: 100, hits: 0, misses: 0, released: false, feedback: '', flash: 0 }; }
  reset();
  function move(down) {
    s.held = !!down;
    if (s.phase === 'idle' || s.phase === 'run') { s.phase = down ? 'run' : 'idle'; s.time = 0; }
  }
  function attack() {
    if (s.phase === 'attack' || s.phase === 'hurt') return false;
    s.phase = 'attack'; s.time = 0; s.released = false; s.feedback = '出剑'; return true;
  }
  function hurt() { s.phase = 'hurt'; s.time = 0; s.released = false; s.feedback = '受击预览'; }
  function advance(ms) {
    let left = Math.max(0, ms);
    while (left > 0) {
      const action = s.phase === 'attack' || s.phase === 'hurt';
      const total = s.phase === 'attack' ? 400 : 240;
      const step = action ? Math.min(left, total - s.time) : left;
      s.time += step; s.flash = Math.max(0, s.flash - step);
      if (s.phase === 'run' && s.held) {
        s.x = Math.min(config.targetX - 24, s.x + config.speed * step / 1000);
        s.runTime += step;
      }
      if (s.phase === 'attack' && !s.released && s.time >= 200) {
        s.released = true;
        const distance = config.targetX - s.x;
        if (distance >= 0 && distance <= config.range && s.hp > 0) {
          s.hp = Math.max(0, s.hp - 25); s.hits++; s.feedback = '命中 −25'; s.flash = 180;
        } else { s.misses++; s.feedback = '挥空'; }
      }
      left -= step;
      if (action && s.time >= total) { s.phase = s.held ? 'run' : 'idle'; s.time = 0; }
    }
    return snapshot();
  }
  function snapshot() {
    let frame;
    if (s.phase === 'attack') frame = Math.min(3, Math.floor(s.time / 100));
    else if (s.phase === 'hurt') frame = Math.min(3, Math.floor(s.time / 60));
    else if (s.phase === 'run') {
      let t = s.runTime % 480; frame = config.runOrder.at(-1);
      for (const id of config.runOrder) { if (t < config.runTiming[id]) { frame = id; break; } t -= config.runTiming[id]; }
    } else frame = Math.min(14, Math.floor((s.time % 625) / (625 / 15)));
    return { ...s, frame, distance: config.targetX - s.x };
  }
  return { reset, move, attack, hurt, advance, snapshot, blur: () => move(false) };
}
