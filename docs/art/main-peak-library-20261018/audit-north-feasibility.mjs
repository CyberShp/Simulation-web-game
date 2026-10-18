import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toArt as oldArt,toWorld as oldWorld,isArtWalkable,routeArt} from '../../../apps/courtyard/courtyard-space.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {COURTYARD_EAST_ROAD} from '../../../src/simulation/ea-sect-domain.mjs';
import {meterCanStand,meterSweep,meterFindPath,spatialPrefab,spatialTerrain,polygonContains} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';
import {createNorthCandidateProjection,NORTH_SITE,NORTH_TILE} from './north-projection-candidate.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const projection=createNorthCandidateProjection(oldArt,oldWorld),options={valley:true,residences:true,services:true};
const report={kind:'source geometry and document-only projection candidate',runtimeIntegrated:false,desktopRun:false,generatedArt:false,sourceHashes:Object.fromEntries(['apps/courtyard/courtyard-space.mjs','apps/courtyard/courtyard-renderer.mjs','src/simulation/ea-sr-spatial.mjs','src/simulation/ea-sect-domain.mjs','assets/courtyard/courtyard-master-v2.png','docs/art/main-peak-library-20261018/north-projection-candidate.mjs','docs/art/main-peak-library-20261018/geometry-candidate.json'].map(p=>[p,hash(p)])),failures:[]};
const {toArt,toWorld}=projection;
let oldPoints=0,oldNegativeArtPoints=0,oldMismatch=0,oldInverseMismatch=0;
for(let x=-84;x<=214;x+=2)for(let y=0;y<=96;y+=1.5){const a=oldArt(x,y),b=toArt(x,y);oldPoints++;if(a.y<0)oldNegativeArtPoints++;if(!Object.is(a.x,b.x)||!Object.is(a.y,b.y))oldMismatch++;const c=oldWorld(a.x,a.y),d=toWorld(a.x,a.y);if(!Object.is(c.x,d.x)||!Object.is(c.y,d.y))oldInverseMismatch++;}
report.compatibility={oldPoints,oldNegativeArtPoints,oldMismatch,oldInverseMismatch};
if(oldMismatch||oldInverseMismatch)report.failures.push('old projection bit preservation');
let newPoints=0,maxRoundTripMetres=0,minHorizontalStep=Infinity,minDepthStep=Infinity,minFixedWorldVerticalStep=Infinity;
const {left,right}=projection.worldStrip;
for(let x=left;x<=right+.00001;x+=.25)for(let y=-32;y<0;y+=.25){const a=toArt(x,y),b=toWorld(a.x,a.y);newPoints++;maxRoundTripMetres=Math.max(maxRoundTripMetres,Math.hypot(b.x-x,b.y-y));if(x+.25<=right)minHorizontalStep=Math.min(minHorizontalStep,toArt(x+.25,y).x-a.x);minFixedWorldVerticalStep=Math.min(minFixedWorldVerticalStep,toArt(x,y+.001).y-a.y);}
for(let x=836;x<=2508;x+=4)for(let y=-32;y<0;y+=.25)minDepthStep=Math.min(minDepthStep,projection.depth(x,y+.001)-projection.depth(x,y));
report.newProjection={newPoints,maxRoundTripMetres,minHorizontalStep,minDepthStep,minFixedWorldVerticalStep,worldStrip:projection.worldStrip,horizontalTarget:projection.horizontalTarget};
if(maxRoundTripMetres>1e-8||minHorizontalStep<=0||minDepthStep<=0||minFixedWorldVerticalStep<=0)report.failures.push('north monotonicity or inverse');
report.seam=[];
for(const x of [836,1025,1200,1376,1500,1616,1672,1800,2000,2176,2286,2508]){const bx=projection.toWorld(x,projection.boundary(x)),w=bx.x,a=toArt(w,-1e-6),b=oldArt(w,0),c=toArt(w,1e-6);report.seam.push({artX:x,boundaryY:projection.boundary(x),worldX:w,below:a,at:b,above:c,maxRoundTrip:Math.max(...[-1e-6,0,1e-6].map(y=>{const p=toArt(w,y),q=toWorld(p.x,p.y);return Math.hypot(q.x-w,q.y-y);})),ordered:a.y<b.y&&b.y<c.y});}
if(report.seam.some(p=>!p.ordered))report.failures.push('seam vertical order');
let state=validateSave(structuredClone(seed.state));
for(const name of ['enableSectDomain','enableCourtyardTerrain','enableWestValley','enableEastResidences'])state=dispatchCommand(state,{name,args:[]}).state;
const before=JSON.stringify(state),home={x:28,y:12.6},anchor=COURTYARD_EAST_ROAD.find(p=>p.x>47&&p.x<48),homeArt=oldArt(home.x,home.y),anchorArt=oldArt(anchor.x,anchor.y);
const artRoute=routeArt(homeArt,anchorArt,options);
let previous=home,blocked=0,walkFailures=0;
for(const art of artRoute||[]){const next=oldWorld(art.x,art.y);if(meterSweep(state,previous,next).blocked)blocked++;if(!isArtWalkable(art.x,art.y,options))walkFailures++;previous=next;}
report.existingApproach={fixture:'validated sect-seed plus public enable commands; no time advanced',home,homeArt,anchor,anchorArt,artWaypoints:artRoute?.length??null,coreSegmentFailures:blocked,artWaypointFailures:walkFailures,queryPreservedState:JSON.stringify(state)===before};
if(!artRoute||blocked||walkFailures||JSON.stringify(state)!==before)report.failures.push('existing approach fixture');
// Observations of the visible path, followed by the pine-covered connection.
// Clear collision here is only one predicate: most of this path is not an
// authored walkable surface in the current desktop.
const rearArt=[[1536,374],[1535,345],[1495,310],[1415,280],[1355,245],[1295,210],[1235,195],[1180,175],[1145,150],[1105,127],[1080,110],[1030,70],[1025,0],[1025,-41.25],[1025,-50],[1025,-120]];
report.rearApproach=rearArt.map(([x,y],i)=>{const p=oldWorld(x,y),prev=i?oldWorld(...rearArt[i-1]):p;return {art:[x,y],world:p,canStand:meterCanStand(state,p),artWalkable:isArtWalkable(x,y,options),previousSegmentCoreClear:!meterSweep(state,prev,p).blocked,terrainBlockers:spatialTerrain(state).filter(t=>polygonContains(p,t.polygon,.26)).map(t=>t.id),visual:i<=6?'visible road centre candidate':i<=9?'ground obscured by pine; needs ground/occlusion proof':i<=12?'visible stair candidate':'future north connection'};});
report.fallbackBranch=[[1295,210],[1320,150],[1330,95],[1320,35],[1320,0],[1320,-120]].map(art=>({art,world:oldWorld(...art),status:'new stair/ground design target, not current road'}));
const authorGeometry=JSON.parse(fs.readFileSync(path.join(dir,'geometry-candidate.json')));
const guardedRear=authorGeometry.roads.find(r=>r.id==='original-rear-approach').centre;
report.hallReserveApproach=[];
for(const level of [1,3]){const fixture={...state,buildings:state.buildings.map(b=>structuredClone(b))};fixture.buildings.find(b=>b.type==='hall').level=level;let a=guardedRear[0],blocked=[];for(let i=1;i<guardedRear.length;i++){const b=guardedRear[i];if(meterSweep(fixture,a,b).blocked)blocked.push(i);a=b;}report.hallReserveApproach.push({hallLevel:level,maximumMetres:level===3?12:8,blockedSegments:blocked,centre:guardedRear.map(world=>({world,art:oldArt(world.x,world.y)})),status:'source collision fixture only; pine-covered surface requires image generation and measurement'});if(blocked.length)report.failures.push('rear approach versus hall reserve');}
report.siteLevels=[];
for(let level=1;level<=3;level++){
 const b={id:900,type:'library',level,buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:'adult-furniture-1',transform:{...NORTH_SITE,orientation:'south'}};
 const p=spatialPrefab(b),world=point=>({x:NORTH_SITE.x+point.x,y:NORTH_SITE.y+point.y}),art=point=>{const a=toArt(point.x,point.y);return {global:a,local:{x:a.x-NORTH_TILE.x,y:a.y-NORTH_TILE.y}};};
 const corners=p.footprint.map(([x,y])=>world({x,y})),access=world(p.access),roadWorld=toWorld(toArt(access.x,access.y).x,-211);
 const foot=corners.map(art),door=world(p.door);
 const ax=toArt(access.x,access.y).x,ay=toArt(access.x,access.y).y,n=Math.ceil((-211-ay)/3),branch=Array.from({length:n+1},(_,i)=>toWorld(ax,ay+(-211-ay)*i/n));
 // The current world does not admit negative y. Translate the unchanged
 // prefab into an interior-only fixture to check its existing room furniture.
 const roomFixture={...state,buildings:state.buildings.map(b=>structuredClone(b))},roomBuilding={...b,transform:{x:60,y:60,orientation:'south'}};roomFixture.buildings.push(roomBuilding);
 const interiorFrom={x:60+p.access.x,y:60+p.access.y};
 const interiorChecks=p.slots.map(slot=>{const goal={x:60+slot.position.x,y:60+slot.position.y},route=meterFindPath(roomFixture,interiorFrom,goal,{maxSnap:0});let at=interiorFrom,blocked=false;for(const to of route||[]){blocked||=meterSweep(roomFixture,at,to).blocked;at=to;}return {kind:slot.kind,label:slot.label,routeFound:route!==null,segments:route?.length??null,blocked};});
 if(interiorChecks.some(c=>!c.routeFound||c.blocked))report.failures.push('library interior fixture level '+level);
 report.siteLevels.push({level,metres:[p.width,p.height],anchor:{x:NORTH_SITE.x,y:NORTH_SITE.y},footprintWorld:corners,footprintArt:foot,door:{world:door,...art(door)},access:{world:access,...art(access)},waiting:p.waiting.map(point=>({world:world(point),...art(world(point))})),roadAtDoor:{world:roadWorld,...art(roadWorld)},branch,minimumFootToRoadNorthPixels:-241-Math.max(...foot.map(f=>f.global.y)),studyCount:p.slots.filter(s=>s.kind==='study').length,slots:p.slots.map(s=>({kind:s.kind,label:s.label,world:world(s.position),...art(world(s.position))})),interiorFixture:{translation:[60,60],claim:'existing room geometry only; not placement or construction',checks:interiorChecks}});
}
report.boundaryNotes={oldArtYZeroAtRear:oldWorld(1025,0),oldWorldYZeroAtRear:oldArt(oldWorld(1025,0).x,0),northSlopeBodyLimitWorldY:1.26,northSlopeBodyLimitArt:oldArt(oldWorld(1025,0).x,1.26),recommendedWorldBounds:{north:-24,south:96},recommendedArtBounds:{top:-941,bottom:941},candidatePublicRoadArtY:-211,candidatePublicRoadHalfWidth:30,scope:'new footprint and ground are design targets only; no new walkable polygon declared'};
fs.writeFileSync(path.join(dir,'spatial-feasibility-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({compatibility:report.compatibility,newProjection:report.newProjection,existingApproach:report.existingApproach,seam:report.seam.map(p=>({x:p.artX,b:p.boundaryY,ordered:p.ordered,error:p.maxRoundTrip})),siteLevels:report.siteLevels.map(p=>({level:p.level,foot:p.footprintArt.map(f=>f.local),access:p.access.local,road:p.roadAtDoor.local,gap:p.minimumFootToRoadNorthPixels})),failures:report.failures},null,2));
if(report.failures.length)process.exitCode=1;
