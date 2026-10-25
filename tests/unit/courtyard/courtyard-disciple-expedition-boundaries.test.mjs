import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {setDiscipleExpeditions,advanceDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';

// Unit fixture uses the official person factory; it is not a normal-play acceptance run.
function fixture() {
 const run=createSectSession(),s=run.state;
 const p=SIM.addDisciple(s,{name:'验境门人',main:s.master.main,traits:[70,90,70,70,90]});
 p.location={kind:'local',sceneId:'scene:yunxiu-courtyard',x:p.mind.scenic.x,y:p.mind.scenic.y};
 p.position={kind:'scene',sceneId:p.location.sceneId,x:p.location.x,y:p.location.y};
 setDiscipleExpeditions(s,{enabled:true});
 assert.doesNotThrow(()=>restoreSect(snapshotSect(run)),'fixture itself must load before any corruption');
 return {run,s,p};
}
function step(s){s.worldTick++;advanceDiscipleExpeditions(s);}
test('wounds and accepted duties prevent departure without spending food',()=>{
 for(const mode of ['wound','duty']){
  const {run,s}=fixture();
  for(const p of s.disciples){if(mode==='wound')p.wound=30;else p.job=s.buildings.find(b=>b.type==='farm').id;}
  assert.doesNotThrow(()=>restoreSect(snapshotSect(run)));
  const food=s.resources.food,energy=s.disciples.map(p=>p.energy);
  step(s);assert.equal(s.discipleExpeditions.journeys.length,0);
  assert.equal(s.resources.food,food);assert.deepEqual(s.disciples.map(p=>p.energy),energy);
 }
});
test('paused public advancement preserves world and outing exactly',()=>{
 const {run,s}=fixture();s.speed=0;const before=snapshotSect(run);advanceSect(run,12);
 assert.deepEqual(snapshotSect(run),before);
});
test('generated preparation has a valid baseline and corrupt identity is rejected',()=>{
 const {run,s}=fixture();step(s);
 assert.equal(s.discipleExpeditions.journeys.length,1,'eligible fixture generates its own real plan');
 const saved=snapshotSect(run);assert.doesNotThrow(()=>restoreSect(saved));
 const broken=structuredClone(saved);broken.state.discipleExpeditions.journeys[0].personId='person:missing';
 assert.throws(()=>restoreSect(broken),/门人历练记录异常/);
});
test('valid generated outbound rejects changed travel and forged encounter',()=>{
 const {run,s}=fixture();
 for(let i=0;i<2000&&s.discipleExpeditions.journeys[0]?.phase!=='outbound';i++){s.speed=1;SIM.tick(s,.1);}
 assert.equal(s.discipleExpeditions.journeys[0]?.phase,'outbound');
 const saved=snapshotSect(run);assert.doesNotThrow(()=>restoreSect(saved));
 const brokenTravel=structuredClone(saved),j=brokenTravel.state.discipleExpeditions.journeys[0];
 brokenTravel.state.travelsById[j.travelId].participantIds=[];
 assert.throws(()=>restoreSect(brokenTravel));
 const brokenEncounter=structuredClone(saved);
 brokenEncounter.state.discipleExpeditions.journeys[0].encounter={personId:'person:valley-shanxiao',observedTick:s.worldTick+1,lastObservedTick:s.worldTick+1,lastPosition:{sceneId:'scene:valley',x:27,y:36},injury:0,risk:'high',reason:'未来观测'};
 assert.throws(()=>restoreSect(brokenEncounter),/门人历练记录异常/);
});
