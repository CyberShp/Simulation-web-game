import test from 'node:test';
import assert from 'node:assert/strict';
import { transportLimit, transportQuantity, filterPeople, filterArts, sameBuilding } from './courtyard-panel-state.mjs';

test('single trip preserves seed stock and validates the explicit quantity', () => {
  assert.equal(transportLimit(52.857, 2), 40);
  assert.equal(transportLimit(2, 2), 0);
  assert.equal(transportLimit(2.5, 2), .5);
  assert.equal(transportQuantity(40, 52.857, 2), 40);
  assert.equal(transportQuantity(50.857, 52.857, 2), null);
  assert.equal(transportQuantity(1, 2.5, 2), null);
  assert.equal(transportQuantity('NaN', 12), null);
  assert.equal(transportQuantity('', 12), null);
});

test('roster filters retain public scope and overlap candidates at scale', () => {
  const people = Array.from({ length: 100 }, (_, i) => ({ id: `person:${i}`, name: `山院来客${i}`, resident: i < 16,
    wound: i % 10 === 0 ? 1 : 0, activityLabel: i % 2 ? '歇脚' : '前往 · 搬运', activityDetail: { phase: 'moving' } }));
  assert.equal(filterPeople(people, { scope: 'resident', activity: 'attention' }).length, 2);
  assert.deepEqual(filterPeople(people, { query: '来客1', ids: ['person:1', 'person:2'] }).map(p => p.id), ['person:1']);
  assert.equal(filterPeople(people, { query: '不存在' }).length, 0);
});

test('known art filters preserve unavailable records without adding discoveries', () => {
  const arts = Array.from({ length: 720 }, (_, i) => ({ id: `art:${i}`, name: `养气法${i}`, kind: i % 2 ? 'attack' : 'main', access: i < 30, understanding: i < 12 ? 5 : 0 }));
  assert.equal(filterArts(arts, { access: 'readable' }).length, 30);
  assert.equal(filterArts(arts, { access: 'learned', kind: 'main' }).length, 6);
  assert.equal(filterArts(arts, { access: 'unavailable' }).length, 690);
  assert.ok(sameBuilding('building:yunxiu:2', '2'));
  assert.ok(!sameBuilding(null, null));
});
