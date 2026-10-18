import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialSlots,spatialAccess,meterCanStand,meterFindPath,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';

test('GC26 interior process stations have usable body clearance and real paths between every stage at all three sizes',()=>{
 for(const level of [1,2,3]){
  // Geometry-only fixture in an empty metre scene; no normal-world building, funding or ground acceptance.
  const b={id:90,instanceId:'building:yunxiu:90',type:'alchemy',level,domainSiteId:'site:domain:gc-26',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:20,y:20,orientation:'south'}};
  const s={spatial:{version:'spatial-metres-1',extentVersion:'courtyard-96-1',geometryRevision:1},buildings:[b]},before=structuredClone(s),slots=spatialSlots(b,'work');
  assert.deepEqual(slots.map(slot=>slot.suffix),['work:1','work:herb:1','work:filter:1','work:seal:1']);
  const points=[spatialAccess(b),...slots.map(slot=>slot.position)];
  for(const at of points)assert(meterCanStand(s,at,.26),`L${level} occupied foot ${JSON.stringify(at)}`);
  for(const from of points)for(const to of points){
   const route=meterFindPath(s,from,to,{maxSnap:0});assert(route,`L${level} unreachable ${JSON.stringify({from,to})}`);
   let at=from;for(const next of route){assert.equal(meterSweep(s,at,next,.26).blocked,false);at=next;}assert(Math.hypot(at.x-to.x,at.y-to.y)<1e-8);
  }
  assert.deepEqual(s,before);
 }
});
