/** Shared approved east-road pixel calibration and visible ground. Queries never move a body. */
import {COURTYARD_EAST_ROAD,EAST_RESIDENCES_WALK_POLYGONS} from './ea-sect-domain.mjs';
import {compileStaticPolygon} from './ea-static-polygon-index.mjs';
const residencePassageGround=compileStaticPolygon(EAST_RESIDENCES_WALK_POLYGONS.at(-1));
const ART_WIDTH=1672;
export const EAST_LAYOUT = Object.freeze({ width: 6688, height: 941, tileWidth: 1672,
  terraceX: 5016, siteId: 'site:domain:east-residence-1',
  entrance: Object.freeze({ x: 135, y: 46.6 }),
  entranceArt: Object.freeze({ x: 6021, y: 420 }),
});
export const EAST_PATH_CENTER = Object.freeze([
  [1457,410],[1536,380],[1565,350],[1672,334],
  [1972,400],[2322,452],[2672,555],[3022,580],[3344,610],
  [3684,580],[4024,510],[4364,435],[4684,380],[5016,395],
]);
export const EAST_TERRACE_WALK = Object.freeze([
  [[0,380],[270,465],[535,518],[590,510],[635,540],[790,565],[1000,585],
    [1150,665],[1310,715],[1340,775],[1240,773],[1120,710],[900,645],
    [700,608],[500,570],[270,515],[0,440]],
  [[490,480],[770,405],[935,415],[970,405],[1070,405],[1115,426],
    [1245,470],[1190,525],[1120,565],[810,566],[640,530]],
]);
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
const rowDepths=ROWS.map(row=>row.y),rowArtDepths=ROWS.map(row=>row.v);
const interval = (values, value) => {
  let low=0,high=values.length-2;
  while(low<high){const mid=(low+high)>>1;if(value>values[mid+1])low=mid+1;else high=mid;}
  return low;
};
export const lerp = (a,b,t) => a + (b-a)*t;
export const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
function rowAt(value, key) {
  const i = interval(ROWS.map(row => row[key]), value), a = ROWS[i], b = ROWS[i+1];
  const t = (value-a[key])/(b[key]-a[key]);
  return { y: lerp(a.y,b.y,t), v: lerp(a.v,b.v,t), x: a.x.map((x,n) => lerp(x,b.x[n],t)) };
}
function baseToArt(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rowIndex=interval(rowDepths,y),a=ROWS[rowIndex],b=ROWS[rowIndex+1],rowT=(y-a.y)/(b.y-a.y),i=interval(X,x),t=(x-X[i])/(X[i+1]-X[i]);
  const left=lerp(a.x[i],b.x[i],rowT),right=lerp(a.x[i+1],b.x[i+1],rowT);
  return { x:lerp(left,right,t), y:lerp(a.v,b.v,rowT) };
}
function baseToWorld(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rowIndex=interval(rowArtDepths,y),a=ROWS[rowIndex],b=ROWS[rowIndex+1],rowT=(y-a.v)/(b.v-a.v);
  // The same binary comparisons read the identical lerp values lazily.
  let low=0,high=a.x.length-2;
  while(low<high){const mid=(low+high)>>1;if(x>lerp(a.x[mid+1],b.x[mid+1],rowT))low=mid+1;else high=mid;}
  const left=lerp(a.x[low],b.x[low],rowT),right=lerp(a.x[low+1],b.x[low+1],rowT),t=(x-left)/(right-left);
  return { x:lerp(X[low],X[low+1],t), y:lerp(a.y,b.y,rowT) };
}

// Two triangular, monotone transforms keep the courtyard core calibrated and
// give the opened road one reversible projection. Neither transform edits metres.
const horizontalAnchors=[[50.72,1672],[90,3344],[120,5016],[126,5516],
  [132,5796],[135,6021],[138,6246],[156,6688],[160,6808]];
const inverseHorizontalAnchors=horizontalAnchors.map(([world,art])=>[art,world]);
function interpolatePairs(pairs,value){
 let low=0,high=pairs.length-2;
 while(low<high){const mid=(low+high)>>1;if(value>pairs[mid+1][0])low=mid+1;else high=mid;}
 const a=pairs[low],b=pairs[low+1];return lerp(a[1],b[1],(value-a[0])/(b[0]-a[0]));
}
function horizontalProjection(baseX,baseY){
  if(baseX<=ART_WIDTH)return baseX;
  const worldX=baseToWorld(baseX,baseY).x,target=interpolatePairs(horizontalAnchors,worldX);
  const fraction=Math.min(1,(baseX-ART_WIDTH)/528);
  return lerp(baseX,target,fraction);
}
function inverseHorizontal(x,baseY){
  if(x<=ART_WIDTH)return x;
  if(x>=horizontalProjection(2200,baseY)){
    const worldX=interpolatePairs(inverseHorizontalAnchors,x);
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
const depthColumnXs=depthColumns.map(c=>c.x);
function columnAt(x){const i=interval(depthColumnXs,x),a=depthColumns[i],b=depthColumns[i+1],t=(x-a.x)/(b.x-a.x);return a.values.map((v,n)=>lerp(v,b.values[n],t));}
function projectDepth(x,baseY){
 if(x<=ART_WIDTH)return baseY;
 const column=interval(depthColumnXs,x),a=depthColumns[column],b=depthColumns[column+1],t=(x-a.x)/(b.x-a.x),depth=interval(depthKeys,baseY);
 const low=lerp(a.values[depth],b.values[depth],t),high=lerp(a.values[depth+1],b.values[depth+1],t);
 return lerp(low,high,(baseY-depthKeys[depth])/(depthKeys[depth+1]-depthKeys[depth]));
}
function inverseDepth(x,y){
 if(x<=ART_WIDTH)return y;
 const column=interval(depthColumnXs,x),a=depthColumns[column],b=depthColumns[column+1],t=(x-a.x)/(b.x-a.x);
 // Read precisely the same interpolated values as columnAt + interpolatePairs,
 // retaining their comparisons and arithmetic without building temporary rows.
 let low=0,high=depthKeys.length-2;
 while(low<high){const mid=(low+high)>>1;if(y>lerp(a.values[mid+1],b.values[mid+1],t))low=mid+1;else high=mid;}
 const left=lerp(a.values[low],b.values[low],t),right=lerp(a.values[low+1],b.values[low+1],t);
 return lerp(depthKeys[low],depthKeys[low+1],(y-left)/(right-left));
}
const joinDepth=[[1422,0],[1536,-6],[1597,18],[1672,49],[1747,42],[1822,33],[1922,0]];
export const joinDepthShift=x=>x<1422||x>1922?0:interpolatePairs(joinDepth,x);
export function legacyToArt(x,y){const base=baseToArt(x,y);if(!base)return null;const artX=horizontalProjection(base.x,base.y);return{x:artX,y:projectDepth(artX,base.y)+joinDepthShift(artX)};}
export function legacyToWorld(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const baseY=inverseDepth(x,y-joinDepthShift(x));return baseToWorld(inverseHorizontal(x,baseY),baseY);}

export function previousEastArtToWorld(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const baseY=inverseDepth(x,y);return baseToWorld(inverseHorizontal(x,baseY),baseY);}
const inPolygon=(x,y,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
/** Pure approved road strip in source-pixel space; the caller supplies seam-adjusted depth. */
export function eastRoadArtGroundPoint(x,y){
 for(let i=1;i<EAST_PATH_CENTER.length;i++){
  const a=EAST_PATH_CENTER[i-1],b=EAST_PATH_CENTER[i];
  // Conservatively expanded bounds reject only impossible strip contacts.
  if(x<Math.min(a[0],b[0])-24-1e-7||x>Math.max(a[0],b[0])+24+1e-7||y<Math.min(a[1],b[1])-24-1e-7||y>Math.max(a[1],b[1])+24+1e-7)continue;
  if(segmentDistance(x,y,a,b)<=24)return true;
 }
 return false;
}
export function eastVisiblePointApplies(p){return p&&p.x>=119&&p.x<156;}
/** Pixel clip only: domain/collision radius is checked separately, once. */
export function eastVisibleGroundPoint(p,{residences=false}={}){
 if(!eastVisiblePointApplies(p))return true;
 const a=legacyToArt(p.x,p.y);if(a.x<ART_WIDTH||a.x>=6688||residences&&a.x>=6312&&residencePassageGround.contains(p))return true;const y=a.y-joinDepthShift(a.x);
 if(eastRoadArtGroundPoint(a.x,y))return true;
 return a.x>=EAST_LAYOUT.terraceX&&EAST_TERRACE_WALK.some(poly=>inPolygon(a.x-EAST_LAYOUT.terraceX,y,poly));
}
const visibleBodyDirections=Object.freeze(Array.from({length:16},(_,k)=>Object.freeze({x:Math.cos(k*Math.PI/8),y:Math.sin(k*Math.PI/8)})));
const visibleBodyCache=new Map();
export function eastVisibleBodyPoint(p,radius=.26,options={}){
 if(p&&p.x+radius<119||p&&p.x-radius>=156)return true;
 const key=[p.x,p.y,radius,!!options.residences].join('/');if(visibleBodyCache.has(key))return visibleBodyCache.get(key);
 let clear=eastVisibleGroundPoint(p,options);for(let k=0;clear&&k<16;k++){const direction=visibleBodyDirections[k];clear=eastVisibleGroundPoint({x:p.x+radius*direction.x,y:p.y+radius*direction.y},options);}
 if(visibleBodyCache.size>=65536)visibleBodyCache.clear();visibleBodyCache.set(key,clear);return clear;
}
/** Preserve the residence passage on its measured narrow bend at the .5m grid seam.
 * These interior gates connect the unchanged surrounding road gates. */
export function eastVisibleResidencePassage(points){
 if(!points)return points;
 const old=[{x:127.60714285714288,y:46.306417112299464},{x:128.00892857142858,y:47.25534759358289},{x:128.41071428571428,y:48.11824123588829}],bend=[{x:127.8,y:46.7},{x:127.8,y:47},{x:127.95,y:48.7}],same=(a,b)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<1e-8,result=[];
 for(let i=0;i<points.length;i++){
  if(old.every((p,k)=>same(points[i+k],p))){result.push(...bend.map(p=>({...p})));i+=2;}
  else if([...old].reverse().every((p,k)=>same(points[i+k],p))){result.push(...[...bend].reverse().map(p=>({...p})));i+=2;}
  else result.push({...points[i]});
 }
 return result;
}

/** Safe interior guides for the unchanged east-road target and later terrace gates. */
export function eastVisibleRoadInterior(points){
 const bend=[{x:126,y:46.5},{x:126.5,y:47},{x:127.8,y:47},{x:127.8,y:46.7},{x:128.09183673469389,y:46.65994616810556}],same=(p,x,y)=>p&&Math.hypot(p.x-x,p.y-y)<1e-8,result=[];
 for(let i=0;i<points.length;i++){const p=points[i],prior=points[i-1];if(same(prior,120,44)&&same(p,131,48))result.push(...bend.map(q=>({...q})));else if(same(prior,131,48)&&same(p,120,44))result.push(...[...bend].reverse().map(q=>({...q})));result.push({...p});}return result;
}

/** Attach internal east-road gates to the measured bend, preserving real endpoints. */
export function eastVisibleRoadPassage(from,to,passage,options={}){
 if(!passage)return passage;
 const road=[{x:120,y:44},...eastVisibleRoadInterior([{x:120,y:44},{x:131,y:48}]).slice(1)];
 const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-8;
 const attachment=p=>{let best=null;for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))),q={x:a.x+dx*t,y:a.y+dy*t};for(const [point,index]of [[q,i-1+t],[a,i-1],[b,i]]){if(!eastVisibleBodyPoint(point,.26,options))continue;const d=Math.hypot(point.x-p.x,point.y-p.y);if(!best||d<best.distance)best={point,index,distance:d};}}return best;};
 const gates=passage.map((p,i)=>{if(p.x<120-1e-8||p.x>131+1e-8||Math.abs(p.y-(44+(p.x-120)*4/11))>1e-7)return{point:p,index:null};if(same(p,road[0]))return{point:p,index:0};if(same(p,road.at(-1)))return{point:p,index:road.length-1};return attachment(i===0&&from.x>=119?from:i===passage.length-1&&to.x>=119?to:p)||{point:p,index:null};});
 const result=[];for(let i=0;i<gates.length;i++){const a=gates[i-1],b=gates[i];if(a?.index!=null&&b.index!=null){const forward=b.index>=a.index,inner=road.map((p,index)=>({p,index})).filter(({index})=>forward?index>a.index+1e-8&&index<b.index-1e-8:index<a.index-1e-8&&index>b.index+1e-8);if(!forward)inner.reverse();result.push(...inner.map(({p})=>({...p})));}if(!result.length||!same(result.at(-1),b.point))result.push({...b.point});}return result;
}
