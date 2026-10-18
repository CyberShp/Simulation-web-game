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
import {WEST_LAYOUT,WEST_PATH_CENTER,WEST_WALK_POLYGONS} from './courtyard-west-layout.mjs';
import {createResidencesCandidateProjection} from './courtyard-residences-layout.mjs';
import {createServicesProjection} from './courtyard-services-layout.mjs';
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

const X = [0, 8, 12, 14, 16, 20, 24, 28, 32, 36, 44, 56, 96, 160];
// Each row is monotone in both world depth and art depth. Interpolated X rows
// stay strictly monotone, giving one exact inverse even between calibration rows.
const ROWS = [
  { y: 0, v: -120, x: [-800,-280,-100,0,100,300,500,680,900,1120,1420,1870,3370,5770] },
  { y: 4, v: 130, x: [-800,-280,-100,0,100,300,500,680,900,1120,1420,1870,3370,5770] },
  { y: 12, v: 315, x: [-800,-280,-100,0,100,300,500,680,900,1120,1420,1870,3370,5770] },
  { y: 12.6, v: 407, x: [-800,-280,-100,0,100,300,500,680,900,1120,1420,1870,3370,5770] },
  { y: 20, v: 475, x: [-560,-100,70,160,250,420,570,710,895,1080,1390,1840,3340,5740] },
  { y: 28, v: 545, x: [-450,0,180,265,660,685,710,750,900,1060,1350,1800,3300,5700] },
  { y: 36, v: 653, x: [-360,-20,160,250,710,730,755,805,945,1100,1430,1850,3350,5750] },
  { y: 40, v: 750, x: [-300,-10,230,405,650,705,775,850,970,1120,1440,1870,3370,5770] },
  { y: 44, v: 810, x: [-300,-10,230,405,580,685,790,875,1000,1150,1470,1900,3400,5800] },
  { y: 44.6, v: 820, x: [-260,30,275,450,625,710,800,880,1005,1160,1480,1910,3410,5810] },
  { y: 45.5, v: 860, x: [-220,50,550,590,625,720,810,890,1020,1180,1500,1930,3430,5830] },
  { y: 48, v: 900, x: [-200,70,295,450,605,720,815,900,1030,1190,1510,1940,3440,5840] },
  { y: 52, v: 980, x: [-180,100,300,450,600,715,810,900,1030,1190,1510,1940,3440,5840] },
  { y: 96, v: 1860, x: [-180,100,300,450,600,715,810,900,1030,1190,1510,1940,3440,5840] },
];
const interval = (values, value) => {
  let i = 0;
  while (i < values.length - 2 && value > values[i + 1]) i++;
  return i;
};
const lerp = (a,b,t) => a + (b-a)*t;
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
function rowAt(value, key) {
  const i = interval(ROWS.map(row => row[key]), value), a = ROWS[i], b = ROWS[i+1];
  const t = (value-a[key])/(b[key]-a[key]);
  return { y: lerp(a.y,b.y,t), v: lerp(a.v,b.v,t), x: a.x.map((x,n) => lerp(x,b.x[n],t)) };
}
function baseToArt(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const row = rowAt(y,'y'), i = interval(X,x), t = (x-X[i])/(X[i+1]-X[i]);
  return { x: lerp(row.x[i],row.x[i+1],t), y: row.v };
}
function baseToWorld(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const row = rowAt(y,'v'), i = interval(row.x,x), t = (x-row.x[i])/(row.x[i+1]-row.x[i]);
  return { x: lerp(X[i],X[i+1],t), y: row.y };
}

// Two triangular, monotone transforms keep the courtyard core calibrated and
// give the opened road one reversible projection. Neither transform edits metres.
const horizontalAnchors=[[50.72,1672],[90,3344],[120,5016],[126,5516],
  [132,5796],[135,6021],[138,6246],[156,6688],[160,6808]];
function interpolatePairs(pairs,value){const i=interval(pairs.map(p=>p[0]),value),a=pairs[i],b=pairs[i+1];return lerp(a[1],b[1],(value-a[0])/(b[0]-a[0]));}
function horizontalProjection(baseX,baseY){
  if(baseX<=ART_WIDTH)return baseX;
  const worldX=baseToWorld(baseX,baseY).x,target=interpolatePairs(horizontalAnchors,worldX);
  const fraction=Math.min(1,(baseX-ART_WIDTH)/528);
  return lerp(baseX,target,fraction);
}
function inverseHorizontal(x,baseY){
  if(x<=ART_WIDTH)return x;
  if(x>=horizontalProjection(2200,baseY)){
    const worldX=interpolatePairs(horizontalAnchors.map(([world,art])=>[art,world]),x);
    return baseToArt(worldX,baseToWorld(0,baseY).y).x;
  }
  let lo=ART_WIDTH,hi=Math.max(8000,x*2);
  while(horizontalProjection(hi,baseY)<x)hi*=2;
  for(let n=0;n<48;n++){const mid=(lo+hi)/2;if(horizontalProjection(mid,baseY)<x)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
const depthKeys=[-120,130,315,407,475,545,653,750,810,820,860,868,877.6,900,980,1340,1860];
const terraceDepth=[-300,-200,-60,65,125,190,260,340,380,385,405,410,420,455,545,865,1225];
const depthColumns=[{x:ART_WIDTH,values:depthKeys}];
function roadSourceDepth(artX){
  const road=COURTYARD_EAST_ROAD.filter(p=>p.x>=50.72&&p.x<=90).map(p=>[p.x,p.y]);
  let lo=50.72,hi=90;
  for(let n=0;n<44;n++){const x=(lo+hi)/2,y=interpolatePairs(road,x),p=baseToArt(x,y);if(horizontalProjection(p.x,p.y)<artX)lo=x;else hi=x;}
  const x=(lo+hi)/2,y=interpolatePairs(road,x);
  return baseToArt(x,y).y;
}
// Frequent road columns follow the formal diagonal's changes in depth, while
// the authored centreline determines only its on-screen shape.
for(let x=ART_WIDTH+1;x<3344;x+=x<1752?1:32){const y=interpolatePairs(EAST_PATH_CENTER,x),sourceY=roadSourceDepth(x);depthColumns.push({x,values:depthKeys.map(v=>y+(v-sourceY)*.8)});}
depthColumns.push({x:3344,values:depthKeys.map(v=>interpolatePairs(EAST_PATH_CENTER,3344)+(v-810)*.8)});
for(const [x,y] of EAST_PATH_CENTER.filter(p=>p[0]>3344))depthColumns.push({x,values:depthKeys.map(v=>y+(v-810)*.8)});
depthColumns.push(
  {x:5350,values:terraceDepth.map(v=>v+90)},
  {x:5516,values:terraceDepth.map(v=>v+140)},
  {x:5703,values:terraceDepth.map(v=>v+40)},
  {x:5796,values:terraceDepth},
  {x:6688,values:terraceDepth},
);
function columnAt(x){const i=interval(depthColumns.map(c=>c.x),x),a=depthColumns[i],b=depthColumns[i+1],t=(x-a.x)/(b.x-a.x);return a.values.map((v,n)=>lerp(v,b.values[n],t));}
function projectDepth(x,baseY){if(x<=ART_WIDTH)return baseY;const values=columnAt(x);return interpolatePairs(depthKeys.map((v,n)=>[v,values[n]]),baseY);}
function inverseDepth(x,y){if(x<=ART_WIDTH)return y;return interpolatePairs(columnAt(x).map((v,n)=>[v,depthKeys[n]]),y);}
const joinDepth=[[1422,0],[1536,-6],[1597,18],[1672,49],[1747,42],[1822,33],[1922,0]];
const joinDepthShift=x=>x<1422||x>1922?0:interpolatePairs(joinDepth,x);
function legacyToArt(x,y){const base=baseToArt(x,y);if(!base)return null;const artX=horizontalProjection(base.x,base.y);return{x:artX,y:projectDepth(artX,base.y)+joinDepthShift(artX)};}
function legacyToWorld(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const baseY=inverseDepth(x,y-joinDepthShift(x));return baseToWorld(inverseHorizontal(x,baseY),baseY);}
const residencesProjection=createResidencesCandidateProjection({legacyToArt,legacyToWorld});
const servicesProjection=createServicesProjection({legacyToArt:residencesProjection.toArt,legacyToWorld:residencesProjection.toWorld});
const northLibraryProjection=createNorthLibraryProjection(servicesProjection.toArt,servicesProjection.toWorld);
export const toArt=(x,y)=>northLibraryProjection.toArt(x,y);
export const toWorld=(x,y)=>northLibraryProjection.toWorld(x,y);
// Version-1 presentation saves stored image points before the local seam shift.
export function previousArtToWorld(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const baseY=inverseDepth(x,y);return baseToWorld(inverseHorizontal(x,baseY),baseY);}

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

// Surface boundaries follow the approved image. Stone, earth and field rows
// share the same input space. Cliffs, trees, roofs and the four exits stay outside.
export const HOME_STAIRS_WALK = Object.freeze([[650,315],[710,315],[742,322],[755,345],[774,419],[599,419],[592,346],[600,322]]);
export const WALK_POLYGONS = Object.freeze([
  HOME_STAIRS_WALK,
  [[575,407],[790,407],[797,445],[569,445]],
  [[485,432],[1007,430],[1100,542],[1021,592],[947,606],[902,651],[713,662],[620,622],[494,595],[449,555]],
  [[219,675],[340,646],[593,699],[615,748],[572,805],[430,827],[254,781],[199,735]],
  [[721,640],[887,640],[914,709],[900,743],[945,804],[960,848],[985,941],[798,941],[782,855],[760,803],[748,765],[710,721]],
]);
const CORRIDORS = [
  { width: 24, points: [[485,524],[420,539],[342,565],[260,573],[195,601],[149,650],[106,698],[84,733],[120,772],[175,792]] },
  { width: 20, points: [[191,603],[157,583],[114,564],[78,562]] },
  { width: 25, points: [[1056,552],[1147,542],[1233,515],[1318,484],[1401,448],[1457,410],[1536,380]] },
  { width: 20, points: [[705,610],[714,638],[713,656],[702,675],[682,700],[668,740],[650,755],[620,795],[674,792],[744,762]] },
  { width: 22, points: [[632,757],[590,758],[545,783],[499,806],[450,820]] },
  { width: 18, points: [[175,792],[250,821],[330,852],[390,857],[465,883],[534,870],[590,847],[620,819],[674,792]] },
  { width: 18, points: [[550,865],[608,860],[633,847],[650,818],[628,805]] },
  { width: 20, points: [[668,740],[695,722],[712,690]] },
];
const SOUTH_FOREGROUND_ROCKS=[[315,850],[395,829],[490,850],[515,941],[300,941]];
export function isArtWalkable(x,y,{terrain=true,domain=true,west=true,valley=false,residences=false,services=false,northLibrary=false,northMeditation=false,westWorkshops=false}={}) {
  if(!domain&&(x<0||x>ART_WIDTH)||!west&&x<0)return false;
  if (!Number.isFinite(x)||!Number.isFinite(y)||x<(westWorkshops?WEST_WORKSHOPS_ART_LEFT:valley?VALLEY_ART_LEFT:DOMAIN_ART_LEFT)||y<(northMeditation?NORTH_MEDITATION_ART_TOP:northLibrary?NORTH_LIBRARY_ART_TOP:westWorkshops?WEST_WORKSHOPS_ART_TOP:0)||x>(services?SERVICES_ART_RIGHT:residences?RESIDENCES_ART_RIGHT:DOMAIN_ART_WIDTH)||y>ART_HEIGHT) return false;
  const artY=y;y-=joinDepthShift(x);
  const world=toWorld(x,artY),extent=valley?DOMAIN_VALLEY_EXTENT_VERSION:west?DOMAIN_EXTENT_VERSION:DOMAIN_EAST_EXTENT_VERSION,residenceVersion=residences?EAST_RESIDENCES_VERSION:null,serviceVersion=services?EAST_SERVICES_VERSION:null,northVersion=northLibrary?NORTH_LIBRARY_VERSION:null,meditationVersion=northMeditation?NORTH_MEDITATION_VERSION:null,workshopsVersion=westWorkshops?WEST_WORKSHOPS_VERSION:null;
  if(westWorkshops&&WEST_WORKSHOPS_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion,workshopsVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northMeditation&&NORTH_MEDITATION_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(northLibrary&&NORTH_LIBRARY_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent,residenceVersion,serviceVersion,northVersion,meditationVersion)&&(!terrain||courtyardTerrainPointClear(world));
  if(services&&(x>=RESIDENCES_ART_RIGHT||EAST_SERVICES_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p))))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(residences&&(x>=6688||x>=6312&&inPolygon(world.x,world.y,EAST_RESIDENCES_WALK_POLYGONS.at(-1))))return domainContains(world,.26,extent,residenceVersion,serviceVersion);
  if(valley&&west&&x<0&&WEST_VALLEY_WALK_POLYGONS.some(p=>inPolygon(world.x,world.y,p)))return domainContains(world,.26,extent);
  if(west&&x<78){const local=x-WEST_LAYOUT.x;return (WEST_WALK_POLYGONS.some(p=>inPolygon(local,y,p))||WEST_PATH_CENTER.slice(1).some((b,i)=>segmentDistance(local,y,WEST_PATH_CENTER[i],b)<=24))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);}
  if(x>1440&&EAST_PATH_CENTER.slice(1).some((b,i)=>segmentDistance(x,y,EAST_PATH_CENTER[i],b)<=24))return domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if(x>=EAST_LAYOUT.terraceX)return EAST_TERRACE_WALK.some(p=>inPolygon(x-EAST_LAYOUT.terraceX,y,p))&&domainContains(toWorld(x,artY),.26,extent,residenceVersion,serviceVersion);
  if(x>ART_WIDTH||y<407&&!inPolygon(x,y,HOME_STAIRS_WALK))return false;
  if(inPolygon(x,y,SOUTH_FOREGROUND_ROCKS))return false;
  if (terrain&&!courtyardTerrainPointClear(toWorld(x,artY))) return false;
  return WALK_POLYGONS.some(p=>inPolygon(x,y,p)) || CORRIDORS.some(c=>c.points.slice(1).some((b,i)=>segmentDistance(x,y,c.points[i],b)<=c.width));
}
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function artSegmentClear(a,b,options) {
  const wa=toWorld(a.x,a.y),wb=toWorld(b.x,b.y);
  if(options?.terrain!==false&&!courtyardTerrainSegmentClear(wa,wb))return false;
  const n=Math.max(1,Math.ceil(distance(a,b)/3),Math.ceil(distance(wa,wb)/.05));
  for(let i=0;i<=n;i++) {
    const p=toArt(lerp(wa.x,wb.x,i/n),lerp(wa.y,wb.y,i/n));
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
  const middle=shortWaypoints([start,...inner.map(({p})=>toArt(p.x,p.y)),end],maxStep);
  if(!middle.every(p=>isArtWalkable(p.x,p.y,options)))return null;
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
  if(!middle.every(p=>isArtWalkable(p.x,p.y,options)))return null;
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
    const passage=courtyardResidencesPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useValleyRoad,useServicesRoad,useResidencesRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every(p=>isArtWalkable(p.x,p.y,options)))return [...first,...middle,...last];
    }
  }
  if(useValleyRoad&&valley){
    const passage=courtyardValleyPassage(toWorld(from.x,from.y),toWorld(to.x,to.y));
    if(passage?.length){
      const points=passage.map(p=>toArt(p.x,p.y)),caps={...options,maxWaypointDistance:maxStep,useEastRoad,useWestRoad,useResidencesRoad,useServicesRoad,useValleyRoad:false};
      const first=routeArt(from,points[0],caps),last=routeArt(points.at(-1),to,caps),middle=shortWaypoints(points,maxStep);
      if(first&&last&&middle.every(p=>isArtWalkable(p.x,p.y,options)))return [...first,...middle,...last];
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
      const b=gridPoint(next);if(!artSegmentClear(a,b,options))continue;
      const score=g[id]+distance(a,b);if(score>=g[next])continue;
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
