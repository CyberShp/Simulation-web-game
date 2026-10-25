/** U-172 finite shared herb budget:119 existing plus a real six-herb journey. */
import {createDiscipleAdvancementScenario} from './disciple-advancement.mjs';
import {validateSect} from '../../apps/courtyard/sect-sim.mjs';
export const EXPEDITION_ADVANCEMENT_SCENARIO=Object.freeze({id:'expedition-advancement-v1',maxWorldSteps:10000,requiredHerb:125,initialPublicHerb:119});
export function createExpeditionAdvancementScenario({condition='ready'}={}){
 if(!['ready','empty-patch'].includes(condition))throw Error('Invalid expedition advancement condition');
 const f=createDiscipleAdvancementScenario(),{session}=f,s=session.state,target=s.personsById[f.targetId];
 s.stockpilesById[f.siteStockpileId].resources.herb=69;s.resources.herb=50;s.resources.jade=600;
 s.stockpilesById['stockpile:building:yunxiu:2'].resources.herb=0;s.stockpilesById['stockpile:building:yunxiu:80'].resources.herb=0;
 target.mind.goal='草木药用，安稳生活';target.mind.traits=[70,50,50,80,30];
 const patch='object:valley:herbs';if(condition==='empty-patch'){s.srWorld.resourcePatches??={};s.srWorld.resourcePatches[patch]=0;}const initialPatch=s.srWorld.resourcePatches?.[patch]??18;
 const stocks=Object.values(s.stockpilesById).filter(st=>st.access==='public'&&st.ownerId===s.stockpilesById[f.sourceStockpileId].ownerId&&!st.carrierId);
 const initialPublicHerb=stocks.reduce((q,st)=>q+(st.resources.herb||0),0);if(initialPublicHerb!==119)throw Error('Initial public herb budget must be119');
 validateSect(session);
 return{...f,session,state:s,s,travellerId:f.targetId,preparationRequest:{type:'prepare-disciple-craft',personId:f.alchemistId,recipeId:'foundation',buildingId:f.buildingId},metadata:{id:EXPEDITION_ADVANCEMENT_SCENARIO.id,condition,startTick:s.worldTick,alchemistId:f.alchemistId,targetId:f.targetId,travellerId:f.targetId,buildingId:f.buildingId,siteStockpileId:f.siteStockpileId,sourceStockpileId:f.sourceStockpileId,
  conditions:{roles:{alchemist:structuredClone(f.metadata.conditions.alchemist),target:{...structuredClone(f.metadata.conditions.target),traits:[...target.mind.traits],goal:target.mind.goal}},publicResources:structuredClone(s.resources),siteMaterials:structuredClone(s.stockpilesById[f.siteStockpileId].resources),masterPosition:structuredClone(s.master.position),completedCanonicalGC26:structuredClone(s.buildingsById[f.buildingId].transform),pillRule:s.doctrine.pillRule,siteHerb:69,homeHerb:50,initialPublicHerb,requiredHerb:{craft:75,breakthrough:50,total:125,shortfall:6},herbStocks:stocks.map(st=>({id:st.id,herb:st.resources.herb||0})),farmSeed:0,publicJade:600,travellerTraits:target.mind.traits,travellerGoal:target.mind.goal,initialValleyHerb:initialPatch,foe:structuredClone(s.personsById['person:valley-shanxiao'].location),publicHerbFungible:true},
  scope:'Two residents; the advancement target also chooses a real supply journey.119 existing public herbs are six short of the75-herb recipe plus50-herb breakthrough. Player requests preparation after actual return, then the shared stock is physically transported. Resources are fungible; the test does not assign identities to individual herbs. No seed allows an unrelated farm batch to fill the gap.'}};
}
