/** U-144 courtyard-v2 presentation coordinates. World positions remain metres.
 * This profile is read-only. Routes are input waypoints for official move commands.
 */
import {courtyardTerrainPointClear,courtyardTerrainSegmentClear} from '../../dist/ea-courtyard-master-terrain.mjs';
export const ART_WIDTH = 1672;
export const ART_HEIGHT = 941;
export const COURTYARD_PROFILE = 'courtyard-v2-presentation-1';

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
export function toArt(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const row = rowAt(y,'y'), i = interval(X,x), t = (x-X[i])/(X[i+1]-X[i]);
  return { x: lerp(row.x[i],row.x[i+1],t), y: row.v };
}
export function toWorld(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const row = rowAt(y,'v'), i = interval(row.x,x), t = (x-row.x[i])/(row.x[i+1]-row.x[i]);
  return { x: lerp(X[i],X[i+1],t), y: row.y };
}

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
export const WALK_POLYGONS = Object.freeze([
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
export function isArtWalkable(x,y) {
  if (!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<407||x>ART_WIDTH||y>ART_HEIGHT) return false;
  if(inPolygon(x,y,SOUTH_FOREGROUND_ROCKS))return false;
  if (!courtyardTerrainPointClear(toWorld(x,y))) return false;
  return WALK_POLYGONS.some(p=>inPolygon(x,y,p)) || CORRIDORS.some(c=>c.points.slice(1).some((b,i)=>segmentDistance(x,y,c.points[i],b)<=c.width));
}
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function artSegmentClear(a,b) {
  const wa=toWorld(a.x,a.y),wb=toWorld(b.x,b.y);
  if(!courtyardTerrainSegmentClear(wa,wb))return false;
  const n=Math.max(1,Math.ceil(distance(a,b)/3),Math.ceil(distance(wa,wb)/.05));
  for(let i=0;i<=n;i++) {
    const p=toArt(lerp(wa.x,wb.x,i/n),lerp(wa.y,wb.y,i/n));
    if(!isArtWalkable(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n))||!isArtWalkable(p.x,p.y))return false;
  }
  return true;
}
const GRID=8, COLS=Math.floor(ART_WIDTH/GRID)+1, ROW_COUNT=Math.floor(ART_HEIGHT/GRID)+1;
let grid;
function walkGrid() {
  if (!grid) {
    grid=new Uint8Array(COLS*ROW_COUNT);
    for(let j=0;j<ROW_COUNT;j++) for(let i=0;i<COLS;i++) grid[j*COLS+i]=isArtWalkable(i*GRID,j*GRID)?1:0;
  }
  return grid;
}
const gridPoint = n => ({x:n%COLS*GRID,y:Math.floor(n/COLS)*GRID});
function nearbyNode(p) {
  const cells=walkGrid(),ix=Math.round(p.x/GRID),iy=Math.round(p.y/GRID);
  let result=-1,best=Infinity;
  for(let y=Math.max(0,iy-3);y<=Math.min(ROW_COUNT-1,iy+3);y++) for(let x=Math.max(0,ix-3);x<=Math.min(COLS-1,ix+3);x++) {
    const id=y*COLS+x,q=gridPoint(id),d=distance(p,q);
    if(cells[id]&&d<best&&artSegmentClear(p,q)){best=d;result=id;}
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
/** Return art waypoints excluding the starting point; null means unavailable.
 * Execute one corresponding official world move at a time, waiting for arrival.
 */
export function routeArt(from,to,{maxWaypointDistance=18}={}) {
  if(!finitePoint(from)||!finitePoint(to)||!isArtWalkable(from.x,from.y)||!isArtWalkable(to.x,to.y))return null;
  if(!Number.isFinite(maxWaypointDistance)||maxWaypointDistance<=0) return null;
  const maxStep=Math.min(18,maxWaypointDistance);
  if(distance(from,to)<.001)return [];
  if(artSegmentClear(from,to))return shortWaypoints([from,to],maxStep);
  const start=nearbyNode(from),goal=nearbyNode(to),cells=walkGrid();
  if(start<0||goal<0)return null;
  const g=new Float64Array(cells.length).fill(Infinity),previous=new Int32Array(cells.length).fill(-1),closed=new Uint8Array(cells.length),open=[];
  g[start]=0;push(open,{id:start,f:distance(gridPoint(start),to)});
  while(open.length){
    const {id}=pop(open);if(closed[id])continue;closed[id]=1;
    if(id===goal){
      const indices=[];for(let at=goal;at!==start;at=previous[at])indices.push(at);indices.reverse();
      const raw=[from,gridPoint(start),...indices.map(gridPoint),to],simple=[from];
      let at=0;
      while(at<raw.length-1){let next=at+1;while(next+1<raw.length&&artSegmentClear(raw[at],raw[next+1]))next++;simple.push(raw[next]);at=next;}
      return shortWaypoints(simple,maxStep);
    }
    const x=id%COLS,y=Math.floor(id/COLS),a=gridPoint(id);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROW_COUNT)continue;
      const next=ny*COLS+nx;if(!cells[next]||closed[next])continue;
      const b=gridPoint(next);if(!artSegmentClear(a,b))continue;
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
