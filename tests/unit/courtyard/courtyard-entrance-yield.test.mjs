import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {requestBodyYield,meterSweep,spatialRoom,spatialAccess,tickSpatial} from '../../../src/simulation/ea-sr-spatial.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';

const copy=x=>structuredClone(x),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Finite rule fixture: a real indoor hall entrance, a holder with the test
 * station reservation and a stationless static facility waiter. The test records
 * are explicit fixture records, not a normal world run. */
function fixture(){
 let s=validateSave(copy(seed.state));
 for(const name of ['enableCourtyardTerrain','enableSectDomain'])s=dispatchCommand(s,{name,args:[]}).state;
 const master=s.master,waiter=s.personsById['person:lu-zhiwei'],building=s.buildingsById['building:yunxiu:1'];
 releaseBodyActivity(s,master);releaseBodyActivity(s,waiter);
 const room=spatialRoom(building),access=spatialAccess(building),slot={x:room.bounds.x+room.bounds.width/2,y:room.bounds.y+room.bounds.height/2};
 const holderActivity='activity:fixture-entrant',holderReservation='reservation:fixture-entrant',waiterActivity='activity:fixture-waiter';
 const installHolder=(person,activityId,reservationId)=>{
  person.activityId=activityId;
  s.activitiesById[activityId]={id:activityId,kind:'facility',personId:person.personId,action:'study',phase:'navigating',targetId:building.instanceId,slotId:`${building.instanceId}/slot:test:desk`,reservationId,startedTick:s.worldTick};
  s.reservationsById[reservationId]={id:reservationId,kind:'slot',personId:person.personId,activityId,slotId:`${building.instanceId}/slot:test:desk`,createdTick:s.worldTick};
 };
 installHolder(master,holderActivity,holderReservation);
 waiter.activityId=waiterActivity;
 s.activitiesById[waiterActivity]={id:waiterActivity,kind:'facility',personId:waiter.personId,action:'study',phase:'waiting',targetId:building.instanceId,slotId:null,reservationId:null,startedTick:s.worldTick};
 Object.assign(master.scenic,{x:access.x-2,y:access.y+3,path:[slot],goal:slot,waitingForPersonId:undefined});
 Object.assign(waiter.mind.scenic,{x:access.x-1,y:access.y+1,path:[],goal:null,waitingForPersonId:undefined});
 return {s,master,waiter,building,room,access,slot,holderActivity,holderReservation,waiterActivity};
}
function holderState(s,holderActivity){return copy(s.activitiesById[holderActivity]);}
function waitersState(s,waiterActivity){return copy(s.activitiesById[waiterActivity]);}

test('a station holder entering can request a stationless static entrance waiter to step aside',()=>{
 const {s,master,waiter,holderActivity,holderReservation,waiterActivity}=fixture();
 const holderBefore=holderState(s,holderActivity),reservationBefore=copy(s.reservationsById[holderReservation]),waiterBefore=waitersState(s,waiterActivity),scenicBefore=copy(waiter.mind.scenic),from={x:waiter.mind.scenic.x,y:waiter.mind.scenic.y};
 assert.equal(requestBodyYield(s,master.scenic,waiter,master.scenic.path),true);
 assert.equal(waiter.mind.scenic.bodyYield.kind,'entrance-clear');
 assert.deepEqual(holderState(s,holderActivity),holderBefore);
 assert.deepEqual(s.reservationsById[holderReservation],reservationBefore);
 assert.deepEqual(waitersState(s,waiterActivity),waiterBefore);
 assert.deepEqual(waiter.mind.scenic.path,scenicBefore.path);
 assert.deepEqual(waiter.mind.scenic.goal,scenicBefore.goal);
 let at=from;
 for(const point of waiter.mind.scenic.bodyYield.path){assert.equal(meterSweep(s,at,point).blocked,false);at=point;}
 tickSpatial(s);
 assert(distance(from,waiter.mind.scenic)>0&&distance(from,waiter.mind.scenic)<=.286001);
 assert.deepEqual(holderState(s,holderActivity),holderBefore);
 assert.deepEqual(s.reservationsById[holderReservation],reservationBefore);
 assert.deepEqual(waitersState(s,waiterActivity),waiterBefore);
});

test('the entrance exception is limited to a static stationless waiter on the holder route',()=>{
 for(const change of ['waiter-has-slot','holder-no-reservation','waiter-not-at-entrance','waiter-moving','blocker-is-master']){
  const {s,master,waiter,holderActivity,holderReservation,waiterActivity}=fixture();
  let from=master.scenic,blocker=waiter;
  if(change==='waiter-has-slot'){s.activitiesById[waiterActivity].slotId=`${s.buildingsById['building:yunxiu:1'].instanceId}/slot:test:desk`;s.activitiesById[waiterActivity].reservationId='reservation:fixture-waiter';}
  if(change==='holder-no-reservation')delete s.reservationsById[holderReservation];
  if(change==='waiter-not-at-entrance')Object.assign(waiter.mind.scenic,{x:20,y:30});
  if(change==='waiter-moving')waiter.mind.scenic.path=[{x:waiter.mind.scenic.x,y:waiter.mind.scenic.y-1}];
  if(change==='blocker-is-master'){
   // The master is never a body-yield blocker; move the valid entrant role to the waiter.
   const b=s.buildingsById['building:yunxiu:1'],slot={x:b?spatialRoom(b).bounds.x+spatialRoom(b).bounds.width/2:0,y:b?spatialRoom(b).bounds.y+spatialRoom(b).bounds.height/2:0};
   s.activitiesById[waiterActivity]={...s.activitiesById[waiterActivity],phase:'navigating',slotId:`${b.instanceId}/slot:test:desk`,reservationId:'reservation:fixture-waiter'};
   s.reservationsById['reservation:fixture-waiter']={id:'reservation:fixture-waiter',kind:'slot',personId:waiter.personId,activityId:waiterActivity,slotId:`${b.instanceId}/slot:test:desk`};
   Object.assign(waiter.mind.scenic,{path:[slot],goal:slot});
   s.master.activityId=waiterActivity+'-master';
   s.activitiesById[s.master.activityId]={id:s.master.activityId,kind:'facility',personId:master.personId,action:'study',phase:'waiting',targetId:b.instanceId,slotId:null,reservationId:null,startedTick:s.worldTick};
   from=waiter.mind.scenic;blocker=master;
  }
  assert.equal(requestBodyYield(s,from,blocker,from.path),false,change);
  assert.equal(blocker.mind?.scenic?.bodyYield??blocker.scenic?.bodyYield,undefined,change);
 }
});
