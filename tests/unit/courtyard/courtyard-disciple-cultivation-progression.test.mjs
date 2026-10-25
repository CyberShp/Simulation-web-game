import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {studyLock} from '../../../src/simulation/ea-sim.mjs';
import {tick,discipleDevelopmentView} from '../../../src/simulation/ea-opening-sim.mjs';

function fixture(){
 const session=createSectSession(),s=session.state,p=s.disciples[0];
 // Isolated progression fixture: legal library, already understood basic arts,
 // and an accepted final lesson. No simulated growth is pre-awarded by a command.
 s.buildings.push({id:80,instanceId:'building:yunxiu:80',type:'library',level:1,progress:0,condition:100,enabled:true,x:44,y:40,prefabId:'prefab:library:units:v1',sceneId:'scene:yunxiu-courtyard',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:40,orientation:'south'}});s.spatial.geometryRevision++;s.nextId=81;
 p.mind.main='qingyuan';p.mind.support=['spring'];
 s.doctrine.books=['qingyuan','qingwind','qingguard','spring','earthguard','swordbasic','metalguard'];
 for(const id of s.doctrine.books)p.mind.knowledge[id]=100;
 return {session,s,p};
}

test('fully understood independent spells and martial arts stop offering new study while unfinished arts remain available',()=>{
 const {s,p}=fixture();
 for(const id of ['qingwind','qingguard','earthguard','swordbasic','metalguard']){
  p.mind.knowledge[id]=99;assert.equal(studyLock(s,p,id,false),'');
  p.mind.knowledge[id]=100;assert.equal(studyLock(s,p,id,false),'已融会贯通');
 }
});

test('understood inactive main arts can still be converted to and stopped support arts can be restarted',()=>{
 const {s,p}=fixture();s.doctrine.books.push('goldmain');p.mind.knowledge.goldmain=100;
 assert.equal(studyLock(s,p,'goldmain',false),'');
 p.mind.support=[];assert.equal(studyLock(s,p,'spring',false),'');
});

test('main and support completion gates retain their previous behavior',()=>{
 const {s,p}=fixture();
 for(const id of ['qingyuan','spring']){
  p.mind.knowledge[id]=99;assert.equal(studyLock(s,p,id,false),'');
  p.mind.knowledge[id]=100;assert.equal(studyLock(s,p,id,false),'已融会贯通');
 }
});

test('the public master study gate applies the same completed independent-art rule',()=>{
 const {s}=fixture();
 for(const id of ['qingwind','qingguard','earthguard','swordbasic','metalguard']){
  s.master.knowledge[id]=99;assert.equal(studyLock(s,s.master,id,true),'');
  s.master.knowledge[id]=100;assert.equal(studyLock(s,s.master,id,true),'已融会贯通');
 }
});

test('loading and reading preserve an existing complete-spell lesson and its exact progress',()=>{
 const {session,p}=fixture();p.mind.learning={id:'qingguard',progress:27,total:80,mode:'deepen'};
 const saved=snapshotSect(session),loaded=restoreSect(saved),before=structuredClone(loaded.state),lesson=structuredClone(loaded.state.disciples[0].mind.learning);
 discipleDevelopmentView(loaded.state);studyLock(loaded.state,loaded.state.disciples[0],'qingguard',false);
 assert.deepEqual(loaded.state,before);assert.deepEqual(loaded.state.disciples[0].mind.learning,lesson);
 assert.deepEqual(loaded.state.personsById[p.personId].mind.learning,saved.state.personsById[p.personId].mind.learning);
});

test('an accepted final spell lesson completes normally before autonomous cultivation yields experience',()=>{
 const {s,p}=fixture();p.mind.traits=[45,88,36,57,80];
 p.mind.learning={id:'qingguard',progress:27,total:80,mode:'deepen'};
 const initialXp=p.xp,initialGoal=p.mind.goal,personId=p.personId;
 let lessonEnded=false,studyExecuted=false,cultivationExecuted=false,previousProgress=27;
 for(let i=0;i<3500&&p.xp===initialXp;i++){
  tick(s,.1);const activity=s.activitiesById[p.activityId];
  if(!lessonEnded&&p.mind.learning){
   assert.equal(p.mind.learning.id,'qingguard');assert(p.mind.learning.progress>=previousProgress);
   previousProgress=p.mind.learning.progress;
   if(activity?.action==='study'&&activity.phase==='executing')studyExecuted=true;
  }else if(!p.mind.learning)lessonEnded=true;
  if(p.mind.activity==='cultivate')assert(lessonEnded);
  if(activity?.action==='cultivate'&&activity.phase==='executing'){
   assert(lessonEnded);assert(activity.slotId);assert.equal(s.reservationsById[activity.reservationId]?.personId,personId);cultivationExecuted=true;
  }
 }
 assert(studyExecuted);assert(lessonEnded);assert(cultivationExecuted);assert(p.xp>initialXp);
 assert.equal(p.mind.goal,initialGoal);assert.equal(p.mind.knowledge.qingguard,100);
 assert.equal(p.mind.learning,null);
});
