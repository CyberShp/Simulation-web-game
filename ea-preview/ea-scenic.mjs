import {spatialEnabled,sceneUnits,spatialAccess,SPATIAL_VERSION} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r2';
import {slotById} from './ea-facility-slots.mjs?v=ea-160-courtyard-20261008-r2';
import {point,findPath,sweep,canStand,distance,LANDMARKS} from '../yunxiu-courtyard/navigation.mjs?v=ea-160-courtyard-20261008-r2';
import {SCENE_GEOMETRY,SCENIC_PLOTS,scenicCanStand,scenicFindPath,scenicSweep,scenicNearest,buildingAccess,geometryRevision,scenicDistance} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r2';
export {SCENE_GEOMETRY,scenicPoint,scenicInverse,scenicCanStand,scenicFindPath,scenicNearest,scenicDistance,scenicPathDistance,buildingAccess,geometryRevision} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r2';

export const FACILITY_AREAS={hall:'main',house:'main',library:'main',watchtower:'gate',farm:'herbs',granary:'herbs',well:'herbs',lumber:'workshop',workshop:'workshop',quarry:'works',meditation:'meditation',alchemy:'kitchen',clinic:'kitchen',kitchen:'kitchen'};
export const areaPoint=id=>point(LANDMARKS.find(l=>l.id===id)?.node||'centre');
export const appearance=id=>id==='master'?0:1+((Number(id)-1)%5);
export function scenicPosition(master){return master.scenic||{...point('mainDoor'),path:[],steps:0,facing:1,back:false};}
export function startScenicWalk(master,goal,s){
 const a=scenicPosition(master),path=s?scenicFindPath(s,a,goal):findPath(a,goal);if(!path)return false;
 master.scenic={...a,path,...(s?{geometry:spatialEnabled(s)?SPATIAL_VERSION:SCENE_GEOMETRY,revision:geometryRevision(s),goal:path.at(-1)||{x:a.x,y:a.y}}:{})};master.path=[];master.action=path.length?'walk':'rest';master.learning=null;master.teaching=null;return true;
}
export function advanceScenic(actor,budget,s){budget=sceneUnits(s,budget);
 if(s&&actor.revision!==geometryRevision(s)){repairScenicActor(actor,s);}
 let used=0;while(actor.path.length&&budget>.001){const target=actor.path[0],d=distance(actor,target);if(d<.001){actor.path.shift();continue;}
 const step=Math.min(budget,d),next={x:actor.x+(target.x-actor.x)*step/d,y:actor.y+(target.y-actor.y)*step/d},moved=s?scenicSweep(s,actor,next):sweep(actor,next);
 if(moved.blocked){if(s){actor.path=[];actor.goal=null;break;}throw Error('山道路径越过通行边界。');}actor.facing=next.x<actor.x?-1:1;actor.back=next.y<actor.y-sceneUnits(s,1);actor.x=moved.x;actor.y=moved.y;actor.steps=(actor.steps||0)+step;budget-=step;used+=step;if(step>=d-.001)actor.path.shift();
 }return used;
}
export function validateScenic(a,s){
 if(a===undefined||a===null)return true;
 if(!(s?scenicCanStand(s,a):canStand(a))||!Number.isFinite(a.steps)||a.steps<0||![1,-1].includes(a.facing)||typeof a.back!=='boolean'||!Array.isArray(a.path)||a.path.length>80)return false;
 let p=a;for(const next of a.path){if(!Number.isFinite(next.x)||!Number.isFinite(next.y)||(s?scenicSweep(s,p,next):sweep(p,next)).blocked)return false;p=next;}return true;
}
export function repairScenicActor(a,s){
 const destination=a.destinationId!==undefined?s.buildings.find(b=>b.id===a.destinationId):null,
  fallback=buildingAccess(s,s.buildings.find(b=>b.type==='hall'))||point('mainDoor'),
  desired=a.activitySlotId&&slotById(s,a.activitySlotId)?.position|| (a.destinationId!==undefined?destination&&destination.enabled!==false&&destination.condition>0?buildingAccess(s,destination):fallback:a.goal||a.path?.at(-1));
 if(!scenicCanStand(s,a)){const p=scenicNearest(s,a)||fallback;a.x=p.x;a.y=p.y;}
 a.path=desired?scenicFindPath(s,a,desired)||[]:[];a.goal=a.path.at(-1)||null;
 a.geometry=spatialEnabled(s)?SPATIAL_VERSION:SCENE_GEOMETRY;a.revision=geometryRevision(s);return a;
}
// Explicit load-time/placement repair is idempotent. It never advances time,
// pays resources or changes story; modern malformed coordinates stay subject
// to strict validation unless the caller explicitly requests placement repair.
export function repairScenicState(s,{legacyOnly=false}={}){
 let changed=false;const a=s.master.scenic;
 if(a&&(!legacyOnly||a.geometry!==SCENE_GEOMETRY)){const before=JSON.stringify(a);repairScenicActor(a,s);if(s.master.action==='walk'&&!a.path.length)s.master.action='rest';changed=JSON.stringify(a)!==before;}
 for(const d of s.disciples){const p=d.mind?.scenic;if(!p||legacyOnly&&p.geometry===SCENE_GEOMETRY)continue;const before=JSON.stringify(p);repairScenicActor(p,s);changed=JSON.stringify(p)!==before||changed;}
 return changed;
}
export function syncScenicPosition(s,person=s.master){
 const a=person===s.master?person.scenic:person.mind?.scenic;if(!a)return false;
 if(spatialEnabled(s)){const sceneId='scene:yunxiu-courtyard';if(person.position?.kind==='travel'||person.position?.sceneId&&person.position.sceneId!==sceneId||person.location?.kind==='travel'||person.location?.sceneId&&person.location.sceneId!==sceneId)return false;const changed=person.position?.x!==a.x||person.position?.y!==a.y;person.position={kind:'scene',sceneId,x:a.x,y:a.y};return changed;}
 const occupied=new Set(s.buildings.map(b=>`${b.x},${b.y}`)),plots=SCENIC_PLOTS.filter(p=>!occupied.has(`${p.x},${p.y}`));
 plots.sort((p,q)=>scenicDistance(a,{x:p.position.x,y:p.position.y+24})-scenicDistance(a,{x:q.position.x,y:q.position.y+24}));
 const p=plots[0];if(!p)return false;const position={x:p.x,y:p.y},changed=person.position?.x!==p.x||person.position?.y!==p.y;person.position=position;return changed;
}
export function updateScenicPerson(s,person,destination,budget){
 const owner=person===s.master?person:person.mind,old=owner.scenic;
 if(!old)owner.scenic={...(spatialEnabled(s)?buildingAccess(s,s.buildings.find(b=>b.type==='hall')):point('mainDoor')),path:[],steps:0,facing:1,back:false,geometry:SCENE_GEOMETRY,revision:geometryRevision(s)};
 const a=owner.scenic,target=destination?buildingAccess(s,destination):spatialEnabled(s)?buildingAccess(s,s.buildings.find(b=>b.type==='hall')):point('mainDoor'),id=destination?.id??null;
 if(a.destinationId!==id||a.revision!==geometryRevision(s)||!a.goal&&scenicDistance(a,target)>1){repairScenicActor(a,s);a.path=scenicFindPath(s,a,target)||[];a.goal=a.path.at(-1)||null;a.destinationId=id;}
 const used=advanceScenic(a,budget,s);syncScenicPosition(s,person);return used;
}
// Combat and exploration share one registered open courtyard plane. Its whole
// logical rectangle lies inside the painted paving, away from walls and stairs.
export const arenaPoint=(x,y)=>({x:500+55*x-25*y,y:365+9*x+29*y});
export const arenaInverse=p=>{const a=p.x-500,b=p.y-365;return{x:(29*a+25*b)/1820,y:(55*b-9*a)/1820};};
