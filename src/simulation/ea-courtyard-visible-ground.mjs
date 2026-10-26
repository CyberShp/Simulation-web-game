/** Approved original courtyard ground, shared by presentation and actor routes. */
import {NORTH_LIBRARY_WALK_POLYGONS} from './ea-sect-domain.mjs';
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
// Conservative broad phase; surviving points retain the original ray predicate.
const mainArtPolygonBounds=polygon=>({polygon,left:Math.min(...polygon.map(p=>p[0]))-1e-7,right:Math.max(...polygon.map(p=>p[0]))+1e-7,top:Math.min(...polygon.map(p=>p[1]))-1e-7,bottom:Math.max(...polygon.map(p=>p[1]))+1e-7});
const mainArtStairsBounds=mainArtPolygonBounds(HOME_STAIRS_WALK),mainArtRockBounds=mainArtPolygonBounds(SOUTH_FOREGROUND_ROCKS),mainArtWalkBounds=WALK_POLYGONS.map(mainArtPolygonBounds);
const boundedMainArtPolygon=(x,y,b)=>(typeof x!=='number'||typeof y!=='number'||x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)&&inPolygon(x,y,b.polygon);


// Broad phase only; surviving segments retain the original distance predicate.
const corridorSegments=CORRIDORS.flatMap(c=>c.points.slice(1).map((b,i)=>({a:c.points[i],b,width:c.width,left:Math.min(c.points[i][0],b[0])-c.width-1e-7,right:Math.max(c.points[i][0],b[0])+c.width+1e-7,top:Math.min(c.points[i][1],b[1])-c.width-1e-7,bottom:Math.max(c.points[i][1],b[1])+c.width+1e-7})));
export function courtyardMainArtWalkable(x,y){
 if(x>1672||y<407&&!boundedMainArtPolygon(x,y,mainArtStairsBounds))return false;
 if(boundedMainArtPolygon(x,y,mainArtRockBounds))return false;
 return mainArtWalkBounds.some(b=>boundedMainArtPolygon(x,y,b))||corridorSegments.some(c=>x>=c.left&&x<=c.right&&y>=c.top&&y<=c.bottom&&segmentDistance(x,y,c.a,c.b)<=c.width);
}
// Index only references approved polygons. Bounds and cells exclude impossible
// candidates; the original point-in-polygon test still decides every boundary.
const northGroundIndex=new Map(),northGroundCell=4;
for(const polygon of NORTH_LIBRARY_WALK_POLYGONS){
 const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),entry={polygon,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 for(let y=Math.floor(entry.top/northGroundCell);y<=Math.floor(entry.bottom/northGroundCell);y++)for(let x=Math.floor(entry.left/northGroundCell);x<=Math.floor(entry.right/northGroundCell);x++){const key=x+'/'+y;if(!northGroundIndex.has(key))northGroundIndex.set(key,[]);northGroundIndex.get(key).push(entry);}
}
const courtyardGroundX=new Float64Array(65536),courtyardGroundY=new Float64Array(65536),courtyardGroundState=new Uint8Array(65536);
export function courtyardSouthGroundPoint(p,{northLibrary=false}={}){
 const x=p.x*65536|0,y=p.y*65536|0,group=northLibrary?4:0,slot=(Math.imul(x^(x>>>16),0x9e3779b1)^Math.imul(y^(y>>>16),0x85ebca6b)^group)&65535;
 const held=courtyardGroundState[slot];if(held&&((held&4)===group)&&courtyardGroundX[slot]===p.x&&courtyardGroundY[slot]===p.y)return (held&2)!==0;
 const clear=computeCourtyardGroundPoint(p,northLibrary);if(typeof p.x!=='number'||typeof p.y!=='number')return clear;courtyardGroundX[slot]=p.x;courtyardGroundY[slot]=p.y;courtyardGroundState[slot]=group|(clear?2:1);return clear;
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
