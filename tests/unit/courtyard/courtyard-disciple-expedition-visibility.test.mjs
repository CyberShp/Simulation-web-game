import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {scenicHomeActors} from '../../../src/simulation/ea-scene-state.mjs';
import {setDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';

test('autonomous preparation and home arrival retain a visible body around the actual world journey',()=>{
 const session=createSectSession(),s=session.state;const checkedPhases=new Set();
 // Official person factory creates an eligible resident for this focused unit fixture.
 const p=SIM.addDisciple(s,{name:'验境门人',main:s.master.main,traits:[70,90,70,70,90]});
 // This visibility case follows an actual supply outing; purpose is chosen by the runtime.
 p.mind.goal='沿路采药，补充草木药用';
 p.location={kind:'local',sceneId:'scene:yunxiu-courtyard',x:p.mind.scenic.x,y:p.mind.scenic.y};
 p.position={kind:'scene',sceneId:p.location.sceneId,x:p.location.x,y:p.location.y};
 setDiscipleExpeditions(s,{enabled:true});
 let prepared=false,outbound=false,delivery=false;
 for(let i=0;i<6500;i++){
  s.speed=1;SIM.tick(s,.1);const j=s.discipleExpeditions.journeys[0];if(!j)continue;
  const person=s.personsById[j.personId];
  if(['preparing','approach','delivery'].includes(j.phase)&&!checkedPhases.has(j.phase)){const saved=snapshotSect(session);const loaded=restoreSect(saved);assert.equal(loaded.state.discipleExpeditions.journeys[0].phase,j.phase);checkedPhases.add(j.phase);}
  if(['preparing','approach'].includes(j.phase)){prepared=true;assert(scenicHomeActors(s).includes(person),j.phase+' home body remains visible');}
  if(j.phase==='outbound'){outbound=true;assert(!scenicHomeActors(s).includes(person),'world travel removes the home body');}
  if(j.phase==='delivery'){delivery=true;assert.equal(j.cargo.herb,6);assert(scenicHomeActors(s).includes(person),'home arrival appears before cargo settlement');assert.equal(person.mind.activity,'walk');assert.equal(person.mind.away,null);break;}
 }
 assert(prepared);assert(outbound);assert(delivery);assert.deepEqual([...checkedPhases].sort(),['approach','delivery','preparing']);
 for(let i=0;i<1000&&s.discipleExpeditions.journeys[0].phase!=='returned';i++){s.speed=1;SIM.tick(s,.1);}
 assert.equal(s.discipleExpeditions.journeys[0].phase,'returned');
 const returnedTick=s.discipleExpeditions.journeys[0].completedTick;
 assert(s.discipleExpeditions.nextOpportunityTick>=returnedTick+1200,'rest period starts at actual return');
 for(let i=0;i<20;i++){s.speed=1;SIM.tick(s,.1);}
 assert.equal(s.discipleExpeditions.journeys.length,1,'return report remains available before another outing');
});
