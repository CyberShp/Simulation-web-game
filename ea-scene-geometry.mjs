import {spatialEnabled,spatialPrefab,spatialTransform,spatialAccess,spatialFootprint,spatialRoom,spatialRevision,meterCanStand,meterSweep,meterNearest,meterFindPath,polygonContains} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r26';
import {hallInterior} from './ea-hall-interior.mjs?v=ea-160-courtyard-20261008-r26';
import {CELLS} from './ea-data.mjs?v=ea-160-courtyard-20261008-r26';
import {WIDTH,HEIGHT,NODES,EDGES,LANDMARKS,distance,inPolygon,nearest} from './yunxiu-courtyard/navigation.mjs?v=ea-160-courtyard-20261008-r26';

export const SCENE_GEOMETRY='plots-v1';
export {WIDTH,HEIGHT,distance as scenicDistance};
const key=p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const xy=([x,y])=>({x,y});
const project=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return{x:a.x+t*dx,y:a.y+t*dy};};
// Plots are registered to the dry terraces in the approved painting. They are
// stable addresses, not type-dependent scenic slots: moving 5/3 to 6/3 moves
// the same object to that address in both the construction and scenic views.
const PANELS=[
 {x:137,y:195,cols:5,rows:3,dx:67,dy:54},
 {x:128,y:463,cols:5,rows:5,dx:71,dy:54},
 {x:1168,y:343,cols:5,rows:4,dx:73,dy:54},
 {x:1082,y:659,cols:5,rows:4,dx:77,dy:54},
 {x:573,y:765,cols:4,rows:3,dx:64,dy:49},
 {x:1100,y:214,cols:6,rows:2,dx:65,dy:52},
 {x:116,y:795,cols:5,rows:2,dx:70,dy:51}
];
const lots=PANELS.flatMap((panel,index)=>Array.from({length:panel.cols*panel.rows},(_,i)=>({x:panel.x+i%panel.cols*panel.dx,y:panel.y+Math.floor(i/panel.cols)*panel.dy,panel:index})));
const cells=CELLS.filter(c=>!(c.x===3&&c.y===2)).sort((a,b)=>Number(a.x>=8||a.y>=7)-Number(b.x>=8||b.y>=7)||a.y-b.y||a.x-b.x);
export const SCENIC_PLOTS=cells.map((c,i)=>({...c,position:{x:lots[i].x,y:lots[i].y},panel:lots[i].panel}));
SCENIC_PLOTS.push({x:3,y:2,position:{x:840,y:217},panel:-1});
const plotMap=new Map(SCENIC_PLOTS.map(p=>[`${p.x},${p.y}`,p]));
export function scenicPoint(x,y){const p=plotMap.get(`${x},${y}`);return p?{...p.position}:null;}
export function scenicInverse(p,{maxDistance=65}={}){let best=null;for(const plot of SCENIC_PLOTS){const d=distance(p,plot.position);if(d<=maxDistance&&(!best||d<best.distance))best={x:plot.x,y:plot.y,distance:d};}return best;}
export function plotPolygon(x,y){const p=scenicPoint(x,y);return p?[[p.x-31,p.y-17],[p.x+31,p.y-17],[p.x+31,p.y+19],[p.x-31,p.y+19]]:[];}
export function buildingFootprint(b){if(b.transform)return spatialFootprint(b);const p=scenicPoint(b.x,b.y);if(!p)return[];return b.type==='hall'?[[665,66],[946,66],[964,178],[699,199]]:[[p.x-25,p.y-12],[p.x+25,p.y-12],[p.x+25,p.y+13],[p.x-25,p.y+13]];}
export function buildingAccess(s,b){if(spatialEnabled(s)||b?.transform)return spatialAccess(b);const p=scenicPoint(b.x,b.y);return p?b.type==='hall'?{x:840,y:217}:{x:p.x,y:p.y+24}:null;}
export const buildingSize=b=>b.transform?spatialPrefab(b)?.width||6:b.type==='hall'?0:62+(b.level-1)*3;
// One projection for preview, construction, completed sprite and selection.
// This deliberately retains legacy scene units until the complete metre port.
export function buildingVisual(b){if(b.transform){const d=spatialPrefab(b),t=spatialTransform(b);return {position:{x:t.x+d.width/2,y:t.y+d.height},size:d.width,footprint:spatialFootprint(b),bounds:{left:t.x,right:t.x+d.width,top:t.y-2.2,bottom:t.y+d.height},prefab:d};}const position=scenicPoint(b.x,b.y);if(!position)return null;const size=buildingSize(b);return {position,size,footprint:buildingFootprint(b),bounds:b.type==='hall'?{left:680,right:972,top:32,bottom:212}:{left:position.x-size/2,right:position.x+size/2,top:position.y-size+20,bottom:position.y+20}};}
export function facilityHit(b,p){if(b.transform)return polygonContains(p,spatialFootprint(b));const view=buildingVisual(b);if(!view)return false;if(b.type==='hall')return inPolygon(p,LANDMARKS.find(l=>l.id==='main').hit);const r=view.bounds;return p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;}
const baseSegments=EDGES.map(e=>({a:xy(NODES[e.a]),b:xy(NODES[e.b]),width:e.w,painted:true}));
const terraceSegments=[];
for(const panel of PANELS){
 const left=panel.x-35,right=panel.x+(panel.cols-1)*panel.dx+35,top=panel.y+24,bottom=top+(panel.rows-1)*panel.dy;
 for(let row=0;row<panel.rows;row++){
  const y=top+row*panel.dy,points=[left,...Array.from({length:panel.cols},(_,col)=>panel.x+col*panel.dx),right];
  for(let col=1;col<points.length;col++)terraceSegments.push({a:{x:points[col-1],y},b:{x:points[col],y},width:18,painted:false});
  if(row){terraceSegments.push({a:{x:left,y:y-panel.dy},b:{x:left,y},width:18,painted:false},{a:{x:right,y:y-panel.dy},b:{x:right,y},width:18,painted:false});}
 }
 const candidates=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].map(p=>({p,q:nearest(p)})).sort((a,b)=>a.q.d-b.q.d);
 // Two independent entrances keep a terrace reachable after path edits.
 for(const {p,q}of candidates.slice(0,2))terraceSegments.push({a:p,b:{x:q.x,y:q.y},width:18,painted:false});
}
export const SCENE_ROADS=[...baseSegments,...terraceSegments];
function insideFootprint(p,polygon,radius){if(inPolygon(p,polygon))return true;return polygon.some((v,i)=>distance(p,project(p,xy(v),xy(polygon[(i+1)%polygon.length])))<radius-.001);}
const cache=new WeakMap();
function indexed(geometry){
 const roads=new Map(),footprints=new Map(),bucket=(map,x,y,item)=>{const k=`${x},${y}`,list=map.get(k)||[];list.push(item);map.set(k,list);};
 for(const e of geometry.segments){const margin=e.width/2;for(let y=Math.floor((Math.min(e.a.y,e.b.y)-margin)/64);y<=Math.floor((Math.max(e.a.y,e.b.y)+margin)/64);y++)for(let x=Math.floor((Math.min(e.a.x,e.b.x)-margin)/64);x<=Math.floor((Math.max(e.a.x,e.b.x)+margin)/64);x++)bucket(roads,x,y,e);}
 for(const f of geometry.footprints){if(!f.polygon.length)continue;const xs=f.polygon.map(p=>p[0]),ys=f.polygon.map(p=>p[1]);for(let y=Math.floor((Math.min(...ys)-8)/64);y<=Math.floor((Math.max(...ys)+8)/64);y++)for(let x=Math.floor((Math.min(...xs)-8)/64);x<=Math.floor((Math.max(...xs)+8)/64);x++)bucket(footprints,x,y,f);}
 return Object.assign(geometry,{roadBuckets:roads,footprintBuckets:footprints});
}
const emptyGeometry=indexed({segments:SCENE_ROADS,footprints:[],revision:'empty'});
export function geometryRevision(s){if(spatialEnabled(s))return spatialRevision(s);return `${s?.rulesetVersion||'legacy'}:`+(s?.buildings||[]).map(b=>`${b.id}/${b.type}/${b.x}/${b.y}`).join('|');}
export function sceneGeometry(s){if(spatialEnabled(s))return {revision:spatialRevision(s),segments:[],rooms:s.buildings.map(spatialRoom).filter(Boolean),footprints:s.buildings.flatMap(b=>{const r=spatialRoom(b);return r?[...r.walls,...r.furniture.map(f=>f.polygon)].map(polygon=>({id:b.id,polygon})):[{id:b.id,polygon:spatialFootprint(b)}];})};
 if(!s)return emptyGeometry;
 const revision=geometryRevision(s),old=cache.get(s);if(old?.revision===revision)return old;
 const rooms=s.buildings.map(b=>hallInterior(s,b)).filter(Boolean);
 const geometry=indexed({segments:[...SCENE_ROADS,...rooms.flatMap(r=>r.lanes)],rooms,footprints:s.buildings.flatMap(b=>{const r=hallInterior(s,b);return r?[...r.walls,...r.furniture.map(f=>f.polygon)].map(polygon=>({id:b.id,polygon})):[{id:b.id,polygon:buildingFootprint(b)}];}),revision});cache.set(s,geometry);return geometry;
}
function standAt(g,p,radius=4){
 if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.x<radius||p.y<radius||p.x>WIDTH-radius||p.y>HEIGHT-radius)return false;
 const k=`${Math.floor(p.x/64)},${Math.floor(p.y/64)}`;return !(g.footprintBuckets.get(k)||[]).some(f=>insideFootprint(p,f.polygon,radius))&&((g.rooms||[]).some(r=>p.x>=r.bounds.x+radius&&p.x<=r.bounds.x+r.bounds.width-radius&&p.y>=r.bounds.y+radius&&p.y<=r.bounds.y+r.bounds.height-radius)||(g.roadBuckets.get(k)||[]).some(e=>distance(p,project(p,e.a,e.b))<=e.width/2-radius+.001));
}
export function scenicCanStand(s,p,radius=4){if(spatialEnabled(s))return meterCanStand(s,p,radius===4?.26:radius);return standAt(sceneGeometry(s),p,radius);}
export function scenicSweep(s,from,to,radius=4){if(spatialEnabled(s))return meterSweep(s,from,to,radius===4?.26:radius);
 const g=sceneGeometry(s),d=distance(from,to),cacheKey=d>50?`${key(from)}>${key(to)}:${radius}`:null,held=cacheKey?g.sweeps?.get(cacheKey):null;if(held)return{...held};
 const finish=result=>{if(cacheKey){g.sweeps??=new Map();if(g.sweeps.size>4096)g.sweeps.clear();g.sweeps.set(cacheKey,result);}return{...result};};
 if(!standAt(g,from,radius))return finish({...from,blocked:true});const n=Math.max(1,Math.ceil(d/3));let last={x:from.x,y:from.y};
 for(let i=1;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n};if(!standAt(g,p,radius))return finish({...last,blocked:true});last=p;}return finish({...last,blocked:false});
}
export function scenicNearest(s,target,{maxDistance=Infinity,radius=4}={}){if(spatialEnabled(s))return meterNearest(s,target,{maxDistance:Number.isFinite(maxDistance)?maxDistance:undefined,radius:radius===4?.26:radius});
 const g=sceneGeometry(s);let best=null;if(standAt(g,target,radius))return {x:target.x,y:target.y};
 for(const e of g.segments){const p=project(target,e.a,e.b),d=distance(target,p);if(d<=maxDistance&&(!best||d<best.distance)&&standAt(g,p,radius))best={...p,distance:d};}
 // A nearest projection can be inside a newly erected building; its entrance
 // and segment ends are additional candidates, never a teleport through it.
 for(const p of [...(s?.buildings||[]).map(b=>buildingAccess(s,b)),...SCENE_ROADS.flatMap(e=>[e.a,e.b])]){if(!p)continue;const d=distance(target,p);if(d<=maxDistance&&(!best||d<best.distance)&&standAt(g,p,radius))best={...p,distance:d};}
 return best?{x:best.x,y:best.y}:null;
}
function graph(s){
 const g=sceneGeometry(s);if(g.graph)return g.graph;const nodes=new Map(),edges=new Map(),add=p=>{const k=key(p);if(!nodes.has(k)){nodes.set(k,{x:p.x,y:p.y});edges.set(k,[]);}return k;};
 // Split roads at every junction. Registered main paths and terrace paths can
 // intersect in the painting, and that intersection must be navigable.
 const roads=g.segments;const splits=roads.map(e=>[e.a,e.b]);
 for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
  const a=roads[i],b=roads[j],dx=a.b.x-a.a.x,dy=a.b.y-a.a.y,ex=b.b.x-b.a.x,ey=b.b.y-b.a.y,den=dx*ey-dy*ex;
  if(Math.abs(den)<1e-8)continue;const ax=b.a.x-a.a.x,ay=b.a.y-a.a.y,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
  if(t>=-1e-6&&t<=1+1e-6&&u>=-1e-6&&u<=1+1e-6){const p={x:a.a.x+dx*t,y:a.a.y+dy*t};splits[i].push(p);splits[j].push(p);}
 }
 for(let i=0;i<roads.length;i++){
  const road=roads[i],points=splits[i].sort((a,b)=>distance(road.a,a)-distance(road.a,b));
  for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j];if(distance(a,b)<.01||scenicSweep(s,a,b).blocked)continue;const ak=add(a),bk=add(b),cost=distance(a,b);edges.get(ak).push({key:bk,cost});edges.get(bk).push({key:ak,cost});}
 }
 return g.graph={nodes,edges};
}
export function scenicFindPath(s,from,goal,{maxSnap=70}={}){if(spatialEnabled(s))return meterFindPath(s,from,goal,{maxSnap:maxSnap===70?2:maxSnap});
 if(!scenicCanStand(s,from))return null;if(distance(from,goal)<.001)return[];
 const g=sceneGeometry(s),routeKey=`${key(from)}>${key(goal)}:${maxSnap}`,held=g.routes?.get(routeKey);if(held!==undefined)return held===null?null:held.map(p=>({...p}));
 const remember=value=>{g.routes??=new Map();if(g.routes.size>1024)g.routes.clear();g.routes.set(routeKey,value);return value===null?null:value.map(p=>({...p}));};
 const to=scenicCanStand(s,goal)?{x:goal.x,y:goal.y}:scenicNearest(s,goal,{maxDistance:maxSnap});if(!to)return remember(null);
 if(!scenicSweep(s,from,to).blocked)return remember(distance(from,to)<.001?[]:[to]);
 const {nodes,edges}=graph(s),startLinks=[],endLinks=new Map();
 for(const[k,p]of nodes){const a=distance(from,p),b=distance(to,p);if(a<260&&!scenicSweep(s,from,p).blocked)startLinks.push({key:k,cost:a});if(b<260&&!scenicSweep(s,p,to).blocked)endLinks.set(k,b);}
 const open=startLinks.map(l=>({...l,total:l.cost})),costs=new Map(startLinks.map(l=>[l.key,l.cost])),parents=new Map();let end=null,total=Infinity;
 while(open.length){open.sort((a,b)=>a.total-b.total);const c=open.shift();if(c.total!==costs.get(c.key))continue;if(c.total>=total)break;
  if(endLinks.has(c.key)&&c.total+endLinks.get(c.key)<total){end=c.key;total=c.total+endLinks.get(c.key);}
  for(const e of edges.get(c.key)||[]){const next=c.total+e.cost;if(next<(costs.get(e.key)??Infinity)){costs.set(e.key,next);parents.set(e.key,c.key);open.push({key:e.key,total:next});}}
 }
 if(!end)return remember(null);const result=[to];let k=end;while(k){result.unshift(nodes.get(k));k=parents.get(k);}const simple=[];let origin=from;
 while(result.length){let i=result.length-1;while(i>0&&scenicSweep(s,origin,result[i]).blocked)i--;const p=result[i];if(scenicSweep(s,origin,p).blocked)return null;if(distance(origin,p)>.001)simple.push({...p});origin=p;result.splice(0,i+1);}
 return remember(simple);
}
export function scenicReachable(s,from,goal){return scenicFindPath(s,from,goal)!==null;}
export function scenicPathDistance(path,from){if(!path)return Infinity;let total=0,p=from;for(const q of path){total+=distance(p,q);p=q;}return total;}
