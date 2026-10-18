import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { createSectSession, commandSect, advanceSect, snapshotSect, restoreSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';

const HOME = 'stockpile:yunxiu', CARRIED = 'stockpile:carried:master';
const food = (s, id = HOME) => s.state.stockpilesById[id].resources.food;
const active = s => s.state.activitiesById[s.state.master.activityId];
const cargoOrder = s => s.state.workOrdersById[active(s)?.workOrderId];
function command(s, request) {
  const result = commandSect(s, request);
  assert.equal(result.ok, true, result.error);
  return result.result;
}
function until(s, predicate, label, { manual = false, ticks = 6000 } = {}) {
  for (let n = 0; n < ticks && !predicate(s); n++) {
    if (manual && n % 200 === 0) command(s, { type: 'manual' });
    advanceSect(s, .1);
  }
  assert.ok(predicate(s), `${label}: ${s.reason}`);
}
function deliver(s, sourceStockpileId, targetStockpileId, cargo) {
  const order = command(s, { type: 'transport', sourceStockpileId, targetStockpileId, cargo });
  until(s, x => x.state.workOrdersById[order.id].phase === 'delivered', 'manual cargo delivered', { manual: true });
}
function harvest(s, resource, batches = 1) {
  for (let n = 0; n < batches; n++) {
    command(s, { type: 'harvest', resource });
    until(s, x => !active(x), 'finite source harvested', { manual: true });
  }
  deliver(s, CARRIED, HOME, { [resource]: s.state.stockpilesById[CARRIED].resources[resource] });
}
function build(s, type) {
  // The shared public build command uses an available original-courtyard plot.
  // This tests supply rules; desktop fixed-site construction is covered separately.
  const response = SIM.dispatchCommand(s.state, { name: 'build', args: [type, 20, 60] });
  s.state = response.state;
  const id = `building:yunxiu:${response.result.id}`;
  until(s, x => !!x.state.buildingsById[id] && !active(x), `${type} completed`, { manual: true });
  return { buildingId: id, stockpileId: `stockpile:${id}` };
}
function warehouse({ stored = 30, extraFood = false } = {}) {
  // Each run starts from the unchanged normal checkpoint. Materials and food
  // enter through finite harvesting, construction and actual transport commands.
  const s = createSectSession({ policy: { herbTarget: 0, foodTarget: 0, risk: 'cautious' } });
  harvest(s, 'wood');
  if (extraFood) harvest(s, 'food', 2);
  const site = build(s, 'warehouse');
  for (let remaining = stored; remaining > 0; remaining -= Math.min(40, remaining)) {
    deliver(s, HOME, site.stockpileId, { food: Math.min(40, remaining) });
  }
  assert.equal(food(s, site.stockpileId), stored);
  return { s, ...site };
}
function startFoodPolicy(s, target, sourceId) {
  command(s, { type: 'policy', policy: { foodTarget: target, herbTarget: 0, risk: 'cautious' } });
  command(s, { type: 'auto' });
  until(s, x => cargoOrder(x)?.sourceStockpileId === sourceId && cargoOrder(x)?.targetStockpileId === HOME, 'automatic food pickup');
  return cargoOrder(s);
}
function verifyDelivery(s, order, sourceId, before, retained) {
  const homeAtStart = food(s), dayAtStart = s.state.economy.lastSupplyDay, quantity = order.cargo.food;
  const expectedHome = () => homeAtStart + quantity - (s.state.economy.lastSupplyDay - dayAtStart) * SIM.foodDemand(s.state);
  assert.equal(food(s, sourceId), before - quantity, 'only the actual cargo is reserved at source');
  assert.ok(food(s, sourceId) >= retained);
  assert.notEqual(order.phase, 'delivered');
  until(s, x => x.state.workOrdersById[order.id].phase === 'carrying', 'food physically picked up');
  assert.equal(food(s), homeAtStart - (s.state.economy.lastSupplyDay - dayAtStart) * SIM.foodDemand(s.state), 'HOME receives no food before arrival');
  const saved = snapshotSect(s), resumed = restoreSect(saved);
  assert.deepEqual(snapshotSect(resumed), saved, 'in-transit food and its ownership survive reload');
  Object.assign(s, resumed);
  until(s, x => x.state.workOrdersById[order.id].phase === 'delivered', 'food reaches HOME');
  assert.ok(Math.abs(food(s) - expectedHome()) < 1e-9, 'delivered food balances against actual daily meals');
  assert.equal(food(s, sourceId), before - quantity);
  const after = snapshotSect(s); viewSect(s); viewSect(s);
  assert.deepEqual(snapshotSect(s), after, 'projections preserve food and the world clock');
}

test('warehouse food returns to HOME by actual transport and is limited to the food target deficit', () => {
  const { s, stockpileId } = warehouse(), source = food(s, stockpileId), target = 32;
  assert.ok(food(s) < target);
  const patch = s.state.srEconomy.patches.food.remaining;
  const order = startFoodPolicy(s, target, stockpileId);
  assert.equal(order.cargo.food, target - food(s));
  assert.ok(order.cargo.food < 40);
  verifyDelivery(s, order, stockpileId, source, 0);
  assert.equal(s.state.srEconomy.patches.food.remaining, patch, 'stored food is reused without harvesting another batch');
});

test('a large HOME deficit sends at most forty food from the warehouse in one trip', () => {
  const { s, stockpileId } = warehouse({ stored: 60, extraFood: true }), source = food(s, stockpileId);
  const order = startFoodPolicy(s, 100, stockpileId);
  assert.ok(100 - food(s) > 40);
  assert.equal(order.cargo.food, 40);
  verifyDelivery(s, order, stockpileId, source, 0);
});

test('automatic grain delivery preserves two onsite seeds after a normally grown and harvested crop', () => {
  const s = createSectSession({ policy: { herbTarget: 0, foodTarget: 0, risk: 'cautious' } });
  const { buildingId, stockpileId } = build(s, 'granary');
  deliver(s, HOME, stockpileId, { food: 2 });
  const patch = s.state.srEconomy.patches.food.remaining;
  const invitation = command(s, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId });
  assert.equal(invitation.accepted, true);
  until(s, x => food(x, stockpileId) > 2, 'grain grows and is harvested at the field', { manual: true });
  const orderId = `work:production:${buildingId}`, production = s.state.workOrdersById[orderId];
  assert.equal(production.crop.seedUsed, 2);
  assert.equal(production.crop.growthElapsedTicks, production.crop.maturityRequiredTicks);
  const fact = s.state.factsById[`fact:production:${buildingId}:${production.batch}`];
  assert.ok(Math.abs(patch - s.state.srEconomy.patches.food.remaining - fact.grossOutput.food) < 1e-9);
  command(s, { type: 'toggle-building', buildingId });
  const source = food(s, stockpileId), order = startFoodPolicy(s, 100, stockpileId);
  assert.equal(order.cargo.food, source - 2);
  verifyDelivery(s, order, stockpileId, source, 2);
  assert.equal(food(s, stockpileId), 2);
});
