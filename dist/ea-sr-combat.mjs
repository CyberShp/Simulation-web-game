import {descentEffectiveRealmSR} from './ea-sr-descent.mjs';
/** SR-XF-013. Timed commands replace instant UI actions; campaign owns damage. */
import {combatCanStand,combatPath,combatClearLine,combatGeometryId,moveCombatActor} from './ea-combat-geometry.mjs';
import {requirePerson,reserveBody,ownedActivity,releaseSRBody,equippedItems,EQUIPMENT_DEFINITIONS,equipmentThemeView,EQUIPMENT_THEME,activateEquipmentTheme,equipmentCombatBenefits,recordBindingPractice,resourceSource,spendResources} from './ea-sr-equipment.mjs';
import {availablePills,consumeAccessiblePill} from './ea-sr-economy.mjs';
import {recordArtPractice,chapterKnown,realmTier} from './ea-sr-cultivation.mjs';
let hooks={};
export function configureSRCombat(next={}){hooks={...hooks,...next};}
export const COMBAT_ACTIONS=Object.freeze({
 attack:{name:'基础剑式',windup:3,execute:1,recovery:7,range:1.9,qi:0,cooldown:12,legacy:'attack'},
 spell:{name:'青岚术',windup:5,execute:1,recovery:8,range:6,qi:16,cooldown:45,legacy:'spell'},
 dodge:{name:'短步脱离',windup:1,execute:1,recovery:4,range:2.8,qi:8,cooldown:32,legacy:'dodge'},
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
 'person:han-lichuan':{realm:12,style:'赤嶂重刀',windupTicks:18,reach:2.2,recoveryTicks:22,damage:36,counter:'绕开正面落点，趁收势追击'},
 'person:xing-lie':{realm:12,style:'煞炼刀法',windupTicks:13,reach:2.5,recoveryTicks:18,damage:30,counter:'切断补给，短护持化解一击'},
 'person:shao-heng':{realm:11,style:'护库刀阵',windupTicks:16,reach:1.8,recoveryTicks:20,damage:27,counter:'牵离固定守位，养脉保持持续战力'}
});
const combatActors=c=>[c.player,...c.allies,...c.enemies].filter(a=>a.personId);
export function projectedCombatHp(person,maxHp){return person.lifeStatus==='dead'||person.wound>=100?0:Math.max(1,Math.min(maxHp,Math.round(maxHp*(1-(person.wound||0)/100))));}
export function syncCombatBodyProjection(s,c=s.combat){
 if(c?.status!=='active'||!c.sessionId)return;
 for(const actor of combatActors(c)){
  const person=s.personsById?.[actor.personId];
  if(!person)continue;
  actor.hp=projectedCombatHp(person,actor.maxHp);
  if(Object.hasOwn(actor,'knockedOut'))actor.knockedOut=actor.hp===0;
 }
}
export function setCombatActorHp(s,actor,hp){
 const person=actor.personId&&s.personsById?.[actor.personId];
 if(!person){actor.hp=Math.max(0,Math.min(actor.maxHp,hp));return actor.hp;}
 actor.hp=Math.max(0,Math.min(actor.maxHp,Math.round(hp)));
 person.wound=Math.max(0,Math.min(100,100*(1-actor.hp/actor.maxHp)));
 return actor.hp;
}
export function beginCombatSession(s,c,{legacy=false}={}){
 if(s.contentVersion!=='sr-content-v1.2')return;
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
 s.combatSessionsById[id]={id,personId:'person:master',participantIds,phase:'active',startedTick:s.worldTick,startingWounds};
 if(legacy&&s.srCombat){const oldKey=`${c.journeyId??'fixture'}:${c.encounterId??'combat'}:${c.regionId}`;if(!s.srCombat.battleId||s.srCombat.battleId===oldKey)s.srCombat.battleId=id;}
}
export function endCombatSession(s,c){
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
export function initSRCombat(s){s.srCombat??={version:1,lastTick:s.worldTick,nextAction:1,pending:null,cooldowns:{},nodes:[],tactic:'guard',executions:[],battleId:null};if(s.combat?.status==='active'&&s.combat.player&&Number.isSafeInteger(s.combat.journeyId)&&!s.combat.sessionId)beginCombatSession(s,s.combat,{legacy:true});syncCombatBodyProjection(s);releaseFinishedCombat(s);return s;}
function known(s,art){const p=s.personsById['person:master'];return p.artsById?.[art]?.understanding??p.knowledge?.[art]??0;}
function targetEnemy(s,target){return typeof target==='string'?s.combat.enemies.find(e=>e.id===target&&e.hp>0):s.combat.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-s.combat.player.x,a.y-s.combat.player.y)-Math.hypot(b.x-s.combat.player.x,b.y-s.combat.player.y))[0];}
function targetAlly(s,target){return target?s.combat.allies.find(a=>a.id===target||a.personId===target):s.combat.player;}
function materialAvailable(s,key){try{return resourceSource(s).resources[key]||0;}catch{return 0;}}
function syncBattle(s){const r=s.srCombat,c=s.combat;if(c?.status!=='active')return;const key=c.sessionId||`${c.journeyId??'fixture'}:${c.encounterId??'combat'}:${c.regionId}`;if(r.battleId===key)return;r.pending=null;r.nodes=[];r.battleId=key;}
function check(s,id,target,{executing=false}={}){const c=s.combat,d=COMBAT_ACTIONS[id],p=c?.player;if(!c||c.status!=='active')return '当前无战斗。';if(!d)return '无此战斗动作。';if(!Number.isFinite(p.hp)||p.hp<=0)return '掌门已倒下，不能继续行动。';if(!executing&&s.srCombat.pending)return '先完成当前动作的起手/收势。';if((s.srCombat.cooldowns[id]||0)>s.worldTick)return '动作仍在冷却。';if(p.qi<d.qi)return '灵力不足。';if(d.realm&&s.master.realm<d.realm)return '尚未达到此动作的大境界。';if(d.chapterId&&!chapterKnown(s,'person:master',d.chapterId))return '须实际研习此境可靠续篇。';if(d.art&&known(s,d.art)<d.understanding)return '尚未理解所需法门。';if(d.pill&&availablePills(s,'person:master',d.pill)<1)return '缺少随身回春散。';if(id==='ward-node'&&!equippedItems(s).some(i=>EQUIPMENT_DEFINITIONS[i.definitionId]?.node&&i.condition>0))return '须携带并装备可用护持印。';if(id==='ward-node'&&materialAvailable(s,'stone')<2)return '缺少节点青石2。';
 if(['attack','spell','sword-chase'].includes(id)||['attack','spell'].includes(d.legacy)){const enemy=targetEnemy(s,target);if(!enemy)return '目标已倒下。';if(Math.hypot(p.x-enemy.x,p.y-enemy.y)>d.range)return '目标超出动作范围。';if(!combatClearLine(p,enemy,combatGeometryId(c)))return '目标被障碍遮挡。';if(id==='sword-chase'&&!combatPath(p,enemy,combatGeometryId(c)))return '追击路径不可达。';}
 if(id==='pulse-heal'){const ally=targetAlly(s,target);if(!ally||ally.hp<=0)return '不能以普通治疗复活倒下或身死的人。';if(Math.hypot(p.x-ally.x,p.y-ally.y)>d.range||!combatClearLine(p,ally,combatGeometryId(c)))return '救治目标不在可触及范围。';if(ally.hp>=ally.maxHp&&(!(s.master.wound>0)||ally!==p))return '无有效伤势，不消耗药物或刷熟练。';}
 if(id==='ward-node'){const t=target&&typeof target==='object'?target:p;if(Math.hypot(p.x-t.x,p.y-t.y)>d.range||!combatCanStand(t,combatGeometryId(c))||!combatClearLine(p,t,combatGeometryId(c)))return '部署点不可达或过远。';}
 return '';
}
export function srCombatAction(s,id,target){initSRCombat(s);syncBattle(s);if(id==='move'){if(s.combat?.status!=='active'||s.combat.player.hp<=0)throw Error('掌门无法在当前状态移动。');if(s.srCombat.pending)throw Error('起手与收势期间不能同时移动；可先取消未执行动作。');if(!hooks.execute)throw Error('战斗执行尚未接入。');return hooks.execute(s,'move',target);}const reason=check(s,id,target);if(reason)throw Error(reason);const p=requirePerson(s),actionId=`combat-action:${s.srCombat.nextAction++}`,activity=ownedActivity(s,p);if(s.combat.sessionId&&(!activity||activity.kind!=='sr-combat'||activity.orderId!==s.combat.sessionId))throw Error('掌门战斗身体占用异常。');if(!s.combat.sessionId)reserveBody(s,p,'combat',actionId);else activity.actionId=actionId;p.action='combat';s.srCombat.pending={id:actionId,action:id,target:structuredClone(target??null),startedTick:s.worldTick,progressTicks:0,phase:'windup',executed:false,reason:'暂停只排计划；恢复后按起手、执行、收势推进。'};return {pending:true,actionId,reason:s.srCombat.pending.reason};}
export function cancelSRCombatAction(s){const p=s.srCombat?.pending;if(!p||p.executed)throw Error('执行后须完成收势，不能退款刷新冷却。');s.srCombat.pending=null;if(!s.combat?.sessionId)releaseSRBody(s,requirePerson(s));else delete ownedActivity(s,s.master).actionId;s.master.action='combat';return true;}
export function setCombatTactic(s,tactic){if(!['guard','focus','rally','retreat'].includes(tactic))throw Error('未知同行战术。');if(!s.combat||s.combat.status!=='active')throw Error('未在战斗。');s.srCombat.tactic=tactic;return {reason:'同行者依出发约定与自身状态自主执行'+({guard:'护卫',focus:'协同压制',rally:'集结',retreat:'撤离'}[tactic])+'，不会逐个被强制施法。'};}
export function executeSpatialCombatAction(s,id,target,legacy){const reason=check(s,id,target,{executing:true});if(reason)throw Error(reason);const c=s.combat,p=c.player,d=COMBAT_ACTIONS[id];if(d.legacy){const result=legacy(s,d.legacy,target);if(d.extraQi)p.qi=Math.max(0,p.qi-d.extraQi);if(d.guardSeconds)p.guard=d.guardSeconds;if(d.evadeSeconds)p.evade=d.evadeSeconds;return result;}
 if(p.qi<d.qi)throw Error('执行时灵力不足。');
 if(id==='sword-chase'){const enemy=targetEnemy(s,target);if(!enemy||!combatClearLine(p,enemy,combatGeometryId(c)))throw Error('追击目标已失去视线。');const distance=Math.hypot(enemy.x-p.x,enemy.y-p.y);if(distance>d.range)throw Error('目标已走出追击范围。');const end={x:enemy.x-(enemy.x-p.x)/Math.max(distance,.001)*1.2,y:enemy.y-(enemy.y-p.y)/Math.max(distance,.001)*1.2};if(!combatPath(p,end,combatGeometryId(c)))throw Error('追击路径被阻挡。');p.qi-=d.qi;moveCombatActor(p,end,10,.5,combatGeometryId(c));return legacy(s,'attack',enemy.id);}
 if(id==='pulse-heal'){const ally=targetAlly(s,target);if(!ally||ally.hp<=0||Math.hypot(ally.x-p.x,ally.y-p.y)>d.range||!combatClearLine(p,ally,combatGeometryId(c)))throw Error('救治对象已不在场。');if(availablePills(s,'person:master','heal')<1)throw Error('药物已用尽。');consumeAccessiblePill(s,'person:master','heal');p.qi-=d.qi;const before=ally.hp;setCombatActorHp(s,ally,Math.min(ally.maxHp,ally.hp+35*equipmentCombatBenefits(s).healMultiplier));if(ally===p&&!c.sessionId)s.master.wound=Math.max(0,(s.master.wound||0)-15);c.message='回春散与养脉法已实际止血，恢复'+Math.round(ally.hp-before)+'生命。';return {healed:ally.hp-before};}
 if(id==='ward-node'){const node=target&&typeof target==='object'?target:p;if(materialAvailable(s,'stone')<2||!combatCanStand(node,combatGeometryId(c))||Math.hypot(p.x-node.x,p.y-node.y)>d.range)throw Error('节点位置或材料失效。');spendResources(s,{stone:2});p.qi-=d.qi;const n={id:`node:${s.srCombat.nextAction++}`,personId:'person:master',x:node.x,y:node.y,radius:2.6,until:s.worldTick+80,condition:1};s.srCombat.nodes.push(n);const theme=equipmentThemeView(s,'person:master',n);if(theme.complete&&theme.cooldownUntil<=s.worldTick&&s.master.energy>=EQUIPMENT_THEME.energyCost)activateEquipmentTheme(s,n);c.message='护持节点已部署：范围2.6米，承伤减25%，80tick后消散。';return {nodeId:n.id};}throw Error('动作尚未定义。');}
function combatPersonId(s,actor){return actor===s.combat?.player?'person:master':s.combat?.allies?.find(a=>a===actor)?.personId||null;}
export function outgoingCombatMultiplier(s,source,kind){const personId=combatPersonId(s,source);if(!personId)return 1;const pending=s.srCombat?.pending;const d=source===s.combat?.player&&pending?.phase==='execute'&&!pending.executed&&COMBAT_ACTIONS[pending.action]?.legacy===kind?COMBAT_ACTIONS[pending.action]:null;return equipmentCombatBenefits(s,personId).damageMultiplier*(d?.damageMultiplier||1);}
export function incomingCombatMultiplier(s,target){const personId=combatPersonId(s,target);if(!personId)return 1;let reduction=equipmentCombatBenefits(s,personId).guard;for(const node of s.srCombat?.nodes||[])if(node.until>s.worldTick&&node.condition>0&&Math.hypot(target.x-node.x,target.y-node.y)<=node.radius)reduction=Math.max(reduction,.25);if(target===s.combat?.player&&equipmentThemeView(s,'person:master',target).active)reduction=Math.max(reduction,EQUIPMENT_THEME.damageReduction);return Math.max(.65,1-reduction);}
export function tickSRCombat(s){const r=s.srCombat;if(!r||r.lastTick===s.worldTick||s.speed===0)return;r.lastTick=s.worldTick;if(releaseFinishedCombat(s))return;syncBattle(s);r.nodes=r.nodes.filter(n=>n.until>s.worldTick);const o=r.pending;if(!o)return;const activity=ownedActivity(s,s.master);if(!activity||activity.orderId!==(s.combat.sessionId||o.id)||s.combat.sessionId&&activity.actionId!==o.id){o.reason='身体动作已中断。';r.pending=null;return;}const d=COMBAT_ACTIONS[o.action];o.progressTicks++;if(o.progressTicks<=d.windup){o.phase='windup';return;}if(!o.executed){o.phase='execute';try{if(!hooks.execute)throw Error('战斗模块尚未接入。');const reason=check(s,o.action,o.target,{executing:true});if(reason)throw Error(reason);o.result=hooks.execute(s,o.action,o.target);r.cooldowns[o.action]=s.worldTick+d.cooldown;o.executed=true;o.executedTick=s.worldTick;o.reason='执行完成，正在收势。';if(['attack','spell','sword-chase'].includes(o.action)||['attack','spell'].includes(d.legacy))recordBindingPractice(s,'person:master',o.id);const practiceArt=d.art||(['attack','spell'].includes(d.legacy)?s.master.main:null);if(practiceArt)recordArtPractice(s,'person:master',practiceArt,{eventId:o.id,difficulty:1,effective:true});for(const i of equippedItems(s))i.condition=Math.max(0,i.condition-.001);}catch(err){o.executed=true;o.failure=err.message;o.reason='执行失败：'+err.message;r.cooldowns[o.action]=s.worldTick+5;}}
 if(releaseFinishedCombat(s))return;
 if(o.progressTicks>=d.windup+d.execute+d.recovery){r.executions.push(structuredClone(o));r.executions=r.executions.slice(-32);r.pending=null;if(!s.combat?.sessionId)releaseSRBody(s,s.master);else delete activity.actionId;s.master.action='combat';}else o.phase='recovery';}
export function viewSRCombat(s){if(s.combat?.status!=='active')return null;return {actions:Object.entries(COMBAT_ACTIONS).filter(([,d])=>!d.realm||s.master.realm>=d.realm).map(([id,d])=>({id,...d,disabled:!!check(s,id),reason:check(s,id),cooldownUntil:s.srCombat?.cooldowns[id]||0})),pending:structuredClone(s.srCombat?.pending),nodes:structuredClone(s.srCombat?.nodes||[]),tactic:s.srCombat?.tactic||'guard',tactics:['guard','focus','rally','retreat'],equipmentDamageMultiplier:incomingCombatMultiplier(s,s.combat.player)};}
export function validateSRCombat(s){
 if(!s.srCombat){if(s.combat?.status==='active')throw Error('战斗扩展状态缺失');return true;}
 const r=s.srCombat,c=s.combat;
 if(r.version!==1||!Number.isSafeInteger(r.lastTick)||r.lastTick>s.worldTick||!['guard','focus','rally','retreat'].includes(r.tactic))throw Error('战斗扩展状态异常。');
 if(r.pending&&(!COMBAT_ACTIONS[r.pending.action]||!Number.isSafeInteger(r.pending.progressTicks)||r.pending.progressTicks<0||!['windup','execute','recovery'].includes(r.pending.phase)))throw Error('战斗阶段异常。');
 for(const n of r.nodes)if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||!Number.isSafeInteger(n.until)||n.condition<0||n.condition>1)throw Error('节点记录异常。');
 for(const [id,session]of Object.entries(s.combatSessionsById||{})){
  const ids=session?.participantIds,starting=session?.startingWounds;
  if(!/^combat:campaign:[1-9]\d*$/.test(id)||!session||session.id!==id||session.personId!=='person:master'||!['active','ended'].includes(session.phase)||!Number.isSafeInteger(session.startedTick)||session.startedTick<0||session.startedTick>s.worldTick||!Array.isArray(ids)||!ids.includes('person:master')||new Set(ids).size!==ids.length||ids.some(personId=>!s.personsById[personId])||!starting||Object.keys(starting).length!==ids.length||ids.some(personId=>!Number.isFinite(starting[personId])||starting[personId]<0||starting[personId]>100))throw Error('战斗会话记录异常：'+id);
  if(session.phase==='ended'&&(!Number.isSafeInteger(session.endedTick)||session.endedTick<session.startedTick||session.endedTick>s.worldTick||!['won','lost','retreated'].includes(session.result)))throw Error('战斗会话结算异常：'+id);
 }
 if(c?.status==='active'&&Number.isSafeInteger(c.journeyId)&&!c.sessionId)beginCombatSession(s,c,{legacy:true});
 if(c?.status==='active'&&(Number.isSafeInteger(c.journeyId)||c.sessionId)){
  syncCombatBodyProjection(s,c);
  if(c.player.hp<=0)throw Error('战斗掌门伤势已达倒下界限，须先推进世界步完成结算');
  const id=c.sessionId,session=s.combatSessionsById?.[id],actors=combatActors(c),ids=actors.map(a=>a.personId);
  if(id!==`combat:campaign:${c.journeyId}`||c.player.personId!=='person:master'||!session||session.phase!=='active'||JSON.stringify(session.participantIds)!==JSON.stringify(ids))throw Error('战斗会话引用异常：'+id);
  for(const actor of actors){const person=s.personsById[actor.personId],activity=ownedActivity(s,person);
   if(!person||person.combatSessionId!==id||!activity||activity.kind!=='sr-combat'||activity.orderId!==id||person.activityId!==activity.id||actor.hp!==projectedCombatHp(person,actor.maxHp))throw Error('战斗人物身体/伤势引用异常：'+actor.personId);
  }
  if(r.pending&&ownedActivity(s,s.master)?.actionId!==r.pending.id)throw Error('战斗招式与身体活动引用异常');
 }
 for(const [id,session]of Object.entries(s.combatSessionsById||{}))if(session.phase==='active'&&(c?.status!=='active'||id!==c.sessionId))throw Error('活跃战斗会话悬空：'+id);
 for(const person of Object.values(s.personsById||{}))if(person.combatSessionId&&(!c||c.status!=='active'||person.combatSessionId!==c.sessionId))throw Error('人物战斗会话悬空：'+person.personId);
 return true;
}
export const combatHandlers={srCombatAction,cancelSRCombatAction,setCombatTactic};

// R/T balance: no inferred realm for unnamed actors, same-tier techniques retain their own differences.
export const REALM_GAP_BALANCE=Object.freeze({multiplierPerTier:1.6,minimum:.1,maximum:10});
function actualCombatRealm(s,actor){if(actor===s.combat?.player)return s.master.realm;const person=actor?.personId&&s.personsById[actor.personId];if(person&&Number.isSafeInteger(person.realm)&&person.realm>=1)return descentEffectiveRealmSR(s,person);const realm=actor?.realm??actor?.srMoves?.realm;return Number.isSafeInteger(realm)&&realm>=1&&realm<=30?realm:null;}
export function realmGapCombatMultiplier(s,source,target){const from=actualCombatRealm(s,source),to=actualCombatRealm(s,target);if(from===null||to===null)return 1;const gap=realmTier(from)-realmTier(to);return Math.max(REALM_GAP_BALANCE.minimum,Math.min(REALM_GAP_BALANCE.maximum,REALM_GAP_BALANCE.multiplierPerTier**gap));}
