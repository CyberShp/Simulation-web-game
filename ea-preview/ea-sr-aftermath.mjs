/** SR-XF-020/022. Persistent obligations and reactions require delivered evidence.
 * Author R/T defaults; this module consumes worldTick and never owns a clock. */
import {RESOURCES,RECIPES} from './ea-data.mjs?v=ea-160-courtyard-20261008-r24';
import {makeWorldPerson,recordFactSR,publishFactSR} from './ea-sr-world.mjs?v=ea-160-courtyard-20261008-r24';
import {reserveBody,releaseSRBody,ownedActivity,isLivingPerson,spendResources,refundResources} from './ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r24';

const MASTER='person:master',HERBALIST='person:su-yelan',KIN='person:su-mingzhi';
const zero=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
const pillZero=()=>Object.fromEntries(Object.keys(RECIPES).map(k=>[k,0]));
const copy=v=>structuredClone(v);
export const AFTERMATH_RULES=Object.freeze({id:'aftermath:yunxiu:v1',source:'U-63-author-default/R/T',notifyTicks:50,agreementTicks:40,collectTicks:30,handoverTicks:40,debtTicks:40,mourningTicks:360,reorientTicks:180,range:2.6});

export const AFTERMATH_AUTHOR_CARD=Object.freeze({id:'card:rain-herbalist:aftermath:v1',rootId:'root:rain-herbalist:v1',sourceStatus:'U-63-author-default/R/T',participants:[HERBALIST,KIN,'person:gu-wanyi'],authorTruth:'苏明芷为苏叶岚表妹兼已入门药徒，在青溪接药；苏叶岚本人欠顾婉仪药草两份。旧信与原借契随原遗物保存；死亡不会把无限债务或公物产权转给表妹/掌门。',knownAtActivation:{[KIN]:['亲属关系','已有师承'],['person:gu-wanyi']:['本人的两份借契']},clueGraph:[{source:'原遗体/遗物2.6米内查验',reveals:['既有亲属托付','师承来源','有限借款']},{source:'实际当面告知50步',reveals:['唯一可靠身死事实'],recipientMustBePresent:true}],timeGraph:{notify:50,griefPreparation:40,custodyAgreement:40,onsiteCollection:30,handover:40,voluntaryDebtPayment:40,mourning:360,reorientation:180},alternatives:['只查验不承担托付','只可靠告知','拒绝自愿代偿','取消尚未实际交付并退原预留'],persistentConsequences:['原人物/死亡事实/原遗物实例不变','已学与师承来源保留','债务仍有同一主体与有限上限','各知情者按实际利益反应一次'],migration:'仅新激活内容定义这些关系；旧死亡/旧雨链不追加亲属、债务或历史评价。'});

export function initAftermath(s){
 if(!s.srWorld)return null;
 if(s.srAftermath)return s.srAftermath;
 s.srAftermath={version:AFTERMATH_RULES.id,lastTick:s.worldTick,migrationTick:s.worldTick,historicalFactIds:Object.keys(s.factsById),historicalDeathIds:Object.keys(s.deathRecordsByPersonId||{}),rainContentActivatedTick:null,nextId:1,orders:{},deathCases:{},reactions:{},appraisals:{},factionReceipts:{},portraitReceipts:{},kinships:[],lineages:{},debts:{}};
 return s.srAftermath;
}
/** Newly activated content only; a previous rain chain/death is never rewritten. */
export function activateRainAftermath(s){
 const a=initAftermath(s);if(!a||a.rainContentActivatedTick!==null||s.srCrises?.rainChain)return a;
 if(s.personsById[HERBALIST]?.lifeStatus==='dead')return a;
 const alreadyExists=!!s.personsById[KIN],kin=makeWorldPerson(s,KIN,'苏明芷','scene:market',3);
 if(!alreadyExists){kin.location={kind:'local',sceneId:'scene:market',x:28,y:27};
 kin.mind.goal='保住家人的药学与溪口疗养事业';
 kin.mind.reason='苏叶岚的表妹兼药学弟子，在青溪接送药材；尚不知道山外发生的事。';
 kin.mind.relationships={master:{trust:55,respect:55,affection:45,conflict:0,lastEvent:s.time},[`d:${s.personsById[HERBALIST].id}`]:{trust:80,respect:75,affection:85,conflict:0,lastEvent:s.time}};
 kin.artsById={};kin.mind.main=null;kin.mind.support=[];kin.mind.knowledge={};kin.mind.hiddenKnowledge={};kin.mind.learning=null;kin.mind.publicMain=null;kin.mind.memories=[];kin.mind.skills={plant:4,industry:0,learning:3,array:0,medicine:6};kin.wound=0;kin.energy=100;kin.talent=1.05;kin.lifeHistory={originTick:s.worldTick,knownAgeYears:null,observedTicks:0,extensionYears:0,extensionUsed:false,exhaustionNotified:false};
 kin.activityId=null;kin.journey=null;kin.role=null;kin.knownFacts=[];kin.beliefs={};kin.mind.mentorId=null;kin.mind.peakId=null;kin.mind.office=null;kin.mind.away=null;kin.mind.journey=null;kin.mind.path=[];if(kin.mind.scenic){kin.mind.scenic.path=[];kin.mind.scenic.goal=null;}kin.mind.activity='rest';
 kin.appearance={spriteIndex:4,accent:'#5ca19b',recipe:{id:`appearance:${KIN}:v1`,body:'slim',face:'oval',hair:'braid',outfit:'herbalist',faceMark:2,height:1.67}};
 kin.schedule={definitionId:'autonomy:yunxiu:v1',commitUntilTick:s.worldTick,updatedThroughTick:s.worldTick,lastReason:kin.mind.reason,invitations:{},phase:'rest',responsibilitySlots:[],privateMotives:[]};}
 a.rainContentActivatedTick=s.worldTick;
 a.kinships.push({personId:KIN,relativeId:HERBALIST,kind:'cousin',activatedTick:s.worldTick,migrationTick:a.migrationTick,source:'author:rain-herbalist:family:v1'});
 a.lineages[KIN]=[{teacherId:HERBALIST,sourceId:'author:rain-herbalist:teaching:v1',status:'active',endedAtTick:null}];
 a.debts['debt:su-yelan:gu-herbs']={id:'debt:su-yelan:gu-herbs',debtorId:HERBALIST,creditorId:'person:gu-wanyi',resource:'herb',quantity:2,paid:0,status:'open',createdTick:s.worldTick,migrationTick:a.migrationTick,sourceId:'author:rain-herbalist:two-herbs:v1',settlements:[]};
 recordFactSR(s,'fact:author:rain-herbalist:obligations',{kind:'author-obligations',public:false,personId:HERBALIST,card:copy(AFTERMATH_AUTHOR_CARD),sourceStatus:AFTERMATH_RULES.source,text:'苏明芷是苏叶岚表妹及已入门药徒；两份顾氏药草借款属苏叶岚本人债务。表妹有遗物托付权，无权没收借物或替旁人承担无限债务。'});
 return a;
}

const relevantKinds=new Set(['death','rescue','estate-handover','death-debt-payment','trap-triggered','harmful-act','content-result']);
// Derived, non-serialized cache. Command clones and reloads naturally rebuild it once.
const knowledgeCaches=new WeakMap();
function knowledgeCache(s){
 let c=knowledgeCaches.get(s);if(c)return c;
 const historical=new Set(s.srAftermath?.historicalFactIds||[]);
 c={facts:new Map(),claims:new Map(),pending:new Set(),historical};knowledgeCaches.set(s,c);
 for(const f of Object.values(s.factsById))if(relevantKinds.has(f.kind)&&!historical.has(f.id)){c.facts.set(f.id,f);c.pending.add(f.id);}
 for(const claim of Object.values(s.claimsById||{}))for(const fid of claim.evidenceFactIds||[])if(c.facts.has(fid)){if(!c.claims.has(fid))c.claims.set(fid,[]);c.claims.get(fid).push(claim);}
 return c;
}
/** Fact/claim producers notify only affected evidence IDs; never writes the save. */
export function markAftermathKnowledge(s,factId){
 if(!s.srAftermath)return;const c=knowledgeCaches.get(s);if(!c)return;
 const f=s.factsById[factId];if(!f||!relevantKinds.has(f.kind)||c.historical.has(factId))return;c.facts.set(factId,f);c.pending.add(factId);
}
function factKnown(s,observerId,factId){
 const f=s.factsById[factId];if(!f)return false;
 if(s.personsById[observerId]?.knownFacts?.includes(factId)||f.knownByPersonIds?.includes(observerId))return true;
 const direct=s.claimsById?.[`claim:fact:${factId}:${observerId}`];if(direct?.verification==='corroborated'&&direct.recipients.includes(observerId)&&direct.evidenceFactIds.includes(factId))return true;
 const c=knowledgeCache(s),claims=c.claims.get(factId)||[];
 return claims.some(q=>q.verification==='corroborated'&&q.recipients?.includes(observerId)&&q.evidenceFactIds?.includes(factId));
}
function deathFact(s,id){const d=s.deathRecordsByPersonId?.[id];return d&&s.factsById[d.factId];}
function deadKnown(s,observerId,id){const f=deathFact(s,id);return !!f&&f.kind==='death'&&factKnown(s,observerId,f.id);}
function loc(p){return p?.location?.kind==='local'?p.location:p?.position?.kind==='scene'?p.position:null;}
function together(a,b){const x=loc(a),y=loc(b);return !!x&&!!y&&x.sceneId===y.sceneId&&Math.hypot(x.x-y.x,x.y-y.y)<=AFTERMATH_RULES.range;}
function atCorpse(s,id){const f=deathFact(s,id),p=loc(s.master);return !!f?.position&&p?.sceneId===f.sceneId&&Math.hypot(p.x-f.position.x,p.y-f.position.y)<=AFTERMATH_RULES.range;}
function knownBy(s,id,observerId){const p=s.personsById[observerId];if(!p)return;p.knownFacts??=[];if(!p.knownFacts.includes(id)){p.knownFacts.push(id);markAftermathKnowledge(s,id);}}
function lineage(s,pid,teacherId,sourceId){const a=s.srAftermath.lineages[pid]??=[];if(!a.some(x=>x.teacherId===teacherId&&x.sourceId===sourceId))a.push({teacherId,sourceId,status:'active',endedAtTick:null});}

/** Physical death interrupts shared work, but does not tell absent pupils the reason. */
export function prepareDeathAftermath(s,personId){
 const a=initAftermath(s);if(!a)return;
 const f=deathFact(s,personId);if(!f)return;markAftermathKnowledge(s,f.id);
 if(!a.deathCases[personId]){
  const p=s.personsById[personId];
  a.deathCases[personId]={personId,deathFactId:f.id,createdTick:s.worldTick,custodyPermission:null,collected:false,delivered:false,debtIds:Object.values(a.debts).filter(d=>d.debtorId===personId||d.creditorId===personId).map(d=>d.id)};
  for(const other of Object.values(s.personsById))if(!a.historicalDeathIds.includes(personId)&&other.mind?.mentorId===p.id)lineage(s,other.personId,personId,`source:mentor:${other.personId}:${personId}`);
  for(const order of Object.values(s.srCultivation?.orders||{}))if(!a.historicalDeathIds.includes(personId)&&order.kind==='teach'&&(order.personId===personId||order.parameters.studentId===personId)&&!['completed','cancelled'].includes(order.phase)){
   lineage(s,order.parameters.studentId,order.personId,`source:lesson:${order.id}`);
   order.phase='blocked';order.reason='授业者或学生已无法继续；须取得可靠消息，已有理解与熟练保留。';
   for(const pid of [order.personId,order.parameters.studentId])if(pid!==personId&&ownedActivity(s,s.personsById[pid])?.orderId===order.id)releaseSRBody(s,s.personsById[pid]);
  }
 }
 for(const list of Object.values(a.lineages))for(const link of list)if(link.teacherId===personId&&link.status==='active'){link.status='unavailable';link.endedAtTick=s.worldTick;}
 for(const debt of Object.values(a.debts))if(debt.debtorId===personId&&debt.status==='open'){debt.status='estate-pending';debt.deathFactId=f.id;debt.debtorDiedTick=s.worldTick;}else if(debt.creditorId===personId&&debt.status==='open'){debt.status='creditor-estate';debt.deathFactId=f.id;}
}

/** The nearby search reads existing letters/contracts; a death message alone reveals none. */
export function discloseAftermathObligations(s,personId){
 const a=s.srAftermath;if(!a||!deadKnown(s,MASTER,personId)||!atCorpse(s,personId))return;
 const kinIds=a.kinships.filter(k=>k.relativeId===personId).map(k=>k.personId),debtIds=Object.values(a.debts).filter(d=>d.debtorId===personId).map(d=>d.id);
 if(!kinIds.length&&!debtIds.length)return;
 const f=recordFactSR(s,`fact:estate-obligations-observed:${personId}`,{kind:'estate-obligations-observed',personId,kinIds,debtIds,sceneId:deathFact(s,personId).sceneId,sourceFactId:deathFact(s,personId).id,text:'现场原遗物中的旧信和已立借契记明亲属托付、药学师承与有限借款；不是死后新立的全债担保。'});publishFactSR(s,f.id);
}

function relation(s,observerId,actorId,delta,factId){
 const a=s.srAftermath,key=`${observerId}/${actorId}/${factId}`,observer=s.personsById[observerId];
 let receipt=a.appraisals[key];
 if(!receipt){
  receipt=a.appraisals[key]={observerId,actorId,factId,delta,atTick:s.worldTick,projected:false};
  if(actorId===MASTER&&observer?.mind?.relationships?.master){const r=observer.mind.relationships.master;r.trust=Math.max(0,Math.min(100,r.trust+delta));}
  const faction=s.factionsById?.[observer?.factionId];
  if(faction){const k=`${faction.id}/${actorId}/${factId}`;if(!a.factionReceipts[k]){a.factionReceipts[k]={factId,observerId,actorId,delta:Math.sign(delta)*Math.min(4,Math.abs(delta)),atTick:s.worldTick};if(actorId===MASTER)faction.reputation+=a.factionReceipts[k].delta;faction.history??=[];faction.history.push({factId,knownByPersonId:observerId,actorId,response:delta>0?'知情守约与互助':delta<0?'知情损害与追索':'不据未明死因追责',atTick:s.worldTick});}}
 }
 // Later delivery to the master may reveal an existing response without applying it again.
 if(!receipt.projected&&actorId===MASTER&&observerId!==MASTER&&factKnown(s,MASTER,factId)){
  const r=s.srWorld.personRelations[observerId]??={trust:0,memories:[]};r.trust+=receipt.delta;if(!r.memories.includes(factId))r.memories.push(factId);receipt.projected=true;
 }
}
function reaction(s,observerId,f){
 const a=s.srAftermath,key=`${observerId}/${f.id}`,existing=a.reactions[key];if(existing){if(!existing.observedByMaster&&deadKnown(s,MASTER,f.personId)&&together(s.master,s.personsById[observerId]))existing.observedByMaster=true;return;}if(!isLivingPerson(s.personsById[observerId])||!s.personsById[observerId]?.mind)return;
 const p=s.personsById[observerId],relative=a.kinships.some(k=>k.personId===observerId&&k.relativeId===f.personId),student=(a.lineages[observerId]||[]).some(x=>x.teacherId===f.personId),creditor=Object.values(a.debts).some(d=>d.debtorId===f.personId&&d.creditorId===observerId),enemy=p.mind?.relationships?.[`d:${s.personsById[f.personId]?.id}`]?.trust<20;
 const kind=relative?'mourning':student?'lost-teacher':creditor?'estate-inquiry':enemy?'relief':'remembered';
 const text=relative?'已核实亲人身死，暂缓冒险并守护遗物；不把未明死因归罪于送信者。':student?'老师已无法继续授业，保留已学与师承来源，先整理旧课再另求指导。':creditor?'本人借款仍属原债务主体，等待有限遗产或自愿代偿；不自动转给门派。':enemy?'确认旧敌身死后松一口气，原有纠葛与证据仍保留。':'已获可靠身死消息，保留共同经历；未明死因不推断谋害。';
 a.reactions[key]={observerId,personId:f.personId,factId:f.id,kind,text,learnedTick:s.worldTick,untilTick:s.worldTick+(relative?AFTERMATH_RULES.mourningTicks:student?AFTERMATH_RULES.reorientTicks:0),causeAssessment:'unknown-unless-separate-evidence',observedByMaster:deadKnown(s,MASTER,f.personId)&&together(s.master,p)};
 if(relative||student){p.schedule??={};p.schedule.aftermath={factId:f.id,kind,untilTick:a.reactions[key].untilTick,settleAfterTick:s.worldTick+40,responded:false};p.mind.goal=relative?'守护亲人的原遗物与已留药学，不再贸然远行':'整理既有授业，寻找新的可靠指导';}
 p.mind.memories??=[];if(!p.mind.memories.some(m=>m.key===`death-known:${f.id}`))p.mind.memories.push({text,important:true,key:`death-known:${f.id}`,time:s.time});
}
function socialFact(s,observerId,f){
 if(s.srAftermath.historicalFactIds.includes(f.id))return;
 if(f.kind==='death'){reaction(s,observerId,f);return;}
 if(!f.actorId||!s.personsById[f.actorId])return;
 const targetId=f.personId||f.recipientId||f.targetPersonId,relative=s.srAftermath.kinships.some(k=>k.personId===observerId&&k.relativeId===targetId),beneficiary=observerId===targetId,observer=s.personsById[observerId],target=s.personsById[targetId],enemy=(observer?.mind?.relationships?.[`d:${target?.id}`]?.trust??50)<20,sharedInterest=!!observer?.factionId&&observer.factionId===target?.factionId;
 let delta=0;
 if(f.kind==='rescue')delta=beneficiary?18:relative?9:enemy?-2:sharedInterest?4:3;
 else if(f.kind==='estate-handover')delta=beneficiary?8:relative?4:1;
 else if(f.kind==='death-debt-payment')delta=beneficiary?6:relative?3:1;
 else if(f.kind==='trap-triggered'||f.kind==='harmful-act')delta=beneficiary?-18:relative?-12:-5;
 else if(f.kind==='content-result'&&f.result==='fulfilled')delta=2;
 else return;
 relation(s,observerId,f.actorId,delta,f.id);
 if(observerId!==MASTER&&f.actorId===MASTER&&factKnown(s,MASTER,f.id)){
  const key=`${f.id}/${f.kind==='rescue'?'help':f.kind==='harmful-act'||f.kind==='trap-triggered'?'harm':'promises'}`;
  if(!s.srAftermath.portraitReceipts[key]){s.srAftermath.portraitReceipts[key]={factId:f.id,observerId,atTick:s.worldTick};s.srWorld.portrait[key.split('/').at(-1)]++;}
 }
}
export function reconcileAftermathKnowledge(s){
 const a=s.srAftermath;if(!a)return;
 for(const [id,d]of Object.entries(s.deathRecordsByPersonId||{}))if(!a.deathCases[id]&&s.factsById[d.factId]?.kind==='death')prepareDeathAftermath(s,id);
 const c=knowledgeCache(s),pending=[...c.pending];c.pending.clear();
 if(pending.length){
  // Scan history on actual evidence/recipient changes, never on idle world steps.
  const claims=Object.values(s.claimsById||{}),people=Object.values(s.personsById);
  for(const fid of pending){const f=c.facts.get(fid);if(!f)continue;
   const refs=claims.filter(q=>q.evidenceFactIds?.includes(fid));c.claims.set(fid,refs);
   const recipients=new Set(f.knownByPersonIds||[]);
   for(const q of refs)if(q.verification==='corroborated')for(const pid of q.recipients||[])recipients.add(pid);
   for(const p of people)if(p.knownFacts?.includes(fid))recipients.add(p.personId);
   for(const pid of recipients)socialFact(s,pid,f);
  }
 }
 // A later physical meeting can reveal an existing reaction without changing its cause/timer.
 for(const r of Object.values(a.reactions))if(!r.observedByMaster&&deadKnown(s,MASTER,r.personId)&&together(s.master,s.personsById[r.observerId]))r.observedByMaster=true;
}

function actionCheck(s,q,{completion=false}={}){
 const a=s.srAftermath,p=s.master,d=s.personsById[q.personId],f=deathFact(s,q.personId);
 if(!isLivingPerson(p)||!d||!deadKnown(s,MASTER,q.personId))throw Error('须先亲自查验遗体或收到可靠身死凭证；旧求援消息不是死亡事实。');
 if(q.choice==='collect'){
  if(!atCorpse(s,q.personId))throw Error('须真正走到遗体与遗物原位置。');
  const c=a.deathCases[q.personId];if(!c?.custodyPermission||c.collected)throw Error('须先取得亲属明确托付，且同一遗物不重复领取。');
  const item=s.itemsById[`item:relic:${q.personId}`];if(!item||item.ownerId!==q.personId||item.location.kind!=='scene'||item.location.id!==f.sceneId)throw Error('原有遗物已不在现场；不得生成第二份。');
  return;
 }
 const other=s.personsById[q.counterpartyId];if(!isLivingPerson(other)||!together(p,other))throw Error('需要实际到场与活着的当事人会面。');
 if(!completion&&other.activityId&&s.activitiesById[other.activityId])throw Error('对方身体已有实际活动，稍后再商议。');
 if(q.choice==='notify')return;
 if(!deadKnown(s,other.personId,q.personId))throw Error('对方尚未收到可靠消息，先实地告知并核实。');
 if(q.choice==='permission'||q.choice==='handover'){
  if(!a.kinships.some(k=>k.personId===other.personId&&k.relativeId===q.personId))throw Error('此人没有已定义的亲属托付权。');
  if(q.informed!==true)throw Error('须明确确认只托管遗物，不取得死者私产或门派借物所有权。');
  if((other.mind.relationships?.master?.trust??0)<45)throw Error('亲属目前不愿把遗物托付给掌门。');
  const grief=other.schedule?.aftermath;
  if(grief&&s.worldTick<grief.settleAfterTick)throw Error('亲属刚核实噩耗，需要40世界步整理心绪，之后再商议托付。');
  const c=a.deathCases[q.personId];if(q.choice==='permission'&&c.custodyPermission)throw Error('此前托付仍有效，不重复订立。');
  if(q.choice==='handover'){const i=s.itemsById[`item:relic:${q.personId}`];if(!c.custodyPermission||c.custodyPermission.recipientId!==other.personId||c.delivered||i?.ownerId!==q.personId||i.location.kind!=='person'||i.location.id!==MASTER)throw Error('须携同一原遗物按原托付当面交还。');}
  return;
 }
 if(q.choice==='payDebt'){
  const debt=a.debts[q.debtId];if(!debt||debt.debtorId!==q.personId||debt.creditorId!==other.personId||debt.paid>=debt.quantity)throw Error('没有同一债务主体的未清有限借款。');
  if(q.informed!==true)throw Error('须知情自愿代偿；不自动继承死者全部债务。');const target=s.stockpilesById[`stockpile:death-creditor:${other.personId}`];if(target&&Object.values(target.resources).reduce((n,v)=>n+v,0)+Object.values(target.pills||{}).reduce((n,v)=>n+v,0)+(completion?q.cost[debt.resource]:debt.quantity-debt.paid)>target.capacity)throw Error('债权人身边的实物包裹已满，先搬出再实际交付。');return;
 }
 throw Error('未知身后事务。');
}

export function aftermathAction(s,q={}){
 const a=initAftermath(s);if(!a)throw Error('当前档尚未启用共同世界。');
 if(q.choice==='cancel'){
  const o=a.orders[q.orderId];if(!o||!['reserved','executing','blocked'].includes(o.phase))throw Error('没有可取消的身后事务。');
  if(o.costReserved){refundResources(s,o.cost,o.sourceStockpileId);o.costReserved=false;}
  o.phase='cancelled';o.cancelledTick=s.worldTick;for(const pid of [MASTER,o.counterpartyId])if(ownedActivity(s,s.personsById[pid])?.orderId===o.id)releaseSRBody(s,s.personsById[pid]);return {cancelled:true};
 }
 reconcileAftermathKnowledge(s);actionCheck(s,q);
 if(s.master.activityId||s.srWorld.interaction||s.srWorld.activeTravelId||s.srCrises?.activeTreatment||s.combat?.status==='active')throw Error('先结束掌门当前身体活动。');
 const id=`order:aftermath:${a.nextId++}`,ticks={notify:AFTERMATH_RULES.notifyTicks,permission:AFTERMATH_RULES.agreementTicks,collect:AFTERMATH_RULES.collectTicks,handover:AFTERMATH_RULES.handoverTicks,payDebt:AFTERMATH_RULES.debtTicks}[q.choice];
 const debt=q.choice==='payDebt'&&a.debts[q.debtId],cost=debt?{[debt.resource]:debt.quantity-debt.paid}:{},sourceStockpileId=spendResources(s,cost);
 const o={id,choice:q.choice,personId:q.personId,counterpartyId:q.counterpartyId||null,debtId:q.debtId||null,informed:q.informed===true,deathFactId:deathFact(s,q.personId).id,cost,sourceStockpileId,costReserved:!!debt,durationTicks:ticks,progressTicks:0,phase:'reserved',startedTick:s.worldTick,reason:'实际会面/交接由共同世界步推进。'};
 reserveBody(s,s.master,'aftermath',id);if(o.counterpartyId)reserveBody(s,s.personsById[o.counterpartyId],'aftermath',id);a.orders[id]=o;return {orderId:id,pending:true,durationTicks:ticks};
}
function finish(s,o){
 const a=s.srAftermath,c=a.deathCases[o.personId],other=s.personsById[o.counterpartyId],relic=s.itemsById[`item:relic:${o.personId}`];
 if(o.choice==='notify'){knownBy(s,o.deathFactId,other.personId);publishFactSR(s,o.deathFactId,other.personId);}
 if(o.choice==='permission')c.custodyPermission={recipientId:other.personId,carrierId:MASTER,formedTick:s.worldTick,sourceFactId:o.deathFactId,privatePropertyInherited:false};
 if(o.choice==='collect'){relic.holderId=MASTER;relic.location={kind:'person',id:MASTER};c.collected=true;c.collectedTick=s.worldTick;}
 if(o.choice==='handover'){relic.holderId=other.personId;relic.location={kind:'person',id:other.personId};c.delivered=true;c.deliveredTick=s.worldTick;const f=recordFactSR(s,`fact:estate-handover:${o.personId}`,{kind:'estate-handover',actorId:MASTER,personId:other.personId,originPersonId:o.personId,itemId:relic.id,text:`掌门实际将${s.personsById[o.personId].name}的原遗物托交亲属，所有权仍属原遗产，不没收旁物`});publishFactSR(s,f.id);publishFactSR(s,f.id,other.personId);markAftermathKnowledge(s,f.id);}
 if(o.choice==='payDebt'){
  const d=a.debts[o.debtId],sid=`stockpile:death-creditor:${other.personId}`;
  s.stockpilesById[sid]??={id:sid,ownerId:other.personId,custodianId:other.personId,carrierId:other.personId,access:'private',capacity:40,position:{sceneId:loc(other).sceneId,x:loc(other).x,y:loc(other).y},resources:zero(),pills:pillZero()};
  for(const[k,v]of Object.entries(o.cost))s.stockpilesById[sid].resources[k]+=v;
  d.paid+=o.cost[d.resource];d.status='settled';d.settlements.push({orderId:o.id,payerId:MASTER,quantity:o.cost[d.resource],atTick:s.worldTick,sourceStockpileId:o.sourceStockpileId,targetStockpileId:sid});o.costReserved=false;
  const f=recordFactSR(s,`fact:death-debt-payment:${d.id}`,{kind:'death-debt-payment',actorId:MASTER,personId:other.personId,originPersonId:d.debtorId,debtId:d.id,text:`掌门自愿实际代偿${s.personsById[d.debtorId].name}的${d.quantity}份药草借款；原债务主体与付款来源保留`});publishFactSR(s,f.id);publishFactSR(s,f.id,other.personId);markAftermathKnowledge(s,f.id);
 }
 o.phase='completed';o.completedTick=s.worldTick;for(const pid of [MASTER,o.counterpartyId])if(ownedActivity(s,s.personsById[pid])?.orderId===o.id)releaseSRBody(s,s.personsById[pid]);reconcileAftermathKnowledge(s);
}
export function tickAftermath(s){
 const a=s.srAftermath;if(!a||a.lastTick>=s.worldTick||s.speed===0)return;a.lastTick=s.worldTick;
 for(const o of Object.values(a.orders))if(['reserved','executing','blocked'].includes(o.phase)){
  try{if(ownedActivity(s,s.master)?.orderId!==o.id||o.counterpartyId&&ownedActivity(s,s.personsById[o.counterpartyId])?.orderId!==o.id)throw Error('会面身体活动已中断，可取消返原预留。');actionCheck(s,o,{completion:true});o.reason='正在实际告知或交接。';o.phase='executing';o.progressTicks++;if(o.progressTicks>=o.durationTicks)finish(s,o);}catch(error){o.phase='blocked';o.reason=error.message;}
 }
 reconcileAftermathKnowledge(s);
 for(const p of Object.values(s.personsById))if(!s.homeMemberIds.includes(p.personId)&&isLivingPerson(p)&&p.personId!==MASTER)aftermathDecision(s,p);
}
export function aftermathDecision(s,p){
 const r=p.schedule?.aftermath;if(!r||r.untilTick<=s.worldTick||p.activityId||p.journey||p.mind?.away)return false;if(r.responded)return true;
 r.responded=true;p.job=null;p.mind.activity=r.kind==='lost-teacher'?'study':'rest';p.mind.reason=r.kind==='lost-teacher'?'核实师亡后整理既有授业，已学保留，再寻指导。':'核实亲人身死后暂缓冒险，整理遗物与家事。';p.mind.commitUntil=s.time+12;p.schedule.commitUntilTick=s.worldTick+120;return true;
}
export function viewAftermath(s){
 const a=s.srAftermath;if(!a)return {deaths:[],orders:[],reactions:[],lineages:[],debts:[]};
 const deaths=Object.values(a.deathCases).filter(c=>deadKnown(s,MASTER,c.personId)).map(c=>{
  const f=deathFact(s,c.personId),obligationsKnown=factKnown(s,MASTER,`fact:estate-obligations-observed:${c.personId}`),kin=(obligationsKnown?a.kinships:[]).filter(k=>k.relativeId===c.personId).map(k=>({personId:k.personId,name:s.personsById[k.personId].name,nearby:together(s.master,s.personsById[k.personId]),notified:deadKnown(s,k.personId,c.personId)})),creditors=(obligationsKnown?c.debtIds:[]).map(id=>a.debts[id]).filter(d=>d.debtorId===c.personId).map(d=>({id:d.id,creditorId:d.creditorId,creditorName:s.personsById[d.creditorId].name,resource:d.resource,quantity:d.quantity,paid:d.paid,status:d.status,nearby:together(s.master,s.personsById[d.creditorId]),notified:deadKnown(s,d.creditorId,c.personId)}));
  return {personId:c.personId,name:s.personsById[c.personId].name,deathFactId:c.deathFactId,observedDeathTick:f.atTick,lastKnownSceneId:f.sceneId,obligationsKnown,kin,creditors,canCollect:!!c.custodyPermission&&!c.collected&&atCorpse(s,c.personId),collected:c.collected,delivered:c.delivered,custodyPermission:c.custodyPermission?copy(c.custodyPermission):null,rule:'只托管同一原遗物；私人资产、借物与债务不自动继承。'};
 });
 const visible=fid=>factKnown(s,MASTER,fid);
 return {deaths,orders:Object.values(a.orders).filter(o=>!['completed','cancelled'].includes(o.phase)).map(copy),reactions:Object.values(a.reactions).filter(r=>r.observedByMaster&&visible(r.factId)&&deadKnown(s,r.observerId,r.personId)).map(copy),lineages:Object.entries(a.lineages).flatMap(([pid,x])=>x.filter(l=>l.status==='unavailable'&&deadKnown(s,MASTER,l.teacherId)&&(pid===MASTER||s.homeMemberIds.includes(pid)||deaths.some(d=>d.kin.some(k=>k.personId===pid&&k.notified)))).map(l=>({personId:pid,name:s.personsById[pid].name,...copy(l)}))),debts:deaths.flatMap(d=>d.creditors)};
}
export function validateAftermath(s){
 const a=s.srAftermath;if(!a)return true;const fail=m=>{throw Error('身后事务存档异常：'+m);},tick=n=>Number.isSafeInteger(n)&&n>=0&&n<=s.worldTick;
 if(a.version!==AFTERMATH_RULES.id||!tick(a.lastTick)||!tick(a.migrationTick)||a.rainContentActivatedTick!==null&&!tick(a.rainContentActivatedTick)||!Array.isArray(a.historicalFactIds)||!Array.isArray(a.historicalDeathIds)||!Number.isSafeInteger(a.nextId)||a.nextId<1)fail('版本/共同世界游标');
 for(const k of a.kinships)if(!s.personsById[k.personId]||!s.personsById[k.relativeId]||!k.source)fail('亲属来源');
 for(const [pid,c]of Object.entries(a.deathCases)){
  if(c.personId!==pid||!s.personsById[pid]||deathFact(s,pid)?.id!==c.deathFactId||!tick(c.createdTick)||!Array.isArray(c.debtIds)||c.debtIds.some(id=>!a.debts[id])||c.delivered&&!c.collected||c.collected&&!c.custodyPermission)fail('身死/原遗物托付引用');
  if(c.custodyPermission&&(!s.personsById[c.custodyPermission.recipientId]||c.custodyPermission.carrierId!==MASTER||c.custodyPermission.privatePropertyInherited!==false||c.custodyPermission.sourceFactId!==c.deathFactId||!tick(c.custodyPermission.formedTick)))fail('托付不是继承');
  if(c.collected){const i=s.itemsById[`item:relic:${pid}`],holder=c.delivered?c.custodyPermission.recipientId:MASTER;if(i?.ownerId!==pid||i.location.kind!=='person'||i.location.id!==holder||i.holderId!==holder||!tick(c.collectedTick)||c.delivered&&!tick(c.deliveredTick))fail('同一原物的产权/保管');}
 }
 for(const [id,d]of Object.entries(a.debts)){
  if(d.id!==id||!s.personsById[d.debtorId]||!s.personsById[d.creditorId]||!RESOURCES[d.resource]||!Number.isFinite(d.quantity)||d.quantity<=0||!Number.isFinite(d.paid)||d.paid<0||d.paid>d.quantity||!['open','estate-pending','creditor-estate','settled'].includes(d.status)||!Array.isArray(d.settlements)||d.settlements.reduce((n,x)=>n+x.quantity,0)!==d.paid||d.status==='settled'&&d.paid!==d.quantity)fail('有限债务主体/付款守恒');
  const seen=new Set();for(const x of d.settlements){const o=a.orders[x.orderId];if(seen.has(x.orderId)||o?.phase!=='completed'||o.choice!=='payDebt'||o.debtId!==id||x.payerId!==MASTER||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity!==o.cost[d.resource]||!tick(x.atTick)||!s.stockpilesById[x.sourceStockpileId]||s.stockpilesById[x.targetStockpileId]?.ownerId!==d.creditorId)fail('同一付款结算/来源');seen.add(x.orderId);}
 }
 for(const [pid,links]of Object.entries(a.lineages))if(!s.personsById[pid]||!Array.isArray(links)||links.some(l=>!s.personsById[l.teacherId]||!l.sourceId||!['active','unavailable'].includes(l.status)||l.status==='unavailable'&&(!s.deathRecordsByPersonId[l.teacherId]||!tick(l.endedAtTick))))fail('师承来源');
 for(const r of Object.values(a.reactions))if(!s.personsById[r.observerId]||!s.personsById[r.personId]||deathFact(s,r.personId)?.id!==r.factId||!tick(r.learnedTick)||!Number.isSafeInteger(r.untilTick)||r.untilTick<r.learnedTick||!factKnown(s,r.observerId,r.factId)||typeof r.observedByMaster!=='boolean')fail('知情余波来源');
 for(const r of Object.values(a.appraisals))if(!s.personsById[r.observerId]||!s.personsById[r.actorId]||s.factsById[r.factId]?.actorId!==r.actorId||!tick(r.atTick)||!Number.isFinite(r.delta)||Math.abs(r.delta)>100||typeof r.projected!=='boolean'||!factKnown(s,r.observerId,r.factId))fail('知情评价来源');
 for(const [id,o]of Object.entries(a.orders)){
  if(o.id!==id||!s.personsById[o.personId]||o.counterpartyId&&!s.personsById[o.counterpartyId]||!['notify','permission','collect','handover','payDebt'].includes(o.choice)||!['reserved','executing','blocked','completed','cancelled'].includes(o.phase)||!Number.isSafeInteger(o.durationTicks)||o.durationTicks<1||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||deathFact(s,o.personId)?.id!==o.deathFactId||!tick(o.startedTick)||!s.stockpilesById[o.sourceStockpileId]||!o.cost||Object.entries(o.cost).some(([k,v])=>!RESOURCES[k]||!Number.isFinite(v)||v<0)||o.choice==='payDebt'&&!a.debts[o.debtId]||o.choice!=='payDebt'&&Object.keys(o.cost).length||o.phase==='completed'&&(o.costReserved||o.progressTicks!==o.durationTicks||!tick(o.completedTick))||o.phase==='cancelled'&&(o.costReserved||!tick(o.cancelledTick)))fail('原子会面/交接订单');
 }
 return true;
}
