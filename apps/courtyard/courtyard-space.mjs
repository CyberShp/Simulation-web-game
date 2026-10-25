import {HOME_STAIRS_WALK,WALK_POLYGONS,courtyardMainArtWalkable} from '../../src/simulation/ea-courtyard-visible-ground.mjs';
export {HOME_STAIRS_WALK,WALK_POLYGONS};
/** U-144 courtyard-v2 presentation coordinates. World positions remain metres.
 * This profile is read-only. Routes are input waypoints for official move commands.
 */
import {courtyardTerrainPointClear,courtyardTerrainSegmentClear} from '../../src/simulation/ea-courtyard-master-terrain.mjs';
import {domainContains,COURTYARD_EAST_ROAD,courtyardWestPassage,courtyardValleyPassage,WEST_VALLEY_WALK_POLYGONS,DOMAIN_VALLEY_EXTENT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_EAST_EXTENT_VERSION,EAST_RESIDENCES_VERSION,EAST_RESIDENCES_WALK_POLYGONS,courtyardResidencesPassage,EAST_SERVICES_VERSION,EAST_SERVICES_WALK_POLYGONS,courtyardServicesPassage} from '../../src/simulation/ea-sect-domain.mjs';
import {NORTH_LIBRARY_VERSION,NORTH_LIBRARY_WALK_POLYGONS,courtyardNorthLibraryPassage} from '../../src/simulation/ea-sect-domain.mjs';
import {createNorthLibraryProjection,NORTH_LIBRARY_LAYOUT} from './courtyard-north-library-layout.mjs';
import {NORTH_MEDITATION_VERSION,NORTH_MEDITATION_WALK_POLYGONS,courtyardNorthMeditationPassage} from '../../src/simulation/ea-north-meditation-geometry.mjs';
import {WEST_WORKSHOPS_VERSION,WEST_WORKSHOPS_WALK_POLYGONS,courtyardWestWorkshopsPassage} from '../../src/simulation/ea-west-workshops-geometry.mjs';
import {WEST_WORKSHOPS_ART_LEFT,WEST_WORKSHOPS_ART_TOP} from './courtyard-west-workshops-layout.mjs';
import {NORTH_MEDITATION_LAYOUT} from './courtyard-north-meditation-layout.mjs';
import {EAST_LAYOUT,EAST_PATH_CENTER,EAST_TERRACE_WALK} from './courtyard-east-layout.mjs';
import {legacyToArt,legacyToWorld,previousEastArtToWorld,joinDepthShift,lerp,finitePoint,eastVisibleResidencePassage,eastVisibleBodyPoint,eastVisibleRoadInterior,eastRoadArtGroundPoint} from '../../src/simulation/ea-courtyard-east-visible-geometry.mjs';
import {WEST_LAYOUT,WEST_PATH_CENTER,WEST_WALK_POLYGONS} from './courtyard-west-layout.mjs';
import {createResidencesCandidateProjection} from './courtyard-residences-layout.mjs';
import {createServicesProjection} from './courtyard-services-layout.mjs';
import {compileStaticPolygon,compileStaticPolygonUnion} from '../../src/simulation/ea-static-polygon-index.mjs';
export const ART_WIDTH = 1672;
export const ART_HEIGHT = 941;
export const DOMAIN_ART_WIDTH = EAST_LAYOUT.width;
export const DOMAIN_ART_LEFT = WEST_LAYOUT.x;
export const VALLEY_ART_LEFT = -3344;
export const RESIDENCES_ART_RIGHT = 8360;
export const SERVICES_ART_RIGHT = 10032;
export const NORTH_LIBRARY_ART_TOP = NORTH_LIBRARY_LAYOUT.y;
export const NORTH_MEDITATION_ART_TOP = NORTH_MEDITATION_LAYOUT.y;
export const COURTYARD_PROFILE = 'courtyard-v2-east-seams-1';

const residencesProjection=createResidencesCandidateProjection({legacyToArt,legacyToWorld});
const servicesProjection=createServicesProjection({legacyToArt:residencesProjection.toArt,legacyToWorld:residencesProjection.toWorld});
const northLibraryProjection=createNorthLibraryProjection(servicesProjection.toArt,servicesProjection.toWorld);
export const toArt=(x,y)=>northLibraryProjection.toArt(x,y);
export const toWorld=(x,y)=>northLibraryProjection.toWorld(x,y);
// Version-1 presentation saves stored image points before the local seam shift.
export const previousArtToWorld=previousEastArtToWorld;

// Authored inputs are deeply frozen. Candidate indexing retains the original
// edge arithmetic; live buildings, bodies and enabled regions are not cached.
const workshopsGround=compileStaticPolygonUnion(WEST_WORKSHOPS_WALK_POLYGONS);
const meditationGround=compileStaticPolygonUnion(NORTH_MEDITATION_WALK_POLYGONS);
const libraryGround=compileStaticPolygonUnion(NORTH_LIBRARY_WALK_POLYGONS);
const servicesGround=compileStaticPolygonUnion(EAST_SERVICES_WALK_POLYGONS);
const residencesPassage=compileStaticPolygon(EAST_RESIDENCES_WALK_POLYGONS.at(-1));
const valleyGround=compileStaticPolygonUnion(WEST_VALLEY_WALK_POLYGONS);

const inPolygon = (x,y,points) => {
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
};
const segmentDistance = (x,y,a,b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
};

export function isArtWalkable(x,y,{terrain=true,domain=true,west=true,valley=false,residences=false,services=false,northLibrary=false,northMeditation=false,westWorkshops=false}={}) {
  if(!domain&&(x<0||x>ART_WIDTH)||!west&&x<0)return false;
  if (!Number.isFinite(x)||!Number.isFinite(y)||x<(westWorkshops?WEST_WORKSHOPS_ART_LEFT:valley?VALLEY_ART_LEFT:DOMAIN_ART_LEFT)||y<(northMeditation?NORTH_MEDITATION_ART_TOP:northLibrary?NORTH_LIBRARY_ART_TOP:westWorkshops?WEST_WORKSHOPS_ART_TOP:0)||x>(services?SERVICES_ART_RIGHT:residences?RESIDENCES_ART_RIGHT:DOMAIN_ART_WIDTH)||y>ART_HEIGHT) return false;
  const artY=y;y-=joinDepthShift(x);
  const world=toWorld(x,artY),extent=valley?DOMAIN_VALLEY_EXTENT_VERSION:west?DOMAIN_EXTENT_VERSION:DOMAIN_EAST_EXTENT_VERSION,residenceVersion=residences?EAST_RESIDENCES_VERSION:null,serviceVersion=services?EAST_SERVICES_VERSION:null,northVersion=northLibrary?NORTH_LIBRARY_VERSION:null,meditationVersion=northMeditation?NORTH_MEDITATION_VERSION:null,workshopsVersion=westWorkshops?WEST_WORKSHOPS_VERSION:null;
  if(westWorkshops&&workshopsGround.contains(world))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion,workshopsVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northMeditation&&meditationGround.contains(world))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northLibrary&&libraryGround.contains(world))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(services&&(x>=RESIDENCES_ART_RIGHT||servicesGround.contains(world)))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(residences&&(x>=6688||x>=6312&&residencesPassage.contains(world)))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(valley&&west&&x<0&&valleyGround.contains(world))return domainContains(world,.26,extent);
  if(west&&x<78){const local=x-WEST_LAYOUT.x;return (WEST_WALK_POLYGONS.some(p=>inPolygon(local,y,p))||WEST_PATH_CENTER.slice(1).some((b,i)=>segmentDistance(local,y,WEST_PATH_CENTER[i],b)<=24))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);}
  if(x>1440&&eastRoadArtGroundPoint(x,y))return domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if(x>=EAST_LAYOUT.terraceX)return EAST_TERRACE_WALK.some(p=>inPolygon(x-EAST_LAYOUT.terraceX,y,p))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if (terrain&&!courtyardTerrainPointClear(toWorld(x,artY))) return false;
  return courtyardMainArtWalkable(x,y);
}
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function artSegmentClear(a,b,options) {
  const wa=toWorld(a.x,a.y),wb=toWorld(b.x,b.y);
  if(options?.terrain!==false&&!courtyardTerrainSegmentClear(wa,wb))return false;
  const n=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(distance(a,b)/3),Math.ceil(distance(wa,wb)/.025))));
  for(let i=0;i<=n;i++) {
    const world={x:lerp(wa.x,wb.x,i/n),y:lerp(wa.y,wb.y,i/n)},p=toArt(world.x,world.y);
    if(!eastVisibleBodyPoint(world,.26,{residences:options?.residences===true}))return false;
    if(!isArtWalkable(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n),options)||!isArtWalkable(p.x,p.y,options))return false;
  }
  return true;
}
const GRID=8, GRID_TOP=NORTH_MEDITATION_ART_TOP-16, GRID_LEFT=WEST_WORKSHOPS_ART_LEFT,COLS=Math.floor((SERVICES_ART_RIGHT-GRID_LEFT)/GRID)+1, ROW_COUNT=Math.floor((ART_HEIGHT-GRID_TOP)/GRID)+1;
const grids=new Map();
function walkGrid(options) {
  const key=`${options?.terrain!==false}:${options?.domain!==false}:${options?.west!==false}:${options?.valley===true}:${options?.residences===true}:${options?.services===true}:${options?.northLibrary===true}:${options?.northMeditation===true}:${options?.westWorkshops===true}`;
  if (!grids.has(key)) {
    const grid=new Uint8Array(COLS*ROW_COUNT);
    // Cache only queried cells; local routes need not scan unopened distant tiles.
    grids.set(key,grid);
  }
  return grids.get(key);
}
const gridPoint = n => ({x:GRID_LEFT+n%COLS*GRID,y:GRID_TOP+Math.floor(n/COLS)*GRID});
function walkCell(cells,id,options){if(!cells[id]){const p=gridPoint(id);cells[id]=isArtWalkable(p.x,p.y,options)?2:1;}return cells[id]===2;}
function nearbyNode(p,options) {
  const cells=walkGrid(options),ix=Math.round((p.x-GRID_LEFT)/GRID),iy=Math.round((p.y-GRID_TOP)/GRID);
  let result=-1,best=Infinity;
  for(let y=Math.max(0,iy-3);y<=Math.min(ROW_COUNT-1,iy+3);y++) for(let x=Math.max(0,ix-3);x<=Math.min(COLS-1,ix+3);x++) {
    const id=y*COLS+x,q=gridPoint(id),d=distance(p,q);
    if(walkCell(cells,id,options)&&d<best&&artSegmentClear(p,q,options)){best=d;result=id;}
  }
  return result;
}
function push(heap,item) {
  let i=heap.length;heap.push(item);
  while(i){const parent=(i-1)>>1;if(heap[parent].f<=item.f)break;heap[i]=heap[parent];i=parent;}
  heap[i]=item;
}
function pop(heap) {
  const first=heap[0],last=heap.pop();
  if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}
  return first;
}
function shortWaypoints(points,maxStep) {
  const result=[];
  function split(a,b,depth=0) {
    const aa=toArt(a.x,a.y),bb=toArt(b.x,b.y);
    if(depth<18&&(distance(aa,bb)>maxStep||distance(a,b)>.2)) {
      const middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};split(a,middle,depth+1);split(middle,b,depth+1);
    }else result.push(bb);
  }
  for(let i=1;i<points.length;i++) {
    split(toWorld(points[i-1].x,points[i-1].y),toWorld(points[i].x,points[i].y));
  }
  if(result.length)result[result.length-1]={...points.at(-1)};
  return result;
}
function attachEastRoad(art){
  const point=toWorld(art.x,art.y);
  if(art.x<1457)return{index:0,point:COURTYARD_EAST_ROAD[0]};
  let best=null;
  for(let i=1;i<COURTYARD_EAST_ROAD.length;i++){
    const a=COURTYARD_EAST_ROAD[i-1],b=COURTYARD_EAST_ROAD[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));
    const at={x:a.x+dx*t,y:a.y+dy*t},d=distance(point,at);
    if(!best||d<best.distance)best={index:i-1+t,point:at,distance:d};
  }
  return best;
}
function eastRoadRoute(from,to,maxStep,options){
  const a=attachEastRoad(from),b=attachEastRoad(to),start=toArt(a.point.x,a.point.y),end=toArt(b.point.x,b.point.y);
  const first=routeArt(from,start,{...options,maxWaypointDistance:maxStep,useEastRoad:false}),last=routeArt(end,to,{...options,maxWaypointDistance:maxStep,useEastRoad:false});
  if(!first||!last)return null;
  const direction=Math.sign(b.index-a.index),inner=COURTYARD_EAST_ROAD.map((p,index)=>({p,index})).filter(({index})=>index>Math.min(a.index,b.index)&&index<Math.max(a.index,b.index));
  if(direction<0)inner.reverse();
  const middle=shortWaypoints(eastVisibleRoadInterior([a.point,...inner.map(({p})=>p),b.point]).map(p=>toArt(p.x,p.y)),maxStep);
  if(!middle.every(p=>isArtWalkable(p.x,p.y,options)&&eastVisibleBodyPoint(toWorld(p.x,p.y),.26,{residences:options.residences===true})))return null;
  return [...first,...middle,...last];
}
function westRoadRoute(from,to,maxStep,options){
  const passage=courtyardWestPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
  if(!passage?.length)return null;
  const points=passage.map(p=>toArt(p.x,p.y));
  const first=routeArt(from,points[0],{...options,maxWaypointDistance:maxStep,useWestRoad:false});
  const last=routeArt(points.at(-1),to,{...options,maxWaypointDistance:maxStep,useWestRoad:false});
  if(!first||!last)return null;
  const middle=shortWaypoints(points,maxStep);
  if(!middle.every(p=>isArtWalkable(p.x,p.y,options)&&eastVisibleBodyPoint(toWorld(p.x,p.y),.26,{residences:options.residences===true})))return null;
  return [...first,...middle,...last];
}
/** Return art waypoints excluding the starting point; null means unavailable.
 * Execute one corresponding official world move at a time, waiting for arrival.
 */
export function routeArt(from,to,{maxWaypointDistance=18,useEastRoad=true,useWestRoad=true,useValleyRoad=true,useResidencesRoad=true,useServicesRoad=true,useNorthLibraryRoad=true,useNorthMeditationRoad=true,useWestWorkshopsRoad=true,terrain=true,domain=true,west=true,valley=false,residences=false,services=false,northLibrary=false,northMeditation=false,westWorkshops=false}={}) {
  const options={terrain,domain,west,valley,residences,services,northLibrary,northMeditation,westWorkshops,useNorthLibraryRoad,useNorthMeditationRoad,useWestWorkshopsRoad};
  if(!finitePoint(from)||!finitePoint(to)||!isArtWalkable(from.x,from.y,options)||!isArtWalkable(to.x,to.y,options))return null;
  if(!Number.isFinite(maxWaypointDistance)||maxWaypointDistance<=0) return null;
  const maxStep=Math.min(18,maxWaypointDistance);
  if(distance(from,to)<.001)return [];
  if(useWestWorkshopsRoad&&westWorkshops){
    const passage=courtyardWestWorkshopsPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useResidencesRoad,useServicesRoad,useWestWorkshopsRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every((p,i)=>artSegmentClear(i?middle[i-1]:points[0],p,options)))return [...first,...middle,...last];
    }
  }
  if(useNorthMeditationRoad&&northMeditation){
    const passage=courtyardNorthMeditationPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useResidencesRoad,useServicesRoad,useNorthMeditationRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every((p,i)=>artSegmentClear(i?middle[i-1]:points[0],p,options)))return [...first,...middle,...last];
    }
  }
  if(useNorthLibraryRoad&&northLibrary){
    const passage=courtyardNorthLibraryPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useResidencesRoad,useServicesRoad,useNorthLibraryRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every((p,i)=>artSegmentClear(i?middle[i-1]:points[0],p,options)))return [...first,...middle,...last];
    }
  }
  if(useServicesRoad&&services){
    const passage=courtyardServicesPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useResidencesRoad,useServicesRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every((p,i)=>artSegmentClear(i?middle[i-1]:points[0],p,options)))return [...first,...middle,...last];
    }
  }
  if(useResidencesRoad&&residences){
    const passage=eastVisibleResidencePassage(courtyardResidencesPassage(toWorld(from.x,from.y),toWorld(to.x,to.y)));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useServicesRoad,useResidencesRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every(p=>isArtWalkable(p.x,p.y,options)&&eastVisibleBodyPoint(toWorld(p.x,p.y),.26,{residences:options.residences===true})))return [...first,...middle,...last];
    }
  }
  if(useValleyRoad&&valley){
    const passage=courtyardValleyPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useResidencesRoad,useServicesRoad,useValleyRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every(p=>isArtWalkable(p.x,p.y,options)&&eastVisibleBodyPoint(toWorld(p.x,p.y),.26,{residences:options.residences===true})))return [...first,...middle,...last];
    }
  }
  if(useWestRoad&&west&&Math.min(from.x,to.x)<0){
    const road=westRoadRoute(from,to,maxStep,{...options,useEastRoad,useResidencesRoad,useServicesRoad,useValleyRoad:false});if(road)return road;
  }
  if(useEastRoad&&!(northLibrary&&(toWorld(from.x,from.y).y<0||toWorld(to.x,to.y).y<0))&&Math.max(from.x,to.x)>ART_WIDTH&&Math.min(from.x,to.x)<EAST_LAYOUT.terraceX){
    const road=eastRoadRoute(from,to,maxStep,{...options,useWestRoad,useValleyRoad,useResidencesRoad,useServicesRoad});if(road)return road;
  }
  if(artSegmentClear(from,to,options))return shortWaypoints([from,to],maxStep);
  const start=nearbyNode(from,options),goal=nearbyNode(to,options),cells=walkGrid(options);
  if(start<0||goal<0)return null;
  const g=new Float64Array(cells.length).fill(Infinity),previous=new Int32Array(cells.length).fill(-1),closed=new Uint8Array(cells.length),open=[];
  g[start]=0;push(open,{id:start,f:distance(gridPoint(start),to)});
  while(open.length){
    const {id}=pop(open);if(closed[id])continue;closed[id]=1;
    if(id===goal){
      const indices=[];for(let at=goal;at!==start;at=previous[at])indices.push(at);indices.reverse();
      const raw=[from,gridPoint(start),...indices.map(gridPoint),to],simple=[from];
      let at=0;
      while(at<raw.length-1){let next=at+1;while(next+1<raw.length&&artSegmentClear(raw[at],raw[next+1],options))next++;simple.push(raw[next]);at=next;}
      return shortWaypoints(simple,maxStep);
    }
    const x=id%COLS,y=Math.floor(id/COLS),a=gridPoint(id);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROW_COUNT)continue;
      const next=ny*COLS+nx;if(closed[next]||!walkCell(cells,next,options))continue;
      const b=gridPoint(next),score=g[id]+distance(a,b);if(score>=g[next])continue;
      if(!artSegmentClear(a,b,options))continue;
      g[next]=score;previous[next]=id;push(open,{id:next,f:score+distance(b,to)});
    }
  }
  return null;
}
export function routeWorld(from,to,options) {
  if(!finitePoint(from)||!finitePoint(to))return null;
  const points=routeArt(toArt(from.x,from.y),toArt(to.x,to.y),options);
  return points?.map(p=>toWorld(p.x,p.y))??null;
}
const reviewPoint = (x,y) => Object.freeze({art:Object.freeze({x,y}),world:Object.freeze(toWorld(x,y))});
export const REVIEW_POINTS = Object.freeze({
  courtyard:reviewPoint(720,530),
  hallEntrance:reviewPoint(680,407),
  farmDropoff:reviewPoint(450,820),
  farmRow:reviewPoint(500,750),
  eastPath:reviewPoint(1290,495),
  westPath:reviewPoint(180,625),
  southSteps:reviewPoint(870,903),
});
