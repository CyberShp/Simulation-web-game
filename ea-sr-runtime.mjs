/** Integration owner: one world clock, one atomic command gateway. */
import * as base from './ea-sim.mjs?v=ea-160-courtyard-20261008-r23';
import {initContracts,validateContracts} from './ea-sr-contracts.mjs?v=ea-160-courtyard-20261008-r23';
import * as spatial from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r23';
import * as economy from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r23';
import * as persons from './ea-sr-persons.mjs?v=ea-160-courtyard-20261008-r23';
import * as weather from './ea-sr-weather.mjs?v=ea-160-courtyard-20261008-r23';
import * as organization from './ea-sr-organization.mjs?v=ea-160-courtyard-20261008-r23';
import * as equipment from './ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r23';
import * as cultivation from './ea-sr-cultivation.mjs?v=ea-160-courtyard-20261008-r23';
import * as combat from './ea-sr-combat.mjs?v=ea-160-courtyard-20261008-r23';
import * as covenants from './ea-sr-covenants.mjs?v=ea-160-courtyard-20261008-r23';
import * as mother from './ea-sr-mother-chain.mjs?v=ea-160-courtyard-20261008-r23';
import * as world from './ea-sr-world.mjs?v=ea-160-courtyard-20261008-r23';
import * as crises from './ea-sr-crises.mjs?v=ea-160-courtyard-20261008-r23';
import * as story from './ea-sr-story.mjs?v=ea-160-courtyard-20261008-r23';
import * as descent from './ea-sr-descent.mjs?v=ea-160-courtyard-20261008-r23';
import * as lateEconomy from './ea-sr-late-economy.mjs?v=ea-160-courtyard-20261008-r23';
import {localIndustryCombatDamageSR} from './ea-sr-world-content.mjs?v=ea-160-courtyard-20261008-r23';
import {configureCampaign} from './ea-campaign.mjs?v=ea-160-courtyard-20261008-r23';
export const srEnabled=s=>s.contentVersion==='sr-content-v1.2';
combat.configureSRCombat({execute:(s,id,target)=>id==='move'?base.combatAction(s,id,target):combat.executeSpatialCombatAction(s,id,target,base.combatAction)});
crises.configureSRCrises({onPermanentDeath:economy.settleEconomyDeath});
mother.configureMotherChain({createCrisis:crises.createMotherCrisisSR,resolveCrisis:crises.resolveMotherCrisisSR,onCriticalOutcome:crises.motherCriticalOutcomeSR});
configureCampaign({enemyCombatConfig:(s,id)=>srEnabled(s)?combat.ENEMY_COMBAT_CONFIG[id]:null,companionTactic:(s)=>srEnabled(s)?s.srCombat?.tactic||'guard':null,incomingDamage:(s,c,source,target,amount,kind)=>srEnabled(s)?localIndustryCombatDamageSR(s,c,source,target,amount*combat.outgoingCombatMultiplier(s,source,kind)*combat.incomingCombatMultiplier(s,target)*combat.realmGapCombatMultiplier(s,source,target),kind):amount,onEffectiveDamage:(s,c,source,target,amount,kind)=>{if(!srEnabled(s)||!source.personId||source.personId==='person:master')return;const p=s.personsById[source.personId];if(!p||p.lifeStatus!=='alive')return;const artId=p.mind?.main||p.main;if(artId)cultivation.recordArtPractice(s,p.personId,artId,{eventId:`combat:${s.srCombat.battleId||c.encounterId}:${c.nextEffectId}:${p.personId}`,difficulty:1,effective:amount>0});}});
cultivation.configureCultivation({breakthroughCost:base.breakthroughCost,onBreakthroughRefining:mother.activateMotherBreakthrough,canCompleteBreakthrough:(s,p,a)=>!mother.motherBlocksBreakthrough(s,p,a),onLifespanExhausted:(s,p)=>{if(p.personId!=='person:master')crises.recordPermanentDeathSR(s,p.personId,{cause:'有限寿元耗尽'});else{s.speed=0;base.log(s,'寿元已到有限界限，此卷暂停并保留；掌门永久死亡与删档规则尚未启用。');}}});
export function initSR(s,{newGame=false}={}){
 if(srEnabled(s)){spatial.initBuildingGrid(s);combat.initSRCombat(s);economy.initEconomy(s);world.hydrateSRWorld(s);economy.initPillInventory(s);cultivation.initCultivation(s);persons.initPersons(s);descent.initDescentSR(s);lateEconomy.initLateEconomy(s);return s;}
 initContracts(s,{activate:true});spatial.initSpatial(s);spatial.initBuildingGrid(s);
 world.initSRWorld(s,base.addDisciple);crises.initSRCrises(s,base.addDisciple);story.initSRStory(s,base.addDisciple);
 economy.initEconomy(s);persons.initPersons(s);weather.initWeather(s);organization.initOrganization(s);
 equipment.initEquipment(s,{newGame});cultivation.initCultivation(s);combat.initSRCombat(s);covenants.initCovenants(s);mother.initMotherChain(s,{addPerson:base.addDisciple});
 for(const p of Object.values(s.personsById))if(p.compatibilityMode!=='historical-only')world.hydrateWorldPositionSR(s,p);economy.initPillInventory(s);descent.initDescentSR(s);lateEconomy.initLateEconomy(s);return s;
}
export function validateSR(s){
 economy.initEconomy(s);
 world.hydrateSRWorld(s);
 economy.initPillInventory(s);cultivation.initCultivation(s);persons.initPersons(s);descent.initDescentSR(s);lateEconomy.initLateEconomy(s);
 validateContracts(s);spatial.validateSpatial(s);economy.validateEconomy(s);persons.validatePersons(s);weather.validateWeather(s);organization.validateOrganization(s);
 equipment.validateEquipment(s);cultivation.validateCultivation(s);combat.validateSRCombat(s);covenants.validateCovenants(s);mother.validateMotherChain(s);world.validateSRWorld(s);crises.validateSRCrises(s);story.validateSRStory(s);descent.validateDescentSR(s);lateEconomy.validateLateEconomy(s);return s;
}
export function beforeSRSecond(s){weather.tickWeather(s);}
export function tickSR(s){
 spatial.tickSpatial(s);economy.tickEconomy(s);persons.tickPersons(s);organization.tickOrganization(s);
 equipment.tickEquipment(s);cultivation.tickCultivation(s);combat.tickSRCombat(s);covenants.tickCovenants(s);mother.tickMotherChain(s);
 world.tickSRWorld(s);crises.tickSRCrises(s);story.tickSRStory(s);descent.tickDescentSR(s);lateEconomy.tickLateEconomy(s);
}
export const SR_HANDLERS={...spatial.handlers,...economy.economyHandlers,...persons.personsHandlers,...weather.weatherHandlers,...organization.organizationHandlers,...equipment.equipmentHandlers,...cultivation.cultivationHandlers,...combat.combatHandlers,...covenants.covenantHandlers,...mother.motherHandlers,...descent.descentHandlers,...lateEconomy.lateEconomyHandlers,
 srWorldCommand:world.srWorldCommand,srCrisisCommand:crises.srCrisisCommand,srStoryCommand:story.srStoryCommand,
 craft:economy.craftSR,craftPill:economy.craftSR,cancelCraft:economy.cancelCraftSR,
 preparePillUse:(s,id,personId='person:master')=>{if(personId!=='person:master')throw Error('掌门只能亲自取药；门人按取用约定自主取药。');return economy.preparePillUse(s,id,personId);},
 masterAction:(s,action)=>{if(['wood','stone','herb','food'].includes(action))return economy.startMasterHarvest(s,action);if(action==='teach'){const lecture=cultivation.prepareLectureSR(s);return base.masterTeach(s,lecture.artId);}return base.masterAction(s,action);},
 returnToBasics:(s)=>cultivation.retrainArt(s,'qingyuan'),
 startExploration:(s,id,companions=[])=>world.srWorldCommand(s,{action:'travel',destination:`scene:${id}`,companions:companions.map(id=>s.disciples.find(p=>p.id===id)?.personId||id)}),
 startMasterTravel:(s,id)=>world.srWorldCommand(s,{action:'travel',destination:id==='valley'?'scene:valley':id==='lake'?'scene:ruins':`scene:${id}`}),
 moveExploration:(s,x,y)=>world.srWorldCommand(s,{action:'move',x,y}),
 cancelMasterTravel:(s)=>world.srWorldCommand(s,{action:'return'}),
 leaveRegion:(s)=>world.srWorldCommand(s,{action:'travel',destination:'scene:yunxiu-courtyard'}),
 resolveExploration:()=>{throw Error('请在当前地点走近具体对象并选择行动。');},resolveMasterEncounter:()=>{throw Error('请在当前地点选择实际行动。');},
 masterStudy:cultivation.studyArt,masterBreakthrough:cultivation.beginBreakthrough,masterRiskBreakthrough:cultivation.beginBreakthrough,masterTeach:cultivation.teachArt,combatAction:combat.srCombatAction,
 acknowledgeCombat:s=>{if(s.combat?.status&&s.combat.status!=='active')story.tickSRStory(s);return base.acknowledgeCombat(s);},
 foundSect:organization.foundSectSR,inviteOffice:organization.inviteOfficeSR,foundPeak:organization.foundPeakSR,setSocietyPolicy:organization.policySR,setPolicy:organization.policySR,
 trade:economy.marketTrade,fulfill:(s,id)=>economy.marketOrder(s,id,'deliver')};
export const SR_BODY_COMMANDS=new Set(['build','upgrade','relocate','demolish','masterStudy','masterBreakthrough','masterRiskBreakthrough','masterTeach','combatAction','srWorldCommand','srCrisisCommand','srStoryCommand',...Object.keys(cultivation.cultivationHandlers),...Object.keys(equipment.equipmentHandlers),...Object.keys(covenants.covenantHandlers),...Object.keys(mother.motherHandlers),...Object.keys(descent.descentHandlers),...Object.keys(lateEconomy.lateEconomyHandlers),'craftSR','craftPill','craft','preparePillUse','startTransport','replenishPatch','startMasterHarvest','improveDrainage','transferProperty','marketTrade','marketOrder','returnToBasics','forgetSupport','masterPill','startExploration','startMasterTravel','moveExploration','leaveRegion']);
