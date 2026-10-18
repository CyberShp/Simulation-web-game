import {routeReachable} from './ea-route-reachability.mjs';
/** T-20 / design 61: persistent accommodation, derived from existing physical beds.
 * Call mutation functions only inside an authorized world step or command draft.
 * This module neither moves a person nor starts a body activity.
 */
import {facilitySlots} from './ea-facility-slots.mjs';
import {buildingAccess,scenicCanStand,scenicDistance,scenicFindPath,scenicPathDistance,scenicSweep,geometryRevision} from './ea-scene-geometry.mjs';

export const RESIDENTIAL_HOUSING_VERSION='residential-housing-1';
export const RESIDENTIAL_MEMBER_LIMIT=15;
export const residentialHousingApplicable=s=>s?.contentVersion==='sr-content-v1.2'&&s?.spatial?.version==='spatial-metres-1';
const MASTER='person:master',SCENE='scene:yunxiu-courtyard';
const catalogueCache=new WeakMap();
const projectionCache=new WeakMap();
const homeSources=new Set(['legacy-observed','arrived']);
const pendingSources=new Set(['legacy-placement','admission','autonomous-rest']);
const reasons={
 'not-enabled':'住宅安置尚未启用。','not-complete':'住处尚未完工。',disabled:'住处已停用。',
 damaged:'住处已损坏，暂不能入住。',construction:'住处正在施工。','no-path':'尚无可到床的通路。',
 claimed:'这张床已有住户或入住承诺。',occupied:'这张床已有身体活动预约。','no-bed':'当前没有可用空床。',
 'housing-shortage':'先完成现有居民的安置，再接纳新住户。','roster-full':'在籍门人已达十五人。',
 'person-unavailable':'本人当前不在院内可安置的位置。','not-arrived':'本人尚未实际到床执行休息或调养。',
};
const copy=v=>structuredClone(v);
const buildings=s=>Object.values(s.buildingsById||{});
// Raw save validation must not hydrate or add adapters to the original record.
const geometryState=s=>s.buildings?s:{...s,buildings:buildings(s)};
const residentIds=s=>[MASTER,...(s.homeMemberIds||[]).filter(id=>id!==MASTER)];
const isResident=(s,id)=>id===MASTER||(s.homeMemberIds||[]).includes(id);
const alive=p=>!!p&&p.lifeStatus!=='dead';
const atTick=s=>s.worldTick;
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function fail(code,message=reasons[code]){const error=new Error(message||code);error.reasonCode=code;throw error;}
function invalid(path){throw new Error(`住宅存档校验失败：${path}`);}
function exactKeys(value,keys,path){if(!plain(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))invalid(path+' 形状不符');}
function tick(value,s,min,path){if(!Number.isSafeInteger(value)||value<min||value>s.worldTick)invalid(path+' 时刻不符');}
function localPosition(s,p){
 if(!alive(p)||p.left||p.journey||p.mind?.away||p.mind?.journey||p.position?.kind!=='scene'||p.position.sceneId!==SCENE)return null;
 const {x,y}=p.position;return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
function route(s,from,to){
 if(!from||!to||!scenicCanStand(s,from)||!scenicCanStand(s,to))return null;
 const path=scenicFindPath(s,from,to,{maxSnap:0});
 if(path===null||scenicDistance(path.at(-1)||from,to)>.001)return null;
 return path;
}
function bedCatalogue(s){
 const g=geometryState(s),revision=geometryRevision(g)+';'+(s.story?.opening?.hallPhase??'')+';'+buildings(s).map(b=>`${b.instanceId}:${b.enabled!==false}:${!!b.disabled}:${(b.condition??100)>0}:${b.spatialLock||''}`).join('|');
 const cached=catalogueCache.get(s);if(cached?.revision===revision)return cached;
 const beds=[],aliases=new Map();
 for(const b of buildings(s).filter(b=>['hall','house'].includes(b.type)).sort((a,b)=>a.instanceId.localeCompare(b.instanceId))){
  for(const slot of facilitySlots(g,b,'rest')){
   const existing=beds.find(bed=>bed.buildingId===b.instanceId&&scenicDistance(bed.position,slot.position)<.01);
   if(existing){aliases.set(slot.id,existing.slotId);continue;}
   const bed={buildingId:b.instanceId,slotId:slot.id,position:{...slot.position},purpose:'residential',building:b};
   beds.push(bed);aliases.set(slot.id,slot.id);
  }
  for(const slot of facilitySlots(g,b,'heal')){
   const bed=beds.find(bed=>bed.buildingId===b.instanceId&&scenicDistance(bed.position,slot.position)<.01);
   if(bed)aliases.set(slot.id,bed.slotId);
  }
 }
 const value={g,revision,beds,aliases,byId:new Map(beds.map(b=>[b.slotId,b])),usability:new Map(),routes:new Map()};catalogueCache.set(s,value);return value;
}
function cachedRoute(c,from,to){
 if(!from||!to)return null;const key=`${from.x}/${from.y}>${to.x}/${to.y}`;
 if(!c.routes.has(key)){if(c.routes.size>=256)c.routes.clear();c.routes.set(key,route(c.g,from,to));}return c.routes.get(key);
}
/** Keep geometry-only proofs across an atomic command; bind bed records to the new world. */
export function inheritResidentialGeometryCache(previous,next){
 const before=catalogueCache.get(previous);if(!before)return;
 const after=bedCatalogue(next);if(before.revision!==after.revision)return;
 after.usability=new Map(before.usability);
 after.routes=new Map([...before.routes].map(([key,path])=>[key,path?.map(point=>({...point}))??null]));
}
function bodyReservations(s,c,bed){return Object.values(s.reservationsById||{}).filter(r=>['slot','sr-slot'].includes(r.kind)&&c.aliases.get(r.slotId)===bed.slotId);}
function actualBodyBed(s,c,personId,{executing=false}={}){
 const p=s.personsById?.[personId],a=s.activitiesById?.[p?.activityId];
 if(!a||a.kind!=='facility'||a.personId!==personId||!['rest','heal'].includes(a.action)||!['navigating','executing','waiting'].includes(a.phase))return null;
 const bed=c.byId.get(c.aliases.get(a.slotId));if(!bed||a.targetId!==bed.buildingId)return null;
 const r=s.reservationsById?.[a.reservationId],held=bodyReservations(s,c,bed);
 if(!r||held.length!==1||held[0]!==r||r.personId!==personId||r.activityId!==a.id||r.slotId!==a.slotId)return null;
 if(executing){
  const foot=localPosition(s,p),scenic=(personId===MASTER?p:p?.mind)?.scenic,tolerance=s.spatial?.version==='spatial-metres-1'?.04:.5;
  if(a.phase!=='executing'||!foot||!scenic||scenicDistance(foot,bed.position)>=tolerance||scenicDistance(scenic,bed.position)>=tolerance||scenicSweep(c.g,foot,bed.position).blocked)return null;
 }
 return bed;
}
function usableReason(s,c,bed){
 if(c.usability.has(bed.slotId))return c.usability.get(bed.slotId);
 const reason=calculateUsableReason(s,c,bed);c.usability.set(bed.slotId,reason);return reason;
}
function calculateUsableReason(s,c,bed){
 const b=bed.building;
 if(b.type==='hall'&&s.story?.opening&&s.story.opening.hallPhase!=='complete')return 'not-complete';
 if(b.disabled||b.enabled===false)return 'disabled';
 if((b.condition??100)<=0)return 'damaged';
 if(b.spatialLock)return 'construction';
 const entry=buildingAccess(c.g,b),hall=buildings(s).find(b=>b.type==='hall'),anchor=hall?buildingAccess(c.g,hall):entry;
 if(cachedRoute(c,entry,bed.position)===null||cachedRoute(c,anchor,entry)===null)return 'no-path';
 return null;
}
function claims(ledger){
 const result=new Map();for(const r of Object.values(ledger?.recordsByPersonId||{}))for(const kind of ['home','pending'])if(r[kind])result.set(r[kind].slotId,{personId:r.personId,kind});return result;
}
function availability(s,c,ledger,bed,personId){
 const code=usableReason(s,c,bed);if(code)return code;
 const held=claims(ledger).get(bed.slotId);if(held&&held.personId!==personId)return 'claimed';
 if(bodyReservations(s,c,bed).some(r=>r.personId!==personId))return 'occupied';
 if(personId&&!routeReachable(c.g,localPosition(s,s.personsById?.[personId]),bed.position,personId))return 'no-path';
 return null;
}
const emptyRecord=personId=>({personId,home:null,pending:null,release:null});
const binding=(s,bed,source)=>({buildingId:bed.buildingId,slotId:bed.slotId,atTick:atTick(s),source});
function choose(s,c,ledger,personId,{admission=false,masterFirst=false}={}){
 const p=s.personsById?.[personId],from=localPosition(s,p);if(!from)return {buildingId:null,slotId:null,reasonCode:'person-unavailable'};
 const record=ledger.recordsByPersonId[personId],body=actualBodyBed(s,c,personId);
 const preferred=[record?.pending?.slotId,body?.slotId,record?.home?.slotId];
 for(const id of preferred){const bed=c.byId.get(id);if(bed&&!availability(s,c,ledger,bed,personId))return {buildingId:bed.buildingId,slotId:bed.slotId,reasonCode:null};}
 const candidates=[];
 for(const bed of c.beds){if(availability(s,c,ledger,bed,personId))continue;const path=cachedRoute(c,from,bed.position);candidates.push({bed,distance:scenicPathDistance(path,from)});}
 candidates.sort((a,b)=>{
  const preferredType=masterFirst?'hall':admission?'house':null;
  return (preferredType?Number(b.bed.building.type===preferredType)-Number(a.bed.building.type===preferredType):0)||a.distance-b.distance||a.bed.buildingId.localeCompare(b.bed.buildingId)||a.bed.slotId.localeCompare(b.bed.slotId,undefined,{numeric:true});
 });
 const bed=candidates[0]?.bed;return bed?{buildingId:bed.buildingId,slotId:bed.slotId,reasonCode:null}:{buildingId:null,slotId:null,reasonCode:c.beds.length&&c.beds.every(b=>usableReason(s,c,b)==='no-path')?'no-path':'no-bed'};
}

/** Strict optional-field validation. No repairs, allocation, path queries or writes. */
export function validateResidentialHousing(s){
 if(!Object.hasOwn(s,'residentialHousing'))return true;
 if(!Number.isSafeInteger(s.worldTick)||s.worldTick<0)invalid('worldTick');
 const ledger=s.residentialHousing;exactKeys(ledger,['version','activatedAtTick','recordsByPersonId'],'residentialHousing');
 if(ledger.version!==RESIDENTIAL_HOUSING_VERSION)invalid('未知住宅版本');
 tick(ledger.activatedAtTick,s,0,'activatedAtTick');if(!plain(ledger.recordsByPersonId))invalid('recordsByPersonId');
 const c=bedCatalogue(s),claimed=new Set();
 for(const [id,r]of Object.entries(ledger.recordsByPersonId)){
  exactKeys(r,['personId','home','pending','release'],`居民 ${id}`);
  if(r.personId!==id||!s.personsById?.[id]||s.personsById[id].personId!==id)invalid(`未知人物 ${id}`);
  for(const kind of ['home','pending']){
   const v=r[kind];if(v===null)continue;exactKeys(v,['buildingId','slotId','atTick','source'],`${id}.${kind}`);
   const bed=c.byId.get(v.slotId);if(!bed||bed.buildingId!==v.buildingId)invalid(`未知实体床 ${id}.${kind}`);
   if(!(kind==='home'?homeSources:pendingSources).has(v.source))invalid(`${id}.${kind}.source`);
   tick(v.atTick,s,ledger.activatedAtTick,`${id}.${kind}.atTick`);
   if(claimed.has(v.slotId))invalid(`重复床位 ${v.slotId}`);claimed.add(v.slotId);
  }
  if(r.release!==null){exactKeys(r.release,['atTick','reason'],`${id}.release`);tick(r.release.atTick,s,ledger.activatedAtTick,`${id}.release.atTick`);if(!['dead','departed'].includes(r.release.reason)||r.home||r.pending)invalid(`${id}.release`);}
 }
 return true;
}
function enabledLedger(s){validateResidentialHousing(s);if(!s.residentialHousing)fail('not-enabled');return s.residentialHousing;}

/** Explicit opt-in, once. Preserve observed bodies before allocating other residents. */
export function ensureResidentialHousing(s){
 validateResidentialHousing(s);if(s.residentialHousing)return s.residentialHousing;
 const c=bedCatalogue(s),ledger={version:RESIDENTIAL_HOUSING_VERSION,activatedAtTick:atTick(s),recordsByPersonId:{}};
 for(const id of residentIds(s)){
  const p=s.personsById?.[id];if(!p)invalid(`未知居民 ${id}`);
  const r=ledger.recordsByPersonId[id]=emptyRecord(id);
  if(!alive(p)){r.release={atTick:atTick(s),reason:'dead'};continue;}
  const observed=actualBodyBed(s,c,id,{executing:true}),travelling=actualBodyBed(s,c,id);
  if(observed&&usableReason(s,c,observed)!=='not-complete'&&!claims(ledger).has(observed.slotId))r.home=binding(s,observed,'legacy-observed');
  else if(travelling&&!claims(ledger).has(travelling.slotId)&&!availability(s,c,ledger,travelling,id))r.pending=binding(s,travelling,'legacy-placement');
 }
 for(const id of residentIds(s)){
  const r=ledger.recordsByPersonId[id];if(r.home||r.pending||r.release)continue;
  const candidate=choose(s,c,ledger,id,{masterFirst:id===MASTER});if(candidate.slotId)r.pending=binding(s,c.byId.get(candidate.slotId),'legacy-placement');
 }
 validateResidentialHousing({...s,residentialHousing:ledger});s.residentialHousing=ledger;return ledger;
}

/** Query-only compatibility preview. The caller must discard a returned clone. */
export function residentialProjectionState(s){
 if(!residentialHousingApplicable(s)||Object.hasOwn(s,'residentialHousing'))return s;
 const signature=JSON.stringify(s),cached=projectionCache.get(s);
 // Older paused saves can be queried many times before the first world step.
 // Both source facts and the private clone must be unchanged before reuse.
 if(cached?.signature===signature&&JSON.stringify(cached.preview)===cached.previewSignature)return cached.preview;
 const preview=structuredClone(s);ensureResidentialHousing(preview);
 projectionCache.set(s,{signature,preview,previewSignature:JSON.stringify(preview)});return preview;
}

/** Shared with the body's ordinary cross-purpose reservation check. */
export function residentialSlotAvailable(s,personId,slotId){
 if(!residentialHousingApplicable(s))return true;
 const preview=residentialProjectionState(s),c=bedCatalogue(preview),id=c.aliases.get(slotId);
 if(!id)return true;const held=claims(preview.residentialHousing).get(id);
 return !held||held.personId===personId;
}

/** Construction owner calls this before locking a building or taking materials. */
export function residentialBuildingChangeView(s,buildingId,{operation}={}){
 if(!residentialHousingApplicable(s)||!['upgrade','relocate','demolish'].includes(operation))return {available:true,reasonCode:null,reason:null,residentIds:[]};
 const preview=residentialProjectionState(s),b=buildings(preview).find(b=>b.instanceId===buildingId||b.id===buildingId);
 if(!b||!['hall','house'].includes(b.type))return {available:true,reasonCode:null,reason:null,residentIds:[]};
 const view=residentialHousingView(preview,{buildingId:b.instanceId});
 const residentIds=[...new Set(view.beds.flatMap(b=>[b.homePersonId,b.pendingPersonId,b.occupantPersonId]).filter(Boolean))];
 return {available:!residentIds.length,reasonCode:residentIds.length?'housing-shortage':null,
  reason:residentIds.length?'住处仍有入住承诺或在床人员，须先由本人实际迁入可达替代床，再进行改建。':null,residentIds};
}

export function chooseResidentialBed(s,personId,action='rest'){
 validateResidentialHousing(s);
 if(!s.residentialHousing)return {buildingId:null,slotId:null,reasonCode:'not-enabled'};
 if(!['rest','heal'].includes(action)||!isResident(s,personId))return {buildingId:null,slotId:null,reasonCode:'person-unavailable'};
 return choose(s,bedCatalogue(s),s.residentialHousing,personId);
}
/** The player may choose the master's own destination; NPC sleep stays autonomous. */
export function residentialRestView(s,personId,slotId){
 const result=(code,bed=null)=>({available:!code,reason:code?reasons[code]:null,reasonCode:code,candidate:bed?{buildingId:bed.buildingId,slotId:bed.slotId}:null});
 if(!residentialHousingApplicable(s))return result('not-enabled');
 const preview=residentialProjectionState(s);validateResidentialHousing(preview);
 if(personId!==MASTER||!localPosition(preview,preview.personsById[personId]))return result('person-unavailable');
 const c=bedCatalogue(preview),bed=c.byId.get(slotId);if(!bed)return result('no-bed');
 return result(availability(preview,c,preview.residentialHousing,bed,personId),bed);
}
function hasShortage(s,c,ledger){
 return residentIds(s).some(id=>{
  if(!alive(s.personsById?.[id]))return false;
  const r=ledger.recordsByPersonId[id],home=r?.home&&c.byId.get(r.home.slotId),pending=r?.pending&&c.byId.get(r.pending.slotId);
  // Initial placements count as accommodated. A lost existing home must be
  // restored or actually replaced before a further admission is promised.
  return home?!!usableReason(s,c,home):!pending||!!usableReason(s,c,pending);
 });
}
export function residentialAdmissionView(s,personId){
 validateResidentialHousing(s);const memberCount=(s.homeMemberIds||[]).length;
 const result=(code,candidate=null)=>({available:!code,reason:code?reasons[code]:null,reasonCode:code,candidate,memberLimit:RESIDENTIAL_MEMBER_LIMIT,memberCount});
 if(!s.residentialHousing)return result('not-enabled');
 if(!localPosition(s,s.personsById?.[personId]))return result('person-unavailable');
 if(!isResident(s,personId)&&memberCount>=RESIDENTIAL_MEMBER_LIMIT)return result('roster-full');
 const c=bedCatalogue(s);if(hasShortage(s,c,s.residentialHousing))return result('housing-shortage');
 const candidate=choose(s,c,s.residentialHousing,personId,{admission:true});
 return candidate.slotId?result(null,{buildingId:candidate.buildingId,slotId:candidate.slotId}):result(candidate.reasonCode);
}

/** Rechecks a command draft; source admission is committed with roster changes. */
export function reserveResidentialBed(s,personId,slotId,{source}={}){
 const ledger=enabledLedger(s);if(!['admission','autonomous-rest'].includes(source))fail('person-unavailable','住宅预留来源不符。');
 const p=s.personsById?.[personId];if(!localPosition(s,p)||source==='autonomous-rest'&&!isResident(s,personId))fail('person-unavailable');
 if(source==='admission'){const admission=residentialAdmissionView(s,personId);if(!admission.available)fail(admission.reasonCode);}
 const c=bedCatalogue(s),bed=c.byId.get(c.aliases.get(slotId));if(!bed)fail('no-bed');
 const reason=availability(s,c,ledger,bed,personId);if(reason)fail(reason);
 const prior=ledger.recordsByPersonId[personId];
 if(prior?.home?.slotId===bed.slotId){
  if(prior.pending){const next=copy(prior);next.pending=null;ledger.recordsByPersonId[personId]=next;return copy(next);}
  return copy(prior);
 }
 if(prior?.pending?.slotId===bed.slotId)return copy(prior);
 const next=prior?copy(prior):emptyRecord(personId);next.pending=binding(s,bed,source);next.release=null;
 const proposed={...ledger,recordsByPersonId:{...ledger.recordsByPersonId,[personId]:next}};
 validateResidentialHousing({...s,residentialHousing:proposed});ledger.recordsByPersonId[personId]=next;return copy(next);
}

/** Arrival must already be established by the existing exclusive body activity. */
export function settleResidentialArrival(s,personId){
 const ledger=enabledLedger(s),r=ledger.recordsByPersonId[personId];if(!r?.pending)return false;
 if(!isResident(s,personId))return false;
 const c=bedCatalogue(s),bed=actualBodyBed(s,c,personId,{executing:true});
 if(!bed||bed.slotId!==r.pending.slotId||availability(s,c,ledger,bed,personId))return false;
 r.home=binding(s,bed,'arrived');r.pending=null;r.release=null;return true;
}

/** Call after existing death/membership commands and during the formal world step. */
export function reconcileResidentialHousing(s){
 const ledger=enabledLedger(s),c=bedCatalogue(s);
 for(const r of Object.values(ledger.recordsByPersonId)){
  const p=s.personsById[r.personId],reason=!alive(p)?'dead':!isResident(s,r.personId)?'departed':null;
  if(reason){if(!r.release||r.release.reason!==reason){r.home=null;r.pending=null;r.release={atTick:atTick(s),reason};}continue;}
  if(r.release)r.release=null;
  if(r.pending&&usableReason(s,c,c.byId.get(r.pending.slotId)))r.pending=null;
 }
 // A shelter may become a house after activation, or an unplaced resident may
 // return from travel. Promise an initial bed without changing their activity.
 for(const id of residentIds(s)){
  const r=ledger.recordsByPersonId[id];if(!r||r.home||r.pending||r.release)continue;
  const candidate=choose(s,c,ledger,id,{masterFirst:id===MASTER});
  if(candidate.slotId)r.pending=binding(s,c.byId.get(candidate.slotId),'legacy-placement');
 }
 return ledger;
}

/** Derived UI data. Filters retain the global totals; all returned data is detached. */
export function residentialHousingView(s,{personId=null,buildingId=null}={}){
 validateResidentialHousing(s);const c=bedCatalogue(s),ledger=s.residentialHousing,held=claims(ledger);
 const beds=c.beds.map(bed=>{
  const code=usableReason(s,c,bed),claim=held.get(bed.slotId),rs=bodyReservations(s,c,bed),r=rs[0],a=r&&s.activitiesById?.[r.activityId];
  return {buildingId:bed.buildingId,slotId:bed.slotId,position:{...bed.position},purpose:bed.purpose,usable:!code,reasonCode:code,reason:code?reasons[code]:null,
   homePersonId:claim?.kind==='home'?claim.personId:null,pendingPersonId:claim?.kind==='pending'?claim.personId:null,
   occupantPersonId:r?.personId??null,activityPhase:a?.phase??null};
 });
 const ids=[...new Set([...residentIds(s),...Object.keys(ledger?.recordsByPersonId||{})])];
 const residents=ids.map(id=>{
  const r=ledger?.recordsByPersonId[id]||emptyRecord(id),home=c.byId.get(r.home?.slotId),pending=c.byId.get(r.pending?.slotId);
  const reasonCode=r.release?null:home?usableReason(s,c,home):pending?usableReason(s,c,pending):'no-bed';
  return {...copy(r),isResident:isResident(s,id),reasonCode,reason:reasonCode?reasons[reasonCode]:null};
 });
 const free=beds.filter(b=>b.usable&&!b.homePersonId&&!b.pendingPersonId&&!b.occupantPersonId).length;
 const unassigned=residentIds(s).filter(id=>alive(s.personsById?.[id])&&!ledger?.recordsByPersonId[id]?.home&&!ledger?.recordsByPersonId[id]?.pending).length;
 const counts={physical:beds.length,usable:beds.filter(b=>b.usable).length,settled:residents.filter(r=>r.home).length,pending:residents.filter(r=>r.pending).length,
  occupied:beds.filter(b=>b.occupantPersonId&&actualBodyBed(s,c,b.occupantPersonId,{executing:true})?.slotId===b.slotId).length,
  unassignedResidents:unassigned,freeForAdmission:!ledger||hasShortage(s,c,ledger)?0:Math.min(free,Math.max(0,RESIDENTIAL_MEMBER_LIMIT-(s.homeMemberIds||[]).length))};
 return {enabled:!!ledger,version:ledger?.version??null,counts,
  beds:beds.filter(b=>(!buildingId||b.buildingId===buildingId)&&(!personId||[b.homePersonId,b.pendingPersonId,b.occupantPersonId].includes(personId))),
  residents:residents.filter(r=>(!personId||r.personId===personId)&&(!buildingId||[r.home?.buildingId,r.pending?.buildingId].includes(buildingId)))};
}
