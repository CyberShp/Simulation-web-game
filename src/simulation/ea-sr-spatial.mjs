import {GUESTHOUSE_LAYOUT_VERSION,guesthouseGroundEnabled,guesthouseArtGroundPoint,GUESTHOUSE_EXTERIOR_ART} from './ea-guesthouse-geometry.mjs';
import {courtyardSouthGroundPoint} from './ea-courtyard-visible-ground.mjs';
import {legacyToWorld as eastArtToWorld,legacyToArt,eastVisibleBodyPoint,eastVisiblePointApplies,eastVisibleResidencePassage,eastVisibleRoadPassage} from './ea-courtyard-east-visible-geometry.mjs';
import {WEST_WORKSHOPS_VERSION,domainWestWorkshopsEnabled,westWorkshopsPointOpen,WEST_WORKSHOPS_EXTERIOR_SOLIDS,courtyardWestWorkshopsPassage} from './ea-west-workshops-geometry.mjs';
import {meditationBuildView,meditationBuildingChangeView,commissionMeditationBuilding,finishMeditationBuildingChange} from './ea-meditation-definitions.mjs';
import {NORTH_MEDITATION_VERSION,NORTH_MEDITATION_APPROACH_VERSION,domainNorthMeditationEnabled,NORTH_MEDITATION_FEET,NORTH_MEDITATION_SOLIDS,courtyardNorthMeditationPassage} from './ea-north-meditation-geometry.mjs';
import {finalizeBuildingChange,releaseBodyActivity} from './ea-facility-activities.mjs';
/** SR-XF-003–006: metre space and persistent, on-site construction transactions. */
import {scenicPoint} from './ea-scene-geometry.mjs';
import {BUILDINGS,RESOURCES,log as gameLog} from './ea-data.mjs';
import {BUILDING_GRID,buildingGridEnabled,buildingCellSize,onBuildingGrid} from './ea-building-grid.mjs';
import {DOMAIN_LAYOUT_VERSION,DOMAIN_EXTENT_VERSION,DOMAIN_EAST_EXTENT_VERSION,DOMAIN_VALLEY_EXTENT_VERSION,domainWestEnabled,domainValleyEnabled,domainExtentEnabled,SECT_DOMAIN,COURTYARD_EAST_ROAD,domainSiteAt,courtyardEastPassage,courtyardWestPassage,courtyardValleyPassage,westTerrainContains} from './ea-sect-domain.mjs';
import {COURTYARD_MASTER_TERRAIN_VERSION,courtyardTerrainSolids,validateCourtyardTerrainRecord,courtyardPassage} from './ea-courtyard-master-terrain.mjs';
import {EAST_RESIDENCES_VERSION,domainResidencesEnabled,domainBounds,domainTerrainBarriers,eastResidencesTerrainContains,courtyardResidencesPassage} from './ea-sect-domain.mjs';
import {EAST_SERVICES_VERSION,domainServicesEnabled,eastServicesTerrainContains,courtyardServicesPassage,EAST_SERVICES_EXTERIOR_SOLIDS} from './ea-sect-domain.mjs';
import {NORTH_LIBRARY_VERSION,NORTH_LIBRARY_APPROACH_VERSION,domainNorthLibraryEnabled,NORTH_LIBRARY_SLOPE_APERTURE,northLibraryTerrainContains,courtyardNorthLibraryPassage,northLibraryLocalBypassClear,northLibraryYieldRouteClear,northLibraryYieldPointClear,northLibraryYieldSegmentProven} from './ea-sect-domain.mjs';
import {SITE_SERVICE_VERSION,siteServiceEnabled} from './ea-service-definitions.mjs';
import {residentialBuildingChangeView} from './ea-residential-housing.mjs';
export const SPATIAL_VERSION='spatial-metres-1';
export const SPATIAL_EXTENT_VERSION='courtyard-96-1';
export const INTERIOR_LAYOUT_VERSION='adult-furniture-1';
export const SPATIAL_SCENE=Object.freeze({id:'scene:yunxiu-courtyard',width:96,height:96,grid:.5,personRadius:.26,pixelsPerMetre:32,depth:.65});
// Courtyard movement is measured in metres per 100 ms world step. Keep the
// walking pace shared by free movement, work travel and body detours.
export const COURTYARD_WALK_RATE=2.2;
// Unmarked metre saves must first pass their original 64m boundary. This is a
// content extent marker within schema 6, not a coordinate or identity migration.
const LEGACY_SPATIAL_BOUNDS=Object.freeze({width:64,height:64});
export function spatialBounds(s){
 if(!spatialEnabled(s))return SPATIAL_SCENE;
 if(!Object.hasOwn(s.spatial,'extentVersion'))return LEGACY_SPATIAL_BOUNDS;
 if(domainExtentEnabled(s.spatial.extentVersion))return domainBounds(s.spatial.extentVersion,s.spatial.eastResidences?.version,s.spatial.eastServices?.version,s.spatial.northLibrary?.version,s.spatial.northMeditation?.version);
 if(s.spatial.extentVersion!==SPATIAL_EXTENT_VERSION)throw Error('未知山院范围版本，原存档保留。');
 return SPATIAL_SCENE;
}
const sceneBounds=spatialBounds;
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
export const HALL_ESTABLISH_COST=Object.freeze({jade:20,wood:15,stone:10});
const CONSTRUCTION_CARRY_CAPACITY=40;
const snap=n=>Math.round(n/SPATIAL_SCENE.grid)*SPATIAL_SCENE.grid;
const rooms=new Set(['hall','house','guesthouse','library','alchemy','kitchen','clinic','workshop','warehouse']);
export const PREFAB_CATALOG=Object.freeze(Object.fromEntries(Object.keys(BUILDINGS).map(type=>[type,{id:`prefab:${type}:metres:v1`,assetVersion:'vector-metres-v1',orientations:['south'],width:['farm','granary','lumber','quarry'].includes(type)?6:type==='well'?3:6,height:['farm','granary','lumber','quarry'].includes(type)?4:type==='well'?3:5,indoor:rooms.has(type),layers:['floor','furniture','actors','walls','roof'],fallback:'same-style-vector',conditionStages:['normal','damaged'],constructionStages:['foundation','structure','finishing']}])));
const prefabId=b=>b.buildingGridVersion===BUILDING_GRID.version?`prefab:${b.type}:units:v1`:PREFAB_CATALOG[b.type]?.id;
const layoutBuilding=(s,b)=>buildingGridEnabled(s)?{...b,buildingGridVersion:BUILDING_GRID.version,...(s.spatial.interiorLayoutVersion===INTERIOR_LAYOUT_VERSION&&rooms.has(b.type)?{interiorLayoutVersion:INTERIOR_LAYOUT_VERSION}:{})}:b;
export function spatialPrefab(b){
 const d=PREFAB_CATALOG[b.type];if(!d)return null;const level=Math.max(1,b.level||1),size=dimensions(b),w=size.width,h=size.height,adult=d.indoor&&b.buildingGridVersion===BUILDING_GRID.version&&b.interiorLayoutVersion===INTERIOR_LAYOUT_VERSION,slots=[],furniture=[],push=(kind,suffix,x,y,label)=>slots.push({kind,suffix,position:{x,y},label,capacity:1,facing:1});
 if(b.type==='guesthouse'){for(let i=0;i<2;i++){const x=i? w-1.2:1.2;furniture.push({kind:'bed',id:`guest-bed:${i+1}`,polygon:rect(x-.45,.5,.9,2.2)});push('guest-bed',`guest-bed:${i+1}`,x,3,`客床 ${i+1}`);}}
 if(['hall','house','clinic'].includes(b.type)){
  // SR-XF-004: 2.2m beds fit adult bodies; 0.8m aisles contain a 0.5m nav row.
  // Compact geometry remains available for validating the original save.
  const n=4*level;for(let i=0;i<n;i++){const col=i%4,row=Math.floor(i/4),x=adult?.95+col*(w-1.9)/3:.8+col*(w-1.6)/3,y=adult?.5+row*3:.95+row*1.6;furniture.push({kind:'bed',id:`bed:${i+1}`,polygon:adult?rect(x-.45,y,.9,2.2):rect(x-.3,y-.65,.6,.9)});const foot=adult?y+2.5:y+.6;push('rest',`bed:${i+1}`,x,foot,`床位 ${i+1}`);push('heal',`bed-care:${i+1}`,x,foot,`调养床 ${i+1}`);}
 }
 if(['hall','library'].includes(b.type)){for(let i=0;i<2*level;i++){const x=adult?.95+i*(w-1.9)/(2*level-1):.8+i*(w-1.6)/(2*level-1),y=adult?h-1.8:h-1.4;furniture.push({kind:'desk',id:`desk:${i+1}`,polygon:adult?rect(x-.55,y,1.1,.65):rect(x-.35,y-.5,.7,.35)});push('study',`desk:${i+1}`,x,adult?y+1:y+.2,`书案 ${i+1}`);}push('teach','teacher:1',w/2,adult?h-1:h-1.4,'讲法席');}
 if(['meditation','hall'].includes(b.type))for(let i=0;i<4;i++)push('cultivate',`mat:${i+1}`,.8+i*(w-1.6)/3,h-(adult?2.4:2.2),`蒲团 ${i+1}`);
 if(BUILDINGS[b.type].work){const unitWell=b.type==='well'&&b.buildingGridVersion===BUILDING_GRID.version,n=['farm','granary'].includes(b.type)?4:b.type==='library'||unitWell?1:2;for(let i=0;i<n;i++){const x=unitWell?w/2:adult?1.1+(i%2)*(w-2.2):.9+(i%2)*(w-1.8),y=unitWell?h+.6:adult?1.6:1.2+Math.floor(i/2)*(h-2.2);push('work',`work:${i+1}`,x,y,`作业工位 ${i+1}`);if(d.indoor)furniture.push({kind:'bench',id:`bench:${i+1}`,polygon:adult?rect(x-.6,y-1,1.2,.65):rect(x-.35,y-.65,.7,.35)});}}
 // T-19: this open quarry keeps its surveyed entry and work feet as the extraction yard grows.
 const northernMeditation=b.type==='meditation'&&b.domainSiteId==='site:domain:gc-03';
 if(northernMeditation)for(const slot of slots){const foot=NORTH_MEDITATION_FEET.find(f=>f.kind===slot.kind&&f.suffix===slot.suffix);if(foot)slot.position={x:foot.position.x-44,y:foot.position.y+46};}
 const valleyQuarry=b.type==='quarry'&&b.buildingGridVersion===BUILDING_GRID.version&&(b.domainSiteId==='site:domain:gc-17'||spatialTransform(b).x===-38&&spatialTransform(b).y===14);
 if(valleyQuarry)for(let i=0;i<slots.length;i++)if(slots[i].kind==='work')slots[i].position={x:.9+i*2.2,y:1.2};
 if(b.type==='alchemy'){
  furniture.push({kind:'furnace',id:'furnace:1',polygon:rect(w/2-1,1,2,1.2)});push('work','work:1',w/2,2.8,'丹炉前操作位');
  if(b.domainSiteId==='site:domain:gc-26'&&adult){
   furniture.push({kind:'herb-table',id:'herb-table:1',polygon:rect(.55,.8,1.2,.8)},{kind:'filter-table',id:'filter-table:1',polygon:rect(w-1.75,.8,1.2,.8)},{kind:'sealing-table',id:'sealing-table:1',polygon:rect(w-1.75,h-2.3,1.2,.8)});
   push('work','work:herb:1',1.15,2.1,'药材整理案');push('work','work:filter:1',w-1.15,2.1,'浸取过滤案');push('work','work:seal:1',w-2.25,h-1.9,'封藏药案');
  }
 }
 if(b.type==='kitchen'){furniture.push({kind:'stove',id:'stove:1',polygon:rect(.8,.8,1.2,.6)});push('work','work:1',1.4,1.9,'灶前操作位');}
 if(siteServiceEnabled(b)){
  if(b.type==='kitchen'){
   furniture.push({kind:'stove',id:'stove:special:1',polygon:rect(w-2,.8,1.2,.6)});push('work','work:special:1',w-1.4,1.9,'灵膳专灶');
   const tables=level===1?[[3,3.2]]:level===2?[[2,3.2],[6,3.2]]:[[2.5,3.2],[7.5,3.2],[5,6.7]];
   tables.forEach(([x,y],i)=>{furniture.push({kind:'table',id:`dining-table:${i+1}`,polygon:rect(x-.9,y,1.8,.7)});for(const [j,[sx,sy]]of [[x-1.45,y+.35],[x+1.45,y+.35],[x-.55,y+1.3],[x+.55,y+1.3]].entries())push('eat',`dining:${i*4+j+1}`,sx,sy,`用膳席 ${i*4+j+1}`);});
  }else if(b.type==='clinic'){const y=[4.7,6.7,9.3][level-1];push('work','doctor:1',1.5,y,'医者诊疗位');push('treatment','consult:1',2.4,y,'患者诊疗位');}
 }
 if(b.type==='hall'){push('care','care:1',w+1,h-.5,'换药席');push('care','care:2',w+1,h-1.5,'照护席');}
 const doorWidth=1.4,door={x:w/2,y:h},walls=d.indoor?[rect(0,0,w,.18),rect(0,0,.18,h),rect(w-.18,0,.18,h),rect(0,h-.18,w/2-doorWidth/2,.18),rect(w/2+doorWidth/2,h-.18,w/2-doorWidth/2,.18)]:[];
 return {...d,id:prefabId(b),cells:b.buildingGridVersion===BUILDING_GRID.version?buildingCellSize(b.type,level):null,width:w,height:h,bounds:{x:0,y:0,width:w,height:h},floor:rect(0,0,w,h),footprint:rect(0,0,w,h),walls,furniture,slots,door,access:{x:w/2,y:h+.6},waiting:[{x:w/2-1,y:h+1},{x:w/2+1,y:h+1}],roof:rect(0,-.15,w,h+.3),...(siteServiceEnabled(b)?{waiting:[{x:w/2-.7,y:b.type==='clinic'?14:12},{x:w/2+.7,y:b.type==='clinic'?14:12}]}:{}),...(valleyQuarry?{access:{x:2,y:4.6},waiting:[{x:1,y:5},{x:3,y:5}]}:{})};
}
export function spatialTransform(b){return b.transform||{x:b.x,y:b.y,orientation:'south'};}
const worldPolygon=(polygon,t)=>polygon.map(([x,y])=>[x+t.x,y+t.y]);
export function spatialRoom(b){const d=spatialPrefab(b),t=spatialTransform(b);if(!d?.indoor)return null;return {...d,bounds:{x:t.x,y:t.y,width:d.width,height:d.height},door:{x:t.x+d.door.x,y:t.y+d.door.y},floor:worldPolygon(d.floor,t),walls:d.walls.map(p=>worldPolygon(p,t)),furniture:d.furniture.map(f=>({...f,polygon:worldPolygon(f.polygon,t)})),slots:d.slots.map(slot=>({...slot,position:{x:t.x+slot.position.x,y:t.y+slot.position.y}})),lanes:[]};}
function dimensions(b){if(b.buildingGridVersion===BUILDING_GRID.version)return buildingCellSize(b.type,b.level);const d=PREFAB_CATALOG[b.type],n=Math.max(1,b.level||1)-1;return d?{width:d.width+n*2,height:d.height+n*2}:null;}
export function spatialFootprint(b){const d=dimensions(b),t=spatialTransform(b);return d?rect(t.x,t.y,d.width,d.height):[];}
export function spatialAccess(b){const d=dimensions(b),t=spatialTransform(b);if(b.type==='quarry'&&b.buildingGridVersion===BUILDING_GRID.version&&(b.domainSiteId==='site:domain:gc-17'||t.x===-38&&t.y===14))return {x:t.x+2,y:t.y+4.6};return d?{x:t.x+d.width/2,y:t.y+d.height+.6}:null;}
export function spatialSlots(b,kind){const d=spatialPrefab(b),t=spatialTransform(b);return d?d.slots.filter(slot=>slot.kind===kind).map(slot=>({...slot,id:`${b.instanceId||`building:yunxiu:${b.id}`}/slot:${slot.suffix}`,buildingId:b.id,position:{x:t.x+slot.position.x,y:t.y+slot.position.y}})):[];}
function clipExteriorPolygon(polygon,axis,value,greater){
 const result=[],inside=p=>greater?p[axis]>=value:p[axis]<=value;
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],aa=inside(a),bb=inside(b);if(aa)result.push(a);if(aa!==bb){const q=(value-a[axis])/(b[axis]-a[axis]);result.push([a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q]);}}return result;
}
export function spatialExteriorSolids(b,stage='complete'){
 if(b.type==='meditation'&&b.domainSiteId==='site:domain:gc-03')return NORTH_MEDITATION_SOLIDS.map(o=>({id:o.id,polygon:o.polygon.map(p=>[...p])}));
 const t=spatialTransform(b),site=domainSiteAt(b.type,t.x,t.y),objects=site?.guesthouse?GUESTHOUSE_EXTERIOR_ART.map(o=>({...o,polygon:o.polygon.flatMap((a,i)=>{const z=o.polygon[(i+1)%o.polygon.length],n=Math.max(1,Math.ceil(Math.hypot(z[0]-a[0],z[1]-a[1])/2));return Array.from({length:n},(_,j)=>{const p=eastArtToWorld(1672+a[0]+(z[0]-a[0])*j/n,a[1]+(z[1]-a[1])*j/n);return [p.x,p.y];});})})):site?.westWorkshops&&b.domainSiteId===site.id?WEST_WORKSHOPS_EXTERIOR_SOLIDS.filter(o=>o.siteId===site.id&&o.level===b.level&&o.stage===stage):siteServiceEnabled(b)&&site?.services?EAST_SERVICES_EXTERIOR_SOLIDS.filter(o=>o.siteId===site.id):[];const d=dimensions(b),out=[];
 for(const object of objects){
  const middle=clipExteriorPolygon(clipExteriorPolygon(object.polygon,0,t.x,true),0,t.x+d.width,false);
  for(const polygon of [clipExteriorPolygon(object.polygon,0,t.x,false),clipExteriorPolygon(object.polygon,0,t.x+d.width,true),clipExteriorPolygon(middle,1,t.y,false),clipExteriorPolygon(middle,1,t.y+d.height,true)])if(polygon.length>2&&Math.abs(polygon.reduce((a,p,i)=>{const q=polygon[(i+1)%polygon.length];return a+p[0]*q[1]-p[1]*q[0];},0))>1e-7)out.push({id:object.id,polygon});
 }return out;
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-dx*q,p.y-a[1]-dy*q);}
export function polygonContains(p,poly,radius=0){if(poly.aabb){const b=poly.aabb,dx=Math.max(b.left-p.x,0,p.x-b.right),dy=Math.max(b.top-p.y,0,p.y-b.bottom);return dx===0&&dy===0||radius>0&&dx*dx+dy*dy<(radius-1e-7)**2;}let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;if(radius&&segmentDistance(p,a,b)<radius-1e-7)return true;}return inside;}
export const SPATIAL_TERRAIN=Object.freeze([{id:'water:east',label:'东侧水面',kind:'water',polygon:rect(58,8,6,22)},{id:'slope:north',label:'北侧陡坡',kind:'slope',polygon:rect(0,0,SPATIAL_SCENE.width,1)},{id:'protected:gate',label:'归院入口保护区',kind:'protected',polygon:rect(30,57,4,7)}]);
// Local U-109 estate preview: the gate posts are solid in the same metre-space
// pathfinder used by every actor. Formal and historical saves keep their map.
const ESTATE_GATE_POSTS=Object.freeze([
 {id:'estate:gate-west',label:'旧山门西柱',kind:'solid',polygon:rect(28.57,57.43,1.14,1.14)},
 {id:'estate:gate-east',label:'旧山门东柱',kind:'solid',polygon:rect(34.29,57.43,1.14,1.14)},
]);
export const spatialTerrain=s=>[...SPATIAL_TERRAIN.flatMap(t=>t.id==='slope:north'&&domainNorthLibraryEnabled(s?.spatial?.northLibrary?.version)?[{...t,id:'slope:north-west',polygon:rect(0,0,NORTH_LIBRARY_SLOPE_APERTURE[0][0],1)},{...t,id:'slope:north-east',polygon:rect(NORTH_LIBRARY_SLOPE_APERTURE[1][0],0,SPATIAL_SCENE.width-NORTH_LIBRARY_SLOPE_APERTURE[1][0],1)}]:[t]),...(s?.spatial?.estateCollisionVersion==='estate-gate-1'?ESTATE_GATE_POSTS:[]),...(domainExtentEnabled(s?.spatial?.extentVersion)?domainTerrainBarriers(s.spatial.eastResidences?.version).map(t=>({...t,polygon:t.polygon.map(p=>[...p])})):[]),...courtyardTerrainSolids(s?.spatial?.courtyardTerrain?.version).map(t=>({...t,polygon:t.polygon.map(p=>[...p])}))];
function westWorkshopConstruction(s){
 if(!domainWestWorkshopsEnabled(s.spatial?.westWorkshops?.version))return null;
 const a=s.activitiesById?.[s.master?.activityId],o=a?.kind==='construction'&&s.workOrdersById?.[a.workOrderId];
 if(!o?.spatial||o.operation!=='build'||o.phase!=='active'||!o.domainSiteId)return null;
 const t=o.targetTransform,site=domainSiteAt(o.buildingType,t?.x,t?.y);
 if(!site?.westWorkshops||site.id!==o.domainSiteId)return null;
 return {order:o,stage:o.progressTicks<=0?'empty':o.progressTicks/o.durationTicks<.35?'foundation':'construction'};
}
export function spatialConstructionExteriorSolids(s){
 const current=westWorkshopConstruction(s);if(!current)return [];
 const o=current.order,b={...layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform}),domainSiteId:o.domainSiteId};
 return spatialExteriorSolids(b,current.stage);
}
// Visual stages may share the same collision geometry. Cache the exact exterior
// polygons so only changed solids invalidate navigation and reachability proofs.
const constructionCollisionSignatures=new Map();
function constructionCollisionSignature(s){
 const current=westWorkshopConstruction(s);if(!current)return '';
 const o=current.order,key=JSON.stringify([o.buildingType,o.targetLevel,o.targetTransform,current.stage,buildingGridEnabled(s),s.spatial?.interiorLayoutVersion]);
 if(!constructionCollisionSignatures.has(key)){if(constructionCollisionSignatures.size>=32)constructionCollisionSignatures.clear();const polygons=spatialConstructionExteriorSolids(s).map(solid=>solid.polygon);constructionCollisionSignatures.set(key,polygons.length?JSON.stringify(polygons):'empty');}
 return constructionCollisionSignatures.get(key);
}
const collisionCache=new WeakMap();
export function spatialRevision(s){return (s.buildings||[]).map(b=>`${b.id}:${b.type}:${b.level}:${b.buildingGridVersion||'metres'}:${b.interiorLayoutVersion||'compact'}${b.serviceVersion?':'+b.serviceVersion:''}:${spatialTransform(b).x}:${spatialTransform(b).y}`).join('|')+';'+(s.spatial?.guesthouse?.version||'')+';'+(s.spatial?.geometryRevision||0)+';'+(s.spatial?.extentVersion||'legacy-64')+';'+(s.spatial?.eastResidences?.version||'')+(s.spatial?.eastServices?';'+s.spatial.eastServices.version:'')+(s.spatial?.northLibrary?';'+s.spatial.northLibrary.version+':'+NORTH_LIBRARY_APPROACH_VERSION:'')+(s.spatial?.northMeditation?';'+s.spatial.northMeditation.version+':'+NORTH_MEDITATION_APPROACH_VERSION:'')+(s.spatial?.westWorkshops?';'+s.spatial.westWorkshops.version+':'+constructionCollisionSignature(s):'')+';'+(s.spatial?.estateCollisionVersion||'')+(s.spatial?.courtyardTerrain?';'+s.spatial.courtyardTerrain.version:'');}
function obstacles(s){const rev=spatialRevision(s),old=collisionCache.get(s);if(old?.rev===rev)return old.polygons;const polygons=[...spatialTerrain(s).filter(t=>t.kind!=='protected').map(t=>t.polygon),...spatialConstructionExteriorSolids(s).map(f=>Object.assign(f.polygon,{exactPolygon:true})),...(s.buildings||[]).flatMap(b=>{const r=spatialRoom(b);return r?[...r.walls,...r.furniture.map(f=>f.polygon),...spatialExteriorSolids(b).map(f=>Object.assign(f.polygon,{exactPolygon:true}))]:b.type==='well'&&b.buildingGridVersion===BUILDING_GRID.version?[spatialFootprint(b)]:spatialExteriorSolids(b).map(f=>Object.assign(f.polygon,{exactPolygon:true}));})];for(const poly of polygons){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);poly[poly.exactPolygon?'spatialAabb':'aabb']={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};}const index=new Map();for(const poly of polygons){const b=poly.aabb||poly.spatialAabb;for(let y=Math.floor(b.top/2);y<=Math.floor(b.bottom/2);y++)for(let x=Math.floor(b.left/2);x<=Math.floor(b.right/2);x++){const key=`${x}/${y}`;if(!index.has(key))index.set(key,[]);index.get(key).push(poly);}}polygons.spatialIndex=index;polygons.bounds=sceneBounds(s);polygons.residences=domainResidencesEnabled(s.spatial?.eastResidences?.version);polygons.services=domainServicesEnabled(s.spatial?.eastServices?.version);polygons.northLibrary=domainNorthLibraryEnabled(s.spatial?.northLibrary?.version);polygons.northMeditationVersion=s.spatial?.northMeditation?.version;polygons.west=domainWestEnabled(s.spatial?.extentVersion);polygons.extentVersion=s.spatial?.extentVersion;polygons.westWorkshopsVersion=s.spatial?.westWorkshops?.version;collisionCache.set(s,{rev,polygons});return polygons;}
// These records contain only the exact private static geometry consumed by
// computeClearPoint. Bodies, doors/queues and permissions are checked elsewhere.
const clearPointCacheByGeometry=new WeakMap(),sharedClearPointCaches=new Map();
function clearPointQueryCache(polygons){
 if(clearPointCacheByGeometry.has(polygons))return clearPointCacheByGeometry.get(polygons);
 const bounds=polygons.bounds||SPATIAL_SCENE,validBox=b=>!b||['left','right','top','bottom'].every(k=>Number.isFinite(b[k]));
 if(![bounds.x??0,bounds.y??0,bounds.width,bounds.height].every(Number.isFinite)||!polygons.every(poly=>poly.every(p=>Array.isArray(p)&&p.every(Number.isFinite))&&validBox(poly.aabb)&&validBox(poly.spatialAabb))){clearPointCacheByGeometry.set(polygons,null);return null;}
 const key=JSON.stringify({bounds,northLibrary:polygons.northLibrary,northMeditationVersion:polygons.northMeditationVersion,residences:polygons.residences,services:polygons.services,west:polygons.west,extentVersion:polygons.extentVersion,westWorkshopsVersion:polygons.westWorkshopsVersion,indexed:!!polygons.spatialIndex,polygons:polygons.map(poly=>[poly,poly.aabb||null,poly.spatialAabb||null])},(_key,value)=>typeof value==='number'&&Object.is(value,-0)?'number:-0':value);
 let cache=sharedClearPointCaches.get(key);
 if(!cache){cache={points:new Map(),keys:[],oldest:0};if(sharedClearPointCaches.size>=8)sharedClearPointCaches.delete(sharedClearPointCaches.keys().next().value);sharedClearPointCaches.set(key,cache);}
 clearPointCacheByGeometry.set(polygons,cache);return cache;
}
function clearPoint(polygons,p,radius=.26){
 if(!p||![p.x,p.y,radius].every(Number.isFinite)||[p.x,p.y,radius].some(v=>Object.is(v,-0)))return computeClearPoint(polygons,p,radius);
 const cache=clearPointQueryCache(polygons);if(!cache)return computeClearPoint(polygons,p,radius);
 const key=[p.x,p.y,radius].join('/'),held=cache.points.get(key);if(held!==undefined)return held;
 const clear=computeClearPoint(polygons,p,radius);
 if(cache.points.size>=8192){cache.points.delete(cache.keys[cache.oldest]);cache.keys[cache.oldest]=key;cache.oldest=(cache.oldest+1)%8192;}else cache.keys.push(key);
 cache.points.set(key,clear);return clear;
}
function computeClearPoint(polygons,p,radius=.26){if(polygons.northLibrary&&!northLibraryTerrainContains(p,radius,polygons.northMeditationVersion))return false;const bounds=polygons.bounds||SPATIAL_SCENE;if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.x<(bounds.x||0)+radius||p.y<(bounds.y||0)+radius||p.x>(bounds.x||0)+bounds.width-radius||p.y>(bounds.y||0)+bounds.height-radius)return false;if(polygons.residences&&!(polygons.services?eastServicesTerrainContains: eastResidencesTerrainContains)(p,radius))return false;if(polygons.west&&!westTerrainContains(p,radius,polygons.extentVersion,polygons.westWorkshopsVersion))return false;if(!polygons.spatialIndex)return !polygons.some(poly=>polygonContains(p,poly,radius));for(let y=Math.floor((p.y-radius)/2);y<=Math.floor((p.y+radius)/2);y++)for(let x=Math.floor((p.x-radius)/2);x<=Math.floor((p.x+radius)/2);x++)if(polygons.spatialIndex.get(`${x}/${y}`)?.some(poly=>polygonContains(p,poly,radius)))return false;return true;}
function segmentsIntersect(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),v1=cross(a,b,c),v2=cross(a,b,d),v3=cross(c,d,a),v4=cross(c,d,b);if(Math.abs(v1)<1e-10&&Math.abs(v2)<1e-10)return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-10&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-10;return v1*v2<=0&&v3*v4<=0;}
const continuousSegmentCache=new WeakMap();
function continuousClear(polygons,from,to,radius){
 let cache=continuousSegmentCache.get(polygons);if(!cache){cache=new Map();continuousSegmentCache.set(polygons,cache);}
 const key=[radius,from.x,from.y,to.x,to.y].join('/');
 if(!cache.has(key)){const clear=computeContinuousClear(polygons,from,to,radius);if(cache.size>=32768)cache.clear();cache.set(key,clear);}
 return cache.get(key);
}
function computeContinuousClear(polygons,from,to,radius){if(!clearPoint(polygons,to,radius))return false;if(polygons.northLibrary&&Math.min(from.y,to.y)<1.26){const n=Math.max(1,Math.ceil(distance(from,to)/.05));for(let i=0;i<=n;i++)if(!northLibraryTerrainContains({x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n},radius,polygons.northMeditationVersion))return false;}if(polygons.west&&Math.min(from.x,to.x)<0){const n=Math.max(1,Math.ceil(distance(from,to)/.05));for(let i=0;i<=n;i++)if(!westTerrainContains({x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n},radius,polygons.extentVersion,polygons.westWorkshopsVersion))return false;}if(polygons.residences&&Math.max(from.x,to.x)>=156){const n=Math.max(1,Math.ceil(distance(from,to)/.05));for(let i=0;i<=n;i++)if(!(polygons.services?eastServicesTerrainContains:eastResidencesTerrainContains)({x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n},radius))return false;}const padding=Math.max(radius,1e-10),left=Math.min(from.x,to.x)-padding,right=Math.max(from.x,to.x)+padding,top=Math.min(from.y,to.y)-padding,bottom=Math.max(from.y,to.y)+padding;let candidates=polygons;if(polygons.spatialIndex){const nearby=new Set();for(let y=Math.floor(top/2);y<=Math.floor(bottom/2);y++)for(let x=Math.floor(left/2);x<=Math.floor(right/2);x++)for(const poly of polygons.spatialIndex.get(`${x}/${y}`)||[])nearby.add(poly);candidates=nearby;}
 const ab=[[from.x,from.y],[to.x,to.y]];for(const poly of candidates){const bounds=poly.aabb;if(bounds&&(bounds.right<left||bounds.left>right||bounds.bottom<top||bounds.top>bottom))continue;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c={x:a[0],y:a[1]},d={x:b[0],y:b[1]};if(segmentsIntersect(from,to,c,d)||Math.min(segmentDistance(from,a,b),segmentDistance(to,a,b),segmentDistance(c,ab[0],ab[1]),segmentDistance(d,ab[0],ab[1]))<radius-1e-7)return false;}}return true;
}
function sweepPolygons(polygons,from,to,radius=.26){if(!clearPoint(polygons,from,radius))return {...from,blocked:true};if(continuousClear(polygons,from,to,radius))return {x:to.x,y:to.y,blocked:false};let lo=0,hi=1;for(let n=0;n<26;n++){const mid=(lo+hi)/2,p={x:from.x+(to.x-from.x)*mid,y:from.y+(to.y-from.y)*mid};if(continuousClear(polygons,from,p,radius))lo=mid;else hi=mid;}return {x:from.x+(to.x-from.x)*lo,y:from.y+(to.y-from.y)*lo,blocked:true};}

export function meterCanStand(s,p,radius=.26){return clearPoint(obstacles(s),p,radius);}
export function meterSweep(s,from,to,radius=.26){return sweepPolygons(obstacles(s),from,to,radius);}
export function meterNearest(s,p,{maxDistance,radius=.26,occupied=[]}={}){
 const polygons=obstacles(s),bounds=polygons.bounds,step=SPATIAL_SCENE.grid,limit=maxDistance??Math.hypot(bounds.width,bounds.height),free=q=>clearPoint(polygons,q,radius)&&!occupied.some(a=>distance(a,q)<radius*2+.01);
 if(free(p))return {x:p.x,y:p.y};if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||limit<0)return null;
 let best=null,bd=Infinity;
 for(let y=Math.max((bounds.y||0)+step,snap(p.y-limit));y<Math.min((bounds.y||0)+bounds.height,p.y+limit);y+=step)for(let x=Math.max((bounds.x||0)+step,snap(p.x-limit));x<Math.min((bounds.x||0)+bounds.width,p.x+limit);x+=step){const q={x,y},d=distance(p,q);if(d<=limit&&d<bd&&free(q)){best=q;bd=d;}}
 return best;
}
function heapPush(heap,n){let i=heap.length;heap.push(n);while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
function heapPop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
// All routes depend only on these geometry polygons and explicit route options.
// Keep reusable passage legs outside world state; each caller owns its returned points.
const pathCache=new WeakMap();
// Housing views use detached state clones. Equal complete navigation geometry
// can share pure route proofs while each caller still receives its own points.
const sharedGeometryPaths=new Map();
function geometryPaths(s,geometry){
 const rooms=roomFrames(s),key=JSON.stringify([spatialRevision(s),geometry.map(poly=>[poly,!!poly.exactPolygon]),rooms.map(({bounds,door})=>[bounds,door]),rooms.mainVisible,rooms.eastVisible,rooms.residences]);
 if(!sharedGeometryPaths.has(key)){if(sharedGeometryPaths.size>=8)sharedGeometryPaths.delete(sharedGeometryPaths.keys().next().value);sharedGeometryPaths.set(key,new Map());}
 return sharedGeometryPaths.get(key);
}

export function meterFindPath(s,from,goal,{maxSnap=2,radius=.26,throughCourtyardPassage=true,throughEastPassage=true,throughWestPassage=true,throughValleyPassage=true,throughResidencesPassage=true,throughServicesPassage=true,throughNorthLibraryPassage=true,throughNorthMeditationPassage=true,throughWestWorkshopsPassage=true,visibleBody=false}={}){
 const geometry=obstacles(s);let paths=pathCache.get(geometry);if(!paths){paths=geometryPaths(s,geometry);pathCache.set(geometry,paths);}
 const options={maxSnap,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody};
 if(![from?.x,from?.y,goal?.x,goal?.y].every(Number.isFinite))return findMeterPath(s,from,goal,options);
 const key=[from.x,from.y,goal.x,goal.y,...Object.values(options)].join('/');
 if(!paths.has(key)){const path=findMeterPath(s,from,goal,options);if(paths.size>=1024)paths.clear();paths.set(key,path);}
 const path=paths.get(key);return path===null?null:path.map(point=>({...point}));
}
function findMeterPath(s,from,goal,{maxSnap=2,radius=.26,throughCourtyardPassage=true,throughEastPassage=true,throughWestPassage=true,throughValleyPassage=true,throughResidencesPassage=true,throughServicesPassage=true,throughNorthLibraryPassage=true,throughNorthMeditationPassage=true,throughWestWorkshopsPassage=true,visibleBody=false}={}){
 const polygons=obstacles(s),rooms=roomFrames(s),clear=p=>clearPoint(polygons,p,radius)&&(!rooms.eastVisible||p.x<118.74||p.x>=156.26||internalAt(rooms,p)||eastVisibleBodyPoint(p,.26,{residences:rooms.residences}))&&(!(visibleBody||polygons.northLibrary)||visibleBodyAt(rooms,true,p)),visibleBodySweep=(a,b)=>eastVisibleSegmentClear(s,a,b)&&(!(visibleBody||polygons.northLibrary)||visibleBodySegmentClear(s,a,b)),sweep=(a,b)=>({blocked:!clear(a)||!continuousClear(polygons,a,b,radius)||!visibleBodySweep(a,b)});if(!clear(from)){if(clearPoint(polygons,from,radius)&&!visibleBodyPointClear(s,from))return visibleBodyWalkPath(s,from,goal);return null;}if(maxSnap===0&&!clear(goal))return null;const to=clear(goal)?{x:goal.x,y:goal.y}:meterNearest(s,goal,{maxDistance:maxSnap,radius});if(!to||!clear(to))return null;if(distance(from,to)<.001)return [];const northLocal=polygons.northLibrary&&(from.y<0||to.y<0);
 if(throughNorthMeditationPassage&&domainNorthMeditationEnabled(s.spatial?.northMeditation?.version)){
  const passage=courtyardNorthMeditationPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage:false,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(throughNorthLibraryPassage&&domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)){
  const passage=courtyardNorthLibraryPassage(from,to,{canStand:clear,canConnect:(a,b)=>!sweep(a,b).blocked});
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage:false,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughServicesPassage&&domainServicesEnabled(s.spatial?.eastServices?.version)){
  const passage=courtyardServicesPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage:false,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughResidencesPassage&&domainResidencesEnabled(s.spatial?.eastResidences?.version)){
  const passage=eastVisibleResidencePassage(courtyardResidencesPassage(from,to));
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage:false,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughWestWorkshopsPassage&&domainWestWorkshopsEnabled(s.spatial?.westWorkshops?.version)){
  const passage=courtyardWestWorkshopsPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const local=westWorkshopsPointOpen(at)&&westWorkshopsPointOpen(point),route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage:throughValleyPassage&&!local,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage:false,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughValleyPassage&&domainValleyEnabled(s.spatial?.extentVersion)){
  const passage=courtyardValleyPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage,throughValleyPassage:false,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughWestPassage&&domainWestEnabled(s.spatial?.extentVersion)){
  const passage=courtyardWestPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage,throughWestPassage:false,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 if(!northLocal&&throughEastPassage&&domainExtentEnabled(s.spatial?.extentVersion)&&courtyardTerrainSolids(s.spatial?.courtyardTerrain?.version).length){
  const passage=eastVisibleRoadPassage(from,to,courtyardEastPassage(from,to),{residences:rooms.residences});
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage,throughEastPassage:false,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 const shortcutBlocked=(a,b)=>sweep(a,b).blocked||!eastVisibleSegmentClear(s,a,b,true)||((visibleBody||polygons.northLibrary)&&!visibleBodySegmentClear(s,a,b,true));
 if(!shortcutBlocked(from,to))return [to];
 if(!northLocal&&throughCourtyardPassage&&courtyardTerrainSolids(s.spatial?.courtyardTerrain?.version).length){
  const passage=courtyardPassage(from,to);
  if(passage){const result=[];let at=from;for(const point of [...passage,to]){const route=meterFindPath(s,at,point,{maxSnap:0,radius,throughCourtyardPassage:false,throughEastPassage,throughWestPassage,throughValleyPassage,throughResidencesPassage,throughServicesPassage,throughNorthLibraryPassage,throughNorthMeditationPassage,throughWestWorkshopsPassage,visibleBody});if(route===null)return null;result.push(...route);at=point;}return result;}
 }
 const step=SPATIAL_SCENE.grid,minX=Math.floor((polygons.bounds.x||0)/step)+1,minY=Math.floor((polygons.bounds.y||0)/step)+1,maxX=Math.ceil(((polygons.bounds.x||0)+polygons.bounds.width)/step)-1,maxY=Math.ceil(((polygons.bounds.y||0)+polygons.bounds.height)/step)-1,stride=maxX-minX+1;
 const k=(x,y)=>(y-minY)*stride+x-minX,open=[],cost=new Map(),parents=new Map(),points=new Map(),closed=new Set();
 for(let y=Math.round(from.y/step)-2;y<=Math.round(from.y/step)+2;y++)for(let x=Math.round(from.x/step)-2;x<=Math.round(from.x/step)+2;x++){const p={x:x*step,y:y*step};if(x<minX||y<minY||x>maxX||y>maxY||sweep(from,p).blocked)continue;const id=k(x,y),g=distance(from,p);cost.set(id,g);points.set(id,p);heapPush(open,{x,y,id,g,f:g+distance(p,to)});}
 let end=null;while(open.length){const c=heapPop(open);if(closed.has(c.id))continue;closed.add(c.id);const p={x:c.x*step,y:c.y*step};if(distance(p,to)<=1.5&&!sweep(p,to).blocked){end=c.id;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=c.x+dx,y=c.y+dy,id=k(x,y);if(x<minX||y<minY||x>maxX||y>maxY||closed.has(id))continue;const g=c.g+Math.hypot(dx,dy)*step;if(g>=(cost.get(id)??Infinity))continue;const q={x:x*step,y:y*step};if(sweep(p,q).blocked)continue;cost.set(id,g);parents.set(id,c.id);points.set(id,q);heapPush(open,{x,y,id,g,f:g+distance(q,to)});}}
 if(end===null)return null;const path=[to];for(let n=end;n!==undefined;n=parents.get(n))path.unshift(points.get(n));const result=[];let p=from;while(path.length){let i=path.length-1;while(i>0&&shortcutBlocked(p,path[i]))i--;if(sweep(p,path[i]).blocked)return null;if(distance(p,path[i])>.001)result.push(path[i]);p=path[i];path.splice(0,i+1);}return result;
}
const personPosition=(s,p)=>p===s.master?p.scenic:p.mind?.scenic;
const people=s=>Object.values(s.personsById||{}).filter(p=>!['waiting','departed'].includes(p.courtyardVisit?.phase)&&p.lifeStatus!=='dead'&&!p.left&&!p.mind?.away&&!p.mind?.journey&&(!p.location||p.location.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id)&&(p===s.master||s.homeMemberIds?.includes(p.personId)||p.mind?.scenic));
const walkingPerson=(s,actor)=>people(s).find(p=>personPosition(s,p)===actor);
/** Click-to-walk resolves to a measured standing point. A click whose own body
 * hangs off the visible paving otherwise stops on that half-body edge, where no
 * legal detour exists; the nearest real standing point within two metres is
 * used instead. Body collision and visible ground stay exactly as measured. */
export function nearestVisibleBodyTarget(s,actor,goal,occupied,{maxDistance=2,step=.25}={}){
 const rooms=roomFrames(s),outdoors=!insideRoomOf(rooms,goal),reachable=p=>meterFindPath(s,actor,p,{maxSnap:0})!==null,
  free=p=>distance(goal,p)<=maxDistance+1e-9&&meterCanStand(s,p)&&!occupied.some(a=>distance(a,p)<.53)&&(outdoors?!insideRoomOf(rooms,p)&&visibleBodyAt(rooms,false,p):visibleBodyPointClear(s,p))&&reachable(p);
 if(free(goal))return {x:goal.x,y:goal.y};
 let best=null,bd=Infinity;
 const consider=p=>{const d=distance(goal,p),q={x:p.x,y:p.y};if(d<bd&&free(q)){best=q;bd=d;}};
 for(let radius=step;radius<=maxDistance+1e-9&&!best;radius+=step){
  const count=Math.max(8,Math.ceil(2*Math.PI*radius/step));
  for(let i=0;i<count;i++){const angle=i*2*Math.PI/count;consider({x:goal.x+Math.cos(angle)*radius,y:goal.y+Math.sin(angle)*radius});}
 }
 if(!best)return null;
 const fine=step/5;
 for(let dy=-step;dy<=step+1e-9;dy+=fine)for(let dx=-step;dx<=step+1e-9;dx+=fine)consider({x:best.x+dx,y:best.y+dy});
 return best;
}
export function metreWalkTarget(s,actor,goal){
 const mover=walkingPerson(s,actor);if(!mover||![goal?.x,goal?.y].every(Number.isFinite))return goal;
 const occupied=people(s).filter(p=>p!==mover).map(p=>personPosition(s,p)).filter(Boolean),
  near=occupied.some(a=>distance(a,goal)<.53);
 if(domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)){const nearest=nearestVisibleBodyTarget(s,actor,goal,occupied);if(nearest)return nearest;}
 if(!near)return goal;
 return meterNearest(s,goal,{maxDistance:2,occupied})||goal;
}
/** Walk routes in the north body band use the same five-centimetre measured
 * body as the desktop observer. An off-ground start first takes one short
 * recovery step to the nearest legal ground; every later sample must stay on
 * the visible body. Null means no legal route, so callers do not silently fall
 * back to a centre-only path. */
export function visibleBodyWalkPath(s,from,goal,{maxRecovery=8}={}){
 if(!spatialEnabled(s)||![from?.x,from?.y,goal?.x,goal?.y].every(Number.isFinite))return null;
 let start=from;
 if(!visibleBodyPointClear(s,from)){
  start=nearestVisibleBodyGround(s,from,{maxDistance:maxRecovery});if(!start)return null;
  // The recovery prefix may leave the original off-ground stance, but once it
  // touches visible ground it must not step back out before the landing.
  const count=Math.max(1,Math.ceil(distance(from,start)/.05));let legal=false;
  for(let i=0;i<=count;i++){const p={x:from.x+(start.x-from.x)*i/count,y:from.y+(start.y-from.y)*i/count},ok=visibleBodyPointClear(s,p);if(ok)legal=true;else if(legal)return null;}
 }
 const route=meterFindPath(s,start,goal,{maxSnap:0,visibleBody:true});
 if(route===null)return null;
 return start===from?route:[{x:start.x,y:start.y},...route];
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
function doorCandidateValid(s,record,entryId,doorIds,participants){
 const p=s.personsById[record.personId],a=p&&personPosition(s,p);
 if(!p||!a||!doorIds.has(entryId)||!participants.has(p)||p.activityId!==record.activityId||!a.path?.length||!a.goal||distance(a.goal,record.target)>.01)return false;
 if(p.wound>20&&['construction','sr-construction','sr-transport'].includes(s.activitiesById[p.activityId]?.kind))return false;
 return true;
}
function pruneDoorQueues(s){
 const queues=s.spatial?.doorQueuesByEntryId;if(!queues)return;
 const entries=Object.entries(queues);if(!entries.length)return;
 const doorIds=new Set(closedDoors(s).map(d=>d.entryId)),participants=new Set(people(s));
 for(const [entryId,q]of entries){
  if(!doorIds.has(entryId)){delete queues[entryId];continue;}
  if(q.holder&&!doorCandidateValid(s,q.holder,entryId,doorIds,participants)){q.holder=null;q.lastPassTick=s.worldTick;}
  q.waiting=q.waiting.filter(w=>doorCandidateValid(s,w,entryId,doorIds,participants));
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
  const path=meterFindPath(s,a,at,{maxSnap:0});if(path===null||!visibleBodyRouteClear(s,a,path)||doorCrossing(s,a,path,at)||path.some((end,i)=>meterBodyBlocker(s,a,i?path[i-1]:a,end)))continue;
  candidates.push({at,path,cost:path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:a,end),0)});
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.at.y-b.at.y||a.at.x-b.at.x);
 if(candidates.length)a.bodyYield={kind:'door-wait',requestedBy:q.holder.personId,startedTick:s.worldTick,target:candidates[0].at,path:candidates[0].path};
}
/** Single-person door ownership is granted only by a real world movement step. */
export function meterDoorPermit(s,actor,from,route,next){
 if(['transport-retreat','requester-clear'].includes(actor.bodyYield?.kind))return false;
 if(!spatialEnabled(s))return true;
 if(actor.bodyYield?.kind==='mutual-corridor'&&cultivationTraveller(s,walkingPerson(s,actor)))return false;
 // Retained routes also obey the measured north body once a legal stance is reached.
 if(domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)&&!visibleBodySegmentClear(s,from,next)&&!visibleRecoveryPrefixPermit(s,actor,from,route,next)){actor.path=[];actor.goal=null;return false;}
 if(!eastVisibleSegmentClear(s,from,next)&&!visibleRecoveryPrefixPermit(s,actor,from,route,next)){actor.path=[];actor.goal=null;return false;}
 const p=walkingPerson(s,actor);
 if(!p)return true;
 pruneDoorQueues(s);
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
// Interior floors and the real door threshold are not outdoor paving. Room
// frames follow the same geometry revision as collision and door ownership.
const roomFrameCache=new WeakMap();
function roomFrames(s){
 const revision=spatialRevision(s),held=roomFrameCache.get(s);if(held?.revision===revision)return held.rooms;
 const rooms=(s.buildings||[]).flatMap(b=>{const room=spatialRoom(b);return room?[{bounds:room.bounds,door:room.door}]:[];});
 rooms.guesthouse=guesthouseGroundEnabled(s);rooms.mainVisible=!!s.spatial?.courtyardTerrain;rooms.northLibrary=domainNorthLibraryEnabled(s.spatial?.northLibrary?.version);rooms.eastVisible=domainExtentEnabled(s.spatial?.extentVersion);rooms.residences=domainResidencesEnabled(s.spatial?.eastResidences?.version);
 roomFrameCache.set(s,{revision,rooms});return rooms;
}
const internalAt=(rooms,p)=>(insideRoomOf(rooms,p)||doorwayOf(rooms,p));
const insideRoomOf=(rooms,p)=>rooms.some(({bounds:r})=>p.x>r.x&&p.x<r.x+r.width&&p.y>r.y&&p.y<r.y+r.height);
const doorwayOf=(rooms,p)=>rooms.some(({door:d})=>Math.abs(p.x-d.x)<=.7+1e-9&&Math.abs(p.y-d.y)<=.3+1e-9);
const guesthouseBodyPoint=p=>{for(let i=-1;i<16;i++){const a=i<0?p:{x:p.x+.26*Math.cos(i*Math.PI/8),y:p.y+.26*Math.sin(i*Math.PI/8)};if(!guesthouseArtGroundPoint(legacyToArt(a.x,a.y)))return false;}return true;};
const visibleBodyAt=(rooms,indoor,p,northProven=false)=>rooms.guesthouse&&guesthouseBodyPoint(p)||indoor&&internalAt(rooms,p)||(!rooms.mainVisible||courtyardSouthGroundPoint(p,{northLibrary:rooms.northLibrary}))&&(northProven||northLibraryYieldPointClear(p))&&(!rooms.eastVisible||eastVisibleBodyPoint(p,.26,{residences:rooms.residences}));
const measuredSegmentCache=new WeakMap(),measuredEquivalentRooms=new WeakMap(),equivalentMeasuredSegmentCaches=new Map();
function equivalentMeasuredSegments(rooms){
 if(measuredEquivalentRooms.has(rooms))return measuredEquivalentRooms.get(rooms);
 measuredEquivalentRooms.set(rooms,null);
 const flags=[rooms.guesthouse,rooms.mainVisible,rooms.northLibrary,rooms.eastVisible,rooms.residences];
 if(!flags.every(value=>typeof value==='boolean'))return null;
 const geometry=[];
 for(const room of rooms){
  const r=room.bounds,d=room.door,values=[r?.x,r?.y,r?.width,r?.height,d?.x,d?.y];
  if(!values.every(value=>typeof value==='number'&&Number.isFinite(value)))return null;
  geometry.push(values.map(value=>Object.is(value,-0)?'-0':value));
 }
 const signature=JSON.stringify([flags,geometry]);let cache=equivalentMeasuredSegmentCaches.get(signature);
 if(!cache){if(equivalentMeasuredSegmentCaches.size>=8)equivalentMeasuredSegmentCaches.delete(equivalentMeasuredSegmentCaches.keys().next().value);cache=new Map();equivalentMeasuredSegmentCaches.set(signature,cache);}
 measuredEquivalentRooms.set(rooms,cache);return cache;
}
function rememberedMeasuredSegment(rooms,kind,a,b,check,shareable=true){
 let cache=measuredSegmentCache.get(rooms);if(!cache){cache=new Map();measuredSegmentCache.set(rooms,cache);}
 const key=[kind,a.x,a.y,b.x,b.y].join('/');
 if(!cache.has(key)){
  if(cache.size>=8192)cache.clear();
  const finite=[a.x,a.y,b.x,b.y].every(value=>typeof value==='number'&&Number.isFinite(value));
  const shared=shareable&&finite&&(kind==='east'||kind==='east:planning-margin'||kind==='body:true'||kind==='body:planning-margin')?equivalentMeasuredSegments(rooms):null;
  if(shared?.has(key))cache.set(key,shared.get(key));
  else{const answer=check();cache.set(key,answer);if(shared&&typeof answer==='boolean'){if(shared.size>=8192)shared.clear();shared.set(key,answer);}}
 }
 return cache.get(key);
}
function eastVisibleSegmentClear(s,a,b,planning=false){
 if(Math.max(a.x,b.x)<118.74||Math.min(a.x,b.x)>=156.26)return true;
 const rooms=roomFrames(s);if(!rooms.eastVisible)return true;
 return rememberedMeasuredSegment(rooms,planning?'east:planning-margin':'east',a,b,()=>{
  const length=distance(a,b),n=Math.max(1,Math.ceil(length/.025));
  for(let i=0;i<=n;i++){
   const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(internalAt(rooms,p))continue;
   if(!eastVisibleBodyPoint(p,.26,{residences:rooms.residences}))return false;
   // A long shortcut and a later walking step sample different points. Keep
   // the same planning margin as the north roads so neither skips a sharp edge.
   if(planning&&length>1&&i>0&&i<n)for(const [dx,dy] of planningBodyOffsets){const q={x:p.x+dx,y:p.y+dy};if(!internalAt(rooms,q)&&!eastVisibleBodyPoint(q,.26,{residences:rooms.residences}))return false;}
  }
  return true;
 });
}
/** The measured visible body at one position: .26 m, sixteen samples. Floors and
 * the 1.4 m door threshold are interior space, so they are exempt by location. */
export function visibleBodyPointClear(s,p,{indoor=true}={}){
 if(!spatialEnabled(s)||!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return true;
 return visibleBodyAt(roomFrames(s),indoor,p);
}
/** Full remaining route, sampled every 2.5 cm, with the same .26 m sixteen-point
 * body rule. The planner samples the same spacing, so its chosen polyline and
 * the retained-route proof agree. */
export function visibleBodyRouteClear(s,from,route,{indoor=true}={}){
 if(!route?.length)return true;
 const rooms=roomFrames(s);let start=from;
 for(const end of route){
  if(!rememberedMeasuredSegment(rooms,'body:'+indoor,start,end,()=>{const n=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/.025));for(let i=0;i<=n;i++){const p={x:start.x+(end.x-start.x)*i/n,y:start.y+(end.y-start.y)*i/n};if(!visibleBodyAt(rooms,indoor,p))return false;}return true;},indoor===true))return false;
  start=end;
 }
 return true;
}
/** Owned activity recovery keeps a short physical prefix and stays on ground after landing. */
function visibleRecoveryPrefixPermit(s,actor,from,route,next){
 if(visibleBodyPointClear(s,from)||!route?.length||distance(actor,from)>1e-8)return false;
 const person=walkingPerson(s,actor),activity=person&&s.activitiesById[person.activityId],reservation=activity&&s.reservationsById[activity.reservationId],target=route[0];
 const reservedRest=activity?.kind==='facility'&&activity.personId===person.personId&&['navigating','waiting'].includes(activity.phase)&&reservation?.personId===person.personId&&reservation.activityId===activity.id&&reservation.slotId===activity.slotId;
 const ownedHarvest=activity?.kind==='sr-harvest'&&activity.personId===person.personId&&person===s.master&&actor.goal&&distance(actor.goal,activity.target)<1e-8&&distance(route.at(-1),activity.target)<1e-8;
 const transport=activity?.kind==='sr-transport'&&activity.personId===person.personId&&s.workOrdersById[activity.workOrderId];
 const transportReservation=transport&&s.reservationsById[transport.reservationId];
 const ownedTransport=transport&&transport.kind==='transport'&&transport.carrierId===person.personId&&['to-source','carrying'].includes(transport.phase)&&transportReservation?.kind==='transport-cargo'&&transportReservation.workOrderId===transport.id&&transportReservation.sourceStockpileId===transport.sourceStockpileId&&s.stockpilesById[transport.sourceStockpileId]&&s.stockpilesById[transport.targetStockpileId]&&actor.goal&&distance(actor.goal,target)<1e-8&&route.length===1;
 const construction=activity?.kind==='construction'&&person===s.master&&activity.personId===person.personId&&s.workOrdersById[activity.workOrderId],flow=construction?.materialFlow;
 const warehouse=flow&&['to-source','returning'].includes(flow.phase),destination=flow&&s.stockpilesById[warehouse?flow.sourceStockpileId:flow.siteStockpileId];
 const ownedConstruction=construction?.kind==='construction'&&construction.phase==='active'&&construction.activityIds?.includes(activity.id)&&flow?.carrierId===person.personId&&['to-source','carrying','returning','recover-site'].includes(flow.phase)&&reservation?.kind==='construction-material'&&reservation.activityId===activity.id&&construction.reservationId===activity.reservationId&&destination&&actor.goal&&distance(actor.goal,route.at(-1))<1e-8&&distance(actor.goal,destination.position)<=(warehouse?1.25:1e-8);
 if((!reservedRest&&!ownedHarvest&&!ownedTransport&&!ownedConstruction)||!visibleBodyPointClear(s,target,{indoor:false})||distance(from,target)>8||meterSweep(s,from,target).blocked||!visibleBodyRouteClear(s,target,route.slice(1)))return false;
 const nearest=nearestVisibleBodyGround(s,from);if(!nearest||distance(from,target)>nearest.distance+.05)return false;
 const n=Math.max(1,Math.ceil(distance(from,target)/.05));let legal=false;
 for(let i=0;i<=n;i++){const p={x:from.x+(target.x-from.x)*i/n,y:from.y+(target.y-from.y)*i/n},clear=visibleBodyPointClear(s,p,{indoor:false});if(clear)legal=true;else if(legal)return false;}
 return pointSegmentDistance(next,from,target)<1e-7&&distance(from,next)<=distance(from,target)+1e-7;
}
/** Nearest measured foot point that an already off-ground body can actually
 * walk to. Returns one straight, solid-free step target; null leaves the body
 * where it is instead of silently accepting a route across open ground. */
export function nearestVisibleBodyGround(s,from,{maxDistance=8,step=.25,bodyActor=null}={}){
 if(!spatialEnabled(s)||!from||!Number.isFinite(from.x)||!Number.isFinite(from.y))return null;
 if(visibleBodyPointClear(s,from))return null;
 const rooms=roomFrames(s),reachable=p=>!insideRoomOf(rooms,p)&&visibleBodyPointClear(s,p,{indoor:false})&&meterCanStand(s,p)&&!meterSweep(s,from,p).blocked&&(!bodyActor||!meterBodyBlocker(s,bodyActor,from,p));
 for(let radius=step;radius<=maxDistance+1e-9;radius+=step){
  const count=Math.max(8,Math.ceil(2*Math.PI*radius/step));let best=null;
  for(let i=0;i<count;i++){const angle=i*2*Math.PI/count,p={x:from.x+Math.cos(angle)*radius,y:from.y+Math.sin(angle)*radius};
   if(!reachable(p))continue;const d=distance(from,p);if(!best||d<best.distance)best={x:p.x,y:p.y,distance:d};
  }
  if(!best)continue;
  const fine=step/5;
  for(let dy=-step;dy<=step+1e-9;dy+=fine)for(let dx=-step;dx<=step+1e-9;dx+=fine){const p={x:best.x+dx,y:best.y+dy};
   if(!reachable(p))continue;const d=distance(from,p);if(d<best.distance)best={x:p.x,y:p.y,distance:d};
  }
  return best;
 }
 return null;
}
/** Idle saved courtyard bodies recover through the same measured prefix as
 * inherited walkers. Only an actual world step moves them; reads keep the save. */
export function advanceIdleVisibleBodyRecovery(s,p){
 const a=personPosition(s,p);
 if(a?.idleVisibleRecovery&&(p.activityId||a.path?.length||a.goal||a.bodyYield||doorRecord(s,p)||p.dead||p.lifeStatus==='dead'||p.life?.status==='dead'||p.position?.sceneId!==SPATIAL_SCENE.id)){delete a.idleVisibleRecovery;return false;}
 if(!spatialEnabled(s)||!p||p===s.master||p.dead||p.lifeStatus==='dead'||p.life?.status==='dead'||p.activityId||doorRecord(s,p)||p.position?.kind!=='scene'||p.position.sceneId!==SPATIAL_SCENE.id||!a||a.path?.length||a.goal||a.bodyYield||!meterCanStand(s,a))return false;
 if(visibleBodyPointClear(s,a)){if(a.idleVisibleRecovery)delete a.idleVisibleRecovery;return false;}
 const recovery=a.idleVisibleRecovery||{origin:{x:a.x,y:a.y},walked:0,startedTick:s.worldTick},remaining=3-recovery.walked;if(remaining<1e-9)return false;
 const target=nearestVisibleBodyGround(s,a,{maxDistance:Math.min(3,remaining),bodyActor:a});if(!target||distance(recovery.origin,target)>3+1e-9)return false;
 const count=Math.max(1,Math.ceil(distance(a,target)/.05));let legal=false;for(let i=0;i<=count;i++){const point={x:a.x+(target.x-a.x)*i/count,y:a.y+(target.y-a.y)*i/count},clear=visibleBodyPointClear(s,point);if(clear)legal=true;else if(legal)return false;}
 const d=distance(a,target);if(d<1e-9)return false;const n=Math.min(.13*COURTYARD_WALK_RATE,d,remaining),to={x:a.x+(target.x-a.x)*n/d,y:a.y+(target.y-a.y)*n/d};
 if(meterSweep(s,a,to).blocked||meterBodyBlocker(s,a,a,to))return false;
 a.facing=to.x<a.x?-1:1;a.back=to.y<a.y;a.x=to.x;a.y=to.y;a.steps=(a.steps||0)+n;recovery.walked+=n;if(visibleBodyPointClear(s,a))delete a.idleVisibleRecovery;else a.idleVisibleRecovery=recovery;syncPosition(s,p);
 if(p.location?.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id){p.location.x=a.x;p.location.y=a.y;}return true;
}
// Long planning shortcuts keep a 2.5 cm sampling margin; half-metre search
// edges and actual movement retain their existing predicates. This is sampled proof.
const planningBodyOffsets=[[.025,0],[-.025,0],[0,.025],[0,-.025]];
function visibleBodySegmentClear(s,a,b,planning=false){
 const rooms=roomFrames(s);return rememberedMeasuredSegment(rooms,planning?'body:planning-margin':'body:true',a,b,()=>{
  const northProven=northLibraryYieldSegmentProven(a,b,planning);
  const length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/.025));
  if(planning){
   if(!visibleBodySegmentClear(s,a,b,false))return false;
   if(length<=1)return true;
   for(let i=1;i<n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!internalAt(rooms,p))for(const [dx,dy] of planningBodyOffsets)if(!visibleBodyAt(rooms,true,{x:p.x+dx,y:p.y+dy},northProven))return false;}
  }else for(let i=0;i<=n;i++)if(!visibleBodyAt(rooms,true,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},northProven))return false;
  return true;
 });
}
/** A bounded half-metre bypass rejoins the original route without changing its goal. */
export function meterLocalBodyDetour(s,actor,from,route){
 if(!spatialEnabled(s)||!walkingPerson(s,actor)||!route?.length)return null;
 const blocker=meterBodyBlocker(s,actor,from,route[0]);if(!blocker)return null;
 // Rejoin within the local bypass distance along the original polyline. Its
 // later turns are shared road gates, even when a distant gate is closer.
 let remaining=2.5,previous=from,rejoin=route.at(-1),suffix=[];
 for(let i=0;i<route.length;i++){const end=route[i],length=distance(previous,end);if(length>=remaining){const t=remaining/length;rejoin={x:previous.x+(end.x-previous.x)*t,y:previous.y+(end.y-previous.y)*t};suffix=route.slice(i+(length-remaining<.001?1:0));break;}remaining-=length;previous=end;}
 const q=personPosition(s,blocker),candidates=[];
 for(let y=snap(q.y-1.5);y<=snap(q.y+1.5);y+=.5)for(let x=snap(q.x-1.5);x<=snap(q.x+1.5);x+=.5){const at={x,y},first=distance(from,at);if(first<.05||first>2.5||!meterCanStand(s,at)||meterSweep(s,from,at).blocked||meterBodyBlocker(s,actor,from,at))continue;
  if(!eastVisibleSegmentClear(s,from,at)||!eastVisibleSegmentClear(s,at,rejoin)||meterSweep(s,at,rejoin).blocked||meterBodyBlocker(s,actor,at,rejoin)||domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)&&(!northLibraryLocalBypassClear(from,[at,rejoin])||!visibleBodyRouteClear(s,from,[at,rejoin])))continue;candidates.push({path:[at,rejoin,...suffix],cost:first+distance(at,rejoin),x,y});
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);return candidates[0]?.path||null;
}
const facilityTraveller=a=>a?.kind==='facility'&&['waiting','navigating'].includes(a.phase);
const constructionTraveller=a=>['construction','sr-construction'].includes(a?.kind)&&a.phase==='moving';
// An accepted breakthrough still owns its body and reserved station on the
// approach. Its original route waits while the same body physically yields.
function cultivationTraveller(s,p){
 const a=s.activitiesById[p?.activityId],o=a&&s.srCultivation?.orders?.[a.orderId],r=a&&s.reservationsById[a.reservationId];
 return a?.kind==='sr-cultivation'&&a.phase==='moving'&&a.personId===p?.personId&&o?.id===a.orderId&&o.kind==='breakthrough'&&o.personId===p.personId&&o.phase==='reserved'&&o.progressTicks===0&&r?.kind==='sr-slot'&&r.personId===p.personId&&r.activityId===a.id&&r.slotId===a.slotId;
}
// Station entry must wait for the whole temporary body movement, including
// an empty retreat path whose return entrance is still occupied.
export function cultivationBodyYielding(s,p,o){
 return cultivationTraveller(s,p)&&s.activitiesById[p.activityId].orderId===o?.id&&['mutual-corridor','transport-retreat','requester-clear'].includes(personPosition(s,p)?.bodyYield?.kind);
}
// Only a commuting craft body with its original active order and reservations
// can pause for traffic. Working at the furnace never enters this route path.
function craftTraveller(s,p){
 const a=s.activitiesById[p?.activityId],w=a&&s.workOrdersById[a.workOrderId],r=w&&s.reservationsById[w.slotReservationId],materials=w&&s.reservationsById[w.reservationId];
 return a?.kind==='sr-craft'&&a.phase==='moving'&&a.personId===p?.personId&&w?.kind==='sr-crafting'&&w.phase==='active'&&w.progressTicks===0&&w.personId===p.personId&&w.activityId===a.id&&r?.kind==='sr-slot'&&r.personId===p.personId&&r.activityId===a.id&&r.slotId===a.slotId&&materials?.kind==='sr-craft-material'&&materials.workOrderId===w.id;
}
export function craftBodyYielding(s,p,w){
 return craftTraveller(s,p)&&s.activitiesById[p.activityId].workOrderId===w?.id&&['mutual-corridor','transport-retreat','requester-clear'].includes(personPosition(s,p)?.bodyYield?.kind);
}
const transportMovementTicks=new WeakMap();
export const transportMovedThisTick=(s,p)=>transportMovementTicks.get(p)===s.worldTick;
function transportTraveller(s,p){
 const a=s.activitiesById[p?.activityId],w=a&&s.workOrdersById[a.workOrderId],r=w&&s.reservationsById[w.reservationId];
 return a?.kind==='sr-transport'&&a.personId===p.personId&&w?.kind==='transport'&&w.carrierId===p.personId&&['to-source','carrying'].includes(w.phase)&&r?.kind==='transport-cargo'&&r.workOrderId===w.id&&r.sourceStockpileId===w.sourceStockpileId&&!!s.stockpilesById[w.sourceStockpileId]&&!!s.stockpilesById[w.targetStockpileId];
}
/** A stationless, stationary facility waiter outside a station building. The
 * blocker keeps its own waiting activity; only a short legal side step is added. */
function stationlessFacilityWaiter(s,p){
 const activity=s.activitiesById[p?.activityId],a=personPosition(s,p);
 return !!activity&&activity.kind==='facility'&&activity.phase==='waiting'&&!activity.slotId&&!activity.reservationId&&
  !!a&&!a.path?.length&&!a.goal&&!a.waitingForPersonId&&
  !p.mind?.away&&!p.mind?.journey&&people(s).includes(p);
}
/** Strict entrance case: the mover holds the building's valid exclusive station
 * reservation and is still outside, while the blocker is a stationless static
 * waiter standing in that building's entrance approach. */
function validStationEntrant(s,mover,blocker,route){
 if(!mover||!blocker||blocker===s.master||!route?.length)return false;
 const activity=s.activitiesById[mover.activityId],reservation=s.reservationsById[activity?.reservationId];
 if(!activity||activity.kind!=='facility'||!facilityTraveller(activity)||!activity.targetId||!activity.slotId||!reservation)return false;
 if(reservation.kind!=='slot'||reservation.personId!==mover.personId||reservation.activityId!==activity.id||reservation.slotId!==activity.slotId)return false;
 if(!activity.slotId.startsWith(activity.targetId+'/'))return false;
 const building=s.buildingsById[activity.targetId],room=building&&spatialRoom(building);
 if(!building||!room)return false;
 const blockerActivity=s.activitiesById[blocker.activityId];
 if(!blockerActivity||blockerActivity.kind!=='facility'||blockerActivity.phase!=='waiting'||blockerActivity.slotId||blockerActivity.reservationId||blockerActivity.targetId!==activity.targetId)return false;
 if(!stationlessFacilityWaiter(s,blocker))return false;
 const access=spatialAccess(building),moverAt=personPosition(s,mover),blockerAt=personPosition(s,blocker);
 if(!access||!moverAt||!blockerAt||distance(blockerAt,access)>3||distance(moverAt,access)>5)return false;
 const r=room.bounds,inside=p=>p.x>r.x&&p.x<r.x+r.width&&p.y>r.y&&p.y<r.y+r.height;
 if(inside(moverAt)||inside(blockerAt))return false;
 if(!route.some((end,i)=>pointSegmentDistance(blockerAt,i?route[i-1]:moverAt,end)<=1))return false;
 return true;
}
/** A mutually blocked traveller keeps the original activity while stepping aside. */
export function requestBodyYield(s,actor,blocker,route){
 const mover=walkingPerson(s,actor),q=personPosition(s,blocker);
 const activity=s.activitiesById[blocker.activityId],moving=s.activitiesById[mover?.activityId],visitorPassing=['arriving','departing'].includes(mover?.courtyardVisit?.phase)&&['arriving','departing'].includes(blocker.courtyardVisit?.phase),constructionPassing=constructionTraveller(activity)&&(facilityTraveller(moving)||constructionTraveller(moving)&&activity.workOrderId===moving.workOrderId),transportPassing=transportTraveller(s,mover)&&transportTraveller(s,blocker)||cultivationTraveller(s,mover)&&transportTraveller(s,blocker),canPause=(visitorPassing||facilityTraveller(activity)||cultivationTraveller(s,blocker)||craftTraveller(s,blocker)||constructionPassing||transportPassing)&&q?.waitingForPersonId===mover?.personId,entranceClear=validStationEntrant(s,mover,blocker,route);
 if(!mover||!q||blocker===mover||blocker.activityId&&!canPause&&!entranceClear||q.path?.length&&!canPause&&!entranceClear||q.bodyYield||!route?.length)return false;
 const from={x:q.x,y:q.y},points=[],mutual=canPause&&actor.waitingForPersonId===blocker.personId;
 const collect=(radius,limit)=>{
 const candidates=[];
 for(let y=snap(from.y-radius);y<=snap(from.y+radius);y+=.5)for(let x=snap(from.x-radius);x<=snap(from.x+radius);x+=.5){const at={x,y},away=distance(from,at);if(away<.53||away>limit||!meterCanStand(s,at)||!visibleBodyPointClear(s,at)||meterBodyBlocker(s,q,at,at)||closedDoors(s).some(d=>distance(at,d.door)<.8))continue;
  if(pointSegmentDistance(at,actor,route[0])<.8||route.some((end,i)=>pointSegmentDistance(at,i?route[i-1]:actor,end)<.8))continue;
  candidates.push({at,away});
 }
 candidates.sort((a,b)=>a.away-b.away||a.at.y-b.at.y||a.at.x-b.at.x);
 for(const {at} of candidates){
  const path=meterFindPath(s,from,at,{maxSnap:0});if(path===null||!path.length||radius===8&&(path.length>24||path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:from,end),0)>8||!visibleBodyRouteClear(s,from,path))||domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)&&(!northLibraryLocalBypassClear(from,path)||!visibleBodyRouteClear(s,from,path))||doorCrossing(s,from,path,at)||path.some((end,i)=>meterBodyBlocker(s,q,i?path[i-1]:from,end)))continue;
  points.push({at,path,cost:path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:from,end),0)});break;
 }
 };

 collect(2,2.25);
 // A narrow entrance may need a real retreat beyond the nearest landing.
 if(!points.length&&(mutual||entranceClear||canPause&&transportTraveller(s,mover)))collect(4,4);
 // U-63: an already waiting facility follower can clear a transport retreat
 // through a measured passing place, within eight metres of actual walking.
 if(!points.length&&canPause&&transportTraveller(s,mover)&&(facilityTraveller(activity)||cultivationTraveller(s,blocker)))collect(8,8);
 points.sort((a,b)=>a.cost-b.cost||a.at.y-b.at.y||a.at.x-b.at.x);
 if(!points.length){if(mutual)return requestTransportRetreat(s,mover,blocker);return false;}
 const kind=entranceClear?'entrance-clear':canPause?'mutual-corridor':undefined;
 q.bodyYield={...(kind?{kind}:{}),requestedBy:mover.personId,activityId:blocker.activityId??null,...(Number.isSafeInteger(activity?.startedTick)?{activityStartedTick:activity.startedTick}:{}),startedTick:s.worldTick,target:points[0].at,path:points[0].path};return true;
}
/** A loaded transport in reciprocal traffic can back along the opposing
 * traveller's road to the nearest measured passing place. The original cargo,
 * task, goal and route stay owned by the transport throughout the retreat. */
function manualWalkRetreatOwner(s,p,y){
 if(p!==s.master||p.activityId||p.action!=='walk'||p.learning||p.journey)return false;
 const at=personPosition(s,p);if(!at?.goal||!at.path?.length||at.spatialEvacuationOrderId||doorRecord(s,p))return false;
 if(y)return y.manualWalk===true&&y.activityId===null&&y.workOrderId===null&&y.originalGoal&&distance(at.goal,y.originalGoal)<1e-8;
 return visibleBodyRouteClear(s,at,at.path);
}
function transportRetreatOwner(s,p,y){
 if(manualWalkRetreatOwner(s,p,y))return true;
 if(craftTraveller(s,p)){const a=s.activitiesById[p.activityId];return !y||y.activityId===a.id&&y.workOrderId===a.workOrderId;}
 if(cultivationTraveller(s,p)){const a=s.activitiesById[p.activityId];return !y||y.activityId===a.id&&y.orderId===a.orderId;}
 const a=s.activitiesById[p?.activityId],w=a&&s.workOrdersById[a.workOrderId];
 const transport=a?.kind==='sr-transport'&&w?.carrierId===p.personId&&(w.phase==='carrying'||transportTraveller(s,p)),construction=a?.kind==='construction'&&p===s.master&&w?.kind==='construction'&&w.materialFlow?.carrierId===p.personId&&w.materialFlow.phase==='carrying'&&w.phase==='active';
 return (transport||construction)&&a.personId===p.personId&&w?.id===a.workOrderId&&(!y||y.workOrderId===w.id&&y.activityId===a.id);
}
function requestTransportRetreat(s,mover,blocker){
 const actor=personPosition(s,mover),other=personPosition(s,blocker);
 const transportPair=transportTraveller(s,mover)&&transportTraveller(s,blocker),cultivationPair=transportTraveller(s,mover)&&cultivationTraveller(s,blocker)||cultivationTraveller(s,mover)&&transportTraveller(s,blocker),craftPair=craftTraveller(s,mover)&&facilityTraveller(s.activitiesById[blocker.activityId]),manualWalk=manualWalkRetreatOwner(s,mover),maxWalk=manualWalk?8:24;
 if(doorRecord(s,mover)||doorRecord(s,blocker)||!(mover===s.master&&transportRetreatOwner(s,mover)||transportPair||cultivationPair||craftPair)||actor.bodyYield||other.bodyYield||actor.waitingForPersonId!==blocker.personId||other.waitingForPersonId!==mover.personId||!(facilityTraveller(s.activitiesById[blocker.activityId])||transportPair||cultivationPair)||!other.path?.length)return false;
 const from={x:actor.x,y:actor.y},prefix=[],candidates=[];let previous=from,total=0;
 for(const end of other.path){
  const length=distance(previous,end);if(total+length>maxWalk)break;
  const dx=end.x-previous.x,dy=end.y-previous.y;
  for(let along=.5;along<=length;along+=.5){const base={x:previous.x+dx*along/length,y:previous.y+dy*along/length};
   for(const offset of [.8,1,1.5,2])for(const sign of [-1,1]){const at={x:base.x-dy/length*offset*sign,y:base.y+dx/length*offset*sign};
    if(!meterCanStand(s,at)||!visibleBodyPointClear(s,at)||closedDoors(s).some(d=>distance(at,d.door)<.8)||other.path.some((q,i)=>pointSegmentDistance(at,i?other.path[i-1]:other,q)<.8)||meterBodyBlocker(s,actor,at,at))continue;
    candidates.push({at,cost:distance(from,at),roadPath:[...prefix,{...base},{...at}]});
   }
  }
  prefix.push({...end});total+=length;previous=end;
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.at.y-b.at.y||a.at.x-b.at.x);
 let best=null;
 for(const candidate of candidates){
  const staticValid=path=>path?.length&&path.length<=24&&path.reduce((sum,q,i)=>sum+distance(i?path[i-1]:from,q),0)<=maxWalk&&visibleBodyRouteClear(s,from,path)&&!doorCrossing(s,from,path,candidate.at)&&!path.some((q,i)=>meterSweep(s,i?path[i-1]:from,q).blocked);
  const valid=path=>staticValid(path)&&!path.some((q,i)=>meterBodyBlocker(s,actor,i?path[i-1]:from,q));
  const direct=meterFindPath(s,from,candidate.at,{maxSnap:0}),path=valid(candidate.roadPath)?candidate.roadPath:valid(direct)?direct:null;
  if(!path){
   if(transportPair&&staticValid(candidate.roadPath)){
    const tail=candidate.roadPath.map((q,i)=>meterBodyBlocker(s,actor,i?candidate.roadPath[i-1]:from,q)).find(Boolean),tailAt=tail&&personPosition(s,tail);
    if(tail&&tail!==blocker&&actor.waitingForPersonId!==tail.personId&&facilityTraveller(s.activitiesById[tail.activityId])&&tailAt?.waitingForPersonId===mover.personId&&requestBodyYield(s,actor,tail,candidate.roadPath))return true;
   }
   continue;
  }
  best={...candidate,path};break;
 }
 if(!best)return false;
 const a=s.activitiesById[mover.activityId];actor.bodyYield={kind:'transport-retreat',requestedBy:blocker.personId,activityId:a?.id??null,workOrderId:a?.workOrderId??null,...(cultivationTraveller(s,mover)?{orderId:a.orderId}:{}),...(manualWalk?{manualWalk:true,originalGoal:{...actor.goal}}:{}),startedTick:s.worldTick,target:best.at,path:best.path,returnPrefixLength:best.path.length,returnPath:[...best.path.slice(0,-1).reverse().map(q=>({...q})),from,...actor.path.map(q=>({...q}))]};return true;
}
/** A mutual-corridor step blocked by the requester's own body: search a small
 * legal retreat for the requester. Hard checks only (bodies/static/visible/door/
 * road); future activity paths are not current body occupancy. */
function findRequesterClear(s,yielderAt,yielderStep,requester,yieldPath=[]){
 const requesterAt=personPosition(s,requester);
 const walkingMaster=requester===s.master&&!requester.activityId&&requester.action==='walk'&&requesterAt?.path?.length&&requesterAt.goal&&!requesterAt.spatialEvacuationOrderId&&!doorRecord(s,requester)&&visibleBodyRouteClear(s,requesterAt,requesterAt.path);
 if(!requesterAt||requester===s.master&&!transportRetreatOwner(s,requester)&&!walkingMaster||requesterAt.bodyYield)return null;
 const from={x:requesterAt.x,y:requesterAt.y};
 const ax=yielderAt.x,ay=yielderAt.y,bx=yielderStep.x,by=yielderStep.y,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((from.x-ax)*dx+(from.y-ay)*dy)/den)),closest={x:ax+t*dx,y:ay+t*dy};
 let awayX=from.x-closest.x,awayY=from.y-closest.y;if(Math.hypot(awayX,awayY)<1e-9){awayX=0;awayY=1;}
 const awayAngle=Math.atan2(awayY,awayX),clear=SPATIAL_SCENE.personRadius*2+.01,angles=[];
 for(let i=0;i<24;i++){const angle=awayAngle+i*Math.PI*2/24;angles.push({angle,pref:Math.cos(angle-awayAngle)});}
 angles.sort((a,b)=>b.pref-a.pref);
 for(const radius of [.05,.1,.15,.2,.25,.3,.35,.4,.45,.5,.55,.6]){
  for(const {angle} of angles){
   const at={x:from.x+Math.cos(angle)*radius,y:from.y+Math.sin(angle)*radius},path=meterFindPath(s,from,at,{maxSnap:0});
   if(path===null||!path.length||!meterCanStand(s,at)||pointSegmentDistance(at,{x:ax,y:ay},yielderStep)<=clear||yieldPath.some((q,i)=>pointSegmentDistance(at,i?yieldPath[i-1]:yielderAt,q)<=clear)||!visibleBodyPointClear(s,at))continue;
   if(walkingMaster&&(path.reduce((sum,end,i)=>sum+distance(i?path[i-1]:from,end),0)>.6||!visibleBodyRouteClear(s,from,path))||domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)&&(!northLibraryLocalBypassClear(from,path)||!visibleBodyRouteClear(s,from,path)))continue;
   if(doorCrossing(s,from,path,at)||closedDoors(s).some(d=>distance(at,d.door)<.8))continue;
   if(path.some((end,i)=>meterBodyBlocker(s,requesterAt,i?path[i-1]:from,end))||path.some((end,i)=>meterSweep(s,i?path[i-1]:from,end).blocked))continue;
   return {at,path};
  }
 }
 return null;
}
function validateManualWalkRetreat(at,y){
 if(y.manualWalk!==true)return;
 const routeLength=(from,path)=>path.reduce((sum,to)=>{sum+=distance(from,to);from=to;return sum;},0);
 if(routeLength(y.target,y.returnPath.slice(0,y.returnPrefixLength))>8+1e-8||routeLength(at,y.path)>8+1e-8)throw Error('玩家行走退让超过八米实际路长。');
}
function syncPosition(s,p){const a=personPosition(s,p);if(a&&(!p.location||p.location.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id)&&p.position?.kind!=='travel'&&(!p.position?.sceneId||p.position.sceneId===SPATIAL_SCENE.id))p.position={kind:'scene',sceneId:SPATIAL_SCENE.id,x:a.x,y:a.y};}
function overlaps(a,b){return a.x<b.x+b.w-.001&&a.x+a.w>b.x+.001&&a.y<b.y+b.h-.001&&a.y+a.h>b.y+.001;}
function footprintRect(b){const t=spatialTransform(b),d=dimensions(b);return {x:t.x,y:t.y,w:d.width,h:d.height};}
const connectivityCache=new WeakMap();
function rememberedConnection(s,origin,goal){const rev=spatialRevision(s);let data=connectivityCache.get(s);if(data?.revision!==rev){data={revision:rev,routes:new Map()};connectivityCache.set(s,data);}const key=`${origin.x}/${origin.y}/${goal.x}/${goal.y}`;if(!data.routes.has(key))data.routes.set(key,meterFindPath(s,origin,goal,{maxSnap:0}));return data.routes.get(key);}
function routeStillClear(s,origin,route){if(route===null)return false;const polygons=obstacles(s);if(!clearPoint(polygons,origin,.26))return false;let p=origin;for(const q of route){if(!continuousClear(polygons,p,q,.26))return false;p=q;}return true;}
const migrationConnectionProof=Symbol('migration-connected-entrances');
export function placementIssue(s,type,x,y,{ignoreId=null,level=1,checkPeople=true,checkReservations=true,checkConnectivity=true,connectionProof=null,checkPreset=true}={}){
 if(!PREFAB_CATALOG[type]||!Number.isFinite(x)||!Number.isFinite(y)||snap(x)!==x||snap(y)!==y)return '位置须在合法营造格上；仅支持南向预制件。';
 if(buildingGridEnabled(s)&&(!onBuildingGrid(x)||!onBuildingGrid(y)))return '位置须对齐建筑单位格；每格2米。';
 const bounds=sceneBounds(s),b=layoutBuilding(s,{type,level,transform:{x,y,orientation:'south'},...((ignoreId===null?domainServicesEnabled(s.spatial?.eastServices?.version)&&domainSiteAt(type,x,y)?.services:s.buildings.find(b=>b.id===ignoreId)?.serviceVersion===SITE_SERVICE_VERSION)?{serviceVersion:SITE_SERVICE_VERSION}:{})}),r=footprintRect(b),poly=spatialFootprint(b);
 if(x<(bounds.x||0)+1||y<(bounds.y||0)+1||x+r.w>(bounds.x||0)+bounds.width-1||y+r.h+1>(bounds.y||0)+bounds.height-1)return '此处超出可建边界或未留门外通道。';
 const outsideOriginal=x<0||y<0||x+r.w>SPATIAL_SCENE.width||y+r.h>SPATIAL_SCENE.height,site=domainSiteAt(type,x,y);
 if(type==='guesthouse'&&(!site?.guesthouse||!guesthouseGroundEnabled(s)||level!==1))return '请先开放客院台地，并在预设客院建位动工。';
 if(domainExtentEnabled(s.spatial?.extentVersion)&&outsideOriginal){
  if(!site||site.guesthouse&&!guesthouseGroundEnabled(s)||site.westWorkshops&&!domainWestWorkshopsEnabled(s.spatial.westWorkshops?.version)||site.northMeditation&&!domainNorthMeditationEnabled(s.spatial.northMeditation?.version)||site.northLibrary&&!domainNorthLibraryEnabled(s.spatial.northLibrary?.version)||site.services&&!domainServicesEnabled(s.spatial.eastServices?.version)||site.residences&&!domainResidencesEnabled(s.spatial.eastResidences?.version)||site.extentVersion===DOMAIN_VALLEY_EXTENT_VERSION&&!domainValleyEnabled(s.spatial.extentVersion)||level>site.maxLevel||r.w>site.reserveWidth||r.h>site.reserveHeight||x<0&&!domainWestEnabled(s.spatial.extentVersion))return '请在已规划并开放的营造地动工。';
 }
 if(checkPreset&&s.spatial?.courtyardTerrain){
  const existing=s.buildings.find(old=>old.id===ignoreId),atExisting=existing&&spatialTransform(existing).x===x&&spatialTransform(existing).y===y;
  const original=type==='hall'&&x===24&&y===4||type==='farm'&&x===12&&y===40;
  if(!site&&!original&&!atExisting)return '请从山域规划选择已开放的预设建位。';
 }
 if(y<0){if(!domainNorthLibraryEnabled(s.spatial?.northLibrary?.version))return '先启用北台藏经阁通路。';for(let yy=y;yy<=y+r.h;yy+=.5)for(let xx=x;xx<=x+r.w;xx+=.5)if(!northLibraryTerrainContains({x:xx,y:yy},0,s.spatial.northMeditation?.version))return '此处超出已开放的北台场地。';}
 if(domainWestEnabled(s.spatial?.extentVersion)&&x<0){
  for(let yy=y;yy<=y+r.h;yy+=.5)for(let xx=x;xx<=x+r.w;xx+=.5)if(!westTerrainContains({x:xx,y:yy},0,s.spatial.extentVersion,s.spatial.westWorkshops?.version))return '此处超出已开放的西部场地。';
 }
 if(domainResidencesEnabled(s.spatial?.eastResidences?.version)&&x+r.w>=156){for(let yy=y;yy<=y+r.h;yy+=.5)for(let xx=x;xx<=x+r.w;xx+=.5)if(!(domainServicesEnabled(s.spatial?.eastServices?.version)?eastServicesTerrainContains:eastResidencesTerrainContains)({x:xx,y:yy}))return '此处超出已开放的住宅场地。';}
 for(const t of spatialTerrain(s)){if(t.buildingId===`building:yunxiu:${ignoreId}`&&type==='farm'&&x===12&&y===40&&level===1)continue;const xs=t.polygon.map(p=>p[0]),ys=t.polygon.map(p=>p[1]);if(overlaps(r,{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}))return `${t.label}不能营造。`;}
 for(const old of s.buildings||[]){if(old.id===ignoreId)continue;if(overlaps(r,footprintRect(old)))return `与${BUILDINGS[old.type].name}（${old.id}）占地冲突。`;if(polygonContains(spatialAccess(old),poly,.65))return `挡住${BUILDINGS[old.type].name}入口与门外通路。`;if(polygonContains(spatialAccess(b),spatialFootprint(old),.65))return `${BUILDINGS[old.type].name}占地挡住新设施入口与门外通路。`;}
 if(checkReservations)for(const o of Object.values(s.workOrdersById||{})){if(o.kind!=='construction'||!o.spatial||['cancelled','completed'].includes(o.phase)||o.targetId===`building:yunxiu:${ignoreId}`||o.operation==='demolish')continue;const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})});if(overlaps(r,footprintRect(planned)))return '该位置已有施工预约。';}
 if(checkPeople)for(const p of people(s)){const q=personPosition(s,p);if(q&&polygonContains(q,poly,.26))return `${p.name||p.personId}正在此处，请等其走开。`;}
 if(!checkConnectivity)return '';
 const candidate={...s,buildings:[...(s.buildings||[]).filter(old=>old.id!==ignoreId),b]},entry=spatialAccess(b),hall=candidate.buildings.find(old=>old.type==='hall'),origin=hall?spatialAccess(hall):{x:32,y:56};if(!meterCanStand(candidate,entry)||!meterFindPath(candidate,origin,entry,{maxSnap:0}))return '入口未与归院道路连通，或门道过窄。';
 // Ordered migration has already connected every placed entrance. Outdoor
 // prefabs other than the unit well add no navigation obstacles.
 if(connectionProof===migrationConnectionProof&&!PREFAB_CATALOG[type].indoor&&type!=='well')return '';
 for(const old of candidate.buildings){if(old===b)continue;const a=spatialAccess(old);if(!meterCanStand(candidate,a)||!routeStillClear(candidate,origin,rememberedConnection(s,origin,a))&&!meterFindPath(candidate,origin,a,{maxSnap:0}))return `改动会封住${BUILDINGS[old.type].name}入口。`;}
 return '';
}
export function initSpatial(s){
 if(spatialEnabled(s))return s;const originalPeople=people(s).map(p=>[p,personPosition(s,p)]),oldBuildings=s.buildings||[];
 s.spatial={version:SPATIAL_VERSION,extentVersion:SPATIAL_EXTENT_VERSION,sceneId:SPATIAL_SCENE.id,geometryRevision:1,migrations:[],completedOrders:[]};
 const bounds=sceneBounds(s);
 const placed=[];for(const b of oldBuildings){const d=spatialPrefab(b),p=b.type==='hall'?{x:24,y:4}:legacyToWorld(b.legacyScenicPosition||scenicPoint(b.x,b.y)||{x:100+b.x*110,y:250+b.y*75});let target={x:snap(p.x-d.width/2),y:snap(p.y-d.height)};if(b.type==='hall')target={x:24,y:4};const test={...s,buildings:placed};let reason=placementIssue(test,b.type,target.x,target.y,{level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:true,connectionProof:migrationConnectionProof});if(reason){let found=null;const candidates=[];for(let y=(bounds.y||0)+1;y<=(bounds.y||0)+bounds.height-d.height-2;y+=SPATIAL_SCENE.grid)for(let x=(bounds.x||0)+1;x<=(bounds.x||0)+bounds.width-d.width-1;x+=SPATIAL_SCENE.grid)candidates.push({x,y,distance:distance(target,{x,y})});candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);for(const q of candidates){if(!placementIssue(test,b.type,q.x,q.y,{level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:true,connectionProof:migrationConnectionProof})){found={x:q.x,y:q.y};break;}}if(!found)throw Error(`空间迁移无法安置${b.instanceId}；保留原档，不丢弃建筑。`);s.spatial.migrations.push({entityId:b.instanceId,kind:'building-layout-repair',from:target,to:found,reason});target=found;}
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
 if(s.spatial.extentVersion===SPATIAL_EXTENT_VERSION||domainExtentEnabled(s.spatial.extentVersion))return s;
 // Validation remains on the legacy boundary until every original position,
 // route and construction target is accepted. Expansion only adds metadata.
 validateSpatial(s);s.spatial.extentVersion=SPATIAL_EXTENT_VERSION;return s;
}
/** Explicit content activation preserves every existing metre position and
 * activity. The current world command owns the transaction and its receipt. */
export function enableSectDomain(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('山域扩展需要现行米制山院存档。');
 validateSpatial(s);
 if(domainWestEnabled(s.spatial.extentVersion))return {enabled:true,alreadyEnabled:true,extentVersion:s.spatial.extentVersion,layoutVersion:DOMAIN_LAYOUT_VERSION};
 if(s.story?.opening&&s.story.opening.hallPhase!=='complete')throw Error('先营造主殿，再启用山域通路。');
 s.spatial.extentVersion=DOMAIN_EXTENT_VERSION;
 s.spatial.domain={layoutVersion:DOMAIN_LAYOUT_VERSION,openedAtTick:s.spatial.domain?.openedAtTick??s.worldTick};
 s.spatial.geometryRevision++;
 validateSpatial(s);
 return {enabled:true,alreadyEnabled:false,extentVersion:DOMAIN_EXTENT_VERSION,layoutVersion:DOMAIN_LAYOUT_VERSION};
}
export function enableWestValley(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('西谷扩展需要现行米制山院存档。');
 validateSpatial(s);
 if(domainValleyEnabled(s.spatial.extentVersion))return {enabled:true,alreadyEnabled:true,extentVersion:DOMAIN_VALLEY_EXTENT_VERSION,layoutVersion:DOMAIN_LAYOUT_VERSION};
 if(!domainWestEnabled(s.spatial.extentVersion))throw Error('先启用西林通路，再启用西谷。');
 if(s.story?.opening&&s.story.opening.hallPhase!=='complete')throw Error('先营造主殿，再启用西谷通路。');
 s.spatial.extentVersion=DOMAIN_VALLEY_EXTENT_VERSION;
 s.spatial.domain.valleyOpenedAtTick=s.worldTick;s.spatial.geometryRevision++;
 validateSpatial(s);
 return {enabled:true,alreadyEnabled:false,extentVersion:DOMAIN_VALLEY_EXTENT_VERSION,layoutVersion:DOMAIN_LAYOUT_VERSION};
}
export function enableEastResidences(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('东侧住宅扩展需要现行米制山院存档。');
 validateSpatial(s);
 if(domainResidencesEnabled(s.spatial.eastResidences?.version))return {enabled:true,alreadyEnabled:true,version:EAST_RESIDENCES_VERSION};
 if(s.story?.opening&&s.story.opening.hallPhase!=='complete')throw Error('先营造主殿，再启用住宅通路。');
 if(!domainExtentEnabled(s.spatial.extentVersion)){
  s.spatial.extentVersion=DOMAIN_EAST_EXTENT_VERSION;
  s.spatial.domain={layoutVersion:DOMAIN_LAYOUT_VERSION,openedAtTick:s.worldTick};
 }
 s.spatial.eastResidences={version:EAST_RESIDENCES_VERSION,openedAtTick:s.worldTick};
 s.spatial.geometryRevision++;
 validateSpatial(s);
 return {enabled:true,alreadyEnabled:false,version:EAST_RESIDENCES_VERSION};
}
export function enableWestWorkshops(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('西谷双院需要现行米制山院存档。');
 validateSpatial(s);
 if(domainWestWorkshopsEnabled(s.spatial.westWorkshops?.version))return {enabled:true,alreadyEnabled:true,version:WEST_WORKSHOPS_VERSION};
 if(!domainValleyEnabled(s.spatial.extentVersion))throw Error('先启用西谷通路，再沿采石场外侧货路前往双院。');
 if(s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION)throw Error('先启用山院实景道路。');
 if(s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION)throw Error('西谷双院需要现行成人室内布局。');
 const before=s.spatial.westWorkshops,revision=s.spatial.geometryRevision;
 s.spatial.westWorkshops={version:WEST_WORKSHOPS_VERSION,openedAtTick:s.worldTick};s.spatial.geometryRevision++;
 try{validateSpatial(s);}catch(error){if(before===undefined)delete s.spatial.westWorkshops;else s.spatial.westWorkshops=before;s.spatial.geometryRevision=revision;throw error;}
 return {enabled:true,alreadyEnabled:false,version:WEST_WORKSHOPS_VERSION};
}
export function enableNorthMeditation(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('聚灵台需要现行米制山院存档。');
 validateSpatial(s);
 if(domainNorthMeditationEnabled(s.spatial.northMeditation?.version))return {enabled:true,alreadyEnabled:true,version:NORTH_MEDITATION_VERSION};
 if(!domainNorthLibraryEnabled(s.spatial.northLibrary?.version))throw Error('先启用藏经阁北台通路，再沿西侧山阶前往聚灵台地。');
 const before=s.spatial.northMeditation,revision=s.spatial.geometryRevision;
 s.spatial.northMeditation={version:NORTH_MEDITATION_VERSION,openedAtTick:s.worldTick};s.spatial.geometryRevision++;
 try{validateSpatial(s);}catch(error){if(before===undefined)delete s.spatial.northMeditation;else s.spatial.northMeditation=before;s.spatial.geometryRevision=revision;throw error;}
 return {enabled:true,alreadyEnabled:false,version:NORTH_MEDITATION_VERSION};
}
export function enableNorthLibrary(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('北台扩展需要现行米制山院存档。');
 validateSpatial(s);
 if(domainNorthLibraryEnabled(s.spatial.northLibrary?.version))return {enabled:true,alreadyEnabled:true,version:NORTH_LIBRARY_VERSION};
 if(!domainExtentEnabled(s.spatial.extentVersion))throw Error('先启用山域通路，再接北台道路。');
 if(s.story?.opening&&s.story.opening.hallPhase!=='complete')throw Error('先营造主殿，再启用北台通路。');
 if(s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION)throw Error('先启用山院实景道路。');
 if(s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION)throw Error('藏经阁需要现行成人室内布局。');
 const before=s.spatial.northLibrary,revision=s.spatial.geometryRevision;
 s.spatial.northLibrary={version:NORTH_LIBRARY_VERSION,openedAtTick:s.worldTick};s.spatial.geometryRevision++;
 try{validateSpatial(s);}catch(error){if(before===undefined)delete s.spatial.northLibrary;else s.spatial.northLibrary=before;s.spatial.geometryRevision=revision;throw error;}
 return {enabled:true,alreadyEnabled:false,version:NORTH_LIBRARY_VERSION};
}
export function enableGuesthouse(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s)||!domainExtentEnabled(s.spatial?.extentVersion)||s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION)throw Error('客院需要现行山域与成人室内布局。');
 validateSpatial(s);
 if(guesthouseGroundEnabled(s))return {enabled:true,alreadyEnabled:true,version:GUESTHOUSE_LAYOUT_VERSION};
 const before=s.spatial.guesthouse,revision=s.spatial.geometryRevision;
 s.spatial.guesthouse={version:GUESTHOUSE_LAYOUT_VERSION,openedAtTick:s.worldTick};s.spatial.geometryRevision++;
 try{validateSpatial(s);}catch(error){if(before===undefined)delete s.spatial.guesthouse;else s.spatial.guesthouse=before;s.spatial.geometryRevision=revision;throw error;}
 return {enabled:true,alreadyEnabled:false,version:GUESTHOUSE_LAYOUT_VERSION};
}
export function enableEastServices(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('生活院扩展需要现行米制山院存档。');
 validateSpatial(s);
 if(domainServicesEnabled(s.spatial.eastServices?.version))return {enabled:true,alreadyEnabled:true,version:EAST_SERVICES_VERSION};
 if(!domainResidencesEnabled(s.spatial.eastResidences?.version))throw Error('先启用东侧住宅通路，再接生活院道路。');
 if(s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION)throw Error('先启用山院实景道路。');
 if(s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION)throw Error('生活院需要现行成人床位与室内布局。');
 const before=s.spatial.eastServices,revision=s.spatial.geometryRevision;
 s.spatial.eastServices={version:EAST_SERVICES_VERSION,openedAtTick:s.worldTick};s.spatial.geometryRevision++;
 try{validateSpatial(s);}catch(error){if(before===undefined)delete s.spatial.eastServices;else s.spatial.eastServices=before;s.spatial.geometryRevision=revision;throw error;}
 return {enabled:true,alreadyEnabled:false,version:EAST_SERVICES_VERSION};
}
export function enableCourtyardTerrain(s){
 if(!spatialEnabled(s)||!buildingGridEnabled(s))throw Error('首屏地形需要现行米制山院存档。');
 validateSpatial(s);
 if(s.spatial.courtyardTerrain?.version===COURTYARD_MASTER_TERRAIN_VERSION)return {enabled:true,alreadyEnabled:true,version:COURTYARD_MASTER_TERRAIN_VERSION};
 s.spatial.courtyardTerrain={version:COURTYARD_MASTER_TERRAIN_VERSION,activatedAtTick:s.worldTick};
 validateCourtyardTerrainRecord(s);
 s.spatial.geometryRevision++;
 for(const p of people(s)){
  const a=personPosition(s,p);if(!a)continue;
  if(!meterCanStand(s,a))throw Error(`首屏地面物件与现有人物位置冲突：${p.personId}，原存档保留。`);
  if(a.path?.length){const route=meterFindPath(s,a,a.goal||a.path.at(-1),{maxSnap:0});if(route===null)throw Error(`首屏地面物件使既有行程不可达：${p.personId}，原存档保留。`);a.path=route;}
  if(a.bodyYield?.path?.length){const route=meterFindPath(s,a,a.bodyYield.path.at(-1),{maxSnap:0});if(route===null)throw Error(`首屏地面物件使既有让行不可达：${p.personId}，原存档保留。`);a.bodyYield.path=route;}
  a.revision=spatialRevision(s);
 }
 validateSpatial(s);
 return {enabled:true,alreadyEnabled:false,version:COURTYARD_MASTER_TERRAIN_VERSION};
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
  for(let y=(bounds.y||0)+BUILDING_GRID.metres;y+d.height+1<=(bounds.y||0)+bounds.height-1;y+=BUILDING_GRID.metres)for(let x=(bounds.x||0)+BUILDING_GRID.metres;x+d.width<=(bounds.x||0)+bounds.width-1;x+=BUILDING_GRID.metres)points.push({x,y});
  return points.sort((a,b)=>distance(a,preferred)-distance(b,preferred)||a.y-b.y||a.x-b.x);
 };
 const placed=[];
 for(const b of s.buildings.slice().sort((a,b)=>(a.type==='hall'?-1:0)-(b.type==='hall'?-1:0)||a.id-b.id)){
  const old=oldById.get(b.instanceId),preferred={x:nearestCell(old.transform.x),y:nearestCell(old.transform.y)},view={...s,buildings:placed};
  const target=candidates(b.type,b.level,preferred).find(q=>!placementIssue(view,b.type,q.x,q.y,{level:b.level,checkPeople:false,checkReservations:false,connectionProof:migrationConnectionProof}));
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
  let target=['upgrade','establish','demolish'].includes(o.operation)&&source?source.transform:candidates(o.buildingType,o.targetLevel,preferred).find(q=>!placementIssue(s,o.buildingType,q.x,q.y,{level:o.targetLevel,ignoreId:source?.id,checkPeople:false,checkReservations:false}));
  if(!target)throw Error('单位格迁移无法保留在建事务的合法目标，原存档保留。');
  o.targetTransform={...target,orientation:'south'};if(source)o.sourceTransform={...source.transform};o.buildingGridVersion=BUILDING_GRID.version;
  a.transform={...o.targetTransform};a.target=o.operation==='build'?spatialAccess(layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})})):spatialAccess(source);
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
 s.stockpilesById[sourceId]=constructionStockpile(s,sourceId,o.operation==='establish'?'落脚处备好的主殿材料':'主屋预留施工材料',source,capacity,materials);
 s.stockpilesById[siteId]=constructionStockpile(s,siteId,'工地待用材料',a.target,capacity);
 o.materialFlow={version:CONSTRUCTION_MATERIAL_FLOW,sourceStockpileId:sourceId,siteStockpileId:siteId,phase:'to-source',cargo:{},carrierId:'person:master',trips:[],cancelRequested:false};
 s.master.scenic.path=sourceRoute;s.master.scenic.goal=sourceRoute.at(-1)||{x:source.x,y:source.y};
 s.master.action=sourceRoute.length?'walk':'rest';a.phase='moving';a.reason=o.operation==='establish'?'去落脚处取建殿的木石。':'前往主屋领取已预留的施工材料。';
}
function begin(s,operation,b,targetTransform){
 if(spatialConstruction(s)||s.master.activityId&&s.activitiesById[s.master.activityId]?.kind==='construction')throw Error('先完成或取消当前营造事务。');
 if(s.master.activityId&&s.activitiesById[s.master.activityId]?.kind!=='facility')throw Error('先完成或安全取消掌门当前身体事务，再开始营造。');
 if(s.master.location&&(s.master.location.kind!=='local'||s.master.location.sceneId!==SPATIAL_SCENE.id)||s.master.wound>0||s.master.energy<15||s.world?.exploration||s.master.journey||s.combat?.status==='active')throw Error('先归院养伤并恢复精力。');
 const def=BUILDINGS[b.type],targetLevel=operation==='upgrade'?b.level+1:b.level;if(targetLevel>def.max)throw Error('建筑已满级。');
 if(['relocate','demolish'].includes(operation)&&b.type==='hall')throw Error('主屋根基不可迁建或拆除。');
 if(operation==='build'&&domainSiteAt(b.type,targetTransform.x,targetTransform.y)?.northMeditation){const gate=meditationBuildView(s);if(!gate.available)throw Error(gate.reason);}
 if(['upgrade','relocate','demolish'].includes(operation)){
  const meditation=meditationBuildingChangeView(s,b,{operation});if(!meditation.available)throw Error(meditation.reason);
  if(Object.values(s.srCultivation?.orders||{}).some(o=>['study','teach','family-notes'].includes(o.kind)&&o.parameters?.preferredBuildingId===b.instanceId&&!['completed','cancelled'].includes(o.phase)))throw Error('先完成或中止阁内研读、整理与讲习，再调整藏经阁。');
  if(Object.values(s.workOrdersById||{}).some(o=>['sr-site-service','sr-site-meal'].includes(o.kind)&&o.targetId===b.instanceId&&!['completed','cancelled'].includes(o.phase)))throw Error('该设施仍有服务事务，请待其完成或安全取消后再营造。');
  const housing=residentialBuildingChangeView(s,b.instanceId||b.id,{operation});
  if(!housing.available)throw Error(housing.reason);
 }
 if(operation!=='build'){
  const sourceFootprint=spatialFootprint(b);
  for(const p of people(s)){
   if(p===s.master)continue;
   const q=personPosition(s,p),activity=s.activitiesById[p.activityId];
   if(q&&activity&&activity.kind!=='facility'&&polygonContains(q,sourceFootprint,.26))throw Error(`${p.name||p.personId}正在建筑内履行事务；请待其离开或明确取消事务后再改动。`);
  }
 }
 const existing=operation!=='build',level=b.level||1,cost=operation==='establish'?{...HALL_ESTABLISH_COST}:operation==='build'?{...def.cost}:operation==='upgrade'?{jade:45*level,wood:30*level,stone:20*level}:operation==='relocate'?{jade:10*level,wood:8*level}:{};
 const issue=operation==='demolish'?'':placementIssue(s,b.type,targetTransform.x,targetTransform.y,{ignoreId:existing?b.id:null,level:targetLevel,checkPeople:operation==='build'||operation==='relocate'});if(issue)throw Error(issue);
 if(operation==='demolish'){const capacity=(s.buildings||[]).reduce((n,v)=>n+(BUILDINGS[v.type].capacity||0)*v.level,0)-(def.capacity||0)*b.level;if(capacity<(s.homeMemberIds?.length||0))throw Error('拆除后床位不足，请先安排其他居所。');}
 const planned=layoutBuilding(s,{type:b.type,level:targetLevel,transform:targetTransform,...(b.serviceVersion?{serviceVersion:b.serviceVersion}:{})}),target=operation==='relocate'||!existing?spatialAccess(planned):spatialAccess(b),route=meterFindPath(s,s.master.scenic,target,{maxSnap:0});if(route===null)throw Error('掌门无法实际抵达工地入口。');
 const orderId=`work:construction:${b.id}`,workSlots=constructionWorkSlots(s,orderId,planned);if(!workSlots.length)throw Error('工地入口旁没有可达的施工执行位，请另选位置。');
 const materials=constructionMaterials(cost),source=s.stockpilesById['stockpile:yunxiu']?.position||{sceneId:SPATIAL_SCENE.id,...spatialAccess(s.buildings.find(v=>v.type==='hall'))},sourceRoute=Object.keys(materials).length?meterFindPath(s,s.master.scenic,source,{maxSnap:0}):null;
 if(Object.keys(materials).length&&sourceRoute===null)throw Error('掌门无法实际抵达主屋施工材料存放处。');
 pay(s,cost);releaseBodyActivity(s,s.master);const id=b.id,activityId=`activity:build:${id}`,reservationId=`reservation:build:${id}`;
 const a={id:activityId,kind:'construction',personId:'person:master',phase:route.length?'moving':'working',operation,type:b.type,x:b.x,y:b.y,buildingId:id,instanceId:`building:yunxiu:${id}`,transform:targetTransform,target,workOrderId:orderId,reservationId};
 const o={id:orderId,kind:'construction',spatial:true,operation,targetId:a.instanceId,buildingType:b.type,targetLevel,targetTransform,sourceTransform:existing?{...b.transform}:null,phase:'active',progressTicks:0,durationTicks:operation==='build'||operation==='establish'?200:operation==='upgrade'?240:operation==='relocate'?180:120,activityIds:[activityId],reservationId,usedCost:{},evacuations:[],workSlots,workSlotGeometryRevision:s.spatial.geometryRevision};
 const site=domainSiteAt(b.type,targetTransform.x,targetTransform.y);if(site)o.domainSiteId=site.id;if(b.serviceVersion)o.serviceVersion=b.serviceVersion;
 s.activitiesById[activityId]=a;s.workOrdersById[orderId]=o;s.reservationsById[reservationId]={id:reservationId,activityId,kind:'construction-material',cost};s.master.activityId=activityId;s.master.scenic.path=route;s.master.scenic.goal=route.at(-1)||null;s.master.action=route.length?'walk':'rest';setupConstructionMaterials(s,a,o,cost,sourceRoute);if(existing)b.spatialLock=orderId;
 log(s,operation==='establish'?'主殿开始营造，材料正运往工地。':`${def.name}已登记${operation==='build'?'营造':operation==='upgrade'?'升级':operation==='relocate'?'迁建':'拆除'}，须到场并安全撤离使用者。`);return {id,operation,pending:true,activityId,workOrderId:orderId,transform:targetTransform};
}
export const handlers={
 enableSectDomain,
 enableGuesthouse,
 enableWestValley,
 enableEastResidences,
 enableEastServices,
 enableNorthLibrary,
 enableNorthMeditation,
 enableWestWorkshops,
 enableCourtyardTerrain,
 buildDomainSite(s,siteId){
  if(!domainExtentEnabled(s.spatial?.extentVersion))throw Error('先启用山域通路与营造地。');
  const site=SECT_DOMAIN.sites.find(value=>value.id===siteId);if(!site)throw Error(SECT_DOMAIN.plannedSites.some(value=>value.id===siteId)?'此处尚在规划，场地与经营功能待接入。':'营造地不存在。');
  if(site.x<0&&!domainWestEnabled(s.spatial.extentVersion))throw Error('先启用西林通路。');
  if(site.extentVersion===DOMAIN_VALLEY_EXTENT_VERSION&&!domainValleyEnabled(s.spatial.extentVersion))throw Error('先启用西谷通路。');
  if(site.westWorkshops&&!domainWestWorkshopsEnabled(s.spatial.westWorkshops?.version))throw Error('先启用西谷双院通路。');
  if(site.northMeditation&&!domainNorthMeditationEnabled(s.spatial.northMeditation?.version))throw Error('先启用聚灵台地通路。');
  if(site.northLibrary&&!domainNorthLibraryEnabled(s.spatial.northLibrary?.version))throw Error('先启用北台藏经阁通路。');
  if(site.guesthouse&&!guesthouseGroundEnabled(s))throw Error('先启用客院台地通路。');
  if(site.services&&!domainServicesEnabled(s.spatial.eastServices?.version))throw Error('先启用东台生活院通路。');
  if(site.residences&&!domainResidencesEnabled(s.spatial.eastResidences?.version))throw Error('先启用东侧住宅通路。');
  const result=handlers.build(s,site.type,site.x,site.y);
  s.workOrdersById[result.workOrderId].domainSiteId=site.id;
  return {...result,siteId:site.id};
 },
 establishHall(s){
  if(s.story?.opening?.hallPhase!=='shelter')throw Error('主殿营造已安排。');
  const hall=s.buildings.find(b=>b.type==='hall');if(!hall)throw Error('主殿地基未找到。');
  const result=begin(s,'establish',hall,{...hall.transform});s.story.opening.hallPhase='building';return result;
 },
 build(s,type,x,y){if(!BUILDINGS[type])throw Error('建筑不存在。');if(BUILDINGS[type].unique&&s.buildings.some(b=>b.type===type))throw Error('该设施只能建一处。');const b=layoutBuilding(s,{id:s.nextId,type,x,y,level:1,...(domainServicesEnabled(s.spatial?.eastServices?.version)&&domainSiteAt(type,x,y)?.services?{serviceVersion:SITE_SERVICE_VERSION}:{})});const result=begin(s,'build',b,{x,y,orientation:'south'});s.nextId++;return result;},
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
 if(['mutual-corridor','requester-clear','transport-retreat'].includes(a.bodyYield?.kind))return false;
 budget*=COURTYARD_WALK_RATE;
 const revision=spatialRevision(s);
 if(a.path?.length&&a.revision!==revision){
  const goal=a.goal||a.path.at(-1),northTrip=domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)&&(a.y<0||goal?.y<0||courtyardNorthLibraryPassage(a,goal));
  if(northTrip||!routeStillClear(s,a,a.path))a.path=meterFindPath(s,a,goal,{maxSnap:0})||[];
  a.revision=revision;
  if(!a.path.length)return false;
 }
 let detours=0;while(a.path?.length&&budget>.001){const q=a.path[0],d=distance(a,q);if(d<.001){a.path.shift();continue;}const n=Math.min(d,budget),to={x:a.x+(q.x-a.x)*n/d,y:a.y+(q.y-a.y)*n/d},r=meterSweep(s,a,to);if(r.blocked){a.path=[];return false;}if(!meterDoorPermit(s,a,a,a.path,to))return false;const blocker=meterBodyBlocker(s,a,a,to);if(blocker){const detour=detours<2&&meterLocalBodyDetour(s,a,a,a.path);if(detour){a.path=detour;detours++;continue;}requestBodyYield(s,a,blocker,a.path);a.waitingForPersonId=blocker.personId;return false;}delete a.waitingForPersonId;a.facing=to.x<a.x?-1:1;a.back=to.y<a.y;a.x=r.x;a.y=r.y;a.steps=(a.steps||0)+n;budget-=n;if(n>=d-.001)a.path.shift();meterDoorMoved(s,a);}return !a.path?.length;
}
function pruneBodyYields(s,{releaseStale=false}={}){for(const p of Object.values(s.personsById||{})){const a=personPosition(s,p),yielding=a?.bodyYield;if(!yielding)continue;const local=people(s).includes(p),queue=yielding.kind==='door-wait'&&doorRecord(s,p),activity=s.activitiesById[p.activityId],staleActivity=yielding.kind==='mutual-corridor'&&(yielding.activityId!==undefined&&yielding.activityId!==(p.activityId??null)||yielding.activityStartedTick!==undefined&&yielding.activityStartedTick!==activity?.startedTick||activity?.startedTick>yielding.startedTick),canPause=yielding.kind==='mutual-corridor'&&(facilityTraveller(activity)||cultivationTraveller(s,p)||craftTraveller(s,p)||constructionTraveller(activity)||transportTraveller(s,p))||yielding.kind==='transport-retreat'&&transportRetreatOwner(s,p,yielding),entranceClear=yielding.kind==='entrance-clear'&&stationlessFacilityWaiter(s,p),yielder=yielding.kind==='requester-clear'&&s.personsById[yielding.forYieldPersonId],yielderAt=yielder&&personPosition(s,yielder),requesterClear=!!(yielderAt?.bodyYield?.kind==='mutual-corridor'&&(yielderAt.bodyYield.requestedBy===p.personId||transportRetreatOwner(s,p)&&constructionTraveller(s.activitiesById[yielder.activityId])&&activity?.workOrderId===s.activitiesById[yielder.activityId]?.workOrderId));if(!local||releaseStale&&staleActivity||a.spatialEvacuationOrderId||!s.personsById[yielding.requestedBy]||yielding.kind==='door-wait'&&!queue?.waiting.some(w=>w.personId===p.personId)||yielding.kind!=='door-wait'&&p.activityId&&!canPause&&!entranceClear&&!requesterClear)delete a.bodyYield;}}
// An empty yield path retains this step's body ownership; the next step releases it.
// A temporary retreat may no longer clear collision from the current body
// position. Replan that retreat while retaining the original task and slot.
function recoverStaticBodyYield(s,a,yielding){
 const path=meterFindPath(s,a,yielding.target,{maxSnap:0});
 const valid=path&&path.length&&path.length<=24&&visibleBodyRouteClear(s,a,path)&&(!domainNorthLibraryEnabled(s.spatial?.northLibrary?.version)||northLibraryLocalBypassClear(a,path))&&!doorCrossing(s,a,path,yielding.target)&&path.every((end,i)=>!meterSweep(s,i?path[i-1]:a,end).blocked);
 if(valid)yielding.path=path;else delete a.bodyYield;
}
function tickBodyYields(s){pruneBodyYields(s,{releaseStale:true});for(const p of people(s)){const a=personPosition(s,p),yielding=a?.bodyYield;if(!yielding||transportTraveller(s,p)&&p.energy<5)continue;const next=yielding.path[0];if(!next){if(yielding.kind==='transport-retreat'){if(yielding.returnPath.slice(0,yielding.returnPrefixLength).some((q,i)=>meterBodyBlocker(s,a,i?yielding.returnPath[i-1]:a,q)))continue;a.path=yielding.returnPath;}delete a.bodyYield;continue;}const d=distance(a,next);if(d<.001){yielding.path.shift();if(!yielding.path.length&&yielding.kind!=='transport-retreat')delete a.bodyYield;continue;}const n=Math.min(.13*COURTYARD_WALK_RATE,d),to={x:a.x+(next.x-a.x)*n/d,y:a.y+(next.y-a.y)*n/d},blocker=meterBodyBlocker(s,a,a,to),staticBlocked=meterSweep(s,a,to).blocked;if(!staticBlocked&&!blocker&&visibleBodyRouteClear(s,a,[to])){a.facing=to.x<a.x?-1:1;a.back=to.y<a.y;a.x=to.x;a.y=to.y;a.steps=(a.steps||0)+n;if(transportTraveller(s,p)){p.energy=Math.max(0,p.energy-.01);transportMovementTicks.set(p,s.worldTick);}if(n>=d-.001)yielding.path.shift();syncPosition(s,p);if(p.location?.kind==='local'&&p.location.sceneId===SPATIAL_SCENE.id){p.location.x=a.x;p.location.y=a.y;}if(a.goal&&a.path?.length&&meterSweep(s,a,a.path[0]).blocked)a.path=meterFindPath(s,a,a.goal,{maxSnap:0})||[];}else if(staticBlocked&&yielding.kind==='mutual-corridor')recoverStaticBodyYield(s,a,yielding);else if(!visibleBodyRouteClear(s,a,[to]))delete a.bodyYield;
 else if(blocker&&yielding.kind==='mutual-corridor'&&(blocker.personId===yielding.requestedBy||blocker===s.master&&transportRetreatOwner(s,blocker)&&constructionTraveller(s.activitiesById[p.activityId])&&s.activitiesById[p.activityId]?.workOrderId===s.activitiesById[blocker.activityId]?.workOrderId)&&!yielding.requesterClearTried){yielding.requesterClearTried=true;const requester=blocker,retreat=requester&&findRequesterClear(s,a,to,requester,yielding.path);if(retreat){const requesterAt=personPosition(s,requester);requesterAt.bodyYield={kind:'requester-clear',requestedBy:p.personId,forYieldPersonId:p.personId,...(craftTraveller(s,requester)?{activityId:requester.activityId,workOrderId:s.activitiesById[requester.activityId].workOrderId}:{}),...(manualWalkRetreatOwner(s,requester)?{manualWalk:true,originalGoal:{...requesterAt.goal}}:{}),startedTick:s.worldTick,target:retreat.at,path:retreat.path};}}}}
const materialTotal=resources=>Object.values(resources).reduce((sum,quantity)=>sum+quantity,0);
function constructionRefund(o,r){return Object.fromEntries(Object.entries(r.cost).map(([k,v])=>[k,v-(o.usedCost[k]||0)]));}
function finishConstructionCancellation(s,a,o){
 const r=s.reservationsById[a.reservationId],refund=constructionRefund(o,r),flow=o.materialFlow;
 if(flow){const source=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];if(materialTotal(flow.cargo)||materialTotal(site.resources))throw Error('工地未用材料尚需实际返程。');for(const[k,v]of Object.entries(constructionMaterials(r.cost)))if(source.resources[k]!==refund[k])throw Error('施工退料位置与剩余数量不一致。');}
 grant(s,refund);const b=s.buildingsById?.[a.instanceId]||s.buildings.find(v=>v.id===a.buildingId);if(b)delete b.spatialLock;
 if(o.operation==='establish')s.story.opening.hallPhase='shelter';
 s.spatial.completedOrders.push({id:o.id,operation:o.operation,phase:'cancelled',progressTicks:o.progressTicks,usedCost:{...o.usedCost},refund,sourceTransform:o.sourceTransform,targetTransform:o.targetTransform,materialTrips:flow?.trips||[],tick:s.worldTick,...(o.domainSiteId?{domainSiteId:o.domainSiteId}:{})});cleanup(s,a);return {refund,usedCost:o.usedCost};
}
function requestConstructionCancellation(s,a,o){
 for(const id of [...o.activityIds]){const helper=s.activitiesById[id];if(helper?.kind==='sr-construction')releaseConstructionHelper(s,o,helper);}
 for(const slot of o.workSlots||[]){slot.occupantId=null;slot.firstArrivalTick=null;}
 a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;a.phase='moving';
 const flow=o.materialFlow,r=s.reservationsById[o.reservationId],refund=constructionRefund(o,r);
 if(!flow.cancelRequested){flow.cancelRequested=true;flow.phase=materialTotal(flow.cargo)?'returning':'recover-site';a.reason=o.operation==='establish'?'把剩余木石带回落脚处。':'收回未用材料，实际带回主屋后结清退款。';}
 if(!materialTotal(flow.cargo)&&!materialTotal(s.stockpilesById[flow.siteStockpileId].resources))return finishConstructionCancellation(s,a,o);
 return {pending:true,refund,usedCost:{...o.usedCost}};
}
function constructionWarehouseRoute(s,from,target){
 const direct=meterFindPath(s,from,target,{maxSnap:0});if(direct!==null)return direct;
 // Rejoin the measured road near a legal stance before rebuilding the warehouse route.
 const joins=COURTYARD_EAST_ROAD.filter(at=>distance(from,at)<=1).sort((a,b)=>distance(from,a)-distance(from,b));
 for(const at of joins){
  if(!meterCanStand(s,at)||meterSweep(s,from,at).blocked||!visibleBodyRouteClear(s,from,[at]))continue;
  const onward=meterFindPath(s,at,target,{maxSnap:0});if(onward!==null&&visibleBodyRouteClear(s,at,onward))return [{x:at.x,y:at.y},...onward];
 }
 return null;
}
function constructionWarehouseContact(s,from,stockPosition){
 const clear=at=>meterCanStand(s,at)&&!people(s).some(p=>p!==s.master&&personPosition(s,p)&&distance(personPosition(s,p),at)<.53);
 if(clear(stockPosition)&&constructionWarehouseRoute(s,from,stockPosition)!==null)return stockPosition;
 const candidates=[];for(let y=snap(stockPosition.y);y<=snap(stockPosition.y+1.25);y+=.5)for(let x=snap(stockPosition.x-1.25);x<=snap(stockPosition.x+1.25);x+=.5){const at={x,y},offset=distance(at,stockPosition);if(y>=stockPosition.y&&offset<=1.25&&clear(at))candidates.push({at,offset});}
 candidates.sort((a,b)=>a.offset-b.offset||a.at.y-b.at.y||a.at.x-b.at.x);
 return candidates.find(({at})=>constructionWarehouseRoute(s,from,at)!==null)?.at||null;
}
function moveConstructionCarrier(s,a,point,reason,{warehouse=false}={}){
 const sc=s.master.scenic,retained=warehouse&&sc.path?.length&&sc.goal&&distance(sc.goal,point)<=1.25&&meterCanStand(s,sc.goal)&&visibleBodyRouteClear(s,sc,sc.path),contact=retained?sc.goal:warehouse?constructionWarehouseContact(s,sc,point):point;if(!contact){sc.path=[];sc.goal=null;s.master.action='rest';a.phase='blocked';a.reason='主屋材料仓周围没有身体可达的取料脚点；货物与进度保留。';return false;}
 if(distance(sc,contact)<=.1){sc.path=[];sc.goal={x:contact.x,y:contact.y};s.master.action='rest';return true;}
 if(!sc.goal||distance(sc.goal,contact)>.01||!sc.path?.length){const route=warehouse?constructionWarehouseRoute(s,sc,contact):meterFindPath(s,sc,contact,{maxSnap:0});if(route===null){sc.path=[];sc.goal=null;s.master.action='rest';a.phase='blocked';a.reason='施工材料通路受阻，保留所在位置与数量，等待通路恢复。';return false;}sc.path=route;sc.goal={x:contact.x,y:contact.y};}
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
   if(!moveConstructionCarrier(s,a,source.position,o.operation==='establish'?'带木石回落脚处。':'携未用材料返回主屋。',{warehouse:true}))return true;
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
  if(!moveConstructionCarrier(s,a,source.position,o.operation==='establish'?'去落脚处取建殿的木石。':'前往主屋领取已预留的施工材料。',{warehouse:true}))return true;
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
function evacuationDestination(s,p,q,b,o,poly,polys=[poly]){
 const future=['upgrade','establish'].includes(o.operation)?layoutBuilding(s,{type:b.type,level:o.targetLevel,transform:o.targetTransform,...(b.serviceVersion?{serviceVersion:b.serviceVersion}:{})}):b,entry=spatialAccess(future);
 for(let n=0;n<40;n++){const offset=n===0?0:(n%2?1:-1)*Math.ceil(n/2)*.75,target={x:entry.x+offset,y:entry.y+1};
  if(polys.some(polygon=>polygonContains(target,polygon,.26))||!meterCanStand(s,target)||people(s).some(other=>other!==p&&personPosition(s,other)&&distance(personPosition(s,other),target)<.53)||o.evacuations.some(e=>e.personId!==p.personId&&e.destination&&distance(e.destination,target)<.53))continue;
  const route=meterFindPath(s,q,target,{maxSnap:0});if(route!==null)return {destination:target,route};
 }
 return null;
}
function evacuate(s,b,o){
 delete o.waitingReason;const future=['upgrade','establish'].includes(o.operation)?layoutBuilding(s,{type:b.type,level:o.targetLevel,transform:o.targetTransform,...(b.serviceVersion?{serviceVersion:b.serviceVersion}:{})}):b,poly=spatialFootprint(future),polys=[poly,...spatialExteriorSolids(future).map(solid=>solid.polygon)];let waiting=false;
 for(const p of people(s)){if(p===s.master)continue;const q=personPosition(s,p);let a=s.activitiesById[p.activityId];const inUse=a?.targetId===b.instanceId;
  if(!q||!polys.some(polygon=>polygonContains(q,polygon,.26))&&!inUse){if(q?.spatialEvacuationOrderId===o.id)delete q.spatialEvacuationOrderId;continue;}
  // Domain-owned jobs retain materials, items and orders until their owner has
  // completed or explicitly cancelled them. Construction cannot discard cargo.
  if(a?.kind==='sr-construction'&&a.workOrderId===o.id){releaseConstructionHelper(s,o,a);a=null;}
  if(a&&a.kind!=='facility'){waiting=true;o.waitingReason=`等待${p.name||p.personId}结束当前事务；其材料与进度保持。`;continue;}
  let evacuation=o.evacuations.find(e=>e.personId===p.personId);
  if(!evacuation){evacuation={personId:p.personId,activityId:p.activityId||null,action:a?.action||null,reason:'建筑改动，安全结束当前使用并沿门道撤离'};o.evacuations.push(evacuation);releaseBodyActivity(s,p);p.activityId=null;if(p.mind){p.mind.activity='rest';p.mind.reason='正在撤离改动中的设施，原任务进度保留。';p.mind.commitUntil=0;}delete q.activitySlotId;}
  q.spatialEvacuationOrderId=o.id;
  if(!q.path?.length){const exit=evacuationDestination(s,p,q,b,o,poly,polys);if(!exit){waiting=true;continue;}evacuation.destination=exit.destination;q.path=exit.route;q.goal={...exit.destination};}
  moveActor(s,q,.13);syncPosition(s,p);if(polys.some(polygon=>polygonContains(q,polygon,.26)))waiting=true;else{delete q.spatialEvacuationOrderId;q.path=[];q.goal=null;}
 }
 return !waiting;
}
function constructionVolunteer(s,p){
 const m=p.mind,sc=m?.scenic,trust=m?.relationships?.master?.trust??55;
 if(!s.homeMemberIds?.includes(p.personId)||p.lifeStatus==='dead'||p.activityId||p.job!=null||m?.activity!=='rest'||m?.away||m?.journey||sc?.spatialEvacuationOrderId||!sc||(p.location?.sceneId??p.position?.sceneId??SPATIAL_SCENE.id)!==SPATIAL_SCENE.id||p.wound>CONSTRUCTION_INJURY_LIMIT||p.energy<CONSTRUCTION_ENERGY_MIN||m.satiety<22||trust<15||p.schedule?.aftermath?.untilTick>s.worldTick)return false;
 return (m.traits?.[3]??60)*.3+(m.traits?.[0]??55)*.1+trust*.4>=42;
}
function constructionEntry(s,a,o){return ['upgrade','establish'].includes(o.operation)?spatialAccess(layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})})):a.target;}
function constructionApproachSlot(s,o,activity,masterAvailable=true){
 if(!activity)return null;
 const waiting=o.activityIds.map(id=>s.activitiesById[id]).filter(participant=>participant&&!participant.slotId&&(participant.personId!=='person:master'||masterAvailable));
 if(!waiting.some(participant=>participant.id===activity.id))waiting.push(activity);
 const reserved=new Set(),bodies=people(s);
 for(const participant of waiting){
  const slot=o.workSlots.find(slot=>!slot.occupantId&&!reserved.has(slot.id)&&!bodies.some(other=>other.personId!==participant.personId&&personPosition(s,other)&&distance(personPosition(s,other),slot.position)<.53));
  if(slot)reserved.add(slot.id);
  if(participant.id===activity.id)return slot||null;
 }
 return null;
}
function recruitConstructionHelpers(s,a,o,masterAvailable){
 if(o.materialFlow?.cancelRequested)return;
 const source=s.buildingsById?.[o.targetId],future=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})}),evacuationFootprint=['upgrade','establish'].includes(o.operation)?spatialFootprint(future):source&&o.operation!=='build'?spatialFootprint(source):null;
 let helpers=o.activityIds.filter(id=>s.activitiesById[id]?.kind==='sr-construction').length;
 for(const p of people(s).filter(p=>p!==s.master).sort((x,y)=>x.personId.localeCompare(y.personId))){
  if(['upgrade','establish'].includes(o.operation)?o.activityIds.length>=o.workSlots.length:helpers>=o.workSlots.length)break;
  if(evacuationFootprint&&personPosition(s,p)&&polygonContains(personPosition(s,p),evacuationFootprint,.26))continue;
  if(!constructionVolunteer(s,p))continue;
  const id=`activity:construction:${a.buildingId}:${p.personId}`;
  if(s.activitiesById[id])continue;
  const sc=personPosition(s,p),entry=constructionEntry(s,a,o),approach=constructionApproachSlot(s,o,{id,personId:p.personId,slotId:null},masterAvailable),target=approach?.position||entry;
  if(['upgrade','establish'].includes(o.operation)&&!approach)continue;
  const route=meterFindPath(s,sc,target,{maxSnap:0});if(route===null)continue;
  s.activitiesById[id]={id,kind:'sr-construction',personId:p.personId,workOrderId:o.id,instanceId:o.targetId,buildingId:a.buildingId,phase:'moving',slotId:null,firstArrivalTick:null,originalMindActivity:p.mind.activity,startedTick:s.worldTick,reason:'自愿前往工地施工。'};
  o.activityIds.push(id);p.activityId=id;p.mind.reason='自愿参与当前工地，须实际到达排他施工位。';sc.path=route;sc.goal={...target};helpers++;
 }
}
function constructionParticipantReady(s,p,activity,a,approach=null){
 const sc=personPosition(s,p);if(!sc)return false;
 const order=s.workOrdersById[activity.workOrderId],entry=activity.slotId?null:constructionEntry(s,a,order),slot=activity.slotId&&order?.workSlots?.find(x=>x.id===activity.slotId),target=slot?.position||approach?.position||entry;
 if(!target||['upgrade','establish'].includes(order.operation)&&!activity.slotId&&!approach){activity.phase='blocked';activity.reason='等待空闲施工位。';sc.path=[];sc.goal=null;return false;}
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
function tickConstructionCrew(s,a,o,r,{masterAvailable,canWork,siteClear}){
 if(!siteClear){
  const sc=s.master.scenic;
  // The entrance must remain clear while its users leave. Waiting at an
  // available construction slot lets the master walk aside before work starts.
  const waitingAt=['upgrade','establish'].includes(o.operation)?constructionApproachSlot(s,o,a,masterAvailable)?.position:constructionEntry(s,a,o);
  if(masterAvailable&&waitingAt&&distance(sc,waitingAt)>.1){
   if(!sc.goal||distance(sc.goal,waitingAt)>.01||!sc.path?.length){const route=meterFindPath(s,sc,waitingAt,{maxSnap:0});if(route!==null){sc.path=route;sc.goal={...waitingAt};}}
   if(sc.path?.length){moveActor(s,sc,.144);syncPosition(s,s.master);s.master.action='walk';}
  }
  return;
 }
 if(canWork)delete o.waitingReason;
 if(o.workSlotGeometryRevision!==s.spatial.geometryRevision){
  const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})}),slots=constructionWorkSlots(s,o.id,planned);
  if(!slots.length){o.waitingReason='几何变化后工地没有安全执行位，保留进度与材料。';canWork=false;}
  else{for(const id of o.activityIds){const personActivity=s.activitiesById[id];if(personActivity){personActivity.slotId=null;personActivity.slotArrived=false;personActivity.phase='moving';}}o.workSlots=slots;o.workSlotGeometryRevision=s.spatial.geometryRevision;}
 }
 const masterSlot=o.workSlots.find(q=>q.id===a.slotId),masterPosition=personPosition(s,s.master);
 if(a.slotArrived&&(!masterSlot||!masterPosition||distance(masterPosition,masterSlot.position)>.53)){if(masterSlot?.occupantId==='person:master'){masterSlot.occupantId=null;masterSlot.firstArrivalTick=null;}a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;}
 for(const id of [...o.activityIds]){const activity=s.activitiesById[id];if(activity?.kind!=='sr-construction')continue;const p=s.personsById[activity.personId],slot=o.workSlots.find(q=>q.id===activity.slotId),sc=p&&personPosition(s,p);if(!p||p.activityId!==id||p.lifeStatus==='dead'||p.left||p.job!=null||p.mind?.activity!==activity.originalMindActivity||p.mind?.away||p.mind?.journey||(p.location?.sceneId??p.position?.sceneId??SPATIAL_SCENE.id)!==SPATIAL_SCENE.id||p.wound>CONSTRUCTION_INJURY_LIMIT||p.energy<8||activity.slotArrived&&(!slot||!sc||distance(sc,slot.position)>.53)){releaseConstructionHelper(s,o,activity);}}
 if(['upgrade','establish'].includes(o.operation)){
  let excess=o.activityIds.length-o.workSlots.length;
  for(const id of [...o.activityIds].slice(1).reverse()){
   if(excess<=0)break;
   const activity=s.activitiesById[id];
   if(activity?.kind==='sr-construction'&&!activity.slotId){releaseConstructionHelper(s,o,activity);excess--;}
  }
 }
 if(masterAvailable&&(s.master.wound>CONSTRUCTION_INJURY_LIMIT||s.master.energy<5)){const slot=o.workSlots.find(q=>q.occupantId==='person:master');if(slot){slot.occupantId=null;slot.firstArrivalTick=null;}a.slotId=null;a.slotArrived=false;a.firstArrivalTick=null;a.phase='blocked';a.reason='掌门受伤或精力不足，原地休整；施工进度保留。';s.master.action='rest';s.master.energy=Math.min(100,s.master.energy+.3);s.master.wound=Math.max(0,s.master.wound-.035);masterAvailable=false;}
 recruitConstructionHelpers(s,a,o,masterAvailable);
 const participants=o.activityIds.map(id=>s.activitiesById[id]).filter(Boolean);
 for(const activity of participants)if((activity===a?masterAvailable:true)&&!activity.slotId){
  if(['upgrade','establish'].includes(o.operation)&&activity.firstArrivalTick!==null&&activity.firstArrivalTick!==undefined){const position=personPosition(s,s.personsById[activity.personId]);if(!position||!o.workSlots.some(slot=>distance(position,slot.position)<=.1))activity.firstArrivalTick=null;}
  constructionParticipantReady(s,s.personsById[activity.personId],activity,a,constructionApproachSlot(s,o,activity,masterAvailable));
 }
 const arrivals=participants.filter(activity=>(activity===a?masterAvailable:true)&&!activity.slotId&&activity.firstArrivalTick!==null&&activity.firstArrivalTick!==undefined).sort((x,y)=>x.firstArrivalTick-y.firstArrivalTick||x.personId.localeCompare(y.personId));
 for(const activity of arrivals){const position=personPosition(s,s.personsById[activity.personId]),slot=o.workSlots.find(q=>!q.occupantId&&(!['upgrade','establish'].includes(o.operation)||position&&distance(position,q.position)<=.1)&&!people(s).some(p=>p.personId!==activity.personId&&personPosition(s,p)&&distance(personPosition(s,p),q.position)<.53));if(!slot){activity.phase='blocked';activity.reason='等待空闲施工位，保留到达顺序。';continue;}slot.occupantId=activity.personId;slot.firstArrivalTick=activity.firstArrivalTick;activity.slotId=slot.id;activity.slotArrived=false;activity.phase='moving';}
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
 if(o.workSlots){const carrying=carryConstructionMaterials(s,a,o);if(!s.workOrdersById[o.id]||o.materialFlow?.cancelRequested)return;if(o.progressTicks<o.durationTicks){const siteClear=!source||((!carrying||['upgrade','establish'].includes(o.operation))&&evacuate(s,source,o)),canWork=!carrying&&siteClear;tickConstructionCrew(s,a,o,r,{masterAvailable:!carrying,canWork,siteClear});if(!siteClear&&!carrying){a.phase='blocked';a.reason=o.waitingReason||'等待使用者沿门道撤离到新占地之外。';}if(o.progressTicks<o.durationTicks)return;}}
 else{
 if(carryConstructionMaterials(s,a,o))return;
 if(a.phase==='moving'){const arrived=moveActor(s,s.master.scenic,.144);syncPosition(s,s.master);if(!arrived)return;if(distance(s.master.scenic,a.target)>.1){s.master.scenic.path=meterFindPath(s,s.master.scenic,a.target,{maxSnap:0})||[];a.phase='blocked';a.reason='通往工地的路径受阻，等待安全路线。';return;}a.phase='working';s.master.action='rest';}
 if(source&&!evacuate(s,source,o)){a.phase='blocked';a.reason=o.waitingReason||'等待使用者沿门道撤离到新占地之外。';return;}
 if(o.progressTicks<o.durationTicks){if(distance(s.master.scenic,a.target)>.1){a.phase='moving';s.master.scenic.path=meterFindPath(s,s.master.scenic,a.target,{maxSnap:0})||[];return;}a.phase='working';const next=o.progressTicks+1,site=o.materialFlow&&s.stockpilesById[o.materialFlow.siteStockpileId];if(site)for(const[k,v]of Object.entries(constructionMaterials(r.cost))){const amount=Math.floor(v*next/o.durationTicks)-(o.usedCost[k]||0);if(site.resources[k]+1e-9<amount){a.phase='blocked';a.reason='工地材料尚未实际到场，保留施工进度。';return;}}o.progressTicks=next;s.master.energy=Math.max(0,s.master.energy-.015);for(const [k,v]of Object.entries(r.cost)){const used=Math.floor(v*o.progressTicks/o.durationTicks),delta=used-(o.usedCost[k]||0);if(site&&k!=='jade')site.resources[k]-=delta;o.usedCost[k]=used;}}
 if(o.progressTicks<o.durationTicks)return;
 }
 const future=layoutBuilding(s,{instanceId:o.targetId,type:a.type,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})});
 if(source){for(const id of [...o.activityIds]){const helper=s.activitiesById[id],person=helper&&s.personsById[helper.personId],position=person&&personPosition(s,person);if(helper?.kind==='sr-construction'&&position&&polygonContains(position,spatialFootprint(['upgrade','establish'].includes(o.operation)?future:source),.26))releaseConstructionHelper(s,o,helper);}if(!evacuate(s,source,o)){a.phase='blocked';a.reason=o.waitingReason||'等待工地人员安全撤离。';return;}}
 if(o.operation!=='demolish'){for(const id of [...o.activityIds]){const helper=s.activitiesById[id],person=helper&&s.personsById[helper.personId],position=person&&personPosition(s,person);if(helper?.kind==='sr-construction'&&position&&polygonContains(position,spatialFootprint(future),.26))releaseConstructionHelper(s,o,helper);}if(!evacuate(s,future,o)){a.phase='blocked';a.reason=o.waitingReason||'等待目标占地人员安全撤离。';return;}}
 if(o.operation==='upgrade'&&polygonContains(s.master.scenic,spatialFootprint(future),.26)){const safe=spatialAccess(future);if(!s.master.scenic.path?.length)s.master.scenic.path=meterFindPath(s,s.master.scenic,safe,{maxSnap:0})||[];s.master.scenic.goal=safe;moveActor(s,s.master.scenic,.144);syncPosition(s,s.master);a.phase='blocked';a.reason='掌门沿门道撤离扩建范围，安全后切换占地。';s.master.action='walk';return;}
 if(o.operation==='demolish'){
  const remainingCapacity=s.buildings.reduce((n,b)=>n+(BUILDINGS[b.type].capacity||0)*b.level,0)-(BUILDINGS[source.type].capacity||0)*source.level;
  if(remainingCapacity<(s.homeMemberIds?.length||0)){a.phase='blocked';a.reason='拆除后床位不足，请先安排其他居所。';o.waitingReason=a.reason;return;}
 }
 const issue=o.operation==='demolish'?'':placementIssue(s,a.type,o.targetTransform.x,o.targetTransform.y,{ignoreId:source?.id,level:o.targetLevel,checkReservations:false,checkPreset:false});if(issue){a.phase='blocked';a.reason=issue;return;}
 if(o.operation==='build'){const b=layoutBuilding(s,{id:a.buildingId,instanceId:a.instanceId,type:a.type,x:a.x,y:a.y,transform:{...o.targetTransform},prefabId:prefabId(future),sceneId:SPATIAL_SCENE.id,level:1,progress:0,condition:100,enabled:true,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})});const site=domainSiteAt(b.type,b.transform.x,b.transform.y);if(site)b.domainSiteId=site.id;s.buildings.push(b);if(b.serviceVersion){const id=`fact:site-service:${b.instanceId}`;s.factsById[id]={id,kind:'site-service-commissioned',buildingId:b.instanceId,siteId:b.domainSiteId,version:b.serviceVersion,atTick:s.worldTick};const stockId=`stockpile:${b.instanceId}`;s.stockpilesById[stockId]={id:stockId,ownerId:'person:master',custodianId:'person:master',access:'public',buildingId:b.instanceId,position:{sceneId:SPATIAL_SCENE.id,...spatialAccess(b)},capacity:320,resources:emptyResources()};}if(site?.northMeditation){commissionMeditationBuilding(s,b);const id=`stockpile:${b.instanceId}`;s.stockpilesById[id]={id,ownerId:'person:master',custodianId:'person:master',access:'public',buildingId:b.instanceId,position:{sceneId:SPATIAL_SCENE.id,...spatialAccess(b)},capacity:80,resources:emptyResources(),pills:{qi:0,spirit:0,heal:0,foundation:0}};}s.stats.built++;}
 else if(o.operation==='demolish'){finishMeditationBuildingChange(s,source,'demolish',source.level);finalizeBuildingChange(s,source,'demolish');const refund={};for(const [k,v]of Object.entries(BUILDINGS[source.type].cost))refund[k]=Math.floor(v*.65);for(let n=1;n<source.level;n++)for(const[k,v]of Object.entries({jade:45*n,wood:30*n,stone:20*n}))refund[k]=(refund[k]||0)+Math.floor(v*.65);grant(s,refund);for(const p of s.disciples||[])if(p.job===source.id)p.job=null;s.buildings=s.buildings.filter(b=>b.id!==source.id);o.salvage=refund;}
 else{const previousLevel=source.level;source.transform={...o.targetTransform};if(o.operation==='upgrade'){source.level=o.targetLevel;source.condition=100;}if(o.operation==='establish'){source.condition=100;s.story.opening.hallPhase='complete';s.stats.built++;log(s,'主殿落成，山院有了立身之所。');}if(o.operation==='relocate'){source.x=o.targetTransform.x;source.y=o.targetTransform.y;const site=domainSiteAt(source.type,source.transform.x,source.transform.y);if(site)source.domainSiteId=site.id;else delete source.domainSiteId;s.stats.relocated++;}delete source.spatialLock;finishMeditationBuildingChange(s,source,o.operation,previousLevel);finalizeBuildingChange(s,source,o.operation);}
 s.spatial.geometryRevision++;s.spatial.completedOrders.push({id:o.id,operation:o.operation,phase:'completed',progressTicks:o.progressTicks,usedCost:{...o.usedCost},sourceTransform:o.sourceTransform,targetTransform:o.targetTransform,evacuations:o.evacuations,salvage:o.salvage||null,tick:s.worldTick,...(o.domainSiteId?{domainSiteId:o.domainSiteId,materialTrips:o.materialFlow?.trips||[]}:{})});cleanup(s,a);
 for(const p of people(s)){const q=personPosition(s,p);if(q){q.revision=spatialRevision(s);q.path=[];q.goal=null;}}
 pruneDoorQueues(s);
}
export function viewSpatial(s){const a=spatialConstruction(s),o=a&&s.workOrdersById[a.workOrderId];if(!o)return null;const b=layoutBuilding(s,{id:a.buildingId,type:a.type,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})});return {building:b,position:spatialAccess(b),footprint:spatialFootprint(b),access:a.target,progress:o.progressTicks/o.durationTicks,stage:o.progressTicks/o.durationTicks<1/3?'foundation':o.progressTicks/o.durationTicks<2/3?'structure':'finishing',label:o.waitingReason||a.reason||({moving:'前往工地',working:'到场施工',blocked:'等待安全条件'}[a.phase]),operation:o.operation};}
export function validateSpatial(s){
 if(!spatialEnabled(s))return true;
 validateCourtyardTerrainRecord(s);
 const bounds=sceneBounds(s);
 if(domainExtentEnabled(s.spatial.extentVersion)){const d=s.spatial.domain;if(!d||d.layoutVersion!==DOMAIN_LAYOUT_VERSION||!Number.isSafeInteger(d.openedAtTick)||d.openedAtTick<0||d.openedAtTick>s.worldTick)throw Error('山域布局版本或开放记录异常，原存档保留。');}
 else if(s.spatial.domain!==undefined)throw Error('山域布局与空间范围版本不一致，原存档保留。');
 if(domainValleyEnabled(s.spatial.extentVersion)){const tick=s.spatial.domain.valleyOpenedAtTick;if(!Number.isSafeInteger(tick)||tick<s.spatial.domain.openedAtTick||tick>s.worldTick)throw Error('西谷开放记录异常，原存档保留。');}
 else if(s.spatial.domain?.valleyOpenedAtTick!==undefined)throw Error('西谷开放记录与范围版本不一致，原存档保留。');
 if(s.spatial.westWorkshops!==undefined){
  const r=s.spatial.westWorkshops;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!domainWestWorkshopsEnabled(r.version)||!domainValleyEnabled(s.spatial.extentVersion)||s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION||s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.domain.valleyOpenedAtTick||r.openedAtTick<s.spatial.courtyardTerrain.activatedAtTick||r.openedAtTick>s.worldTick)throw Error('西谷双院开放记录异常，原存档保留。');
 }
 if(s.spatial.eastResidences!==undefined){
  const r=s.spatial.eastResidences;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!domainResidencesEnabled(r.version)||!domainExtentEnabled(s.spatial.extentVersion)||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.domain.openedAtTick||r.openedAtTick>s.worldTick)throw Error('东侧住宅开放记录异常，原存档保留。');
 }
 if(s.spatial.guesthouse!==undefined){const r=s.spatial.guesthouse;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!guesthouseGroundEnabled(s)||!domainExtentEnabled(s.spatial.extentVersion)||s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.domain.openedAtTick||r.openedAtTick>s.worldTick)throw Error('客院台地开放记录异常，原存档保留。');}
 if(s.spatial.eastServices!==undefined){
  const r=s.spatial.eastServices;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!domainServicesEnabled(r.version)||!domainResidencesEnabled(s.spatial.eastResidences?.version)||s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION||s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.eastResidences.openedAtTick||r.openedAtTick>s.worldTick)throw Error('东台生活院开放记录异常，原存档保留。');
 }
 if(s.spatial.northLibrary!==undefined){
  const r=s.spatial.northLibrary;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!domainNorthLibraryEnabled(r.version)||!domainExtentEnabled(s.spatial.extentVersion)||s.spatial.courtyardTerrain?.version!==COURTYARD_MASTER_TERRAIN_VERSION||s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.domain.openedAtTick||r.openedAtTick<s.spatial.courtyardTerrain.activatedAtTick||r.openedAtTick>s.worldTick)throw Error('北台藏经阁开放记录异常，原存档保留。');
 }
 if(s.spatial.northMeditation!==undefined){
  const r=s.spatial.northMeditation;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!domainNorthMeditationEnabled(r.version)||!domainNorthLibraryEnabled(s.spatial.northLibrary?.version)||!Number.isSafeInteger(r.openedAtTick)||r.openedAtTick<s.spatial.northLibrary.openedAtTick||r.openedAtTick>s.worldTick)throw Error('聚灵台地开放记录异常，原存档保留。');
 }
 for(const [id,fact]of Object.entries(s.factsById||{}))if(id.startsWith('fact:site-service:')){
  const building=s.buildingsById?.[fact?.buildingId],site=SECT_DOMAIN.sites.find(site=>site.id===fact?.siteId);
  if(!fact||typeof fact!=='object'||Array.isArray(fact)||Object.keys(fact).length!==6||id!==`fact:site-service:${fact.buildingId}`||fact.id!==id||fact.kind!=='site-service-commissioned'||fact.version!==SITE_SERVICE_VERSION||!site?.services||!/^building:yunxiu:[1-9][0-9]*$/.test(fact.buildingId)||!domainServicesEnabled(s.spatial.eastServices?.version)||!Number.isSafeInteger(fact.atTick)||fact.atTick<s.spatial.eastServices.openedAtTick||fact.atTick>s.worldTick||building&&(building.serviceVersion!==fact.version||building.domainSiteId!==fact.siteId||building.type!==site.type))throw Error('生活设施建成事实或实例版本异常，原存档保留。');
 }
 for(const b of s.buildings)if(b.serviceVersion!==undefined){const t=spatialTransform(b),site=domainSiteAt(b.type,t.x,t.y);if(b.serviceVersion!==SITE_SERVICE_VERSION||!s.factsById?.[`fact:site-service:${b.instanceId}`]||!domainServicesEnabled(s.spatial.eastServices?.version)||!site?.services||b.domainSiteId!==site.id||b.buildingGridVersion!==BUILDING_GRID.version||b.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION)throw Error('生活设施版本或固定建位异常，原存档保留。');}
 if(s.spatial.buildingGridVersion&&!buildingGridEnabled(s))throw Error('未知建筑单位格版本。');
 if(s.spatial.interiorLayoutVersion&&s.spatial.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION||s.buildings.some(b=>b.interiorLayoutVersion&&b.interiorLayoutVersion!==INTERIOR_LAYOUT_VERSION))throw Error('未知室内布局版本，原存档保留。');
 if(s.spatial.sceneId!==SPATIAL_SCENE.id||!Number.isSafeInteger(s.spatial.geometryRevision)||s.spatial.geometryRevision<1||!Array.isArray(s.spatial.migrations)||!Array.isArray(s.spatial.completedOrders)||s.spatial.completedOrders.length>128)throw Error('米制空间迁移记录异常。');
 const queues=s.spatial.doorQueuesByEntryId;
 if(queues!==undefined){if(!queues||typeof queues!=='object'||Array.isArray(queues))throw Error('门道队列容器异常。');const queued=new Set();for(const [entryId,q]of Object.entries(queues)){
  if(!/^building:yunxiu:[1-9][0-9]*\/entry:south$/.test(entryId)||q?.entryId!==entryId||!Array.isArray(q.waiting)||!Number.isSafeInteger(q.lastPassTick)||q.lastPassTick< -1||q.lastPassTick>s.worldTick)throw Error('门道队列入口或释放时刻异常。');
  let previous=null;for(const record of [...(q.holder?[q.holder]:[]),...q.waiting]){if(record?.entryId!==entryId||typeof record.personId!=='string'||!Number.isSafeInteger(record.firstArrivalTick)||record.firstArrivalTick<0||record.firstArrivalTick>s.worldTick||record.activityId!==null&&typeof record.activityId!=='string'||!Number.isFinite(record.target?.x)||!Number.isFinite(record.target?.y)||!['in','out'].includes(record.phase)||queued.has(record.personId))throw Error('门道通行权或候选记录异常。');queued.add(record.personId);}
  for(const record of q.waiting){if(previous&&(previous.firstArrivalTick>record.firstArrivalTick||previous.firstArrivalTick===record.firstArrivalTick&&previous.personId.localeCompare(record.personId)>0))throw Error('门道候选队序异常。');previous=record;}
 }}
 for(const b of s.buildings){const t=b.transform,d=spatialPrefab(b);if(!t||![t.x,t.y].every(Number.isFinite)||snap(t.x)!==t.x||snap(t.y)!==t.y||t.orientation!=='south'||b.prefabId!==prefabId(b)||b.buildingGridVersion&&!buildingGridEnabled(s)||buildingGridEnabled(s)&&(b.buildingGridVersion!==BUILDING_GRID.version||!onBuildingGrid(t.x)||!onBuildingGrid(t.y))||t.x<(bounds.x||0)+1||t.y<(bounds.y||0)+1||t.x+d.width>(bounds.x||0)+bounds.width-1||t.y+d.height+1>(bounds.y||0)+bounds.height-1)throw Error(`米制建筑位置异常：${b.instanceId}`);const issue=placementIssue(s,b.type,t.x,t.y,{ignoreId:b.id,level:b.level,checkPeople:false,checkReservations:false,checkConnectivity:false,checkPreset:false});if(issue||!meterCanStand(s,spatialAccess(b)))throw Error(`米制建筑占地或入口异常：${b.instanceId} ${issue}`);const site=domainSiteAt(b.type,t.x,t.y);if(b.domainSiteId!==undefined&&b.domainSiteId!==site?.id||(t.x<0||t.y<0||t.x>=SPATIAL_SCENE.width)&&b.domainSiteId!==site?.id)throw Error('建筑与山域营造地身份不一致。');}
 for(const p of people(s)){const a=personPosition(s,p);if(a&&!meterCanStand(s,a))throw Error(`人物米制脚点不合法：${p.personId}`);let from=a;for(const q of a?.path||[]){if(meterSweep(s,from,q).blocked)throw Error('米制路径穿越障碍。');from=q;}if(a?.idleVisibleRecovery){const r=a.idleVisibleRecovery;if(![r.origin?.x,r.origin?.y,r.walked].every(Number.isFinite)||r.walked<0||r.walked>3+1e-8||distance(a,r.origin)>r.walked+1e-7||!Number.isSafeInteger(r.startedTick)||r.startedTick<0||r.startedTick>s.worldTick)throw Error('闲置人物可见脚点恢复预算异常。');}if(a?.bodyYield){const y=a.bodyYield;if(!['door-wait','mutual-corridor','entrance-clear','requester-clear','transport-retreat',undefined].includes(y.kind)||typeof y.requestedBy!=='string'||!Number.isSafeInteger(y.startedTick)||y.startedTick<0||y.startedTick>s.worldTick||!Number.isFinite(y.target?.x)||!Number.isFinite(y.target?.y)||!Array.isArray(y.path)||y.path.length>24||y.path.some(q=>!Number.isFinite(q?.x)||!Number.isFinite(q?.y)))throw Error('人物真实让行路径异常。');if(y.kind==='transport-retreat'&&(!transportRetreatOwner(s,p,y)||distance(a,y.target)>24||!Number.isInteger(y.returnPrefixLength)||y.returnPrefixLength<1||y.returnPrefixLength>24||!Array.isArray(y.returnPath)||y.returnPrefixLength>y.returnPath.length||y.returnPath.length>512||y.returnPath.some(q=>!Number.isFinite(q?.x)||!Number.isFinite(q?.y))))throw Error('运输让行归属异常。');if(y.kind==='transport-retreat')validateManualWalkRetreat(a,y);}}
 const active=Object.values(s.workOrdersById).filter(o=>o.spatial&&o.kind==='construction');if(active.length>1)throw Error('重复施工工作单。');
 for(const o of active){const a=s.activitiesById[o.activityIds?.[0]],r=s.reservationsById[o.reservationId],source=s.buildingsById?.[o.targetId];
  if((o.domainSiteId!==undefined||o.targetTransform?.y<0)&&o.domainSiteId!==domainSiteAt(o.buildingType,o.targetTransform?.x,o.targetTransform?.y)?.id)throw Error('施工与山域营造地身份不一致。');
  const serviceSite=domainSiteAt(o.buildingType,o.targetTransform?.x,o.targetTransform?.y),serviceVersion=o.operation==='build'&&domainServicesEnabled(s.spatial.eastServices?.version)&&serviceSite?.services?SITE_SERVICE_VERSION:source?.serviceVersion;
  if(o.serviceVersion!==serviceVersion)throw Error('生活设施施工版本与目标实例不一致，原存档保留。');
  if(!a||s.master.activityId!==a.id||a.personId!=='person:master'||a.instanceId!==o.targetId||o.id!==`work:construction:${a.buildingId}`||a.id!==`activity:build:${a.buildingId}`||!r||r.activityId!==a.id||r.kind!=='construction-material'||a.workOrderId!==o.id||!['build','establish','upgrade','relocate','demolish'].includes(o.operation)||!['moving','working','blocked'].includes(a.phase)||!Number.isInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||o.durationTicks!==({build:200,establish:200,upgrade:240,relocate:180,demolish:120}[o.operation])||!Number.isInteger(a.buildingId)||a.buildingId<1||a.buildingId>=s.nextId||o.operation==='build'&&source||o.operation!=='build'&&!source||!BUILDINGS[o.buildingType]||o.buildingType!==a.type||o.operation==='establish'&&(a.type!=='hall'||s.story?.opening?.hallPhase!=='building'||o.targetLevel!==source.level))throw Error('米制施工预约异常。');
  if(o.workSlots){
   if(!Array.isArray(o.workSlots)||o.workSlots.length<1||o.workSlots.length>2||!Number.isSafeInteger(o.workSlotGeometryRevision)||o.workSlotGeometryRevision<1||o.workSlotGeometryRevision>s.spatial.geometryRevision||!Array.isArray(o.activityIds)||o.activityIds[0]!==a.id||o.activityIds.length>o.workSlots.length+1||new Set(o.activityIds).size!==o.activityIds.length)throw Error('施工执行位或参与者记录异常。');
   const planned=layoutBuilding(s,{type:o.buildingType,level:o.targetLevel,transform:o.targetTransform,...(o.serviceVersion?{serviceVersion:o.serviceVersion}:{})}),entry=spatialAccess(planned),expectedSlots=o.workSlotGeometryRevision===s.spatial.geometryRevision?constructionWorkSlots(s,o.id,planned):null;
   if(expectedSlots&&(expectedSlots.length!==o.workSlots.length||expectedSlots.some((slot,i)=>slot.id!==o.workSlots[i].id||distance(slot.position,o.workSlots[i].position)>.001)))throw Error('施工执行位与目标几何不一致。');
   for(const [index,slot]of o.workSlots.entries()){
    if(slot.id!==`${o.id}/slot:${index+1}`||!Number.isFinite(slot.position?.x)||!Number.isFinite(slot.position?.y)||distance(slot.position,entry)<.91||o.workSlots.some(other=>other!==slot&&distance(other.position,slot.position)<.53)||slot.firstArrivalTick!==null&&(!Number.isSafeInteger(slot.firstArrivalTick)||slot.firstArrivalTick>s.worldTick))throw Error('施工执行位位置或到达次序异常。');
    if(slot.occupantId!==null){const person=s.personsById[slot.occupantId],activity=person&&s.activitiesById[person.activityId],position=person&&personPosition(s,person),arrived=activity?.slotArrived===true||activity?.phase==='working';if(!person||!activity||activity.workOrderId!==o.id||activity.slotId!==slot.id||activity.firstArrivalTick!==slot.firstArrivalTick||!o.activityIds.includes(activity.id)||arrived&&(!activity.slotArrived||!position||distance(position,slot.position)>.1))throw Error('施工执行位占用者与活动不一致。');}
    else if(slot.firstArrivalTick!==null)throw Error('空施工位仍有占用到达时刻。');
   }
   for(const id of o.activityIds){const activity=s.activitiesById[id],person=activity&&s.personsById[activity.personId];if(!activity||!person||person.activityId!==id||activity.workOrderId!==o.id||!['construction','sr-construction'].includes(activity.kind)||activity!==a&&activity.kind!=='sr-construction'||!['moving','working','blocked'].includes(activity.phase)||activity.slotId!==null&&activity.slotId!==undefined&&!o.workSlots.some(slot=>slot.id===activity.slotId&&slot.occupantId===person.personId)||activity.firstArrivalTick!==null&&activity.firstArrivalTick!==undefined&&(!Number.isSafeInteger(activity.firstArrivalTick)||activity.firstArrivalTick>s.worldTick)||activity.slotArrived!==undefined&&typeof activity.slotArrived!=='boolean'||activity.slotArrived&&!activity.slotId||activity.kind==='sr-construction'&&activity.phase==='working'&&!activity.slotId)throw Error('施工参与活动或排他占位异常。');}
  }
  const t=o.targetTransform;if(buildingGridEnabled(s)&&(!onBuildingGrid(t?.x)||!onBuildingGrid(t?.y)))throw Error('施工目标须对齐建筑单位格。');if(!t||t.orientation!=='south'||![t.x,t.y].every(n=>Number.isFinite(n)&&snap(n)===n)||!Number.isInteger(o.targetLevel)||o.targetLevel<1||o.targetLevel>BUILDINGS[a.type].max)throw Error('施工目标预制件不合法。');
  const d=dimensions(layoutBuilding(s,{type:o.buildingType,level:o.targetLevel}));if(t.x<(bounds.x||0)+1||t.y<(bounds.y||0)+1||t.x+d.width>(bounds.x||0)+bounds.width-1||t.y+d.height+1>(bounds.y||0)+bounds.height-1)throw Error('施工目标超出山院可建边界。');
  const level=source?.level||1,expected=o.operation==='establish'?HALL_ESTABLISH_COST:o.operation==='build'?BUILDINGS[a.type].cost:o.operation==='upgrade'?{jade:45*level,wood:30*level,stone:20*level}:o.operation==='relocate'?{jade:10*level,wood:8*level}:{};
  if(Object.keys(r.cost||{}).length!==Object.keys(expected).length||!Object.entries(expected).every(([k,v])=>r.cost[k]===v))throw Error('施工材料预约来源不匹配。');
  for(const [k,v]of Object.entries(r.cost))if(o.usedCost[k]!==Math.floor(v*o.progressTicks/o.durationTicks)&&!(o.progressTicks===0&&(o.usedCost[k]||0)===0))throw Error('施工投入不守恒。');
  if(o.materialFlow){const flow=o.materialFlow,origin=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];if(flow.version!==CONSTRUCTION_MATERIAL_FLOW||!origin||!site||origin.ownerId!=='person:master'||site.ownerId!=='person:master'||flow.carrierId!=='person:master'||!['to-source','carrying','ready','recover-site','returning'].includes(flow.phase)||!Array.isArray(flow.trips)||typeof flow.cancelRequested!=='boolean'||!flow.cargo||Object.entries(flow.cargo).some(([k,v])=>k==='jade'||!RESOURCES[k]||!Number.isFinite(v)||v<=0))throw Error('施工材料位置或运输阶段异常。');for(const[k,v]of Object.entries(constructionMaterials(r.cost))){const count=origin.resources[k]+site.resources[k]+(flow.cargo[k]||0)+(o.usedCost[k]||0);if(Math.abs(count-v)>1e-8)throw Error('施工材料在仓库、在途、工地与已安装量之间不守恒。');}if(flow.phase==='ready'&&!flow.cancelRequested&&(materialTotal(origin.resources)>1e-8||materialTotal(flow.cargo)>1e-8))throw Error('施工材料尚未全部交付。');}
 }
 return true;
}
