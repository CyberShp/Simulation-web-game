/** SR-XF-003/005/006, SAVE-01: larger 2.5D estate, identical old coordinates.
 * Component fixtures explicitly fund and heal the master. These assertions do
 * not claim normal player progression, browser performance or device coverage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {scenicNearest} from '../dist/ea-scene-geometry.mjs';
import {SPATIAL_SCENE,SPATIAL_TERRAIN,SPATIAL_EXTENT_VERSION,spatialAccess,spatialFootprint,placementIssue,meterCanStand,meterFindPath,meterSweep,meterNearest,validateSpatial,initBuildingGrid} from '../dist/ea-sr-spatial.mjs';

function fixture(){
 const s=S.initial({sr:true,seed:907});
 s.master.wound=0;s.master.energy=100;s.speed=1;
 for(const key of Object.keys(s.resources))s.resources[key]=10000;
 return S.validateSave(s);
}
function building(type,x,y,id=99){return{id,instanceId:`building:yunxiu:${id}`,type,level:1,buildingGridVersion:S.BUILDING_GRID.version,prefabId:`prefab:${type}:units:v1`,sceneId:SPATIAL_SCENE.id,transform:{x,y,orientation:'south'}};}
function assertRoute(s,from,goal){
 const route=meterFindPath(s,from,goal,{maxSnap:0});assert.notEqual(route,null,'reachable target must have a path');
 let p=from;for(const q of route){assert(meterCanStand(s,q));assert.equal(meterSweep(s,p,q).blocked,false);p=q;}
 assert.deepEqual(p,goal);return route;
}

test('96m estate keeps 2m building cells / 0.5m navigation; original water and gate stay fixed',()=>{
 const s=fixture();assert.equal(s.schemaVersion,6);assert.equal(s.spatial.extentVersion,SPATIAL_EXTENT_VERSION);
 assert.equal(SPATIAL_SCENE.width,96);assert.equal(SPATIAL_SCENE.height,96);
 assert.equal(SPATIAL_SCENE.width/S.BUILDING_GRID.metres,48);assert.equal(SPATIAL_SCENE.grid,.5);
 assert.deepEqual(Array.from(SPATIAL_TERRAIN.find(t=>t.kind==='water').polygon),[[58,8],[64,8],[64,30],[58,30]]);
 assert.deepEqual(SPATIAL_TERRAIN.find(t=>t.kind==='protected').polygon,[[30,57],[34,57],[34,64],[30,64]]);
 assert(!meterCanStand(s,{x:60,y:15}));assert(meterCanStand(s,{x:66,y:15}));
 assert(!meterCanStand(s,{x:80,y:.75}),'new north rim is the same impassable slope');
 for(const goal of[{x:80,y:50},{x:50,y:80},{x:95.5,y:95.5}])assertRoute(s,{x:32,y:56},goal);
});

test('expanded navigation detours around buildings in both far axes with safe continuous segments',()=>{
 const s=fixture();s.buildings.push(building('house',72,70),building('well',86,82,100));
 for(const[from,to]of[[{x:67,y:73},{x:85,y:73}],[{x:75,y:66},{x:75,y:81}],[{x:83,y:83},{x:92,y:83}]]){
  assert(meterSweep(s,from,to).blocked);const path=assertRoute(s,from,to);assert(path.length>1);
 }
 assert.equal(meterFindPath(s,{x:94,y:94},{x:96,y:94},{maxSnap:0}),null);
 assert(!meterCanStand(s,{x:95.75,y:90}));assert(meterCanStand(s,{x:95.7,y:90}));
 assert(meterSweep(s,{x:94,y:94},{x:97,y:94}).blocked);
});

test('expanded path search terminates with no route when a far-area doorway is sealed',()=>{
 const s=fixture();s.buildings.push(building('house',80,80),building('well',82,86,100));
 const from={x:32,y:56},inside={x:83,y:83};assert(meterCanStand(s,from));assert(meterCanStand(s,inside));
 assert.equal(meterFindPath(s,from,inside,{maxSnap:0}),null);
});

test('nearest-safe-foot search covers the enlarged scene while explicit snap limits still apply',()=>{
 const s=fixture(),outside={x:160,y:80},near=meterNearest(s,outside);
 assert.deepEqual(near,{x:95.5,y:80});assert.deepEqual(scenicNearest(s,outside),near);
 assert.equal(meterNearest(s,outside,{maxDistance:64}),null);
 assert.equal(meterNearest(s,{x:NaN,y:80}),null);
});

test('old unit-grid save is first validated at 64m, then only receives extent metadata, without time or coordinate changes',()=>{
 const old=fixture();delete old.spatial.extentVersion;
 const source=JSON.stringify(old);assert(!meterCanStand(old,{x:70,y:70}));
 const migrated=S.validateSave(old);assert.equal(JSON.stringify(old),source,'load must preserve its input');
 assert.equal(migrated.spatial.extentVersion,SPATIAL_EXTENT_VERSION);
 const withoutMarker=JSON.parse(JSON.stringify(migrated));delete withoutMarker.spatial.extentVersion;
 assert.equal(JSON.stringify(withoutMarker),source,'only extentVersion is added to a hydrated unit-grid world');
 const saved=JSON.stringify(migrated);assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);
 // Also cover an in-place command clone: cached 64m collisions must not survive.
 initBuildingGrid(old);assert(meterCanStand(old,{x:70,y:70}));
 assert.equal(old.spatial.extentVersion,SPATIAL_EXTENT_VERSION);
});

test('unmarked out-of-old-bounds people, buildings, paths and queued construction reject before expansion',()=>{
 for(const corrupt of[
  s=>{s.master.scenic.x=70;s.master.scenic.y=70;s.master.position.x=70;s.master.position.y=70;s.master.location.x=70;s.master.location.y=70;},
  s=>{s.buildings[0].transform.x=66;},
  s=>{s.master.scenic.path=[{x:70,y:70}];},
 ]){
  const s=fixture();delete s.spatial.extentVersion;corrupt(s);const original=JSON.stringify(s);
  assert.throws(()=>S.validateSave(s));assert.equal(JSON.stringify(s),original);assert(!Object.hasOwn(s.spatial,'extentVersion'));
 }
 let s=fixture();s=S.dispatchCommand(s,{name:'build',args:['farm',80,80]}).state;
 // This state is a valid new-area transaction but cannot masquerade as an old save.
 delete s.spatial.extentVersion;s.master.scenic.path=[];s.master.scenic.goal=null;const original=JSON.stringify(s);
 assert.throws(()=>validateSpatial(s),/施工目标.*边界/);assert.throws(()=>S.validateSave(s));assert.equal(JSON.stringify(s),original);
});

test('unknown extent markers reject, and bounds violations do not spend resources or advance a command',()=>{
 const s=fixture(),before=JSON.stringify(s);
 for(const[x,y]of[[92,92],[96,70],[70,96],[-2,70],[70,-2]]){
  assert.throws(()=>S.dispatchCommand(s,{name:'build',args:['house',x,y]}),/边界/);
  assert.equal(JSON.stringify(s),before);
 }
 for(const marker of['courtyard-999-1',null,'']){
  const bad=S.cloneState(s);bad.spatial.extentVersion=marker;const original=JSON.stringify(bad);
  assert.throws(()=>S.validateSave(bad),/范围版本/);assert.equal(JSON.stringify(bad),original);
 }
});

test('public walking and on-site construction work in new land; mid-task and completed saves reload exactly',()=>{
 let s=fixture();const originalBuildings=JSON.stringify(s.buildings),act=(name,...args)=>{const r=S.dispatchCommand(s,{name,args});s=r.state;return r.result;};
 const reload=()=>{const raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);};
 act('moveScenicMaster',80.5,78.5);
 let n=0;while(s.master.scenic.path.length&&n++<2500)S.tick(s,.1);
 assert(n<2500);assert.equal(s.master.scenic.x,80.5);assert.equal(s.master.scenic.y,78.5);reload();
 assert.equal(JSON.stringify(s.buildings),originalBuildings);
 const r=act('build','farm',80,80);assert.equal(s.workOrdersById[r.workOrderId].progressTicks,0);reload();
 for(let i=0;i<5;i++)S.tick(s,.1);
 assert.equal(s.workOrdersById[r.workOrderId].progressTicks,0,'walking is not construction progress');
 n=0;while(s.workOrdersById[r.workOrderId]&&n++<3000)S.tick(s,.1);
 assert(n<3000);const b=s.buildings.find(b=>b.id===r.id);assert(b);assert.deepEqual(spatialFootprint(b),[[80,80],[84,80],[84,84],[80,84]]);
 assert.deepEqual(spatialAccess(b),{x:82,y:84.6});assert.equal(placementIssue(s,'house',86,80),'');
 validateSpatial(s);reload();assert.equal(s.spatial.completedOrders.at(-1).operation,'build');
});

test('recommended placement reaches new land when the original yard has no fitting footprint',()=>{
 const s=fixture();
 // Synthetic capacity stress: farm plots leave two-metre aisles, but no second
 // 4x4 footprint remains in the old boundary. Not a progressed save.
 s.buildings=[];let id=1;
 const fill=(x,y)=>{
  const b=building('farm',x,y,id);
  if(!placementIssue(s,'farm',x,y,{checkPeople:false,checkConnectivity:false})&&meterCanStand(s,spatialAccess(b))){s.buildings.push(b);id++;}
 };
 for(let y=2;y<=56;y+=6)for(let x=2;x<=56;x+=6)fill(x,y);
 // The old eastern pond interrupts the regular field rows along x=58.
 for(let y=8;y<=26;y+=6)fill(54,y);
 const point=S.recommendedPlacement(s,'farm');assert(point);assert(point.x+4>63||point.y+5>63);
 assert.equal(point.x%2,0);assert.equal(point.y%2,0);assert.equal(placementIssue(s,'farm',point.x,point.y),'');
});
