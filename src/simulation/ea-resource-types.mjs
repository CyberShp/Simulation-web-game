/** U-167/T-21. Service goods share existing physical stocks and accounting. */
export const BASE_RESOURCES={jade:'灵石',wood:'灵木',stone:'青石',herb:'灵草',crystal:'灵晶',insight:'道韵',food:'口粮'};
export const SERVICE_RESOURCE_VERSION='service-resources:yunxiu:v1';
export const SERVICE_RESOURCES=Object.freeze({rawWater:'原水',cleanWater:'洁水',meal:'饭食',spiritMeal:'灵膳'});
const ALL_RESOURCES=Object.freeze({...BASE_RESOURCES,...SERVICE_RESOURCES});
const ENABLE_FACT='fact:service-resources:v1';
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
export const serviceResourcesEnabled=s=>s?.serviceResources?.version===SERVICE_RESOURCE_VERSION;
export const resourceTypes=s=>serviceResourcesEnabled(s)?ALL_RESOURCES:BASE_RESOURCES;
export const knownResource=(s,key)=>Object.hasOwn(resourceTypes(s),key);
export function validResourceMap(s,map,{requiredBase=true,max=1e12}={}){
 return record(map)&&(!requiredBase||Object.keys(BASE_RESOURCES).every(key=>Object.hasOwn(map,key)))&&Object.entries(map).every(([key,value])=>knownResource(s,key)&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max);
}
export function resourceBalance(s,map,key){
 if(!knownResource(s,key))throw Error('未登记的物资类型。');
 return map[key]??(Object.hasOwn(SERVICE_RESOURCES,key)?0:undefined);
}
export const zeroResources=s=>Object.fromEntries(Object.keys(resourceTypes(s)).map(key=>[key,0]));
export function validateServiceResources(s){
 const enabled=s.serviceResources;
 if(enabled===undefined){if(s.factsById?.[ENABLE_FACT])throw Error('生活物资启用记录缺失。');return true;}
 const fact=s.factsById?.[ENABLE_FACT];
 if(!record(enabled)||Object.keys(enabled).length!==3||enabled.version!==SERVICE_RESOURCE_VERSION||enabled.originFactId!==ENABLE_FACT||!Number.isSafeInteger(enabled.enabledAtTick)||enabled.enabledAtTick<0||enabled.enabledAtTick>s.worldTick||fact?.id!==ENABLE_FACT||fact.kind!=='content-enable'||fact.version!==SERVICE_RESOURCE_VERSION||fact.atTick!==enabled.enabledAtTick)throw Error('生活物资版本或启用事实异常。');
 return true;
}
/** Called only inside a validated public command. It grants no goods. */
export function enableServiceResources(s){
 validateServiceResources(s);
 if(serviceResourcesEnabled(s))return false;
 if(s.schemaVersion!==6||s.contentVersion!=='sr-content-v1.2'||s.srEconomy?.version!=='economy:yunxiu:v1'||!Number.isSafeInteger(s.worldTick)||s.worldTick<0||!record(s.factsById))throw Error('当前世界尚不支持生活物资。');
 s.factsById[ENABLE_FACT]={id:ENABLE_FACT,kind:'content-enable',version:SERVICE_RESOURCE_VERSION,atTick:s.worldTick};
 s.serviceResources={version:SERVICE_RESOURCE_VERSION,enabledAtTick:s.worldTick,originFactId:ENABLE_FACT};
 return true;
}
