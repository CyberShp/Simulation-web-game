import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession, commandSect, advanceSect, snapshotSect, restoreSect, validateSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';

const HOME = 'stockpile:yunxiu', CARRIED = 'stockpile:carried:master';
const food = s => s.state.stockpilesById[HOME].resources.food;
const facts = s => Object.values(s.state.factsById);
const active = s => s.state.activitiesById[s.state.master.activityId];
function until(s, predicate, seconds = 600) {
  for (let n = 0; n < seconds * 10 && !predicate(s); n++) advanceSect(s, .1);
  assert.ok(predicate(s), s.reason);
}
function auto(policy = {}) {
  const s = createSectSession({ policy: { risk: 'balanced', ...policy } });
  assert.equal(commandSect(s, { type: 'auto' }).ok, true);
  return s;
}
// Explicit unit fixtures cover failure boundaries; normal-loop tests below use
// the unchanged public-command checkpoint and only the policy command.
function corner({ stockFood = 12, source = 0, jade = 20, cap = 4, target = 32, risk = 'balanced' } = {}) {
  const s = auto({ foodTarget: target, spendingCap: cap, risk });
  s.state.stockpilesById[HOME].resources.food = stockFood;
  s.state.stockpilesById[HOME].resources.jade = jade;
  s.state.srEconomy.patches.food.remaining = source;
  return restoreSect(snapshotSect(s));
}

test('normal two-person checkpoint repeatedly collects and delivers food through twenty-five simulated minutes', () => {
  const s = auto(), start = snapshotSect(s), foodReceipts = [];
  for (let n = 0; n < 1500; n++) {
    advanceSect(s, 1);
    assert.equal(s.state.economy.starvation, 0, `starvation at ${n} seconds`);
  }
  // Daily consumption may have just crossed the target at the sampling edge.
  // Require the resulting physical trip to refill it within one supply day.
  until(s, x => food(x) >= x.policy.foodTarget, 120);
  for (const f of facts(s)) if (f.operation === 'manual-harvest' && f.resource === 'food') foodReceipts.push(f);
  assert.ok(foodReceipts.length >= 2);
  assert.ok(food(s) >= s.policy.foodTarget);
  assert.ok(s.state.stockpilesById[HOME].resources.herb >= s.policy.herbTarget);
  assert.ok(Object.values(s.state.workOrdersById).filter(w => w.kind === 'transport' && w.phase === 'delivered' && w.sourceStockpileId === CARRIED && w.targetStockpileId === HOME && w.cargo.food === 16).length >= 2);
  assert.equal(s.state.srEconomy.patches.food.remaining, start.state.srEconomy.patches.food.remaining - foodReceipts.reduce((n, f) => n + f.quantity, 0));
  const copy = snapshotSect(s); viewSect(s); viewSect(s);
  assert.deepEqual(snapshotSect(s), copy, 'UI reads cannot produce or consume food');
  assert.equal(validateSect(s), true);
});

test('public food target consumes a finite source, funds restoration once and resumes collection across reloads', () => {
  let s = auto({ foodTarget: 320, spendingCap: 4 });
  until(s, x => active(x)?.kind === 'sr-harvest' && active(x).resource === 'food');
  let saved = snapshotSect(s); s = restoreSect(saved); assert.deepEqual(snapshotSect(s), saved);
  until(s, x => active(x)?.kind === 'sr-transport' && x.state.workOrdersById[active(x).workOrderId]?.cargo.food > 0);
  saved = snapshotSect(s); s = restoreSect(saved); assert.deepEqual(snapshotSect(s), saved);
  until(s, x => active(x)?.kind === 'sr-replenish' && active(x).resource === 'food');
  const patchBefore = s.state.srEconomy.patches.food.remaining;
  assert.ok(patchBefore <= 80);
  assert.ok(food(s) >= 4, 'one day of food remains after reserving seed food');
  assert.equal(s.budget.spent, 4);
  saved = snapshotSect(s);
  const twin = restoreSect(JSON.stringify(saved));
  advanceSect(s, 90); advanceSect(twin, 90);
  assert.deepEqual(snapshotSect(twin), snapshotSect(s), 'restoration resumes identically without duplicate payment');
  const restoration = facts(s).filter(f => f.operation === 'replenish' && f.resource === 'food');
  assert.equal(restoration.length, 1);
  assert.deepEqual(restoration[0].cost, { food: 8, jade: 4 });
  assert.ok(facts(s).some(f => f.operation === 'manual-harvest' && f.resource === 'food' && f.atTick > restoration[0].atTick));
  assert.equal(s.budget.orders.length, 1);
  assert.equal(validateSect(s), true);
});

test('a hungry unit fixture can gather and deliver before starvation clears at the next daily supply', () => {
  const s = corner({ stockFood: 0, source: 80, cap: 0 });
  s.state.economy.starvation = 2;
  until(s, x => food(x) >= 16, 120);
  assert.ok(facts(s).some(f => f.operation === 'manual-harvest' && f.resource === 'food'));
  until(s, x => x.state.economy.starvation === 0, 120);
  assert.ok(food(s) > 0);
  assert.equal(s.budget.spent, 0);
});

test('permission, budget, treasury and seed reserve failures do not spend or replace the source', () => {
  for (const [options, reason] of [
    [{ risk: 'cautious', source: 80 }, /守院生产/],
    [{ cap: 0 }, /额度不足/],
    [{ jade: 3 }, /公库不足4灵石/],
    [{ stockFood: 8 }, /至少12份/],
  ]) {
    const s = corner(options), before = snapshotSect(s);
    advanceSect(s, 1);
    assert.equal(s.budget.spent, 0);
    assert.equal(s.state.srEconomy.patches.food.remaining, before.state.srEconomy.patches.food.remaining);
    assert.equal(s.state.stockpilesById[HOME].resources.jade, before.state.stockpilesById[HOME].resources.jade);
    assert.match(viewSect(s).foodSupply.reason, reason);
    assert.equal(facts(s).some(f => f.operation === 'replenish' && f.resource === 'food'), false);
  }
});

test('a hungry full herb pack is delivered before food gathering and its blocking reason is visible', () => {
  const s = createSectSession();
  for (let batch = 0; batch < 3; batch++) {
    assert.equal(commandSect(s, { type: 'harvest', resource: 'herb' }).ok, true);
    until(s, x => active(x)?.kind !== 'sr-harvest', 30);
  }
  const fixture = snapshotSect(s);
  fixture.state.stockpilesById[HOME].resources.food = 0;
  fixture.state.economy.starvation = 2;
  const hungry = restoreSect(fixture);
  commandSect(hungry, { type: 'policy', policy: { risk: 'balanced' } });
  assert.equal(hungry.state.stockpilesById[CARRIED].resources.herb, 30);
  assert.match(viewSect(hungry).foodSupply.reason, /包裹装不下/);
  commandSect(hungry, { type: 'auto' });
  until(hungry, x => food(x) >= 16, 120);
  assert.equal(hungry.state.stockpilesById[CARRIED].resources.herb, 0);
  assert.ok(Object.values(hungry.state.workOrdersById).some(w => w.phase === 'delivered' && w.sourceStockpileId === CARRIED && w.cargo.herb === 30));
  until(hungry, x => x.state.economy.starvation === 0, 120);
  assert.equal(validateSect(hungry), true);
});

test('zero food target leaves automatic food gathering disabled and bad targets preserve the session', () => {
  const s = corner({ target: 0, stockFood: 0, source: 80 });
  advanceSect(s, 10);
  assert.equal(s.ledger.some(e => e.autonomous && /口粮|采粮/.test(e.text)), false);
  assert.equal(viewSect(s).foodSupply.status, 'disabled');
  const before = snapshotSect(s);
  for (const foodTarget of [-1, 501, 1.5, null, '32']) {
    assert.equal(commandSect(s, { type: 'policy', policy: { foodTarget } }).ok, false);
    assert.deepEqual(snapshotSect(s), before);
  }
});

test('food collection respects manual takeover and pause, and finishes its current work after target is disabled', () => {
  const s = auto({ foodTarget: 100 });
  until(s, x => active(x)?.kind === 'sr-harvest' && active(x).resource === 'food');
  const id = s.state.master.activityId;
  commandSect(s, { type: 'manual' });
  commandSect(s, { type: 'policy', policy: { foodTarget: 0 } });
  commandSect(s, { type: 'pause', paused: true });
  const saved = snapshotSect(s); advanceSect(s, 60);
  assert.deepEqual(snapshotSect(s), saved);
  const reloaded = restoreSect(saved); commandSect(reloaded, { type: 'pause', paused: false });
  until(reloaded, x => x.state.master.activityId !== id, 30);
  assert.equal(reloaded.control.mode, 'manual');
  assert.equal(reloaded.state.stockpilesById[CARRIED].resources.food, 16);
  assert.equal(validateSect(reloaded), true);
});

test('legacy policy adds only its default food goal and both valid budget receipt shapes survive reload', () => {
  const old = snapshotSect(createSectSession()); delete old.policy.foodTarget;
  const untouched = structuredClone(old), migrated = restoreSect(old);
  assert.equal(migrated.policy.foodTarget, 32);
  assert.deepEqual(migrated.state, old.state);
  assert.deepEqual(old, untouched);
  const s = corner();
  until(s, x => x.budget.spent === 4, 10);
  assert.equal(validateSect(restoreSect(snapshotSect(s))), true);
  for (const mutate of [x => x.budget.orders[0].jade = 8, x => x.budget.orders[0].food = 9, x => x.budget.orders[0].resource = 'herb', x => x.budget.spent = 0]) {
    const bad = snapshotSect(s); mutate(bad); assert.throws(() => restoreSect(bad));
  }
});
