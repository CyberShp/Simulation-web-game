import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourtyardRoutePlanner} from '../../../apps/courtyard/courtyard-route-planner.mjs';
import {planCourtyardRoute} from '../../../apps/courtyard/courtyard-route-worker.mjs';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {toArt,toWorld,artSegmentClear} from '../../../apps/courtyard/courtyard-space.mjs';
import {meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(){
 let clock=10;const workers=[];
 const planner=createCourtyardRoutePlanner({now:()=>++clock,createWorker:()=>{
  const worker={messages:[],terminated:false,postMessage(value){this.messages.push(structuredClone(value));},terminate(){this.terminated=true;},reply(value){this.onmessage?.({data:value});},error(message){this.onerror?.({message,preventDefault(){}});},messageError(message){this.onmessageerror?.({message,preventDefault(){}});}};
  workers.push(worker);return worker;
 }});
 const input={state:{worldTick:70,personsById:{master:{x:3,y:4}}},from:{x:3,y:4},to:{x:10,y:11},options:{residences:true}};
 const reply=(worker,extra={})=>worker.reply({requestId:worker.messages.at(-1).requestId,ok:true,route:[{x:10,y:11}],samples:[{x:5,y:6}],workerDurationMs:12,...extra});
 return {planner,workers,input,reply};
}

test('a replacement settles the old request and only the latest worker may deliver a plan',async()=>{
 const {planner,workers,input,reply}=fixture(),old=planner.plan(input),oldId=planner.status().requestId,current=planner.plan({...input,to:{x:20,y:21}}),id=planner.status().requestId;
 assert.deepEqual(await old,{ok:false,cancelled:true,requestId:oldId,error:'已改为新的行动。'});assert(workers[0].terminated);assert.equal(planner.isCurrent(oldId),false);
 reply(workers[0]);assert.equal(planner.status().status,'pending');reply(workers[1]);const result=await current;
 assert(result.ok);assert.equal(result.requestId,id);assert.equal(planner.status().status,'planned');assert.equal(planner.mark(oldId,'accepted'),false);assert(planner.mark(id,'accepted',{acceptedAt:100}));assert.equal(planner.status().acceptedAt,100);
});

test('a terminated worker error cannot reject or terminate a newer request',async()=>{
 const {planner,workers,input,reply}=fixture(),old=planner.plan(input),current=planner.plan(input);await old;
 workers[0].error('late old error');workers[0].messageError('late old clone failure');assert.equal(planner.status().status,'pending');assert.equal(workers[1].terminated,false);
 reply(workers[1]);assert((await current).ok);
});

for(const reason of ['读档更换世界。','正在关闭窗口。','掌门已接受新的行动。'])test(`explicit invalidation settles the request: ${reason}`,async()=>{
 const {planner,workers,input,reply}=fixture(),pending=planner.plan(input),id=planner.status().requestId;planner.invalidate(reason);const value=await pending;
 assert.equal(value.ok,false);assert.equal(value.cancelled,true);assert.equal(value.error,reason);assert(workers[0].terminated);reply(workers[0]);assert.equal(planner.isCurrent(id),false);assert.equal(planner.mark(id,'accepted'),false);assert.equal(planner.status().status,'cancelled');
});

test('an already planned result loses commit authority when invalidated',async()=>{
 const {planner,workers,input,reply}=fixture(),pending=planner.plan(input),id=planner.status().requestId;reply(workers[0]);assert((await pending).ok);assert(planner.isCurrent(id));planner.invalidate('已恢复另一个存档。');assert.equal(planner.isCurrent(id),false);assert.equal(planner.mark(id,'accepted'),false);
});

test('current worker errors, message errors and postMessage failures settle without an unhandled rejection',async()=>{
 for(const kind of ['error','messageError']){
  const {planner,workers,input,reply}=fixture(),pending=planner.plan(input);workers[0][kind]('unavailable');const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/unavailable/);assert(workers[0].terminated);
  const retry=planner.plan(input);reply(workers[1]);assert((await retry).ok);
 }
 const planner=createCourtyardRoutePlanner({createWorker:()=>({terminate(){},postMessage(){throw Error('cannot clone');}})});const failed=await planner.plan({});assert.equal(failed.ok,false);assert.match(failed.error,/cannot clone/);
});

test('status reads and transferred inputs cannot mutate planner authority or the caller world',async()=>{
 const {planner,workers,input,reply}=fixture(),before=structuredClone(input),pending=planner.plan(input);input.state.worldTick++;
 assert.deepEqual(workers[0].messages[0].payload,before,'the Worker receives its own structured snapshot');const status=planner.status();status.requestId=999;status.status='accepted';assert.equal(planner.status().status,'pending');assert.equal(planner.mark(999,'accepted'),false);
 reply(workers[0]);assert((await pending).ok);assert.equal(input.state.worldTick,before.state.worldTick+1);planner.dispose();assert(workers[0].terminated);
});

test('the raw Worker clone keeps real building-wall routing rather than just terrain centres',()=>{
 const state=createSectSession().state,from={x:23,y:26},to={x:37,y:26},options={terrain:true,domain:true,residences:true};
 // Isolated collision fixture: a completed room crosses otherwise open painted
 // paving. This verifies transferred building facts, not normal construction.
 state.buildingsById['building:yunxiu:99']={...state.buildings[0],id:99,instanceId:'building:yunxiu:99',transform:{x:24,y:24,orientation:'south'}};
 assert(artSegmentClear(toArt(from.x,from.y),toArt(to.x,to.y),options));assert(meterSweep(state,from,to).blocked);
 const raw=structuredClone(state),before=JSON.stringify(raw),payload={state:raw,from:toArt(from.x,from.y),to:toArt(to.x,to.y),options};assert.equal(raw.buildings,undefined);
 const actual=planCourtyardRoute(payload);assert(actual.ok);assert.equal(JSON.stringify(raw),before,'hydrating a Worker copy preserves every canonical save field');
 let previous=from;for(const point of actual.route){const next=toWorld(point.x,point.y);assert.equal(meterSweep(state,previous,next).blocked,false);previous=next;}
 const absent=structuredClone(state);delete absent.buildingsById['building:yunxiu:99'];const unsafe=planCourtyardRoute({...payload,state:absent});assert(unsafe.ok);assert.notDeepEqual(actual.route,unsafe.route);
 let cutWall=false;previous=from;for(const point of unsafe.route){const next=toWorld(point.x,point.y);cutWall ||= meterSweep(state,previous,next).blocked;previous=next;}assert(cutWall,'the fixture detects an actual route through the omitted building wall');
});

const main=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-main.mjs',import.meta.url),'utf8');
function mainFixture(gatewayResult={ok:true,commandId:'command:9',waypoint:{world:{x:8,y:9},tick:70}}){
 const f=fixture(),calls=[],elements=new Map(),context={approachPlanner:f.planner,session:{state:{worldTick:70,revision:5,master:{activityId:null,scenic:{x:3,y:4}},activitiesById:{},geometryRevision:1}},options:{residences:true},renderer:{mode:'local',reference:false,target:{x:90,y:91}},closing:false,importing:false,
  performance:{now:()=>20},persistence:{status:()=>({protected:false})},toArt:(x,y)=>({x,y}),geometryRevision:s=>s.geometryRevision,
  $:id=>{if(!elements.has(id))elements.set(id,{hidden:false});return elements.get(id);},notice(){},syncPause(){},refresh(){},issue(){throw Error('only the live movement gateway may issue');},
  commandMovementWaypoint:(session,point,options,intermediate,issue)=>{calls.push({session,point,options,intermediate,issue,from:structuredClone(session.state.master.scenic)});if(gatewayResult instanceof Error)throw gatewayResult;return structuredClone(gatewayResult);},structuredClone};
 context.master=()=>({...context.session.state.master.scenic,indoor:false});context.routeOptions=()=>({...context.options});
 const begin=main.indexOf('const approachBodyOwner='),end=main.indexOf('\nfunction nextWaypoint',begin);assert(begin>=0&&end>begin);
 const api=vm.runInNewContext(`let route=[{x:90,y:91}],activeWaypoint={world:{x:80,y:81},tick:60},destination={x:70,y:71},routeFailure='old-route-detail',routeSteps=2,pendingApproach='old-person';${main.slice(begin,end)};({planApproach,routeState:()=>JSON.stringify({route,activeWaypoint,destination,routeFailure,routeSteps,pendingApproach,rendererTarget:renderer.target})})`,context);
 return {...f,context,calls,api};
}

test('the actual main adapter retains the committed route for Worker failure and first-command refusal',async()=>{
 for(const gateway of [{ok:false,error:'live path blocked'},new Error('live path failed')]){
  const f=mainFixture(gateway),before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});assert.equal(f.api.routeState(),before,'a pending plan does not replace the old route');f.reply(f.workers[0]);const result=await pending;
  assert.equal(result.ok,false);assert.equal(f.calls.length,1);assert.equal(f.api.routeState(),before);
 }
 const f=mainFixture(),before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});f.reply(f.workers[0],{ok:false,error:'worker found no route'});assert.equal((await pending).ok,false);assert.equal(f.calls.length,0);assert.equal(f.api.routeState(),before);
});

test('the actual main adapter rejects changed world, geometry, body ownership and closing before any command',async()=>{
 for(const alter of [f=>f.context.session=structuredClone(f.context.session),f=>f.context.session.state.geometryRevision++,f=>{const s=f.context.session.state;s.master.activityId='activity:new';s.activitiesById['activity:new']={startedTick:71};},f=>f.context.closing=true,f=>f.context.importing=true,f=>f.context.options.residences=false]){
  const f=mainFixture(),before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});alter(f);f.reply(f.workers[0]);assert.equal((await pending).ok,false);assert.equal(f.calls.length,0);assert.equal(f.api.routeState(),before);
 }
});

test('world time and moving feet use the live formal gateway, then atomically replace only a successful route',async()=>{
 const f=mainFixture(),before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});const sent=f.workers[0].messages[0].payload;
 f.context.session.state.worldTick=78;f.context.session.state.revision=13;Object.assign(f.context.session.state.master.scenic,{x:6,y:7});assert.equal(f.api.routeState(),before);
 f.reply(f.workers[0],{route:[{x:8,y:9},{x:10,y:11}]});assert((await pending).ok);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].from,{x:6,y:7});assert.deepEqual(sent.from,{x:3,y:4});assert.equal(f.calls[0].session,f.context.session);assert.equal(f.calls[0].issue,f.context.issue);
 const after=JSON.parse(f.api.routeState());assert.deepEqual(after.route,[{x:10,y:11}]);assert.deepEqual(after.activeWaypoint.world,{x:8,y:9});assert.deepEqual(after.destination,{x:10,y:11});assert.equal(after.routeSteps,3);assert.equal(after.routeFailure,null);
});

test('superseding the actual main request never commits the older target',async()=>{
 const f=mainFixture(),before=f.api.routeState(),old=f.api.planApproach({x:10,y:11}),current=f.api.planApproach({x:20,y:21});assert.equal((await old).cancelled,true);f.reply(f.workers[0]);assert.equal(f.calls.length,0);assert.equal(f.api.routeState(),before);
 f.reply(f.workers[1],{route:[{x:20,y:21}]});assert((await current).ok);assert.equal(f.calls.length,1);assert.deepEqual(JSON.parse(f.api.routeState()).destination,{x:20,y:21});
});

test('an invalid replacement target still revokes the earlier main request without clearing its old route',async()=>{
 const f=mainFixture(),before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});assert.equal((await f.api.planApproach({x:NaN,y:11})).ok,false);assert.equal((await pending).cancelled,true);
 f.reply(f.workers[0]);assert.equal(f.calls.length,0);assert.equal(f.api.routeState(),before);
});

for(const kind of ['transport','cultivation'])test(`the actual main adapter rechecks ${kind} cancellation terms after background planning`,async()=>{
 const f=mainFixture(),s=f.context.session.state,id='activity:existing',orderId='order:existing';s.master.activityId=id;
 s.activitiesById[id]={id,personId:'person:master',kind:'sr-'+kind,startedTick:70,...(kind==='transport'?{workOrderId:orderId}:{orderId,phase:'moving'})};
 s.workOrdersById={[orderId]:{id:orderId,phase:'to-source'}};s.srCultivation={orders:{[orderId]:{id:orderId,phase:'reserved',consumed:false,refineStarted:false}}};
 const before=f.api.routeState(),pending=f.api.planApproach({x:10,y:11});
 // Identity, activity epoch and order ID stay unchanged while the running
 // world crosses from fully refundable preparation to a confirmed interruption.
 if(kind==='transport')s.workOrdersById[orderId].phase='carrying';
 else{s.srCultivation.orders[orderId].consumed=true;s.srCultivation.orders[orderId].refineStarted=true;}
 f.reply(f.workers[0]);assert.equal((await pending).ok,false,'changed cancellation terms need a new public review');assert.equal(f.calls.length,0);assert.equal(f.api.routeState(),before);
});
