import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
const copy=v=>structuredClone(v),LIN='person:lin-changfeng';
function prepared(){
 let s=SIM.validateSave(seed.state);
 const command=(name,...args)=>{s=SIM.dispatchCommand(s,{name,args}).state;};
 const until=f=>{for(let i=0;i<4000&&!f(s);i++)SIM.tick(s,.1);assert(f(s));};
 command('build','lumber',26,16);until(s=>s.buildings.some(b=>b.type==='lumber'));
 command('moveScenicMaster',27.5,14);until(s=>SIM.courtyardAdmissionView(s,LIN).distance.near);
 command('admitCourtyardVisitor',{personId:LIN,rank:'outer',affiliationId:'scene:yunxiu-courtyard',mentorId:null});
 return createSectSession({source:{...seed,state:s}});
}
const ready=prepared();
function runUntil(run,check){
 for(let i=0;i<4000&&!check(run.state);i++){
  if(i%200===0)assert(commandSect(run,{type:'manual'}).ok);
  advanceSect(run,.1);
 }
 assert(check(run.state));
}
test('reception projection stays read-only and the public controller opens the saved schedule',()=>{
 const run=restoreSect(snapshotSect(ready)),before=copy(snapshotSect(run));
 assert(viewSect(run).reception.canEnable);assert.deepEqual(snapshotSect(run),before);
 assert(commandSect(run,{type:'set-reception',enabled:true}).ok);
 assert.deepEqual(run.state.personsById,before.state.personsById);
 assert.equal(run.state.rngState,before.state.rngState);assert.equal(run.state.worldTick,before.state.worldTick);
 assert.equal(viewSect(run).reception.enabled,true);
 assert(commandSect(run,{type:'pause',paused:true}).ok);const paused=snapshotSect(run);advanceSect(run,120);
 assert.deepEqual(snapshotSect(run),paused);assert.deepEqual(snapshotSect(restoreSect(paused)),paused);
});
test('a refusal through the person-window command commits once and survives the next view and reload',()=>{
 const run=restoreSect(snapshotSect(ready));assert(commandSect(run,{type:'set-reception',enabled:true}).ok);
 runUntil(run,s=>Object.keys(s.courtyardSeekers.recordsByPersonId).length>0);
 const id=Object.keys(run.state.courtyardSeekers.recordsByPersonId)[0];
 assert(viewSect(run).people.some(p=>p.id===id),'the arriving person is visible on the southern road');
 runUntil(run,s=>s.personsById[id].courtyardVisit.phase==='present');
 assert(commandSect(run,{type:'move',x:29,y:26.285714285714285}).ok);
 runUntil(run,s=>SIM.courtyardSeekerView(s,id).distance.near);
 const before=copy(run.state),request={type:'admit-visitor',personId:id,rank:'outer',affiliationId:'scene:yunxiu-courtyard',mentorId:null};
 const answer=commandSect(run,request);assert.equal(answer.refused,true);assert.equal(answer.result.accepted,false);
 const answers=copy(run.state.courtyardSeekers.recordsByPersonId[id].visits[0].answers);assert.equal(answers.length,1);
 assert.deepEqual(run.state.homeMemberIds,before.homeMemberIds);assert.deepEqual(run.state.stockpilesById,before.stockpilesById);
 const saved=snapshotSect(run),restored=restoreSect(saved);assert.deepEqual(snapshotSect(restored),saved);
 const admission=viewSect(restored).people.find(p=>p.id===id).admission;
 assert.equal(admission.canRequestAdmission,true);assert.equal(admission.canAdmit,false);assert.equal(admission.lastAnswer.reason,answer.error);
 assert.deepEqual(snapshotSect(restored),saved);assert.equal(commandSect(restored,request).refused,true);
 assert.deepEqual(restored.state.courtyardSeekers.recordsByPersonId[id].visits[0].answers,answers);
 assert(commandSect(restored,{type:'answer-seeker',personId:id,answer:'defer'}).ok);
 assert.equal(SIM.courtyardSeekerView(restored.state,id).deferred,true);
 assert(commandSect(restored,{type:'answer-seeker',personId:id,answer:'decline'}).ok);
 assert.equal(restored.state.personsById[id].courtyardVisit.phase,'departing');
 assert(viewSect(restored).people.some(p=>p.id===id),'departure remains visible');
 runUntil(restored,s=>s.personsById[id].courtyardVisit.phase==='departed');
 assert.equal(viewSect(restored).people.some(p=>p.id===id),false);
 assert.equal(restored.state.personsById[id].personId,id,'departure retains the persistent identity');
 const departed=snapshotSect(restored);assert.deepEqual(snapshotSect(restoreSect(departed)),departed);
});
