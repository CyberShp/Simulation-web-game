import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,advanceSect,snapshotSect} from '../../../apps/courtyard/sect-sim.mjs';
import {toArt,toWorld,routeArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
import {residentialMovementWaypoints,commandMovementWaypoint} from '../../../apps/courtyard/courtyard-navigation.mjs';
const options={terrain:true,domain:true,west:true,valley:false,residences:true};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function normal(){const s=createSectSession();for(const type of ['enable-courtyard-terrain','enable-domain','enable-residences','manual']){const r=commandSect(s,{type});assert(r.ok,r.error);}return s;}
function firstLeg(session){const p=session.state.master.scenic,start=toArt(p.x,p.y);return residentialMovementWaypoints(session.state,start,routeArt(start,toArt(177,46.6),options),options)[0];}

test('an unoccupied public route keeps its exact final door and checks actual feet between legs',()=>{
 const session=normal(),p=session.state.master.scenic,start=toArt(p.x,p.y),destination=toArt(177,46.6),route=residentialMovementWaypoints(session.state,start,routeArt(start,destination,options),options);
 assert(commandSect(session,{type:'pause',paused:false}).ok);
 for(const [index,point]of route.entries()){
  const r=commandMovementWaypoint(session,point,options,index<route.length-1,q=>commandSect(session,q));assert(r.ok,`leg ${index}: ${r.error}`);
  if(index===route.length-1)assert.deepEqual(r.waypoint.world,toWorld(destination.x,destination.y));
  for(let n=0;n<180&&distance(session.state.master.scenic,r.waypoint.world)>=.08;n++){advanceSect(session,.1);const f=toArt(session.state.master.scenic.x,session.state.master.scenic.y);assert(isArtWalkable(f.x,f.y,options));}
  assert(distance(session.state.master.scenic,r.waypoint.world)<.08,`arrival ${index}`);
 }
 assert(distance(session.state.master.scenic,{x:177,y:46.6})<.08);
});

test('a protected command is attempted once and preserves the world',()=>{
 const session=normal(),point=firstLeg(session),before=snapshotSect(session);let calls=0;
 const refusal={ok:false,error:'当前进度处于保护暂停，请先重试保存或导出恢复文件。'};
 const result=commandMovementWaypoint(session,point,options,true,()=>{calls++;return refusal;});
 assert.equal(result,refusal);assert.equal(calls,1);assert.deepEqual(snapshotSect(session),before);
});

test('a disconnected continuation exits before issuing another command',()=>{
 const session=normal(),before=snapshotSect(session);let calls=0;
 const result=commandMovementWaypoint(session,toArt(185,20),options,true,()=>{calls++;return{ok:true};},{recheck:true});
 assert.equal(result.ok,false);assert.match(result.error,/道路未能接续/);assert.equal(calls,0);assert.deepEqual(snapshotSect(session),before);
});
