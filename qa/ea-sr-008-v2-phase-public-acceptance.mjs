/** SR-XF-008-I01: v2 day preference follows the world clock during voluntary work. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {spatialSlots} from '../dist/ea-sr-spatial.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const phaseAt=s=>{
 const fraction=(s.worldTick%s.ticksPerDay)/s.ticksPerDay;
 return fraction<.2||fraction>=.8?'rest':fraction<.55?'work':'study';
};
const phaseView=(s,personId)=>{
 const before=JSON.stringify(s);
 const phase=SIM.viewPersons(s).find(p=>p.personId===personId)?.schedule?.phase;
 assert.equal(JSON.stringify(s),before,'reading a person must not advance or change the world');
 return phase;
};

test('SR-XF-008-I01: five people and two real work slots retain voluntary work across a day-phase change',()=>{
 const source=normalOpening();
 source.build('house');
 for(let n=0;n<3;n++){source.resources({jade:65,herb:8,food:8});source.act('recruit');source.save();}
 source.resources({food:80});
 assert.equal(source.s.homeMemberIds.length,5);
 const lumber=source.s.buildings.find(b=>b.type==='lumber'),stockId=`stockpile:${lumber.instanceId}`;
 assert.equal(spatialSlots(lumber,'work').length,2);
 for(let n=0;n<3;n++){
  const carried=source.act('startTransport',stockId,'stockpile:yunxiu','person:master',{wood:40});
  source.until(s=>s.workOrdersById[carried.id].phase==='delivered','real lumber stockpile delivery');
  source.save();
 }
 const day=source.s.ticksPerDay;
 assert.equal(phaseAt(source.s),'rest');
 const v2=SIM.prepareAutonomyV2(source.s),h=harness(SIM.validateSave(v2));
 assert.equal(phaseView(h.s,'person:lin-changfeng'),'rest');
 h.until(s=>{
  const dayTick=s.worldTick%day;
  return dayTick>=80&&dayTick<=100&&s.homeMemberIds.filter(id=>{const c=SIM.workCandidateV2(s,id,lumber.instanceId);return c.available&&c.willing;}).length>=2;
 },'two people become willing before the next production phase',day+100);
 const boundary=Math.floor(h.s.worldTick/day)*day+Math.ceil(day*.2);
 assert(boundary-h.s.worldTick<240,'the willing members can cross the next phase within their original terms');
 const inviteTick=h.s.worldTick,accepted=[],offers=[];
 for(const personId of h.s.homeMemberIds){
  const offer=h.act('inviteWork',personId,lumber.instanceId);
  offers.push({personId,...offer});
  if(offer.accepted)accepted.push(personId);
  h.save();
 }
 assert(accepted.length>=2,'two people voluntarily accept from a normal five-person source: '+JSON.stringify(offers));
 const workers=accepted.slice(0,2);
 const commitments=workers.map(id=>Object.values(h.s.personsById[id].schedule.commitmentsById).find(c=>c.targetId===lumber.instanceId&&c.status==='active'));
 assert(commitments.every(c=>c?.endTick===inviteTick+240));
 h.until(s=>s.worldTick>=boundary,'cross into the production-preference phase',240);
 assert.equal(phaseAt(h.s),'work');
 assert(h.s.worldTick<inviteTick+240,'the accepted terms are still active at the phase boundary');
 const slots=workers.map(id=>h.s.activitiesById[h.s.personsById[id].activityId]?.slotId);
 assert.equal(new Set(slots).size,2,'the two voluntary workers use different physical stations');
 for(let n=0;n<workers.length;n++){
  const id=workers[n],p=h.s.personsById[id],body=h.s.activitiesById[p.activityId],promise=p.schedule.commitmentsById[commitments[n].id];
  assert.equal(p.schedule.phase,'work','the stored day preference follows the single world clock');
  assert.equal(phaseView(h.s,id),'work','the read-only person card shows the current preference');
  assert.equal(promise.status,'active','a preference change does not cancel an accepted commitment');
  assert.equal(promise.endTick,inviteTick+240,'a preference change does not extend the deadline');
  assert.equal(p.job,lumber.id,'a preference change does not reassign the person');
  assert.equal(body?.phase,'executing','the physical work continues at the same station');
  assert.equal(body.slotId,slots[n]);
 }
 h.save();
 const reopened=SIM.validateSave(JSON.parse(JSON.stringify(h.s)));
 for(const id of workers)assert.equal(phaseView(reopened,id),'work');
 h.act('toggleBuilding',lumber.id);
 h.save();
 for(let n=0;n<workers.length;n++){
  const id=workers[n],p=h.s.personsById[id];
  assert.equal(p.schedule.commitmentsById[commitments[n].id].status,'interrupted','closing the real workplace interrupts its term');
  assert.notEqual(h.s.activitiesById[p.activityId]?.phase,'executing','a closed workplace cannot keep a body producing');
  assert.equal(phaseView(h.s,id),'work','the public day preference still follows the world clock after interruption');
 }
 console.log(JSON.stringify({sourceCommands:source.counts.commands,publicCommands:h.counts.commands,exactSaveReads:source.counts.saves+h.counts.saves,people:h.s.homeMemberIds.length,workSlots:slots,inviteTick,boundaryTick:boundary,phase:'work'}));
});
