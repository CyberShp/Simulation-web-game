import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,advanceSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {toArt,toWorld,routeArt,isArtWalkable,artSegmentClear} from '../../../apps/courtyard/courtyard-space.mjs';
import {residentialMovementWaypoints} from '../../../apps/courtyard/courtyard-navigation.mjs';
import {scenicSweep} from '../../../src/simulation/ea-scene-geometry.mjs';
const options={terrain:true,domain:true,west:true,valley:false,residences:true};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function normal(){const s=createSectSession();for(const type of ['enable-courtyard-terrain','enable-domain','enable-residences','manual']){const r=commandSect(s,{type});assert(r.ok,r.error);}return s;}

test('residential long walks use clear body segments and reach the same door through actual world steps',()=>{
 let session=normal();const start=toArt(session.state.master.scenic.x,session.state.master.scenic.y),destination=toArt(177,46.6),samples=routeArt(start,destination,options),before=JSON.stringify(snapshotSect(session));
 const route=residentialMovementWaypoints(session.state,start,samples,options);assert(route?.length);assert(route.length<samples.length/4);assert.deepEqual(route.at(-1),destination);assert.equal(JSON.stringify(snapshotSect(session)),before);
 let previous=start;for(const point of route){assert(distance(toWorld(previous.x,previous.y),toWorld(point.x,point.y))<=3.000001);assert(artSegmentClear(previous,point,options));assert.equal(scenicSweep(session.state,toWorld(previous.x,previous.y),toWorld(point.x,point.y)).blocked,false);previous=point;}
 assert(commandSect(session,{type:'pause',paused:false}).ok);const initialTick=session.state.worldTick;let checks=0;
 for(const [index,point]of route.entries()){
  const world=toWorld(point.x,point.y),result=commandSect(session,{type:'move',...world});assert(result.ok,result.error);
  for(let n=0;n<180&&distance(session.state.master.scenic,world)>=.04;n++){advanceSect(session,.1);const p=session.state.master.scenic,foot=toArt(p.x,p.y);assert(isArtWalkable(foot.x,foot.y,options));checks++;}
  assert(distance(session.state.master.scenic,world)<.04,`Arrival ${index}`);
  if(index===Math.floor(route.length/2)){const saved=snapshotSect(session);session=restoreSect(saved);assert.deepEqual(snapshotSect(session),saved);}
 }
 assert(checks>100);assert(session.state.worldTick-initialTick<2500);assert(distance(session.state.master.scenic,{x:177,y:46.6})<.04);
});

test('movement compaction preserves old-domain queues and rejects a blocked destination',()=>{
 const session=normal(),start=toArt(session.state.master.scenic.x,session.state.master.scenic.y),route=routeArt(start,toArt(177,46.6),options);
 const legacy=residentialMovementWaypoints(session.state,start,route,{...options,residences:false});assert.deepEqual(legacy,route);assert.notEqual(legacy[0],route[0]);
 const before=JSON.stringify(snapshotSect(session));assert.equal(residentialMovementWaypoints(session.state,start,[toArt(185,20)],options),null);assert.equal(JSON.stringify(snapshotSect(session)),before);
});
