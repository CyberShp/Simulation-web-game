import {BASIC_COMBAT_ATTACK,basicCombatAttackProfile} from './ea-combat-attack-profiles.mjs';
import {descentEffectiveRealmSR} from './ea-sr-descent.mjs';
/** SR-XF-013. Timed commands replace instant UI actions; campaign owns damage. */
import {combatCanStand,combatPath,combatClearLine,combatGeometryId,moveCombatActor,combatInRange} from './ea-combat-geometry.mjs';
import {requirePerson,reserveBody,ownedActivity,releaseSRBody,equippedItems,EQUIPMENT_DEFINITIONS,equipmentThemeView,EQUIPMENT_THEME,activateEquipmentTheme,equipmentCombatBenefits,recordBindingPractice,resourceSource,spendResources} from './ea-sr-equipment.mjs';
import {availablePills,consumeAccessiblePill} from './ea-sr-economy.mjs';
import {recordArtPractice,chapterKnown,realmTier} from './ea-sr-cultivation.mjs';
import {openingCombatProfile} from './ea-opening-inheritance.mjs';
import {combatStaggered,combatDirection,clearCombatReaction,combatWorldTick} from './ea-combat-impact.mjs';
import {combatParticipant,combatSide,chooseCombatTarget,selectedCombatEnemy} from './ea-combat-targeting.mjs';
import {ensureEncounterCombatants,encounterCombatantHp,setEncounterCombatantHp,validateEncounterCombatants,settleEncounterCombatantDeaths} from './ea-combat-participants.mjs';
let hooks={};
export function configureSRCombat(next={}){hooks={...hooks,...next};}
const aimPoint = target => target && typeof target === 'object' && Number.isFinite(target.x) && Number.isFinite(target.y);
export function clearCombatInput(s){if(s.srCombat)delete s.srCombat.buffered;if(s.combat?.controls&&(s.combat.controls.move.x||s.combat.controls.move.y)){s.combat.controls.move={x:0,y:0};s.combat.controls.moveUntilTick=s.worldTick;}return s;}
function controls(s){return s.combat.controls??={move:{x:0,y:0},moveUntilTick:s.worldTick,autoAttack:false};}
function cancelUnreleased(s,reason){const o=s.srCombat?.pending;if(!o||o.executed)return false;cancelSRCombatAction(s);s.srCombat.executions.push({...structuredClone(o),phase:'interrupted',reason});s.srCombat.executions=s.srCombat.executions.slice(-32);return true;}
export function setSRCombatInput(s,move,{reset=false}={}){
 if(!move||!Number.isFinite(move.x)||!Number.isFinite(move.y)||Math.abs(move.x)>1||Math.abs(move.y)>1)throw Error('移动方向须在-1至1之间。');
 if(typeof reset!=='boolean')throw Error('输入重置须为布尔值。');
 const battle=s.combat,person=s.master,activity=person&&ownedActivity(s,person),pending=s.srCombat?.pending;
 if(battle?.status!=='active'||!battle.sessionId||battle.player.hp<=0||person.personId!=='person:master'||person.combatSessionId!==battle.sessionId||activity?.kind!=='sr-combat'||activity.orderId!==battle.sessionId)throw Error('当前没有可由掌门控制的战斗身体。');
 if(pending&&activity.actionId!==pending.id)throw Error('战斗招式与身体活动引用异常。');
 const length=Math.hypot(move.x,move.y),normalized=length>0?{x:move.x/length,y:move.y/length}:{x:0,y:0};
 // Held movement is intent. Windup owns the temporary movement lock.
 const next={...battle.controls,autoAttack:battle.controls?.autoAttack??false,move:s.speed===0||reset?{x:0,y:0}:normalized,moveUntilTick:s.worldTick+5};
 if(reset&&s.srCombat)delete s.srCombat.buffered;
 battle.controls=next;
 if(length>0&&s.speed!==0&&!reset){battle.player.target=null;battle.retreatRequested=false;}
 return {move:{...next.move},moveUntilTick:next.moveUntilTick};
}
export function setSRAutoAttack(s,enabled){if(typeof enabled!=='boolean')throw Error('自动普攻设置须为布尔值。');if(s.combat?.status!=='active')throw Error('当前无战斗。');controls(s).autoAttack=enabled;if(!enabled&&s.srCombat?.pending?.automatic)cancelUnreleased(s,'玩家关闭自动普攻。');return {enabled};}
export function setSRCombatTarget(s,targetId){
 const c=s.combat;if(c?.status!=='active')throw Error('当前无战斗。');
 if(targetId===null){c.selectedTargetId=null;return {targetId:null};}
 const target=typeof targetId==='string'&&combatParticipant(c,targetId);
 if(!target||combatSide(c,target)!=='hostile'||target.hp<=0)throw Error('请选择仍在战场上的敌方目标。');
 c.selectedTargetId=target.id;return {targetId:target.id,personId:target.personId||null};
}
export function recordAimedCombatHit(s,{actionId,artId}){if(!actionId)return;recordBindingPractice(s,'person:master',actionId);if(artId)recordArtPractice(s,'person:master',artId,{eventId:actionId,difficulty:1,effective:true});}
// T-COMBAT-FEEL-20261023, in the existing 100 ms world steps.
export const COMBAT_INPUT_BUFFER_TICKS=2;
export const COMBAT_ACTIONS=Object.freeze({
 // T-COMBAT-REACH-POSITION-20261024: all basic swords share this effective reach.
 attack:BASIC_COMBAT_ATTACK,
 spell:{name:'青岚术',windup:3,execute:1,recovery:3,range:6,qi:16,cooldown:45,legacy:'spell'},
 dodge:{name:'短步脱离',windup:0,execute:1,recovery:2,range:2.8,qi:8,cooldown:32,legacy:'dodge'},
 guard:{name:'短时护持',windup:2,execute:1,recovery:4,qi:4,cooldown:50,legacy:'guard'},
 retreat:{name:'约定撤离',windup:1,execute:1,recovery:1,qi:0,cooldown:0,legacy:'retreat'},
 'sword-chase':{name:'追击剑式',windup:5,execute:1,recovery:9,range:4,qi:10,cooldown:38,art:'sword',understanding:20,role:'追击与靠近；不能穿障碍'},
 'pulse-heal':{name:'止血养脉',windup:8,execute:1,recovery:7,range:2.8,qi:8,cooldown:80,art:'spring',understanding:20,pill:'heal',role:'耗一份回春散；无伤不获熟练'},
 'core-lance':{name:'凝丹穿云',realm:13,chapterId:'golden-core',windup:8,execute:1,recovery:12,range:6,qi:28,cooldown:100,legacy:'spell',extraQi:12,damageMultiplier:1.25,role:'实际凝丹灵力远射，基础术法伤害×1.25，视线与障碍仍成立'},
 'soul-guard':{name:'育婴定神',realm:16,chapterId:'nascent-soul',windup:8,execute:1,recovery:10,qi:10,cooldown:100,legacy:'guard',extraQi:6,guardSeconds:3.6,role:'实际守御3.6秒，耗灵力10，不复活与治疗身死者'},
 'spirit-step':{name:'养神留影',realm:19,chapterId:'spirit-transform',windup:3,execute:1,recovery:8,range:2.8,qi:18,cooldown:90,legacy:'dodge',extraQi:10,evadeSeconds:1,role:'共用真实闪避路径，延长避害至1秒，不能穿越障碍'},
 'void-lance':{name:'定界灵矛',realm:22,chapterId:'void-refine',windup:10,execute:1,recovery:14,range:6,qi:36,cooldown:130,legacy:'spell',extraQi:20,damageMultiplier:1.4,role:'定界灵力射击，伤害×1.4，施术与回气均需时间'},
 'integrate-guard':{name:'合真护体',realm:25,chapterId:'integrate',windup:10,execute:1,recovery:12,qi:16,cooldown:140,legacy:'guard',extraQi:12,guardSeconds:5,role:'功体护持5秒，不叠加成永久无敌'},
 'vehicle-lance':{name:'渡劫灵光',realm:28,chapterId:'great-vehicle',windup:14,execute:1,recovery:18,range:6,qi:48,cooldown:180,legacy:'spell',extraQi:32,damageMultiplier:1.6,role:'渡劫灵珀续篇远射，伤害×1.6，长起手可被真实危机阻断'},
 'ward-node':{name:'护持节点',windup:10,execute:1,recovery:6,range:2.5,qi:12,cooldown:70,art:'array',understanding:20,role:'耗青石2；范围2.6米，持续80tick，承伤减25%'}
});
export const ENEMY_COMBAT_CONFIG=Object.freeze({
 'person:valley-shanxiao':{realm:2,style:'抬臂拍击',windupTicks:18,reach:1.8,recoveryTicks:20,damage:10,counter:'抬臂后避开落点，或展开短时护持'},
 'person:han-lichuan':{realm:12,style:'赤嶂重刀',windupTicks:18,reach:2.2,recoveryTicks:22,damage:36,counter:'绕开正面落点，趁收势追击'},
 'person:xing-lie':{realm:12,style:'煞炼刀法',windupTicks:13,reach:2.5,recoveryTicks:18,damage:30,counter:'切断补给，短护持化解一击'},
 'person:shao-heng':{realm:11,style:'护库刀阵',windupTicks:16,reach:1.8,recoveryTicks:20,damage:27,counter:'牵离固定守位，养脉保持持续战力'}
});
const combatActors=c=>[c.player,...c.allies,...c.enemies].filter(a=>a.personId);
export function projectedCombatHp(person,maxHp){return person.lifeStatus==='dead'||person.wound>=100?0:Math.max(1,Math.min(maxHp,Math.round(maxHp*(1-(person.wound||0)/100))));}
export function syncCombatBodyProjection(s,c=s.combat){
 if(c?.status!=='active'||!c.sessionId)return;
 for(const actor of c.enemies){const record=s.world?.encounterCombatantsById?.[actor.combatantId];if(record)actor.hp=encounterCombatantHp(record);}
 for(const actor of combatActors(c)){
  const person=s.personsById?.[actor.personId];
  if(!person)continue;
  actor.hp=projectedCombatHp(person,actor.maxHp);
  if(Object.hasOwn(actor,'knockedOut'))actor.knockedOut=actor.hp===0;
 }
}
export function setCombatActorHp(s,actor,hp){
 const ordinary=setEncounterCombatantHp(s,actor,hp);if(ordinary!==null)return ordinary;
 const person=actor.personId&&s.personsById?.[actor.personId];
 if(!person){actor.hp=Math.max(0,Math.min(actor.maxHp,hp));return actor.hp;}
 actor.hp=Math.max(0,Math.min(actor.maxHp,Math.round(hp)));
 person.wound=Math.max(0,Math.min(100,100*(1-actor.hp/actor.maxHp)));
 return actor.hp;
}
export function beginCombatSession(s,c,{legacy=false}={}){
 if(s.contentVersion!=='sr-content-v1.2')return;
 ensureEncounterCombatants(s,c);
 const id=`combat:campaign:${c.journeyId}`;
 if(c.sessionId&&c.sessionId!==id)throw Error('战斗会话引用异常：'+c.sessionId);
 if(c.player.personId&&c.player.personId!=='person:master')throw Error('战斗掌门人物引用异常：'+c.player.personId);
 if(s.combatSessionsById[id])throw Error('战斗会话ID重复：'+id);
 c.sessionId=id;c.player.personId='person:master';
 const actors=combatActors(c),participantIds=actors.map(a=>a.personId);
 if(new Set(participantIds).size!==participantIds.length)throw Error('战斗会话人物重复：'+id);
 const startingWounds={};
 for(const actor of actors){
  const person=requirePerson(s,actor.personId),existing=ownedActivity(s,person);
  if(person.combatSessionId)throw Error('人物已有战斗会话：'+actor.personId);
  if(existing&&(!legacy||existing.kind!=='sr-combat'))throw Error('人物身体已有活动：'+actor.personId);
  if(person.activityId&&!existing)throw Error('人物身体已有活动：'+actor.personId);
  startingWounds[actor.personId]=person.wound||0;
  if(legacy)person.wound=Math.max(person.wound||0,100*(1-actor.hp/actor.maxHp));
  actor.hp=projectedCombatHp(person,actor.maxHp);
  if(actor===c.player&&actor.hp<=0)throw Error('旧战斗掌门已倒下，不能恢复活跃战斗');
  const activity=existing||reserveBody(s,person,'combat',id);
  activity.orderId=id;activity.phase='executing';
  if(legacy&&actor===c.player&&s.srCombat?.pending)activity.actionId=s.srCombat.pending.id;
  person.combatSessionId=id;
 }
 s.combatSessionsById[id]={id,personId:'person:master',participantIds,combatantIds:c.enemies.filter(a=>a.combatantId).map(a=>a.combatantId),phase:'active',startedTick:s.worldTick,startingWounds};
 if(legacy&&s.srCombat){const oldKey=`${c.journeyId??'fixture'}:${c.encounterId??'combat'}:${c.regionId}`;if(!s.srCombat.battleId||s.srCombat.battleId===oldKey)s.srCombat.battleId=id;}
}
export function endCombatSession(s,c){
 if(c&&c.status!=='active'){for(const actor of [c.player,...c.allies,...c.enemies]){clearCombatReaction(actor);delete actor.motionAction;delete actor.dodgePath;delete actor.pendingAttack;actor.targetId=null;if(Object.hasOwn(actor,'telegraph')){actor.telegraph=null;actor.windup=0;}}if(c.projectiles)c.projectiles=[];clearCombatInput(s);}
 const id=c?.sessionId,session=id&&s.combatSessionsById?.[id];if(!session||session.phase!=='active')return;
 session.phase='ended';session.endedTick=s.worldTick;session.result=c.status;
 for(const personId of session.participantIds){const person=s.personsById[personId];if(!person)continue;
  if(person.combatSessionId===id)person.combatSessionId=null;
  const activity=ownedActivity(s,person);if(activity?.kind==='sr-combat'&&activity.orderId===id)releaseSRBody(s,person);
 }
 if(s.master.action==='combat')s.master.action='rest';
}
function releaseFinishedCombat(s){
 if(s.combat?.status==='active')return false;
 const r=s.srCombat,a=ownedActivity(s,s.master);
 if(r?.pending){r.executions.push({...structuredClone(r.pending),phase:'interrupted',reason:'战斗已经结束。'});r.executions=r.executions.slice(-32);r.pending=null;}
 endCombatSession(s,s.combat);
 // A finished battle may leave a body reservation after its last action was recorded.
 // Only that reservation belongs here; never release a later, unrelated activity.
 if(a?.kind==='sr-combat'&&(!s.combat?.sessionId||a.orderId===s.combat.sessionId)){releaseSRBody(s,s.master);if(s.master.action==='combat')s.master.action='rest';}
 return true;
}
function hydrateEncounterBattle(s){
 const c=s.combat;if(!c||s.contentVersion!=='sr-content-v1.2')return;
 ensureEncounterCombatants(s,c);if(c.status!=='active')settleEncounterCombatantDeaths(s,c);
 const session=s.combatSessionsById?.[c.sessionId];
 if(session&&session.combatantIds===undefined)session.combatantIds=c.enemies.filter(a=>a.combatantId).map(a=>a.combatantId);
}
export function initSRCombat(s){
 s.srCombat??={version:1,lastTick:s.worldTick,nextAction:1,pending:null,cooldowns:{},nodes:[],tactic:'guard',executions:[],battleId:null};
 if(s.combat?.status==='active'&&s.combat.player&&Number.isSafeInteger(s.combat.journeyId)&&!s.combat.sessionId)beginCombatSession(s,s.combat,{legacy:true});
 hydrateEncounterBattle(s);syncCombatBodyProjection(s);releaseFinishedCombat(s);return s;
}
function known(s,art){const p=s.personsById['person:master'];return p.artsById?.[art]?.understanding??p.knowledge?.[art]??0;}
function targetEnemy(s,target){return typeof target==='string'?s.combat.enemies.find(e=>(e.id===target||e.personId===target)&&e.hp>0):selectedCombatEnemy(s.combat)||chooseCombatTarget(s.combat,s.combat.player);}
function targetAlly(s,target){return target?s.combat.allies.find(a=>a.id===target||a.personId===target):s.combat.player;}
function materialAvailable(s,key){try{return resourceSource(s).resources[key]||0;}catch{return 0;}}
function syncBattle(s){const r=s.srCombat,c=s.combat;if(c?.status!=='active')return;const key=c.sessionId||`${c.journeyId??'fixture'}:${c.encounterId??'combat'}:${c.regionId}`;if(r.battleId===key)return;r.pending=null;delete r.buffered;r.nodes=[];r.battleId=key;}
function actionDefinition(s,id){return id==='attack'?basicCombatAttackProfile(s.combat):COMBAT_ACTIONS[id];}
function check(s,id,target,{executing=false,ignoreCooldown=false,ignoreStagger=false}={}){const c=s.combat,d=actionDefinition(s,id),p=c?.player;if(!c||c.status!=='active')return '当前无战斗。';if(!d)return '无此战斗动作。';if(!Number.isFinite(p.hp)||p.hp<=0)return '掌门已倒下，不能继续行动。';if(!executing&&s.srCombat.pending&&!(s.srCombat.pending.automatic&&!s.srCombat.pending.executed))return '先完成当前动作的起手/收势。';if(!ignoreCooldown&&(s.srCombat.cooldowns[id]||0)>s.worldTick)return '动作仍在冷却。';if(p.qi<(id==='spell'?openingCombatProfile(s).cost:d.qi))return '灵力不足。';if(d.realm&&s.master.realm<d.realm)return '尚未达到此动作的大境界。';if(d.chapterId&&!chapterKnown(s,'person:master',d.chapterId))return '须实际研习此境可靠续篇。';if(d.art&&known(s,d.art)<d.understanding)return '尚未理解所需法门。';if(d.pill&&availablePills(s,'person:master',d.pill)<1)return '缺少随身回春散。';if(id==='ward-node'&&!equippedItems(s).some(i=>EQUIPMENT_DEFINITIONS[i.definitionId]?.node&&i.condition>0))return '须携带并装备可用护持印。';if(id==='ward-node'&&materialAvailable(s,'stone')<2)return '缺少节点青石2。';
 if(!ignoreStagger&&combatStaggered(p,s.worldTick))return '受击尚未站稳。';
 if(['attack','spell'].includes(id)&&target&&typeof target==='object'&&!aimPoint(target))return '瞄准落点无效。';
 if((['attack','spell','sword-chase'].includes(id)||['attack','spell'].includes(d.legacy))&&!(['attack','spell'].includes(id)&&aimPoint(target))){const enemy=targetEnemy(s,target);if(!enemy)return '目标已倒下。';if(!combatInRange(p,enemy,id==='spell'?openingCombatProfile(s).range:d.range))return '目标超出动作范围。';if(!combatClearLine(p,enemy,combatGeometryId(c)))return '目标被障碍遮挡。';if(id==='sword-chase'&&!combatPath(p,enemy,combatGeometryId(c)))return '追击路径不可达。';}
 if(id==='pulse-heal'){const ally=targetAlly(s,target);if(!ally||ally.hp<=0)return '不能以普通治疗复活倒下或身死的人。';if(Math.hypot(p.x-ally.x,p.y-ally.y)>d.range||!combatClearLine(p,ally,combatGeometryId(c)))return '救治目标不在可触及范围。';if(ally.hp>=ally.maxHp&&(!(s.master.wound>0)||ally!==p))return '无有效伤势，不消耗药物或刷熟练。';}
 if(id==='ward-node'){const t=target&&typeof target==='object'?target:p;if(Math.hypot(p.x-t.x,p.y-t.y)>d.range||!combatCanStand(t,combatGeometryId(c))||!combatClearLine(p,t,combatGeometryId(c)))return '部署点不可达或过远。';}
 return '';
}
export const combatMovementLocked=s=>!!(s.combat?.status==='active'&&(s.combat.player.hp<=0||combatStaggered(s.combat.player,s.worldTick)||s.srCombat?.pending?.action==='spell'&&!s.srCombat.pending.executed));
function actionReadiness(s,id,target){
 const reason=check(s,id,target,{executing:true,ignoreCooldown:true,ignoreStagger:true});
 if(reason)return {reason,ready:false,bufferable:false};
 const pending=s.srCombat.pending,d=actionDefinition(s,pending?.action);
 const replace=!!pending&&(pending.automatic&&!pending.executed||id==='dodge'&&['attack','spell','guard'].includes(pending.action));
 const pendingWait=pending&&!replace?Math.max(1,d.windup+d.execute+d.recovery-pending.progressTicks):0;
 const wait=Math.max(pendingWait,(s.srCombat.cooldowns[id]||0)-s.worldTick,(s.combat.player.staggerUntilTick||0)-s.worldTick,0);
 return {ready:wait===0,replace,bufferable:s.speed!==0&&wait>0&&wait<=COMBAT_INPUT_BUFFER_TICKS,wait,
  reason:wait===0?'':combatStaggered(s.combat.player,s.worldTick)?'受击尚未站稳。':pendingWait?'先完成当前动作的起手/收势。':'动作仍在冷却。'};
}
function replaceCombatAction(s,reason){
 const o=s.srCombat.pending;if(!o)return;
 s.srCombat.executions.push({...structuredClone(o),phase:'interrupted',reason});
 s.srCombat.executions=s.srCombat.executions.slice(-32);s.srCombat.pending=null;
 if(s.combat.sessionId)delete ownedActivity(s,s.master).actionId;else releaseSRBody(s,requirePerson(s));
}
export function srCombatAction(s,id,target){
 initSRCombat(s);syncBattle(s);
 if(id==='move'){
  if(s.combat?.status!=='active'||s.combat.player.hp<=0||combatStaggered(s.combat.player,s.worldTick))throw Error('掌门无法在当前状态移动。');
  if(s.srCombat.pending)throw Error('起手与收势期间不能同时移动；可先取消未执行动作。');
  if(!hooks.execute)throw Error('战斗执行尚未接入。');return hooks.execute(s,'move',target);
 }
 const ready=actionReadiness(s,id,target);if(!ready.ready&&!ready.bufferable)throw Error(ready.reason);
 const p=requirePerson(s),activity=ownedActivity(s,p);
 if(s.combat.sessionId&&(!activity||activity.kind!=='sr-combat'||activity.orderId!==s.combat.sessionId||s.srCombat.pending&&activity.actionId!==s.srCombat.pending.id))throw Error('掌门战斗身体占用异常。');
 const frozenTarget=structuredClone(target??(['attack','spell','sword-chase'].includes(id)?selectedCombatEnemy(s.combat)?.id:null)??null);
 if(!ready.ready){
  s.srCombat.buffered={action:id,target:frozenTarget,requestedTick:s.worldTick,expiresTick:s.worldTick+COMBAT_INPUT_BUFFER_TICKS};
  return {buffered:true,expiresTick:s.srCombat.buffered.expiresTick,reason:'已保留这次接续，条件成立后执行一次。'};
 }
 if(ready.replace)replaceCombatAction(s,id==='dodge'?'短步优先接续。':'手动行动优先。');
 delete s.srCombat.buffered;
 const actionId=`combat-action:${s.srCombat.nextAction++}`;
 if(!s.combat.sessionId)reserveBody(s,p,'combat',actionId);else activity.actionId=actionId;
 p.action='combat';
 const aimed=['attack','spell'].includes(id)&&aimPoint(frozenTarget),aimLength=aimed?Math.hypot(frozenTarget.x-s.combat.player.x,frozenTarget.y-s.combat.player.y):0;
 const direction=aimed?(aimLength>1e-8?{x:(frozenTarget.x-s.combat.player.x)/aimLength,y:(frozenTarget.y-s.combat.player.y)/aimLength}:{...s.combat.player.facing}):null;
 if(aimed)s.combat.player.facing={...direction};
 if(id==='spell'&&aimPoint(frozenTarget))s.combat.player.target=null;
 s.srCombat.pending={id:actionId,action:id,target:frozenTarget,...(aimed?{direction,targetMode:'direction'}:{}),startedTick:s.worldTick,progressTicks:0,phase:'windup',executed:false,reason:'暂停只排计划；恢复后按起手、执行、收势推进。'};
 return {pending:true,actionId,reason:s.srCombat.pending.reason};
}
function consumeCombatBuffer(s){
 const queued=s.srCombat.buffered;if(!queued)return;
 if(queued.expiresTick<s.worldTick){delete s.srCombat.buffered;return;}
 const ready=actionReadiness(s,queued.action,queued.target);
 if(ready.ready)srCombatAction(s,queued.action,queued.target);
 else if(!ready.bufferable)delete s.srCombat.buffered;
}
export function cancelSRCombatAction(s){const p=s.srCombat?.pending;if(!p||p.executed)throw Error('执行后须完成收势，不能退款刷新冷却。');s.srCombat.pending=null;if(!s.combat?.sessionId)releaseSRBody(s,requirePerson(s));else delete ownedActivity(s,s.master).actionId;s.master.action='combat';return true;}
export function interruptSRCombatWindup(s){return cancelUnreleased(s,'重击打断尚未释放的动作。');}
export function setCombatTactic(s,tactic){if(!['guard','focus','rally','retreat'].includes(tactic))throw Error('未知同行战术。');if(!s.combat||s.combat.status!=='active')throw Error('未在战斗。');s.srCombat.tactic=tactic;return {reason:'同行者依出发约定与自身状态自主执行'+({guard:'护卫',focus:'协同压制',rally:'集结',retreat:'撤离'}[tactic])+'，不会逐个被强制施法。'};}
export function executeSpatialCombatAction(s,id,target,legacy){const reason=check(s,id,target,{executing:true});if(reason)throw Error(reason);const c=s.combat,p=c.player,d=COMBAT_ACTIONS[id];if(d.legacy){const result=legacy(s,d.legacy,target);if(d.extraQi)p.qi=Math.max(0,p.qi-d.extraQi);if(d.guardSeconds)p.guard=d.guardSeconds;if(d.evadeSeconds)p.evade=d.evadeSeconds;return result;}
 if(p.qi<d.qi)throw Error('执行时灵力不足。');
 if(id==='sword-chase'){const enemy=targetEnemy(s,target);if(!enemy||!combatClearLine(p,enemy,combatGeometryId(c)))throw Error('追击目标已失去视线。');const distance=Math.hypot(enemy.x-p.x,enemy.y-p.y);if(distance>d.range)throw Error('目标已走出追击范围。');const end={x:enemy.x-(enemy.x-p.x)/Math.max(distance,.001)*COMBAT_ACTIONS.attack.range,y:enemy.y-(enemy.y-p.y)/Math.max(distance,.001)*COMBAT_ACTIONS.attack.range};if(!combatPath(p,end,combatGeometryId(c)))throw Error('追击路径被阻挡。');p.qi-=d.qi;moveCombatActor(p,end,10,.5,combatGeometryId(c));return legacy(s,'attack',enemy.id);}
 if(id==='pulse-heal'){const ally=targetAlly(s,target);if(!ally||ally.hp<=0||Math.hypot(ally.x-p.x,ally.y-p.y)>d.range||!combatClearLine(p,ally,combatGeometryId(c)))throw Error('救治对象已不在场。');if(availablePills(s,'person:master','heal')<1)throw Error('药物已用尽。');consumeAccessiblePill(s,'person:master','heal');p.qi-=d.qi;const before=ally.hp;setCombatActorHp(s,ally,Math.min(ally.maxHp,ally.hp+35*equipmentCombatBenefits(s).healMultiplier));if(ally===p&&!c.sessionId)s.master.wound=Math.max(0,(s.master.wound||0)-15);c.message='回春散与养脉法已实际止血，恢复'+Math.round(ally.hp-before)+'生命。';return {healed:ally.hp-before};}
 if(id==='ward-node'){const node=target&&typeof target==='object'?target:p;if(materialAvailable(s,'stone')<2||!combatCanStand(node,combatGeometryId(c))||Math.hypot(p.x-node.x,p.y-node.y)>d.range)throw Error('节点位置或材料失效。');spendResources(s,{stone:2});p.qi-=d.qi;const n={id:`node:${s.srCombat.nextAction++}`,personId:'person:master',x:node.x,y:node.y,radius:2.6,until:s.worldTick+80,condition:1};s.srCombat.nodes.push(n);const theme=equipmentThemeView(s,'person:master',n);if(theme.complete&&theme.cooldownUntil<=s.worldTick&&s.master.energy>=EQUIPMENT_THEME.energyCost)activateEquipmentTheme(s,n);c.message='护持节点已部署：范围2.6米，承伤减25%，80tick后消散。';return {nodeId:n.id};}throw Error('动作尚未定义。');}
function combatPersonId(s,actor){return actor===s.combat?.player?'person:master':s.combat?.allies?.find(a=>a===actor)?.personId||null;}
export function outgoingCombatMultiplier(s,source,kind){const personId=combatPersonId(s,source);if(!personId)return 1;const pending=s.srCombat?.pending;const d=source===s.combat?.player&&pending?.phase==='execute'&&!pending.executed&&COMBAT_ACTIONS[pending.action]?.legacy===kind?COMBAT_ACTIONS[pending.action]:null;return equipmentCombatBenefits(s,personId).damageMultiplier*(d?.damageMultiplier||1);}
export function incomingCombatMultiplier(s,target){const personId=combatPersonId(s,target);if(!personId)return 1;let reduction=equipmentCombatBenefits(s,personId).guard;for(const node of s.srCombat?.nodes||[])if(node.until>s.worldTick&&node.condition>0&&Math.hypot(target.x-node.x,target.y-node.y)<=node.radius)reduction=Math.max(reduction,.25);if(target===s.combat?.player&&equipmentThemeView(s,'person:master',target).active)reduction=Math.max(reduction,EQUIPMENT_THEME.damageReduction);return Math.max(.65,1-reduction);}
export function tickSRCombat(s){const r=s.srCombat;if(!r||r.lastTick===s.worldTick||s.speed===0){if(s.speed===0)clearCombatInput(s);return;}r.lastTick=s.worldTick;if(releaseFinishedCombat(s))return;syncBattle(s);r.nodes=r.nodes.filter(n=>n.until>s.worldTick);if(r.buffered?.expiresTick<s.worldTick)delete r.buffered;if(combatStaggered(s.combat.player,s.worldTick))return;consumeCombatBuffer(s);if(!r.pending&&s.combat.controls?.autoAttack&&!s.combat.retreatRequested){const target=s.combat.enemies.filter(e=>e.hp>0&&combatInRange(e,s.combat.player,basicCombatAttackProfile(s.combat).range)&&combatClearLine(s.combat.player,e,combatGeometryId(s.combat))).sort((a,b)=>Math.hypot(a.x-s.combat.player.x,a.y-s.combat.player.y)-Math.hypot(b.x-s.combat.player.x,b.y-s.combat.player.y))[0];if(target&&!check(s,'attack',target.id)){srCombatAction(s,'attack',target.id);r.pending.automatic=true;}}const o=r.pending;if(!o)return;const activity=ownedActivity(s,s.master);if(!activity||activity.orderId!==(s.combat.sessionId||o.id)||s.combat.sessionId&&activity.actionId!==o.id){o.reason='身体动作已中断。';r.pending=null;return;}const d=actionDefinition(s,o.action);o.progressTicks++;if(o.progressTicks<=d.windup){o.phase='windup';return;}if(!o.executed){o.phase='execute';try{if(!hooks.execute)throw Error('战斗模块尚未接入。');const reason=check(s,o.action,o.target,{executing:true});if(reason)throw Error(reason);o.result=hooks.execute(s,o.action,o.target);r.cooldowns[o.action]=s.worldTick+d.cooldown;o.executed=true;o.executedTick=s.worldTick;o.reason='执行完成，正在收势。';if(o.targetMode!=='direction'&&(['attack','spell','sword-chase'].includes(o.action)||['attack','spell'].includes(d.legacy)))recordBindingPractice(s,'person:master',o.id);const art=openingCombatProfile(s),practiceArt=o.action==='spell'?art.attackArtId:o.action==='guard'?art.guardArtId:d.art||(['attack','spell'].includes(d.legacy)?s.master.main:null);if(practiceArt&&o.targetMode!=='direction')recordArtPractice(s,'person:master',practiceArt,{eventId:o.id,difficulty:1,effective:true});for(const i of equippedItems(s))i.condition=Math.max(0,i.condition-.001);}catch(err){o.executed=true;o.failure=err.message;o.reason='执行失败：'+err.message;r.cooldowns[o.action]=s.worldTick+5;}}
 if(releaseFinishedCombat(s))return;
 if(o.progressTicks>=d.windup+d.execute+d.recovery){r.executions.push(structuredClone(o));r.executions=r.executions.slice(-32);r.pending=null;if(!s.combat?.sessionId)releaseSRBody(s,s.master);else delete activity.actionId;s.master.action='combat';consumeCombatBuffer(s);}else o.phase='recovery';}
export function viewSRCombat(s){
 if(s.combat?.status!=='active')return null;
 const art=openingCombatProfile(s),p=s.combat.player;
 const actions=(manual=false)=>Object.entries(COMBAT_ACTIONS).filter(([,d])=>!d.realm||s.master.realm>=d.realm).map(([id,definition])=>{
  const d=id==='attack'?basicCombatAttackProfile(s.combat):definition;
  const target=manual&&['attack','spell'].includes(id)?{x:p.x+p.facing.x,y:p.y+p.facing.y}:undefined,ready=actionReadiness(s,id,target),reason=ready.reason;
  return {id,...d,...(id==='spell'?{name:art.attackName,range:art.range,qi:art.cost,art:art.attackArtId}:id==='guard'?{name:art.guardName,art:art.guardArtId}:{}),targetMode:['attack','spell'].includes(id)?'direction':id==='dodge'?'point':'self',disabled:!ready.ready&&!ready.bufferable,bufferable:ready.bufferable,reason,cooldownUntil:s.srCombat?.cooldowns[id]||0};
 });
 return {actions:actions(),manualActions:actions(true),selectedTargetId:selectedCombatEnemy(s.combat)?.id||null,targets:s.combat.enemies.map(e=>({id:e.id,personId:e.personId||null,name:e.name,hp:e.hp,maxHp:e.maxHp,faction:'hostile',available:e.hp>0,selected:e.id===s.combat.selectedTargetId})),controls:structuredClone(s.combat.controls||{move:{x:0,y:0},moveUntilTick:s.worldTick,autoAttack:false}),pending:structuredClone(s.srCombat?.pending),buffered:structuredClone(s.srCombat?.buffered??null),projectiles:structuredClone(s.combat.projectiles||[]),nodes:structuredClone(s.srCombat?.nodes||[]),tactic:s.srCombat?.tactic||'guard',tactics:['guard','focus','rally','retreat'],equipmentDamageMultiplier:incomingCombatMultiplier(s,s.combat.player)};
}
/** Read-only animation facts; no render frame advances an action. */
export function projectCombatActorMotion(s,actor){
 const tick=combatWorldTick(s),c=s.combat,direction={...(actor.facing||{x:1,y:0})};
 const moveIntent=actor===c.player?{...(c.controls?.move||{x:0,y:0})}:{x:0,y:0},movementLocked=actor.hp<=0||combatStaggered(actor,tick)||(actor===c.player?combatMovementLocked(s):!!(actor.telegraph||actor.pendingAttack)),moving=actor.movedTick===tick;
 const dodgePath=actor.dodgePath&&tick<=actor.dodgePath.startedTick+actor.dodgePath.durationTicks?structuredClone(actor.dodgePath):null;
 const make=(action,phase,start,duration,progress,extra={})=>({movementLocked,moving,moveIntent,...(dodgePath?{dodgePath}:{}),actionId:null,action,phase,startedTick:start,executeAtTick:start,phaseStartedTick:start,phaseDurationTicks:Math.max(1,duration),phaseProgressTicks:Math.max(0,progress),direction,recoveryUntilTick:tick,...extra});
 if(actor.hp<=0)return make('down','down',actor.downedTick??tick,12,tick-(actor.downedTick??tick));
 if(combatStaggered(actor,tick)){const r=actor.hitReaction;return make('hit','hit',r?.tick??tick,(actor.staggerUntilTick-(r?.tick??tick)),tick-(r?.tick??tick),{actionId:r?.eventId||null,direction:r?.direction||direction,recoveryUntilTick:actor.staggerUntilTick});}
 if(actor===c.player){
  const pending=s.srCombat?.pending,d=pending&&actionDefinition(s,pending.action);
  if(d){const progress=pending.progressTicks,windup=progress<=d.windup&&!pending.executed,release=pending.executedTick===tick;
   const phase=windup?'windup':release?'release':'recovery',offset=windup?0:d.windup+(release?0:d.execute),phaseProgress=windup?progress:release?0:Math.max(0,progress-offset),duration=windup?d.windup:release?d.execute:d.recovery;
   return make(pending.action,phase,tick-phaseProgress,duration,phaseProgress,{actionId:pending.id,startedTick:pending.startedTick,executeAtTick:pending.executedTick??tick+Math.max(0,d.windup+1-progress),direction:pending.direction||direction,recoveryUntilTick:tick+Math.max(0,d.windup+d.execute+d.recovery-progress)});
  }
  if(actor.evade>0)return make('dodge','evade',tick,1,0);
  if(actor.guard>0)return make('guard','guard',tick,1,0);
 }else{
  const m=actor.motionAction;
  const a=actor.pendingAttack;if(a)return make('attack','windup',a.startedTick,a.releaseTick-a.startedTick,tick-a.startedTick,{actionId:a.id,startedTick:a.startedTick,executeAtTick:a.releaseTick,direction:a.direction,recoveryUntilTick:a.releaseTick+COMBAT_ACTIONS.attack.recovery});
  if(actor.telegraph){const total=Math.round(actor.telegraph.total*10),remaining=Math.round(actor.telegraph.remaining*10);return make('strike','windup',tick-(total-remaining),total,total-remaining,{actionId:m?.id||null,startedTick:m?.startedTick??tick-(total-remaining),executeAtTick:tick+remaining,direction:combatDirection(actor,actor.telegraph,direction),recoveryUntilTick:tick+remaining+(actor.srMoves?.recoveryTicks||20)});}
  if(m&&m.recoveryUntilTick>tick){const release=m.releasedTick===tick;return make(m.action,release?'release':'recovery',release?tick:m.releasedTick+1,release?1:m.recoveryUntilTick-m.releasedTick-1,release?0:tick-m.releasedTick-1,{actionId:m.id,startedTick:m.startedTick,executeAtTick:m.releasedTick,recoveryUntilTick:m.recoveryUntilTick,direction:m.direction||direction});}
 }
 return make(moving?'move':'idle',moving?'move':'idle',tick,1,0);
}
export function validateSRCombat(s){
 hydrateEncounterBattle(s);validateEncounterCombatants(s);
 if(!s.srCombat){if(s.combat?.status==='active')throw Error('战斗扩展状态缺失');return true;}
 const r=s.srCombat,c=s.combat;
 if(c)for(const actor of [c.player,...c.allies,...c.enemies]){
  if(actor.targetId!==undefined&&actor.targetId!==null){const target=combatParticipant(c,actor.targetId);if(!target||combatSide(c,actor)===combatSide(c,target))throw Error('战斗自主目标阵营异常。');}
  const attack=actor.pendingAttack;if(attack&&(!c.allies.includes(actor)||typeof attack.id!=='string'||!Number.isSafeInteger(attack.startedTick)||attack.startedTick<0||attack.startedTick>s.worldTick||!Number.isSafeInteger(attack.releaseTick)||attack.releaseTick<attack.startedTick+COMBAT_ACTIONS.attack.windup+1||attack.releaseTick>s.worldTick+COMBAT_ACTIONS.attack.windup+1||!c.enemies.some(e=>e.id===attack.targetId)||!Number.isFinite(attack.direction?.x)||!Number.isFinite(attack.direction?.y)||Math.abs(Math.hypot(attack.direction.x,attack.direction.y)-1)>1e-6))throw Error('同行出手阶段异常。');
  for(const key of ['staggerUntilTick','staggerImmuneUntilTick','downedTick','movedTick'])if(actor[key]!==undefined&&(!Number.isSafeInteger(actor[key])||actor[key]<0||actor[key]>s.worldTick+15))throw Error('战斗受击时钟异常。');
  const h=actor.hitReaction;if(h&&(!['light','heavy','guard','evade','down'].includes(h.kind)||typeof h.eventId!=='string'||!Number.isSafeInteger(h.tick)||h.tick<0||h.tick>s.worldTick||!Number.isSafeInteger(h.untilTick)||h.untilTick<h.tick||h.untilTick>h.tick+4||!Number.isFinite(h.direction?.x)||!Number.isFinite(h.direction?.y)||Math.abs(Math.hypot(h.direction.x,h.direction.y)-1)>1e-6||!Number.isFinite(h.contact?.x)||!Number.isFinite(h.contact?.y)||typeof h.interrupted!=='boolean'))throw Error('战斗受击阶段异常。');
  const path=actor.dodgePath;if(path&&(!aimPoint(path.from)||!aimPoint(path.to)||!Number.isSafeInteger(path.startedTick)||path.startedTick<0||path.startedTick>s.worldTick||path.durationTicks!==2||Math.hypot(path.to.x-path.from.x,path.to.y-path.from.y)>2.800001))throw Error('短步路径异常。');
 }
 if(c?.selectedTargetId!==undefined&&c.selectedTargetId!==null&&!c.enemies.some(e=>e.id===c.selectedTargetId))throw Error('战斗选中目标异常。');
 if(r.buffered&&(!COMBAT_ACTIONS[r.buffered.action]||!Number.isSafeInteger(r.buffered.requestedTick)||r.buffered.requestedTick<0||r.buffered.requestedTick>s.worldTick||!Number.isSafeInteger(r.buffered.expiresTick)||r.buffered.expiresTick!==r.buffered.requestedTick+COMBAT_INPUT_BUFFER_TICKS||r.buffered.expiresTick<s.worldTick||r.buffered.target!==null&&typeof r.buffered.target!=='string'&&!aimPoint(r.buffered.target)))throw Error('战斗接续输入异常。');
 if(r.pending?.targetMode==='direction'&&(!aimPoint(r.pending.target)||!Number.isFinite(r.pending.direction?.x)||!Number.isFinite(r.pending.direction?.y)||Math.abs(Math.hypot(r.pending.direction.x,r.pending.direction.y)-1)>1e-6))throw Error('战斗瞄准方向异常。');
 if(c?.controls){const v=c.controls;if(typeof v.autoAttack!=='boolean'||!Number.isSafeInteger(v.moveUntilTick)||v.moveUntilTick<0||v.moveUntilTick>s.worldTick+5||!Number.isFinite(v.move?.x)||!Number.isFinite(v.move?.y)||Math.hypot(v.move.x,v.move.y)>1.000001)throw Error('战斗方向输入异常。');}
 if(r.version!==1||!Number.isSafeInteger(r.lastTick)||r.lastTick>s.worldTick||!['guard','focus','rally','retreat'].includes(r.tactic))throw Error('战斗扩展状态异常。');
 if(r.pending&&(!COMBAT_ACTIONS[r.pending.action]||!Number.isSafeInteger(r.pending.progressTicks)||r.pending.progressTicks<0||!['windup','execute','recovery'].includes(r.pending.phase)))throw Error('战斗阶段异常。');
 for(const n of r.nodes)if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||!Number.isSafeInteger(n.until)||n.condition<0||n.condition>1)throw Error('节点记录异常。');
 for(const [id,session]of Object.entries(s.combatSessionsById||{})){
  const ids=session?.participantIds,starting=session?.startingWounds;
  if(session.combatantIds!==undefined&&(!Array.isArray(session.combatantIds)||new Set(session.combatantIds).size!==session.combatantIds.length||session.combatantIds.some(id=>!s.world?.encounterCombatantsById?.[id])))throw Error('战斗会话普通人物引用异常。');
  if(!/^combat:campaign:[1-9]\d*$/.test(id)||!session||session.id!==id||session.personId!=='person:master'||!['active','ended'].includes(session.phase)||!Number.isSafeInteger(session.startedTick)||session.startedTick<0||session.startedTick>s.worldTick||!Array.isArray(ids)||!ids.includes('person:master')||new Set(ids).size!==ids.length||ids.some(personId=>!s.personsById[personId])||!starting||Object.keys(starting).length!==ids.length||ids.some(personId=>!Number.isFinite(starting[personId])||starting[personId]<0||starting[personId]>100))throw Error('战斗会话记录异常：'+id);
  if(session.phase==='ended'&&(!Number.isSafeInteger(session.endedTick)||session.endedTick<session.startedTick||session.endedTick>s.worldTick||!['won','lost','retreated'].includes(session.result)))throw Error('战斗会话结算异常：'+id);
 }
 if(c?.status==='active'&&Number.isSafeInteger(c.journeyId)&&!c.sessionId)beginCombatSession(s,c,{legacy:true});
 if(c?.status==='active'&&(Number.isSafeInteger(c.journeyId)||c.sessionId)){
  syncCombatBodyProjection(s,c);
  if(c.player.hp<=0)throw Error('战斗掌门伤势已达倒下界限，须先推进世界步完成结算');
  const id=c.sessionId,session=s.combatSessionsById?.[id],actors=combatActors(c),ids=actors.map(a=>a.personId);
  if(id!==`combat:campaign:${c.journeyId}`||c.player.personId!=='person:master'||!session||session.phase!=='active'||JSON.stringify(session.participantIds)!==JSON.stringify(ids))throw Error('战斗会话引用异常：'+id);
  const ordinary=c.enemies.filter(a=>a.combatantId);
  if(ordinary.length&&JSON.stringify(session.combatantIds)!==JSON.stringify(ordinary.map(a=>a.combatantId)))throw Error('战斗普通人物会话引用异常。');
  for(const actor of ordinary){const record=s.world.encounterCombatantsById[actor.combatantId];if(!record||record.encounterId!==c.encounterId||record.configId!==actor.configId||actor.maxHp!==record.maxHp||actor.hp!==encounterCombatantHp(record))throw Error('战斗普通人物伤势投影异常。');if(c.sceneFrame&&(record.location?.sceneId!==c.sceneFrame.sceneId||Math.abs(record.location.x-c.sceneFrame.origin.x-actor.x)>1e-8||Math.abs(record.location.y-c.sceneFrame.origin.y-actor.y)>1e-8))throw Error('战斗普通人物真实脚点异常。');}
  for(const actor of actors){const person=s.personsById[actor.personId],activity=ownedActivity(s,person);
   if(!person||person.combatSessionId!==id||!activity||activity.kind!=='sr-combat'||activity.orderId!==id||person.activityId!==activity.id||actor.hp!==projectedCombatHp(person,actor.maxHp))throw Error('战斗人物身体/伤势引用异常：'+actor.personId);
   if(c.sceneFrame){const loc=person.location,frame=c.sceneFrame;if(loc?.kind!=='local'||loc.sceneId!==frame?.sceneId||Math.abs(loc.x-frame.origin.x-actor.x)>1e-8||Math.abs(loc.y-frame.origin.y-actor.y)>1e-8)throw Error('斗法与人物实际脚点不一致：'+actor.personId);}
  }
  if(r.pending&&ownedActivity(s,s.master)?.actionId!==r.pending.id)throw Error('战斗招式与身体活动引用异常');
 }
 for(const [id,session]of Object.entries(s.combatSessionsById||{}))if(session.phase==='active'&&(c?.status!=='active'||id!==c.sessionId))throw Error('活跃战斗会话悬空：'+id);
 for(const person of Object.values(s.personsById||{}))if(person.combatSessionId&&(!c||c.status!=='active'||person.combatSessionId!==c.sessionId))throw Error('人物战斗会话悬空：'+person.personId);
 return true;
}
export const combatHandlers={srCombatAction,cancelSRCombatAction,setCombatTactic,setSRCombatInput,setSRAutoAttack,setSRCombatTarget};

// R/T balance: no inferred realm for unnamed actors, same-tier techniques retain their own differences.
export const REALM_GAP_BALANCE=Object.freeze({multiplierPerTier:1.6,minimum:.1,maximum:10});
function actualCombatRealm(s,actor){if(actor===s.combat?.player)return s.master.realm;const person=actor?.personId&&s.personsById[actor.personId];if(person&&Number.isSafeInteger(person.realm)&&person.realm>=1)return descentEffectiveRealmSR(s,person);const realm=actor?.realm??actor?.srMoves?.realm;return Number.isSafeInteger(realm)&&realm>=1&&realm<=30?realm:null;}
export function realmGapCombatMultiplier(s,source,target){const from=actualCombatRealm(s,source),to=actualCombatRealm(s,target);if(from===null||to===null)return 1;const gap=realmTier(from)-realmTier(to);return Math.max(REALM_GAP_BALANCE.minimum,Math.min(REALM_GAP_BALANCE.maximum,REALM_GAP_BALANCE.multiplierPerTier**gap));}
