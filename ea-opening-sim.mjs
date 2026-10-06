import {initRainArtisan,advanceRainArtisan,validateRainArtisan,offerArtisanCare,cancelArtisanCare,declineArtisanCare,treatmentStatus} from './ea-rain-artisan.mjs?v=ea-160-estate-grid-20261006-r1';
export {artisanCareView,treatmentStatus,offerArtisanCare,cancelArtisanCare,declineArtisanCare} from './ea-rain-artisan.mjs?v=ea-160-estate-grid-20261006-r1';
import {prepareFacilityActivity,releaseBodyActivity,reconcileActivities,validateFacilityActivities,cancelProduction} from './ea-facility-activities.mjs?v=ea-160-estate-grid-20261006-r1';
export {cancelProduction};
/** DB v1.2 first development slice, wired into the actual EA application. */
import * as base from './ea-sim.mjs?v=ea-160-estate-grid-20261006-r1';
import {cloneState,hydrateState,migrateState,legacyProjection,validateV6Shape,SCHEMA_VERSION,CONTENT_VERSION} from './ea-state-v6.mjs?v=ea-160-estate-grid-20261006-r1';
import {startScenicWalk,scenicPosition,advanceScenic,syncScenicPosition,buildingAccess,repairScenicState,scenicNearest} from './ea-scenic.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sim.mjs?v=ea-160-estate-grid-20261006-r1';
import {srEnabled,initSR,validateSR,beforeSRSecond,tickSR,SR_HANDLERS,SR_BODY_COMMANDS} from './ea-sr-runtime.mjs?v=ea-160-estate-grid-20261006-r1';
import {executeContractCommand} from './ea-sr-contracts.mjs?v=ea-160-estate-grid-20261006-r1';
import {sceneUnits,placementIssue} from './ea-sr-spatial.mjs?v=ea-160-estate-grid-20261006-r1';
import {advanceSRStory} from './ea-sr-story.mjs?v=ea-160-estate-grid-20261006-r1';
import {tickCampaignCombat} from './ea-campaign.mjs?v=ea-160-estate-grid-20261006-r1';
import {teachingQualificationSR} from './ea-sr-cultivation.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-equipment.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-cultivation.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-combat.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-covenants.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-mother-chain.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-economy.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-persons.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-weather.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-organization.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-world.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-crises.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-story.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-descent.mjs?v=ea-160-estate-grid-20261006-r1';
export * from './ea-sr-late-economy.mjs?v=ea-160-estate-grid-20261006-r1';
export {srEnabled,initSR};
export {cloneState,SCHEMA_VERSION,CONTENT_VERSION};
const LEGACY_COMMAND_NAMES=['setSpeed','setIntroPage','acknowledgeOnboarding','requestSceneInteraction','cancelSceneInteraction','setNarrativePage','acknowledgeNarrative','acknowledgeIntro','advanceStory','build','cancelConstruction','cancelProduction','offerArtisanCare','cancelArtisanCare','declineArtisanCare','upgrade','toggleBuilding','repairBuilding','relocate','demolish','recruit','obtainBook','sealBook','masterStudy','forgetSupport','returnToBasics','masterBreakthrough','masterRiskBreakthrough','masterPill','masterAction','masterTeach','moveMaster','moveScenicMaster','craft','trade','fulfill','claim','setPolicy','offerRoute','upgradeSect','societyCommand','foundSect','inviteOffice','foundPeak','inviteMentor','setSocietyPolicy','settleIncident','resolvePersonalQuest','resolveWorldVisitor','resolveSocietyVisitor','startExploration','moveExploration','resolveExploration','leaveRegion','combatAction','acknowledgeCombat','startMasterTravel','resolveMasterEncounter','cancelMasterTravel'];
export const COMMAND_NAMES=[...new Set([...LEGACY_COMMAND_NAMES,...Object.keys(SR_HANDLERS)])];
const bodyCommands=new Set(['build','upgrade','repairBuilding','relocate','demolish','masterStudy','masterAction','masterTeach','masterBreakthrough','masterRiskBreakthrough','masterPill','moveMaster','moveScenicMaster','requestSceneInteraction','startExploration','startMasterTravel','craft','advanceStory','offerArtisanCare','declineArtisanCare']);

export function initial(options={}){
 const s=migrateState(base.initial(options),{newGame:true});
 const logs=s.logs.slice();
 const visitor=base.addDisciple(s,{name:'陆知微',root:'木灵根',portrait:1,talent:1.15,goal:'精研草木',traits:[82,44,78,68,62]});
 delete s.personsById[visitor.personId];visitor.personId='person:lu-zhiwei';s.personsById[visitor.personId]=visitor;s.homeMemberIds=[];s.logs=logs;
 visitor.mind.reason='循旧药方来为家人求药，是否留下仍未商议。';
 const second=base.addDisciple(s,{name:'林长风',root:'土灵根',portrait:2,talent:1.08,goal:'求取长生',traits:[45,88,36,57,80]});
 delete s.personsById[second.personId];second.personId='person:lin-changfeng';s.personsById[second.personId]=second;s.homeMemberIds=[];s.logs=logs;
 second.mind.reason='正在寻找安身与求道的地方，想先了解山院能提供的生活。';
 const hall=buildingAccess(s,s.buildings.find(b=>b.type==='hall'));
 for(const [person,offset]of [[visitor,-22],[second,22]]){const p=scenicNearest(s,{x:hall.x+offset,y:hall.y+8});if(p){person.mind.scenic.x=p.x;person.mind.scenic.y=p.y;}}
 s.story.opening={visitorId:visitor.personId,secondVisitorId:second.personId,gifted:false,invitation:'unasked'};
 s.stockpilesById['stockpile:lu-zhiwei']={id:'stockpile:lu-zhiwei',ownerId:visitor.personId,resources:Object.fromEntries(Object.keys(base.RESOURCES).map(k=>[k,0]))};
 initRainArtisan(s,base.addDisciple);s.rulesetVersion='opening-runtime-3';repairScenicState(s);if(options.sr)initSR(s,{newGame:true});return s;
}

function validateOpeningRecords(s){
 const opening=s.story.opening;
 if(opening){
  if(opening.visitorId!=='person:lu-zhiwei'||opening.secondVisitorId!=='person:lin-changfeng'||!s.personsById[opening.visitorId]||!s.personsById[opening.secondVisitorId]||typeof opening.gifted!=='boolean'||!['unasked','joined','declined'].includes(opening.invitation)||!opening.gifted&&opening.invitation!=='unasked')throw Error('存档校验失败：赠药与入院记录异常');
  if(opening.invitation==='joined'&&!s.homeMemberIds.includes(opening.visitorId)&&!s.society.departed.some(p=>p.id===s.personsById[opening.visitorId].id))throw Error('存档校验失败：入院人物引用异常');
  const gift=s.factsById['fact:opening:gift'];
  if(!s.stockpilesById['stockpile:lu-zhiwei']||opening.gifted!==!!gift||gift&&(gift.id!=='fact:opening:gift'||gift.kind!=='gift'||gift.actorId!=='person:master'||gift.recipientId!==opening.visitorId||gift.resource!=='herb'||gift.quantity!==10||!Number.isSafeInteger(gift.atTick)||gift.atTick<0||gift.atTick>s.worldTick))throw Error('存档校验失败：赠药事实或库存缺失');
 }
}

export function validateSave(input,{upgrade=false}={}){
 if(srEnabled(input)){validateV6Shape(input);const s=cloneState(input);base.validateSave(legacyProjection(s),{canonical:true});validateOpeningRecords(s);validateFacilityActivities(s);validateRainArtisan(s);return hydrateState(validateSR(s));}
 if(input?.schemaVersion===undefined){
  const old=base.validateSave(input);
  const migrated=migrateState(old,{sourceVersion:input.version});migrated.rulesetVersion='opening-runtime-2';return validateSave(migrated,{upgrade});
 }
 // Base validation checks all legacy domain fields without mutating input.
 validateV6Shape(input);
 const s=cloneState(input),checked=base.validateSave(legacyProjection(s));
 s.personsById['person:master']=checked.master;
 s.disciples=checked.disciples;s.buildings=checked.buildings;
 s.story=checked.story;
 validateOpeningRecords(s);
 if(s.rulesetVersion==='opening-runtime-1'){
  if(s.contentVersion==='opening-v1.2'&&!s.story.completed&&!s.story.artisan){if(s.personsById['person:cheng-wenzhou'])throw Error('存档校验失败：伤匠身份缺少事件');initRainArtisan(s,base.addDisciple);}
  s.rulesetVersion='opening-runtime-2';
 }
 if(s.rulesetVersion==='opening-runtime-2'&&s.contentVersion==='opening-v1.2'){
  s.rulesetVersion='opening-runtime-3';
  for(const a of Object.values(s.activitiesById))if(a.kind==='facility'&&a.action!=='care'&&s.buildingsById[a.targetId]?.type==='hall'){
   const p=s.personsById[a.personId],position=(p===s.master?p:p.mind).scenic;
   a.phase=a.slotId?'navigating':'waiting';if(position){position.path=[];position.goal=null;position.revision=null;}
  }
 }
 upgradeConstructionRecords(s);validateConstruction(s);validateFacilityActivities(s);validateRainArtisan(s);
 if(upgrade){initSR(s);return validateSave(s);}return hydrateState(s);
}

export function advanceStory(s,choice){
 if(srEnabled(s)&&s.story.step>=3)return advanceSRStory(s,choice);
 if(s.story.opening&&s.story.step===2){
  if(!base.storyReady(s))throw Error('先恢复可运行的药田与伐木场，并准备可用居所。');
  const visitor=s.personsById[s.story.opening.secondVisitorId],position=visitor.mind.scenic;
  if(s.world.exploration||s.master.journey||Math.hypot(s.master.scenic.x-position.x,s.master.scenic.y-position.y)>sceneUnits(s,48))throw Error('先到林长风身边，再商议入院。');
  s.homeMemberIds.push(visitor.personId);visitor.mind.reason='山院给了我安身与传承的机会，我愿靠自己的选择求道。';
  base.rememberPerson(s,visitor,visitor.mind.reason,{important:true,key:'opening:changfeng-join'});
  s.story.claimed.push('story:2');s.story.step=3;base.log(s,'林长风自愿留下，原来的身份、外观与经历一并保留。');return base.campaignSummary(s);
 }
 if(!s.story.opening||s.story.step!==1)return base.advanceStory(s,choice);
 const o=s.story.opening,visitor=s.personsById[o.visitorId];
 if(s.world.exploration||s.master.journey||s.combat?.status==='active')throw Error('先返回山院，再与来客商议。');
 const distance=Math.hypot(scenicPosition(s.master).x-scenicPosition(visitor.mind).x,scenicPosition(s.master).y-scenicPosition(visitor.mind).y);
 if(distance>sceneUnits(s,48))throw Error('先走到陆知微身边，再赠药或商议。');
 if(!o.gifted){
  if(choice!=='gift')throw Error('先决定是否赠药，入院须另行商议。');
  base.pay(s,{herb:10});s.stockpilesById['stockpile:lu-zhiwei'].resources.herb+=10;o.gifted=true;
  s.factsById['fact:opening:gift']={id:'fact:opening:gift',kind:'gift',actorId:'person:master',recipientId:visitor.personId,resource:'herb',quantity:10,atTick:s.worldTick};
  base.rememberPerson(s,visitor,'掌门赠来十份灵草救急。赠药不要求我入院，也未要求参与他的家仇。',{important:true,key:'opening:gift'});
  base.log(s,'赠出十份灵草。陆知微谢过救命之情，尚未承诺入院或同行。');
  return base.campaignSummary(s);
 }
 if(!['invite','decline'].includes(choice))throw Error('请选择商议入院，或让她先回去照应家人。');
 if(choice==='invite'){
  if(s.disciples.length>=base.capacity(s))throw Error('居所不足，赠药仍已送达，可营造居所后再商议。');
  s.homeMemberIds.push(visitor.personId);o.invitation='joined';visitor.mind.reason='药材已备好，山院提供药理与住处，我愿留下求道；同行仍另作决定。';
  base.rememberPerson(s,visitor,visitor.mind.reason,{important:true,key:'opening:voluntary-join'});
  base.log(s,'陆知微自愿入院研习药理。赠药、入院和参与复仇各是一次选择。');
 }else{o.invitation='declined';base.log(s,'陆知微带药回去照应家人。善缘保留，山院仍可自行营造和结识其他同道。');}
 if(!s.story.claimed.includes('story:1'))s.story.claimed.push('story:1');s.story.step=2;
 return base.campaignSummary(s);
}

/** A study command schedules arrival; walking cannot also earn understanding. */
export function masterStudy(s,id){
 releaseBodyActivity(s,s.master);base.masterStudy(s,id);
 const facility=base.lifeFacility(s,s.master,'study',id);if(!facility)throw Error('研习场所暂不可用。');
 const plan=s.master.learning;prepareFacilityActivity(s,s.master,facility,'study',0);
 const activity=s.activitiesById[s.master.activityId];plan.facilityId=facility.id;plan.waitingForArrival=activity?.phase!=='executing';
 s.master.action=s.master.scenic.path.length?'walk':'study';
 return {facilityId:facility.id,waitingForArrival:plan.waitingForArrival};
}

export function setSpeed(s,value){if(![0,1,2,4].includes(value))throw Error('时序速度无效。');s.speed=value;return value;}

export function constructionStatus(s){const a=s.activitiesById?.[s.master.activityId];return a?.kind==='construction'?a:null;}
export function build(s,type,x,y){
 const lock=base.buildingLock(s,type)||base.placementLock(s,type,x,y);
 if(lock)throw Error(lock);
 if(constructionStatus(s))throw Error('掌门已有营造事务，完成或取消后再动工。');
 if(s.master.wound>0||s.master.energy<15||s.world.exploration||s.master.journey||s.combat?.status==='active')throw Error('先归院养伤并恢复精力，再亲自营造。');
 const id=s.nextId++,instanceId=`building:yunxiu:${id}`,activityId=`activity:build:${id}`,target=buildingAccess(s,{type,x,y});
 releaseBodyActivity(s,s.master);
 if(!startScenicWalk(s.master,target,s))throw Error('营造地点暂时无法抵达。');
 base.pay(s,base.BUILDINGS[type].cost);
 const activity={id:activityId,personId:'person:master',kind:'construction',phase:s.master.scenic.path.length?'moving':'working',type,x,y,buildingId:id,instanceId,target,workOrderId:`work:construction:${id}`,reservationId:`reservation:build:${id}`};
 s.activitiesById[activityId]=activity;s.master.activityId=activityId;
 s.workOrdersById[activity.workOrderId]={id:activity.workOrderId,kind:'construction',targetId:instanceId,phase:'active',progressTicks:0,durationTicks:200,activityIds:[activityId],reservationId:activity.reservationId};hydrateState(s);
 s.reservationsById[activity.reservationId]={id:activity.reservationId,activityId,cost:{...base.BUILDINGS[type].cost}};
 base.log(s,`${base.BUILDINGS[type].name}开始备料，掌门须到场营造；材料已预留。`);
 return {id,type,x,y,pending:true,activityId};
}
export function cancelConstruction(s){
 const a=constructionStatus(s);if(!a)throw Error('当前没有营造事务。');
 const r=s.reservationsById[a.reservationId],refund={};
 for(const [key,value]of Object.entries(r.cost))refund[key]=Math.floor(value*(1-a.progressTicks/a.totalTicks));
 base.grant(s,refund);delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];delete s.workOrdersById[a.workOrderId];s.master.activityId=null;
 s.master.scenic.path=[];s.master.scenic.goal=null;s.master.action='rest';
 base.log(s,'营造已取消，尚未用去的材料退回府库。');return refund;
}
function advanceConstruction(s){
 const a=constructionStatus(s);if(!a)return;
 if(a.phase==='moving'){
  advanceScenic(s.master.scenic,4.6,s);syncScenicPosition(s,s.master);
  if(s.master.scenic.path.length)return;
  if(Math.hypot(s.master.scenic.x-a.target.x,s.master.scenic.y-a.target.y)>18){a.phase='blocked';s.master.action='rest';return;}
  a.phase='working';s.master.action='rest';
 }
 if(a.phase!=='working'&&!(a.phase==='blocked'&&a.progressTicks>=a.totalTicks))return;
 if(a.progressTicks<a.totalTicks){s.master.energy=Math.max(0,s.master.energy-.015);s.workOrdersById[a.workOrderId].progressTicks++;}
 if(a.progressTicks<a.totalTicks)return;
 // Recheck against any intervening layout change; never spend a second time.
 const lock=base.placementLock(s,a.type,a.x,a.y);
 if(lock){if(a.phase!=='blocked')base.log(s,'营造暂缓：'+lock+'。待通路与场地安全后继续，也可取消并收回未用材料。');a.phase='blocked';return;}
 const b={id:a.buildingId,instanceId:a.instanceId,type:a.type,x:a.x,y:a.y,level:1,progress:0,condition:100,enabled:true};
 s.buildings.push(b);s.stats.built++;delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];delete s.workOrdersById[a.workOrderId];s.master.activityId=null;
 repairScenicState(s);base.log(s,`${base.BUILDINGS[a.type].name}营造完成，入口连通，门人可自主前来使用。`);
}
function upgradeConstructionRecords(s){
 for(const a of Object.values(s.activitiesById))if(a.kind==='construction'&&!a.workOrderId){
  a.workOrderId=`work:construction:${a.buildingId}`;
  s.workOrdersById[a.workOrderId]={id:a.workOrderId,kind:'construction',targetId:a.instanceId,phase:'active',progressTicks:a.progressTicks,durationTicks:a.totalTicks,activityIds:[a.id],reservationId:a.reservationId};
 }
 hydrateState(s);
}
function validateConstruction(s){
 const activities=Object.values(s.activitiesById).filter(a=>a.kind==='construction'),orders=Object.values(s.workOrdersById).filter(o=>o.kind==='construction');
 if(activities.length>1||orders.length!==activities.length)throw Error('存档校验失败：营造工作单异常');
 if(!activities.length){if(s.activitiesById[s.master.activityId]?.kind==='construction')throw Error('存档校验失败：人物活动悬空');return;}
 const a=activities[0],r=s.reservationsById[a?.reservationId],o=s.workOrdersById[a.workOrderId];
 if(a.id!==`activity:build:${a.buildingId}`||s.master.activityId!==a.id||a.personId!=='person:master'||!['moving','working','blocked'].includes(a.phase)||!base.BUILDINGS[a.type]||!Number.isSafeInteger(a.progressTicks)||a.progressTicks<0||a.progressTicks>200||a.totalTicks!==200||!Number.isSafeInteger(a.buildingId)||a.buildingId<1||a.buildingId>=s.nextId||a.instanceId!==`building:yunxiu:${a.buildingId}`||s.buildingsById[a.instanceId]||!base.CELLS.some(p=>p.x===a.x&&p.y===a.y)||!r||r.id!==a.reservationId||r.activityId!==a.id||!r.cost||Object.keys(r.cost).length!==Object.keys(base.BUILDINGS[a.type].cost).length||!Object.entries(base.BUILDINGS[a.type].cost).every(([key,value])=>r.cost[key]===value)||!a.target||a.target.x!==buildingAccess(s,a).x||a.target.y!==buildingAccess(s,a).y||o.id!==a.workOrderId||o.id!==`work:construction:${a.buildingId}`||o.targetId!==a.instanceId||o.phase!=='active'||o.activityIds.length!==1||o.activityIds[0]!==a.id||o.reservationId!==a.reservationId)throw Error('存档校验失败：营造活动或材料预约异常');
 for(const [id,r]of Object.entries(s.reservationsById))if(!r.kind&&id!==a.reservationId)throw Error('存档校验失败：未知材料预约');
}

/** The only simulation owner: 100ms ticks; existing economy updates each second. */
export function tick(s,dt){
 if(!Number.isFinite(dt)||dt<=0||dt>86400||s.speed===0)return;
 const total=s.sim.carry+dt*s.speed,count=Math.floor(total*10+1e-8);
 s.sim.carry=Math.max(0,Math.round((total-count/10)*1e10)/1e10);
 for(let n=0;n<count;n++){
  if(s.speed===0)break;
  s.worldTick++;s.revision++;
  if(srEnabled(s))beforeSRSecond(s);
  if((s.worldTick-s.schemaMigration.clockOriginTick)%10===0)base.advanceWorldSecond(s,{advanceCombat:!srEnabled(s)});
  if(srEnabled(s)){tickCampaignCombat(s,.1);tickSR(s);}else advanceConstruction(s);
  advanceRainArtisan(s);reconcileActivities(s);
 }
}

/** Atomic, revision-checked, retry-safe command gateway used by the browser. */
export function dispatchCommand(s,{name,args=[],id=`command:${s.transactions.nextCommandId}`,expectedRevision=s.revision}={}){
 if(srEnabled(s)){
  const handlers=Object.fromEntries(COMMAND_NAMES.map(command=>[command,(next,...values)=>{
   if(next.master.sceneIntent&&!['requestSceneInteraction','cancelSceneInteraction','setNarrativePage','acknowledgeNarrative','acknowledgeIntro'].includes(command))base.cancelSceneInteraction(next);
   if(bodyCommands.has(command)||SR_BODY_COMMANDS.has(command)){
    const a=next.activitiesById[next.master.activityId];
    if(a?.kind==='facility')releaseBodyActivity(next,next.master);
    const cancelling=command==='descentCommand'&&values[0]?.action==='cancel'||command==='aftermathAction'&&values[0]?.choice==='cancel';
    if(a&&a.kind!=='facility'&&!cancelling&&!command.startsWith('cancel')&&!['srCrisisCommand','srWorldCommand','srStoryCommand'].includes(command))throw Error('掌门已有身体活动，先完成或中止。');
   }
   if(command==='build'){const lock=base.buildingLock(next,values[0]);if(lock)throw Error(lock);}
   const fn=command==='advanceStory'?advanceStory:SR_HANDLERS[command]||({setSpeed,offerArtisanCare,cancelArtisanCare,declineArtisanCare,cancelProduction}[command])||base[command];
   if(typeof fn!=='function')throw Error('操作尚未接入。');
   const result=fn(next,...values);reconcileActivities(next);return result;
  }]));
  const committed=executeContractCommand(s,{name,args,id,expectedRevision},{handlers,clone:value=>initSR(cloneState(value)),validate:validateSave});
  if(committed.status==='rejected')throw Error(committed.message);return committed;
 }
 if(!COMMAND_NAMES.includes(name)||!Array.isArray(args))throw Error('操作尚未接入。');
 const signature=JSON.stringify([name,args]),prior=s.transactions.receipts.find(r=>r.id===id);
 if(prior){if(prior.signature!==signature)throw Error('同一操作编号不能用于不同请求。');return {state:s,result:structuredClone(prior.result),replayed:true};}
 if(id!==`command:${s.transactions.nextCommandId}`||expectedRevision!==s.revision)throw Error('世界状态已更新，请重新选择操作。');
 if(treatmentStatus(s)&&bodyCommands.has(name))throw Error('掌门正在换药；先完成或中止治疗。');
 if(constructionStatus(s)&&bodyCommands.has(name))throw Error('掌门正在营造；先完成或取消这项事务。');
 const next=cloneState(s);
 if(next.master.sceneIntent&&!['requestSceneInteraction','setNarrativePage','acknowledgeNarrative','acknowledgeIntro'].includes(name))base.cancelSceneInteraction(next);
 if(bodyCommands.has(name)&&!constructionStatus(next))releaseBodyActivity(next,next.master);
 const fn=name==='offerArtisanCare'?offerArtisanCare:name==='cancelArtisanCare'?cancelArtisanCare:name==='declineArtisanCare'?declineArtisanCare:name==='cancelProduction'?cancelProduction:name==='setSpeed'?setSpeed:name==='advanceStory'?advanceStory:name==='build'?build:name==='cancelConstruction'?cancelConstruction:name==='masterStudy'?masterStudy:base[name];
 if(['demolish','relocate'].includes(name)){const b=next.buildings.find(b=>b.id===args[0]),o=b&&next.workOrdersById[`work:production:${b.instanceId}`];if(o){if(o.phase!=='completed')cancelProduction(next,b.id);else delete next.workOrdersById[o.id];}}
 const value=fn(next,...args),result=value===undefined?true:structuredClone(value);
 reconcileActivities(next);
 next.revision++;next.transactions.nextCommandId++;
 next.transactions.receipts.push({id,signature,result,revision:next.revision});next.transactions.receipts=next.transactions.receipts.slice(-128);
 return {state:validateSave(next),result,replayed:false};
}

export function placementLock(s,type,x,y,ignoreId=null){return srEnabled(s)?placementIssue(s,type,x,y,{ignoreId}):base.placementLock(s,type,x,y,ignoreId);}

export {spatialEnabled,viewSpatial,PREFAB_CATALOG,placementIssue,sceneUnits} from './ea-sr-spatial.mjs?v=ea-160-estate-grid-20261006-r1';

export {viewBalance} from './ea-sr-balance.mjs?v=ea-160-estate-grid-20261006-r1';

export function recommendedPlacement(s,type){
 if(!srEnabled(s))return base.CELLS.find(p=>!base.placementLock(s,type,p.x,p.y))||null;
 const candidates=[];for(let y=1;y<46;y+=.5)for(let x=1;x<62;x+=.5)candidates.push({x,y});
 candidates.sort((a,b)=>Math.hypot(a.x-27,a.y-14)-Math.hypot(b.x-27,b.y-14));
 return candidates.find(p=>!placementIssue(s,type,p.x,p.y))||null;
}

export function teachers(s,artId){const candidates=base.teachers(s,artId);return srEnabled(s)?candidates.filter(t=>{const p=t.id===0?s.master:s.disciples.find(p=>p.id===t.id);return p&&teachingQualificationSR(s,p.personId,artId).qualified;}):candidates;}
