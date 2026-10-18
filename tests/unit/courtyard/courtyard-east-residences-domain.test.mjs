import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,validateSave,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION,EAST_RESIDENCES_VERSION,domainWestEnabled,domainValleyEnabled,eastResidenceSites,firstSite,EAST_RESIDENCES_ROADS} from '../../../src/simulation/ea-sect-domain.mjs';
import {spatialBounds,spatialAccess,spatialSlots,meterFindPath,meterSweep,meterCanStand,placementIssue} from '../../../src/simulation/ea-sr-spatial.mjs';
import {validateScenic} from '../../../src/simulation/ea-scenic.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';
import {toArt,toWorld,routeArt,isArtWalkable,artSegmentClear} from '../../../apps/courtyard/courtyard-space.mjs';
import {RESIDENCES_SITES} from '../../../apps/courtyard/courtyard-residences-layout.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
function session(source=seed.state){let state=validateSave(copy(source));return {get state(){return state;},command(name,...args){const response=dispatchCommand(state,{name,args});state=response.state;return response.result;},step(){tick(state,.1);},until(predicate,label,max=9000){for(let i=0;i<max&&!predicate(state);i++)tick(state,.1);assert.ok(predicate(state),label);},restore(){const text=JSON.stringify(state);state=validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);}};}

test('residence plans retain GC09 and keep the three added plots locked until explicit activation',()=>{
 assert.deepEqual([firstSite.id,firstSite.x,firstSite.y,firstSite.reserveWidth],['site:domain:east-residence-1',132,40,12]);
 assert.deepEqual(eastResidenceSites.map(s=>[s.number,s.x,s.y]),[[10,168,60],[11,162,40],[12,174,40]]);
 const run=session();
 for(const site of eastResidenceSites){
  assert.equal(site.type,'house');assert.equal(site.residences,true);assert.equal(site.reserveWidth,10);assert.equal(site.reserveHeight,10);
  assert.equal(site.x%2,0);assert.equal(site.y%2,0);const before=JSON.stringify(run.state);
  assert.throws(()=>run.command('buildDomainSite',site.id),/住宅通路/);assert.equal(JSON.stringify(run.state),before);
 }
});

test('residential projection preserves the frozen old domain and matches all three measured first-level doors',()=>{
 const old=[];for(const x of [-84,-64,-34,-18,0,8,12,24,36,56,96,132,156,160])for(const y of [0,4,12.6,28,40,46.6,60,72,96]){const art=toArt(x,y);old.push({x,y,art,world:toWorld(art.x,art.y)});}
 // Recorded from the completed west-valley projection before adding east residences.
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'85df666eab65228272ddbf29de887d0af121155bc97a439a58a71220e5c9b87c');
 for(const site of eastResidenceSites){const art=RESIDENCES_SITES.find(p=>p.id===site.id),entry=toArt(site.entrance.x,site.entrance.y);assert.ok(Math.hypot(entry.x-6688-art.entrance[0],entry.y-art.entrance[1])<1e-8);}
 for(let x=160;x<=186;x+=.5)for(let y=0;y<=96;y+=.5){const art=toArt(x,y),world=toWorld(art.x,art.y);assert.ok(Math.hypot(world.x-x,world.y-y)<1e-8);if(y<96)assert.ok(toArt(x,y+.5).y>art.y);if(x<186)assert.ok(toArt(x+.5,y).x>art.x);}
});

test('east residences open independently and preserve every existing region and world fact',()=>{
 for(const extent of ['courtyard-96-1',DOMAIN_EAST_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION]){
  const source=copy(seed.state);
  // Compatibility fixtures change only the recorded extent; all entities are in the original courtyard.
  if(extent==='courtyard-96-1'){source.spatial.extentVersion=extent;delete source.spatial.domain;}
  const run=session(source);
  if([DOMAIN_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION].includes(extent))run.command('enableSectDomain');
  if(extent===DOMAIN_VALLEY_EXTENT_VERSION)run.command('enableWestValley');
  const before=copy(run.state),result=run.command('enableEastResidences');
  assert.equal(result.alreadyEnabled,false);
  assert.equal(run.state.spatial.extentVersion,extent==='courtyard-96-1'?DOMAIN_EAST_EXTENT_VERSION:extent);
  assert.equal(domainWestEnabled(run.state.spatial.extentVersion),domainWestEnabled(extent));
  assert.equal(domainValleyEnabled(run.state.spatial.extentVersion),domainValleyEnabled(extent));
  assert.deepEqual(run.state.spatial.eastResidences,{version:EAST_RESIDENCES_VERSION,openedAtTick:before.worldTick});
  const bounds=spatialBounds(run.state);assert.equal(bounds.x+bounds.width,186);
  for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById'])assert.deepEqual(run.state[key],before[key],key);
  if(before.spatial.domain)assert.deepEqual(run.state.spatial.domain,before.spatial.domain);
  run.restore();const enabled=JSON.stringify(run.state);assert.equal(run.command('enableEastResidences').alreadyEnabled,true);
  // The public command receipt is allowed to change; the spatial record is idempotent.
  assert.deepEqual(run.state.spatial,JSON.parse(enabled).spatial);
  if(!domainWestEnabled(extent)){run.command('enableSectDomain');assert.deepEqual(run.state.spatial.eastResidences,{version:EAST_RESIDENCES_VERSION,openedAtTick:before.worldTick});}
 }
});

test('residential extent metadata is read without hydration and rejects malformed records atomically',()=>{
 const run=session(),old=JSON.stringify(run.state);run.restore();assert.equal(JSON.stringify(run.state),old);assert.equal(run.state.spatial.eastResidences,undefined);
 run.command('enableEastResidences');
 for(const mutate of [s=>s.spatial.eastResidences=null,s=>s.spatial.eastResidences.version='unknown',s=>delete s.spatial.eastResidences.openedAtTick,s=>s.spatial.eastResidences.openedAtTick=s.worldTick+1,s=>s.spatial.eastResidences.extra=true,s=>{s.spatial.extentVersion='courtyard-96-1';delete s.spatial.domain;}]){
  const bad=copy(run.state);mutate(bad);const original=JSON.stringify(bad);assert.throws(()=>validateSave(bad),/住宅/);assert.equal(JSON.stringify(bad),original);
 }
});

test('adult residence interiors retain old bed identities and reach every physical bed at each level',()=>{
 const run=session();run.command('enableEastResidences');const s=run.state;
 // Isolated prefab geometry: exterior terrain and normal construction are checked separately.
 const building={id:80,instanceId:'building:yunxiu:80',type:'house',level:1,buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:'adult-furniture-1',transform:{x:162,y:40,orientation:'south'}};
 s.buildings.push(building);let previous=[];
 for(const level of [1,2,3]){
  building.level=level;s.spatial.geometryRevision++;const beds=spatialSlots(building,'rest'),care=spatialSlots(building,'heal'),entry=spatialAccess(building);
  assert.equal(beds.length,4*level);assert.deepEqual(beds.slice(0,previous.length).map(b=>b.id),previous);
  assert.deepEqual(care.map(b=>b.position),beds.map(b=>b.position));
  for(const bed of beds){const path=meterFindPath(s,entry,bed.position,{maxSnap:0});assert.ok(path,`${level}/${bed.id}`);for(const [i,p]of path.entries())assert.equal(meterSweep(s,i?path[i-1]:entry,p).blocked,false);assert.ok(meterFindPath(s,bed.position,entry,{maxSnap:0}));}
  previous=beds.map(b=>b.id);
 }
});

test('all residence levels share measured exterior ground, connected doors and physical bed routes',()=>{
 const run=session();run.command('enableCourtyardTerrain');run.command('enableEastResidences');const s=run.state;
 // Isolated geometry fixture: every maximum residence coexists with the existing courtyard.
 const houses=[firstSite,...eastResidenceSites].map((site,i)=>({id:80+i,instanceId:`building:yunxiu:${80+i}`,type:'house',level:3,domainSiteId:site.id,buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:'adult-furniture-1',transform:{x:site.x,y:site.y,orientation:'south'}}));
 s.buildings.push(...houses);s.spatial.geometryRevision++;
 const checkPath=(from,to,label)=>{const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path,label);for(const [i,p]of path.entries())assert.equal(meterSweep(s,i?path[i-1]:from,p).blocked,false,label);return path;};
 for(const house of houses){
  for(const level of [1,2,3]){house.level=level;s.spatial.geometryRevision++;const entry=spatialAccess(house);
   assert.equal(placementIssue(s,'house',house.transform.x,house.transform.y,{ignoreId:house.id,level,checkPeople:false,checkConnectivity:false}),'');
   checkPath(s.master.scenic,entry,`${house.domainSiteId}/${level}/entrance`);checkPath(entry,s.master.scenic,'return');
   const beds=spatialSlots(house,'rest');assert.equal(beds.length,4*level);for(const bed of beds){checkPath(entry,bed.position,bed.id);checkPath(bed.position,entry,bed.id);}
  }
 }
 for(const from of houses)for(const to of houses)if(from!==to)checkPath(spatialAccess(from),spatialAccess(to),'between maximum residences');
 for(const road of Object.entries(EAST_RESIDENCES_ROADS).filter(([key])=>!key.startsWith('branch:')).map(([,road])=>road))for(const point of road)assert.equal(meterCanStand(s,point),true);
 for(const point of [{x:158,y:44},{x:166,y:56},{x:185,y:20},{x:181,y:64}])assert.equal(meterCanStand(s,point),false);
});

test('residential art routes follow measured metres and retain closed boundaries before activation',()=>{
 const run=session();run.command('enableCourtyardTerrain');run.command('enableEastResidences');const s=run.state,options={residences:true,west:false};
 for(const site of eastResidenceSites){
  const from=toArt(s.master.scenic.x,s.master.scenic.y),to=toArt(site.entrance.x,site.entrance.y);
  assert.equal(isArtWalkable(to.x,to.y,{residences:false,west:false}),false);
  const route=routeArt(from,to,options);assert.ok(route,site.id);assert.deepEqual(route.at(-1),to);
  for(const [i,p]of route.entries()){const previous=i?route[i-1]:from;assert.equal(artSegmentClear(previous,p,options),true,`${site.id}/${i}`);assert.equal(meterSweep(s,toWorld(previous.x,previous.y),toWorld(p.x,p.y)).blocked,false);}
 }
 for(const point of [{x:158,y:44},{x:185,y:20}]){const art=toArt(point.x,point.y);assert.equal(isArtWalkable(art.x,art.y,options),false);}
});

test('a residence is built from normal gathered materials and preserves delivery and construction through save reads',()=>{
 const run=session();run.command('enableCourtyardTerrain');run.command('enableEastResidences');const home='stockpile:yunxiu',site=eastResidenceSites.find(p=>p.number===11);
 for(let batch=0;batch<2;batch++){
  run.command('startMasterHarvest','wood');run.until(s=>!s.master.activityId,'finite wood gathered');
  const cargo=run.command('startTransport','stockpile:carried:master',home,'person:master',{wood:12});run.until(s=>s.workOrdersById[cargo.id]?.phase==='delivered','gathered wood delivered');
 }
 const before=copy(run.state.stockpilesById[home].resources),result=run.command('buildDomainSite',site.id);let transit=false,working=false;
 for(let i=0;i<9000&&run.state.workOrdersById[result.workOrderId];i++){
  const from={...run.state.master.scenic};run.step();assert.equal(meterSweep(run.state,from,run.state.master.scenic).blocked,false);
  const order=run.state.workOrdersById[result.workOrderId];if(!order)break;
  if(!transit&&run.state.master.scenic.x>156&&order.materialFlow.phase==='carrying'){assert.equal(order.progressTicks,0);run.restore();run.command('setSpeed',0);const paused=JSON.stringify(run.state);run.step();assert.equal(JSON.stringify(run.state),paused);run.command('setSpeed',1);transit=true;}
  if(!working&&order.progressTicks>=40){run.restore();working=true;}
 }
 assert.ok(transit&&working);const built=run.state.buildings.find(b=>b.domainSiteId===site.id);assert.ok(built);assert.deepEqual(built.transform,{x:162,y:40,orientation:'south'});assert.equal(spatialSlots(built,'rest').length,4);
 assert.equal(run.state.stockpilesById[home].resources.wood,before.wood-40);assert.equal(run.state.stockpilesById[home].resources.stone,before.stone-20);assert.equal(run.state.spatial.completedOrders.filter(o=>o.id===result.workOrderId).length,1);run.restore();
 const unchanged=JSON.stringify(run.state);assert.throws(()=>run.command('buildDomainSite',site.id),/冲突|一处/);assert.equal(JSON.stringify(run.state),unchanged);
});

test('long legitimate valley-to-residence journeys survive reads while the old and new point limits stay strict',()=>{
 const run=session();for(const command of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableEastResidences'])run.command(command);
 const west={x:-36,y:18.6},arrived=point=>Math.hypot(run.state.master.scenic.x-point.x,run.state.master.scenic.y-point.y)<.01;
 const walkTo=point=>{for(let i=0;i<7000&&!arrived(point);i++){if(i%200===0)run.command('moveScenicMaster',point.x,point.y);run.step();}assert.ok(arrived(point));};
 for(const site of eastResidenceSites){
  walkTo(west);run.command('moveScenicMaster',site.entrance.x,site.entrance.y);
  const a=run.state.master.scenic;assert.ok(a.path.length>80&&a.path.length<=160);assert.equal(validateScenic(a,run.state),true);run.restore();run.step();run.restore();
  // Design 62: expanded districts retain up to 512 real route turns; old scenes keep 80.
  const bad=copy(run.state),actor=bad.personsById['person:master'].scenic;actor.path=[...Array.from({length:513-actor.path.length},()=>({...actor.path[0]})),...actor.path];const before=JSON.stringify(bad);
  assert.equal(validateScenic(actor,run.state),false);assert.throws(()=>validateSave(bad));assert.equal(JSON.stringify(bad),before);
  walkTo(site.entrance);run.restore();
 }
 const old=session(),a={...old.state.master.scenic,path:Array.from({length:81},()=>({x:old.state.master.scenic.x,y:old.state.master.scenic.y}))};assert.equal(validateScenic(a,old.state),false);
});
