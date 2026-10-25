import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,advanceSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {studyLock} from '../../../src/simulation/ea-sim.mjs';
import {tick,discipleDevelopmentView} from '../../../src/simulation/ea-opening-sim.mjs';
import {xpNeed} from '../../../src/simulation/ea-data.mjs';
import {beginPersonBreakthrough} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';

// Isolated rule fixtures. Normal-save desktop acceptance is recorded separately.
function fixture(){
 const run=createSectSession(),s=run.state,p=s.disciples[0];
 s.buildings.push({id:80,instanceId:'building:yunxiu:80',type:'library',level:1,progress:0,condition:100,enabled:true,x:44,y:40,prefabId:'prefab:library:units:v1',sceneId:'scene:yunxiu-courtyard',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:40,orientation:'south'}});
 s.spatial.geometryRevision++;s.nextId=81;
 p.mind.main='qingyuan';p.mind.support=['spring'];p.mind.traits=[45,88,36,57,80];
 s.doctrine.books=['qingyuan','spring','qingwind','qingguard','ember','wood'];
 for(const id of s.doctrine.books)p.mind.knowledge[id]=100;
 return {run,s,p};
}

test('full understanding retains a main conversion and an inactive support opportunity',()=>{
 const {s,p}=fixture();
 assert.equal(studyLock(s,p,'ember',false),'');
 p.mind.support=[];
 assert.equal(studyLock(s,p,'wood',false),'');
 assert.equal(p.mind.main,'qingyuan');assert.deepEqual(p.mind.support,[]);
 assert.equal(p.mind.knowledge.ember,100);assert.equal(p.mind.knowledge.wood,100);
});

test('independent spell study follows understanding rather than practical mastery',()=>{
 const {s,p}=fixture();
 p.artsById.qingguard={artId:'qingguard',understanding:100,mastery:0};
 assert.equal(studyLock(s,p,'qingguard',false),'已融会贯通');
 p.mind.knowledge.qingguard=99;p.artsById.qingguard.understanding=99;p.artsById.qingguard.mastery=100;
 assert.equal(studyLock(s,p,'qingguard',false),'');
 assert.equal(p.artsById.qingguard.mastery,100);
});

test('unavailable study and cultivation workstations preserve a committed lesson without awarding growth',()=>{
 const {s,p}=fixture();
 p.mind.learning={id:'qingguard',progress:27,total:80,mode:'deepen'};
 for(const b of s.buildings)b.enabled=false;
 s.spatial.geometryRevision++;
 const xp=p.xp,lesson=structuredClone(p.mind.learning),personId=p.personId;
 for(let i=0;i<300;i++)tick(s,.1);
 assert.equal(p.xp,xp);assert.deepEqual(p.mind.learning,lesson);
 assert.equal(p.personId,personId);assert.equal(s.personsById[personId],p);
 assert(!Object.values(s.activitiesById).some(a=>a.personId===personId&&['study','cultivate'].includes(a.action)&&a.phase==='executing'));
});

test('actual final study adds understanding without combat mastery and round-trips the bodily activity',()=>{
 const {run}=fixture();let s=run.state,p=s.disciples[0];s.doctrine.books=['qingyuan','spring','qingwind','qingguard'];
 p.mind.knowledge.qingguard=80;
 p.artsById.qingguard={artId:'qingguard',access:true,understanding:80,mastery:0,source:'actual-study',chapter:'qi'};
 p.mind.learning={id:'qingguard',progress:27,total:80,mode:'deepen'};
 const identity=p.personId,goal=p.mind.goal;
 let savedExecuting=false,finished=false;
 for(let i=0;i<3500;i++){
  advanceSect(run,.1);
  s=run.state;p=s.personsById[identity];
  const a=s.activitiesById[p.activityId];
  if(!savedExecuting&&a?.action==='study'&&a.phase==='executing'){
   assert.equal(s.reservationsById[a.reservationId]?.personId,identity);
   const saved=snapshotSect(run),loaded=restoreSect(saved);
   assert.deepEqual(snapshotSect(loaded),saved);
   loaded.state.speed=0;const paused=snapshotSect(loaded);
   advanceSect(loaded,20);discipleDevelopmentView(loaded.state);
   assert.deepEqual(snapshotSect(loaded),paused);savedExecuting=true;
  }
  assert.equal(p.artsById.qingguard.mastery,0);
  if(!p.mind.learning){finished=true;break;}
 }
 assert(savedExecuting);assert(finished,JSON.stringify({tick:s.worldTick,activity:p.mind.activity,learning:p.mind.learning,energy:p.energy,reason:p.mind.reason}));
 assert.equal(p.mind.knowledge.qingguard,100);assert.equal(p.artsById.qingguard.understanding,100);
 assert.equal(p.personId,identity);assert.equal(p.mind.goal,goal);
});

test('nearby growth reports an existing breakthrough without re-requesting its reserved materials',()=>{
 const {s,p}=fixture();p.xp=xpNeed(p.realm);p.energy=100;p.wound=0;
 // Fund exactly one isolated order so its reservation empties the available stock.
 s.resources.jade=24;s.resources.herb=8;
 s.master.scenic.x=p.mind.scenic.x;s.master.scenic.y=p.mind.scenic.y;
 releaseBodyActivity(s,p);
 const result=beginPersonBreakthrough(s,p.personId,{autonomous:true});
 const order=s.srCultivation.orders[result.orderId],before=structuredClone(s);
 const member=discipleDevelopmentView(s).members.find(m=>m.personId===p.personId);
 assert.deepEqual(s,before);assert(member.cultivation.breakthrough);
 assert.equal(member.cultivation.breakthrough.progress,order.progressTicks);
 assert.equal(member.cultivation.breakthrough.total,order.durationTicks);
 assert.deepEqual(member.cultivation.materials,[]);assert.deepEqual(member.cultivation.conditions,[]);
 s.master.position.sceneId='scene:valley';
 const remote=discipleDevelopmentView(s).members.find(m=>m.personId===p.personId);
 assert.equal(remote.cultivation,undefined);
});
