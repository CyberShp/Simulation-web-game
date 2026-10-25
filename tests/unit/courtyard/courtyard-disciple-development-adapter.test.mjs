import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession, commandSect, snapshotSect, restoreSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';

test('nearby growth view distinguishes a study intention from waiting for a real desk', () => {
  const session = createSectSession(), s = session.state, p = s.personsById[s.homeMemberIds[0]];
  Object.assign(s.master.scenic, { x: p.mind.scenic.x, y: p.mind.scenic.y });
  p.mind.activity = 'study'; p.mind.learning = { id: 'qingyuan', progress: 3, total: 55 };
  p.mind.reason = '继续完成既定功课。'; p.activityId = 'activity:test:study-wait';
  s.activitiesById[p.activityId] = { id: p.activityId, kind: 'facility', personId: p.personId, action: 'study', phase: 'waiting', reason: '工位已满，等候书案。' };
  const before = JSON.stringify(s);
  const member = viewSect(session).discipleDevelopment.members.find(member => member.personId === p.personId);
  assert.equal(member.contact.available, true);
  assert.equal(member.activityStatus, 'waiting');
  assert.equal(member.physicalReason, '工位已满，等候书案。');
  assert.equal(member.reason, '继续完成既定功课。');
  assert.equal(JSON.stringify(s), before);
  s.master.position.sceneId = 'scene:valley';
  const remote = viewSect(session).discipleDevelopment.members.find(member => member.personId === p.personId);
  assert.equal(remote.activityStatus, undefined); assert.equal(remote.physicalReason, undefined);
});

test('desktop work focus preserves bodies and resources, survives reload, and rejects invalid values atomically', () => {
  const session = createSectSession();
  const before = snapshotSect(session);
  const response = commandSect(session, { type: 'disciple-work-focus', value: 'wood' });
  assert.equal(response.ok, true, response.error);
  assert.equal(session.state.doctrine.workFocus, 'wood');
  assert.equal(session.state.worldTick, before.state.worldTick);
  assert.deepEqual(session.state.personsById, before.state.personsById);
  assert.deepEqual(session.state.stockpilesById, before.state.stockpilesById);
  assert.deepEqual(restoreSect(snapshotSect(session)).state, session.state);

  const changed = snapshotSect(session);
  const invalid = commandSect(session, { type: 'disciple-work-focus', value: 'force-everyone' });
  assert.equal(invalid.ok, false);
  assert.deepEqual(snapshotSect(session), changed);
  viewSect(session);
  viewSect(session);
  assert.deepEqual(snapshotSect(session), changed, 'reading growth and work opportunities must not advance or mutate the world');
});

test('desktop recommendation keeps a committed refusal and restores it with the same public answer', () => {
  const session = createSectSession();
  const before = snapshotSect(session);
  const request = { type: 'recommend-disciple-technique', personId: 'person:lu-zhiwei', techniqueId: 'qingwind' };
  const reply = commandSect(session, request);
  assert.equal(reply.ok, false);
  assert.equal(reply.refused, true);
  assert.equal(reply.result.accepted, false);
  assert.ok(reply.error);
  assert.equal(session.state.worldTick, before.state.worldTick);
  assert.deepEqual(session.state.stockpilesById, before.state.stockpilesById);
  const restored = restoreSect(snapshotSect(session));
  const again = commandSect(restored, request);
  assert.equal(again.refused, true);
  assert.equal(again.error, reply.error);
  const originalMember = viewSect(session).discipleDevelopment.members.find(member => member.personId === request.personId);
  const restoredMember = viewSect(restored).discipleDevelopment.members.find(member => member.personId === request.personId);
  assert.deepEqual(restoredMember.recommendation, originalMember.recommendation);
});

test('a fully understood technique cannot become a study promise even when it is not an active support', () => {
  const session = createSectSession(), s = session.state, p = s.personsById[s.homeMemberIds[0]];
  Object.assign(s.master.scenic, { x: p.mind.scenic.x, y: p.mind.scenic.y });
  p.mind.knowledge.qingwind = 100; p.mind.support = [];
  const before = structuredClone(p.mind.learning);
  const option = viewSect(session).discipleDevelopment.members.find(member => member.personId === p.personId).options.find(option => option.techniqueId === 'qingwind');
  assert.equal(option.available, false); assert.match(option.reason, /融会贯通/);
  const result = commandSect(session, { type: 'recommend-disciple-technique', personId: p.personId, techniqueId: 'qingwind' });
  assert.equal(result.refused, true); assert.equal(result.result.status, 'unavailable');
  assert.deepEqual(session.state.personsById[p.personId].mind.learning, before);
  assert.equal(session.state.personsById[p.personId].mind.knowledge.qingwind, 100);
});
