/** SR-XF-008-I01: sourced five-person work offers through the public command gateway. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {spatialSlots} from '../dist/ea-sr-spatial.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

test('SR-XF-008-I01: five voluntary v2 offers share two physical lumber stations and survive exact saves',()=>{
 const source=normalOpening();
 source.build('house');
 for(let n=0;n<3;n++){source.resources({jade:65,herb:8,food:8});source.act('recruit');source.save();}
 source.resources({food:60});
 assert.equal(source.s.homeMemberIds.length,5);
 const lumber=source.s.buildings.find(b=>b.type==='lumber'),stockId=`stockpile:${lumber.instanceId}`;
 for(let n=0;n<3;n++){
  const carried=source.act('startTransport',stockId,'stockpile:yunxiu','person:master',{wood:40});
  source.until(s=>s.workOrdersById[carried.id].phase==='delivered','physical lumber transfer');source.save();
 }
 const sourceBefore=JSON.stringify(source.s),v2=SIM.prepareAutonomyV2(source.s);
 assert.equal(JSON.stringify(source.s),sourceBefore,'migration keeps the original native save');
 assert(source.s.homeMemberIds.every(id=>source.s.personsById[id].schedule.definitionId==='autonomy:yunxiu:v1'),'normal players still begin under v1');
 const h=harness(SIM.validateSave(v2));
 // A separate scoring fixture checks ability mapping without claiming an earned library replenishment.
 const skillFixture=SIM.validateSave(JSON.parse(JSON.stringify(h.s))),library=skillFixture.buildings.find(b=>b.type==='library');
 skillFixture.srEconomy.patches.insight.remaining=skillFixture.srEconomy.patches.insight.max;
 const scholar=skillFixture.personsById['person:yunxiu:68'];
 const libraryCandidate=SIM.workCandidateV2(skillFixture,scholar.personId,library.instanceId);
 assert.equal(libraryCandidate.available,true,'restored library source exposes the specialized candidate');
 assert.equal(libraryCandidate.inputs.ability,scholar.mind.skills.learning,'library ability uses the person’s actual learning skill');
 skillFixture.personsById['person:lin-changfeng'].mind.skills.industry=80;
 assert.equal(SIM.workCandidateV2(skillFixture,'person:lin-changfeng',lumber.instanceId).inputs.ability,80,'ordinary work still credits skill above its 50-point baseline');
 const relationBaseline=Object.fromEntries(h.s.homeMemberIds.map(id=>[id,JSON.stringify(h.s.personsById[id].mind.relationships)]));
 const inviteTick=h.s.worldTick,offers=[];
 for(const personId of h.s.homeMemberIds){
  const candidate=SIM.workCandidateV2(h.s,personId,lumber.instanceId);
  const offer=h.act('inviteWork',personId,lumber.instanceId);offers.push({personId,candidate,offer});h.save();
  assert.equal(offer.accepted,candidate.available&&candidate.willing,'the public result consumes the known candidate');
  assert.equal(offer.score,candidate.score);
  assert.equal(h.s.factsById[offer.sourceFactId]?.kind,'autonomy-work-choice','each new answer has one source fact');
  if(candidate.available&&!candidate.willing)assert.equal(offer.retryAfterTick,inviteTick+150,'first refusal starts the 150-tick backoff');
  const factsBefore=Object.keys(h.s.factsById).length;
  assert.deepEqual(h.act('inviteWork',personId,lumber.instanceId),offer,'same conditions keep one decision and deadline');
  assert.equal(Object.keys(h.s.factsById).length,factsBefore,'repeated clicks do not add a second decision fact');
 }
 assert.equal(h.s.worldTick,inviteTick,'inviting does not advance the world clock');
 console.log(JSON.stringify({inviteTick,offers:offers.map(x=>({personId:x.personId,activity:h.s.personsById[x.personId].mind.activity,available:x.offer.available,accepted:x.offer.accepted,score:x.offer.score,inputs:x.candidate.inputs,reason:x.offer.publicReason}))}));
 assert(offers.filter(x=>x.offer.accepted).length>=2,'two workers accept the real lumber opportunity');
 for(const {personId,candidate,offer} of offers.filter(x=>x.offer.accepted)){
  assert.equal(candidate.inputs.ability,50,'ordinary lumber work starts at the documented no-specialty ability');
  const p=h.s.personsById[personId],promise=Object.values(p.schedule.commitmentsById).find(c=>c.sourceFactId===offer.sourceFactId);
  assert.equal(promise?.endTick,inviteTick+240,'a sourced promise lasts 240 world ticks');
 }
 const slots=spatialSlots(lumber,'work');assert.equal(slots.length,2);
 h.until(s=>s.homeMemberIds.filter(id=>s.activitiesById[s.personsById[id].activityId]?.targetId===lumber.instanceId&&s.activitiesById[s.personsById[id].activityId]?.phase==='executing').length===2,'two willing people reach distinct work slots',300);
 const workers=h.s.homeMemberIds.map(id=>({id,body:h.s.activitiesById[h.s.personsById[id].activityId]})).filter(x=>x.body?.targetId===lumber.instanceId&&x.body.phase==='executing');
 assert.equal(new Set(workers.map(x=>x.body.slotId)).size,2);
 for(const {id,body} of workers)assert.equal(h.s.reservationsById[body.reservationId]?.personId,id);
 h.save();
 const interrupted=harness(SIM.validateSave(h.s));
 interrupted.act('toggleBuilding',lumber.id);interrupted.save();
 for(const {id,body} of workers){
  const p=interrupted.s.personsById[id],promise=Object.values(p.schedule.commitmentsById).find(c=>c.targetId===lumber.instanceId&&c.startTick===inviteTick);
  assert.equal(promise.status,'interrupted','closing the actual workplace interrupts the promise');
  assert.notEqual(interrupted.s.activitiesById[p.activityId]?.phase,'executing','a closed facility cannot keep executing');
  assert.equal(interrupted.s.reservationsById[body.reservationId],undefined,'interrupting work releases its physical station');
 }
 const unwilling=offers.find(x=>x.candidate.available&&!x.candidate.willing);
 assert(unwilling,'the public source also contains a feasible refusal');
 const refusedKey=`work:${lumber.instanceId}`;
 const closedOffer=interrupted.act('inviteWork',unwilling.personId,lumber.instanceId);interrupted.save();
 assert.equal(closedOffer.available,false,'facility closure is a hard blocker');
 assert.equal(interrupted.s.personsById[unwilling.personId].schedule.retriesByTarget[refusedKey].consecutiveFailures,2);
 assert.equal(closedOffer.retryAfterTick,interrupted.s.worldTick+300,'changed conditions advance the backoff');
 interrupted.act('toggleBuilding',lumber.id);interrupted.save();
 const reopenedOffer=interrupted.act('inviteWork',unwilling.personId,lumber.instanceId);interrupted.save();
 assert.equal(reopenedOffer.available,true,'reopened facility is feasible again');
 assert.equal(reopenedOffer.accepted,false,'the same person still decides');
 assert.equal(interrupted.s.personsById[unwilling.personId].schedule.retriesByTarget[refusedKey].consecutiveFailures,3);
 assert.equal(reopenedOffer.retryAfterTick,interrupted.s.worldTick+600,'third refusal reaches the capped backoff');
 assert.deepEqual(interrupted.act('inviteWork',unwilling.personId,lumber.instanceId),reopenedOffer,'a repeated offer cannot extend the cap');
 h.until(s=>workers.every(({id})=>Object.values(s.personsById[id].schedule.commitmentsById).every(c=>c.status!=='active')),'promises reach their original deadlines',300);
 h.save();
 const relationChanges=h.s.homeMemberIds.filter(id=>JSON.stringify(h.s.personsById[id].mind.relationships)!==relationBaseline[id]);
 assert.deepEqual(relationChanges,[],'the bounded v2 window has no unsourced relationship mutation');
 console.log(JSON.stringify({sourceCommands:source.counts.commands,publicCommands:h.counts.commands,exactSaveReads:source.counts.saves+h.counts.saves,offers:offers.map(x=>({personId:x.personId,available:x.offer.available,accepted:x.offer.accepted,score:x.offer.score})),worldTick:h.s.worldTick}));
});
