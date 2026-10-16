import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLine, isWalkable } from '../../../archive/prototypes/pixel_scene_validation/world.mjs';
import { TICK_SECONDS, SKILLS, createBattle, command, advanceBattle, snapshot, validateBattle, serializeBattle, restoreBattle, battleWorld } from '../../../archive/prototypes/pixel_scene_validation/arena-sim.mjs';
import { TRAIL_LANDMARKS, TRAIL_ARRIVAL, isTrailArrival } from '../../../archive/prototypes/pixel_scene_validation/trail-world.mjs';

const master = state => state.actors.find(actor => actor.id === 'master');
const red = state => state.actors.find(actor => actor.id === 'red-1');
function duel({ targetX = 860, targetY = 600, ai = false } = {}) {
  const state = createBattle({ mode: 'duel' });
  Object.assign(master(state), { x: 800, y: 600 });
  Object.assign(red(state), { x: targetX, y: targetY, aiNextTick: ai ? 0 : 1000000 });
  assert.equal(command(state, { type: 'start' }).ok, true);
  return state;
}
const cast = (state, skill, targetId = 'red-1') => command(state, { type: 'cast', skill, targetId });

function driveTrail(state) {
  const actor = master(state);
  if (state.status !== 'active' || state.paused || actor.action) return;
  if (state.trail.phase !== 'combat') {
    if (!actor.path.length) command(state, { type: 'move', target: state.trail.phase === 'return' ? TRAIL_LANDMARKS.home : TRAIL_LANDMARKS.valley });
    return;
  }
  if (state.tick % 5) return;
  const target = state.actors.filter(other => other.team === 'red' && other.hp > 0)
    .sort((a, b) => Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y))[0];
  if (!target) return;
  if (actor.shield <= 0 && cast(state, 'ward').ok) return;
  const range = Math.hypot(target.x - actor.x, target.y - actor.y);
  if (range <= 320 && cast(state, 'fire', target.id).ok) return;
  if (range <= 260 && cast(state, 'sword', target.id).ok) return;
  command(state, { type: 'attack', targetId: target.id });
}

test('battle starts from valid fixed identities and only master accepts direct orders', () => {
  assert.equal(TICK_SECONDS, .1);
  for (const mode of ['team', 'duel']) {
    const state = createBattle({ mode, seed: 29 });
    assert.equal(validateBattle(state), true);
    assert.deepEqual(state, createBattle({ mode, seed: 29 }));
    const held = snapshot(state);
    advanceBattle(state, 100);
    assert.deepEqual(state, held);
    assert.equal(command(state, { type: 'start' }).ok, true);
    const active = snapshot(state);
    assert.equal(command(state, { type: 'move', actorId: 'red-1', x: 900, y: 600 }).ok, false);
    assert.deepEqual(state, active);
  }
});

test('public attack pursues a distant opponent, then applies real melee damage', () => {
  const state = duel({ targetX: 990 });
  assert.equal(command(state, { type: 'attack', targetId: 'red-1' }).ok, true);
  const origin = master(state).x;
  for (let n = 0; n < 40 && !state.events.some(event => event.kind === 'hit'); n++) advanceBattle(state);
  assert.ok(master(state).x > origin);
  assert.ok(master(state).distance > 100);
  assert.equal(red(state).hp, 82);
  const hit = state.events.find(event => event.kind === 'hit');
  assert.equal(hit.skill, 'attack');
  assert.equal(hit.amount, 18);
  assert.deepEqual(hit.to, { x: red(state).x, y: red(state).y });
  assert.equal(validateBattle(state), true);
});

test('busy, cooldown, low qi, range and blocked commands preserve existing payment and actions', () => {
  const state = duel({ targetX: 1050 });
  assert.equal(cast(state, 'sword').ok, true);
  assert.equal(master(state).qi, 91);
  assert.equal(master(state).cooldowns.sword, SKILLS.sword.cooldown);
  let before = snapshot(state);
  assert.equal(cast(state, 'fire').ok, false);
  assert.deepEqual(state, before);
  advanceBattle(state, 11);
  before = snapshot(state);
  assert.equal(cast(state, 'sword').ok, false);
  assert.deepEqual(state, before);
  master(state).qi = 0;
  before = snapshot(state);
  assert.equal(cast(state, 'fire').ok, false);
  assert.deepEqual(state, before);

  const far = duel({ targetX: 1200 });
  before = snapshot(far);
  assert.equal(cast(far, 'sword').ok, false);
  assert.deepEqual(far, before);
  const blocked = duel();
  Object.assign(master(blocked), { x: 450, y: 665 });
  Object.assign(red(blocked), { x: 560, y: 665 });
  assert.equal(clearLine(master(blocked), red(blocked)), false);
  before = snapshot(blocked);
  assert.equal(cast(blocked, 'sword').ok, false);
  assert.deepEqual(blocked, before);
});

test('movement cancels an unreleased cast with its qi and cooldown retained', () => {
  const state = duel({ targetX: 1000 });
  assert.equal(cast(state, 'sword').ok, true);
  const qi = master(state).qi;
  const cooldown = master(state).cooldowns.sword;
  assert.equal(command(state, { type: 'move', target: { x: 830, y: 650 } }).ok, true);
  assert.equal(master(state).action, null);
  assert.equal(master(state).qi, qi);
  assert.equal(master(state).cooldowns.sword, cooldown);
  advanceBattle(state, 15);
  assert.equal(state.events.some(event => event.kind === 'release'), false);
  assert.equal(red(state).hp, 100);
  assert.equal(master(state).autoAttack, false);
  assert.ok(master(state).distance > 0);
});

test('a released sword misses an opponent who moves away from its locked landing point', () => {
  const state = duel({ targetX: 1000 });
  red(state).moveInput = { x: 0, y: 1 };
  assert.equal(cast(state, 'sword').ok, true);
  advanceBattle(state, 8);
  assert.ok(red(state).y >= 650);
  assert.equal(red(state).hp, 100);
  assert.equal(state.events.filter(event => event.kind === 'release').length, 1);
  assert.equal(state.events.filter(event => event.kind === 'miss').length, 1);
  assert.equal(state.events.some(event => event.kind === 'hit'), false);
});

test('releasing direction keys preserves a queued plan, an active spell and click-to-move paths', () => {
  const paused = duel({ targetX: 1000 });
  command(paused, { type: 'pause', value: true });
  cast(paused, 'sword');
  const plan = snapshot(paused).plannedCommand;
  assert.equal(command(paused, { type: 'moveVector', x: 0, y: 0 }).ok, true);
  assert.deepEqual(paused.plannedCommand, plan);
  for (const checkpoint of [1, 4]) {
    const state = duel({ targetX: 1000 });
    cast(state, 'sword');
    advanceBattle(state, checkpoint);
    const action = snapshot(state).actors.find(actor => actor.id === 'master').action;
    assert.equal(command(state, { type: 'moveVector', vector: { x: 0, y: 0 } }).ok, true);
    assert.deepEqual(master(state).action, action);
  }
  const walking = duel();
  command(walking, { type: 'move', x: 830, y: 700 });
  const path = snapshot(walking).actors.find(actor => actor.id === 'master').path;
  command(walking, { type: 'moveVector', x: 0, y: 0 });
  assert.deepEqual(master(walking).path, path);
  command(walking, { type: 'attack', targetId: 'red-1' });
  command(walking, { type: 'moveVector', x: 0, y: 0 });
  assert.equal(master(walking).autoAttack, true);
});

test('line of sight is checked again at impact, after a target enters cover', () => {
  const state = duel();
  Object.assign(master(state), { x: 490, y: 645 });
  Object.assign(red(state), { x: 530, y: 645 });
  assert.equal(cast(state, 'sword').ok, true);
  advanceBattle(state, 3);
  Object.assign(red(state), { x: 535, y: 669 });
  assert.equal(isWalkable(red(state).x, red(state).y), true);
  assert.equal(clearLine(master(state), red(state)), false);
  advanceBattle(state, 5);
  assert.equal(red(state).hp, 100);
  assert.equal(state.events.at(-1).kind, 'miss');
});

test('fire resolves separate real hits for opponents inside its locked area', () => {
  const state = createBattle();
  for (const actor of state.actors) actor.aiNextTick = 1000000;
  Object.assign(master(state), { x: 800, y: 600 });
  Object.assign(red(state), { x: 860, y: 600 });
  Object.assign(state.actors.find(actor => actor.id === 'red-2'), { x: 880, y: 620 });
  Object.assign(state.actors.find(actor => actor.id === 'blue-1'), { x: 870, y: 600 });
  command(state, { type: 'start' });
  assert.equal(cast(state, 'fire').ok, true);
  assert.equal(master(state).qi, 84);
  advanceBattle(state, 9);
  const hits = state.events.filter(event => event.kind === 'hit');
  assert.deepEqual(hits.map(event => event.targetId), ['red-1', 'red-2']);
  assert.ok(hits.every(event => event.amount === 28));
  assert.equal(red(state).hp, 72);
  assert.equal(state.actors.find(actor => actor.id === 'red-2').hp, 72);
  assert.equal(state.actors.find(actor => actor.id === 'blue-1').hp, 100);
  assert.equal(validateBattle(state), true);
});

test('wards resolve before same-tick damage and actor array order cannot change the outcome', () => {
  const original = duel({ ai: true });
  const reversed = snapshot(original);
  reversed.actors.reverse();
  for (const state of [original, reversed]) {
    advanceBattle(state, 2);
    assert.equal(red(state).action?.skill, 'attack');
    assert.equal(cast(state, 'ward').ok, true);
    advanceBattle(state, 3);
    assert.equal(master(state).hp, 280);
    assert.equal(master(state).shield, 41);
    assert.equal(state.events.filter(event => event.kind === 'hit').at(-1).absorbed, 9);
    assert.equal(validateBattle(state), true);
  }
  reversed.actors.sort((a, b) => original.actors.findIndex(actor => actor.id === a.id) - original.actors.findIndex(actor => actor.id === b.id));
  assert.deepEqual(reversed, original);
});

test('paused orders keep one plan without spending, and execution validates the resumed state', () => {
  const state = duel({ targetX: 1000 });
  command(state, { type: 'pause', value: true });
  command(state, { type: 'move', x: 830, y: 640 });
  command(state, { type: 'select', targetId: 'red-1' });
  assert.equal(command(state, { type: 'cast', skill: 'sword' }).ok, true);
  assert.equal(state.plannedCommand.type, 'cast');
  assert.equal(master(state).qi, 100);
  assert.equal(master(state).cooldowns.sword, 0);
  const held = snapshot(state);
  advanceBattle(state, 500);
  assert.deepEqual(state, held);
  command(state, { type: 'pause', value: false });
  advanceBattle(state);
  assert.equal(master(state).action.skill, 'sword');
  assert.equal(master(state).qi, 91.25);
  assert.equal(master(state).cooldowns.sword, 29);
  assert.equal(state.plannedCommand, null);

  const changed = duel({ targetX: 1000 });
  command(changed, { type: 'pause', value: true });
  cast(changed, 'sword');
  red(changed).x = 1200;
  command(changed, { type: 'pause', value: false });
  advanceBattle(changed);
  assert.equal(master(changed).qi, 100);
  assert.equal(master(changed).cooldowns.sword, 0);
  assert.equal(master(changed).action, null);
  const failure = changed.events.find(event => event.kind === 'order_failed');
  assert.equal(failure.sourceId, 'master');
  assert.equal(failure.targetId, 'red-1');
  assert.equal(failure.skill, 'sword');
  assert.match(failure.reason, /范围/);
  assert.equal(validateBattle(changed), true);

  const initial = createBattle({ mode: 'duel' });
  command(initial, { type: 'start' });
  command(initial, { type: 'pause', value: true });
  assert.equal(cast(initial, 'sword').ok, true);
  command(initial, { type: 'pause', value: false });
  advanceBattle(initial);
  assert.equal(master(initial).qi, 100);
  assert.equal(master(initial).cooldowns.sword, 0);
  assert.match(initial.events.find(event => event.kind === 'order_failed').reason, /范围/);
  assert.deepEqual(restoreBattle(serializeBattle(initial)), initial);
  for (const reason of [null, '', '长'.repeat(201)]) {
    const invalid = snapshot(initial);
    invalid.events.find(event => event.kind === 'order_failed').reason = reason;
    assert.throws(() => validateBattle(invalid), /事件原因/);
  }
});

test('both teams move, choose opponents and apply autonomous attacks under the same clock', () => {
  const state = createBattle();
  command(state, { type: 'start' });
  advanceBattle(state, 220);
  for (const team of ['blue', 'red']) {
    const npcs = state.actors.filter(actor => actor.team === team && actor.id !== 'master');
    assert.ok(npcs.some(actor => actor.distance > 20), `${team} moved`);
    assert.ok(state.events.some(event => event.kind === 'hit' && npcs.some(actor => actor.id === event.sourceId)), `${team} damaged an opponent`);
  }
  assert.equal(master(state).distance, 0);
  assert.equal(state.events.some(event => event.sourceId === 'master' && event.kind === 'cast'), false);
  assert.ok(state.events.length <= 512);
  assert.equal(validateBattle(state), true);
});

test('victory, defeat, simultaneous draw and retreat settle once and freeze', () => {
  const victory = duel();
  red(victory).hp = 18;
  cast(victory, 'attack');
  advanceBattle(victory, 4);
  assert.equal(victory.status, 'victory');

  const defeat = duel({ ai: true });
  master(defeat).hp = 9;
  advanceBattle(defeat, 5);
  assert.equal(defeat.status, 'defeat');

  const draw = duel({ ai: true });
  master(draw).hp = 9;
  red(draw).hp = 18;
  red(draw).maxHp = 18;
  advanceBattle(draw);
  cast(draw, 'attack');
  advanceBattle(draw, 4);
  assert.equal(draw.status, 'draw');
  assert.equal(master(draw).hp, 0);
  assert.equal(red(draw).hp, 0);

  const retreat = duel();
  cast(retreat, 'attack');
  assert.equal(command(retreat, { type: 'retreat' }).ok, true);
  assert.equal(command(retreat, { type: 'retreat' }).ok, true);
  for (const state of [victory, defeat, draw, retreat]) {
    const held = snapshot(state);
    advanceBattle(state, 100);
    assert.deepEqual(state, held);
    assert.equal(state.events.filter(event => event.kind === 'result').length, 1);
    assert.equal(validateBattle(state), true);
    assert.deepEqual(restoreBattle(serializeBattle(state)), state);
  }
});

test('saves before release, in flight and after damage resume identical tick-by-tick facts', () => {
  for (const checkpoint of [1, 4, 8, 9, 10]) {
    const original = duel({ targetX: 1000 });
    cast(original, 'fire');
    advanceBattle(original, checkpoint);
    const restored = restoreBattle(serializeBattle(original));
    for (let n = 0; n < 30; n++) {
      advanceBattle(original);
      advanceBattle(restored);
      assert.deepEqual(restored, original, `checkpoint ${checkpoint}, step ${n}`);
    }
    assert.equal(original.events.filter(event => event.kind === 'hit').length, 1);
  }
});

test('bad versions, unsafe positions, invalid action stages and references reject without mutating input', () => {
  const state = duel({ targetX: 1000 });
  cast(state, 'sword');
  advanceBattle(state);
  for (const corrupt of [
    s => { s.version = 99; }, s => { s.ruleset = 'other'; }, s => { s.kind = 'campaign'; },
    s => { s.tick = -1; }, s => { master(s).hp = NaN; }, s => { master(s).x = 20; },
    s => { master(s).cooldowns.fire = -2; }, s => { master(s).action.released = true; },
    s => { master(s).action.targetId = 'missing'; }, s => { s.events[0].amount = Infinity; },
    s => { s.nextEventId = 0; }, s => { s.plannedCommand = { type: 'cast', skill: 'missing' }; }
  ]) {
    const invalid = snapshot(state);
    corrupt(invalid);
    const held = structuredClone(invalid);
    assert.throws(() => restoreBattle(invalid), /存档无效/);
    assert.deepEqual(invalid, held);
  }
  const restored = restoreBattle(state);
  restored.actors[0].hp--;
  assert.notDeepEqual(restored, state);
  assert.throws(() => restoreBattle('{oops'));
});

test('trail modes retain stable 16/32 identities and old arena snapshots restore without new fields', () => {
  for (const mode of ['team', 'duel', 'trail', 'trail32']) {
    const state = createBattle({ mode });
    assert.deepEqual(restoreBattle(serializeBattle(state)), state);
    assert.equal(state.actors.length, mode === 'duel' ? 2 : mode === 'trail32' ? 32 : 16);
    assert.equal(new Set(state.actors.map(actor => actor.id)).size, state.actors.length);
    assert.equal(new Set(state.actors.map(actor => `${actor.x},${actor.y}`)).size, state.actors.length);
    assert.equal(battleWorld(state).world.height, mode.startsWith('trail') ? 2823 : 941);
    if (!mode.startsWith('trail')) assert.equal(Object.hasOwn(state, 'trail'), false);
  }
  const state = createBattle({ mode: 'trail32' });
  for (const mutate of [s => s.trail.phase = 'unknown', s => s.trail.returnRadius = 1000, s => s.trail.home.y = 700, s => s.actors[1].id = 'blue-16', s => s.actors[0].y = 2830]) {
    const invalid = snapshot(state);
    mutate(invalid);
    assert.throws(() => restoreBattle(invalid), /存档无效/);
  }
});

test('sixteen actors walk out, fight autonomously and keep the same health and identities until returning home', () => {
  const state = createBattle({ mode: 'trail' });
  const identities = state.actors.map(actor => actor.id), initialEnemies = state.actors.filter(actor => actor.team === 'red').map(actor => ({ id: actor.id, x: actor.x, y: actor.y }));
  command(state, { type: 'start' });
  const phases = new Set(), damageTeams = new Set();
  let maxY = 0, returnHp = null, tickBeforeReturn = null;
  for (let i = 0; i < 800 && state.status === 'active'; i++) {
    driveTrail(state);
    advanceBattle(state);
    assert.equal(validateBattle(state), true);
    maxY = Math.max(maxY, master(state).y);
    phases.add(state.trail.phase);
    if (state.trail.phase === 'outbound') {
      assert.deepEqual(state.actors.filter(actor => actor.team === 'red').map(actor => ({ id: actor.id, x: actor.x, y: actor.y })), initialEnemies);
      assert.equal(state.events.some(event => event.kind === 'hit'), false);
    }
    for (const event of state.events.filter(event => event.kind === 'hit')) damageTeams.add(state.actors.find(actor => actor.id === event.sourceId).team);
    if (state.trail.phase === 'return' && returnHp === null) {
      returnHp = master(state).hp;
      tickBeforeReturn = state.tick;
      assert.equal(state.status, 'active');
      assert.ok(Math.hypot(master(state).x - 820, master(state).y - 650) > 50);
      assert.equal(state.actors.some(actor => actor.team === 'red' && actor.hp > 0), false);
    }
  }
  assert.deepEqual([...phases], ['outbound', 'combat', 'return']);
  assert.deepEqual([...damageTeams].sort(), ['blue', 'red']);
  assert.equal(state.status, 'victory');
  assert.ok(maxY > 1882);
  assert.ok(state.tick > tickBeforeReturn + 100);
  assert.ok(Math.hypot(master(state).x - 820, master(state).y - 650) <= 50);
  assert.equal(master(state).hp, returnHp);
  assert.deepEqual(state.actors.map(actor => actor.id), identities);
  assert.ok(state.actors.filter(actor => actor.team === 'blue' && actor.id !== 'master').every(actor => actor.distance > 1000));
  assert.equal(state.events.filter(event => event.kind === 'result').length, 1);
});

test('thirty-two actors keep real movement, damage and a legal frozen result after the full route', () => {
  const state = createBattle({ mode: 'trail32' });
  command(state, { type: 'start' });
  for (let i = 0; i < 800 && state.status === 'active'; i++) {
    driveTrail(state);
    advanceBattle(state);
    assert.equal(validateBattle(state), true);
  }
  assert.equal(state.actors.length, 32);
  assert.ok(['victory', 'defeat', 'draw'].includes(state.status));
  assert.equal(master(state).hp > 0, state.status === 'victory');
  assert.ok(state.actors.some(actor => actor.team === 'red' && actor.distance > 0));
  assert.ok(state.actors.filter(actor => actor.team === 'red').every(actor => Object.values(actor.cooldowns).some(tick => tick > 0)));
  const held = snapshot(state);
  advanceBattle(state, 100);
  assert.deepEqual(state, held);
  assert.deepEqual(restoreBattle(serializeBattle(state)), held);
});

test('the arranged fight waits for the leader and companions to reach the open valley', () => {
  const state = createBattle({ mode: 'trail' });
  command(state, { type: 'start' });
  command(state, { type: 'move', target: TRAIL_LANDMARKS.forest });
  const waiting = state.actors.filter(actor => actor.team === 'red').map(actor => [actor.id, actor.x, actor.y]);
  advanceBattle(state, 300);
  assert.equal(state.trail.phase, 'outbound');
  assert.equal(state.trail.startedTick, null);
  assert.equal(state.events.some(event => event.kind === 'hit'), false);
  assert.deepEqual(state.actors.filter(actor => actor.team === 'red').map(actor => [actor.id, actor.x, actor.y]), waiting);
  const held = snapshot(state);
  assert.equal(command(state, { type: 'attack', targetId: 'red-1' }).ok, false);
  assert.deepEqual(state, held);
  assert.equal(command(state, { type: 'cast', skill: 'fire', targetId: 'red-1' }).ok, false);
  assert.deepEqual(state, held);
  command(state, { type: 'move', target: TRAIL_LANDMARKS.valley });
  for (let tick = 0; tick < 200 && state.trail.phase === 'outbound'; tick++) {
    advanceBattle(state);
    validateBattle(state);
  }
  assert.equal(state.trail.phase, 'combat');
  assert.equal(isTrailArrival(master(state)), true);
  assert.ok(state.actors.filter(actor => actor.team === 'blue' && actor.hp > 0).every(actor => actor.y >= TRAIL_ARRIVAL.partyMinY));
  assert.equal(state.trail.startedTick, state.tick);
  assert.deepEqual(restoreBattle(serializeBattle(state)), state);
});

test('companions can assemble when the leader enters the arrival area facing north', () => {
  const state = createBattle({ mode: 'trail32' });
  command(state, { type: 'start' });
  command(state, { type: 'move', x: 700, y: 2280 });
  for (let tick = 0; tick < 300 && master(state).path.length; tick++) advanceBattle(state);
  assert.equal(state.trail.phase, 'outbound');
  command(state, { type: 'move', x: 830, y: 2225 });
  for (let tick = 0; tick < 300 && state.trail.phase === 'outbound'; tick++) {
    advanceBattle(state);
    validateBattle(state);
  }
  assert.equal(state.trail.phase, 'combat');
  assert.equal(isTrailArrival(master(state)), true);
  assert.ok(state.actors.filter(actor => actor.team === 'blue' && actor.hp > 0).every(actor => actor.y >= TRAIL_ARRIVAL.partyMinY));
});

test('trail travel, released flight, return and paused plans restore identical next-tick facts', () => {
  const state = createBattle({ mode: 'trail' });
  command(state, { type: 'start' });
  const checkpoints = new Map();
  for (let i = 0; i < 800 && state.status === 'active'; i++) {
    driveTrail(state);
    advanceBattle(state);
    if (state.trail.phase === 'outbound' && master(state).y > 1200 && !checkpoints.has('travel')) checkpoints.set('travel', serializeBattle(state));
    const action = master(state).action;
    if (action && ['sword', 'fire'].includes(action.skill) && action.released && !action.impacted && !checkpoints.has('flight')) checkpoints.set('flight', serializeBattle(state));
    if (state.trail.phase === 'return' && !checkpoints.has('return')) checkpoints.set('return', serializeBattle(state));
  }
  assert.deepEqual([...checkpoints.keys()], ['travel', 'flight', 'return']);
  for (const encoded of checkpoints.values()) {
    const original = restoreBattle(encoded), restored = restoreBattle(snapshot(original));
    for (let tick = 0; tick < 35; tick++) {
      driveTrail(original); driveTrail(restored);
      advanceBattle(original); advanceBattle(restored);
      assert.deepEqual(restored, original);
      validateBattle(restored);
    }
  }
  const paused = restoreBattle(checkpoints.get('travel'));
  command(paused, { type: 'pause', value: true });
  const qi = master(paused).qi, cooldowns = { ...master(paused).cooldowns };
  assert.equal(command(paused, { type: 'cast', skill: 'ward' }).ok, true);
  const restored = restoreBattle(serializeBattle(paused));
  advanceBattle(restored, 50);
  assert.deepEqual(restored, paused);
  assert.equal(master(restored).qi, qi);
  assert.deepEqual(master(restored).cooldowns, cooldowns);
  command(restored, { type: 'pause', value: false });
  advanceBattle(restored);
  assert.equal(master(restored).action.skill, 'ward');
  assert.equal(restored.plannedCommand, null);
});

test('unreachable trail orders preserve the route and voluntary exit settles once from an extended map', () => {
  const state = createBattle({ mode: 'trail' });
  command(state, { type: 'start' });
  assert.equal(command(state, { type: 'move', target: TRAIL_LANDMARKS.valley }).ok, true);
  advanceBattle(state, 50);
  const held = snapshot(state);
  assert.equal(command(state, { type: 'move', x: 500, y: 1400 }).ok, false);
  assert.deepEqual(state, held);
  assert.equal(command(state, { type: 'cast', skill: 'sword', targetId: 'red-1' }).ok, false);
  assert.deepEqual(state, held);
  assert.equal(command(state, { type: 'retreat' }).ok, true);
  assert.equal(state.status, 'retreated');
  assert.equal(command(state, { type: 'retreat' }).ok, true);
  advanceBattle(state, 100);
  assert.equal(state.events.filter(event => event.kind === 'result').length, 1);
  assert.deepEqual(restoreBattle(serializeBattle(state)), state);
});
