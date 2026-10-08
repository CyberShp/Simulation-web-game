import {spatialEnabled,spatialSlots} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r29';
import {interiorSlots} from './ea-hall-interior.mjs?v=ea-160-courtyard-20261008-r29';
/** Physical courtyard work stations. The old painting is a transitional ground layer. */
import {BUILDINGS} from './ea-data.mjs?v=ea-160-courtyard-20261008-r29';
import {buildingAccess,scenicCanStand,scenicSweep,scenicDistance,geometryRevision} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r29';
export const FACILITY_MODEL_VERSION='courtyard-stations-1';
export const facilityBodyKinds=new Set(['work','study','teach','cultivate','care','rest','heal']);
const suffixes={work:'work',study:'desk',teach:'teacher',cultivate:'mat',care:'care'};
const cache=new WeakMap();
function definitions(s){const revision=geometryRevision(s),old=cache.get(s);if(old?.revision===revision)return old;const value={revision,slots:new Map(),byId:null};cache.set(s,value);return value;}
function compileSlots(s,b,kind){if(spatialEnabled(s))return spatialSlots(b,kind);
 if(!b||!facilityBodyKinds.has(kind))return [];
 const inside=interiorSlots(s,b,kind);if(inside&&kind!=='care')return inside;
 if(['rest','heal'].includes(kind))return [];
 const entry=buildingAccess(s,b);if(!entry)return [];
 if(kind==='care'){if(b.type!=='hall')return [];return [-1,1].map((side,i)=>({id:`${b.instanceId}/slot:care:${i+1}`,buildingId:b.id,kind,label:i?'换药侧位':'院前照护席',position:{x:entry.x+22+side*4.8,y:entry.y+30-side*3.6},facing:-1,capacity:1})).filter(slot=>scenicCanStand(s,slot.position));}
 const count=kind==='work'?(['farm','granary'].includes(b.type)?4:b.type==='library'?1:BUILDINGS[b.type]?.work?2:0):kind==='study'?(['library','hall'].includes(b.type)?2:0):kind==='teach'?(['library','hall'].includes(b.type)?1:0):['meditation','hall'].includes(b.type)?4:0;
 // Separate named stations on the working lane: crop care positions, desks,
 // teaching place and meditation mats. These are not invented interior beds.
 const offsets=kind==='teach'||count===1?[0]:count===4?[-24,-8,8,24]:[-16,16];
 return offsets.slice(0,count).map((dx,i)=>({id:`${b.instanceId||`building:yunxiu:${b.id}`}/slot:${suffixes[kind]}:${i+1}`,buildingId:b.id,kind,
  label:kind==='work'?`照料工位 ${i+1}`:kind==='study'?`院前阅卷位 ${i+1}`:kind==='teach'?'讲法位置':`院前蒲团 ${i+1}`,position:{x:entry.x+dx,y:entry.y},facing:-1,capacity:1}))
  .filter(slot=>scenicCanStand(s,slot.position)&&!scenicSweep(s,entry,slot.position).blocked);
}
export function facilitySlots(s,b,kind){
 if(!b)return [];const defs=definitions(s),key=`${b.instanceId||b.id}/${kind}`;
 if(!defs.slots.has(key))defs.slots.set(key,Object.freeze(compileSlots(s,b,kind).map(slot=>Object.freeze({...slot,position:Object.freeze(slot.position)}))));
 return defs.slots.get(key);
}
export function slotById(s,id){
 const defs=definitions(s);if(!defs.byId){defs.byId=new Map();for(const b of s.buildings)for(const kind of facilityBodyKinds)for(const slot of facilitySlots(s,b,kind))defs.byId.set(slot.id,slot);}
 return defs.byId.get(id)||null;
}

export function slotReservation(s,slotId){return Object.values(s.reservationsById||{}).find(r=>['slot','sr-slot'].includes(r.kind)&&r.slotId===slotId)||null;}
export function facilitySlotView(s,b){
 const list=[...facilityBodyKinds].flatMap(kind=>facilitySlots(s,b,kind)),seen=new Set();
 return list.filter(slot=>{const key=`${slot.position.x}/${slot.position.y}`;if(seen.has(key))return false;seen.add(key);return true;}).map(slot=>{
 const r=Object.values(s.reservationsById||{}).find(r=>['slot','sr-slot'].includes(r.kind)&&scenicDistance(slotById(s,r.slotId)?.position||{x:-999,y:-999},slot.position)<.01),a=r&&s.activitiesById[r.activityId];
  // Rest and healing may share one bed position. Show the reserved activity's
  // real slot name instead of the first unoccupied kind at that coordinate.
  return {...slot,...(r?slotById(s,r.slotId):null),personId:r?.personId??null,phase:a?.phase??'free'};
 });
}
