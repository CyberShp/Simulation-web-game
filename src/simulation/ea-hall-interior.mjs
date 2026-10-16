import {spatialEnabled,spatialRoom,spatialSlots} from './ea-sr-spatial.mjs';
/** A bounded first indoor prefab. Coordinates remain in the legacy scene plane.
 * This does not claim the complete metre/free-placement migration in spec 03. */
export const HALL_INTERIOR_VERSION='hall-interior-1';
export const hallInteriorEnabled=s=>spatialEnabled(s)||s?.rulesetVersion==='opening-runtime-3'&&s?.contentVersion==='opening-v1.2';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const slots=(kind,suffix,points,label)=>points.map(([x,y],i)=>({kind,suffix:`${suffix}:${i+1}`,position:{x,y},label:`${label} ${i+1}`,facing:1,capacity:1}));
const beds=[[728,134],[770,134],[888,134],[930,134]];
export const HALL_INTERIOR=Object.freeze({
 id:'prefab:hall:interior:v1',bounds:{x:698,y:84,width:252,height:116},door:{x:840,y:206},floor:rect(698,84,252,116),
 walls:[rect(694,80,260,4),rect(694,84,4,116),rect(950,84,4,116),rect(694,200,134,4),rect(852,200,102,4)],
 furniture:[...[[714,96],[756,96],[874,96],[916,96]].map(([x,y],i)=>({kind:'bed',id:`bed:${i+1}`,polygon:rect(x,y,24,28)})),
  ...[[742,148],[780,148]].map(([x,y],i)=>({kind:'desk',id:`desk:${i+1}`,polygon:rect(x,y,24,12)}))],
 slots:[...slots('rest','bed',beds,'主屋床位'),...slots('heal','bed-care',beds,'主屋调养床位'),
  ...slots('study','desk',[[754,172],[792,172]],'室内书案'),...slots('teach','teacher',[[820,172]],'室内讲法席'),
  ...slots('cultivate','mat',[[882,166],[914,166],[882,186],[914,186]],'室内蒲团')],
 lanes:[...[[134,704,944],[172,704,944],[190,704,944]].map(([y,x,end])=>({a:{x,y},b:{x:end,y},width:12,painted:false})),
  {a:{x:840,y:217},b:{x:840,y:90},width:24,painted:false}]
});
export function hallInterior(s,b){if(spatialEnabled(s))return b?spatialRoom(b):null;return hallInteriorEnabled(s)&&b?.type==='hall'?HALL_INTERIOR:null;}
export function indoorBuildingAt(s,p){if(spatialEnabled(s))return s.buildings.find(b=>{const r=spatialRoom(b);return r&&p&&p.x>r.bounds.x&&p.x<r.bounds.x+r.bounds.width&&p.y>r.bounds.y&&p.y<r.bounds.y+r.bounds.height;})||null;const b=s.buildings.find(b=>b.type==='hall'),r=hallInterior(s,b);return r&&p&&p.x>r.bounds.x&&p.x<r.bounds.x+r.bounds.width&&p.y>r.bounds.y&&p.y<r.bounds.y+r.bounds.height?b:null;}
export function interiorSlots(s,b,kind){if(spatialEnabled(s))return spatialSlots(b,kind);const r=hallInterior(s,b);return r?r.slots.filter(slot=>slot.kind===kind).map(slot=>({...slot,id:`${b.instanceId}/slot:${slot.suffix}`,buildingId:b.id})):null;}
export function indoorRoofOpen(s,b,{selection=null,hover=null,actors=[]}={}){
 // Compatibility export for old callers. U-101 keeps closed buildings opaque in every visual state.
 return false;
}
