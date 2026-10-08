/** SR-XF-009/010/011. U-63 author defaults (R/T), one world clock and one resource authority. */
import {RESOURCES,GOODS,BUILDINGS,RECIPES,TECHNIQUES} from './ea-data.mjs?v=ea-160-courtyard-20261008-r35';
import {buildingAccess,scenicFindPath,scenicDistance,geometryRevision,scenicNearest} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r35';
import {advanceScenic,syncScenicPosition} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r35';
import {facilitySlots,slotReservation} from './ea-facility-slots.mjs?v=ea-160-courtyard-20261008-r35';
import {cloneState,hydrateState} from './ea-state-v6.mjs?v=ea-160-courtyard-20261008-r35';
import {CLIMATE,weatherModifiers} from './ea-sr-weather.mjs?v=ea-160-courtyard-20261008-r35';
import {travelPreviewSR,travelSR} from './ea-sr-world.mjs?v=ea-160-courtyard-20261008-r35';
const zeros=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
const MARKET_SUPPLY_VERSION='market-supply:physical:v1',MARKET_SUPPLIER='person:qingxi-supply-clerk',MARKET_CARRIER='person:qingxi-hauler';
const MARKET_SUPPLIER_STOCK='stockpile:qingxi-supplier',MARKET_SUPPLIER_WALLET='stockpile:qingxi-supplier-wallet',MARKET_TOLL_STOCK='stockpile:chizhang-market-toll';
const marketSupplyStockpile=id=>id===MARKET_SUPPLIER_STOCK||id===MARKET_SUPPLIER_WALLET||id===MARKET_TOLL_STOCK||typeof id==='string'&&id.startsWith('stockpile:market-supply:');
const MARKET_SOURCE_GOODS=['food','wood','stone','herb','crystal'];
const MARKET_SUPPLY_OUT=['route:valley-market','route:bridge','route:quarry-supply'];
const MARKET_SUPPLY_BACK=[...MARKET_SUPPLY_OUT].reverse();
const MARKET_ROUTE_TICKS={'route:valley-market':100,'route:bridge':90,'route:quarry-supply':110};
const body=(s,p)=>p===s.master?p:p.mind;
const close=(s,a,b)=>scenicDistance(a,b)<(s.spatial?.version==='spatial-metres-1'?.12:4);
const copy=v=>structuredClone(v);
const fail=m=>{throw Error(m);};
export const WHOLESALE_DEFINITION={id:'wholesale:qingxi:v1',source:'U-63/R-25/T-04 author finite regional trade budget',periodTicks:2400,periodBudget:1200,lifetimeTreasury:90000,maximumUnitsPerGood:40,toolkitMargin:1.1};
export const ECONOMY_DEFINITION={id:'economy:yunxiu:v1',source:'U-63/R-25/T-04',units:'resource units; fractional legacy balances retained',capacity:2400,carryCapacity:40,replenishTicks:150,recipes:Object.fromEntries(Object.entries(BUILDINGS).filter(([,b])=>b.work).map(([id,b])=>[id,{id:`recipe:${id}:v1`,durationTicks:b.duration*10,input:copy(b.input||{}),output:copy(b.out),capacity:'exclusive declared facility slots',cancel:'unworked proportion returned exactly once',skill:id==='farm'?'plant':'industry'}]))};
export const FARM_CROP_RECIPE={recipeId:'recipe:farm',recipeVersion:'herb-crop:yunxiu:v1',seedCost:{herb:2},maturityRequiredTicks:10,careRequired:200,contributionPerWorker:10,output:{herb:12},skill:'plant'};
export const FARM_V1_RECIPE={recipeId:'recipe:farm:v1',recipeVersion:'economy:yunxiu:v1',inputCost:{},durationUnit:'contribution',durationValue:200,outputDefinition:{herb:12},skillRuleVersion:'production-skill:v1'};
// Keep the shipped v1 definitions independent of later BUILDINGS tuning so a
// paid, active batch can be checked against the rules that opened it.
const freezeRecipes=rows=>Object.freeze(Object.fromEntries(Object.entries(rows).map(([id,row])=>[id,Object.freeze({...row,inputCost:Object.freeze({...row.inputCost}),outputDefinition:Object.freeze({...row.outputDefinition})})])));
export const PRODUCTION_RECIPES_V1=freezeRecipes({
 farm:{inputCost:{},outputDefinition:{herb:12},durationValue:200,skill:'plant'},
 lumber:{inputCost:{},outputDefinition:{wood:18},durationValue:200,skill:'industry'},
 quarry:{inputCost:{},outputDefinition:{stone:16},durationValue:200,skill:'industry'},
 meditation:{inputCost:{},outputDefinition:{},durationValue:200,skill:'industry'},
 library:{inputCost:{},outputDefinition:{insight:6},durationValue:200,skill:'learning'},
 well:{inputCost:{},outputDefinition:{crystal:4},durationValue:200,skill:'array'},
 granary:{inputCost:{},outputDefinition:{food:22},durationValue:200,skill:'plant'},
 workshop:{inputCost:{wood:3,stone:2},outputDefinition:{jade:24},durationValue:200,skill:'industry'}
});
export const PRODUCTION_RECIPE_VERSION='supply-recipes:yunxiu:v2';
export const PILL_RECIPE_VERSION='supply-recipes:yunxiu:v2';
const PILL_RECIPES_V1=Object.freeze(Object.fromEntries(Object.entries({
 qi:{cost:{jade:15,herb:12},duration:25,yield:2,realm:1,effect:{xp:70,energy:0,wound:0}},
 spirit:{cost:{jade:30,herb:22,crystal:2},duration:35,yield:2,realm:6,effect:{xp:120,energy:45,wound:0}},
 heal:{cost:{jade:10,herb:10},duration:20,yield:2,realm:1,effect:{xp:0,energy:15,wound:25}},
 foundation:{cost:{jade:180,herb:75,crystal:12,insight:15},duration:70,yield:1,realm:9,knowledge:'alchemy',mastery:35,effect:{xp:0,energy:0,wound:0}}
}).map(([id,row])=>[id,Object.freeze({...row,cost:Object.freeze({...row.cost}),effect:Object.freeze({...row.effect})})])));
const PILL_RECIPE_CATALOG=Object.freeze({'pill-recipes:yunxiu:v1':PILL_RECIPES_V1,[PILL_RECIPE_VERSION]:PILL_RECIPES_V1});
const pillDurationAtLevel=(row,level)=>Math.ceil(row.duration*10/(1+.25*(level-1)));
function pillRecipeSnapshot(s,b,id,{version=PILL_RECIPE_VERSION,cost=null,yieldCount=null,durationTicks=null,createdTick=s.worldTick}={}){
 const row=PILL_RECIPE_CATALOG[version]?.[id];if(!row)fail('丹方版本不存在。');
 const inputCost=copy(cost||row.cost);
 return {recipeId:id,recipeVersion:version,inputCost,sourceStockpileIds:Object.fromEntries(Object.keys(inputCost).map(k=>[k,['jade','insight'].includes(k)?'stockpile:yunxiu':`stockpile:${b.instanceId}`])),outputCount:yieldCount??row.yield,effectDefinition:copy(row.effect),durationUnit:'world-tick',durationTicks:durationTicks??pillDurationAtLevel(row,b.level),buildingLevel:b.level,workstationRule:'facility:alchemy:exclusive-slot',realmGate:row.realm,knowledgeGate:row.knowledge||null,masteryGate:row.mastery||0,createdTick};
}
function upgradePillRecipeSnapshots(s){
 for(const w of Object.values(s.workOrdersById||{}))if(w.kind==='sr-crafting'&&!w.recipeSnapshot){
  const b=s.buildingsById[w.targetId];if(!b||!PILL_RECIPES_V1[w.recipeId]||w.recipeVersion!=='pill-recipes:yunxiu:v1')fail('旧丹炉工单版本或设施异常。');
  w.recipeSnapshot=pillRecipeSnapshot(s,b,w.recipeId,{version:'pill-recipes:yunxiu:v1',cost:w.cost,yieldCount:w.yield,durationTicks:w.durationTicks,createdTick:w.startedTick??0});
  if(!w.legacyPaid){
   const level=Array.from({length:b.level},(_,index)=>index+1).find(value=>pillDurationAtLevel(PILL_RECIPES_V1[w.recipeId],value)===w.durationTicks);
   if(!level)fail('旧丹炉工单用时异常。');
   w.recipeSnapshot.buildingLevel=level;
  }
 }
}
const sameFields=(a,b)=>!!a&&!!b&&!Array.isArray(a)&&!Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&b[k]===v);
function validatePillRecipeSnapshot(s,w){
 const snap=w.recipeSnapshot,row=PILL_RECIPE_CATALOG[snap?.recipeVersion]?.[w.recipeId],b=s.buildingsById[w.targetId];
 if(!row||!b||b.type!=='alchemy')fail('丹炉配方快照异常。');
 const expectedSources=pillRecipeSnapshot(s,b,w.recipeId,{version:snap.recipeVersion,cost:w.cost}).sourceStockpileIds;
 const invalid=snap.recipeId!==w.recipeId||snap.recipeVersion!==w.recipeVersion||
  snap.durationUnit!=='world-tick'||snap.workstationRule!=='facility:alchemy:exclusive-slot'||
  !Number.isSafeInteger(snap.buildingLevel)||snap.buildingLevel<1||snap.buildingLevel>b.level||
  !Number.isSafeInteger(snap.createdTick)||snap.createdTick<0||snap.createdTick>s.worldTick||snap.createdTick!==(w.startedTick??0)||
  snap.realmGate!==row.realm||snap.knowledgeGate!==(row.knowledge||null)||snap.masteryGate!==(row.mastery||0)||
  snap.durationTicks!==w.durationTicks||snap.outputCount!==w.yield||
  !sameFields(snap.inputCost,w.cost)||!sameFields(snap.inputCost,row.cost)||
  !sameFields(snap.effectDefinition,row.effect)||
  !sameFields(snap.sourceStockpileIds,w.sourceStockpileIds)||
  !sameFields(snap.sourceStockpileIds,expectedSources);
 if(invalid)fail('丹炉配方快照异常。');
 if(snap.recipeVersion===PILL_RECIPE_VERSION&&(snap.outputCount!==row.yield||snap.durationTicks!==pillDurationAtLevel(row,snap.buildingLevel)))fail('丹炉配方快照异常。');
 if(snap.recipeVersion==='pill-recipes:yunxiu:v1'&&(!w.legacyPaid&&(snap.outputCount!==row.yield||snap.durationTicks!==pillDurationAtLevel(row,snap.buildingLevel))||w.legacyPaid&&![1,row.yield].includes(snap.outputCount)))fail('旧丹炉配方快照异常。');
}
function validCompletedPillFact(s,w){
 const fact=s.factsById[`fact:craft:${w.id}`],oldVersion=w.recipeVersion==='pill-recipes:yunxiu:v1';
 return w.resultFactId===`fact:craft:${w.id}`&&fact?.id===w.resultFactId&&
  fact.kind==='inventory-transaction'&&fact.operation==='pill-production'&&
  fact.workOrderId===w.id&&fact.actorId===w.personId&&
  fact.recipeId===w.recipeId&&fact.quantity===w.recipeSnapshot.outputCount&&
  fact.count===w.recipeSnapshot.outputCount&&sameFields(fact.cost,w.recipeSnapshot.inputCost)&&
  (fact.recipeVersion===w.recipeVersion||oldVersion&&fact.recipeVersion===undefined)&&
  (fact.targetStockpileId===`stockpile:${w.targetId}`||oldVersion&&fact.targetStockpileId===undefined)&&
  fact.atTick===w.finishedTick;
}
function validCancelledPillFact(s,w){
 const fact=s.factsById[`fact:craft-cancel:${w.id}`],expected={},oldVersion=w.recipeVersion==='pill-recipes:yunxiu:v1';
 for(const [key,quantity] of Object.entries(w.recipeSnapshot.inputCost))expected[key]=quantity*(1-w.progressTicks/w.durationTicks);
 const sameAmounts=actual=>!!actual&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,quantity])=>Number.isFinite(actual[key])&&Math.abs(actual[key]-quantity)<1e-8);
 if(fact?.id!==`fact:craft-cancel:${w.id}`||fact.kind!=='inventory-transaction'||fact.operation!=='craft-cancel'||fact.workOrderId!==w.id||fact.actorId!==w.personId||fact.atTick!==w.finishedTick||!sameAmounts(w.refund)||!sameAmounts(fact.refund))return false;
 if(w.cancelRecordVersion===undefined)return oldVersion&&w.refundStockpileIds===undefined&&fact.refundStockpileIds===undefined&&w.refundTemporaryPlacements===undefined&&fact.refundTemporaryPlacements===undefined;
 if(w.cancelRecordVersion!=='craft-cancel:v2'||!sameFields(w.refundStockpileIds,fact.refundStockpileIds)||JSON.stringify(w.refundTemporaryPlacements)!==JSON.stringify(fact.refundTemporaryPlacements)||!w.refundTemporaryPlacements)return false;
 return Object.keys(expected).every(key=>{
  const destination=w.refundStockpileIds[key],source=s.stockpilesById[w.sourceStockpileIds[key]],place=s.stockpilesById[destination];
  if(!source||!place||place.ownerId!==source.ownerId||place.access!==source.access)return false;
  if(destination===source.id)return !w.refundTemporaryPlacements[key];
  const placement=w.refundTemporaryPlacements[key];
  return destination===`stockpile:craft-refund:${w.id}:${key}`&&place.sourceStockpileId===source.id&&total(place)<=place.capacity+1e-8&&
   placement?.custodianId===place.custodianId&&JSON.stringify(placement.position)===JSON.stringify(place.position);
 });
}
// A later tune adds a new catalogue/version; existing entries are never edited.
const PRODUCTION_RECIPE_CATALOG=Object.freeze({'economy:yunxiu:v1':PRODUCTION_RECIPES_V1,[PRODUCTION_RECIPE_VERSION]:PRODUCTION_RECIPES_V1});
export function productionRecipeDefinition(version,type){return PRODUCTION_RECIPE_CATALOG[version]?.[type]||null;}
export function productionRecipeSnapshot(s,b,version=PRODUCTION_RECIPE_VERSION){
 const recipe=productionRecipeDefinition(version,b.type),siteId=`stockpile:${b.instanceId}`;
 if(!recipe)fail('生产配方不存在。');
 return {recipeId:`recipe:${b.type}`,recipeVersion:version,inputCost:copy(recipe.inputCost),durationUnit:'contribution',durationValue:recipe.durationValue,outputDefinition:copy(recipe.outputDefinition),outputRuleVersion:'production-yield:v1',skillRuleVersion:'production-skill:v1',skillKey:recipe.skill,skillGate:0,workstationRule:`facility:${b.type}:exclusive-slots`,sourceStockpileIds:Object.fromEntries(Object.keys(recipe.inputCost).map(k=>[k,siteId])),ownerId:'person:master',createdTick:s.worldTick};
}
export function farmWaterlogged(s){return (s.ecologiesBySceneId?.['scene:yunxiu-courtyard']?.surfaceZones?.['zone:yard-path']?.wetness||0)>CLIMATE.floodThreshold;}
export function advanceFarmCrops(s){for(const order of Object.values(s.workOrdersById||{})){
 if(order.kind!=='production'||order.recipeSnapshot?.recipeVersion!==FARM_CROP_RECIPE.recipeVersion||!order.crop||order.phase==='completed')continue;
 const crop=order.crop,b=s.buildingsById[order.targetId];if(!b||b.type!=='farm')continue;
 if(s.worldTick<=crop.sownAtTick)continue;
 if(b.enabled===false||b.condition<=0||b.spatialLock){crop.phase='paused:facility';crop.weatherPauseReason=null;continue;}
 if(farmWaterlogged(s)){crop.phase='paused:waterlogged';crop.weatherPauseReason='waterlogged';continue;}
 crop.weatherPauseReason=null;
 if(crop.growthElapsedTicks<crop.maturityRequiredTicks){crop.growthElapsedTicks++;if(crop.growthElapsedTicks===crop.maturityRequiredTicks)crop.maturedAtTick=s.worldTick;}
 crop.phase=crop.maturedAtTick===null?'growing':crop.careContribution>=order.durationTicks?'ripe/waiting':'mature';
 }}
function stock(s,id){return s.stockpilesById[id]||fail('仓储不存在。');}
function personScene(s,p){if(p.location?.kind==='travel'||p.position?.kind==='worldTravel')return null;return p.location?.sceneId||p.position?.sceneId||'scene:yunxiu-courtyard';}
function atHome(s,p){return personScene(s,p)==='scene:yunxiu-courtyard'&&!body(s,p).away&&!body(s,p).journey&&p.lifeStatus!=='dead';}
function personFeet(s,p){return personScene(s,p)!=='scene:yunxiu-courtyard'?p.location?.kind==='local'?p.location:p.position:body(s,p).scenic||p.position;}
function position(s,st){if(marketSupplyStockpile(st.id))return st.position;if(st.carrierId&&s.personsById[st.carrierId]){const p=s.personsById[st.carrierId],sceneId=personScene(s,p);if(!sceneId)return {kind:'travel',travelId:p.location?.travelId||p.position?.travelId};return {sceneId,x:personFeet(s,p).x,y:personFeet(s,p).y};}return st.buildingId&&s.buildingsById[st.buildingId]?{sceneId:s.buildingsById[st.buildingId].sceneId||'scene:yunxiu-courtyard',...buildingAccess(s,s.buildingsById[st.buildingId])}:st.position;}
function stockAccess(s,st){const anchor=position(s,st);if(!anchor||anchor.sceneId!=='scene:yunxiu-courtyard')return null;return scenicNearest(s,anchor,{maxDistance:s.spatial?.version==='spatial-metres-1'?1.5:48});}
function total(st){return Object.values(st.resources).reduce((a,b)=>a+b,0)+Object.values(st.pills||{}).reduce((a,b)=>a+b,0);}
// SR-XF-009/010: a dose has exactly one physical stock or reserved allocation.
const pillZeros=()=>Object.fromEntries(Object.keys(RECIPES).map(id=>[id,0]));
const pillId=k=>typeof k==='string'&&k.startsWith('pill:')?k.slice(5):null;
const legalCargoKey=k=>!!RESOURCES[k]||!!RECIPES[pillId(k)];
const physicalTransportKey=k=>k!=='insight'&&legalCargoKey(k);
const physicalOutputTotal=(b,out)=>Object.entries(out).reduce((sum,[k,quantity])=>sum+(b.type==='library'&&k==='insight'?0:quantity),0);
function cargoBin(st,k){return pillId(k)?(st.pills??=pillZeros()):st.resources;}
function cargoAmount(st,k){return cargoBin(st,k)[pillId(k)||k]||0;}
function changeCargo(st,k,delta){const bin=cargoBin(st,k),id=pillId(k)||k;bin[id]=Math.max(0,(bin[id]||0)+delta);}
function pillTotals(s,{publicOnly=false}={}){const result=pillZeros();for(const st of Object.values(s.stockpilesById||{})){if(publicOnly&&st.access!=='public'&&st.ownerId!=='person:master')continue;for(const id of Object.keys(RECIPES))result[id]+=st.pills?.[id]||0;}for(const a of Object.values(s.srEconomy?.pillAllocations||{}))if(a.phase==='reserved'&&(!publicOnly||a.personId==='person:master'))result[a.recipeId]+=a.quantity;for(const w of Object.values(s.workOrdersById||{}))if(w.kind==='transport'&&!['delivered','cancelled'].includes(w.phase)&&(!publicOnly||s.stockpilesById[w.sourceStockpileId]?.access==='public'||s.stockpilesById[w.sourceStockpileId]?.ownerId==='person:master'))for(const[k,q]of Object.entries(w.cargo))if(pillId(k))result[pillId(k)]+=q;return result;}
export function hydratePillTotals(s){if(!s.srEconomy?.pillInventoryVersion)return s;const totals={};for(const id of Object.keys(RECIPES))Object.defineProperty(totals,id,{enumerable:true,configurable:true,get:()=>pillTotals(s,{publicOnly:true})[id],set:()=>fail('丹药总量只读；须通过实际药库投放、搬运或消费。')});Object.defineProperty(s,'pills',{enumerable:true,configurable:true,get:()=>totals});return s;}
export function initPillInventory(s){if(!s.srWorld)return s;if(!s.srEconomy.pillInventoryVersion){const legacy={...s.pills};if(!Object.entries(legacy).every(([id,q])=>RECIPES[id]&&Number.isSafeInteger(q)&&q>=0))fail('旧药物库存无效，不能迁移。');for(const st of Object.values(s.stockpilesById))st.pills??=pillZeros();const home=stock(s,'stockpile:yunxiu');for(const[id,q]of Object.entries(legacy))home.pills[id]+=q;s.srEconomy.pillAllocations??={};s.srEconomy.pillInventoryVersion='positioned-pills:v1';ledger(s,'fact:pill-stock-migration:v1',{operation:'pill-stock-migration',targetStockpileId:home.id,quantities:legacy,source:'existing legacy paid/owned pills; transferred once without grants'});}for(const st of Object.values(s.stockpilesById))st.pills??=pillZeros();s.srEconomy.pillAllocations??={};for(const o of Object.values(s.srCultivation?.orders||{}))if(o.reservedPill!==undefined&&!o.pillAllocation){if(o.kind!=='breakthrough'||o.parameters?.pillCost!==1||o.reservedPill!==1||!s.personsById[o.personId])fail('旧筑基丹预约记录无效，不能补发或清空。');const id=`pill-allocation:${o.id}`,source=stock(s,o.sourceStockpileId||'stockpile:yunxiu'),p=s.personsById[o.personId],phase=o.consumed||o.refineStarted?'consumed':o.phase==='cancelled'?'refunded':'reserved';const allocation={id,personId:p.personId,holderId:p.personId,recipeId:'foundation',quantity:1,parts:[{stockpileId:source.id,quantity:1}],phase,createdTick:o.createdTick??s.worldTick,legacyPaidOrderId:o.id,positionAtPickup:{sceneId:personScene(s,p),x:personFeet(s,p).x,y:personFeet(s,p).y}};s.srEconomy.pillAllocations[id]??=allocation;o.pillAllocation=s.srEconomy.pillAllocations[id];if(phase==='consumed')ledger(s,`fact:pill-consume:${id}`,{operation:'pill-consume',actorId:p.personId,recipeId:'foundation',quantity:1,sources:copy(allocation.parts),source:'existing legacy order had already consumed its paid dose'});else if(phase==='refunded')ledger(s,`fact:pill-refund:${id}`,{operation:'pill-refund',actorId:p.personId,recipeId:'foundation',quantity:1,sources:copy(allocation.parts),source:'existing legacy order had already refunded dose to legacy public count'});ledger(s,`fact:pill-allocation-migration:${id}`,{operation:'pill-allocation-migration',actorId:p.personId,recipeId:'foundation',quantity:1,phase,source:'existing reservedPill in paid breakthrough order; no second deduction or new dose'});delete o.reservedPill;}return hydratePillTotals(s);}
export function carriedStockpile(s,personId='person:master'){const p=s.personsById[personId];if(!p)fail('携药人物不存在。');const id=personId==='person:master'?'stockpile:carried:master':`stockpile:carried:${personId.slice(7)}`;s.stockpilesById[id]??={id,ownerId:personId,custodianId:personId,carrierId:personId,access:'private',capacity:40,position:{sceneId:personScene(s,p),x:personFeet(s,p).x,y:personFeet(s,p).y},resources:zeros(),pills:pillZeros()};return id;}
function usablePillStocks(s,personId,recipeId,{near=true}={}){const p=s.personsById[personId];if(!p||p.lifeStatus==='dead'||!personScene(s,p))return [];const scene=personScene(s,p),feet=personFeet(s,p),reach=s.spatial?.version==='spatial-metres-1'?1.5:48;return Object.values(s.stockpilesById).filter(st=>(st.access==='public'||st.ownerId===personId&&st.access!=='merchant')&&(!s.combat||s.combat.status!=='active'||st.carrierId===personId)&&(st.pills?.[recipeId]||0)>0&&position(s,st)?.sceneId===scene&&!s.buildingsById[st.buildingId]?.spatialLock&&(!near||scenicDistance(feet,position(s,st))<=reach)&&(scene!=='scene:yunxiu-courtyard'||stockAccess(s,st)&&scenicFindPath(s,feet,stockAccess(s,st),{maxSnap:0})!==null)).sort((a,b)=>(a.ownerId===personId&&a.carrierId===personId?-1:0)-(b.ownerId===personId&&b.carrierId===personId?-1:0)||scenicDistance(feet,position(s,a))-scenicDistance(feet,position(s,b))||a.id.localeCompare(b.id));}
export function availablePills(s,personId='person:master',recipeId){if(!s.srEconomy?.pillInventoryVersion)return s.pills?.[recipeId]||0;return usablePillStocks(s,personId,recipeId).reduce((q,st)=>q+st.pills[recipeId],0);}
export function ownAvailablePills(s,personId,recipeId){if(!s.srEconomy?.pillInventoryVersion)return 0;return usablePillStocks(s,personId,recipeId).filter(st=>st.ownerId===personId&&st.access==='private').reduce((n,st)=>n+st.pills[recipeId],0);}
export function reserveAccessiblePills(s,personId,recipeId,quantity=1,{reservationId}={}){if(!RECIPES[recipeId]||!Number.isSafeInteger(quantity)||quantity<1)fail('丹药预留参数无效。');if(!s.srEconomy?.pillInventoryVersion){if((s.pills[recipeId]||0)<quantity)fail('丹药不足。');s.pills[recipeId]-=quantity;return {legacy:true,recipeId,quantity,parts:[],phase:'reserved'};}const id=reservationId||`pill-allocation:${s.srEconomy.nextId++}`,old=s.srEconomy.pillAllocations[id];if(old){if(old.personId!==personId||old.recipeId!==recipeId||old.quantity!==quantity)fail('同一丹药预约不能改参数。');return old;}const sources=usablePillStocks(s,personId,recipeId);if(sources.reduce((q,st)=>q+st.pills[recipeId],0)<quantity)fail('本人身边无可达丹药；须实际取药或搬入同地药库。');let needed=quantity;const parts=[];for(const st of sources){const q=Math.min(needed,st.pills[recipeId]);if(q){st.pills[recipeId]-=q;parts.push({stockpileId:st.id,quantity:q});needed-=q;}if(!needed)break;}const allocation={id,personId,holderId:personId,recipeId,quantity,parts,phase:'reserved',createdTick:s.worldTick,positionAtPickup:{sceneId:personScene(s,s.personsById[personId]),x:personFeet(s,s.personsById[personId]).x,y:personFeet(s,s.personsById[personId]).y}};s.srEconomy.pillAllocations[id]=allocation;return allocation;}
function currentPillAllocation(s,allocation){return allocation?.legacy?allocation:s.srEconomy.pillAllocations[allocation?.id]||fail('丹药预约不存在。');}
export function consumePillAllocation(s,allocation){const a=currentPillAllocation(s,allocation);if(a.phase!=='reserved')fail('丹药预约已经消费或退回。');a.phase='consumed';if(!a.legacy)ledger(s,`fact:pill-consume:${a.id}`,{operation:'pill-consume',actorId:a.personId,recipeId:a.recipeId,quantity:a.quantity,sources:copy(a.parts)});return a;}
export function refundPillAllocation(s,allocation){const a=currentPillAllocation(s,allocation);if(a.phase!=='reserved')fail('丹药预约已经消费或退回。');if(a.legacy)s.pills[a.recipeId]+=a.quantity;else{const p=s.personsById[a.personId],feet=personFeet(s,p),sceneId=personScene(s,p),reach=s.spatial?.version==='spatial-metres-1'?1.5:48;a.returnedTo=[];for(const[index,part]of a.parts.entries()){const source=stock(s,part.stockpileId),same=position(s,source)?.sceneId===sceneId&&scenicDistance(feet,position(s,source))<=reach&&!s.buildingsById[source.buildingId]?.spatialLock;let target=source;if(!same){const id=`stockpile:pill-refund:${a.id}:${index}`;s.stockpilesById[id]??={id,ownerId:source.ownerId,custodianId:a.personId,access:source.access,capacity:80,position:{sceneId,x:feet.x,y:feet.y},resources:zeros(),pills:pillZeros()};target=s.stockpilesById[id];}target.pills??=pillZeros();target.pills[a.recipeId]+=part.quantity;a.returnedTo.push({stockpileId:target.id,quantity:part.quantity});}ledger(s,`fact:pill-refund:${a.id}`,{operation:'pill-refund',actorId:a.personId,recipeId:a.recipeId,quantity:a.quantity,sources:copy(a.parts),returnedTo:copy(a.returnedTo)});}a.phase='refunded';return a;}
export function consumeAccessiblePill(s,personId,recipeId){const a=reserveAccessiblePills(s,personId,recipeId,1);consumePillAllocation(s,a);return a;}
export function grantPills(s,stockpileId,recipeId,quantity,{factId,actorId='person:master'}={}){if(!RECIPES[recipeId]||!Number.isSafeInteger(quantity)||quantity<1||!factId)fail('丹药投放需合法配方、数量及唯一事实。');if(s.factsById[factId]){const old=s.factsById[factId];if(old.recipeId!==recipeId||old.quantity!==quantity||old.targetStockpileId&&old.targetStockpileId!==stockpileId)fail('同一丹药结果不能改配方、数量或位置。');return {replayed:true};}if(!s.srEconomy?.pillInventoryVersion){s.pills[recipeId]=(s.pills[recipeId]||0)+quantity;ledger(s,factId,{operation:'pill-production',recipeId,quantity,actorId});return {replayed:false};}const st=stock(s,stockpileId);if(total(st)+quantity>st.capacity)fail('实际药库已满，保留工序等待搬出。');st.pills??=pillZeros();st.pills[recipeId]+=quantity;ledger(s,factId,{operation:'pill-production',recipeId,quantity,actorId,targetStockpileId:st.id});return {replayed:false};}
export function preparePillUse(s,recipeId,personId='person:master'){initEconomy(s);if(!RECIPES[recipeId]||recipeId==='foundation')fail('此入口仅取可直接服用药物；筑基丹须实际搬运。');if(availablePills(s,personId,recipeId)>0)return {ready:true};const p=s.personsById[personId];if(!p||!atHome(s,p))fail('院外须先实际携药，不能远取院中药柜。');const sources=usablePillStocks(s,personId,recipeId,{near:false});for(const st of sources){try{return {...startTransport(s,st.id,carriedStockpile(s,personId),personId,{[`pill:${recipeId}`]:1},autonomousPillPickup),pending:true,recipeId};}catch(error){if(!error.message.includes('通路'))throw error;}}fail('本地没有有权取用且可达的药柜。');}
const autonomousPillPickup=Symbol('autonomous-pill-pickup');
function canUse(st,actorId){return st.access==='public'||st.ownerId===actorId&&st.access!=='merchant';}
function ledger(s,id,data){if(s.factsById[id])return false;s.factsById[id]={id,kind:'inventory-transaction',atTick:s.worldTick,...data};return true;}
function rememberProductionResult(s,b,participants,factId){
 const text=`我在${BUILDINGS[b.type].name}${participants.length>1?'与同门协作':''}完成一批生产。`;
 for(const {person} of participants){
  const memories=person.mind?.memories;if(!Array.isArray(memories)||memories.some(m=>m.key===factId))continue;
  memories.unshift({time:s.society?.clock??s.time,text,important:false,public:true,key:factId});
  let recent=0;person.mind.memories=memories.filter(m=>m.important||++recent<=10);
 }
}
function makeMarketSupplyPerson(s,id,name,sceneId,x,y){
 const p=copy(s.personsById['person:merchant-qingxi']);p.id=s.society.nextPersonId++;p.personId=id;p.name=name;p.job=null;p.activityId=null;p.lifeStatus='alive';
 p.position={kind:'scene',sceneId,x,y};delete p.location;delete p.schedule;
 if(p.mind){p.mind.away=null;p.mind.activity='rest';p.mind.memories=[];if(p.mind.scenic)Object.assign(p.mind.scenic,{x,y,path:[],goal:null});}
 s.personsById[id]=p;return p;
}
/** SR-XF-011-AC-02: one-time conversion of the saved finite source, never a new grant. */
function initMarketSupply(s){
 if(s.contentVersion!=='sr-content-v1.2')return;
 const e=s.srEconomy;if(e.marketSupplyVersion===MARKET_SUPPLY_VERSION)return;
 if(e.marketSupplyVersion!==undefined||s.stockpilesById[MARKET_SUPPLIER_STOCK]||s.personsById[MARKET_SUPPLIER])fail('青溪补货来源版本或旧档引用异常。');
 const old=e.marketSourceRemaining,tick=e.marketRestockTick;
 if(!old||Object.keys(old).length!==6||![...MARKET_SOURCE_GOODS,'insight'].every(k=>Number.isFinite(old[k])&&old[k]>=0)||!Number.isSafeInteger(tick)||tick<0)fail('旧青溪补货余额或游标异常，原档保留。');
 if(!s.personsById['person:chizhang-steward']||!s.scenesById?.['scene:supply'])fail('青溪供货地或关口人员引用缺失，原档保留。');
 makeMarketSupplyPerson(s,MARKET_SUPPLIER,'许青和','scene:supply',35,31);
 makeMarketSupplyPerson(s,MARKET_CARRIER,'陈绍','scene:market',37,27);
 const resources={...zeros(),...Object.fromEntries(MARKET_SOURCE_GOODS.map(k=>[k,old[k]]))};
 s.stockpilesById[MARKET_SUPPLIER_STOCK]={id:MARKET_SUPPLIER_STOCK,ownerId:MARKET_SUPPLIER,custodianId:MARKET_SUPPLIER,carrierId:null,access:'private',capacity:1200,position:{sceneId:'scene:supply',x:35,y:31},resources};
 s.stockpilesById[MARKET_SUPPLIER_WALLET]={id:MARKET_SUPPLIER_WALLET,ownerId:MARKET_SUPPLIER,custodianId:MARKET_SUPPLIER,carrierId:null,access:'private',capacity:100000,position:{sceneId:'scene:supply',x:35,y:31},resources:zeros()};
 s.stockpilesById[MARKET_TOLL_STOCK]??={id:MARKET_TOLL_STOCK,ownerId:'person:chizhang-steward',custodianId:'person:chizhang-steward',carrierId:null,access:'private',capacity:100000,position:{sceneId:'scene:supply',x:36,y:30},resources:zeros()};
 e.marketInsightSource={ownerId:MARKET_SUPPLIER,custodianId:MARKET_SUPPLIER,balance:old.insight};
 e.nextMarketSourceQuoteTick=tick;e.marketSupplyVersion=MARKET_SUPPLY_VERSION;
 e.marketSupply={nextRunId:1,activeRunId:null,queue:[],runs:{},nextInsightQuoteTick:tick};
 e.marketSupplyMigration={oldRemaining:copy(old),oldQuoteTick:tick,sourceStockpileId:MARKET_SUPPLIER_STOCK,merchantStockAtMigration:copy(stock(s,'stockpile:qingxi').resources)};
 delete e.marketSourceRemaining;delete e.marketRestockTick;
 ledger(s,'fact:market-supply-migration:v1',{operation:'market-supply-migration',sourceStockpileId:MARKET_SUPPLIER_STOCK,quantities:copy(old),merchantStockpileId:'stockpile:qingxi'});
}
export function initEconomy(s){
 if(!s.srEconomy)s.srEconomy={version:'economy:yunxiu:v1',nextId:1,updatedThroughTick:s.worldTick,merchantArrivalTick:s.worldTick+300,merchantVisitEndsTick:s.worldTick+1200,marketRestockTick:s.worldTick+2400,marketSourceRemaining:{food:160,wood:120,stone:120,herb:120,crystal:24,insight:12},patches:{wood:{remaining:720,max:720},stone:{remaining:960,max:960},herb:{remaining:160,max:160},food:{remaining:320,max:320},crystal:{remaining:80,max:80},insight:{remaining:72,max:72}},orders:{},tradeHistory:[]};
 s.srEconomy.resaleInventory??=zeros();s.srEconomy.commonGoods??=[];s.srEconomy.wholesale??={nextMarketTick:s.worldTick+WHOLESALE_DEFINITION.periodTicks,windowStartedTick:s.worldTick,windowSpent:0,spentLifetime:0};
 const hall=s.buildings.find(b=>b.type==='hall');if(hall&&s.stockpilesById['stockpile:yunxiu'])s.stockpilesById['stockpile:yunxiu'].buildingId=hall.instanceId;
 for(const st of Object.values(s.stockpilesById)){st.capacity??=ECONOMY_DEFINITION.capacity;if(st.custodianId===undefined&&s.personsById[st.ownerId])st.custodianId=st.ownerId;if(st.access===undefined)st.access=st.id==='stockpile:yunxiu'?'public':'private';if(st.position===undefined)st.position={sceneId:'scene:yunxiu-courtyard',...buildingAccess(s,hall)};if(st.access==='private'&&st.ownerId!=='person:master'&&!marketSupplyStockpile(st.id)&&s.personsById[st.ownerId])st.carrierId??=st.ownerId;}
 if(!s.personsById['person:merchant-qingxi']){const p=structuredClone(Object.values(s.personsById).find(p=>p.mind)||s.master),id=s.society.nextPersonId++;p.id=id;p.personId='person:merchant-qingxi';p.name='周行舟';if(s.scenesById?.['scene:market'])p.position={kind:'scene',sceneId:'scene:market',x:37,y:25};delete p.location;p.job=null;p.activityId=null;p.appearance={spriteIndex:3,accent:'#ad8b69'};delete p.schedule;s.personsById[p.personId]=p;}
 if(s.stockpilesById['stockpile:qingxi']){s.stockpilesById['stockpile:qingxi'].ownerId='person:merchant-qingxi';s.stockpilesById['stockpile:qingxi'].custodianId='person:merchant-qingxi';delete s.stockpilesById['stockpile:qingxi'].legalOwnerId;}
 if(!s.stockpilesById['stockpile:qingxi'])s.stockpilesById['stockpile:qingxi']={id:'stockpile:qingxi',ownerId:'person:merchant-qingxi',custodianId:'person:merchant-qingxi',access:'merchant',capacity:4000,position:{sceneId:'scene:market',x:0,y:0},resources:{...zeros(),jade:600,food:80,wood:60,stone:60,herb:60,crystal:12,insight:6}};
 if(!s.personsById['person:wholesale-buyer']){const source=s.personsById['person:merchant-qingxi'],p=copy(source);p.id=s.society.nextPersonId++;p.personId='person:wholesale-buyer';p.name='青溪商会批发执事';p.lifeStatus='alive';p.activityId=null;p.job=null;delete p.location;p.position={kind:'scene',sceneId:s.scenesById?.['scene:market']?'scene:market':'scene:yunxiu-courtyard',x:17,y:25};p.appearance={spriteIndex:2,accent:'#777b96'};delete p.schedule;s.personsById[p.personId]=p;}s.stockpilesById['stockpile:wholesale-treasury']??={id:'stockpile:wholesale-treasury',ownerId:'person:wholesale-buyer',custodianId:'person:wholesale-buyer',access:'private',capacity:WHOLESALE_DEFINITION.lifetimeTreasury,position:{sceneId:'scene:market',x:17,y:25},resources:{...zeros(),jade:WHOLESALE_DEFINITION.lifetimeTreasury}};
 for(const b of s.buildings)if(BUILDINGS[b.type].work||b.type==='alchemy'){const id=`stockpile:${b.instanceId}`;s.stockpilesById[id]??={id,ownerId:'person:master',custodianId:'person:master',access:'public',buildingId:b.instanceId,position:{sceneId:'scene:yunxiu-courtyard',...buildingAccess(s,b)},capacity:320,resources:zeros()};}
 // Earlier library batches already earned a study budget; fold only the public
 // library balance into the public ledger, leaving reserved transport cargo alone.
 const publicBudget=s.stockpilesById['stockpile:yunxiu'];
 for(const b of s.buildings)if(b.type==='library'){
  const st=s.stockpilesById[`stockpile:${b.instanceId}`],amount=st?.resources?.insight;
  if(st?.ownerId!=='person:master'||st.access!=='public'||!Number.isFinite(amount)||amount<=0)continue;
  st.resources.insight=0;publicBudget.resources.insight+=amount;
  ledger(s,`fact:library-budget:${b.instanceId}:${s.srEconomy.nextId++}`,{operation:'library-study-budget',sourceStockpileId:st.id,targetStockpileId:publicBudget.id,resource:'insight',quantity:amount});
 }
 initMarketSupply(s);initPillInventory(s);upgradeMarketOrderAccessV2(s);upgradePillRecipeSnapshots(s);if(s.crafting&&!s.activitiesById[s.master.activityId]?.kind?.startsWith('sr-'))resumeLegacyCraft(s);return s;
}
const HARVEST_BATCH={wood:12,stone:10,herb:10,food:16};
function reservedHarvest(s,resource,exceptActivityId){return Object.values(s.activitiesById||{}).filter(a=>a.kind==='sr-harvest'&&a.resource===resource&&a.id!==exceptActivityId).reduce((n,a)=>n+(a.reservedQuantity||0),0);}
export function harvestAvailable(s,resource,amount=1,exceptActivityId=null){return !s.srEconomy||!s.srEconomy.patches[resource]||s.srEconomy.patches[resource].remaining-reservedHarvest(s,resource,exceptActivityId)+1e-9>=amount;}
export function consumeHarvest(s,resource,amount,exceptActivityId=null){if(!s.srEconomy)return true;const patch=s.srEconomy.patches[resource];if(!patch)return true;if(!harvestAvailable(s,resource,amount,exceptActivityId))return false;patch.remaining=Math.max(0,patch.remaining-amount);return true;}
export function startMasterHarvest(s,resource){initEconomy(s);if(!['wood','stone','herb','food'].includes(resource))fail('仅可亲自采集基础物资。');if(s.master.location?.kind==='travel'||s.master.location?.sceneId&&s.master.location.sceneId!=='scene:yunxiu-courtyard')fail('山外采集须到对应真实资源点。');if(s.master.activityId&&s.activitiesById[s.master.activityId])fail('先完成已有身体活动。');if(s.master.wound>20||s.master.energy<15)fail('先恢复身体与精力。');const b=s.buildings.find(b=>Object.hasOwn(BUILDINGS[b.type].out||{},resource)&&b.enabled!==false&&b.condition>0),patch=s.srEconomy.patches[resource],hall=buildingAccess(s,s.buildings.find(b=>b.type==='hall')),scale=s.spatial?.version==='spatial-metres-1'?1:32;
 patch.position??={sceneId:'scene:yunxiu-courtyard',...scenicNearest(s,{x:hall.x+(resource==='wood'?7:resource==='stone'?-7:resource==='herb'?5:-5)*scale,y:hall.y+5*scale})};const anchor=b?buildingAccess(s,b):patch.position,target=scenicNearest(s,anchor,{maxDistance:3*scale});if(!target)fail('资源区周边没有合法采集脚点；清出通路后重试。');if(!harvestAvailable(s,resource,HARVEST_BATCH[resource]))fail('此处整批来源不足，需实际恢复或采购。');const path=scenicFindPath(s,s.master.scenic,target,{maxSnap:0});if(path===null)fail('采集地点通路受阻。');const id=`activity:manual-harvest:${s.srEconomy.nextId++}`,a={id,kind:'sr-harvest',personId:'person:master',resource,reservedQuantity:HARVEST_BATCH[resource],anchor:{x:anchor.x,y:anchor.y},target:{...target},phase:path.length?'moving':'working',progressTicks:0,durationTicks:100,reason:'掌门亲自前往实际采集位置。'};s.activitiesById[id]=a;s.master.activityId=id;s.master.scenic.path=path;s.master.scenic.goal={...target};s.master.scenic.revision=geometryRevision(s);return {id,pending:true};}
export function cancelMasterHarvest(s){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='sr-harvest')fail('没有掌门采集事务。');delete s.activitiesById[a.id];s.master.activityId=null;s.master.scenic.path=[];s.master.scenic.goal=null;return {cancelled:true};}
function advanceMasterHarvest(s){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='sr-harvest')return;if(!atHome(s,s.master)||s.master.scenic?.spatialEvacuationOrderId||s.master.wound>20||s.master.energy<5){a.phase='paused';a.reason='本人离位、受伤或精力不足，保留未完劳动。';return;}if(s.master.scenic.revision!==geometryRevision(s)){const target=scenicNearest(s,a.anchor||a.target,{maxDistance:s.spatial?.version==='spatial-metres-1'?3:96});if(!target){a.phase='blocked';a.reason='资源区周边没有合法采集脚点，清出通路或取消。';return;}a.target=target;}if(!close(s,s.master.scenic,a.target)){const sc=s.master.scenic;if(sc.revision!==geometryRevision(s)||!sc.path.length){const path=scenicFindPath(s,sc,a.target,{maxSnap:0});if(path===null){a.phase='blocked';a.reason='采集通路已阻，先疏通或取消。';return;}sc.path=path;sc.goal={...a.target};sc.revision=geometryRevision(s);}advanceScenic(sc,4.6,s);syncScenicPosition(s,s.master);a.phase='moving';return;}a.phase='working';a.reason='已到场，亲自采集有限物资。';if(a.progressTicks<a.durationTicks){a.progressTicks++;s.master.energy=Math.max(0,s.master.energy-.015);}if(a.progressTicks<a.durationTicks)return;const id='stockpile:carried:master';s.stockpilesById[id]??={id,ownerId:'person:master',custodianId:'person:master',carrierId:'person:master',access:'private',capacity:40,position:{sceneId:'scene:yunxiu-courtyard',x:s.master.scenic.x,y:s.master.scenic.y},resources:zeros()};const st=s.stockpilesById[id],quantity=HARVEST_BATCH[a.resource];if(total(st)+quantity>st.capacity){a.phase='paused';a.reason='随身包裹已满，先取消事务并搬入府库。';return;}if(!consumeHarvest(s,a.resource,quantity,a.id)){a.phase='blocked';a.reason='整批来源已不足，取消采集后恢复或采购；等待不再扣精力。';return;}st.resources[a.resource]+=quantity;ledger(s,`fact:manual-harvest:${a.id}`,{operation:'manual-harvest',resource:a.resource,quantity,targetStockpileId:id,sourcePosition:{...a.target},actorId:'person:master'});delete s.activitiesById[a.id];s.master.activityId=null;s.master.action='rest';return true;}
export function productionInputResources(s,b){return s.srEconomy?s.stockpilesById[`stockpile:${b.instanceId}`]?.resources||{}:s.resources;}
export function productionInputAvailable(s,b,cost=BUILDINGS[b.type]?.input||{}){return Object.entries(cost).every(([k,v])=>(productionInputResources(s,b)[k]||0)>=v);}
export function reserveProductionInput(s,b,cost){if(!productionInputAvailable(s,b,cost))return false;const source=productionInputResources(s,b);for(const[k,v]of Object.entries(cost))source[k]-=v;return true;}
export function refundProductionInput(s,b,cost){const target=productionInputResources(s,b);for(const[k,v]of Object.entries(cost))target[k]=(target[k]||0)+v;}
function workshopBuyerAvailable(s){if(s.srWorld)return s.personsById['person:merchant-qingxi']?.lifeStatus!=='dead'&&s.personsById['person:merchant-qingxi']?.position?.kind==='scene'&&s.personsById['person:merchant-qingxi'].position.sceneId==='scene:yunxiu-courtyard'&&marketRouteOpen(s);return merchantPresent(s);}
export function productionAvailability(s,b){if(!s.srEconomy)return {available:true,reason:''};if(b.type==='workshop'&&!workshopBuyerAvailable(s))return {available:false,reason:'器物买方尚未实际到达；等商人抵院后交货收款。'};if(b.type==='workshop'&&stock(s,'stockpile:qingxi').resources.jade<=0)return {available:false,reason:'器物买方本金不足，保留投入等待。'};const order=s.workOrdersById?.[`work:production:${b.instanceId}`],out=(order?.phase!=='completed'&&order?.recipeSnapshot?.outputDefinition)||(b.type==='farm'?FARM_V1_RECIPE.outputDefinition:productionRecipeDefinition(PRODUCTION_RECIPE_VERSION,b.type)?.outputDefinition||{}),st=s.stockpilesById[`stockpile:${b.instanceId}`];if(st&&total(st)+physicalOutputTotal(b,out)>st.capacity)return {available:false,reason:'成品存放处已满，先搬入府库。'};if(b.type==='library'){const home=stock(s,'stockpile:yunxiu');if(total(home)+(out.insight||0)>home.capacity+1e-9)return {available:false,reason:'院中公库研习预算容量已满，先腾出容量。'};}for(const[k,v]of Object.entries(out))if(!harvestAvailable(s,k,v))return {available:false,reason:`${RESOURCES[k]}来源已耗尽；补种、采购或另寻供给。`};return {available:true,reason:''};}
/** Wrap the existing single production callback; relocate its actual delta rather than create another result. */
export function settleFiniteProduction(s,b,settle,participants){
 if(!s.srEconomy)return settle(participants);initEconomy(s);const order=s.workOrdersById[`work:production:${b.instanceId}`];if(!order||s.factsById[`fact:production:${b.instanceId}:${order.batch}`])return false;const pursesBefore=Object.fromEntries(Object.values(s.personsById).map(p=>[p.personId,p.mind?.purse||0]));const before={...s.resources},st=stock(s,`stockpile:${b.instanceId}`);
 if(b.type!=='farm'||order.recipeSnapshot?.recipeVersion!==FARM_CROP_RECIPE.recipeVersion){const availability=productionAvailability(s,b);if(!availability.available)return false;}
 const trial=cloneState(s),trialParticipants=participants.map(x=>({person:trial.personsById[x.person.personId],share:x.share,...(x.skillAtFirstContribution===undefined?{}:{skillAtFirstContribution:x.skillAtFirstContribution})}));
 if(!settle(trialParticipants,trial))return false;const wageDelta=Object.values(trial.personsById).reduce((n,p)=>n+Math.max(0,(p.mind?.purse||0)-(pursesBefore[p.personId]||0)),0);const out={};for(const k of Object.keys(RESOURCES))out[k]=Math.max(0,trial.resources[k]-before[k]+(k==='jade'?wageDelta:0));
 const fits=Object.entries(out).every(([k,v])=>harvestAvailable(s,k,v))&&total(st)+physicalOutputTotal(b,out)<=st.capacity+1e-9&&(b.type!=='library'||total(stock(s,'stockpile:yunxiu'))+(out.insight||0)<=stock(s,'stockpile:yunxiu').capacity+1e-9);
 if(!fits||b.type==='workshop'&&stock(s,'stockpile:qingxi').resources.jade+1e-9<(out.jade||0))return false;if(b.type==='workshop'&&s.srWorld&&!prepareMerchantCollection(s,b,order,out.jade||0))return false;if(!settle(participants,s))return false;if(b.type==='workshop'){stock(s,'stockpile:qingxi').resources.jade-=out.jade||0;s.srEconomy.commonGoods.push({id:`common-good:${b.instanceId}:${order.batch}`,kind:'toolkit',ownerId:'person:merchant-qingxi',stockpileId:'stockpile:qingxi',costPaid:out.jade||0,craftedTick:s.worldTick,phase:'stocked'});if(s.srWorld){const c=s.workOrdersById[`work:merchant-collection:${b.instanceId}:${order.batch}`];c.phase='carrying';c.paidTick=s.worldTick;c.actualPayment=out.jade||0;c.productionFactId=`fact:production:${b.instanceId}:${order.batch}`;const a=s.activitiesById[s.personsById[c.carrierId].activityId];if(a)a.phase='carrying';}}

 const received={};for(const[k,v]of Object.entries(out)){const budget=b.type==='library'&&k==='insight',moved=budget?v:k==='jade'?Math.min(v,s.resources[k]):v;received[k]=moved;if(!budget){s.resources[k]=Math.max(0,s.resources[k]-moved);st.resources[k]+=moved;}if(s.srEconomy.patches[k])s.srEconomy.patches[k].remaining=Math.max(0,s.srEconomy.patches[k].remaining-v);}

 const factId=`fact:production:${b.instanceId}:${order.batch}`;
 ledger(s,factId,{operation:'production',targetStockpileId:b.type==='library'?'stockpile:yunxiu':st.id,quantities:received,grossOutput:out,wagesFromProceeds:Math.max(0,(out.jade||0)-(received.jade||0)),participantIds:participants.map(p=>p.person.personId),...(order.recipeSnapshot?{recipeVersion:order.recipeSnapshot.recipeVersion,weatherSnapshot:weatherModifiers(s),facilitySnapshot:{level:b.level,condition:b.condition,enabled:b.enabled},participantSkills:copy(order.participantSkills||{})}:{}),...(order.crop?{cropId:order.crop.cropId}:{}),...(b.type==='workshop'?{buyerId:'person:merchant-qingxi',payment:out.jade||0}: {})});
 rememberProductionResult(s,b,participants,factId);return true;
}
/** Patch restoration is a paid physical activity, never an instant remote refill. */
export function replenishPatch(s,resource){
 initEconomy(s);const p=s.srEconomy.patches[resource];if(!p)fail('资源来源不存在。');const costs={herb:{herb:4,jade:8},food:{food:8,jade:4},wood:{jade:12,herb:2},insight:{jade:12},crystal:{jade:20,insight:4}},cost=costs[resource];if(!cost)fail('青石矿脉不可凭空恢复；采购或扩展真实矿源。');if(p.remaining>p.max*.25)fail('当前来源尚足，暂不需要恢复。');if(!atHome(s,s.master))fail('先返回院中再恢复本地来源。');if(s.master.activityId&&s.activitiesById[s.master.activityId]?.kind!=='facility')fail('先完成或取消已有身体活动。');if(s.master.wound>20||s.master.energy<20)fail('先恢复身体与精力。');const b=s.buildings.find(b=>Object.hasOwn(BUILDINGS[b.type].out||{},resource)&&b.enabled!==false&&b.condition>0),target=b?buildingAccess(s,b):buildingAccess(s,s.buildings.find(b=>b.type==='hall'));if(b?.spatialLock)fail('设施正迁建，先恢复可用位置。');const path=scenicFindPath(s,s.master.scenic,target);if(path===null)fail('来源恢复地点通路受阻。');for(const[k,v]of Object.entries(cost))if(s.resources[k]<v)fail('补种/恢复材料不足。');if(s.master.activityId){const old=s.activitiesById[s.master.activityId];if(old.reservationId)delete s.reservationsById[old.reservationId];delete s.activitiesById[old.id];}for(const[k,v]of Object.entries(cost))s.resources[k]-=v;
 const id=`activity:replenish:${s.srEconomy.nextId++}`,rid=`reservation:${id}`;s.activitiesById[id]={id,kind:'sr-replenish',personId:'person:master',resource,phase:path.length?'moving':'working',target:{...target},progressTicks:0,durationTicks:ECONOMY_DEFINITION.replenishTicks,reservationId:rid,reason:'实际前往来源地补种、整理或接引。'};s.reservationsById[rid]={id:rid,kind:'sr-replenish-material',activityId:id,cost:copy(cost)};s.master.activityId=id;s.master.scenic.path=path;s.master.scenic.goal={...target};s.master.scenic.revision=geometryRevision(s);return {id,pending:true,resource,durationTicks:ECONOMY_DEFINITION.replenishTicks};
}
export function cancelReplenish(s){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='sr-replenish')fail('没有进行中的来源恢复。');const r=s.reservationsById[a.reservationId],refund={};for(const[k,v]of Object.entries(r.cost)){refund[k]=v*(1-a.progressTicks/a.durationTicks);s.resources[k]+=refund[k];}delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];s.master.activityId=null;s.master.scenic.path=[];s.master.scenic.goal=null;ledger(s,`fact:replenish-cancel:${a.id}`,{operation:'replenish-cancel',resource:a.resource,refund,actorId:'person:master'});return {cancelled:true,refund};}
function advanceReplenish(s){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='sr-replenish')return;if(!atHome(s,s.master)||s.master.scenic?.spatialEvacuationOrderId||s.master.wound>20||s.master.energy<5){a.phase='paused';a.reason='本人外出、受伤或精力不足，保留恢复进度。';return;}if(!close(s,s.master.scenic,a.target)){const sc=s.master.scenic;if(sc.revision!==geometryRevision(s)||!sc.path.length){const path=scenicFindPath(s,sc,a.target);if(path===null){a.phase='blocked';a.reason='通路受阻，先疏通或取消。';return;}sc.path=path;sc.goal={...a.target};sc.revision=geometryRevision(s);}advanceScenic(sc,4.6,s);syncScenicPosition(s,s.master);a.phase='moving';return;}a.phase='working';a.reason='已到现场恢复有限来源。';a.progressTicks++;s.master.energy=Math.max(0,s.master.energy-.02);if(a.progressTicks<a.durationTicks)return;s.srEconomy.patches[a.resource].remaining=s.srEconomy.patches[a.resource].max;ledger(s,`fact:patch:${a.id}`,{operation:'replenish',resource:a.resource,cost:copy(s.reservationsById[a.reservationId].cost),actorId:'person:master',sourcePosition:copy(a.target)});delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];s.master.activityId=null;s.master.action='rest';}
export function startTransport(s,sourceId,targetId,carrierId='person:master',cargo={},authorization=null){
 initEconomy(s);if(marketSupplyStockpile(sourceId)||marketSupplyStockpile(targetId))fail('青溪供货仓及运单货位须按具名交易结算，不能由普通搬运处置。');const source=stock(s,sourceId),target=stock(s,targetId),p=s.personsById[carrierId];if(orderV2ReserveLocked(s,sourceId)||orderV2ReserveLocked(s,targetId))fail('此货位已由商单预留，须先履约或取消。');if(position(s,source)?.sceneId!==position(s,target)?.sceneId)fail('跨地点运输须通过真实旅程；不能在院中瞬间到远方取料。');if(position(s,source)?.sceneId!=='scene:yunxiu-courtyard')fail('这里只能搬运当前院落物资。');if(!p||sourceId===targetId)fail('搬运人物或目的地无效。');if(!canUse(source,carrierId)||!canUse(target,carrierId))fail('无权取用或投放个人/商人物资。');
 const pairs=Object.entries(cargo);if(!pairs.length||!pairs.every(([k,v])=>physicalTransportKey(k)&&Number.isFinite(v)&&v>0&&(!pillId(k)||Number.isSafeInteger(v)))||pairs.reduce((n,[,v])=>n+v,0)>40)fail('每次搬运1至40份实际物资；道韵作为研习预算留在账本。');
 const npcPrivateTransfer=source.ownerId!==target.ownerId&&[source,target].some(st=>st.access==='private'&&st.ownerId!=='person:master');
 const npcMedicinePickup=authorization===autonomousPillPickup&&p!==s.master&&source.access==='public'&&target.access==='private'&&target.ownerId===carrierId&&target.carrierId===carrierId&&target.id===`stockpile:carried:${carrierId.slice(7)}`&&pairs.length===1&&pillId(pairs[0][0])&&pairs[0][1]===1&&usablePillStocks(s,carrierId,pillId(pairs[0][0]),{near:false}).some(st=>st.id===sourceId);
 if(npcPrivateTransfer&&!npcMedicinePickup)fail('跨所有者财物须当面赠予或按授权转让；搬运不改变归属。');
 if(total(target)+pairs.reduce((n,[,v])=>n+v,0)>target.capacity)fail('目的仓储容量不足。');
 const o=body(s,p);if(o.scenic?.spatialEvacuationOrderId)fail('先完成实际撤离施工占地。');if(!atHome(s,p))fail('搬运人须真实在院，不能从山外操控留影搬运。');if(source.buildingId&&s.buildingsById[source.buildingId]?.spatialLock||target.buildingId&&s.buildingsById[target.buildingId]?.spatialLock)fail('源或目的设施正迁建，先恢复可用位置。');if(p.activityId&&s.activitiesById[p.activityId]?.kind!=='facility'||o.away||o.journey||p.wound>(pairs.every(([k])=>pillId(k))?85:20)||p.energy<(pairs.every(([k])=>pillId(k))?5:15))fail('此人正在履约、外出或需要休整。');if(p!==s.master){const trust=o.relationships?.master?.trust??55;if(trust<35||o.traits?.[3]<40) return {accepted:false,reason:'本人暂不愿承担搬运。'};}
 const sourceAccess=stockAccess(s,source);if(!sourceAccess)fail('源仓接触范围没有合法脚点，先清出通路。');const route=scenicFindPath(s,o.scenic,sourceAccess,{maxSnap:0});if(route===null)fail('无法抵达取料位置。');for(const[k,v]of pairs)if(cargoAmount(source,k)+1e-9<v)fail('可用库存不足，已有物资可能已被预留。');
 if(p.activityId){const a=s.activitiesById[p.activityId];if(a.reservationId)delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];}
 const id=`work:transport:${s.srEconomy.nextId++}`,aid=`activity:transport:${carrierId}`,rid=`reservation:transport:${id}`;for(const[k,v]of pairs)changeCargo(source,k,-v);
 s.reservationsById[rid]={id:rid,kind:'transport-cargo',workOrderId:id,cost:copy(cargo),sourceStockpileId:sourceId};s.workOrdersById[id]={id,kind:'transport',sourceStockpileId:sourceId,targetStockpileId:targetId,carrierId,cargo:copy(cargo),phase:'to-source',reservationId:rid,startedTick:s.worldTick,reason:'先到仓储实际取料。'};s.activitiesById[aid]={id:aid,kind:'sr-transport',personId:carrierId,workOrderId:id};p.activityId=aid;o.scenic.path=route;o.scenic.goal=copy(sourceAccess);o.scenic.revision=geometryRevision(s);return {accepted:true,id};
}
function releaseTransport(s,w){const p=s.personsById[w.carrierId];if(p&&s.activitiesById[p.activityId]?.workOrderId===w.id){delete s.activitiesById[p.activityId];p.activityId=null;const o=body(s,p);o.scenic.path=[];o.scenic.goal=null;if(p===s.master&&p.action==='walk')p.action='rest';}delete s.reservationsById[w.reservationId];}
export function cancelTransport(s,id){const w=s.workOrdersById[id];if(w?.kind!=='transport'||['delivered','cancelled'].includes(w.phase))fail('搬运已结束或不存在。');
 const source=stock(s,w.sourceStockpileId);if(w.phase==='to-source'){for(const[k,v]of Object.entries(w.cargo))changeCargo(source,k,v);w.returnedTo=source.id;}else{const p=s.personsById[w.carrierId],pid=`stockpile:dropped:${id}`,place=p.location?.kind==='travel'||p.position?.kind==='worldTravel'?{kind:'travel',travelId:p.location?.travelId||p.position.travelId}:{sceneId:personScene(s,p),x:personFeet(s,p).x,y:personFeet(s,p).y};s.stockpilesById[pid]={id:pid,ownerId:source.ownerId,access:source.access,capacity:80,custodianId:w.carrierId,position:place,resources:zeros(),pills:pillZeros()};for(const[k,v]of Object.entries(w.cargo))changeCargo(s.stockpilesById[pid],k,v);w.returnedTo=pid;}
 w.phase='cancelled';w.reason='未取料归原仓；已取料留在人物所在位置。';releaseTransport(s,w);ledger(s,`fact:transport-cancel:${id}`,{operation:'cancel',workOrderId:id,targetStockpileId:w.returnedTo,quantities:copy(w.cargo)});return {returnedTo:w.returnedTo};}
export function transferProperty(s,sourceId,targetId,resource,quantity,mode='gift'){
 initEconomy(s);if(marketSupplyStockpile(sourceId)||marketSupplyStockpile(targetId))fail('青溪供货仓及运单货位须按具名交易结算，不能作为普通赠借对象。');const a=stock(s,sourceId),b=stock(s,targetId);if(orderV2ReserveLocked(s,sourceId)||orderV2ReserveLocked(s,targetId))fail('此货位已由商单预留，须先履约或取消。');if(!['gift','loan','return'].includes(mode)||!legalCargoKey(resource)||!Number.isFinite(quantity)||quantity<=0||pillId(resource)&&!Number.isSafeInteger(quantity))fail('赠借参数无效。');if(!canUse(a,'person:master'))fail('掌门无权处置此份个人财物。');if(personScene(s,s.master)!==position(s,a)?.sceneId||personScene(s,s.master)!==position(s,b)?.sceneId)fail('须与源及受赠对象在同一实际地点。');const reach=s.spatial?.version==='spatial-metres-1'?1.5:48;if(scenicDistance(personFeet(s,s.master),position(s,a))>reach||scenicDistance(personFeet(s,s.master),position(s,b))>reach)fail('先携带物资与受赠人同地交付。');if(cargoAmount(a,resource)<quantity||total(b)+quantity>b.capacity)fail('可用库存或容量不足。');if(mode==='loan')fail('可消耗物资须赠予；借器使用装备实例所有权接口。');changeCargo(a,resource,-quantity);changeCargo(b,resource,quantity);const id=`fact:property:${s.srEconomy.nextId++}`;ledger(s,id,{operation:mode,sourceStockpileId:sourceId,targetStockpileId:targetId,resource,quantity});return {id};}
/** SR-XF-009 finite onsite pill crafting; s.pills remains the sole count authority. */
export function craftAvailabilitySR(s,id){
 const r=PILL_RECIPE_CATALOG[PILL_RECIPE_VERSION][id],b=s.buildings.find(b=>b.type==='alchemy'&&b.enabled!==false&&b.condition>0&&!b.spatialLock),reasons=[];
 if(!r)reasons.push('丹方不存在。');
 if(!b)reasons.push('需可运行且未迁建的丹炉。');
 if(!atHome(s,s.master))reasons.push('掌门须真实归院操作丹炉。');
 if(s.master.activityId&&s.activitiesById[s.master.activityId]?.kind!=='facility')reasons.push('先完成或取消当前身体活动。');
 if(s.crafting)reasons.push('旧丹炉工序尚待现场接续。');
 if(s.master.wound>20||s.master.energy<15)reasons.push('先恢复身体与精力。');
 if(r){
  if(s.master.realm<r.realm)reasons.push('掌门尚未达到此丹方操作境界。');
  if(r.knowledge&&(s.master.knowledge[r.knowledge]||0)<r.mastery)reasons.push(`掌门需理解《${TECHNIQUES[r.knowledge]?.name||r.knowledge}》${r.mastery}。`);
  if(id==='foundation'&&!s.doctrine.books.includes('foundation'))reasons.push('先取得可靠筑基丹方。');
  if(b){
   if(!facilitySlots(s,b,'work').some(slot=>!slotReservation(s,slot.id)))reasons.push('丹炉操作工位已被预约。');
   for(const[k,v]of Object.entries(r.cost))if((s.stockpilesById[['jade','insight'].includes(k)?'stockpile:yunxiu':`stockpile:${b.instanceId}`]?.resources[k]||0)<v)reasons.push(`${RESOURCES[k]}需${v}：${['jade','insight'].includes(k)?'院中公共预算不足':'先实际搬入丹炉工位缓存'}。`);
  }
 }
 return {available:!reasons.length,reasons,recipeId:id,buildingId:b?.instanceId||null,cost:copy(r?.cost||{}),durationTicks:r?Math.ceil(r.duration*10/(1+.25*((b?.level||1)-1))):0,yield:r?.yield||0,physicalStockpileId:b?`stockpile:${b.instanceId}`:null};
}
function createCraft(s,b,id,{legacy=null}={}){
 const recipe=PILL_RECIPE_CATALOG[legacy?'pill-recipes:yunxiu:v1':PILL_RECIPE_VERSION][id],sc=s.master.scenic;if(!recipe)fail('丹方不存在。');
 const slot=facilitySlots(s,b,'work').find(slot=>!slotReservation(s,slot.id));if(!slot)fail('丹炉工位正在使用。');
 const path=scenicFindPath(s,sc,slot.position,{maxSnap:s.spatial?.version==='spatial-metres-1'?.04:1});if(path===null)fail('丹炉工位通路受阻。');
 if(s.master.activityId){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='facility')fail('掌门正在履行其他身体事务。');if(a.reservationId)delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];}
 const n=s.srEconomy.nextId++,wid=`work:craft:${n}`,aid=`activity:craft:${n}`,rid=`reservation:craft:${n}`,sid=`reservation:craft-slot:${n}`,durationTicks=legacy?Math.round(legacy.total*10):Math.ceil(recipe.duration*10/(1+.25*(b.level-1))),progressTicks=legacy?Math.round((legacy.total-legacy.remaining)*10):0;
 const version=legacy?'pill-recipes:yunxiu:v1':PILL_RECIPE_VERSION;
 const snapshot=pillRecipeSnapshot(s,b,id,{version,cost:recipe.cost,yieldCount:legacy?.yield??recipe.yield,durationTicks});
 const sourceStockpileIds=copy(snapshot.sourceStockpileIds);for(const[k,v]of Object.entries(snapshot.inputCost))if(!legacy)stock(s,sourceStockpileIds[k]).resources[k]-=v;
 s.workOrdersById[wid]={id:wid,kind:'sr-crafting',recipeId:id,recipeVersion:version,recipeSnapshot:snapshot,personId:'person:master',targetId:b.instanceId,phase:'active',progressTicks,durationTicks,yield:snapshot.outputCount,cost:copy(snapshot.inputCost),sourceStockpileIds,reservationId:rid,slotReservationId:sid,activityId:aid,startedTick:s.worldTick,legacyPaid:!!legacy,resultFactId:null};
 s.reservationsById[rid]={id:rid,kind:'sr-craft-material',workOrderId:wid,cost:copy(snapshot.inputCost)};
 s.reservationsById[sid]={id:sid,kind:'sr-slot',personId:'person:master',activityId:aid,slotId:slot.id};
 s.activitiesById[aid]={id:aid,kind:'sr-craft',personId:'person:master',workOrderId:wid,targetId:b.instanceId,slotId:slot.id,phase:path.length?'moving':'working',reason:'前往丹炉工位，实际照料这一批药物。'};
 s.master.activityId=aid;sc.path=path;sc.goal=copy(slot.position);sc.revision=geometryRevision(s);return {id:wid,pending:true,durationTicks,progressTicks};
}
export function craftSR(s,id){initEconomy(s);const v=craftAvailabilitySR(s,id);if(!v.available)fail(v.reasons.join('；'));return createCraft(s,s.buildingsById[v.buildingId],id);}
function resumeLegacyCraft(s){const b=s.buildings.find(b=>b.type==='alchemy'&&b.enabled!==false&&b.condition>0&&!b.spatialLock);if(!b||!atHome(s,s.master)||s.master.activityId&&s.activitiesById[s.master.activityId]?.kind!=='facility'||!facilitySlots(s,b,'work').some(slot=>!slotReservation(s,slot.id)))return;const old=copy(s.crafting);try{createCraft(s,b,old.recipeId,{legacy:old});s.crafting=null;}catch{ /* Keep paid legacy progress, never fabricate completion or clear it. */ }}
function releaseCraft(s,w){delete s.reservationsById[w.reservationId];delete s.reservationsById[w.slotReservationId];delete s.activitiesById[w.activityId];if(s.master.activityId===w.activityId)s.master.activityId=null;s.master.scenic.path=[];s.master.scenic.goal=null;}
export function cancelCraftSR(s){
 const a=s.activitiesById[s.master.activityId],w=a?.kind==='sr-craft'&&s.workOrdersById[a.workOrderId];
 if(!w||w.phase!=='active')fail('没有正在进行的丹炉工序。');
 const refund={},refundStockpileIds={},refundTemporaryPlacements={};
 for(const [key,quantity] of Object.entries(w.cost)){
  const amount=quantity*(1-w.progressTicks/w.durationTicks),source=stock(s,w.sourceStockpileIds[key]);
  refund[key]=amount;
  if(total(source)+amount<=source.capacity+1e-9){source.resources[key]+=amount;refundStockpileIds[key]=source.id;continue;}
  const id=`stockpile:craft-refund:${w.id}:${key}`;
  if(s.stockpilesById[id])fail('丹炉退料暂存已存在。');
  const temporary={id,label:'丹炉退料暂存',sourceStockpileId:source.id,ownerId:source.ownerId,custodianId:source.custodianId,access:source.access,position:copy(position(s,source)),capacity:Math.max(1,amount),resources:zeros(),pills:pillZeros()};
  temporary.resources[key]=amount;s.stockpilesById[id]=temporary;refundStockpileIds[key]=id;
  refundTemporaryPlacements[key]={custodianId:temporary.custodianId,position:copy(temporary.position)};
 }
 w.phase='cancelled';w.finishedTick=s.worldTick;w.refund=refund;w.refundStockpileIds=refundStockpileIds;w.refundTemporaryPlacements=refundTemporaryPlacements;w.cancelRecordVersion='craft-cancel:v2';
 releaseCraft(s,w);
 ledger(s,`fact:craft-cancel:${w.id}`,{operation:'craft-cancel',actorId:w.personId,workOrderId:w.id,refund:copy(refund),refundStockpileIds:copy(refundStockpileIds),refundTemporaryPlacements:copy(refundTemporaryPlacements)});
 return {cancelled:true,refund};
}
function advanceCraft(s){const a=s.activitiesById[s.master.activityId],w=a?.kind==='sr-craft'&&s.workOrdersById[a.workOrderId];if(!w||w.phase!=='active')return;const b=s.buildingsById[w.targetId],slot=b&&facilitySlots(s,b,'work').find(slot=>slot.id===a.slotId);if(!atHome(s,s.master)||s.master.wound>20||s.master.energy<5||s.master.scenic.spatialEvacuationOrderId||!b||b.enabled===false||b.condition<=0||b.spatialLock||!slot){a.phase='paused';a.reason='身体、设施或工位暂不可用，保留投入与剩余工序。';return;}const sc=s.master.scenic;if(scenicDistance(sc,slot.position)>(s.spatial?.version==='spatial-metres-1'?.04:.5)){if(sc.revision!==geometryRevision(s)||!sc.path.length){const path=scenicFindPath(s,sc,slot.position,{maxSnap:s.spatial?.version==='spatial-metres-1'?.04:1});if(path===null){a.phase='blocked';a.reason='丹炉工位通路受阻，保留材料与进度。';return;}sc.path=path;sc.goal=copy(slot.position);sc.revision=geometryRevision(s);}advanceScenic(sc,4.6,s);syncScenicPosition(s,s.master);a.phase='moving';return;}a.phase='working';a.reason='掌门在独立丹炉工位实际照料药物。';w.progressTicks=Math.min(w.durationTicks,w.progressTicks+1);s.master.energy=Math.max(0,s.master.energy-.02);if(w.progressTicks<w.durationTicks)return;const fid=`fact:craft:${w.id}`;if(!s.factsById[fid]){try{grantPills(s,`stockpile:${b.instanceId}`,w.recipeSnapshot.recipeId,w.recipeSnapshot.outputCount,{factId:fid});}catch(error){a.reason=error.message;return;}s.stats.crafted++;Object.assign(s.factsById[fid],{count:w.recipeSnapshot.outputCount,workOrderId:w.id,cost:copy(w.recipeSnapshot.inputCost),recipeVersion:w.recipeSnapshot.recipeVersion});}w.phase='completed';w.resultFactId=fid;w.finishedTick=s.worldTick;releaseCraft(s,w);s.master.action='rest';}
export function settleEconomyDeath(s,personId){if(!s.srEconomy)return;const supply=s.srEconomy.marketSupply,run=personId===MARKET_CARRIER&&supply?.runs[supply.activeRunId];if(run&&run.phase!=='completed'){const travel=s.travelsById?.[run.travelId];if(travel?.status==='traveling')travel.status='blocked';run.reason='承运人身死，货款与货物留在最后实际货位，等待有权接续或取回。';}for(const w of Object.values(s.workOrdersById))if(w.kind==='transport'&&w.carrierId===personId&&!['delivered','cancelled'].includes(w.phase))cancelTransport(s,w.id);const p=s.personsById[personId],a=p&&s.activitiesById[p.activityId];if(a?.kind==='sr-merchant-collection'){const w=s.workOrdersById[a.workOrderId];if(w){w.phase=w.phase==='carrying'?'interrupted':'cancelled';w.reason='收货者身死，已付器物仍归其遗产且留在实际位置；未交付未付款保持原方。';w.finishedTick=s.worldTick;}delete s.activitiesById[a.id];p.activityId=null;}if(a?.kind==='sr-craft'){const w=s.workOrdersById[a.workOrderId];w.phase='interrupted';w.finishedTick=s.worldTick;releaseCraft(s,w);}if(a?.kind==='sr-replenish'){delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];p.activityId=null;}}
export function merchantPresent(s){if(s.srWorld){const p=s.personsById['person:merchant-qingxi'],loc=s.master.location;if(!loc||loc.kind!=='local'||p?.position?.kind!=='scene'||p.position.sceneId!==loc.sceneId)return false;const current=loc.sceneId==='scene:yunxiu-courtyard'?s.master.scenic:loc,target=p.position;return scenicDistance(current,target)<3;}return marketRouteOpen(s)&&s.worldTick>=s.srEconomy.merchantArrivalTick&&s.worldTick<s.srEconomy.merchantVisitEndsTick;}
export function marketTrade(s,resource,side,batches=1){initEconomy(s);if(!merchantPresent(s))fail('须亲自到商人身边，或等真实商队抵院后靠近交易。');const g=GOODS[resource],m=stock(s,'stockpile:qingxi'),home=stock(s,s.master.location?.sceneId==='scene:market'?'stockpile:sr-party':'stockpile:yunxiu');if(!g||!['buy','sell'].includes(side)||!Number.isSafeInteger(batches)||batches<1||batches>8)fail('交易参数无效。');const q=10*batches,price=g[side]*batches;if(side==='buy'){if(m.resources[resource]<q)fail('商人现货不足，补货须走实际可用道路。');if(home.resources.jade<price)fail('公库灵石不足。');if(total(m)-q+price>m.capacity)fail('商人货仓容量不足。');if(total(home)+q-price>home.capacity)fail('公库容量不足。');home.resources.jade-=price;m.resources.jade+=price;m.resources[resource]-=q;home.resources[resource]+=q;}else{if(home.resources[resource]<q)fail('公库可售物资不足；在途、个人和借器不可出售。');if(m.resources.jade<price)fail('商人本金不足，暂不收购。');if(total(m)+q-price>m.capacity||total(home)-q+price>home.capacity)fail('交付后仓储容量不足。');home.resources[resource]-=q;m.resources[resource]+=q;m.resources.jade-=price;home.resources.jade+=price;s.srEconomy.resaleInventory[resource]+=q;}
 const id=`fact:trade:${s.srEconomy.nextId++}`;ledger(s,id,{operation:side,merchantId:'faction:qingxi-market',resource,quantity:q,price});s.srEconomy.tradeHistory.push(id);s.stats.trades+=batches;return {id,quantity:q,price};}
export const ORDER_DEFINITIONS={gu_medicine:{name:'顾氏供药',cost:{herb:20},reward:{jade:24},rep:2},artisan_tools:{name:'百工用材',cost:{wood:20,stone:10},reward:{jade:30},rep:2},ghost_shelter:{name:'安息院灯火',cost:{wood:10,food:10},reward:{jade:18},rep:1}};
export function marketOrder(s,id,choice='accept',options={}){initEconomy(s);const def=ORDER_DEFINITIONS[id];if(!def)fail('订单不存在。');if(typeof choice!=='string')fail('订单动作无效。');let o=s.srEconomy.orders[id];if(choice.endsWith('-v2')||o?.version==='market-order:v2')return marketOrderV2(s,id,choice,options);if(['completed','declined'].includes(o?.phase))fail('该订单已结算或拒绝。');if(choice==='decline'){if(o?.phase==='accepted')for(const[k,v]of Object.entries(o.cargo))stock(s,o.sourceStockpileId||'stockpile:yunxiu').resources[k]+=v;s.srEconomy.orders[id]={id,phase:'declined',atTick:s.worldTick};delete s.reservationsById[`reservation:order:${id}`];return {phase:'declined'};}
 if(choice==='accept'){if(o) return copy(o);const sourceStockpileId=s.master.location?.sceneId==='scene:market'?'stockpile:sr-party':'stockpile:yunxiu',source=stock(s,sourceStockpileId);if(personScene(s,s.master)!==position(s,source).sceneId)fail('先到物资所在地点再接受交付约定。');for(const[k,v]of Object.entries(def.cost))if(source.resources[k]<v)fail('可用库存不足，不能与其他工单重复预留。');for(const[k,v]of Object.entries(def.cost))source.resources[k]-=v;o={id,phase:'accepted',sourceStockpileId,cargo:copy(def.cost),acceptedTick:s.worldTick,arrivalTick:s.worldTick+300};s.srEconomy.orders[id]=o;s.reservationsById[`reservation:order:${id}`]={id:`reservation:order:${id}`,kind:'trade-order',cost:copy(def.cost),orderId:id};return copy(o);}
 if(choice!=='deliver'||o?.phase!=='accepted')fail('先接受报价并预留货物。');if(!merchantPresent(s)||!marketRouteOpen(s)||s.worldTick<o.arrivalTick)fail('收货商队尚未实际到达；等待通路和交付时间。');const source=stock(s,o.sourceStockpileId||'stockpile:yunxiu');if(s.srWorld&&(personScene(s,s.master)!==position(s,source).sceneId||position(s,source).sceneId!==stock(s,'stockpile:qingxi').position.sceneId))fail('预留货物仍在原仓；取消后实际携带到场，再接受当地订单。');const m=stock(s,'stockpile:qingxi');if(total(m)+Object.values(o.cargo).reduce((a,b)=>a+b,0)-def.reward.jade>m.capacity||total(source)+def.reward.jade>source.capacity)fail('交付后仓储容量不足，保留预留。');if(m.resources.jade<def.reward.jade)fail('商人支付本金不足，保留货物预留。');for(const[k,v]of Object.entries(o.cargo)){m.resources[k]+=v;s.srEconomy.resaleInventory[k]+=v;}m.resources.jade-=def.reward.jade;stock(s,o.sourceStockpileId||'stockpile:yunxiu').resources.jade+=def.reward.jade;s.sect.reputation+=def.rep;o.phase='completed';o.resultTransactionId=`fact:order:${id}`;delete s.reservationsById[`reservation:order:${id}`];ledger(s,o.resultTransactionId,{operation:'order-delivery',orderId:id,cargo:copy(o.cargo),payment:copy(def.reward),reputation:def.rep});return copy(o);
}
// SR-XF-011-AC-01: a bounded home-to-market order uses three separately owned,
// positioned reserves and the existing master journey. Later routes and carriers
// require their own public offer and consent before this contract can widen.
const ORDER_V2='market-order:v2';
const ORDER_V2_ID='artisan_tools';
const ORDER_V2_SOURCE='stockpile:yunxiu';
const ORDER_V2_DESTINATION='stockpile:qingxi';
const ORDER_V2_PAYMENT='stockpile:market-order:artisan_tools:payment';
const ORDER_V2_CARGO='stockpile:market-order:artisan_tools:cargo';
const ORDER_V2_FREIGHT='stockpile:market-order:artisan_tools:freight';
const ORDER_V2_RESERVATION='reservation:market-order:v2:artisan_tools';
const ORDER_V2_ACCESS='source-access:v1';
const ORDER_V2_STOCK_LABELS={[ORDER_V2_CARGO]:'百工用材 · 公用随行货位',[ORDER_V2_PAYMENT]:'百工用材 · 商人付款',[ORDER_V2_FREIGHT]:'百工用材 · 承运口粮'};
// SR-XF-011 / R-16: restore the source warehouse's access for earlier active v2 reserves.
function upgradeMarketOrderAccessV2(s){
 const o=s.srEconomy.orders?.[ORDER_V2_ID];
 if(o?.version!==ORDER_V2||o.accessVersion||['completed','declined'].includes(o.phase)||o.phase==='cancelled'&&s.factsById[`fact:order-v2:recover:${o.id}`])return;
 const source=s.stockpilesById[o.sourceStockpileId],freightSource=s.stockpilesById[o.quote?.deliveryCostStockpileId],cargo=s.stockpilesById[o.cargoStockpileId],freight=s.stockpilesById[o.freightStockpileId];
 if(!source||!freightSource||!cargo||!freight||source.ownerId!==cargo.ownerId||freightSource.ownerId!==freight.ownerId||source.access!=='public'||freightSource.access!=='public'||!['private','public'].includes(cargo.access)||!['private','public'].includes(freight.access))return;
 cargo.access=source.access;freight.access=freightSource.access;o.accessVersion=ORDER_V2_ACCESS;
 ledger(s,`fact:order-v2:access-migration:${o.id}`,{operation:'order-access-migration',orderId:o.id,sourceStockpileIds:[source.id,freightSource.id],cargoStockpileIds:[cargo.id,freight.id],quantities:{cargo:copy(cargo.resources),freight:copy(freight.resources)}});
}
function orderV2ReserveLocked(s,id){const o=s.srEconomy?.orders?.[ORDER_V2_ID];return o?.version===ORDER_V2&&!['completed','cancelled','declined'].includes(o.phase)&&[o.cargoStockpileId,o.paymentStockpileId,o.freightStockpileId].includes(id);}
const localFeet=(s,p)=>{const feet=personFeet(s,p);return {sceneId:personScene(s,p),x:feet.x,y:feet.y};};
function marketOrderQuoteV2(s,id,options={}){
 if(id!==ORDER_V2_ID)fail('此跨场景报价尚未开放。');
 if(options&&typeof options!=='object'||Array.isArray(options))fail('订单参数无效。');
 const sourceStockpileId=options?.sourceStockpileId||ORDER_V2_SOURCE;
 const deliveryCostStockpileId=options?.deliveryCostStockpileId||sourceStockpileId;
 const carrierId=options?.carrierId||'person:master';
 if(sourceStockpileId!==ORDER_V2_SOURCE||deliveryCostStockpileId!==ORDER_V2_SOURCE||carrierId!=='person:master')fail('此报价只适用于云岫公库、掌门承运至青溪坊市。');
 if(personScene(s,s.master)!=='scene:yunxiu-courtyard'||s.master.location?.kind!=='local')fail('须在云岫别院查看本地发货报价。');
 const source=stock(s,sourceStockpileId),merchant=stock(s,ORDER_V2_DESTINATION);
 const plan=travelPreviewSR(s,'scene:market');
 if(!plan.reachable||plan.path?.length!==2||plan.path[0].id!=='route:home-valley'||plan.path[1].id!=='route:valley-market'||plan.cost.jade||plan.cost.crystal||plan.waitTicks)fail('当前路线不属于此报价；须另议承运条件。');
 const def=ORDER_DEFINITIONS[id],food=plan.path.reduce((n,part)=>n+part.cost,0);
 return {version:ORDER_V2,priceVersion:'artisan-tools:home-market:v1',orderId:id,sellerId:'person:master',buyerId:'person:merchant-qingxi',carrierId,sourceStockpileId,targetStockpileId:merchant.id,deliveryCostStockpileId,cargo:copy(def.cost),payment:copy(def.reward),reputation:def.rep,routeIds:plan.path.map(part=>part.id),routeFoodBySegment:plan.path.map(part=>part.cost),foodCost:food,tollJadeCap:0,earliestDeliverTick:s.worldTick+300,deadlineTick:s.worldTick+1500,quotedTick:s.worldTick};
}
function orderV2Stockpile(s,id,ownerId,custodianId,access,capacity,at){return s.stockpilesById[id]={id,ownerId,custodianId,access,capacity,position:copy(at),resources:zeros(),pills:pillZeros()};}
function orderV2Sync(s,o){
 const cargo=stock(s,o.cargoStockpileId),freight=stock(s,o.freightStockpileId),payment=stock(s,o.paymentStockpileId),merchant=stock(s,ORDER_V2_DESTINATION);
 payment.position=copy(merchant.position);
 if(o.pickupTick!==undefined){const at=s.master.location?.kind==='travel'?{kind:'travel',travelId:s.master.location.travelId}:localFeet(s,s.master);cargo.position=copy(at);freight.position=copy(at);}
 if(!o.travelId)return;
 const travel=s.travelsById[o.travelId];if(!travel)fail('订单承运旅程缺失。');
 if(travel.returning){o.phase='blocked';o.blockedReason='承运人沿原路返回，货物留在本人实际位置。';return;}
 let elapsed=travel.progressTicks||0;
 for(let i=o.chargedSegments;i<o.routeTravelTicks.length;i++){
  const boundary=o.routeTravelTicks.slice(0,i+1).reduce((n,v)=>n+v,0);
  if(elapsed<boundary&&travel.status!=='arrived')break;
  const food=o.quote.routeFoodBySegment[i];if(freight.resources.food<food)fail('订单承运口粮预约短缺。');
  freight.resources.food-=food;o.chargedSegments++;
  ledger(s,`fact:order-v2:route:${o.id}:${i+1}`,{operation:'order-route-food',orderId:o.id,travelId:o.travelId,routeId:o.quote.routeIds[i],sourceStockpileId:freight.id,quantity:food});
 }
 if(['traveling','blocked','waiting'].includes(travel.status)){
  o.phase=travel.status==='blocked'?'blocked':'in_transit';o.blockedReason=travel.status==='blocked'?travel.blockedReason:null;
 }else if(travel.status==='arrived'&&travel.destination==='scene:market'){
  o.phase='delivered';o.blockedReason=null;
 }else if(travel.status==='arrived'&&travel.destination!=='scene:market'){
  o.phase='blocked';o.blockedReason='承运旅程未抵达约定坊市。';
 }
}
function marketOrderV2(s,id,choice,options){
 const prior=s.srEconomy.orders[id];
 if(prior&&prior.version!==ORDER_V2)fail('此订单已有旧版约定，须按原约定结清。');
 if(choice==='quote-v2')return prior?copy(prior.quote):marketOrderQuoteV2(s,id,options);
 if(choice==='decline-v2'){
  if(prior)fail('已有约定须明确取消。');
  const quote=marketOrderQuoteV2(s,id,options);
  s.srEconomy.orders[id]={id,version:ORDER_V2,phase:'declined',quote,declinedTick:s.worldTick};
  return {phase:'declined'};
 }
 if(choice==='accept-v2'){
  if(prior)fail('此订单已有约定，不能再次接单。');
  const quote=marketOrderQuoteV2(s,id,options),source=stock(s,quote.sourceStockpileId),buyer=stock(s,quote.targetStockpileId),freightSource=stock(s,quote.deliveryCostStockpileId);
  if(source.ownerId!=='person:master'||source.access!=='public'||freightSource.ownerId!=='person:master'||freightSource.access!=='public')fail('卖方货仓或运费仓产权不符。');
  if(Object.entries(quote.cargo).some(([k,v])=>source.resources[k]<v)||freightSource.resources.food<quote.foodCost)fail('货物或运费口粮不足，不能预留。');
  if(buyer.resources.jade<quote.payment.jade)fail('商人付款本金不足，不能预留。');
  if(s.personsById[quote.buyerId]?.lifeStatus==='dead'||s.master.lifeStatus==='dead')fail('交易一方无法履约。');
  if(Object.values(quote.cargo).reduce((n,v)=>n+v,0)>40)fail('承运货物超过本趟四十份。');
  for(const[k,v]of Object.entries(quote.cargo))source.resources[k]-=v;
  freightSource.resources.food-=quote.foodCost;buyer.resources.jade-=quote.payment.jade;
  const cargo=orderV2Stockpile(s,ORDER_V2_CARGO,quote.sellerId,quote.sellerId,source.access,40,position(s,source));
  const payment=orderV2Stockpile(s,ORDER_V2_PAYMENT,quote.buyerId,quote.buyerId,'merchant',quote.payment.jade,position(s,buyer));
  const freight=orderV2Stockpile(s,ORDER_V2_FREIGHT,quote.sellerId,quote.sellerId,freightSource.access,quote.foodCost,position(s,freightSource));
  for(const[k,v]of Object.entries(quote.cargo))cargo.resources[k]=v;
  payment.resources.jade=quote.payment.jade;freight.resources.food=quote.foodCost;
  const o={id,version:ORDER_V2,phase:'accepted',quote,sourceStockpileId:source.id,targetStockpileId:buyer.id,cargoStockpileId:cargo.id,paymentStockpileId:payment.id,freightStockpileId:freight.id,carrierId:quote.carrierId,accessVersion:ORDER_V2_ACCESS,acceptedTick:s.worldTick,chargedSegments:0,routeTravelTicks:[],travelId:null,deadlineClockVersion:'passable-window:v1',passableTicks:0,pausedTicks:0,pauseSpans:[],lastDeadlineTick:s.worldTick};
  s.srEconomy.orders[id]=o;s.reservationsById[ORDER_V2_RESERVATION]={id:ORDER_V2_RESERVATION,kind:'sr-market-order-v2',orderId:id,cargoStockpileId:cargo.id,paymentStockpileId:payment.id,freightStockpileId:freight.id};
  ledger(s,`fact:order-v2:accept:${id}`,{operation:'order-reserve',orderId:id,cargo:copy(quote.cargo),payment:copy(quote.payment),food:quote.foodCost,sourceStockpileId:source.id,paymentSourceStockpileId:buyer.id,freightSourceStockpileId:freightSource.id});
  return copy(o);
 }
 if(!prior)fail('先接单并预留双方货款。');
 const o=prior;
 if(choice==='recover-v2'){
  if(o.phase!=='cancelled'||!o.cancelledAfterPickup||s.master.location?.kind!=='local')fail('须在取消后到承运货物所在地点取回。');
  const cargo=stock(s,o.cargoStockpileId),freight=stock(s,o.freightStockpileId),at=position(s,cargo);
  if(s.factsById[`fact:order-v2:recover:${id}`])fail('此订单货物已取回。');
  if(cargo.carrierId!==o.carrierId||freight.carrierId!==o.carrierId||cargo.access!=='public'||freight.access!=='public'||at.sceneId!==s.master.location.sceneId||position(s,freight).sceneId!==at.sceneId||scenicDistance(personFeet(s,s.master),at)>1.5)fail('承运公物与本人不在同一实际地点。');
  const goods=Object.fromEntries(Object.keys(o.quote.cargo).map(k=>[k,cargo.resources[k]])),food=freight.resources.food,quantity=Object.values(goods).reduce((n,v)=>n+v,0)+food;
  if(quantity<=0)fail('此订单货物已取回。');if(total(cargo)+food>cargo.capacity)fail('公用随行货位容量不足，保留原位物资。');
  // The public cargo holding follows its named carrier after the order closes.
  freight.resources.food=0;cargo.resources.food+=food;
  ledger(s,`fact:order-v2:recover:${id}`,{operation:'order-v2-recover',orderId:id,carrierId:o.carrierId,sourceStockpileIds:[cargo.id,freight.id],targetStockpileId:cargo.id,cargo:goods,food});
  return {recovered:true,targetStockpileId:cargo.id,cargo:goods,food};
 }
 if(['completed','declined','cancelled'].includes(o.phase))fail('此订单已经结束。');
 orderV2Sync(s,o);advanceOrderV2Deadline(s,o);advanceOrderV2MerchantResponse(s,o);advanceOrderV2Amendment(s,o);
 if(choice==='agree-amend-v2'){
  if(o.merchantResponse?.decision!=='renegotiate'||o.amendment)fail('当前没有可同意的改约报价。');
  if(s.master.location?.sceneId!=='scene:market'||!merchantPresent(s))fail('须在青溪坊市当面同意改约。');
  o.amendment={acceptedTick:s.worldTick,lastTick:s.worldTick,passableTicks:0,pausedTicks:0,pauseSpans:[]};
  ledger(s,`fact:order-v2:amend:${id}`,{operation:'order-v2-amend-accepted',orderId:id,buyerId:o.quote.buyerId,sellerId:o.quote.sellerId,responseFactId:`fact:order-v2:response:${id}`,extraPassableTicks:ORDER_V2_AMEND_WINDOW,payment:copy(o.quote.payment),fee:0,penalty:0});
  return copy(o);
 }
 if(['pickup-v2','depart-v2'].includes(choice)&&(o.merchantResponse?.decision==='refuse'||o.amendment?.expiredTick!==undefined))fail('周行舟已拒收本单；先明确取消，保留卖方货物与剩余运费。');
 if(choice==='pickup-v2'){
  if(o.pickupTick!==undefined)fail('货物已由承运人取走。');
  if(o.phase!=='accepted'||s.master.activityId||s.srWorld.activeTravelId||s.master.lifeStatus==='dead')fail('掌门当前不能取货。');
  const source=stock(s,o.sourceStockpileId),at=position(s,source);
  if(personScene(s,s.master)!==at.sceneId||scenicDistance(personFeet(s,s.master),at)>(s.spatial?.version==='spatial-metres-1'?1.5:48))fail('承运人须实际到货仓接货。');
  const feet=localFeet(s,s.master);for(const st of [stock(s,o.cargoStockpileId),stock(s,o.freightStockpileId)]){st.carrierId=o.carrierId;st.custodianId=o.carrierId;st.position=copy(feet);}o.pickupTick=s.worldTick;
  ledger(s,`fact:order-v2:pickup:${id}`,{operation:'order-pickup',orderId:id,carrierId:o.carrierId,cargoStockpileId:o.cargoStockpileId,freightStockpileId:o.freightStockpileId,position:copy(feet)});
  return copy(o);
 }
 if(choice==='depart-v2'){
  if(o.phase!=='accepted'||o.pickupTick===undefined||o.travelId)fail('先由具名承运人实际取货。');
  if(s.master.location?.sceneId!=='scene:yunxiu-courtyard')fail('承运人须从约定来源出发。');
  const plan=travelPreviewSR(s,'scene:market');
  if(!plan.reachable)fail('订单路线中断，保留各方预留。');
  if(JSON.stringify(plan.path.map(p=>p.id))!==JSON.stringify(o.quote.routeIds)||plan.cost.food!==o.quote.foodCost||plan.cost.jade||plan.cost.crystal||plan.waitTicks)fail('实际路线费用已变；须重新协商运费。');
  const home=stock(s,o.sourceStockpileId),freight=stock(s,o.freightStockpileId);
  if(freight.resources.food<plan.cost.food)fail('运费预留不足。');
  // The world journey checks its normal local payer. Bridge the already owned
  // reserve for that check, then debit the dedicated bin as each leg is walked.
  home.resources.food+=plan.cost.food;
  let travel;try{travel=travelSR(s,'scene:market',{cargo:{}});}catch(error){home.resources.food-=plan.cost.food;throw error;}
  o.travelId=travel.id;o.routeTravelTicks=plan.path.map(p=>p.travelTicks);o.phase='in_transit';
  for(const st of [stock(s,o.cargoStockpileId),freight])st.position={kind:'travel',travelId:travel.id};
  ledger(s,`fact:order-v2:depart:${id}`,{operation:'order-depart',orderId:id,carrierId:o.carrierId,travelId:travel.id,routeIds:copy(o.quote.routeIds),cargoStockpileId:o.cargoStockpileId});
  return copy(o);
 }
 if(choice==='deliver-v2'){
  if(o.phase!=='delivered'||s.master.location?.sceneId!=='scene:market'||!merchantPresent(s)||s.personsById[o.quote.buyerId].lifeStatus==='dead')fail('双方须在青溪坊市同场验货。');
  if(o.merchantResponse?.decision==='refuse'||o.amendment?.expiredTick!==undefined)fail('周行舟已拒收本单；货款保持原产权，可明确取消。');
  if(o.merchantResponse?.decision==='renegotiate'&&!o.amendment)fail('周行舟提出改约，须当面同意后才能交付。');
  if(s.worldTick<o.quote.earliestDeliverTick)fail('尚未到约定最早交付时刻。');
  // The vacated public cargo holding receives payment at the actual market position.
  const cargo=stock(s,o.cargoStockpileId),payment=stock(s,o.paymentStockpileId),freight=stock(s,o.freightStockpileId),buyer=stock(s,o.targetStockpileId),seller=cargo;
  if(Object.entries(o.quote.cargo).some(([k,v])=>cargo.resources[k]!==v)||payment.resources.jade!==o.quote.payment.jade)fail('货物或付款预留不完整。');
  const cargoCount=Object.values(o.quote.cargo).reduce((n,v)=>n+v,0),refund=freight.resources.food;
  if(total(buyer)+cargoCount>buyer.capacity||total(seller)-cargoCount+o.quote.payment.jade+refund>seller.capacity)fail('收货或收款货位容量不足。');
  for(const[k,v]of Object.entries(o.quote.cargo)){cargo.resources[k]=0;buyer.resources[k]+=v;s.srEconomy.resaleInventory[k]+=v;}
  payment.resources.jade=0;seller.resources.jade+=o.quote.payment.jade;freight.resources.food=0;seller.resources.food+=refund;s.sect.reputation+=o.quote.reputation;
  o.phase='completed';o.completedTick=s.worldTick;o.freightRefundStockpileId=seller.id;o.resultTransactionId=`fact:order-v2:complete:${id}`;delete s.reservationsById[ORDER_V2_RESERVATION];
  closeOrderV2AmendPause(o);
  ledger(s,o.resultTransactionId,{operation:'order-v2-complete',orderId:id,travelId:o.travelId,cargo:copy(o.quote.cargo),payment:copy(o.quote.payment),reputation:o.quote.reputation,sourceStockpileId:cargo.id,targetStockpileId:buyer.id,paymentSourceStockpileId:payment.id,paymentTargetStockpileId:seller.id,freightRefund:refund});
  return copy(o);
 }
 if(choice==='cancel-v2'){
  if(o.travelId&&s.srWorld.activeTravelId===o.travelId)fail('承运人仍在路上，须先到合法落点再取消。');
  const source=stock(s,o.sourceStockpileId),cargo=stock(s,o.cargoStockpileId),freight=stock(s,o.freightStockpileId),payment=stock(s,o.paymentStockpileId),buyer=stock(s,o.targetStockpileId),beforePickup=o.pickupTick===undefined;
  if(beforePickup){for(const[k,v]of Object.entries(o.quote.cargo))if(cargo.resources[k]!==v)fail('货物预留不完整。');const freightSource=stock(s,o.quote.deliveryCostStockpileId),needed=Object.values(o.quote.cargo).reduce((n,v)=>n+v,0)+freight.resources.food;
   if(source.id===freightSource.id&&total(source)+needed<=source.capacity){for(const[k,v]of Object.entries(o.quote.cargo)){cargo.resources[k]=0;source.resources[k]+=v;}const food=freight.resources.food;freight.resources.food=0;freightSource.resources.food+=food;o.freightRefundStockpileId=freightSource.id;}
   else o.cancelledAtSourceRetained=true;
  }
  const unpaid=payment.resources.jade;if(unpaid!==o.quote.payment.jade)fail('商人付款预留不完整。');if(total(buyer)+unpaid<=buyer.capacity){payment.resources.jade=0;buyer.resources.jade+=unpaid;o.paymentReturnStockpileId=buyer.id;}else o.paymentReturnStockpileId=payment.id;
  o.phase='cancelled';o.cancelledTick=s.worldTick;o.cancelledAfterPickup=!beforePickup;o.cancelledCargo=copy(cargo.resources);o.cancelledFreight=freight.resources.food;delete s.reservationsById[ORDER_V2_RESERVATION];
  closeOrderV2Pause(o);
  closeOrderV2AmendPause(o);
  ledger(s,`fact:order-v2:cancel:${id}`,{operation:'order-v2-cancel',orderId:id,afterPickup:!beforePickup,cargoStockpileId:cargo.id,cargo:copy(o.cancelledCargo),cargoRetainedAtSource:!!o.cancelledAtSourceRetained,paymentReturnedTo:o.paymentReturnStockpileId,freightStockpileId:freight.id,unspentFreight:o.cancelledFreight,freightRefundStockpileId:o.freightRefundStockpileId||null,travelId:o.travelId});
  return copy(o);
 }
 fail('订单动作无效。');
}
const ORDER_V2_WINDOW=1200;
const ORDER_V2_AMEND_WINDOW=300;
function closeOrderV2Pause(o){const span=o.pauseSpans?.at(-1);if(span&&!Number.isSafeInteger(span.endTick))span.endTick=o.lastDeadlineTick;}
function orderV2PauseReasons(s,o){
 const reasons=[];
 for(const id of o.quote.routeIds)if(s.routesById?.[id]?.condition==='blocked')reasons.push(`road:${id}`);
 const buyer=s.personsById[o.quote.buyerId];
 if(!buyer||buyer.lifeStatus==='dead'||buyer.wound>20||buyer.energy<10)reasons.push('merchant:incapacitated');
 else if(buyer.position?.kind!=='scene'||buyer.position.sceneId!=='scene:market')reasons.push('merchant:away');
 const warehouse=stock(s,o.targetStockpileId),cargoCount=Object.values(o.quote.cargo).reduce((n,v)=>n+v,0);
 if(position(s,warehouse)?.sceneId!=='scene:market'||total(warehouse)+cargoCount>warehouse.capacity)reasons.push('warehouse:unavailable');
 return reasons;
}
function advanceOrderV2Deadline(s,o){
 // Earlier v2 saves had no running clock. Their already accepted terms remain
 // payable without a newly imposed retroactive breach.
 if(o.deadlineClockVersion!=='passable-window:v1'||o.breachTick!==undefined)return;
 if(s.worldTick<=o.lastDeadlineTick||s.worldTick<=o.quote.earliestDeliverTick)return;
 for(let tick=Math.max(o.lastDeadlineTick+1,o.quote.earliestDeliverTick+1);tick<=s.worldTick;tick++){
  const reasons=orderV2PauseReasons(s,o),key=reasons.join('|'),open=o.pauseSpans.at(-1);
  if(reasons.length){
   if(open&&!Number.isSafeInteger(open.endTick)&&open.reasons.join('|')!==key)closeOrderV2Pause(o);
   if(!o.pauseSpans.length||Number.isSafeInteger(o.pauseSpans.at(-1).endTick))o.pauseSpans.push({startTick:tick,reasons,pausedTicks:0});
   o.pauseSpans.at(-1).pausedTicks++;o.pausedTicks++;
  }else{
   if(open&&!Number.isSafeInteger(open.endTick))closeOrderV2Pause(o);
   o.passableTicks++;
   if(o.passableTicks>ORDER_V2_WINDOW){
    o.breachTick=tick;
    ledger(s,`fact:order-v2:breach:${o.id}`,{operation:'order-v2-seller-breach',orderId:o.id,sellerId:o.quote.sellerId,buyerId:o.quote.buyerId,earliestDeliverTick:o.quote.earliestDeliverTick,passableTicks:o.passableTicks,pausedTicks:o.pausedTicks,pausedReasons:copy(o.pauseSpans),source:'accepted quoted delivery window elapsed while road, merchant and warehouse were available'});
   }
  }
  o.lastDeadlineTick=tick;
  if(o.breachTick!==undefined)break;
 }
}
function orderV2MerchantReason(decision){return decision==='continue'?'货物已在周行舟面前，验货仍有利可图。':decision==='renegotiate'?'周行舟尚未见到货，木石现货低于两单备货量（木 40、石 20），愿按原价再等 300 个可履约世界步。':'周行舟尚未见到货，现有木石达到两单备货量（木 40、石 20），决定拒收。';}
function advanceOrderV2MerchantResponse(s,o){
 if(o.breachTick===undefined||o.merchantResponse)return;
 if(orderV2PauseReasons(s,o).length)return;
 const buyer=s.personsById[o.quote.buyerId],warehouse=stock(s,o.targetStockpileId),cargo=stock(s,o.cargoStockpileId),at=position(s,cargo);
 const cargoVisible=buyer?.position?.kind==='scene'&&at?.sceneId===buyer.position.sceneId&&scenicDistance(at,buyer.position)<3;
 const merchantStock={wood:warehouse.resources.wood,stone:warehouse.resources.stone};
 // Author default: less than two comparable orders of either material leaves
 // too little trade buffer for this merchant to refuse a late seller outright.
 const short=Object.entries(o.quote.cargo).some(([resource,quantity])=>merchantStock[resource]<quantity*2);
 const decision=cargoVisible?'continue':short?'renegotiate':'refuse';
 const reason=orderV2MerchantReason(decision);
 o.merchantResponse={decision,decidedTick:s.worldTick,breachFactId:`fact:order-v2:breach:${o.id}`,merchantId:o.quote.buyerId,cargoVisible,cargoSceneId:at?.sceneId||null,merchantStock,chargedSegmentsAtDecision:o.chargedSegments,reason,costs:{grossPaymentJade:o.quote.payment.jade,extraFeeJade:0,penaltyJade:0,spentFoodAtDecision:o.quote.routeFoodBySegment.slice(0,o.chargedSegments).reduce((n,v)=>n+v,0)},terms:decision==='renegotiate'?{extraPassableTicks:ORDER_V2_AMEND_WINDOW,payment:copy(o.quote.payment),fee:0,penalty:0}:null};
 ledger(s,`fact:order-v2:response:${o.id}`,{operation:'order-v2-merchant-response',orderId:o.id,...copy(o.merchantResponse)});
}
function closeOrderV2AmendPause(o){const a=o.amendment,span=a?.pauseSpans.at(-1);if(span&&!Number.isSafeInteger(span.endTick))span.endTick=a.lastTick;}
function advanceOrderV2Amendment(s,o){
 const a=o.amendment;if(!a||a.expiredTick!==undefined||s.worldTick<=a.lastTick)return;
 for(let tick=a.lastTick+1;tick<=s.worldTick;tick++){
  const reasons=orderV2PauseReasons(s,o),key=reasons.join('|'),open=a.pauseSpans.at(-1);
  if(reasons.length){
   if(open&&!Number.isSafeInteger(open.endTick)&&open.reasons.join('|')!==key)closeOrderV2AmendPause(o);
   if(!a.pauseSpans.length||Number.isSafeInteger(a.pauseSpans.at(-1).endTick))a.pauseSpans.push({startTick:tick,reasons,pausedTicks:0});
   a.pauseSpans.at(-1).pausedTicks++;a.pausedTicks++;
  }else{
   if(open&&!Number.isSafeInteger(open.endTick))closeOrderV2AmendPause(o);
   a.passableTicks++;
   if(a.passableTicks>ORDER_V2_AMEND_WINDOW){
    a.expiredTick=tick;
    ledger(s,`fact:order-v2:amend-expired:${o.id}`,{operation:'order-v2-amend-expired',orderId:o.id,merchantId:o.quote.buyerId,passableTicks:a.passableTicks,pausedTicks:a.pausedTicks,source:'seller exceeded explicitly accepted extra delivery window'});
   }
  }
  a.lastTick=tick;if(a.expiredTick!==undefined)break;
 }
}
function marketRouteOpen(s){const routes=s.srWorld?.routes;return !routes||Object.values(routes).every(r=>!r.id?.includes('bridge')||!['closed','blocked'].includes(r.condition));}
function prepareMerchantCollection(s,b,order,payment){const p=s.personsById['person:merchant-qingxi'],id=`work:merchant-collection:${b.instanceId}:${order.batch}`,prior=s.workOrdersById[id],target=stockAccess(s,stock(s,`stockpile:${b.instanceId}`));if(prior?.phase==='waiting-for-goods'&&target&&atHome(s,p)&&close(s,p.mind.scenic,target)&&s.activitiesById[p.activityId]?.workOrderId===id)return true;if(prior&&!['cancelled','delivered'].includes(prior.phase)||prior?.phase==='cancelled'&&prior.cancelledVisitTick===s.srEconomy.merchantArrivalTick)return false;if(!workshopBuyerAvailable(s)||p.activityId||p.wound>20||p.energy<10)return false;if(!target)return false;const path=scenicFindPath(s,p.mind.scenic,target,{maxSnap:0});if(path===null)return false;const aid=`activity:merchant-collection:${s.srEconomy.nextId++}`;s.workOrdersById[id]={id,kind:'sr-merchant-collection',carrierId:p.personId,targetId:b.instanceId,sourceStockpileId:`stockpile:${b.instanceId}`,productionWorkOrderId:order.id,productionBatch:order.batch,productionSnapshot:{id:order.id,batch:order.batch,buildingId:b.instanceId,recipeId:`recipe:${b.type}:v1`,sourceStockpileId:`stockpile:${b.instanceId}`},activityId:aid,phase:'to-source',startedTick:s.worldTick,expectedPayment:payment,reason:'商人先沿院中实际路径到工坊取货。'};s.activitiesById[aid]={id:aid,kind:'sr-merchant-collection',personId:p.personId,workOrderId:id,phase:'moving',reason:'实际步行到工坊验货付款。'};p.activityId=aid;p.mind.scenic.path=path;p.mind.scenic.goal=copy(target);p.mind.scenic.revision=geometryRevision(s);return false;}
export function cancelMerchantCollection(s,id){const w=s.workOrdersById[id];if(w?.kind!=='sr-merchant-collection'||['delivered','cancelled'].includes(w.phase)||w.phase==='carrying')fail('此收货约定不存在、已结束或已经付费取货。');const p=s.personsById[w.carrierId];delete s.activitiesById[p.activityId];p.activityId=null;p.mind.scenic.path=[];p.mind.scenic.goal=null;w.phase='cancelled';w.cancelledVisitTick=s.srEconomy.merchantArrivalTick;w.reason='未交付器物和未付款均保留原方；可在下一次真实到访重新商议。';return {cancelled:true};}
function advanceMerchantCollection(s,p,a){const w=s.workOrdersById[a.workOrderId],sc=p.mind.scenic;if(!w||['delivered','cancelled','interrupted'].includes(w.phase)){delete s.activitiesById[a.id];p.activityId=null;return;}if(p.wound>20||p.energy<5||sc.spatialEvacuationOrderId){w.reason='本人受伤、精力不足或实际撤离，收货身体活动暂停。';return;}if(w.phase==='waiting-for-goods'){w.reason='商人已到工坊，等待完整器物实际结算后付款取货。';return;}const endpoint=stock(s,w.phase==='carrying'?'stockpile:yunxiu':w.sourceStockpileId);if(endpoint.buildingId&&s.buildingsById[endpoint.buildingId]?.spatialLock){w.reason='收货或返程位置正在迁建，保留身体活动。';return;}const target=stockAccess(s,endpoint);if(!target){w.reason='收货位置无合法接触点，保留约定。';return;}if(!close(s,sc,target)){if(sc.revision!==geometryRevision(s)||!sc.path.length||!sc.goal||scenicDistance(sc.goal,target)>.01){const path=scenicFindPath(s,sc,target,{maxSnap:0});if(path===null){w.reason='收货通路中断，清出路径或取消未交付约定。';return;}sc.path=path;sc.goal=copy(target);sc.revision=geometryRevision(s);}advanceScenic(sc,4.6,s);p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:sc.x,y:sc.y};s.stockpilesById['stockpile:qingxi'].position={sceneId:'scene:yunxiu-courtyard',x:sc.x,y:sc.y};p.energy=Math.max(0,p.energy-.003);return;}if(w.phase==='to-source'){w.phase='waiting-for-goods';a.phase='waiting';return;}w.phase='delivered';w.completedTick=s.worldTick;w.reason='已携已买器物回商队；可随后沿实际世界行程返坊市。';ledger(s,`fact:merchant-collection:${w.id}`,{operation:'merchant-collection',actorId:p.personId,sourceStockpileId:w.sourceStockpileId,targetStockpileId:'stockpile:qingxi',productionBatch:w.productionBatch,paid:w.actualPayment});delete s.activitiesById[a.id];p.activityId=null;sc.path=[];sc.goal=null;}
function advanceMerchant(s){
 if(!s.srWorld)return;const e=s.srEconomy,p=s.personsById['person:merchant-qingxi'],st=s.stockpilesById['stockpile:qingxi'];if(!p||p.lifeStatus==='dead')return;const body=s.activitiesById[p.activityId];if(body?.kind==='sr-merchant-collection'){advanceMerchantCollection(s,p,body);return;}if(body)return;
 // A previous collection can leave the merchant below the next collection's
 // energy gate. Recovery happens only after this tick remains idle in one scene.
 const idleSceneId=p.position?.kind==='scene'?p.position.sceneId:null;
 e.merchantSchedulePhase??=p.position?.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard'?'home':s.worldTick<e.merchantVisitEndsTick?'arriving':'market';
 if(e.merchantSchedulePhase==='home'&&s.worldTick>=e.merchantVisitEndsTick){e.merchantSchedulePhase='leaving';e.merchantJourneyId=null;}
 if(e.merchantSchedulePhase==='market'&&s.worldTick>=e.merchantArrivalTick-300&&s.worldTick<e.merchantVisitEndsTick){e.merchantSchedulePhase='arriving';e.merchantJourneyId=null;}
 if(['arriving','leaving'].includes(e.merchantSchedulePhase)){
 const arriving=e.merchantSchedulePhase==='arriving';s.travelsById??={};if(!e.merchantJourneyId){const begin=arriving?Math.max(0,e.merchantArrivalTick-300):s.worldTick;e.merchantJourneyId=`travel:merchant:${arriving?'in':'out'}:${begin}`;s.travelsById[e.merchantJourneyId]={id:e.merchantJourneyId,kind:'merchant-travel',participantIds:[p.personId],sourceSceneId:arriving?'scene:market':'scene:yunxiu-courtyard',destinationSceneId:arriving?'scene:yunxiu-courtyard':'scene:market',startedTick:begin,durationTicks:300,progressTicks:0,cargoStockpileId:st.id,status:'traveling',lastStepTick:begin};}
 const t=s.travelsById[e.merchantJourneyId];p.position={kind:'worldTravel',travelId:t.id};st.position={kind:'travel',travelId:t.id};if(!marketRouteOpen(s)){t.status='blocked';t.lastStepTick=s.worldTick;return;}t.status='traveling';if(t.lastStepTick<s.worldTick){t.progressTicks=Math.min(t.durationTicks,t.progressTicks+1);t.lastStepTick=s.worldTick;}if(t.progressTicks<t.durationTicks)return;t.status='completed';t.completedTick=s.worldTick;e.merchantJourneyId=null;
 if(arriving){e.merchantSchedulePhase='home';e.merchantArrivalTick=s.worldTick;e.merchantVisitEndsTick=s.worldTick+900;ledger(s,`fact:merchant-arrival:${t.id}`,{operation:'merchant-arrival',actorId:p.personId,targetStockpileId:st.id});}else e.merchantSchedulePhase='market';}
 if(e.merchantSchedulePhase==='home'){const hallBuilding=s.buildings.find(b=>b.type==='hall'),hall=buildingAccess(s,hallBuilding),sc=p.mind?.scenic,upgrade=s.workOrdersById?.[hallBuilding?.spatialLock];
  // Keep the visitor and their stockpile at the feet actually reached during an active hall expansion.
  if(upgrade?.operation==='upgrade'&&sc&&p.position?.sceneId==='scene:yunxiu-courtyard')p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:sc.x,y:sc.y};
  else{const q=scenicNearest(s,{x:hall.x+(s.spatial?.version==='spatial-metres-1'?2:64),y:hall.y});p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:q?.x??hall.x,y:q?.y??hall.y};if(sc)Object.assign(sc,{x:p.position.x,y:p.position.y,path:[],goal:null});}
  st.position={sceneId:'scene:yunxiu-courtyard',x:p.position.x,y:p.position.y};if(idleSceneId===p.position.sceneId)p.energy=Math.min(100,p.energy+.3);return;}
 p.position={kind:'scene',sceneId:'scene:market',x:37,y:25};st.position={sceneId:'scene:market',x:37,y:25};if(idleSceneId===p.position.sceneId)p.energy=Math.min(100,p.energy+.3);
}
/** External cash is a persistent finite customer's payment for actual resold cargo, never a periodic grant. */
function settleWholesale(s){const e=s.srEconomy,w=e.wholesale,m=stock(s,'stockpile:qingxi'),customer=stock(s,'stockpile:wholesale-treasury');if(s.worldTick<w.nextMarketTick||!marketRouteOpen(s)||s.srWorld&&s.personsById['person:merchant-qingxi'].position?.sceneId!=='scene:market')return;
 if(s.worldTick-w.windowStartedTick>=WHOLESALE_DEFINITION.periodTicks){w.windowStartedTick=s.worldTick;w.windowSpent=0;}let budget=Math.min(WHOLESALE_DEFINITION.periodBudget-w.windowSpent,customer.resources.jade,Math.max(0,m.capacity-total(m))),cargo={},payment=0,toolkits=[];
 for(const resource of ['wood','stone','herb','crystal','food','insight']){const rate=GOODS[resource].buy/10,q=Math.min(WHOLESALE_DEFINITION.maximumUnitsPerGood,e.resaleInventory[resource],m.resources[resource],Math.floor(budget/rate));if(q<=0)continue;m.resources[resource]-=q;e.resaleInventory[resource]-=q;cargo[resource]=q;const p=q*rate;budget-=p;payment+=p;}
 for(const g of e.commonGoods){if(g.phase!=='stocked')continue;const price=g.costPaid*WHOLESALE_DEFINITION.toolkitMargin;if(price>budget)continue;g.phase='delivered';g.ownerId='person:wholesale-buyer';g.stockpileId=customer.id;g.deliveredTick=s.worldTick;g.buyerId='person:wholesale-buyer';toolkits.push(g.id);budget-=price;payment+=price;}
 if(payment>0){customer.resources.jade-=payment;m.resources.jade+=payment;w.windowSpent+=payment;w.spentLifetime+=payment;const id=`fact:wholesale:${s.worldTick}`;ledger(s,id,{operation:'wholesale-delivery',actorId:'person:merchant-qingxi',buyerId:'person:wholesale-buyer',sourceStockpileId:m.id,paymentSourceStockpileId:customer.id,payment,cargo,toolkitIds:toolkits,source:'finite regional customer treasury; actual consumed/delivered goods'});for(const[k,v]of Object.entries(cargo))customer.resources[k]+=v;}
 w.nextMarketTick=s.worldTick+WHOLESALE_DEFINITION.periodTicks;
}
function marketSupplyReason(s){
 const m=stock(s,'stockpile:qingxi'),source=stock(s,MARKET_SUPPLIER_STOCK),merchant=s.personsById['person:merchant-qingxi'],clerk=s.personsById[MARKET_SUPPLIER],carrier=s.personsById[MARKET_CARRIER];
 if(!marketRouteOpen(s))return '石桥路段不能通行，供货车与货物在原位置等待；山院仍可实际采集基本材料。';
 if(merchant?.lifeStatus!=='alive'||clerk?.lifeStatus!=='alive'||carrier?.lifeStatus!=='alive')return '交易或承运当事人已失能，原货物和预留款保持原位置。';
 if(carrier.wound>20||carrier.energy<5||carrier.activityId)return '承运人受伤、疲乏或有其他身体活动，尚不能预留新供货；恢复后可继续报价。';
 if(!MARKET_SOURCE_GOODS.some(k=>source.resources[k]>0))return '青溪供货仓的实物来源已用尽。';
 if(m.resources.food<6)return `商人路粮不足：出发须先从其现货预留6口粮，当前${m.resources.food}；可从山院实际采粮后当面售给商人。`;
 if(m.resources.jade<2)return '商人本金不足以预留关口费和购货款。';
 if(total(m)>=m.capacity)return '商人货仓已满，须先实际售出或转走货物。';
 if(merchant.position?.sceneId!=='scene:market')return '商人尚未实际回到坊市，不能从远处接收供货。';
 return null;
}
function quoteMarketSupply(s){
 const e=s.srEconomy,m=stock(s,'stockpile:qingxi'),source=stock(s,MARKET_SUPPLIER_STOCK),state=e.marketSupply;
 if(s.worldTick<e.nextMarketSourceQuoteTick||state.activeRunId||state.queue.length)return;
 const reason=marketSupplyReason(s);if(reason){state.lastReason=reason;return;}
 const left=Object.fromEntries(MARKET_SOURCE_GOODS.map(k=>[k,Math.min(20,source.resources[k])])),plans=[];
 let cash=m.resources.jade,food=m.resources.food,capacity=m.capacity-total(m);
 while(MARKET_SOURCE_GOODS.some(k=>left[k]>0)&&food>=6&&capacity>0){
  const cargo={},room=Math.min(40,capacity);let used=0;
  for(const k of MARKET_SOURCE_GOODS){const q=Math.min(left[k],room-used);if(q>0){cargo[k]=q;used+=q;}if(used>=room)break;}
  if(!used)break;
  const price=Object.entries(cargo).reduce((n,[k,q])=>n+q*GOODS[k].sell/10,0);
  if(cash+1e-9<price+2)break;
  plans.push({cargo,price,quantity:used});cash-=price+2;food-=6;capacity-=used;
  for(const[k,q]of Object.entries(cargo))left[k]-=q;
 }
 if(!plans.length){state.lastReason=m.resources.food<6?marketSupplyReason(s):cash<2?'商人本金不足以预留实际购货款。':'现货仓容或本金不足，本次未承诺进货。';return;}
 for(const plan of plans){
  const id=`market-supply:${state.nextRunId++}`,sourceReserveId=`stockpile:${id}:source`,fundStockpileId=`stockpile:${id}:fund`;
  const reserved={...zeros(),...plan.cargo},fund={...zeros(),jade:plan.price+2,food:6};
  for(const[k,q]of Object.entries(plan.cargo))source.resources[k]-=q;
  m.resources.jade-=plan.price+2;m.resources.food-=6;
  s.stockpilesById[sourceReserveId]={id:sourceReserveId,ownerId:MARKET_SUPPLIER,custodianId:MARKET_SUPPLIER,carrierId:null,access:'private',capacity:40,position:{sceneId:'scene:supply',x:35,y:31},resources:reserved,pills:pillZeros()};
  s.stockpilesById[fundStockpileId]={id:fundStockpileId,ownerId:'person:merchant-qingxi',custodianId:'person:merchant-qingxi',carrierId:null,access:'private',capacity:1000,position:{sceneId:'scene:market',x:37,y:25},resources:fund,pills:pillZeros()};
  state.runs[id]={id,phase:'quoted',quotedTick:s.worldTick,departureTick:null,sourceStockpileId:source.id,targetStockpileId:m.id,sourceReserveId,paymentReservationId:fundStockpileId,fundStockpileId,cargoStockpileId:null,cargo:plan.cargo,quantity:plan.quantity,price:plan.price,priceVersion:'goods-sell-per-ten:v1',routeIds:[...MARKET_SUPPLY_OUT,...MARKET_SUPPLY_BACK],carrierId:MARKET_CARRIER,cargoPosition:{sceneId:'scene:supply',x:35,y:31},cargoOwnerId:MARKET_SUPPLIER,cargoCustodianId:MARKET_SUPPLIER,paidGoodsJade:0,paidTollJade:0,consumedFood:0,settlementFactId:null,reason:'供货源仓已预约，商人货款与双程路粮已一次预留。'};
  state.queue.push(id);
  ledger(s,`fact:supply-quote:${id}`,{operation:'supplier-quote',sourceStockpileId:source.id,sourceReserveId,fundStockpileId,cargo:copy(plan.cargo),goodsPrice:plan.price,tollLimit:2,foodReserved:6});
 }
 e.nextMarketSourceQuoteTick=s.worldTick+2400;e.merchantArrivalTick=s.worldTick+300;e.merchantVisitEndsTick=s.worldTick+1200;state.lastReason=null;
}
function departMarketSupply(s,run,direction){
 const carrier=s.personsById[MARKET_CARRIER],clerk=s.personsById[MARKET_SUPPLIER],from=direction==='out'?'scene:market':'scene:supply',to=direction==='out'?'scene:supply':'scene:market';
 const ids=[carrier.personId];if(clerk.position?.kind==='scene'&&clerk.position.sceneId===from)ids.push(clerk.personId);
 const id=`travel:${run.id}:${direction}`,routes=direction==='out'?MARKET_SUPPLY_OUT:MARKET_SUPPLY_BACK;
 s.travelsById[id]={id,kind:'market-supply-travel',participantIds:ids,sourceSceneId:from,destinationSceneId:to,routeIds:copy(routes),startedTick:s.worldTick,durationTicks:300,progressTicks:0,segmentIndex:0,segmentWork:0,status:'traveling'};
 for(const pid of ids)s.personsById[pid].position={kind:'worldTravel',travelId:id};
 const fund=stock(s,run.fundStockpileId);fund.position={kind:'travel',travelId:id};fund.carrierId=carrier.personId;fund.custodianId=carrier.personId;
 if(run.cargoStockpileId){const cargo=stock(s,run.cargoStockpileId);cargo.position={kind:'travel',travelId:id};cargo.carrierId=carrier.personId;run.cargoPosition=copy(cargo.position);}
 run.travelId=id;run.phase=direction==='out'?'outbound':'returning';if(direction==='out')run.departureTick=s.worldTick;run.reason='具名承运人沿真实路段运送，逐段耗用已预留口粮。';
}
function advanceMarketSupplyTravel(s,run){
 const travel=s.travelsById[run.travelId],routeId=travel.routeIds[travel.segmentIndex],route=s.routesById[routeId];
 if(!route||['blocked','closed'].includes(route.condition)){travel.status='blocked';run.reason=`${routeId}断路，承运人与货位停在本段，修路后延续。`;return;}
 const fund=stock(s,run.fundStockpileId),weather=s.weatherByRegionId?.['region:yunxiu']?.phase||s.world?.weather?.id;
 if(travel.status==='blocked')run.reason='通行阻碍已解除，货款与货物沿原旅程的剩余路段继续。';
 s.personsById[run.carrierId].mind.activity='travel';
 travel.status='traveling';travel.segmentWork+=(weather==='rain'?.8:weather==='fog'?.9:1)/(route.condition==='damaged'?1.5:1);travel.progressTicks=Math.min(300,travel.routeIds.slice(0,travel.segmentIndex).reduce((sum,id)=>sum+MARKET_ROUTE_TICKS[id],0)+travel.segmentWork);
 if(travel.segmentWork+1e-9<MARKET_ROUTE_TICKS[routeId])return;
 if(fund.resources.food<1)fail('补货运单逐段路粮不足。');
 fund.resources.food--;run.consumedFood++;ledger(s,`fact:supply-road:${run.id}:${travel.id}:${travel.segmentIndex}`,{operation:'supplier-route-food',runId:run.id,routeId,quantity:1,fundStockpileId:fund.id});
 travel.segmentIndex++;travel.segmentWork=0;travel.progressTicks=travel.routeIds.slice(0,travel.segmentIndex).reduce((sum,id)=>sum+MARKET_ROUTE_TICKS[id],0);
 if(travel.segmentIndex<travel.routeIds.length)return;
 travel.status='arrived';travel.completedTick=s.worldTick;
 const end=travel.destinationSceneId,feet=end==='scene:supply'?{x:35,y:31}:{x:37,y:25};
 for(const pid of travel.participantIds)s.personsById[pid].position={kind:'scene',sceneId:end,...feet};
 fund.position={sceneId:end,...feet};if(run.cargoStockpileId){stock(s,run.cargoStockpileId).position={sceneId:end,...feet};run.cargoPosition=copy(stock(s,run.cargoStockpileId).position);}
 run.phase=end==='scene:supply'?'at-source':'awaiting-delivery';run.reason=end==='scene:supply'?'承运人与供货执事已同地，可实际验货付款。':'已抵坊市，等待商人与货位同地验收。';
}
function purchaseMarketSupply(s,run){
 const carrier=s.personsById[MARKET_CARRIER],clerk=s.personsById[MARKET_SUPPLIER],reserve=stock(s,run.sourceReserveId),fund=stock(s,run.fundStockpileId),wallet=stock(s,MARKET_SUPPLIER_WALLET);
 if(carrier.lifeStatus!=='alive'||clerk.lifeStatus!=='alive'||carrier.position?.sceneId!=='scene:supply'||clerk.position?.sceneId!=='scene:supply'){run.reason='具名双方尚未在供货仓同场验货。';return;}
 if(fund.resources.jade+1e-9<run.price||Object.entries(run.cargo).some(([k,q])=>reserve.resources[k]+1e-9<q)){run.reason='预约货或货款不完整，保留原位等待核对。';return;}
 const id=`stockpile:${run.id}:cargo`,resources={...zeros(),...run.cargo};
 for(const[k,q]of Object.entries(run.cargo))reserve.resources[k]-=q;
 fund.resources.jade-=run.price;wallet.resources.jade+=run.price;
 s.stockpilesById[id]={id,ownerId:'person:merchant-qingxi',custodianId:carrier.personId,carrierId:carrier.personId,access:'private',capacity:40,position:{sceneId:'scene:supply',x:35,y:31},resources,pills:pillZeros()};
 run.cargoStockpileId=id;run.cargoPosition=copy(s.stockpilesById[id].position);run.cargoOwnerId='person:merchant-qingxi';run.cargoCustodianId=carrier.personId;run.paidGoodsJade=run.price;run.phase='purchased';run.reason='供货执事同地收款后，实物才转归商人，由承运人保管。';
 ledger(s,`fact:supply-purchase:${run.id}`,{operation:'supplier-purchase',runId:run.id,actorId:carrier.personId,sellerId:clerk.personId,sourceStockpileId:reserve.id,targetStockpileId:id,paymentSourceStockpileId:fund.id,paymentTargetStockpileId:wallet.id,cargo:copy(run.cargo),payment:run.price});
}
function returnMarketSupply(s,run){
 const steward=s.personsById['person:chizhang-steward'],fund=stock(s,run.fundStockpileId);
 if(steward?.lifeStatus==='alive'&&steward.position?.kind==='scene'&&steward.position.sceneId==='scene:supply'){
  if(fund.resources.jade<2){run.reason='具名关口报价需2灵石，预留款不足则原地等候。';return;}
  fund.resources.jade-=2;stock(s,MARKET_TOLL_STOCK).resources.jade+=2;run.paidTollJade=2;
  ledger(s,`fact:supply-toll:${run.id}`,{operation:'supplier-toll',runId:run.id,actorId:steward.personId,sourceStockpileId:fund.id,targetStockpileId:MARKET_TOLL_STOCK,payment:2});
 }
 departMarketSupply(s,run,'back');
}
function deliverMarketSupply(s,run){
 const m=stock(s,'stockpile:qingxi'),merchant=s.personsById['person:merchant-qingxi'],carrier=s.personsById[MARKET_CARRIER],cargo=stock(s,run.cargoStockpileId),fund=stock(s,run.fundStockpileId);
 if(merchant?.lifeStatus!=='alive'||merchant.position?.sceneId!=='scene:market'){run.reason='商人未在坊市接货，实物由承运人原位保管。';return;}
 if(total(m)+total(cargo)+total(fund)>m.capacity){run.reason='商人目标仓已满，实物与未用款保留在承运人货位。';return;}
 for(const[k,q]of Object.entries(cargo.resources))if(q>0){m.resources[k]+=q;cargo.resources[k]=0;}
 for(const[k,q]of Object.entries(fund.resources))if(q>0){m.resources[k]+=q;fund.resources[k]=0;}
 cargo.carrierId=null;fund.carrierId=null;cargo.custodianId=merchant.personId;fund.custodianId=merchant.personId;
 cargo.position={sceneId:'scene:market',x:37,y:25};fund.position={sceneId:'scene:market',x:37,y:25};run.cargoPosition=copy(cargo.position);run.cargoCustodianId=merchant.personId;
 run.phase='completed';run.completedTick=s.worldTick;run.reason='商人同场验收，真实货物入现货仓；未用费用原产权返仓。';run.settlementFactId=`fact:supply-delivery:${run.id}`;
 ledger(s,run.settlementFactId,{operation:'supplier-delivery',runId:run.id,carrierId:carrier.personId,sourceStockpileId:cargo.id,targetStockpileId:m.id,cargo:copy(run.cargo),paidGoodsJade:run.paidGoodsJade,paidTollJade:run.paidTollJade,consumedFood:run.consumedFood});
 carrier.mind.activity='rest';s.srEconomy.marketSupply.activeRunId=null;
}
function transferMarketInsightBudget(s){
 const e=s.srEconomy,state=e.marketSupply,merchant=s.personsById['person:merchant-qingxi'],clerk=s.personsById[MARKET_SUPPLIER],budget=e.marketInsightSource,m=stock(s,'stockpile:qingxi'),wallet=stock(s,MARKET_SUPPLIER_WALLET);
 if(s.worldTick<state.nextInsightQuoteTick||!budget.balance||merchant.lifeStatus!=='alive'||clerk.lifeStatus!=='alive'||merchant.position?.sceneId!=='scene:market'||clerk.position?.sceneId!=='scene:market')return;
 const rate=GOODS.insight.sell/10,q=Math.min(20,budget.balance,Math.floor(m.resources.jade/rate),m.capacity-total(m));if(q<=0)return;
 const payment=q*rate;m.resources.jade-=payment;wallet.resources.jade+=payment;m.resources.insight+=q;budget.balance-=q;state.nextInsightQuoteTick=s.worldTick+2400;
 ledger(s,`fact:supply-insight:${s.worldTick}`,{operation:'supplier-study-budget',sellerId:clerk.personId,buyerId:merchant.personId,quantity:q,payment,source:'marketInsightSource',targetStockpileId:m.id,paymentTargetStockpileId:wallet.id});
}
function advanceMarketSupply(s){
 if(s.contentVersion!=='sr-content-v1.2')return;
 const state=s.srEconomy.marketSupply;
 const run=state.activeRunId&&state.runs[state.activeRunId];
 if(run){
  const carrier=s.personsById[MARKET_CARRIER];
  if(carrier?.lifeStatus!=='alive'){if(run.travelId&&s.travelsById[run.travelId]?.status==='traveling')s.travelsById[run.travelId].status='blocked';run.reason='承运人身死，货款与货物留在最后实际货位，等待有权接续或取回。';}
  else if(carrier.wound>20||carrier.energy<5){
   const travel=['outbound','returning'].includes(run.phase)&&s.travelsById[run.travelId];
   if(travel?.status==='traveling')travel.status='blocked';
   const scene=run.phase==='awaiting-delivery'?'scene:market':['at-source','purchased'].includes(run.phase)?'scene:supply':null;
   const fund=s.stockpilesById[run.fundStockpileId],cargo=s.stockpilesById[run.cargoStockpileId||run.sourceReserveId];
   const restingAtScene=scene&&carrier.position?.sceneId===scene&&fund?.position?.sceneId===scene&&cargo?.position?.sceneId===scene;
   run.reason='承运人受伤或疲乏，货款与货物留在原货位；原地静养后继续履约。';
   if(travel?.status==='blocked'||restingAtScene){carrier.mind.activity='rest';carrier.wound=Math.max(0,carrier.wound-.035);carrier.energy=Math.min(100,carrier.energy+.3);}
  }
  else if(['outbound','returning'].includes(run.phase))advanceMarketSupplyTravel(s,run);
  else if(run.phase==='at-source')purchaseMarketSupply(s,run);
  else if(run.phase==='purchased')returnMarketSupply(s,run);
  else if(run.phase==='awaiting-delivery')deliverMarketSupply(s,run);
 }
 transferMarketInsightBudget(s);
 quoteMarketSupply(s);
 if(state.activeRunId||!state.queue.length)return;
 const merchant=s.personsById['person:merchant-qingxi'],carrier=s.personsById[MARKET_CARRIER],next=state.runs[state.queue[0]];
 if(merchant?.position?.sceneId!=='scene:market'||carrier?.position?.sceneId!=='scene:market'||carrier.lifeStatus!=='alive'||carrier.wound>20||carrier.energy<5||carrier.activityId||!marketRouteOpen(s)){state.lastReason=marketSupplyReason(s)||'承运人尚未在坊市空闲接单，已预约货物保持原位。';return;}
 state.queue.shift();state.activeRunId=next.id;carrier.mind.activity='travel';
 departMarketSupply(s,next,'out');
}
function advanceMarketOrdersV2(s){for(const o of Object.values(s.srEconomy.orders))if(o.version===ORDER_V2&&!['completed','cancelled','declined'].includes(o.phase)){orderV2Sync(s,o);advanceOrderV2Deadline(s,o);advanceOrderV2MerchantResponse(s,o);advanceOrderV2Amendment(s,o);}}
export function tickEconomy(s){if(!s.srEconomy||s.srEconomy.updatedThroughTick>=s.worldTick)return;const e=s.srEconomy;e.updatedThroughTick=s.worldTick;initEconomy(s);advanceFarmCrops(s);advanceMerchant(s);advanceMasterHarvest(s);advanceReplenish(s);advanceCraft(s);settleWholesale(s);advanceMarketSupply(s);advanceMarketOrdersV2(s);
 for(const w of Object.values(s.workOrdersById))if(w.kind==='transport'&&!['delivered','cancelled'].includes(w.phase)){const p=s.personsById[w.carrierId],o=p&&body(s,p);if(!p||!atHome(s,p)||o.scenic?.spatialEvacuationOrderId||p.wound>(Object.keys(w.cargo).every(pillId)?85:20)||p.energy<5||o.away||o.journey){w.reason='搬运者外出、受伤或精力不足；货物保留在预约或本人身上。';continue;}const endpoint=stock(s,w.phase==='to-source'?w.sourceStockpileId:w.targetStockpileId);if(endpoint.buildingId&&s.buildingsById[endpoint.buildingId]?.spatialLock){w.reason='源或目的设施正迁建，保持预约/携带等待或取消。';continue;}const target=stockAccess(s,endpoint);if(!target){w.reason='仓储接触范围没有合法脚点，货物保留，可清出通路或取消。';o.scenic.path=[];o.scenic.goal=null;continue;}if(!close(s,o.scenic,target)){if(o.scenic.revision!==geometryRevision(s)||!o.scenic.path.length||!o.scenic.goal||scenicDistance(o.scenic.goal,target)>.01){const path=scenicFindPath(s,o.scenic,target,{maxSnap:0});if(path===null){w.reason='道路不通，货物与进度保留。';o.scenic.path=[];o.scenic.goal=null;o.scenic.revision=geometryRevision(s);continue;}o.scenic.path=path;o.scenic.goal=copy(target);o.scenic.revision=geometryRevision(s);}advanceScenic(o.scenic,4.6,s);syncScenicPosition(s,p);p.energy=Math.max(0,p.energy-.01);continue;}
 if(w.phase==='to-source'){w.phase='carrying';w.reason='已实际取料，携带前往交付地点。';o.scenic.path=[];continue;}const targetStock=stock(s,w.targetStockpileId);if(total(targetStock)+Object.values(w.cargo).reduce((a,b)=>a+b,0)>targetStock.capacity){w.reason='目的仓储已满，保持携带。';continue;}for(const[k,v]of Object.entries(w.cargo))changeCargo(targetStock,k,v);w.phase='delivered';w.reason='已到场交付，可供目的工序使用。';releaseTransport(s,w);ledger(s,`fact:transport:${w.id}`,{operation:'delivery',sourceStockpileId:w.sourceStockpileId,targetStockpileId:w.targetStockpileId,quantities:copy(w.cargo)});}
}
export function viewConstructionMaterials(s){return Object.values(s.workOrdersById||{}).filter(o=>o.kind==='construction'&&o.materialFlow).map(o=>{const flow=o.materialFlow,source=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];return {workOrderId:o.id,phase:flow.phase,cancelRequested:flow.cancelRequested,carrierId:flow.carrierId,sourceStockpileId:flow.sourceStockpileId,siteStockpileId:flow.siteStockpileId,reservedAtSource:copy(source?.resources||zeros()),inTransit:copy(flow.cargo),deliveredAtSite:copy(site?.resources||zeros()),installed:copy(o.usedCost),trips:copy(flow.trips)};});}
// SR-XF-010-I01 / ECON-02/03: derive the visible ledger from one physical holder per unit.
export function viewInventorySummary(s){
 const keys=[...Object.keys(RESOURCES),...Object.keys(RECIPES).map(id=>`pill:${id}`)],fields=['available','reserved','inTransit','shortage'];
 const groups=Object.fromEntries(['public','personal','merchant'].map(id=>[id,{id,amounts:Object.fromEntries(keys.map(k=>[k,Object.fromEntries(fields.map(f=>[f,0]))])),shortageReasons:[]}]));
 const scope=st=>st?.access==='public'&&st.ownerId==='person:master'?'public':['merchant','private'].includes(st?.access)&&st.ownerId==='person:merchant-qingxi'?'merchant':st?.access==='private'&&st.ownerId==='person:master'?'personal':null;
 const add=(id,key,field,quantity)=>{if(id&&groups[id]?.amounts[key]&&Number.isFinite(quantity)&&quantity>0)groups[id].amounts[key][field]+=quantity;};
 const stockCargo=(st,field,id)=>{if(!id)return;for(const[k,v]of Object.entries(st.resources||{}))add(id,k,field,v);for(const[k,v]of Object.entries(st.pills||{}))add(id,`pill:${k}`,field,v);};
 const construction=new Set(),heldOrders=new Map();
 for(const w of Object.values(s.workOrdersById||{}))if(w.kind==='construction'&&w.materialFlow){construction.add(w.materialFlow.sourceStockpileId);construction.add(w.materialFlow.siteStockpileId);for(const[k,v]of Object.entries(w.materialFlow.cargo||{}))add('public',k,'inTransit',v);}
 for(const o of Object.values(s.srEconomy?.orders||{}))if(o.version==='market-order:v2'&&!['completed','cancelled','declined'].includes(o.phase)){
  heldOrders.set(o.cargoStockpileId,{id:scope(s.stockpilesById[o.sourceStockpileId]),field:o.pickupTick===undefined?'reserved':'inTransit'});
  heldOrders.set(o.freightStockpileId,{id:scope(s.stockpilesById[o.quote?.deliveryCostStockpileId]),field:o.pickupTick===undefined?'reserved':'inTransit'});
  heldOrders.set(o.paymentStockpileId,{id:scope(s.stockpilesById[o.targetStockpileId]),field:'reserved'});
 }
 for(const run of Object.values(s.srEconomy?.marketSupply?.runs||{}))if(run.phase!=='completed'){
  heldOrders.set(run.fundStockpileId,{id:'merchant',field:run.phase==='quoted'?'reserved':'inTransit'});
  if(run.cargoStockpileId)heldOrders.set(run.cargoStockpileId,{id:'merchant',field:'inTransit'});
 }
 for(const st of Object.values(s.stockpilesById||{})){
  const held=heldOrders.get(st.id),id=construction.has(st.id)?'public':held?.id||scope(st);
  if(!id)continue;
  const field=construction.has(st.id)?'reserved':held?.field||(position(s,st)?.kind==='travel'?'inTransit':'available');
  stockCargo(st,field,id);
 }
 for(const w of Object.values(s.workOrdersById||{})){
  if(w.kind==='transport'&&!['delivered','cancelled'].includes(w.phase))for(const[k,v]of Object.entries(w.cargo))add(scope(s.stockpilesById[w.sourceStockpileId]),k,w.phase==='to-source'?'reserved':'inTransit',v);
  if(w.kind==='construction'){
   const r=s.reservationsById?.[w.reservationId];if(!r)continue;
   for(const[k,v]of Object.entries(r.cost||{}))if(!w.materialFlow||k==='jade')add('public',k,'reserved',Math.max(0,v-(w.usedCost?.[k]||0)));
  }
  if(w.kind==='production'&&w.phase!=='completed'){
   const r=s.reservationsById?.[w.reservationId],id=scope(s.stockpilesById?.[`stockpile:${w.targetId}`])||'public';
   for(const[k,v]of Object.entries(r?.cost||{}))add(id,k,'reserved',r.remainingCost?.[k]??v*Math.max(0,1-w.progressTicks/w.durationTicks));
  }
  if(w.kind==='sr-crafting'&&w.phase==='active')for(const[k,v]of Object.entries(w.cost||{}))add(scope(s.stockpilesById[w.sourceStockpileIds[k]]),k,'reserved',v*Math.max(0,1-w.progressTicks/w.durationTicks));
 }
 for(const o of Object.values(s.srEconomy?.orders||{}))if(o.version!=='market-order:v2'&&o.phase==='accepted')for(const[k,v]of Object.entries(o.cargo||{}))add(scope(s.stockpilesById[o.sourceStockpileId||'stockpile:yunxiu']),k,'reserved',v);
 for(const a of Object.values(s.srEconomy?.pillAllocations||{}))if(a.phase==='reserved')for(const p of a.parts||[])add(scope(s.stockpilesById[p.stockpileId]),`pill:${a.recipeId}`,'reserved',p.quantity);
 for(const a of Object.values(s.activitiesById||{}))if(a.kind==='sr-replenish')for(const[k,v]of Object.entries(s.reservationsById?.[a.reservationId]?.cost||{}))add('public',k,'reserved',v*Math.max(0,1-a.progressTicks/a.durationTicks));
 for(const b of Object.values(s.buildingsById||{})){
  const st=s.stockpilesById?.[`stockpile:${b.instanceId}`],order=s.workOrdersById?.[`work:production:${b.instanceId}`];
  if(!BUILDINGS[b.type]?.work||b.enabled===false||b.condition<=0||b.constructionWorkOrderId||!st||scope(st)!=='public'||order&&order.phase!=='completed')continue;
  const need=b.type==='farm'?FARM_CROP_RECIPE.seedCost:productionRecipeDefinition(PRODUCTION_RECIPE_VERSION,b.type)?.inputCost||{};
  for(const[k,v]of Object.entries(need)){const missing=Math.max(0,v-(st.resources?.[k]||0));if(missing){add('public',k,'shortage',missing);groups.public.shortageReasons.push({targetId:b.instanceId,targetName:BUILDINGS[b.type].name,resource:k,quantity:missing,reason:'下一批需先将材料实际搬到工位。'});}}
 }
 return Object.values(groups).map(g=>({...g,amounts:Object.fromEntries(Object.entries(g.amounts).map(([k,a])=>[k,{...a,total:a.available+a.reserved+a.inTransit}]))}));
}
function marketOrderPreviewV2(s,id){if(id!==ORDER_V2_ID)return null;const prior=s.srEconomy.orders[id];if(prior)return prior.version===ORDER_V2?copy(prior.quote):null;try{return marketOrderQuoteV2(s,id);}catch{return null;}}
function viewMarketSupply(s){
 if(s.contentVersion!=='sr-content-v1.2')return null;
 const e=s.srEconomy,ms=e.marketSupply,source=stock(s,MARKET_SUPPLIER_STOCK),active=ms.activeRunId&&ms.runs[ms.activeRunId];
 const reserved=Object.fromEntries(MARKET_SOURCE_GOODS.map(k=>[k,0])),inTransit={...reserved};
 for(const run of Object.values(ms.runs))if(run.phase!=='completed')for(const[k,q]of Object.entries(run.cargo)){const field=run.phase==='quoted'?'reserved':'inTransit';(field==='reserved'?reserved:inTransit)[k]+=q;}
 return {sourceId:source.id,sourceSceneId:'scene:supply',source:copy(source.resources),insightBudget:e.marketInsightSource.balance,reserved,inTransit,shop:copy(stock(s,'stockpile:qingxi').resources),nextQuoteTick:e.nextMarketSourceQuoteTick,carrierName:s.personsById[MARKET_CARRIER].name,clerkName:s.personsById[MARKET_SUPPLIER].name,active:active?{id:active.id,phase:active.phase,reason:active.reason,cargo:copy(active.cargo),travelId:active.travelId||null}:null,queued:ms.queue.length,reason:ms.lastReason||(!marketRouteOpen(s)?marketSupplyReason(s):null),localFoodRemaining:e.patches.food.remaining};
}
export function viewEconomy(s){if(!s.srEconomy)return {enabled:false};return {enabled:true,inventorySummary:viewInventorySummary(s),constructionMaterials:viewConstructionMaterials(s),definition:ECONOMY_DEFINITION,pillAccess:Object.entries(RECIPES).map(([id,r])=>({recipeId:id,name:r.name,available:availablePills(s,'person:master',id),total:s.pills[id],reason:availablePills(s,'person:master',id)>0?'本人身边有合法可达药物。':'须实际取药或携到当前地点。'})),craft:Object.values(s.workOrdersById).find(w=>w.kind==='sr-crafting'&&w.phase==='active')?copy(Object.values(s.workOrdersById).find(w=>w.kind==='sr-crafting'&&w.phase==='active')):null,craftRecipes:Object.entries(RECIPES).map(([id,r])=>({id,name:r.name,...craftAvailabilitySR(s,id)})),giftRecipients:Object.values(s.stockpilesById).filter(st=>st.access==='private'&&!marketSupplyStockpile(st.id)&&st.ownerId!=='person:master'&&s.personsById[st.ownerId]&&s.personsById[st.ownerId].lifeStatus!=='dead'&&position(s,st)?.sceneId===personScene(s,s.master)&&(s.homeMemberIds.includes(st.ownerId)||s.personsById[st.ownerId].visibility!=='author-private')).map(st=>({stockpileId:st.id,personId:st.ownerId,name:s.personsById[st.ownerId].name,position:copy(position(s,st))})),stockpiles:Object.values(s.stockpilesById).filter(st=>st.access!=='private'||st.ownerId==='person:master').map(st=>({id:st.id,label:st.label||ORDER_V2_STOCK_LABELS[st.id]||(st.buildingId?BUILDINGS[s.buildingsById[st.buildingId]?.type]?.name||st.id:st.id),orderReserved:orderV2ReserveLocked(s,st.id),resources:copy(st.resources),pills:copy(st.pills||pillZeros()),ownerId:st.legalOwnerId||st.ownerId,access:st.access,capacity:st.capacity,position:copy(position(s,st))})),merchantCollections:Object.values(s.workOrdersById).filter(w=>w.kind==='sr-merchant-collection').map(copy),transports:Object.values(s.workOrdersById).filter(w=>w.kind==='transport').map(copy),patches:copy(s.srEconomy.patches),market:{goods:copy(GOODS),supply:viewMarketSupply(s),wholesale:{definition:WHOLESALE_DEFINITION,lastKnownPayments:s.srEconomy.wholesale.spentLifetime,rule:'只在商人实际回到坊市后，以已收购材料/器物向有限客户交付取得付款；无货不补本金。'},orders:Object.entries(ORDER_DEFINITIONS).map(([id,d])=>({id,...copy(d),state:copy(s.srEconomy.orders[id]||{phase:'available'}),quoteV2:marketOrderPreviewV2(s,id)})),routeOpen:marketRouteOpen(s),merchantPresent:merchantPresent(s),arrivalTick:s.srEconomy.merchantArrivalTick,departureTick:s.srEconomy.merchantVisitEndsTick},ledger:Object.values(s.factsById).filter(f=>f.kind==='inventory-transaction').slice(-20).map(copy)};}
function validateMarketOrderV2(s,id,o){
 const q=o.quote,active=!['completed','cancelled','declined'].includes(o.phase);
 if(id!==ORDER_V2_ID||o.id!==id||q?.version!==ORDER_V2||q.priceVersion!=='artisan-tools:home-market:v1'||q.orderId!==id||q.sellerId!=='person:master'||q.buyerId!=='person:merchant-qingxi'||q.carrierId!=='person:master'||q.sourceStockpileId!==ORDER_V2_SOURCE||q.deliveryCostStockpileId!==ORDER_V2_SOURCE||q.targetStockpileId!==ORDER_V2_DESTINATION||JSON.stringify(q.cargo)!==JSON.stringify(ORDER_DEFINITIONS[id].cost)||q.payment?.jade!==30||q.reputation!==2||q.foodCost!==2||JSON.stringify(q.routeIds)!==JSON.stringify(['route:home-valley','route:valley-market'])||!Array.isArray(q.routeFoodBySegment)||q.routeFoodBySegment.length!==2||q.routeFoodBySegment.some(v=>!Number.isSafeInteger(v)||v<0)||q.routeFoodBySegment.reduce((n,v)=>n+v,0)!==q.foodCost||!['accepted','in_transit','blocked','delivered','completed','declined','cancelled'].includes(o.phase))fail('跨场景商单报价或阶段异常。');
 if(o.deadlineClockVersion!==undefined){
  if(o.deadlineClockVersion!=='passable-window:v1'||q.deadlineTick!==q.earliestDeliverTick+ORDER_V2_WINDOW||!Number.isSafeInteger(o.lastDeadlineTick)||o.lastDeadlineTick<o.acceptedTick||o.lastDeadlineTick>s.worldTick||!Number.isSafeInteger(o.passableTicks)||!Number.isSafeInteger(o.pausedTicks)||o.passableTicks<0||o.pausedTicks<0||o.passableTicks+o.pausedTicks!==Math.max(0,o.lastDeadlineTick-q.earliestDeliverTick)||!Array.isArray(o.pauseSpans))fail('商单交付时钟异常。');
  let paused=0,lastEnd=q.earliestDeliverTick;
  for(const [index,span] of o.pauseSpans.entries()){
   const end=span.endTick??o.lastDeadlineTick;
   if(!Number.isSafeInteger(span.startTick)||!Number.isSafeInteger(end)||span.startTick<=lastEnd||end<span.startTick||end>o.lastDeadlineTick||!Number.isSafeInteger(span.pausedTicks)||span.pausedTicks!==end-span.startTick+1||!Array.isArray(span.reasons)||!span.reasons.length||span.reasons.some(reason=>typeof reason!=='string'||!reason)||span.endTick===undefined&&(index!==o.pauseSpans.length-1||!active||o.breachTick!==undefined))fail('商单停表分段异常。');
   paused+=span.pausedTicks;lastEnd=end;
  }
  const breach=s.factsById[`fact:order-v2:breach:${id}`];
  if(paused!==o.pausedTicks||o.breachTick!==undefined&&(!Number.isSafeInteger(o.breachTick)||o.breachTick!==o.lastDeadlineTick||o.passableTicks!==ORDER_V2_WINDOW+1||breach?.atTick!==o.breachTick||breach.operation!=='order-v2-seller-breach'||breach.orderId!==id||breach.sellerId!==q.sellerId||breach.buyerId!==q.buyerId||breach.passableTicks!==o.passableTicks||breach.pausedTicks!==o.pausedTicks||JSON.stringify(breach.pausedReasons)!==JSON.stringify(o.pauseSpans))||o.breachTick===undefined&&(breach||o.passableTicks>ORDER_V2_WINDOW))fail('商单交付期限或失约事实异常。');
 }
 const response=o.merchantResponse,responseFact=s.factsById[`fact:order-v2:response:${id}`],amend=o.amendment;
 if(response){
  if(response.costs?.grossPaymentJade!==q.payment.jade||response.costs.extraFeeJade!==0||response.costs.penaltyJade!==0||!Number.isSafeInteger(response.costs.spentFoodAtDecision)||response.costs.spentFoodAtDecision<0||response.costs.spentFoodAtDecision>q.foodCost||!Number.isSafeInteger(response.chargedSegmentsAtDecision)||response.chargedSegmentsAtDecision<0||response.chargedSegmentsAtDecision>o.chargedSegments||response.costs.spentFoodAtDecision!==q.routeFoodBySegment.slice(0,response.chargedSegmentsAtDecision).reduce((n,v)=>n+v,0))fail('商人回应成本快照异常。');
  for(let segment=1;segment<=o.chargedSegments;segment++){
   const routeFact=s.factsById[`fact:order-v2:route:${id}:${segment}`];
   if(routeFact&&((segment<=response.chargedSegmentsAtDecision&&routeFact.atTick>response.decidedTick)||(segment>response.chargedSegmentsAtDecision&&routeFact.atTick<response.decidedTick)))fail('商人回应路粮时序异常。');
  }
  if(o.breachTick===undefined||!['continue','renegotiate','refuse'].includes(response.decision)||response.merchantId!==q.buyerId||response.breachFactId!==`fact:order-v2:breach:${id}`||!Number.isSafeInteger(response.decidedTick)||response.decidedTick<o.breachTick||response.decidedTick>s.worldTick||response.reason!==orderV2MerchantReason(response.decision)||typeof response.cargoVisible!=='boolean'||response.cargoSceneId!==null&&(typeof response.cargoSceneId!=='string'||!s.scenesById?.[response.cargoSceneId])||!['wood','stone'].every(k=>Number.isFinite(response.merchantStock?.[k])&&response.merchantStock[k]>=0)||response.decision==='continue'!==response.cargoVisible||response.decision==='renegotiate'!==(!response.cargoVisible&&(response.merchantStock.wood<q.cargo.wood*2||response.merchantStock.stone<q.cargo.stone*2))||response.decision==='refuse'!==(!response.cargoVisible&&response.merchantStock.wood>=q.cargo.wood*2&&response.merchantStock.stone>=q.cargo.stone*2)||JSON.stringify(response.terms)!==JSON.stringify(response.decision==='renegotiate'?{extraPassableTicks:ORDER_V2_AMEND_WINDOW,payment:q.payment,fee:0,penalty:0}:null)||responseFact?.atTick!==response.decidedTick||responseFact.operation!=='order-v2-merchant-response'||responseFact.orderId!==id||Object.keys(response).some(key=>JSON.stringify(responseFact[key])!==JSON.stringify(response[key])))fail('商人失约回应或来源事实异常。');
 }else if(responseFact||amend)fail('商人回应关联异常。');
 if(amend){
  const accepted=s.factsById[`fact:order-v2:amend:${id}`],expired=s.factsById[`fact:order-v2:amend-expired:${id}`];
  if(response?.decision!=='renegotiate'||!Number.isSafeInteger(amend.acceptedTick)||amend.acceptedTick<response.decidedTick||amend.acceptedTick>s.worldTick||!Number.isSafeInteger(amend.lastTick)||amend.lastTick<amend.acceptedTick||amend.lastTick>s.worldTick||!Number.isSafeInteger(amend.passableTicks)||!Number.isSafeInteger(amend.pausedTicks)||amend.passableTicks<0||amend.pausedTicks<0||amend.passableTicks+amend.pausedTicks!==amend.lastTick-amend.acceptedTick||!Array.isArray(amend.pauseSpans)||accepted?.atTick!==amend.acceptedTick||accepted.operation!=='order-v2-amend-accepted'||accepted.orderId!==id||accepted.buyerId!==q.buyerId||accepted.sellerId!==q.sellerId||accepted.responseFactId!==`fact:order-v2:response:${id}`||accepted.extraPassableTicks!==ORDER_V2_AMEND_WINDOW||JSON.stringify(accepted.payment)!==JSON.stringify(q.payment)||accepted.fee!==0||accepted.penalty!==0||amend.expiredTick!==undefined&&(amend.expiredTick!==amend.lastTick||amend.passableTicks!==ORDER_V2_AMEND_WINDOW+1||expired?.atTick!==amend.expiredTick||expired.operation!=='order-v2-amend-expired'||expired.orderId!==id||expired.merchantId!==q.buyerId||expired.passableTicks!==amend.passableTicks||expired.pausedTicks!==amend.pausedTicks)||amend.expiredTick===undefined&&(expired||amend.passableTicks>ORDER_V2_AMEND_WINDOW))fail('商单改约时钟或事实异常。');
  let paused=0,lastEnd=amend.acceptedTick;
  for(const [index,span] of amend.pauseSpans.entries()){
   const end=span.endTick??amend.lastTick;
   if(!Number.isSafeInteger(span.startTick)||!Number.isSafeInteger(end)||span.startTick<=lastEnd||end<span.startTick||end>amend.lastTick||!Number.isSafeInteger(span.pausedTicks)||span.pausedTicks!==end-span.startTick+1||!Array.isArray(span.reasons)||!span.reasons.length||span.reasons.some(reason=>typeof reason!=='string'||!reason)||span.endTick===undefined&&(index!==amend.pauseSpans.length-1||!active||amend.expiredTick!==undefined))fail('商单改约停表分段异常。');
   paused+=span.pausedTicks;lastEnd=end;
  }
  if(paused!==amend.pausedTicks)fail('商单改约停表累计异常。');
 }else if(s.factsById[`fact:order-v2:amend:${id}`]||s.factsById[`fact:order-v2:amend-expired:${id}`])fail('商单改约事实缺少约定。');
 if(o.phase==='declined'){if(s.reservationsById[ORDER_V2_RESERVATION]||s.stockpilesById[ORDER_V2_CARGO]||s.stockpilesById[ORDER_V2_PAYMENT]||s.stockpilesById[ORDER_V2_FREIGHT])fail('拒单后不能存在预留货位。');return;}
 if(o.sourceStockpileId!==q.sourceStockpileId||o.targetStockpileId!==q.targetStockpileId||o.carrierId!==q.carrierId||o.cargoStockpileId!==ORDER_V2_CARGO||o.paymentStockpileId!==ORDER_V2_PAYMENT||o.freightStockpileId!==ORDER_V2_FREIGHT)fail('订单来源、目的地或承运引用异常。');
 const cargo=s.stockpilesById[o.cargoStockpileId],payment=s.stockpilesById[o.paymentStockpileId],freight=s.stockpilesById[o.freightStockpileId];
 if(!cargo||!payment||!freight||o.accessVersion&&o.accessVersion!==ORDER_V2_ACCESS||o.accessVersion&&(cargo.access!==s.stockpilesById[o.sourceStockpileId]?.access||freight.access!==s.stockpilesById[o.quote.deliveryCostStockpileId]?.access)||cargo.id!==ORDER_V2_CARGO||payment.id!==ORDER_V2_PAYMENT||freight.id!==ORDER_V2_FREIGHT||cargo.ownerId!=='person:master'||freight.ownerId!=='person:master'||payment.ownerId!=='person:merchant-qingxi'||cargo.custodianId!=='person:master'||freight.custodianId!=='person:master'||payment.custodianId!=='person:merchant-qingxi')fail('订单三处货位产权或保管人异常。');
 if(active?!s.reservationsById[ORDER_V2_RESERVATION]:!!s.reservationsById[ORDER_V2_RESERVATION])fail('订单预约关联异常。');
 if(!Number.isSafeInteger(o.chargedSegments)||o.chargedSegments<0||o.chargedSegments>2||!Array.isArray(o.routeTravelTicks)||o.travelId&&!s.travelsById[o.travelId]||o.travelId&&s.travelsById[o.travelId].participantIds?.[0]!==o.carrierId||o.travelId&&!s.travelsById[o.travelId].returning&&JSON.stringify(s.travelsById[o.travelId].routeIds)!==JSON.stringify(q.routeIds))fail('订单旅程或分段进度异常。');
 for(let i=0;i<o.chargedSegments;i++)if(!s.factsById[`fact:order-v2:route:${id}:${i+1}`])fail('已走路段口粮事实缺失。');
 if(o.travelId&&o.routeTravelTicks.length!==2||!o.travelId&&o.routeTravelTicks.length)fail('订单旅程长度异常。');
 const cargoFull=Object.entries(q.cargo).every(([k,v])=>cargo.resources[k]===v),cargoEmpty=Object.keys(q.cargo).every(k=>cargo.resources[k]===0),paymentFull=payment.resources.jade===q.payment.jade,paymentEmpty=payment.resources.jade===0;
 if(o.phase==='completed'){if(!cargoEmpty||!paymentEmpty||freight.resources.food!==0||!s.factsById[o.resultTransactionId]||o.resultTransactionId!==`fact:order-v2:complete:${id}`)fail('已结算商单货款或事实异常。');return;}
 if(o.phase==='cancelled'){const fact=s.factsById[`fact:order-v2:cancel:${id}`],paymentReturned=o.paymentReturnStockpileId===payment.id?paymentFull:paymentEmpty;if(!paymentReturned||!fact||fact.paymentReturnedTo!==o.paymentReturnStockpileId||JSON.stringify(fact.cargo)!==JSON.stringify(o.cancelledCargo)||fact.unspentFreight!==o.cancelledFreight||Object.entries(q.cargo).some(([k,v])=>cargo.resources[k]>(o.cancelledCargo?.[k]||0)||o.cancelledCargo?.[k]>v)||freight.resources.food>o.cancelledFreight||!o.cancelledAfterPickup&&!o.cancelledAtSourceRetained&&(!cargoEmpty||freight.resources.food!==0))fail('已取消商单退还数量或事实异常。');return;}
 if(!cargoFull||!paymentFull||freight.resources.food!==q.foodCost-o.chargedSegments||!s.factsById[`fact:order-v2:accept:${id}`])fail('活跃商单三处预约数量异常。');
 if(o.pickupTick!==undefined&&!s.factsById[`fact:order-v2:pickup:${id}`]||o.travelId&&!s.factsById[`fact:order-v2:depart:${id}`])fail('取货或出发事实缺失。');
}
function validateStockpile(s,st){
 if(!Number.isFinite(st.capacity)||st.capacity<0||!st.position||!Object.values(st.resources).every(v=>Number.isFinite(v)&&v>=0))fail('仓储位置、容量或数量异常：'+st.id);
 if(typeof st.ownerId!=='string'||![s.personsById,s.organizationsById,s.factionsById].some(table=>table&&Object.hasOwn(table,st.ownerId)))fail('仓储所有者引用异常：'+st.id);
 if(typeof st.custodianId!=='string'||!s.personsById[st.custodianId])fail('仓储保管者引用异常：'+st.id);
 if(!['public','private','merchant'].includes(st.access))fail('仓储访问级别异常：'+st.id);
 const at=st.position;
 if(at.kind==='travel'){
  if(typeof at.travelId!=='string'||!s.travelsById?.[at.travelId])fail('旅队仓储引用缺失：'+st.id);
 }else if((at.kind!==undefined&&at.kind!=='scene')||typeof at.sceneId!=='string'||!s.scenesById?.[at.sceneId]&&!(s.contentVersion!=='sr-content-v1.2'&&at.sceneId==='scene:market')||!Number.isFinite(at.x)||!Number.isFinite(at.y))fail('仓储场景或坐标引用异常：'+st.id);
}
function validateMarketSupply(s){
 if(s.contentVersion!=='sr-content-v1.2')return;
 const e=s.srEconomy,ms=e.marketSupply,migration=e.marketSupplyMigration,source=s.stockpilesById[MARKET_SUPPLIER_STOCK],wallet=s.stockpilesById[MARKET_SUPPLIER_WALLET],toll=s.stockpilesById[MARKET_TOLL_STOCK];
 const nonnegative=v=>Number.isFinite(v)&&v>=0;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const at=(st,sceneId,x,y)=>st?.position?.sceneId===sceneId&&st.position.x===x&&st.position.y===y;
 const fact=(id,fields,required=true)=>{
  const found=s.factsById[id];if(!required){if(found)fail('供货阶段出现提前或重复事实：'+id);return null;}
  if(!found||found.id!==id||found.kind!=='inventory-transaction'||!Number.isSafeInteger(found.atTick)||found.atTick<0||found.atTick>s.worldTick||Object.entries(fields).some(([key,value])=>!same(found[key],value)))fail('供货来源或结算事实异常：'+id);
  return found;
 };
 if(e.marketSupplyVersion!==MARKET_SUPPLY_VERSION||e.marketRestockTick!==undefined||e.marketSourceRemaining!==undefined||!ms||!migration||!s.factsById['fact:market-supply-migration:v1']||!Number.isSafeInteger(e.nextMarketSourceQuoteTick)||e.nextMarketSourceQuoteTick<0||!Number.isSafeInteger(ms.nextInsightQuoteTick)||ms.nextInsightQuoteTick<0||!Number.isSafeInteger(ms.nextRunId)||ms.nextRunId<1||!Array.isArray(ms.queue)||!ms.runs||e.marketInsightSource?.ownerId!==MARKET_SUPPLIER||!nonnegative(e.marketInsightSource.balance))fail('青溪实体供货版本或游标异常。');
 if(!source||!wallet||!toll||source.ownerId!==MARKET_SUPPLIER||source.custodianId!==MARKET_SUPPLIER||wallet.ownerId!==MARKET_SUPPLIER||wallet.custodianId!==MARKET_SUPPLIER||toll.ownerId!=='person:chizhang-steward'||toll.custodianId!=='person:chizhang-steward'||!s.personsById[MARKET_SUPPLIER]||!s.personsById[MARKET_CARRIER]||![source,wallet,toll].every(st=>st.access==='private'&&st.carrierId===null)||!at(source,'scene:supply',35,31)||!at(wallet,'scene:supply',35,31)||!at(toll,'scene:supply',36,30))fail('供货仓、执事或承运人产权与位置异常。');
 if(migration.sourceStockpileId!==MARKET_SUPPLIER_STOCK||!Number.isSafeInteger(migration.oldQuoteTick)||!MARKET_SOURCE_GOODS.every(k=>nonnegative(migration.oldRemaining?.[k])&&nonnegative(migration.merchantStockAtMigration?.[k]))||!nonnegative(migration.oldRemaining?.insight)||JSON.stringify(s.factsById['fact:market-supply-migration:v1'].quantities)!==JSON.stringify(migration.oldRemaining))fail('旧余额迁移证据异常。');
 fact('fact:market-supply-migration:v1',{operation:'market-supply-migration',sourceStockpileId:source.id,quantities:migration.oldRemaining,merchantStockpileId:'stockpile:qingxi'});
 const active=ms.activeRunId,queued=new Set(ms.queue);
 if(queued.size!==ms.queue.length||active!==null&&!ms.runs[active]||active!==null&&queued.has(active)||ms.queue.some(id=>ms.runs[id]?.phase!=='quoted'))fail('供货队列或活跃批次异常。');
 const expectedInternalIds=new Set([source.id,wallet.id,toll.id]);
 const sourceBalance=Object.fromEntries(MARKET_SOURCE_GOODS.map(k=>[k,source.resources[k]]));
 let paidGoods=0,paidToll=0;
 for(const [id,r] of Object.entries(ms.runs)){
  const reserve=s.stockpilesById[r.sourceReserveId],fund=s.stockpilesById[r.fundStockpileId],cargo=r.cargoStockpileId&&s.stockpilesById[r.cargoStockpileId],completed=r.phase==='completed';
  if(r.id!==id||r.carrierId!==MARKET_CARRIER||!['quoted','outbound','at-source','purchased','returning','awaiting-delivery','completed','blocked'].includes(r.phase)||!Number.isSafeInteger(r.quotedTick)||r.quotedTick>s.worldTick||!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>40||!nonnegative(r.price)||!nonnegative(r.paidGoodsJade)||!nonnegative(r.paidTollJade)||!Number.isSafeInteger(r.consumedFood)||r.consumedFood<0||r.consumedFood>6||!reserve||!fund||reserve.ownerId!==MARKET_SUPPLIER||fund.ownerId!=='person:merchant-qingxi'||Object.entries(r.cargo||{}).some(([k,q])=>!MARKET_SOURCE_GOODS.includes(k)||!Number.isSafeInteger(q)||q<1)||Object.values(r.cargo).reduce((a,b)=>a+b,0)!==r.quantity||Math.abs(Object.entries(r.cargo).reduce((n,[k,q])=>n+q*GOODS[k].sell/10,0)-r.price)>1e-9||!s.factsById[`fact:supply-quote:${id}`])fail('供货报价或货位异常。');
  const purchased=['purchased','returning','awaiting-delivery','completed'].includes(r.phase);
  const actualCargo=purchased?cargo:reserve,expectedCustodian=completed?'person:merchant-qingxi':purchased?MARKET_CARRIER:MARKET_SUPPLIER;
  expectedInternalIds.add(r.sourceReserveId);expectedInternalIds.add(r.fundStockpileId);if(purchased)expectedInternalIds.add(r.cargoStockpileId);
  if(r.sourceReserveId!==`stockpile:${id}:source`||r.fundStockpileId!==`stockpile:${id}:fund`||r.cargoStockpileId!==(purchased?`stockpile:${id}:cargo`:null)||reserve.custodianId!==MARKET_SUPPLIER||reserve.carrierId!==null||!at(reserve,'scene:supply',35,31)||fund.custodianId!==(r.phase==='quoted'||completed?'person:merchant-qingxi':MARKET_CARRIER)||fund.carrierId!==(r.phase==='quoted'||completed?null:MARKET_CARRIER)||cargo&&cargo.carrierId!==(completed?null:MARKET_CARRIER))fail('供货预约仓、承运或实体货位异常。');
  if(r.phase==='quoted'&&!at(fund,'scene:market',37,25)||completed&&(!at(fund,'scene:market',37,25)||!at(cargo,'scene:market',37,25)))fail('供货款货位位置异常。');
  if(r.sourceStockpileId!==source.id||r.targetStockpileId!=='stockpile:qingxi'||r.paymentReservationId!==fund.id||r.priceVersion!=='goods-sell-per-ten:v1'||JSON.stringify(r.routeIds)!==JSON.stringify([...MARKET_SUPPLY_OUT,...MARKET_SUPPLY_BACK])||(r.phase==='quoted'?r.departureTick!==null:!Number.isSafeInteger(r.departureTick)||r.departureTick<r.quotedTick||r.departureTick>s.worldTick))fail('补货运单来源、价格版本或出发时刻异常。');
  if(r.cargoOwnerId!==actualCargo?.ownerId||r.cargoCustodianId!==expectedCustodian||JSON.stringify(r.cargoPosition)!==JSON.stringify(actualCargo?.position)||actualCargo?.custodianId!==expectedCustodian||reserve.access!=='private'||fund.access!=='private'||cargo&&cargo.access!=='private')fail('补货货位产权、保管或位置异常。');
  if(purchased!==!!cargo||r.paidGoodsJade!==(cargo?r.price:0)||![0,2].includes(r.paidTollJade)||!completed&&(r.consumedFood+fund.resources.food!==6||Math.abs(fund.resources.jade-(r.price+2-r.paidGoodsJade-r.paidTollJade))>1e-9)||completed&&(fund.resources.food!==0||fund.resources.jade!==0)||completed!==!!s.factsById[`fact:supply-delivery:${id}`]||completed&&r.settlementFactId!==`fact:supply-delivery:${id}`)fail('供货付款、货物或交付事实异常。');
  for(const[k,q]of Object.entries(r.cargo))if(reserve.resources[k]!== (purchased?0:q)||cargo&&cargo.resources[k]!== (completed?0:q))fail('供货批次预约或承运实物异常。');
  for(const k of MARKET_SOURCE_GOODS)sourceBalance[k]+=(completed?r.cargo[k]||0:purchased?cargo.resources[k]:reserve.resources[k]);
  if(Object.entries(reserve.resources).some(([k,q])=>q!==(purchased?0:r.cargo[k]||0))||cargo&&Object.entries(cargo.resources).some(([k,q])=>q!==(completed?0:r.cargo[k]||0))||Object.entries(fund.resources).some(([k,q])=>!['jade','food'].includes(k)&&q!==0))fail('供货专用货位出现未登记物资。');
  const quote=fact(`fact:supply-quote:${id}`,{operation:'supplier-quote',sourceStockpileId:source.id,sourceReserveId:reserve.id,fundStockpileId:fund.id,cargo:r.cargo,goodsPrice:r.price,tollLimit:2,foodReserved:6});
  if(quote.atTick!==r.quotedTick)fail('供货报价时刻异常。');
  const purchase=fact(`fact:supply-purchase:${id}`,{operation:'supplier-purchase',runId:id,actorId:MARKET_CARRIER,sellerId:MARKET_SUPPLIER,sourceStockpileId:reserve.id,targetStockpileId:`stockpile:${id}:cargo`,paymentSourceStockpileId:fund.id,paymentTargetStockpileId:wallet.id,cargo:r.cargo,payment:r.price},purchased);
  if(purchase&&purchase.atTick<r.quotedTick)fail('供货购买时刻异常。');
  const tollFact=fact(`fact:supply-toll:${id}`,{operation:'supplier-toll',runId:id,actorId:'person:chizhang-steward',sourceStockpileId:fund.id,targetStockpileId:toll.id,payment:2},r.paidTollJade===2);
  if(tollFact&&(!purchased||tollFact.atTick<purchase.atTick))fail('关口费结算时刻异常。');
  const delivery=fact(`fact:supply-delivery:${id}`,{operation:'supplier-delivery',runId:id,carrierId:MARKET_CARRIER,sourceStockpileId:`stockpile:${id}:cargo`,targetStockpileId:'stockpile:qingxi',cargo:r.cargo,paidGoodsJade:r.price,paidTollJade:r.paidTollJade,consumedFood:6},completed);
  if(delivery&&(!Number.isSafeInteger(r.completedTick)||delivery.atTick!==r.completedTick||delivery.atTick<purchase.atTick))fail('供货交付时刻异常。');
  if(r.phase==='quoted'&&r.consumedFood!==0||r.phase==='at-source'&&r.consumedFood!==3||purchased&&r.consumedFood<3||['awaiting-delivery','completed'].includes(r.phase)&&r.consumedFood!==6)fail('供货分段路粮进度异常。');
  for(let j=0;j<6;j++){
   const direction=j<3?'out':'back',index=j%3,routeId=(direction==='out'?MARKET_SUPPLY_OUT:MARKET_SUPPLY_BACK)[index];
   const road=fact(`fact:supply-road:${id}:travel:${id}:${direction}:${index}`,{operation:'supplier-route-food',runId:id,routeId,quantity:1,fundStockpileId:fund.id},j<r.consumedFood);
   if(road&&road.atTick<r.quotedTick)fail('供货分段路粮时刻异常。');
  }
  if(Object.keys(s.factsById).filter(fid=>fid.startsWith(`fact:supply-road:${id}:`)).length!==r.consumedFood)fail('供货分段路粮事实数量异常。');
  paidGoods+=r.paidGoodsJade;paidToll+=r.paidTollJade;
  if(['outbound','returning'].includes(r.phase)){const t=s.travelsById[r.travelId],direction=r.phase==='outbound'?'out':'back',routeIds=direction==='out'?MARKET_SUPPLY_OUT:MARKET_SUPPLY_BACK;if(!t||t.id!==`travel:${id}:${direction}`||t.kind!=='market-supply-travel'||t.participantIds?.[0]!==MARKET_CARRIER||!['traveling','blocked'].includes(t.status)||JSON.stringify(t.routeIds)!==JSON.stringify(routeIds)||t.durationTicks!==300||!nonnegative(t.progressTicks)||t.progressTicks>300||fund.position?.travelId!==t.id||cargo&&cargo.position?.travelId!==t.id||!Number.isSafeInteger(t.segmentIndex)||t.segmentIndex<0||t.segmentIndex>2||!nonnegative(t.segmentWork)||t.segmentWork>=MARKET_ROUTE_TICKS[t.routeIds[t.segmentIndex]]||s.personsById[MARKET_CARRIER].position?.travelId!==t.id)fail('补货实体旅程异常。');}
  if(!completed&&!queued.has(id)&&active!==id)fail('未完成供货批次失去承运引用。');
 }
 if(Object.keys(s.stockpilesById).filter(marketSupplyStockpile).some(id=>!expectedInternalIds.has(id))||MARKET_SOURCE_GOODS.some(k=>Math.abs(sourceBalance[k]-migration.oldRemaining[k])>1e-9)||Object.entries(source.resources).some(([k,q])=>!MARKET_SOURCE_GOODS.includes(k)&&q!==0))fail('供货迁移余额与实体来源不守恒。');
 let insightPaid=0,insightDelivered=0;
 for(const [id,record] of Object.entries(s.factsById).filter(([id])=>id.startsWith('fact:supply-insight:'))){
  if(!Number.isFinite(record.quantity)||record.quantity<=0||!Number.isFinite(record.payment)||record.payment<=0)fail('供货研学预算数量异常。');
  fact(id,{operation:'supplier-study-budget',sellerId:MARKET_SUPPLIER,buyerId:'person:merchant-qingxi',quantity:record.quantity,payment:record.quantity*GOODS.insight.sell/10,source:'marketInsightSource',targetStockpileId:'stockpile:qingxi',paymentTargetStockpileId:wallet.id});
  insightPaid+=record.payment;insightDelivered+=record.quantity;
 }
 if(Math.abs(e.marketInsightSource.balance+insightDelivered-migration.oldRemaining.insight)>1e-9||Math.abs(wallet.resources.jade-paidGoods-insightPaid)>1e-9||Math.abs(toll.resources.jade-paidToll)>1e-9||Object.entries(wallet.resources).some(([k,q])=>k!=='jade'&&q!==0)||Object.entries(toll.resources).some(([k,q])=>k!=='jade'&&q!==0))fail('供货价款、关口费或研学预算不守恒。');
}
export function validateEconomy(s){if(!s.srEconomy)return true;const e=s.srEconomy;validateMarketSupply(s);if(e.version!=='economy:yunxiu:v1'||!Number.isSafeInteger(e.nextId)||e.nextId<1||e.updatedThroughTick>s.worldTick)fail('经济版本/游标异常。');if(!e.wholesale||e.wholesale.windowSpent<0||e.wholesale.windowSpent>WHOLESALE_DEFINITION.periodBudget+1e-9||e.wholesale.spentLifetime>WHOLESALE_DEFINITION.lifetimeTreasury+1e-9||!Object.entries(e.resaleInventory).every(([k,v])=>RESOURCES[k]&&Number.isFinite(v)&&v>=-1e-9))fail('批发库存/周期预算异常。');if(e.pillInventoryVersion){if(e.pillInventoryVersion!=='positioned-pills:v1'||!s.factsById['fact:pill-stock-migration:v1'])fail('药物位置迁移标记或事实异常。');for(const st of Object.values(s.stockpilesById))if(st.pills&&(Object.keys(st.pills).length!==Object.keys(RECIPES).length||!Object.entries(st.pills).every(([id,q])=>RECIPES[id]&&Number.isSafeInteger(q)&&q>=0)))fail('实际药库计数异常：'+st.id);for(const[id,a]of Object.entries(e.pillAllocations)){if(a.id!==id||!s.personsById[a.personId]||!RECIPES[a.recipeId]||!Number.isSafeInteger(a.quantity)||a.quantity<1||!['reserved','consumed','refunded'].includes(a.phase)||!Array.isArray(a.parts)||new Set(a.parts.map(p=>p.stockpileId)).size!==a.parts.length||!a.parts.every(p=>s.stockpilesById[p.stockpileId]&&Number.isSafeInteger(p.quantity)&&p.quantity>0)||a.parts.reduce((n,p)=>n+p.quantity,0)!==a.quantity)fail('药物预约引用或数量异常。');if(a.phase==='consumed'&&!s.factsById[`fact:pill-consume:${id}`]||a.phase==='refunded'&&!s.factsById[`fact:pill-refund:${id}`])fail('药物消费或退款事实缺失。');}}for(const p of Object.values(e.patches))if(!Number.isFinite(p.remaining)||p.remaining<0||p.remaining>p.max)fail('有限资源来源异常。');for(const a of Object.values(s.activitiesById||{}))if(a.kind==='sr-harvest'&&a.reservedQuantity!==undefined&&a.reservedQuantity!==HARVEST_BATCH[a.resource])fail('采集整批预约数量异常。');for(const st of Object.values(s.stockpilesById))validateStockpile(s,st);for(const w of Object.values(s.workOrdersById))if(w.kind==='transport'){if(!s.personsById[w.carrierId]||!s.stockpilesById[w.sourceStockpileId]||!s.stockpilesById[w.targetStockpileId]||!['to-source','carrying','delivered','cancelled'].includes(w.phase)||!Object.entries(w.cargo).every(([k,v])=>legalCargoKey(k)&&v>0&&Number.isFinite(v)&&(!pillId(k)||Number.isSafeInteger(v))))fail('运输引用或状态异常。');const r=s.reservationsById[w.reservationId];if(['delivered','cancelled'].includes(w.phase)?!!r:!r||JSON.stringify(r.cost)!==JSON.stringify(w.cargo))fail('运输物资预约异常。');}for(const w of Object.values(s.workOrdersById))if(w.kind==='sr-merchant-collection'){if(!s.personsById[w.carrierId]||!s.buildingsById[w.targetId]||!s.stockpilesById[w.sourceStockpileId]||['to-source','waiting-for-goods'].includes(w.phase)&&!s.workOrdersById[w.productionWorkOrderId]||!['to-source','waiting-for-goods','carrying','delivered','cancelled','interrupted'].includes(w.phase)||!Number.isFinite(w.expectedPayment)||w.expectedPayment<0)fail('商人取货约定引用或阶段异常。');const a=s.activitiesById[w.activityId];if(['to-source','waiting-for-goods','carrying'].includes(w.phase)){if(a?.kind!=='sr-merchant-collection'||a.workOrderId!==w.id||s.personsById[w.carrierId].activityId!==a.id)fail('商人取货身体所有权异常。');}else if(a)fail('商人结束取货未清理身体活动。');if(['carrying','delivered','interrupted'].includes(w.phase)&&(!Number.isFinite(w.actualPayment)||!s.factsById[w.productionFactId]||!e.commonGoods.some(g=>g.id===`common-good:${w.targetId}:${w.productionBatch}`)))fail('已付款器物或实际付款事实缺失。');}for(const[id,o]of Object.entries(e.orders)){if(o.version===ORDER_V2){validateMarketOrderV2(s,id,o);continue;}if(!ORDER_DEFINITIONS[id]||!['accepted','completed','declined'].includes(o.phase))fail('商单异常。');if(o.phase==='completed'&&!s.factsById[o.resultTransactionId])fail('商单结算事实缺失。');}for(const w of Object.values(s.workOrdersById))if(w.kind==='sr-crafting'){validatePillRecipeSnapshot(s,w);if(!RECIPES[w.recipeId]||!s.personsById[w.personId]||!s.buildingsById[w.targetId]||!['active','completed','cancelled','interrupted'].includes(w.phase)||!Number.isSafeInteger(w.durationTicks)||w.durationTicks<1||!Number.isSafeInteger(w.progressTicks)||w.progressTicks<0||w.progressTicks>w.durationTicks||!Number.isSafeInteger(w.yield)||w.yield<1||!Object.entries(w.cost).every(([k,v])=>RESOURCES[k]&&Number.isFinite(v)&&v>=0&&s.stockpilesById[w.sourceStockpileIds[k]]))fail('丹炉批次引用、成本或进度异常。');if(w.phase==='active'){const a=s.activitiesById[w.activityId],r=s.reservationsById[w.reservationId],slot=s.reservationsById[w.slotReservationId];if(a?.kind!=='sr-craft'||a.workOrderId!==w.id||s.master.activityId!==a.id||r?.kind!=='sr-craft-material'||JSON.stringify(r.cost)!==JSON.stringify(w.cost)||slot?.kind!=='sr-slot'||slot.activityId!==a.id||slot.slotId!==a.slotId)fail('丹炉材料/工位预约异常。');}else if(s.reservationsById[w.reservationId]||s.reservationsById[w.slotReservationId]||s.activitiesById[w.activityId]||w.phase==='completed'&&(!validCompletedPillFact(s,w)||w.progressTicks!==w.durationTicks)||w.phase==='cancelled'&&!validCancelledPillFact(s,w))fail('已结束丹炉批次清理或产物事实异常。');}for(const a of Object.values(s.activitiesById))if(a.kind==='sr-replenish'&&(!e.patches[a.resource]||!Number.isSafeInteger(a.progressTicks)||a.progressTicks<0||a.progressTicks>=a.durationTicks||a.durationTicks!==ECONOMY_DEFINITION.replenishTicks||s.master.activityId!==a.id||s.reservationsById[a.reservationId]?.activityId!==a.id))fail('来源恢复事务异常。');return true;}
export const economyHandlers={preparePillUse,craftSR,cancelCraftSR,cancelMerchantCollection,startMasterHarvest,cancelMasterHarvest,startTransport,cancelTransport,transferProperty,replenishPatch,cancelReplenish,marketTrade,marketOrder};
