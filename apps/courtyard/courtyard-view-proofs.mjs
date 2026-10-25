/** Read-only projection helpers. No cache is serialized into the world. */
import {actorScenePosition,lifeScenePath} from '../../src/simulation/ea-life.mjs';
import {geometryRevision,buildingAccess,scenicFindPath,scenicDistance} from '../../src/simulation/ea-scene-geometry.mjs';

/** Preserve detached metadata, aliases, sparse arrays and enumerable keys.
 * Native cloning remains authoritative for values outside plain save data. */
export function copyViewMetadata(root){
 const copies=new Map(),fallback={};
 function copy(value){
  if(value===null||typeof value!=='object'){if(typeof value==='function'||typeof value==='symbol')throw fallback;return value;}
  if(copies.has(value))return copies.get(value);
  if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw fallback;
  const result=Array.isArray(value)?new Array(value.length):{};copies.set(value,result);
  for(const key of Object.keys(value)){const child=copy(value[key]);if(key==='__proto__')Object.defineProperty(result,key,{value:child,writable:true,enumerable:true,configurable:true});else result[key]=child;}
  return result;
 }
 try{return copy(root);}catch(error){if(error!==fallback)throw error;return structuredClone(root);}
}

const proofs=new WeakMap(),HOME='scene:yunxiu-courtyard';
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const arrived=(path,from,to)=>path!==null&&scenicDistance(path.at(-1)||from,to)<.001;
export function inheritViewWorkRouteProof(previous,next){
 const cache=proofs.get(previous);if(cache?.revision!==geometryRevision(next))return;
 proofs.set(next,{revision:cache.revision,origins:new Map([...cache.origins].map(([id,origin])=>[id,{position:{...origin.position},targets:new Set(origin.targets)}]))});
}
/** Used only by the view's existing workOpportunity path-predicate seam.
 * A moved origin inherits positive proofs only after the same navigator proves
 * a real prefix back to its previous origin. Failed routes are never inherited. */
export function viewWorkRouteAvailable(s,person,building){
 const exact=()=>lifeScenePath(s,person,building)!==null,location=person.location;
 if(s.spatial?.sceneId!==HOME||location?.kind!=='local'||location.sceneId!==HOME||s.buildingsById?.[building.instanceId]!==building)return exact();
 const from=actorScenePosition(s,person),goal=buildingAccess(s,building);if(!from||!goal||![from.x,from.y,goal.x,goal.y].every(Number.isFinite))return exact();
 const revision=geometryRevision(s);let cache=proofs.get(s);if(cache?.revision!==revision){cache={revision,origins:new Map()};proofs.set(s,cache);}
 const id=person.personId;let origin=cache.origins.get(id);
 if(origin&&!same(from,origin.position)){
  const prefix=origin.targets.size?scenicFindPath(s,from,origin.position,{maxSnap:0}):null;
  origin=arrived(prefix,from,origin.position)?{position:{x:from.x,y:from.y},targets:new Set(origin.targets)}:null;
 }
 if(!origin){if(cache.origins.size>=32)cache.origins.clear();origin={position:{x:from.x,y:from.y},targets:new Set()};}
 cache.origins.set(id,origin);
 const key=`${building.instanceId}/${goal.x}/${goal.y}`;
 if(origin.targets.has(key))return true;
 const available=exact();if(available){if(origin.targets.size>=256)origin.targets.clear();origin.targets.add(key);}return available;
}
