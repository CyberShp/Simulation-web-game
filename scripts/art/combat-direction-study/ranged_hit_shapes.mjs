// Native alpha row intervals share the sprite's exact root, scale and mirror.
export function enemyPoseInfo(enemy) {
  let frame = enemy.stage === 'warning' ? 1 : enemy.stage === 'attack' ? (enemy.time < 200 ? 1 : enemy.time < 300 ? 2 : 3) : enemy.stage === 'recover' ? 3 : 0;
  if (enemy.stage === 'chase') frame = Math.floor((enemy.time % 480) / 120);
  if (enemy.stage === 'hurt') frame = 4 + Math.min(1, Math.floor(enemy.time / (enemy.hurtDuration / 2)));
  if (enemy.stage === 'dead') frame = 4 + Math.min(3, Math.floor(enemy.time / 100));
  return { frame, poseSet: ['chase', 'hurt', 'dead'].includes(enemy.stage) ? 'supplement' : 'counter' };
}

function pointSegmentDistance2(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
  const t = n ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / n)) : 0;
  return (px - a.x - t * dx) ** 2 + (py - a.y - t * dy) ** 2;
}

function segmentRectDistance2(a, b, left, top, right, bottom) {
  let lo = 0, hi = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [origin, delta, min, max] of [[a.x, dx, left, right], [a.y, dy, top, bottom]]) {
    if (Math.abs(delta) < 1e-12) { if (origin < min || origin > max) { lo = 2; break; } }
    else { let p = (min - origin) / delta, q = (max - origin) / delta; if (p > q) [p, q] = [q, p]; lo = Math.max(lo, p); hi = Math.min(hi, q); }
  }
  if (lo <= hi && lo <= 1 && hi >= 0) return 0;
  const pointRect = p => Math.max(left - p.x, 0, p.x - right) ** 2 + Math.max(top - p.y, 0, p.y - bottom) ** 2;
  return Math.min(pointRect(a), pointRect(b), pointSegmentDistance2(left, top, a, b), pointSegmentDistance2(right, top, a, b), pointSegmentDistance2(left, bottom, a, b), pointSegmentDistance2(right, bottom, a, b));
}

export function alphaCapsuleHit(before, after, vector, enemy, sprite, shape, mirror, coreLength = 28, coreWidth = 4) {
  if (!shape) return false;
  const radius = coreWidth / 2, half = coreLength / 2 - radius;
  const local = p => ({ x: sprite.root[0] + (p.x - enemy.x) / (mirror ? -sprite.scale : sprite.scale), y: sprite.root[1] + (p.y - enemy.y) / sprite.scale });
  const a = local({ x: before.x - vector.x * half, y: before.y - vector.y * half });
  const b = local({ x: after.x + vector.x * half, y: after.y + vector.y * half });
  const r = radius / sprite.scale, minY = Math.min(a.y, b.y) - r, maxY = Math.max(a.y, b.y) + r;
  const minX = Math.min(a.x, b.x) - r, maxX = Math.max(a.x, b.x) + r;
  for (const row of shape.rows) {
    const y = row[0]; if (y + 1 < minY) continue; if (y > maxY) break;
    for (let i = 1; i < row.length; i += 2) {
      const left = row[i], right = row[i + 1]; if (right < minX || left > maxX) continue;
      if (segmentRectDistance2(a, b, left, y, right, y + 1) <= r * r + 1e-9) return true;
    }
  }
  return false;
}
