import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {craftAvailabilitySR,cancelCraftSR} from '../../../src/simulation/ea-sr-economy.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {WEST_ALCHEMY_PROCESS_RECIPE_VERSION} from '../../../src/simulation/ea-alchemy-definitions.mjs';

function fixture({local={},service=true,west=true}={}){
 const s=createSectSession().state;
 // Read-only pricing input fixture. This is not a placed GC26 or a save/road acceptance world.
 const b={...s.buildings[0],type:'alchemy',level:1,enabled:true,condition:100,instanceId:'building:fixture:alchemy'};
 if(west)b.domainSiteId='site:domain:gc-26';
 s.buildingsById[b.instanceId]=b;
 if(service)enableServiceResources(s);
 s.stockpilesById[`stockpile:${b.instanceId}`]={id:`stockpile:${b.instanceId}`,resources:{herb:100,crystal:20,...local}};
 Object.assign(s.resources,{jade:500,insight:30,wood:100,...(service?{cleanWater:100}:{})});
 s.master.realm=9;s.master.energy=100;s.master.wound=0;s.master.activityId=null;
 s.master.knowledge.alchemy=40;s.doctrine.books.push('foundation');return s;
}

test('new furnace recipes require water and fuel at the furnace even when public stocks are sufficient',()=>{
 for(const [id,water,wood]of [['heal',2,1],['qi',2,1],['spirit',3,2],['foundation',6,4]]){
  const s=fixture(),raw=structuredClone(s),p=craftAvailabilitySR(s,id);assert.equal(p.available,false);assert.equal(p.recipeVersion,WEST_ALCHEMY_PROCESS_RECIPE_VERSION);
  assert(p.reasons.some(r=>r.includes('洁水')));assert(p.reasons.some(r=>r.includes('灵木')));
  assert.equal(p.cost.cleanWater,water);assert.equal(p.cost.wood,wood);assert.deepEqual(s,raw);
  for(const local of [{cleanWater:water,wood:wood-1},{cleanWater:water-1,wood}]){
   const low=fixture({local}),before=structuredClone(low);assert.equal(craftAvailabilitySR(low,id).available,false);assert.deepEqual(low,before);
  }
  const ready=fixture({local:{cleanWater:water,wood}}),before=structuredClone(ready);assert.equal(craftAvailabilitySR(ready,id).available,true);assert.deepEqual(ready,before);
 }
});

test('legacy furnace costs stay unchanged and missing service-resource activation cannot quote an available new batch',()=>{
 const old=fixture({west:false}),before=structuredClone(old),p=craftAvailabilitySR(old,'heal');assert.deepEqual(p.cost,{jade:10,herb:10});assert.equal(p.recipeVersion,'supply-recipes:yunxiu:v2');assert.deepEqual(old,before);
 const early=fixture({service:false}),raw=structuredClone(early),n=craftAvailabilitySR(early,'heal');assert.equal(n.available,false);assert(n.reasons.some(r=>r.includes('生活物资')));assert.deepEqual(early,raw);
});

test('cancellation returns optional zero-key water once, with overflow kept at its actual source position',()=>{
 for(const progress of [0,30])for(const full of [false,true]){
  // Isolated cancellation-rule input; full new-site save and movement acceptance follows the terrain integration.
  const source={id:'stock:source',ownerId:'person:master',custodianId:'person:master',access:'public',capacity:40,position:{sceneId:'scene:yunxiu-courtyard',x:10,y:20},resources:{herb:full?40:0}};
  const order={id:'work:water-fixture',phase:'active',cost:{cleanWater:2},sourceStockpileIds:{cleanWater:source.id},progressTicks:progress,durationTicks:200,activityId:'activity:water-fixture',reservationId:'reserved:water',slotReservationId:'reserved:slot',personId:'person:master'};
  const s={worldTick:50,master:{activityId:order.activityId,scenic:{path:[],goal:null}},activitiesById:{[order.activityId]:{kind:'sr-craft',workOrderId:order.id}},workOrdersById:{[order.id]:order},reservationsById:{[order.reservationId]:{},[order.slotReservationId]:{}},stockpilesById:{[source.id]:source},factsById:{}};
  const result=cancelCraftSR(s),expected=2*(1-progress/200),destination=s.stockpilesById[order.refundStockpileIds.cleanWater];
  assert.equal(result.refund.cleanWater,expected);assert.equal(destination.resources.cleanWater,expected);assert.equal(destination.ownerId,source.ownerId);assert.deepEqual(destination.position,source.position);
  if(full){assert.notEqual(destination.id,source.id);assert.equal(source.resources.cleanWater,undefined);}else assert.equal(destination.id,source.id);
  const done=structuredClone(s);assert.throws(()=>cancelCraftSR(s));assert.deepEqual(s,done);assert.equal(s.master.activityId,null);assert.equal(Object.keys(s.reservationsById).length,0);
 }
});
