/** Static route proofs for repeated availability queries. Actual journeys still
 * obtain their own route, and all cache state remains outside the saved world.
 */
import {geometryRevision,scenicCanStand,scenicSweep,scenicFindPath,scenicDistance} from './ea-scene-geometry.mjs';
const caches=new WeakMap();
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function pathExists(s,from,to){
 if(!scenicCanStand(s,from)||!scenicCanStand(s,to))return false;
 const path=scenicFindPath(s,from,to,{maxSnap:0});
 return path!==null&&scenicDistance(path.at(-1)||from,to)<.001;
}
export function inheritReachabilityProof(previous,next){
 const cache=caches.get(previous);
 if(cache?.revision===geometryRevision(next))caches.set(next,{revision:cache.revision,origins:new Map(cache.origins)});
}
export function routeReachable(s,from,to,originId){
 if(!valid(from)||!valid(to))return false;
 const revision=geometryRevision(s);let cache=caches.get(s);
 if(cache?.revision!==revision){cache={revision,origins:new Map()};caches.set(s,cache);}
 let origin=cache.origins.get(originId);
 if(origin&&(origin.position.x!==from.x||origin.position.y!==from.y)){
  const joined=!scenicSweep(s,from,origin.position).blocked||pathExists(s,from,origin.position);
  origin=joined?{position:{x:from.x,y:from.y},targets:new Map([...origin.targets].filter(([,reachable])=>reachable))}:null;
 }
 if(!origin){if(cache.origins.size>=32)cache.origins.clear();origin={position:{x:from.x,y:from.y},targets:new Map()};}
 cache.origins.set(originId,origin);
 const key=`${to.x}/${to.y}`;
 if(!origin.targets.has(key)){if(origin.targets.size>=256)origin.targets.clear();origin.targets.set(key,pathExists(s,from,to));}
 return origin.targets.get(key);
}
