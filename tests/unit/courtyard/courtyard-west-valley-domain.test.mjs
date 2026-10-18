import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,tick,validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {BUILDING_GRID,buildingCellSize} from '../../../src/simulation/ea-building-grid.mjs';
import {DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION,westValleySites,WEST_VALLEY_ROAD,WEST_VALLEY_QUARRY_ROAD,valleyActiveBounds} from '../../../src/simulation/ea-sect-domain.mjs';
import {meterCanStand,meterFindPath,meterSweep,placementIssue,spatialBounds,spatialSlots,spatialAccess,spatialFootprint} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,toWorld} from '../../../apps/courtyard/courtyard-space.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
function session(){
 let state=validateSave(copy(seed.state));
 return {get state(){return state;},command(name,...args){const response=dispatchCommand(state,{name,args});state=response.state;return response.result;},step(){tick(state,.1);},until(predicate,label,max=7000){for(let i=0;i<max&&!predicate(state);i++)tick(state,.1);assert.ok(predicate(state),label);},restore(){const text=JSON.stringify(state);state=validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);}};
}
function opened(){const run=session();for(const command of ['enableSectDomain','enableCourtyardTerrain','enableWestValley'])run.command(command);return run;}
const stock=run=>run.state.stockpilesById['stockpile:yunxiu'].resources;

test('four valley plots have persistent plan identities, two-metre anchors and room for all three levels',()=>{
 assert.deepEqual(westValleySites.map(site=>[site.number,site.type,site.x,site.y]),[[17,'quarry',-38,14],[18,'granary',-52,34],[19,'granary',-64,34],[24,'warehouse',-36,24]]);
 for(const site of westValleySites){
  assert.equal(site.id,`site:domain:gc-${site.number}`);assert.equal(site.extentVersion,DOMAIN_VALLEY_EXTENT_VERSION);
  assert.equal(Math.abs(site.x%2),0);assert.equal(site.y%2,0);
  for(const level of [1,2,3]){const size=buildingCellSize(site.type,level);assert.equal(size.width,2+2*level);assert.ok(size.width<=site.reserveWidth&&size.height<=site.reserveHeight);}
 }
});

test('valley activation is explicit and retains west identities, world time, resources and in-flight facts',()=>{
 const run=session(),east=JSON.stringify(run.state);assert.throws(()=>run.command('enableWestValley'),/西林/);assert.equal(JSON.stringify(run.state),east);
 run.command('enableSectDomain');run.command('enableCourtyardTerrain');run.restore();
 assert.equal(run.state.spatial.extentVersion,DOMAIN_EXTENT_VERSION);
 for(const site of westValleySites){assert.equal(meterCanStand(run.state,site.entrance),false);const before=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite',site.id),/西谷/);assert.equal(JSON.stringify(run.state),before);}
 const before=copy(run.state),result=run.command('enableWestValley');assert.equal(result.alreadyEnabled,false);
 assert.deepEqual(spatialBounds(run.state),valleyActiveBounds);
 for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById'])assert.deepEqual(run.state[key],before[key],key);
 assert.equal(run.state.spatial.domain.openedAtTick,before.spatial.domain.openedAtTick);assert.equal(run.state.spatial.domain.valleyOpenedAtTick,before.worldTick);run.restore();
 const spatial=copy(run.state.spatial);assert.equal(run.command('enableWestValley').alreadyEnabled,true);assert.deepEqual(run.state.spatial,spatial);
 assert.equal(run.command('enableSectDomain').extentVersion,DOMAIN_VALLEY_EXTENT_VERSION);assert.deepEqual(run.state.spatial,spatial);
 for(const mutate of [s=>delete s.spatial.domain.valleyOpenedAtTick,s=>s.spatial.domain.valleyOpenedAtTick=s.worldTick+1,s=>s.spatial.extentVersion=DOMAIN_EXTENT_VERSION]){const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/西谷|版本/);assert.equal(JSON.stringify(bad),text);}
});

test('all four maximum footprints coexist and every entrance and outdoor work slot remains reachable',()=>{
 const run=opened(),s=run.state;
 // Geometry fixture: all maximum footprints coexist without claiming a playthrough.
 const buildings=westValleySites.map((site,i)=>({id:80+i,instanceId:`building:yunxiu:${80+i}`,type:site.type,level:3,buildingGridVersion:BUILDING_GRID.version,...(site.type==='warehouse'?{interiorLayoutVersion:'adult-furniture-1'}:{}),transform:{x:site.x,y:site.y,orientation:'south'}}));
 s.buildings.push(...buildings);s.spatial.geometryRevision++;
 for(const building of buildings){
  assert.equal(placementIssue(s,building.type,building.transform.x,building.transform.y,{ignoreId:building.id,level:3,checkPeople:false,checkConnectivity:false}),'');
  const work=spatialSlots(building,'work');assert.equal(work.length,building.type==='granary'?4:building.type==='quarry'?2:0);assert.equal(spatialSlots(building,'rest').length,0);
  for(const point of [spatialAccess(building),...work.map(slot=>slot.position)]){
   const path=meterFindPath(s,s.master.scenic,point,{maxSnap:0});assert.ok(path,`${building.type} ${JSON.stringify(point)}`);
   for(const [i,p] of path.entries())assert.equal(meterSweep(s,i?path[i-1]:s.master.scenic,p).blocked,false);
   assert.ok(meterFindPath(s,point,s.master.scenic,{maxSnap:0}));
  }
  for(const [x,y] of spatialFootprint(building)){const art=toArt(x,y),world=toWorld(art.x,art.y);assert.ok(art.x>=-3344&&art.x<=-1672&&art.y>=0&&art.y<=941);assert.ok(Math.hypot(world.x-x,world.y-y)<1e-8);}
 }
 for(const point of [...WEST_VALLEY_ROAD,...WEST_VALLEY_QUARRY_ROAD])assert.equal(meterCanStand(s,point),true);
 for(const from of buildings)for(const to of buildings){if(from===to)continue;const start=spatialAccess(from),path=meterFindPath(s,start,spatialAccess(to),{maxSnap:0});assert.ok(path);for(const [i,point] of path.entries())assert.equal(meterSweep(s,i?path[i-1]:start,point).blocked,false);}
 // The irrigation canal remains physically closed; its bridge is the crossing.
 for(const [x,y] of [[440,544],[890,580],[1200,624],[1330,660]])assert.equal(meterCanStand(s,toWorld(x-3344,y)),false);
 for(const level of [1,2,3]){const quarry={...buildings[0],level};assert.deepEqual(spatialAccess(quarry),{x:-36,y:18.6});assert.deepEqual(spatialSlots(quarry,'work').map(slot=>slot.position),[{x:-37.1,y:15.2},{x:-34.9,y:15.2}]);}
 for(const point of [{x:-80,y:20},{x:-50,y:10},{x:-70,y:50}])assert.equal(meterCanStand(s,point),false);
});

test('a valley field is built after real material delivery and resumes exactly during transit and construction',()=>{
 const run=opened(),site=westValleySites.find(site=>site.number===18),before=copy(stock(run)),result=run.command('buildDomainSite',site.id);
 let transit=false,working=false;
 for(let i=0;i<7000&&run.state.workOrdersById[result.workOrderId];i++){
  const from={x:run.state.master.scenic.x,y:run.state.master.scenic.y};run.step();assert.equal(meterSweep(run.state,from,run.state.master.scenic).blocked,false);
  const order=run.state.workOrdersById[result.workOrderId];if(!order)break;
  if(!transit&&run.state.master.scenic.x< -25&&order.materialFlow.phase==='carrying'){assert.equal(order.progressTicks,0);run.restore();run.command('setSpeed',0);const paused=JSON.stringify(run.state);run.step();assert.equal(JSON.stringify(run.state),paused);run.command('setSpeed',1);transit=true;}
  if(!working&&order.progressTicks>=40){run.restore();working=true;}
 }
 assert.ok(transit&&working);const built=run.state.buildings.find(b=>b.domainSiteId===site.id);assert.ok(built);assert.deepEqual(built.transform,{x:-52,y:34,orientation:'south'});assert.equal(spatialSlots(built,'work').length,4);
 assert.equal(stock(run).wood,before.wood-20);assert.equal(stock(run).stone,before.stone-5);assert.equal(run.state.spatial.completedOrders.filter(order=>order.id===result.workOrderId).length,1);run.restore();
 const duplicate=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite',site.id),/冲突|一处/);assert.equal(JSON.stringify(run.state),duplicate);
});

test('cancelled west-valley cargo physically returns once and arbitrary plots remain unavailable',()=>{
 const run=opened(),site=westValleySites.find(site=>site.number===19),before=copy(stock(run));
 const text=JSON.stringify(run.state);assert.throws(()=>run.command('build','granary',-62,34),/规划|预设/);assert.equal(JSON.stringify(run.state),text);
 const result=run.command('buildDomainSite',site.id);run.until(s=>s.master.scenic.x< -25&&s.workOrdersById[result.workOrderId]?.materialFlow.phase==='carrying','cargo reaches the valley');
 assert.equal(run.command('cancelConstruction').pending,true);assert.equal(stock(run).wood,before.wood-20);run.restore();
 run.until(s=>!s.workOrdersById[result.workOrderId],'cargo returns to the source');assert.equal(stock(run).wood,before.wood);assert.equal(stock(run).stone,before.stone);assert.equal(run.state.buildings.some(b=>b.domainSiteId===site.id),false);run.restore();
 run.command('cancelConstruction');assert.equal(stock(run).wood,before.wood);
});

test('the fixed storage court is built from gathered wood and receives goods at its own entrance',()=>{
 const run=opened(),site=westValleySites.find(site=>site.number===24),homeId='stockpile:yunxiu',home=copy(run.state.stockpilesById[homeId]);
 run.command('startMasterHarvest','wood');run.until(s=>!s.master.activityId,'wood is gathered from the finite source');
 const delivery=run.command('startTransport','stockpile:carried:master',homeId,'person:master',{wood:12});run.until(s=>s.workOrdersById[delivery.id]?.phase==='delivered','gathered wood reaches the original store');
 const construction=run.command('buildDomainSite',site.id);run.until(s=>!s.workOrdersById[construction.workOrderId],'storage court construction completes');run.restore();
 const building=run.state.buildings.find(b=>b.domainSiteId===site.id),stockId=`stockpile:${building.instanceId}`,store=run.state.stockpilesById[stockId];
 assert.deepEqual(store.position,{sceneId:'scene:yunxiu-courtyard',...spatialAccess(building)});assert.equal(store.capacity,2400);assert.equal(store.resources.food,0);
 assert.equal(run.state.stockpilesById[homeId].buildingId,home.buildingId);assert.deepEqual(run.state.stockpilesById[homeId].position,home.position);
 const cargo=run.command('startTransport',homeId,stockId,'person:master',{food:10});run.until(s=>s.workOrdersById[cargo.id]?.phase==='carrying'&&s.master.scenic.x< -20,'storage cargo reaches the valley');run.restore();assert.equal(run.state.stockpilesById[stockId].resources.food,0);
 run.until(s=>s.workOrdersById[cargo.id]?.phase==='delivered','food reaches its separate storage court');assert.equal(run.state.stockpilesById[stockId].resources.food,10);run.restore();
});
