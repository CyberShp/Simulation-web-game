import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { initOpeningVisitors } from '../../../src/simulation/ea-courtyard-visitors.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';

const PERSON = 'person:lin-changfeng', MASTER = 'person:master';
const payload = (rank = 'outer') => ({ personId: PERSON, rank, affiliationId: 'scene:yunxiu-courtyard', mentorId: rank === 'direct' ? MASTER : null });
const snapshot = state => JSON.parse(JSON.stringify(state));
const send = (state, name, ...args) => SIM.dispatchCommand(state, { name, args }).state;
function until(state, predicate, limit = 1000) {
  for (let n = 0; n < limit && !predicate(state); n++) SIM.tick(state, .1);
  assert.ok(predicate(state), 'public world steps reach the requested state');
}
function approach(state) {
  state = send(state, 'moveScenicMaster', 27.5, 14);
  until(state, value => SIM.courtyardAdmissionView(value, PERSON).distance.near);
  return state;
}
function prepared() {
  let state = SIM.validateSave(seed.state);
  assert.deepEqual(state.resources, { jade: 60, wood: 25, stone: 25, herb: 6, crystal: 0, insight: 0, food: 50 });
  state = send(state, 'build', 'lumber', 26, 16);
  until(state, value => value.buildings.some(building => building.type === 'lumber'));
  return approach(state);
}
function refused(state, selection, pattern) {
  const before = snapshot(state);
  assert.throws(() => SIM.dispatchCommand(state, { name: 'admitCourtyardVisitor', args: [selection] }), pattern);
  assert.deepEqual(snapshot(state), before, 'a refused admission preserves every committed field');
}
const ready = prepared();

test('public construction and approach allow each selected rank on the original visitor', () => {
  for (const rank of ['outer', 'inner', 'direct']) {
    const state = SIM.cloneState(ready), before = snapshot(state), person = before.personsById[PERSON];
    const admitted = send(state, 'admitCourtyardVisitor', payload(rank));
    const record = admitted.courtyardAdmissions.recordsByPersonId[PERSON];
    assert.deepEqual(admitted.homeMemberIds, ['person:lu-zhiwei', PERSON]);
    assert.deepEqual(Object.keys(admitted.personsById), Object.keys(before.personsById));
    assert.equal(admitted.personsById[PERSON].id, person.id);
    assert.deepEqual(admitted.personsById[PERSON].appearance, person.appearance);
    assert.equal(admitted.personsById[PERSON].portrait, person.portrait);
    assert.deepEqual(admitted.personsById[PERSON].mind.relationships, person.mind.relationships);
    assert.equal(admitted.personsById[PERSON].mind.purse, person.mind.purse);
    assert.deepEqual(admitted.resources, before.stockpilesById['stockpile:yunxiu'].resources);
    assert.equal(admitted.worldTick, before.worldTick);
    assert.equal(admitted.rngState, before.rngState);
    assert.equal(admitted.story.step, 3);
    assert.equal(admitted.story.claimed.filter(id => id === 'story:2').length, 1);
    assert.equal(record.rank, rank);
    assert.equal(record.affiliationId, payload(rank).affiliationId);
    assert.equal(record.mentorId, payload(rank).mentorId);
    assert.equal(admitted.personsById[PERSON].mind.mentorId, rank === 'direct' ? 'master' : person.mind.mentorId);
    assert.equal(admitted.factsById[record.factId].atTick, before.worldTick);
    assert.equal(admitted.personsById[PERSON].mind.memories.filter(memory => memory.key === 'opening:changfeng-join').length, 1);
    assert.equal(admitted.personsById[PERSON].mind.memories.filter(memory => memory.key === `courtyard-admission:${PERSON}`).length, 1);
  }
});

test('admission projection is read-only and rechecks construction, arrival and actual distance', () => {
  const state = SIM.cloneState(ready), before = snapshot(state);
  const view = SIM.courtyardAdmissionView(state, PERSON);
  view.rankOptions[0].label = 'changed';
  view.conditions[0].met = false;
  assert.equal(SIM.courtyardAdmissionView(state, PERSON).rankOptions[0].label, '外门');
  assert.deepEqual(snapshot(state), before);
  const missingLumber = approach(SIM.validateSave(seed.state));
  assert.equal(SIM.courtyardAdmissionView(missingLumber, PERSON).conditions.find(condition => condition.id === 'lumber').met, false);
  refused(missingLumber, payload(), /伐木场/);
  const far = send(state, 'moveScenicMaster', 35, 28);
  until(far, value => !SIM.courtyardAdmissionView(value, PERSON).distance.near);
  refused(far, payload(), /身边/);
  // The existing arrival initializer supplies a valid waiting record in this boundary fixture.
  const travelling = SIM.cloneState(ready);
  initOpeningVisitors(travelling);
  assert.equal(SIM.courtyardAdmissionView(travelling, PERSON).conditions.find(condition => condition.id === 'arrival').met, false);
  refused(travelling, payload(), /山路上/);
});

test('invalid rank, affiliation, mentor and person choices never settle admission', () => {
  const state = SIM.cloneState(ready);
  for (const [selection, pattern] of [
    [null, /选择/],
    [{ ...payload(), rank: 'unknown' }, /门籍/],
    [{ ...payload(), affiliationId: 'peak:unbuilt' }, /本院/],
    [{ ...payload('direct'), mentorId: null }, /师/],
    [{ ...payload('direct'), mentorId: PERSON }, /师/],
    [{ ...payload(), mentorId: MASTER }, /亲传师父/],
    [{ ...payload(), personId: 'person:cheng-wenzhou' }, /约定/],
    [{ ...payload(), personId: 'person:missing' }, /约定/],
  ]) refused(state, selection, pattern);
});

test('formal admission checks available places and a busy body using explicit unit fixtures', () => {
  const full = SIM.cloneState(ready);
  // Additional residents are a boundary fixture; this is not a normal admission path.
  while (full.homeMemberIds.length < SIM.capacity(full)) SIM.addDisciple(full);
  assert.equal(SIM.courtyardAdmissionView(full, PERSON).conditions.find(condition => condition.id === 'capacity').met, false);
  refused(full, payload(), /居所/);
  const busy = SIM.cloneState(ready);
  busy.master.activityId = 'activity:admission-busy-fixture';
  busy.activitiesById[busy.master.activityId] = { id: busy.master.activityId, kind: 'construction' };
  assert.equal(SIM.courtyardAdmissionView(busy, PERSON).conditions.find(condition => condition.id === 'available').met, false);
  refused(busy, payload(), /身体活动/);
});

test('receipt replay is exact after save, and a new duplicate command is clearly refused', () => {
  const state = SIM.cloneState(ready), command = { name: 'admitCourtyardVisitor', args: [payload('direct')], id: `command:${state.transactions.nextCommandId}`, expectedRevision: state.revision };
  const committed = SIM.dispatchCommand(state, command);
  const loaded = SIM.validateSave(snapshot(committed.state)), before = snapshot(loaded);
  const replay = SIM.dispatchCommand(loaded, command);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result, committed.result);
  assert.deepEqual(snapshot(replay.state), before);
  refused(loaded, payload('direct'), /已在山院名册/);
  refused(loaded, payload('inner'), /已在山院名册/);
  assert.equal(SIM.courtyardAdmissionView(loaded, PERSON).membership.mentorName, loaded.master.name);
});

test('admission and subsequent autonomous steps survive exact save and load', () => {
  let state = send(SIM.cloneState(ready), 'admitCourtyardVisitor', payload('inner'));
  const before = snapshot(state), loaded = SIM.validateSave(before);
  assert.deepEqual(snapshot(loaded), before);
  assert.deepEqual(SIM.courtyardAdmissionView(loaded, PERSON), SIM.courtyardAdmissionView(state, PERSON));
  SIM.tick(state, 120); SIM.tick(loaded, 120);
  assert.deepEqual(snapshot(loaded), snapshot(state));
  assert.equal(state.courtyardAdmissions.recordsByPersonId[PERSON].rank, 'inner');
  assert.equal(state.economy.starvation, 0);
  assert.ok(state.personsById[PERSON].schedule.updatedThroughTick > before.worldTick);
  assert.ok(Object.values(state.factsById).some(fact => fact.operation === 'production' && fact.participantIds?.includes(PERSON)), 'the admitted person participates in real production');
});

test('old saves retain their people, assets, mentor relationships and unrecorded ranks', () => {
  const source = snapshot(seed.state), raw = JSON.stringify(source);
  delete source.courtyardAdmissions;
  const loaded = SIM.validateSave(source);
  assert.equal(JSON.stringify(source), raw);
  assert.deepEqual(loaded.personsById, source.personsById);
  assert.deepEqual(loaded.stockpilesById, source.stockpilesById);
  assert.deepEqual(loaded.homeMemberIds, source.homeMemberIds);
  assert.deepEqual(loaded.courtyardAdmissions.recordsByPersonId, {});
  assert.equal(SIM.courtyardAdmissionView(loaded, 'person:lu-zhiwei').membership, null);
  const oldJoined = send(SIM.cloneState(ready), 'advanceStory');
  oldJoined.personsById[PERSON].mind.mentorId = 'master';
  delete oldJoined.courtyardAdmissions;
  const oldSnapshot = snapshot(oldJoined), resumed = SIM.validateSave(oldSnapshot);
  assert.deepEqual(resumed.personsById, oldSnapshot.personsById);
  assert.deepEqual(resumed.homeMemberIds, oldSnapshot.homeMemberIds);
  assert.equal(SIM.courtyardAdmissionView(resumed, PERSON).status, 'member');
  assert.equal(SIM.courtyardAdmissionView(resumed, PERSON).membership, null);
  refused(resumed, payload('direct'), /已在山院名册/);
});

test('future and damaged admission records are rejected while the input remains intact', () => {
  const admitted = send(SIM.cloneState(ready), 'admitCourtyardVisitor', payload('direct'));
  for (const mutate of [
    state => { state.courtyardAdmissions.version = 'courtyard-admissions-2'; },
    state => { state.courtyardAdmissions = null; },
    state => { state.courtyardAdmissions.recordsByPersonId[PERSON].rank = 'unknown'; },
    state => { state.courtyardAdmissions.recordsByPersonId[PERSON].mentorId = PERSON; },
    state => { state.courtyardAdmissions.recordsByPersonId[PERSON].affiliationId = 'scene:valley'; },
    state => { state.courtyardAdmissions.recordsByPersonId[PERSON].admittedAtTick = state.worldTick + 1; },
    state => { delete state.factsById[state.courtyardAdmissions.recordsByPersonId[PERSON].factId]; },
    state => { delete state.courtyardAdmissions; },
    state => { state.courtyardAdmissions.recordsByPersonId = {}; },
  ]) {
    const input = snapshot(admitted); mutate(input); const before = snapshot(input);
    assert.throws(() => SIM.validateSave(input), /门籍/);
    assert.deepEqual(input, before);
  }
});
