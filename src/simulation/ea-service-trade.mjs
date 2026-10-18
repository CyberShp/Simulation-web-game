/** U-167/T-21: the declared finite water source uses the existing supply route. */
import {serviceResourcesEnabled} from './ea-resource-types.mjs';
export const SERVICE_TRADE_VERSION='service-trade:yunxiu:v1';
export const SERVICE_WATER_SOURCE=Object.freeze({stockpileId:'stockpile:qingxi-supplier',ownerId:'person:qingxi-supply-clerk',quantity:320,factId:'fact:service-water-source:v1'});
export const SERVICE_TRADE_GOODS=Object.freeze({cleanWater:Object.freeze({name:'洁水',buy:8,sell:3})});
export const serviceTradeEnabled=s=>serviceResourcesEnabled(s)&&s.srEconomy?.serviceTrade?.version===SERVICE_TRADE_VERSION;
export function validateServiceTrade(s){
 const marker=s.srEconomy?.serviceTrade,fact=s.factsById?.[SERVICE_WATER_SOURCE.factId];
 if(marker===undefined){if(fact)throw Error('洁水供货版本缺失。');return true;}
 if(!serviceTradeEnabled(s)||Object.keys(marker).length!==3||marker.sourceFactId!==SERVICE_WATER_SOURCE.factId||!Number.isSafeInteger(marker.enabledAtTick)||marker.enabledAtTick<s.serviceResources.enabledAtTick||marker.enabledAtTick>s.worldTick||fact?.id!==SERVICE_WATER_SOURCE.factId||fact.kind!=='inventory-transaction'||fact.operation!=='service-water-source'||fact.version!==SERVICE_TRADE_VERSION||fact.sourceStockpileId!==SERVICE_WATER_SOURCE.stockpileId||fact.ownerId!==SERVICE_WATER_SOURCE.ownerId||fact.quantity!==SERVICE_WATER_SOURCE.quantity||fact.atTick!==marker.enabledAtTick)throw Error('洁水供货版本或有限来源事实异常。');
 return true;
}
export function enableServiceTrade(s){
 validateServiceTrade(s);if(serviceTradeEnabled(s))return false;
 const source=s.stockpilesById?.[SERVICE_WATER_SOURCE.stockpileId];
 if(!serviceResourcesEnabled(s)||s.srEconomy?.marketSupplyVersion!=='market-supply:physical:v1'||!source||source.ownerId!==SERVICE_WATER_SOURCE.ownerId||source.access!=='private'||source.position?.sceneId!=='scene:supply'||(source.resources.cleanWater||0)!==0)throw Error('具名洁水来源尚不能登记。');
 const quantity=Object.values(source.resources).reduce((n,q)=>n+q,0)+Object.values(source.pills||{}).reduce((n,q)=>n+q,0);
 if(quantity+SERVICE_WATER_SOURCE.quantity>source.capacity)throw Error('供货仓容量不足，保留原货物。');
 const {factId,stockpileId,ownerId}=SERVICE_WATER_SOURCE;
 source.resources.cleanWater=SERVICE_WATER_SOURCE.quantity;
 s.factsById[factId]={id:factId,kind:'inventory-transaction',operation:'service-water-source',version:SERVICE_TRADE_VERSION,sourceStockpileId:stockpileId,ownerId,quantity:SERVICE_WATER_SOURCE.quantity,atTick:s.worldTick};
 s.srEconomy.serviceTrade={version:SERVICE_TRADE_VERSION,sourceFactId:factId,enabledAtTick:s.worldTick};
 return true;
}
