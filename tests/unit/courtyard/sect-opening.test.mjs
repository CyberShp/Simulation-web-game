import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import { createOpeningSectSession, createSectSession, commandSect, advanceSect, openingView,
  snapshotSect, restoreSect, validateSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';

const home = session => session.state.stockpilesById['stockpile:yunxiu'].resources;
function send(session, request) {
  const result = commandSect(session, request);
  assert.equal(result.ok, true, `${request.type}: ${result.error || ''}`);
  return result;
}
function rejected(session, request) {
  const before = snapshotSect(session), result = commandSect(session, request);
  assert.equal(result.ok, false, request.type);
  assert.deepEqual(snapshotSect(session), before, `${request.type} preserves committed state`);
}
function roundTrip(session) {
  const before = snapshotSect(session), restored = restoreSect(JSON.stringify(before));
  assert.deepEqual(snapshotSect(restored), before);
  assert.equal(validateSect(restored), true);
  assert.deepEqual(openingView(restored), openingView(session));
  assert.deepEqual(snapshotSect(session), before, 'the opening projection is read-only');
  return restored;
}
function readIntro(session) {
  send(session, { type: 'opening-intro', page: 1 });
  send(session, { type: 'opening-intro', page: 2 });
  send(session, { type: 'opening-intro', complete: true });
}
function choose(session, lineage = 'qinglan') {
  readIntro(session);
  send(session, { type: 'heal' });
  send(session, { type: 'choose-inheritance', lineage });
}
function until(session, predicate, limit = 1000) {
  for (let n = 0; n < limit && !predicate(session); n++) advanceSect(session, .1);
  assert.ok(predicate(session), `expected progress, current stage: ${openingView(session).stage}`);
}

test('a desktop opening starts from the official mountain initial world and keeps its identities', () => {
  const s = createOpeningSectSession({ name: '沈行舟' });
  const initial = SIM.validateSave(SIM.initial({ sr: true, mountainOpening: true, name: '沈行舟' }));
  assert.deepEqual(s.state, initial);
  assert.equal(s.provenance.kind, 'official-initial-opening');
  assert.equal(s.baseline.tick, 0);
  assert.equal(s.state.master.name, '沈行舟');
  assert.deepEqual(s.state.homeMemberIds, []);
  assert.deepEqual(Object.keys(s.state.buildingsById), ['building:yunxiu:1']);
  assert.equal(s.state.story.opening.hallPhase, 'shelter');
  assert.equal(s.state.spatial.domain, undefined);
  assert.equal(s.state.spatial.courtyardTerrain, undefined);
  assert.deepEqual(home(s), { jade: 110, wood: 65, stone: 45, herb: 22, crystal: 0, insight: 0, food: 50 });
  assert.deepEqual(openingView(s).masterPosition, { x: 28, y: 12.6 });
  assert.deepEqual(openingView(s).hallPosition, { x: 24, y: 4 });
  assert.deepEqual(viewSect(s).buildings[0].entrance, { x: 28, y: 12.6 });
  assert.equal(viewSect(s).opening.stage, 'intro');
  roundTrip(s);
  assert.throws(() => createOpeningSectSession({ name: '' }), /姓名/);
});

test('intro pages are public commands, survive reload, and reading does not advance the world', () => {
  let s = createOpeningSectSession();
  const beforeReading = snapshotSect(s);
  advanceSect(s, 60);
  assert.deepEqual(snapshotSect(s), beforeReading);
  rejected(s, { type: 'opening-intro', complete: true });
  rejected(s, { type: 'opening-intro', page: 3 });
  rejected(s, { type: 'heal' });
  rejected(s, { type: 'establish-hall' });
  rejected(s, { type: 'auto' });
  for (const page of [1, 2]) {
    send(s, { type: 'opening-intro', page });
    assert.equal(s.state.story.onboarding.introPage, page);
    s = roundTrip(s);
    assert.equal(openingView(s).introPage, page);
  }
  send(s, { type: 'opening-intro', complete: true });
  assert.equal(s.state.story.intro, true);
  assert.equal(s.state.worldTick, 0);
  assert.equal(openingView(s).stage, 'shelter');
  assert.equal(openingView(s).readingRequired, true);
  assert.deepEqual(home(s), beforeReading.state.stockpilesById['stockpile:yunxiu'].resources);
  rejected(s, { type: 'opening-intro', complete: true });
  rejected(s, { type: 'choose-inheritance', lineage: 'qinglan' });
  rejected(s, { type: 'establish-hall' });
  roundTrip(s);
});

test('the same new world heals, chooses, recovers, carries materials and completes its hall across precise saves', () => {
  let s = createOpeningSectSession();
  const identities = Object.keys(s.state.personsById);
  readIntro(s);
  s = roundTrip(s);
  send(s, { type: 'heal' });
  assert.equal(home(s).herb, 16);
  assert.equal(s.state.worldTick, 0);
  assert.equal(s.state.master.wound, 30);
  assert.equal(openingView(s).stage, 'inheritance');
  s = roundTrip(s);
  const pending = snapshotSect(s);
  advanceSect(s, 60);
  assert.deepEqual(snapshotSect(s), pending);
  rejected(s, { type: 'heal' });
  rejected(s, { type: 'choose-inheritance', lineage: 'missing' });
  rejected(s, { type: 'establish-hall' });
  send(s, { type: 'choose-inheritance', lineage: 'hanquan' });
  assert.equal(home(s).herb, 16);
  assert.equal(openingView(s).stage, 'recovering');
  advanceSect(s, 5);
  assert.ok(s.state.master.wound > 0 && s.state.master.wound < 30, 'recovery consumes real world steps');
  assert.equal(s.state.worldTick, 50);
  s = roundTrip(s);
  rejected(s, { type: 'heal' });
  rejected(s, { type: 'choose-inheritance', lineage: 'qinglan' });
  rejected(s, { type: 'establish-hall' });
  until(s, current => openingView(current).stage === 'hall-ready');
  s = roundTrip(s);
  assert.equal(s.state.master.wound, 0);
  assert.equal(s.state.story.step, 0);
  assert.equal(s.state.story.claimed.includes('story:0'), false);
  assert.equal(s.state.story.opening.hallPhase, 'shelter');
  assert.equal(home(s).herb, 16);
  rejected(s, { type: 'heal' });
  const resources = structuredClone(home(s));
  advanceSect(s, 60);
  assert.equal(openingView(s).stage, 'hall-ready', 'waiting never confirms construction');
  assert.deepEqual(s.control, { mode: 'manual', idleMs: 0 });
  assert.equal(s.state.master.main, 'frost');
  assert.equal(s.ledger.some(entry => entry.kind === 'autonomous-action'), false);
  send(s, { type: 'establish-hall' });
  assert.equal(openingView(s).stage, 'hall-building');
  assert.equal(s.state.story.step, 1);
  assert.equal(s.state.story.claimed.filter(id => id === 'story:0').length, 1);
  assert.deepEqual(s.state.transactions.receipts.slice(-2).map(receipt => JSON.parse(receipt.signature)[0]), ['advanceStory', 'establishHall']);
  assert.equal(home(s).jade, resources.jade - 20);
  assert.equal(home(s).wood, resources.wood - 15);
  assert.equal(home(s).stone, resources.stone - 10);
  assert.equal(home(s).herb, 16);
  const hallId = s.state.buildingsById['building:yunxiu:1'].instanceId;
  rejected(s, { type: 'establish-hall' });
  until(s, current => current.state.workOrdersById['work:construction:1']?.materialFlow?.phase === 'carrying');
  s = roundTrip(s);
  const carried = s.state.workOrdersById['work:construction:1'].materialFlow.cargo;
  assert.deepEqual(carried, { wood: 15, stone: 10 });
  until(s, current => (current.state.workOrdersById['work:construction:1']?.progressTicks || 0) >= 100);
  s = roundTrip(s);
  const resumed = roundTrip(s);
  until(s, current => openingView(current).stage === 'complete');
  until(resumed, current => openingView(current).stage === 'complete');
  assert.deepEqual(snapshotSect(resumed), snapshotSect(s), 'continuation is deterministic after a mid-build reload');
  assert.equal(s.state.buildingsById[hallId].instanceId, hallId);
  assert.deepEqual(Object.keys(s.state.personsById), identities);
  assert.deepEqual(s.state.homeMemberIds, []);
  assert.equal(openingView(s).active, false);
  assert.equal(s.state.story.opening.inheritance.selected, 'hanquan');
  assert.equal(s.state.story.step, 1);
  assert.equal(s.state.story.opening.gifted, false);
  assert.equal(s.state.story.opening.invitation, 'unasked');
  assert.equal(s.state.spatial.completedOrders.at(-1).operation, 'establish');
  roundTrip(s);
});

test('all five inheritance choices grant only their chosen three arts and charge the first heal once', () => {
  for (const lineage of ['qinglan', 'chiyang', 'hanquan', 'houttu', 'jinfeng']) {
    const s = createOpeningSectSession();
    choose(s, lineage);
    const option = openingView(s).inheritance.options.find(value => value.id === lineage);
    assert.equal(Object.hasOwn(option, 'source'), false);
    assert.equal(s.state.master.main, option.heart);
    assert.deepEqual(s.state.doctrine.books, [option.heart, option.attack, option.guard]);
    assert.deepEqual(Object.keys(s.state.master.knowledge), [option.heart, option.attack, option.guard]);
    assert.equal(home(s).herb, 16);
    rejected(s, { type: 'heal' });
    rejected(s, { type: 'choose-inheritance', lineage });
    roundTrip(s);
  }
});

test('an unreachable construction supply rolls back both the healing milestone and establishment', () => {
  const s = createOpeningSectSession();
  choose(s);
  until(s, current => openingView(current).stage === 'hall-ready');
  // Failure fixture: a valid recorded stockpile whose actual location has no
  // reachable construction pickup point. The normal chain above stays intact.
  const fixture = snapshotSect(s);
  fixture.state.stockpilesById['stockpile:yunxiu'].position = { sceneId: 'scene:yunxiu-courtyard', x: 60, y: 20 };
  const blocked = restoreSect(fixture);
  assert.equal(openingView(blocked).canEstablishHall, true, 'material amounts meet the public requirements');
  const before = snapshotSect(blocked), result = commandSect(blocked, { type: 'establish-hall' });
  assert.equal(result.ok, false);
  assert.match(result.error, /无法实际抵达.*材料存放处/);
  assert.deepEqual(snapshotSect(blocked), before, 'the failed second command commits neither command');
  assert.equal(blocked.state.story.step, 0);
  assert.equal(blocked.state.story.claimed.includes('story:0'), false);
  assert.equal(blocked.state.story.opening.hallPhase, 'shelter');
  assert.equal(home(blocked).wood, 65);
});

test('a paused first heal preserves pause intent and fractional time across selection and restore', () => {
  let s = createOpeningSectSession();
  readIntro(s);
  send(s, { type: 'pause', paused: true });
  send(s, { type: 'heal' });
  assert.equal(s.state.story.opening.inheritance.resumeSpeed, 0);
  s = roundTrip(s);
  send(s, { type: 'choose-inheritance', lineage: 'chiyang' });
  const paused = snapshotSect(s);
  advanceSect(s, 30);
  assert.deepEqual(snapshotSect(s), paused);
  send(s, { type: 'pause', paused: false });
  advanceSect(s, .05);
  assert.equal(s.state.worldTick, 0);
  assert.equal(s.carrySeconds, .05);
  const restored = roundTrip(s);
  for (const current of [s, restored]) advanceSect(current, .05);
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  assert.equal(s.state.worldTick, 1);
  assert.equal(s.carrySeconds, 0);
  assert.equal(home(s).herb, 16);
});

test('opening protection keeps real manual movement and restores thirty-second autonomy after completion', () => {
  const s = createOpeningSectSession();
  readIntro(s);
  send(s, { type: 'move', x: 30, y: 16 });
  const start = { x: s.state.master.scenic.x, y: s.state.master.scenic.y };
  advanceSect(s, 1);
  assert.notDeepEqual({ x: s.state.master.scenic.x, y: s.state.master.scenic.y }, start, 'shelter guidance does not freeze explicit movement');
  assert.equal(s.state.worldTick, 10);
  send(s, { type: 'heal' });
  send(s, { type: 'choose-inheritance', lineage: 'qinglan' });
  until(s, current => openingView(current).stage === 'hall-ready');
  rejected(s, { type: 'return-auto' });
  send(s, { type: 'establish-hall' });
  until(s, current => openingView(current).stage === 'complete');
  assert.deepEqual(s.control, { mode: 'manual', idleMs: 0 });
  advanceSect(s, 29.9);
  assert.equal(s.control.mode, 'manual');
  advanceSect(s, .1);
  assert.equal(s.control.mode, 'auto');
  assert.equal(s.state.master.action, 'cultivate');
  assert.ok(s.ledger.some(entry => ['autonomous-action', 'waiting'].includes(entry.kind)));
});

test('checkpoint sessions keep their source, exact restore and existing autonomous behavior', () => {
  const s = createSectSession(), before = snapshotSect(s);
  assert.deepEqual(s.state, SIM.validateSave(seed.state));
  assert.deepEqual(s.provenance, seed.provenance);
  assert.equal(openingView(s).enabled, false);
  assert.equal(openingView(s).active, false);
  const restored = roundTrip(s);
  assert.deepEqual(snapshotSect(s), before);
  for (const current of [s, restored]) {
    send(current, { type: 'auto' });
    advanceSect(current, 5);
  }
  assert.deepEqual(snapshotSect(restored), snapshotSect(s));
  assert.ok(s.state.worldTick > before.state.worldTick);
});
