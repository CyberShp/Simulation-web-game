import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {NORTH_LIBRARY_VERSION,DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION,domainBounds,domainContains,northLibrarySites,westValleySites,NORTH_LIBRARY_ROADS} from '../../../src/simulation/ea-sect-domain.mjs';
import {spatialPrefab,spatialAccess,spatialSlots,meterCanStand,meterFindPath,meterSweep,placementIssue,handlers} from '../../../src/simulation/ea-sr-spatial.mjs';
import {validateScenic} from '../../../src/simulation/ea-scenic.mjs';
import {localMarketQuote} from '../../../src/simulation/ea-sr-economy.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
function session(){let state=validateSave(copy(seed.state));return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;},step(){tick(state,.1);},until(predicate,label,max=10000){for(let i=0;i<max&&!predicate(state);i++)tick(state,.1);assert.ok(predicate(state),label);},restore(){const bytes=JSON.stringify(state);state=validateSave(JSON.parse(bytes));assert.equal(JSON.stringify(state),bytes);}};}
function enabled(){const run=session();run.command('enableCourtyardTerrain');run.command('enableNorthLibrary');return run;}
function checkedRoute(s,from,to,label){const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path,label);let at=from;for(const point of path){assert.equal(meterSweep(s,at,point).blocked,false,label);at=point;}return path;}
function interiorFixture(level=1){
 const s=validateSave(copy(seed.state)),b={id:80,instanceId:'building:yunxiu:80',type:'library',level,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:40,orientation:'south'}};
 s.buildings.push(b);s.spatial.geometryRevision++;return {s,b};
}

test('existing adult library desks, teaching and work remain physically reachable at all three levels',()=>{
 for(const level of [1,2,3]){
  const {s,b}=interiorFixture(level),prefab=spatialPrefab(b),entry=spatialAccess(b);
  assert.deepEqual([prefab.width,prefab.height],[4+level*2,4+level*2]);
  assert.equal(spatialSlots(b,'study').length,level*2);assert.equal(spatialSlots(b,'teach').length,1);assert.equal(spatialSlots(b,'work').length,1);
  for(const kind of ['study','teach','work'])for(const slot of spatialSlots(b,kind)){
   assert.equal(meterCanStand(s,slot.position),true,slot.id);const path=meterFindPath(s,entry,slot.position,{maxSnap:0});assert.ok(path,slot.id);
   let at=entry;for(const point of path){assert.equal(meterSweep(s,at,point).blocked,false,slot.id);at=point;}
  }
 }
});

test('bound library work prevents construction before payment while retaining the active order',()=>{
 for(const kind of ['study','teach','family-notes'])for(const phase of ['reserved','executing','blocked'])for(const operation of ['upgrade','relocate','demolish']){
  const {s,b}=interiorFixture();s.srCultivation.orders['order:library:guard']={id:'order:library:guard',kind,phase,parameters:{preferredBuildingId:b.instanceId}};
  const before=JSON.stringify(s);assert.throws(()=>handlers[operation](s,b.id,44,40),/先完成或中止阁内研读、整理与讲习/);assert.equal(JSON.stringify(s),before);
 }
});

test('finished or legacy unbound study orders retain the existing construction behavior',()=>{
 for(const order of [{kind:'study',phase:'completed',parameters:{preferredBuildingId:'building:yunxiu:80'}},{kind:'family-notes',phase:'cancelled',parameters:{preferredBuildingId:'building:yunxiu:80'}},{kind:'study',phase:'executing',parameters:{}}]){
  const {s,b}=interiorFixture();s.srCultivation.orders['order:library:history']={id:'order:library:history',...order};const before=copy(s.srCultivation.orders);
  const result=handlers.demolish(s,b.id);assert.equal(result.pending,true);assert.deepEqual(s.srCultivation.orders,before);
 }
});

test('explicit north activation preserves the source world and all previously opened regional flags',()=>{
 for(const extent of [DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION])for(const eastern of [false,true]){
  const run=session();run.command('enableCourtyardTerrain');if(extent!==DOMAIN_EAST_EXTENT_VERSION)run.command('enableSectDomain');if(extent===DOMAIN_VALLEY_EXTENT_VERSION)run.command('enableWestValley');if(eastern){run.command('enableEastResidences');run.command('enableEastServices');}
  const before=copy(run.state),oldBounds=domainBounds(extent,before.spatial.eastResidences?.version,before.spatial.eastServices?.version),result=run.command('enableNorthLibrary');assert.equal(result.alreadyEnabled,false);
  assert.deepEqual(run.state.spatial.northLibrary,{version:NORTH_LIBRARY_VERSION,openedAtTick:before.worldTick});assert.equal(run.state.spatial.extentVersion,extent);assert.deepEqual(run.state.spatial.eastResidences,before.spatial.eastResidences);assert.deepEqual(run.state.spatial.eastServices,before.spatial.eastServices);
  for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById','factsById'])assert.deepEqual(run.state[key],before[key],key);
  const bounds=domainBounds(extent,before.spatial.eastResidences?.version,before.spatial.eastServices?.version,NORTH_LIBRARY_VERSION);assert.deepEqual(bounds,{...oldBounds,y:-24,height:120});
  const bytes=JSON.stringify(run.state);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);const opened=copy(run.state.spatial);assert.equal(run.command('enableNorthLibrary').alreadyEnabled,true);assert.deepEqual(run.state.spatial,opened);
 }
});

test('north metadata remains optional and rejects malformed activation without rewriting the save',()=>{
 const old=session(),bytes=JSON.stringify(old.state);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);assert.equal(old.state.spatial.northLibrary,undefined);assert.throws(()=>old.command('enableNorthLibrary'),/实景道路/);assert.equal(JSON.stringify(old.state),bytes);
 const run=session();run.command('enableCourtyardTerrain');run.command('enableNorthLibrary');
 for(const mutate of [s=>s.spatial.northLibrary=null,s=>s.spatial.northLibrary.version='unknown',s=>delete s.spatial.northLibrary.openedAtTick,s=>s.spatial.northLibrary.openedAtTick=-1,s=>s.spatial.northLibrary.openedAtTick=s.worldTick+1,s=>s.spatial.northLibrary.extra=true,s=>delete s.spatial.courtyardTerrain]){
  const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/北台|tick字段/);assert.equal(JSON.stringify(bad),text);
 }
});

test('fixed northern site, slope aperture and maximum hall reserve use the same real circle geometry',()=>{
 const site=northLibrarySites[0];assert.deepEqual([site.number,site.type,site.x,site.y,site.reserveWidth,site.reserveHeight],[2,'library',44,-16,10,10]);
 const locked=session();locked.command('enableCourtyardTerrain');const text=JSON.stringify(locked.state);assert.throws(()=>locked.command('buildDomainSite',site.id),/北台/);assert.equal(JSON.stringify(locked.state),text);assert.equal(domainContains(site.entrance,.26,locked.state.spatial.extentVersion),false);
 const run=enabled(),s=run.state;
 for(const road of NORTH_LIBRARY_ROADS)for(let i=1;i<road.centre.length;i++)assert.equal(meterSweep(s,road.centre[i-1],road.centre[i]).blocked,false,`${road.id}/${i}`);
 for(const point of [{x:20,y:-5},{x:70,y:-5},{x:45,y:-23},{x:32,y:.5},{x:36,y:.5}])assert.equal(meterCanStand(s,point),false);
 assert.equal(meterCanStand(s,{x:34.27272727272727,y:.5}),true);
 for(const hallLevel of [1,3])for(const level of [1,2,3]){
  const b={...interiorFixture(level).b,domainSiteId:site.id,transform:{x:44,y:-16,orientation:'south'}};s.buildingsById[b.instanceId]=b;s.buildingsById['building:yunxiu:1'].level=hallLevel;s.spatial.geometryRevision++;
  const entry=spatialAccess(b),home=spatialAccess(s.buildingsById['building:yunxiu:1']);assert.equal(placementIssue(s,'library',44,-16,{ignoreId:b.id,level,checkPeople:false}),'');checkedRoute(s,home,entry,'HOME to library');checkedRoute(s,entry,home,'library to HOME');
  for(const kind of ['study','teach','work'])for(const slot of spatialSlots(b,kind)){const route=checkedRoute(s,entry,slot.position,slot.id);assert.ok(route.length<8,'an interior station stays inside the northern room');assert.ok(route.every(p=>p.y<0));}
 }
});

test('north activation retains old positive ground and cross-domain routes keep the existing save limit',()=>{
 const run=session();run.command('enableCourtyardTerrain');run.command('enableSectDomain');run.command('enableWestValley');run.command('enableEastResidences');run.command('enableEastServices');
 const points=[];for(let x=-80;x<=212;x+=4)for(let y=2;y<=94;y+=4)points.push({x,y,open:meterCanStand(run.state,{x,y})});run.command('enableNorthLibrary');for(const p of points)assert.equal(meterCanStand(run.state,p),p.open,`${p.x}/${p.y}`);
 for(const from of [{x:-34,y:28.6},{x:135,y:46.6},{x:177,y:46.6},{x:195,y:66.6}])for(const [a,b]of [[from,northLibrarySites[0].entrance],[northLibrarySites[0].entrance,from]]){
  const path=checkedRoute(run.state,a,b,'north cross-domain route');assert.ok(path.length<=160);assert.equal(validateScenic({...run.state.master.scenic,...a,path,goal:b},run.state),true);
 }
});

test('explicit northern journeys preserve their legal turns within the extended path save limit',()=>{
 const run=session();run.command('enableCourtyardTerrain');run.command('enableSectDomain');run.command('enableWestValley');
 const before=copy(run.state),repeat=Array.from({length:81},()=>({x:28,y:12.6}));
 assert.equal(validateScenic({...before.personsById['person:master'].scenic,x:28,y:12.6,path:repeat,goal:repeat[0]},run.state),false);
 run.command('enableNorthLibrary');assert.equal(run.state.spatial.eastResidences,undefined);
 for(const site of westValleySites)for(const [from,to]of [[site.entrance,northLibrarySites[0].entrance],[northLibrarySites[0].entrance,site.entrance]]){
  const path=checkedRoute(run.state,from,to,'valley and north actual public route');
  assert.ok(path.length<=160);if([17,19].includes(site.number))assert.ok(path.length>80);
  const actor={...run.state.master.scenic,...from,path,goal:to};assert.equal(validateScenic(actor,run.state),true);
  const bytes=JSON.stringify(actor);assert.equal(validateScenic(JSON.parse(bytes),run.state),true);assert.equal(JSON.stringify(actor),bytes);
 }
 const west=westValleySites.find(s=>s.number===17).entrance,arrived=()=>Math.hypot(run.state.master.scenic.x-west.x,run.state.master.scenic.y-west.y)<.01;
 for(let i=0;i<5000&&!arrived();i++){if(i%200===0)run.command('moveScenicMaster',west.x,west.y);run.step();}assert.ok(arrived());
 run.command('moveScenicMaster',northLibrarySites[0].entrance.x,northLibrarySites[0].entrance.y);assert.ok(run.state.master.scenic.path.length>80);run.restore();run.step();run.restore();
 const bad=copy(run.state),actor=bad.personsById['person:master'].scenic;actor.path=[...Array.from({length:513-actor.path.length},()=>({...actor.path[0]})),...actor.path];const bytes=JSON.stringify(bad);
 assert.equal(validateScenic(actor,run.state),false);assert.throws(()=>validateSave(bad));assert.equal(JSON.stringify(bad),bytes);
});

test('public finite gathering and local trade fund actual northern construction with transit and work save reads',()=>{
 const run=enabled(),HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',MERCHANT='person:merchant-qingxi';
 const before=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite',northLibrarySites[0].id),/材料不足/);assert.equal(JSON.stringify(run.state),before);
 for(let i=0;i<2;i++){run.command('startMasterHarvest','wood');run.until(s=>!s.master.activityId,'actual wood harvest');}
 let order=run.command('startTransport',CARRIED,HOME,MASTER,{wood:24});run.until(s=>s.workOrdersById[order.id]?.phase==='delivered','wood reaches HOME');
 run.command('startMasterHarvest','stone');run.until(s=>!s.master.activityId,'finite stone harvested');
 const present=s=>{const p=s.personsById[MERCHANT];return p.position?.sceneId==='scene:yunxiu-courtyard'&&(!p.courtyardVisit||p.courtyardVisit.phase==='present');};
 let quoted=false;for(let attempt=0;attempt<5&&!quoted;attempt++){run.until(present,'merchant actually arrives');const at=run.state.personsById[MERCHANT].position;run.command('moveScenicMaster',at.x+1,at.y);run.until(s=>!s.master.scenic.path.length,'master approaches merchant');quoted=localMarketQuote(run.state,{resource:'stone',side:'sell',batches:1,stockpileId:CARRIED}).available;}
 assert.equal(quoted,true);run.command('marketTrade','stone','sell',1,{stockpileId:CARRIED});const jade=run.state.stockpilesById[CARRIED].resources.jade;order=run.command('startTransport',CARRIED,HOME,MASTER,{jade});run.until(s=>s.workOrdersById[order.id]?.phase==='delivered','earned jade reaches HOME');
 const materials=copy(run.state.stockpilesById[HOME].resources),built=run.command('buildDomainSite',northLibrarySites[0].id);let carried=false,working=false;
 for(const [key,quantity]of Object.entries({jade:65,wood:45,stone:20}))assert.equal(materials[key]-run.state.stockpilesById[HOME].resources[key],quantity);
 for(let i=0;i<10000&&run.state.workOrdersById[built.workOrderId];i++){
  const from={...run.state.master.scenic};run.step();assert.equal(meterSweep(run.state,from,run.state.master.scenic).blocked,false);
  const o=run.state.workOrdersById[built.workOrderId];if(!o)break;
  if(!carried&&run.state.master.scenic.y<0&&o.materialFlow.phase==='carrying'){run.restore();carried=true;}
  if(!working&&o.progressTicks>=25){run.restore();working=true;}
 }
 assert.ok(carried&&working);const b=run.state.buildings.find(b=>b.domainSiteId===northLibrarySites[0].id);assert.ok(b);assert.deepEqual(b.transform,{x:44,y:-16,orientation:'south'});assert.equal(spatialSlots(b,'study').length,2);
 const completed=run.state.spatial.completedOrders.filter(o=>o.id===built.workOrderId);assert.equal(completed.length,1);assert.deepEqual(completed[0].usedCost,{jade:65,wood:45,stone:20});assert.ok(completed[0].materialTrips.every(t=>t.phase==='delivered'));run.restore();
 for(const mutate of [s=>delete s.spatial.northLibrary,s=>delete s.buildingsById[b.instanceId].domainSiteId,s=>s.buildingsById[b.instanceId].domainSiteId='site:domain:gc-03']){const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad));assert.equal(JSON.stringify(bad),text);}
});
