import test from 'node:test';
import assert from 'node:assert/strict';
import { observeActorDisplay } from './courtyard-renderer.mjs';
import { toArt } from './courtyard-space.mjs';

const person = (x, y, path, indoor = false) => ({ id: 'person:test', x, y, path, indoor });
const route = [{ x: 21, y: 20 }, { x: 21, y: 22 }, { x: 23, y: 22 }];
function cornerStep() {
  const initial = observeActorDisplay(null, person(20, 20, route), 0, false, 0);
  return observeActorDisplay(initial, person(21, 21, route.slice(1)), 10, false, 1000);
}

test('100 ms steps continue from the current displayed foot', () => {
  const path = [{ x: 23, y: 20 }];
  let value = observeActorDisplay(null, person(20, 20, path), 0, false, 0);
  value = observeActorDisplay(value, person(21, 20, path), 1, false, 100);
  assert.equal(value.durationMs, 100);
  value = observeActorDisplay(value, person(21, 20, path), 1, false, 150);
  assert.deepEqual(value.world, { x: 20.5, y: 20 });
  value = observeActorDisplay(value, person(22, 20, path), 2, false, 150);
  assert.deepEqual(value.world, { x: 20.5, y: 20 });
  value = observeActorDisplay(value, person(22, 20, path), 2, false, 250);
  assert.deepEqual(value.world, { x: 22, y: 20 });
});

test('a sparse formal step keeps consumed corners and never enters a future node', () => {
  const state = person(21, 21, route.slice(1));
  const untouched = JSON.stringify(state);
  let value = cornerStep();
  assert.equal(value.durationMs, 1000);
  value = observeActorDisplay(value, state, 15, false, 1500);
  assert.deepEqual(value.world, { x: 21, y: 20 });
  assert.deepEqual(value.art, toArt(21, 20));
  assert.deepEqual(value.motion.map(p => [p.x, p.y]), [[20, 20], [21, 20], [21, 21]]);
  value = observeActorDisplay(value, state, 19, false, 2500);
  assert.deepEqual(value.world, { x: 21, y: 21 });
  assert.equal(JSON.stringify(state), untouched);
});

test('new observed travel preserves the unfinished displayed corner', () => {
  let value = cornerStep();
  value = observeActorDisplay(value, person(22, 22, route.slice(2)), 20, false, 1500);
  assert.deepEqual(value.world, { x: 21, y: 20 });
  value = observeActorDisplay(value, person(22, 22, route.slice(2)), 25, false, 2000);
  assert.deepEqual(value.world, { x: 21, y: 21.5 });
});

test('pause, indoor changes, clock rewind and unverifiable paths use the exact actual foot', () => {
  const value = cornerStep();
  for (const [body, tick, paused, now] of [
    [person(21, 21, route.slice(1)), 15, true, 1500],
    [person(21, 21, route.slice(1), true), 15, false, 1500],
    [person(19, 19, []), 0, false, 1500],
    [person(22, 22, [{ x: 24, y: 24 }]), 20, false, 1500],
    [person(22, 22, route.slice(2)), 99, false, 9000],
  ]) {
    const result = observeActorDisplay(value, body, tick, paused, now);
    assert.deepEqual(result.world, { x: body.x, y: body.y });
    assert.equal(result.interpolating, false);
  }
});
