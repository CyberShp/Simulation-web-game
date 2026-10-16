// World-space navigation. Art, camera transforms and actor appearance never define collision.
const key = (x, y) => `${x},${y}`;
export const tileAt = (map, x, y) => map.tiles[Math.floor(y)]?.[Math.floor(x)];
export const heightAt = (map, x, y) => tileAt(map, x, y)?.height || 0;
export function blockedCells(map) {
  const result = new Set();
  for (const o of [...map.obstacles, ...map.buildings])
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) result.add(key(x, y));
  return result;
}
export function canStand(map, p, radius = .26, occupied = blockedCells(map)) {
  if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y) || p.x - radius < 0 || p.y - radius < 0 || p.x + radius > map.width || p.y + radius > map.height) return false;
  for (let y = Math.floor(p.y - radius); y <= Math.floor(p.y + radius); y++) {
    for (let x = Math.floor(p.x - radius); x <= Math.floor(p.x + radius); x++) {
      const dx = Math.max(x - p.x, 0, p.x - x - 1), dy = Math.max(y - p.y, 0, p.y - y - 1);
      if (dx * dx + dy * dy < radius * radius - 1e-9 && (!tileAt(map, x, y)?.walkable || occupied.has(key(x, y)))) return false;
    }
  }
  return true;
}
export function sweep(map, from, to, radius = .26, occupied = blockedCells(map)) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y), n = Math.max(1, Math.ceil(distance / .08));
  let last = { x: from.x, y: from.y };
  if (!canStand(map, last, radius, occupied)) return { ...last, blocked: true };
  for (let i = 1; i <= n; i++) {
    const p = { x: from.x + (to.x - from.x) * i / n, y: from.y + (to.y - from.y) * i / n };
    if (!canStand(map, p, radius, occupied) || Math.abs(heightAt(map, p.x, p.y) - heightAt(map, last.x, last.y)) > .46) return { ...last, blocked: true };
    last = p;
  }
  return { ...last, blocked: false };
}
export function nearestWalkable(map, target, radius = .26, occupied = blockedCells(map), maxDistance = 4) {
  if (canStand(map, target, radius, occupied)) return { ...target };
  let best = null, bestD = Infinity;
  for (let y = Math.max(0, Math.floor(target.y - maxDistance)); y < Math.min(map.height, target.y + maxDistance + 1); y++) {
    for (let x = Math.max(0, Math.floor(target.x - maxDistance)); x < Math.min(map.width, target.x + maxDistance + 1); x++) {
      const p = { x: x + .5, y: y + .5 }, d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d <= maxDistance && d < bestD && canStand(map, p, radius, occupied)) { best = p; bestD = d; }
    }
  }
  return best;
}
export function findPath(map, start, goal, { radius = .26, extraBlocked = new Set(), snap = true } = {}) {
  const occupied = blockedCells(map), target = snap ? nearestWalkable(map, goal, radius, occupied) : goal;
  if (!target || !canStand(map, start, radius, occupied) || !canStand(map, target, radius, occupied)) return null;
  const sx = Math.floor(start.x), sy = Math.floor(start.y), gx = Math.floor(target.x), gy = Math.floor(target.y);
  const sk = key(sx, sy), gk = key(gx, gy), open = [{ x: sx, y: sy, g: 0, f: 0 }], costs = new Map([[sk, 0]]), parents = new Map(), done = new Set();
  while (open.length) {
    open.sort((a, b) => a.f - b.f || a.g - b.g); const c = open.shift(), ck = key(c.x, c.y);
    if (done.has(ck)) continue; done.add(ck);
    if (ck === gk) {
      const points = []; let k = gk;
      while (k !== sk) { const [x, y] = k.split(',').map(Number); points.unshift({ x: x + .5, y: y + .5 }); k = parents.get(k); }
      // The actor can be between tile centers when the destination changes.
      const origin = { x: sx + .5, y: sy + .5 };
      if (points.length && sweep(map, start, points[0], radius, occupied).blocked) points.unshift(origin);
      if (!points.length || Math.hypot(points.at(-1).x - target.x, points.at(-1).y - target.y) > .01) points.push(target);
      let p = start;
      for (const next of points) { if (sweep(map, p, next, radius, occupied).blocked) return null; p = next; }
      return points;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, nk = key(nx, ny), a = { x: c.x + .5, y: c.y + .5 }, b = { x: nx + .5, y: ny + .5 };
      if (extraBlocked.has(nk) && nk !== gk || !canStand(map, b, radius, occupied) || sweep(map, a, b, radius, occupied).blocked) continue;
      const cost = c.g + Math.hypot(dx, dy) + (tileAt(map, nx, ny).kind === 'road' ? 0 : .15);
      if (cost >= (costs.get(nk) ?? Infinity)) continue;
      costs.set(nk, cost); parents.set(nk, ck); open.push({ x: nx, y: ny, g: cost, f: cost + Math.hypot(gx - nx, gy - ny) });
    }
  }
  return null;
}
export function moveBuilding(map, id, x, y, actors = [], essential = []) {
  const index = map.buildings.findIndex(b => b.id === id), old = map.buildings[index];
  if (!old || !Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, reason: '位置无效' };
  const candidate = { ...old, x, y }, next = { ...map, buildings: map.buildings.map((b, i) => i === index ? candidate : b) };
  const occupied = blockedCells({ ...map, buildings: map.buildings.filter((_, i) => i !== index) });
  for (let yy = y; yy < y + old.h; yy++) for (let xx = x; xx < x + old.w; xx++) {
    const t = tileAt(map, xx, yy);
    if (!t?.walkable || ['bridge', 'stairs'].includes(t.kind) || occupied.has(key(xx, yy)) || t.height !== tileAt(map, x, y)?.height) return { ok: false, reason: '此处无法营造：水面、台阶、斜坡或已有障碍' };
  }
  if (actors.some(a => !canStand(next, a, a.radius))) return { ok: false, reason: '此处有人，请等门人走开' };
  if (essential.some(p => !findPath(next, essential[0], p, { snap: false }))) return { ok: false, reason: '不能封死石桥、试炼场或归院道路' };
  map.buildings[index] = candidate; map.revision++; return { ok: true };
}
