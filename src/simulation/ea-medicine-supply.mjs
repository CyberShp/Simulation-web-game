import {medicineMaterialNeeds} from './ea-medicine-materials.mjs';
/** T-MEDICINE-SUPPLY-20261025: finite public stock, voluntary bodies, existing orders. */
import {craftAvailabilityForPerson,requestAutonomousCraft,startTransport,cropRecipeFor,cancelPersonCraftSR} from './ea-sr-economy.mjs';
const HOME='scene:yunxiu-courtyard',STORE='stockpile:yunxiu';
const terminal=w=>!w||['completed','delivered','cancelled','interrupted'].includes(w.phase);
const localPublic=(s,st)=>st.access==='public'&&st.ownerId===s.stockpilesById[STORE]?.ownerId&&!st.carrierId&&(st.position?.sceneId||s.buildingsById[st.buildingId]?.sceneId||HOME)===HOME;
const stocks=s=>Object.values(s.stockpilesById||{}).filter(st=>localPublic(s,st));
function eligible(s,p){
 const m=p.mind,a=s.activitiesById[p.activityId];
 return p!==s.master&&p.lifeStatus!=='dead'&&s.homeMemberIds.includes(p.personId)&&p.location?.kind==='local'&&p.location.sceneId===HOME&&m&&!m.away&&!m.journey&&!m.office&&!p.job&&!m.learning&&!m.recovering&&p.wound<=5&&p.energy>=35&&m.satiety>=22&&!m.scenic?.spatialEvacuationOrderId&&!Object.values(p.schedule?.commitmentsById||{}).some(c=>c.status==='active'&&c.endTick>s.worldTick)&&(!a||a.kind==='facility'&&a.action==='rest')&&['rest','walk'].includes(m.activity)&&(!m.commitUntil||m.commitUntil<=s.time)&&.3*m.traits[3]+.1*m.traits[0]+.4*(m.relationships?.master?.trust??55)>=42;
}
function candidates(s){return s.disciples.filter(p=>eligible(s,p)).sort((a,b)=>(b.mind.skills.medicine||0)-(a.mind.skills.medicine||0)||a.personId.localeCompare(b.personId));}
function amounts(s){
 const home=s.stockpilesById[STORE]?.pills?.heal||0;
 const local=stocks(s).reduce((q,st)=>q+(st.pills?.heal||0),0);
 const transit=Object.values(s.workOrdersById||{}).filter(w=>w.kind==='transport'&&['to-source','carrying'].includes(w.phase)&&localPublic(s,s.stockpilesById[w.sourceStockpileId]||{})&&localPublic(s,s.stockpilesById[w.targetStockpileId]||{})).reduce((q,w)=>q+(w.cargo?.['pill:heal']||0),0);
 const pending=Object.values(s.workOrdersById||{}).filter(w=>w.kind==='sr-crafting'&&w.recipeId==='heal'&&w.phase==='active'&&(s.buildingsById[w.targetId]?.sceneId||HOME)===HOME).reduce((q,w)=>q+w.yield,0);
 return {home,local,transit,pending,committed:local+transit+pending};
}
export function setMedicineSupply(s,{enabled,target=2}={}){
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(target)||target<0||target>10)throw Error('回春散储备目标须为0至10份，并明确是否启用。');
 s.medicineSupply??={version:1,enabled:false,target:2,lastTick:s.worldTick,nextCheckTick:s.worldTick,active:null,lastCompleted:null,reason:'尚未安排回春散供给。'};
 Object.assign(s.medicineSupply,{enabled,target,nextCheckTick:s.worldTick,reason:enabled&&target>0?'按储备缺口等待门人自主承接。':'暂停新供给任务，已投入的工序与运输继续。'});
 return {enabled,target};
}
function track(s,r,p,result,kind,buildingId){
 r.active={personId:p.personId,workOrderId:result.id,kind,buildingId};
 r.reason=kind==='craft'?`${p.name}愿意按现有丹方炼制回春散。`:kind==='deliver'?`${p.name}愿意将已制成回春散运回公库。`:`${p.name}愿意把本批实际材料送到丹房。`;
 p.mind.reason=r.reason;
}
function carry(s,r,people,source,target,cargo,kind,buildingId){
 let reason='暂时没有愿意且有余力的门人承担搬运。';
 for(const p of people){try{const result=startTransport(s,source,target,p.personId,cargo);if(result.accepted===false){reason=result.reason;continue;}track(s,r,p,result,kind,buildingId);return true;}catch(error){reason=error.message;}}
 r.reason=reason;return false;
}
export function advanceMedicineSupply(s){
 const r=s.medicineSupply;if(!r||r.lastTick>=s.worldTick)return;r.lastTick=s.worldTick;
 if(r.active){const w=s.workOrdersById[r.active.workOrderId],p=s.personsById[r.active.personId];
  // The volunteer ends only their own supply batch when the body cannot continue.
  // Normal pauses, occupied stations and a full store retain the paid batch.
  if(w?.phase==='active'&&w.kind==='sr-crafting'&&w.autonomous===true&&p?.activityId===w.activityId&&w.personId===p.personId&&(p.wound>20||p.location?.kind!=='local'||p.location.sceneId!==HOME)){
   const cause=p.wound>20?'伤势需要休养':'本人已离院';
   cancelPersonCraftSR(s,p.personId);
   r.lastInterruption={personId:p.personId,workOrderId:w.id,atTick:s.worldTick,reason:`${p.name}因${cause}中止本批，已用材料按实际工序结清，余料退回。`};
   if(p.wound>20)p.mind.recovering=true;
  }
  if(!terminal(w))return;
  r.lastCompleted={...r.active,phase:w?.phase||'missing',atTick:s.worldTick};r.active=null;r.nextCheckTick=s.worldTick;
 }
 if(!r.enabled||r.target===0){r.reason='暂停新供给任务，已投入的工序与运输继续。';return;}
 if(s.worldTick<r.nextCheckTick)return;r.nextCheckTick=s.worldTick+20;
 const count=amounts(s);
 if(count.home>=r.target){r.reason='公库回春散已达到目标，暂停新的备料与炼制。';return;}
 const ready=stocks(s).filter(st=>st.id!==STORE&&(st.pills?.heal||0)>0).sort((a,b)=>a.id.localeCompare(b.id));
 if(!ready.length&&count.committed>=r.target){r.reason='现有在制与运输已覆盖储备缺口，等待实际入库。';return;}
 const materialNeeds=medicineMaterialNeeds(s);
 if(materialNeeds.foodProtected){r.reason=`公库口粮${materialNeeds.homeFood}份，先补足${materialNeeds.foodTarget}份生活储备，再接新的药物筹备。`;return;}
 const people=candidates(s);if(!people.length){r.reason='暂无愿意且空闲的门人；需先履行原差事或恢复身体。';return;}
 if(ready.length){const st=ready[0];carry(s,r,people,st.id,STORE,{'pill:heal':Math.min(st.pills.heal,r.target-count.home)},'deliver',st.buildingId||null);return;}
 const buildings=Object.values(s.buildingsById).filter(b=>b.type==='alchemy'&&b.enabled!==false&&b.condition>0&&!b.spatialLock&&(b.sceneId||HOME)===HOME).sort((a,b)=>a.instanceId.localeCompare(b.instanceId));
 if(!buildings.length){r.reason='尚无可用丹房，等待真实建成并开放。';return;}
 let reason='等待可用丹房工位。';
 for(const b of buildings){
  const site=s.stockpilesById[`stockpile:${b.instanceId}`];if(!site||!localPublic(s,site))continue;
  const quote=craftAvailabilityForPerson(s,'heal',people[0].personId,{buildingId:b.instanceId});
  const missing=Object.entries(quote.cost||{}).filter(([k,q])=>(s.stockpilesById[quote.sourceStockpileIds?.[k]||(['jade','insight'].includes(k)?STORE:site.id)]?.resources[k]||0)<q);
  if(missing.length){
   const needs=medicineMaterialNeeds(s,{buildingId:b.instanceId});
   let moved=false;
   for(const [key,need] of missing){if(['jade','insight'].includes(key)){reason='公共灵石或研习预算不足，等待真实补足。';continue;}
    const deficit=needs.materials[key]?.deficit??need-(site.resources[key]||0);
    if(deficit<=0){reason='所缺原料已在实际运输途中，等待送达丹房。';continue;}
    reason=`本批材料不足：${({herb:'灵草',cleanWater:'洁水',wood:'木材'})[key]||key}尚缺${deficit}，等待实际库存补足。`;
    const sources=stocks(s).filter(st=>st.id!==site.id&&(st.resources[key]||0)>0).sort((a,b)=>a.id===STORE?-1:b.id===STORE?1:a.id.localeCompare(b.id));
    for(const st of sources){const cargo={};let space=40;
     for(const [k,q] of missing){if(['jade','insight'].includes(k))continue;const reserve=cropRecipeFor(s.buildingsById[st.buildingId])?.seedCost?.[k]||0,quantity=Math.min(needs.materials[k]?.deficit??q-(site.resources[k]||0),Math.max(0,(st.resources[k]||0)-reserve),space);if(quantity>0){cargo[k]=quantity;space-=quantity;}}
     if(!Object.keys(cargo).length)continue;
     if(carry(s,r,people,st.id,site.id,cargo,'materials',b.instanceId)){moved=true;break;}reason=r.reason;
    }
    if(moved)return;
    if(!sources.length)reason=`本批材料不足：${({herb:"灵草",cleanWater:"洁水",wood:"木材"})[key]||key}尚缺${deficit}，等待实际库存补足。`;
   }
   continue;
  }
  for(const p of people){const q=craftAvailabilityForPerson(s,'heal',p.personId,{buildingId:b.instanceId});if(!q.available){reason=q.reasons.join('；');continue;}
   const result=requestAutonomousCraft(s,p.personId,'heal',{buildingId:b.instanceId});if(result.accepted===false){reason=result.reason;continue;}track(s,r,p,result,'craft',b.instanceId);return;
  }
 }
 r.reason=reason;
}
export function medicineSupplyView(s){
 const r=s.medicineSupply,c=amounts(s),a=r?.active,w=a&&s.workOrdersById[a.workOrderId],p=a&&s.personsById[a.personId];
 return {enabled:r?.enabled||false,target:r?.target??2,...c,lastInterruption:r?.lastInterruption?{reason:r.lastInterruption.reason,atTick:r.lastInterruption.atTick}:null,materials:medicineMaterialNeeds(s),reason:r?.reason||'可设置回春散储备目标，由门人自主筹备与炼制。',active:a?{name:p?.name||'门人',kind:{materials:'搬运材料',craft:'炼制回春散',deliver:'成药入库'}[a.kind],phase:s.activitiesById[w?.activityId]?.reason||w?.reason||({active:'正在操作',completed:'工序已完成',delivered:'已实际送达',cancelled:'已中止',interrupted:'已中断'})[w?.phase]||'等待接续'}:null};
}
export function validateMedicineSupply(s){
 const r=s.medicineSupply;if(!r)return true;const bad=()=>{throw Error('药物供给政策或任务引用异常。');};
 if(r.version!==1||typeof r.enabled!=='boolean'||!Number.isSafeInteger(r.target)||r.target<0||r.target>10||!Number.isSafeInteger(r.lastTick)||r.lastTick>s.worldTick||!Number.isSafeInteger(r.nextCheckTick)||typeof r.reason!=='string')bad();
 if(r.lastInterruption){const i=r.lastInterruption,w=s.workOrdersById[i.workOrderId];if(!s.personsById[i.personId]||w?.personId!==i.personId||w.kind!=='sr-crafting'||w.autonomous!==true||w.phase!=='cancelled'||!s.factsById[`fact:craft-cancel:${w.id}`]||!Number.isSafeInteger(i.atTick)||i.atTick<0||i.atTick>s.worldTick||typeof i.reason!=='string')bad();}
 if(r.active){const a=r.active,w=s.workOrdersById[a.workOrderId];if(!s.personsById[a.personId]||!terminal(w)&&!s.homeMemberIds.includes(a.personId)||!['materials','craft','deliver'].includes(a.kind)||!w||a.personId!==(w.personId||w.carrierId)||w.kind!==(a.kind==='craft'?'sr-crafting':'transport')||a.kind==='craft'&&(w.recipeId!=='heal'||w.targetId!==a.buildingId))bad();}
 return true;
}
