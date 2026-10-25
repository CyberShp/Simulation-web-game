import test from 'node:test';
import assert from 'node:assert/strict';
import {meterSweep,meterFindPath,spatialRevision,spatialConstructionExteriorSolids} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';
const scene=()=>({spatial:{version:'spatial-metres-1',extentVersion:'courtyard-96-1'},buildings:[]});
const well=()=>({id:'well',type:'well',level:1,buildingGridVersion:BUILDING_GRID.version,transform:{x:10,y:10}});
const from={x:8,y:9.8},to={x:15,y:9.8};
test('a route beside a well preserves distinct body radii on repeated queries',()=>{
 const s=scene();s.buildings.push(well());
 for(let i=0;i<2;i++){
  assert.deepEqual(meterSweep(s,from,to,.1),{...to,blocked:false});
  const wide=meterSweep(s,from,to,.3);assert.equal(wide.blocked,true);assert(wide.x>from.x&&wide.x<10,'wide body stops before well');
 }
});
test('moving a building invalidates both clear and blocked segment results',()=>{
 const s=scene(),b=well();s.buildings.push(b);
 assert.equal(meterSweep(s,from,to,.3).blocked,true);
 b.transform.y=20;assert.deepEqual(meterSweep(s,from,to,.3),{...to,blocked:false});
 b.transform.y=10;assert.equal(meterSweep(s,from,to,.3).blocked,true);
});
test('changing the scene extent invalidates a cached segment across its boundary',()=>{
 const s=scene(),a={x:60,y:50},b={x:70,y:50};
 assert.deepEqual(meterSweep(s,a,b),{...b,blocked:false});
 delete s.spatial.extentVersion;const stopped=meterSweep(s,a,b);assert.equal(stopped.blocked,true);assert(stopped.x<=64-.26+1e-7);
 s.spatial.extentVersion='courtyard-96-1';assert.deepEqual(meterSweep(s,a,b),{...b,blocked:false});
});

test('equal detached geometry shares route proofs with independent returned waypoints',()=>{
 const s=scene(),a={x:8,y:20},b={x:15,y:20};s.buildings.push(well());const first=meterFindPath(s,a,b,{maxSnap:0});assert.deepEqual(first,[b]);first[0].x=99;
 const detached=structuredClone(s);assert.deepEqual(meterFindPath(detached,a,b,{maxSnap:0}),[b]);
 detached.buildings[0].transform={x:10,y:19};const changed=meterFindPath(detached,a,b,{maxSnap:0});assert(changed);assert.notDeepEqual(changed,[b]);assert.deepEqual(meterFindPath(s,a,b,{maxSnap:0}),[b]);
});
test('construction signatures preserve identical empty ground and invalidate actual exterior changes',()=>{
 const s=scene();Object.assign(s.spatial,{extentVersion:'yunxiu-domain-west-valley-1',westWorkshops:{version:'west-workshops-1'}});s.master={activityId:'build'};s.activitiesById={build:{kind:'construction',workOrderId:'order'}};s.workOrdersById={order:{spatial:true,operation:'build',phase:'active',domainSiteId:'site:domain:gc-25',buildingType:'workshop',targetLevel:1,targetTransform:{x:-62,y:4,orientation:'south'},progressTicks:0,durationTicks:200}};
 const order=s.workOrdersById.order,empty=spatialRevision(s);assert.deepEqual(spatialConstructionExteriorSolids(s),[]);order.progressTicks=1;assert.deepEqual(spatialConstructionExteriorSolids(s),[]);assert.equal(spatialRevision(s),empty);
 order.progressTicks=70;assert(spatialConstructionExteriorSolids(s).length);const framed=spatialRevision(s);assert.notEqual(framed,empty);order.targetLevel=2;assert.notEqual(spatialRevision(s),framed);order.targetLevel=1;order.phase='completed';s.buildings.push({id:80,type:'workshop',level:1,domainSiteId:'site:domain:gc-25',buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:'adult-furniture-1',transform:{x:-62,y:4}});assert.notEqual(spatialRevision(s),framed);
});
