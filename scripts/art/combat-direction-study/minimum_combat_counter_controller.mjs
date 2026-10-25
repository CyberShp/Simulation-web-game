export function createCombat(config) {
  let s;
  const finish = () => { s.phase = s.held ? 'run' : 'idle'; s.time = 0; };
  function reset() {
    s = { x: config.startX, held: false, phase: 'idle', time: 0, runTime: 0,
      hp: 100, playerHp: 100, hits: 0, misses: 0, received: 0, dodges: 0,
      released: false, feedback: '', flash: 0, hurtFlash: 0, dodgeCooldown: 0,
      enemyStage: 'idle', enemyTime: 0, counterUsed: false, enemyReleased: false,
      warningX: config.startX };
  }
  reset();
  function move(down) {
    s.held = !!down;
    if (s.phase === 'idle' || s.phase === 'run') { s.phase = down ? 'run' : 'idle'; s.time = 0; }
  }
  function attack() {
    if (['attack', 'hurt', 'dodge'].includes(s.phase)) return false;
    s.phase = 'attack'; s.time = 0; s.released = false; s.feedback = '出剑'; return true;
  }
  function hurt() { s.phase = 'hurt'; s.time = 0; s.released = false; s.feedback = '受击'; }
  function dodge() {
    if (s.phase === 'hurt' || s.phase === 'dodge' || s.dodgeCooldown > 0) return false;
    s.phase = 'dodge'; s.time = 0; s.released = false; s.dodgeCooldown = 400;
    s.feedback = '后撤位移'; return true;
  }
  function advance(ms) {
    let left = Math.max(0, ms);
    while (left > 0) {
      const total = s.phase === 'attack' ? 400 : s.phase === 'hurt' ? 240 : s.phase === 'dodge' ? 180 : Infinity;
      const step = Math.min(left, 25, total - s.time);
      s.time += step; s.flash = Math.max(0, s.flash - step);
      s.hurtFlash = Math.max(0, s.hurtFlash - step);
      s.dodgeCooldown = Math.max(0, s.dodgeCooldown - step);
      if (s.phase === 'run' && s.held) {
        s.x = Math.min(config.targetX - 24, s.x + config.speed * step / 1000); s.runTime += step;
      } else if (s.phase === 'dodge') {
        s.x = Math.max(40, s.x - 52 * step / 180); s.runTime += step;
      }
      if (s.enemyStage === 'warning') {
        s.enemyTime += step;
        if (s.enemyTime >= 650) { s.enemyTime -= 650; s.enemyStage = 'attack'; s.enemyReleased = false; }
      } else if (s.enemyStage === 'attack') {
        s.enemyTime += step;
        if (!s.enemyReleased && s.enemyTime >= 200) {
          s.enemyReleased = true;
          if (Math.abs(s.x - s.warningX) <= 28) {
            s.playerHp = Math.max(0, s.playerHp - 20); s.received++; s.hurtFlash = 180; hurt();
          } else { s.dodges++; s.feedback = '躲开反击'; }
        }
        if (s.enemyTime >= 400) { s.enemyStage = 'spent'; s.enemyTime = 0; }
      }
      if (s.phase === 'attack' && !s.released && s.time >= 200) {
        s.released = true;
        const distance = config.targetX - s.x;
        if (distance >= 0 && distance <= config.range && s.hp > 0) {
          s.hp = Math.max(0, s.hp - 25); s.hits++; s.feedback = '命中 −25'; s.flash = 180;
          if (!s.counterUsed) { s.counterUsed = true; s.enemyStage = 'warning'; s.enemyTime = 0; s.warningX = s.x; }
        } else { s.misses++; s.feedback = '挥空'; }
      }
      if (s.time >= total) finish();
      left -= step;
    }
    return snapshot();
  }
  function snapshot() {
    let frame = 3;
    if (s.phase === 'attack') frame = Math.min(3, Math.floor(s.time / 100));
    else if (s.phase === 'hurt') frame = Math.min(3, Math.floor(s.time / 60));
    else if (s.phase === 'dodge') frame = Math.min(3, Math.floor(s.time / 45));
    else if (s.phase === 'run') {
      let t = s.runTime % 480; frame = config.runOrder.at(-1);
      for (const id of config.runOrder) { if (t < config.runTiming[id]) { frame = id; break; } t -= config.runTiming[id]; }
    }
    return { ...s, frame, distance: config.targetX - s.x,
      enemyFrame: s.enemyStage === 'warning' ? 1 : s.enemyStage === 'attack' ? (s.enemyTime < 200 ? 1 : s.enemyTime < 300 ? 2 : 3) : 0 };
  }
  return { reset, move, attack, hurt, dodge, advance, snapshot, blur: () => move(false) };
}
