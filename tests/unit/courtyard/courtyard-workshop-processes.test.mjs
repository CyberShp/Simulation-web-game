import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { handlers } from '../../../src/simulation/ea-sr-spatial.mjs';
import { createSectSession, commandSect, viewSect, snapshotSect, restoreSect, advanceSect } from '../../../apps/courtyard/sect-sim.mjs';

const copy = value => structuredClone(value);
const WORKSHOP = 'site:domain:gc-25', WORKER = 'person:lu-zhiwei';

// A reachable late-game fixture: the fixed workshop site needs stage 2 and
// 100 jade/65 wood/45 stone, which the seed world cannot yet afford. The fixture
// tops up the public stockpile and lays the fixed building through the same
// spatial handler the public build command uses; every later step is public.
function workshopYard() {
  let state = SIM.validateSave(copy(seed.state));
  const run = (name, ...args) => { const result = SIM.dispatchCommand(state, { name, args }); state = result.state; return result.result; };
  for (const name of ['enableCourtyardTerrain', 'enableSectDomain', 'enableWestValley', 'enableWestWorkshops']) run(name);
  const home = state.stockpilesById['stockpile:yunxiu'].resources;
  Object.assign(home, { jade: home.jade + 200, wood: home.wood + 100, stone: home.stone + 100, herb: home.herb + 100 });
  const build = handlers.buildDomainSite(state, WORKSHOP);
  for (let step = 0; step < 8000 && state.workOrdersById[build.workOrderId]; step++) SIM.tick(state, .5);
  const building = state.buildingsById[`building:yunxiu:${build.id}`], stockpileId = `stockpile:${building.instanceId}`;
  Object.assign(state.stockpilesById[stockpileId].resources, { wood: 6, herb: 6, stone: 6, crystal: 2 });
  return { get state() { return state; }, building, stockpileId };
}
const sessionFor = yard => createSectSession({ source: { state: yard.state, provenance: { kind: 'normal-public-command-checkpoint', stateSha256: createHash('sha256').update(JSON.stringify(yard.state)).digest('hex') } } });
const workplace = session => viewSect(session).operations.workplaces.find(value => value.buildingId === `building:yunxiu:${session.state.buildings.find(building => building.type === 'workshop').id}`);

test('the five professional processes keep their own recipes and distinct tuning', () => {
  assert.deepEqual(SIM.WORKSHOP_PROCESSES.map(process => process.id), ['paper', 'rope', 'tailor', 'repair', 'instrument']);
  const durations = new Set(), versions = new Set();
  for (const process of SIM.WORKSHOP_PROCESSES) {
    const recipe = SIM.productionRecipeDefinition(process.version, 'workshop');
    assert.deepEqual(recipe, process.recipe, process.id);
    assert.deepEqual(Object.keys(recipe.outputDefinition), ['jade']);
    assert.ok(recipe.durationValue > 0 && recipe.inputCost.wood >= 1);
    versions.add(process.version); durations.add(recipe.durationValue);
  }
  assert.equal(versions.size, 5);
  assert.equal(durations.size, 5);
  assert.equal(SIM.productionRecipeDefinition('workshop-recipes:paper:v1', 'lumber'), null);
  assert.equal(SIM.productionSkillVersion('workshop-recipes:rope:v1'), true);
  assert.equal(SIM.productionSkillVersion('economy:yunxiu:v1'), false);
});

test('a commissioned process reserves materials, reloads, cancels and actually runs to settlement', () => {
  const yard = workshopYard();
  const session = sessionFor(yard);
  const view = workplace(session), orderId = `work:production:${view.buildingId}`;
  assert.deepEqual(view.processes.map(process => process.id), ['paper', 'rope', 'tailor', 'repair', 'instrument']);
  assert.equal(view.selectedProcess, null);
  assert.equal(view.processes.find(process => process.id === 'paper').availability.available, true);
  const started = commandSect(session, { type: 'start-workshop-process', buildingId: view.buildingId, processId: 'paper' });
  assert.equal(started.ok, true, started.error);
  const order = session.state.workOrdersById[orderId];
  assert.equal(order.phase, 'waiting');
  assert.equal(order.batch, 1);
  assert.equal(order.durationTicks, 160);
  assert.equal(order.recipeSnapshot.recipeVersion, 'workshop-recipes:paper:v1');
  assert.deepEqual(session.state.reservationsById[order.reservationId].cost, { wood: 2, herb: 2 });
  assert.deepEqual(session.state.stockpilesById[yard.stockpileId].resources.wood, 4);
  const projected = workplace(session);
  assert.equal(projected.selectedProcess, 'paper');
  assert.equal(projected.cancelable, true);
  assert.equal(projected.order.phase, 'waiting');
  const saved = snapshotSect(session), loaded = restoreSect(saved);
  assert.deepEqual(snapshotSect(loaded), saved);
  assert.equal(SIM.validateSave(copy(loaded.state)).revision, loaded.state.revision);
  const cancelled = commandSect(loaded, { type: 'cancel-production', buildingId: view.buildingId });
  assert.equal(cancelled.ok, true, cancelled.error);
  assert.equal(loaded.state.workOrdersById[orderId], undefined);
  assert.deepEqual(loaded.state.stockpilesById[yard.stockpileId].resources.wood, 6);
  assert.deepEqual(loaded.state.stockpilesById[yard.stockpileId].resources.herb, 6);
  const rope = commandSect(loaded, { type: 'start-workshop-process', buildingId: view.buildingId, processId: 'rope' });
  assert.equal(rope.ok, true, rope.error);
  assert.equal(loaded.state.workOrdersById[orderId].recipeSnapshot.recipeVersion, 'workshop-recipes:rope:v1');
  const tailor = commandSect(loaded, { type: 'start-workshop-process', buildingId: view.buildingId, processId: 'tailor' });
  assert.equal(tailor.ok, false);
  assert.match(tailor.error, /已有在制批次/);
  const invited = commandSect(loaded, { type: 'invite-work', personId: WORKER, buildingId: view.buildingId });
  assert.equal(invited.ok, true, invited.error);
  const factId = `fact:production:${view.buildingId}:1`;
  for (let step = 0; step < 60000 && !loaded.state.factsById[factId]; step++) advanceSect(loaded, .2);
  const fact = loaded.state.factsById[factId];
  assert.ok(fact, 'the batch never settled');
  assert.equal(fact.recipeVersion, 'workshop-recipes:rope:v1');
  assert.ok(fact.grossOutput.jade > 0);
  assert.equal(loaded.state.workOrdersById[orderId].phase, 'completed');
  assert.equal(SIM.validateSave(copy(loaded.state)).revision, loaded.state.revision);
});
