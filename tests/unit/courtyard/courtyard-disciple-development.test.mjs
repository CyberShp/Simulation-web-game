import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {setDiscipleWorkFocus,recommendDiscipleTechnique,discipleDevelopmentView,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
function fixture(){const session=createSectSession(),s=session.state,p=s.personsById[s.homeMemberIds[0]];s.master.scenic.x=p.mind.scenic.x;s.master.scenic.y=p.mind.scenic.y;return {session,s,p};}
test('development is a read-only projection and older saves need no new writable state',()=>{
 const {s,p}=fixture();delete p.mind.developmentRecommendation;const before=JSON.stringify(s);const a=discipleDevelopmentView(s);assert.equal(a.members[0].recommendation,null);assert.equal(JSON.stringify(s),before);assert.deepEqual(discipleDevelopmentView(s),a);
});
test('public focus changes no current promise, identity, goal or progress',()=>{
 const {s,p}=fixture(),before={job:p.job,goal:p.mind.goal,learning:structuredClone(p.mind.learning),schedule:structuredClone(p.schedule),tick:s.worldTick};
 assert.equal(setDiscipleWorkFocus(s,'herb').accepted,true);assert.equal(s.doctrine.workFocus,'herb');assert.deepEqual({job:p.job,goal:p.mind.goal,learning:p.mind.learning,schedule:p.schedule,tick:s.worldTick},before);assert.throws(()=>setDiscipleWorkFocus(s,'unknown'));
});
test('accepted recommendation persists and never instantly installs knowledge or abandons learning',()=>{
 const {session,s,p}=fixture(),before=structuredClone({learning:p.mind.learning,knowledge:p.mind.knowledge,job:p.job,commit:p.mind.commitUntil});
 const result=recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'});assert.equal(result.accepted,true);assert.deepEqual({learning:p.mind.learning,knowledge:p.mind.knowledge,job:p.job,commit:p.mind.commitUntil},before);
 assert.deepEqual(recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'}),result);
 const loaded=restoreSect(snapshotSect(session));assert.deepEqual(loaded.state.personsById[p.personId].mind.developmentRecommendation,result);
});
test('refusal and unavailable contact are recorded with deterministic repeated answers',()=>{
 const {s,p}=fixture();p.mind.relationships.master.trust=0;const args={personId:p.personId,techniqueId:'qingyuan'},rng=s.rngState;
 const r=recommendDiscipleTechnique(s,args);assert.equal(r.status,'refused');assert.equal(r.accepted,false);assert.deepEqual(recommendDiscipleTechnique(s,args),r);assert.equal(s.rngState,rng);
 s.master.position.sceneId='scene:valley';assert.equal(recommendDiscipleTechnique(s,args).status,'unavailable');
});
test('hidden and sealed techniques cannot be recommended or leaked by projection',()=>{
 const {s,p}=fixture();p.mind.hiddenKnowledge.qingwind='secret:test';s.society.secrets.push({id:'secret:test',discovered:false});p.mind.knowledge.qingwind=50;
 assert.throws(()=>recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingwind'}));const view=discipleDevelopmentView(s).members[0];assert(!view.knowledge.some(k=>k.techniqueId==='qingwind'));assert(!view.options.some(k=>k.techniqueId==='qingwind'));
});
test('remote projection withholds current activity, mastery and abilities',()=>{
 const {s,p}=fixture();p.mind.skills.learning=45;p.mind.knowledge.qingyuan=30;s.master.position.sceneId='scene:valley';
 const member=discipleDevelopmentView(s).members[0];assert.equal(member.learning,null);assert.equal(member.activity,null);assert.deepEqual(member.knowledge,[]);assert.deepEqual(member.skills,[]);assert.deepEqual(member.options,[]);
});
test('load rejects future recommendation timestamps and unknown technique ids',()=>{
 for(const corrupt of [r=>{r.atTick+=100000;},r=>{r.techniqueId='unknown';},r=>{r.status='completed';},r=>{r.accepted='yes';}]){
  const {session,s,p}=fixture();recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'});const saved=snapshotSect(session);corrupt(saved.state.personsById[p.personId].mind.developmentRecommendation);assert.throws(()=>restoreSect(saved));
 }
});

test('a remote completed recommendation exposes only the previously offered topic and timestamp',()=>{
 const {s,p}=fixture();recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'});const r=p.mind.developmentRecommendation;r.status='completed';r.completedAtTick=s.worldTick;r.publicReason='实际完成';s.master.position.sceneId='scene:valley';
 const reported=discipleDevelopmentView(s).members[0].recommendation;
 assert.deepEqual(Object.keys(reported).sort(),['atTick','name','publicReason','techniqueId']);assert(!('status' in reported));assert(!('completedAtTick' in reported));assert(!('accepted' in reported));
});

test('a formally accepted suggestion is autonomously studied at an actual station before understanding grows',()=>{
 let {s,p}=fixture();const personId=p.personId,knowledgeBefore=p.mind.knowledge.qingyuan||0;
 const committed=dispatchCommand(s,{name:'recommendDiscipleTechnique',args:[{personId,techniqueId:'qingyuan'}]});s=committed.state;assert.equal(committed.result.accepted,true);
 let selected=false,executed=false;
 for(let i=0;i<1500&&(s.personsById[personId].mind.knowledge.qingyuan||0)===knowledgeBefore;i++){
  tick(s,.1);p=s.personsById[personId];if(p.mind.learning?.id==='qingyuan')selected=true;
  const a=s.activitiesById[p.activityId];if(a?.action==='study'&&a.phase==='executing'){assert(a.slotId);assert.equal(s.reservationsById[a.reservationId]?.personId,personId);executed=true;}
 }
 assert(selected);assert(executed);assert((p.mind.knowledge.qingyuan||0)>knowledgeBefore);assert.equal(p.mind.developmentRecommendation.status,'completed');
});
test('an existing lesson finishes before the recommended new technique enters autonomous study',()=>{
 let {s,p}=fixture();const personId=p.personId;
 // Explicit isolated fixture: one legal completed library and one already
 // accepted lesson. No understanding, production or study progress is awarded.
 s.buildings.push({id:80,instanceId:'building:yunxiu:80',type:'library',level:1,progress:0,condition:100,enabled:true,x:44,y:40,prefabId:'prefab:library:units:v1',sceneId:'scene:yunxiu-courtyard',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:40,orientation:'south'}});s.spatial.geometryRevision++;s.nextId=81;
 p.mind.learning={id:'qingyuan',progress:0,total:55,mode:'learn'};const original=structuredClone(p.mind.learning);
 const committed=dispatchCommand(s,{name:'recommendDiscipleTechnique',args:[{personId,techniqueId:'qingwind'}]});s=committed.state;p=s.personsById[personId];assert.equal(committed.result.accepted,true);assert.deepEqual(p.mind.learning,original);assert.equal(p.mind.knowledge.qingwind,undefined);
 let finishedOld=false,selectedNew=false,executedNew=false;
 for(let i=0;i<3500&&!(p.mind.knowledge.qingwind>0);i++){
  tick(s,.1);p=s.personsById[personId];finishedOld ||= p.mind.knowledge.qingyuan>0;
  if(!finishedOld){assert.equal(p.mind.learning?.id,'qingyuan');assert.equal(p.mind.knowledge.qingwind,undefined);}
  if(p.mind.learning?.id==='qingwind'){assert(finishedOld);selectedNew=true;const a=s.activitiesById[p.activityId];if(a?.action==='study'&&a.phase==='executing'){assert.equal(a.targetId,'building:yunxiu:80');assert(a.slotId);assert.equal(s.reservationsById[a.reservationId]?.personId,personId);executedNew=true;}}
 }
 assert(finishedOld);assert(selectedNew);assert(executedNew);assert(p.mind.knowledge.qingwind>0);assert.equal(p.mind.developmentRecommendation.status,'completed');
});
