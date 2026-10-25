/** GC15: finite visitor accommodation on exclusive physical guest beds. */
import {COURTYARD_VISITOR_WALK_BUDGET} from './ea-courtyard-visitors.mjs';
import {facilitySlots,slotReservation} from './ea-facility-slots.mjs';
import {prepareFacilityActivity,releaseBodyActivity} from './ea-facility-activities.mjs';
import {courtyardSeekerView,courtyardSeekerAssessment} from './ea-courtyard-seekers.mjs';
import {scenicFindPath,scenicDistance,scenicSweep} from './ea-scene-geometry.mjs';
import {visibleBodyPointClear,visibleBodyRouteClear} from './ea-sr-spatial.mjs';
export const GUEST_LODGING_VERSION='guest-lodging:yunxiu:v1';
const visit=(s,id)=>s.courtyardSeekers?.recordsByPersonId?.[id]?.visits?.at(-1);
const active=s=>(s.guestLodging?.stays||[]).filter(x=>x.releasedTick===null);
const publicStay=stay=>{const {assessment,...visible}=stay;return structuredClone(visible);};
const publicAnswer=answer=>answer?{accepted:answer.accepted,personId:answer.personId,visitNumber:answer.visitNumber,atTick:answer.atTick,reason:answer.reason,factId:answer.factId}:null;
const usable=b=>b?.type==='guesthouse'&&b.enabled!==false&&!b.disabled&&!b.spatialLock&&b.condition>0;
function beds(s,all=false){return Object.values(s.buildingsById||{}).filter(b=>all?b.type==='guesthouse':usable(b)).flatMap(b=>facilitySlots(s,b,'guest-bed').map(slot=>({...slot,buildingId:b.instanceId})));}
function offerCheck(s,personId,options={}){
 const p=s.personsById?.[personId],v=visit(s,personId),view=courtyardSeekerView(s,personId);
 const c=view?.conditions?.slice(0,4).find(x=>!x.met);
 if(!p||!view||c||!Number.isSafeInteger(v?.deadlineTick)||v.deadlineTick<=s.worldTick||v.endedAtTick!==null)return {reason:c?.reason||'来客尚未实际到院或停留期限已过。'};
 const slot=beds(s).find(b=>(!options.buildingId||b.buildingId===options.buildingId)&&!active(s).some(x=>x.slotId===b.id)&&!slotReservation(s,b.id)&&scenicFindPath(s,p.mind.scenic,b.position,{maxSnap:0})!==null);
 return slot?{slot,p,v}:{reason:'当前没有可达的空客床。'};
}
/** A read-only, physically reachable conversation position beside an occupied guest bed. */
function conversationPoint(s,stay){
 if(stay?.phase!=='staying'||!usable(s.buildingsById[stay.buildingId]))return null;
 const p=s.personsById[stay.personId],master=s.personsById['person:master'],at=p?.mind?.scenic,from=master?.scenic;
 if(!at||!from||master.lifeStatus==='dead'||master.position?.sceneId!==p.position?.sceneId||p.lifeStatus==='dead'||p.courtyardVisit?.phase!=='present'||s.homeMemberIds.includes(stay.personId))return null;
 const people=Object.values(s.personsById).filter(q=>q.personId!==master.personId&&q.lifeStatus!=='dead'&&q.position?.kind==='scene'&&q.position.sceneId===p.position.sceneId).map(q=>q.mind?.scenic||q.scenic).filter(Boolean);
 const points=Array.from({length:8},(_,i)=>({x:at.x+Math.cos(i*Math.PI/4),y:at.y+Math.sin(i*Math.PI/4)})).sort((a,b)=>scenicDistance(from,a)-scenicDistance(from,b));
 for(const point of points){
  if(!visibleBodyPointClear(s,point)||people.some(q=>scenicDistance(q,point)<.55))continue;
  const path=scenicFindPath(s,from,point,{maxSnap:0});if(path===null||!visibleBodyRouteClear(s,from,path))continue;
  let prior=from,clear=true;for(const next of path){if(scenicSweep(s,prior,next).blocked){clear=false;break;}prior=next;}if(clear)return point;
 }
 return null;
}
export function guestLodgingView(s,personId){
 if(personId){const stay=active(s).find(x=>x.personId===personId),check=offerCheck(s,personId),v=visit(s,personId);return {personId,canOffer:!stay&&!check.reason,reason:stay?'已接受客院住宿。':check.reason||'',status:stay?'lodging':'visitor',phase:stay?.phase||null,buildingId:stay?.buildingId||null,slotId:stay?.slotId||null,deadlineTick:v?.deadlineTick||null,conversationPoint:conversationPoint(s,stay),lastAnswer:publicAnswer(s.guestLodging?.answers?.findLast(x=>x.personId===personId))};}
 const stays=active(s),list=beds(s,true).map(b=>({...b,usable:usable(s.buildingsById[b.buildingId]),personId:stays.find(x=>x.slotId===b.id)?.personId||null}));
 return {version:GUEST_LODGING_VERSION,beds:list,counts:{physical:list.length,usable:list.filter(b=>b.usable).length,occupied:stays.length,pending:stays.filter(x=>x.arrivedTick===null).length,settled:stays.filter(x=>x.arrivedTick!==null).length,free:list.filter(b=>b.usable&&!b.personId&&!slotReservation(s,b.id)).length},guests:stays.map(publicStay),stays:(s.guestLodging?.stays||[]).map(publicStay)};
}
function record(s,stay,event){const id=`fact:guest-lodging:${stay.id}:${event}`;s.factsById[id]={id,kind:'guest-lodging',event,stayId:stay.id,personId:stay.personId,buildingId:stay.buildingId,slotId:stay.slotId,atTick:s.worldTick};return id;}
export function offerGuestLodging(s,personId,options={}){
 // The command gateway supplies one object; direct callers may use the explicit id API.
 if(personId&&typeof personId==='object'){options=personId;personId=options.personId;}
 const prior=active(s).find(x=>x.personId===personId);if(prior)return {accepted:true,personId,stayId:prior.id,phase:prior.phase};
 const check=offerCheck(s,personId,options);if(check.reason)throw Error(check.reason);
 const {p,v,slot}=check,judgement=courtyardSeekerAssessment(s,p),signature=JSON.stringify(judgement.inputs);
 if(!judgement.willing){
  const ledger=s.guestLodging||{version:GUEST_LODGING_VERSION,stays:[],answers:[]};
  const prior=ledger.answers.findLast(x=>x.personId===personId&&x.visitNumber===v.number&&x.signature===signature);if(prior)return publicAnswer(prior);
  const answer={accepted:false,personId,visitNumber:v.number,atTick:s.worldTick,signature,reason:'来客希望保持自己的行止，暂不接受住宿邀请。',factId:`fact:guest-lodging:answer:${ledger.answers.length+1}`};
  s.guestLodging=ledger;ledger.answers.push(answer);s.factsById[answer.factId]={id:answer.factId,kind:'guest-lodging-answer',...structuredClone(answer)};return publicAnswer(answer);
 }
 const ledger=s.guestLodging||{version:GUEST_LODGING_VERSION,stays:[],answers:[]},stay={id:`${personId}:${v.number}:${ledger.stays.length+1}`,personId,visitNumber:v.number,buildingId:slot.buildingId,slotId:slot.id,offeredTick:s.worldTick,expiresTick:v.deadlineTick,arrivedTick:null,releasedTick:null,releaseReason:null,phase:'navigating',assessment:judgement,offerFactId:null,arrivalFactId:null,releaseFactId:null};
 const before={activity:p.mind.activity,reason:p.mind.reason,scenic:structuredClone(p.mind.scenic),activityId:p.activityId,activities:{...s.activitiesById},reservations:{...s.reservationsById}};
 p.mind.activity='guest-bed';p.mind.reason='接受客院邀请，前往客床。';
 prepareFacilityActivity(s,p,s.buildingsById[stay.buildingId],'guest-bed',0,{slotId:stay.slotId});
 const body=s.activitiesById[p.activityId];if(body?.slotId!==stay.slotId||!s.reservationsById[body.reservationId]){Object.assign(p.mind,{activity:before.activity,reason:before.reason,scenic:before.scenic});p.activityId=before.activityId;s.activitiesById=before.activities;s.reservationsById=before.reservations;throw Error('客床身体预约未能成立。');}
 s.guestLodging=ledger;ledger.stays.push(stay);stay.offerFactId=record(s,stay,'offered');
 return {accepted:true,personId,stayId:stay.id,phase:stay.phase};
}
export function advanceGuestLodging(s,{reconcileOnly=false}={}){
 for(const stay of active(s)){
  const p=s.personsById[stay.personId],b=s.buildingsById[stay.buildingId],v=visit(s,stay.personId);
  const reason=p?.lifeStatus==='dead'?'death':s.homeMemberIds.includes(stay.personId)?'admitted':!usable(b)?'facility-unavailable':!v||v.number!==stay.visitNumber||v.endedAtTick!==null||p.courtyardVisit?.phase!=='present'||s.worldTick>=v.deadlineTick?'visit-ended':null;
  if(reason){if(s.activitiesById[p.activityId]?.action==='guest-bed')releaseBodyActivity(s,p);stay.releasedTick=s.worldTick;stay.releaseReason=reason;stay.phase='released';stay.releaseFactId=record(s,stay,'released');if(p.mind.activity==='guest-bed')p.mind.activity='rest';continue;}
  if(reconcileOnly)continue;
  p.mind.activity='guest-bed';
  if(prepareFacilityActivity(s,p,b,'guest-bed',COURTYARD_VISITOR_WALK_BUDGET,{slotId:stay.slotId})&&stay.arrivedTick===null){stay.arrivedTick=s.worldTick;stay.phase='staying';stay.arrivalFactId=record(s,stay,'arrived');p.mind.reason='已在客院暂住，仍按原行程离院。';}
 }
}
export function validateGuestLodging(s){
 const ledger=s.guestLodging;if(ledger===undefined){if(Object.values(s.factsById||{}).some(f=>f.kind?.startsWith('guest-lodging'))||Object.values(s.activitiesById||{}).some(a=>a.action==='guest-bed'))throw Error('存档校验失败：客院住宿根记录缺失。');return true;}
 const fail=()=>{throw Error('存档校验失败：客院住宿引用或时序异常，原存档保留。');},tick=n=>Number.isSafeInteger(n)&&n>=0&&n<=s.worldTick,ids=new Set(),occupied=new Set(),people=new Set();
 if(ledger?.version!==GUEST_LODGING_VERSION||!Array.isArray(ledger.stays)||!Array.isArray(ledger.answers))fail();
 for(const answer of ledger.answers){const f=s.factsById[answer.factId];if(!f||f.kind!=='guest-lodging-answer'||!tick(answer.atTick)||answer.accepted!==false||!s.personsById[answer.personId]||Object.keys(answer).some(k=>JSON.stringify(f[k])!==JSON.stringify(answer[k])))fail();}
 for(const [index,stay] of ledger.stays.entries()){
  const p=s.personsById[stay.personId],v=s.courtyardSeekers?.recordsByPersonId?.[stay.personId]?.visits?.find(x=>x.number===stay.visitNumber);
  if(!p||!v||ids.has(stay.id)||stay.id!==`${stay.personId}:${stay.visitNumber}:${index+1}`||!tick(stay.offeredTick)||!Number.isSafeInteger(stay.expiresTick)||stay.expiresTick<=stay.offeredTick||stay.expiresTick>v.deadlineTick||!['navigating','staying','released'].includes(stay.phase))fail();ids.add(stay.id);
  for(const [event,field,time] of [['offered','offerFactId','offeredTick'],['arrived','arrivalFactId','arrivedTick'],['released','releaseFactId','releasedTick']]){const at=stay[time],f=s.factsById[stay[field]];if(at===null){if(stay[field]!==null)fail();}else if(!tick(at)||at<stay.offeredTick||!f||f.kind!=='guest-lodging'||f.event!==event||f.stayId!==stay.id||f.atTick!==at||f.personId!==stay.personId||f.buildingId!==stay.buildingId||f.slotId!==stay.slotId)fail();}
  if(stay.arrivedTick!==null&&stay.releasedTick!==null&&stay.arrivedTick>stay.releasedTick||stay.phase==='staying'&&stay.arrivedTick===null||stay.phase==='navigating'&&stay.arrivedTick!==null)fail();
  if(stay.releasedTick===null){const b=s.buildingsById[stay.buildingId],a=s.activitiesById[p.activityId];if(!usable(b)||occupied.has(stay.slotId)||people.has(stay.personId)||!facilitySlots(s,b,'guest-bed').some(x=>x.id===stay.slotId)||a?.action!=='guest-bed'||a.slotId!==stay.slotId||a.targetId!==stay.buildingId||s.reservationsById[a.reservationId]?.slotId!==stay.slotId||stay.phase==='released')fail();occupied.add(stay.slotId);people.add(stay.personId);}else if(stay.phase!=='released'||!['death','admitted','facility-unavailable','visit-ended'].includes(stay.releaseReason))fail();
 }
 for(const f of Object.values(s.factsById)){if(f.kind==='guest-lodging'&&!ledger.stays.some(x=>x.id===f.stayId&&[x.offerFactId,x.arrivalFactId,x.releaseFactId].includes(f.id))||f.kind==='guest-lodging-answer'&&!ledger.answers.some(x=>x.factId===f.id))fail();}
 return true;
}
