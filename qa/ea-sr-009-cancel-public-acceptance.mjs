/** SR-XF-009-AC-03 cancellation subcase from an earned, active workshop batch.
 * SR009_ACTIVE_SOURCE=/tmp/immortal-m2-sr009-workshop-active.json node --test qa/ea-sr-009-cancel-public-acceptance.mjs
 * Competing independent orders are a separate subcase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourcePath = process.env.SR009_ACTIVE_SOURCE;
const source = sourcePath ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;
const close = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-8,
  `${label}: ${actual} differs from ${expected}`);

if (!source) {
  test('SR-XF-009-AC-03 earned active source', {skip: 'Set SR009_ACTIVE_SOURCE to the derived public-command workshop checkpoint.'}, () => {});
} else {
  test('cancelling a partly worked batch returns only unused local input once and leaves other real work available', () => {
    assert.equal(source.provenance?.kind, 'derived-public-command-checkpoint');
    assert.equal(source.provenance?.sourceProvenance?.kind, 'normal-public-command-checkpoint');
    const raw = JSON.stringify(source.state), state = SIM.validateSave(source.state);
    assert.equal(JSON.stringify(source.state), raw, 'validation keeps the earned source intact');
    assert.equal(JSON.stringify(SIM.validateSave(state)), JSON.stringify(state), 'migration applies once');
    const h = harness(state);
    const b = h.s.buildings.find(b => b.type === 'workshop');
    assert.equal(b?.instanceId, 'building:yunxiu:6');
    const orderId = `work:production:${b.instanceId}`;
    const siteId = `stockpile:${b.instanceId}`;
    const factId = `fact:production:${b.instanceId}:1`;
    const order = h.s.workOrdersById[orderId];
    const reservation = h.s.reservationsById[order.reservationId];
    assert.equal(order.phase, 'active');
    assert.equal(order.progressTicks, 30);
    assert.deepEqual(reservation.cost, {wood: 3, stone: 2});
    assert.equal(h.s.stockpilesById[siteId].resources.wood, 0);
    assert.equal(h.s.stockpilesById[siteId].resources.stone, 0);
    assert.equal(h.s.factsById[factId], undefined);
    const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
      gameVersion: '1.6.0-dev', writerId: 'qa-sr009-ac03'});
    const exactSave = label => {
      h.save();
      const raw = JSON.stringify(h.s);
      const exported = persistence.exportState(h.s, {slot: 1});
      const imported = persistence.parseImport(exported);
      assert.equal(imported.ok, true, `${label}: native import succeeds`);
      assert.equal(JSON.stringify(imported.state), raw, `${label}: full state survives exact reload`);
    };
    exactSave('active input reserved');
    const refund = h.act('cancelProduction', b.id);
    for (const [resource, cost] of Object.entries(reservation.cost)) {
      const unused = cost * (1 - order.progressTicks / order.durationTicks);
      close(refund[resource], unused, `${resource} unused refund`);
      close(h.s.stockpilesById[siteId].resources[resource], unused,
        `${resource} returns only to the worksite position`);
      close(cost - refund[resource], cost * order.progressTicks / order.durationTicks,
        `${resource} consumed by actual work`);
    }
    assert.equal(h.s.reservationsById[order.reservationId], undefined);
    assert.equal(h.s.workOrdersById[orderId], undefined);
    assert.equal(h.s.factsById[factId], undefined);
    exactSave('unused input returned once');
    const afterFirstCancel = JSON.stringify(h.s);
    assert.throws(() => h.act('cancelProduction', b.id), /当前没有未完成的生产批次/);
    assert.equal(JSON.stringify(h.s), afterFirstCancel, 'repeated cancel leaves the complete world unchanged');
    for (let i = 0; i < 10; i++) SIM.tick(h.s, .1);
    assert.equal(h.s.workOrdersById[orderId], undefined,
      'the returned fractions cannot fund another complete workshop recipe');
    assert.equal(h.s.factsById[factId], undefined);
    exactSave('no phantom second batch');
    const harvest = h.act('startMasterHarvest', 'stone');
    assert.equal(harvest.pending, true, 'the master can undertake another legal real-world activity');
    h.until(s => !s.activitiesById[harvest.id], 'real stone harvest finishes', 700);
    assert(h.s.stockpilesById['stockpile:carried:master'].resources.stone >= 10);
    assert.equal(h.s.workOrdersById[orderId], undefined);
    exactSave('other legal work completed');
    console.log(JSON.stringify({source: sourcePath, sourceCounts: source.provenance.counts,
      cancelTick: source.state.worldTick, progress: order.progressTicks,
      cost: reservation.cost, refund, after: h.counts}));
  });
}
