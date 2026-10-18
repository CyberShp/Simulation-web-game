import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createWorldPerson} from '../../../src/simulation/ea-sim.mjs';
import {COURTYARD_VISITOR_ROAD} from '../../../src/simulation/ea-courtyard-visitors.mjs';
import {scenicHomeActors} from '../../../src/simulation/ea-scene-state.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
const copy=v=>JSON.parse(JSON.stringify(v)),MASTER='person:master',LIN='person:lin-changfeng';
const send=(s,name,...args)=>SIM.dispatchCommand(s,{name,args});
function until(s,f,limit=4000){for(let i=0;i<limit&&!f(s);i++)SIM.tick(s,.1);assert.ok(f(s),`world steps reach condition at ${s.worldTick}`);return s;}
function reload(s){const before=copy(s),result=SIM.validateSave(before);assert.deepEqual(copy(result),before);assert.deepEqual(copy(s),before);return result;}
const selection=id=>({personId:id,rank:'outer',affiliationId:'scene:yunxiu-courtyard',mentorId:null});
function prepare(){
 let s=SIM.validateSave(seed.state);s=send(s,'build','lumber',26,16).state;until(s,v=>v.buildings.some(b=>b.type==='lumber'));
 s=send(s,'moveScenicMaster',27.5,14).state;until(s,v=>SIM.courtyardAdmissionView(v,LIN).distance.near);
 return send(s,'admitCourtyardVisitor',selection(LIN)).state;
}
const ready=prepare();
function open(){return send(SIM.cloneState(ready),'setCourtyardReception',{enabled:true}).state;}
function first(s=open()){
 until(s,v=>Object.keys(v.courtyardSeekers.recordsByPersonId).length>0);return {s,id:Object.keys(s.courtyardSeekers.recordsByPersonId)[0]};
}
function approach(s,id){
 until(s,v=>v.personsById[id].courtyardVisit.phase==='present');
 s=send(s,'moveScenicMaster',29,26.285714285714285).state;until(s,v=>SIM.courtyardSeekerView(v,id).distance.near);return s;
}
function refused(s,name,args,pattern){const before=copy(s);assert.throws(()=>send(s,name,...args),pattern);assert.deepEqual(copy(s),before);}

test('explicit reception preserves old reads, existing persons, resources, random state and clock',()=>{
 const s=SIM.cloneState(ready),before=copy(s);assert.equal(s.courtyardSeekers,undefined);
 for(let i=0;i<3;i++){assert.equal(SIM.courtyardReceptionView(s).canEnable,true);assert.equal(SIM.courtyardSeekerView(s,LIN),null);}assert.deepEqual(copy(s),before);reload(s);
 const opened=send(s,'setCourtyardReception',{enabled:true}).state;
 assert.deepEqual(copy(opened.personsById),before.personsById);assert.deepEqual(opened.resources,before.stockpilesById['stockpile:yunxiu'].resources);
 assert.equal(opened.rngState,before.rngState);assert.equal(opened.worldTick,before.worldTick);assert.equal(Object.keys(opened.courtyardSeekers.recordsByPersonId).length,0);
 const due=opened.courtyardSeekers.nextOpportunityTick;
 const disabled=send(opened,'setCourtyardReception',{enabled:false}).state,reopened=send(disabled,'setCourtyardReception',{enabled:true}).state;
 assert.equal(reopened.courtyardSeekers.nextOpportunityTick,due);reload(reopened);
 const paused=send(reopened,'setSpeed',0).state,raw=copy(paused);SIM.tick(paused,99);assert.deepEqual(copy(paused),raw);reload(paused);
});

test('persistent neutral construction does not join, occupy beds, grant goods or claim joining memories',()=>{
 const s=SIM.cloneState(ready),before=copy(s),p=createWorldPerson(s);
 assert.equal(s.personsById[p.personId],p);assert.deepEqual(s.homeMemberIds,before.homeMemberIds);assert.deepEqual(s.logs,before.logs);
 assert.deepEqual(s.residentialHousing,before.residentialHousing);assert.deepEqual(s.stockpilesById,before.stockpilesById);
 assert.equal(p.mind.memories.some(m=>m.key?.startsWith('joining:')),false);assert.equal(s.society.nextPersonId,p.id+1);
});

test('world-clock creation and every actual southern-road foot survive exact reload before admission',()=>{
 let {s,id}=first();const p=s.personsById[id],identity={personId:p.personId,id:p.id,appearance:copy(p.appearance),talent:p.talent,traits:copy(p.mind.traits)};
 assert.equal(p.courtyardVisit.phase,'arriving');assert.equal(s.homeMemberIds.includes(id),false);assert.equal(s.residentialHousing.recordsByPersonId[id],undefined);
 assert.equal(p.position.x,COURTYARD_VISITOR_ROAD[0].x);assert.equal(p.position.y,COURTYARD_VISITOR_ROAD[0].y);
 refused(s,'admitCourtyardVisitor',[selection(id)],/抵达/);const reference=s;s=reload(s);
 let steps=0;while(s.personsById[id].courtyardVisit.phase!=='present'&&steps<500){SIM.tick(s,.1);SIM.tick(reference,.1);const foot=s.personsById[id].position,art=toArt(foot.x,foot.y);assert.ok(isArtWalkable(art.x,art.y,{domain:true}),JSON.stringify({foot,art}));if(++steps===40)s=reload(s);}
 assert.ok(steps>1&&steps<500);assert.deepEqual(copy(s),copy(reference),'saving during arrival preserves the same complete world evolution');
 const after=s.personsById[id];assert.deepEqual({personId:after.personId,id:after.id,appearance:after.appearance,talent:after.talent,traits:after.mind.traits},identity);
 const r=s.courtyardSeekers.recordsByPersonId[id];assert.ok(r.visits[0].arrivedTick>r.createdAtTick);refused(s,'admitCourtyardVisitor',[selection(id)],/身边/);reload(s);
});

test('an unwilling caller keeps the same response and hidden scoring stays outside projections',()=>{
 let {s,id}=first();s=approach(s,id);const before=copy(s),out=send(s,'admitCourtyardVisitor',selection(id));s=out.state;
 assert.equal(out.result.accepted,false);assert.equal(s.homeMemberIds.includes(id),false);assert.equal(s.residentialHousing.recordsByPersonId[id],undefined);
 assert.deepEqual(s.resources,before.stockpilesById['stockpile:yunxiu'].resources);assert.equal(s.rngState,before.rngState);
 const answers=copy(s.courtyardSeekers.recordsByPersonId[id].visits[0].answers);assert.equal(answers.length,1);
 const repeat=send(reload(s),'admitCourtyardVisitor',selection(id));assert.deepEqual(repeat.result,out.result);assert.deepEqual(repeat.state.courtyardSeekers.recordsByPersonId[id].visits[0].answers,answers);
 const raw=copy(repeat.state),view=SIM.courtyardAdmissionView(repeat.state,id);assert.equal(view.canRequestAdmission,true);assert.equal(view.canAdmit,false);assert.ok(view.conditions.every(c=>c.label));assert.equal(view.lastAnswer.assessment,undefined);assert.equal(view.lastAnswer.signature,undefined);assert.deepEqual(copy(repeat.state),raw);
});

test('defer extends once, refusal leaves along the road, and the next willing person gets one real bed',()=>{
 let {s,id}=first();s=approach(s,id);const v=()=>s.courtyardSeekers.recordsByPersonId[id].visits[0],deadline=v().deadlineTick;
 s=send(s,'answerCourtyardSeeker',{personId:id,answer:'defer'}).state;assert.equal(v().deadlineTick,deadline+SIM.SEEKER_RULES.deferTicks);
 s=send(s,'answerCourtyardSeeker',{personId:id,answer:'defer'}).state;assert.equal(v().answers.length,1);s=reload(s);
 s=send(s,'answerCourtyardSeeker',{personId:id,answer:'decline'}).state;assert.equal(s.personsById[id].courtyardVisit.phase,'departing');assert.equal(v().departedTick,null);
 const start=copy(s.personsById[id].position);until(s,w=>Math.hypot(w.personsById[id].position.x-start.x,w.personsById[id].position.y-start.y)>.05,10);s=reload(s);
 until(s,w=>w.personsById[id].courtyardVisit.phase==='departed');assert.ok(v().departedTick>v().endedAtTick);reload(s);
 until(s,w=>Object.keys(w.courtyardSeekers.recordsByPersonId).length===2);
 const next=Object.keys(s.courtyardSeekers.recordsByPersonId).find(x=>x!==id);s=approach(s,next);
 assert.equal(SIM.courtyardAdmissionView(s,next).canAdmit,true);const before=copy(s),r=send(s,'admitCourtyardVisitor',selection(next));s=r.state;
 assert.equal(r.result.accepted,true);assert.equal(s.homeMemberIds.filter(x=>x===next).length,1);assert.ok(s.residentialHousing.recordsByPersonId[next].pending.slotId);
 assert.equal(s.residentialHousing.recordsByPersonId[next].home,null);assert.equal(s.courtyardAdmissions.recordsByPersonId[next].consentSource,'yunxiu:south-road-seekers');
 assert.deepEqual(s.resources,before.stockpilesById['stockpile:yunxiu'].resources);assert.equal(s.worldTick,before.worldTick);refused(s,'admitCourtyardVisitor',[selection(next)],/名册|收录/);s=reload(s);
 until(s,w=>w.residentialHousing.recordsByPersonId[next].home!==null,5000);assert.equal(s.residentialHousing.recordsByPersonId[next].pending,null);reload(s);
 assert(scenicHomeActors(s).some(p=>p.personId===next),'an admitted person follows the normal resident projection');
 // Explicit departure fixtures retain the actual accepted world above.
 for(const change of [p=>{p.left=true;},p=>{p.mind.away={kind:'visit'};},p=>{p.mind.journey={kind:'journey'};},p=>{p.mind.activity='travel';}]){
  const away=SIM.cloneState(s);change(away.personsById[next]);assert.equal(scenicHomeActors(away).some(p=>p.personId===next),false,'the old arrival marker must not restore an absent resident');
 }
});

test('material and body failures are atomic; the caller keeps identity on a changed-opportunity return',()=>{
 let {s,id}=first();s=approach(s,id);s=send(s,'admitCourtyardVisitor',selection(id)).state;
 // Boundary fixtures below change only the tested condition; they are not normal-play growth evidence.
 const noFood=SIM.cloneState(s);noFood.resources.food=0;refused(noFood,'admitCourtyardVisitor',[selection(id)],/食粮/);
 const busy=SIM.cloneState(s);busy.master.activityId='activity:fixture:busy';busy.activitiesById[busy.master.activityId]={id:busy.master.activityId,kind:'facility',personId:MASTER,action:'study',phase:'executing'};
 assert.equal(SIM.courtyardSeekerView(busy,id).canTalk,false);refused(busy,'answerCourtyardSeeker',[{personId:id,answer:'defer'}],/身体|事务/);
 s=send(s,'answerCourtyardSeeker',{personId:id,answer:'decline'}).state;s=send(s,'setCourtyardReception',{enabled:false}).state;
 until(s,w=>w.personsById[id].courtyardVisit.phase==='departed');const original=copy(s.personsById[id]),oldAnswers=copy(s.courtyardSeekers.recordsByPersonId[id].visits[0].answers);
 s.master.artsById.qingyuan.understanding=70;s.master.artsById.qingyuan.mastery=60;s.master.energy=100;s.master.wound=0;
 until(s,w=>w.worldTick>=w.courtyardSeekers.recordsByPersonId[id].visits[0].departedTick+SIM.SEEKER_RULES.returnTicks);
 s=send(s,'setCourtyardReception',{enabled:true}).state;until(s,w=>w.courtyardSeekers.recordsByPersonId[id].visits.length===2);
 assert.equal(Object.keys(s.courtyardSeekers.recordsByPersonId).length,1);assert.equal(s.personsById[id].id,original.id);assert.deepEqual(s.personsById[id].appearance,original.appearance);
 assert.deepEqual(s.courtyardSeekers.recordsByPersonId[id].visits[0].answers,oldAnswers);s=reload(s);s=approach(s,id);
 assert.equal(send(s,'admitCourtyardVisitor',selection(id)).result.accepted,true);
});

test('missing source markers, changed answers, unknown versions and orphan membership reject the original bytes',()=>{
 let {s,id}=first();s=approach(s,id);s=send(s,'admitCourtyardVisitor',selection(id)).state;reload(s);
 for(const mutate of [
  v=>{delete v.courtyardSeekers;},v=>{delete v.personsById[id].courtyardSeekerSource;},
  v=>{v.courtyardSeekers.version='unknown';},v=>{delete v.personsById[id];},
  v=>{v.factsById[v.courtyardSeekers.recordsByPersonId[id].visits[0].answers[0].factId].reason='changed';},
  v=>{v.courtyardSeekers.recordsByPersonId[id].visits[0].answers[0].assessment.score=99;},
  v=>{v.courtyardSeekers.recordsByPersonId[id].visits[0].deadlineTick++;},
  v=>{v.homeMemberIds.push(id);},
  v=>{const a=v.courtyardSeekers.recordsByPersonId[id].visits[0].answers[0];a.assessment.components.extra=0;v.factsById[a.factId].assessment.components.extra=0;},
  v=>{const a=v.courtyardSeekers.recordsByPersonId[id].visits[0].answers[0];a.signature='{}';v.factsById[a.factId].signature='{}';},
  v=>{v.personsById[id].courtyardVisit.phase='departed';},
 ]){const bad=copy(s);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>SIM.validateSave(bad));assert.equal(JSON.stringify(bad),text);}
});
