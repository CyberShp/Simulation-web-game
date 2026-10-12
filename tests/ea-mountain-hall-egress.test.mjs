import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial, tick, dispatchCommand, validateSave} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';
import {HALL_ESTABLISH_COST, meterSweep} from '../dist/ea-sr-spatial.mjs';
import {BUILDINGS} from '../dist/ea-data.mjs';

const sites = JSON.parse(readFileSync(new URL('../godot/estate_2d/estate-sites.json', import.meta.url))).sites;
const scenePosition = (state, id) => id === 'person:master'
  ? state.master.scenic : state.personsById[id].mind.scenic;
const advance = (state, steps) => {for (let i = 0; i < steps; i++) tick(state, .1);};

function completeHall(state) {
  const started = state.worldTick;
  const watched = ['person:master', 'person:cheng-wenzhou'];
  let resumedDuringEvacuation = false;
  for (let i = 0; i < 500 && state.story.opening.hallPhase !== 'complete'; i++) {
    const positions = watched.map(id => ({...scenePosition(state, id)}));
    tick(state, .1);
    watched.forEach((id, index) => {
      const after = scenePosition(state, id), before = positions[index];
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < .7,
        `${id} must walk continuously on the shared world step`);
      assert.equal(meterSweep(state, before, after).blocked, false, `${id} must use the open doorway`);
    });
    if (!resumedDuringEvacuation && scenePosition(state, watched[1]).spatialEvacuationOrderId) {
      const saved = JSON.stringify(state);
      state = validateSave(JSON.parse(saved));
      assert.equal(JSON.stringify(state), saved, 'save/load preserves the ongoing evacuation');
      resumedDuringEvacuation = true;
    }
  }
  assert.equal(state.story.opening.hallPhase, 'complete', 'the door clears and the hall finishes');
  assert.ok(state.worldTick > started);
  assert.equal(resumedDuringEvacuation, true);
  const finished = state.spatial.completedOrders.find(order => order.operation === 'establish');
  assert.deepEqual(finished.usedCost, HALL_ESTABLISH_COST);
  assert.equal(state.stats.built, 1);
  const saved = JSON.stringify(state);
  assert.equal(JSON.stringify(validateSave(JSON.parse(saved))), saved);
  return state;
}

function completeFarm(state) {
  const orderId = Object.values(state.workOrdersById).find(order => order.kind === 'construction' && order.buildingType === 'farm').id;
  const watched = ['person:master', 'person:lu-zhiwei'];
  let reloadedInTransit = false;
  for (let i = 0; i < 500 && state.workOrdersById[orderId]; i++) {
    const positions = watched.map(id => ({...scenePosition(state, id)}));
    tick(state, .1);
    watched.forEach((id, index) => {
      const after = scenePosition(state, id), before = positions[index];
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < .7);
      assert.equal(meterSweep(state, before, after).blocked, false);
    });
    const master = scenePosition(state, watched[0]), helper = scenePosition(state, watched[1]);
    assert.ok(Math.hypot(master.x - helper.x, master.y - helper.y) >= .53 - 1e-7,
      'the carrier and volunteer keep their physical separation');
    const order = state.workOrdersById[orderId], flow = order?.materialFlow;
    if (flow) {
      for (const resource of ['wood', 'stone']) {
        const remaining = state.stockpilesById[flow.sourceStockpileId].resources[resource]
          + state.stockpilesById[flow.siteStockpileId].resources[resource]
          + (flow.cargo[resource] || 0) + (order.usedCost[resource] || 0);
        assert.equal(remaining, BUILDINGS.farm.cost[resource], 'materials stay at their real location');
      }
      if (!reloadedInTransit && flow.phase === 'carrying') {
        const saved = JSON.stringify(state);
        state = validateSave(JSON.parse(saved));
        assert.equal(JSON.stringify(state), saved);
        reloadedInTransit = true;
      }
    }
  }
  assert.equal(state.buildings.filter(building => building.type === 'farm').length, 1);
  assert.equal(state.workOrdersById[orderId], undefined);
  assert.equal(reloadedInTransit, true);
  assert.deepEqual(state.spatial.completedOrders.find(order => order.id === orderId).usedCost, BUILDINGS.farm.cost);
  assert.equal(state.personsById['person:lu-zhiwei'].job, null, 'volunteering does not assign a permanent job');
  const saved = JSON.stringify(state);
  assert.equal(JSON.stringify(validateSave(JSON.parse(saved))), saved);
}

test('new mountain opening gifts the visitor, clears the hall exit and separates farm volunteers from deliveries', () => {
  let state = validateSave(JSON.parse(createGodotBridge({state:initial({sr:true, mountainOpening:true}), sites}).save()));
  const command = (name, ...args) => {
    const result = dispatchCommand(state, {name, args});
    state = result.state;
    return result.result;
  };
  // The normal UI allows time to read the opening and approach its visitor.
  advance(state, 450);
  command('masterAction', 'heal');
  command('chooseOpeningInheritance', 'qinglan');
  advance(state, 330);
  assert.equal(state.master.wound, 0);
  command('advanceStory');
  const visitor = scenePosition(state, 'person:lu-zhiwei'), master = state.master.scenic;
  const dx = master.x - visitor.x, dy = master.y - visitor.y, distance = Math.hypot(dx, dy) || 1;
  assert.equal(command('moveScenicMaster', visitor.x + dx / distance * .45, visitor.y + dy / distance * .45), true);
  advance(state, 250);
  command('advanceStory', 'gift');
  advance(state, 280);
  assert.ok(Math.hypot(state.master.scenic.x - visitor.x, state.master.scenic.y - visitor.y) < 3);
  command('establishHall');
  state = completeHall(state);
  command('advanceStory', 'invite');
  const farm = sites.find(site => site.type === 'farm');
  command('build', 'farm', farm.x, farm.y);
  completeFarm(state);
});

// Optional real browser evidence stays outside the source tree.
const blockedSave = process.env.EA_HALL_BLOCKED_SAVE;
test('captured blocked hall resumes with the same people, materials and world clock', {skip:!blockedSave}, () => {
  let state = validateSave(JSON.parse(readFileSync(blockedSave, 'utf8')));
  assert.equal(state.workOrdersById['work:construction:1'].progressTicks, 0);
  assert.equal(scenePosition(state, 'person:cheng-wenzhou').waitingForPersonId, 'person:master');
  state = dispatchCommand(state, {name:'setSpeed', args:[1]}).state;
  completeHall(state);
});

const blockedFarmSave = process.env.EA_FARM_BLOCKED_SAVE;
test('captured farm delivery resumes while its volunteer walks to a construction slot', {skip:!blockedFarmSave}, () => {
  let state = validateSave(JSON.parse(readFileSync(blockedFarmSave, 'utf8')));
  assert.equal(scenePosition(state, 'person:master').waitingForPersonId, 'person:lu-zhiwei');
  assert.equal(scenePosition(state, 'person:lu-zhiwei').waitingForPersonId, 'person:master');
  state = dispatchCommand(state, {name:'setSpeed', args:[1]}).state;
  completeFarm(state);
});
