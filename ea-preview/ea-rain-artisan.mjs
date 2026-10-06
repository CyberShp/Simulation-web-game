/** Author card: docs/design/content/rain-artisan-v1.2.json. No runtime AI. */
import {canPay,pay,grant,log} from './ea-data.mjs?v=ea-160-sr-qa-20261006-r3';
import {buildingAccess,scenicFindPath,scenicDistance,scenicSweep,geometryRevision} from './ea-scene-geometry.mjs?v=ea-160-sr-qa-20261006-r3';
import {areaPoint,advanceScenic,validateScenic} from './ea-scenic.mjs?v=ea-160-sr-qa-20261006-r3';
import {prepareFacilityActivity,releaseBodyActivity} from './ea-facility-activities.mjs?v=ea-160-sr-qa-20261006-r3';
import {sceneUnits,spatialEnabled} from './ea-sr-spatial.mjs?v=ea-160-sr-qa-20261006-r3';
const gatePoint=s=>spatialEnabled(s)?{x:32,y:56}:areaPoint('gate');
const PERSON_ID='person:cheng-wenzhou',ORDER_ID='work:rain-artisan:care',MEDICINE_ID='reservation:rain-artisan:medicine';
export function initRainArtisan(s,addPerson){
 const members=s.homeMemberIds.slice(),logs=s.logs.slice();s.homeMemberIds=[];const p=addPerson(s,{name:'程问舟',root:'土灵根',portrait:3,talent:1.02,goal:'修器养家',traits:[66,38,84,78,55]});
 delete s.personsById[p.personId];p.personId=PERSON_ID;s.personsById[PERSON_ID]=p;s.homeMemberIds=members;s.logs=logs;p.wound=35;
 p.mind.reason='为石桥驿赶工，雨夜滑伤后自行包扎，准备求助。';
 s.story.artisan={personId:PERSON_ID,phase:'dormant',arrivedTick:null,careResultId:null,recoveryTicks:0};
}
export function artisanPresent(s){return home(s)&&['arriving','present','care','recovering','recovered','departing'].includes(s.story.artisan?.phase);}
export function treatmentStatus(s){const o=s.workOrdersById?.[ORDER_ID];return o?.phase==='active'?o:null;}
function home(s){return !s.world.exploration&&!s.master.journey&&s.combat?.status!=='active';}
function walk(s,p,target){const a=p.mind.scenic,path=scenicFindPath(s,a,target);if(path===null)return false;a.path=path;a.goal={...target};a.revision=geometryRevision(s);delete a.destinationId;return true;}
export function artisanCareView(s){
 const event=s.story.artisan;if(!home(s)||!event||event.phase==='dormant'||event.phase==='departed')return null;
 const p=s.personsById[event.personId],order=treatmentStatus(s);
 return {personId:p.personId,id:p.id,name:p.name,phase:event.phase,wound:p.wound,arrivedTick:event.arrivedTick,
  progress:order?{value:order.progressTicks,total:order.durationTicks}:null,
  text:event.phase==='arriving'?'雨夜滑伤的修器匠正从山门缓步前来。':event.phase==='care'?'双方须到照护位置，换药随世界时间完成。':event.phase==='recovering'?'已经换药，正在原地休养；掌门可继续其他事务。':event.phase==='recovered'?'伤势已经恢复，程问舟记下了这次照料。':event.phase==='departing'?'程问舟已告辞，沿山路下山。':'旧绷带浸湿，程问舟想借院前干燥地方换药。他愿意接受用途明确的草药照料。',
  careLock:!home(s)?'先回到山院':event.phase!=='present'?'此时尚不能重新换药':s.master.wound>0?'掌门先养好伤势':s.master.energy<15?'掌门先恢复精力':!canPay(s,{herb:8})?'需灵草8份':'',
  canDecline:event.phase==='present'};
}
export function offerArtisanCare(s){
 const view=artisanCareView(s);if(!view||view.careLock)throw Error(view?.careLock||'伤匠尚未到访。');
 const event=s.story.artisan,p=s.personsById[event.personId],hall=s.buildings.find(b=>b.type==='hall');
 releaseBodyActivity(s,s.master);s.master.action='rest';s.master.teaching=null;
 // Offering care is accepted by this conscious, willing visitor. Membership,
 // private tools and later cooperation are not transferred by acceptance.
 p.mind.activity='heal';event.phase='care';
 prepareFacilityActivity(s,p,hall,'care',0);prepareFacilityActivity(s,s.master,hall,'care',0);
 pay(s,{herb:8});s.reservationsById[MEDICINE_ID]={id:MEDICINE_ID,kind:'care-medicine',workOrderId:ORDER_ID,cost:{herb:8}};
 s.workOrdersById[ORDER_ID]={id:ORDER_ID,kind:'treatment',targetId:p.personId,phase:'active',startWound:p.wound,progressTicks:0,durationTicks:250,reservationId:MEDICINE_ID,activityIds:[p.activityId,s.master.activityId],resultTransactionId:null};
 log(s,'程问舟接受换药照料。灵草8份已备好，双方先到院前照护席。');return {personId:p.personId,pending:true};
}
export function cancelArtisanCare(s){
 const o=treatmentStatus(s);if(!o)throw Error('当前没有伤匠治疗。');
 const refund={herb:8*(1-o.progressTicks/o.durationTicks)};grant(s,refund);
 delete s.reservationsById[MEDICINE_ID];delete s.workOrdersById[ORDER_ID];releaseBodyActivity(s,s.master);
 const event=s.story.artisan,p=s.personsById[event.personId];releaseBodyActivity(s,p);p.mind.activity='rest';event.phase='present';s.master.action='rest';
 log(s,'换药中止，尚未用去的灵草退回；伤匠仍在院前，可先补药或休息。');return refund;
}
export function declineArtisanCare(s){
 const event=s.story.artisan;if(event?.phase!=='present'||!home(s))throw Error('当前无法送别伤匠。');
 const p=s.personsById[event.personId];releaseBodyActivity(s,p);event.phase='departing';p.mind.activity='rest';walk(s,p,gatePoint(s));
 log(s,'程问舟理解山院暂时无法照料，收好随身工具，沿山路离开。');return true;
}
export function advanceRainArtisan(s){
 const event=s.story.artisan;if(!event)return;const p=s.personsById[event.personId];if(!p||p.lifeStatus==='dead'||p.life?.status==='dead'||p.dead||p.historicalOnly)return;const hall=s.buildings.find(b=>b.type==='hall');
 if(event.phase==='dormant'){
  if(!home(s)||s.story.step<4||!s.story.onboarding.productions.length)return;
  Object.assign(p.mind.scenic,gatePoint(s),{path:[],goal:null,revision:geometryRevision(s)});walk(s,p,buildingAccess(s,hall));event.phase='arriving';
  log(s,'山门传来呼唤：一名雨夜滑伤的修器匠正缓步上山。');return;
 }
 if(event.phase==='arriving'||event.phase==='departing'){
  advanceScenic(p.mind.scenic,2.2,s);
  const goal=event.phase==='arriving'?buildingAccess(s,hall):gatePoint(s);
  if(!p.mind.scenic.path.length&&scenicDistance(p.mind.scenic,goal)<sceneUnits(s,1)){
   event.phase=event.phase==='arriving'?'present':'departed';
   if(event.phase==='present'){event.arrivedTick=s.worldTick;if(home(s))log(s,'程问舟来到院前，请求换药。可走近了解、暂缓，或提供8份灵草照料。');}
  }return;
 }
 if(event.phase==='care'){
  const o=treatmentStatus(s),patientReady=prepareFacilityActivity(s,p,hall,'care',2.2),masterReady=prepareFacilityActivity(s,s.master,hall,'care',4.6);
  if(!patientReady||!masterReady||!home(s)||s.master.energy<1)return;
  s.master.energy=Math.max(0,s.master.energy-.015);o.progressTicks++;p.wound=Math.max(10,o.startWound-(o.startWound-10)*o.progressTicks/o.durationTicks);
  if(o.progressTicks!==o.durationTicks)return;
  delete s.reservationsById[MEDICINE_ID];o.phase='completed';o.resultTransactionId='result:rain-artisan:care';event.careResultId=o.resultTransactionId;event.phase='recovering';p.wound=10;
  releaseBodyActivity(s,s.master);s.master.action='rest';
  if(!s.factsById['fact:rain-artisan:cooperation']){
   s.factsById['fact:rain-artisan:cooperation']={id:'fact:rain-artisan:cooperation',sourcePersonId:p.personId,knownBy:['person:master',p.personId],locationId:'location:stonebridge',createdTick:s.worldTick};
   p.mind.relationships.master.trust=Math.min(100,p.mind.relationships.master.trust+12);
   p.mind.memories.unshift({time:s.time,text:s.master.name+'亲自备药、换药，未要求交出工具或留下效力。',important:true,public:true,key:'rain-artisan:care'});
   s.master.memories.unshift({time:s.time,text:'为程问舟换药。他提及石桥驿的修器活计，愿在康复后与山院往来。'});
  }
  log(s,'换药完成，程问舟伤势稳定，接着在照护席休养；掌门可以继续行动。');return;
 }
 if(event.phase==='recovering'){
  if(!prepareFacilityActivity(s,p,hall,'care',2.2))return;
  event.recoveryTicks++;p.wound=Math.max(0,10*(1-event.recoveryTicks/200));
  if(event.recoveryTicks===200){p.wound=0;releaseBodyActivity(s,p);event.phase='recovered';p.mind.activity='rest';log(s,'程问舟休养后恢复行走，向掌门道谢。石桥驿的修器往来已记在纪事中。');}
 }
}
export function validateRainArtisan(s){
 const e=s.story.artisan;if(!e){if(Object.values(s.workOrdersById).some(o=>o.kind==='treatment')||Object.values(s.reservationsById).some(r=>r.kind==='care-medicine'))throw Error('存档校验失败：治疗缺少来客事件');return true;}const fail=()=>{throw Error('存档校验失败：伤匠治疗记录异常');},p=s.personsById[e.personId],o=s.workOrdersById[ORDER_ID],r=s.reservationsById[MEDICINE_ID];
 if(Object.values(s.workOrdersById).some(o=>o.kind==='treatment'&&o.id!==ORDER_ID)||Object.values(s.reservationsById).some(r=>r.kind==='care-medicine'&&r.id!==MEDICINE_ID))fail();
 const feet=p?.mind?.scenic;
 if(!feet||!Number.isFinite(feet.x)||!Number.isFinite(feet.y)||!Number.isFinite(feet.steps)||feet.steps<0||![1,-1].includes(feet.facing)||typeof feet.back!=='boolean'||!Array.isArray(feet.path)||feet.path.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))fail();
 const atCourtyard=!spatialEnabled(s)||p.position?.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard';
 if(atCourtyard&&!['dormant','departed'].includes(e.phase)&&!validateScenic(feet,s))fail();
 if(e.personId!==PERSON_ID||!p||s.homeMemberIds.includes(p.personId)||!['dormant','arriving','present','care','recovering','recovered','departing','departed'].includes(e.phase)||!Number.isSafeInteger(e.recoveryTicks)||e.recoveryTicks<0||e.recoveryTicks>200||e.arrivedTick!==null&&(!Number.isSafeInteger(e.arrivedTick)||e.arrivedTick<0||e.arrivedTick>s.worldTick)||!p.mind.scenic||p.wound<0||p.wound>35)fail();
 if(o){if(o.id!==ORDER_ID||o.kind!=='treatment'||o.targetId!==PERSON_ID||!['active','completed'].includes(o.phase)||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>250||o.durationTicks!==250||!Number.isFinite(o.startWound)||o.startWound<10||o.startWound>35||o.reservationId!==MEDICINE_ID)fail();
  if(o.phase==='active'){if(e.phase!=='care'||o.progressTicks===250||o.resultTransactionId!==null||!r||r.id!==MEDICINE_ID||r.kind!=='care-medicine'||r.workOrderId!==ORDER_ID||r.cost?.herb!==8||Object.keys(r.cost).length!==1||o.activityIds.length!==2||new Set(o.activityIds).size!==2||!o.activityIds.every(id=>s.activitiesById[id]?.action==='care')||!o.activityIds.every(id=>[PERSON_ID,'person:master'].includes(s.activitiesById[id]?.personId)))fail();}
  else if(r||o.progressTicks!==250||o.resultTransactionId!=='result:rain-artisan:care'||e.careResultId!==o.resultTransactionId||!['recovering','recovered'].includes(e.phase))fail();
 }else if(e.phase==='care'||e.phase==='recovering'||e.phase==='recovered'||r||e.careResultId!==null)fail();
 const fact=s.factsById['fact:rain-artisan:cooperation'];if(fact&&(fact.id!=='fact:rain-artisan:cooperation'||fact.sourcePersonId!==PERSON_ID||fact.locationId!=='location:stonebridge'||!Array.isArray(fact.knownBy)||fact.knownBy.length!==2||!fact.knownBy.includes(PERSON_ID)||!fact.knownBy.includes('person:master')||!Number.isSafeInteger(fact.createdTick)||fact.createdTick<0||fact.createdTick>s.worldTick))fail();
 if(e.careResultId&&(!s.factsById['fact:rain-artisan:cooperation']||p.mind.memories.filter(m=>m.key==='rain-artisan:care').length!==1))fail();
 return true;
}
