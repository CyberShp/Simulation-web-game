/** Departure selection is a local plan; the travel command rechecks willingness. */
export function expeditionPartyPlan(party,selectedIds=[]){
 const maxCompanions=Number.isSafeInteger(party?.maxCompanions)&&party.maxCompanions>=0?party.maxCompanions:2;
 const selected=[...new Set(selectedIds)],candidates=party?.candidates||[],byId=new Map(candidates.map(c=>[c.personId,c]));
 const issues=selected.flatMap(id=>{const person=byId.get(id);return person?.available?[]:[`${person?.name||'原选择的门人'}：${person?.reason||'当前已不能同行'}`];});
 if(selected.length>maxCompanions)issues.unshift(`本次最多邀请${maxCompanions}位门人。`);
 return {maxCompanions,selected,candidates,available:issues.length===0,reason:issues.join('；'),label:selected.length?`与${selected.length}位门人出谷`:'掌门独行出谷'};
}
