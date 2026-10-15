import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectSeed } from './sect-seed-build.mjs';
import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect } from './sect-sim.mjs';
import { COURTYARD_EAST_ROAD } from '../../dist/ea-sect-domain.mjs';
import { meterFindPath, meterSweep, spatialSlots } from '../../dist/ea-sr-spatial.mjs';

const SITE = 'site:domain:east-residence-1', HOME = 'stockpile:yunxiu';
const order = session => session.state.workOrdersById[session.state.activitiesById[session.state.master.activityId]?.workOrderId];
const quantity = cargo => Object.values(cargo).reduce((sum, value) => sum + value, 0);
const call = (session, request) => {
  const result = commandSect(session, request);
  assert.equal(result.ok, true, result.error);
  return result;
};
function until(session, predicate, limit = 5000) {
  let steps = 0;
  while (!predicate(session) && steps++ < limit) advanceSect(session, .1);
  assert.ok(predicate(session), `未到达预期阶段：${order(session)?.materialFlow?.phase || session.reason}`);
}
function preciseResume(session, ticks = 7) {
  const saved = snapshotSect(session), restored = restoreSect(JSON.stringify(saved));
  assert.deepEqual(snapshotSect(restored), saved);
  advanceSect(session, ticks / 10);
  advanceSect(restored, ticks / 10);
  assert.deepEqual(snapshotSect(restored), snapshotSect(session));
}
function readySession() {
  const session = createSectSession();
  call(session, { type: 'enable-courtyard-terrain' });
  for (let batch = 0; batch < 2; batch++) {
    call(session, { type: 'harvest', resource: 'wood' });
    until(session, value => value.state.activitiesById[value.state.master.activityId]?.kind !== 'sr-harvest');
  }
  assert.equal(session.state.stockpilesById['stockpile:carried:master'].resources.wood, 24);
  call(session, { type: 'transport', sourceStockpileId: 'stockpile:carried:master', targetStockpileId: HOME, cargo: { wood: 24 } });
  until(session, value => value.state.activitiesById[value.state.master.activityId]?.kind !== 'sr-transport');
  assert.equal(session.state.stockpilesById[HOME].resources.wood, 49);
  return session;
}

test('east opening preserves the original 96 metre world and supplies the shared official road', () => {
  const session = createSectSession({ source: buildSectSeed({ enableDomain: false }) });
  const before = snapshotSect(session);
  call(session, { type: 'enable-domain' });
  assert.deepEqual(session.state.personsById, before.state.personsById);
  assert.deepEqual(session.state.stockpilesById, before.state.stockpilesById);
  assert.deepEqual(session.state.buildingsById, before.state.buildingsById);
  assert.equal(session.state.worldTick, before.state.worldTick);
  preciseResume(session, 0);
  call(session, { type: 'enable-courtyard-terrain' });
  const source = session.state.stockpilesById[HOME].position, target = { x: 135, y: 46.6 };
  const route = meterFindPath(session.state, source, target, { maxSnap: 0 });
  assert.ok(route);
  for (const gate of COURTYARD_EAST_ROAD) assert.ok(route.some(point => Math.hypot(point.x - gate.x, point.y - gate.y) < 1e-7));
  for (const [index, to] of route.entries()) assert.equal(meterSweep(session.state, index ? route[index - 1] : source, to).blocked, false);
  const backwards = meterFindPath(session.state, target, source, { maxSnap: 0 });
  for (const gate of [...COURTYARD_EAST_ROAD].reverse()) assert.ok(backwards.some(point => Math.hypot(point.x - gate.x, point.y - gate.y) < 1e-7));
  assert.equal(meterFindPath(session.state, source, { x: 110, y: 20 }, { maxSnap: 0 }), null);
});

test('a material shortage refuses construction with the complete source world preserved', () => {
  const session = createSectSession();
  call(session, { type: 'enable-courtyard-terrain' });
  const before = snapshotSect(session), site = viewSect(session).domain.sites[0];
  assert.deepEqual(site.cost, { jade: 45, wood: 40, stone: 20 });
  assert.deepEqual(site.missingCost, { wood: 15 });
  assert.equal(site.buildAvailable.available, false);
  assert.equal(commandSect(session, { type: 'build-site', siteId: SITE }).ok, false);
  assert.deepEqual(snapshotSect(session), before);
  assert.equal(site.completedCapacity, 0);
});

test('normal gathering funds two real material trips, on-site work and four reachable beds with exact resumes', () => {
  const session = readySession(), people = Object.keys(session.state.personsById);
  call(session, { type: 'build-site', siteId: SITE });
  const workId = order(session).id;
  until(session, value => order(value)?.materialFlow.phase === 'carrying' && value.state.master.scenic.x > 96);
  assert.equal(order(session).progressTicks, 0);
  assert.deepEqual(order(session).materialFlow.cargo, { wood: 40 });
  preciseResume(session);
  until(session, value => order(value)?.materialFlow.trips.length === 2 && order(value).materialFlow.phase === 'carrying' && value.state.master.scenic.x > 96);
  assert.equal(order(session).progressTicks, 0);
  assert.deepEqual(order(session).materialFlow.cargo, { stone: 20 });
  const carrying = viewSect(session).construction.materialFlow;
  assert.equal(carrying.currentTrip, 2);
  assert.equal(carrying.deliveredQuantity, 40);
  assert.equal(carrying.requiredQuantity, 60);
  assert.equal(carrying.carryCapacity, 40);
  preciseResume(session);
  until(session, value => order(value)?.progressTicks > 10);
  const construction = order(session);
  assert.equal(construction.materialFlow.phase, 'ready');
  assert.ok(construction.workSlots.some(slot => slot.occupantId && slot.firstArrivalTick !== null));
  assert.equal(viewSect(session).domain.sites[0].completedCapacity, 0);
  preciseResume(session);
  until(session, value => !value.state.workOrdersById[workId]);
  const site = viewSect(session).domain.sites[0], building = session.state.buildingsById[site.buildingId];
  assert.equal(site.status, 'complete');
  assert.equal(site.completedCapacity, 4);
  const beds = spatialSlots(building, 'rest');
  assert.equal(beds.length, 4);
  for (const bed of beds) assert.ok(meterFindPath(session.state, site.entrance, bed.position, { maxSnap: 0 }));
  const receipt = session.state.spatial.completedOrders.find(item => item.id === workId);
  assert.deepEqual(receipt.usedCost, { jade: 45, wood: 40, stone: 20 });
  assert.equal(receipt.materialTrips.length, 2);
  assert.deepEqual(receipt.materialTrips.map(trip => quantity(trip.cargo)), [40, 20]);
  assert.ok(receipt.materialTrips.every(trip => trip.phase === 'delivered' && trip.finishedTick > trip.startedTick));
  assert.deepEqual(Object.keys(session.state.personsById), people);
  preciseResume(session, 0);
});

test('interrupting a carried construction load returns it through the road before refunding once', () => {
  const session = readySession();
  call(session, { type: 'build-site', siteId: SITE });
  const workId = order(session).id;
  until(session, value => order(value)?.materialFlow.phase === 'carrying' && value.state.master.scenic.x > 96);
  const pending = viewSect(session).operations.master.actions.cancel.consequence;
  assert.equal(pending.pendingReturn, true);
  assert.deepEqual(pending.refunded, {});
  const before = snapshotSect(session), cancelled = call(session, { type: 'cancel-activity' });
  assert.equal(cancelled.result.pending, true);
  assert.equal(order(session).materialFlow.cancelRequested, true);
  assert.deepEqual(session.state.stockpilesById[HOME].resources, before.state.stockpilesById[HOME].resources);
  assert.equal(viewSect(session).construction.materialFlow.stageLabel, '返料中');
  assert.equal(viewSect(session).operations.master.actions.cancel.available, false);
  const returning = snapshotSect(session);
  assert.equal(commandSect(session, { type: 'move', x: 20, y: 30 }).ok, false);
  assert.deepEqual(snapshotSect(session), returning);
  preciseResume(session);
  until(session, value => !value.state.workOrdersById[workId]);
  const receipt = session.state.spatial.completedOrders.find(item => item.id === workId);
  assert.equal(receipt.phase, 'cancelled');
  assert.equal(receipt.domainSiteId, SITE);
  assert.deepEqual(receipt.refund, { jade: 45, wood: 40, stone: 20 });
  assert.equal(receipt.materialTrips[0].phase, 'returned');
  assert.equal(session.state.stockpilesById[HOME].resources.wood, 49);
  assert.equal(session.state.stockpilesById[HOME].resources.stone, 25);
  assert.equal(viewSect(session).domain.sites[0].completedCapacity, 0);
  const after = structuredClone(session.state.stockpilesById[HOME].resources);
  call(session, { type: 'cancel-activity' });
  assert.deepEqual(session.state.stockpilesById[HOME].resources, after);
  assert.equal(session.state.spatial.completedOrders.filter(item => item.id === workId).length, 1);
});

test('interrupting on-site work keeps installed costs and physically retrieves the remaining materials across reloads', () => {
  const session = readySession();
  call(session, { type: 'build-site', siteId: SITE });
  const workId = order(session).id;
  until(session, value => order(value)?.progressTicks >= 40);
  const used = structuredClone(order(session).usedCost), consequence = viewSect(session).operations.master.actions.cancel.consequence;
  assert.ok(used.wood > 0 && used.stone > 0);
  assert.deepEqual(consequence.consumed, used);
  const result = call(session, { type: 'cancel-activity' });
  assert.equal(result.result.pending, true);
  preciseResume(session);
  until(session, value => order(value)?.materialFlow.phase === 'returning' && value.state.master.scenic.x > 96 && value.state.master.scenic.x < 120);
  preciseResume(session);
  until(session, value => !value.state.workOrdersById[workId]);
  const receipt = session.state.spatial.completedOrders.find(item => item.id === workId);
  assert.deepEqual(receipt.usedCost, used);
  assert.deepEqual(receipt.refund, { jade: 45 - used.jade, wood: 40 - used.wood, stone: 20 - used.stone });
  assert.ok(receipt.materialTrips.filter(trip => trip.kind === 'return').every(trip => quantity(trip.cargo) <= 40 && trip.phase === 'returned'));
  assert.equal(session.state.stockpilesById[HOME].resources.wood, 49 - used.wood);
  assert.equal(session.state.stockpilesById[HOME].resources.stone, 25 - used.stone);
  assert.equal(viewSect(session).domain.sites[0].status, 'available');
  preciseResume(session, 0);
});
