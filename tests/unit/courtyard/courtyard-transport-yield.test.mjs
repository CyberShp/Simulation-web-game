import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {requestBodyYield,tickSpatial,visibleBodyRouteClear,meterSweep,meterBodyBlocker} from '../../../src/simulation/ea-sr-spatial.mjs';
import {startTransport,tickEconomy,cancelTransport} from '../../../src/simulation/ea-sr-economy.mjs';

function fixture(){
 let s=validateSave(structuredClone(seed.state));
 for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableEastResidences','enableEastServices','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const master=s.master,npc=s.personsById['person:lu-zhiwei'],m=master.scenic,q=npc.mind.scenic,home=s.stockpilesById['stockpile:yunxiu'];
 for(const [id,x,y]of [['stockpile:yield-source',65,31],['stockpile:yield-target',45.02196078431373,12.926470588235293]]){
  s.stockpilesById[id]={...structuredClone(home),id,capacity:10000,buildingId:undefined,position:{sceneId:'scene:yunxiu-courtyard',x,y},resources:Object.fromEntries(Object.keys(home.resources).map(k=>[k,k==='food'?40:0]))};
 }
 for(const p of [master,npc]){if(p.activityId){const a=s.activitiesById[p.activityId];delete s.reservationsById[a.reservationId];delete s.activitiesById[p.activityId];p.activityId=null;}p.energy=60;}
 const masterOrder=startTransport(s,'stockpile:yield-source','stockpile:yield-target',master.personId,{food:10}).id;
 const npcOrder=startTransport(s,'stockpile:yield-source','stockpile:yield-target',npc.personId,{food:10}).id;
 s.workOrdersById[masterOrder].phase='carrying';
 Object.assign(m,{x:49.36409515638936,y:12.236074289732818,path:[{x:47.093333333333334,y:12.42391304347826},{x:45.02196078431373,y:12.926470588235293}],goal:{x:45.02196078431373,y:12.926470588235293},waitingForPersonId:npc.personId});
 Object.assign(q,{x:48.673984586994415,y:12.29316064198056,path:[{x:50.72,y:12.123913043478261},{x:57,y:31},{x:65,y:31}],goal:{x:65,y:31},waitingForPersonId:master.personId});
 for(const p of [master,npc]){const at=p===master?m:q;p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:at.x,y:at.y};}
 s.speed=1;return{s,master,npc,m,q,masterOrder,npcOrder};
}

test('reciprocal transport traffic takes a real measured yield without changing its cargo or orders',()=>{
 const {s,m,q,npc,masterOrder,npcOrder}=fixture(),before=structuredClone({orders:[s.workOrdersById[masterOrder],s.workOrdersById[npcOrder]],reservations:s.reservationsById});
 assert(requestBodyYield(s,m,npc,m.path));const yielding=m.bodyYield?m:q,y=yielding.bodyYield;
 assert(visibleBodyRouteClear(s,yielding,y.path));let from=yielding;
 for(const to of y.path){assert(!meterSweep(s,from,to).blocked);assert(!meterBodyBlocker(s,yielding,from,to));from=to;}
 const original={x:yielding.x,y:yielding.y};s.worldTick++;tickSpatial(s);
 assert(Math.hypot(yielding.x-original.x,yielding.y-original.y)>0);
 assert.deepEqual({orders:[s.workOrdersById[masterOrder],s.workOrdersById[npcOrder]],reservations:s.reservationsById},before);
});

test('an exhausted local carrier waits at the existing standing recovery rate without moving or changing cargo',()=>{
 const {s,npc,q,npcOrder}=fixture();npc.energy=0;const before=structuredClone({q,order:s.workOrdersById[npcOrder],reservations:s.reservationsById});
 s.worldTick++;tickEconomy(s);assert.equal(npc.energy,.03);assert.equal(q.x,before.q.x);assert.equal(q.y,before.q.y);
 assert.deepEqual(s.workOrdersById[npcOrder].cargo,before.order.cargo);assert.deepEqual(s.reservationsById,before.reservations);
 tickEconomy(s);assert.equal(npc.energy,.03);
});

test('a blocked transport that takes no physical step spends no walking energy',()=>{
 const {s,m,q,master,masterOrder}=fixture();delete q.waitingForPersonId;
 const before={x:m.x,y:m.y,energy:master.energy,cargo:structuredClone(s.workOrdersById[masterOrder].cargo)};
 s.worldTick++;tickEconomy(s);
 assert.equal(m.x,before.x);assert.equal(m.y,before.y);assert.equal(master.energy,before.energy);
 assert.deepEqual(s.workOrdersById[masterOrder].cargo,before.cargo);assert.equal(s.workOrdersById[masterOrder].phase,'carrying');
});

test('a transport that moves across the energy threshold cannot also recover in the same tick',()=>{
 const {s,m,q,npc,master}=fixture();assert(requestBodyYield(s,m,npc,m.path));const yielding=m.bodyYield?master:npc,at=yielding===master?m:q;
 yielding.energy=5;const before={x:at.x,y:at.y};s.worldTick++;tickSpatial(s);
 assert(Math.hypot(at.x-before.x,at.y-before.y)>0);assert.equal(yielding.energy,4.99);
 tickEconomy(s);assert.equal(yielding.energy,4.99);tickEconomy(s);assert.equal(yielding.energy,4.99);
});

test('an active transport yield survives read-only save validation with its original ownership',()=>{
 const {s,m,npc}=fixture();assert(requestBodyYield(s,m,npc,m.path));const serialized=JSON.stringify(s),loaded=validateSave(JSON.parse(serialized)),before=JSON.stringify(loaded);
 assert.equal(JSON.stringify(s),serialized);assert.equal(JSON.stringify(validateSave(JSON.parse(before))),before);
});

test('cancelling a yielding transport returns uncollected goods or drops carried goods at the real feet',()=>{
 for(const phase of ['to-source','carrying']){
  const {s,m,q,master,masterOrder}=fixture(),w=s.workOrdersById[masterOrder];w.phase=phase;
  m.bodyYield={kind:'transport-retreat',requestedBy:'person:lu-zhiwei',activityId:master.activityId,workOrderId:w.id,startedTick:s.worldTick,target:{x:m.x,y:m.y},path:[],returnPrefixLength:1,returnPath:[{x:m.x,y:m.y},...m.path]};
  const original={x:m.x,y:m.y},sourceAmount=s.stockpilesById[w.sourceStockpileId].resources.food;
  cancelTransport(s,w.id);assert.equal(m.bodyYield,undefined);assert.equal(w.phase,'cancelled');assert.equal(s.reservationsById[w.reservationId],undefined);
  if(phase==='to-source')assert.equal(s.stockpilesById[w.sourceStockpileId].resources.food,sourceAmount+10);
  else {const dropped=s.stockpilesById[w.returnedTo];assert.equal(dropped.resources.food,10);assert.equal(dropped.position.x,original.x);assert.equal(dropped.position.y,original.y);}
  assert.doesNotThrow(()=>validateSave(JSON.parse(JSON.stringify(s))));
 }
});

test('a facility follower clears a reciprocal transport retreat through at most eight metres of real walking',()=>{
 const {s,m,q,master,npc,npcOrder}=fixture();cancelTransport(s,npcOrder);
 const activityId='activity:yield-following-rest',slotId='building:yunxiu:1/slot:bed:1',reservationId='reservation:yield-following-rest';
 Object.assign(m,{x:-37.75518080051454,y:36.425368860032954,path:[{x:-36.29732794,y:35.77777778}],goal:{x:-36.29732794,y:35.77777778},waitingForPersonId:'person:opposing-carrier'});
 Object.assign(q,{x:-38.92697301724525,y:36.918379031648826,path:[{x:-38.14366765,y:36.59793814},{x:-36.29732794,y:35.77777778}],goal:{x:24.95,y:7},waitingForPersonId:master.personId});
 npc.activityId=activityId;npc.mind.activity='rest';s.activitiesById[activityId]={id:activityId,kind:'facility',personId:npc.personId,action:'rest',phase:'navigating',targetId:'building:yunxiu:1',slotId,reservationId};s.reservationsById[reservationId]={id:reservationId,kind:'slot',activityId,personId:npc.personId,slotId};
 const route=[{x:-38.14366765,y:36.59793814},{x:-39.90771192,y:37.31958763},{x:-41.29838606,y:37.64948454},{x:-42.72544147,y:37.97938144},{x:-42.10515307,y:37.96563574},{x:-41.48554007,y:37.95189003},{x:-40.86660137,y:37.93814433},{x:-41.50702179,y:38.50515464},{x:-42.1775423,y:39.07216495},{x:-42.88033605,y:39.63917526}];
 const before=structuredClone({activity:s.activitiesById[activityId],reservation:s.reservationsById[reservationId],path:q.path,goal:q.goal});
 assert(requestBodyYield(s,m,npc,route));const y=q.bodyYield;assert.equal(y.kind,'mutual-corridor');
 const length=y.path.reduce((sum,to,i)=>{const from=i?y.path[i-1]:q;return sum+Math.hypot(to.x-from.x,to.y-from.y);},0);
 assert(length>4,JSON.stringify({length,target:y.target,path:y.path}));assert(length<=8);assert(visibleBodyRouteClear(s,q,y.path));
 assert.deepEqual({activity:s.activitiesById[activityId],reservation:s.reservationsById[reservationId],path:q.path,goal:q.goal},before);
});
