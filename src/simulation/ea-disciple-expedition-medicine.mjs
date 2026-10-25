/** T-EXPEDITION-MEDICINE-20261025: one finite dose, twenty real safe ticks. */
import {day,RECIPES} from './ea-data.mjs';
import {consumePill} from './ea-sim.mjs';
import {transferExpeditionMedicine} from './ea-sr-economy.mjs';
export const EXPEDITION_MEDICINE_RULES=Object.freeze({quantity:1,useTicks:20,woundThreshold:5,safetyDistance:6});
const HOME='scene:yunxiu-courtyard',VALLEY='scene:valley';
const bagId=p=>`stockpile:carried:${p.personId.slice(7)}`;
const bag=(s,p)=>s.stockpilesById[bagId(p)];
export function prepareExpeditionMedicine(s,p,j){
 const m=j.medicine;if(!m||m.status!=='pending')return;
 m.stockpileId=bagId(p);
 if(bag(s,p)?.ownerId===p.personId&&bag(s,p)?.carrierId===p.personId&&bag(s,p)?.access==='private'&&(bag(s,p).pills?.heal||0)>=1){m.source='personal';m.status='carried';m.reason='已备本人随身回春散一份，按需自行使用。';return;}
 const result=transferExpeditionMedicine(s,j.id,'pickup');
 if(result.quantity){m.source='public';m.borrowed=1;m.pickupFactId=result.factId;m.status='carried';m.reason='已从公库实际领取回春散一份，未用将实际归库。';}
 else{m.status='none';m.reason=result.reason;}
}
export function newExpeditionMedicine(){return {version:1,status:'pending',stockpileId:null,source:'none',borrowed:0,pickupFactId:null,returned:0,returnFactId:null,reason:'将在实际取粮位置自行检查可携药物。'};}
function safePosition(p,j){
 const l=p.location;
 if(l?.kind!=='local')return false;
 if(j.phase==='delivery'&&l.sceneId===HOME)return true;
 const e=j.encounter?.lastPosition;
 return j.phase==='valley-return'&&l.sceneId===VALLEY&&e?.sceneId===l.sceneId&&Math.hypot(l.x-e.x,l.y-e.y)>EXPEDITION_MEDICINE_RULES.safetyDistance;
}
/** True consumes this body tick; otherwise the original return continues. */
export function advanceExpeditionMedicine(s,p,j){
 const m=j.medicine;if(!m||m.status!=='carried'||p.lifeStatus==='dead')return false;
 if(m.lastUseTick===s.worldTick)return m.use?.status==='preparing';
 m.lastUseTick=s.worldTick;
 if(m.use?.status==='consumed'||m.use?.status==='cancelled')return false;
 if(p.wound<=5||p.mind.lastPillDay===day(s)||(bag(s,p)?.pills?.heal||0)<1||!safePosition(p,j)){
  if(m.use?.status==='preparing'){m.use.status='cancelled';m.use.cancelledTick=s.worldTick;}
  return false;
 }
 const l=p.location;
 if(!m.use)m.use={status:'preparing',startedTick:s.worldTick,progressTicks:0,position:{sceneId:l.sceneId,x:l.x,y:l.y}};
 const u=m.use;
 if(u.position.sceneId!==l.sceneId||Math.hypot(u.position.x-l.x,u.position.y-l.y)>.01){u.status='cancelled';u.cancelledTick=s.worldTick;return false;}
 p.mind.reason='已退到安全处，自行取出随身回春散调养，随后继续归院。';
 if(++u.progressTicks<EXPEDITION_MEDICINE_RULES.useTicks)return true;
 const allocationId=`pill-allocation:${s.srEconomy.nextId}`,before={wound:p.wound,energy:p.energy};
 consumePill(s,'heal',p,{silent:true});p.mind.lastPillDay=day(s);
 const factId=`fact:disciple:${j.id}:medicine-use`;
 s.factsById[factId]={id:factId,kind:'disciple-expedition-medicine-use',atTick:s.worldTick,journeyId:j.id,personId:p.personId,recipeId:'heal',quantity:1,stockpileId:m.stockpileId,allocationId,startedTick:u.startedTick,durationTicks:EXPEDITION_MEDICINE_RULES.useTicks,position:{...u.position},before,after:{wound:p.wound,energy:p.energy},text:'本人在安全处实际服用随身回春散，随后仍沿原路归院'};
 Object.assign(u,{status:'consumed',completedTick:s.worldTick,factId,allocationId});m.status='consumed';
 return true;
}
export function finishExpeditionMedicine(s,p,j){
 const m=j.medicine;if(!m)return true;
 if(m.source==='personal'&&m.status==='carried'){m.status='retained';m.retainedReason='本人未用私药继续随身保管。';}
 if(m.use?.status==='preparing'){m.use.status='cancelled';m.use.cancelledTick=s.worldTick;}
 if(m.source==='public'&&m.status==='carried'){
  if(j.phase==='dead'){m.status='retained';m.retainedReason='未用公药仍在本人实际药囊中，未隔空归库。';return true;}
  const result=transferExpeditionMedicine(s,j.id,'return');
  if(result.quantity){m.returned=1;m.returnFactId=result.factId;m.status='returned';}
  else if(j.phase==='cancelled'){m.status='retained';m.retainedReason='本趟取消，未用公药仍由本人携带，待实际交还。';}
  else{p.mind.reason=result.reason;return false;}
 }
 return true;
}

export function validateExpeditionMedicine(s,j,fail){
 const m=j.medicine;if(m===undefined){if(['pickup','use','return'].some(k=>s.factsById[`fact:disciple:${j.id}:medicine-${k}`]))fail('携药事实缺少对应行程记录');return;}
 const tick=t=>Number.isSafeInteger(t)&&t>=j.startedTick&&t<=s.worldTick;
 const p=s.personsById[j.personId],expectedBag=bagId(p),held=s.stockpilesById[expectedBag];
 if(!m||m.version!==1||!['pending','none','carried','consumed','returned','retained'].includes(m.status)||!['none','personal','public'].includes(m.source)||![0,1].includes(m.borrowed)||![0,1].includes(m.returned)||typeof m.reason!=='string'||![null,expectedBag].includes(m.stockpileId)||m.pickupFactId!==null&&typeof m.pickupFactId!=='string'||m.returnFactId!==null&&typeof m.returnFactId!=='string'||m.lastUseTick!==undefined&&!tick(m.lastUseTick))fail('携药记录形状');
 if(m.status==='pending'&&(m.source!=='none'||m.stockpileId!==null||m.borrowed||m.returned||m.pickupFactId||m.returnFactId||m.use)||m.status==='none'&&(m.source!=='none'||m.borrowed||m.returned||m.pickupFactId||m.returnFactId||m.use))fail('携药准备状态');
 if(['carried','consumed','returned','retained'].includes(m.status)&&(!['personal','public'].includes(m.source)||m.stockpileId!==expectedBag||!held||held.ownerId!==p.personId||held.carrierId!==p.personId||held.access!=='private'))fail('本人实际药囊来源');
 if(m.source==='public'){
  const f=s.factsById[m.pickupFactId];
  if(m.borrowed!==1||m.pickupFactId!==`fact:disciple:${j.id}:medicine-pickup`||f?.kind!=='inventory-transaction'||f.operation!=='expedition-medicine-pickup'||f.journeyId!==j.id||f.actorId!==p.personId||f.recipeId!=='heal'||f.quantity!==1||f.sourceStockpileId!=='stockpile:yunxiu'||f.targetStockpileId!==expectedBag||!tick(f.atTick)||f.position?.sceneId!==HOME)fail('公药实际领用来源');
 }else if(m.borrowed||m.pickupFactId||m.returned||m.returnFactId)fail('个人药物不应成为公药债务');
 if(m.status==='carried'&&(held.pills?.heal||0)<1)fail('携药记录没有实际药物');
 if(m.returned){
  const f=s.factsById[m.returnFactId];
  if(m.status!=='returned'||m.returnFactId!==`fact:disciple:${j.id}:medicine-return`||f?.kind!=='inventory-transaction'||f.operation!=='expedition-medicine-return'||f.journeyId!==j.id||f.actorId!==p.personId||f.recipeId!=='heal'||f.quantity!==1||f.sourceStockpileId!==expectedBag||f.targetStockpileId!=='stockpile:yunxiu'||!tick(f.atTick)||f.atTick<s.factsById[m.pickupFactId].atTick||f.position?.sceneId!==HOME||m.use?.status==='consumed')fail('余药实际归库来源');
 }else if(m.status==='returned'||m.returnFactId)fail('归药记录缺少实际交接');
 if(m.status==='retained'&&(!(['dead','cancelled'].includes(j.phase)||j.phase==='returned'&&m.source==='personal')||typeof m.retainedReason!=='string'))fail('遗留药物状态');
 const u=m.use;
 if((m.status==='consumed')!==(u?.status==='consumed')||u?.status!=='consumed'&&(u?.factId||s.factsById[`fact:disciple:${j.id}:medicine-use`]))fail('用药状态与消费事实不符');
 if(u){
  const pos=u.position,e=j.encounter?.lastPosition;
  if(!['preparing','consumed','cancelled'].includes(u.status)||!tick(u.startedTick)||!Number.isSafeInteger(u.progressTicks)||u.progressTicks<1||u.progressTicks>20||!pos||![HOME,VALLEY].includes(pos.sceneId)||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))fail('实际用药动作');
  if(pos.sceneId===VALLEY&&(!e||e.sceneId!==VALLEY||Math.hypot(pos.x-e.x,pos.y-e.y)<=6))fail('用药未离开本人已观察危险');
  if(u.status==='consumed'){
   const f=s.factsById[u.factId],a=s.srEconomy?.pillAllocations?.[u.allocationId];
   if(m.status!=='consumed'||u.progressTicks!==20||!tick(u.completedTick)||u.completedTick-u.startedTick!==19||u.factId!==`fact:disciple:${j.id}:medicine-use`||f?.kind!=='disciple-expedition-medicine-use'||f.journeyId!==j.id||f.personId!==p.personId||f.recipeId!=='heal'||f.quantity!==1||f.stockpileId!==expectedBag||f.allocationId!==u.allocationId||f.atTick!==u.completedTick||f.startedTick!==u.startedTick||f.durationTicks!==20||JSON.stringify(f.position)!==JSON.stringify(pos)||!(f.before?.wound>5&&f.before.wound<100)||!Number.isFinite(f.before.energy)||f.after?.wound!==Math.max(0,f.before.wound-RECIPES.heal.effect.wound)||f.after?.energy!==Math.min(100,f.before.energy+RECIPES.heal.effect.energy)||a?.personId!==p.personId||a.recipeId!=='heal'||a.quantity!==1||a.phase!=='consumed'||a.parts.length!==1||a.parts[0].stockpileId!==expectedBag||a.parts[0].quantity!==1)fail('用药实际消耗与药效来源');
  }else if(u.status==='cancelled'&&!tick(u.cancelledTick)||u.status==='preparing'&&m.status!=='carried')fail('用药中断状态');
 }else if(m.status==='consumed'||s.factsById[`fact:disciple:${j.id}:medicine-use`])fail('用药结果缺少对应动作');
 if(m.status!=='pending'&&m.source==='none'&&m.status!=='none')fail('缺药不能生成携药结果');
}
