import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSectSession,commandSect,snapshotSect} from '../../../apps/courtyard/sect-sim.mjs';
import {routeArt,REVIEW_POINTS} from '../../../apps/courtyard/courtyard-space.mjs';
import {residentialMovementWaypoints} from '../../../apps/courtyard/courtyard-navigation.mjs';
import {planCourtyardRoute} from '../../../apps/courtyard/courtyard-route-worker.mjs';

function fixture(){const session=createSectSession();assert(commandSect(session,{type:'enable-courtyard-terrain'}).ok);return{state:session.state,from:REVIEW_POINTS.courtyard.art,to:REVIEW_POINTS.eastPath.art,options:{terrain:true,domain:false,west:false,residences:true}};}
function thread(){const url=new URL('../../../apps/courtyard/courtyard-route-worker.mjs',import.meta.url).href;return new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:value=>parentPort.postMessage(value)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});}
const receive=worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});

test('canonical worker input restores only derived accessors and keeps the same physical route without changing facts',()=>{
 const payload=fixture(),raw=structuredClone(payload),before=JSON.stringify(raw.state);
 assert.equal(raw.state.master,undefined);assert.equal(raw.state.buildings,undefined);
 const samples=routeArt(payload.from,payload.to,payload.options),route=residentialMovementWaypoints(payload.state,payload.from,samples,payload.options),result=planCourtyardRoute(raw);
 assert(result.ok);assert.deepEqual(result.samples,samples);assert.deepEqual(result.route,route);assert.equal(JSON.stringify(raw.state),before);assert.equal(raw.state.master.personId,'person:master');assert.equal(raw.state.buildings.length,Object.keys(raw.state.buildingsById).length);
});

test('actual independent worker transport returns the same route and reports failures without a command or clock',async()=>{
 const worker=thread();try{
  assert((await receive(worker)).ready);const payload=fixture(),before=JSON.stringify(payload.state),answer=receive(worker);worker.postMessage({requestId:1,payload});const result=await answer,expected=planCourtyardRoute(structuredClone(payload));
  assert.equal(result.requestId,1);assert(result.ok);assert.deepEqual(result.route,expected.route);assert.deepEqual(result.samples,expected.samples);assert.equal(JSON.stringify(payload.state),before);assert(Number.isFinite(result.workerDurationMs));
  const failed=receive(worker);worker.postMessage({requestId:2,payload:{...payload,state:null}});const error=await failed;assert.equal(error.requestId,2);assert.equal(error.ok,false);assert.match(error.error,/路线规划未完成/);
 }finally{await worker.terminate();}
});
