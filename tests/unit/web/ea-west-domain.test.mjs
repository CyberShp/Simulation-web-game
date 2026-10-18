import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,tick,validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {BUILDINGS} from '../../../src/simulation/ea-data.mjs';
import {DOMAIN_EXTENT_VERSION,DOMAIN_EAST_EXTENT_VERSION,SECT_DOMAIN,westLumberSite,firstSite,westValleySites,COURTYARD_WEST_ROAD} from '../../../src/simulation/ea-sect-domain.mjs';
import {meterCanStand,meterFindPath,meterSweep,meterNearest,spatialBounds,spatialSlots} from '../../../src/simulation/ea-sr-spatial.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
function session(source=seed.state){
 let state=validateSave(copy(source));
 return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;},step(){tick(state,.1);},until(predicate,label,max=6000){for(let n=0;n<max&&!predicate(state);n++)tick(state,.1);assert.ok(predicate(state),label);},restore(){const text=JSON.stringify(state);state=validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);}};
}
function ready(){const run=session();run.command('enableSectDomain');run.command('enableCourtyardTerrain');return run;}
const stock=run=>run.state.stockpilesById['stockpile:yunxiu'].resources;

test('the 31 approved plots retain original identities and separate registered plans from open work sites',()=>{
 assert.equal(SECT_DOMAIN.plannedSites.length,31);assert.equal(new Set(SECT_DOMAIN.plannedSites.map(s=>s.id)).size,31);
 assert.deepEqual(SECT_DOMAIN.plannedSites.map(s=>s.number),Array.from({length:31},(_,i)=>i+1));
 assert.equal(SECT_DOMAIN.sites[0].id,firstSite.id);assert.deepEqual(SECT_DOMAIN.sites.map(s=>s.id),[firstSite.id,westLumberSite.id,...westValleySites.map(site=>site.id)]);
 for(const plot of SECT_DOMAIN.plannedSites){assert.equal(plot.planId,`GC-${String(plot.number).padStart(2,'0')}`);assert.equal(plot.diagramPosition.length,2);assert.equal(plot.diagramOffsetY,115);}
 assert.equal(SECT_DOMAIN.plannedSites.find(s=>s.number===27).runtimeStatus,'planning');
 const run=ready(),before=JSON.stringify(run.state);
 assert.throws(()=>run.command('buildDomainSite','site:domain:gc-27'),/规划|筹备/);assert.equal(JSON.stringify(run.state),before);
});

test('legacy east saves keep their extent and all existing world facts until explicit west activation',()=>{
 const run=session();assert.equal(run.state.spatial.extentVersion,DOMAIN_EAST_EXTENT_VERSION);
 const before=copy(run.state),bounds=spatialBounds(run.state);run.restore();
 assert.deepEqual(spatialBounds(run.state),bounds);assert.equal(meterCanStand(run.state,westLumberSite.entrance),false);
 assert.ok(meterFindPath(run.state,run.state.master.scenic,firstSite.entrance,{maxSnap:0}));
 assert.throws(()=>run.command('buildDomainSite',westLumberSite.id),/西林/);
 run.command('enableSectDomain');assert.equal(run.state.spatial.extentVersion,DOMAIN_EXTENT_VERSION);
 assert.deepEqual(spatialBounds(run.state),{x:-34,y:0,width:194,height:96});
 for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(run.state[key],before[key],key);
 assert.equal(run.state.spatial.domain.openedAtTick,before.spatial.domain.openedAtTick);run.restore();
});

test('west navigation uses the bridge and forest road while slopes reject standing, shortcuts and saved paths',()=>{
 const run=ready(),source=run.state.stockpilesById['stockpile:yunxiu'].position,path=meterFindPath(run.state,source,westLumberSite.entrance,{maxSnap:0});
 assert.ok(path);for(const gate of COURTYARD_WEST_ROAD)assert.ok(path.some(p=>Math.hypot(p.x-gate.x,p.y-gate.y)<1e-7));
 for(const [i,p]of path.entries())assert.equal(meterSweep(run.state,i?path[i-1]:source,p).blocked,false);
 for(const p of [{x:-2,y:15},{x:-4,y:50},{x:-33,y:30},{x:-35,y:34}])assert.equal(meterCanStand(run.state,p),false);
 assert.equal(meterSweep(run.state,{x:5,y:20},westLumberSite.entrance).blocked,true);
 const nearest=meterNearest(run.state,{x:-9,y:38},{maxDistance:6});assert.ok(nearest?.x<0);assert.equal(meterCanStand(run.state,nearest),true);
 const bad=copy(run.state);bad.personsById['person:master'].scenic.path=[{x:-2,y:15}];assert.throws(()=>validateSave(bad),/路径/);
});

test('construction uses real westbound material travel, resumes during delivery and work, then produces and returns wood',()=>{
 const run=ready(),before=copy(stock(run)),people=Object.keys(run.state.personsById),result=run.command('buildDomainSite',westLumberSite.id);
 let inTransit=false,working=false;
 for(let n=0;n<5000&&run.state.workOrdersById[result.workOrderId];n++){
  const prior={x:run.state.master.scenic.x,y:run.state.master.scenic.y};run.step();const order=run.state.workOrdersById[result.workOrderId];
  assert.ok(Math.hypot(prior.x-run.state.master.scenic.x,prior.y-run.state.master.scenic.y)<.7);
  assert.equal(meterSweep(run.state,prior,run.state.master.scenic).blocked,false);if(!order)break;
  for(const resource of ['wood','stone'])assert.equal(run.state.stockpilesById[order.materialFlow.sourceStockpileId].resources[resource]+run.state.stockpilesById[order.materialFlow.siteStockpileId].resources[resource]+(order.materialFlow.cargo[resource]||0)+(order.usedCost[resource]||0),BUILDINGS.lumber.cost[resource]);
  if(!inTransit&&run.state.master.scenic.x<-1&&order.materialFlow.phase==='carrying'){assert.equal(order.progressTicks,0);run.restore();inTransit=true;}
  if(!working&&order.progressTicks>30){run.restore();working=true;}
 }
 assert.ok(inTransit&&working);const building=run.state.buildings.find(b=>b.domainSiteId===westLumberSite.id);assert.ok(building);
 assert.deepEqual(building.transform,{x:-18,y:28,orientation:'south'});assert.equal(spatialSlots(building,'work').length,2);assert.equal(spatialSlots(building,'rest').length,0);
 assert.deepEqual(Object.keys(run.state.personsById),people);assert.equal(stock(run).wood,before.wood-20);run.restore();
 const beforeDuplicate=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite',westLumberSite.id),/冲突|一处/);assert.equal(JSON.stringify(run.state),beforeDuplicate);
 assert.equal(run.command('inviteWork','person:lu-zhiwei',building.instanceId).accepted,true);
 const workplaceId=`stockpile:${building.instanceId}`;
 run.until(s=>s.stockpilesById[workplaceId]?.resources.wood>=1,'real work produces wood at the west workplace');
 assert.equal(stock(run).wood,before.wood-20,'production remains at its workplace until transport');run.restore();
 const delivery=run.command('startTransport',workplaceId,'stockpile:yunxiu','person:master',{wood:1});
 run.until(s=>s.workOrdersById[delivery.id]?.phase==='delivered','wood physically reaches the original store');
 assert.equal(stock(run).wood,before.wood-19);run.restore();
});

test('material shortage, arbitrary desktop placement and relocation reject without mutation; cancellation returns west cargo once',()=>{
 const shortage=copy(seed.state);shortage.stockpilesById['stockpile:yunxiu'].resources.wood=0;const poor=session(shortage);poor.command('enableSectDomain');poor.command('enableCourtyardTerrain');
 const rejected=JSON.stringify(poor.state);assert.throws(()=>poor.command('buildDomainSite',westLumberSite.id),/wood材料不足/);assert.equal(JSON.stringify(poor.state),rejected);
 const run=ready(),before=copy(stock(run));for(const args of [['lumber',-20,28],['house',40,60]]){const text=JSON.stringify(run.state);assert.throws(()=>run.command('build',...args),/预设|规划/);assert.equal(JSON.stringify(run.state),text);}
 const text=JSON.stringify(run.state);assert.throws(()=>run.command('relocate',2,20,60),/预设|规划/);assert.equal(JSON.stringify(run.state),text);
 const result=run.command('buildDomainSite',westLumberSite.id);run.until(s=>s.master.scenic.x<-1&&s.workOrdersById[result.workOrderId]?.materialFlow.phase==='carrying','west transit starts');
 assert.equal(run.command('cancelConstruction').pending,true);assert.equal(stock(run).wood,before.wood-20);run.restore();
 run.until(s=>!s.workOrdersById[result.workOrderId],'cancelled materials physically return');assert.equal(stock(run).wood,before.wood);assert.equal(stock(run).stone,before.stone);
 assert.equal(run.state.buildings.some(b=>b.domainSiteId===westLumberSite.id),false);const receipt=run.state.spatial.completedOrders.find(o=>o.id===result.workOrderId);assert.equal(receipt.phase,'cancelled');assert.ok(receipt.materialTrips.every(t=>t.phase==='returned'));
 run.command('cancelConstruction');assert.equal(stock(run).wood,before.wood);run.restore();
});

test('a historical courtyard facility retains its identity and position when preset construction becomes active',()=>{
 const run=session(),result=run.command('build','lumber',20,60);
 run.until(s=>!s.workOrdersById[result.workOrderId],'historical free-layout building completes');
 const building=run.state.buildings.find(b=>b.id===result.id),prior=copy(building);
 run.command('enableCourtyardTerrain');run.restore();assert.deepEqual(run.state.buildingsById[building.instanceId],prior);
 run.command('enableSectDomain');run.restore();assert.deepEqual(run.state.buildingsById[building.instanceId],prior);
 const before=JSON.stringify(run.state);assert.throws(()=>run.command('relocate',building.id,24,60),/预设|规划/);assert.equal(JSON.stringify(run.state),before);
});
