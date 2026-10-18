import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {validateScenic} from '../../../src/simulation/ea-scenic.mjs';
import {WEST_WORKSHOPS_ROADS,westWorkshopSites,westWorkshopsPointOpen} from '../../../src/simulation/ea-west-workshops-geometry.mjs';
import {meterFindPath,meterSweep,meterCanStand,spatialAccess,spatialSlots,spatialRevision,spatialExteriorSolids,spatialConstructionExteriorSolids,placementIssue} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,toWorld,routeArt,artSegmentClear} from '../../../apps/courtyard/courtyard-space.mjs';
const copy=value=>structuredClone(value),home={x:28,y:12.6};
const artOptions={domain:true,west:true,valley:true,westWorkshops:true};
function enabled(){let state=validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableWestWorkshops'])state=dispatchCommand(state,{name,args:[]}).state;return state;}
// Geometry fixtures: no claim of financing, elapsed construction or production.
function building(site,id=80,level=1){return {id,instanceId:`building:yunxiu:${id}`,type:site.type,level,domainSiteId:site.id,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:site.x,y:site.y,orientation:'south'},condition:100,enabled:true};}
function route(s,from,to){const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path,JSON.stringify({from,to}));let at=from;for(const p of path){assert.equal(meterSweep(s,at,p,.26).blocked,false);at=p;}assert.ok(Math.hypot(at.x-to.x,at.y-to.y)<1e-8);return path;}
function centroid(o){return o.polygon.reduce((p,[x,y])=>({x:p.x+x/o.polygon.length,y:p.y+y/o.polygon.length}),{x:0,y:0});}

test('the measured bridge carries one real body radius and retains raw tread queries',()=>{
 const s=enabled(),road=WEST_WORKSHOPS_ROADS.find(r=>r.id==='valley-bridge');
 for(let i=1;i<road.centre.length;i++){
  const a=road.centre[i-1],b=road.centre[i],n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025);
  assert.equal(meterSweep(s,a,b,.26).blocked,false);
  for(let j=0;j<=n;j++){
   const p={x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n};assert.ok(meterCanStand(s,p,.26));
   // These are raw ground samples. The centre query already tests .26m collision.
   for(let k=0;k<16;k++){const angle=k*Math.PI/8;assert.ok(westWorkshopsPointOpen({x:p.x+.26*Math.cos(angle),y:p.y+.26*Math.sin(angle)}));}
  }
 }
 for(const native of [[600,420],[600,460],[735,470],[500,510],[350,400]]){const p=toWorld(native[0]-3900,native[1]);assert.equal(westWorkshopsPointOpen(p),false,`rail/post/water ${native}`);}
});

test('both level-one sites connect HOME, each other, and every real work station',()=>{
 const s=enabled(),buildings=westWorkshopSites.map((site,i)=>building(site,80+i));
 for(const b of buildings){assert.equal(placementIssue(s,b.type,b.transform.x,b.transform.y,{checkPeople:false}),'');route(s,home,spatialAccess(b));route(s,spatialAccess(b),home);}
 s.buildings.push(...buildings);s.spatial.geometryRevision++;
 for(const b of buildings){const entry=spatialAccess(b),slots=spatialSlots(b,'work');route(s,home,entry);route(s,entry,home);for(const slot of slots){assert.ok(meterCanStand(s,slot.position));route(s,entry,slot.position);route(s,slot.position,entry);for(const other of slots)route(s,slot.position,other.position);}
  for(const solid of spatialExteriorSolids(b))assert.equal(meterCanStand(s,centroid(solid),.1),false);
 }
 route(s,spatialAccess(buildings[0]),spatialAccess(buildings[1]));route(s,spatialAccess(buildings[1]),spatialAccess(buildings[0]));
});

test('empty, foundation, timber-frame and complete yards preserve the measured entry route',()=>{
 for(const site of westWorkshopSites){const s=enabled(),b=building(site),a={id:'activity:stage',kind:'construction',workOrderId:'work:stage'},o={id:'work:stage',kind:'construction',spatial:true,operation:'build',phase:'active',domainSiteId:site.id,buildingType:site.type,targetLevel:1,targetTransform:b.transform,progressTicks:0,durationTicks:200};
  s.activitiesById[a.id]=a;s.master.activityId=a.id;s.workOrdersById[o.id]=o;
  let oldRevision=spatialRevision(s);
  for(const progressTicks of [0,1,70]){o.progressTicks=progressTicks;const revision=spatialRevision(s);if(progressTicks)assert.notEqual(revision,oldRevision);oldRevision=revision;
   const solids=spatialConstructionExteriorSolids(s);assert.equal(solids.length>0,progressTicks===70);for(const solid of solids)assert.equal(meterCanStand(s,centroid(solid),.1),false);route(s,home,site.entrance);route(s,site.entrance,home);
  }
  delete s.activitiesById[a.id];delete s.workOrdersById[o.id];s.master.activityId=null;s.buildings.push(b);s.spatial.geometryRevision++;
  assert.equal(spatialConstructionExteriorSolids(s).length,0);route(s,home,site.entrance);route(s,site.entrance,home);
 }
});

test('the desktop projection reaches both exact L1 entries through its measured route',()=>{
 const s=enabled(),bytes=JSON.stringify(s);
 for(const site of westWorkshopSites){const start=toArt(home.x,home.y),goal=toArt(site.entrance.x,site.entrance.y),path=routeArt(start,goal,artOptions);assert.ok(path?.length);let at=start;for(const p of path){assert.equal(artSegmentClear(at,p,artOptions),true);at=p;}assert.ok(Math.hypot(at.x-goal.x,at.y-goal.y)<1e-6);}
 assert.equal(JSON.stringify(s),bytes);
});

test('long workshop routes preserve exact transit saves while old path limits and segment checks remain',()=>{
 let s=enabled();for(const site of westWorkshopSites){const path=route(s,home,site.entrance);assert.ok(path.length>80&&path.length<=512);const actor={...s.master.scenic,...home,path,goal:site.entrance};assert.equal(validateScenic(actor,s),true);
  for(const bad of [{...actor,path:Array.from({length:513},()=>({...home}))},{...actor,path:[{x:NaN,y:12.6}]},{...actor,path:[toWorld(-3300,420)]}])assert.equal(validateScenic(bad,s),false);
 }
 s=dispatchCommand(s,{name:'setSpeed',args:[1]}).state;
 const goal=westWorkshopSites[1].entrance;s=dispatchCommand(s,{name:'moveScenicMaster',args:[goal.x,goal.y]}).state;
 assert.ok(s.master.scenic.path.length>80);let bytes=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 for(let i=0;i<60;i++)tick(s,.1);assert.ok(s.master.scenic.steps>seed.state.personsById['person:master'].scenic.steps);
 bytes=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes);
 const old=validateSave(copy(seed.state)),sc=old.master.scenic;assert.equal(validateScenic({...sc,path:Array.from({length:81},()=>({x:sc.x,y:sc.y}))},old),false);
});
