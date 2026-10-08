/** SR-XF-009-AC-03 competing reservation subcase from an earned public-command save.
 * SR009_SOURCE=/tmp/immortal-m1-sr002-checkpoints/physical-workshop-built.json node --test qa/ea-sr-009-reservation-competition-public-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {productionAvailability, productionInputAvailable} from '../dist/ea-sr-economy.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourcePath = process.env.SR009_SOURCE;
const source = sourcePath ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;

if (!source) {
  test('SR-XF-009-AC-03 earned source', {skip: 'Set SR009_SOURCE to physical-workshop-built.json.'}, () => {});
} else {
  test('material reserved by a real transport order cannot also begin workshop production', () => {
    assert.equal(source.provenance?.kind, 'normal-public-command-checkpoint');
    assert.equal(source.provenance?.label, 'physical workshop built');
    const rawSource = JSON.stringify(source.state), state = SIM.validateSave(source.state);
    assert.equal(JSON.stringify(source.state), rawSource, 'validation keeps the earned source intact');
    assert.equal(JSON.stringify(SIM.validateSave(state)), JSON.stringify(state), 'migration applies once');
    const h = harness(state);
    const b = h.s.buildings.find(b => b.type === 'workshop');
    assert.equal(b?.instanceId, 'building:yunxiu:6');
    const siteId = `stockpile:${b.instanceId}`;
    const personId = 'person:lu-zhiwei';
    const orderId = `work:production:${b.instanceId}`;
    const site = () => h.s.stockpilesById[siteId];
    const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
      gameVersion: '1.6.0-dev', writerId: 'qa-sr009-ac03-competition'});
    const exactSave = label => {
      h.save();
      const raw = JSON.stringify(h.s);
      const imported = persistence.parseImport(persistence.exportState(h.s, {slot: 1}));
      assert.equal(imported.ok, true, `${label}: native import succeeds`);
      assert.equal(JSON.stringify(imported.state), raw, `${label}: full state survives reload`);
    };
    for (const [resource, quantity] of [['stone', 2], ['wood', 3]]) {
      const delivery = h.act('startTransport', 'stockpile:yunxiu', siteId, 'person:master', {[resource]: quantity});
      h.until(s => s.workOrdersById[delivery.id]?.phase === 'delivered', `${resource} actually delivered`, 1000);
      exactSave(`${resource} onsite`);
    }
    h.until(s => productionAvailability(s, s.buildingsById[b.instanceId]).available,
      'merchant is actually available so only material competition controls the offer', 3000);
    assert.equal(site().resources.wood, 3);
    assert.equal(site().resources.stone, 2);
    assert.equal(productionInputAvailable(h.s, b), true);
    exactSave('complete unreserved recipe onsite');

    const competing = h.act('startTransport', siteId, 'stockpile:yunxiu', 'person:master', {wood: 3});
    assert.equal(h.s.workOrdersById[competing.id].phase, 'to-source');
    assert.deepEqual(h.s.reservationsById[h.s.workOrdersById[competing.id].reservationId].cost, {wood: 3});
    assert.equal(site().resources.wood, 0, 'reserved wood is no longer available at the worksite');
    assert.equal(site().resources.stone, 2);
    assert.equal(productionInputAvailable(h.s, b), false);
    const refused = h.act('inviteWork', personId, b.instanceId);
    assert.equal(refused.accepted, false);
    assert.match(refused.publicReason, /生产原料不足/);
    assert.equal(h.s.workOrdersById[orderId], undefined);
    exactSave('other order holds the only wood');

    const cancelled = h.act('cancelTransport', competing.id);
    assert.equal(cancelled.returnedTo, siteId, 'unpicked cargo returns to its source once');
    assert.equal(site().resources.wood, 3);
    assert.equal(site().resources.stone, 2);
    assert.equal(h.s.reservationsById[h.s.workOrdersById[competing.id].reservationId], undefined);
    const afterCancel = JSON.stringify(h.s);
    assert.throws(() => h.act('cancelTransport', competing.id), /搬运已结束或不存在/);
    assert.equal(JSON.stringify(h.s), afterCancel);
    assert.equal(productionInputAvailable(h.s, b), true);
    exactSave('competing claim released once');

    const accepted = h.act('inviteWork', personId, b.instanceId);
    assert.equal(accepted.accepted, true);
    h.until(s => s.workOrdersById[orderId]?.progressTicks > 0, 'a real worker starts one lawful batch', 1000);
    const production = h.s.workOrdersById[orderId];
    assert.equal(production.batch, 1);
    assert.deepEqual(h.s.reservationsById[production.reservationId]?.cost, {wood: 3, stone: 2});
    assert.equal(site().resources.wood, 0);
    assert.equal(site().resources.stone, 0);
    exactSave('materials consumed by one actual production batch');
    console.log(JSON.stringify({source: sourcePath, sourceCounts: source.provenance.counts,
      reservedAtTick: refused.atTick, resumedAtTick: accepted.atTick,
      competingTransportId: competing.id, productionBatch: production.batch, after: h.counts}));
  });
}
