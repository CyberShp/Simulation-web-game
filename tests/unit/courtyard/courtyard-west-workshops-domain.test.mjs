import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {domainBounds,SECT_DOMAIN} from '../../../src/simulation/ea-sect-domain.mjs';
import {WEST_WORKSHOPS_VERSION,westWorkshopSites} from '../../../src/simulation/ea-west-workshops-geometry.mjs';
import {spatialAccess,spatialPrefab,spatialSlots,placementIssue,handlers} from '../../../src/simulation/ea-sr-spatial.mjs';
const copy=value=>structuredClone(value);
function setup(){let state=validateSave(copy(seed.state));return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;}};}
function valley(){const r=setup();for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley'])r.command(name);return r;}

test('existing valley worlds retain their exact state and both new fixed sites remain locked',()=>{
 const r=valley(),before=copy(r.state),bytes=JSON.stringify(before);
 assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 assert.equal(r.state.spatial.westWorkshops,undefined);
 for(const site of westWorkshopSites){
  assert.throws(()=>r.command('buildDomainSite',site.id),site.type==='workshop'?/需山院初成/:/西谷双院通路/);
  assert.throws(()=>handlers.buildDomainSite(r.state,site.id),/西谷双院通路/);
  assert.deepEqual(r.state,before);
  assert.match(placementIssue(r.state,site.type,site.x,site.y,{checkPeople:false}),/已规划并开放/);
 }
 for(const number of [21,22,23])assert.equal(SECT_DOMAIN.plannedSites.find(site=>site.number===number).runtimeStatus,'planning');
 assert.deepEqual(domainBounds(r.state.spatial.extentVersion),{x:-84,y:0,width:244,height:96});
});

test('the optional workshop opening record rejects unknown or inconsistent metadata without rewriting input',()=>{
 const r=valley();r.command('enableWestWorkshops');const s=copy(r.state);
 const bytes=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 for(const mutate of [s=>s.spatial.westWorkshops=null,s=>s.spatial.westWorkshops.version='unknown',s=>delete s.spatial.westWorkshops.openedAtTick,s=>s.spatial.westWorkshops.openedAtTick=-1,s=>s.spatial.westWorkshops.openedAtTick=s.worldTick+1,s=>s.spatial.westWorkshops.extra=true,s=>s.spatial.extentVersion='yunxiu-domain-west-1',s=>delete s.spatial.courtyardTerrain]){
  const bad=copy(s);mutate(bad);const raw=JSON.stringify(bad);assert.throws(()=>validateSave(bad));assert.equal(JSON.stringify(bad),raw);
 }
});

test('the public workshop opening preserves all existing entities and supplies and requires the existing valley',()=>{
 const r=valley(),before=copy(r.state),revision=before.spatial.geometryRevision;
 assert.deepEqual(r.command('enableWestWorkshops'),{enabled:true,alreadyEnabled:false,version:WEST_WORKSHOPS_VERSION});
 const opened=copy(r.state);assert.deepEqual(opened.spatial.westWorkshops,{version:WEST_WORKSHOPS_VERSION,openedAtTick:before.worldTick});
 assert.equal(opened.revision,before.revision+1);assert.equal(opened.transactions.nextCommandId,before.transactions.nextCommandId+1);
 delete opened.spatial.westWorkshops;opened.spatial.geometryRevision=revision;opened.revision=before.revision;opened.transactions=before.transactions;assert.deepEqual(opened,before);
 const bytes=JSON.stringify(r.state);assert.equal(handlers.enableWestWorkshops(r.state).alreadyEnabled,true);assert.equal(JSON.stringify(r.state),bytes);
 assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 const closed=setup(),original=copy(closed.state);assert.throws(()=>closed.command('enableWestWorkshops'),/西谷通路/);assert.deepEqual(closed.state,original);
});

test('fixed workshop footprints retain furnace identity and provide the declared process stations',()=>{
 for(const site of westWorkshopSites)for(const level of [1,2,3]){
  const b={id:80,instanceId:'building:yunxiu:80',type:site.type,level,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',domainSiteId:site.id,transform:{x:site.x,y:site.y,orientation:'south'}};
  const prefab=spatialPrefab(b),size=4+level*2;
  assert.deepEqual([prefab.width,prefab.height],[size,size]);assert.equal(prefab.indoor,true);
  assert.deepEqual(spatialAccess(b),{x:site.x+size/2,y:site.y+size+.6});
  const work=spatialSlots(b,'work');assert.equal(work.length,site.type==='alchemy'?4:2);
  assert.equal(new Set(work.map(slot=>slot.id)).size,work.length);
  for(const slot of work){assert(slot.position.x>site.x&&slot.position.x<site.x+size);assert(slot.position.y>site.y&&slot.position.y<site.y+size);}
  const legacy={...b};delete legacy.domainSiteId;
  if(site.type==='alchemy'){
   const oldPrefab=spatialPrefab(legacy);assert.deepEqual(oldPrefab.furniture,prefab.furniture.filter(item=>item.kind==='furnace'));
   assert.deepEqual(spatialSlots(legacy,'work'),work.filter(slot=>slot.suffix==='work:1'));
   assert.deepEqual(oldPrefab.floor,prefab.floor);assert.deepEqual(oldPrefab.walls,prefab.walls);
  }else{assert.deepEqual(spatialPrefab(legacy),prefab);assert.deepEqual(spatialSlots(legacy,'work'),work);}
 }
});
