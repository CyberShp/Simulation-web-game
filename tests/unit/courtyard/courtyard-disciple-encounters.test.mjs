import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession } from '../../../apps/courtyard/sect-sim.mjs';
import { encounterStep, DISCIPLE_ENCOUNTER_RULES } from '../../../src/simulation/ea-disciple-encounters.mjs';
function fixture(x=21.7) {
 const s=createSectSession().state;
 const p=s.personsById[s.homeMemberIds[0]],foe=s.personsById['person:valley-shanxiao'];
 p.realm=1;p.wound=0;p.energy=80;p.lifeStatus='alive';p.location={kind:'local',sceneId:'scene:valley',x,y:36};
 foe.location={kind:'local',sceneId:'scene:valley',x:27,y:36};s.worldTick=100;
 return {s,p,j:{}};
}
test('scouting requires actual co-location and perception; no remote knowledge',()=>{
 const {s,p,j}=fixture(10);assert.equal(encounterStep(s,p,j),null);assert.equal(j.encounter,undefined);
 p.location={kind:'local',sceneId:'scene:market',x:26,y:36};assert.equal(encounterStep(s,p,j),null);
});
test('visible danger prompts autonomous retreat outside contact with no injury',()=>{
 const {s,p,j}=fixture();assert.deepEqual(encounterStep(s,p,j),{retreat:true});assert.equal(p.wound,0);assert.equal(j.encounter.risk,'high');assert.equal(p.energy,80);assert.equal(j.encounter.injury,0);assert.equal(j.encounter.lastContactTick,undefined);
 s.personsById['person:valley-shanxiao'].lifeStatus='dead';assert.equal(encounterStep(s,p,j),null);
});
test('contact causes persistent injury once per clock interval and respects real armor',()=>{
 const {s,p,j}=fixture(26);s.itemsById.robe={condition:100,ownerId:p.personId,definitionId:'equipment:travel-robe',location:{kind:'person',id:p.personId,slot:'armor'}};
 encounterStep(s,p,j);assert.ok(Math.abs(p.wound-9.2)<1e-9);encounterStep(s,p,j);assert.ok(Math.abs(p.wound-9.2)<1e-9);
 s.worldTick+=10;encounterStep(s,p,j);assert.ok(Math.abs(p.wound-18.4)<1e-9);
 const restored=JSON.parse(JSON.stringify({s,p,j}));encounterStep(restored.s,restored.p,restored.j);assert.ok(Math.abs(restored.p.wound-18.4)<1e-9);
});

test('lethal contact preserves canonical permanent death and remains idempotent',()=>{
 const {s,p,j}=fixture(26);p.wound=95;encounterStep(s,p,j);
 assert.equal(p.lifeStatus,'dead');assert.ok(s.deathRecordsByPersonId[p.personId]);
 const fact=p.deathFactId;s.worldTick+=10;assert.equal(encounterStep(s,p,j),null);assert.equal(p.deathFactId,fact);
});


test('perception and physical contact have separate inclusive distance boundaries',()=>{
 assert.equal(DISCIPLE_ENCOUNTER_RULES.perception,6);assert.equal(DISCIPLE_ENCOUNTER_RULES.contactDistance,3);
 for(const distance of [3-.001,3,3+.001,5.3,6,6+.001]){
  const {s,p,j}=fixture(27-distance),before={energy:p.energy,wound:p.wound};
  const result=encounterStep(s,p,j);
  if(distance>6){assert.equal(result,null);assert.equal(j.encounter,undefined);}
  else{assert.deepEqual(result,{retreat:true});assert.equal(j.encounter.observedTick,s.worldTick);assert.equal(j.encounter.lastPosition.sceneId,'scene:valley');}
  if(distance<=3){assert.equal(p.wound,10);assert.equal(p.energy,76);assert.equal(j.encounter.lastContactTick,s.worldTick);}
  else{assert.equal(p.wound,before.wound);assert.equal(p.energy,before.energy);assert.equal(j.encounter?.lastContactTick,undefined);}
 }
});

test('closing from observation to contact starts damage only on actual entry and preserves the ten-tick interval',()=>{
 const {s,p,j}=fixture(21.7);encounterStep(s,p,j);assert.equal(p.wound,0);assert.equal(j.encounter.lastContactTick,undefined);
 p.location={...p.location,x:24};s.worldTick++;encounterStep(s,p,j);assert.equal(p.wound,10);assert.equal(j.encounter.lastContactTick,101);
 s.worldTick+=9;encounterStep(s,p,j);assert.equal(p.wound,10);s.worldTick++;encounterStep(s,p,j);assert.equal(p.wound,20);
 const contactTick=j.encounter.lastContactTick;p.location={...p.location,x:21.7};s.worldTick+=10;encounterStep(s,p,j);assert.equal(p.wound,20);assert.equal(j.encounter.lastContactTick,contactTick);
});
