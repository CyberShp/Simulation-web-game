/** SR-XF-008-AC-03: travel interruption and material-dependent work resumption.
 * SR008_AC03_WORKSHOP_SOURCE=/tmp/immortal-m2-sr009-workshop-active.json node --test qa/ea-sr-008-material-interrupt-public-acceptance.mjs
 * The source is derived only from an earned normal public-command save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {productionAvailability, productionInputAvailable} from '../dist/ea-sr-economy.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourcePath = process.env.SR008_AC03_WORKSHOP_SOURCE;
const source = sourcePath ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;
const personId = 'person:yunxiu:67';

if (!source) {
  test('SR-XF-008-AC-03 earned workshop source', {skip: 'Set SR008_AC03_WORKSHOP_SOURCE to the derived public-command workshop checkpoint.'}, () => {});
} else {
  test('a travelling worker stops contributing and can only resume after actual material delivery and a fresh choice', () => {
    assert.equal(source.provenance?.kind, 'derived-public-command-checkpoint');
    assert.equal(source.provenance?.sourceProvenance?.kind, 'normal-public-command-checkpoint');
    assert.equal(source.provenance?.publicCommands?.length, 4);
    const state = SIM.validateSave(source.state);
    assert.equal(JSON.stringify(state), JSON.stringify(source.state), 'earned source is already canonical');
    const h = harness(state);
    const facility = h.s.buildings.find(b => b.type === 'workshop');
    assert.equal(facility?.instanceId, 'building:yunxiu:6');
    const siteId = `stockpile:${facility.instanceId}`;
    const orderId = `work:production:${facility.instanceId}`;
    const factId = `fact:production:${facility.instanceId}:1`;
    const reservationId = `reservation:slot:${personId}`;
    const p = () => h.s.personsById[personId];
    const activity = () => h.s.activitiesById[p().activityId];
    const order = () => h.s.workOrdersById[orderId];
    const site = () => h.s.stockpilesById[siteId];
    assert.equal(activity()?.phase, 'executing');
    assert.equal(activity()?.targetId, facility.instanceId);
    assert.equal(h.s.reservationsById[reservationId]?.slotId, activity().slotId);
    assert.equal(order().batch, 1);
    assert.equal(order().progressTicks, 30);
    const formerContribution = order().contributions[personId];
    assert(formerContribution > 0);
    assert.equal(site().resources.wood, 0);
    assert.equal(site().resources.stone, 0);
    const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
      gameVersion: '1.6.0-dev', writerId: 'qa-sr008-ac03-material'});
    const evidenceDir = process.env.XIANFU_QA_SR008_AC03_MATERIAL_DIR;
    const checkpoint = label => {
      h.save();
      const raw = JSON.stringify(h.s);
      const exported = persistence.exportState(h.s, {slot: 1});
      const imported = persistence.parseImport(exported);
      assert.equal(imported.ok, true, `${label}: native import succeeds`);
      assert.equal(JSON.stringify(imported.state), raw, `${label}: full state survives exact save`);
      assert.equal(renderSRPanel(imported.state, SIM, 'disciples'), renderSRPanel(h.s, SIM, 'disciples'),
        `${label}: public reasons survive reload`);
      if (!evidenceDir) return;
      const dir = resolve(evidenceDir);
      mkdirSync(dir, {recursive: true});
      writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance: {
        kind: 'derived-public-command-checkpoint', label: `SR-XF-008-AC-03 material ${label}`,
        sourcePath, counts: h.counts}, state: h.s}));
      writeFileSync(resolve(dir, `${label}-import.json`), exported);
    };
    checkpoint('two-working');

    h.act('srWorldCommand', {action: 'travel', destination: 'scene:valley', companions: [personId]});
    assert.equal(p().position.kind, 'worldTravel');
    assert.equal(activity(), undefined);
    assert.equal(h.s.reservationsById[reservationId], undefined);
    assert.equal(p().job, null);
    assert.equal(order().contributions[personId], formerContribution);
    checkpoint('departed');
    h.until(s => s.master.location.sceneId === 'scene:valley', 'real companion trip arrives', 200);
    h.until(s => Boolean(s.factsById[factId]), 'other actual workers complete the old shared batch', 700);
    assert.equal(p().location.sceneId, 'scene:valley');
    assert.equal(order().contributions[personId], formerContribution,
      'the traveller keeps only contribution earned before leaving');
    assert.equal(Object.keys(h.s.factsById).filter(id => id === factId).length, 1);
    assert(h.s.factsById[factId].participantIds.includes(personId),
      'the pre-departure contribution remains legitimately attributed to the old batch');
    assert.equal(site().resources.wood, 0);
    assert.equal(site().resources.stone, 0);
    checkpoint('old-batch-completed-away');

    h.act('srWorldCommand', {action: 'return', companions: [personId]});
    h.until(s => s.master.location.sceneId === 'scene:yunxiu-courtyard', 'real companion return', 200);
    assert.equal(p().location.sceneId, 'scene:yunxiu-courtyard');
    assert.equal(p().job, null);
    assert.equal(h.s.reservationsById[reservationId], undefined);
    assert.equal(productionInputAvailable(h.s, facility), false);
    assert.equal(productionAvailability(h.s, facility).available, true);
    const unavailable = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(unavailable.accepted, false);
    assert.match(unavailable.publicReason, /生产原料不足/);
    assert.equal(h.s.reservationsById[reservationId], undefined);
    checkpoint('returned-without-material');

    h.resources({wood: 3, stone: 2});
    for (const [resource, quantity] of [['stone', 2], ['wood', 3]]) {
      const delivery = h.act('startTransport', 'stockpile:yunxiu', siteId, 'person:master', {[resource]: quantity});
      assert.equal(delivery.accepted, true);
      assert.equal(site().resources[resource], 0, `${resource} is not available at the site while reserved`);
      h.until(s => s.workOrdersById[delivery.id]?.phase === 'delivered', `${resource} physically delivered`, 1000);
      assert.equal(site().resources[resource], quantity);
      checkpoint(`${resource}-delivered`);
    }
    assert.equal(productionInputAvailable(h.s, facility), true);
    h.until(s => productionAvailability(s, facility).available, 'actual buyer available again', 3000);
    const accepted = h.act('inviteWork', personId, facility.instanceId);
    assert.equal(accepted.accepted, true);
    assert.notEqual(accepted.signature, unavailable.signature);
    h.until(s => {
      const a = s.activitiesById[s.personsById[personId].activityId];
      return a?.targetId === facility.instanceId && a.phase === 'executing';
    }, 'the same person returns to a real work slot', 1200);
    assert.equal(h.s.reservationsById[reservationId]?.slotId, activity().slotId);
    assert.equal(order().batch, 2);
    assert(order().contributions[personId] > 0, 'only newly earned work counts in the new batch');
    assert.deepEqual(h.s.reservationsById[order().reservationId]?.cost, {wood: 3, stone: 2},
      'the new batch reserves the newly delivered materials once');
    assert.equal(h.s.factsById[factId].participantIds.filter(id => id === personId).length, 1);
    checkpoint('resumed-on-material');
    console.log(JSON.stringify({source: sourcePath, sourceCounts: source.provenance.counts,
      after: h.counts, firstBatchFormerContribution: formerContribution,
      firstResultTick: h.s.factsById[factId].atTick,
      refusedTick: unavailable.atTick, acceptedTick: accepted.atTick,
      resumedBatch: order().batch, resumedContribution: order().contributions[personId]}));
  });
}
