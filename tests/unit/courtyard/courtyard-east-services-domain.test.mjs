import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,validateSave,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {EAST_SERVICES_VERSION,DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION,domainBounds,domainContains,eastServiceSites,EAST_SERVICES_ROADS,domainWestEnabled,domainValleyEnabled} from '../../../src/simulation/ea-sect-domain.mjs';
import {facilityBodyKinds,facilitySlots,slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {SITE_SERVICE_VERSION} from '../../../src/simulation/ea-service-definitions.mjs';
import {validateScenic} from '../../../src/simulation/ea-scenic.mjs';
import {spatialBounds,spatialPrefab,spatialAccess,spatialSlots,spatialExteriorSolids,meterFindPath,meterSweep,meterCanStand,placementIssue,spatialRevision,handlers as spatialHandlers} from '../../../src/simulation/ea-sr-spatial.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
function session(source=seed.state){let state=validateSave(copy(source));return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;},step(){tick(state,.1);},until(predicate,label,max=9000){for(let i=0;i<max&&!predicate(state);i++)tick(state,.1);assert.ok(predicate(state),label);},restore(){const bytes=JSON.stringify(state);state=validateSave(JSON.parse(bytes));assert.equal(JSON.stringify(state),bytes);}};}
function enabled(){const run=session();for(const name of ['enableCourtyardTerrain','enableEastResidences','enableEastServices'])run.command(name);return run;}
const physicalKinds=['work','eat','rest','treatment'];
function route(s,from,to,label){const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path,label);let previous=from;for(const p of path){assert.equal(meterSweep(s,previous,p).blocked,false,label);previous=p;}return path;}
function building(site,id=80){return {id,instanceId:`building:yunxiu:${id}`,type:site.type,level:1,domainSiteId:site.id,serviceVersion:SITE_SERVICE_VERSION,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:site.x,y:site.y,orientation:'south'}};}

test('service sites use fixed even-metre anchors and require explicit roads',()=>{
 assert.deepEqual(eastServiceSites.map(s=>[s.number,s.type,s.x,s.y,s.reserveWidth,s.reserveHeight]),[[13,'kitchen',192,60,10,10],[14,'clinic',196,40,10,10]]);
 const run=session();run.command('enableCourtyardTerrain');run.command('enableEastResidences');
 const before=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite','site:domain:gc-13'),/生活院通路/);assert.equal(JSON.stringify(run.state),before);
 for(const site of eastServiceSites){assert.equal(site.services,true);assert.equal(domainContains(site.entrance,.26,run.state.spatial.extentVersion,run.state.spatial.eastResidences.version),false);}
});

test('opening services preserves old coordinates, resources, identity and independently opened regions',()=>{
 for(const extent of [DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION]){
  const run=session();run.command('enableCourtyardTerrain');if(extent!==DOMAIN_EAST_EXTENT_VERSION)run.command('enableSectDomain');if(extent===DOMAIN_VALLEY_EXTENT_VERSION)run.command('enableWestValley');run.command('enableEastResidences');
  const before=copy(run.state),result=run.command('enableEastServices');assert.equal(result.alreadyEnabled,false);assert.deepEqual(run.state.spatial.eastServices,{version:EAST_SERVICES_VERSION,openedAtTick:before.worldTick});
  assert.equal(run.state.spatial.extentVersion,extent);assert.equal(spatialBounds(run.state).x+spatialBounds(run.state).width,214);assert.equal(domainWestEnabled(extent),domainWestEnabled(run.state.spatial.extentVersion));assert.equal(domainValleyEnabled(extent),domainValleyEnabled(run.state.spatial.extentVersion));
  for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById','factsById'])assert.deepEqual(run.state[key],before[key],key);
  run.restore();const opened=copy(run.state.spatial);assert.equal(run.command('enableEastServices').alreadyEnabled,true);assert.deepEqual(run.state.spatial,opened);
 }
});

test('optional service extent is not hydrated and malformed activation records preserve their bytes',()=>{
 const old=session(),bytes=JSON.stringify(old.state);old.restore();assert.equal(JSON.stringify(old.state),bytes);assert.equal(old.state.spatial.eastServices,undefined);
 for(const prepare of [()=>{},run=>run.command('enableEastResidences')]){const run=session();prepare(run);const before=JSON.stringify(run.state);assert.throws(()=>run.command('enableEastServices'),/住宅通路|实景道路/);assert.equal(JSON.stringify(run.state),before);}
 const run=enabled();
 for(const mutate of [s=>s.spatial.eastServices=null,s=>s.spatial.eastServices.version='unknown',s=>delete s.spatial.eastServices.openedAtTick,s=>s.spatial.eastServices.openedAtTick=s.worldTick+1,s=>s.spatial.eastServices.openedAtTick=-1,s=>s.spatial.eastServices.extra=true,s=>delete s.spatial.eastResidences,s=>delete s.spatial.courtyardTerrain]){
  const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/生活院|住宅/);assert.equal(JSON.stringify(bad),text);
 }
});

test('new interiors reach all real stations at every level while unmarked kitchen and clinic remain unchanged',()=>{
 const run=enabled(),s=run.state,instances=eastServiceSites.map((site,i)=>building(site,80+i));s.buildings.push(...instances);s.spatial.geometryRevision++;
 for(const kind of ['eat','treatment'])assert.deepEqual(facilitySlots({...s,spatial:null},s.buildings[0],kind),[]);
 for(const b of instances){const old={...b};delete old.serviceVersion;const legacy=JSON.stringify(spatialPrefab(old));assert.equal(spatialSlots(old,'eat').length,0);assert.equal(spatialSlots(old,'treatment').length,0);assert.equal(spatialSlots(old,'work').length,b.type==='kitchen'?1:0);
  for(const level of [1,2,3]){b.level=level;s.spatial.geometryRevision++;const entry=spatialAccess(b),prefab=spatialPrefab(b);
   assert.deepEqual([prefab.width,prefab.height],[4+level*2,4+level*2]);assert.equal(placementIssue(s,b.type,b.transform.x,b.transform.y,{ignoreId:b.id,level,checkPeople:false,checkConnectivity:false}),'');
   route(s,s.master.scenic,entry,`${b.type} L${level} source`);route(s,entry,s.master.scenic,'return');
   for(const kind of physicalKinds)for(const slot of spatialSlots(b,kind)){assert.ok(meterCanStand(s,slot.position),slot.id);assert.equal(slotById(s,slot.id)?.id,slot.id);route(s,entry,slot.position,slot.id);}
   if(b.type==='kitchen'){assert.equal(spatialSlots(b,'eat').length,4*level);assert.deepEqual(spatialSlots(b,'work').map(s=>s.suffix),['work:1','work:special:1']);}
   else{assert.equal(spatialSlots(b,'rest').length,4*level);assert.deepEqual(spatialSlots(b,'heal').map(s=>s.position),spatialSlots(b,'rest').map(s=>s.position));assert.equal(spatialSlots(b,'treatment').length,1);assert.equal(spatialSlots(b,'work')[0].suffix,'doctor:1');}
  }
  assert.equal(JSON.stringify(spatialPrefab(old)),legacy);
 }
});

test('measured service joins and ground constrain both directions and exterior attachments stay solid',()=>{
 const run=enabled(),s=run.state;
 for(const [name,points]of Object.entries(EAST_SERVICES_ROADS)){if(name==='rescue')continue;for(let i=1;i<points.length;i++){if(points[i].x>213.73)continue;assert.equal(meterSweep(s,points[i-1],points[i]).blocked,false,`${name}/${i}`);}}
 for(const p of [{x:200,y:25},{x:211,y:60},{x:202,y:56},{x:213,y:35}])assert.equal(meterCanStand(s,p),false);
 const instances=eastServiceSites.map((site,i)=>building(site,80+i));s.buildings.push(...instances);s.spatial.geometryRevision++;
 route(s,spatialAccess(instances[0]),spatialAccess(instances[1]),'kitchen to clinic');route(s,spatialAccess(instances[1]),spatialAccess(instances[0]),'clinic to kitchen');
 for(const b of instances){const solids=spatialExteriorSolids(b);assert.ok(solids.length);for(const o of solids){const p=o.polygon.reduce((s,p)=>({x:s.x+p[0]/o.polygon.length,y:s.y+p[1]/o.polygon.length}),{x:0,y:0});assert.equal(meterCanStand(s,p,.1),false,o.id);}}
});

test('normal gathered materials reach and build GC13 with transit and construction save reads',()=>{
 const run=enabled(),home='stockpile:yunxiu';const unprepared=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite','site:domain:gc-13'),/wood材料不足/);assert.equal(JSON.stringify(run.state),unprepared);assert.throws(()=>run.command('buildDomainSite','site:domain:gc-14'));assert.equal(JSON.stringify(run.state),unprepared);run.command('startMasterHarvest','wood');run.until(s=>!s.master.activityId,'wood collected');const transfer=run.command('startTransport','stockpile:carried:master',home,'person:master',{wood:12});run.until(s=>s.workOrdersById[transfer.id]?.phase==='delivered','wood delivered');
 const before=copy(run.state.stockpilesById[home].resources),result=run.command('buildDomainSite','site:domain:gc-13');let transit=false,working=false;
 for(let i=0;i<11000&&run.state.workOrdersById[result.workOrderId];i++){
  const from={...run.state.master.scenic};run.step();assert.equal(meterSweep(run.state,from,run.state.master.scenic).blocked,false);
  const order=run.state.workOrdersById[result.workOrderId];if(!order)break;
  assert.equal(order.serviceVersion,SITE_SERVICE_VERSION);
  if(!transit&&run.state.master.scenic.x>186&&order.materialFlow.phase==='carrying'){assert.equal(order.progressTicks,0);run.restore();for(const value of [undefined,'unknown']){const bad=copy(run.state);if(value===undefined)delete bad.workOrdersById[result.workOrderId].serviceVersion;else bad.workOrdersById[result.workOrderId].serviceVersion=value;const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/生活设施施工版本/);assert.equal(JSON.stringify(bad),text);}transit=true;}
  if(!working&&order.progressTicks>=40){run.restore();working=true;}
 }
 assert.ok(transit&&working);const b=run.state.buildings.find(b=>b.domainSiteId==='site:domain:gc-13');assert.ok(b);assert.equal(b.serviceVersion,SITE_SERVICE_VERSION);assert.equal(spatialSlots(b,'eat').length,4);assert.deepEqual(b.transform,{x:192,y:60,orientation:'south'});
 const stockId=`stockpile:${b.instanceId}`,stock=run.state.stockpilesById[stockId];assert.ok(stock);assert.deepEqual(stock.position,{sceneId:'scene:yunxiu-courtyard',...spatialAccess(b)});assert.equal(stock.capacity,320);assert.deepEqual(stock.resources,{jade:0,wood:0,stone:0,food:0,herb:0,crystal:0,insight:0});
 assert.equal(run.state.stockpilesById[home].resources.wood,before.wood-35);assert.equal(run.state.stockpilesById[home].resources.stone,before.stone-20);assert.equal(run.state.spatial.completedOrders.filter(o=>o.id===result.workOrderId).length,1);run.restore();
 for(const mutate of [s=>delete s.stockpilesById[stockId],s=>s.stockpilesById[stockId].id='stockpile:wrong',s=>s.stockpilesById[stockId].buildingId='building:yunxiu:1',s=>delete s.stockpilesById[stockId].ownerId,s=>s.stockpilesById[stockId].custodianId='person:lu-zhiwei',s=>s.stockpilesById[stockId].access='private',s=>s.stockpilesById[stockId].capacity=640,s=>s.stockpilesById[stockId].position.x+=1,s=>delete s.stockpilesById[stockId].position]){const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/货位|库存|仓|stockpile/);assert.equal(JSON.stringify(bad),text);}
 // Focused transaction fixtures exercise the construction guard before any payment.
 for(const kind of ['sr-site-service','sr-site-meal'])for(const operation of ['upgrade','relocate','demolish']){const s=validateSave(copy(run.state));s.workOrdersById['work:service:guard']={id:'work:service:guard',kind,targetId:b.instanceId,phase:'waiting-output'};const text=JSON.stringify(s);assert.throws(()=>spatialHandlers[operation](s,b.id,192,60),/服务事务/);assert.equal(JSON.stringify(s),text);}
 const unchanged=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite','site:domain:gc-13'),/一座|一处/);assert.equal(JSON.stringify(run.state),unchanged);
 const factId=`fact:site-service:${b.instanceId}`,fact=copy(run.state.factsById[factId]);assert.equal(fact.version,SITE_SERVICE_VERSION);
 for(const mutate of [s=>s.buildingsById[b.instanceId].serviceVersion='unknown',s=>delete s.buildingsById[b.instanceId].serviceVersion,s=>delete s.factsById[factId],s=>s.factsById[factId].version='unknown',s=>s.factsById[factId].siteId='site:domain:gc-14',s=>s.factsById[factId].atTick=s.worldTick+1,s=>s.factsById[factId].extra=true]){const bad=copy(run.state);mutate(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/生活设施|tick字段/);assert.equal(JSON.stringify(bad),text);}
 const demolished=run.command('demolish',b.id);run.until(s=>!s.workOrdersById[demolished.workOrderId],'formal demolition completed');assert.equal(run.state.buildingsById[b.instanceId],undefined);assert.deepEqual(run.state.factsById[factId],fact);assert.equal(run.state.stockpilesById[stockId].removedBuildingId,b.instanceId);assert.equal(run.state.stockpilesById[stockId].buildingId,undefined);run.restore();
});

test('valley to service public routes keep the existing 160-point save contract',()=>{
 const run=enabled();run.command('enableSectDomain');run.command('enableWestValley');
 const from={x:-34,y:28.6};for(const site of eastServiceSites){const path=route(run.state,from,site.entrance,site.id);assert.ok(path.length>80&&path.length<=160);assert.equal(validateScenic({...run.state.master.scenic,...from,path,goal:site.entrance},run.state),true);}
});
