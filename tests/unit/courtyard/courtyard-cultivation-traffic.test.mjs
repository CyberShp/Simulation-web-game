import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {requestBodyYield,tickSpatial,meterDoorPermit,meterSweep,visibleBodyRouteClear} from '../../../src/simulation/ea-sr-spatial.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';
import {readyAtWorkstation} from '../../../src/simulation/ea-sr-equipment.mjs';
import {facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
const copy=structuredClone;

// Explicit ownership fixture on the measured stair bend. The ordinary-save
// breakthrough and transport replay is retained separately as acceptance data.
function fixture(){
 let s=validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const master=s.master,worker=s.personsById['person:lu-zhiwei'];releaseBodyActivity(s,master);releaseBodyActivity(s,worker);
 const m=master.scenic,q=worker.mind.scenic;
 Object.assign(m,{x:34.45,y:1.9,path:[{x:34.92727272727273,y:2.32},{x:35.518181818181816,y:2.52},{x:35.81363636363636,y:2.62},{x:36.16,y:2.72},{x:37.07666666666667,y:3.07}],waitingForPersonId:worker.personId});
 Object.assign(q,{x:34.92727272727273,y:2.32,path:[{x:34.29090909090909,y:1.76}],goal:{x:34.29090909090909,y:1.76},waitingForPersonId:master.personId});
 const activity={id:'activity:test-breakthrough',kind:'sr-cultivation',personId:worker.personId,orderId:'order:test-breakthrough',phase:'moving',startedTick:s.worldTick,reservationId:'reservation:test-breakthrough',slotId:'test:mat:1'};
 const order={id:activity.orderId,kind:'breakthrough',personId:worker.personId,phase:'reserved',progressTicks:0,cost:{jade:24,herb:8},consumed:false};
 const reservation={id:activity.reservationId,kind:'sr-slot',personId:worker.personId,activityId:activity.id,slotId:activity.slotId};
 worker.activityId=activity.id;s.activitiesById[activity.id]=activity;s.srCultivation.orders[order.id]=order;s.reservationsById[reservation.id]=reservation;s.speed=1;
 return {s,m,q,worker,activity,order,reservation};
}

test('an owned travelling breakthrough yields physically while retaining order, costs and station',()=>{
 const {s,m,q,worker,activity,order,reservation}=fixture(),owned=copy({activity,order,reservation}),originalRoute=copy(q.path),from={x:q.x,y:q.y};
 assert(requestBodyYield(s,m,worker,m.path));assert.equal(q.bodyYield.kind,'mutual-corridor');assert(visibleBodyRouteClear(s,q,q.bodyYield.path));
 const path=copy(q.bodyYield.path);let previous=from;for(const point of path){assert.equal(meterSweep(s,previous,point).blocked,false);previous=point;}
 // readyAtWorkstation uses this same public movement gate each world step.
 advanceScenic(q,4.6,s);assert.deepEqual({x:q.x,y:q.y},from,'original station route waits during the temporary yield');
 let moved=false;for(let n=0;n<160&&q.bodyYield;n++){s.worldTick++;const before={x:q.x,y:q.y};tickSpatial(s);const delta=Math.hypot(q.x-before.x,q.y-before.y);assert(delta<.3);moved ||= delta>0;}
 assert(moved);assert.equal(q.bodyYield,undefined,'the temporary gate ends with the actual side step');
 assert.deepEqual({activity:s.activitiesById[worker.activityId],order:s.srCultivation.orders[order.id],reservation:s.reservationsById[reservation.id]},owned);assert.deepEqual(q.path,originalRoute);
 assert.equal(meterDoorPermit(s,q,q,[{x:q.x+.01,y:q.y}],{x:q.x+.01,y:q.y}),true,'the unchanged original activity regains movement permission');
});

test('terminal, executing and unowned cultivation bodies cannot acquire temporary yielding',()=>{
 for(const boundary of ['missing-order','terminal-order','executing-body','identity','activity-owner','reservation-owner','reservation-slot','wrong-kind','already-progressed']){
  const {s,m,q,worker,activity,order,reservation}=fixture();
  if(boundary==='missing-order')delete s.srCultivation.orders[order.id];
  if(boundary==='terminal-order')order.phase='completed';
  if(boundary==='executing-body')activity.phase='executing';
  if(boundary==='identity')order.personId='person:master';
  if(boundary==='activity-owner')activity.personId='person:master';
  if(boundary==='reservation-owner')reservation.personId='person:master';
  if(boundary==='reservation-slot')reservation.slotId='test:mat:2';
  if(boundary==='wrong-kind')order.kind='study';
  if(boundary==='already-progressed')order.progressTicks=1;
  const before=JSON.stringify(s);assert.equal(requestBodyYield(s,m,worker,m.path),false,boundary);assert.equal(q.bodyYield,undefined,boundary);assert.equal(JSON.stringify(s),before,boundary);
 }
});

function mixedFixture(){
 const f=fixture(),{s,m,q,worker,activity,order,reservation}=f;
 // Use the measured passing place and the same owned breakthrough as the
 // first fixture, now approaching an opposing, reserved cargo carrier.
 delete s.activitiesById[worker.activityId];delete worker.activityId;
 const p=s.master;p.activityId=activity.id;activity.personId=p.personId;order.personId=p.personId;reservation.personId=p.personId;
 Object.assign(m,{x:49.36409515638936,y:12.236074289732818,path:[{x:47.093333333333334,y:12.42391304347826},{x:45.02196078431373,y:12.926470588235293}],goal:{x:45.02196078431373,y:12.926470588235293},waitingForPersonId:worker.personId});
 Object.assign(q,{x:48.673984586994415,y:12.29316064198056,path:[{x:50.72,y:12.123913043478261},{x:57,y:31},{x:65,y:31}],goal:{x:65,y:31},waitingForPersonId:p.personId});
 s.activitiesById[activity.id]=activity;
 const cargo={id:'work:test-cargo',kind:'transport',phase:'to-source',carrierId:worker.personId,sourceStockpileId:'stockpile:test-source',targetStockpileId:'stockpile:yunxiu',reservationId:'reservation:test-cargo'};
 worker.activityId='activity:test-cargo';s.activitiesById[worker.activityId]={id:worker.activityId,kind:'sr-transport',personId:worker.personId,workOrderId:cargo.id};s.workOrdersById[cargo.id]=cargo;s.stockpilesById[cargo.sourceStockpileId]={id:cargo.sourceStockpileId,resources:{food:3}};s.reservationsById[cargo.reservationId]={id:cargo.reservationId,kind:'transport-cargo',workOrderId:cargo.id,sourceStockpileId:cargo.sourceStockpileId,cost:{food:3}};
 for(const [i,x,y]of [[0,47.11287667738951,12.422296406561848],[1,46.718333333333334,12.010865989702518],[2,45.89333333333333,11.184068278805121]]){const id='person:queue:'+i,body=copy(worker);body.personId=id;body.id=id;body.activityId=null;body.mind.scenic={x,y,path:[]};body.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x,y};s.personsById[id]=body;s.homeMemberIds.push(id);}
 m.revision=geometryRevision(s);q.revision=geometryRevision(s);return {...f,p,cargo};
}

test('an owned breakthrough can take the existing measured retreat opposite reserved transport',()=>{
 const {s,m,q,worker,p,activity,order,reservation,cargo}=mixedFixture(),owned=copy({activity,order,reservation,cargo}),goal=copy(m.goal);
 assert(requestBodyYield(s,m,worker,m.path));assert.equal(m.bodyYield?.kind,'transport-retreat');assert.equal(m.bodyYield.orderId,order.id);assert.equal(m.bodyYield.activityId,activity.id);assert(visibleBodyRouteClear(s,m,m.bodyYield.path));
 const from={x:m.x,y:m.y};advanceScenic(m,4.6,s);assert.deepEqual({x:m.x,y:m.y},from,'station travel cannot compete with its temporary retreat');
 for(let n=0;n<12;n++){s.worldTick++;const old={x:m.x,y:m.y};tickSpatial(s);assert(Math.hypot(m.x-old.x,m.y-old.y)<.3);}
 assert.notDeepEqual({x:m.x,y:m.y},from);assert.deepEqual({activity,order,reservation,cargo},owned);assert.deepEqual(m.goal,goal);assert.equal(p.activityId,activity.id);assert.equal(q.waitingForPersonId,p.personId);
});

test('a breakthrough retreat loses control when its owning order becomes invalid',()=>{
 const {s,m,worker,order}=mixedFixture();assert(requestBodyYield(s,m,worker,m.path));assert.equal(m.bodyYield.kind,'transport-retreat');order.phase='completed';s.worldTick++;tickSpatial(s);assert.equal(m.bodyYield,undefined);
});

test('an owned temporary yield cannot enter the station, even with an empty return path at the mat',()=>{
 for(const kind of ['mutual-corridor','transport-retreat','requester-clear']){
  const {s,q,worker,activity,order,reservation}=fixture(),hall=s.buildings.find(b=>b.type==='hall'),slot=facilitySlots(s,hall,'cultivate')[0];
  order.parameters={};activity.slotId=slot.id;reservation.slotId=slot.id;Object.assign(q,slot.position);q.path=[];q.goal={...slot.position};q.bodyYield={kind,activityId:activity.id,orderId:order.id,path:[],requestedBy:s.master.personId,startedTick:s.worldTick};
  const before=copy({activity,order,reservation,position:{x:q.x,y:q.y}});
  assert.equal(readyAtWorkstation(s,worker,order),false,kind);assert.equal(order.progressTicks,0);assert.equal(activity.phase,'moving');assert.deepEqual({activity,reservation,position:{x:q.x,y:q.y}},{activity:before.activity,reservation:before.reservation,position:before.position});
  delete q.bodyYield;assert.equal(readyAtWorkstation(s,worker,order),true,kind+' releases the same station');
 }
});
