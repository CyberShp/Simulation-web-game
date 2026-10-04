import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-sim.mjs';
import {CELLS} from '../dist/ea-data.mjs';
import {facilityRecords} from '../dist/ea-scene-state.mjs';
import {SCENIC_PLOTS,scenicPoint,scenicInverse,buildingAccess,buildingFootprint,facilityHit,scenicCanStand,scenicFindPath,scenicSweep,scenicDistance} from '../dist/ea-scene-geometry.mjs';
import {repairScenicState,advanceScenic,validateScenic} from '../dist/ea-scenic.mjs';

test('every logical construction address has one stable reversible dry-terrace plot',()=>{
 assert.equal(SCENIC_PLOTS.length,CELLS.length);assert.equal(new Set(SCENIC_PLOTS.map(p=>`${p.position.x},${p.position.y}`)).size,CELLS.length);
 for(const c of CELLS){const p=scenicPoint(c.x,c.y),inverse=scenicInverse(p);assert.deepEqual({x:inverse.x,y:inverse.y},c);}
 assert.equal(scenicInverse({x:-100,y:-100}),null);assert.equal(scenicPoint(999,999),null);
});
test('a building position depends only on its construction address, not other buildings or upgrade counts',()=>{
 const s=SIM.initial(),farm=SIM.build(s,'farm',5,3),before=facilityRecords(s).find(r=>r.id===farm.id).position;
 SIM.build(s,'lumber',6,3);assert.deepEqual(facilityRecords(s).find(r=>r.id===farm.id).position,before);
 s.resources.jade=1000;s.resources.wood=1000;s.resources.stone=1000;SIM.upgrade(s,farm.id);assert.deepEqual(facilityRecords(s).find(r=>r.id===farm.id).position,before);
 SIM.relocate(s,farm.id,7,3);const moved=facilityRecords(s).find(r=>r.id===farm.id);assert.deepEqual(moved.position,scenicPoint(7,3));assert.notDeepEqual(moved.position,before);
 assert.equal(facilityHit(farm,{x:moved.position.x,y:moved.position.y-10}),true);assert.equal(facilityHit(farm,{x:before.x,y:before.y-10}),false);
});
test('forty occupied plots preserve entrances, exclude footprints and never cross a building',()=>{
 const s=SIM.initial();s.buildings.push(...SCENIC_PLOTS.filter(p=>p.panel!==-1).slice(0,40).map((p,i)=>({id:i+2,type:'farm',x:p.x,y:p.y,condition:100,enabled:true,level:3})));
 const start={x:840,y:217};
 for(const b of s.buildings){const access=buildingAccess(s,b),path=scenicFindPath(s,start,access);assert.equal(scenicCanStand(s,access),true);assert.ok(path,`entrance ${b.id}`);
  const polygon=buildingFootprint(b),middle={x:polygon.reduce((n,p)=>n+p[0],0)/polygon.length,y:polygon.reduce((n,p)=>n+p[1],0)/polygon.length};assert.equal(scenicCanStand(s,middle),false);
  let from=start;for(const to of path){assert.equal(scenicSweep(s,from,to).blocked,false);from=to;}assert.ok(scenicDistance(from,access)<.01);
 }
});
test('moving and deleting an NPC destination repairs its in-flight route by exact building ID',()=>{
 const s=SIM.initial(),b=SIM.build(s,'farm',5,3),actor={x:840,y:217,steps:0,facing:1,back:false,path:[],destinationId:b.id};actor.path=scenicFindPath(s,actor,buildingAccess(s,b));actor.goal=actor.path.at(-1);s.disciples=[{id:99,mind:{scenic:actor}}];
 advanceScenic(actor,100,s);b.x=6;b.y=3;repairScenicState(s);assert.deepEqual(actor.goal,buildingAccess(s,b));assert.equal(validateScenic(actor,s),true);
 s.buildings=s.buildings.filter(x=>x.id!==b.id);repairScenicState(s);assert.deepEqual(actor.goal,{x:840,y:217});assert.equal(validateScenic(actor,s),true);
 const held=structuredClone(s);assert.equal(repairScenicState(s),false);assert.deepEqual(s,held);
});
test('cached path arrays stay independent when an actor consumes or edits waypoints',()=>{
 const s=SIM.initial(),from={x:840,y:217},goal={x:128,y:487},a=scenicFindPath(s,from,goal),expected=structuredClone(a);a.shift();if(a[0])a[0].x=-999;
 assert.deepEqual(scenicFindPath(s,from,goal),expected);
});
test('legacy courtyard migration is idempotent and modern malformed paths are rejected',()=>{
 const s=SIM.initial();SIM.moveScenicMaster(s,1300,397);delete s.master.scenic.geometry;delete s.master.scenic.revision;const before={resources:structuredClone(s.resources),story:structuredClone(s.story),time:s.time};
 const restored=SIM.validateSave(s),again=SIM.validateSave(restored);assert.deepEqual(restored,again);assert.deepEqual(restored.resources,before.resources);assert.deepEqual(restored.story,before.story);assert.equal(restored.time,before.time);
 restored.master.scenic.path=[{x:40,y:40}];assert.throws(()=>SIM.validateSave(restored),/山院行走/);
});
