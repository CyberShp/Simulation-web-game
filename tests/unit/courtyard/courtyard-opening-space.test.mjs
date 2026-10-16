import test from 'node:test';
import assert from 'node:assert/strict';
import { isArtWalkable, routeArt, REVIEW_POINTS, ART_WIDTH } from '../../../apps/courtyard/courtyard-space.mjs';

test('opening ground uses its own terrain facts and keeps the current domain boundary', () => {
  const options = { terrain: false, domain: false }, ground = { x: 617.4, y: 757.4 };
  assert.equal(isArtWalkable(ground.x, ground.y), false);
  assert.equal(isArtWalkable(ground.x, ground.y, options), true);
  const route = routeArt(REVIEW_POINTS.courtyard.art, ground, options);
  assert.ok(route?.length);
  assert.deepEqual(route.at(-1), ground);
  for (const point of route) assert.ok(isArtWalkable(point.x, point.y, options));
  for (const point of [{ x: ART_WIDTH + 1, y: 500 }, { x: 420, y: 850 }, { x: 1100, y: 260 }]) {
    assert.equal(isArtWalkable(point.x, point.y, options), false);
    assert.equal(routeArt(REVIEW_POINTS.courtyard.art, point, options), null);
  }
  assert.equal(isArtWalkable(ground.x, ground.y), false, 'opening grid does not change the established courtyard');
});
