import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession, commandSect, advanceSect, snapshotSect, restoreSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';
import { grantPills } from '../../../src/simulation/ea-sr-economy.mjs';

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
  assert.equal(operation(session).actionConsequences.requiresConfirmation, false);
  assert.deepEqual(operation(session).actionConsequences.refunded, { food: 2 });
  const foodSummary = operation(session).inventory.summary.find(group => group.id === 'public').amounts.food;
  assert.equal(foodSummary.available, food - 2);
  assert.equal(foodSummary.reserved, 2);
  assert.equal(foodSummary.total, food);
  assert.equal(commandSect(session, { type: 'study', artId: 'qingguard' }).ok, false);
  assert.equal(session.state.resources.food, food - 2);
  session = saved(session);
  const refunded = act(session, { type: 'cancel-activity' });
  assert.match(refunded.message, /口粮2份已退回山院公库/);
  assert.equal(session.state.resources.food, food);
  act(session, { type: 'cancel-activity' });
  assert.equal(session.state.resources.food, food);
  const next = act(session, { type: 'study', artId: 'qingguard' });
  until(session, s => s.state.srCultivation.orders[next.result.orderId].progressTicks >= 10, 'actual study begins');
  const beforeCancel = session.state.resources.food;
  assert.equal(operation(session).actionConsequences.requiresConfirmation, true);
  assert.deepEqual(operation(session).actionConsequences.consumed, { food: 2 });
  assert.equal(operation(session).study.stageLabel, '研读中');
  session = saved(session);
  const interrupted = act(session, { type: 'rest' });
  assert.match(interrupted.message, /口粮2份已耗用/);
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
  assert.equal(projection.arts[0].kindLabel, '主修心法');
  assert.equal(projection.arts[0].chapterLabel, '炼气篇');
  assert.equal(projection.arts[0].durationSeconds, 8, 'formal study is 80 shared 100ms ticks');
  assert.equal(projection.arts[0].understandingGain, 12);
  assert.equal(projection.arts[0].masteryGain, 0);
  assert.equal(projection.arts[0].conditions.find(c => c.id === 'energy').required, 20);
  assert.equal(projection.arts.find(a => a.id === 'qingwind').roleLabel, '当前攻击法门');
  assert.match(projection.arts.find(a => a.id === 'qingwind').purpose, /伤敌/);
  assert.equal(projection.master.breakthrough.entryAvailable, false);
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

test('large crop preview caps one trip, preserves seedlings, and cancellation leaves a recoverable physical parcel', () => {
  let session = start();
  const field = farm(session);
  const seed = act(session, { type: 'transport', sourceStockpileId: HOME, targetStockpileId: field.stockpileId, cargo: { herb: 2 } });
  until(session, s => s.state.workOrdersById[seed.result.id].phase === 'delivered', 'seed reaches field');
  act(session, { type: 'invite-work', personId: 'person:lu-zhiwei', buildingId: field.id });
  until(session, s => farm(s).herbOnSite > 42, 'multiple actual crop harvests exceed one carrying load', 12000);
  act(session, { type: 'toggle-building', buildingId: field.id });
  const preview = farm(session).harvestTransport, total = farm(session).herbOnSite;
  assert.equal(preview.quantity, 40);
  assert.equal(preview.retained, 2);
  assert.ok(preview.remaining > 0);
  const request = { type: 'transport', sourceStockpileId: preview.sourceStockpileId, targetStockpileId: preview.targetStockpileId, cargo: { herb: preview.quantity } };
  act(session, request);
  assert.equal(operation(session).actionConsequences.requiresConfirmation, false);
  const beforePickup = act(session, { type: 'cancel-activity' });
  assert.match(beforePickup.message, /已退回灵草田货位/);
  assert.equal(farm(session).herbOnSite, total);
  assert.equal(operation(session).inventory.stockpiles.filter(st => st.dropped).length, 0);

  const delivery = act(session, request);
  until(session, s => s.state.workOrdersById[delivery.result.id].phase === 'carrying', 'master has actually picked up crop');
  assert.equal(operation(session).actionConsequences.requiresConfirmation, true);
  assert.equal(operation(session).inventory.stockpiles.find(st => st.id === field.stockpileId).inTransit.herb, 40);
  const cancelled = act(session, { type: 'cancel-activity' });
  assert.match(cancelled.message, /留在.*可从物资页回收/);
  const droppedId = cancelled.result.returnedTo;
  session = saved(session);
  const parcel = operation(session).inventory.stockpiles.find(st => st.id === droppedId);
  assert.match(parcel.label, /落地包裹/);
  assert.equal(parcel.label.includes('stockpile:'), false);
  assert.ok(Number.isFinite(parcel.position.x));
  assert.equal(parcel.items.find(item => item.id === 'herb').available, 40);
  assert.equal(parcel.recovery.available, true, parcel.recovery.reason);
  const publicHerb = session.state.resources.herb;
  const recovery = act(session, { type: 'transport', sourceStockpileId: parcel.id, targetStockpileId: parcel.recovery.targetStockpileId, cargo: parcel.recovery.cargo });
  until(session, s => s.state.workOrdersById[recovery.result.id].phase === 'delivered', 'parcel physically reaches public store');
  assert.equal(session.state.resources.herb, publicHerb + 40);
  // Production is booked in decimal nanounits; binary subtraction has a tail.
  assert.equal(Math.round(farm(session).herbOnSite * 1e9), Math.round(total * 1e9) - 40e9);
  assert.ok(farm(session).herbOnSite >= 2);
  assert.equal(operation(session).inventory.stockpiles.find(st => st.id === droppedId).recovery.available, false);
  saved(session);
});

test('positioned pill fixture uses named item rows and the same reserved and in-transit ledger', () => {
  let session = start();
  // This controlled inventory fixture isolates presentation. Transport and cancel
  // still execute the public command path and retain the allocation's location.
  grantPills(session.state, HOME, 'heal', 2, { factId: 'fact:qa:operations-pill-display' });
  const initial = operation(session), home = initial.inventory.stockpiles.find(st => st.id === HOME);
  assert.equal(home.items.find(item => item.id === 'pill:heal').name, '回春散');
  assert.equal(home.items.find(item => item.id === 'pill:heal').available, 2);
  assert.equal(initial.inventory.summary[0].amounts['pill:heal'].name, '回春散');
  assert.equal(initial.inventory.summary[0].amounts.insight.transportable, false);
  assert.equal(initial.inventory.summary[0].amounts.insight.kind, 'knowledge-budget');
  const request = { type: 'transport', sourceStockpileId: HOME, targetStockpileId: 'stockpile:carried:master', cargo: { 'pill:heal': 1 } };
  const delivery = act(session, request);
  let item = operation(session).inventory.stockpiles.find(st => st.id === HOME).items.find(item => item.id === 'pill:heal');
  assert.deepEqual([item.available, item.reserved, item.inTransit, item.total], [1, 1, 0, 2]);
  until(session, s => s.state.workOrdersById[delivery.result.id].phase === 'carrying', 'master picks up the actual pill');
  session = saved(session);
  item = operation(session).inventory.stockpiles.find(st => st.id === HOME).items.find(item => item.id === 'pill:heal');
  assert.deepEqual([item.available, item.reserved, item.inTransit, item.total], [1, 0, 1, 2]);
  const cancelled = act(session, { type: 'cancel-activity' });
  const parcel = operation(session).inventory.stockpiles.find(st => st.id === cancelled.result.returnedTo);
  assert.equal(parcel.items.find(item => item.id === 'pill:heal').name, '回春散');
  assert.deepEqual(parcel.recovery.cargo, { 'pill:heal': 1 });
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
