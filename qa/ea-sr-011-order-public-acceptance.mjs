/** SR-XF-011-AC-01, same-yard order subchain through the normal public opening.
 * Optional native import files go only to XIANFU_QA_SR011_DIR outside the repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {harness, normalOpening} from './ea-sr-integration-acceptance.mjs';

const orderId = 'artisan_tools';
const reservationId = `reservation:order:${orderId}`;
const factId = `fact:order:${orderId}`;
const persistence = createEAPersistence({
  validate: SIM.validateSave, dataVersion: 6, gameVersion: '1.6.0-dev', writerId: 'qa-sr011-ac01',
});

function productionCard(s) {
  const before = JSON.stringify(s);
  const html = renderSRPanel(s, SIM, 'production');
  assert.equal(JSON.stringify(s), before, 'production and ledger projection cannot change the world');
  assert.match(html, /百工用材/);
  assert.match(html, /实际出入账/);
  return html;
}

function checkpoint(h, label) {
  h.save();
  const raw = JSON.stringify(h.s);
  const exported = persistence.exportState(h.s, {slot: 1});
  const imported = persistence.parseImport(exported);
  assert.equal(imported.ok, true, `${label}: native slot export imports`);
  assert.equal(JSON.stringify(imported.state), raw, `${label}: complete save is exact`);
  assert.equal(productionCard(imported.state), productionCard(h.s), `${label}: visible order and ledger survive reload`);
  const evidenceDir = process.env.XIANFU_QA_SR011_DIR;
  if (evidenceDir) {
    const dir = resolve(evidenceDir);
    mkdirSync(dir, {recursive: true});
    writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({
      provenance: {kind: 'normal-public-command-checkpoint', label: `SR-XF-011-AC-01 ${label}`, counts: h.counts},
      state: h.s,
    }));
    writeFileSync(resolve(dir, `${label}-import.json`), exported);
  }
}

function rejectedWithoutMutation(h, choice, reason) {
  const before = JSON.stringify(h.s);
  assert.throws(() => h.act('marketOrder', orderId, choice), reason);
  assert.equal(JSON.stringify(h.s), before, `${choice}: rejected public command leaves all state unchanged`);
}

test('SR-XF-011-AC-01 same-yard public order: one reserve, real meeting, one payment, exact reload', t => {
  const h = normalOpening();
  h.resources({wood: 20, stone: 10});
  const home = () => h.s.stockpilesById['stockpile:yunxiu'];
  assert(home().resources.wood >= 20 && home().resources.stone >= 10, 'normal harvesting and transport supplied the public yard stockpile');
  const sourceRaw = JSON.stringify(h.s);
  const woodBefore = home().resources.wood;
  const stoneBefore = home().resources.stone;
  const jadeBefore = home().resources.jade;
  const repBefore = h.s.sect.reputation;
  checkpoint(h, 'available');

  rejectedWithoutMutation(h, 'deliver', /先接受报价并预留货物/);
  const accepted = h.act('marketOrder', orderId, 'accept');
  assert.equal(accepted.phase, 'accepted');
  assert.deepEqual(accepted.cargo, {wood: 20, stone: 10});
  assert.equal(home().resources.wood, woodBefore - 20);
  assert.equal(home().resources.stone, stoneBefore - 10);
  assert.deepEqual(h.s.reservationsById[reservationId].cost, {wood: 20, stone: 10});
  assert.equal(h.s.worldTick, accepted.acceptedTick, 'accepting an order does not advance the clock');
  checkpoint(h, 'accepted');

  const acceptedTick = h.s.worldTick;
  const acceptedWood = home().resources.wood;
  const acceptedStone = home().resources.stone;
  assert.deepEqual(h.act('marketOrder', orderId, 'accept'), accepted, 'another public accept keeps the same order');
  assert.equal(h.s.worldTick, acceptedTick, 'another accept cannot move world time');
  assert.equal(home().resources.wood, acceptedWood, 'another accept cannot reserve wood twice');
  assert.equal(home().resources.stone, acceptedStone, 'another accept cannot reserve stone twice');
  assert.deepEqual(h.s.srEconomy.orders[orderId], accepted, 'another accept retains the original order');
  rejectedWithoutMutation(h, 'deliver', /收货商队尚未实际到达/);
  checkpoint(h, 'early-rejected');

  h.merchant();
  const merchant = h.s.personsById['person:merchant-qingxi'];
  assert.equal(merchant.position.sceneId, 'scene:yunxiu-courtyard', 'the merchant physically arrives in the yard');
  assert.equal(SIM.viewEconomy(h.s).market.merchantPresent, true, 'the master physically meets the merchant');
  assert(h.s.worldTick >= accepted.arrivalTick, 'the promised receipt time has elapsed');
  checkpoint(h, 'meeting');

  const merchantStock = () => h.s.stockpilesById['stockpile:qingxi'];
  const tradeBefore = {
    homeJade: home().resources.jade, merchantJade: merchantStock().resources.jade,
    merchantWood: merchantStock().resources.wood, merchantStone: merchantStock().resources.stone,
    reputation: h.s.sect.reputation,
  };
  const completed = h.act('marketOrder', orderId, 'deliver');
  assert.equal(completed.phase, 'completed');
  assert.equal(completed.resultTransactionId, factId);
  assert.equal(home().resources.jade, tradeBefore.homeJade + 30);
  assert.equal(merchantStock().resources.jade, tradeBefore.merchantJade - 30);
  assert.equal(merchantStock().resources.wood, tradeBefore.merchantWood + 20);
  assert.equal(merchantStock().resources.stone, tradeBefore.merchantStone + 10);
  assert.equal(h.s.sect.reputation, tradeBefore.reputation + 2);
  assert.equal(h.s.reservationsById[reservationId], undefined, 'delivery consumes the one reservation');
  assert.equal(h.s.factsById[factId].operation, 'order-delivery');
  assert.deepEqual(h.s.factsById[factId].cargo, {wood: 20, stone: 10});
  assert.deepEqual(h.s.factsById[factId].payment, {jade: 30});
  assert.equal(h.s.factsById[factId].reputation, 2);
  const settledCard = productionCard(h.s);
  assert.match(settledCard, /百工用材[\s\S]*?已完成/);
  assert.match(settledCard, /订单交付 · 百工用材 · 交付 灵木 20 · 青石 10 · 收款 灵石 30 · 名声\+2/, 'visible ledger names the one cargo and payment');
  checkpoint(h, 'completed');

  rejectedWithoutMutation(h, 'deliver', /该订单已结算或拒绝/);
  rejectedWithoutMutation(h, 'accept', /该订单已结算或拒绝/);
  assert.equal(Object.keys(h.s.factsById).filter(id => id === factId).length, 1, 'one delivery writes one ledger fact');
  assert.equal(home().resources.jade, tradeBefore.homeJade + 30, 'repeat cannot pay again');
  assert.equal(h.s.sect.reputation, tradeBefore.reputation + 2, 'repeat cannot grant reputation again');
  checkpoint(h, 'repeat-rejected');

  const cancel = harness(SIM.validateSave(JSON.parse(sourceRaw)));
  const cancelHome = () => cancel.s.stockpilesById['stockpile:yunxiu'];
  const cancelResources = {wood: cancelHome().resources.wood, stone: cancelHome().resources.stone, jade: cancelHome().resources.jade};
  const cancelRep = cancel.s.sect.reputation;
  cancel.act('marketOrder', orderId, 'accept');
  checkpoint(cancel, 'decline-accepted');
  assert.equal(cancel.act('marketOrder', orderId, 'decline').phase, 'declined');
  assert.equal(cancelHome().resources.wood, cancelResources.wood);
  assert.equal(cancelHome().resources.stone, cancelResources.stone);
  assert.equal(cancelHome().resources.jade, cancelResources.jade);
  assert.equal(cancel.s.sect.reputation, cancelRep);
  assert.equal(cancel.s.reservationsById[reservationId], undefined);
  assert.equal(cancel.s.factsById[factId], undefined, 'decline has no delivery ledger fact');
  checkpoint(cancel, 'declined');
  rejectedWithoutMutation(cancel, 'decline', /该订单已结算或拒绝/);
  rejectedWithoutMutation(cancel, 'deliver', /该订单已结算或拒绝/);
  assert.equal(cancelHome().resources.wood, cancelResources.wood, 'repeat decline cannot refund twice');
  assert.equal(cancelHome().resources.stone, cancelResources.stone, 'repeat decline cannot refund twice');
  checkpoint(cancel, 'decline-repeat-rejected');

  t.diagnostic(JSON.stringify({main: h.counts, decline: cancel.counts, initialJade: jadeBefore, initialReputation: repBefore}));
});

test('SR-XF-011-AC-01 remaining same-yard offers settle once after native reload', t => {
  const h = normalOpening();
  const offers = [
    {id: 'gu_medicine', name: '顾氏供药', cost: {herb: 20}, reward: {jade: 24}, rep: 2},
    {id: 'ghost_shelter', name: '安息院灯火', cost: {wood: 10, food: 10}, reward: {jade: 18}, rep: 1},
  ];
  h.resources({herb: 20, wood: 10, food: 10});
  const home = () => h.s.stockpilesById['stockpile:yunxiu'];
  const merchantStock = () => h.s.stockpilesById['stockpile:qingxi'];
  const exact = label => {
    h.save();
    const raw = JSON.stringify(h.s);
    const imported = persistence.parseImport(persistence.exportState(h.s, {slot: 1}));
    assert.equal(imported.ok, true, `${label}: native import succeeds`);
    assert.equal(JSON.stringify(imported.state), raw, `${label}: native reload is exact`);
  };
  for (const offer of offers) {
    const original = Object.fromEntries(Object.keys(offer.cost).map(key => [key, home().resources[key]]));
    const accepted = h.act('marketOrder', offer.id, 'accept');
    assert.equal(accepted.phase, 'accepted');
    for (const [key, quantity] of Object.entries(offer.cost)) assert.equal(home().resources[key], original[key] - quantity);
    assert.deepEqual(h.s.reservationsById[`reservation:order:${offer.id}`].cost, offer.cost);
    exact(`${offer.id} accepted`);
    const beforeRepeat = JSON.stringify({home: home().resources, merchant: merchantStock().resources,
      reputation: h.s.sect.reputation, order: h.s.srEconomy.orders[offer.id],
      reservation: h.s.reservationsById[`reservation:order:${offer.id}`],
      result: h.s.factsById[`fact:order:${offer.id}`]});
    assert.deepEqual(h.act('marketOrder', offer.id, 'accept'), accepted);
    assert.equal(JSON.stringify({home: home().resources, merchant: merchantStock().resources,
      reputation: h.s.sect.reputation, order: h.s.srEconomy.orders[offer.id],
      reservation: h.s.reservationsById[`reservation:order:${offer.id}`],
      result: h.s.factsById[`fact:order:${offer.id}`]}), beforeRepeat,
    `${offer.id}: accepting twice cannot reserve twice`);
  }
  h.until(s => offers.every(offer => s.worldTick >= s.srEconomy.orders[offer.id].arrivalTick), 'both delivery windows open', 1000);
  h.merchant();
  for (const offer of offers) {
    const before = {homeJade: home().resources.jade, merchantJade: merchantStock().resources.jade,
      merchantCargo: Object.fromEntries(Object.keys(offer.cost).map(key => [key, merchantStock().resources[key]])),
      reputation: h.s.sect.reputation};
    const completed = h.act('marketOrder', offer.id, 'deliver');
    assert.equal(completed.phase, 'completed');
    assert.equal(home().resources.jade, before.homeJade + offer.reward.jade);
    assert.equal(merchantStock().resources.jade, before.merchantJade - offer.reward.jade);
    assert.equal(h.s.sect.reputation, before.reputation + offer.rep);
    for (const [key, quantity] of Object.entries(offer.cost)) assert.equal(merchantStock().resources[key], before.merchantCargo[key] + quantity);
    assert.equal(h.s.reservationsById[`reservation:order:${offer.id}`], undefined);
    assert.deepEqual(h.s.factsById[`fact:order:${offer.id}`].cargo, offer.cost);
    exact(`${offer.id} completed`);
    const settled = JSON.stringify(h.s);
    assert.throws(() => h.act('marketOrder', offer.id, 'deliver'), /该订单已结算或拒绝/);
    assert.equal(JSON.stringify(h.s), settled, `${offer.id}: repeat delivery changes nothing`);
    exact(`${offer.id} repeat rejected`);
  }
  t.diagnostic(JSON.stringify({offers: offers.map(offer => offer.id), ...h.counts}));
});
