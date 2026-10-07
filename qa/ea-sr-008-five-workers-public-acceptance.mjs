/** SR-XF-008-AC-02: five naturally recruited people meet two physical lumber work slots. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAUI} from '../dist/ea-ui.mjs';
import {spatialSlots} from '../dist/ea-sr-spatial.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

function selectedPersonCard(state, id) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const fragments = [];
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      childNodes: [], textContent: '', dataset: {}, style: {}, scrollTop: 0, attributes: {},
      classList: {toggle(){}, add(){}, remove(){}, contains(){return false;}},
      setAttribute(){}, removeAttribute(){}, addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return []}
    });
    return nodes.get(selector);
  };
  globalThis.window = {matchMedia: () => ({matches: false})};
  globalThis.document = {
    activeElement: null, body: node('body'), querySelector: node, getElementById: id => node('#' + id),
    querySelectorAll: () => [], addEventListener(){},
    createElement: () => ({set innerHTML(value){fragments.push(value);}, content: {childNodes: []}})
  };
  try {
    const ui = createEAUI({getState: () => state, getScene: () => 'map', getTab: () => 'disciples',
      openModal(){}, act(){throw Error('a read-only person card cannot issue a command');}, ensureRunning(){}});
    ui.renderDetail({kind: 'person', id});
    return fragments.at(-1);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('SR-XF-008-AC-02: five public recruits use two lumber slots without crowded or phantom production', () => {
  const h = normalOpening();
  const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6, gameVersion: '1.6.0-dev', writerId: 'qa-sr008-ac02'});
  const evidenceDir = process.env.XIANFU_QA_SR008_AC02_DIR;
  const checkpoint = label => {
    h.save();
    const raw = JSON.stringify(h.s);
    const exported = persistence.exportState(h.s, {slot: 1});
    const restored = persistence.parseImport(exported);
    assert.equal(restored.ok, true, `${label}: native import succeeds`);
    assert.equal(JSON.stringify(restored.state), raw, `${label}: exact world survives reload`);
    assert.equal(renderSRPanel(restored.state, SIM, 'disciples'), renderSRPanel(h.s, SIM, 'disciples'),
      `${label}: public person cards survive reload`);
    assert.equal(JSON.stringify(h.s), raw, `${label}: management view remains read-only`);
    if (!evidenceDir) return;
    const dir = resolve(evidenceDir);
    mkdirSync(dir, {recursive: true});
    const provenance = {kind: 'normal-public-command-checkpoint', label: `SR-XF-008-AC-02 ${label}`, seed: 618033, counts: h.counts};
    writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance, state: h.s}));
    writeFileSync(resolve(dir, `${label}-import.json`), exported);
  };
  const workBodies = facilityId => h.s.disciples.map(p => ({person: p, body: h.s.activitiesById[p.activityId]}))
    .filter(({body}) => body?.targetId === facilityId && body.action === 'work');

  h.build('house');
  for (let n = 0; n < 3; n++) {
    h.resources({jade: 65, herb: 8, food: 8});
    const person = h.act('recruit');
    assert(h.s.homeMemberIds.includes(person.personId), 'the new person joined by a public recruitment command');
    h.save();
  }
  h.resources({food: 60});
  assert.equal(h.s.disciples.length, 5);
  assert(SIM.capacity(h.s) >= 5);
  assert.equal(new Set(h.s.disciples.map(p => p.personId)).size, 5);
  checkpoint('five-recruited');

  const facility = h.s.buildings.find(b => b.type === 'lumber');
  assert(facility?.enabled && facility.condition > 0);
  const slots = spatialSlots(facility, 'work');
  assert.equal(slots.length, 2, 'the real prefab declares two distinct work positions');
  assert.notDeepEqual(slots[0].position, slots[1].position);
  const stockId = `stockpile:${facility.instanceId}`;
  const stock = () => h.s.stockpilesById[stockId];
  assert(stock().resources.wood > 0, 'earlier autonomous production is physically stored at the lumber facility');
  for (let n = 0; n < 3; n++) {
    const carried = h.act('startTransport', stockId, 'stockpile:yunxiu', 'person:master', {wood: 40});
    h.save();
    h.until(s => s.workOrdersById[carried.id].phase === 'delivered', 'master physically carries lumber into public storage');
    h.save();
  }
  assert(stock().capacity - stock().resources.wood >= 18, 'one complete output can fit at the real facility');
  checkpoint('lumber-cleared');

  const inviteTick = h.s.worldTick;
  const offers = h.s.disciples.map(p => ({personId: p.personId, ...h.act('inviteWork', p.personId, facility.instanceId)}));
  assert.equal(offers.length, 5, 'every person receives a separate offer');
  assert(offers.filter(o => o.accepted).length >= 3, 'more willing workers than available places');
  assert(offers.some(o => o.available && !o.accepted), 'one person may choose another activity');
  assert.equal(h.s.worldTick, inviteTick, 'offering jobs does not advance production');
  checkpoint('five-invited');

  const orderId = `work:production:${facility.instanceId}`;
  const beforeWalking = h.s.workOrdersById[orderId].progressTicks;
  const woodBeforeWalking = stock().resources.wood;
  h.until(s => s.worldTick === inviteTick + 10, 'people start walking and waiting', 10);
  assert.equal(h.s.workOrdersById[orderId].progressTicks, beforeWalking,
    'approach and queuing do not increase the shared batch');
  assert.equal(stock().resources.wood, woodBeforeWalking, 'approach and queuing do not make output');

  h.until(s => workBodies(facility.instanceId).filter(({body}) => body.phase === 'executing').length === 2 &&
    workBodies(facility.instanceId).filter(({body}) => body.phase === 'waiting').length >= 1,
  'two arrive while further willing workers queue', 300);
  const workers = workBodies(facility.instanceId);
  const executing = workers.filter(({body}) => body.phase === 'executing');
  const waiting = workers.filter(({body}) => body.phase === 'waiting');
  assert.equal(executing.length, 2);
  assert.equal(waiting.length, 2, 'the two other willing workers wait');
  assert.equal(new Set(executing.map(({body}) => body.slotId)).size, 2);
  for (const {person, body} of executing) {
    const slot = slots.find(slot => slot.id === body.slotId);
    assert(slot, `${person.name} owns a declared physical slot`);
    const reservation = h.s.reservationsById[body.reservationId];
    assert.equal(reservation?.personId, person.personId);
    assert.equal(reservation?.slotId, slot.id);
    assert.equal(person.mind.scenic.x, slot.position.x);
    assert.equal(person.mind.scenic.y, slot.position.y);
  }
  assert.equal(new Set(waiting.map(({body}) => `${body.waitingPosition.x}:${body.waitingPosition.y}`)).size, 2,
    'waiting positions are separate');
  for (const {person, body} of waiting) {
    assert.equal(body.slotId, null);
    assert.equal(body.reservationId, null);
    assert.equal(person.mind.scenic.x, body.waitingPosition.x);
    assert.equal(person.mind.scenic.y, body.waitingPosition.y);
    assert(slots.every(slot => Math.hypot(person.mind.scenic.x - slot.position.x,
      person.mind.scenic.y - slot.position.y) > 1.5), 'waiting stays outside work positions');
  }
  const personViews = SIM.viewPersons(h.s);
  for (const {person, body} of workers) {
    const view = personViews.find(v => v.personId === person.personId);
    assert.equal(view.schedule.reason, body.reason);
    assert.equal(view.appearance.action, body.phase === 'executing' ? 'gather' : 'waiting');
    assert(renderSRPanel(h.s, SIM, 'disciples').includes(body.reason), `${person.name} has a visible reason`);
  }
  const other = h.s.disciples.find(p => !offers.find(o => o.personId === p.personId).accepted);
  assert(other && !workers.some(({person}) => person.personId === other.personId), 'the refusing person continues another life activity');
  const selectedBefore = JSON.stringify(h.s);
  const workerCard = selectedPersonCard(h.s, executing[0].person.id);
  assert.match(workerCard, /生产 · 伐木场 · 作业工位 [12]/);
  assert.match(workerCard, /正在使用作业工位 [12]/);
  const waitingCard = selectedPersonCard(h.s, waiting[0].person.id);
  assert.match(waitingCard, /生产 · 伐木场/);
  assert.match(waitingCard, /工位已满，在门外独立位置等候|前面有人等候工位/);
  assert.equal(JSON.stringify(h.s), selectedBefore, 'selecting worker and waiter cards does not advance the world');
  checkpoint('two-working-two-waiting');

  const batch = h.s.workOrdersById[orderId].batch;
  const woodBeforeBatch = stock().resources.wood;
  h.until(s => Boolean(s.factsById[`fact:production:${facility.instanceId}:${batch}`]),
    'the shared batch finishes with two actual contributors', 150);
  const fact = h.s.factsById[`fact:production:${facility.instanceId}:${batch}`];
  assert.deepEqual(new Set(fact.participantIds), new Set(executing.map(({person}) => person.personId)));
  assert(fact.quantities.wood > 0);
  assert(Math.abs(stock().resources.wood - woodBeforeBatch - fact.quantities.wood) < 1e-7,
    'one result fact accounts for exactly one physically stored output');
  assert(waiting.every(({person}) => !fact.participantIds.includes(person.personId)),
    'people waiting by the facility produce nothing');
  checkpoint('shared-batch-settled');
});
