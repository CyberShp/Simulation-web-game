import { blockedCells, canStand, findPath, heightAt, moveBuilding, nearestWalkable, sweep } from '../ea-navigation.mjs?v=terrain-lab-1.0.4';
export const VERSION = 'terrain-lab-1.0';
export const POIS = [
  { id: 'home', name: '主屋', x: 7.5, y: 7.5 },
  { id: 'west', name: '西路', x: 10.5, y: 14.5 },
  { id: 'bridge', name: '石桥', x: 14.5, y: 12.5 },
  { id: 'garden', name: '药圃', x: 21.5, y: 10.5 },
  { id: 'arena', name: '试炼场', x: 22.5, y: 18.5 }
];
export const APPEARANCE_COLORS = ['#dbe5cf', '#70a998', '#7295b3', '#b29a79', '#ab7880', '#929474'];
export function appearance(seed) {
  const n = seed >>> 0;
  return { seed: n, robe: APPEARANCE_COLORS[n % 6], trim: ['#ccb374', '#dae1ce', '#bfa993'][Math.floor(n / 6) % 3], hair: ['#26332c', '#3d302b', '#656b62'][Math.floor(n / 18) % 3], hairstyle: Math.floor(n / 54) % 4, body: Math.floor(n / 216) % 2, weapon: ['sword', 'staff', 'fan'][Math.floor(n / 432) % 3] };
}
export function createMap() {
  const width = 30, height = 25, tiles = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const river = x >= 13 && x <= 15, border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const bridge = river && y >= 11 && y <= 13;
    const elevation = x >= 18 ? .8 : x >= 17 ? .4 : 0;
    return { walkable: !border && (!river || bridge), kind: border ? 'cliff' : bridge ? 'bridge' : river ? 'water' : 'grass', height: elevation };
  }));
  for (let x = 3; x < 28; x++) for (let y = 11; y <= 13; y++) if (tiles[y][x].kind === 'grass') tiles[y][x].kind = x === 17 ? 'stairs' : 'road';
  for (let y = 6; y <= 21; y++) for (const x of [7, 8, 21, 22]) if (tiles[y][x].kind === 'grass') tiles[y][x].kind = 'road';
  const obstacles = [
    { id: 'wall-a', kind: 'wall', x: 5, y: 16, w: 5, h: 1, label: '院墙' },
    { id: 'wall-b', kind: 'wall', x: 20, y: 16, w: 5, h: 1, label: '试炼院墙' },
    { id: 'tree-1', kind: 'tree', x: 4, y: 10, w: 1, h: 1 },
    { id: 'tree-2', kind: 'tree', x: 10, y: 8, w: 1, h: 1 },
    { id: 'tree-3', kind: 'tree', x: 18, y: 8, w: 1, h: 1 },
    { id: 'tree-4', kind: 'tree', x: 25, y: 14, w: 1, h: 1 },
    { id: 'rock-1', kind: 'rock', x: 11, y: 20, w: 2, h: 1 },
    { id: 'training', kind: 'dummy', x: 25, y: 20, w: 1, h: 1 }
  ];
  const buildings = [
    { id: 'hall', name: '别院主屋', kind: 'hall', x: 4, y: 3, w: 5, h: 3 },
    { id: 'house', name: '门人居', kind: 'house', x: 3, y: 19, w: 4, h: 3 },
    { id: 'clinic', name: '济生医庐', kind: 'clinic', x: 23, y: 4, w: 4, h: 3 },
    { id: 'workshop', name: '百工坊', kind: 'workshop', x: 9, y: 4, w: 3, h: 3 }
  ];
  const decorations = [{ id: 'rail-back', kind: 'rail', x: 13, y: 11, w: 3, h: 0 }, { id: 'rail-front', kind: 'rail', x: 13, y: 14, w: 3, h: 0 }];
  return { width, height, tiles, obstacles, buildings, decorations, revision: 0 };
}
function actor(id, name, seed, x, y) {
  return { id, name, seed, appearance: appearance(seed), x, y, radius: .26, facing: { x: 1, y: 0 }, goal: null, path: [], moving: false, phase: 0, wait: 0, actionTime: 0, dodgeTime: 0, hp: 100, qi: 100, moveRevision: -1, arrived: true };
}
export function createState() {
  const actors = [actor('master', '沈砚', 1, 7.5, 7.5), actor('lu', '陆知微', 590, 20.5, 9.5), actor('lin', '林长风', 918, 8.5, 10.5), actor('gu', '顾听澜', 1483, 22.5, 21.5), actor('ye', '叶松声', 2348, 9.5, 18.5), actor('su', '苏归岚', 2861, 25.5, 10.5)];
  return { map: createMap(), actors, party: ['lu', 'lin'], elapsed: 0, combat: false, strike: null, paused: false, stats: { orders: 0, replans: 0, blockedMoves: 0, dodges: 0, violations: 0, arrivals: 0, crowdWaits: 0, allyAttacks: 0 }, logs: ['山院已醒。点选道路行走，或从上方选择去处。'], nextId: 1, notice: '', targetMarker: null };
}
export const master = s => s.actors[0];
export function log(s, message) { s.logs.unshift(message); s.logs.length = Math.min(s.logs.length, 12); s.notice = message; }
export function setGoal(s, a, goal, extraBlocked) {
  const target = nearestWalkable(s.map, goal, a.radius);
  const path = target && findPath(s.map, a, target, { radius: a.radius, extraBlocked });
  a.goal = target; a.path = path || []; a.moveRevision = s.map.revision; a.wait = 0; a.arrived = !path?.length;
  return !!path;
}
export function command(s, type, value) {
  const m = master(s);
  if (type === 'walk') {
    const p = typeof value === 'string' ? POIS.find(p => p.id === value) : value;
    if (!p || !setGoal(s, m, p)) { log(s, '此处没有可达道路，请另选落脚处。'); return false; }
    s.stats.orders++; s.targetMarker = { ...m.goal }; log(s, `掌门沿可达道路前往${p.name || '选定地点'}。`); return true;
  }
  if (type === 'party') {
    s.party = value.filter(id => s.actors.some(a => a.id === id && id !== 'master')).slice(0, 2);
    for (const a of s.actors.slice(1)) { a.path = []; a.goal = null; }
    log(s, `同行者：${s.party.map(id => s.actors.find(a => a.id === id).name).join('、') || '独自行动'}。`); return true;
  }
  if (type === 'relocate') {
    const result = moveBuilding(s.map, 'workshop', value.x, value.y, s.actors, POIS);
    if (!result.ok) { log(s, result.reason); return false; }
    for (const a of s.actors) { if (a.goal && a.path.length) { setGoal(s, a, a.goal); s.stats.replans++; } else a.moveRevision = s.map.revision; }
    log(s, '百工坊已搬迁，行走中的人物已重新计算道路。'); return true;
  }
  if (type === 'recruit') {
    if (s.actors.length >= 10) { log(s, '这座验证山院最多容纳十人。'); return false; }
    const spot = [{ x: 6.5, y: 9.5 }, { x: 9.5, y: 9.5 }, { x: 5.5, y: 8.5 }, { x: 11.5, y: 9.5 }, { x: 6.5, y: 8.5 }, { x: 8.5, y: 8.5 }, { x: 7.5, y: 9.5 }].find(p => canStand(s.map, p) && s.actors.every(a => Math.hypot(a.x - p.x, a.y - p.y) > .6));
    if (!spot) return false;
    const id = `guest-${s.nextId++}`, seed = 3203 + s.nextId * 359;
    s.actors.push(actor(id, ['许望舒', '温南星', '陶静初', '徐闻溪'][(s.nextId - 2) % 4], seed, spot.x, spot.y));
    log(s, '新门人已到院，其外观在行走、面板和试炼中保持一致。'); return true;
  }
  if (type === 'trial') {
    s.combat = !s.combat; s.strike = null;
    if (s.combat) { command(s, 'walk', 'arena'); log(s, '试炼开启：在试炼场躲开预警，沿墙闪避不会穿墙。'); }
    else log(s, '试炼结束，恢复山院行走。');
    return true;
  }
  if (type === 'dodge') {
    if (m.qi < 15) { log(s, '灵力不足，稍作调息。'); return false; }
    const dir = value || m.facing, length = Math.hypot(dir.x, dir.y) || 1;
    const destination = { x: m.x + dir.x / length * 3.6, y: m.y + dir.y / length * 3.6 };
    const moved = sweep(s.map, m, destination, m.radius);
    // Sweeping includes terrain; also stop before colliding with another actor.
    const n = Math.max(1, Math.ceil(Math.hypot(moved.x - m.x, moved.y - m.y) / .08)); let end = { x: m.x, y: m.y };
    for (let i = 1; i <= n; i++) {
      const p = { x: m.x + (moved.x - m.x) * i / n, y: m.y + (moved.y - m.y) * i / n };
      if (s.actors.slice(1).some(a => Math.hypot(a.x - p.x, a.y - p.y) < a.radius + m.radius)) break; end = p;
    }
    m.x = end.x; m.y = end.y; m.path = []; m.goal = null; m.qi -= 15; m.actionTime = .45; m.dodgeTime = .45; s.stats.dodges++;
    if (moved.blocked) { s.stats.blockedMoves++; log(s, '闪避在障碍前停住，消耗灵力15。'); } else log(s, '闪避完成，消耗灵力15。');
    return true;
  }
  if (type === 'attack') { m.actionTime = .5; log(s, '掌门演练剑式；同行者自行选择时机出手。'); return true; }
  return false;
}
export function audit(s) {
  const failures = [];
  for (const a of s.actors) if (!canStand(s.map, a, a.radius)) failures.push(`${a.id}:static`);
  for (let i = 0; i < s.actors.length; i++) for (let j = i + 1; j < s.actors.length; j++) {
    const a = s.actors[i], b = s.actors[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius - .01) failures.push(`${a.id}:${b.id}:crowd`);
  }
  return failures;
}
export function step(s, dt) {
  if (s.paused) return; dt = Math.min(.05, Math.max(0, dt)); s.elapsed += dt;
  const m = master(s), occupied = blockedCells(s.map);
  for (let i = 0; i < s.actors.length; i++) {
    const a = s.actors[i]; a.moving = false; a.actionTime = Math.max(0, a.actionTime - dt); a.dodgeTime = Math.max(0, a.dodgeTime - dt); a.qi = Math.min(100, a.qi + dt * 4);
    if (s.combat && i > 0 && s.party.includes(a.id) && Math.hypot(a.x - 25.5, a.y - 20.5) < 6 && (s.elapsed + i * .55) % 2.2 < dt) { a.actionTime = .5; a.facing = { x: 25.5 - a.x, y: 20.5 - a.y }; s.stats.allyAttacks++; }
    if (a.goal && a.moveRevision !== s.map.revision) { setGoal(s, a, a.goal); s.stats.replans++; }
    // Give the directly controlled walker room before companions try to reform around them.
    // This prevents a party cluster repeatedly stepping into the master's next waypoint.
    let yielding = i > 0 && (a.yieldUntil || 0) > s.elapsed;
    if (i > 0 && m.path.length) {
      const n = m.path[0], vx = n.x - m.x, vy = n.y - m.y, length = Math.hypot(vx, vy);
      if (length > .001) {
        const ux = vx / length, uy = vy / length, dx = a.x - m.x, dy = a.y - m.y;
        const forward = dx * ux + dy * uy, lateral = dx * -uy + dy * ux;
        if (forward > -.15 && forward < 1.35 && Math.abs(lateral) < .68) {
          const sign = lateral < 0 ? -1 : 1;
          for (const side of [sign, -sign]) {
            const p = { x: a.x - uy * side * .85, y: a.y + ux * side * .85 };
            if (!sweep(s.map, a, p, a.radius, occupied).blocked && s.actors.every(b => b === a || Math.hypot(b.x - p.x, b.y - p.y) >= a.radius + b.radius + .05)) {
              a.path = [p]; a.goal = p; a.moveRevision = s.map.revision; a.yieldUntil = s.elapsed + .8; yielding = true; break;
            }
          }
        }
      }
    }
    if (!yielding && i > 0 && s.party.includes(a.id)) {
      const index = s.party.indexOf(a.id), distance = Math.hypot(m.x - a.x, m.y - a.y);
      if (distance > 1.8 && (!a.path.length || s.elapsed % 1 < dt)) {
        const alternatives = [{ x: m.x - 1 + index * 2, y: m.y + 1.1 }, { x: m.x, y: m.y + 1.8 }, { x: m.x - 1.8, y: m.y }];
        const p = alternatives.find(p => canStand(s.map, p, a.radius, occupied)); if (p) setGoal(s, a, p);
      }
    } else if (!yielding && i > 0 && !a.path.length && Math.floor(s.elapsed + i * 3) % 13 === 0 && s.elapsed % 1 < dt) {
      const p = POIS[(Math.floor(s.elapsed / 13) + i) % POIS.length]; setGoal(s, a, p);
    }
    if (!a.path.length) {
      // A resting resident yields to an approaching walker instead of occupying a doorway forever.
      const approaching = i > 0 && s.actors.find(b => b !== a && b.path.length && Math.hypot(b.x - a.x, b.y - a.y) < 1.1);
      if (approaching) {
        const dx = a.x - approaching.x, dy = a.y - approaching.y, length = Math.hypot(dx, dy) || 1;
        for (const turn of [Math.PI / 2, -Math.PI / 2, 0]) {
          const d = { x: (dx * Math.cos(turn) - dy * Math.sin(turn)) / length * dt * 2, y: (dx * Math.sin(turn) + dy * Math.cos(turn)) / length * dt * 2 };
          const p = { x: a.x + d.x, y: a.y + d.y };
          if (!sweep(s.map, a, p, a.radius, occupied).blocked && s.actors.every(b => b === a || Math.hypot(b.x - p.x, b.y - p.y) >= a.radius + b.radius + .025)) { a.x = p.x; a.y = p.y; a.moving = true; a.phase += .2; break; }
        }
      }
      continue;
    }
    const next = a.path[0], dx = next.x - a.x, dy = next.y - a.y, length = Math.hypot(dx, dy), amount = Math.min(length, dt * (i === 0 ? 2.5 : 2.7));
    const candidate = length > .001 ? { x: a.x + dx / length * amount, y: a.y + dy / length * amount } : { x: next.x, y: next.y };
    const moved = sweep(s.map, a, candidate, a.radius, occupied);
    if (moved.blocked) { a.path = []; a.wait += dt; s.stats.blockedMoves++; if (a.goal) setGoal(s, a, a.goal); continue; }
    const other = s.actors.find(b => b !== a && Math.hypot(b.x - moved.x, b.y - moved.y) < a.radius + b.radius + .025);
    if (other) {
      a.wait += dt;
      const base = Math.atan2(dy, dx), preference = i % 2 ? -1 : 1;
      for (const turn of [preference * .8, -preference * .8, preference * 1.5, -preference * 1.5, Math.PI]) {
        const p = { x: a.x + Math.cos(base + turn) * amount, y: a.y + Math.sin(base + turn) * amount };
        if (!sweep(s.map, a, p, a.radius, occupied).blocked && s.actors.every(b => b === a || Math.hypot(b.x - p.x, b.y - p.y) >= a.radius + b.radius + .025)) { a.x = p.x; a.y = p.y; a.moving = true; a.phase += amount * 5; break; }
      }
      if (a.wait > .4) {
        const extra = new Set(s.actors.filter(b => b !== a).map(b => `${Math.floor(b.x)},${Math.floor(b.y)}`));
        if (a.goal) { const path = findPath(s.map, a, a.goal, { extraBlocked: extra }); if (path?.length) a.path = path; }
        a.wait = 0; s.stats.crowdWaits++;
      }
      continue;
    }
    a.wait = 0; a.x = moved.x; a.y = moved.y; a.moving = amount > .001; a.phase += amount * 5;
    if (length > .001) a.facing = { x: dx / length, y: dy / length };
    if (length <= amount + .001) { a.path.shift(); if (!a.path.length && !a.arrived) { a.arrived = true; s.stats.arrivals++; if (i === 0) log(s, '已抵达。道路、台阶与障碍均按地图通行数据处理。'); } }
  }
  if (s.combat && Math.hypot(m.x - 22.5, m.y - 19) < 6) {
    if (!s.strike && s.elapsed % 4 < dt) s.strike = { x: m.x, y: m.y, remaining: 1.2, total: 1.2 };
    if (s.strike) { s.strike.remaining -= dt; if (s.strike.remaining <= 0) { if (Math.hypot(m.x - s.strike.x, m.y - s.strike.y) < 1.2 && m.dodgeTime <= 0) { m.hp = Math.max(0, m.hp - 8); log(s, '试炼落点命中，气血减少8。'); } s.strike = null; } }
  }
  const faults = audit(s); if (faults.length) { s.stats.violations++; s.paused = true; log(s, '地图出现通行异常，已暂停并保留现场。'); }
}
export function project(x, y, z = 0) { return { x: (x - y) * 26, y: (x + y) * 13 - z * 30 }; }
export function unproject(x, y, z = 0) { return { x: (x / 26 + (y + z * 30) / 13) / 2, y: ((y + z * 30) / 13 - x / 26) / 2 }; }
export function depthOrder(s) {
  return [...s.map.buildings.map(b => ({ type: 'building', item: b, depth: b.x + b.y + (b.w + b.h) / 2 })), ...[...s.map.obstacles, ...s.map.decorations].map(o => ({ type: o.kind, item: o, depth: o.x + o.y + (o.w + o.h) / 2 })), ...s.actors.map(a => ({ type: 'actor', item: a, depth: a.x + a.y }))].sort((a, b) => a.depth - b.depth || Number(a.type === 'actor') - Number(b.type === 'actor') || String(a.item.id).localeCompare(String(b.item.id)));
}
export { canStand, findPath, heightAt };
