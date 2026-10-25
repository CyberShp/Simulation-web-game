import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {spatialAccess,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {SITE_SERVICE_VERSION,serviceRecipe} from '../../../src/simulation/ea-service-definitions.mjs';
import {startSiteService,masterSiteService,cancelSiteService,viewSiteServices,tickSiteServices,validateSiteServices,eatSiteMeal,siteMealCount,siteFoodSettlement,siteFoodDemand,requestServiceWork} from '../../../src/simulation/ea-site-services.mjs';
import {stockpileReceiptPreview} from '../../../src/simulation/ea-sr-economy.mjs';
import {day} from '../../../src/simulation/ea-data.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
// Rules fixtures provide explicit commission facts and finite on-site stock.
// Actors retain their source positions and reach each actual metre-space station by official world steps.
function fixture(type='kitchen'){
 let s=SIM.validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableEastResidences','enableEastServices'])s=SIM.dispatchCommand(s,{name,args:[]}).state;
 enableServiceResources(s);const number=type==='kitchen'?13:14,x=type==='kitchen'?192:196,y=type==='kitchen'?60:40,id=s.nextId++;
 const b={...copy(s.buildings[0]),id,instanceId:`building:yunxiu:${id}`,type,level:1,condition:100,enabled:true,progress:0,x,y,domainSiteId:`site:domain:gc-${number}`,serviceVersion:SITE_SERVICE_VERSION,prefabId:`prefab:${type}:units:v1`,transform:{x,y,orientation:'south'}};
 s.buildingsById[b.instanceId]=b;s.spatial.geometryRevision++;
 const fid=`fact:site-service:${b.instanceId}`;s.factsById[fid]={id:fid,kind:'site-service-commissioned',buildingId:b.instanceId,siteId:b.domainSiteId,version:SITE_SERVICE_VERSION,atTick:s.worldTick};
 const sid=`stockpile:${b.instanceId}`;s.stockpilesById[sid]={id:sid,ownerId:'person:master',custodianId:'person:master',access:'public',buildingId:b.instanceId,capacity:320,position:{sceneId:'scene:yunxiu-courtyard',...spatialAccess(b)},resources:{jade:0,wood:8,stone:0,herb:12,crystal:0,insight:0,food:60,cleanWater:40,meal:0,spiritMeal:0},pills:Object.fromEntries(Object.keys(s.stockpilesById['stockpile:yunxiu'].pills).map(k=>[k,0]))};
 s.master.wound=0;s.master.energy=100;s.resources.food=500;s.masterControl.mode='manual';s.masterControl.idleMs=0;
 s=SIM.validateSave(copy(s));return {s,b:s.buildingsById[b.instanceId],sid};
}
function roundtrip(s){const before=JSON.stringify(s),r=SIM.validateSave(copy(s));assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(r),before);return r;}
function until(s,predicate,max=9000){for(let i=0;i<max&&!predicate(s);i++){const from={...s.master.scenic};SIM.tick(s,.1);if(i%200===0)s.masterControl.idleMs=0;if(s.master.scenic.steps!==from.steps)assert.equal(meterSweep(s,from,s.master.scenic).blocked,false,JSON.stringify({tick:s.worldTick,from,to:s.master.scenic,body:s.activitiesById[s.master.activityId]}));}assert(predicate(s),'required physical service state was reached');}

test('queued service holds only on-site inputs, preserves return capacity, and cancels exactly once',()=>{
 let {s,b,sid}=fixture();const before=copy(s.stockpilesById[sid].resources),home=copy(s.resources),viewBytes=JSON.stringify(s);viewSiteServices(s,b.instanceId);assert.equal(JSON.stringify(s),viewBytes);
 const result=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'}),o=s.workOrdersById[result.id];assert.equal(s.stockpilesById[sid].resources.food,before.food-9);assert.deepEqual(copy(s.resources),home);assert.equal(stockpileReceiptPreview(s,sid).reservedAtSource,12);
 s=roundtrip(s);cancelSiteService(s,o.id);assert.deepEqual(s.stockpilesById[sid].resources,before);const cancelled=JSON.stringify(s);assert.throws(()=>cancelSiteService(s,o.id));assert.equal(JSON.stringify(s),cancelled);roundtrip(s);
});
test('master walks to the exact stove, completes one batch, and survives arrival/work save restore',()=>{
 let {s,b,sid}=fixture();const start=copy(s.master.scenic),{id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});masterSiteService(s,id);
 assert.equal(s.workOrdersById[id].progressTicks,0);for(let i=0;i<20;i++)SIM.tick(s,.1);assert.equal(s.workOrdersById[id].progressTicks,0);s=roundtrip(s);
 until(s,x=>x.workOrdersById[id].progressTicks>=20);assert(s.master.scenic.steps>start.steps);const slot=facilitySlots(s,b,'work').find(x=>x.id.endsWith('/slot:work:1'));assert(Math.hypot(s.master.scenic.x-slot.position.x,s.master.scenic.y-slot.position.y)<.04);assert.deepEqual(personLifeSummary(s,s.master).progress,{value:20,total:120,label:'饭食'});s.speed=0;const paused=JSON.stringify(s);tickSiteServices(s);SIM.tick(s,2);assert.equal(JSON.stringify(s),paused);s.speed=1;s=roundtrip(s);until(s,x=>x.workOrdersById[id].phase==='completed');assert.equal(s.stockpilesById[sid].resources.meal,10);assert.equal(s.workOrdersById[id].progressTicks,120);
 const saved=JSON.stringify(s);tickSiteServices(s);assert.equal(JSON.stringify(s),saved);roundtrip(s);
});
test('interrupt after first labor retains consumed inputs and progress without refunding fuel',()=>{
 let {s,b,sid}=fixture();const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});masterSiteService(s,id);until(s,x=>x.workOrdersById[id].progressTicks>=10);const used=copy(s.workOrdersById[id].usedInput),stock=copy(s.stockpilesById[sid].resources);
 s=SIM.dispatchCommand(s,{name:'masterAction',args:['rest']}).state;for(let i=0;i<20;i++)SIM.tick(s,.1);assert.equal(s.workOrdersById[id].phase,'waiting');assert.equal(s.stockpilesById[sid].resources.meal,0);cancelSiteService(s,id);assert.deepEqual(s.workOrdersById[id].usedInput,used);assert.deepEqual(s.stockpilesById[sid].resources,stock);roundtrip(s);
});
test('unknown recipes, skill bypass and forged input/result saves are rejected',()=>{
 const {s,b}=fixture();const before=JSON.stringify(s);assert.throws(()=>startSiteService(s,{buildingId:b.instanceId,recipeId:'other'}));assert.equal(JSON.stringify(s),before);
 const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'spiritMeal'});assert.throws(()=>masterSiteService(s,id),/药理/);
 for(const mutate of [x=>x.workOrdersById[id].recipeSnapshot.input.food=1,x=>x.workOrdersById[id].progressTicks=1,x=>x.reservationsById[x.workOrdersById[id].reservationId].remainingCost.food=0]){const bad=copy(s);mutate(bad);assert.throws(()=>SIM.validateSave(bad));}
 validateSiteServices(s);
});

for(const [recipeId,woundRecovery]of [['treatment',4],['bath',8]])test(`${recipeId} requires separate actual doctor and patient stations before applying one effect`,()=>{
 let {s,b,sid}=fixture('clinic');const lu=s.personsById['person:lu-zhiwei'];lu.wound=12;s.master.knowledge.spring=20;
 const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId,patientId:lu.personId});assert.equal(s.workOrdersById[id].progressTicks,0);for(let i=0;i<10;i++)SIM.tick(s,.1);assert.equal(lu.wound,12);masterSiteService(s,id);
 until(s,x=>x.workOrdersById[id].progressTicks>=10);const o=s.workOrdersById[id],doctor=s.activitiesById[s.master.activityId],patient=s.activitiesById[lu.activityId];assert.notEqual(doctor.slotId,patient.slotId);assert.equal(doctor.phase,'executing');assert.equal(patient.phase,'executing');assert.equal(lu.wound,12);s=roundtrip(s);until(s,x=>x.workOrdersById[id].phase==='completed');assert.equal(s.personsById[lu.personId].wound,12-woundRecovery);assert.equal(s.stockpilesById[sid].resources.herb,12-(recipeId==='bath'?2:1));roundtrip(s);
});

test('meal credit starts the day after commissioning and replaces only the exact personal daily allowance',()=>{
 let {s,b,sid}=fixture();const initialDay=day(s),food=s.resources.food;
 assert.match(viewSiteServices(s,b.instanceId).meal.reason,/翌日/);assert.throws(()=>eatSiteMeal(s,{buildingId:b.instanceId}));
 until(s,x=>day(x)===initialDay+1);assert.equal(s.resources.food,food);assert.equal(siteFoodSettlement(s),0);s=roundtrip(s);
 const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});masterSiteService(s,id);until(s,x=>x.workOrdersById[id].phase==='completed');const mealDay=day(s),raw=s.resources.food;assert.equal(s.stockpilesById[sid].resources.meal,10);
 for(let i=0;i<2;i++){const {workOrderId}=eatSiteMeal(s,{buildingId:b.instanceId});assert.equal(siteMealCount(s,'person:master'),i);until(s,x=>x.workOrdersById[workOrderId].phase==='completed');s=roundtrip(s);}
 assert.equal(siteMealCount(s,'person:master'),2);assert.equal(s.stockpilesById[sid].resources.meal,8);assert.throws(()=>eatSiteMeal(s,{buildingId:b.instanceId}),/两份/);const debt=siteFoodDemand(s);until(s,x=>day(x)>mealDay);assert.equal(s.resources.food,raw-debt);s=roundtrip(s);const paid=s.resources.food;SIM.tick(s,.1);assert.equal(s.resources.food,paid);
});

test('NPC work invitation keeps a refusal and accepted work uses the same actual stove',()=>{
 let {s,b,sid}=fixture();const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'}),lu=s.personsById['person:lu-zhiwei'];
 lu.mind.relationships.master.trust=0;const refused=requestServiceWork(s,{workOrderId:id,personId:lu.personId});assert.equal(refused.accepted,false);assert.equal(s.workOrdersById[id].workerId,null);assert.equal(s.workOrdersById[id].progressTicks,0);
 lu.mind.relationships.master.trust=90;lu.mind.relationships.master.respect=90;lu.mind.activity='rest';lu.job=null;const answer=requestServiceWork(s,{workOrderId:id,personId:lu.personId});assert.equal(answer.accepted,true);s=roundtrip(s);until(s,x=>x.workOrdersById[id].phase==='completed');assert.equal(s.stockpilesById[sid].resources.meal,10);assert.equal(s.factsById[s.workOrdersById[id].resultFactId].workerId,lu.personId);roundtrip(s);
});

test('cancelled service history survives actual demolition and a later exact restore',()=>{
 let {s,b}=fixture();const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});cancelSiteService(s,id);
 s=SIM.dispatchCommand(s,{name:'demolish',args:[b.id]}).state;until(s,x=>!x.buildingsById[b.instanceId]);s=roundtrip(s);assert.equal(s.workOrdersById[id].phase,'cancelled');assert(s.factsById[s.workOrdersById[id].resultFactId]);
});

test('spirit meals need the learned art, then add six energy only after actual dining and share the two-portion cap',()=>{
 let {s,b,sid}=fixture();s.master.knowledge.alchemy=20;const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'spiritMeal'});masterSiteService(s,id);until(s,x=>x.workOrdersById[id].phase==='completed');assert.equal(s.stockpilesById[sid].resources.spiritMeal,2);assert.equal(s.workOrdersById[id].progressTicks,240);
 const {workOrderId}=eatSiteMeal(s,{buildingId:b.instanceId,resourceKey:'spiritMeal'});const energy=s.master.energy;assert.equal(siteMealCount(s,'person:master'),0);until(s,x=>x.workOrdersById[workOrderId].phase==='completed');assert(s.master.energy>energy+5);assert(s.master.energy<=100);assert.equal(siteMealCount(s,'person:master'),1);roundtrip(s);
});

test('completed labor waits for finite output capacity and cannot publish twice',()=>{
 let {s,b,sid}=fixture();const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});masterSiteService(s,id);until(s,x=>x.workOrdersById[id].progressTicks>=1);
 // Capacity-only rule fixture: these independently supplied materials fill the physical stock.
 const st=s.stockpilesById[sid];st.resources.stone=320-Object.values(st.resources).reduce((a,b)=>a+b,0);until(s,x=>x.workOrdersById[id].progressTicks===120);assert.equal(s.workOrdersById[id].phase,'waiting');assert.equal(st.resources.meal,0);s=roundtrip(s);
 for(let i=0;i<10;i++)SIM.tick(s,.1);assert.equal(s.workOrdersById[id].phase,'waiting');s.stockpilesById[sid].resources.stone-=10;SIM.tick(s,.1);assert.equal(s.workOrdersById[id].phase,'completed');assert.equal(s.stockpilesById[sid].resources.meal,10);roundtrip(s);
});

test('dining interruption returns the held cooked portion and leaves daily allowance unspent',()=>{
 let {s,b,sid}=fixture();const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});masterSiteService(s,id);until(s,x=>x.workOrdersById[id].phase==='completed');const before=s.stockpilesById[sid].resources.meal;
 const {workOrderId}=eatSiteMeal(s,{buildingId:b.instanceId});s=roundtrip(s);s=SIM.dispatchCommand(s,{name:'masterAction',args:['rest']}).state;SIM.tick(s,.1);assert.equal(s.workOrdersById[workOrderId].phase,'cancelled');assert.equal(s.stockpilesById[sid].resources.meal,before);assert.equal(siteMealCount(s,'person:master'),0);roundtrip(s);
});

test('an active recipe cannot adopt a later building level or its lower input cost',()=>{
 const {s,b}=fixture(),{id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'}),bad=copy(s),r=serviceRecipe('meal',3);bad.workOrdersById[id].recipeSnapshot=r;const held=bad.reservationsById[bad.workOrdersById[id].reservationId];held.cost=copy(r.input);held.remainingCost=copy(r.input);assert.throws(()=>SIM.validateSave(bad),/服务工单/);
});

test('an NPC who actually ate both portions keeps personal supply when another resident has no raw food',()=>{
 let {s,b}=fixture();const lu=s.personsById['person:lu-zhiwei'];lu.mind.satiety=40;lu.mind.relationships.master.trust=90;lu.mind.relationships.master.respect=90;
 const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'meal'});assert.equal(requestServiceWork(s,{workOrderId:id,personId:lu.personId}).accepted,true);until(s,x=>x.workOrdersById[id].phase==='completed');until(s,x=>siteMealCount(x,lu.personId)===2);const suppliedDay=day(s),satiety=s.personsById[lu.personId].mind.satiety,trust=s.personsById[lu.personId].mind.relationships.master.trust;
 // Explicit shortage fixture after the NPC's two portions have physically been consumed.
 s.resources.food=0;s=roundtrip(s);until(s,x=>day(x)>suppliedDay);assert(s.economy.starvation>0);const person=s.personsById[lu.personId],fact=s.factsById[`fact:person-daily-supply:${lu.personId}:${day(s)}`];assert.equal(fact.supplied,true);assert.equal(fact.mealCredit.factIds.length,2);assert(person.mind.satiety>=satiety);assert(person.mind.relationships.master.trust>=trust);roundtrip(s);
});

test('present injured artisan receives one clinic treatment with arrival and work restores',()=>{
 let {s,b,sid}=fixture('clinic');const p=s.personsById['person:cheng-wenzhou'];
 s.story.artisan.phase='present';s.story.artisan.arrivedTick=s.worldTick;p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:28,y:25};p.wound=35;s.master.knowledge.spring=24;
 assert(viewSiteServices(s,b.instanceId).patients.some(x=>x.personId===p.personId&&x.available));
 const herbs=s.stockpilesById[sid].resources.herb;s.stockpilesById[sid].resources.herb=0;
 assert.throws(()=>startSiteService(s,{buildingId:b.instanceId,recipeId:'treatment',patientId:p.personId}),/材料/);s.stockpilesById[sid].resources.herb=herbs;
 s.story.artisan.phase='arriving';assert.throws(()=>startSiteService(s,{buildingId:b.instanceId,recipeId:'treatment',patientId:p.personId}),/患者/);s.story.artisan.phase='present';
 s=SIM.validateSave(copy(s));const {id}=startSiteService(s,{buildingId:b.instanceId,recipeId:'treatment',patientId:p.personId});masterSiteService(s,id);s=roundtrip(s);
 until(s,x=>x.workOrdersById[id].progressTicks>=10);s=roundtrip(s);until(s,x=>x.workOrdersById[id].phase==='completed');
 assert.equal(s.personsById[p.personId].wound,31);assert.equal(s.story.artisan.phase,'present');assert(!s.homeMemberIds.includes(p.personId));assert.equal(s.stockpilesById[sid].resources.herb,herbs-1);assert.equal(s.stockpilesById[sid].resources.cleanWater,39);s=roundtrip(s);
 SIM.tick(s,.1);assert.equal(s.personsById[p.personId].wound,31);assert.equal(Object.values(s.factsById).filter(f=>f.workOrderId===id&&f.kind==='site-service-completed').length,1);
});
