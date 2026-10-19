import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {requestBodyYield,meterSweep,tickSpatial} from '../../../src/simulation/ea-sr-spatial.mjs';
import {northLibraryYieldRouteClear} from '../../../src/simulation/ea-sect-domain.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
const copy=x=>structuredClone(x),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){let s=validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;const master=s.master,worker=s.personsById['person:lu-zhiwei'];releaseBodyActivity(s,master);releaseBodyActivity(s,worker);
 // Explicit body-rule fixture reproduces the measured stair bend. The ongoing
 // activity and reservation are test records; normal-world replay is external.
 const m=master.scenic,q=worker.mind.scenic;Object.assign(m,{x:34.45,y:1.9,path:[{x:34.92727272727273,y:2.32},{x:35.518181818181816,y:2.52},{x:35.81363636363636,y:2.62},{x:35.961363636363636,y:2.67},{x:36.16,y:2.72},{x:37.07666666666667,y:3.07}],waitingForPersonId:worker.personId});
 Object.assign(q,{x:34.92727272727273,y:2.32,path:[{x:34.29090909090909,y:1.76}],waitingForPersonId:master.personId});
 worker.activityId='activity:test-worker';s.activitiesById[worker.activityId]={id:worker.activityId,kind:'facility',personId:worker.personId,action:'study',phase:'waiting',slotId:'test:desk:2',reservationId:'reservation:test-worker',startedTick:s.worldTick};s.reservationsById['reservation:test-worker']={id:'reservation:test-worker',kind:'slot',personId:worker.personId,activityId:worker.activityId,slotId:'test:desk:2'};return{s,m,q,master,worker};}

test('reciprocal waiting can find a real retreat within four metres when the nearby landing has no space',()=>{
 const{s,m,q,worker}=fixture(),activity=copy(s.activitiesById[worker.activityId]),reservation=copy(s.reservationsById[activity.reservationId]),path=copy(q.path),before={x:q.x,y:q.y};
 assert(requestBodyYield(s,m,worker,m.path));assert.deepEqual(q.bodyYield.target,{x:38,y:3.5});assert(distance(before,q.bodyYield.target)>2.25&&distance(before,q.bodyYield.target)<=4);
 assert.deepEqual(s.activitiesById[worker.activityId],activity);assert.deepEqual(s.reservationsById[activity.reservationId],reservation);assert.deepEqual(q.path,path);
 let at=before;for(const point of q.bodyYield.path){assert.equal(meterSweep(s,at,point).blocked,false);at=point;}assert(northLibraryYieldRouteClear(before,q.bodyYield.path));
 tickSpatial(s);assert(distance(before,q)>0&&distance(before,q)<=.286001);assert.deepEqual(s.activitiesById[worker.activityId],activity);assert.deepEqual(s.reservationsById[activity.reservationId],reservation);assert.deepEqual(q.path,path);
});

test('the original nearby search remains preferred when the courtyard has a free landing',()=>{
 const{s,m,q,worker}=fixture();Object.assign(m,{x:28.1399,y:12.8842,path:[{x:35.83485068135691,y:28.51851851851852}]});Object.assign(q,{x:28.4089,y:13.3557,path:[{x:27.5,y:11.5}]});
 assert(requestBodyYield(s,m,worker,m.path));assert(distance(q,q.bodyYield.target)<=2.25);
});

test('a wider retreat requires both waiting links and cannot interrupt an executing activity',()=>{
 for(const boundary of ['one-way','executing']){const{s,m,q,worker}=fixture();if(boundary==='one-way')delete m.waitingForPersonId;else s.activitiesById[worker.activityId].phase='executing';const before=JSON.stringify(s);assert.equal(requestBodyYield(s,m,worker,m.path),false);assert.equal(JSON.stringify(s),before);assert.equal(q.bodyYield,undefined);}
});

test('outdoor yielding checks the entire body along the visible road instead of accepting a narrow edge',()=>{
 assert.equal(northLibraryYieldRouteClear({x:46,y:12.5},[{x:46,y:12.5}]),false);
 assert.equal(northLibraryYieldRouteClear({x:46.51848330179962,y:13.299730394948382},[{x:46.5,y:13.5}]),false);
 assert.equal(northLibraryYieldRouteClear({x:44.5,y:13},[{x:46,y:12.5}]),false);
 assert.equal(northLibraryYieldRouteClear({x:34.92727272727273,y:2.32},[{x:35.518181818181816,y:2.52},{x:36.16,y:2.72},{x:37.626666666666665,y:3.28},{x:37.94232044198895,y:3.5640883977900564},{x:38,y:3.5}]),true);
});
