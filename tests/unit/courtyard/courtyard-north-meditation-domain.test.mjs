import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {domainBounds} from '../../../src/simulation/ea-sect-domain.mjs';
import {NORTH_MEDITATION_VERSION,NORTH_MEDITATION_ROADS,NORTH_MEDITATION_FEET,northMeditationSites} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
import {spatialAccess,spatialPrefab,spatialSlots,spatialExteriorSolids,meterCanStand,meterFindPath,meterSweep,placementIssue} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,toWorld,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
const copy=v=>structuredClone(v),site=northMeditationSites[0],options={terrain:true,domain:true,west:true,valley:true,residences:true,services:true,northLibrary:true,northMeditation:true};
function setup(){let state=validateSave(copy(seed.state));return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;}};}
function enabled(){const r=setup();for(const n of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableEastResidences','enableEastServices','enableNorthLibrary','enableNorthMeditation'])r.command(n);return r;}
function route(s,a,b){const path=meterFindPath(s,a,b,{maxSnap:0});assert.ok(path);let from=a;for(const to of path){assert.equal(meterSweep(s,from,to).blocked,false);from=to;}assert.ok(path.length<=512);return path;}

test('north meditation opens explicitly after the library road and preserves every world fact',()=>{
 const r=setup(),initial=copy(r.state);assert.throws(()=>r.command('enableNorthMeditation'),/藏经阁/);assert.deepEqual(r.state,initial);
 for(const n of ['enableCourtyardTerrain','enableNorthLibrary'])r.command(n);
 const before=copy(r.state);r.command('enableNorthMeditation');assert.deepEqual(r.state.spatial.northMeditation,{version:NORTH_MEDITATION_VERSION,openedAtTick:before.worldTick});
 for(const key of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById','factsById'])assert.deepEqual(r.state[key],before[key],key);
 assert.equal(r.state.spiritSources,undefined);const bytes=JSON.stringify(r.state);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 const again=copy(r.state);assert.equal(r.command('enableNorthMeditation').alreadyEnabled,true);assert.deepEqual(r.state.spatial,again.spatial);for(const key of ['worldTick','rngState','personsById','stockpilesById','factsById'])assert.deepEqual(r.state[key],again[key]);
 const bounds=domainBounds(r.state.spatial.extentVersion,null,null,r.state.spatial.northLibrary.version,NORTH_MEDITATION_VERSION);assert.equal(bounds.y,-52);assert.equal(bounds.height,148);
});
test('northern opening metadata is optional and malformed versions or chronology preserve input on rejection',()=>{
 const old=setup().state,bytes=JSON.stringify(old);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 const r=enabled();for(const mutate of [s=>s.spatial.northMeditation=null,s=>s.spatial.northMeditation.version='unknown',s=>delete s.spatial.northMeditation.openedAtTick,s=>s.spatial.northMeditation.openedAtTick=-1,s=>s.spatial.northMeditation.openedAtTick=s.worldTick+1,s=>s.spatial.northMeditation.extra=true,s=>delete s.spatial.northLibrary]){const s=copy(r.state);mutate(s);const raw=JSON.stringify(s);assert.throws(()=>validateSave(s));assert.equal(JSON.stringify(s),raw);}
});
test('the three footprints share four actual mats, two maintenance feet and eight individual solid bases',()=>{
 for(const level of [1,2,3]){
  const r=enabled(),s=r.state;assert.equal(placementIssue(s,'meditation',44,-46,{level,checkPeople:false}),'');
  // Geometry fixture only: this does not claim paid construction or commissioned supply.
  const b={id:80,instanceId:'building:yunxiu:80',type:'meditation',level,condition:100,enabled:true,domainSiteId:site.id,buildingGridVersion:'building-units-1',transform:{x:44,y:-46,orientation:'south'}};
  s.buildings.push(b);s.spatial.geometryRevision++;const prefab=spatialPrefab(b),entry=spatialAccess(b);
  assert.deepEqual([prefab.width,prefab.height],[4+level*2,4+level*2]);assert.equal(prefab.indoor,false);assert.equal(spatialExteriorSolids(b).length,8);
  for(const foot of NORTH_MEDITATION_FEET){const slots=spatialSlots(b,foot.kind),slot=slots.find(q=>q.suffix===foot.suffix);assert.deepEqual(slot.position,foot.position);assert(meterCanStand(s,slot.position));route(s,entry,slot.position);const art=toArt(slot.position.x,slot.position.y);assert(isArtWalkable(art.x,art.y,options));}
  route(s,{x:47,y:-9.4},entry);route(s,entry,{x:47,y:-9.4});
 }
});
test('surveyed road segments and entry feet retain the same reversible projection and full body clearance',()=>{
 const s=enabled().state;
 for(const road of NORTH_MEDITATION_ROADS)for(let i=1;i<road.centre.length;i++){
  const a=road.centre[i-1],b=road.centre[i];assert.equal(meterSweep(s,a,b).blocked,false,road.id);
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.1));
  for(let j=0;j<=count;j++){const p={x:a.x+(b.x-a.x)*j/count,y:a.y+(b.y-a.y)*j/count},art=toArt(p.x,p.y),back=toWorld(art.x,art.y);assert(Math.hypot(back.x-p.x,back.y-p.y)<1e-7);assert(isArtWalkable(art.x,art.y,options),`${road.id} ${j}`);}
 }
 for(const start of [{x:28,y:12.6},{x:-37.1,y:15.2},{x:195,y:66.6}]){route(s,start,site.entrance);route(s,site.entrance,start);}
 const before=copy(s);assert.throws(()=>dispatchCommand(s,{name:'buildDomainSite',args:[site.id]}),/勘察/);assert.deepEqual(s,before);
});
