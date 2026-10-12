import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial, tick, dispatchCommand, validateSave} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge, projectGodotWorld} from '../dist/ea-godot-bridge.mjs';
import {grantPills} from '../dist/ea-sr-economy.mjs';

const empty = {healingCrafted:false, valleyGathered:false, firstBattle:null};
const fresh = () => initial({sr:true, mountainOpening:true, seed:271828});
function projection(state) {
  const before = JSON.stringify(state);
  const result = projectGodotWorld(state).openingJourney;
  assert.equal(JSON.stringify(state), before, 'projection preserves the simulation and its clock');
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(Object.keys(result), Object.keys(empty));
  return result;
}
function roundTrip(state, expected) {
  const bridge = createGodotBridge({state:validateSave(JSON.parse(JSON.stringify(state)))});
  const before = bridge.save(), view = bridge.snapshot();
  assert.deepEqual(view.openingJourney, expected);
  assert.equal(bridge.snapshot(), view);
  assert.equal(bridge.save(), before);
  assert.equal(bridge.load(before).ok, true);
  assert.deepEqual(bridge.snapshot().openingJourney, expected);
  assert.equal(bridge.save(), before);
}

test('new and existing saves without journey facts expose an empty read-only journey', () => {
  for (const state of [fresh(), initial({sr:true, seed:271828})]) {
    assert.deepEqual(projection(state), empty);
    roundTrip(state, empty);
  }
});

test('journey fact projection filters ownership, provenance and future records', () => {
  const state = fresh();
  state.worldTick = 100;
  const add = (id, values) => state.factsById[id] = {id, actorId:'person:master', atTick:10, ...values};
  const pill = {kind:'inventory-transaction', operation:'pill-production', recipeId:'heal', quantity:2};
  add('fact:other-person', {...pill, actorId:'person:lu-zhiwei'});
  add('fact:other-pill', {...pill, recipeId:'qi'});
  add('fact:future-pill', {...pill, atTick:101});
  add('fact:empty-pill', {...pill, quantity:0});
  add('fact:private-pill', {...pill, public:false});
  add('fact:wrong-kind', {...pill, kind:'author-world-card'});
  add('fact:map-key', {...pill, id:'fact:different-key'});
  add('fact:interaction:object:ruins:pool:gather:1', {kind:'interaction', sceneId:'scene:valley'});
  add('fact:interaction:object:valley:herbs:gather:2', {kind:'interaction', sceneId:'scene:ruins'});
  add('fact:interaction:object:valley:herbs:gather:3', {kind:'interaction', sceneId:'scene:valley', actorId:'person:lu-zhiwei'});
  add('fact:interaction:object:valley:herbs:gather:90', {kind:'interaction', sceneId:'scene:valley', atTick:80});
  add('fact:interaction:object:valley:herbs:gather:100', {kind:'interaction', sceneId:'scene:valley', atTick:130});
  const battle = {kind:'combat-result', personId:'person:valley-shanxiao', encounterId:'valley-shanxiao',
    sessionId:'combat:campaign:1', sceneId:'scene:valley', result:'retreated', atTick:60};
  add('fact:combat:campaign:1:result', battle);
  assert.deepEqual(projection(state), empty, 'a result without its ended session is not a completed battle');
  state.combatSessionsById[battle.sessionId] = {personId:'person:master', phase:'active', result:'retreated', endedTick:60};
  assert.deepEqual(projection(state), empty);
  state.combatSessionsById[battle.sessionId].phase = 'ended';
  add('fact:healing-consumed', {...pill, operation:'pill-consume', quantity:1, atTick:60});
  assert.deepEqual(projection(state), {...empty, firstBattle:{result:'retreated', atTick:60}});
  add('fact:crafted-healing', pill);
  add('fact:interaction:object:valley:herbs:gather:20', {kind:'interaction', sceneId:'scene:valley', atTick:50});
  assert.deepEqual(projection(state), {healingCrafted:true, valleyGathered:true,
    firstBattle:{result:'retreated', atTick:60}});
  add('fact:combat:campaign:2:result', {...battle, sessionId:'combat:campaign:2', result:'lost', atTick:90});
  state.combatSessionsById['combat:campaign:2'] = {personId:'person:master', phase:'ended', result:'lost', endedTick:90};
  assert.deepEqual(projection(state), {healingCrafted:true, valleyGathered:true,
    firstBattle:{result:'lost', atTick:90}}, 'the latest settled battle is projected');
});

test('real gathering, active combat, retreat and pill use project only their completed facts', () => {
  let state = fresh();
  const command = (name, ...args) => {
    const dispatched = dispatchCommand(state, {name, args});
    state = dispatched.state;
    return dispatched.result;
  };
  const world = action => command('srWorldCommand', action);
  const until = (predicate, label) => {
    for (let i = 0; i < 3000 && !predicate(state); i++) tick(state, .1);
    assert.ok(predicate(state), label);
  };
  command('masterAction', 'heal');
  command('chooseOpeningInheritance', 'qinglan');
  until(s => s.master.wound === 0, 'opening healing');
  const carriedSupply = command('startTransport', 'stockpile:yunxiu',
    'stockpile:carried:master', 'person:master', {food:1});
  until(s => s.workOrdersById[carriedSupply.id]?.phase === 'delivered', 'carried supply');
  // This finite medicine fixture exercises the real production and consumption
  // ledger; it does not stand in for the separate normal-player crafting chain.
  grantPills(state, 'stockpile:carried:master', 'heal', 1, {factId:'fact:qa:opening-journey-dose'});
  assert.equal(projection(state).healingCrafted, true);
  world({action:'travel', destination:'scene:valley', cargo:{food:4}});
  until(s => !s.srWorld.activeTravelId, 'valley arrival');
  world({action:'move', x:11.5, y:16});
  until(s => !s.srWorld.interaction, 'walk to herbs');
  world({action:'interact', objectId:'object:valley:herbs', choice:'gather'});
  assert.equal(projection(state).valleyGathered, false);
  until(s => !s.srWorld.interaction, 'gather completion');
  assert.equal(projection(state).valleyGathered, true);
  world({action:'move', x:24.5, y:36});
  until(s => !s.srWorld.interaction, 'walk to encounter');
  world({action:'engage', objectId:'object:valley:shanxiao'});
  const active = {healingCrafted:true, valleyGathered:true, firstBattle:null};
  assert.deepEqual(projection(state), active);
  roundTrip(state, active);
  until(s => s.master.wound > 0, 'real combat injury');
  command('combatAction', 'retreat');
  assert.equal(projection(state).firstBattle, null);
  until(s => s.combat.status === 'retreated', 'settled retreat');
  const ended = {...active, firstBattle:{result:'retreated', atTick:state.worldTick}};
  assert.deepEqual(projection(state), ended);
  command('acknowledgeCombat');
  const woundBeforePill = state.master.wound;
  command('masterPill', 'heal');
  assert.equal(state.worldTick, ended.firstBattle.atTick, 'immediate commands preserve the battle result tick');
  assert.ok(state.master.wound < woundBeforePill);
  assert.ok(Object.values(state.factsById).some(fact => fact.kind === 'inventory-transaction' &&
    fact.operation === 'pill-consume' && fact.actorId === 'person:master' &&
    fact.recipeId === 'heal' && fact.atTick === ended.firstBattle.atTick));
  assert.deepEqual(projection(state), ended);
  roundTrip(state, ended);
});

const qaDirectory = process.env.EA_OPENING_JOURNEY_QA_DIR;
test('captured player saves retain their opening journey milestones', {skip:!qaDirectory}, () => {
  for (const [name, gathered, result] of [
    ['pills-ready', false, null], ['combat-save', true, null],
    ['home-wounded', true, 'retreated'], ['final-healed', true, 'retreated'],
  ]) {
    const state = validateSave(JSON.parse(readFileSync(`${qaDirectory}/${name}.json`, 'utf8')));
    const expected = {healingCrafted:true, valleyGathered:gathered,
      firstBattle:result ? {result, atTick:8134} : null};
    assert.deepEqual(projection(state), expected, name);
    roundTrip(state, expected);
  }
});
