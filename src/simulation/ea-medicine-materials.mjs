/** T-MEDICINE-MATERIALS-20261025: preferences on existing work and transport. */
import {scenicNearest,scenicFindPath} from './ea-scenic.mjs';
import {workOpportunity} from './ea-life.mjs';
import {craftAvailabilityForPerson,cropRecipeFor,productionVersionFor,productionRecipeDefinition,startTransport,stockpileReceiptPreview} from './ea-sr-economy.mjs';
import {SECT_SUSTENANCE_RULES} from './ea-sect-sustenance.mjs';
const HOME='scene:yunxiu-courtyard',STORE='stockpile:yunxiu';
export const MEDICINE_MATERIAL_RULES=Object.freeze({scoreBonus:24,carryCapacity:40});
const live=w=>w&&!['completed','delivered','cancelled','interrupted'].includes(w.phase);
const activeBuilding=b=>b&&b.enabled!==false&&!b.disabled&&b.condition>0&&!b.spatialLock;
function publicStock(s,st){const home=s.stockpilesById?.[STORE],b=s.buildingsById?.[st?.buildingId];return !!st&&st.access==='public'&&st.ownerId===home?.ownerId&&!st.carrierId&&(st.position?.sceneId||b?.sceneId||HOME)===HOME&&!b?.spatialLock;}
function seedReserve(s,st,key){const b=s.buildingsById?.[st.buildingId],o=b&&s.workOrdersById?.[`work:production:${b.instanceId}`];return cropRecipeFor(b,o)?.seedCost?.[key]||0;}
function surplus(s,st,key){return Math.max(0,(st.resources[key]||0)-seedReserve(s,st,key));}
function access(s,st){return st?.position&&scenicNearest(s,st.position,{maxDistance:1.5});}
function connected(s,source,target){const a=access(s,source),b=access(s,target);return a&&b&&scenicFindPath(s,a,b,{maxSnap:0})!==null;}
function committedMedicine(s){
 let n=Object.values(s.stockpilesById||{}).filter(st=>publicStock(s,st)).reduce((q,st)=>q+(st.pills?.heal||0),0);
 for(const w of Object.values(s.workOrdersById||{}))if(live(w)){
  if(w.kind==='transport'&&publicStock(s,s.stockpilesById[w.sourceStockpileId])&&publicStock(s,s.stockpilesById[w.targetStockpileId]))n+=w.cargo?.['pill:heal']||0;
  else if(w.kind==='sr-crafting'&&w.recipeId==='heal'&&publicStock(s,s.stockpilesById[`stockpile:${w.targetId}`]))n+=w.yield;
 }
 return n;
}
export function medicineMaterialNeeds(s,{buildingId=null}={}){
 const home=s.stockpilesById?.[STORE],policy=s.medicineSupply,homeFood=home?.resources.food||0,foodTarget=Math.max(SECT_SUSTENANCE_RULES.minimumTarget,(s.disciples?.length||0)*SECT_SUSTENANCE_RULES.foodPerMember),foodProtected=homeFood<foodTarget;
 const enabled=!!policy?.enabled&&policy.target>0,needed=enabled&&(home?.pills?.heal||0)<policy.target&&committedMedicine(s)<policy.target;
 const b=Object.values(s.buildingsById||{}).filter(b=>b.type==='alchemy'&&activeBuilding(b)&&(b.sceneId||HOME)===HOME&&(!buildingId||b.instanceId===buildingId||b.id===buildingId)).sort((a,b)=>a.instanceId.localeCompare(b.instanceId))[0],site=b&&s.stockpilesById[`stockpile:${b.instanceId}`];
 const result={enabled,needed,buildingId:b?.instanceId||null,siteStockpileId:site?.id||null,materials:{},foodProtected,food:{available:homeFood,target:foodTarget},homeFood,foodTarget,reason:''};
 if(!enabled){result.reason='尚未启用回春散储备，药材生产与运输按原日常选择。';return result;}
 if(!needed){result.reason='现有公共成药、在制与运输已覆盖目标，暂停新增药材偏好。';return result;}
 if(!b||!publicStock(s,site)){result.reason='尚无可用且具有公共现场库的丹房。';return result;}
 const quote=craftAvailabilityForPerson(s,'heal','person:master',{buildingId:b.instanceId});
 for(const [key,required]of Object.entries(quote.cost)){
  if(['jade','insight'].includes(key))continue;
  const onsite=site.resources[key]||0,transit=Object.values(s.workOrdersById||{}).filter(w=>w.kind==='transport'&&live(w)&&w.targetStockpileId===site.id&&publicStock(s,s.stockpilesById[w.sourceStockpileId])).reduce((n,w)=>n+(w.cargo?.[key]||0),0),deficit=Math.max(0,required-onsite-transit);
  const available=Object.values(s.stockpilesById||{}).filter(st=>st.id!==site.id&&publicStock(s,st)&&surplus(s,st,key)>0&&connected(s,st,site)).reduce((n,st)=>n+surplus(s,st,key),0);
  const label={herb:'灵草',cleanWater:'洁水',wood:'木材'}[key]||key;
  result.materials[key]={required,site:onsite,available,transit,deficit,productionDeficit:Math.max(0,deficit-available),reason:!deficit?(transit?'已有实际在途材料覆盖本炉缺口。':'丹房现场材料已足。'):available>=deficit?'已有可达公共余料，等待本人实际搬运。':`${label}尚缺${Math.max(0,deficit-available)}，需由本人实际生产补足。`};
 }
 result.reason=foodProtected?`先保障公库口粮${foodTarget}份，当前${homeFood}份；药材偏好暂缓。`:Object.values(result.materials).find(x=>x.productionDeficit>0)?.reason||Object.values(result.materials).find(x=>x.deficit>0)?.reason||'本炉材料已备齐，等待原炼制条件成立。';
 return result;
}
function eligible(s,p){
 const m=p?.mind,a=s.activitiesById?.[p?.activityId];
 return !!m&&!!s.srEconomy&&p!==s.master&&p.schedule?.definitionId==='autonomy:yunxiu:v1'&&p.lifeStatus!=='dead'&&s.homeMemberIds.includes(p.personId)&&p.position?.kind==='scene'&&p.position.sceneId===HOME&&!m.away&&!m.journey&&!m.office&&!m.learning&&!m.recovering&&p.wound<=5&&p.energy>=22&&m.satiety>=22&&!m.scenic?.spatialEvacuationOrderId&&(!a||a.kind==='facility')&&s.time>=m.commitUntil&&s.worldTick>=p.schedule.commitUntilTick&&!Object.values(p.schedule.commitmentsById||{}).some(c=>c.status==='active'&&c.endTick>s.worldTick);
}
function outputs(s,b){const o=s.workOrdersById?.[`work:production:${b.instanceId}`];return o&&o.phase!=='completed'&&o.recipeSnapshot?.outputDefinition||cropRecipeFor(b,o)?.output||productionRecipeDefinition(productionVersionFor(b),b.type)?.outputDefinition||{};}
export function medicineMaterialWorkCandidate(s,p,b){
 if(!s.medicineSupply?.enabled||s.medicineSupply.target===0||!eligible(s,p))return null;
 const needs=medicineMaterialNeeds(s);if(!needs.needed||needs.foodProtected||!activeBuilding(b))return null;
 const resource=Object.keys(outputs(s,b)).find(k=>needs.materials[k]?.productionDeficit>0);if(!resource||!workOpportunity(s,p,b,{checkPath:false}).available)return null;
 const source=s.stockpilesById[`stockpile:${b.instanceId}`],target=s.stockpilesById[needs.siteStockpileId];if(!publicStock(s,source)||!connected(s,source,target))return null;
 return {resource,scoreBonus:MEDICINE_MATERIAL_RULES.scoreBonus,reason:`看到回春散材料缺口，愿在${resource==='cleanWater'?'真实水源取洁水':resource==='herb'?'药田照料采收':'现有工位生产木材'}，仍需实际收成与运送。`};
}
export function medicineMaterialTransportCandidate(s,p,{buildingId=null}={}){
 if(!s.medicineSupply?.enabled||s.medicineSupply.target===0||!eligible(s,p)||(p.mind.relationships?.master?.trust??55)<35||p.mind.traits[3]<40)return null;
 const needs=medicineMaterialNeeds(s,{buildingId});if(!needs.needed||needs.foodProtected||!needs.siteStockpileId)return null;
 const target=s.stockpilesById[needs.siteStockpileId],destination=access(s,target);if(!destination)return null;
 for(const source of Object.values(s.stockpilesById||{}).filter(st=>st.id!==target.id&&publicStock(s,st)).sort((a,b)=>a.id===STORE?-1:b.id===STORE?1:a.id.localeCompare(b.id))){
  const cargo={};let space=MEDICINE_MATERIAL_RULES.carryCapacity,degree=0;
  for(const [key,m]of Object.entries(needs.materials)){const q=Math.min(m.deficit,surplus(s,source,key),space);if(q>0){cargo[key]=q;space-=q;degree=Math.max(degree,m.deficit/m.required);}}
  if(!Object.keys(cargo).length||!stockpileReceiptPreview(s,target,cargo).available)continue;
  const point=access(s,source);if(!point||scenicFindPath(s,p.mind.scenic,point,{maxSnap:0})===null||scenicFindPath(s,point,destination,{maxSnap:0})===null)continue;
  return {activity:'medicine-material-transport',job:null,score:SECT_SUSTENANCE_RULES.transportBaseScore+p.mind.traits[3]*.3+p.mind.traits[0]*.1+Math.min(1,degree)*40,reason:'公库口粮已保障，愿把本炉所缺的公共余料实际送到丹房，田边留下真实种苗。',buildingId:needs.buildingId,sourceStockpileId:source.id,targetStockpileId:target.id,cargo};
 }
 return null;
}
export function beginMedicineMaterialTransport(s,p,candidate){
 const current=medicineMaterialTransportCandidate(s,p,{buildingId:candidate?.buildingId});
 if(!current||current.sourceStockpileId!==candidate?.sourceStockpileId||current.targetStockpileId!==candidate?.targetStockpileId)return {accepted:false,reason:'药材缺口、本人承诺或实际可运条件已经变化。'};
 const result=startTransport(s,current.sourceStockpileId,current.targetStockpileId,p.personId,current.cargo);
 if(result.accepted){p.job=null;p.mind.activity='rest';p.mind.lastDecision=s.time;p.mind.commitUntil=s.time;p.mind.reason=current.reason;if(p.schedule)p.schedule.lastReason=current.reason;}
 return result;
}
