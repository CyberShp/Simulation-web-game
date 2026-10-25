/** A finite, face-to-face request using the existing voluntary craft and transport orders. */
import {RECIPES,RESOURCES} from './ea-data.mjs';
import {SERVICE_RESOURCES} from './ea-resource-types.mjs';
import {developmentContact} from './ea-disciple-development.mjs';
import {autonomousCraftAvailability,craftAvailabilityForPerson,pharmacistProgress,requestAutonomousCraft,craftProcessView,startTransport,cancelPersonCraftSR,craftPreparationAvailability,cropRecipeFor,stockpileReceiptPreview,validateCraftPreparationTerms} from './ea-sr-economy.mjs';
const HOME='stockpile:yunxiu',SCENE='scene:yunxiu-courtyard';
const copy=x=>structuredClone(x);
const visible=(s,p)=>!p.mind?.hiddenKnowledge?.alchemy||s.society?.secrets?.some(e=>e.id===p.mind.hiddenKnowledge.alchemy&&e.discovered);
const pending=r=>r.status==='accepted';
const records=s=>s.discipleCraftRequests?.records||[];
const person=(s,id)=>(s.disciples||[]).find(p=>p.personId===id&&s.homeMemberIds.includes(id)&&p.lifeStatus!=='dead');
function publicSite(s,b){const home=s.stockpilesById[HOME],site=s.stockpilesById[`stockpile:${b?.instanceId}`];return !!home&&home.access==='public'&&!!site&&site.access==='public'&&site.ownerId===home.ownerId&&!site.carrierId&&(b.sceneId||SCENE)===SCENE&&(site.position?.sceneId||SCENE)===SCENE;}
function commitment(s,p){return p.mind.commitUntil>s.time||p.schedule?.commitUntilTick>s.worldTick||Object.values(p.schedule?.commitmentsById||{}).some(c=>c.status==='active'&&c.endTick>s.worldTick);}
function gate(s,p,recipeId,buildingId){
 const contact=developmentContact(s,p),b=s.buildingsById[buildingId],qualified=pharmacistProgress(s,p.personId).recipes.find(r=>r.recipeId===recipeId);
 if(!b||!publicSite(s,b))return {recipeId,name:RECIPES[recipeId].name,buildingId,qualified:qualified.qualified,requirements:qualified.requirements,available:false,willing:null,score:null,reasons:['宗门委托须使用同院、同一公共产权的丹房现场库和公库。'],materials:[],canPrepare:false,prepareReasons:['宗门委托须使用同院同产权的公共材料。'],preparationMaterials:[],yield:RECIPES[recipeId].yield,durationTicks:0,processStages:[],sourceStockpileIds:{}};
 const quote=craftAvailabilityForPerson(s,recipeId,p.personId,{buildingId}),choice=autonomousCraftAvailability(s,p.personId,recipeId,{buildingId});
 const reasons=[];
 if(!contact.available)reasons.push('先与门人在院中走近交谈，再商议炼制。');
 if(commitment(s,p))reasons.push('本人已有尚未到期的承诺，先履行原安排。');
 const pureRefusal=choice.score!==undefined&&choice.score<42;
 if(!choice.accepted&&!pureRefusal)reasons.push(choice.reason);
 if(pureRefusal)reasons.push(...quote.reasons);
 const materials=(publicSite(s,b)?Object.entries(quote.cost):[]).map(([resource,required])=>{const sourceStockpileId=quote.sourceStockpileIds[resource],stock=s.stockpilesById[sourceStockpileId];return{resource,label:RESOURCES[resource]||SERVICE_RESOURCES[resource]||resource,required,available:stock?.resources[resource]||0,sourceStockpileId,sourceLabel:sourceStockpileId===HOME?'院中公库':'丹房现场库'};});
 const prepChoice=craftPreparationAvailability(s,p.personId,recipeId,{buildingId,deferred:true}),prepareReasons=[];
 if(!contact.available)prepareReasons.push('先当面商议这一炉的筹备。');if(!prepChoice.accepted)prepareReasons.push(prepChoice.reason);
 if((p.mind.relationships?.master?.trust??55)<35||p.mind.traits[3]<40)prepareReasons.push('本人暂不愿承担备料搬运。');
 if(!quote.materialLocks?.some(row=>!row.publicBudget))prepareReasons.push('现场材料已齐，可直接商议炼制。');
 return {recipeId,name:RECIPES[recipeId].name,buildingId,qualified:qualified.qualified,requirements:qualified.requirements,available:!reasons.length,willing:choice.accepted,score:choice.score??null,reasons,materials,canPrepare:!prepareReasons.length,prepareReasons,preparationMaterials:preparationMaterials(s,quote,buildingId),yield:quote.yield,durationTicks:quote.durationTicks,processStages:quote.processStages||[],sourceStockpileIds:quote.sourceStockpileIds};
}
function receipt(r){const {signature,...answer}=r;return copy(answer);}
function latest(s,id){return records(s).filter(r=>r.personId===id).at(-1)||null;}
export function requestDiscipleCraft(s,{personId,recipeId,buildingId}={}){
 const p=person(s,personId);if(!p||p===s.master)throw Error('只能与本院在籍门人商议炼制。');
 if(!RECIPES[recipeId])throw Error('没有这项正式丹方。');
 if(s.buildingsById[buildingId]?.type!=='alchemy')throw Error('请选择真实丹房，再商议这一炉。');
 if(!developmentContact(s,p).available)throw Error('先与门人在院中走近交谈，再商议炼制。');
 if(!visible(s,p))throw Error('本人暂不愿详谈药理与炼制安排。');
 const active=records(s).find(r=>r.personId===personId&&pending(r));
 if(active&&!active.preparation&&active.recipeId===recipeId&&active.buildingId===buildingId)return receipt(active);
 const q=gate(s,p,recipeId,buildingId),reason=active?'本人已有一炉及其交付承诺，先完成原安排。':q.reasons.join('；'),signature=JSON.stringify([personId,recipeId,buildingId,q.available,q.willing,reason,q.qualified,q.requirements,q.materials]);
 const old=latest(s,personId);if(old?.signature===signature&&!old.accepted)return receipt(old);
 let result=null;
 if(!active&&q.available)result=requestAutonomousCraft(s,personId,recipeId,{buildingId});
 const accepted=!!result?.accepted;
 s.discipleCraftRequests??={version:1,nextId:1,lastTick:s.worldTick,records:[]};
 const state=s.discipleCraftRequests,r={id:`request:disciple-craft:${state.nextId++}`,personId,recipeId,recipeName:RECIPES[recipeId].name,buildingId,atTick:s.worldTick,status:accepted?'accepted':!active&&q.available&&!q.willing?'refused':'unavailable',accepted,available:!active&&q.available,reason:accepted?'我愿按这一炉的实际丹方炼制，成药再实际运回公库。':result?.reason||reason,signature,craftOrderId:accepted?result.id:null,deliveryOrderId:null,phase:accepted?'crafting':'answered'};
 state.records.push(r);return receipt(r);
}
function publicMaterialStock(s,stock){const home=s.stockpilesById[HOME],b=s.buildingsById[stock?.buildingId];return !!stock&&stock.access==='public'&&stock.ownerId===home?.ownerId&&!stock.carrierId&&(stock.position?.sceneId||b?.sceneId||SCENE)===SCENE&&!b?.spatialLock;}
function materialSurplus(s,stock,key){const b=s.buildingsById[stock.buildingId],order=b&&s.workOrdersById[`work:production:${b.instanceId}`];return Math.max(0,(stock.resources[key]||0)-(cropRecipeFor(b,order)?.seedCost?.[key]||0));}
function preparationMaterials(s,quote,buildingId){
 const site=s.stockpilesById[`stockpile:${buildingId}`];if(!publicMaterialStock(s,site))return [];
 return Object.entries(quote.cost).filter(([key])=>!['jade','insight'].includes(key)).map(([resource,required])=>{
  const onsite=site.resources[resource]||0,inTransit=Object.values(s.workOrdersById).filter(w=>w.kind==='transport'&&['to-source','carrying'].includes(w.phase)&&w.targetStockpileId===site.id&&publicMaterialStock(s,s.stockpilesById[w.sourceStockpileId])).reduce((n,w)=>n+(w.cargo[resource]||0),0),deficit=Math.max(0,required-onsite-inTransit),publicAvailable=Object.values(s.stockpilesById).filter(stock=>stock.id!==site.id&&publicMaterialStock(s,stock)).reduce((n,stock)=>n+materialSurplus(s,stock,resource),0);
  return {resource,label:RESOURCES[resource]||SERVICE_RESOURCES[resource]||resource,required,site:onsite,deficit,publicAvailable,inTransit,missing:Math.max(0,deficit-publicAvailable)};
 });
}
export function requestDiscipleCraftPreparation(s,{personId,recipeId,buildingId}={}){
 const p=person(s,personId);if(!p||p===s.master||!RECIPES[recipeId]||s.buildingsById[buildingId]?.type!=='alchemy')throw Error('只能与在籍门人商议真实丹房的既有丹方。');
 if(!developmentContact(s,p).available)throw Error('先与门人在院中走近交谈，再商议筹备。');if(!visible(s,p))throw Error('本人暂不愿详谈药理与炼制安排。');
 const active=records(s).find(r=>r.personId===personId&&pending(r));if(active?.preparation&&active.recipeId===recipeId&&active.buildingId===buildingId)return receipt(active);
 const q=gate(s,p,recipeId,buildingId),reason=active?'本人已有一炉与交付承诺，先完成原安排。':q.prepareReasons.join('；'),signature=JSON.stringify(['preparation',personId,recipeId,buildingId,q.canPrepare,reason,q.preparationMaterials,q.materials]);
 const old=latest(s,personId);if(old?.signature===signature&&!old.accepted)return receipt(old);
 const choice=craftPreparationAvailability(s,personId,recipeId,{buildingId,deferred:true}),accepted=!active&&q.canPrepare,quote=choice.quote||craftAvailabilityForPerson(s,recipeId,personId,{buildingId});
 s.discipleCraftRequests??={version:1,nextId:1,lastTick:s.worldTick,records:[]};const state=s.discipleCraftRequests;
 const r={id:`request:disciple-craft:${state.nextId++}`,personId,recipeId,recipeName:RECIPES[recipeId].name,buildingId,atTick:s.worldTick,status:accepted?'accepted':choice.score!==undefined&&choice.score<42?'refused':'unavailable',accepted,available:accepted,reason:accepted?'我愿筹备这一炉，材料实际齐备后再按原丹方炼制并运回公库。':reason,signature,craftOrderId:null,deliveryOrderId:null,phase:accepted?'preparing':'answered'};
 if(accepted)r.preparation={version:1,recipeVersion:quote.recipeVersion,cost:copy(quote.cost),sourceStockpileIds:copy(quote.sourceStockpileIds),materialTransportIds:[],activeTransportId:null};state.records.push(r);return receipt(r);
}
export function cancelDiscipleCraftPreparation(s,{requestId}={}){
 const r=records(s).find(r=>r.id===requestId);if(!r?.preparation||r.status!=='accepted'||r.phase!=='preparing'||r.craftOrderId)throw Error('只能撤回尚未开炉的筹备。');
 r.status='interrupted';r.phase='interrupted';r.finishedTick=s.worldTick;r.reason='已撤回这一炉筹备；已接受的材料运输继续按原安排交付，物资保留实际位置。';return receipt(r);
}
const sameFields=(a,b)=>!!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>b[k]===v);
function advancePreparation(s,p,r,{allowExpiredWork=false}={}){
 const prep=r.preparation,quote=craftAvailabilityForPerson(s,r.recipeId,p.personId,{buildingId:r.buildingId});
 if(prep.recipeVersion!==quote.recipeVersion||!sameFields(prep.cost,quote.cost)||!sameFields(prep.sourceStockpileIds,quote.sourceStockpileIds)){r.reason='丹房配方或材料来源已变化，保留已到材料，暂停开炉；请撤回后重新商议。';return;}
 if(prep.activeTransportId){const w=s.workOrdersById[prep.activeTransportId];if(w&&['to-source','carrying'].includes(w.phase)){r.reason=w.reason;return;}if(w?.phase!=='delivered'){interrupt(s,r,'备料运输已中止，材料留在实际结清位置；这一炉尚未开炉。');return;}prep.activeTransportId=null;}
 if(!publicSite(s,s.buildingsById[r.buildingId])){r.reason='公共材料产权或丹房状态已变化，暂停筹备。';return;}
 if(commitment(s,p)){r.reason='先履行本人当前承诺，保留这一炉筹备。';return;}
 const choice=craftPreparationAvailability(s,p.personId,r.recipeId,{buildingId:r.buildingId,deferred:allowExpiredWork});if(!choice.accepted){r.reason=choice.reason;return;}
 const materials=preparationMaterials(s,quote,r.buildingId),missing=materials.filter(row=>row.deficit>0);
 if(!quote.materialLocks.length){const oldJob=p.job;if(allowExpiredWork)p.job=null;const out=requestAutonomousCraft(s,p.personId,r.recipeId,{buildingId:r.buildingId});if(!out.accepted){p.job=oldJob;r.reason=out.reason;return;}r.craftOrderId=out.id;r.craftStartedTick=s.worldTick;r.phase='crafting';r.reason='本炉材料已实际备齐，本人按原丹方开始炼制。';return true;}
 if(!missing.length){r.reason='所缺材料已在真实运输途中，等待送达丹房。';return;}
 for(const source of Object.values(s.stockpilesById).filter(stock=>stock.id!==`stockpile:${r.buildingId}`&&publicMaterialStock(s,stock)).sort((a,b)=>a.id===HOME?-1:b.id===HOME?1:a.id.localeCompare(b.id))){
  const cargo={};let room=40;for(const row of missing){const n=Math.min(room,row.deficit,materialSurplus(s,source,row.resource));if(n>0){cargo[row.resource]=n;room-=n;}}
  if(!Object.keys(cargo).length)continue;const target=`stockpile:${r.buildingId}`,capacity=stockpileReceiptPreview(s,target,cargo);if(!capacity.available){r.reason=capacity.reason;continue;}
  try{const out=startTransport(s,source.id,target,p.personId,cargo);if(!out.accepted){r.reason=out.reason;return;}prep.materialTransportIds.push(out.id);prep.activeTransportId=out.id;p.job=null;p.mind.activity='rest';p.mind.commitUntil=s.time;p.mind.lastDecision=s.time;r.reason='本人正在实际运送这一炉所缺的公共材料。';return true;}catch(error){r.reason=error.message;}
 }
 if(!r.reason||!materials.every(row=>!row.missing))r.reason='公共余料尚不足，等待真实采回、生产或交库；保留这一炉筹备。';
}
// Creation only, after the current person's schedule has declined a higher-priority action.
export function considerDiscipleCraftPreparation(s,personId){
 const p=person(s,personId),r=records(s).find(r=>r.personId===personId&&pending(r)&&r.phase==='preparing'),m=p?.mind,a=p&&s.activitiesById[p.activityId];
 if(!r||!p||commitment(s,p)||m.learning||m.recovering||m.away||m.journey||m.scenic?.spatialEvacuationOrderId||p.wound>5||p.energy<35||m.satiety<22||a&&(a.kind!=='facility'||a.personId!==personId)||r.preparation.activeTransportId)return false;
 return advancePreparation(s,p,r,{allowExpiredWork:true})===true;
}
function interrupt(s,r,reason){r.status='interrupted';r.phase='interrupted';r.reason=reason;r.finishedTick=s.worldTick;}
function deliverable(s,p){const a=s.activitiesById[p.activityId],m=p.mind;return !p.job&&!m.learning&&!m.office&&!m.recovering&&!m.away&&!m.journey&&!m.scenic?.spatialEvacuationOrderId&&p.wound<=5&&p.energy>=22&&m.satiety>=22&&!commitment(s,p)&&(!a||a.kind==='facility'&&['rest','social'].includes(a.action));}
export function advanceDiscipleCraftRequests(s){
 const state=s.discipleCraftRequests;if(!state||state.lastTick>=s.worldTick)return;state.lastTick=s.worldTick;
 for(const r of state.records.filter(pending)){
  const p=s.personsById[r.personId],w=s.workOrdersById[r.craftOrderId];
  if(!p||p.lifeStatus==='dead'||!s.homeMemberIds.includes(r.personId)||p.location?.kind!=='local'||p.location.sceneId!==SCENE){
   if(p&&w?.phase==='active'&&p.activityId===w.activityId)cancelPersonCraftSR(s,p.personId);
   const cause=!p?'未找到本人身份':p.lifeStatus==='dead'?'本人已经身故':!s.homeMemberIds.includes(r.personId)?'本人已经离宗':'本人已经离院';
   interrupt(s,r,`${cause}，原工单按实际工序结清；现存成药与在途货物保留实际位置。`);continue;
  }
  if(r.phase==='preparing'){advancePreparation(s,p,r);continue;}
  if(w?.phase==='active'){
   if(p.wound>20&&p.activityId===w.activityId){cancelPersonCraftSR(s,p.personId);p.mind.recovering=true;interrupt(s,r,'本人重伤中止炼制，已耗与退款按实际工序结清。');}
   continue;
  }
  if(!w||w.phase!=='completed'){interrupt(s,r,'这一炉已中止，成药交付尚未完成。');continue;}
  if(r.deliveryOrderId){const delivery=s.workOrdersById[r.deliveryOrderId];
   if(delivery?.phase==='delivered'){
    const fact=s.factsById[`fact:transport:${delivery.id}`];
    if(fact?.operation!=='delivery'||fact.targetStockpileId!==HOME||fact.sourceStockpileId!==`stockpile:${r.buildingId}`||fact.quantities?.[`pill:${r.recipeId}`]!==w.yield)throw Error('商议炼丹交付事实与本炉数量不符。');
    r.status='completed';r.phase='delivered';r.reason='这一炉成药已实际运抵院中公库。';r.finishedTick=s.worldTick;
   }else if(!delivery||['cancelled','interrupted'].includes(delivery.phase))interrupt(s,r,'成药运输已中止，药物保留在运输实际结清的位置，尚未完成交付。');
   continue;
  }
  r.phase='waiting';
  if(!deliverable(s,p)){r.reason='成药仍在丹房，等待本人履行现有安排或休整后实际交付。';continue;}
  const b=s.buildingsById[r.buildingId],site=s.stockpilesById[`stockpile:${r.buildingId}`];
  if(!publicSite(s,b)||(site.pills?.[r.recipeId]||0)<w.yield){r.reason='公共现场成药或产权条件已变化，等待真实库存与授权，尚未交付。';continue;}
  try{const out=startTransport(s,site.id,HOME,p.personId,{[`pill:${r.recipeId}`]:w.yield});
   if(!out.accepted){r.reason=out.reason;continue;}r.deliveryOrderId=out.id;r.phase='delivering';r.reason='本人已接受成药运输，沿实际通路运回公库。';p.mind.activity='rest';p.mind.reason=r.reason;p.mind.commitUntil=s.time;p.mind.lastDecision=s.time;
  }catch(error){r.reason=error.message;}
 }
}
export function discipleCraftRequestsView(s){return {members:(s.disciples||[]).filter(p=>p.lifeStatus!=='dead'&&s.homeMemberIds.includes(p.personId)).map(p=>{
 const contact=developmentContact(s,p),last=latest(s,p.personId),task=records(s).find(r=>r.personId===p.personId&&pending(r));
 if(!contact.available||!visible(s,p))return{personId:p.personId,contact:{available:false,reason:contact.available?'本人暂不愿详谈药理与炼制安排。':'先与门人在院中走近交谈，再商议炼制。'},recipes:[],lastAnswer:last?{id:last.id,recipeId:last.recipeId,recipeName:last.recipeName,atTick:last.atTick,reason:'此前已商议这一炉，当前进展待当面了解。'}:null,active:null};
 const buildings=Object.values(s.buildingsById).filter(b=>b.type==='alchemy'&&b.enabled!==false&&b.condition>0&&!b.spatialLock).sort((a,b)=>a.instanceId.localeCompare(b.instanceId)),b=buildings[0],recipes=b?Object.keys(RECIPES).map(id=>gate(s,p,id,b.instanceId)):[];
 const w=task&&s.workOrdersById[task.craftOrderId],process=w&&craftProcessView(s,w),delivery=task?.deliveryOrderId&&s.workOrdersById[task.deliveryOrderId];
 const deliveryStatus=task?.phase==='preparing'?'preparing':['cancelled','interrupted'].includes(delivery?.phase)||['cancelled','interrupted'].includes(w?.phase)?'interrupted':delivery?.phase==='delivered'?'delivered':task?.deliveryOrderId?'delivering':w?.phase==='completed'?'waiting':'crafting';
 const materialTransport=task?.preparation?.activeTransportId&&s.workOrdersById[task.preparation.activeTransportId];
 const progressReason=deliveryStatus==='preparing'?(materialTransport?.phase==='delivered'?'本次材料已实际送达丹房，等待本人承接下一步。':materialTransport&&['cancelled','interrupted'].includes(materialTransport.phase)?'本次备料运输已中止，材料保留实际位置。':materialTransport?.reason||task.reason):deliveryStatus==='interrupted'?'本次炼制或运输已中止，物资按实际投入与位置结清。':deliveryStatus==='delivered'?'成药已实际运抵院中公库。':deliveryStatus==='waiting'&&task?.phase==='crafting'?'本炉已炼成，成药留在丹房，等待本人实际运回公库。':task?.reason;
 return{personId:p.personId,contact,recipes,lastAnswer:last?{...receipt(last),...(last.id===task?.id&&deliveryStatus==='preparing'?{reason:progressReason}:{})}:null,active:task?{requestId:task.id,materialTransportId:task.preparation?.activeTransportId||null,materialTransportPhase:s.workOrdersById[task.preparation?.activeTransportId]?.phase||null,materials:task.preparation?preparationMaterials(s,{cost:task.preparation.cost},task.buildingId):[],workOrderId:task.craftOrderId,recipeName:task.recipeName,stageLabel:process?.stageLabel||'等待原工序',progressTicks:w?.progressTicks||0,durationTicks:w?.durationTicks||0,deliveryStatus,reason:progressReason}:null};
 })};}
export function validateDiscipleCraftRequests(s){
 const state=s.discipleCraftRequests;if(!state)return true;const fail=()=>{throw Error('门人炼丹商议记录或交付引用异常。');},validTick=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.worldTick;
 if(state.version!==1||!Number.isSafeInteger(state.nextId)||state.nextId<1||!validTick(state.lastTick)||!Array.isArray(state.records))fail();
 const ids=new Set(),busy=new Set();
 for(const r of state.records){
  if(!r||typeof r.id!=='string'||!/^request:disciple-craft:[1-9][0-9]*$/.test(r.id)||!Number.isSafeInteger(Number(r.id.split(':').at(-1)))||ids.has(r.id)||!s.personsById[r.personId]||!RECIPES[r.recipeId]||r.recipeName!==RECIPES[r.recipeId].name||!s.buildingsById[r.buildingId]||!validTick(r.atTick)||typeof r.signature!=='string'||typeof r.reason!=='string'||typeof r.accepted!=='boolean'||typeof r.available!=='boolean'||!['accepted','refused','unavailable','completed','interrupted'].includes(r.status))fail();ids.add(r.id);
  if(r.accepted&&!r.available||r.accepted!==['accepted','completed','interrupted'].includes(r.status)||r.finishedTick!==undefined&&(!validTick(r.finishedTick)||r.finishedTick<r.atTick))fail();
  if(!r.accepted){if(r.preparation!==undefined||r.craftStartedTick!==undefined||r.craftOrderId!==null||r.deliveryOrderId!==null||r.phase!=='answered')fail();continue;}
  if(r.preparation)validatePreparationRecord(s,r,validTick,fail);
  if(r.preparation&&r.craftOrderId===null){if(r.deliveryOrderId!==null||!(r.status==='accepted'&&r.phase==='preparing'&&r.finishedTick===undefined||r.status==='interrupted'&&r.phase==='interrupted'&&validTick(r.finishedTick)))fail();if(pending(r)){if(busy.has(r.personId))fail();busy.add(r.personId);}continue;}
  const w=s.workOrdersById[r.craftOrderId];if(w?.kind!=='sr-crafting'||w.personId!==r.personId||w.recipeId!==r.recipeId||w.targetId!==r.buildingId||w.autonomous!==true||w.startedTick!==(r.craftStartedTick??r.atTick))fail();
  if(r.preparation&&(w.recipeVersion!==r.preparation.recipeVersion||!sameFields(w.cost,r.preparation.cost)||!sameFields(w.sourceStockpileIds,r.preparation.sourceStockpileIds)))fail();
  if(pending(r)){if(busy.has(r.personId)||!['crafting','waiting','delivering'].includes(r.phase))fail();busy.add(r.personId);}
  if(r.deliveryOrderId){const d=s.workOrdersById[r.deliveryOrderId];if(d?.kind!=='transport'||d.carrierId!==r.personId||d.sourceStockpileId!==`stockpile:${r.buildingId}`||d.targetStockpileId!==HOME||Object.keys(d.cargo).length!==1||d.cargo[`pill:${r.recipeId}`]!==w.yield||w.phase!=='completed')fail();}
  if(r.status==='completed'&&(r.phase!=='delivered'||!validTick(r.finishedTick)||s.workOrdersById[r.deliveryOrderId]?.phase!=='delivered'))fail();
  if(r.status==='interrupted'&&(r.phase!=='interrupted'||!validTick(r.finishedTick)))fail();
 }
 if(state.records.some(r=>Number(r.id.split(':').at(-1))>=state.nextId))fail();return true;
}

function validatePreparationRecord(s,r,validTick,fail){
 const p=r.preparation;validateCraftPreparationTerms(s,p,r.recipeId,r.buildingId);if(p.version!==1||typeof p.recipeVersion!=='string'||!p.cost||!p.sourceStockpileIds||!Array.isArray(p.materialTransportIds)||new Set(p.materialTransportIds).size!==p.materialTransportIds.length||p.activeTransportId!==null&&!p.materialTransportIds.includes(p.activeTransportId)||!Object.entries(p.cost).length||!Object.entries(p.cost).every(([k,v])=>Number.isFinite(v)&&v>0&&s.stockpilesById[p.sourceStockpileIds[k]]))fail();
 for(const id of p.materialTransportIds){const w=s.workOrdersById[id];if(w?.kind!=='transport'||w.carrierId!==r.personId||w.targetStockpileId!==`stockpile:${r.buildingId}`||!Object.entries(w.cargo).every(([k,v])=>!['jade','insight'].includes(k)&&p.cost[k]>=v)||w.startedTick<r.atTick)fail();}
 if(r.craftOrderId!==null&&(!validTick(r.craftStartedTick)||r.craftStartedTick<r.atTick))fail();
 if(r.craftOrderId===null&&r.craftStartedTick!==undefined)fail();
}
