import { alphaCapsuleHit, enemyPoseInfo } from './ranged_hit_shapes.mjs';

const unit = (x, y, fallback = { x: 1, y: 0 }) => { const n = Math.hypot(x, y); return n > 1e-8 ? { x: x / n, y: y / n } : { ...fallback }; };
const cardinal = v => Math.abs(v.x) >= Math.abs(v.y) ? (v.x >= 0 ? 'right' : 'left') : (v.y >= 0 ? 'down' : 'up');
const octant = v => ['right', 'se', 'down', 'sw', 'left', 'nw', 'up', 'ne'][(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8];

export function segmentCircleHit(a, b, center, radius) {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length2)) : 0;
  return (a.x + t * dx - center.x) ** 2 + (a.y + t * dy - center.y) ** 2 <= radius * radius;
}

export function createRanged(config) {
  if (!config.hitShapes) throw new Error('Native alpha hit shapes are required');
  let epoch = 0, eventId = 0;
  let player, enemy, keys, mouse, outcome, clock, events, projectiles, groundStrikes, groundBursts, impacts, nextId, shakeMs;
  const input = () => unit(Number(keys.has('KeyD')) - Number(keys.has('KeyA')), Number(keys.has('KeyS')) - Number(keys.has('KeyW')), { x: 0, y: 0 });
  const idle = () => { player.phase = 'idle'; player.time = 0; };
  function reset() {
    epoch++;
    player = { x: config.playerStart?.x ?? 420, y: config.playerStart?.y ?? 300, hp: 100,
      phase: 'idle', time: 0, runTime: 0, aim: { x: 1, y: 0 }, attackAim: { x: 1, y: 0 },
      dodgeVector: { x: -1, y: 0 }, heavyTarget: null, heavyAim: { x: 1, y: 0 }, releasePoseMs: 0,
      released: false, cooldown: 0, heavyCooldown: 0, hits: 0, misses: 0, flash: 0 };
    enemy = { x: config.enemyStart?.x ?? 620, y: config.enemyStart?.y ?? 300, hp: config.enemyHp ?? 200,
      stage: 'chase', time: 0, released: false, facing: -1, lock: { x: player.x, y: player.y },
      flash: 0, hitKind: 'light', hurtDuration: 120, resume: 'chase', resumeTime: 0, resumeReleased: false };
    keys = new Set(); mouse = { x: enemy.x, y: enemy.y }; outcome = 'ready'; clock = 0; events = [];
    projectiles = []; groundStrikes = []; groundBursts = []; impacts = []; nextId = 1; shakeMs = 0;
  }
  reset();
  function key(code, down) {
    if (outcome === 'ready' && down && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) outcome = 'running';
    if (outcome !== 'running') return; if (down) keys.add(code); else keys.delete(code);
  }
  const muzzle = () => ({ x: player.x + (config.lightMuzzleOffset?.[0] ?? 0), y: player.y + (config.lightMuzzleOffset?.[1] ?? -24) });
  function aim(x, y) { mouse = { x, y }; const origin = muzzle(); player.aim = unit(x - origin.x, y - origin.y, player.aim); }
  function attack() {
    if (outcome === 'ready') outcome = 'running';
    if (outcome !== 'running' || !['idle', 'run'].includes(player.phase)) return false;
    player.phase = 'attack'; player.time = 0; player.attackAim = { ...player.aim }; player.released = false; player.releasePoseMs = 0;
    return true;
  }
  function heavy() {
    if (outcome === 'ready') outcome = 'running';
    if (outcome !== 'running' || !['idle', 'run'].includes(player.phase) || player.heavyCooldown > 0) return false;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, distance = Math.hypot(dx, dy), u = unit(dx, dy, player.aim);
    const target = { x: player.x + u.x * Math.min(320, distance), y: player.y + u.y * Math.min(320, distance) }; clamp(target);
    player.heavyTarget = target; player.heavyAim = unit(target.x - player.x, target.y - player.y, player.aim);
    player.phase = 'heavy'; player.time = 0; player.released = false; player.releasePoseMs = 0; event('heavy-start'); return true;
  }
  function dodge() {
    if (outcome !== 'running' || ['hurt', 'dodge'].includes(player.phase) || player.cooldown > 0) return false;
    const v = input(); player.dodgeVector = Math.hypot(v.x, v.y) ? v : { x: -player.aim.x, y: -player.aim.y };
    player.phase = 'dodge'; player.time = 0; player.released = false; player.cooldown = 450; player.releasePoseMs = 0;
    event('dodge'); return true;
  }
  function event(type, extra = {}) { events.push({ id: ++eventId, epoch, type, at: clock, ...extra }); if (events.length > 24) events.shift(); }
  function clamp(p) {
    const polygon = config.walkPolygon; let positive = false, negative = false, best = null, bestDistance = Infinity;
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
  function terminal(result) { outcome = result; keys.clear(); projectiles = []; groundStrikes = []; player.releasePoseMs = 0; event(result); }
  function hurtPlayer() {
    player.hp = Math.max(0, player.hp - 20); player.flash = 120; player.released = true;
    player.phase = player.hp ? 'hurt' : 'down'; player.time = 0; player.releasePoseMs = 0; event('player-hit');
    if (!player.hp) { terminal('defeat'); enemy.stage = 'recover'; enemy.time = 0; }
  }
  function hitEnemy(kind, from, sourceId, contact = null) {
    if (enemy.hp <= 0 || outcome !== 'running') return;
    const isHeavy = kind === 'heavy', damage = isHeavy ? 55 : 25, duration = isHeavy ? 360 : 120;
    const push = unit(from.x, from.y, player.attackAim), amount = isHeavy ? 16 : 3.2;
    enemy.x += push.x * amount; enemy.y += push.y * amount; clamp(enemy);
    enemy.hp = Math.max(0, enemy.hp - damage); enemy.flash = isHeavy ? 120 : 80; enemy.hitKind = kind;
    player.hits++; event('enemy-hit', { kind, damage, sourceId });
    impacts.push({ id: nextId++, sourceId, kind, x: contact?.x ?? enemy.x, y: contact?.y ?? enemy.y, visiblePoint: !!contact, remainingMs: isHeavy ? 120 : 80 });
    if (isHeavy) shakeMs = 80;
    if (!enemy.hp) { enemy.stage = 'dead'; enemy.time = 0; terminal('victory'); return; }
    const previousRemaining = enemy.stage === 'hurt' ? Math.max(0, enemy.hurtDuration - enemy.time) : 0;
    if (enemy.stage !== 'hurt') { enemy.resume = enemy.stage; enemy.resumeTime = enemy.time; enemy.resumeReleased = enemy.released; }
    enemy.stage = 'hurt'; enemy.time = 0; enemy.hurtDuration = Math.max(duration, previousRemaining);
  }
  function visual(dt) {
    impacts = impacts.map(i => ({ ...i, remainingMs: i.remainingMs - dt })).filter(i => i.remainingMs > 0);
    groundBursts = groundBursts.map(i => ({ ...i, remainingMs: i.remainingMs - dt })).filter(i => i.remainingMs > 0);
    shakeMs = Math.max(0, shakeMs - dt); player.flash = Math.max(0, player.flash - dt); enemy.flash = Math.max(0, enemy.flash - dt);
    player.releasePoseMs = Math.max(0, player.releasePoseMs - dt);
  }
  function effects(dt) {
    const survivors = [];
    for (const shot of projectiles) {
      if (outcome !== 'running') break;
      const travel = Math.min(shot.remaining, (config.projectileSpeed ?? 480) * dt / 1000);
      const before = { x: shot.x, y: shot.y }, after = { x: shot.x + shot.dx * travel, y: shot.y + shot.dy * travel };
      shot.x = after.x; shot.y = after.y; shot.remaining -= travel;
      const pose = enemyPoseInfo(enemy), sprite = pose.poseSet === 'supplement' ? config.enemySupplement[pose.frame] : config.enemyActions[pose.frame];
      if (alphaCapsuleHit(before, after, { x: shot.dx, y: shot.dy }, enemy, sprite, config.hitShapes[sprite.file], enemy.facing > 0, config.lightCoreLength ?? 28, config.lightCoreWidth ?? 4)) {
        hitEnemy('light', { x: shot.dx, y: shot.dy }, shot.id, { x: after.x + shot.dx * 12, y: after.y + shot.dy * 12 });
      }
      else if (shot.remaining > 1e-8) survivors.push(shot);
      else { player.misses++; event('projectile-miss', { sourceId: shot.id }); }
    }
    projectiles = outcome === 'running' ? survivors : [];
    const pending = [];
    for (const strike of groundStrikes) {
      if (outcome !== 'running') break;
      strike.remainingMs -= dt;
      if (strike.remainingMs > 1e-8) { pending.push(strike); continue; }
      const hit = Math.hypot(enemy.x - strike.target.x, enemy.y - strike.target.y) <= 44;
      groundBursts.push({ id: nextId++, sourceId: strike.id, x: strike.target.x, y: strike.target.y, hit, remainingMs: 140 });
      event('heavy-land', { sourceId: strike.id, hit });
      if (hit) {
        const u = unit(enemy.x - strike.target.x, enemy.y - strike.target.y, strike.aim); hitEnemy('heavy', u, strike.id);
      } else { player.misses++; event('heavy-miss', { sourceId: strike.id }); }
    }
    groundStrikes = outcome === 'running' ? pending : [];
  }
  function advance(ms) {
    let left = Math.max(0, ms);
    if (outcome !== 'running') {
      visual(left);
      if (enemy.stage === 'dead') enemy.time += left;
      if (player.phase === 'down') player.time += left;
      if (outcome === 'victory' && player.phase === 'attack') { player.time += left; if (player.time >= 400) idle(); }
      return snapshot();
    }
    while (left > 0 && outcome === 'running') {
      const dt = Math.min(left, 10); left -= dt; clock += dt; visual(dt);
      player.cooldown = Math.max(0, player.cooldown - dt); player.heavyCooldown = Math.max(0, player.heavyCooldown - dt);
      player.time += dt; enemy.time += dt;
      const v = input(), origin = muzzle(); player.aim = unit(mouse.x - origin.x, mouse.y - origin.y, player.aim);
      if (['idle', 'run'].includes(player.phase)) player.phase = Math.hypot(v.x, v.y) ? 'run' : 'idle';
      if (['idle', 'run', 'attack'].includes(player.phase)) {
        player.x += v.x * config.speed * dt / 1000; player.y += v.y * config.speed * dt / 1000;
        if (Math.hypot(v.x, v.y)) { player.runTime += dt; player.releasePoseMs = 0; }
      } else if (player.phase === 'dodge') {
        player.x += player.dodgeVector.x * 52 * dt / 180; player.y += player.dodgeVector.y * 52 * dt / 180;
      }
      clamp(player);
      if (enemy.stage === 'chase') {
        const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy); enemy.facing = dx >= 0 ? 1 : -1;
        if (distance <= 85) { enemy.stage = 'warning'; enemy.time = 0; enemy.lock = { x: player.x, y: player.y }; event('warning'); }
        else { const u = unit(dx, dy); enemy.x += u.x * (config.enemySpeed ?? 88) * dt / 1000; enemy.y += u.y * (config.enemySpeed ?? 88) * dt / 1000; clamp(enemy); }
      } else if (enemy.stage === 'warning' && enemy.time >= 650) { enemy.stage = 'attack'; enemy.time -= 650; enemy.released = false; }
      else if (enemy.stage === 'attack') {
        if (!enemy.released && enemy.time >= 200) {
          enemy.released = true; event('enemy-swing'); if (Math.hypot(player.x - enemy.lock.x, player.y - enemy.lock.y) <= 32) hurtPlayer(); else event('evaded');
        }
        if (enemy.time >= 400) { enemy.stage = 'recover'; enemy.time = 0; }
      } else if (enemy.stage === 'recover' && enemy.time >= 420) { enemy.stage = 'chase'; enemy.time = 0; }
      else if (enemy.stage === 'hurt' && enemy.time >= enemy.hurtDuration) { enemy.stage = enemy.resume; enemy.time = enemy.resumeTime; enemy.released = enemy.resumeReleased; }
      if (outcome !== 'running') break;
      effects(dt); if (outcome !== 'running') break;
      if (player.phase === 'attack' && !player.released && player.time >= 200) {
        player.released = true;
        const source = muzzle();
        const shot = { id: nextId++, x: source.x, y: source.y, dx: player.attackAim.x, dy: player.attackAim.y, remaining: 320 };
        projectiles.push(shot); event('projectile-release', { sourceId: shot.id });
      }
      if (player.phase === 'heavy' && player.time >= 260) {
        const strike = { id: nextId++, target: { ...player.heavyTarget }, aim: { ...player.heavyAim }, remainingMs: 120 };
        groundStrikes.push(strike); player.heavyCooldown = 1800; player.releasePoseMs = 80; player.released = true;
        event('heavy-release', { sourceId: strike.id }); idle();
      }
      if (player.phase === 'attack' && player.time >= 400 || player.phase === 'hurt' && player.time >= 240 || player.phase === 'dodge' && player.time >= 180) idle();
    }
    return snapshot();
  }
  function snapshot() {
    const v = input(), locked = player.phase === 'attack' ? player.attackAim : player.phase === 'heavy' || player.releasePoseMs > 0 ? player.heavyAim : null;
    const facing = locked || (player.phase === 'dodge' ? { x: -player.dodgeVector.x, y: -player.dodgeVector.y } : player.phase === 'run' ? v : player.aim);
    let frame = 3;
    if (player.phase === 'attack') frame = Math.min(3, Math.floor(player.time / 100));
    else if (player.phase === 'heavy') frame = Math.min(1, Math.floor(player.time / 130));
    else if (player.phase === 'hurt') frame = Math.min(3, Math.floor(player.time / 60));
    else if (player.phase === 'dodge') frame = Math.min(3, Math.floor(player.time / 45));
    else if (player.phase === 'run') { let t = player.runTime % 480; frame = config.runOrder.at(-1); for (const id of config.runOrder) { if (t < config.runTiming[id]) { frame = id; break; } t -= config.runTiming[id]; } }
    const pose = enemyPoseInfo(enemy), enemyFrame = pose.frame;
    return { player: { ...player, aim: { ...player.aim }, attackAim: { ...player.attackAim }, heavyAim: { ...player.heavyAim }, heavyTarget: player.heavyTarget && { ...player.heavyTarget }, dodgeVector: { ...player.dodgeVector }, frame, direction: locked ? octant(facing) : cardinal(facing), mirror: facing.x < 0 },
      enemy: { ...enemy, lock: { ...enemy.lock }, frame: enemyFrame, poseSet: pose.poseSet, mirror: enemy.facing > 0 },
      outcome, epoch, muzzle: muzzle(), clock, keys: [...keys], events: events.map(e => ({ ...e })), projectiles: projectiles.map(p => ({ ...p })), groundStrikes: groundStrikes.map(s => ({ ...s, target: { ...s.target }, aim: { ...s.aim } })), groundBursts: groundBursts.map(i => ({ ...i })), impacts: impacts.map(i => ({ ...i })), shakeMs };
  }
  return { reset, key, aim, attack, heavy, dodge, advance, snapshot, blur: () => keys.clear() };
}
