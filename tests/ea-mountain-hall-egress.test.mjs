import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial, tick, dispatchCommand, validateSave} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';
import {HALL_ESTABLISH_COST, meterSweep} from '../dist/ea-sr-spatial.mjs';

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
}

test('new mountain opening gifts the visitor before building and keeps the hall exit clear', () => {
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
  completeHall(state);
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
