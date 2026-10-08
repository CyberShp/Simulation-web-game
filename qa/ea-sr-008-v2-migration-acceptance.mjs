/** SR-XF-008-I01: isolated v1 schedule migration preserves the playable world and source receipts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const legacyFields=s=>({
  worldTick:s.worldTick,time:s.time,resources:s.resources,stockpilesById:s.stockpilesById,
  activitiesById:s.activitiesById,reservationsById:s.reservationsById,workOrdersById:s.workOrdersById,
  sim:s.sim,rngState:s.rngState,people:s.homeMemberIds.map(id=>{const p=s.personsById[id];return {id,job:p.job,activityId:p.activityId,mind:p.mind,commitUntilTick:p.schedule.commitUntilTick,invitations:p.schedule.invitations};})
});

test('SR-XF-008-I01: an accepted v1 invitation migrates on a copy with its remaining commitment and fact source',()=>{
  const h=normalOpening(),personId='person:lu-zhiwei',lumber=h.s.buildings.find(b=>b.type==='lumber');
  const receipt=h.act('inviteWork',personId,lumber.instanceId);
  assert.equal(receipt.accepted,true);
  h.save();
  const before=JSON.stringify(h.s),protectedState=structuredClone(legacyFields(h.s)),originalEnd=h.s.personsById[personId].schedule.commitUntilTick;
  const migrated=SIM.prepareAutonomyV2(h.s);
  assert.equal(JSON.stringify(h.s),before,'isolated preparation does not mutate the existing save');
  assert.deepEqual(legacyFields(migrated),protectedState,'time, balances, actual bodies, relation memories and v1 receipts remain unchanged');
  const p=migrated.personsById[personId],ids=Object.keys(p.schedule.commitmentsById);
  assert.equal(p.schedule.definitionId,SIM.AUTONOMY_V2.version);
  assert.equal(ids.length,1);
  const c=p.schedule.commitmentsById[ids[0]];
  assert.equal(c.endTick,originalEnd,'migration preserves the original deadline instead of granting a fresh term');
  assert.equal(c.startTick,receipt.atTick);
  assert.equal(c.targetId,lumber.instanceId);
  assert.equal(migrated.factsById[c.sourceFactId].originalAtTick,receipt.atTick);
  assert.equal(p.lifePlan.goalId,migrated.factsById[p.lifePlan.sourceFactId].id);
  assert.deepEqual(p.schedule.retriesByTarget,{},'an old retry hint is not treated as an executed escalation');
  assert.equal(migrated.personsById['person:master'].schedule.definitionId,SIM.AUTONOMY.version);
  assert.equal(migrated.personsById['person:merchant-qingxi'].schedule.definitionId,SIM.AUTONOMY.version);
  const candidateBefore=JSON.stringify(migrated),candidate=SIM.workCandidateV2(migrated,personId,lumber.instanceId);
  assert.equal(candidate.available,true);
  assert.equal(candidate.inputs.responsibility,80,'the preserved accepted promise is a real responsibility input');
  assert.deepEqual(SIM.workCandidateV2(migrated,personId,lumber.instanceId),candidate,'same person-known state gives the same ordered candidate without a roll');
  assert.equal(JSON.stringify(migrated),candidateBefore,'candidate inspection does not advance time or alter the save');
  assert.equal(JSON.stringify(SIM.validateSave(migrated)),JSON.stringify(migrated),'the migrated native save round-trips without further mutation');
  assert.equal(JSON.stringify(SIM.prepareAutonomyV2(migrated)),JSON.stringify(migrated),'repeat preparation is idempotent');

  const invalid=structuredClone(h.s);invalid.speed=3;const invalidBefore=JSON.stringify(invalid);
  assert.throws(()=>SIM.validateSave(invalid),/时间、速度或资源异常/,'the original v1 save is invalid');
  assert.throws(()=>SIM.prepareAutonomyV2(invalid),/时间、速度或资源异常/,'migration must reject the same invalid original save');
  assert.equal(JSON.stringify(invalid),invalidBefore,'a rejected source save remains intact');

  const lowTrust=structuredClone(migrated),lowTrustMind=lowTrust.personsById[personId].mind;
  lowTrustMind.relationships.master.trust=10;lowTrustMind.traits[3]=50;
  const reluctant=SIM.workCandidateV2(lowTrust,personId,lumber.instanceId);
  assert.equal(reluctant.available,true,'a real work opportunity remains physically available');
  assert.equal(reluctant.willing,false,'low trust is a personal refusal');
  assert.match(reluctant.reason,/缺乏信任/);
  const divided=structuredClone(migrated);divided.personsById[personId].mind.refusalUntil=divided.society.clock+100;
  const notYet=SIM.workCandidateV2(divided,personId,lumber.instanceId);
  assert.equal(notYet.available,true);
  assert.equal(notYet.willing,false);
  assert.match(notYet.reason,/分歧/);

  const expiry=harness(SIM.validateSave(migrated));
  expiry.until(s=>s.worldTick>=originalEnd,'original invitation deadline',Math.max(1,originalEnd-migrated.worldTick+2));
  const expired=expiry.s.personsById[personId];
  assert.equal(expired.schedule.commitmentsById[c.id].status,'completed','the original deadline settles on normal world ticks');
  assert.equal(expired.lifePlan.currentStepId,null);
  expiry.save();
  const stopped=harness(SIM.validateSave(migrated));
  stopped.act('toggleBuilding',lumber.id);
  const stoppedPerson=stopped.s.personsById[personId];
  assert.equal(stoppedPerson.schedule.commitmentsById[c.id].status,'interrupted','public facility shutdown settles the promise before command save');
  assert.equal(stoppedPerson.lifePlan.currentStepId,null);
  stopped.save();
  const travellingPromise=harness(SIM.validateSave(migrated));
  travellingPromise.act('srWorldCommand',{action:'travel',destination:'scene:valley',companions:[personId]});
  assert.equal(travellingPromise.s.personsById[personId].schedule.commitmentsById[c.id].status,'interrupted','a public departure ends the courtyard promise');
  travellingPromise.save();

  const broken=structuredClone(migrated);
  broken.personsById[personId].schedule.commitmentsById[c.id].sourceFactId='fact:missing';
  assert.throws(()=>SIM.validateSave(broken),/人物承诺来源或当前活动异常/);
  const unknown=structuredClone(h.s);
  unknown.personsById[personId].schedule.definitionId='autonomy:yunxiu:unknown';
  assert.throws(()=>SIM.prepareAutonomyV2(unknown),/自主日程异常/);

  h.act('toggleBuilding',lumber.id);
  const refused=h.act('inviteWork',personId,lumber.instanceId);
  assert.equal(refused.accepted,false);
  const interrupted=SIM.prepareAutonomyV2(h.s).personsById[personId];
  assert.deepEqual(interrupted.schedule.commitmentsById,{},'the inactive prior offer is not a current obligation');
  assert.deepEqual(interrupted.schedule.retriesByTarget,{},'the v1 refusal starts no v2 stepped retry history');
  assert.equal(interrupted.schedule.invitations[`work:${lumber.instanceId}`].atTick,refused.atTick);
  const blocked=SIM.workCandidateV2(SIM.prepareAutonomyV2(h.s),personId,lumber.instanceId);
  assert.equal(blocked.available,false);
  assert.equal(blocked.score,null,'facility failure is a hard block, not a low willingness score');
  h.act('srWorldCommand',{action:'travel',destination:'scene:valley',companions:[personId]});
  assert.equal(h.s.personsById[personId].position.kind,'worldTravel');
  const travelling=SIM.workCandidateV2(SIM.prepareAutonomyV2(h.s),personId,lumber.instanceId);
  assert.equal(travelling.available,false);
  assert.match(travelling.reason,/返回山院/);
  h.save();
  console.log(JSON.stringify({publicCommands:h.counts.commands,exactSaveReads:h.counts.saves,peopleMigrated:h.s.homeMemberIds.length,commitUntilTick:originalEnd}));
});
