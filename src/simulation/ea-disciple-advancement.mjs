/** Read-only needs from the existing breakthrough/pill authorities. */
import {xpNeed,RESOURCES} from './ea-data.mjs';
import {developmentContact} from './ea-disciple-development.mjs';
import {breakthroughView,autonomousBreakthroughChoice} from './ea-sr-cultivation.mjs';
const visible=(s,p)=>!p.mind?.hiddenKnowledge?.foundation||s.society?.secrets?.some(e=>e.id===p.mind.hiddenKnowledge.foundation&&e.discovered);
export function discipleAdvancementView(s){
 const people=(s.disciples||[]).filter(p=>p.lifeStatus!=='dead'&&s.homeMemberIds.includes(p.personId));
 return {members:people.map(p=>{
  const contact=developmentContact(s,p),pharmacists=people.filter(other=>other!==p).map(other=>({personId:other.personId,name:other.name,reason:'走近后向同门商议炼丹。'}));
  if(!contact.available||!visible(s,p))return {personId:p.personId,name:p.name,contact:{available:false,reason:contact.available?'本人暂不愿详谈进阶准备。':'走近后了解本人进阶准备。'},fromRealm:null,toRealm:null,needsFoundation:null,recipeId:null,quantity:0,status:'unknown',reason:'待当面了解本人安排。',locks:[],cost:{},pill:null,active:null,pickup:null,pharmacists};
  const order=Object.values(s.srCultivation?.orders||{}).find(o=>o.personId===p.personId&&o.kind==='breakthrough'&&!['completed','cancelled'].includes(o.phase));
  const active=order?{orderId:order.id,phase:order.phase,progressTicks:order.progressTicks,durationTicks:order.durationTicks,consumed:!!order.consumed}:null;
  const body=s.activitiesById[p.activityId],transport=body?.kind==='sr-transport'&&body.personId===p.personId&&s.workOrdersById[body.workOrderId],bag=`stockpile:carried:${p.personId.slice(7)}`;
  const pickup=transport?.kind==='transport'&&transport.carrierId===p.personId&&transport.targetStockpileId===bag&&['to-source','carrying'].includes(transport.phase)&&Object.keys(transport.cargo).length===1&&transport.cargo['pill:foundation']===1?{workOrderId:transport.id,phase:transport.phase,reason:transport.reason}:null;
  // Full local pill paths are relevant only to a ready nine-layer resident.
  // Other realms and unfinished accumulation avoid that extra route search.
  const full=p.xp>=xpNeed(p.realm),v=breakthroughView(s,p.personId),choice=autonomousBreakthroughChoice(s,p.personId),access=v.pillAccess;
  const reserved=!!pickup||!!order?.pillAllocation&&['reserved','consumed'].includes(order.pillAllocation.phase);
  const pill=p.realm===9?{required:1,available:access.available,localAvailable:access.localAvailable,publicAllowed:access.publicAllowed,needsPickup:!active&&!pickup&&access.needsPickup,pickupWilling:access.pickupWilling,pickupAvailable:access.pickupAvailable,reserved,reason:pickup?'已为本人取丹预留一枚，正在沿真实通路领取。':reserved?'本人已为当前突破预留筑基丹。':access.reason}:{required:0,available:0,localAvailable:0,publicAllowed:false,needsPickup:false,reserved:false,reason:'本层突破不需筑基丹。'};
  const materialLocks=Object.entries(v.cost).filter(([k,q])=>(s.resources[k]||0)<q).map(([k,q])=>`公共突破材料${RESOURCES[k]||k}需${q}，尚待筹备。`),otherLocks=[...choice.reasons,...v.locksWithoutPill,...materialLocks];
  const needsFoundation=p.realm===9&&full&&!active&&!pickup&&choice.available&&!v.locksWithoutPill.length&&access.publicAllowed&&access.localAvailable<1;
  const locks=active||pickup?[]:[...choice.reasons,...v.locks,...materialLocks];
  const status=active?'active':pickup?'picking-up':p.breakthroughCooldown>s.time?'recovering':needsFoundation?'needs-pill':!full?'preparing':!locks.length?'ready':'ordinary';
  const reason=active?order.reason:pickup?transport.reason:status==='recovering'?'突破已完成，先按原规则调息恢复。':otherLocks[0]||(!access?.publicAllowed&&p.realm===9&&access.localAvailable<1?access.reason:needsFoundation?'修为已满，尚需一枚有权取用的筑基丹；可向同门商议炼制。':pill.needsPickup?(pill.pickupAvailable?'已有可取筑基丹，等待本人履行原承诺后实际领取。':pill.reason):locks[0]||'准备已足，由本人权衡是否开始突破。');
  return {personId:p.personId,name:p.name,contact,fromRealm:v.fromRealm,toRealm:v.toRealm,needsFoundation,recipeId:p.realm===9?'foundation':null,quantity:p.realm===9?1:0,status,reason,locks,cost:active||pickup?{}:{...v.cost},pill,active,pickup,pharmacists};
 })};
}
