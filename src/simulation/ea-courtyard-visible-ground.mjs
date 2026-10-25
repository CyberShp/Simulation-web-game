/** Approved original courtyard ground, shared by presentation and actor routes. */
import {NORTH_LIBRARY_VERSION,NORTH_LIBRARY_WALK_POLYGONS} from './ea-sect-domain.mjs';
import {legacyToArt,joinDepthShift,eastRoadArtGroundPoint,EAST_LAYOUT} from './ea-courtyard-east-visible-geometry.mjs';
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

export function courtyardMainArtWalkable(x,y){
 if(x>1672||y<407&&!inPolygon(x,y,HOME_STAIRS_WALK))return false;
 if(inPolygon(x,y,SOUTH_FOREGROUND_ROCKS))return false;
 return WALK_POLYGONS.some(p=>inPolygon(x,y,p))||CORRIDORS.some(c=>c.points.slice(1).some((b,i)=>segmentDistance(x,y,c.points[i],b)<=c.width));
}
// Index only references approved polygons. Bounds and cells exclude impossible
// candidates; the original point-in-polygon test still decides every boundary.
const northGroundIndex=new Map(),northGroundCell=4;
for(const polygon of NORTH_LIBRARY_WALK_POLYGONS){
 const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),entry={polygon,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 for(let y=Math.floor(entry.top/northGroundCell);y<=Math.floor(entry.bottom/northGroundCell);y++)for(let x=Math.floor(entry.left/northGroundCell);x<=Math.floor(entry.right/northGroundCell);x++){const key=x+'/'+y;if(!northGroundIndex.has(key))northGroundIndex.set(key,[]);northGroundIndex.get(key).push(entry);}
}
const courtyardGroundPoints=new Map(),courtyardGroundKeys=[];
let oldestCourtyardGroundKey=0;
/** Original courtyard and east-road entrance share the approved pixel surfaces.
 * Surveyed north overlays and the later terrace retain their own body predicates. */
export function courtyardSouthGroundPoint(p,{northLibrary=false}={}){
 const key=[northLibrary?NORTH_LIBRARY_VERSION:'',p.x,p.y].join('/'),held=courtyardGroundPoints.get(key);if(held!==undefined)return held;
 const clear=computeCourtyardGroundPoint(p,northLibrary);
 // Keep the same FIFO order without restarting a Map iterator at deleted slots.
 if(courtyardGroundPoints.size>=65536){courtyardGroundPoints.delete(courtyardGroundKeys[oldestCourtyardGroundKey]);courtyardGroundKeys[oldestCourtyardGroundKey]=key;oldestCourtyardGroundKey=(oldestCourtyardGroundKey+1)%65536;}else courtyardGroundKeys.push(key);
 courtyardGroundPoints.set(key,clear);return clear;
}
function computeCourtyardGroundPoint(p,northLibrary){
 if(p.y<0)return true;
 if(northLibrary&&(northGroundIndex.get(Math.floor(p.x/northGroundCell)+'/'+Math.floor(p.y/northGroundCell))||[]).some(b=>p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom&&inPolygon(p.x,p.y,b.polygon)))return true;
 const a=legacyToArt(p.x,p.y);if(!a)return false;
 if(a.x<78||a.x>=EAST_LAYOUT.terraceX)return true;
 const y=a.y-joinDepthShift(a.x);
 if(a.x>1440&&eastRoadArtGroundPoint(a.x,y))return true;
 return courtyardMainArtWalkable(a.x,y);
}
