import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {advanceMasterFreeWalk} from '../../../src/simulation/ea-sim.mjs';
import {tickSpatial,requestBodyYield,meterSweep,visibleBodyRouteClear,COURTYARD_WALK_RATE} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {releaseBodyActivity,prepareFacilityActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';

function fixture(){
 let s=validateSave(structuredClone(seed.state));
 for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const master=s.master,worker=s.personsById['person:lu-zhiwei'];releaseBodyActivity(s,master);releaseBodyActivity(s,worker);
 const m=master.scenic,q=worker.mind.scenic;
 Object.assign(m,{x:35,y:28,path:[{x:37,y:28}],goal:{x:37,y:28},revision:geometryRevision(s)});master.action='walk';
 Object.assign(q,{x:35.5,y:28.3,path:[],goal:null});
 worker.activityId='activity:test-walking-yield';
 s.activitiesById[worker.activityId]={id:worker.activityId,kind:'facility',personId:worker.personId,action:'study',phase:'waiting',slotId:'test:desk:2',reservationId:'reservation:test-walking-yield',startedTick:s.worldTick};
 s.reservationsById['reservation:test-walking-yield']={id:'reservation:test-walking-yield',kind:'slot',personId:worker.personId,activityId:worker.activityId,slotId:'test:desk:2'};
 q.bodyYield={kind:'mutual-corridor',requestedBy:master.personId,activityId:worker.activityId,activityStartedTick:s.worldTick,startedTick:s.worldTick,target:{x:34.5,y:27.7},path:[{x:34.5,y:27.7}]};
 s.speed=1;return{s,master,worker,m,q};
}

test('a walking master briefly clears a blocked yield while retaining the original player route and target',()=>{
 const {s,m,q,master,worker}=fixture(),before=structuredClone({path:m.path,goal:m.goal,action:master.action,activity:s.activitiesById[worker.activityId],reservation:s.reservationsById['reservation:test-walking-yield']});
 s.worldTick++;tickSpatial(s);assert.equal(m.bodyYield?.kind,'requester-clear');
 const path=structuredClone(m.bodyYield.path),from={x:m.x,y:m.y};let length=0,at=from;
 assert(visibleBodyRouteClear(s,m,path));
 for(const to of path){assert.equal(meterSweep(s,at,to).blocked,false);length+=Math.hypot(to.x-at.x,to.y-at.y);at=to;}
 assert(length<=.600001);
 s.worldTick++;tickSpatial(s);assert(Math.hypot(m.x-from.x,m.y-from.y)>0);
 const afterYield={x:m.x,y:m.y};advanceMasterFreeWalk(s,4.6);
 if(m.bodyYield)assert.deepEqual({x:m.x,y:m.y},afterYield);
 assert.deepEqual({path:m.path,goal:m.goal,action:master.action,activity:s.activitiesById[worker.activityId],reservation:s.reservationsById['reservation:test-walking-yield']},before);
 const workerStart={x:q.x,y:q.y};
 for(let i=0;i<12;i++){s.worldTick++;const previous={x:m.x,y:m.y};tickSpatial(s);assert(Math.hypot(m.x-previous.x,m.y-previous.y)<=.13*COURTYARD_WALK_RATE+1e-7);}
 assert(Math.hypot(q.x-workerStart.x,q.y-workerStart.y)>0);
});

test('stationary or occupied masters keep exclusive control of their existing body task',()=>{
 for(const condition of ['stationary','occupied','no-path']){
  const {s,m,master}=fixture();if(condition==='stationary')master.action='rest';
  else if(condition==='occupied'){master.activityId='activity:test-master-busy';s.activitiesById[master.activityId]={id:master.activityId,kind:'facility',personId:master.personId,action:'study',phase:'waiting'};}
  else m.path=[];
  const before={x:m.x,y:m.y};s.worldTick++;tickSpatial(s);assert.equal(m.bodyYield,undefined);assert.deepEqual({x:m.x,y:m.y},before);
 }
});

test('a replaced facility activity releases only its obsolete yield during the next world step',()=>{
 for(const condition of ['new-start','new-id','same-tick-reuse']){
  const {s,m,q,worker}=fixture(),activity=s.activitiesById[worker.activityId];
  if(condition==='new-start')activity.startedTick=s.worldTick+1;
  else if(condition==='new-id'){delete s.activitiesById[worker.activityId];worker.activityId='activity:test-replacement';s.activitiesById[worker.activityId]={...activity,id:worker.activityId};s.reservationsById['reservation:test-walking-yield'].activityId=worker.activityId;}
  else {q.bodyYield.activityStartedTick=s.worldTick-10;activity.startedTick=s.worldTick;}
  const saved=JSON.stringify(s),task=structuredClone(s.activitiesById[worker.activityId]),reservation=structuredClone(s.reservationsById['reservation:test-walking-yield']),position={x:q.x,y:q.y},route=structuredClone(m.path),goal=structuredClone(m.goal);
  assert.equal(JSON.stringify(s),saved);s.worldTick++;tickSpatial(s);
  assert.equal(q.bodyYield,undefined);assert.deepEqual({x:q.x,y:q.y},position);assert.deepEqual(s.activitiesById[worker.activityId],task);assert.deepEqual(s.reservationsById['reservation:test-walking-yield'],reservation);assert.deepEqual(m.path,route);assert.deepEqual(m.goal,goal);
 }
});

test('a legal manual walk uses a bounded passing place and then returns to its original route',()=>{
 const {s,m,q,master,worker}=fixture();delete q.bodyYield;
 Object.assign(m,{x:43.11512614841488,y:8.984752873017051,path:[{x:43.093333333333334,y:8.972972972972972},{x:41.22666666666667,y:7.243243243243244}],goal:{x:41.22666666666667,y:7.243243243243244},waitingForPersonId:worker.personId});
 Object.assign(q,{x:42.718968982991214,y:8.626071644470622,path:[{x:43.093333333333334,y:8.972972972972972},{x:43.89333333333333,y:9.405405405405405},{x:44.693333333333335,y:9.892460881934564},{x:45.89333333333333,y:11.184068278805121},{x:46.49333333333333,y:11.829871977240398},{x:46.64333333333333,y:11.99132290184922},{x:46.718333333333334,y:12.010865989702518},{x:46.79333333333334,y:12.02304061784897},{x:47.093333333333334,y:12.071739130434782},{x:47.36,y:12.20912330719886},{x:47.093333333333334,y:12.42391304347826},{x:45.02196078431373,y:12.926470588235293},{x:43.976165305141755,y:17.061764705882354}],goal:{x:43.976165305141755,y:17.061764705882354},waitingForPersonId:master.personId});
 const target=structuredClone(worker);target.personId='person:manual-walk-target';target.id=300;target.activityId=null;target.mind.scenic={x:41.22666666666667,y:7.243243243243244,path:[],goal:null};target.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:41.22666666666667,y:7.243243243243244};s.personsById[target.personId]=target;s.homeMemberIds.push(target.personId);
 const original=structuredClone({path:m.path,goal:m.goal,workerActivity:s.activitiesById[worker.activityId],workerReservation:s.reservationsById['reservation:test-walking-yield']});
 assert(requestBodyYield(s,m,worker,m.path));const y=m.bodyYield;assert.equal(y.kind,'transport-retreat');assert.equal(y.manualWalk,true);assert.equal(y.activityId,null);assert.equal(y.workOrderId,null);
 const length=y.path.reduce((sum,to,i)=>{const from=i?y.path[i-1]:m;return sum+Math.hypot(to.x-from.x,to.y-from.y);},0);assert(length<=8);assert(visibleBodyRouteClear(s,m,y.path));
 let moved=false;for(let i=0;i<180&&m.bodyYield;i++){
  s.worldTick++;const previous={x:m.x,y:m.y};tickSpatial(s);const d=Math.hypot(m.x-previous.x,m.y-previous.y);assert(d<=.13*COURTYARD_WALK_RATE+1e-7);moved ||= d>0;
  if(m.bodyYield){advanceMasterFreeWalk(s,4.6);assert.deepEqual(m.goal,original.goal);}
  advanceScenic(q,4.6,s);
 }
 assert(moved);assert.equal(m.bodyYield,undefined);assert.deepEqual(m.goal,original.goal);assert.deepEqual(m.path.slice(-original.path.length),original.path);
 assert.deepEqual(s.activitiesById[worker.activityId],original.workerActivity);assert.deepEqual(s.reservationsById['reservation:test-walking-yield'],original.workerReservation);
});

test('formal stop and same-goal or redirected movement release only the manual micro-yield',()=>{
 for(const action of ['stop','same-goal','redirect']){
  let {s,m,q,master,worker}=fixture();const hall=s.buildings.find(b=>b.type==='hall');
  releaseBodyActivity(s,worker);worker.mind.activity='rest';worker.mind.learning=null;worker.job=null;prepareFacilityActivity(s,worker,hall,'rest',0);
  const a=s.activitiesById[worker.activityId];q.bodyYield.activityId=worker.activityId;q.bodyYield.activityStartedTick=a.startedTick;
  for(const p of [master,worker]){const at=p===master?m:q;p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:at.x,y:at.y};}
  assert.doesNotThrow(()=>validateSave(JSON.parse(JSON.stringify(s))));s.worldTick++;tickSpatial(s);assert.equal(m.bodyYield?.manualWalk,true);assert.equal(m.bodyYield.kind,'requester-clear');
  const goal={...m.goal},reservation=structuredClone(s.reservationsById[a.reservationId]);
  const request=action==='stop'?{name:'masterAction',args:['rest']}:{name:'moveScenicMaster',args:action==='same-goal'?[goal.x,goal.y]:[36,29]};
  const committed=dispatchCommand(s,request);s=committed.state;m=s.master.scenic;
  assert.equal(m.bodyYield,undefined);assert.deepEqual(s.reservationsById[a.reservationId],reservation);
  if(action==='stop')assert.equal(s.master.action,'rest');else if(action==='same-goal')assert.deepEqual(m.goal,goal);else assert.notDeepEqual(m.goal,goal);
  assert.doesNotThrow(()=>validateSave(JSON.parse(JSON.stringify(s))));
 }
});
