import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, tick, dispatchCommand, validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {godotMoveCommand, projectGodotScene} from '../../../src/simulation/ea-godot-world.mjs';
import {createGodotBridge, projectGodotWorld} from '../../../src/simulation/ea-godot-bridge.mjs';
import {supportsGodotLocalJourney} from '../../../apps/web/ea-godot-host.mjs';

function player() {
  let state = initial({sr: true, mountainOpening: true, seed: 271828});
  return {
    get state() { return state; },
    command(name, ...args) {
      const dispatched = dispatchCommand(state, {name, args});
      state = dispatched.state;
      return dispatched.result;
    },
    step(count = 1) { for (let i = 0; i < count; i++) tick(state, .1); },
    until(predicate, message) {
      for (let i = 0; i < 3000 && !predicate(state); i++) this.step();
      assert.ok(predicate(state), message);
    },
    restore() { state = validateSave(JSON.parse(JSON.stringify(state))); },
  };
}

test('home scene adds only the public same-scene merchant and remains read only', () => {
  const p = player(), state = p.state;
  const merchant = state.personsById['person:merchant-qingxi'];
  merchant.position = {kind: 'scene', sceneId: 'scene:yunxiu-courtyard', x: 30, y: 45};
  const privatePerson = Object.values(state.personsById).find(person => person.visibility === 'author-private');
  privatePerson.position = {kind: 'scene', sceneId: 'scene:yunxiu-courtyard', x: 31, y: 45};
  const before = JSON.stringify(state);
  const scene = projectGodotScene(state, {homePeople: [{id: 'person:master', x: 28, y: 12.6}], homeMasterPath: [{x: 32, y: 60}]});
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual([scene.sceneId, scene.width, scene.height], ['scene:yunxiu-courtyard', 96, 96]);
  assert.equal(scene.people.filter(person => person.id === merchant.personId).length, 1);
  assert.equal(scene.people.some(person => person.id === privatePerson.personId), false);
  assert.equal(scene.world.publicPeople.some(person => person.id === privatePerson.personId), false);
  assert.equal(scene.world.scene.actors.some(person => person.personId === privatePerson.personId), false);
  assert.equal(scene.world.exits[0].id, 'exit:yunxiu-valley');
  assert.deepEqual(godotMoveCommand(state, 32, 60), {name: 'moveScenicMaster', args: [32, 60]});
  assert.throws(() => godotMoveCommand(state, 97, 60), /当前场景范围/);
});

test('formal travel hides bodies, valley uses public actors and world movement, return restores home', () => {
  const p = player();
  p.command('masterAction', 'heal');
  p.command('chooseOpeningInheritance', 'qinglan');
  p.until(state => state.master.wound === 0, 'opening recovery');
  const result = p.command('srWorldCommand', {action: 'travel', destination: 'scene:valley', cargo: {food: 4}});
  assert.ok(result.id);
  let scene = projectGodotScene(p.state);
  assert.equal(scene.sceneId, 'scene:travel');
  assert.deepEqual(scene.people, []);
  assert.equal(scene.world.travel.id, result.id);
  assert.throws(() => godotMoveCommand(p.state, 12, 16), /行程中/);
  p.step(10);
  p.restore();
  p.until(state => !state.srWorld.activeTravelId, 'valley arrival');
  const before = JSON.stringify(p.state);
  scene = projectGodotScene(p.state);
  assert.equal(JSON.stringify(p.state), before);
  assert.deepEqual([scene.sceneId, scene.width, scene.height], ['scene:valley', 64, 48]);
  assert.equal(scene.people.filter(person => person.id === 'person:master').length, 1);
  const qingluo = scene.people.find(person => person.id === 'person:qing-luo');
  const guardian = scene.world.objects.find(object => object.id === 'object:valley:guardian');
  assert.deepEqual([qingluo.x, qingluo.y], [guardian.x, guardian.y]);
  assert.equal(guardian.available, true);
  assert.deepEqual(godotMoveCommand(p.state, 11.5, 16),
    {name: 'srWorldCommand', args: [{action: 'move', x: 11.5, y: 16}]});
  assert.throws(() => godotMoveCommand(p.state, 65, 16), /当前场景范围/);
  const movement = godotMoveCommand(p.state, 11.5, 16);
  p.command(movement.name, ...movement.args);
  scene = projectGodotScene(p.state);
  assert.ok(scene.masterPath.length > 0);
  assert.equal(scene.people.find(person => person.id === 'person:master').moving, true);
  const redirected = p.command('srWorldCommand', {action: 'move', x: 8, y: 26});
  assert.equal(redirected.kind, 'walk');
  assert.deepEqual(redirected.path.at(-1), {x: 8, y: 26});
  p.until(state => !state.srWorld.interaction, 'valley walk');
  p.command('srWorldCommand', {action: 'return'});
  scene = projectGodotScene(p.state);
  assert.equal(scene.sceneId, 'scene:travel');
  assert.deepEqual(scene.people, []);
  p.restore();
  p.until(state => !state.srWorld.activeTravelId, 'home return');
  scene = projectGodotScene(p.state, {homePeople: [{id: 'person:master'}]});
  assert.equal(scene.sceneId, 'scene:yunxiu-courtyard');
  assert.equal(scene.people.filter(person => person.id === 'person:master').length, 1);
});

test('bridge switches its scene and routes valley movement through the formal world command', () => {
  const p = player();
  p.command('masterAction', 'heal');
  p.command('chooseOpeningInheritance', 'qinglan');
  p.until(state => state.master.wound === 0, 'opening recovery');
  const bridge = createGodotBridge({state: p.state});
  let view = bridge.snapshot();
  assert.equal(view.sceneId, 'scene:yunxiu-courtyard');
  assert.ok(view.buildings.length);
  assert.deepEqual([view.width, view.height], [96, 96]);
  const before = bridge.save();
  assert.equal(bridge.snapshot(), view);
  assert.equal(bridge.save(), before);
  assert.equal(bridge.command({name: 'srWorldCommand', args: [{action: 'travel', destination: 'scene:valley', cargo: {food: 4}}]}).ok, true);
  view = bridge.snapshot();
  assert.equal(view.sceneId, 'scene:travel');
  assert.deepEqual(view.people, []);
  assert.deepEqual(view.buildings, []);
  assert.deepEqual(view.terrain, []);
  assert.ok(view.world.travel?.id);
  assert.equal(supportsGodotLocalJourney(validateSave(JSON.parse(bridge.save()))), true);
  for (let i = 0; i < 3000 && bridge.snapshot().sceneId !== 'scene:valley'; i++) bridge.advance(.1);
  view = bridge.snapshot();
  assert.equal(view.sceneId, 'scene:valley');
  assert.deepEqual([view.width, view.height], [64, 48]);
  assert.ok(view.people.some(person => person.id === 'person:qing-luo'));
  assert.equal(view.people.some(person => person.id === 'person:great:guiyuan:hidden'), false);
  const invalidSave = bridge.save();
  assert.equal(bridge.command({type: 'move', x: 97, y: 20}).ok, false);
  assert.equal(bridge.save(), invalidSave);
  const moved = bridge.command({type: 'move', x: 11.5, y: 16});
  assert.equal(moved.ok, true);
  assert.equal(moved.result.kind, 'walk');
  assert.ok(bridge.snapshot().masterPath.length);
  assert.equal(bridge.command({type: 'move', x: 8, y: 26}).ok, true);
  const saved = bridge.save();
  assert.equal(createGodotBridge({state: validateSave(JSON.parse(saved))}).snapshot().sceneId, 'scene:valley');
});

test('local valley combat projects its official actors and routes world clicks into local combat movement', () => {
  const p = player();
  p.command('masterAction', 'heal');
  p.command('chooseOpeningInheritance', 'qinglan');
  p.until(state => state.master.wound === 0, 'opening recovery');
  p.command('srWorldCommand', {action: 'travel', destination: 'scene:valley', cargo: {food: 4}});
  p.until(state => !state.srWorld.activeTravelId, 'valley arrival');
  p.command('srWorldCommand', {action: 'move', x: 25, y: 36});
  p.until(state => !state.srWorld.interaction, 'approach foe');
  p.command('srWorldCommand', {action: 'interact', objectId: 'object:valley:shanxiao', choice: 'engage'});
  const beforeProjection = JSON.stringify(p.state);
  projectGodotWorld(p.state);
  assert.equal(JSON.stringify(p.state), beforeProjection);
  assert.equal(Object.isFrozen(p.state.combat.effects), false);
  assert.equal(Object.isFrozen(p.state.combat.player), false);
  const bridge = createGodotBridge({state: p.state});
  let view = bridge.snapshot();
  assert.equal(view.sceneId, 'scene:valley');
  assert.equal(view.combat?.status, 'active');
  assert.equal(view.combat.sceneFrame.sceneId, 'scene:valley');
  assert.equal(view.combat.encounterId, 'valley-shanxiao');
  assert.equal(view.combat.enemies[0].personId, 'person:valley-shanxiao');
  assert.ok(view.combat.controls.actions.some(action => action.id === 'attack'));
  const fighter = view.people.find(person => person.id === 'person:master');
  assert.deepEqual([fighter.x, fighter.y], [
    view.combat.sceneFrame.origin.x + view.combat.player.x,
    view.combat.sceneFrame.origin.y + view.combat.player.y,
  ]);
  assert.equal(supportsGodotLocalJourney(validateSave(JSON.parse(bridge.save()))), true);
  const battleSave = bridge.save();
  assert.match(bridge.command({type: 'move', x: 15, y: 16}).error, /林间战场/);
  assert.equal(bridge.save(), battleSave);
  const clicked = bridge.command({type: 'move', x: 25.5, y: 36});
  assert.equal(clicked.ok, true, clicked.error);
  view = bridge.snapshot();
  assert.deepEqual(view.combat.player.target, {x: 4.5, y: 4});
  const guarded = bridge.command({name: 'combatAction', args: ['guard']});
  assert.equal(guarded.ok, true, guarded.error);
  view = bridge.snapshot();
  assert.equal(view.combat.controls.pending?.action, 'guard');
  const restored = createGodotBridge({state: validateSave(JSON.parse(bridge.save()))}).snapshot();
  assert.equal(restored.combat.sessionId, view.combat.sessionId);
  const unrelated = validateSave(JSON.parse(bridge.save()));
  unrelated.combat.localEncounter = false;
  assert.equal(supportsGodotLocalJourney(unrelated), false);
});

test('an unacknowledged valley battle result stays in the save while the returned master appears at home', () => {
  const p = player();
  p.command('masterAction', 'heal');
  p.command('chooseOpeningInheritance', 'qinglan');
  p.until(state => state.master.wound === 0, 'opening recovery');
  p.command('srWorldCommand', {action: 'travel', destination: 'scene:valley', cargo: {food: 4}});
  p.until(state => !state.srWorld.activeTravelId, 'valley arrival');
  p.command('srWorldCommand', {action: 'move', x: 24.5, y: 36});
  p.until(state => !state.srWorld.interaction, 'approach foe');
  p.command('srWorldCommand', {action: 'engage', objectId: 'object:valley:shanxiao'});
  p.command('combatAction', 'retreat');
  p.until(state => state.combat.status === 'retreated', 'retreat from valley battle');
  assert.equal(createGodotBridge({state: p.state}).snapshot().combat?.status, 'retreated');
  p.command('srWorldCommand', {action: 'exit', exitId: 'exit:valley-yunxiu'});
  p.until(state => !state.srWorld.interaction, 'reach return exit');
  p.command('srWorldCommand', {action: 'exit', exitId: 'exit:valley-yunxiu'});
  p.until(state => !state.srWorld.activeTravelId, 'return home');
  const saved = JSON.stringify(p.state), view = createGodotBridge({state: p.state}).snapshot();
  assert.equal(view.sceneId, 'scene:yunxiu-courtyard');
  assert.equal(view.combat, null);
  assert.ok(view.people.some(person => person.id === 'person:master'));
  assert.equal(p.state.combat.status, 'retreated');
  assert.ok(p.state.combat.result?.text);
  assert.equal(JSON.stringify(p.state), saved);
  assert.equal(validateSave(JSON.parse(saved)).combat.status, 'retreated');
});
