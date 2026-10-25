import test from 'node:test';
import assert from 'node:assert/strict';
import {productionWorkSkill} from '../../../src/simulation/ea-society.mjs';
import {tick,prepareAutonomyV2,workCandidateV2,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {buildingYield} from '../../../src/simulation/ea-sim.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {createWorkSpecializationScenario} from '../../fixtures/work-specialization.mjs';

function advance(f,predicate,limit=650){
 for(let n=0;n<limit;n++){tick(f.s,.1);if(predicate())return;}
 assert.fail('bounded specialization scene: '+JSON.stringify(f.people.map(({personId})=>{const p=f.s.personsById[personId];return {personId,activity:p.mind.activity,job:p.job,reason:p.mind.reason,body:f.s.activitiesById[p.activityId]};})));
}
const person=(f,entry)=>f.s.personsById[entry.personId];
const chosen=(f,entry)=>person(f,entry).mind.activity==='work'&&person(f,entry).job===f.s.buildingsById[entry.buildingId].id;

test('work preference and production resolve the same crop, recipe snapshot and legacy tag skills without writes',()=>{
 const expected={farm:'plant',granary:'plant',lumber:'industry',quarry:'industry',library:'learning',well:'array',workshop:'industry'};
 for(const [type,skill]of Object.entries(expected)){
  const b={type,instanceId:'building:skill-fixture'},id='work:production:'+b.instanceId,s={workOrdersById:{}};
  const before=JSON.stringify(s);assert.equal(productionWorkSkill(s,b),skill);assert.equal(JSON.stringify(s),before);
  s.workOrdersById[id]={phase:'active',recipeSnapshot:{skillKey:skill}};assert.equal(productionWorkSkill(s,b),skill);
  s.workOrdersById[id].recipeSnapshot.skillKey='medicine';assert.equal(productionWorkSkill(s,b),'medicine','an active snapshot takes precedence over the building tag');
  // Completed snapshots do not choose the skill for the next batch.
  s.workOrdersById[id]={phase:'completed',recipeSnapshot:{skillKey:'medicine'}};assert.equal(productionWorkSkill(s,b),skill);
 }
 const b={type:'farm',instanceId:'building:crop-fixture'},s={workOrdersById:{'work:production:building:crop-fixture':{phase:'waiting',crop:{phase:'growing'}}}};
 assert.equal(productionWorkSkill(s,b),'plant');
});

test('opposite acquired skills change actual autonomous work choices with the same personalities and RNG',()=>{
 const normal=createWorkSpecializationScenario(),swapped=createWorkSpecializationScenario({swapSpecialties:true});
 assert.equal(normal.s.rngState,swapped.s.rngState);
 for(const f of [normal,swapped]){
  const initial=new Map(f.people.map(e=>[e.personId,structuredClone({goal:person(f,e).mind.goal,traits:person(f,e).mind.traits,knowledge:person(f,e).mind.knowledge})]));
  advance(f,()=>f.people.every(e=>chosen(f,e)),30);
  for(const entry of f.people){const p=person(f,entry);assert.match(p.mind.reason,entry.skillKey==='plant'?/已有灵植经验/:/已有百工经验/);assert.deepEqual({goal:p.mind.goal,traits:p.mind.traits,knowledge:p.mind.knowledge},initial.get(entry.personId));}
 }
 for(const entry of normal.people)assert.notEqual(person(normal,entry).job,swapped.s.personsById[entry.personId].job);
});

test('specialists physically reach their own work slots and settle one ordinary batch with the existing yield and growth',()=>{
 const f=createWorkSpecializationScenario(),initialFacts=new Set(Object.keys(f.s.factsById)),arrivals=new Set(),finished=new Map();
 const homeBefore={...f.s.resources},siteBefore=new Map(f.people.map(e=>[e.buildingId,{...f.s.stockpilesById['stockpile:'+e.buildingId].resources}]));
 advance(f,()=>{
  for(const entry of f.people){
   const p=person(f,entry),a=f.s.activitiesById[p.activityId];
   if(a?.kind==='facility'&&a.action==='work'&&a.phase==='executing'&&a.targetId===entry.buildingId){const slot=slotById(f.s,a.slotId),r=f.s.reservationsById[a.reservationId];assert(slot);assert.equal(r.personId,p.personId);assert.equal(r.slotId,a.slotId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);arrivals.add(p.personId);}
   const fact=Object.values(f.s.factsById).find(x=>!initialFacts.has(x.id)&&x.operation==='production'&&x.workOrderId==='work:production:'+entry.buildingId);
   if(fact&&!finished.has(entry.personId))finished.set(entry.personId,structuredClone({fact,stock:f.s.stockpilesById[fact.targetStockpileId].resources}));
  }
  return finished.size===f.people.length;
 });
 for(const entry of f.people){
  const p=person(f,entry),b=f.s.buildingsById[entry.buildingId],{fact,stock}=finished.get(entry.personId),resource=entry.skillKey==='plant'?'herb':'wood';
  assert(arrivals.has(p.personId));assert.deepEqual(fact.participantIds,[p.personId]);assert.equal(fact.participantSkills[p.personId],entry.initialSkill);assert(Math.abs(p.mind.skills[entry.skillKey]-entry.initialSkill-.6)<1e-9);
  assert(Math.abs(fact.grossOutput[resource]-buildingYield(f.s,b,p)[resource]*(1+entry.initialSkill/250))<1e-8,'the preference score adds no second production multiplier');
  assert.equal(fact.targetStockpileId,'stockpile:'+entry.buildingId);
  const consumed=entry.skillKey==='plant'?f.metadata.conditions.farmSeedHerb:0;
  assert(Math.abs(stock[resource]-(siteBefore.get(entry.buildingId)[resource]-consumed+fact.quantities[resource]))<1e-8,'first settlement enters the real site stock before any later sowing');
  assert.equal(f.s.resources[resource],homeBefore[resource],'physical goods remain at the work site');
 }
});

test('a valid work commitment keeps its current job despite a stronger different specialty',()=>{
 const f=createWorkSpecializationScenario();advance(f,()=>f.people.every(e=>chosen(f,e)),30);const e=f.people[0],p=person(f,e),job=p.job;
 p.mind.skills.plant=0;p.mind.skills.industry=100;const until=p.mind.commitUntil;for(let n=0;n<20;n++)tick(f.s,.1);
 assert(f.s.society.clock<until);assert.equal(person(f,e).job,job);
});

test('urgent hunger, fatigue and injury retain priority over work experience',()=>{
 for(const condition of ['hungry','tired','injured']){
  const f=createWorkSpecializationScenario(),e=f.people[0],p=person(f,e);if(condition==='hungry')p.mind.satiety=10;if(condition==='tired')p.energy=10;if(condition==='injured')p.wound=30;
  const before=p.mind.lastDecision;advance(f,()=>person(f,e).mind.lastDecision>before,15);assert.notEqual(person(f,e).mind.activity,'work',condition);assert(!Object.values(f.s.factsById).some(x=>x.operation==='production'&&x.participantIds?.includes(e.personId)));
 }
});

test('missing seed and a disabled expert workplace do not become usable through skill',()=>{
 for(const condition of ['seed','disabled']){
  const f=createWorkSpecializationScenario(),e=f.people[0];if(condition==='seed')f.s.stockpilesById['stockpile:'+e.buildingId].resources.herb=0;else f.s.buildingsById[e.buildingId].enabled=false;
  const before=person(f,e).mind.lastDecision;advance(f,()=>person(f,e).mind.lastDecision>before,15);assert.notEqual(person(f,e).job,f.s.buildingsById[e.buildingId].id);assert(!Object.values(f.s.factsById).some(x=>x.operation==='production'&&x.workOrderId==='work:production:'+e.buildingId));
 }
});

test('a sourced v2 work invitation retains its existing score, answer and actual finite commitment',()=>{
 const f=createWorkSpecializationScenario();f.s=prepareAutonomyV2(f.s);const e=f.people[0],candidate=workCandidateV2(f.s,e.personId,e.buildingId),request={name:'inviteWork',args:[e.personId,e.buildingId]};
 assert(candidate.available&&candidate.willing);const invited=dispatchCommand(f.s,request);f.s=invited.state;const answer=invited.result;assert(answer.accepted);assert.equal(answer.score,candidate.score);
 const facts=Object.keys(f.s.factsById).length,repeated=dispatchCommand(f.s,request);assert.deepEqual(repeated.result,answer);assert.equal(Object.keys(repeated.state.factsById).length,facts);f.s=repeated.state;
 const p=person(f,e),promise=Object.values(p.schedule.commitmentsById).find(c=>c.sourceFactId===answer.sourceFactId);assert(promise);assert.equal(promise.targetId,e.buildingId);assert.equal(f.s.factsById[answer.sourceFactId].kind,'autonomy-work-choice');
 const deadline=promise.endTick;for(let n=0;n<30;n++)tick(f.s,.1);assert.equal(person(f,e).job,f.s.buildingsById[e.buildingId].id);assert.equal(person(f,e).mind.activity,'work');assert.equal(person(f,e).schedule.commitmentsById[promise.id].status,'active');assert.equal(person(f,e).schedule.commitmentsById[promise.id].endTick,deadline);
});
