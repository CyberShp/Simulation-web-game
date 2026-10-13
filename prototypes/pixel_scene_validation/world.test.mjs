import test from 'node:test';
import assert from 'node:assert/strict';
import { isWalkable, moveTowards, findPath, createCooldowns, tryCast } from './world.mjs';

test('courtyard and shared stair boundary are walkable; roofs, water and props are blocked', () => {
  for (const [x, y] of [[800, 700], [800, 410], [800, 320], [800, 928]]) assert.equal(isWalkable(x, y), true, `${x},${y}`);
  for (const [x, y] of [[800, 250], [1500, 600], [150, 700], [510, 665], [1210, 685], [NaN, 700]]) assert.equal(isWalkable(x, y), false, `${x},${y}`);
  assert.equal(findPath({ x: 800, y: 700 }, { x: 800, y: 250 }), null);
  assert.equal(findPath({ x: 800, y: 700 }, { x: 1500, y: 600 }), null);
});

test('a long movement step stops before the lantern and cannot cross water or the roof', () => {
  const actor = { x: 450, y: 665 };
  const result = moveTowards(actor, { x: 600, y: 665 }, 20);
  assert.equal(result.moved, true);
  assert.equal(result.blocked, true);
  assert.equal(result.reached, false);
  assert.ok(actor.x < 498);
  assert.equal(isWalkable(actor.x, actor.y), true);
  const climber = { x: 800, y: 700 };
  assert.equal(moveTowards(climber, { x: 800, y: 100 }, 20).blocked, true);
  assert.ok(climber.y >= 320);
  const shore = { x: 1360, y: 670 };
  assert.equal(moveTowards(shore, { x: 1650, y: 700 }, 20).blocked, true);
  assert.equal(isWalkable(shore.x, shore.y), true);
});

test('foreground stone bases and cliff edges reject feet while elevated silhouettes remain passable', () => {
  for (const [x, y] of [[585, 782], [1075, 790], [336, 730], [1305, 775], [1430, 705], [465, 785]]) {
    assert.equal(isWalkable(x, y), false, `${x},${y}`);
    assert.equal(findPath({ x: 825, y: 720 }, { x, y }), null);
  }
  for (const [x, y] of [[360, 690], [1305, 685], [580, 740], [1080, 745], [825, 800], [825, 920]]) assert.equal(isWalkable(x, y), true, `${x},${y}`);
  for (const target of [{ x: 585, y: 782 }, { x: 1075, y: 790 }, { x: 336, y: 730 }]) {
    const actor = { x: target.x, y: 600 };
    const result = moveTowards(actor, target, 10);
    assert.equal(result.blocked, true);
    assert.equal(result.reached, false);
    assert.equal(isWalkable(actor.x, actor.y), true);
  }
  const route = findPath({ x: 825, y: 920 }, { x: 800, y: 320 });
  assert.ok(route?.length);
  const actor = { x: 825, y: 920 };
  for (const target of route) assert.equal(moveTowards(actor, target, 20).reached, true);
});

test('A* routes around each prop and traverses the courtyard to the stairs', () => {
  for (const [start, target] of [
    [{ x: 450, y: 665 }, { x: 600, y: 665 }],
    [{ x: 1140, y: 685 }, { x: 1290, y: 685 }],
    [{ x: 680, y: 920 }, { x: 800, y: 320 }]
  ]) {
    const route = findPath(start, target);
    assert.ok(route?.length);
    assert.deepEqual(route.at(-1), target);
    const actor = { ...start };
    for (const waypoint of route) {
      const result = moveTowards(actor, waypoint, 100);
      assert.equal(result.blocked, false, JSON.stringify({ start, target, waypoint }));
      assert.equal(result.reached, true);
      assert.equal(isWalkable(actor.x, actor.y), true);
    }
    assert.ok(Math.hypot(actor.x - target.x, actor.y - target.y) < 1e-6);
  }
});

test('walking respects elapsed time and invalid movement leaves position intact', () => {
  const actor = { x: 800, y: 700 };
  assert.equal(moveTowards(actor, { x: 1000, y: 700 }, 0.5).moved, true);
  assert.ok(Math.abs(actor.x - 852.5) < 1e-7);
  const before = { ...actor };
  assert.equal(moveTowards(actor, { x: 1000, y: 700 }, -1).blocked, true);
  assert.deepEqual(actor, before);
  assert.equal(moveTowards(actor, actor, 0).reached, true);
});

test('skills reject cooldown repeats and backward time, then recover independently', () => {
  const cooldowns = createCooldowns();
  assert.deepEqual(tryCast(cooldowns, 'sword', 0), { ok: true, remaining: 0 });
  const repeat = tryCast(cooldowns, 'sword', 1);
  assert.equal(repeat.ok, false);
  assert.ok(Math.abs(repeat.remaining - 1.8) < 1e-7);
  assert.equal(cooldowns.readyAt.sword, 2.8);
  assert.equal(tryCast(cooldowns, 'fire', 1).ok, true);
  assert.equal(tryCast(cooldowns, 'ward', 1).ok, true);
  assert.equal(cooldowns.readyAt.fire, 6);
  assert.equal(cooldowns.readyAt.ward, 9);
  assert.equal(tryCast(cooldowns, 'sword', 2.8).ok, true);
  const readyAt = { ...cooldowns.readyAt };
  assert.equal(tryCast(cooldowns, 'fire', 2).ok, false);
  assert.deepEqual(cooldowns.readyAt, readyAt);
  assert.equal(tryCast(cooldowns, 'fire', 6).ok, true);
  assert.equal(tryCast(cooldowns, 'ward', 8.9).ok, false);
  assert.equal(tryCast(cooldowns, 'ward', 9).ok, true);
  assert.equal(tryCast(cooldowns, 'unknown', 10).ok, false);
});
