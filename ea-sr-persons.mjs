/** SR-XF-007/008. Persistent identity recipes, semantic action fallback and deterministic voluntary invitations. */
import {beginPersonBreakthrough,breakthroughView} from './ea-sr-cultivation.mjs?v=ea-160-courtyard-20261008-r36';
import {BUILDINGS} from './ea-data.mjs?v=ea-160-courtyard-20261008-r36';
import {workOpportunity} from './ea-life.mjs?v=ea-160-courtyard-20261008-r36';
import {cloneState} from './ea-state-v6.mjs?v=ea-160-courtyard-20261008-r36';
import {releaseBodyActivity} from './ea-facility-activities.mjs?v=ea-160-courtyard-20261008-r36';
import {equippedAppearanceMounts} from './ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r36';
import {initAftermath,tickAftermath,validateAftermath,aftermathDecision,aftermathAction,viewAftermath} from './ea-sr-aftermath.mjs?v=ea-160-courtyard-20261008-r36';
export {viewAftermath,AFTERMATH_RULES} from './ea-sr-aftermath.mjs?v=ea-160-courtyard-20261008-r36';
const mind=p=>p.mind||p,clone=v=>structuredClone(v),hash=s=>[...s].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);
export const APPEARANCE_CATALOG={id:'appearance:yunxiu:v1',body:['slim','regular','broad'],face:['oval','angular','round'],hair:['topknot','half-tied','braid','loose'],outfit:['traveller','herbalist','artisan','disciple'],source:'U-63/R-25',slots:['weapon','armor','artifact','accessory']};
export const ACTION_FRAMES={stand:{pose:'upright',tool:null,asset:'yunxiu-courtyard:characters:v1'},walk:{pose:'walk',tool:null,asset:'yunxiu-courtyard:characters:v1'},work:{pose:'working',tool:'facility-specific',asset:'yunxiu-courtyard:characters:v1'},plant:{pose:'stoop',tool:'hoe',asset:'yunxiu-courtyard:characters:v1'},gather:{pose:'reach',tool:'basket',asset:'yunxiu-courtyard:characters:v1'},study:{pose:'seated',tool:'book',asset:'yunxiu-courtyard:characters:v1'},rest:{pose:'recline',tool:null,asset:'yunxiu-courtyard:characters:v1'},heal:{pose:'seated',tool:'bandage',asset:'yunxiu-courtyard:characters:v1'},cast:{pose:'cast',tool:'equipped-focus',asset:'yunxiu-courtyard:characters:v1'},hit:{pose:'recoil',tool:null,asset:'yunxiu-courtyard:characters:v1'},transport:{pose:'walk',tool:'bundle',asset:'yunxiu-courtyard:characters:v1'},waiting:{pose:'upright',tool:null,asset:'yunxiu-courtyard:characters:v1'},groundRest:{pose:'ground-rest',tool:null,asset:'yunxiu-courtyard:characters:v1'},cultivate:{pose:'seated',tool:null,asset:'yunxiu-courtyard:characters:v1'},teach:{pose:'gesture',tool:'book',asset:'yunxiu-courtyard:characters:v1'},down:{pose:'ground-rest',tool:null,asset:'yunxiu-courtyard:characters:v1'}};
export const AUTONOMY={version:'autonomy:yunxiu:v1',source:'U-63/R-25/T-03',commitTicks:240,retryTicks:120,switchThreshold:12,injuryInterrupt:20,energyMin:22,trustMin:15,dayPhases:[{from:0,to:.2,activity:'rest'},{from:.2,to:.55,activity:'work'},{from:.55,to:.8,activity:'study'},{from:.8,to:1,activity:'rest'}]};
export const AUTONOMY_V2={version:'autonomy:yunxiu:v2',source:'U-63/R-25/T-03',commitTicks:240,switchThreshold:15,retryTicks:[150,300,600],invitationThreshold:42};
const dayPhaseAtTick=s=>{const fraction=(s.worldTick%s.ticksPerDay)/s.ticksPerDay;return AUTONOMY.dayPhases.find(phase=>fraction>=phase.from&&fraction<phase.to).activity;};
function upgradeLegacyClientRecipe(s,p){
 if(p.personId!=='person:late:chen-yuanshu'||s.srLateEconomy?.version!=='late-economy:qingxi:v1'||s.factsById?.['fact:late:registered-budget']?.actorId!==p.personId||p.appearance?.spriteIndex!==3||p.appearance.accent!=='#6696ad')return;
 const source=Object.values(s.personsById).find(person=>person.mind);
 if(source&&source!==p&&p.appearance.recipe?.id===`appearance:${source.personId}:v1`&&source.appearance?.recipe?.id===p.appearance.recipe.id){
  // The old world-person factory copied this ID; retain the saved visual traits.
  p.appearance.recipe.id=`appearance:${p.personId}:v1`;
 }
}
export function initPersons(s){initAftermath(s);for(const p of Object.values(s.personsById)){const seed=hash(p.personId);p.appearance??={spriteIndex:seed%6,accent:'#91a9ce'};upgradeLegacyClientRecipe(s,p);if(!Object.hasOwn(p.appearance,'recipe'))p.appearance.recipe={id:`appearance:${p.personId}:v1`,body:APPEARANCE_CATALOG.body[seed%3],face:APPEARANCE_CATALOG.face[(seed>>>2)%3],hair:APPEARANCE_CATALOG.hair[(seed>>>4)%4],outfit:p.personId==='person:lu-zhiwei'?'herbalist':p.personId==='person:cheng-wenzhou'?'artisan':p.personId==='person:master'?'traveller':'disciple',faceMark:(seed>>>7)%5,height:1.65+(seed%20)/100};p.schedule??={definitionId:AUTONOMY.version,commitUntilTick:s.worldTick,updatedThroughTick:s.worldTick,lastReason:'自行权衡生活与修行。',invitations:{},phase:'rest',responsibilitySlots:[],privateMotives:[]};}return s;}
/** Prepare a v2 candidate save on an isolated copy; the live v1 decision owner remains unchanged. */
export function prepareAutonomyV2(input,validateSource){
 if(input.schemaVersion!==6||input.contentVersion!=='sr-content-v1.2')throw Error('自主日程迁移需要正式 SR 存档。');
 if(typeof validateSource!=='function')throw Error('自主日程迁移需要先校验原存档。');
 const s=cloneState(validateSource(input));initPersons(s);
 for(const p of Object.values(s.personsById)){
  if(!s.homeMemberIds.includes(p.personId)||p.compatibilityMode==='historical-only'||p.recordScope==='historical-only')continue;
  const schedule=p.schedule;if(schedule.definitionId===AUTONOMY_V2.version)continue;
  if(schedule.definitionId!==AUTONOMY.version)throw Error('自主日程定义版本未知。');
  const goal=typeof p.mind?.goal==='string'&&p.mind.goal?p.mind.goal:null;
  const goalFactId=goal?`fact:autonomy:legacy-goal:${p.personId}`:null;
  if(goalFactId){const existing=s.factsById[goalFactId];if(existing&&(existing.kind!=='autonomy-legacy-goal'||existing.personId!==p.personId||existing.goal!==goal))throw Error('人物目标迁移来源冲突。');s.factsById[goalFactId]??={id:goalFactId,kind:'autonomy-legacy-goal',personId:p.personId,goal,atTick:s.worldTick,source:'person.mind.goal'};}
  const commitmentsById={};
  for(const [key,receipt]of Object.entries(schedule.invitations||{})){
   if(!key.startsWith('work:')||!receipt?.accepted||!Number.isSafeInteger(receipt.atTick)||receipt.atTick>s.worldTick)continue;
   const building=s.buildings.find(b=>b.instanceId===key.slice(5)),body=s.activitiesById[p.activityId];
   if(!building||p.job!==building.id||p.mind?.activity!=='work'||schedule.commitUntilTick<=s.worldTick||body&&(body.kind!=='facility'||body.targetId!==building.instanceId))continue;
   const sourceFactId=`fact:autonomy:legacy-invitation:${p.personId}:${building.instanceId}:${receipt.atTick}`;
   const existing=s.factsById[sourceFactId];if(existing&&(existing.kind!=='autonomy-legacy-invitation'||existing.personId!==p.personId||existing.targetId!==building.instanceId||existing.accepted!==true))throw Error('工作承诺迁移来源冲突。');
   s.factsById[sourceFactId]??={id:sourceFactId,kind:'autonomy-legacy-invitation',personId:p.personId,targetId:building.instanceId,accepted:true,originalAtTick:receipt.atTick,atTick:s.worldTick,signature:receipt.signature,source:'schedule.invitations'};
   const id=`commitment:autonomy:work:${p.personId}:${building.instanceId}:${receipt.atTick}`;
   commitmentsById[id]={id,sourceFactId,activity:'work',targetId:building.instanceId,startTick:receipt.atTick,endTick:schedule.commitUntilTick,accepted:true,status:'active'};
  }
  const commitmentIds=Object.keys(commitmentsById).sort();
  p.lifePlan={id:`plan:autonomy:${p.personId}`,goalId:goalFactId,sourceFactId:goalFactId,createdAtTick:s.worldTick,currentStepId:commitmentIds[0]||null,dependencyIds:[],commitmentIds,reviewAtTick:Math.max(s.worldTick,schedule.commitUntilTick),status:goal?'active':'unplanned'};
  schedule.definitionId=AUTONOMY_V2.version;schedule.phase=dayPhaseAtTick(s);schedule.commitmentsById=commitmentsById;schedule.responsibilitySlots??=[];schedule.retriesByTarget={};schedule.privateMotives??=[];
 }
 return s;
}
/** Deterministic work candidate for a v2 plan; this read does not choose or execute an activity. */
export function workCandidateV2(s,personId,buildingId){
 const p=s.personsById[personId],b=s.buildingsById[buildingId];
 if(!p||!b||p.schedule?.definitionId!==AUTONOMY_V2.version)throw Error('自主日程候选需已迁移的人物和真实营造。');
 const id=`candidate:autonomy:work:${personId}:${buildingId}`,m=mind(p);
 const blocked=reason=>({id,activity:'work',targetId:buildingId,available:false,willing:false,score:null,reason});
 if(p.lifeStatus==='dead'||!s.homeMemberIds.includes(personId))return blocked('本人已不在院内可接受差事的身份。');
 if(p.position?.kind!=='scene'||p.position.sceneId!=='scene:yunxiu-courtyard'||p.location?.sceneId&&p.location.sceneId!=='scene:yunxiu-courtyard')return blocked('本人尚未真实返回山院。');
 if(m.scenic?.spatialEvacuationOrderId||p.schedule?.aftermath?.untilTick>s.worldTick)return blocked('当前已有优先处理的撤离或身后事务。');
 const opportunity=workOpportunity(s,p,b);
 const personalRefusal=!opportunity.available&&['先前分歧仍未缓和，暂不接差事。','对掌门缺乏信任，暂不愿响应差事。'].includes(opportunity.reason);
 if(!opportunity.available&&!personalRefusal)return blocked(opportunity.reason);
 const otherBody=s.activitiesById[p.activityId];if(otherBody&&otherBody.kind!=='facility')return blocked('本人正承担另一项身体活动。');
 if(otherBody?.kind==='facility'&&otherBody.targetId!==buildingId&&otherBody.phase==='executing')return blocked('正在执行当前工序，先安全结束或中断。');
 const commitments=Object.values(p.schedule.commitmentsById||{});
 if(commitments.some(c=>c.status==='active'&&c.targetId!==buildingId&&c.endTick>s.worldTick))return blocked('本人已有尚未到期的差事承诺。');
 const supply=s.factsById[`fact:person-daily-supply:${personId}:${s.society.lastDay}`],goal=s.factsById[p.lifePlan?.goalId]?.goal||'';
 const need=supply?.kind==='daily-supply-relation'&&!supply.supplied?80:50;
 const aspiration=goal.includes('草木')&&b.type==='farm'||goal.includes('护道')&&b.type==='quarry'?80:50;
 const skillKey=b.type==='farm'?'plant':b.type==='library'?'learning':b.type==='clinic'?'medicine':b.type==='well'?'array':'industry';
 // The ordinary production recipes have no specialist gate; scholarly and
 // formation work still uses the person's actual learned skill.
 const skill=Math.max(0,Math.min(100,m.skills?.[skillKey]??0));
 const ability=['farm','lumber','quarry','granary','workshop'].includes(b.type)?Math.max(50,skill):skill;
 const relation=Math.max(0,Math.min(100,((m.relationships?.master?.trust??50)+(m.relationships?.master?.respect??50))/2));
 const responsibility=commitments.some(c=>c.status==='active'&&c.targetId===buildingId&&c.endTick>s.worldTick)?80:0;
 const dayFraction=(s.worldTick%s.ticksPerDay)/s.ticksPerDay,timeMatch=dayFraction>=.2&&dayFraction<.55?80:50;
 const risk=Math.max(0,Math.min(100,p.wound||0)),switchCost=m.activity==='work'&&p.job===b.id||['rest','social'].includes(m.activity)?0:15;
 const score=Math.max(0,Math.min(100,Math.round(need*.24+aspiration*.18+ability*.16+relation*.16+responsibility*.16+timeMatch*.10-risk*.20-switchCost)));
 const willing=!personalRefusal&&score>=AUTONOMY_V2.invitationThreshold;
 return {id,activity:'work',targetId:buildingId,available:true,willing,score,reason:personalRefusal?opportunity.reason:willing?'我愿在现有承诺与体力允许时考虑这份差事。':'我更想先顾及自己的修行与生活。',inputs:{need,aspiration,ability,relation,responsibility,timeMatch,risk,switchCost}};
}
export function appearanceView(s,personId){const p=s.personsById[personId];if(!p)return null;const a=p.appearance||{},m=mind(p),activity=s.activitiesById[p.activityId];let action=m.activity||p.action||'stand';
 if(activity?.kind==='sr-harvest')action=activity.phase==='moving'?'walk':activity.phase==='working'?'gather':'waiting';
 else if(activity?.kind==='sr-replenish')action=activity.phase==='moving'?'walk':activity.phase==='working'?(activity.resource==='herb'||activity.resource==='food'||activity.resource==='wood'?'plant':'work'):'waiting';
 else if(activity?.kind==='sr-craft')action=activity.phase==='moving'?'walk':activity.phase==='working'?'work':'waiting';
 else if(activity?.kind==='sr-drainage')action=activity.phase==='working'?'work':'waiting';
 else if(['construction','sr-construction'].includes(activity?.kind))action=activity.phase==='moving'?'walk':activity.phase==='blocked'?'waiting':'work';
 else if(activity?.kind==='sr-merchant-collection')action=activity.phase==='carrying'?'transport':activity.phase==='moving'?'walk':'waiting';
 else if(activity?.kind==='sr-cultivation'&&s.srCultivation?.orders?.[activity.orderId]?.kind==='study')action=activity.phase==='executing'?'study':activity.phase==='moving'||activity.phase==='navigating'?'walk':'waiting';
 else if(activity?.kind==='sr-transport'){const order=s.workOrdersById[activity.workOrderId];action=order?.phase==='carrying'?'transport':order?.phase==='to-source'?'walk':'waiting';}
 else if(activity?.phase==='navigating'||m.scenic?.path?.length||p.scenic?.path?.length)action='walk';else if(activity?.phase==='waiting')action='waiting';
 else if(action==='work'){if(activity?.phase!=='executing')action='waiting';else{const b=s.buildingsById[activity?.targetId];action=b?.type==='farm'?'plant':['lumber','quarry'].includes(b?.type)?'gather':'work';}}
 else if(action==='rest'&&activity?.phase!=='executing')action='groundRest';
 const combat=p===s.master?s.combat?.player:s.combat?.allies?.find(x=>x.personId===personId);if(combat&&s.combat?.status==='active'){if(Number.isSafeInteger(combat.lastHitTick)&&s.worldTick-combat.lastHitTick<8)action='hit';else if(s.srCombat?.pending?.personId===personId||p===s.master&&s.srCombat?.pending)action='cast';else action='stand';}
 const known=Object.hasOwn(ACTION_FRAMES,action),frame=ACTION_FRAMES[action]||ACTION_FRAMES.stand,mounts=equippedAppearanceMounts(s,p.personId);
 let tool=frame.tool;if(action==='work'){const b=s.buildingsById[activity?.targetId];tool=activity?.kind==='sr-craft'?'mortar':activity?.kind==='sr-drainage'?'spade':b?.type==='workshop'?'hammer':b?.type==='library'||activity?.kind==='sr-replenish'&&activity.resource==='insight'?'book':b?.type==='well'||activity?.kind==='sr-replenish'&&activity.resource==='crystal'?'equipped-focus':tool;}
 const reservation=s.reservationsById?.[activity?.reservationId];
 const reservedBed=action==='rest'&&activity?.phase==='executing'&&reservation?.kind==='slot'&&reservation.activityId===activity.id&&reservation.slotId===activity.slotId&&reservation.personId===personId;
 return {personId:p.personId,name:p.name,spriteIndex:a.spriteIndex,accent:a.accent,recipe:clone(a.recipe||null),portraitKey:`portrait:${p.personId}`,action,pose:frame.pose,tool,asset:frame.asset,assetRole:'identity-base',sceneAssetCandidate:reservedBed?'yunxiu-courtyard:rest:v1':null,fullAnimationAvailable:false,fallback:!known?'未知活动使用稳定站立姿态，未宣称专用动作':reservedBed?'床位执行可使用同身份静态仰卧素材；实际床面位置或图片不成立时回退到同身份床边人物':['stand','walk','waiting','transport'].includes(action)?null:'沿用同身份云岫静态人物与真实工具；该活动专用连续身体动作尚未绘制',animationTick:s.worldTick,mounts};}
function signature(s,p,b,opportunity){const m=mind(p);return JSON.stringify([b.instanceId,b.enabled,b.condition>0,b.spatialLock||null,p.wound>20,p.energy<22,m.satiety<22,m.away?.kind||null,m.journey?.id||null,Math.floor((m.relationships?.master?.trust??55)/10),Math.floor((m.traits?.[3]??60)/10),s.resources.herb>=1,s.resources.food>=1,opportunity.available,opportunity.available?'':opportunity.reason,m.scenic?.spatialEvacuationOrderId||null]);}
function inviteWorkV2(s,p,b){
 const key=`work:${b.instanceId}`,prior=p.schedule.invitations[key],m=mind(p);
 const active=Object.values(p.schedule.commitmentsById).find(c=>c.status==='active'&&c.targetId===b.instanceId&&c.endTick>s.worldTick);
 if(active&&p.job===b.id&&m.activity==='work'&&prior?.accepted)return clone(prior);
 const candidate=workCandidateV2(s,p.personId,b.instanceId);
 const inputs=candidate.inputs;
 const sig=JSON.stringify([candidate.id,candidate.available,candidate.willing,candidate.reason,b.enabled,b.condition>0,b.spatialLock||null,inputs&&[inputs.need,inputs.aspiration,Math.floor(inputs.ability/10),Math.floor(inputs.relation/10),inputs.responsibility,inputs.timeMatch,Math.floor(inputs.risk/10),inputs.switchCost]]);
 if(prior?.signature===sig)return clone(prior);
 const accepted=candidate.available&&candidate.willing;
 const earlier=p.schedule.retriesByTarget[key],failures=accepted?0:Math.min(3,(earlier?.consecutiveFailures||0)+1);
 const retryAfterTick=accepted?null:s.worldTick+AUTONOMY_V2.retryTicks[failures-1];
 const sourceFactId=`fact:autonomy:work-choice:${p.personId}:${b.instanceId}:${s.worldTick}:${s.transactions.nextCommandId}`;
 if(s.factsById[sourceFactId])throw Error('工作意愿来源事实重复。');
 const publicReason=!candidate.available?candidate.reason:accepted?'我愿在承诺期内承担这份差事。':candidate.reason;
 s.factsById[sourceFactId]={id:sourceFactId,kind:'autonomy-work-choice',personId:p.personId,targetId:b.instanceId,accepted,originalAtTick:s.worldTick,atTick:s.worldTick,sourceCommandId:`command:${s.transactions.nextCommandId}`,signature:sig,score:candidate.score,publicReason};
 const result={accepted,available:candidate.available,signature:sig,atTick:s.worldTick,score:candidate.score,publicReason,retryAfterTick,sourceFactId};
 p.schedule.invitations[key]=result;
 if(!accepted){p.schedule.retriesByTarget[key]={signature:sig,consecutiveFailures:failures,nextReviewTick:retryAfterTick,sourceFactId};m.reason=publicReason;p.schedule.lastReason=publicReason;return clone(result);}
 delete p.schedule.retriesByTarget[key];releaseBodyActivity(s,p);p.job=b.id;m.activity='work';m.reason=publicReason;p.schedule.lastReason=publicReason;
 m.commitUntil=s.time+AUTONOMY_V2.commitTicks/10;m.lastDecision=s.time;p.schedule.commitUntilTick=s.worldTick+AUTONOMY_V2.commitTicks;
 const id=`commitment:autonomy:work:${p.personId}:${b.instanceId}:${s.worldTick}:${s.transactions.nextCommandId}`;
 p.schedule.commitmentsById[id]={id,sourceFactId,activity:'work',targetId:b.instanceId,startTick:s.worldTick,endTick:p.schedule.commitUntilTick,accepted:true,status:'active'};
 p.lifePlan.commitmentIds.push(id);p.lifePlan.currentStepId=id;p.lifePlan.reviewAtTick=p.schedule.commitUntilTick;
 return clone(result);
}
export function inviteWork(s,personId,buildingId){initPersons(s);const p=s.personsById[personId],b=s.buildings.find(b=>b.id===buildingId||b.instanceId===buildingId);if(!p||p===s.master||!s.homeMemberIds.includes(personId)||!b)throw Error('只能向在院门人提供真实差事。');if(p.schedule?.definitionId===AUTONOMY_V2.version)return inviteWorkV2(s,p,b);const opportunity=workOpportunity(s,p,b);if(p.lifeStatus==='dead'||p.mind?.scenic?.spatialEvacuationOrderId){opportunity.available=false;opportunity.reason=p.lifeStatus==='dead'?'此人已经身死。':'正在实际撤离施工占地，离开后再商议。';}if(p.schedule?.aftermath?.untilTick>s.worldTick){opportunity.available=false;opportunity.reason='正在整理已经核实的亲人/老师身后事务，暂不承诺新差事。';}const key=`work:${b.instanceId}`,sig=signature(s,p,b,opportunity),prior=p.schedule.invitations[key],m=mind(p);const promiseCurrent=prior?.accepted&&s.worldTick<prior.atTick+AUTONOMY.commitTicks&&s.worldTick<p.schedule.commitUntilTick&&p.job===b.id&&m.activity==='work';if(prior?.signature===sig&&(!prior.accepted||promiseCurrent))return clone(prior);const score=(m.traits?.[3]??60)*.3+(m.traits?.[0]??55)*.1+(m.relationships?.master?.trust??55)*.4+(m.goal?.includes('草木')&&b.type==='farm'?15:0);const willing=opportunity.available&&score>=42;const result={accepted:willing,available:opportunity.available,signature:sig,atTick:s.worldTick,score,publicReason:!opportunity.available?opportunity.reason:willing?'我愿在承诺期内承担这份差事。':'我更想先顾及自己的修行与生活。',retryAfterTick:s.worldTick+AUTONOMY.retryTicks};p.schedule.invitations[key]=result;if(willing){releaseBodyActivity(s,p);p.job=b.id;m.activity='work';m.reason=result.publicReason;p.schedule.lastReason=result.publicReason;m.commitUntil=s.time+AUTONOMY.commitTicks/10;m.lastDecision=s.time;p.schedule.commitUntilTick=s.worldTick+AUTONOMY.commitTicks;}return clone(result);}
/** Optional decision hook for the EXISTING society owner. It never executes or produces. */
export function npcScheduleDecision(s,p){if(p.schedule?.definitionId===AUTONOMY_V2.version)p.schedule.phase=dayPhaseAtTick(s);if(aftermathDecision(s,p))return true;if(!p.schedule)return false;const m=mind(p),a=s.activitiesById[p.activityId];if(m.scenic?.spatialEvacuationOrderId)return true;if(a?.kind?.startsWith('sr-'))return true;if(m.away||m.journey)return false;
 if(p.schedule.definitionId===AUTONOMY_V2.version){
  const promise=Object.values(p.schedule.commitmentsById||{}).find(c=>c.status==='active'&&c.endTick>s.worldTick);
  if(promise){
   if(p.wound>20||p.energy<22||m.satiety<20){releaseBodyActivity(s,p);p.job=null;m.activity=p.wound>20?'heal':m.satiety<20?'forage':'rest';m.commitUntil=s.time;p.schedule.commitUntilTick=s.worldTick;promise.status='interrupted';if(p.lifePlan?.currentStepId===promise.id)p.lifePlan.currentStepId=null;return false;}
   if(m.activity==='work'&&s.buildingsById[promise.targetId]?.id===p.job)return true;
  }
 }
 if(s.srCultivation&&(m.traits?.[1]??50)>=30){const v=breakthroughView(s,p.personId);if(!v.locks.length&&Object.entries(v.cost).every(([k,v])=>s.resources[k]>=v)){releaseBodyActivity(s,p);beginPersonBreakthrough(s,p.personId,{autonomous:true});m.reason='积累与材料已足，我愿到静修位置按阶段突破。';return true;}}if(p.wound>AUTONOMY.injuryInterrupt||p.energy<8){releaseBodyActivity(s,p);m.activity=p.wound>20?'heal':'rest';p.job=null;p.schedule.commitUntilTick=s.worldTick;return false;}if(s.worldTick<p.schedule.commitUntilTick)return true;
 const phase=(s.worldTick%s.ticksPerDay)/s.ticksPerDay,wanted=AUTONOMY.dayPhases.find(q=>phase>=q.from&&phase<q.to).activity;p.schedule.phase=wanted;
 if(wanted==='rest'&&p.energy<92&&m.satiety>=22){releaseBodyActivity(s,p);m.activity='rest';p.job=null;m.reason='夜间休整，白日再权衡工作与研习。';m.commitUntil=s.time+12;p.schedule.commitUntilTick=s.worldTick+120;return true;}return false;}
export function reconcileAutonomyV2Commitments(s){
 for(const p of Object.values(s.personsById)){
  if(p.schedule?.definitionId!==AUTONOMY_V2.version)continue;
  for(const c of Object.values(p.schedule.commitmentsById||{})){
   if(c.status!=='active')continue;
   const b=s.buildingsById[c.targetId],body=s.activitiesById[p.activityId];
   const interrupted=p.lifeStatus==='dead'||!s.homeMemberIds.includes(p.personId)||p.position?.kind!=='scene'||p.position.sceneId!=='scene:yunxiu-courtyard'||p.wound>AUTONOMY.injuryInterrupt||!b||b.enabled===false||b.condition<=0||!!b.spatialLock||p.job!==b.id||mind(p).activity!=='work'||body&&(body.kind!=='facility'||body.targetId!==c.targetId);
   if(c.endTick<=s.worldTick)c.status='completed';
   else if(interrupted)c.status='interrupted';
   else continue;
   if(p.lifePlan?.currentStepId===c.id)p.lifePlan.currentStepId=null;
  }
 }
}
export function tickPersons(s){initPersons(s);tickAftermath(s);reconcileAutonomyV2Commitments(s);for(const p of Object.values(s.personsById)){if(!p.schedule)continue;if(p.schedule.definitionId===AUTONOMY_V2.version)p.schedule.phase=dayPhaseAtTick(s);p.schedule.updatedThroughTick=s.worldTick;const a=s.activitiesById[p.activityId];p.schedule.lastReason=a?.reason||mind(p).reason||'按本人选择继续。';}}
export function viewPersons(s){const reactions=viewAftermath(s).reactions;return Object.values(s.personsById).filter(p=>p===s.master||s.homeMemberIds.includes(p.personId)).map(p=>{const m=mind(p),a=s.activitiesById[p.activityId],schedule=p.schedule;const visibleUntil=m.away||m.journey||!(m.commitUntil>0)?s.worldTick:schedule?.commitUntilTick;return {personId:p.personId,name:p.name,appearance:appearanceView(s,p.personId),schedule:schedule?{phase:schedule.definitionId===AUTONOMY_V2.version?dayPhaseAtTick(s):schedule.phase,commitUntilTick:visibleUntil,reason:a?.reason||m.reason||schedule.lastReason,aftermath:reactions.filter(r=>r.observerId===p.personId).map(clone),invitations:Object.values(schedule.invitations).map(i=>({accepted:i.accepted,available:i.available,atTick:i.atTick,reason:i.publicReason}))}:null,activityId:p.activityId,office:m.office||null};});}
function validateAutonomyV2(s,p){
 const schedule=p.schedule,plan=p.lifePlan,validTick=n=>Number.isSafeInteger(n)&&n>=0;
 if(!plan||plan.id!==`plan:autonomy:${p.personId}`||!validTick(plan.createdAtTick)||plan.createdAtTick>s.worldTick||!validTick(plan.reviewAtTick)||plan.reviewAtTick<plan.createdAtTick||!['active','unplanned'].includes(plan.status)||!Array.isArray(plan.dependencyIds)||!Array.isArray(plan.commitmentIds)||new Set(plan.dependencyIds).size!==plan.dependencyIds.length||new Set(plan.commitmentIds).size!==plan.commitmentIds.length)throw Error('人物阶段计划异常。');
 if(plan.goalId!==plan.sourceFactId||plan.goalId!==null&&(!s.factsById?.[plan.goalId]||s.factsById[plan.goalId].kind!=='autonomy-legacy-goal'||s.factsById[plan.goalId].personId!==p.personId)||plan.dependencyIds.some(id=>!s.factsById?.[id]))throw Error('人物阶段计划来源异常。');
 if(!schedule.commitmentsById||Array.isArray(schedule.commitmentsById)||!schedule.retriesByTarget||Array.isArray(schedule.retriesByTarget)||!Array.isArray(schedule.responsibilitySlots)||!Array.isArray(schedule.privateMotives))throw Error('人物承诺与退避字段异常。');
 for(const [id,c]of Object.entries(schedule.commitmentsById)){
  const fact=s.factsById?.[c.sourceFactId];
  if(c.id!==id||!fact||fact.personId!==p.personId||!['autonomy-legacy-invitation','autonomy-work-choice'].includes(fact.kind)||fact.targetId!==c.targetId||fact.originalAtTick!==c.startTick||c.activity!=='work'||c.accepted!==true||fact.accepted!==true||!validTick(c.startTick)||!validTick(c.endTick)||c.endTick<c.startTick||!['active','interrupted','completed'].includes(c.status)||c.status==='completed'&&c.endTick>s.worldTick||c.status==='active'&&(!s.buildingsById?.[c.targetId]||p.job!==s.buildingsById[c.targetId].id||p.mind?.activity!=='work'||c.endTick<=s.worldTick))throw Error('人物承诺来源或当前活动异常。');
 }
 if(plan.commitmentIds.some(id=>!schedule.commitmentsById[id])||plan.currentStepId!==null&&schedule.commitmentsById[plan.currentStepId]?.status!=='active')throw Error('人物阶段计划承诺引用异常。');
 for(const retry of Object.values(schedule.retriesByTarget))if(!retry||typeof retry.signature!=='string'||!validTick(retry.consecutiveFailures)||retry.consecutiveFailures>3||!validTick(retry.nextReviewTick)||s.factsById?.[retry.sourceFactId]?.kind!=='autonomy-work-choice'||s.factsById[retry.sourceFactId].personId!==p.personId||s.factsById[retry.sourceFactId].accepted!==false)throw Error('人物失败退避记录异常。');
}
export function validatePersons(s){validateAftermath(s);for(const p of Object.values(s.personsById)){if(!p.schedule)continue;const r=p.appearance?.recipe;if(!r||typeof r!=='object'||Array.isArray(r)||r.id!==`appearance:${p.personId}:v1`||!APPEARANCE_CATALOG.body.includes(r.body)||!APPEARANCE_CATALOG.face.includes(r.face)||!APPEARANCE_CATALOG.hair.includes(r.hair)||!APPEARANCE_CATALOG.outfit.includes(r.outfit)||!Number.isSafeInteger(r.faceMark)||r.faceMark<0||r.faceMark>4||!Number.isFinite(r.height)||r.height<1.6||r.height>1.9||!Number.isSafeInteger(p.schedule.commitUntilTick)||p.schedule.commitUntilTick<0||p.schedule.updatedThroughTick>s.worldTick||![AUTONOMY.version,AUTONOMY_V2.version].includes(p.schedule.definitionId))throw Error('人物外观配方或自主日程异常。');if(p.schedule.definitionId===AUTONOMY_V2.version)validateAutonomyV2(s,p);}return true;}
export const personsHandlers={inviteWork,aftermathAction};
