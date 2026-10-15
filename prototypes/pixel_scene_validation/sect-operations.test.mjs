import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession, commandSect, advanceSect, snapshotSect, restoreSect, viewSect } from './sect-sim.mjs';

const HOME = 'stockpile:yunxiu', MASTER = 'person:master';
function start() {
  const session = createSectSession();
  act(session, { type: 'enable-courtyard-terrain' });
  return session;
}
function act(session, request) {
  const result = commandSect(session, request);
  assert.equal(result.ok, true, result.error);
  return result;
}
function until(session, condition, label, limit = 4000) {
  for (let i = 0; i < limit && !condition(session); i++) {
    // Normal player control renewals keep this a deliberate manual chain.
    if (i % 100 === 0) act(session, { type: 'manual' });
    advanceSect(session, .1);
  }
  assert.ok(condition(session), label);
}
function saved(session) {
  const snapshot = snapshotSect(session);
  const restored = restoreSect(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(snapshotSect(restored), snapshot);
  return restored;
}
const operation = session => viewSect(session).operations;
const farm = session => operation(session).farms[0];

test('two-person checkpoint: manual seeds, voluntary work, actual harvest, delivery and study share one state', () => {
  let session = start();
  const field = farm(session), sourceHerb = session.state.resources.herb;
  assert.equal(field.herbOnSite, 0);
  const refusal = commandSect(session, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId: field.id });
  assert.equal(refusal.refused, true);
  assert.equal(farm(session).invites[0].lastResult.accepted, false);
  assert.match(farm(session).invites[0].lastResult.reason, /种苗/);
  const firstAnswer = structuredClone(session.state.personsById['person:lu-zhiwei'].schedule.invitations);
  session = saved(session);
  commandSect(session, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId: field.id });
  assert.deepEqual(session.state.personsById['person:lu-zhiwei'].schedule.invitations, firstAnswer);

  const shipment = act(session, { type: 'transport', sourceStockpileId: HOME, targetStockpileId: field.stockpileId, cargo: { herb: 2 } });
  assert.equal(session.state.resources.herb, sourceHerb - 2);
  assert.equal(farm(session).herbOnSite, 0, 'reservation is not delivery');
  assert.equal(operation(session).inventory.stockpiles.find(st => st.id === HOME).reserved.herb, 2);
  session = saved(session);
  until(session, s => s.state.workOrdersById[shipment.result.id].phase === 'delivered', 'seeds arrive');
  assert.equal(farm(session).herbOnSite, 2);
  assert.equal(farm(session).seedNeeded, 0);
  assert.equal(act(session, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId: field.id }).result.accepted, true);
  assert.equal(session.state.personsById['person:lu-zhiwei'].personId, 'person:lu-zhiwei');
  until(session, s => !!viewSect(s).crop.lastHarvest, 'NPC reaches work position and harvests');
  act(session, { type: 'toggle-building', buildingId: field.id });
  const harvest = viewSect(session).crop.lastHarvest;
  assert.ok(harvest.quantity > 0);
  assert.equal(session.state.resources.herb, sourceHerb - 2, 'harvest remains in the field');
  const quantity = Math.min(40, farm(session).herbOnSite - 2);
  const delivery = act(session, { type: 'transport', sourceStockpileId: field.stockpileId, targetStockpileId: HOME, cargo: { herb: quantity } });
  session = saved(session);
  until(session, s => s.state.workOrdersById[delivery.result.id].phase === 'delivered', 'harvest is physically delivered');
  assert.equal(farm(session).herbOnSite, 2, 'next crop seed retained');
  assert.equal(session.state.resources.herb, sourceHerb - 2 + quantity);
  assert.equal(Object.values(session.state.factsById).filter(f => f.id === harvest.factId).length, 1);

  const before = session.state.master.artsById.qingyuan.understanding;
  const study = act(session, { type: 'study', artId: 'qingyuan' });
  assert.equal(operation(session).study.progressTicks, 0);
  assert.equal(session.state.master.artsById.qingyuan.understanding, before);
  session = saved(session);
  until(session, s => s.state.srCultivation.orders[study.result.orderId].phase === 'completed', 'study at actual desk completes');
  assert.equal(session.state.master.artsById.qingyuan.understanding, before + 12);
  assert.equal(session.state.master.artsById.qingyuan.mastery, 0, 'reading does not grant combat practice');
  const afterStudy = saved(session);
  assert.equal(afterStudy.state.srCultivation.orders[study.result.orderId].phase, 'completed');
  const xp = session.state.master.xp;
  act(session, { type: 'cultivate' });
  until(session, s => s.state.master.xp > xp, 'actual cultivation grows the same master');
  saved(session);
});

test('study cancellation refunds only before actual work and refuses duplicate costs or unknown arts', () => {
  let session = start();
  const food = session.state.resources.food;
  act(session, { type: 'study', artId: 'qingguard' });
  assert.equal(session.state.resources.food, food - 2);
  const foodSummary = operation(session).inventory.summary.find(group => group.id === 'public').amounts.food;
  assert.equal(foodSummary.available, food - 2);
  assert.equal(foodSummary.reserved, 2);
  assert.equal(foodSummary.total, food);
  assert.equal(commandSect(session, { type: 'study', artId: 'qingguard' }).ok, false);
  assert.equal(session.state.resources.food, food - 2);
  session = saved(session);
  act(session, { type: 'cancel-activity' });
  assert.equal(session.state.resources.food, food);
  act(session, { type: 'cancel-activity' });
  assert.equal(session.state.resources.food, food);
  const next = act(session, { type: 'study', artId: 'qingguard' });
  until(session, s => s.state.srCultivation.orders[next.result.orderId].progressTicks >= 10, 'actual study begins');
  const beforeCancel = session.state.resources.food;
  session = saved(session);
  act(session, { type: 'cancel-activity' });
  assert.equal(session.state.resources.food, beforeCancel, 'already consumed meal is not refunded');
  const state = JSON.stringify(session.state);
  assert.equal(commandSect(session, { type: 'study', artId: 'F2-001' }).ok, false);
  assert.equal(commandSect(session, { type: 'heal' }).ok, false);
  assert.equal(JSON.stringify(session.state), state);
});

test('public operations are read-only, preserve private supplies, and keep missing materials recoverable', () => {
  let session = start();
  const before = snapshotSect(session), projection = operation(session);
  operation(session);
  assert.deepEqual(snapshotSect(session), before);
  assert.deepEqual(projection.arts.map(a => a.id), ['qingyuan', 'qingwind', 'qingguard']);
  assert.ok(projection.inventory.stockpiles.every(st => st.access === 'public' || st.ownerId === MASTER));
  assert.equal(Object.hasOwn(projection.farms[0].invites[0], 'score'), false);
  assert.equal(projection.harvest.find(source => source.id === 'stone').replenish.available, false);
  const failed = commandSect(session, { type: 'transport', sourceStockpileId: HOME, targetStockpileId: farm(session).stockpileId, cargo: { herb: 7 } });
  assert.equal(failed.ok, false);
  assert.deepEqual(snapshotSect(session), before, 'rejected request cannot leave reservations or abandon work');
  act(session, { type: 'harvest', resource: 'food' });
  until(session, s => (s.state.stockpilesById['stockpile:carried:master']?.resources.food || 0) === 16, 'gathered food stays carried');
  const publicFood = session.state.resources.food;
  const delivered = act(session, { type: 'transport', sourceStockpileId: 'stockpile:carried:master', targetStockpileId: HOME, cargo: { food: 16 } });
  session = saved(session);
  until(session, s => s.state.workOrdersById[delivered.result.id].phase === 'delivered', 'food reaches public pantry');
  assert.ok(session.state.resources.food > publicFood);
  assert.equal(session.state.stockpilesById['stockpile:carried:master'].resources.food, 0);
  saved(session);
});

test('work invitations and facility choices preserve an ongoing manual walk intent', () => {
  const session = start();
  act(session, { type: 'move', x: 14, y: 44.6 });
  const intent = session.automation.activeAction;
  assert.equal(intent, 'manual-walk');
  commandSect(session, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId: farm(session).id });
  assert.equal(session.automation.activeAction, intent);
  act(session, { type: 'toggle-building', buildingId: farm(session).id });
  assert.equal(session.automation.activeAction, intent);
  saved(session);
});
