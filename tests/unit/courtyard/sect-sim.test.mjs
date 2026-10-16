import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import { buildSectSeed } from '../../../apps/courtyard/sect-seed-build.mjs';
import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect, validateSect } from '../../../apps/courtyard/sect-sim.mjs';

const publicHerb = s => s.state.stockpilesById['stockpile:yunxiu'].resources.herb;
function until(s, predicate, limit = 6000) {
  for (let i = 0; i < limit && !predicate(s); i++) advanceSect(s, .1);
  assert.ok(predicate(s), `condition not reached: ${s.reason}`);
}
function automatic(policy = {}) {
  const s = createSectSession({ policy });
  assert.equal(commandSect(s, { type: 'auto' }).ok, true);
  return s;
}

test('two-member checkpoint is reproduced with the recorded official command lineage', () => {
  const rebuilt = buildSectSeed();
  // Historical source hashes describe the shipped checkpoint. Current code may
  // change while reproducing the exact same world and official command trace.
  assert.deepEqual(rebuilt.state, seed.state);
  const { sourceFiles: historicalSources, ...historicalProvenance } = seed.provenance;
  const { sourceFiles: currentSources, ...currentProvenance } = rebuilt.provenance;
  assert.deepEqual(currentProvenance, historicalProvenance);
  const currentPath = name => name.startsWith('dist/') ? name.replace(/^dist\//, 'src/simulation/')
    : name.startsWith('godot/') ? `archive/${name}` : name;
  assert.deepEqual(Object.keys(currentSources), Object.keys(historicalSources).map(currentPath));
  assert.equal(createHash('sha256').update(JSON.stringify(seed.state)).digest('hex'), seed.provenance.stateSha256);
  assert.deepEqual(seed.state.homeMemberIds, ['person:lu-zhiwei']);
  assert.ok(seed.state.factsById['fact:opening:gift']);
  assert.equal(seed.state.story.opening.invitation, 'joined');
  assert.deepEqual(Object.values(seed.state.buildingsById).map(b => b.type), ['hall', 'farm']);
  assert.equal(seed.provenance.trace.at(-1).name, 'enableSectDomain');
  const domain = viewSect(createSectSession()).domain;
  assert.equal(domain.enabled, true);
  assert.equal(domain.sites[0].status, 'available');
  assert.deepEqual(domain.sites[0].cost, { jade: 45, wood: 40, stone: 20 });
});

test('an existing courtyard save opens the east domain only through its explicit public command', () => {
  const oldSource = buildSectSeed({ enableDomain: false });
  const s = restoreSect(snapshotSect(createSectSession({ source: oldSource })));
  const before = snapshotSect(s), oldView = viewSect(s);
  assert.equal(oldView.domain.enabled, false);
  assert.equal(oldView.width, 96);
  assert.equal(oldView.domain.openedAreas.length, 1);
  assert.equal(oldView.domain.sites[0].status, 'locked');
  assert.equal(commandSect(s, { type: 'enable-domain' }).ok, true);
  const expanded = viewSect(s);
  assert.equal(expanded.domain.enabled, true);
  assert.deepEqual(expanded.bounds, { x: 0, y: 0, width: 160, height: 96 });
  assert.deepEqual(s.state.personsById, before.state.personsById);
  assert.deepEqual(s.state.stockpilesById, before.state.stockpilesById);
  assert.deepEqual(s.state.buildingsById, before.state.buildingsById);
  assert.deepEqual(s.control, before.control);
  assert.equal(s.state.worldTick, before.state.worldTick);
  assert.equal(commandSect(s, { type: 'move', x: 135, y: 46.6 }).ok, true);
  assert.deepEqual(s.state.master.scenic.goal, { x: 135, y: 46.6 });
  advanceSect(s, 10);
  const walking = snapshotSect(s);
  assert.equal(commandSect(s, { type: 'move', x: 110, y: 20 }).ok, false, 'closed slope remains unavailable');
  assert.deepEqual(snapshotSect(s), walking, 'rejected terrain keeps the current route and control intact');
  const restored = restoreSect(JSON.stringify(walking));
  assert.deepEqual(snapshotSect(restored), walking);
  advanceSect(s, 15);
  advanceSect(restored, 15);
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  assert.ok(s.state.master.scenic.x > 80, 'the formal body actually follows the east route');
  advanceSect(s, 5);
  assert.equal(s.control.mode, 'auto');
  assert.deepEqual(s.state.master.scenic.goal, { x: 135, y: 46.6 }, 'the handoff retains the ongoing legal walk');
  const handoffReload = restoreSect(JSON.stringify(snapshotSect(s)));
  assert.deepEqual(snapshotSect(handoffReload), snapshotSect(s));
  const replacement = restoreSect(snapshotSect(s));
  assert.equal(commandSect(replacement, { type: 'move', x: 128, y: 46 }).ok, true, 'a new player route can replace the unfinished walk');
  assert.equal(replacement.control.mode, 'manual');
  assert.deepEqual(replacement.state.master.scenic.goal, { x: 128, y: 46 });
  until(s, v => Math.hypot(v.state.master.scenic.x - 135, v.state.master.scenic.y - 46.6) < .01);
  until(handoffReload, v => Math.hypot(v.state.master.scenic.x - 135, v.state.master.scenic.y - 46.6) < .01);
  assert.deepEqual(snapshotSect(handoffReload), snapshotSect(s));
  const arrivalTick = s.state.worldTick;
  assert.ok(arrivalTick > before.state.worldTick + 300);
  advanceSect(s, 2);
  assert.ok(s.ledger.some(e => e.kind === 'autonomous-action' && e.tick >= arrivalTick), 'new autonomous work starts after arrival');
  assert.equal(validateSect(s), true);
});

test('real wood collection and public delivery fund east construction whose carried materials survive a boundary reload', () => {
  const s = createSectSession(), siteId = 'site:domain:east-residence-1';
  const before = snapshotSect(s);
  assert.equal(commandSect(s, { type: 'build-site', siteId }).ok, false, '25 wood cannot fund the 40 wood house');
  assert.deepEqual(snapshotSect(s), before, 'failed construction preserves the starting world');
  for (let batch = 0; batch < 2; batch++) {
    assert.equal(commandSect(s, { type: 'harvest', resource: 'wood' }).ok, true);
    const underway = snapshotSect(s);
    assert.equal(commandSect(s, { type: 'build-site', siteId }).ok, false);
    assert.deepEqual(snapshotSect(s), underway, 'a new construction request does not replace collection');
    until(s, v => v.state.activitiesById[v.state.master.activityId]?.kind !== 'sr-harvest');
  }
  assert.equal(s.state.stockpilesById['stockpile:carried:master'].resources.wood, 24);
  assert.equal(s.state.stockpilesById['stockpile:yunxiu'].resources.wood, 25);
  assert.equal(commandSect(s, { type: 'transport', sourceStockpileId: 'stockpile:carried:master', targetStockpileId: 'stockpile:yunxiu', cargo: { wood: 24 } }).ok, true);
  until(s, v => v.state.activitiesById[v.state.master.activityId]?.kind !== 'sr-transport');
  assert.equal(s.state.stockpilesById['stockpile:yunxiu'].resources.wood, 49);
  assert.equal(commandSect(s, { type: 'build-site', siteId }).ok, true);
  const activityId = s.state.master.activityId;
  until(s, v => v.state.master.scenic.x > 96 && v.state.master.scenic.x < 120 && viewSect(v).construction?.materialFlow?.phase === 'carrying');
  assert.equal(s.state.master.activityId, activityId);
  const acrossBoundary = viewSect(s);
  assert.equal(acrossBoundary.sceneId, 'scene:yunxiu-courtyard');
  assert.equal(acrossBoundary.domain.sites[0].status, 'building');
  assert.equal(acrossBoundary.construction.progressTicks, 0, 'material delivery precedes construction');
  assert.ok(Object.values(acrossBoundary.construction.materialFlow.cargo).some(amount => amount > 0));
  assert.ok(acrossBoundary.stockpiles.some(st => st.id === acrossBoundary.construction.materialFlow.siteStockpileId));
  const restored = restoreSect(JSON.stringify(snapshotSect(s)));
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  until(s, v => v.control.mode === 'auto');
  until(restored, v => v.control.mode === 'auto');
  assert.equal(s.state.master.activityId, activityId, 'construction continues through the thirty second handoff');
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  const isComplete = v => Object.values(v.state.buildingsById).some(b => b.type === 'house' && b.transform.x === 132 && b.transform.y === 40);
  until(s, isComplete);
  until(restored, isComplete);
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  const completed = viewSect(s);
  assert.equal(completed.domain.sites[0].status, 'complete');
  assert.equal(completed.domain.sites[0].progress, 1);
  assert.equal(completed.construction, null);
  assert.ok(completed.buildings.find(b => b.type === 'house').capacity > 0);
  assert.equal(completed.ledger.some(e => e.autonomous && e.action === 'buildDomainSite'), false);
  const completionTick = s.state.worldTick;
  assert.equal(commandSect(s, { type: 'auto' }).ok, true);
  advanceSect(s, 1200);
  assert.equal(s.state.worldTick, completionTick + 12000);
  assert.ok(publicHerb(s) >= s.policy.herbTarget, 'the same expanded sect reaches its herb goal');
  assert.equal(s.state.economy.starvation, 0);
  assert.ok(s.state.stockpilesById['stockpile:yunxiu'].resources.food > 0);
  assert.ok(viewSect(s).people.filter(p => p.resident).every(p => ['rest', 'groundRest', 'cultivate'].includes(p.activity)));
  assert.equal(validateSect(s), true);
});

test('one normal save reaches herb target through real crop labor and actual storage delivery', () => {
  const s = automatic(), before = publicHerb(s);
  until(s, state => !!Object.values(state.state.workOrdersById).find(w => w.kind === 'transport' && w.phase === 'carrying'));
  const inTransit = restoreSect(snapshotSect(s));
  assert.deepEqual(snapshotSect(inTransit), snapshotSect(s));
  until(s, state => publicHerb(state) >= state.policy.herbTarget);
  until(inTransit, state => publicHerb(state) >= state.policy.herbTarget);
  assert.deepEqual(snapshotSect(inTransit), snapshotSect(s));
  const facts = Object.values(s.state.factsById);
  assert.ok(facts.some(f => f.kind === 'crop-harvest' && f.atTick > seed.state.worldTick));
  assert.ok(Object.values(s.state.workOrdersById).some(w => w.kind === 'transport' && w.phase === 'delivered' && w.targetStockpileId === 'stockpile:yunxiu' && w.cargo.herb > 0));
  assert.ok(publicHerb(s) > before);
  assert.equal(s.state.personsById['person:lu-zhiwei'].personId, 'person:lu-zhiwei');
  const copy = snapshotSect(s); viewSect(s); viewSect(s);
  assert.deepEqual(snapshotSect(s), copy, 'projection must be read-only');
  advanceSect(s, 2);
  assert.match(s.reason, /目标已达到/);
  assert.ok(['rest', 'cultivate'].includes(s.state.master.action));
  assert.equal(validateSect(s), true);
});

test('manual takeover respects thirty running seconds, pause, and the current official activity', () => {
  const s = automatic();
  advanceSect(s, 1);
  const frozen = snapshotSect(s);
  assert.equal(commandSect(s, { type: 'move', x: 999, y: 999 }).ok, false);
  assert.deepEqual(snapshotSect(s), frozen, 'invalid replacement preserves actual transport');
  assert.equal(commandSect(s, { type: 'move', x: 17, y: 46 }).ok, true);
  assert.deepEqual(s.control, { mode: 'manual', idleMs: 0 });
  advanceSect(s, 15);
  assert.equal(commandSect(s, { type: 'pause', paused: true }).ok, true);
  const paused = snapshotSect(s);
  advanceSect(s, 120);
  assert.deepEqual(snapshotSect(s), paused);
  assert.equal(commandSect(s, { type: 'pause', paused: false }).ok, true);
  advanceSect(s, 14.9);
  assert.deepEqual(s.control, { mode: 'manual', idleMs: 29900 });
  advanceSect(s, .1);
  assert.deepEqual(s.control, { mode: 'auto', idleMs: 30000 });
  assert.equal(validateSect(s), true);
});

test('material left by a manual transport interruption stays visible and can be physically recovered', () => {
  const s = createSectSession();
  assert.equal(commandSect(s, { type: 'harvest', resource: 'wood' }).ok, true);
  until(s, v => v.state.activitiesById[v.state.master.activityId]?.kind !== 'sr-harvest');
  assert.equal(commandSect(s, { type: 'transport', sourceStockpileId: 'stockpile:carried:master', targetStockpileId: 'stockpile:yunxiu', cargo: { wood: 12 } }).ok, true);
  until(s, v => Object.values(v.state.workOrdersById).some(w => w.kind === 'transport' && w.phase === 'carrying' && w.cargo.wood === 12));
  const dropPosition = { x: s.state.master.scenic.x, y: s.state.master.scenic.y };
  assert.equal(commandSect(s, { type: 'move', x: 20, y: 30 }).ok, true);
  const dropped = viewSect(s).stockpiles.find(st => st.id.startsWith('stockpile:dropped:'));
  assert.ok(dropped);
  assert.equal(dropped.resources.wood, 12);
  assert.equal(dropped.position.sceneId, 'scene:yunxiu-courtyard');
  assert.deepEqual({ x: dropped.position.x, y: dropped.position.y }, dropPosition);
  const reloaded = restoreSect(JSON.stringify(snapshotSect(s)));
  assert.equal(commandSect(reloaded, { type: 'transport', sourceStockpileId: dropped.id, targetStockpileId: 'stockpile:yunxiu', cargo: { wood: 12 } }).ok, true);
  until(reloaded, v => v.state.activitiesById[v.state.master.activityId]?.kind !== 'sr-transport');
  assert.equal(reloaded.state.stockpilesById['stockpile:yunxiu'].resources.wood, 37);
  assert.equal(reloaded.state.stockpilesById[dropped.id].resources.wood, 0);
  assert.ok(viewSect(reloaded).transports.some(w => w.sourceStockpileId === dropped.id && w.phase === 'delivered'));
  assert.equal(validateSect(reloaded), true);
});

test('explicit manual control retains the current body and blocks new autonomous commands for thirty seconds', () => {
  const s = automatic();
  advanceSect(s, 1);
  assert.deepEqual(s.state.masterControl, s.control, 'autonomous public commands retain autonomous control');
  const activity = structuredClone(s.state.activitiesById[s.state.master.activityId]);
  const position = structuredClone(s.state.master.scenic);
  assert.equal(commandSect(s, { type: 'manual' }).ok, true);
  assert.deepEqual(s.state.activitiesById[s.state.master.activityId], activity);
  assert.deepEqual(s.state.master.scenic, position);
  const nextCommandId = s.state.transactions.nextCommandId;
  for (let i = 0; i < 299; i++) {
    advanceSect(s, .1);
    assert.deepEqual(s.state.masterControl, s.control);
  }
  assert.equal(s.state.transactions.nextCommandId, nextCommandId);
  assert.deepEqual(s.control, { mode: 'manual', idleMs: 29900 });
  const restored = restoreSect(snapshotSect(s));
  assert.deepEqual(restored.state.masterControl, restored.control);
  advanceSect(restored, .1);
  assert.deepEqual(restored.control, { mode: 'auto', idleMs: 30000 });
  assert.deepEqual(restored.state.masterControl, restored.control);
  commandSect(restored, { type: 'auto' });
  advanceSect(restored, 2);
  assert.equal(restored.state.masterControl.mode, 'auto');
});

test('twenty simulated minutes retain stable world state and a reached target without starvation', () => {
  const s = automatic();
  advanceSect(s, 1200);
  assert.equal(s.state.worldTick - seed.state.worldTick, 12000);
  assert.ok(publicHerb(s) >= 30);
  assert.equal(s.state.economy.starvation, 0);
  assert.ok(s.state.stockpilesById['stockpile:yunxiu'].resources.food > 0);
  assert.equal(s.state.buildingsById['building:yunxiu:2'].enabled, false);
  assert.equal(s.automation.parkedFarmId, 'building:yunxiu:2');
  assert.notEqual(s.state.personsById['person:lu-zhiwei'].mind.activity, 'work');
  assert.ok(s.ledger.some(e => e.action === 'toggleBuilding'));
  const saved = snapshotSect(s), restored = restoreSect(JSON.stringify(saved));
  assert.deepEqual(snapshotSect(restored), saved, 'loading adds no elapsed time or rewards');
  assert.deepEqual(restored.state.homeMemberIds, seed.state.homeMemberIds);
  assert.equal(validateSect(restored), true);
});

test('allowing local collection gives the master a real finite-source harvest and delivery while the NPC chooses her own activity', () => {
  const s = automatic({ risk: 'balanced' });
  until(s, state => publicHerb(state) >= state.policy.herbTarget);
  assert.ok(Object.values(s.state.factsById).some(f => f.operation === 'manual-harvest' && f.actorId === 'person:master' && f.targetStockpileId === 'stockpile:carried:master'));
  assert.ok(Object.values(s.state.workOrdersById).some(w => w.kind === 'transport' && w.phase === 'delivered' && w.sourceStockpileId === 'stockpile:carried:master' && w.targetStockpileId === 'stockpile:yunxiu'));
  assert.ok(s.state.srEconomy.patches.herb.remaining < seed.state.srEconomy.patches.herb.remaining);
  assert.equal(s.budget.spent, 0);
  assert.equal(validateSect(s), true);
});

test('route permission and zero replenishment budget reject new actions and keep legal alternatives', () => {
  const s = automatic({ herbTarget: 500, risk: 'cautious', spendingCap: 0 });
  advanceSect(s, 1200);
  assert.ok(s.totals['risk-blocked'] >= 1);
  assert.equal(s.ledger.some(e => e.kind === 'autonomous-action' && e.action === 'startMasterHarvest'), false);
  assert.equal(commandSect(s, { type: 'policy', policy: { risk: 'balanced' } }).ok, true);
  until(s, state => state.totals['budget-blocked'] >= 1, 3000);
  assert.equal(s.budget.spent, 0);
  assert.deepEqual(s.budget.orders, []);
  assert.ok(['rest', 'cultivate'].includes(s.state.master.action));
  assert.equal(commandSect(s, { type: 'policy', policy: { spendingCap: 8 } }).ok, true);
  until(s, state => state.budget.spent === 8, 1000);
  assert.equal(s.budget.orders.length, 1);
  const order = s.budget.orders[0];
  assert.equal(s.state.activitiesById[order.activityId].kind, 'sr-replenish');
  until(s, state => state.state.srEconomy.patches.herb.remaining > 100, 1000);
  assert.ok(Object.values(s.state.factsById).some(f => f.operation === 'replenish' && f.actorId === 'person:master'));
  assert.equal(validateSect(s), true);
});

test('corrupt wrapper and formal saves are refused without changing the original', () => {
  const s = automatic(), before = snapshotSect(s);
  for (const mutate of [x => x.version++, x => x.control.idleMs = -1, x => x.budget.spent = 9, x => x.policy.risk = 'unbounded', x => x.state.stockpilesById['stockpile:yunxiu'].resources.herb = -1]) {
    const bad = snapshotSect(s); mutate(bad);
    assert.throws(() => restoreSect(bad));
  }
  assert.deepEqual(snapshotSect(s), before);
});
