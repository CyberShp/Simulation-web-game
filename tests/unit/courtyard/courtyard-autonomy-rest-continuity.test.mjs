import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {npcScheduleDecision} from '../../../src/simulation/ea-sr-persons.mjs';

const PERSON = 'person:lu-zhiwei';

function fixture({phase = 'navigating', worldTick = 100, energy = 83, wound = 0, reservation = true} = {}) {
  const s = SIM.initial({sr: true});
  s.srCultivation = null;
  s.worldTick = worldTick;
  const p = s.personsById[PERSON];
  p.energy = energy;
  p.wound = wound;
  p.mind.satiety = 100;
  p.mind.activity = 'rest';
  p.mind.reason = '夜间休整，白日再权衡工作与研习。';
  p.mind.commitUntil = s.time + 12;
  p.mind.scenic = {path: [{x: 1, y: 1}, {x: 2, y: 2}], goal: {x: 2, y: 2}, steps: 4};
  p.schedule.commitUntilTick = s.worldTick;
  p.schedule.phase = 'rest';
  const building = s.buildingsById['building:yunxiu:1'];
  const a = {
    id: 'activity:body:test-rest',
    kind: 'facility',
    personId: PERSON,
    action: 'rest',
    phase,
    targetId: building.instanceId,
    slotId: 'building:yunxiu:1/slot:bed:fixture',
    reservationId: 'reservation:slot:test-rest',
    startedTick: s.worldTick - 120,
    reason: '前往床位。',
  };
  s.activitiesById[a.id] = a;
  p.activityId = a.id;
  if (reservation) {
    s.reservationsById[a.reservationId] = {id: a.reservationId, kind: 'slot', personId: PERSON, activityId: a.id, slotId: a.slotId, createdTick: a.startedTick};
  }
  return {s, p, a, building};
}

function assertPreserved(run, original) {
  assert.equal(run.result, true);
  assert.equal(run.p.activityId, original.id);
  assert.equal(run.s.activitiesById[original.id], original);
  assert.equal(original.startedTick, run.s.worldTick - 120);
  assert.equal(original.slotId, run.p.mind.scenic.activitySlotId ?? original.slotId);
  assert.deepEqual(run.p.mind.scenic.path, [{x: 1, y: 1}, {x: 2, y: 2}]);
  assert.equal(run.p.mind.scenic.steps, 4);
  assert.equal(run.s.reservationsById[original.reservationId].slotId, original.slotId);
  assert.equal(run.p.schedule.commitUntilTick, run.s.worldTick + 120);
  assert.equal(run.p.mind.commitUntil, run.s.time + 12);
}

for (const phase of ['navigating', 'waiting', 'executing']) {
  test(`expired rest commitment keeps an active rest ${phase} activity, reservation, startedTick and route`, () => {
    const {s, p, a} = fixture({phase});
    const result = npcScheduleDecision(s, p);
    assertPreserved({s, p, result}, a);
    assert.equal(p.mind.activity, 'rest');
    assert.equal(p.mind.reason, '夜间休整，白日再权衡工作与研习。');
    assert.equal(s.activitiesById[a.id], a);
  });
}

test('active rest without a matching reservation is not kept as a valid rest continuation', () => {
  const {s, p, a} = fixture({reservation: false});
  npcScheduleDecision(s, p);
  assert.equal(p.activityId, null);
  assert.equal(s.activitiesById[a.id], undefined);
  assert.equal(p.mind.activity, 'rest');
  assert.equal(p.schedule.commitUntilTick, s.worldTick + 120);
});

test('non-rest phase does not take the rest-continuation branch; normal autonomy remains the switch path', () => {
  const {s, p, a} = fixture({worldTick: 300});
  const before = a;
  const result = npcScheduleDecision(s, p);
  assert.equal(result, false);
  assert.equal(p.schedule.phase, 'work');
  assert.equal(p.activityId, before.id);
  assert.equal(s.activitiesById[before.id], before);
  assert.equal(p.mind.activity, 'rest');
});

test('emergency energy interruption still releases the rest activity and current commitment is cancelled', () => {
  const {s, p, a} = fixture({energy: 7});
  const result = npcScheduleDecision(s, p);
  assert.equal(result, false);
  assert.equal(p.activityId, null);
  assert.equal(s.activitiesById[a.id], undefined);
  assert.equal(s.reservationsById[a.reservationId], undefined);
  assert.equal(p.mind.activity, 'rest');
  assert.equal(p.schedule.commitUntilTick, s.worldTick);
});

test('emergency wound interruption still releases the rest activity and switches to heal', () => {
  const {s, p, a} = fixture({wound: 21});
  const result = npcScheduleDecision(s, p);
  assert.equal(result, false);
  assert.equal(p.activityId, null);
  assert.equal(s.activitiesById[a.id], undefined);
  assert.equal(p.mind.activity, 'heal');
  assert.equal(p.schedule.commitUntilTick, s.worldTick);
});
