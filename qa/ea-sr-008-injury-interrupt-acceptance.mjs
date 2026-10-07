/** SR-XF-008-AC-03 injury subcase from a normally earned, active workshop save.
 * SR008_AC03_WORKSHOP_SOURCE=/tmp/immortal-m2-sr009-workshop-active.json node --test qa/ea-sr-008-injury-interrupt-acceptance.mjs
 * The injury is a labeled in-memory event injection; recovery and all player actions use the normal gateway and world clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {productionAvailability, productionInputAvailable} from '../dist/ea-sr-economy.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourcePath = process.env.SR008_AC03_WORKSHOP_SOURCE;
const source = sourcePath ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;
const personId = 'person:yunxiu:67';

if (!source) {
  test('SR-XF-008-AC-03 earned workshop source', {skip: 'Set SR008_AC03_WORKSHOP_SOURCE to an earned active workshop checkpoint.'}, () => {});
} else {
  test('injury releases the worker immediately; healing and new material permit a fresh voluntary return', () => {
    assert.equal(source.provenance?.kind, 'derived-public-command-checkpoint');
    assert.equal(source.provenance?.sourceProvenance?.kind, 'normal-public-command-checkpoint');
    assert.equal(source.provenance?.publicCommands?.length, 4);
    const state = SIM.validateSave(source.state);
    assert.equal(JSON.stringify(state), JSON.stringify(source.state), 'source is a canonical earned save');
    assert.equal(state.worldTick, source.provenance.counts.worldTick);
    const h = harness(state, 'sr008-injury');
    const facility = h.s.buildings.find(b => b.type === 'workshop');
    assert.equal(facility?.instanceId, 'building:yunxiu:6');
    const siteId = `stockpile:${facility.instanceId}`;
    const orderId = `work:production:${facility.instanceId}`;
    const factId = `fact:production:${facility.instanceId}:1`;
    const slotReservationId = `reservation:slot:${personId}`;
    const p = () => h.s.personsById[personId];
    const order = () => h.s.workOrdersById[orderId];
    const site = () => h.s.stockpilesById[siteId];
    const body = () => h.s.activitiesById[p().activityId];
    const original = body();
    assert.equal(original?.phase, 'executing');
    assert.equal(original.action, 'work');
    assert.equal(h.s.reservationsById[slotReservationId]?.slotId, original.slotId);
    assert.equal(order().batch, 1);
    assert.deepEqual(h.s.reservationsById[order().reservationId]?.cost, {wood: 3, stone: 2});
    const formerContribution = order().contributions[personId];
    const formerProgress = order().progressTicks;
    assert(formerContribution > 0);
    const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
      gameVersion: '1.6.0-dev', writerId: 'qa-sr008-ac03-injury'});
    const evidenceDir = process.env.XIANFU_QA_SR008_AC03_INJURY_DIR;
    const checkpoint = label => {
      h.save();
      const raw = JSON.stringify(h.s);
      const exported = persistence.exportState(h.s, {slot: 1});
      const imported = persistence.parseImport(exported);
      assert.equal(imported.ok, true, `${label}: native import succeeds`);
      assert.equal(JSON.stringify(imported.state), raw, `${label}: full state survives reload`);
      assert.equal(renderSRPanel(imported.state, SIM, 'disciples'), renderSRPanel(h.s, SIM, 'disciples'),
        `${label}: public reason survives reload`);
      if (!evidenceDir) return;
      const dir = resolve(evidenceDir);
      mkdirSync(dir, {recursive: true});
      writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance: {
        kind: 'earned-save-injury-event-checkpoint', label: `SR-XF-008-AC-03 injury ${label}`,
        sourcePath, injuryTrigger: 'in-memory event injection', counts: h.counts}, state: h.s}));
      writeFileSync(resolve(dir, `${label}-import.json`), exported);
    };
    checkpoint('working');

    // Model a wound event while this earned worker is already executing. The source and later commands are unmodified.
    p().wound = 35;
    SIM.tick(h.s, .1);
    assert.equal(p().job, null);
    assert.equal(body(), undefined, 'the old working body is released within the next world step');
    assert.equal(h.s.reservationsById[slotReservationId], undefined, 'the old physical work slot is free');
    assert.equal(order().progressTicks, formerProgress);
    assert.equal(order().contributions[personId], formerContribution);
    assert.deepEqual(h.s.reservationsById[order().reservationId]?.cost, {wood: 3, stone: 2},
      'the shared batch keeps its single material reservation for the other worker');
    assert.match(renderSRPanel(h.s, SIM, 'disciples'), /伤势未愈/, 'management reports the interruption');
    checkpoint('injured-released');
    const hurtOffer = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(hurtOffer.accepted, false);
    assert.match(hurtOffer.publicReason, /伤势/);
    checkpoint('injured-refused');

    h.until(s => Boolean(s.factsById[factId]), 'other real worker finishes the original batch', 700);
    const firstFact = h.s.factsById[factId];
    assert.equal(firstFact.participantIds.filter(id => id === personId).length, 1,
      'only the contribution earned before injury remains attributed');
    assert.equal(order().contributions[personId], formerContribution);
    assert.equal(order().batch, 1);
    assert.equal(order().progressTicks, order().durationTicks);
    assert.equal(h.s.reservationsById[order().reservationId], undefined,
      'the original batch releases its material reservation once at settlement');
    assert.equal(site().resources.wood, 0);
    assert.equal(site().resources.stone, 0);
    checkpoint('first-batch-settled');

    h.until(s => s.personsById[personId].wound <= 20, 'actual healing crosses the work threshold', 1000);
    assert.equal(p().job, null, 'healing does not silently restore the old promise');
    h.until(s => productionAvailability(s, facility).available, 'real buyer available', 3000);
    assert.equal(productionInputAvailable(h.s, facility), false);
    const missingOffer = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(missingOffer.accepted, false);
    assert.match(missingOffer.publicReason, /生产原料不足/);
    checkpoint('healed-material-refused');

    h.resources({wood: 3, stone: 2});
    for (const [resource, quantity] of [['stone', 2], ['wood', 3]]) {
      const transfer = h.act('startTransport', 'stockpile:yunxiu', siteId, 'person:master', {[resource]: quantity});
      assert.equal(transfer.accepted, true);
      assert.equal(site().resources[resource], 0, `${resource} is unavailable before delivery`);
      h.until(s => s.workOrdersById[transfer.id]?.phase === 'delivered', `${resource} physically delivered`, 1000);
      assert.equal(site().resources[resource], quantity);
      checkpoint(`${resource}-delivered`);
    }
    h.until(s => productionAvailability(s, facility).available, 'buyer available for renewed batch', 3000);
    const renewed = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(renewed.accepted, true);
    assert.notEqual(renewed.signature, missingOffer.signature);
    h.until(s => {
      const worker = s.personsById[personId], activity = s.activitiesById[worker.activityId];
      return activity?.targetId === facility.instanceId && activity.phase === 'executing' &&
        s.workOrdersById[orderId]?.batch === 2 && s.workOrdersById[orderId]?.contributions[personId] > 0;
    }, 'the healed person voluntarily contributes to a new real batch', 1200);
    assert.equal(h.s.reservationsById[slotReservationId]?.slotId, body().slotId);
    assert.deepEqual(h.s.reservationsById[order().reservationId]?.cost, {wood: 3, stone: 2});
    assert.equal(h.s.factsById[factId].atTick, firstFact.atTick, 'the first batch is not settled twice');
    checkpoint('healed-working');
    console.log(JSON.stringify({source: sourcePath, sourceCounts: source.provenance.counts,
      after: h.counts, oldProgress: formerProgress, oldContribution: formerContribution,
      injuryTick: source.provenance.counts.worldTick, firstResultTick: firstFact.atTick,
      renewedTick: renewed.atTick, resumedBatch: order().batch}));
  });
}
