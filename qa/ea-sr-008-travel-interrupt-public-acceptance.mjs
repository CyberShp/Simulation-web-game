/** SR-XF-008-AC-03 travel subcase from an earned, working public-command save.
 * SR008_AC03_SOURCE=/tmp/immortal-m2-sr008-ac01/working.json node --test qa/ea-sr-008-travel-interrupt-public-acceptance.mjs
 * This subcase does not alone cover injury or a material-dependent return.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourcePath = process.env.SR008_AC03_SOURCE;
const source = sourcePath ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;
const personId = 'person:lu-zhiwei';

if (!source) {
  test('SR-XF-008-AC-03 earned source', {skip: 'Set SR008_AC03_SOURCE to the earned working.json checkpoint.'}, () => {});
} else {
  test('travel interrupts a real worker, releases the body and slot, and requires a fresh valid offer on return', () => {
    assert.equal(source.provenance?.kind, 'normal-public-command-checkpoint');
    assert.equal(source.provenance?.label, 'SR-XF-008-AC-01 working');
    const state = SIM.validateSave(source.state);
    assert.equal(JSON.stringify(state), JSON.stringify(source.state), 'source is already a canonical save');
    assert.equal(state.worldTick, source.provenance.counts.worldTick);
    const h = harness(state);
    const p = () => h.s.personsById[personId];
    const body = () => h.s.activitiesById[p().activityId];
    const facility = h.s.buildings.find(b => b.type === 'lumber');
    assert(facility?.enabled);
    const orderId = `work:production:${facility.instanceId}`;
    const order = () => h.s.workOrdersById[orderId];
    const reservationId = `reservation:slot:${personId}`;
    const firstBody = body();
    assert.equal(firstBody?.phase, 'executing');
    assert.equal(firstBody.targetId, facility.instanceId);
    assert.equal(h.s.reservationsById[reservationId]?.slotId, firstBody.slotId);
    assert.equal(h.s.disciples.filter(person => h.s.activitiesById[person.activityId]?.targetId === facility.instanceId &&
      h.s.activitiesById[person.activityId]?.phase === 'executing').length, 1,
      'one real worker is executing at the earned starting point');
    const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
      gameVersion: '1.6.0-dev', writerId: 'qa-sr008-ac03'});
    const evidenceDir = process.env.XIANFU_QA_SR008_AC03_DIR;
    const checkpoint = label => {
      h.save();
      const raw = JSON.stringify(h.s);
      const exported = persistence.exportState(h.s, {slot: 1});
      const parsed = persistence.parseImport(exported);
      assert.equal(parsed.ok, true, `${label}: native import succeeds`);
      assert.equal(JSON.stringify(parsed.state), raw, `${label}: complete save survives reload`);
      assert.equal(renderSRPanel(parsed.state, SIM, 'disciples'), renderSRPanel(h.s, SIM, 'disciples'),
        `${label}: public card survives reload`);
      if (!evidenceDir) return;
      const dir = resolve(evidenceDir);
      mkdirSync(dir, {recursive: true});
      writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance: {
        kind: 'normal-public-command-checkpoint', label: `SR-XF-008-AC-03 travel ${label}`,
        source: sourcePath, counts: h.counts}, state: h.s}));
      writeFileSync(resolve(dir, `${label}-import.json`), exported);
    };
    const interruptedBatch = order().batch;
    const interruptedProgress = order().progressTicks;
    const interruptedContribution = order().contributions[personId];
    checkpoint('working');

    h.act('srWorldCommand', {action: 'travel', destination: 'scene:valley', companions: [personId]});
    assert.equal(p().position.kind, 'worldTravel');
    assert.equal(body(), undefined, 'travel owns the body; the old work activity is gone');
    assert.equal(h.s.reservationsById[reservationId], undefined, 'the physical work slot is released');
    assert.equal(p().job, null);
    assert.equal(SIM.workOpportunity(h.s, p(), facility).available, false);
    checkpoint('outbound');
    for (let i = 0; i < 10; i++) SIM.tick(h.s, .1);
    assert.equal(order().batch, interruptedBatch);
    assert.equal(order().progressTicks, interruptedProgress, 'without the worker, the batch does not advance');
    assert.equal(order().contributions[personId], interruptedContribution);
    assert.equal(h.s.reservationsById[reservationId], undefined);
    assert.equal(h.s.factsById[`fact:production:${facility.instanceId}:${interruptedBatch}`], undefined);
    checkpoint('away-paused');

    h.until(s => s.master.location?.sceneId === 'scene:valley', 'real trip arrives', 120);
    assert.equal(p().location.sceneId, 'scene:valley');
    assert.equal(SIM.workOpportunity(h.s, p(), facility).available, false);
    checkpoint('away-arrived');
    h.act('srWorldCommand', {action: 'return', companions: [personId]});
    h.until(s => s.master.location?.sceneId === 'scene:yunxiu-courtyard', 'real return arrives', 120);
    assert.equal(p().location.sceneId, 'scene:yunxiu-courtyard');
    assert.equal(p().job, null, 'return does not silently restore the old job');
    assert.equal(h.s.reservationsById[reservationId], undefined);
    const oldFactId = `fact:production:${facility.instanceId}:${interruptedBatch}`;
    const oldFact = h.s.factsById[oldFactId];
    assert(oldFact, 'another real worker can finish the old batch while the traveller is away');
    assert.equal(oldFact.participantIds.filter(id => id === personId).length, 1,
      'the traveller retains one legitimate pre-departure share');
    assert.equal(Object.keys(h.s.factsById).filter(id => id === oldFactId).length, 1,
      'the old batch has one result fact');
    assert.equal(order().batch, interruptedBatch + 1);
    assert.equal(order().contributions[personId] ?? 0, 0,
      'the traveller makes no contribution to the next batch before choosing work again');
    checkpoint('returned-unassigned');

    h.act('toggleBuilding', facility.id);
    const refused = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(refused.accepted, false, 'stopped target blocks a new promise');
    assert.match(refused.publicReason, /设施停用/);
    assert.equal(h.s.reservationsById[reservationId], undefined);
    checkpoint('returned-target-blocked');
    h.act('toggleBuilding', facility.id);
    assert.equal(SIM.workOpportunity(h.s, p(), facility).available, true);
    const accepted = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(accepted.accepted, true, 'recovered conditions require and allow a new decision');
    assert.notEqual(accepted.signature, refused.signature);
    h.until(s => s.activitiesById[s.personsById[personId].activityId]?.phase === 'executing',
      'worker reaches a newly reserved real slot', 300);
    assert.equal(body().targetId, facility.instanceId);
    assert.equal(h.s.reservationsById[reservationId]?.slotId, body().slotId);
    assert.equal(p().position.sceneId, 'scene:yunxiu-courtyard');
    assert.equal(h.s.factsById[oldFactId].atTick, oldFact.atTick);
    assert(order().contributions[personId] > 0, 'new labour is attributed only after the renewed choice');
    checkpoint('returned-working');
    console.log(JSON.stringify({source: sourcePath, sourceCounts: source.provenance.counts,
      after: h.counts, pausedBatch: interruptedBatch, pausedProgress: interruptedProgress,
      returnTick: accepted.atTick, resumedTick: h.s.worldTick}));
  });
}
