import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {encounterStep} from '../../../src/simulation/ea-disciple-encounters.mjs';

// U-172 local encounter conditions. Contact3 retains HEAD b336841's original
// valley radius; perception6 is the existing expedition observation contract.
function fixture(distance){
 const s=createSectSession().state,p=s.personsById[s.homeMemberIds[0]],foe=s.personsById['person:valley-shanxiao'];
 p.realm=1;p.wound=0;p.energy=80;p.lifeStatus='alive';
 p.location={kind:'local',sceneId:'scene:valley',x:27-distance,y:36};p.position={kind:'scene',sceneId:'scene:valley',x:27-distance,y:36};
 foe.location={kind:'local',sceneId:'scene:valley',x:27,y:36};foe.position={kind:'scene',sceneId:'scene:valley',x:27,y:36};foe.lifeStatus='alive';
 s.worldTick=100;return{s,p,foe,j:{}};
}

test('contact and perception retain distinct inclusive3m and6m boundaries',()=>{
 for(const [distance,seen,hurt] of [[2.999,true,true],[3,true,true],[3.001,true,false],[5.999,true,false],[6,true,false],[6.001,false,false]]){
  const{s,p,j}=fixture(distance),result=encounterStep(s,p,j);
  assert.equal(!!j.encounter,seen,'observation at '+distance+'m');
  assert.equal(result?.retreat===true,seen,'retreat at '+distance+'m');
  assert.equal(p.wound>0,hurt,'contact damage at '+distance+'m');
  assert.equal(p.energy<80,hurt,'contact cost at '+distance+'m');
  if(seen&&!hurt){assert.equal(j.encounter.injury,0);assert.equal(j.encounter.lastContactTick,undefined);}
 }
});

test('outside perception the distant opponents combat strength is not read or disclosed',()=>{
 const{s,p,foe,j}=fixture(6.001);
 Object.defineProperty(foe,'realm',{configurable:true,get(){assert.fail('remote strength was consulted outside perception');}});
 assert.equal(encounterStep(s,p,j),null);assert.deepEqual(j,{});
 assert.equal(p.wound,0);assert.equal(p.energy,80);
});

test('contact applies actual injury once per10-world-tick interval',()=>{
 const{s,p,j}=fixture(3);encounterStep(s,p,j);
 const first=p.wound,energy=p.energy;assert(first>0);assert.equal(j.encounter.lastContactTick,100);
 encounterStep(s,p,j);assert.equal(p.wound,first);assert.equal(p.energy,energy);
 s.worldTick=109;encounterStep(s,p,j);assert.equal(p.wound,first);assert.equal(p.energy,energy);
 s.worldTick=110;encounterStep(s,p,j);assert.equal(p.wound,first*2);assert.equal(j.encounter.injury,p.wound);
 encounterStep(s,p,j);assert.equal(p.wound,first*2,'same-tick repetition cannot deal a third hit');
});

test('a dead opponent or a different scene cannot deal contact damage or refresh an observation',()=>{
 for(const condition of ['dead','different-scene']){
  const{s,p,foe,j}=fixture(5);encounterStep(s,p,j);assert(j.encounter);
  const observed=JSON.stringify(j);s.worldTick+=10;
  p.location={...p.location,x:26};p.position={...p.position,x:26};
  if(condition==='dead')foe.lifeStatus='dead';else{foe.location={...foe.location,sceneId:'scene:market'};foe.position={...foe.position,sceneId:'scene:market'};assert.equal(foe.location.sceneId,'scene:market');}
  assert.equal(encounterStep(s,p,j),null,condition);assert.equal(JSON.stringify(j),observed,condition);
  assert.equal(p.wound,0);assert.equal(p.energy,80);
 }
});
