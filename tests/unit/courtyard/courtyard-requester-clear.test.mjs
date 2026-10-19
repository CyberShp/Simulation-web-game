import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {tickSpatial} from '../../../src/simulation/ea-sr-spatial.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';

const copy=x=>structuredClone(x);
function fixture(){
 let s=validateSave(copy(seed.state));
 for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const master=s.master,worker=s.personsById['person:lu-zhiwei'];
 releaseBodyActivity(s,master);releaseBodyActivity(s,worker);
 const m=master.scenic,q=worker.mind.scenic;
 Object.assign(m,{x:34.45,y:1.9,path:[{x:35.2,y:2.5}],goal:{x:35.2,y:2.5}});
 Object.assign(q,{x:34.92727272727273,y:2.32,path:[],goal:null});
 master.activityId='activity:test-master';
 s.activitiesById[master.activityId]={id:master.activityId,kind:'facility',personId:master.personId,action:'study',phase:'waiting',slotId:'test:desk:1',reservationId:'reservation:test-master',startedTick:s.worldTick};
 s.reservationsById['reservation:test-master']={id:'reservation:test-master',kind:'slot',personId:master.personId,activityId:master.activityId,slotId:'test:desk:1'};
 worker.activityId='activity:test-worker';
 s.activitiesById[worker.activityId]={id:worker.activityId,kind:'facility',personId:worker.personId,action:'study',phase:'waiting',slotId:'test:desk:2',reservationId:'reservation:test-worker',startedTick:s.worldTick};
 s.reservationsById['reservation:test-worker']={id:'reservation:test-worker',kind:'slot',personId:worker.personId,activityId:worker.activityId,slotId:'test:desk:2'};
 return {s,master,worker,m,q};
}

test('a mutual-corridor step blocked by the requester body creates one bounded requester-clear retreat',()=>{
 const {s,master,worker,m,q}=fixture();
 const masterActivity=copy(s.activitiesById[master.activityId]),workerActivity=copy(s.activitiesById[worker.activityId]),masterReservation=copy(s.reservationsById['reservation:test-master']),workerReservation=copy(s.reservationsById['reservation:test-worker']);
 m.bodyYield={kind:'mutual-corridor',requestedBy:worker.personId,startedTick:s.worldTick,target:{x:35.2,y:2.5},path:[{x:35.2,y:2.5}]};
 const before={master:{x:m.x,y:m.y},worker:{x:q.x,y:q.y}};
 tickSpatial(s);
 assert.equal(q.bodyYield?.kind,'requester-clear');
 assert.equal(m.bodyYield?.requesterClearTried,true);
 assert.deepEqual(s.activitiesById[master.activityId],masterActivity);
 assert.deepEqual(s.activitiesById[worker.activityId],workerActivity);
 assert.deepEqual(s.reservationsById['reservation:test-master'],masterReservation);
 assert.deepEqual(s.reservationsById['reservation:test-worker'],workerReservation);
 const retreat=copy(q.bodyYield.target),retreatPath=copy(q.bodyYield.path);
 assert(retreatPath.length>=1);
 assert.equal(q.bodyYield.requestedBy,master.personId);
 // One retreat only; the next tick must not repeat the search or change the target.
 tickSpatial(s);
 assert.deepEqual(q.bodyYield?.target??retreat,retreat);
 assert.equal(m.bodyYield?.requesterClearTried,true);
 // The worker (requester) actually leaves the blocked step corridor; the master's yield then advances.
 assert(Math.hypot(q.x-before.worker.x,q.y-before.worker.y)>0.001);
 for(let i=0;i<6;i++)tickSpatial(s);
 assert(Math.hypot(m.x-before.master.x,m.y-before.master.y)>0.001);
 assert.deepEqual(s.activitiesById[master.activityId],masterActivity);
 assert.deepEqual(s.activitiesById[worker.activityId],workerActivity);
 assert.deepEqual(s.reservationsById['reservation:test-worker'],workerReservation);
});

test('the master is never auto-moved as a requester; no legal search means the yield stays blocked',()=>{
 const {s,master,worker,m,q}=fixture();
 const masterActivity=copy(s.activitiesById[master.activityId]),workerActivity=copy(s.activitiesById[worker.activityId]);
 q.bodyYield={kind:'mutual-corridor',requestedBy:master.personId,startedTick:s.worldTick,target:{x:34.29,y:1.76},path:[{x:34.29,y:1.76}]};
 const masterBefore={x:m.x,y:m.y};
 tickSpatial(s);
 assert.equal(m.bodyYield,undefined);
 assert.deepEqual({x:m.x,y:m.y},masterBefore);
 assert.equal(q.bodyYield?.requesterClearTried,true);
 assert.deepEqual(s.activitiesById[master.activityId],masterActivity);
 assert.deepEqual(s.activitiesById[worker.activityId],workerActivity);
});
