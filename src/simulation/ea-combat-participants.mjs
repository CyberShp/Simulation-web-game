/** T-COMBAT-PARTY-20261024: finite ordinary encounter actors. */
const GUARD_VISUAL_IDENTITIES=Object.freeze({'combatant:rescue:enemy-1':'prison-guard-armored','combatant:rescue:enemy-2':'prison-guard-cloth'});
/** Existing saves derive only these exact persistent identities, without mutation. */
export const encounterCombatantVisualIdentity=(s,actor)=>s.world?.encounterCombatantsById?.[actor.combatantId]?.visualIdentity||GUARD_VISUAL_IDENTITIES[actor.combatantId]||null;
export const encounterCombatantId=(encounterId,configId)=>`combatant:${encounterId}:${configId}`;
export function ensureEncounterCombatants(s,c){
 if(s.contentVersion!=='sr-content-v1.2')return;
 const records=s.world.encounterCombatantsById??={};
 for(const actor of c.enemies.filter(a=>!a.personId)){
  const configId=actor.configId||actor.id,id=encounterCombatantId(c.encounterId,configId);
  actor.configId=configId;actor.combatantId=id;
  records[id]??={id,encounterId:c.encounterId,configId,name:actor.name,maxHp:actor.maxHp,wound:100*(1-actor.hp/actor.maxHp),lifeStatus:'alive',createdTick:s.worldTick,source:'T-COMBAT-PARTY-20261024'};
  const record=records[id];if(!record.visualIdentity&&GUARD_VISUAL_IDENTITIES[id])record.visualIdentity=GUARD_VISUAL_IDENTITIES[id];if(record.visualIdentity)actor.visualIdentity=record.visualIdentity;actor.maxHp=record.maxHp;actor.hp=encounterCombatantHp(record);
 }
}
export function encounterCombatantHp(record){return record.lifeStatus==='dead'||record.wound>=100?0:Math.max(1,Math.round(record.maxHp*(1-record.wound/100)));}
export function setEncounterCombatantHp(s,actor,hp){
 const record=s.world?.encounterCombatantsById?.[actor.combatantId];if(!record)return null;
 actor.hp=record.lifeStatus==='dead'?0:Math.max(0,Math.min(record.maxHp,Math.round(hp)));
 record.wound=100*(1-actor.hp/record.maxHp);return actor.hp;
}
export function settleEncounterCombatantDeaths(s,c){
 for(const actor of c.enemies){
  const record=s.world?.encounterCombatantsById?.[actor.combatantId];if(!record||actor.hp>0||record.lifeStatus==='dead')continue;
  const id=`fact:death:${record.id}`;
  s.factsById[id]??={id,kind:'encounter-combatant-death',combatantId:record.id,encounterId:c.encounterId,...(c.sessionId?{sessionId:c.sessionId}:{}),atTick:s.combatSessionsById?.[c.sessionId]?.endedTick??s.worldTick,sceneId:c.sceneFrame?.sceneId||`scene:${c.regionId}`,...(record.location?{position:{x:record.location.x,y:record.location.y}}:{}),text:`${record.name}在实际斗法中身死，原身份与结果保留。`};
  record.lifeStatus='dead';record.wound=100;record.deathFactId=id;
 }
}
export function validateEncounterCombatants(s){
 for(const [id,record]of Object.entries(s.world?.encounterCombatantsById||{})){
  if(record.id!==id||id!==encounterCombatantId(record.encounterId,record.configId)||typeof record.name!=='string'||!Number.isFinite(record.maxHp)||record.maxHp<=0||record.maxHp>1000||!Number.isFinite(record.wound)||record.wound<0||record.wound>100||!['alive','dead'].includes(record.lifeStatus)||!Number.isSafeInteger(record.createdTick)||record.createdTick<0||record.createdTick>s.worldTick||record.source!=='T-COMBAT-PARTY-20261024')throw Error('普通战斗人物身份或伤势记录异常。');
  if(record.visualIdentity!==undefined&&(typeof record.visualIdentity!=='string'||!record.visualIdentity))throw Error('普通战斗人物显示身份异常。');
  const fact=s.factsById[record.deathFactId];if(record.lifeStatus==='dead'&&(!fact||fact.kind!=='encounter-combatant-death'||fact.combatantId!==id||record.wound!==100))throw Error('普通战斗人物死亡事实异常。');
  if(record.location&&(record.location.kind!=='local'||!s.scenesById[record.location.sceneId]||!Number.isFinite(record.location.x)||!Number.isFinite(record.location.y)))throw Error('普通战斗人物真实位置异常。');
 }
}
