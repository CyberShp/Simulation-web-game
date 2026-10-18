import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {COURTYARD_EAST_ROAD,firstSite,eastResidenceSites} from '../../../src/simulation/ea-sect-domain.mjs';
import {meterFindPath,meterLocalBodyDetour,meterSweep,spatialRevision} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';

function fixture(){
 let state=validateSave(JSON.parse(JSON.stringify(seed.state)));
 for(const name of ['enableCourtyardTerrain','enableEastResidences'])state=dispatchCommand(state,{name,args:[]}).state;
 // Body geometry reproduces the occupied hall exit from the construction QA.
 // This fixture does not claim to finance or complete a residence.
 Object.assign(state.master.scenic,{x:28,y:12.6,path:[],goal:null,revision:spatialRevision(state)});
 delete state.master.scenic.destinationId;
 Object.assign(state.personsById['person:lu-zhiwei'].mind.scenic,{x:28.5,y:14,path:[],goal:null});
 return state;
}

test('a hall-exit body bypass retains every later east-road turn',()=>{
 const s=fixture(),actor=s.master.scenic,route=meterFindPath(s,actor,firstSite.entrance,{maxSnap:0});
 const before=JSON.stringify(s),detour=meterLocalBodyDetour(s,actor,actor,route);
 assert.ok(detour);assert.equal(JSON.stringify(s),before,'a route query preserves the saved world');
 assert.deepEqual(detour.slice(2),route,'the local rejoin keeps all distant road points');
 assert.ok(Math.abs(Math.hypot(detour[1].x-actor.x,detour[1].y-actor.y)-2.5)<1e-8);
 for(const gate of COURTYARD_EAST_ROAD)assert.ok(detour.some(p=>Math.hypot(p.x-gate.x,p.y-gate.y)<1e-8));
});

test('actual body movement from HOME reaches all four residences along visible ground after a bypass',()=>{
 for(const site of [firstSite,...eastResidenceSites]){
  const s=fixture(),actor=s.master.scenic;actor.path=meterFindPath(s,actor,site.entrance,{maxSnap:0});actor.goal={...site.entrance};
  let steps=0,detoured=false;
  while(actor.path.length&&steps++<2000){
   const before={x:actor.x,y:actor.y},oldLength=actor.path.length;
   advanceScenic(actor,4.608,s);if(actor.path.length>oldLength)detoured=true;
   assert.equal(meterSweep(s,before,actor).blocked,false,site.id);
   const count=Math.max(1,Math.ceil(Math.hypot(actor.x-before.x,actor.y-before.y)/.025));
   for(let i=0;i<=count;i++){const art=toArt(before.x+(actor.x-before.x)*i/count,before.y+(actor.y-before.y)*i/count);assert.ok(isArtWalkable(art.x,art.y,{residences:true}),`${site.id} ${JSON.stringify(art)}`);}
  }
  assert.ok(detoured,'the occupied hall exit exercises body avoidance');
  assert.equal(actor.path.length,0,`${site.id} arrives`);
  assert.ok(Math.hypot(actor.x-site.entrance.x,actor.y-site.entrance.y)<1e-8);
 }
});
