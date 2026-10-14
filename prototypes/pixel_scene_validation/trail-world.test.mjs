import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from './world.mjs';
import { TRAIL_WORLD, TRAIL_LANDMARKS, trailNavigation as navigation } from './trail-world.mjs';

test('courtyard, stone bridge and both sides of the forest connect to the valley on real ground', () => {
  assert.deepEqual(TRAIL_WORLD, { width: 1672, height: 2823 });
  for (const point of Object.values(TRAIL_LANDMARKS)) assert.equal(navigation.isWalkable(point.x, point.y), true);
  for (let y = 920; y <= 960; y++) assert.equal(navigation.isWalkable(820, y), true, `gate seam ${y}`);
  const home = TRAIL_LANDMARKS.home, valley = TRAIL_LANDMARKS.valley;
  for (const [start, target] of [[home, valley], [valley, home], [TRAIL_LANDMARKS.forest, { x: 1230, y: 1850 }]]) {
    const actor = { ...start }, path = navigation.findPath(start, target);
    assert.ok(path?.length);
    for (const waypoint of path) {
      assert.equal(navigation.clearTraversal(actor, waypoint), true);
      for (let tick = 0; tick < 500 && Math.hypot(actor.x - waypoint.x, actor.y - waypoint.y) > .001; tick++) {
        navigation.moveTowards(actor, waypoint, .1, 110);
        assert.equal(navigation.isWalkable(actor.x, actor.y), true);
      }
      assert.ok(Math.hypot(actor.x - waypoint.x, actor.y - waypoint.y) < .001);
    }
    assert.ok(Math.hypot(actor.x - target.x, actor.y - target.y) < .001);
  }
});

test('water, stone island and outer cliffs reject movement and long steps stop at their boundaries', () => {
  for (const target of [{ x: 500, y: 1400 }, { x: 850, y: 1840 }, { x: 80, y: 2400 }, { x: 820, y: 2824 }]) {
    assert.equal(navigation.isWalkable(target.x, target.y), false);
    assert.equal(navigation.findPath(TRAIL_LANDMARKS.home, target), null);
  }
  const actor = { ...TRAIL_LANDMARKS.crossing };
  const result = navigation.moveTowards(actor, { x: 400, y: actor.y }, 20, 110);
  assert.equal(result.blocked, true);
  assert.equal(navigation.isWalkable(actor.x, actor.y), true);
  assert.ok(actor.x > 680);
  assert.equal(navigation.clearLine({ x: 570, y: 1860 }, { x: 1210, y: 1860 }), false);
});

test('ground gaps stop traversal while ranged sight crosses open water and stops at physical cover', () => {
  const banks = [[[0, 0], [40, 0], [40, 100], [0, 100]], [[60, 0], [100, 0], [100, 100], [60, 100]]];
  const options = { bounds: { width: 100, height: 100 }, walkable: banks, footprints: [], obstacles: [], sightBlockers: [], cellSize: 12, useHeap: true };
  const water = createNavigation(options), a = { x: 20, y: 50 }, b = { x: 80, y: 50 };
  assert.equal(water.isWalkable(a.x, a.y), true);
  assert.equal(water.isWalkable(b.x, b.y), true);
  assert.equal(water.clearTraversal(a, b), false);
  assert.equal(water.findPath(a, b), null);
  assert.equal(water.clearLine(a, b), true);
  const cover = createNavigation({ ...options, sightBlockers: [{ id: 'rock', polygon: [[48, 40], [52, 40], [52, 60], [48, 60]] }] });
  assert.equal(cover.clearLine(a, b), false);
  assert.equal(cover.clearLine({ x: 20, y: 40 }, { x: 80, y: 40 }), false);
  assert.equal(cover.clearLine({ x: 20, y: 20 }, { x: 80, y: 20 }), true);
});
