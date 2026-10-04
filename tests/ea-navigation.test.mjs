import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, findPath, heightAt, moveBuilding, nearestWalkable, sweep } from '../dist/ea-navigation.mjs';
import { appearance, audit, command, createMap, createState, depthOrder, master, POIS, project, step, unproject } from '../dist/terrain-lab/world.mjs';
const ticks = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) step(s, .05); };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const reach = (s, p, seconds = 30) => { command(s, 'walk', p); ticks(s, seconds); assert.ok(distance(master(s), typeof p === 'string' ? POIS.find(x => x.id === p) : p) < .02); assert.equal(s.stats.violations, 0); };

test('all five public destinations connect in both directions using valid swept segments', () => {
  const map = createMap();
  for (const from of POIS) for (const goal of POIS) {
    const path = findPath(map, from, goal, { snap: false }); assert.ok(path, `${from.id}->${goal.id}`);
    let p = from; for (const q of path) { assert.equal(sweep(map, p, q).blocked, false); p = q; }
  }
});
test('cross-river travel uses the stone bridge and cannot walk on the river', () => {
  const map = createMap(), path = findPath(map, { x: 7.5, y: 7.5 }, { x: 21.5, y: 10.5 });
  assert.ok(path.some(p => p.x > 13 && p.x < 16));
  for (const p of path.filter(p => p.x > 13 && p.x < 16)) assert.ok(p.y >= 11.26 && p.y <= 13.74);
  assert.equal(canStand(map, { x: 14.5, y: 9.5 }), false);
  assert.equal(sweep(map, { x: 12.5, y: 8.5 }, { x: 18.5, y: 8.5 }).blocked, true);
});
test('collision checks the entire character radius, not just its center', () => {
  const map = createMap(); assert.equal(canStand(map, { x: 4.8, y: 16.5 }, .26), false);
  assert.equal(canStand(map, { x: 4.7, y: 16.5 }, .26), true);
  assert.equal(canStand(map, { x: 12.8, y: 9.5 }, .26), false);
});
test('swept fast moves stop before walls and water even when the final tile is clear', () => {
  const map = createMap(), moved = sweep(map, { x: 7.5, y: 15.5 }, { x: 7.5, y: 19.5 });
  assert.ok(moved.blocked); assert.ok(moved.y < 15.75); assert.ok(canStand(map, moved));
  const river = sweep(map, { x: 12.5, y: 8.5 }, { x: 17.5, y: 8.5 }); assert.ok(river.blocked); assert.ok(river.x < 12.75);
});
test('eight-way navigation cannot cut diagonally through blocked corners', () => {
  const map = createMap(); map.obstacles.push({ id: 'corner1', x: 3, y: 8, w: 1, h: 1 }, { id: 'corner2', x: 2, y: 9, w: 1, h: 1 });
  const path = findPath(map, { x: 2.5, y: 8.5 }, { x: 3.5, y: 9.5 }); assert.ok(path.length > 1);
  assert.ok(sweep(map, { x: 2.5, y: 8.5 }, { x: 3.5, y: 9.5 }).blocked);
});
test('closed-off goals report no route instead of walking through a wall', () => {
  const map = createMap(); map.obstacles.push({ id: 'seal', x: 12, y: 11, w: 1, h: 3 });
  assert.equal(findPath(map, POIS[0], POIS[3]), null);
});
test('an obstacle click resolves to a safe nearby standing point', () => {
  const map = createMap(), p = nearestWalkable(map, { x: 5.5, y: 4.5 }); assert.ok(p); assert.ok(canStand(map, p));
  assert.equal(nearestWalkable(map, { x: 1000, y: 1000 }), null);
});
test('only connected stair heights are traversable, with reversible camera projection', () => {
  const map = createMap(); assert.ok(findPath(map, POIS[2], POIS[3]));
  const mismatch = createMap(); for (let y = 0; y < mismatch.height; y++) mismatch.tiles[y][17].height = 3;
  assert.equal(findPath(mismatch, POIS[2], POIS[3]), null);
  for (const z of [0, .4, .8]) for (const p of POIS) { const screen = project(p.x, p.y, z), restored = unproject(screen.x, screen.y, z); assert.ok(distance(p, restored) < 1e-9); }
});
test('moving an obstacle invalidates and replans the route during a journey', () => {
  const s = createState(); command(s, 'walk', 'garden'); ticks(s, .5);
  assert.equal(command(s, 'relocate', { x: 9, y: 11 }), true); assert.ok(s.stats.replans > 0);
  ticks(s, 30); assert.ok(distance(master(s), POIS[3]) < .02); assert.equal(s.stats.violations, 0);
});
test('illegal construction is atomic: water, stairs, actors and sealed bridge are rejected', () => {
  for (const target of [{ x: 13, y: 9 }, { x: 13, y: 11 }, { x: 17, y: 10 }, { x: 6, y: 7 }, { x: 12, y: 11 }]) {
    const s = createState(), before = JSON.stringify(s.map); const result = moveBuilding(s.map, 'workshop', target.x, target.y, s.actors, POIS);
    assert.equal(result.ok, false, JSON.stringify(target)); assert.equal(JSON.stringify(s.map), before);
  }
});
test('different parties reach all destinations without static or crowd overlaps', () => {
  const s = createState(); for (const party of [['lu', 'lin'], ['gu', 'su'], ['ye', 'lin']]) { command(s, 'party', party); for (const id of ['garden', 'arena', 'home']) reach(s, id); }
  assert.deepEqual(audit(s), []); assert.ok(s.stats.crowdWaits > 0);
});
test('crowd stress: ten residents, repeated crossings and randomized destinations remain valid', () => {
  const s = createState(); for (let i = 0; i < 4; i++) command(s, 'recruit');
  for (let cycle = 0; cycle < 10; cycle++) { command(s, 'party', [s.actors[1 + cycle % 9].id, s.actors[1 + (cycle + 3) % 9].id]); reach(s, ['garden', 'home', 'arena'][cycle % 3], 30); }
  assert.equal(s.actors.length, 10); assert.deepEqual(audit(s), []); assert.equal(s.stats.violations, 0);
});
test('rapid dodge and 360 direction sweeps never penetrate geometry', () => {
  const map = createMap(); for (const point of [POIS[0], POIS[2], { x: 7.5, y: 15.5 }, { x: 19.5, y: 17.5 }, POIS[3]]) for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180, result = sweep(map, point, { x: point.x + Math.cos(angle) * 5, y: point.y + Math.sin(angle) * 5 }); assert.ok(canStand(map, result));
  }
  const s = createState(); reach(s, { x: 7.5, y: 15.5 }); command(s, 'dodge', { x: 0, y: 1 }); assert.ok(master(s).y < 15.75); assert.deepEqual(audit(s), []);
});
test('character identities do not change across movement, trial or recruitment', () => {
  const s = createState(), before = Object.fromEntries(s.actors.map(a => [a.id, JSON.stringify(a.appearance)]));
  reach(s, 'arena'); command(s, 'trial'); ticks(s, 10); command(s, 'attack'); command(s, 'recruit');
  for (const a of s.actors.filter(a => before[a.id])) assert.equal(JSON.stringify(a.appearance), before[a.id]);
  assert.ok(s.stats.allyAttacks > 0); assert.equal(new Set(s.actors.map(a => JSON.stringify(a.appearance))).size, s.actors.length);
  for (const a of s.actors) assert.deepEqual(appearance(a.seed), a.appearance);
});
test('front/back drawing order changes correctly across tree, wall and bridge rail', () => {
  const s = createState(), a = master(s), order = () => depthOrder(s).map(e => e.item.id);
  a.x = 3.5; a.y = 9.5; assert.ok(order().indexOf('master') < order().indexOf('tree-1'));
  a.x = 5.5; a.y = 11.5; assert.ok(order().indexOf('master') > order().indexOf('tree-1'));
  a.x = 7.5; a.y = 15.5; assert.ok(order().indexOf('master') < order().indexOf('wall-a'));
  a.x = 7.5; a.y = 17.5; assert.ok(order().indexOf('master') > order().indexOf('wall-a'));
  a.x = 14.5; a.y = 12.5; const o = order(); assert.ok(o.indexOf('rail-back') < o.indexOf('master')); assert.ok(o.indexOf('master') < o.indexOf('rail-front'));
});
test('idle residents yield and opposite-direction travelers both clear the bridge', () => {
  const s = createState(); reach(s, 'garden'); reach(s, 'home');
  for (const a of s.actors) assert.ok(canStand(s.map, a, a.radius)); assert.equal(s.stats.violations, 0);
});


test('recruitment after courtyard construction only creates residents on clear ground', () => {
  const s = createState(); assert.ok(command(s, 'relocate', { x: 9, y: 9 }));
  for (let i = 0; i < 4; i++) assert.ok(command(s, 'recruit'));
  assert.equal(s.actors.length, 10); assert.deepEqual(audit(s), []); ticks(s, 15); assert.equal(s.stats.violations, 0);
});
test('attacking does not grant dodge immunity to a warning strike', () => {
  const s = createState(); reach(s, 'arena'); s.combat = true;
  const m = master(s); s.strike = { x: m.x, y: m.y, remaining: .02, total: 1.2 };
  command(s, 'attack'); step(s, .05); assert.equal(m.hp, 92);
  s.strike = { x: m.x, y: m.y, remaining: .02, total: 1.2 };
  command(s, 'dodge', { x: 0, y: -1 }); step(s, .05); assert.equal(m.hp, 92); assert.deepEqual(audit(s), []);
});

test('companions clear the next waypoint when the master leaves a tight cluster', () => {
  const s = createState(), m = master(s); m.x = 8.5; m.y = 8.5;
  const gu = s.actors.find(a => a.id === 'gu'), su = s.actors.find(a => a.id === 'su');
  gu.x = 9.05; gu.y = 9.05; su.x = 9.1; su.y = 8.1;
  command(s, 'party', ['gu', 'su']); assert.deepEqual(audit(s), []);
  assert.ok(command(s, 'relocate', { x: 9, y: 11 })); reach(s, 'garden', 30);
});

test('relocation after arrival does not create a new master journey or overwrite completion', () => {
  const s = createState(); reach(s, 'home', 2); assert.equal(master(s).path.length, 0);
  assert.ok(command(s, 'relocate', { x: 9, y: 11 })); s.notice = 'Completed'; ticks(s, 2);
  assert.equal(master(s).path.length, 0); assert.equal(s.notice, 'Completed');
});
