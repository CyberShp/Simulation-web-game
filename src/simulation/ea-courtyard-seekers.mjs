/** U-111/U-155/U-167, T-23: ordinary southern-road callers and their durable answers. */
import {TECHNIQUES,log} from './ea-data.mjs';
import {createWorldPerson,foodDemand} from './ea-sim.mjs';
import {rememberPerson} from './ea-society.mjs';
import {initPersons} from './ea-sr-persons.mjs';
import {initCultivation,teachingQualificationSR,artStudyRequirement} from './ea-sr-cultivation.mjs';
import {hydrateWorldPositionSR} from './ea-sr-world.mjs';
import {COURTYARD_VISITOR_ROAD,beginCourtyardVisit,advanceCourtyardVisitor,departCourtyardVisitor} from './ea-courtyard-visitors.mjs';
import {routeReachable} from './ea-route-reachability.mjs';
import {facilitySlots} from './ea-facility-slots.mjs';
import {buildingAccess,scenicDistance} from './ea-scene-geometry.mjs';
import {SPATIAL_SCENE} from './ea-sr-spatial.mjs';
import {residentialProjectionState,residentialHousingView,ensureResidentialHousing,residentialAdmissionView,reserveResidentialBed} from './ea-residential-housing.mjs';

export const COURTYARD_SEEKERS_VERSION='courtyard-seekers:yunxiu:v1';
export const SEEKER_SOURCE='yunxiu:south-road-seekers';
export const SEEKER_RULES=Object.freeze({firstTicks:600,intervalTicks:1800,stayTicks:1200,deferTicks:600,returnTicks:2400,threshold:50,opportunityBonus:8});
const MASTER='person:master',HOME='stockpile:yunxiu',ENTRY=COURTYARD_VISITOR_ROAD[0],TARGET=COURTYARD_VISITOR_ROAD.at(-1);
const clone=v=>structuredClone(v),plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const current=r=>r?.visits?.at(-1),mind=p=>p?.personId===MASTER?p:p?.mind;
const living=p=>!!p&&p.lifeStatus!=='dead'&&!p.left&&!p.mind?.away&&!p.mind?.journey&&!p.journey;
const local=p=>living(p)&&p.position?.kind==='scene'&&p.position.sceneId===SPATIAL_SCENE.id;
const publicAnswer=a=>a?{type:a.type,atTick:a.atTick,reason:a.reason,factId:a.factId}:null;
const conditionLabels={world:'正式山院',hall:'主殿可接待',opening:'林长风入院商议已完成',road:'南山道通达',housing:'有可达空床',food:'备足一日食粮',member:'尚未录入门籍',arrival:'来客已实际抵院',distance:'掌门已走近',bodies:'双方可当面交谈',limit:'名册尚有余位'};
const presentConditions=cs=>cs.map(c=>({...c,label:conditionLabels[c.id]||c.id,reason:c.met?'':c.reason}));
const sourceRecord=(s,id)=>s.courtyardSeekers?.recordsByPersonId?.[id];
const factPrefix='fact:courtyard-seeker:';
function fact(s,id,value){if(s.factsById[id])throw Error('求见事实已登记。');s.factsById[id]={id,...clone(value)};return id;}
function recordFact(s,r,event,fields={}){const v=current(r),id=`${factPrefix}${r.personId}:${v.number}:${event}`;return fact(s,id,{kind:'courtyard-seeker-event',personId:r.personId,visitNumber:v.number,event,atTick:s.worldTick,...fields});}
function foodView(s){const available=s.stockpilesById?.[HOME]?.resources?.food??0,needed=foodDemand(s)+2;return {available,needed,met:available>=needed};}
function roadReady(s){return COURTYARD_VISITOR_ROAD.slice(1).every((to,i)=>routeReachable(s,COURTYARD_VISITOR_ROAD[i],to,`seeker:road:${i}`));}
function housingView(s){return residentialHousingView(s.residentialHousing?s:residentialProjectionState(s));}
function receptionConditions(s){
 const sr=s.contentVersion==='sr-content-v1.2'&&s.spatial?.version==='spatial-metres-1',hall=Object.values(s.buildingsById||{}).find(b=>b.type==='hall'),food=foodView(s);
 const housing=sr?housingView(s):null;
 const conditions=[
  {id:'world',met:sr,reason:'接待需在正式山院内开启。'},
  {id:'hall',met:!!hall&&s.story?.opening?.hallPhase==='complete'&&hall.enabled!==false&&!hall.spatialLock&&hall.condition>0,reason:'主殿建成并可使用后再接待求道者。'},
  {id:'opening',met:s.story?.step>=3,reason:'先完成林长风的入院商议，再开放日常接待。'},
  {id:'road',met:sr&&roadReady(s),reason:'南山道或院前接待点暂不可达。'},
  {id:'housing',met:(housing?.counts.freeForAdmission??0)>0,reason:'先为新增门人准备一张可达空床。'},
  {id:'food',met:food.met,reason:`主殿公库需保有至少 ${food.needed} 份可用食粮，供新增一人后的一日生活。`},
 ];
 return {conditions,food,housing,available:conditions.every(c=>c.met),reason:conditions.find(c=>!c.met)?.reason||''};
}
export function courtyardReceptionView(s){
 const c=receptionConditions(s),ledger=s.courtyardSeekers;
 return {version:ledger?.version??null,enabled:ledger?.enabled??false,canEnable:c.available,reason:c.reason,conditions:presentConditions(c.conditions),food:c.food,
  freeBeds:c.housing?.counts.freeForAdmission??0,nextOpportunityTick:ledger?.nextOpportunityTick??null,
  callers:Object.keys(ledger?.recordsByPersonId||{}).map(id=>({personId:id,name:s.personsById[id]?.name||'',visitNumber:current(ledger.recordsByPersonId[id]).number,phase:s.personsById[id]?.courtyardVisit?.phase,admitted:s.homeMemberIds.includes(id)}))};
}
export function setCourtyardReception(s,{enabled}={}){
 if(typeof enabled!=='boolean')throw Error('请选择是否开启山门接待。');
 let ledger=s.courtyardSeekers;
 if(!ledger&&!enabled)return {enabled:false};
 if(ledger?.enabled===enabled)return {enabled};
 if(enabled){const c=receptionConditions(s);if(!c.available)throw Error(c.reason);ensureResidentialHousing(s);}
 if(!ledger)ledger=s.courtyardSeekers={version:COURTYARD_SEEKERS_VERSION,enabledAtTick:s.worldTick,enabled:false,nextOpportunityTick:s.worldTick+SEEKER_RULES.firstTicks,lastProcessedTick:s.worldTick,policies:[],recordsByPersonId:{}};
 ledger.enabled=enabled;
 const change={enabled,atTick:s.worldTick,factId:`${factPrefix}policy:${ledger.policies.length+1}`};ledger.policies.push(change);
 fact(s,change.factId,{kind:'courtyard-seeker-policy',enabled,atTick:s.worldTick,version:COURTYARD_SEEKERS_VERSION});
 log(s,enabled?'山门开放日常接待，来客将循南山道求见。':'山门暂缓新的接待，在途来客依原行程抵达。');
 return {enabled,nextOpportunityTick:ledger.nextOpportunityTick};
}
function matchingArts(p){
 const goal=p.mind.goal;
 if(goal==='精研草木')return ['spring','wood','alchemy'];
 if(goal==='守成护道')return ['earth','array'].filter(id=>TECHNIQUES[id]);
 if(goal==='求取长生')return p.mind.main?[p.mind.main]:Object.keys(TECHNIQUES).filter(id=>TECHNIQUES[id].kind==='main');
 if(goal==='求索奇法')return Object.keys(TECHNIQUES).filter(id=>TECHNIQUES[id].kind==='support');
 return [];
}
function learningOpportunity(s,p){
 const teachers=[MASTER,...s.homeMemberIds].map(id=>s.personsById[id]).filter(local);
 for(const artId of matchingArts(p)){
  if(!s.doctrine.books.includes(artId)||artStudyRequirement(p,artId))continue;
  const teacher=teachers.find(t=>!mind(t).hiddenKnowledge?.[artId]&&teachingQualificationSR(s,t.personId,artId).qualified);if(!teacher)continue;
  for(const b of Object.values(s.buildingsById)){
   if(!['hall','library'].includes(b.type)||b.enabled===false||b.disabled||b.spatialLock||b.condition<=0)continue;
   const entry=buildingAccess(s,b),desk=facilitySlots(s,b,'study')[0],lectern=facilitySlots(s,b,'teach')[0];
   if(!desk||!lectern||desk.id===lectern.id)continue;
   if(!routeReachable(s,TARGET,entry,'seeker:learning')||!routeReachable(s,entry,desk.position,`seeker:${b.instanceId}`)||!routeReachable(s,entry,lectern.position,`seeker:${b.instanceId}`))continue;
   const art=teacher.artsById[artId];return {artId,teacherId:teacher.personId,buildingId:b.instanceId,studySlotId:desk.id,teachSlotId:lectern.id,understanding:art.understanding,mastery:art.mastery};
  }
 }
 return null;
}
function assessment(s,p){
 const trust=p.mind.relationships.master.trust,discipline=p.mind.traits[3],kindness=p.mind.traits[0],opportunity=learningOpportunity(s,p);
 const components={discipline:discipline*.3,kindness:kindness*.1,trust:trust*.4,opportunity:opportunity?SEEKER_RULES.opportunityBonus:0};
 const score=Object.values(components).reduce((a,b)=>a+b,0),willing=score>=SEEKER_RULES.threshold;
 const reason=willing?'院中生活与求道条件合适，我愿意留下。':trust<40?'彼此尚缺足够信任，我还不愿加入。':!opportunity&&discipline*.3+kindness*.1+trust*.4+SEEKER_RULES.opportunityBonus>=SEEKER_RULES.threshold?'我想先找到与志向相合、能实际请教的成熟传承。':'我仍想保留独自求道的安排，暂不愿入籍。';
 const inputs={goal:p.mind.goal,trust,discipline,kindness,opportunity};
 return {inputs,components,score,threshold:SEEKER_RULES.threshold,willing,reason};
}
function signatureInputs(inputs){const value=clone(inputs);if(value.opportunity){delete value.opportunity.mastery;delete value.opportunity.understanding;}return value;}
function conditionSignature(s,p,a=assessment(s,p)){return JSON.stringify({assessment:signatureInputs(a.inputs),food:foodView(s).met,bed:housingView(s).counts.freeForAdmission>0});}
export function courtyardSeekerBodyReason(s,personId){
 const p=s.personsById[personId],master=s.personsById[MASTER],a=s.activitiesById[master?.activityId],other=s.activitiesById[p?.activityId];
 return !local(master)||!local(p)||s.world?.exploration||s.combat?.status==='active'||other||a&&!(a.kind==='facility'&&['rest','cultivate','social'].includes(a.action)&&!a.serviceOrderId)?'须双方当前身体能交谈，先完成正在进行的事务。':'';
}
export function courtyardSeekerView(s,personId){
 const r=sourceRecord(s,personId),p=s.personsById?.[personId];if(!r||!p)return null;
 const v=current(r),master=s.personsById[MASTER],distance=local(master)&&local(p)?scenicDistance(mind(master).scenic,mind(p).scenic):null;
 const near=Number.isFinite(distance)&&distance<=1.5,member=s.homeMemberIds.includes(personId);
 const food=foodView(s),housing=housingView(s),a=assessment(s,p),bodyReason=courtyardSeekerBodyReason(s,personId);
 const conditions=[
  {id:'member',met:!member&&!s.courtyardAdmissions?.recordsByPersonId?.[personId],reason:'此人已有正式收录记录。'},
  {id:'arrival',met:local(p)&&p.courtyardVisit?.phase==='present'&&v.endedAtTick===null,reason:'来客尚未在院前停留，请待实际抵达后再商议。'},
  {id:'distance',met:near,reason:`先走到${p.name}身边，再当面商议。`},
  {id:'bodies',met:!bodyReason,reason:bodyReason},
  {id:'housing',met:housing.counts.freeForAdmission>0,reason:'先准备一张可达且尚未承诺的实体床位。'},
  {id:'food',met:food.met,reason:`主殿公库需保留 ${food.needed} 份食粮。`},
  {id:'limit',met:s.homeMemberIds.length<15,reason:'当前在籍门人已满十五人。'},
 ];
 const canTalk=conditions.slice(0,4).every(c=>c.met),canRequestAdmission=conditions.every(c=>c.met);
 const latest=v.answers.at(-1);
 return {personId,name:p.name,status:member?'admitted':'candidate',visitNumber:v.number,phase:p.courtyardVisit.phase,
  canTalk,canRequestAdmission,canAdmit:canRequestAdmission&&a.willing,reason:conditions.find(c=>!c.met)?.reason||'',conditions:presentConditions(conditions),
  distance:{near,meters:distance,limit:1.5,reason:near?'':conditions[2].reason},food,housing:{available:conditions[4].met,freeBeds:housing.counts.freeForAdmission},
  publicReason:near?(latest?.reason||p.mind.reason):'',lastAnswer:publicAnswer(latest),deadlineTick:v.deadlineTick,deferred:v.deferred};
}
function addAnswer(s,r,type,reason,{assessment:judgement=null,signature=null}={}){
 const v=current(r),answer={type,atTick:s.worldTick,reason,signature,assessment:judgement?clone(judgement):null,factId:`${factPrefix}${r.personId}:${v.number}:answer:${v.answers.length+1}`};
 fact(s,answer.factId,{kind:'courtyard-seeker-answer',personId:r.personId,visitNumber:v.number,actorId:MASTER,...clone(answer)});v.answers.push(answer);
 rememberPerson(s,s.personsById[r.personId],reason,{important:true,key:answer.factId});return answer;
}
function endVisit(s,r,reason){const v=current(r);v.endedAtTick=s.worldTick;v.endedReason=reason;v.departureSignature=conditionSignature(s,s.personsById[r.personId]);departCourtyardVisitor(s,s.personsById[r.personId]);v.endFactId=recordFact(s,r,'leave',{reason,signature:v.departureSignature});}
export function answerCourtyardSeeker(s,{personId,answer}={}){
 if(!['defer','decline'].includes(answer))throw Error('请选择暂缓商议或婉拒。');
 const r=sourceRecord(s,personId),view=courtyardSeekerView(s,personId);if(!view?.canTalk)throw Error(view?.reason||'此人没有山门求见约定。');
 const v=current(r),prior=v.answers.find(a=>a.type===`host-${answer}`);if(prior)return publicAnswer(prior);
 const reason=answer==='defer'?'掌门请我稍候，我愿再等一段时间。':'掌门已婉拒本次入院，我将循南路离开。';
 const result=addAnswer(s,r,`host-${answer}`,reason);
 if(answer==='defer'){v.deferred=true;v.deadlineTick+=SEEKER_RULES.deferTicks;}else endVisit(s,r,'host-declined');
 return publicAnswer(result);
}
/** Called by the shared admission transaction; a refusal is a committed answer. */
export function acceptCourtyardSeeker(s,personId){
 const r=sourceRecord(s,personId),view=courtyardSeekerView(s,personId);if(!view?.canRequestAdmission)throw Error(view?.reason||'此人没有山门求见约定。');
 const p=s.personsById[personId],a=assessment(s,p),signature=conditionSignature(s,p,a),v=current(r),prior=v.answers.findLast(answer=>answer.signature===signature&&answer.type.startsWith('npc-'));
 if(prior&&!prior.assessment.willing)return {accepted:false,personId,reason:prior.reason,answer:publicAnswer(prior)};
 if(!a.willing){const answer=addAnswer(s,r,'npc-decline',a.reason,{assessment:a,signature});return {accepted:false,personId,reason:a.reason,answer:publicAnswer(answer)};}
 ensureResidentialHousing(s);const housing=residentialAdmissionView(s,personId);if(!housing.available)throw Error(housing.reason);
 reserveResidentialBed(s,personId,housing.candidate.slotId,{source:'admission'});
 const answer=addAnswer(s,r,'npc-accept',a.reason,{assessment:a,signature});s.homeMemberIds.push(personId);p.mind.joinedAt=s.society.clock??s.time;p.mind.reason='已经正式入院，准备按自己的志向安顿生活。';
 v.endedAtTick=s.worldTick;v.endedReason='admitted';v.endFactId=recordFact(s,r,'admitted',{answerFactId:answer.factId,slotId:housing.candidate.slotId});
 return {accepted:true,personId,answer:publicAnswer(answer),consentSource:SEEKER_SOURCE};
}
function startVisit(s,r){
 const p=s.personsById[r.personId],number=r.visits.length+1;
 beginCourtyardVisit(s,p,{reason:'从云岫南麓循山路前来，想了解院中生活与求道机会。'});
 const v={number,startedTick:s.worldTick,arrivedTick:null,departedTick:null,deadlineTick:null,deferred:false,endedAtTick:null,endedReason:null,departureSignature:null,startFactId:null,arrivalFactId:null,endFactId:null,departedFactId:null,answers:[]};r.visits.push(v);v.startFactId=recordFact(s,r,'start');
}
function createCaller(s){
 const rngBefore=s.rngState,p=createWorldPerson(s),rngAfter=s.rngState;
 p.courtyardSeekerSource=COURTYARD_SEEKERS_VERSION;p.activityId=null;p.knownFacts=[];p.beliefs={};
 hydrateWorldPositionSR(s,p);initPersons(s);initCultivation(s);
 const r={personId:p.personId,source:SEEKER_SOURCE,createdAtTick:s.worldTick,rngBefore,rngAfter,sourceFactId:`${factPrefix}${p.personId}:source`,visits:[]};s.courtyardSeekers.recordsByPersonId[p.personId]=r;
 fact(s,r.sourceFactId,{kind:'courtyard-seeker-source',personId:p.personId,source:r.source,version:COURTYARD_SEEKERS_VERSION,atTick:s.worldTick,rngBefore,rngAfter,numericId:p.id});
 startVisit(s,r);log(s,`${p.name}从南山道前来求见，正在路上。`);
}
export function advanceCourtyardSeekers(s){
 const ledger=s.courtyardSeekers;if(!ledger||ledger.lastProcessedTick>=s.worldTick)return;ledger.lastProcessedTick=s.worldTick;
 for(const r of Object.values(ledger.recordsByPersonId)){
  const p=s.personsById[r.personId],v=current(r);if(s.courtyardAdmissions?.recordsByPersonId[r.personId]||!living(p))continue;
  advanceCourtyardVisitor(s,p);
  if(v.arrivedTick===null&&p.courtyardVisit.phase==='present'){v.arrivedTick=s.worldTick;v.deadlineTick=s.worldTick+SEEKER_RULES.stayTicks;v.arrivalFactId=recordFact(s,r,'arrived');p.mind.reason='我想先了解这里的生活和传承，再决定是否入院。';}
  if(v.endedAtTick===null&&v.deadlineTick!==null&&s.worldTick>=v.deadlineTick)endVisit(s,r,'time-elapsed');
  if(v.departedTick===null&&p.courtyardVisit.phase==='departed'){v.departedTick=s.worldTick;v.departedFactId=recordFact(s,r,'departed');}
 }
 if(!ledger.enabled||s.worldTick<ledger.nextOpportunityTick)return;
 const active=Object.values(ledger.recordsByPersonId).some(r=>living(s.personsById[r.personId])&&!s.courtyardAdmissions?.recordsByPersonId[r.personId]&&s.personsById[r.personId].courtyardVisit.phase!=='departed');
 if(active)return;
 const c=receptionConditions(s);if(!c.available){ledger.nextOpportunityTick=s.worldTick+SEEKER_RULES.intervalTicks;return;}
 const returning=Object.values(ledger.recordsByPersonId).find(r=>{
  const p=s.personsById[r.personId],v=current(r);return living(p)&&!s.courtyardAdmissions?.recordsByPersonId[r.personId]&&v.departedTick!==null&&s.worldTick>=v.departedTick+SEEKER_RULES.returnTicks&&v.departureSignature!==conditionSignature(s,p);
 });
 if(returning)startVisit(s,returning);else createCaller(s);
 ledger.nextOpportunityTick=s.worldTick+SEEKER_RULES.intervalTicks;
}
export function validateCourtyardSeekers(s){
 const ledger=s.courtyardSeekers,fail=message=>{throw Error(`存档校验失败：山门求见${message}，原存档保留。`);};
 const facts=Object.values(s.factsById||{}).filter(f=>f.id?.startsWith(factPrefix)),marked=Object.values(s.personsById||{}).filter(p=>p.courtyardSeekerSource!==undefined);
 if(ledger===undefined){if(facts.length||marked.length)fail('缺少来源记录');return true;}
 const tick=(n,lo=0)=>Number.isSafeInteger(n)&&n>=lo&&n<=s.worldTick;
 if(!plain(ledger)||ledger.version!==COURTYARD_SEEKERS_VERSION||s.contentVersion!=='sr-content-v1.2'||!tick(ledger.enabledAtTick)||typeof ledger.enabled!=='boolean'||!tick(ledger.lastProcessedTick,ledger.enabledAtTick)||!Number.isSafeInteger(ledger.nextOpportunityTick)||ledger.nextOpportunityTick<ledger.enabledAtTick+SEEKER_RULES.firstTicks||!Array.isArray(ledger.policies)||!ledger.policies.length||!plain(ledger.recordsByPersonId))fail('版本、政策或排期异常');
 const used=new Set(),check=(id,expected)=>{const f=s.factsById[id];if(used.has(id)||!f||!same(f,{id,...expected}))fail(`事实 ${id} 不符`);used.add(id);};
 let policyTick=ledger.enabledAtTick;
 for(const [i,p]of ledger.policies.entries()){if(!plain(p)||p.factId!==`${factPrefix}policy:${i+1}`||typeof p.enabled!=='boolean'||!tick(p.atTick,policyTick)||i===0&&(!p.enabled||p.atTick!==ledger.enabledAtTick))fail('政策时序异常');check(p.factId,{kind:'courtyard-seeker-policy',enabled:p.enabled,atTick:p.atTick,version:COURTYARD_SEEKERS_VERSION});policyTick=p.atTick;}
 if(ledger.enabled!==ledger.policies.at(-1).enabled)fail('政策状态异常');
 for(const [id,r]of Object.entries(ledger.recordsByPersonId)){
  const p=s.personsById[id];if(!plain(r)||r.personId!==id||r.source!==SEEKER_SOURCE||!p||p.courtyardSeekerSource!==COURTYARD_SEEKERS_VERSION||!tick(r.createdAtTick,ledger.enabledAtTick)||![r.rngBefore,r.rngAfter].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff)||r.sourceFactId!==`${factPrefix}${id}:source`||!Array.isArray(r.visits)||!r.visits.length)fail('人物来源异常');
  check(r.sourceFactId,{kind:'courtyard-seeker-source',personId:id,source:SEEKER_SOURCE,version:COURTYARD_SEEKERS_VERSION,atTick:r.createdAtTick,rngBefore:r.rngBefore,rngAfter:r.rngAfter,numericId:p.id});
  let previous=r.createdAtTick;
  for(const [i,v]of r.visits.entries()){
   if(v.number!==i+1||!tick(v.startedTick,previous)||i===0&&v.startedTick!==r.createdAtTick||i>0&&(r.visits[i-1].departedTick===null||v.startedTick<r.visits[i-1].departedTick+SEEKER_RULES.returnTicks)||!Array.isArray(v.answers)||typeof v.deferred!=='boolean')fail('来访时序异常');
   const event=(key,event,atTick,fields={})=>{const fid=`${factPrefix}${id}:${v.number}:${event}`;if(v[key]!==fid||!tick(atTick,v.startedTick))fail('来访事实引用异常');check(fid,{kind:'courtyard-seeker-event',personId:id,visitNumber:v.number,event,atTick,...fields});};
   event('startFactId','start',v.startedTick);
   if(v.arrivedTick!==null){event('arrivalFactId','arrived',v.arrivedTick);if(v.deadlineTick!==v.arrivedTick+SEEKER_RULES.stayTicks+(v.deferred?SEEKER_RULES.deferTicks:0))fail('停留期限异常');}else if(v.deadlineTick!==null||v.arrivalFactId!==null||v.answers.length)fail('未到院已有答复');
   let answerTick=v.arrivedTick;
   for(const [j,a]of v.answers.entries()){
    if(!plain(a)||!['host-defer','host-decline','npc-accept','npc-decline'].includes(a.type)||!tick(a.atTick,answerTick)||a.factId!==`${factPrefix}${id}:${v.number}:answer:${j+1}`||typeof a.reason!=='string'||!a.reason)fail('答复异常');
    if(a.type.startsWith('npc-')){
     const q=a.assessment,inp=q?.inputs,c=q?.components;
     if(!keys(q,['inputs','components','score','threshold','willing','reason'])||!keys(inp,['goal','trust','discipline','kindness','opportunity'])||!keys(c,['discipline','kindness','trust','opportunity'])||![inp.trust,inp.discipline,inp.kindness].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||typeof inp.goal!=='string'||q.threshold!==SEEKER_RULES.threshold||c.trust!==inp.trust*.4||c.discipline!==inp.discipline*.3||c.kindness!==inp.kindness*.1||c.opportunity!==(inp.opportunity?SEEKER_RULES.opportunityBonus:0)||q.score!==Object.values(c).reduce((x,y)=>x+y,0)||q.willing!==(q.score>=q.threshold)||(a.type==='npc-accept')!==q.willing||a.reason!==q.reason||a.signature!==JSON.stringify({assessment:signatureInputs(inp),food:true,bed:true}))fail('意愿评分来源异常');
     if(inp.opportunity!==null){const op=inp.opportunity;if(!keys(op,['artId','teacherId','buildingId','studySlotId','teachSlotId','understanding','mastery'])||!TECHNIQUES[op.artId]||!s.personsById[op.teacherId]||typeof op.buildingId!=='string'||!op.buildingId||typeof op.studySlotId!=='string'||typeof op.teachSlotId!=='string'||op.studySlotId===op.teachSlotId||!Number.isFinite(op.understanding)||op.understanding<65||op.understanding>100||!Number.isFinite(op.mastery)||op.mastery<60||op.mastery>100)fail('传承来源异常');}
    }else if(a.assessment!==null||a.signature!==null)fail('掌门答复混有个人判断');
    check(a.factId,{kind:'courtyard-seeker-answer',personId:id,visitNumber:v.number,actorId:MASTER,...clone(a)});answerTick=a.atTick;
   }
   if(v.deferred!==(v.answers.filter(a=>a.type==='host-defer').length===1)||v.answers.filter(a=>a.type==='host-defer').length>1)fail('暂缓次数异常');
   if(v.endedAtTick!==null){
    if(!tick(v.endedAtTick,Math.max(answerTick??v.startedTick,v.arrivedTick??v.startedTick))||!['host-declined','time-elapsed','admitted'].includes(v.endedReason))fail('结束时刻异常');
    if(v.endedReason==='admitted'){
     const answer=v.answers.at(-1),f=s.factsById[v.endFactId];if(answer?.type!=='npc-accept'||answer.atTick!==v.endedAtTick||v.answers.filter(a=>a.type==='npc-accept').length!==1||!f?.slotId||!s.courtyardAdmissions?.recordsByPersonId[id])fail('收录来源缺失');event('endFactId','admitted',v.endedAtTick,{answerFactId:answer.factId,slotId:f.slotId});
    }else{if(typeof v.departureSignature!=='string'||v.endedReason==='host-declined'&&!v.answers.some(a=>a.type==='host-decline')||v.endedReason==='time-elapsed'&&v.endedAtTick<v.deadlineTick)fail('离场来源异常');event('endFactId','leave',v.endedAtTick,{reason:v.endedReason,signature:v.departureSignature});}
   }else if(v.endedReason!==null||v.endFactId!==null||v.departureSignature!==null)fail('结束状态异常');
   if(v.departedTick!==null){if(v.endedAtTick===null||v.departedTick<v.endedAtTick||v.endedReason==='admitted')fail('离场时序异常');event('departedFactId','departed',v.departedTick);}else if(v.departedFactId!==null)fail('离场事实异常');
   previous=v.departedTick??v.endedAtTick??v.startedTick;
  }
  const v=current(r),visit=p.courtyardVisit;if(!visit||visit.startedTick!==v.startedTick||visit.arrivedTick!==v.arrivedTick||visit.departedTick!==v.departedTick)fail('身体来访与来源不符');
  const membership=s.courtyardAdmissions?.recordsByPersonId[id];if(!!membership!==(v.endedReason==='admitted')||membership&&membership.consentSource!==SEEKER_SOURCE||!membership&&s.homeMemberIds.includes(id))fail('门籍来源不符');
  if(!membership){const expected=v.departedTick!==null?'departed':v.endedAtTick!==null?'departing':v.arrivedTick!==null?'present':'arriving';if(visit.phase!==expected)fail('身体来访阶段不符');}
 }
 if(Object.values(ledger.recordsByPersonId).filter(r=>living(s.personsById[r.personId])&&!s.courtyardAdmissions?.recordsByPersonId[r.personId]&&current(r).departedTick===null).length>1)fail('同时接待人数异常');
 if(marked.some(p=>!ledger.recordsByPersonId[p.personId])||facts.some(f=>!used.has(f.id)))fail('来源或事实悬空');
 return true;
}
