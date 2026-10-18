import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect } from '../../../apps/courtyard/sect-sim.mjs';

const WEST = 'site:domain:west-lumber-1', WORKER = 'person:lu-zhiwei';
const request = (session, input) => { const result = commandSect(session, input); assert.equal(result.ok, true, result.error); return result; };
const until = (session, predicate, limit = 4000) => {
  for (let step = 0; step < limit && !predicate(session); step++) advanceSect(session, .1);
  assert.ok(predicate(session), session.reason);
};
function lumberYard() {
  const session = createSectSession();
  request(session, { type: 'enable-domain' });
  request(session, { type: 'enable-courtyard-terrain' });
  request(session, { type: 'build-site', siteId: WEST });
  until(session, current => current.state.buildings.some(building => building.type === 'lumber'));
  const building = session.state.buildings.find(value => value.type === 'lumber');
  return { session, buildingId: building.instanceId, workplaces: () => viewSect(session).operations.workplaces.find(value => value.buildingId === building.instanceId) };
}

test('the workplace projection exposes the batch recipe the workers actually consume', () => {
  const { workplaces } = lumberYard();
  const workplace = workplaces();
  assert.deepEqual(workplace.recipe, { inputCost: {}, outputDefinition: { wood: 18 }, durationTicks: 200, skillKey: 'industry' });
  assert.deepEqual(workplace.missingCost, {});
  assert.equal(workplace.cancelable, false);
  assert.equal(workplace.order, null);
  const recipe = SIM.productionRecipeDefinition(SIM.PRODUCTION_RECIPE_VERSION, 'lumber');
  assert.deepEqual(workplace.recipe.outputDefinition, recipe.outputDefinition);
  assert.equal(workplace.recipe.durationTicks, recipe.durationValue);
});

test('an invited worker starts the batch and the public cancel request clears it without inventing goods', () => {
  const { session, buildingId, workplaces } = lumberYard();
  request(session, { type: 'invite-work', personId: WORKER, buildingId });
  const orderId = `work:production:${buildingId}`;
  until(session, current => !!current.state.workOrdersById[orderId]);
  const started = workplaces();
  assert.equal(started.cancelable, true);
  assert.equal(started.order.phase, 'active');
  assert.ok(started.order.progressTicks > 0 && started.order.progressTicks < started.order.durationTicks);
  const saved = snapshotSect(session), loaded = restoreSect(saved);
  assert.deepEqual(snapshotSect(loaded), saved);
  assert.equal(viewSect(loaded).operations.workplaces.find(value => value.buildingId === buildingId).order.phase, 'active');
  const cancelled = request(loaded, { type: 'cancel-production', buildingId });
  assert.match(cancelled.message, /中止伐木场本批生产/);
  assert.equal(loaded.state.workOrdersById[orderId], undefined);
  assert.equal(viewSect(loaded).operations.workplaces.find(value => value.buildingId === buildingId).cancelable, false);
  const refused = commandSect(loaded, { type: 'cancel-production', buildingId });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /当前没有未完成的生产批次/);
  const afterCancel = snapshotSect(loaded);
  assert.deepEqual(snapshotSect(restoreSect(afterCancel)), afterCancel);
});
