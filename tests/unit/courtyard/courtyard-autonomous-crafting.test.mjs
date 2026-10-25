import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {initEconomy,craftAvailabilityForPerson,requestAutonomousCraft,cancelPersonCraftSR,craftRefundPreview,tickEconomy,validateEconomy,settleEconomyDeath} from '../../../src/simulation/ea-sr-economy.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
const HOME='stockpile:yunxiu',B='building:yunxiu:90',SITE='stockpile:'+B;
// Rule geometry matches the existing four-station fixture. Initial materials,
// needs and personality are configured; no order, work or result is prewritten.
function fixture(){
 const s=createSectSession().state;enableServiceResources(s);
 s.buildingsById[B]={id:90,instanceId:B,type:'alchemy',level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',enabled:true,condition:100,transform:{x:44,y:40,orientation:'south'},domainSiteId:'site:domain:gc-26'};initEconomy(s);
 Object.assign(s.resources,{jade:100,food:100});Object.assign(s.stockpilesById[SITE].resources,{herb:10,cleanWater:2,wood:1});
 const p=s.personsById[s.homeMemberIds[0]];releaseBodyActivity(s,p);p.job=null;p.energy=100;p.wound=0;
 Object.assign(p.mind,{activity:'rest',learning:null,office:null,satiety:100,commitUntil:0,lastDecision:s.time,traits:[70,50,50,80,50]});Object.assign(p.mind.relationships.master,{trust:80});delete p.mind.recovering;
 Object.assign(p.mind.scenic,{x:47,y:47,path:[],goal:null});p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:47,y:47};
 s.master.scenic.path=[{x:28,y:13}];s.master.scenic.goal={x:28,y:13};return{s,p};
}
const masterBody=s=>structuredClone({activityId:s.master.activityId,action:s.master.action,scenic:s.master.scenic,position:s.master.position});
function begin(s,p){const r=requestAutonomousCraft(s,p.personId,'heal',{buildingId:B});assert.equal(r.accepted,true,r.reason);return s.workOrdersById[r.id];}
function run(s,p,w,predicate,max=1200){for(let n=0;n<max&&!predicate();n++){const progress=w.progressTicks;s.worldTick++;tickEconomy(s);if(w.progressTicks>progress){assert.equal(w.progressTicks,progress+1);const a=s.activitiesById[p.activityId];const slot=slotById(s,a?.slotId||w.process.completedStages.at(-1).slotId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);}}assert(predicate(),'bounded physical craft progression');}

test('a willing resident owns every real stage and the result while the master retains their own movement',()=>{
 const {s,p}=fixture(),before=JSON.stringify(s),quote=craftAvailabilityForPerson(s,'heal',p.personId,{buildingId:B}),master=masterBody(s);
 assert.equal(quote.available,true);assert.equal(JSON.stringify(s),before);assert.deepEqual(quote.cost,{jade:10,herb:10,cleanWater:2,wood:1});assert.equal(quote.sourceStockpileIds.jade,HOME);assert.equal(quote.sourceStockpileIds.herb,SITE);assert.equal(quote.yield,2);assert.equal(quote.process.stages.length,4);
 const w=begin(s,p);assert.equal(w.personId,p.personId);assert.equal(s.master.activityId,master.activityId);assert.equal(s.factsById[w.choiceFactId].actorId,p.personId);assert.equal(s.reservationsById[w.slotReservationId].personId,p.personId);
 const sameTick=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),sameTick);run(s,p,w,()=>w.progressTicks>0);assert.equal(s.activitiesById[p.activityId].phase,'working');assert.equal(w.progressTicks,1);
 run(s,p,w,()=>w.phase==='completed');assert.deepEqual(w.process.completedStages.map(x=>x.id),['prepare','extract','fire','seal']);assert.equal(new Set(w.process.completedStages.map(x=>x.slotId)).size,4);assert.equal(w.progressTicks,280);assert.equal(s.stockpilesById[SITE].pills.heal,2);assert.equal(s.factsById[w.resultFactId].actorId,p.personId);assert.equal(s.factsById[w.resultFactId].targetStockpileId,SITE);assert.equal(s.resources.jade,90);assert.equal(s.stockpilesById[SITE].resources.herb,0);assert.equal(p.activityId,null);assert.equal(p.job,null);assert.deepEqual(masterBody(s),master);assert.equal(validateEconomy(s),true);
 const done=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),done);
});

test('personal refusal, current commitments, bodily needs and missing material reject before claiming resources or slots',()=>{
 for(const condition of ['unwilling','office','job','learning','recovering','wound','energy','satiety','materials','building']){
  const {s,p}=fixture();let target=B;
  if(condition==='unwilling'){p.mind.traits=[0,0,50,0,0];p.mind.relationships.master.trust=0;}
  if(condition==='office')p.mind.office='healer';if(condition==='job')p.job=s.buildingsById[B].id;if(condition==='learning')p.mind.learning={id:'qingyuan',progress:0};if(condition==='recovering')p.mind.recovering=true;if(condition==='wound')p.wound=6;if(condition==='energy')p.energy=34.9;if(condition==='satiety')p.mind.satiety=21.9;if(condition==='materials')s.stockpilesById[SITE].resources.cleanWater=0;if(condition==='building')target='building:missing';
  const before=JSON.stringify(s),r=requestAutonomousCraft(s,p.personId,'heal',{buildingId:target});assert.equal(r.accepted,false,condition);assert.equal(JSON.stringify(s),before,condition+' must not consume or steal a body');
 }
});

for(const ending of ['cancel','death'])test(`${ending} settles the resident's partial batch without clearing the master's path`,()=>{
 const {s,p}=fixture(),master=masterBody(s),w=begin(s,p);run(s,p,w,()=>w.process.stageIndex===1&&w.process.stageProgressTicks===10);
 const preview=craftRefundPreview(s,w);assert.equal(preview.consumed.herb,10);assert.equal(preview.consumed.cleanWater,.5);
 if(ending==='cancel')assert.deepEqual(cancelPersonCraftSR(s,p.personId).refund,preview.refundable);else{p.lifeStatus='dead';settleEconomyDeath(s,p.personId);assert.equal(w.phase,'interrupted');}
 assert.equal(s.stockpilesById[SITE].pills.heal,0);assert.equal(p.activityId,null);assert.equal(s.stockpilesById[SITE].resources.cleanWater,1.5);assert.equal(s.resources.jade,100);assert.deepEqual(masterBody(s),master);assert.equal(s.factsById[`fact:craft-cancel:${w.id}`].actorId,p.personId);assert.equal(validateEconomy(s),true);
 const before=JSON.stringify(s);assert.throws(()=>cancelPersonCraftSR(s,p.personId));assert.equal(JSON.stringify(s),before);
});
