/** U-63/R-25: recommendations are opportunities considered by the existing NPC loop. */
import {TECHNIQUES,RESOURCES,log,xpNeed,realmName} from './ea-data.mjs';
import {pharmacistProgress} from './ea-sr-economy.mjs';
import {breakthroughView} from './ea-sr-cultivation.mjs';
import {sceneUnits} from './ea-sr-spatial.mjs';
import {actorScenePosition,lifeFacility,lifeScenePath,personLifeSummary} from './ea-life.mjs';
import {scenicDistance} from './ea-scenic.mjs';
export const DISCIPLE_WORK_FOCUS_OPTIONS=[{id:'balanced',label:'均衡差事'},...['food','wood','stone','herb','crystal','insight','jade'].map(id=>({id,label:`侧重${RESOURCES[id]}`}))];
// T-DISCIPLE-DEVELOPMENT-20261025: trustMin 40 and recommendationBonus 35; see design record 74.
export const DISCIPLE_DEVELOPMENT_RULES=Object.freeze({trustMin:40,recommendationBonus:35});
let studyRequirement=()=>'';
export function configureDiscipleDevelopment({studyLock}){studyRequirement=studyLock;}
const visible=(s,p,id)=>!p.mind.hiddenKnowledge?.[id]||s.society?.secrets?.some(e=>e.id===p.mind.hiddenKnowledge[id]&&e.discovered);
const books=s=>(s.doctrine?.books||[]).filter(id=>TECHNIQUES[id]&&!s.doctrine.sealed?.includes(id));
const members=s=>(s.disciples||[]).filter(p=>p.lifeStatus!=='dead'&&(!s.homeMemberIds||s.homeMemberIds.includes(p.personId)));
export function developmentContact(s,p){
 const m=s.master,a=actorScenePosition(s,m),b=actorScenePosition(s,p);
 const local=x=>x&&x.lifeStatus!=='dead'&&x.position?.sceneId==='scene:yunxiu-courtyard'&&!x.mind?.away&&!x.journey;
 const available=local(m)&&local(p)&&!s.world?.exploration&&s.combat?.status!=='active'&&scenicDistance(a,b)<=sceneUnits(s,48);
 return {available,reason:available?'':'先与门人在院中走近交谈，再推荐法门。'};
}
function option(s,p,id,{contact=true}={}){
 const m=p.mind,t=TECHNIQUES[id],c=developmentContact(s,p);
 let reason=!books(s).includes(id)||!visible(s,p,id)?'尚无可公开推荐的典籍。':contact&&!c.available?c.reason:(m.knowledge?.[id]||0)>=100?'已融会贯通。':m.restrictedUntil>(s.society?.clock??s.time)?'当前借阅约定尚未恢复。':studyRequirement(s,p,id,false)||'';
 const facility=!reason&&lifeFacility(s,p,'study',id);
 if(!reason&&(!facility||lifeScenePath(s,p,facility)===null))reason='当前没有可抵达的研习位置。';
 const trust=m.relationships?.master?.trust??55;
 const willing=!reason&&trust>=DISCIPLE_DEVELOPMENT_RULES.trustMin&&(m.refusalUntil??0)<=(s.society?.clock??s.time);
 return {techniqueId:id,name:t?.name||'',available:!reason,willing,status:reason?'unavailable':willing?'accepted':'refused',reason:reason||(!willing?'我暂不愿接受这项研习建议，想先照顾自己的安排。':'我愿在现有承诺、身体与研习条件允许时考虑这门法门。')};
}
export function setDiscipleWorkFocus(s,value){
 const o=DISCIPLE_WORK_FOCUS_OPTIONS.find(o=>o.id===value);if(!o)throw Error('经营侧重无效。');
 if(s.doctrine.workFocus!==value){s.doctrine.workFocus=value;log(s,`掌门公布经营侧重「${o.label}」，门人将在既有承诺结束后自行权衡。`);}return {accepted:true,publicReason:`经营侧重已公布为「${o.label}」，门人将在现有承诺结束后自行权衡。`};
}
export function recommendDiscipleTechnique(s,{personId,techniqueId}={}){
 const p=members(s).find(p=>p.personId===personId);if(!p)throw Error('只能向本院现有门人推荐法门。');
 if(!books(s).includes(techniqueId)||!visible(s,p,techniqueId))throw Error('尚无可公开推荐的典籍。');
 const o=option(s,p,techniqueId),prior=p.mind.developmentRecommendation;
 const signature=JSON.stringify([techniqueId,o.available,o.willing,o.reason,p.mind.main,p.mind.support,p.realm]);
 if(prior?.signature===signature&&['accepted','refused','unavailable'].includes(prior.status))return structuredClone(prior);
 const r={techniqueId,name:o.name,status:o.status,accepted:o.willing,available:o.available,publicReason:o.reason,atTick:s.worldTick,signature,understandingAtOffer:p.mind.knowledge?.[techniqueId]||0};
 p.mind.developmentRecommendation=r;return structuredClone(r);
}
export function advanceDiscipleDevelopment(s,p){
 const r=p.mind.developmentRecommendation;if(r?.status!=='accepted')return;
 const value=p.mind.knowledge?.[r.techniqueId]||0;
 if(value>r.understandingAtOffer){r.status='completed';r.completedAtTick=s.worldTick;r.publicReason=`已通过实际研习加深《${TECHNIQUES[r.techniqueId].name}》理解，接下来仍由本人安排。`;return;}
 const o=option(s,p,r.techniqueId,{contact:false});
 if(!o.available){r.status='invalidated';r.accepted=false;r.available=false;r.publicReason=o.reason;r.closedAtTick=s.worldTick;}
}
function cultivationProgress(s,p){
 const breakthrough=breakthroughView(s,p.personId);
 const order=Object.values(s.srCultivation?.orders||{}).find(o=>o.personId===p.personId&&o.kind==='breakthrough'&&!['completed','cancelled'].includes(o.phase));
 const materials=Object.entries(breakthrough.cost).map(([id,required])=>({id,label:RESOURCES[id]||id,required,available:s.resources[id]||0}));
 return {realm:realmName(p.realm),xp:p.xp,required:xpNeed(p.realm),conditions:order?[]:[...breakthrough.locks],materials:order?[]:materials,breakthrough:order?{progress:order.progressTicks,total:order.durationTicks,reason:order.reason}:null};
}
export function discipleDevelopmentView(s){
 const value=s.doctrine?.workFocus||'balanced';return {workFocus:{value,label:DISCIPLE_WORK_FOCUS_OPTIONS.find(o=>o.id===value)?.label||value,options:structuredClone(DISCIPLE_WORK_FOCUS_OPTIONS)},members:members(s).map(p=>{
 const m=p.mind,learning=m.learning&&visible(s,p,m.learning.id)&&books(s).includes(m.learning.id)?{...m.learning,name:TECHNIQUES[m.learning.id]?.name}:null;
 const privateStudy=m.activity==='study'&&m.learning&&!learning;
 const r=m.developmentRecommendation,contact=developmentContact(s,p);
 if(!contact.available)return {personId:p.personId,name:p.name,goal:m.goal,activity:null,activityLabel:'待当面了解',reason:contact.reason,contact,learning:null,knowledge:[],skills:[],options:[],recommendation:r&&books(s).includes(r.techniqueId)&&visible(s,p,r.techniqueId)?{techniqueId:r.techniqueId,name:r.name,atTick:r.atTick,publicReason:'此前已记录研习建议，当前进展待当面了解。'}:null};
 const life=personLifeSummary(s,p);
 return {personId:p.personId,name:p.name,goal:m.goal,activity:m.activity,activityLabel:life.label,activityStatus:life.status,physicalReason:life.reason,reason:privateStudy?'独处参悟，暂不愿详谈。':m.reason,contact,learning,pharmacist:visible(s,p,'alchemy')?pharmacistProgress(s,p.personId):null,cultivation:cultivationProgress(s,p),knowledge:Object.entries(m.knowledge||{}).filter(([id])=>TECHNIQUES[id]&&visible(s,p,id)).map(([techniqueId,value])=>({techniqueId,name:TECHNIQUES[techniqueId].name,value})),skills:Object.entries(m.skills||{}).map(([id,value])=>({id,label:({plant:'灵植',learning:'研习',medicine:'医理',array:'阵法',industry:'百工'})[id]||id,value})),options:books(s).filter(id=>visible(s,p,id)).map(id=>option(s,p,id)),recommendation:r&&books(s).includes(r.techniqueId)&&visible(s,p,r.techniqueId)?structuredClone(r):null};
 })};
}

/** Optional on old saves; existing receipts must be well formed before loading. */
export function validateDiscipleDevelopment(s){
 const tick=n=>Number.isSafeInteger(n)&&n>=0&&n<=s.worldTick;
 for(const p of Object.values(s.personsById||{})){
  const r=p.mind?.developmentRecommendation;if(r===undefined)continue;
  if(!r||typeof r!=='object'||Array.isArray(r)||!TECHNIQUES[r.techniqueId]||r.name!==TECHNIQUES[r.techniqueId].name||!['accepted','refused','unavailable','completed','invalidated'].includes(r.status)||typeof r.accepted!=='boolean'||typeof r.available!=='boolean'||typeof r.publicReason!=='string'||!r.publicReason||r.publicReason.length>500||typeof r.signature!=='string'||!r.signature||r.signature.length>2048||!tick(r.atTick)||!Number.isFinite(r.understandingAtOffer)||r.understandingAtOffer<0||r.understandingAtOffer>100)throw Error('存档校验失败：门人研习建议记录异常');
  if(r.accepted!==['accepted','completed'].includes(r.status)||['accepted','completed','refused'].includes(r.status)&&!r.available||['unavailable','invalidated'].includes(r.status)&&r.available||r.status==='completed'&&(!tick(r.completedAtTick)||r.completedAtTick<r.atTick)||r.status==='invalidated'&&(!tick(r.closedAtTick)||r.closedAtTick<r.atTick)||r.completedAtTick!==undefined&&r.status!=='completed'||r.closedAtTick!==undefined&&r.status!=='invalidated')throw Error('存档校验失败：门人研习建议时序异常');
 }
 return true;
}
