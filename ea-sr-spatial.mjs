import {finalizeBuildingChange,releaseBodyActivity} from './ea-facility-activities.mjs?v=ea-160-courtyard-20261008-r9';
/** SR-XF-003–006: metre space and persistent, on-site construction transactions. */
import {scenicPoint} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r9';
import {BUILDINGS,RESOURCES,log as gameLog} from './ea-data.mjs?v=ea-160-courtyard-20261008-r9';
import {BUILDING_GRID,buildingGridEnabled,buildingCellSize,onBuildingGrid} from './ea-building-grid.mjs?v=ea-160-courtyard-20261008-r9';
export const SPATIAL_VERSION='spatial-metres-1';
export const SPATIAL_EXTENT_VERSION='courtyard-96-1';
export const INTERIOR_LAYOUT_VERSION='adult-furniture-1';
export const SPATIAL_SCENE=Object.freeze({id:'scene:yunxiu-courtyard',width:96,height:96,grid:.5,personRadius:.26,pixelsPerMetre:32,depth:.65});
// Unmarked metre saves must first pass their original 64m boundary. This is a
// content extent marker within schema 6, not a coordinate or identity migration.
const LEGACY_SPATIAL_BOUNDS=Object.freeze({width:64,height:64});
function sceneBounds(s){
 if(!spatialEnabled(s))return SPATIAL_SCENE;
 if(!Object.hasOwn(s.spatial,'extentVersion'))return LEGACY_SPATIAL_BOUNDS;
 if(s.spatial.extentVersion!==SPATIAL_EXTENT_VERSION)throw Error('未知山院范围版本，原存档保留。');
 return SPATIAL_SCENE;
}
export const spatialEnabled=s=>s?.spatial?.version===SPATIAL_VERSION;
export const sceneUnits=(s,pixels)=>spatialEnabled(s)?pixels/32:pixels;
export const legacyToWorld=p=>({x:p.x/32,y:p.y/(32*.65)});
export const legacyToScenic=(s,p)=>spatialEnabled(s)?legacyToWorld(p):{...p};
export const scenicToLegacy=(s,p)=>spatialEnabled(s)?worldToLegacy(p):{...p};
export const worldToLegacy=p=>({x:p.x*32,y:p.y*32*.65});
// Camera rotation is presentation-only. Old saves, paths and default callers
// retain their world coordinates and the legacy unrotated projection.
export const spatialProject=(p,c={scale:32,depth:.65,ox:0,oy:0})=>{const a=c.rotation||0,co=Math.cos(a),si=Math.sin(a);return{x:c.ox+(p.x*co-p.y*si)*c.scale,y:c.oy+(p.x*si+p.y*co)*c.scale*c.depth};};
export const spatialUnproject=(p,c={scale:32,depth:.65,ox:0,oy:0})=>{const x=(p.x-c.ox)/c.scale,y=(p.y-c.oy)/(c.scale*c.depth),a=c.rotation||0,co=Math.cos(a),si=Math.sin(a);return{x:x*co+y*si,y:-x*si+y*co};};
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const emptyResources=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
const CONSTRUCTION_MATERIAL_FLOW='construction-material-flow-1';
const CONSTRUCTION_CARRY_CAPACITY=40;
const snap=n=>Math.round(n/SPATIAL_SCENE.grid)*SPATIAL_SCENE.grid;
const rooms=new Set(['hall','house','library','alchemy','kitchen','clinic','workshop']);
export const PREFAB_CATALOG=Object.freeze(Object.fromEntries(Object.keys(BUILDINGS).map(type=>[type,{id:`prefab:${type}:metres:v1`,assetVersion:'vector-metres-v1',orientations:['south'],width:['farm','granary','lumber','quarry'].includes(type)?6:type==='well'?3:6,height:['farm','granary','lumber','quarry'].includes(type)?4:type==='well'?3:5,indoor:rooms.has(type),layers:['floor','furniture','actors','walls','roof'],fallback:'same-style-vector',conditionStages:['normal','damaged'],constructionStages:['foundation','structure','finishing']}])));
const prefabId=b=>b.buildingGridVersion===BUILDING_GRID.version?`prefab:${b.type}:units:v1`:PREFAB_CATALOG[b.type]?.id;
const layoutBuilding=(s,b)=>buildingGridEnabled(s)?{...b,buildingGridVersion:BUILDING_GRID.version,...(s.spatial.interiorLayoutVersion===INTERIOR_LAYOUT_VERSION&&rooms.has(b.type)?{interiorLayoutVersion:INTERIOR_LAYOUT_VERSION}:{})}:b;
export function spatialPrefab(b){
 const d=PREFAB_CATALOG[b.type];if(!d)return null;const level=Math.max(1,b.level||1),size=dimensions(b),w=size.width,h=size.height,adult=d.indoor&&b.buildingGridVersion===BUILDING_GRID.version&&b.interiorLayoutVersion===INTERIOR_LAYOUT_VERSION,slots=[],furniture=[],push=(kind,suffix,x,y,label)=>slots.push({kind,suffix,position:{x,y},label,capacity:1,facing:1});
 if(['hall','house','clinic'].includes(b.type)){
  // SR-XF-004: 2.2m beds fit adult bodies; 0.8m aisles contain a 0.5m nav row.
  // Compact geometry remains available for validating the original save.
  const n=4*level;for(let i=0;i<n;i++){const col=i%4,row=Math.floor(i/4),x=adult?.95+col*(w-1.9)/3:.8+col*(w-1.6)/3,y=adult?.5+row*3:.95+row*1.6;furniture.push({kind:'bed',id:`bed:${i+1}`,polygon:adult?rect(x-.45,y,.9,2.2):rect(x-.3,y-.65,.6,.9)});const foot=adult?y+2.5:y+.6;push('rest',`bed:${i+1}`,x,foot,`床位 ${i+1}`);push('heal',`bed-care:${i+1}`,x,foot,`调养床 ${i+1}`);}
 }
 if(['hall','library'].includes(b.type)){for(let i=0;i<2*level;i++){const x=adult?.95+i*(w-1.9)/(2*level-1):.8+i*(w-1.6)/(2*level-1),y=adult?h-1.8:h-1.4;furniture.push({kind:'desk',id:`desk:${i+1}`,polygon:adult?rect(x-.55,y,1.1,.65):rect(x-.35,y-.5,.7,.35)});push('study',`desk:${i+1}`,x,adult?y+1:y+.2,`书案 ${i+1}`);}push('teach','teacher:1',w/2,adult?h-1:h-1.4,'讲法席');}
 if(['meditation','hall'].includes(b.type))for(let i=0;i<4;i++)push('cultivate',`mat:${i+1}`,.8+i*(w-1.6)/3,h-(adult?2.4:2.2),`蒲团 ${i+1}`);
 if(BUILDINGS[b.type].work){const unitWell=b.type==='well'&&b.buildingGridVersion===BUILDING_GRID.version,n=['farm','granary'].includes(b.type)?4:b.type==='library'||unitWell?1:2;for(let i=0;i<n;i++){const x=unitWell?w/2:adult?1.1+(i%2)*(w-2.2):.9+(i%2)*(w-1.8),y=unitWell?h+.6:adult?1.6:1.2+Math.floor(i/2)*(h-2.2);push('work',`work:${i+1}`,x,y,`作业工位 ${i+1}`);if(d.indoor)furniture.push({kind:'bench',id:`bench:${i+1}`,polygon:adult?rect(x-.6,y-1,1.2,.65):rect(x-.35,y-.65,.7,.35)});}}
 if(b.type==='alchemy'){furniture.push({kind:'furnace',id:'furnace:1',polygon:rect(w/2-1,1,2,1.2)});push('work','work:1',w/2,2.8,'丹炉前操作位');}
 if(b.type==='kitchen'){furniture.push({kind:'stove',id:'stove:1',polygon:rect(.8,.8,1.2,.6)});push('work','work:1',1.4,1.9,'灶前操作位');}
 if(b.type==='hall'){push('care','care:1',w+1,h-.5,'换药席');push('care','care:2',w+1,h-1.5,'照护席');}
 const doorWidth=1.4,door={x:w/2,y:h},walls=d.indoor?[rect(0,0,w,.18),rect(0,0,.18,h),rect(w-.18,0,.18,h),rect(0,h-.18,w/2-doorWidth/2,.18),rect(w/2+doorWidth/2,h-.18,w/2-doorWidth/2,.18)]:[];
 return {...d,id:prefabId(b),cells:b.buildingGridVersion===BUILDING_GRID.version?buildingCellSize(b.type,level):null,width:w,height:h,bounds:{x:0,y:0,width:w,height:h},floor:rect(0,0,w,h),footprint:rect(0,0,w,h),walls,furniture,slots,door,access:{x:w/2,y:h+.6},waiting:[{x:w/2-1,y:h+1},{x:w/2+1,y:h+1}],roof:rect(0,-.15,w,h+.3)};
}
export function spatialTransform(b){return b.transform||{x:b.x,y:b.y,orientation:'south'};}
const worldPolygon=(polygon,t)=>polygon.map(([x,y])=>[x+t.x,y+t.y]);
export function spatialRoom(b){const d=spatialPrefab(b),t=spatialTransform(b);if(!d?.indoor)return null;return {...d,bounds:{x:t.x,y:t.y,width:d.width,height:d.height},door:{x:t.x+d.door.x,y:t.y+d.door.y},floor:worldPolygon(d.floor,t),walls:d.walls.map(p=>worldPolygon(p,t)),furniture:d.furniture.map(f=>({...f,polygon:worldPolygon(f.polygon,t)})),slots:d.slots.map(slot=>({...slot,position:{x:t.x+slot.position.x,y:t.y+slot.position.y}})),lanes:[]};}
function dimensions(b){if(b.buildingGridVersion===BUILDING_GRID.version)return buildingCellSize(b.type,b.level);const d=PREFAB_CATALOG[b.type],n=Math.max(1,b.level||1)-1;return d?{width:d.width+n*2,height:d.height+n*2}:null;}
export function spatialFootprint(b){const d=dimensions(b),t=spatialTransform(b);return d?rect(t.x,t.y,d.width,d.height):[];}
export function spatialAccess(b){const d=dimensions(b),t=spatialTransform(b);return d?{x:t.x+d.width/2,y:t.y+d.height+.6}:null;}
export function spatialSlots(b,kind){const d=spatialPrefab(b),t=spatialTransform(b);return d?d.slots.filter(slot=>slot.kind===kind).map(slot=>({...slot,id:`${b.instanceId||`building:yunxiu:${b.id}`}/slot:${slot.suffix}`,buildingId:b.id,position:{x:t.x+slot.position.x,y:t.y+slot.position.y}})):[];}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-dx*q,p.y-a[1]-dy*q);}
export function polygonContains(p,poly,radius=0){if(poly.aabb){const b=poly.aabb,dx=Math.max(b.left-p.x,0,p.x-b.right),dy=Math.max(b.top-p.y,0,p.y-b.bottom);return dx===0&&dy===0||radius>0&&dx*dx+dy*dy<(radius-1e-7)**2;}let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;if(radius&&segmentDistance(p,a,b)<radius-1e-7)return true;}return inside;}
export const SPATIAL_TERRAIN=Object.freeze([{id:'water:east',label:'东侧水面',kind:'water',polygon:rect(58,8,6,22)},{id:'slope:north',label:'北侧陡坡',kind:'slope',polygon:rect(0,0,SPATIAL_SCENE.width,1)},{id:'protected:gate',label:'归院入口保护区',kind:'protected',polygon:rect(30,57,4,7)}]);
const collisionCache=new WeakMap();
export function spatialRevision(s){return (s.buildings||[]).map(b=>`${b.id}:${b.type}:${b.level}:${b.buildingGridVersion||'metres'}:${b.interiorLayoutVersion||'compact'}:${spatialTransform(b).x}:${spatialTransform(b).y}`).join('|')+';'+(s.spatial?.geometryRevision||0)+';'+(s.spatial?.extentVersion||'legacy-64');}
function obstacles(s){const rev=spatialRevision(s),old=collisionCache.get(s);if(old?.rev===rev)return old.polygons;const polygons=[...SPATIAL_TERRAIN.filter(t=>t.kind!=='protected').map(t=>t.polygon),...(s.buildings||[]).flatMap(b=>{const r=spatialRoom(b);return r?[...r.walls,...r.furniture.map(f=>f.polygon)]:b.type==='well'&&b.buildingGridVersion===BUILDING_GRID.version?[spatialFootprint(b)]:[];})];for(const poly of polygons){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);poly.aabb={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};}const index=new Map();for(const poly of polygons){const b=poly.aabb;for(let y=Math.floor(b.top/2);y<=Math.floor(b.bottom/2);y++)for(let x=Math.floor(b.left/2);x<=Math.floor(b.right/2);x++){const key=`${x}/${y}`;if(!index.has(key))index.set(key,[]);index.get(key).push(poly);}}polygons.spatialIndex=index;polygons.bounds=sceneBounds(s);collisionCache.set(s,{rev,polygons});return polygons;}
function clearPoint(polygons,p,radius=.26){const bounds=polygons.bounds||SPATIAL_SCENE;if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.x<radius||p.y<radius||p.x>bounds.width-radius||p.y>bounds.height-radius)return false;if(!polygons.spatialIndex)return !polygons.some(poly=>polygonContains(p,poly,radius));for(let y=Math.floor((p.y-radius)/2);y<=Math.floor((p.y+radius)/2);y++)for(let x=Math.floor((p.x-radius)/2);x<=Math.floor((p.x+radius)/2);x++)if(polygons.spatialIndex.get(`${x}/${y}`)?.some(poly=>polygonContains(p,poly,radius)))return false;return true;}
function segmentsIntersect(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),v1=cross(a,b,c),v2=cross(a,b,d),v3=cross(c,d,a),v4=cross(c,d,b);if(Math.abs(v1)<1e-10&&Math.abs(v2)<1e-10)return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-10&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-10;return v1*v2<=0&&v3*v4<=0;}
function continuousClear(polygons,from,to,radius){if(!clearPoint(polygons,to,radius))return false;let candidates=polygons;if(polygons.spatialIndex){const nearby=new Set();for(let y=Math.floor((Math.min(from.y,to.y)-radius)/2);y<=Math.floor((Math.max(from.y,to.y)+radius)/2);y++)for(let x=Math.floor((Math.min(from.x,to.x)-radius)/2);x<=Math.floor((Math.max(from.x,to.x)+radius)/2);x++)for(const poly of polygons.spatialIndex.get(`${x}/${y}`)||[])nearby.add(poly);candidates=nearby;}
 const ab=[[from.x,from.y],[to.x,to.y]];for(const poly of candidates)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c={x:a[0],y:a[1]},d={x:b[0],y:b[1]};if(segmentsIntersect(from,to,c,d)||Math.min(segmentDistance(from,a,b),segmentDistance(to,a,b),segmentDistance(c,ab[0],ab[1]),segmentDistance(d,ab[0],ab[1]))<radius-1e-7)return false;}return true;
}
function sweepPolygons(polygons,from,to,radius=.26){if(!clearPoint(polygons,from,radius))return {...from,blocked:true};if(continuousClear(polygons,from,to,radius))return {x:to.x,y:to.y,blocked:false};let lo=0,hi=1;for(let n=0;n<26;n++){const mid=(lo+hi)/2,p={x:from.x+(to.x-from.x)*mid,y:from.y+(to.y-from.y)*mid};if(continuousClear(polygons,from,p,radius))lo=mid;else hi=mid;}return {x:from.x+(to.x-from.x)*lo,y:from.y+(to.y-from.y)*lo,blocked:true};}

export function meterCanStand(s,p,radius=.26){return clearPoint(obstacles(s),p,radius);}
export function meterSweep(s,from,to,radius=.26){return sweepPolygons(obstacles(s),from,to,radius);}
export function meterNearest(s,p,{maxDistance,radius=.26,occupied=[]}={}){
 const polygons=obstacles(s),bounds=polygons.bounds,step=SPATIAL_SCENE.grid,limit=maxDistance??Math.hypot(bounds.width,bounds.height),free=q=>clearPoint(polygons,q,radius)&&!occupied.some(a=>distance(a,q)<radius*2+.01);
 if(free(p))return {x:p.x,y:p.y};if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||limit<0)return null;
 let best=null,bd=Infinity;
 for(let y=Math.max(step,snap(p.y-limit));y<Math.min(bounds.height,p.y+limit);y+=step)for(let x=Math.max(step,snap(p.x-limit));x<Math.min(bounds.width,p.x+limit);x+=step){const q={x,y},d=distance(p,q);if(d<=limit&&d<bd&&free(q)){best=q;bd=d;}}
 return best;
}
function heapPush(heap,n){let i=heap.length;heap.push(n);while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
function heapPop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
export function meterFindPath(s,from,goal,{maxSnap=2,radius=.26}={}){
 const polygons=obstacles(s),clear=p=>clearPoint(polygons,p,radius),sweep=(a,b)=>({blocked:!clear(a)||!continuousClear(polygons,a,b,radius)});if(!clear(from))return null;const to=clear(goal)?{x:goal.x,y:goal.y}:meterNearest(s,goal,{maxDistance:maxSnap,radius});if(!to)return null;if(distance(from,to)<.001)return [];if(!sweep(from,to).blocked)return [to];
 const step=SPATIAL_SCENE.grid,maxX=Math.ceil(polygons.bounds.width/step)-1,maxY=Math.ceil(polygons.bounds.height/step)-1,stride=maxX+1;
 const k=(x,y)=>y*stride+x,open=[],cost=new Map(),parents=new Map(),points=new Map(),closed=new Set();
 for(let y=Math.round(from.y/step)-2;y<=Math.round(from.y/step)+2;y++)for(let x=Math.round(from.x/step)-2;x<=Math.round(from.x/step)+2;x++){const p={x:x*step,y:y*step};if(x<1||y<1||x>maxX||y>maxY||sweep(from,p).blocked)continue;const id=k(x,y),g=distance(from,p);cost.set(id,g);points.set(id,p);heapPush(open,{x,y,id,g,f:g+distance(p,to)});}
 let end=null;while(open.length){const c=heapPop(open);if(closed.has(c.id))continue;closed.add(c.id);const p={x:c.x*step,y:c.y*step};if(distance(p,to)<=1.5&&!sweep(p,to).blocked){end=c.id;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=c.x+dx,y=c.y+dy,id=k(x,y);if(x<1||y<1||x>maxX||y>maxY||closed.has(id))continue;const q={x:x*step,y:y*step};if(sweep(p,q).blocked)continue;const g=c.g+Math.hypot(dx,dy)*step;if(g>=(cost.get(id)??Infinity))continue;cost.set(id,g);parents.set(id,c.id);points.set(id,q);heapPush(open,{x,y,id,g,f:g+distance(q,to)});}}
 if(end===null)return null;const path=[to];for(let n=end;n!==undefined;n=parents.get(n))path.unshift(points.get(n));const result=[];let p=from;while(path.length){let i=path.length-1;while(i>0&&sweep(p,path[i]).blocked)i--;if(sweep(p,path[i]).blocked)return null;if(distance(p,path[i])>.001)result.push(path[i]);p=path[i];path.splice(0,i+1);}return result;
}
const personPosition=(s,p)=>p===s.master?p.scenic:p.mind?.scenic;
const people=s=>Object.values(s.personsById||{}).filter(p=>p.lifeStatus!=='dead'&&!p.left&&!p.mind?.away&&!p.mind?.journey&&(!p.location||p.location.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id)&&(p===s.master||s.homeMemberIds?.includes(p.personId)||p.mind?.scenic));
const walkingPerson=(s,actor)=>people(s).find(p=>personPosition(s,p)===actor);
export function metreWalkTarget(s,actor,goal){
 const mover=walkingPerson(s,actor);if(!mover||!people(s).some(p=>p!==mover&&personPosition(s,p)&&distance(personPosition(s,p),goal)<.53))return goal;
 const occupied=people(s).filter(p=>p!==mover).map(p=>personPosition(s,p)).filter(Boolean);
 return meterNearest(s,goal,{maxDistance:2,occupied})||goal;
}
function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const doorCache=new WeakMap();
function closedDoors(s){const revision=spatialRevision(s),cached=doorCache.get(s);if(cached?.revision===revision)return cached.doors;const doors=s.buildings.flatMap(b=>{const prefab=spatialPrefab(b);if(!prefab?.indoor)return [];const t=spatialTransform(b);return [{entryId:`${b.instanceId}/entry:south`,door:{x:t.x+prefab.door.x,y:t.y+prefab.door.y}}];});doorCache.set(s,{revision,doors});return doors;}
const doorRecord=(s,a)=>Object.values(s.spatial?.doorQueuesByEntryId||{}).find(q=>q.holder?.personId===a.personId||q.waiting.some(w=>w.personId===a.personId));
function doorCrossing(s,from,route,next){
 if(!route?.length)return null;
 for(const {entryId,door} of closedDoors(s)){const goal=route.at(-1),phase=from.y<door.y-.26&&goal.y>door.y+.26?'out':from.y>door.y+.26&&goal.y<door.y-.26?'in':null;
  if(!phase||pointSegmentDistance(door,from,next||from)>1.5)continue;
  let before=from;for(const after of route){if((before.y-door.y)*(after.y-door.y)<=0&&Math.abs(after.y-before.y)>1e-9){const x=before.x+(after.x-before.x)*(door.y-before.y)/(after.y-before.y);if(Math.abs(x-door.x)<=.44+1e-6)return {entryId,phase,door};}before=after;}
 }
 return null;
}
function doorCandidateValid(s,record,entryId){
 const p=s.personsById[record.personId],a=p&&personPosition(s,p);
 if(!p||!a||!closedDoors(s).some(d=>d.entryId===entryId)||!people(s).includes(p)||p.activityId!==record.activityId||!a.path?.length||!a.goal||distance(a.goal,record.target)>.01)return false;
 if(p.wound>20&&['construction','sr-construction','sr-transport'].includes(s.activitiesById[p.activityId]?.kind))return false;
 return true;
}
function pruneDoorQueues(s){
 const queues=s.spatial?.doorQueuesByEntryId;if(!queues)return;
 for(const [entryId,q]of Object.entries(queues)){
  if(!closedDoors(s).some(d=>d.entryId===entryId)){delete queues[entryId];continue;}
  if(q.holder&&!doorCandidateValid(s,q.holder,entryId)){q.holder=null;q.lastPassTick=s.worldTick;}
  q.waiting=q.waiting.filter(w=>doorCandidateValid(s,w,entryId));
  q.waiting.sort((a,b)=>a.firstArrivalTick-b.firstArrivalTick||a.personId.localeCompare(b.personId));
  if(!q.holder&&!q.waiting.length&&q.lastPassTick<s.worldTick-1)delete queues[entryId];
 }
}
function requestDoorWaitingStep(s,p,q,door,phase){
 const a=personPosition(s,p);if(a.bodyYield?.kind==='door-wait')return;
 const holder=s.personsById[q.holder?.personId],holderAt=holder&&personPosition(s,holder),candidates=[];
 for(let y=snap(door.y-2);y<=snap(door.y+2);y+=.5)for(let x=snap(door.x-2);x<=snap(door.x+2);x+=.5){const at={x,y};
  if(phase==='in'?y<door.y+.8:y>door.y-.8)continue;
  if(Math.abs(x-door.x)<.8||distance(a,at)<.2||distance(a,at)>2.5||holderAt&&distance(holderAt,at)<.8||!meterCanStand(s,at)||people(s).some(other=>other!==p&&personPosition(s,other)?.bodyYield?.target&&distance(personPosition(s,other).bodyYield.target,at)<.53))continue;
  const path=meterFindPath(s,a,at,{maxSnap:0});if(path===null||doorCrossing(s,a,path,at)||path.some((end,i)=>meterBodyBlocker(s,a,i?path[i-1]:a,end)))continue;
  candidates.push({at,path,cost:path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:a,end),0)});
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.at.y-b.at.y||a.at.x-b.at.x);
 if(candidates.length)a.bodyYield={kind:'door-wait',requestedBy:q.holder.personId,startedTick:s.worldTick,target:candidates[0].at,path:candidates[0].path};
}
/** Single-person door ownership is granted only by a real world movement step. */
export function meterDoorPermit(s,actor,from,route,next){
 if(!spatialEnabled(s)||!walkingPerson(s,actor))return true;
 const p=walkingPerson(s,actor);pruneDoorQueues(s);
 const crossing=doorCrossing(s,from,route,next),prior=doorRecord(s,p);
 if(prior&&crossing&&prior.entryId!==crossing.entryId){if(prior.holder?.personId===p.personId)prior.holder=null;prior.waiting=prior.waiting.filter(w=>w.personId!==p.personId);}
 if(!crossing){if(!prior)return true;if(prior.holder?.personId===p.personId)return true;if(!prior.holder&&prior.lastPassTick<s.worldTick&&prior.waiting[0]?.personId===p.personId&&prior.waiting[0].firstArrivalTick<s.worldTick){prior.holder=prior.waiting.shift();return true;}return false;}
 s.spatial.doorQueuesByEntryId??={};const queues=s.spatial.doorQueuesByEntryId,q=queues[crossing.entryId]??={entryId:crossing.entryId,holder:null,waiting:[],lastPassTick:-1};
 const current=q.holder?.personId===p.personId?q.holder:q.waiting.find(w=>w.personId===p.personId);
 if(!current)q.waiting.push({entryId:crossing.entryId,personId:p.personId,firstArrivalTick:s.worldTick,activityId:p.activityId??null,target:{...actor.goal},phase:crossing.phase});
 q.waiting.sort((a,b)=>a.firstArrivalTick-b.firstArrivalTick||a.personId.localeCompare(b.personId));
 if(!q.holder&&q.lastPassTick<s.worldTick&&q.waiting[0]?.firstArrivalTick<s.worldTick)q.holder=q.waiting.shift();
 if(q.holder?.personId!==p.personId&&q.holder)requestDoorWaitingStep(s,p,q,crossing.door,crossing.phase);
 return q.holder?.personId===p.personId;
}
export function meterDoorMoved(s,actor){
 const p=walkingPerson(s,actor);if(!p)return;const q=doorRecord(s,p);if(q?.holder?.personId!==p.personId)return;
 const door=closedDoors(s).find(d=>d.entryId===q.entryId)?.door;if(!door)return;
 if(q.holder.phase==='out'&&actor.y>door.y+.26||q.holder.phase==='in'&&actor.y<door.y-.26){q.holder=null;q.lastPassTick=s.worldTick;}
}
/** Only real courtyard bodies participate; a renderer's copied pose remains read-only. */
export function meterBodyBlocker(s,actor,from,to){
 if(!spatialEnabled(s))return null;
 const mover=walkingPerson(s,actor);if(!mover)return null;
 return people(s).find(p=>{if(p===mover)return false;const q=personPosition(s,p);if(!q)return false;const before=distance(from,q),after=distance(to,q);
  // Legal old positions may already overlap: walking outward must remain possible.
  return !(before<.53-1e-7&&after>before+1e-7)&&pointSegmentDistance(q,from,to)<.53-1e-7;
 })||null;
}
/** A bounded half-metre bypass rejoins the original route without changing its goal. */
export function meterLocalBodyDetour(s,actor,from,route){
 if(!spatialEnabled(s)||!walkingPerson(s,actor)||!route?.length)return null;
 const blocker=meterBodyBlocker(s,actor,from,route[0]);if(!blocker)return null;
 const q=personPosition(s,blocker),candidates=[];
 for(let y=snap(q.y-1.5);y<=snap(q.y+1.5);y+=.5)for(let x=snap(q.x-1.5);x<=snap(q.x+1.5);x+=.5){const at={x,y},first=distance(from,at);if(first<.05||first>2.5||!meterCanStand(s,at)||meterSweep(s,from,at).blocked||meterBodyBlocker(s,actor,from,at))continue;
  for(let j=0;j<route.length;j++){const end=route[j];if(meterSweep(s,at,end).blocked||meterBodyBlocker(s,actor,at,end))continue;const suffix=route.slice(j);candidates.push({path:[at,...suffix],cost:first+distance(at,end)+j*.001,x,y});break;}
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);return candidates[0]?.path||null;
}
/** An idle local person can physically step aside without changing a task or material reservation. */
export function requestBodyYield(s,actor,blocker,route){
 const mover=walkingPerson(s,actor),q=personPosition(s,blocker);
 if(!mover||!q||blocker===mover||blocker.activityId||q.path?.length||q.bodyYield||!route?.length)return false;
 const from={x:q.x,y:q.y},points=[];
 for(let y=snap(from.y-2);y<=snap(from.y+2);y+=.5)for(let x=snap(from.x-2);x<=snap(from.x+2);x+=.5){const at={x,y},away=distance(from,at);if(away<.53||away>2.25||!meterCanStand(s,at))continue;
  if(pointSegmentDistance(at,actor,route[0])<.8||route.some((end,i)=>pointSegmentDistance(at,i?route[i-1]:actor,end)<.8))continue;
  const path=meterFindPath(s,from,at,{maxSnap:0});if(path===null||!path.length||doorCrossing(s,from,path,at)||closedDoors(s).some(d=>distance(at,d.door)<.8)||path.some((end,i)=>meterBodyBlocker(s,q,i?path[i-1]:from,end)))continue;
  points.push({at,path,cost:path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:from,end),0)});
 }
 points.sort((a,b)=>a.cost-b.cost||a.at.y-b.at.y||a.at.x-b.at.x);
 if(!points.length)return false;
 q.bodyYield={requestedBy:mover.personId,startedTick:s.worldTick,target:points[0].at,path:points[0].path};return true;
}
function syncPosition(s,p){const a=personPosition(s,p);if(a&&(!p.location||p.location.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id)&&p.position?.kind!=='travel'&&(!p.position?.sceneId||p.position.sceneId===SPATIAL_SCENE.id))p.position={kind:'scene',sceneId:SPATIAL_SCENE.id,x:a.x,y:a.y};}
function overlaps(a,b){return a.x<b.x+b.w-.001&&a.x+a.w>b.x+.001&&a.y<b.y+b.h-.001&&a.y+a.h>b.y+.001;}
function footprintRect(b){const t=spatialTransform(b),d=dimensions(b);return {x:t.x,y:t.y,w:d.width,h:d.height};}
const connectivityCache=new WeakMap();
function rememberedConnection(s,origin,goal){const rev=spatialRevision(s);let data=connectivityCache.get(s);if(data?.revision!==rev){data={revision:rev,routes:new Map()};connectivityCache.set(s,data);}const key=`${goal.x}/${goal.y}`;if(!data.routes.has(key))data.routes.set(key,meterFindPath(s,origin,goal,{maxSnap:0}));return data.routes.get(key);}
function routeStillClear(s,origin,route){if(route===null)return false;const polygons=obstacles(s);if(!clearPoint(polygons,origin,.26))return false;let p=origin;for(const q of route){if(!continuousClear(polygons,p,q,.26))return false;p=q;}return true;}
export function placementIssue(s,type,x,y,{ignoreId=null,level=1,checkPeople=true,checkReservations=true,checkConnectivity=true}={}){
 if(!PREFAB_CATALOG[type]||!Number.isFinite(x)||!Number.isFinite(y)||snap(x)!==x||snap(y)!==y)return '位置须在合法营造格上；仅支持南向预制件。';
 if(buildingGridEnabled(s)&&(!onBuildingGrid(x)||!onBuildingGrid(y)))return '位置须对齐建筑单位格；每格2米。';
 const bounds=sceneBounds(s),b=layoutBuilding(s,{type,level,transform:{x,y,orientation:'south'}}),r=footprintRect(b),poly=spatialFootprint(b);
 if(x<1||y<1||x+r.w>bounds.width-1||y+r.h+1>bounds.height-1)return '此处超出可建边界或未留门外通道。';
 for(const t of SPATIAL_TERRAIN){const xs=t.polygon.map(p=>p[0]),ys=t.polygon.map(p=>p[1]);if(overlaps(r,{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}))return `${t.label}不能营造。`;}
 for(const old of s.buildings||[]){if(old.id===ignoreId)continue;if(overlaps(r,footprintRect(old)))return `与${BUILDINGS[old.type].name}（${old.id}）占地冲突。`;if(polygonContains(spatialAccess(old),poly,.65))return `挡住${BUILDINGS[old.type].name}入口与门外通路。`;if(polygonContains(spatialAccess(b),spatialFootprint(old),.65))return `${BUILDINGS[old.type].name}占地挡住新设施入口与门外通路。`;}
 if(checkReservations)for(const o of Object.values(s.workOrdersById||{})){if(o.kind!=='construction'||!o.spatial||['cancelled','completed'].includes(o.phase)||o.targetId===`building:yunxiu:${ignoreId}`||o.operation==='demolish')continue;const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform});if(overlaps(r,footprintRect(planned)))return '该位置已有施工预约。';}
 if(checkPeople)for(const p of people(s)){const q=personPosition(s,p);if(q&&polygonContains(q,poly,.26))return `${p.name||p.personId}正在此处，请等其走开。`;}
 if(!checkConnectivity)return '';
 const candidate={...s,buildings:[...(s.buildings||[]).filter(old=>old.id!==ignoreId),b]},entry=spatialAccess(b),origin={x:32,y:56};if(!meterCanStand(candidate,entry)||!meterFindPath(candidate,origin,entry,{maxSnap:0}))return '入口未与归院道路连通，或门道过窄。';
 for(const old of candidate.buildings){if(old===b)continue;const a=spatialAccess(old);if(!meterCanStand(candidate,a)||!routeStillClear(candidate,origin,rememberedConnection(s,origin,a))&&!meterFindPath(candidate,origin,a,{maxSnap:0}))return `改动会封住${BUILDINGS[old.type].name}入口。`;}
 return '';
}
export function initSpatial(s){
 if(spatialEnabled(s))return s;const originalPeople=people(s).map(p=>[p,personPosition(s,p)]),oldBuildings=s.buildings||[];
 s.spatial={version:SPATIAL_VERSION,extentVersion:SPATIAL_EXTENT_VERSION,sceneId:SPATIAL_SCENE.id,geometryRevision:1,migrations:[],completedOrders:[]};
 const bounds=sceneBounds(s);
 const placed=[];for(const b of oldBuildings){const d=spatialPrefab(b),p=b.type==='hall'?{x:24,y:4}:legacyToWorld(b.legacyScenicPosition||scenicPoint(b.x,b.y)||{x:100+b.x*110,y:250+b.y*75});let target={x:snap(p.x-d.width/2),y:snap(p.y-d.height)};if(b.type==='hall')target={x:24,y:4};const test={...s,buildings:placed};let reason=placementIssue(test,b.type,target.x,target.y,{level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:true});if(reason){let found=null;const candidates=[];for(let y=1;y<=bounds.height-d.height-2;y+=SPATIAL_SCENE.grid)for(let x=1;x<=bounds.width-d.width-1;x+=SPATIAL_SCENE.grid)candidates.push({x,y,distance:distance(target,{x,y})});candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);for(const q of candidates){if(!placementIssue(test,b.type,q.x,q.y,{level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:true})){found={x:q.x,y:q.y};break;}}if(!found)throw Error(`空间迁移无法安置${b.instanceId}；保留原档，不丢弃建筑。`);s.spatial.migrations.push({entityId:b.instanceId,kind:'building-layout-repair',from:target,to:found,reason});target=found;}
  b.transform={...target,orientation:'south'};b.prefabId=PREFAB_CATALOG[b.type].id;b.sceneId=SPATIAL_SCENE.id;delete b.legacyScenicPosition;placed.push(b);
 }
 for(const b of s.buildings){const entry=spatialAccess(b);if(!meterCanStand(s,entry)||!meterFindPath(s,{x:32,y:56},entry,{maxSnap:0}))throw Error(`空间迁移入口不可达：${b.instanceId}；原档保留。`);}
 const occupiedFeet=[];for(const [p,a]of originalPeople){if(!a){const preferred=spatialAccess(s.buildings.find(b=>b.type==='hall')),entry=meterNearest(s,preferred,{occupied:occupiedFeet});if(!entry)throw Error('空间迁移找不到互不重叠的安全脚点，原档仍保留。');occupiedFeet.push(entry);const owner=p===s.master?p:(p.mind??={});owner.scenic={...entry,path:[],goal:null,steps:0,facing:1,back:false,geometry:SPATIAL_VERSION,revision:spatialRevision(s)};s.spatial.migrations.push({entityId:p.personId,kind:'missing-position-init',to:entry,reason:'旧档没有场景脚点，确定安置主屋门外'});continue;}const from={x:a.x,y:a.y},q=legacyToWorld(a),legal=meterNearest(s,q,{occupied:occupiedFeet});if(!legal)throw Error('空间迁移找不到安全位置，原档仍保留。');occupiedFeet.push(legal);Object.assign(a,legal,{path:[],goal:null,steps:(a.steps||0)/32,geometry:SPATIAL_VERSION,revision:spatialRevision(s)});if(distance(q,legal)>.001)s.spatial.migrations.push({entityId:p.personId,kind:'person-position-repair',from:q,to:legal,reason:'原脚点落在墙面、家具或其他人物占位，加载时确定修复'});else s.spatial.migrations.push({entityId:p.personId,kind:'coordinate-map',from,to:legal});}
 for(const a of Object.values(s.activitiesById||{})){if(a.kind!=='facility')continue;const p=s.personsById[a.personId],b=s.buildingsById[a.targetId],pos=p&&personPosition(s,p),slot=b&&spatialSlots(b,a.action).find(slot=>slot.id===a.slotId),route=pos&&slot&&meterFindPath(s,pos,slot.position,{maxSnap:0});if(slot&&route!==null){a.phase='navigating';a.reason='旧工位映射为米制家具，沿真实路线继续原任务。';pos.path=route;pos.goal={...slot.position};pos.activitySlotId=slot.id;}else{if(a.reservationId)delete s.reservationsById[a.reservationId];delete a.reservationId;delete a.slotId;a.phase='waiting';a.reason='原工位在新布局暂不可达，释放独占预约等待合法位置；原投入保留。';if(pos){pos.path=[];pos.goal=null;delete pos.activitySlotId;}}a.resumeNote='空间升级保留工作单进度/材料，只重新验证到场。';s.spatial.migrations.push({entityId:a.id,kind:'activity-slot-resume',phase:a.phase,slotId:a.slotId||null,reason:a.reason});}
 // Preserve in-flight old construction by mapping its goal; one existing order remains authoritative.
 for(const a of Object.values(s.activitiesById||{}))if(a.kind==='construction'){const o=s.workOrdersById[a.workOrderId];if(!o||o.spatial)continue;const d=spatialPrefab(a),p=legacyToWorld(a.target);o.spatial=true;o.operation='build';o.buildingType=a.type;o.targetLevel=1;o.targetTransform={x:snap(p.x-d.width/2),y:snap(p.y-d.height-.6),orientation:'south'};o.sourceTransform=null;const reservation=s.reservationsById[a.reservationId];if(reservation)reservation.kind='construction-material';o.usedCost=Object.fromEntries(Object.entries(reservation?.cost||{}).map(([key,value])=>[key,Math.floor(value*o.progressTicks/o.durationTicks)]));o.evacuations=[];a.operation='build';a.transform=o.targetTransform;a.target=spatialAccess({type:a.type,transform:a.transform});a.phase='moving';const pos=s.master.scenic;pos.path=meterFindPath(s,pos,a.target)||[];pos.goal=pos.path.at(-1)||null;}
 for(const p of people(s))syncPosition(s,p);return s;
}
function pay(s,cost){for(const [k,v]of Object.entries(cost))if(!Number.isFinite(s.resources[k])||s.resources[k]<v)throw Error(`${k}材料不足。`);for(const [k,v]of Object.entries(cost))s.resources[k]-=v;}
function grant(s,cost){for(const [k,v]of Object.entries(cost))s.resources[k]+=v;}
function log(s,message){gameLog(s,message);}
/** Loading/upgrade owner calls this on an isolated state. No time, RNG or fees.
 * Existing metre saves are validated before conversion; identity and job progress
 * survive. The explicit mapping is persisted and never performed by a renderer. */
function initSpatialExtent(s){
 if(s.spatial.extentVersion===SPATIAL_EXTENT_VERSION)return s;
 // Validation remains on the legacy boundary until every original position,
 // route and construction target is accepted. Expansion only adds metadata.
 validateSpatial(s);s.spatial.extentVersion=SPATIAL_EXTENT_VERSION;return s;
}
function initInteriorLayout(s){
 const version=s.spatial.interiorLayoutVersion;
 if(version&&version!==INTERIOR_LAYOUT_VERSION)throw Error('未知室内布局版本，原存档保留。');
 const pending=s.buildings.filter(b=>rooms.has(b.type)&&b.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION);
 if(version===INTERIOR_LAYOUT_VERSION&&!pending.length)return s;
 // The loader owns an isolated copy. Validate compact furniture before changing
 // its geometry so a corrupt original position cannot be silently repaired.
 validateSpatial(s);
 const kinds=['rest','heal','study','teach','cultivate','work','care'];
 const oldSlots=new Map(pending.flatMap(b=>kinds.flatMap(kind=>spatialSlots(b,kind))).map(slot=>[slot.id,slot]));
 const present=people(s),snapshots=present.map(p=>({person:p,position:personPosition(s,p)&&structuredClone(personPosition(s,p))}));
 // Travellers retain their actual world position. Their dormant courtyard feet
 // are a return anchor, and must remain usable when this furniture is restored.
 const returning=Object.values(s.personsById||{}).filter(p=>(p===s.master||s.homeMemberIds?.includes(p.personId))&&p.lifeStatus!=='dead'&&!p.left&&!present.includes(p)).map(p=>({person:p,position:personPosition(s,p)&&structuredClone(personPosition(s,p))})).filter(({position:q})=>q&&meterCanStand(s,q));
 for(const b of pending){b.interiorLayoutVersion=INTERIOR_LAYOUT_VERSION;s.spatial.migrations.push({entityId:b.instanceId,kind:'adult-furniture-layout',version:INTERIOR_LAYOUT_VERSION,reason:'成人床、书案与室内通道采用同一预制件；保留原槽位身份。'});}
 s.spatial.interiorLayoutVersion=INTERIOR_LAYOUT_VERSION;s.spatial.geometryRevision++;
 const slots=new Map(pending.flatMap(b=>kinds.flatMap(kind=>spatialSlots(b,kind))).map(slot=>[slot.id,slot]));
 const mapAnchor=point=>{if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return point;for(const [id,old]of oldSlots)if(distance(point,old.position)<.04)return {...point,...slots.get(id).position};return {...point};};
 const occupied=[];
 // Existing executing reservations take their corresponding furniture first.
 snapshots.sort((a,b)=>Number(s.activitiesById[b.person.activityId]?.phase==='executing')-Number(s.activitiesById[a.person.activityId]?.phase==='executing'));
 for(const {person:p,position:old}of snapshots){
  if(!old)continue;const q=personPosition(s,p),a=s.activitiesById[p.activityId],slot=a&&slots.get(a.slotId),oldSlot=a&&oldSlots.get(a.slotId);
  const preferred=slot&&oldSlot&&distance(old,oldSlot.position)<.04?slot.position:{x:old.x,y:old.y};
  const legal=meterNearest(s,preferred,{occupied});if(!legal)throw Error(`室内布局无法保留${p.name||p.personId}的安全脚点，原存档保留。`);
  occupied.push(legal);Object.assign(q,legal,{path:[],goal:null,revision:spatialRevision(s)});
  if(slot){if(a.target)a.target=mapAnchor(a.target);if(a.anchor)a.anchor=mapAnchor(a.anchor);}
  const goal=slot?.position||mapAnchor(old.goal);
  if(goal&&Number.isFinite(goal.x)&&Number.isFinite(goal.y)){const route=meterFindPath(s,q,goal,{maxSnap:0});if(route!==null){q.path=route;q.goal={...goal};}else if(a){a.reason='室内家具调整后正在等候可达通路，原任务投入与进度保留。';}}
  if(a?.kind==='facility'&&slot&&a.phase==='executing'&&(q.path.length||distance(q,slot.position)>=.04))a.phase='navigating';
  syncPosition(s,p);
  if(distance(old,legal)>.001)s.spatial.migrations.push({entityId:p.personId,kind:'person-adult-furniture',from:{x:old.x,y:old.y},to:legal,slotId:slot?.id||null,reason:'随原家具映射到合法脚点，活动和投入保持。'});
 }
 for(const {person:p,position:old}of returning){
  if(meterCanStand(s,old))continue;const legal=meterNearest(s,old,{occupied});if(!legal)throw Error(`室内布局无法保留${p.name||p.personId}的安全返院位置，原存档保留。`);
  occupied.push(legal);Object.assign(personPosition(s,p),legal,{path:[],goal:null,revision:spatialRevision(s)});
  if(s.srWorld?.homeReturnPositions?.[p.personId])s.srWorld.homeReturnPositions[p.personId]={...legal};
  s.spatial.migrations.push({entityId:p.personId,kind:'home-return-adult-furniture',from:{x:old.x,y:old.y},to:legal,reason:'更新家具后的安全返院脚点；山外位置与行程进度保持。'});
 }
 for(const orders of [s.srCultivation?.orders,s.srEquipment?.orders])for(const o of Object.values(orders||{}))if(o.target&&['reserved','executing','blocked'].includes(o.phase)&&pending.some(b=>b.instanceId===o.workstationId))o.target=mapAnchor(o.target);
 for(const stock of Object.values(s.stockpilesById||{}))if(!stock.carrierId&&stock.position?.sceneId===SPATIAL_SCENE.id&&!meterCanStand(s,stock.position)){const legal=meterNearest(s,stock.position);if(!legal)throw Error('室内布局无法保留地面物资的可达位置，原存档保留。');stock.position={...stock.position,...legal};}
 validateSpatial(s);return s;
}
export function initBuildingGrid(s){
 if(!spatialEnabled(s))return s;
 pruneDoorQueues(s);pruneBodyYields(s);
 if(buildingGridEnabled(s))return initInteriorLayout(initSpatialExtent(s));
 if(s.spatial.buildingGridVersion)throw Error('未知建筑单位格版本，原存档保留。');
 validateSpatial(s);const bounds=sceneBounds(s);
 const oldBuildings=s.buildings.map(b=>({...b,transform:{...b.transform}}));
 const oldPeople=people(s).map(p=>({person:p,position:personPosition(s,p)&&structuredClone(personPosition(s,p))}));
 const oldById=new Map(oldBuildings.map(b=>[b.instanceId,b]));
 const nearestCell=n=>Math.round(n/BUILDING_GRID.metres)*BUILDING_GRID.metres;
 s.spatial.buildingGridVersion=BUILDING_GRID.version;
 const candidates=(type,level,preferred)=>{
  const d=buildingCellSize(type,level),points=[];
  for(let y=BUILDING_GRID.metres;y+d.height+1<=bounds.height-1;y+=BUILDING_GRID.metres)for(let x=BUILDING_GRID.metres;x+d.width<=bounds.width-1;x+=BUILDING_GRID.metres)points.push({x,y});
  return points.sort((a,b)=>distance(a,preferred)-distance(b,preferred)||a.y-b.y||a.x-b.x);
 };
 const placed=[];
 for(const b of s.buildings.slice().sort((a,b)=>(a.type==='hall'?-1:0)-(b.type==='hall'?-1:0)||a.id-b.id)){
  const old=oldById.get(b.instanceId),preferred={x:nearestCell(old.transform.x),y:nearestCell(old.transform.y)},view={...s,buildings:placed};
  const target=candidates(b.type,b.level,preferred).find(q=>!placementIssue(view,b.type,q.x,q.y,{level:b.level,checkPeople:false,checkReservations:false}));
  if(!target)throw Error(`单位格迁移无法合法安置${BUILDINGS[b.type].name}，原存档保留。`);
  b.buildingGridVersion=BUILDING_GRID.version;b.transform={...target,orientation:'south'};b.prefabId=prefabId(b);placed.push(b);
  s.spatial.migrations.push({entityId:b.instanceId,kind:'building-unit-grid',from:{...old.transform,width:dimensions(old).width,height:dimensions(old).height},to:{...b.transform,...buildingCellSize(b.type,b.level)},reason:'U-99整格占地；最近合法单位格，保留建筑身份/等级/库存/投入。'});
 }
 s.spatial.geometryRevision++;
 // Convert only home geometry anchors. Other scenes and historical facts remain
 // in their original coordinate system; their people are never moved here.
 const mapPoint=p=>{
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return p;
  const near=oldBuildings.map(b=>({b,entry:spatialAccess(b)})).find(o=>distance(p,o.entry)<1.5);
  const old=near?.b||oldBuildings.find(b=>polygonContains(p,spatialFootprint(b)));
  if(!old)return {x:p.x,y:p.y};
  const b=s.buildingsById?.[old.instanceId]||s.buildings.find(b=>b.instanceId===old.instanceId);
  if(near){const at=spatialAccess(b);return {x:at.x+p.x-near.entry.x,y:at.y+p.y-near.entry.y};}
  const a=dimensions(old),d=dimensions(b);return {x:b.transform.x+(p.x-old.transform.x)*d.width/a.width,y:b.transform.y+(p.y-old.transform.y)*d.height/a.height};
 };
 // A smaller unit prefab may remove a workstation (the old well had two).
 // Release only that physical reservation; shared production input/progress
 // and the person's activity identity remain intact for the normal FIFO queue.
 for(const a of Object.values(s.activitiesById||{})){
  if(a.kind!=='facility'||!a.slotId)continue;const b=s.buildingsById[a.targetId];
  if(b&&spatialSlots(b,a.action).some(slot=>slot.id===a.slotId))continue;
  const oldSlotId=a.slotId,releasedReservationId=a.reservationId||null;
  if(a.reservationId)delete s.reservationsById[a.reservationId];a.slotId=null;a.reservationId=null;a.phase='waiting';
  a.reason='单位格调整后原工位取消，保留生产投入与进度，在门外等候有效工位。';delete a.waitingPosition;
  s.spatial.migrations.push({entityId:a.id,kind:'activity-unit-grid-wait',oldSlotId,releasedReservationId,phase:a.phase,reason:a.reason});
 }
 const occupiedFeet=[];
 for(const {person:p,position:old} of oldPeople){
  if(!old)continue;const q=personPosition(s,p),a=s.activitiesById[p.activityId],b=a&&s.buildingsById[a.targetId];
  const slot=b&&['rest','heal','study','teach','cultivate','work','care'].flatMap(kind=>spatialSlots(b,kind)).find(slot=>slot.id===a.slotId);
  const oldBuilding=b&&oldById.get(b.instanceId),oldSlot=oldBuilding&&['rest','heal','study','teach','cultivate','work','care'].flatMap(kind=>spatialSlots(oldBuilding,kind)).find(slot=>slot.id===a.slotId);
  const preferred=slot&&oldSlot&&distance(old,oldSlot.position)<.06?slot.position:mapPoint(old);
  const legal=meterNearest(s,preferred,{occupied:occupiedFeet});
  if(!legal)throw Error(`单位格迁移找不到${p.name}的安全脚点，原存档保留。`);
  occupiedFeet.push(legal);Object.assign(q,legal,{path:[],goal:null,revision:null});
  if(a){delete a.waitingPosition;if(Number.isFinite(a.target?.x)&&Number.isFinite(a.target?.y)&&a.kind!=='construction')a.target=mapPoint(a.target);if(Number.isFinite(a.anchor?.x)&&Number.isFinite(a.anchor?.y))a.anchor=mapPoint(a.anchor);}
  if(a?.kind==='facility'){if(slot)q.activitySlotId=slot.id;else delete q.activitySlotId;}
  const goal=a?.kind==='facility'?slot?.position:slot?.position||a?.target||old.goal&&mapPoint(old.goal);
  if(goal&&Number.isFinite(goal.x)&&Number.isFinite(goal.y)){const route=meterFindPath(s,q,goal,{maxSnap:0});if(route!==null){q.path=route;q.goal={...goal};}else if(a){a.reason='单位格调整后通路受阻，原任务投入和进度保留，等待恢复。';}}
  if(a?.kind==='facility'&&slot&&a.phase==='executing'&&(q.path.length||distance(q,slot.position)>=.04))a.phase='navigating';
  syncPosition(s,p);
  if(distance(old,legal)>.001)s.spatial.migrations.push({entityId:p.personId,kind:'person-unit-grid',from:{x:old.x,y:old.y},to:legal,reason:'随原建筑/工位映射到合法脚点，不推进活动。'});
 }
 for(const st of Object.values(s.stockpilesById||{})){
  if(st.buildingId&&s.buildingsById[st.buildingId])st.position={sceneId:SPATIAL_SCENE.id,...spatialAccess(s.buildingsById[st.buildingId])};
  else if(st.position?.sceneId===SPATIAL_SCENE.id&&!st.carrierId){const at=meterNearest(s,mapPoint(st.position));if(!at)throw Error('单位格迁移无法保留地面物资可达位置。');st.position={...st.position,...at};}
 }
 for(const patch of Object.values(s.srEconomy?.patches||{}))if(patch.position?.sceneId===SPATIAL_SCENE.id){const at=meterNearest(s,patch.position);if(at)patch.position={...patch.position,...at};}
 for(const o of Object.values(s.workOrdersById||{})){
  if(!o.spatial||o.kind!=='construction')continue;const a=s.activitiesById[o.activityIds[0]],source=s.buildingsById[o.targetId],preferred={x:nearestCell(o.targetTransform.x),y:nearestCell(o.targetTransform.y)};
  let target=['upgrade','demolish'].includes(o.operation)&&source?source.transform:candidates(o.buildingType,o.targetLevel,preferred).find(q=>!placementIssue(s,o.buildingType,q.x,q.y,{level:o.targetLevel,ignoreId:source?.id,checkPeople:false,checkReservations:false}));
  if(!target)throw Error('单位格迁移无法保留在建事务的合法目标，原存档保留。');
  o.targetTransform={...target,orientation:'south'};if(source)o.sourceTransform={...source.transform};o.buildingGridVersion=BUILDING_GRID.version;
  a.transform={...o.targetTransform};a.target=o.operation==='build'?spatialAccess(layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform})):spatialAccess(source);
  const q=s.master.scenic,route=meterFindPath(s,q,a.target,{maxSnap:0});q.path=route||[];q.goal=route===null?null:{...a.target};a.phase=route===null?'blocked':route.length?'moving':'working';
  a.reason='单位格调整保留原施工材料与进度，重新核对实际到场。';
 }
 log(s,'山院已按建筑单位格对齐。原建筑、人物、库存与任务进度保留；铺路暂缓。');
 return initInteriorLayout(initSpatialExtent(s));
}
export function spatialConstruction(s){const a=s.activitiesById?.[s.master.activityId];return a?.kind==='construction'&&s.workOrdersById[a.workOrderId]?.spatial?a:null;}
const CONSTRUCTION_INJURY_LIMIT=20;
const CONSTRUCTION_ENERGY_MIN=22;
function constructionWorkSlots(s,orderId,building){
 const size=dimensions(building),t=spatialTransform(building),entry=spatialAccess(building),footprint=spatialFootprint(building),slots=[];
 for(const side of [-1,1]){
  const preferred={x:entry.x+side*1.25,y:t.y+size.height+1.5},candidates=[];
  for(let y=snap(preferred.y-2);y<=preferred.y+2;y+=SPATIAL_SCENE.grid)for(let x=snap(preferred.x-2);x<=preferred.x+2;x+=SPATIAL_SCENE.grid){const point={x,y},d=distance(point,preferred);if(d<=2+1e-9)candidates.push({point,d});}
  candidates.sort((a,b)=>a.d-b.d||a.point.y-b.point.y||a.point.x-b.point.x);
  const selected=candidates.find(({point})=>point.y>=t.y+size.height+1&&distance(point,entry)>=.91&&!polygonContains(point,footprint,.26)&&slots.every(slot=>distance(slot.position,point)>=.53)&&meterCanStand(s,point)&&meterFindPath(s,entry,point,{maxSnap:0})!==null);
  if(selected)slots.push({id:`${orderId}/slot:${slots.length+1}`,position:selected.point,occupantId:null,firstArrivalTick:null});
 }
 return slots;
}
function constructionMaterials(cost){return Object.fromEntries(Object.entries(cost).filter(([k,v])=>k!=='jade'&&v>0));}
function constructionStockpile(s,id,label,at,capacity,materials={}){
 const pills=Object.fromEntries(Object.keys(s.stockpilesById['stockpile:yunxiu'].pills||{}).map(k=>[k,0]));
 return {id,label,ownerId:'person:master',custodianId:'person:master',access:'private',capacity,position:{sceneId:SPATIAL_SCENE.id,x:at.x,y:at.y},resources:{...emptyResources(),...materials},pills};
}
function setupConstructionMaterials(s,a,o,cost,sourceRoute){
 const materials=constructionMaterials(cost);if(!Object.keys(materials).length)return;
 const sourceId=`stockpile:construction:source:${a.buildingId}`,siteId=`stockpile:construction:site:${a.buildingId}`;
 const source=s.stockpilesById['stockpile:yunxiu'].position||{sceneId:SPATIAL_SCENE.id,...spatialAccess(s.buildings.find(b=>b.type==='hall'))},capacity=Math.max(CONSTRUCTION_CARRY_CAPACITY,Object.values(materials).reduce((n,v)=>n+v,0));
 s.stockpilesById[sourceId]=constructionStockpile(s,sourceId,'主屋预留施工材料',source,capacity,materials);
 s.stockpilesById[siteId]=constructionStockpile(s,siteId,'工地待用材料',a.target,capacity);
 o.materialFlow={version:CONSTRUCTION_MATERIAL_FLOW,sourceStockpileId:sourceId,siteStockpileId:siteId,phase:'to-source',cargo:{},carrierId:'person:master',trips:[],cancelRequested:false};
 s.master.scenic.path=sourceRoute;s.master.scenic.goal=sourceRoute.at(-1)||{x:source.x,y:source.y};
 s.master.action=sourceRoute.length?'walk':'rest';a.phase='moving';a.reason='前往主屋领取已预留的施工材料。';
}
function begin(s,operation,b,targetTransform){
 if(spatialConstruction(s)||s.master.activityId&&s.activitiesById[s.master.activityId]?.kind==='construction')throw Error('先完成或取消当前营造事务。');
 if(s.master.activityId&&s.activitiesById[s.master.activityId]?.kind!=='facility')throw Error('先完成或安全取消掌门当前身体事务，再开始营造。');
 if(s.master.location&&(s.master.location.kind!=='local'||s.master.location.sceneId!==SPATIAL_SCENE.id)||s.master.wound>0||s.master.energy<15||s.world?.exploration||s.master.journey||s.combat?.status==='active')throw Error('先归院养伤并恢复精力。');
 const def=BUILDINGS[b.type],targetLevel=operation==='upgrade'?b.level+1:b.level;if(targetLevel>def.max)throw Error('建筑已满级。');
 if(['relocate','demolish'].includes(operation)&&b.type==='hall')throw Error('主屋根基不可迁建或拆除。');
 if(operation!=='build'){
  const sourceFootprint=spatialFootprint(b);
  for(const p of people(s)){
   if(p===s.master)continue;
   const q=personPosition(s,p),activity=s.activitiesById[p.activityId];
   if(q&&activity&&activity.kind!=='facility'&&polygonContains(q,sourceFootprint,.26))throw Error(`${p.name||p.personId}正在建筑内履行事务；请待其离开或明确取消事务后再改动。`);
  }
 }
 const existing=operation!=='build',level=b.level||1,cost=operation==='build'?{...def.cost}:operation==='upgrade'?{jade:45*level,wood:30*level,stone:20*level}:operation==='relocate'?{jade:10*level,wood:8*level}:{};
 const issue=operation==='demolish'?'':placementIssue(s,b.type,targetTransform.x,targetTransform.y,{ignoreId:existing?b.id:null,level:targetLevel,checkPeople:operation==='build'||operation==='relocate'});if(issue)throw Error(issue);
 if(operation==='demolish'){const capacity=(s.buildings||[]).reduce((n,v)=>n+(BUILDINGS[v.type].capacity||0)*v.level,0)-(def.capacity||0)*b.level;if(capacity<(s.homeMemberIds?.length||0))throw Error('拆除后床位不足，请先安排其他居所。');}
 const planned=layoutBuilding(s,{type:b.type,level:targetLevel,transform:targetTransform}),target=operation==='relocate'||!existing?spatialAccess(planned):spatialAccess(b),route=meterFindPath(s,s.master.scenic,target,{maxSnap:0});if(route===null)throw Error('掌门无法实际抵达工地入口。');
 const orderId=`work:construction:${b.id}`,workSlots=constructionWorkSlots(s,orderId,planned);if(!workSlots.length)throw Error('工地入口旁没有可达的施工执行位，请另选位置。');
 const materials=constructionMaterials(cost),source=s.stockpilesById['stockpile:yunxiu']?.position||{sceneId:SPATIAL_SCENE.id,...spatialAccess(s.buildings.find(v=>v.type==='hall'))},sourceRoute=Object.keys(materials).length?meterFindPath(s,s.master.scenic,source,{maxSnap:0}):null;
 if(Object.keys(materials).length&&sourceRoute===null)throw Error('掌门无法实际抵达主屋施工材料存放处。');
 pay(s,cost);releaseBodyActivity(s,s.master);const id=b.id,activityId=`activity:build:${id}`,reservationId=`reservation:build:${id}`;
 const a={id:activityId,kind:'construction',personId:'person:master',phase:route.length?'moving':'working',operation,type:b.type,x:b.x,y:b.y,buildingId:id,instanceId:`building:yunxiu:${id}`,transform:targetTransform,target,workOrderId:orderId,reservationId};
 const o={id:orderId,kind:'construction',spatial:true,operation,targetId:a.instanceId,buildingType:b.type,targetLevel,targetTransform,sourceTransform:existing?{...b.transform}:null,phase:'active',progressTicks:0,durationTicks:operation==='build'?200:operation==='upgrade'?240:operation==='relocate'?180:120,activityIds:[activityId],reservationId,usedCost:{},evacuations:[],workSlots,workSlotGeometryRevision:s.spatial.geometryRevision};
 s.activitiesById[activityId]=a;s.workOrdersById[orderId]=o;s.reservationsById[reservationId]={id:reservationId,activityId,kind:'construction-material',cost};s.master.activityId=activityId;s.master.scenic.path=route;s.master.scenic.goal=route.at(-1)||null;s.master.action=route.length?'walk':'rest';setupConstructionMaterials(s,a,o,cost,sourceRoute);if(existing)b.spatialLock=orderId;
 log(s,`${def.name}已登记${operation==='build'?'营造':operation==='upgrade'?'升级':operation==='relocate'?'迁建':'拆除'}，须到场并安全撤离使用者。`);return {id,operation,pending:true,activityId,workOrderId:orderId,transform:targetTransform};
}
export const handlers={
 build(s,type,x,y){if(!BUILDINGS[type])throw Error('建筑不存在。');if(BUILDINGS[type].unique&&s.buildings.some(b=>b.type===type))throw Error('该设施只能建一处。');const b=layoutBuilding(s,{id:s.nextId,type,x,y,level:1});const result=begin(s,'build',b,{x,y,orientation:'south'});s.nextId++;return result;},
 upgrade(s,id){const b=s.buildings.find(b=>b.id===id);if(!b)throw Error('建筑不存在。');return begin(s,'upgrade',b,{...b.transform});},
 relocate(s,id,x,y){const b=s.buildings.find(b=>b.id===id);if(!b)throw Error('建筑不存在。');return begin(s,'relocate',b,{x,y,orientation:'south'});},
 demolish(s,id){const b=s.buildings.find(b=>b.id===id);if(!b)throw Error('建筑不存在。');return begin(s,'demolish',b,{...b.transform});},
 cancelConstruction(s){const a=spatialConstruction(s);if(!a)return {alreadyCancelled:true,refund:{}};const o=s.workOrdersById[a.workOrderId];return o.materialFlow?requestConstructionCancellation(s,a,o):finishConstructionCancellation(s,a,o);}
};
function releaseConstructionHelper(s,o,activity){
 const p=s.personsById[activity.personId],sc=p&&personPosition(s,p),slot=o.workSlots?.find(slot=>slot.id===activity.slotId);
 if(slot?.occupantId===activity.personId){slot.occupantId=null;slot.firstArrivalTick=null;}
 if(p?.activityId===activity.id){p.activityId=null;if(p.mind?.activity===activity.originalMindActivity)p.mind.reason='施工参与已结束，可重新安排活动。';if(sc){sc.path=[];sc.goal=null;}}
 o.activityIds=o.activityIds.filter(id=>id!==activity.id);delete s.activitiesById[activity.id];
}
function cleanup(s,a){const o=s.workOrdersById[a.workOrderId],flow=o?.materialFlow;for(const id of [...(o?.activityIds||[])]){const helper=s.activitiesById[id];if(helper?.kind==='sr-construction')releaseConstructionHelper(s,o,helper);}for(const p of people(s)){const q=personPosition(s,p);if(q?.spatialEvacuationOrderId===a.workOrderId){delete q.spatialEvacuationOrderId;q.path=[];q.goal=null;}}if(flow){delete s.stockpilesById[flow.sourceStockpileId];delete s.stockpilesById[flow.siteStockpileId];}delete s.reservationsById[a.reservationId];delete s.workOrdersById[a.workOrderId];delete s.activitiesById[a.id];s.master.activityId=null;s.master.action='rest';s.master.scenic.path=[];s.master.scenic.goal=null;s.spatial.completedOrders=s.spatial.completedOrders.slice(-128);}
function moveActor(s,a,budget){
 const revision=spatialRevision(s);
 if(a.path?.length&&a.revision!==revision){
  if(!routeStillClear(s,a,a.path))a.path=meterFindPath(s,a,a.goal||a.path.at(-1),{maxSnap:0})||[];
  a.revision=revision;
  if(!a.path.length)return false;
 }
 let detours=0;while(a.path?.length&&budget>.001){const q=a.path[0],d=distance(a,q);if(d<.001){a.path.shift();continue;}const n=Math.min(d,budget),to={x:a.x+(q.x-a.x)*n/d,y:a.y+(q.y-a.y)*n/d},r=meterSweep(s,a,to);if(r.blocked){a.path=[];return false;}if(!meterDoorPermit(s,a,a,a.path,to))return false;const blocker=meterBodyBlocker(s,a,a,to);if(blocker){const detour=detours<2&&meterLocalBodyDetour(s,a,a,a.path);if(detour){a.path=detour;detours++;continue;}requestBodyYield(s,a,blocker,a.path);a.waitingForPersonId=blocker.personId;return false;}delete a.waitingForPersonId;a.facing=to.x<a.x?-1:1;a.back=to.y<a.y;a.x=r.x;a.y=r.y;a.steps=(a.steps||0)+n;budget-=n;if(n>=d-.001)a.path.shift();meterDoorMoved(s,a);}return !a.path?.length;
}
function pruneBodyYields(s){for(const p of Object.values(s.personsById||{})){const a=personPosition(s,p),yielding=a?.bodyYield;if(!yielding)continue;const local=people(s).includes(p),queue=yielding.kind==='door-wait'&&doorRecord(s,p);if(!local||!s.personsById[yielding.requestedBy]||yielding.kind==='door-wait'&&!queue?.waiting.some(w=>w.personId===p.personId)||yielding.kind!=='door-wait'&&p.activityId)delete a.bodyYield;}}
function tickBodyYields(s){pruneBodyYields(s);for(const p of people(s)){const a=personPosition(s,p),yielding=a?.bodyYield;if(!yielding)continue;const next=yielding.path[0];if(!next){delete a.bodyYield;continue;}const d=distance(a,next);if(d<.001){yielding.path.shift();if(!yielding.path.length)delete a.bodyYield;continue;}const n=Math.min(.13,d),to={x:a.x+(next.x-a.x)*n/d,y:a.y+(next.y-a.y)*n/d};if(!meterSweep(s,a,to).blocked&&!meterBodyBlocker(s,a,a,to)){a.facing=to.x<a.x?-1:1;a.back=to.y<a.y;a.x=to.x;a.y=to.y;a.steps=(a.steps||0)+n;if(n>=d-.001)yielding.path.shift();syncPosition(s,p);if(p.location?.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id){p.location.x=a.x;p.location.y=a.y;}if(a.goal&&a.path?.length&&meterSweep(s,a,a.path[0]).blocked)a.path=meterFindPath(s,a,a.goal,{maxSnap:0})||[];}if(!yielding.path.length)delete a.bodyYield;}}
const materialTotal=resources=>Object.values(resources).reduce((sum,quantity)=>sum+quantity,0);
function constructionRefund(o,r){return Object.fromEntries(Object.entries(r.cost).map(([k,v])=>[k,v-(o.usedCost[k]||0)]));}
function finishConstructionCancellation(s,a,o){
 const r=s.reservationsById[a.reservationId],refund=constructionRefund(o,r),flow=o.materialFlow;
 if(flow){const source=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];if(materialTotal(flow.cargo)||materialTotal(site.resources))throw Error('工地未用材料尚需实际返程。');for(const[k,v]of Object.entries(constructionMaterials(r.cost)))if(source.resources[k]!==refund[k])throw Error('施工退料位置与剩余数量不一致。');}
 grant(s,refund);const b=s.buildingsById?.[a.instanceId]||s.buildings.find(v=>v.id===a.buildingId);if(b)delete b.spatialLock;
 s.spatial.completedOrders.push({id:o.id,operation:o.operation,phase:'cancelled',progressTicks:o.progressTicks,usedCost:{...o.usedCost},refund,sourceTransform:o.sourceTransform,targetTransform:o.targetTransform,materialTrips:flow?.trips||[],tick:s.worldTick});cleanup(s,a);return {refund,usedCost:o.usedCost};
}
function requestConstructionCancellation(s,a,o){
 for(const id of [...o.activityIds]){const helper=s.activitiesById[id];if(helper?.kind==='sr-construction')releaseConstructionHelper(s,o,helper);}
 for(const slot of o.workSlots||[]){slot.occupantId=null;slot.firstArrivalTick=null;}
 a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;a.phase='moving';
 const flow=o.materialFlow,r=s.reservationsById[o.reservationId],refund=constructionRefund(o,r);
 if(!flow.cancelRequested){flow.cancelRequested=true;flow.phase=materialTotal(flow.cargo)?'returning':'recover-site';a.reason='收回未用材料，实际带回主屋后结清退款。';}
 if(!materialTotal(flow.cargo)&&!materialTotal(s.stockpilesById[flow.siteStockpileId].resources))return finishConstructionCancellation(s,a,o);
 return {pending:true,refund,usedCost:{...o.usedCost}};
}
function constructionWarehouseContact(s,from,stockPosition){
 const clear=at=>meterCanStand(s,at)&&!people(s).some(p=>p!==s.master&&personPosition(s,p)&&distance(personPosition(s,p),at)<.53);
 if(clear(stockPosition)&&meterFindPath(s,from,stockPosition,{maxSnap:0})!==null)return stockPosition;
 const candidates=[];for(let y=snap(stockPosition.y);y<=snap(stockPosition.y+1.25);y+=.5)for(let x=snap(stockPosition.x-1.25);x<=snap(stockPosition.x+1.25);x+=.5){const at={x,y},offset=distance(at,stockPosition);if(y>=stockPosition.y&&offset<=1.25&&clear(at))candidates.push({at,offset});}
 candidates.sort((a,b)=>a.offset-b.offset||a.at.y-b.at.y||a.at.x-b.at.x);
 return candidates.find(({at})=>meterFindPath(s,from,at,{maxSnap:0})!==null)?.at||null;
}
function moveConstructionCarrier(s,a,point,reason,{warehouse=false}={}){
 const sc=s.master.scenic,contact=warehouse?constructionWarehouseContact(s,sc,point):point;if(!contact){sc.path=[];sc.goal=null;s.master.action='rest';a.phase='blocked';a.reason='主屋材料仓周围没有身体可达的取料脚点；货物与进度保留。';return false;}
 if(distance(sc,contact)<=.1){sc.path=[];sc.goal={x:contact.x,y:contact.y};s.master.action='rest';return true;}
 if(!sc.goal||distance(sc.goal,contact)>.01||!sc.path?.length){const route=meterFindPath(s,sc,contact,{maxSnap:0});if(route===null){sc.path=[];sc.goal=null;s.master.action='rest';a.phase='blocked';a.reason='施工材料通路受阻，保留所在位置与数量，等待通路恢复。';return false;}sc.path=route;sc.goal={x:contact.x,y:contact.y};}
 a.phase='moving';a.reason=reason;s.master.action='walk';moveActor(s,sc,.144);syncPosition(s,s.master);s.master.energy=Math.max(0,s.master.energy-.01);
 return distance(sc,contact)<=.1;
}
function pickConstructionCargo(source,capacity){const cargo={};let room=capacity;for(const k of Object.keys(RESOURCES)){if(k==='jade')continue;const amount=Math.min(room,source.resources[k]);if(amount>0){source.resources[k]-=amount;cargo[k]=amount;room-=amount;}if(room<=0)break;}return cargo;}
function carryConstructionMaterials(s,a,o){
 const flow=o.materialFlow;if(!flow)return false;
 const source=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];
 if(s.master.wound>20||s.master.energy<5){a.phase='blocked';a.reason='掌门受伤或精力不足，原地休整；施工材料保留在实际位置。';s.master.action='rest';s.master.energy=Math.min(100,s.master.energy+.3);s.master.wound=Math.max(0,s.master.wound-.035);return true;}
 if(flow.cancelRequested){
  if(flow.phase==='returning'){
   if(!moveConstructionCarrier(s,a,source.position,'携未用材料返回主屋。',{warehouse:true}))return true;
   for(const[k,v]of Object.entries(flow.cargo))source.resources[k]+=v;
   flow.trips.at(-1).phase='returned';flow.trips.at(-1).finishedTick=s.worldTick;flow.cargo={};flow.phase='recover-site';return true;
  }
  if(!materialTotal(site.resources)){finishConstructionCancellation(s,a,o);return true;}
  if(!moveConstructionCarrier(s,a,site.position,'前往工地收回未用材料。'))return true;
  flow.cargo=pickConstructionCargo(site,CONSTRUCTION_CARRY_CAPACITY);flow.trips.push({id:`trip:${o.id}:${flow.trips.length+1}`,kind:'return',cargo:{...flow.cargo},sourceStockpileId:site.id,targetStockpileId:source.id,carrierId:'person:master',phase:'carrying',startedTick:s.worldTick});flow.phase='returning';return true;
 }
 if(flow.phase==='ready')return false;
 if(flow.phase==='to-source'){
  if(!materialTotal(source.resources)){flow.phase='ready';a.phase='working';a.reason='工地材料已全部实际到场，可以施工。';return true;}
  if(!moveConstructionCarrier(s,a,source.position,'前往主屋领取已预留的施工材料。',{warehouse:true}))return true;
  flow.cargo=pickConstructionCargo(source,CONSTRUCTION_CARRY_CAPACITY);flow.trips.push({id:`trip:${o.id}:${flow.trips.length+1}`,kind:'delivery',cargo:{...flow.cargo},sourceStockpileId:source.id,targetStockpileId:site.id,carrierId:'person:master',phase:'carrying',startedTick:s.worldTick});flow.phase='carrying';return true;
 }
 if(flow.phase==='carrying'){
  if(!moveConstructionCarrier(s,a,site.position,'携施工材料前往工地。'))return true;
  for(const[k,v]of Object.entries(flow.cargo))site.resources[k]+=v;
  flow.trips.at(-1).phase='delivered';flow.trips.at(-1).finishedTick=s.worldTick;flow.cargo={};flow.phase=materialTotal(source.resources)?'to-source':'ready';
  a.phase=flow.phase==='ready'?'working':'moving';a.reason=flow.phase==='ready'?'工地材料已全部实际到场，可以施工。':'继续领取下一批施工材料。';return true;
 }
 throw Error('施工材料运输阶段异常。');
}
function evacuationDestination(s,p,q,b,o,poly){
 const future=o.operation==='upgrade'?layoutBuilding(s,{type:b.type,level:o.targetLevel,transform:o.targetTransform}):b,entry=spatialAccess(future);
 for(let n=0;n<40;n++){const offset=n===0?0:(n%2?1:-1)*Math.ceil(n/2)*.75,target={x:entry.x+offset,y:entry.y+1};
  if(polygonContains(target,poly,.26)||!meterCanStand(s,target)||people(s).some(other=>other!==p&&personPosition(s,other)&&distance(personPosition(s,other),target)<.53)||o.evacuations.some(e=>e.personId!==p.personId&&e.destination&&distance(e.destination,target)<.53))continue;
  const route=meterFindPath(s,q,target,{maxSnap:0});if(route!==null)return {destination:target,route};
 }
 return null;
}
function evacuate(s,b,o){
 delete o.waitingReason;const sourcePoly=spatialFootprint(b),poly=o.operation==='upgrade'?spatialFootprint(layoutBuilding(s,{type:b.type,level:o.targetLevel,transform:o.targetTransform})):sourcePoly;let waiting=false;
 for(const p of people(s)){if(p===s.master)continue;const q=personPosition(s,p),a=s.activitiesById[p.activityId],inUse=a?.targetId===b.instanceId;
  if(!q||!polygonContains(q,poly,.26)&&!inUse){if(q?.spatialEvacuationOrderId===o.id)delete q.spatialEvacuationOrderId;continue;}
  // Domain-owned jobs retain materials, items and orders until their owner has
  // completed or explicitly cancelled them. Construction cannot discard cargo.
  if(a?.kind==='sr-construction'&&a.workOrderId===o.id)continue;
  if(a&&a.kind!=='facility'){waiting=true;o.waitingReason=`等待${p.name||p.personId}结束当前事务；其材料与进度保持。`;continue;}
  let evacuation=o.evacuations.find(e=>e.personId===p.personId);
  if(!evacuation){evacuation={personId:p.personId,activityId:p.activityId||null,action:a?.action||null,reason:'建筑改动，安全结束当前使用并沿门道撤离'};o.evacuations.push(evacuation);releaseBodyActivity(s,p);p.activityId=null;if(p.mind){p.mind.activity='rest';p.mind.reason='正在撤离改动中的设施，原任务进度保留。';p.mind.commitUntil=0;}delete q.activitySlotId;}
  q.spatialEvacuationOrderId=o.id;
  if(!q.path?.length){const exit=evacuationDestination(s,p,q,b,o,poly);if(!exit){waiting=true;continue;}evacuation.destination=exit.destination;q.path=exit.route;q.goal={...exit.destination};}
  moveActor(s,q,.13);syncPosition(s,p);if(polygonContains(q,poly,.26))waiting=true;else{delete q.spatialEvacuationOrderId;q.path=[];q.goal=null;}
 }
 return !waiting;
}
function constructionVolunteer(s,p){
 const m=p.mind,sc=m?.scenic,trust=m?.relationships?.master?.trust??55;
 if(!s.homeMemberIds?.includes(p.personId)||p.lifeStatus==='dead'||p.activityId||p.job!=null||m?.activity!=='rest'||m?.away||m?.journey||sc?.spatialEvacuationOrderId||!sc||(p.location?.sceneId??p.position?.sceneId??SPATIAL_SCENE.id)!==SPATIAL_SCENE.id||p.wound>CONSTRUCTION_INJURY_LIMIT||p.energy<CONSTRUCTION_ENERGY_MIN||m.satiety<22||trust<15||p.schedule?.aftermath?.untilTick>s.worldTick)return false;
 return (m.traits?.[3]??60)*.3+(m.traits?.[0]??55)*.1+trust*.4>=42;
}
function recruitConstructionHelpers(s,a,o){
 if(o.materialFlow?.cancelRequested)return;
 const source=s.buildingsById?.[o.targetId],future=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform}),evacuationFootprint=o.operation==='upgrade'?spatialFootprint(future):source&&o.operation!=='build'?spatialFootprint(source):null;
 let helpers=o.activityIds.filter(id=>s.activitiesById[id]?.kind==='sr-construction').length;
 for(const p of people(s).filter(p=>p!==s.master).sort((x,y)=>x.personId.localeCompare(y.personId))){
  if(helpers>=o.workSlots.length)break;
  if(evacuationFootprint&&personPosition(s,p)&&polygonContains(personPosition(s,p),evacuationFootprint,.26))continue;
  if(!constructionVolunteer(s,p))continue;
  const sc=personPosition(s,p),route=meterFindPath(s,sc,a.target,{maxSnap:0});if(route===null)continue;
  const id=`activity:construction:${a.buildingId}:${p.personId}`;
  if(s.activitiesById[id])continue;
  s.activitiesById[id]={id,kind:'sr-construction',personId:p.personId,workOrderId:o.id,instanceId:o.targetId,buildingId:a.buildingId,phase:'moving',slotId:null,firstArrivalTick:null,originalMindActivity:p.mind.activity,startedTick:s.worldTick,reason:'自愿前往工地施工。'};
  o.activityIds.push(id);p.activityId=id;p.mind.reason='自愿参与当前工地，须实际到达排他施工位。';sc.path=route;sc.goal={...a.target};helpers++;
 }
}
function constructionParticipantReady(s,p,activity,a){
 const sc=personPosition(s,p);if(!sc)return false;
 const entry=activity.slotId?null:a.target,slot=activity.slotId&&s.workOrdersById[activity.workOrderId]?.workSlots?.find(x=>x.id===activity.slotId),target=slot?.position||entry;
 if(!target)return false;
 if(slot){const blocker=people(s).find(other=>other!==p&&personPosition(s,other)&&distance(personPosition(s,other),slot.position)<.53);if(blocker){activity.phase='blocked';activity.reason=`${blocker.name||blocker.personId}暂占施工位，等待其离开。`;s.workOrdersById[activity.workOrderId].waitingReason=activity.reason;sc.path=[];sc.goal=null;return false;}}
 if(distance(sc,target)>.1){
  if(!sc.goal||distance(sc.goal,target)>.01||!sc.path?.length){const route=meterFindPath(s,sc,target,{maxSnap:0});if(route===null){activity.phase='blocked';activity.reason='施工位通路受阻，等待通路恢复。';sc.path=[];sc.goal=null;return false;}sc.path=route;sc.goal={...target};}
  activity.phase='moving';if(p===s.master)s.master.action='walk';moveActor(s,sc,p===s.master ? .144 : .13);syncPosition(s,p);
  if(p!==s.master)p.energy=Math.max(0,p.energy-.01);
 }
 if(distance(sc,target)>.1)return false;
 sc.path=[];sc.goal={...target};if(activity.firstArrivalTick===null||activity.firstArrivalTick===undefined)activity.firstArrivalTick=s.worldTick;
 return true;
}
function tickConstructionCrew(s,a,o,r,{masterAvailable,canWork}){
 if(canWork)delete o.waitingReason;
 if(o.workSlotGeometryRevision!==s.spatial.geometryRevision){
  const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform}),slots=constructionWorkSlots(s,o.id,planned);
  if(!slots.length){o.waitingReason='几何变化后工地没有安全执行位，保留进度与材料。';canWork=false;}
  else{for(const id of o.activityIds){const personActivity=s.activitiesById[id];if(personActivity){personActivity.slotId=null;personActivity.slotArrived=false;personActivity.phase='moving';}}o.workSlots=slots;o.workSlotGeometryRevision=s.spatial.geometryRevision;}
 }
 const masterSlot=o.workSlots.find(q=>q.id===a.slotId),masterPosition=personPosition(s,s.master);
 if(a.slotArrived&&(!masterSlot||!masterPosition||distance(masterPosition,masterSlot.position)>.53)){if(masterSlot?.occupantId==='person:master'){masterSlot.occupantId=null;masterSlot.firstArrivalTick=null;}a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;}
 for(const id of [...o.activityIds]){const activity=s.activitiesById[id];if(activity?.kind!=='sr-construction')continue;const p=s.personsById[activity.personId],slot=o.workSlots.find(q=>q.id===activity.slotId),sc=p&&personPosition(s,p);if(!p||p.activityId!==id||p.lifeStatus==='dead'||p.left||p.job!=null||p.mind?.activity!==activity.originalMindActivity||p.mind?.away||p.mind?.journey||(p.location?.sceneId??p.position?.sceneId??SPATIAL_SCENE.id)!==SPATIAL_SCENE.id||p.wound>CONSTRUCTION_INJURY_LIMIT||p.energy<8||activity.slotArrived&&(!slot||!sc||distance(sc,slot.position)>.53)){releaseConstructionHelper(s,o,activity);}}
 if(masterAvailable&&(s.master.wound>CONSTRUCTION_INJURY_LIMIT||s.master.energy<5)){const slot=o.workSlots.find(q=>q.occupantId==='person:master');if(slot){slot.occupantId=null;slot.firstArrivalTick=null;}a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;a.phase='blocked';a.reason='掌门受伤或精力不足，原地休整；施工进度保留。';s.master.action='rest';s.master.energy=Math.min(100,s.master.energy+.3);s.master.wound=Math.max(0,s.master.wound-.035);masterAvailable=false;}
 recruitConstructionHelpers(s,a,o);
 const participants=o.activityIds.map(id=>s.activitiesById[id]).filter(Boolean);
 for(const activity of participants)if((activity===a?masterAvailable:true)&&!activity.slotId)constructionParticipantReady(s,s.personsById[activity.personId],activity,a);
 const arrivals=participants.filter(activity=>(activity===a?masterAvailable:true)&&!activity.slotId&&activity.firstArrivalTick!==null&&activity.firstArrivalTick!==undefined).sort((x,y)=>x.firstArrivalTick-y.firstArrivalTick||x.personId.localeCompare(y.personId));
 for(const activity of arrivals){const slot=o.workSlots.find(q=>!q.occupantId&&!people(s).some(p=>p.personId!==activity.personId&&personPosition(s,p)&&distance(personPosition(s,p),q.position)<.53));if(!slot){activity.phase='blocked';activity.reason='等待空闲施工位，保留到达顺序。';continue;}slot.occupantId=activity.personId;slot.firstArrivalTick=activity.firstArrivalTick;activity.slotId=slot.id;activity.slotArrived=false;activity.phase='moving';}
 for(const activity of participants)if((activity===a?masterAvailable:true)&&activity.slotId&&constructionParticipantReady(s,s.personsById[activity.personId],activity,a))activity.slotArrived=true;
 if(!canWork||o.workSlotGeometryRevision!==s.spatial.geometryRevision)return;
 const site=o.materialFlow&&s.stockpilesById[o.materialFlow.siteStockpileId];
 for(const activity of participants.sort((x,y)=>x.personId.localeCompare(y.personId))){
  const p=s.personsById[activity.personId],slot=o.workSlots.find(q=>q.id===activity.slotId);
  if(!slot||slot.occupantId!==activity.personId||!personPosition(s,p)||distance(personPosition(s,p),slot.position)>.1||p.wound>CONSTRUCTION_INJURY_LIMIT||p.energy<5||activity===a&&!masterAvailable||o.progressTicks>=o.durationTicks)continue;
  const blocker=people(s).find(other=>other!==p&&personPosition(s,other)&&distance(personPosition(s,other),slot.position)<.53);if(blocker){activity.phase='blocked';activity.reason=`${blocker.name||blocker.personId}暂占施工位，等待其离开。`;o.waitingReason=activity.reason;continue;}
  const next=o.progressTicks+1;
  if(site&&Object.entries(constructionMaterials(r.cost)).some(([k,v])=>site.resources[k]+1e-9<Math.floor(v*next/o.durationTicks)-(o.usedCost[k]||0))){activity.phase='blocked';activity.reason='工地材料尚未实际到场，保留施工进度。';o.waitingReason=activity.reason;break;}
  activity.phase='working';activity.reason='已到排他施工位，参与共享工单。';o.progressTicks=next;p.energy=Math.max(0,p.energy-.015);
  for(const[k,v]of Object.entries(r.cost)){const used=Math.floor(v*next/o.durationTicks),delta=used-(o.usedCost[k]||0);if(site&&k!=='jade')site.resources[k]-=delta;o.usedCost[k]=used;}
 }
 if(!participants.some(activity=>activity.phase==='working')&&!o.waitingReason)o.waitingReason=participants.length?'等待参与者实际到达工地执行位。':'暂无愿意且能够到场的施工者。';
}
export function tickSpatial(s){
 if(!spatialEnabled(s)||s.speed===0)return;pruneDoorQueues(s);tickBodyYields(s);const a=spatialConstruction(s);if(!a)return;const o=s.workOrdersById[a.workOrderId],r=s.reservationsById[a.reservationId],source=s.buildingsById?.[a.instanceId]||s.buildings.find(b=>b.id===a.buildingId);
 if(o.workSlots){const carrying=carryConstructionMaterials(s,a,o);if(!s.workOrdersById[o.id]||o.materialFlow?.cancelRequested)return;if(o.progressTicks<o.durationTicks){const safe=!carrying&&(!source||evacuate(s,source,o));tickConstructionCrew(s,a,o,r,{masterAvailable:!carrying,canWork:safe});if(!safe&&!carrying){a.phase='blocked';a.reason=o.waitingReason||'等待使用者沿门道撤离到新占地之外。';}if(o.progressTicks<o.durationTicks)return;}}
 else{
 if(carryConstructionMaterials(s,a,o))return;
 if(a.phase==='moving'){const arrived=moveActor(s,s.master.scenic,.144);syncPosition(s,s.master);if(!arrived)return;if(distance(s.master.scenic,a.target)>.1){s.master.scenic.path=meterFindPath(s,s.master.scenic,a.target,{maxSnap:0})||[];a.phase='blocked';a.reason='通往工地的路径受阻，等待安全路线。';return;}a.phase='working';s.master.action='rest';}
 if(source&&!evacuate(s,source,o)){a.phase='blocked';a.reason=o.waitingReason||'等待使用者沿门道撤离到新占地之外。';return;}
 if(o.progressTicks<o.durationTicks){if(distance(s.master.scenic,a.target)>.1){a.phase='moving';s.master.scenic.path=meterFindPath(s,s.master.scenic,a.target,{maxSnap:0})||[];return;}a.phase='working';const next=o.progressTicks+1,site=o.materialFlow&&s.stockpilesById[o.materialFlow.siteStockpileId];if(site)for(const[k,v]of Object.entries(constructionMaterials(r.cost))){const amount=Math.floor(v*next/o.durationTicks)-(o.usedCost[k]||0);if(site.resources[k]+1e-9<amount){a.phase='blocked';a.reason='工地材料尚未实际到场，保留施工进度。';return;}}o.progressTicks=next;s.master.energy=Math.max(0,s.master.energy-.015);for(const [k,v]of Object.entries(r.cost)){const used=Math.floor(v*o.progressTicks/o.durationTicks),delta=used-(o.usedCost[k]||0);if(site&&k!=='jade')site.resources[k]-=delta;o.usedCost[k]=used;}}
 if(o.progressTicks<o.durationTicks)return;
 }
 const future=layoutBuilding(s,{instanceId:o.targetId,type:a.type,level:o.targetLevel,transform:o.targetTransform});
 if(source){for(const id of [...o.activityIds]){const helper=s.activitiesById[id],person=helper&&s.personsById[helper.personId],position=person&&personPosition(s,person);if(helper?.kind==='sr-construction'&&position&&polygonContains(position,spatialFootprint(o.operation==='upgrade'?future:source),.26))releaseConstructionHelper(s,o,helper);}if(!evacuate(s,source,o)){a.phase='blocked';a.reason=o.waitingReason||'等待工地人员安全撤离。';return;}}
 if(o.operation!=='demolish'){for(const id of [...o.activityIds]){const helper=s.activitiesById[id],person=helper&&s.personsById[helper.personId],position=person&&personPosition(s,person);if(helper?.kind==='sr-construction'&&position&&polygonContains(position,spatialFootprint(future),.26))releaseConstructionHelper(s,o,helper);}if(!evacuate(s,future,o)){a.phase='blocked';a.reason=o.waitingReason||'等待目标占地人员安全撤离。';return;}}
 if(o.operation==='upgrade'&&polygonContains(s.master.scenic,spatialFootprint(future),.26)){const safe=spatialAccess(future);if(!s.master.scenic.path?.length)s.master.scenic.path=meterFindPath(s,s.master.scenic,safe,{maxSnap:0})||[];s.master.scenic.goal=safe;moveActor(s,s.master.scenic,.144);syncPosition(s,s.master);a.phase='blocked';a.reason='掌门沿门道撤离扩建范围，安全后切换占地。';s.master.action='walk';return;}
 if(o.operation==='demolish'){
  const remainingCapacity=s.buildings.reduce((n,b)=>n+(BUILDINGS[b.type].capacity||0)*b.level,0)-(BUILDINGS[source.type].capacity||0)*source.level;
  if(remainingCapacity<(s.homeMemberIds?.length||0)){a.phase='blocked';a.reason='拆除后床位不足，请先安排其他居所。';o.waitingReason=a.reason;return;}
 }
 const issue=o.operation==='demolish'?'':placementIssue(s,a.type,o.targetTransform.x,o.targetTransform.y,{ignoreId:source?.id,level:o.targetLevel,checkReservations:false});if(issue){a.phase='blocked';a.reason=issue;return;}
 if(o.operation==='build'){const b=layoutBuilding(s,{id:a.buildingId,instanceId:a.instanceId,type:a.type,x:a.x,y:a.y,transform:{...o.targetTransform},prefabId:prefabId(future),sceneId:SPATIAL_SCENE.id,level:1,progress:0,condition:100,enabled:true});s.buildings.push(b);s.stats.built++;}
 else if(o.operation==='demolish'){finalizeBuildingChange(s,source,'demolish');const refund={};for(const [k,v]of Object.entries(BUILDINGS[source.type].cost))refund[k]=Math.floor(v*.65);for(let n=1;n<source.level;n++)for(const[k,v]of Object.entries({jade:45*n,wood:30*n,stone:20*n}))refund[k]=(refund[k]||0)+Math.floor(v*.65);grant(s,refund);for(const p of s.disciples||[])if(p.job===source.id)p.job=null;s.buildings=s.buildings.filter(b=>b.id!==source.id);o.salvage=refund;}
 else{source.transform={...o.targetTransform};if(o.operation==='upgrade'){source.level=o.targetLevel;source.condition=100;}if(o.operation==='relocate'){source.x=o.targetTransform.x;source.y=o.targetTransform.y;s.stats.relocated++;}delete source.spatialLock;finalizeBuildingChange(s,source,o.operation);}
 s.spatial.geometryRevision++;s.spatial.completedOrders.push({id:o.id,operation:o.operation,phase:'completed',progressTicks:o.progressTicks,usedCost:{...o.usedCost},sourceTransform:o.sourceTransform,targetTransform:o.targetTransform,evacuations:o.evacuations,salvage:o.salvage||null,tick:s.worldTick});cleanup(s,a);
 for(const p of people(s)){const q=personPosition(s,p);if(q){q.revision=spatialRevision(s);q.path=[];q.goal=null;}}
}
export function viewSpatial(s){const a=spatialConstruction(s),o=a&&s.workOrdersById[a.workOrderId];if(!o)return null;const b=layoutBuilding(s,{id:a.buildingId,type:a.type,level:o.targetLevel,transform:o.targetTransform});return {building:b,position:spatialAccess(b),footprint:spatialFootprint(b),access:a.target,progress:o.progressTicks/o.durationTicks,stage:o.progressTicks/o.durationTicks<1/3?'foundation':o.progressTicks/o.durationTicks<2/3?'structure':'finishing',label:o.waitingReason||a.reason||({moving:'前往工地',working:'到场施工',blocked:'等待安全条件'}[a.phase]),operation:o.operation};}
export function validateSpatial(s){
 if(!spatialEnabled(s))return true;
 const bounds=sceneBounds(s);
 if(s.spatial.buildingGridVersion&&!buildingGridEnabled(s))throw Error('未知建筑单位格版本。');
 if(s.spatial.interiorLayoutVersion&&s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||s.buildings.some(b=>b.interiorLayoutVersion&&b.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION))throw Error('未知室内布局版本，原存档保留。');
 if(s.spatial.sceneId!==SPATIAL_SCENE.id||!Number.isSafeInteger(s.spatial.geometryRevision)||s.spatial.geometryRevision<1||!Array.isArray(s.spatial.migrations)||!Array.isArray(s.spatial.completedOrders)||s.spatial.completedOrders.length>128)throw Error('米制空间迁移记录异常。');
 const queues=s.spatial.doorQueuesByEntryId;
 if(queues!==undefined){if(!queues||typeof queues!=='object'||Array.isArray(queues))throw Error('门道队列容器异常。');const queued=new Set();for(const [entryId,q]of Object.entries(queues)){
  if(!/^building:yunxiu:[1-9][0-9]*\/entry:south$/.test(entryId)||q?.entryId!==entryId||!Array.isArray(q.waiting)||!Number.isSafeInteger(q.lastPassTick)||q.lastPassTick< -1||q.lastPassTick>s.worldTick)throw Error('门道队列入口或释放时刻异常。');
  let previous=null;for(const record of [...(q.holder?[q.holder]:[]),...q.waiting]){if(record?.entryId!==entryId||typeof record.personId!=='string'||!Number.isSafeInteger(record.firstArrivalTick)||record.firstArrivalTick<0||record.firstArrivalTick>s.worldTick||record.activityId!==null&&typeof record.activityId!=='string'||!Number.isFinite(record.target?.x)||!Number.isFinite(record.target?.y)||!['in','out'].includes(record.phase)||queued.has(record.personId))throw Error('门道通行权或候选记录异常。');queued.add(record.personId);}
  for(const record of q.waiting){if(previous&&(previous.firstArrivalTick>record.firstArrivalTick||previous.firstArrivalTick===record.firstArrivalTick&&previous.personId.localeCompare(record.personId)>0))throw Error('门道候选队序异常。');previous=record;}
 }}
 for(const b of s.buildings){const t=b.transform,d=spatialPrefab(b);if(!t||![t.x,t.y].every(Number.isFinite)||snap(t.x)!==t.x||snap(t.y)!==t.y||t.orientation!=='south'||b.prefabId!==prefabId(b)||b.buildingGridVersion&&!buildingGridEnabled(s)||buildingGridEnabled(s)&&(b.buildingGridVersion!==BUILDING_GRID.version||!onBuildingGrid(t.x)||!onBuildingGrid(t.y))||t.x<1||t.y<1||t.x+d.width>bounds.width-1||t.y+d.height+1>bounds.height-1)throw Error(`米制建筑位置异常：${b.instanceId}`);const issue=placementIssue(s,b.type,t.x,t.y,{ignoreId:b.id,level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:false});if(issue||!meterCanStand(s,spatialAccess(b)))throw Error(`米制建筑占地或入口异常：${b.instanceId} ${issue}`);}
 for(const p of people(s)){const a=personPosition(s,p);if(a&&!meterCanStand(s,a))throw Error(`人物米制脚点不合法：${p.personId}`);let from=a;for(const q of a?.path||[]){if(meterSweep(s,from,q).blocked)throw Error('米制路径穿越障碍。');from=q;}if(a?.bodyYield){const y=a.bodyYield;if(!['door-wait',undefined].includes(y.kind)||typeof y.requestedBy!=='string'||!Number.isSafeInteger(y.startedTick)||y.startedTick<0||y.startedTick>s.worldTick||!Number.isFinite(y.target?.x)||!Number.isFinite(y.target?.y)||!Array.isArray(y.path)||y.path.length>24||y.path.some(q=>!Number.isFinite(q?.x)||!Number.isFinite(q?.y)))throw Error('人物真实让行路径异常。');}}
 const active=Object.values(s.workOrdersById).filter(o=>o.spatial&&o.kind==='construction');if(active.length>1)throw Error('重复施工工作单。');
 for(const o of active){const a=s.activitiesById[o.activityIds?.[0]],r=s.reservationsById[o.reservationId],source=s.buildingsById?.[o.targetId];
  if(!a||s.master.activityId!==a.id||a.personId!=='person:master'||a.instanceId!==o.targetId||o.id!==`work:construction:${a.buildingId}`||a.id!==`activity:build:${a.buildingId}`||!r||r.activityId!==a.id||r.kind!=='construction-material'||a.workOrderId!==o.id||!['build','upgrade','relocate','demolish'].includes(o.operation)||!['moving','working','blocked'].includes(a.phase)||!Number.isInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||o.durationTicks!==({build:200,upgrade:240,relocate:180,demolish:120}[o.operation])||!Number.isInteger(a.buildingId)||a.buildingId<1||a.buildingId>=s.nextId||o.operation==='build'&&source||o.operation!=='build'&&!source||!BUILDINGS[o.buildingType]||o.buildingType!==a.type)throw Error('米制施工预约异常。');
  if(o.workSlots){
   if(!Array.isArray(o.workSlots)||o.workSlots.length<1||o.workSlots.length>2||!Number.isSafeInteger(o.workSlotGeometryRevision)||o.workSlotGeometryRevision<1||o.workSlotGeometryRevision>s.spatial.geometryRevision||!Array.isArray(o.activityIds)||o.activityIds[0]!==a.id||o.activityIds.length>o.workSlots.length+1||new Set(o.activityIds).size!==o.activityIds.length)throw Error('施工执行位或参与者记录异常。');
   const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform}),entry=spatialAccess(planned),expectedSlots=o.workSlotGeometryRevision===s.spatial.geometryRevision?constructionWorkSlots(s,o.id,planned):null;
   if(expectedSlots&&(expectedSlots.length!==o.workSlots.length||expectedSlots.some((slot,i)=>slot.id!==o.workSlots[i].id||distance(slot.position,o.workSlots[i].position)>.001)))throw Error('施工执行位与目标几何不一致。');
   for(const [index,slot]of o.workSlots.entries()){
    if(slot.id!==`${o.id}/slot:${index+1}`||!Number.isFinite(slot.position?.x)||!Number.isFinite(slot.position?.y)||distance(slot.position,entry)<.91||o.workSlots.some(other=>other!==slot&&distance(other.position,slot.position)<.53)||slot.firstArrivalTick!==null&&(!Number.isSafeInteger(slot.firstArrivalTick)||slot.firstArrivalTick>s.worldTick))throw Error('施工执行位位置或到达次序异常。');
    if(slot.occupantId!==null){const person=s.personsById[slot.occupantId],activity=person&&s.activitiesById[person.activityId],position=person&&personPosition(s,person),arrived=activity?.slotArrived===true||activity?.phase==='working';if(!person||!activity||activity.workOrderId!==o.id||activity.slotId!==slot.id||activity.firstArrivalTick!==slot.firstArrivalTick||!o.activityIds.includes(activity.id)||arrived&&(!activity.slotArrived||!position||distance(position,slot.position)>.1))throw Error('施工执行位占用者与活动不一致。');}
    else if(slot.firstArrivalTick!==null)throw Error('空施工位仍有占用到达时刻。');
   }
   for(const id of o.activityIds){const activity=s.activitiesById[id],person=activity&&s.personsById[activity.personId];if(!activity||!person||person.activityId!==id||activity.workOrderId!==o.id||!['construction','sr-construction'].includes(activity.kind)||activity!==a&&activity.kind!=='sr-construction'||!['moving','working','blocked'].includes(activity.phase)||activity.slotId!==null&&activity.slotId!==undefined&&!o.workSlots.some(slot=>slot.id===activity.slotId&&slot.occupantId===person.personId)||activity.firstArrivalTick!==null&&activity.firstArrivalTick!==undefined&&(!Number.isSafeInteger(activity.firstArrivalTick)||activity.firstArrivalTick>s.worldTick)||activity.slotArrived!==undefined&&typeof activity.slotArrived!=='boolean'||activity.slotArrived&&!activity.slotId||activity.kind==='sr-construction'&&activity.phase==='working'&&!activity.slotId)throw Error('施工参与活动或排他占位异常。');}
  }
  const t=o.targetTransform;if(buildingGridEnabled(s)&&(!onBuildingGrid(t?.x)||!onBuildingGrid(t?.y)))throw Error('施工目标须对齐建筑单位格。');if(!t||t.orientation!=='south'||![t.x,t.y].every(n=>Number.isFinite(n)&&snap(n)===n)||!Number.isInteger(o.targetLevel)||o.targetLevel<1||o.targetLevel>BUILDINGS[a.type].max)throw Error('施工目标预制件不合法。');
  const d=dimensions(layoutBuilding(s,{type:o.buildingType,level:o.targetLevel}));if(t.x<1||t.y<1||t.x+d.width>bounds.width-1||t.y+d.height+1>bounds.height-1)throw Error('施工目标超出山院可建边界。');
  const level=source?.level||1,expected=o.operation==='build'?BUILDINGS[a.type].cost:o.operation==='upgrade'?{jade:45*level,wood:30*level,stone:20*level}:o.operation==='relocate'?{jade:10*level,wood:8*level}:{};
  if(Object.keys(r.cost||{}).length!==Object.keys(expected).length||!Object.entries(expected).every(([k,v])=>r.cost[k]===v))throw Error('施工材料预约来源不匹配。');
  for(const [k,v]of Object.entries(r.cost))if(o.usedCost[k]!==Math.floor(v*o.progressTicks/o.durationTicks)&&!(o.progressTicks===0&&(o.usedCost[k]||0)===0))throw Error('施工投入不守恒。');
  if(o.materialFlow){const flow=o.materialFlow,origin=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];if(flow.version!==CONSTRUCTION_MATERIAL_FLOW||!origin||!site||origin.ownerId!=='person:master'||site.ownerId!=='person:master'||flow.carrierId!=='person:master'||!['to-source','carrying','ready','recover-site','returning'].includes(flow.phase)||!Array.isArray(flow.trips)||typeof flow.cancelRequested!=='boolean'||!flow.cargo||Object.entries(flow.cargo).some(([k,v])=>k==='jade'||!RESOURCES[k]||!Number.isFinite(v)||v<=0))throw Error('施工材料位置或运输阶段异常。');for(const[k,v]of Object.entries(constructionMaterials(r.cost))){const count=origin.resources[k]+site.resources[k]+(flow.cargo[k]||0)+(o.usedCost[k]||0);if(Math.abs(count-v)>1e-8)throw Error('施工材料在仓库、在途、工地与已安装量之间不守恒。');}if(flow.phase==='ready'&&!flow.cancelRequested&&(materialTotal(origin.resources)>1e-8||materialTotal(flow.cargo)>1e-8))throw Error('施工材料尚未全部交付。');}
 }
 return true;
}
