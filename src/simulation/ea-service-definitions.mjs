/** U-167/T-21: immutable inputs for a new, explicitly enabled site service batch. */
export const SITE_SERVICE_VERSION='site-services:yunxiu:v1';
export const SERVICE_RECIPE_VERSION='site-service-recipes:yunxiu:v1';
export function siteServiceEnabled(building){return building?.serviceVersion===SITE_SERVICE_VERSION&&['kitchen','clinic'].includes(building.type);}
export const SERVICE_RECIPES=Object.freeze({
 meal:Object.freeze({id:'meal',buildingType:'kitchen',name:'饭食',slotKind:'work',slotKey:'work:1',durationTicks:120,input:Object.freeze({food:9,cleanWater:2,wood:1}),output:Object.freeze({meal:10}),skill:null,skillGate:0}),
 spiritMeal:Object.freeze({id:'spiritMeal',buildingType:'kitchen',name:'灵膳',slotKind:'work',slotKey:'work:special:1',durationTicks:240,input:Object.freeze({food:2,herb:1,cleanWater:2,wood:1}),output:Object.freeze({spiritMeal:2}),skill:'alchemy',skillGate:20}),
 treatment:Object.freeze({id:'treatment',buildingType:'clinic',name:'诊疗',slotKind:'work',slotKey:'doctor:1',patientSlotKind:'treatment',patientSlotKey:'consult:1',durationTicks:80,input:Object.freeze({herb:1,cleanWater:1}),woundRecovery:4,energyRecovery:0,skills:Object.freeze(['spring','alchemy']),skillGate:20}),
 bath:Object.freeze({id:'bath',buildingType:'clinic',name:'药浴',slotKind:'work',slotKey:'doctor:1',patientSlotKind:'heal',durationTicks:200,input:Object.freeze({herb:2,cleanWater:4,wood:1}),woundRecovery:8,energyRecovery:6,skills:Object.freeze(['spring','alchemy']),skillGate:20})
});
export function serviceRecipe(id,level=1){
 const recipe=SERVICE_RECIPES[id];if(!recipe||!Number.isInteger(level)||level<1||level>3)throw Error('服务配方或设施等级无效。');
 return {...recipe,version:SERVICE_RECIPE_VERSION,level,input:{...recipe.input,...(id==='meal'?{food:10-level}:{})},...(recipe.output?{output:{...recipe.output}}:{})};
}
