/** U-63 / U-167 / design 68 T-25: new GC26 batches use actual local water and fuel. */
export const WEST_ALCHEMY_RECIPE_VERSION='pill-recipes:west-workshops:v1';
export const westAlchemyEnabled=b=>b?.type==='alchemy'&&b.domainSiteId==='site:domain:gc-26';
export const WEST_ALCHEMY_SUPPLIES=Object.freeze({
 heal:Object.freeze({cleanWater:2,wood:1}),
 qi:Object.freeze({cleanWater:2,wood:1}),
 spirit:Object.freeze({cleanWater:3,wood:2}),
 foundation:Object.freeze({cleanWater:6,wood:4})
});

/** T-25 addition: only new orders use the sequential process; v1 stays immutable. */
export const WEST_ALCHEMY_PROCESS_RECIPE_VERSION='pill-recipes:west-workshops:v2';
export const WEST_ALCHEMY_PROCESS_VERSION='alchemy-process:west-workshops:v1';
export function alchemyProcessDefinition(inputCost,furnaceTicks){
 const definitions=[['prepare','药案整理','work:herb:1',20,['herb']],['extract','浸取过滤','work:filter:1',40,['cleanWater']],['fire','丹炉火候','work:1',furnaceTicks,['wood','crystal','jade','insight']],['seal','封藏入库','work:seal:1',20,[]]];
 return {version:WEST_ALCHEMY_PROCESS_VERSION,stages:definitions.map(([id,label,slotSuffix,durationTicks,keys])=>({id,label,slotSuffix,durationTicks,inputCost:Object.fromEntries(keys.filter(k=>Object.hasOwn(inputCost,k)).map(k=>[k,inputCost[k]]))}))};
}
