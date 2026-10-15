import test from 'node:test';
import assert from 'node:assert/strict';
import { observeActorDisplay, CourtyardRenderer } from './courtyard-renderer.mjs';
import { toArt } from './courtyard-space.mjs';
import { createSectSession, viewSect, snapshotSect } from './sect-sim.mjs';

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

const rendererFixture = () => new CourtyardRenderer({ getContext: () => ({}), getBoundingClientRect: () => ({ width: 1672, height: 941 }) });

test('overlapping public identities all remain selectable in front-to-back order', () => {
  const session = createSectSession(), before = snapshotSect(session), people = viewSect(session).people;
  const renderer = rendererFixture();
  // Exercise projected overlap without moving or cloning simulation bodies.
  renderer.hitRegions = people.map(person => ({ person, p: { x: 700, y: 600 }, x: 680, y: 520, w: 40, h: 80 }));
  assert.deepEqual(renderer.pickPeople(700, 560).map(person => person.id), [...people].reverse().map(person => person.id));
  assert.equal(renderer.pickPerson(700, 560).id, people.at(-1).id);
  assert.deepEqual(snapshotSect(session), before);
});

test('minimum hit region is 44 CSS pixels while indoor and occluded bodies remain unpickable', () => {
  const renderer = rendererFixture(), source = viewSect(createSectSession()).people;
  renderer.fit = .5;
  renderer.hitRegions = [{ person: source[0], p: { x: 700, y: 600 }, x: 695, y: 590, w: 10, h: 10 }];
  const edge = renderer.artToScreen({ x: 740, y: 595 });
  assert.equal(renderer.pickPeople(edge.x, edge.y)[0].id, source[0].id);
  const outside = renderer.artToScreen({ x: 745, y: 595 });
  assert.equal(renderer.pickPeople(outside.x, outside.y).length, 0);
  renderer.fit = 1;
  renderer.hitRegions = [
    { person: { ...source[0], indoor: true }, p: { x: 700, y: 600 }, x: 680, y: 520, w: 40, h: 80 },
    { person: source[1], p: { x: 650, y: 300 }, x: 620, y: 180, w: 60, h: 100 },
  ];
  assert.deepEqual(renderer.pickPeople(700, 560), []);
  assert.deepEqual(renderer.pickPeople(650, 230), []);
  renderer.reference = true;
  assert.deepEqual(renderer.pickPeople(700, 560), []);
});

test('location focus changes only the camera and rejects unavailable positions', () => {
  const renderer = rendererFixture(), session = createSectSession(), before = snapshotSect(session);
  renderer.mode = 'planning'; renderer.reference = true;
  assert.equal(renderer.focusLocation({ kind: 'indoor', focus: { x: 28, y: 12.6 } }), true);
  assert.equal(renderer.mode, 'local');
  assert.equal(renderer.reference, false);
  assert.equal(renderer.followId, null);
  assert.equal(renderer.camera.zoom, 1.35);
  assert.equal(renderer.focusLocation({ focus: { x: null, y: null } }), false);
  assert.deepEqual(snapshotSect(session), before);
});
