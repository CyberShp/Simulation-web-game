export const WORLD = Object.freeze({ width: 1672, height: 941 });
export const WALKABLE = [
  [[295, 410], [1305, 410], [1412, 610], [1418, 670], [1348, 720], [1232, 758], [1142, 768], [1035, 768], [1010, 825], [1010, 928], [650, 928], [650, 825], [674, 768], [634, 762], [530, 755], [435, 735], [365, 710], [300, 681], [230, 630], [220, 615]],
  [[729, 320], [935, 320], [973, 410], [690, 410]]
];
export const OBSTACLES = [
  { id: 'lantern', x: 510, y: 665, rx: 12, ry: 7 },
  { id: 'pine', x: 1210, y: 685, rx: 23, ry: 12 }
];
// Ground footprints sit below the flags and lanterns' elevated silhouettes.
export const FOOTPRINTS = [
  { id: 'left-flag-garden', polygon: [[307, 733], [330, 720], [375, 719], [411, 754], [411, 941], [307, 941]] },
  { id: 'right-flag-garden', polygon: [[1260, 746], [1278, 728], [1302, 730], [1334, 705], [1350, 675], [1350, 941], [1260, 941]] },
  { id: 'left-front-lantern', polygon: [[550, 775], [571, 762], [601, 766], [615, 791], [635, 801], [635, 850], [550, 850]] },
  { id: 'right-front-lantern', polygon: [[1035, 786], [1050, 767], [1105, 768], [1116, 791], [1134, 800], [1134, 850], [1035, 850]] }
];

const EPSILON = 1e-7;
const GRID = 12;
const COOLDOWN_SECONDS = { sword: 2.8, fire: 5, ward: 8 };
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);

function contains(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) <= EPSILON && x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON && y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function isWalkable(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  if (!WALKABLE.some(polygon => contains(polygon, x, y))) return false;
  if (FOOTPRINTS.some(footprint => contains(footprint.polygon, x, y))) return false;
  return !OBSTACLES.some(obstacle => ((x - obstacle.x) / obstacle.rx) ** 2 + ((y - obstacle.y) / obstacle.ry) ** 2 <= 1 + EPSILON);
}

function segmentWalkable(a, b) {
  if (!isWalkable(a.x, a.y) || !isWalkable(b.x, b.y)) return false;
  for (const obstacle of OBSTACLES) {
    const x = (a.x - obstacle.x) / obstacle.rx;
    const y = (a.y - obstacle.y) / obstacle.ry;
    const dx = (b.x - a.x) / obstacle.rx;
    const dy = (b.y - a.y) / obstacle.ry;
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1, -(x * dx + y * dy) / denominator)) : 0;
    if ((x + t * dx) ** 2 + (y + t * dy) ** 2 <= 1 + EPSILON) return false;
  }
  const steps = Math.max(1, Math.ceil(distance(a, b) / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isWalkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

export { segmentWalkable as clearLine };

export function moveTowards(actor, target, dt, speed = 105) {
  const result = { moved: false, blocked: false, reached: false };
  if (!point(actor) || !point(target) || !Number.isFinite(dt) || !Number.isFinite(speed) || dt < 0 || speed < 0 || !isWalkable(actor.x, actor.y)) return { ...result, blocked: true };
  if (distance(actor, target) < EPSILON) return { ...result, reached: true };
  let budget = Math.min(dt * speed, distance(actor, target));
  while (budget > EPSILON) {
    const remaining = distance(actor, target);
    if (remaining < EPSILON) break;
    const step = Math.min(8, budget, remaining);
    const next = { x: actor.x + (target.x - actor.x) / remaining * step, y: actor.y + (target.y - actor.y) / remaining * step };
    if (segmentWalkable(actor, next)) {
      actor.x = next.x;
      actor.y = next.y;
      result.moved = true;
    } else {
      result.blocked = true;
      const horizontal = { x: next.x, y: actor.y };
      const vertical = { x: actor.x, y: next.y };
      const candidates = Math.abs(next.x - actor.x) >= Math.abs(next.y - actor.y) ? [horizontal, vertical] : [vertical, horizontal];
      const slide = candidates.find(candidate => distance(actor, candidate) > EPSILON && segmentWalkable(actor, candidate));
      if (!slide) break;
      actor.x = slide.x;
      actor.y = slide.y;
      result.moved = true;
    }
    budget -= step;
  }
  result.reached = distance(actor, target) < EPSILON;
  return result;
}

let grid;
function navigationGrid() {
  if (grid) return grid;
  grid = new Map();
  for (let y = 0; y <= WORLD.height; y += GRID) {
    for (let x = 0; x <= WORLD.width; x += GRID) {
      if (isWalkable(x, y)) grid.set(`${x},${y}`, { x, y });
    }
  }
  return grid;
}

function nearbyNodes(position, nodes) {
  const cx = Math.round(position.x / GRID) * GRID;
  const cy = Math.round(position.y / GRID) * GRID;
  const candidates = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const key = `${cx + dx * GRID},${cy + dy * GRID}`;
      const node = nodes.get(key);
      if (node && segmentWalkable(position, node)) candidates.push({ key, node, cost: distance(position, node) });
    }
  }
  return candidates;
}

export function findPath(start, target) {
  if (!point(start) || !point(target) || !isWalkable(start.x, start.y) || !isWalkable(target.x, target.y)) return null;
  if (distance(start, target) < EPSILON) return [];
  if (segmentWalkable(start, target)) return [{ x: target.x, y: target.y }];
  const nodes = navigationGrid();
  const goals = new Map(nearbyNodes(target, nodes).map(candidate => [candidate.key, candidate.cost]));
  const open = new Set();
  const scores = new Map();
  const previous = new Map();
  for (const candidate of nearbyNodes(start, nodes)) {
    open.add(candidate.key);
    scores.set(candidate.key, candidate.cost);
    previous.set(candidate.key, null);
  }
  if (!open.size || !goals.size) return null;
  while (open.size) {
    let currentKey;
    let best = Infinity;
    for (const key of open) {
      const estimate = scores.get(key) + distance(nodes.get(key), target);
      if (estimate < best) {
        best = estimate;
        currentKey = key;
      }
    }
    open.delete(currentKey);
    const current = nodes.get(currentKey);
    if (goals.has(currentKey)) {
      const reversed = [{ x: target.x, y: target.y }];
      for (let key = currentKey; key !== null; key = previous.get(key)) reversed.push(nodes.get(key));
      const route = reversed.reverse();
      const simplified = [];
      let anchor = start;
      for (let i = 0; i < route.length;) {
        let next = route.length - 1;
        while (next > i && !segmentWalkable(anchor, route[next])) next--;
        simplified.push({ ...route[next] });
        anchor = route[next];
        i = next + 1;
      }
      return simplified;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const key = `${current.x + dx * GRID},${current.y + dy * GRID}`;
        const neighbor = nodes.get(key);
        if (!neighbor || !segmentWalkable(current, neighbor)) continue;
        const score = scores.get(currentKey) + distance(current, neighbor);
        if (score + EPSILON >= (scores.get(key) ?? Infinity)) continue;
        scores.set(key, score);
        previous.set(key, currentKey);
        open.add(key);
      }
    }
  }
  return null;
}

export function createCooldowns() {
  return { readyAt: { sword: 0, fire: 0, ward: 0 }, lastTime: 0 };
}

export function tryCast(cooldowns, type, time) {
  if (!Object.hasOwn(COOLDOWN_SECONDS, type) || !Number.isFinite(time) || time < 0) return { ok: false, remaining: 0 };
  if (time < cooldowns.lastTime) return { ok: false, remaining: Math.max(0, cooldowns.readyAt[type] - cooldowns.lastTime) };
  cooldowns.lastTime = time;
  const remaining = Math.max(0, cooldowns.readyAt[type] - time);
  if (remaining > EPSILON) return { ok: false, remaining };
  cooldowns.readyAt[type] = time + COOLDOWN_SECONDS[type];
  return { ok: true, remaining: 0 };
}
