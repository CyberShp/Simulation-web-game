const unit = (x, y, fallback = { x: 1, y: 0 }) => {
  const n = Math.hypot(x, y); return n > 1e-8 ? { x: x / n, y: y / n } : { ...fallback };
};
const direction = v => Math.abs(v.x) >= Math.abs(v.y) ? (v.x >= 0 ? 'right' : 'left') : (v.y >= 0 ? 'down' : 'up');

export function createEncounter(config) {
  let player, enemy, keys, mouse, outcome, clock, events;
  const input = () => unit(Number(keys.has('KeyD')) - Number(keys.has('KeyA')), Number(keys.has('KeyS')) - Number(keys.has('KeyW')), { x: 0, y: 0 });
  const idle = () => { player.phase = 'idle'; player.time = 0; };
  function reset() {
    player = { x: 420, y: 300, hp: 100, phase: 'idle', time: 0, runTime: 0,
      aim: { x: 1, y: 0 }, attackAim: { x: 1, y: 0 }, dodgeVector: { x: -1, y: 0 },
      released: false, cooldown: 0, hits: 0, misses: 0, flash: 0 };
    enemy = { x: 620, y: 300, hp: config.enemyHp || 200, stage: 'chase', time: 0, released: false,
      facing: -1, lock: { x: 420, y: 300 }, flash: 0, resume: 'chase', resumeTime: 0, resumeReleased: false };
    keys = new Set(); mouse = { x: 620, y: 300 }; outcome = 'ready'; clock = 0; events = [];
  }
  reset();
  function key(code, down) {
    if (outcome === 'ready' && down && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) outcome = 'running';
    if (outcome !== 'running') return; if (down) keys.add(code); else keys.delete(code);
  }
  function aim(x, y) { mouse = { x, y }; player.aim = unit(x - player.x, y - player.y, player.aim); }
  function attack() {
    if (outcome === 'ready') outcome = 'running';
    if (outcome !== 'running' || !['idle', 'run'].includes(player.phase)) return false;
    player.phase = 'attack'; player.time = 0; player.attackAim = { ...player.aim }; player.released = false;
    return true;
  }
  function dodge() {
    if (outcome !== 'running' || ['hurt', 'dodge'].includes(player.phase) || player.cooldown > 0) return false;
    const v = input(); player.dodgeVector = Math.hypot(v.x, v.y) ? v : { x: -player.aim.x, y: -player.aim.y };
    player.phase = 'dodge'; player.time = 0; player.released = false; player.cooldown = 450;
    return true;
  }
  function event(type) { events.push({ type, at: clock }); if (events.length > 12) events.shift(); }
  function clamp(p) {
    const polygon = config.walkPolygon;
    if (!polygon) { p.x = Math.max(65, Math.min(815, p.x)); p.y = Math.max(175, Math.min(535, p.y)); return; }
    let positive = false, negative = false, best = null, bestDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[(i + 1) % polygon.length];
      const dx = bx - ax, dy = by - ay, cross = dx * (p.y - ay) - dy * (p.x - ax);
      positive ||= cross > 1e-6; negative ||= cross < -1e-6;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy)));
      const q = { x: ax + t * dx, y: ay + t * dy }, d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bestDistance) { bestDistance = d; best = q; }
    }
    if (positive && negative) { p.x = best.x; p.y = best.y; }
  }
  function hurtPlayer() {
    player.hp = Math.max(0, player.hp - 20); player.flash = 180; player.released = true;
    player.phase = player.hp ? 'hurt' : 'down'; player.time = 0; event('player-hit');
    if (!player.hp) { outcome = 'defeat'; keys.clear(); enemy.stage = 'recover'; enemy.time = 0; }
  }
  function hitEnemy() {
    const dx = enemy.x - player.x, dy = enemy.y - player.y, n = Math.hypot(dx, dy);
    const aligned = n < 1 || (dx * player.attackAim.x + dy * player.attackAim.y) / n >= Math.cos(Math.PI * 50 / 180);
    if (n > config.range || !aligned || enemy.hp <= 0) { player.misses++; event('miss'); return; }
    enemy.hp = Math.max(0, enemy.hp - 25); player.hits++; enemy.flash = 180; event('enemy-hit');
    if (!enemy.hp) { enemy.stage = 'dead'; enemy.time = 0; outcome = 'victory'; keys.clear(); return; }
    if (enemy.stage !== 'hurt') { enemy.resume = enemy.stage; enemy.resumeTime = enemy.time; enemy.resumeReleased = enemy.released; }
    enemy.stage = 'hurt'; enemy.time = 0;
  }
  function advance(ms) {
    let left = Math.max(0, ms);
    if (outcome !== 'running') {
      if (enemy.stage === 'dead') enemy.time += left;
      if (player.phase === 'down') player.time += left;
      if (outcome === 'victory' && player.phase === 'attack') { player.time += left; if (player.time >= 400) idle(); }
      return snapshot();
    }
    while (left > 0 && outcome === 'running') {
      const dt = Math.min(left, 10); left -= dt; clock += dt;
      player.cooldown = Math.max(0, player.cooldown - dt); player.flash = Math.max(0, player.flash - dt); enemy.flash = Math.max(0, enemy.flash - dt);
      player.time += dt; enemy.time += dt;
      const v = input(); player.aim = unit(mouse.x - player.x, mouse.y - player.y, player.aim);
      if (['idle', 'run'].includes(player.phase)) player.phase = Math.hypot(v.x, v.y) ? 'run' : 'idle';
      if (['idle', 'run', 'attack'].includes(player.phase)) {
        player.x += v.x * config.speed * dt / 1000; player.y += v.y * config.speed * dt / 1000;
        if (Math.hypot(v.x, v.y)) player.runTime += dt;
      } else if (player.phase === 'dodge') {
        player.x += player.dodgeVector.x * 52 * dt / 180; player.y += player.dodgeVector.y * 52 * dt / 180;
      }
      clamp(player);
      if (enemy.stage === 'chase') {
        const dx = player.x - enemy.x, dy = player.y - enemy.y, n = Math.hypot(dx, dy); enemy.facing = dx >= 0 ? 1 : -1;
        if (n <= 85) { enemy.stage = 'warning'; enemy.time = 0; enemy.lock = { x: player.x, y: player.y }; event('warning'); }
        else { const u = unit(dx, dy); enemy.x += u.x * 88 * dt / 1000; enemy.y += u.y * 88 * dt / 1000; clamp(enemy); }
      } else if (enemy.stage === 'warning' && enemy.time >= 650) {
        enemy.stage = 'attack'; enemy.time -= 650; enemy.released = false;
      } else if (enemy.stage === 'attack') {
        if (!enemy.released && enemy.time >= 200) {
          enemy.released = true;
          if (Math.hypot(player.x - enemy.lock.x, player.y - enemy.lock.y) <= 32) hurtPlayer(); else event('evaded');
        }
        if (enemy.time >= 400) { enemy.stage = 'recover'; enemy.time = 0; }
      } else if (enemy.stage === 'recover' && enemy.time >= 420) { enemy.stage = 'chase'; enemy.time = 0; }
      else if (enemy.stage === 'hurt' && enemy.time >= 160) { enemy.stage = enemy.resume; enemy.time = enemy.resumeTime; enemy.released = enemy.resumeReleased; }
      if (outcome !== 'running') break;
      if (player.phase === 'attack' && !player.released && player.time >= 200) { player.released = true; hitEnemy(); }
      if (player.phase === 'attack' && player.time >= 400 || player.phase === 'hurt' && player.time >= 240 || player.phase === 'dodge' && player.time >= 180) idle();
    }
    return snapshot();
  }
  function snapshot() {
    const moving = input(); const facing = player.phase === 'attack' ? player.attackAim : player.phase === 'dodge' ? { x: -player.dodgeVector.x, y: -player.dodgeVector.y } : player.phase === 'run' ? moving : player.aim;
    let frame = 3;
    if (player.phase === 'attack') frame = Math.min(3, Math.floor(player.time / 100));
    else if (player.phase === 'hurt') frame = Math.min(3, Math.floor(player.time / 60));
    else if (player.phase === 'down') frame = 3;
    else if (player.phase === 'dodge') frame = Math.min(3, Math.floor(player.time / 45));
    else if (player.phase === 'run') {
      let t = player.runTime % 480; frame = config.runOrder.at(-1);
      for (const id of config.runOrder) { if (t < config.runTiming[id]) { frame = id; break; } t -= config.runTiming[id]; }
    }
    let enemyFrame = enemy.stage === 'warning' ? 1 : enemy.stage === 'attack' ? (enemy.time < 200 ? 1 : enemy.time < 300 ? 2 : 3) : enemy.stage === 'recover' ? 3 : 0;
    if (enemy.stage === 'chase') enemyFrame = Math.floor((enemy.time % 480) / 120);
    if (enemy.stage === 'hurt') enemyFrame = 4 + Math.min(1, Math.floor(enemy.time / 80));
    if (enemy.stage === 'dead') enemyFrame = 4 + Math.min(3, Math.floor(enemy.time / 100));
    return { player: { ...player, aim: { ...player.aim }, attackAim: { ...player.attackAim }, dodgeVector: { ...player.dodgeVector }, frame, direction: direction(facing), mirror: facing.x < 0 },
      enemy: { ...enemy, lock: { ...enemy.lock }, frame: enemyFrame, poseSet: ['chase', 'hurt', 'dead'].includes(enemy.stage) ? 'supplement' : 'counter', mirror: enemy.facing > 0 }, outcome, clock, keys: [...keys], events: events.map(e => ({ ...e })) };
  }
  return { reset, key, aim, attack, dodge, advance, snapshot, blur: () => keys.clear() };
}
