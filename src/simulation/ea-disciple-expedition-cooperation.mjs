/** T-EXPEDITION-COMPANIONS-20261026: local agreement, finite waiting and sourced warnings. */
import {recordFactSR} from './ea-sr-world.mjs';
export const EXPEDITION_COMPANION_RULES=Object.freeze({invitationDistance:3.1,communicationDistance:6,cohesionDistance:3,waitTicks:120});
const VALLEY='scene:valley',HOME='scene:yunxiu-courtyard';
const terminal=j=>!j||['returned','cancelled','dead'].includes(j.phase);
const distance=(a,b)=>a&&b&&a.kind==='local'&&b.kind==='local'&&a.sceneId===b.sceneId?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
export function companionInTalkingReach(a,b){return a?.location?.sceneId===HOME&&distance(a.location,b?.location)<=EXPEDITION_COMPANION_RULES.invitationDistance;}
export function expeditionPeer(s,j){return j.party&&s.discipleExpeditions.journeys.find(x=>x.id===j.party.peerJourneyId);}
export function attachExpeditionCompanions(s,leader,peer){
 const id=`party:${leader.id}`;
 for(const [j,other,role] of [[leader,peer,'leader'],[peer,leader,'companion']]){
  const p=s.personsById[j.personId],partner=s.personsById[other.personId];
  j.party={version:1,id,role,leaderJourneyId:leader.id,peerJourneyId:other.id,consent:{atTick:s.worldTick,purpose:j.purpose,ambition:p.mind.traits[1],curiosity:p.mind.traits[4],selfPosition:{...p.location},partnerPosition:{...partner.location},reason:'本人愿与眼前同门沿同一已知路线结伴，遇险相互提醒并沿来路撤回。'}};
 }
}
/** The same tick origin is used for both observers, independent of update order. */
export function expeditionPartySnapshot(s){return new Map((s.discipleExpeditions?.journeys||[]).filter(j=>j.party).map(j=>{const p=s.personsById[j.personId];return[j.id,{phase:j.phase,location:{...p.location},lifeStatus:p.lifeStatus,medicinePreparing:j.medicine?.use?.status==='preparing',medicineStartedTick:j.medicine?.use?.startedTick}];}));}
function separated(s,j,reason){
 if(!j.partySeparated){const factId=`fact:disciple:${j.id}:party-separation`;recordFactSR(s,factId,{kind:'disciple-party-separation',journeyId:j.id,personId:j.personId,peerJourneyId:j.party.peerJourneyId,reason,position:{...s.personsById[j.personId].location},text:reason});j.partySeparated={atTick:s.worldTick,factId,reason};}
 delete j.partyWait;
}
/** Waiting consumes this world step and never moves either body or its work. */
export function waitForExpeditionPeer(s,p,j,reason,{returnAlone=false,kind='lost'}={}){
 if(j.partySeparated)return false;
 if(!j.partyWait)j.partyWait={startedTick:s.worldTick,reason,kind};else Object.assign(j.partyWait,{reason,kind});
 if(s.worldTick-j.partyWait.startedTick>=EXPEDITION_COMPANION_RULES.waitTicks){separated(s,j,returnAlone||j.phase==='valley-return'?'约定等候已满，未能会合，改沿本人实际来路独立返回。':'约定等候已满，未能会合，结束本次结伴约定，按本人安排继续。');if(returnAlone){if(['exploring','scouting'].includes(j.phase))j.retreated=true;j.phase='valley-return';delete j.walkDetour;}return false;}
 p.mind.reason=reason;return true;
}
export function waitDuringExpedition(s,p,j,snapshot){
 if(!j.party||j.partySeparated)return false;
 const peer=expeditionPeer(s,j),a=snapshot?.get(j.id),b=snapshot?.get(peer?.id),peerPerson=peer&&s.personsById[peer.personId];
 if(!a||a.location?.sceneId!==VALLEY||!['exploring','scouting','valley-return'].includes(j.phase))return false;
 const visible=b&&distance(a.location,b.location)<=EXPEDITION_COMPANION_RULES.communicationDistance;
 if(visible){j.partyLastSeen={atTick:s.worldTick,position:{...b.location}};
  if(b.lifeStatus==='dead'){separated(s,j,'在近处发现同伴倒下，无法继续结伴，沿本人来路撤回。');if(['exploring','scouting'].includes(j.phase)){j.phase='valley-return';delete j.walkDetour;j.retreated=true;}return false;}
  const danger=j.encounter?.lastPosition||s.factsById[j.partyWarning?.factId]?.dangerPosition;
  const safe=danger?.sceneId===VALLEY&&Math.hypot(a.location.x-danger.x,a.location.y-danger.y)>EXPEDITION_COMPANION_RULES.communicationDistance;
  if(j.phase==='valley-return'&&b.medicinePreparing&&safe){
   const held=waitForExpeditionPeer(s,p,j,'在安全退路等候眼前同伴调药，随后继续归院。',{kind:'medicine'});
   if(held){j.partySupport??={kind:'wait-for-medicine',sourceJourneyId:peer.id,startedTick:s.worldTick,lastTick:s.worldTick,ticks:0};j.partySupport.lastTick=s.worldTick;j.partySupport.ticks++;}
   return held;
  }
  if(['exploring','scouting'].includes(j.phase)&&['exploring','scouting'].includes(b.phase)&&distance(a.location,b.location)>EXPEDITION_COMPANION_RULES.cohesionDistance&&Math.hypot(a.location.x-7,a.location.y-27)>Math.hypot(b.location.x-7,b.location.y-27)+.25)return waitForExpeditionPeer(s,p,j,'放慢脚步，等近处同伴跟上已知路线。',{returnAlone:true,kind:'cohesion'});
  if(['cohesion','lost','medicine'].includes(j.partyWait?.kind))delete j.partyWait;return false;
 }
 // No remote coordinates or unseen health are used to choose a destination.
 if(!terminal(peer)&&peerPerson)return waitForExpeditionPeer(s,p,j,'同伴已离开可见范围，按约在当前脚点等候。',{returnAlone:true});
 return waitForExpeditionPeer(s,p,j,'暂未见同伴到来，按约在当前脚点等候。',{returnAlone:true});
}
export function relayExpeditionWarnings(s,snapshot){
 for(const j of s.discipleExpeditions?.journeys||[]){
  if(!j.party||terminal(j)||j.partyWarning)continue;
  const peer=expeditionPeer(s,j),a=snapshot.get(j.id),b=snapshot.get(peer?.id),seen=peer?.encounter;
  if(!a||!b||b.lifeStatus==='dead'||s.personsById[peer.personId].lifeStatus==='dead'||!seen||a.location.sceneId!==VALLEY||distance(a.location,b.location)>EXPEDITION_COMPANION_RULES.communicationDistance||seen.lastObservedTick>s.worldTick)continue;
  const factId=`fact:disciple:${j.id}:party-warning`;
  recordFactSR(s,factId,{kind:'disciple-companion-warning',journeyId:j.id,personId:j.personId,sourceJourneyId:peer.id,sourcePersonId:peer.personId,sourceObservedTick:seen.lastObservedTick,senderPosition:{...b.location},receiverPosition:{...a.location},dangerPosition:{...seen.lastPosition},text:'近处同伴讲明自己亲见的风险，听者据此沿本人来路撤回。'});
  j.partyWarning={factId,sourceJourneyId:peer.id,sourcePersonId:peer.personId,sourceObservedTick:seen.lastObservedTick,receivedTick:s.worldTick};
  if(['exploring','scouting'].includes(j.phase)){j.phase='valley-return';delete j.walkDetour;j.retreated=true;delete j.partyWait;}
 }
}
export function validateExpeditionCooperation(s,fail){
 const journeys=s.discipleExpeditions?.journeys||[],localPoint=p=>p?.kind==='local'&&p.sceneId===VALLEY&&Number.isFinite(p.x)&&Number.isFinite(p.y),point=p=>p?.kind==='local'&&p.sceneId===HOME&&Number.isFinite(p.x)&&Number.isFinite(p.y),tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.worldTick;
 for(const j of journeys){
  if(!j.party){if(j.partyWarning||j.partyWait||j.partyLastSeen||j.partySeparated||j.partySupport)fail('同行来源缺失');continue;}
  const q=j.party,peer=expeditionPeer(s,j),leader=journeys.find(x=>x.id===q.leaderJourneyId),c=q.consent;
  if(q.version!==1||!peer||peer===j||peer.personId===j.personId||peer.party?.peerJourneyId!==j.id||peer.party?.id!==q.id||peer.party?.leaderJourneyId!==q.leaderJourneyId||peer.party?.role===q.role||!['leader','companion'].includes(q.role)||!leader||leader.party?.role!=='leader'||q.id!==`party:${leader.id}`||j.purpose!==peer.purpose||j.startedTick!==peer.startedTick||!c||c.atTick!==j.startedTick||c.purpose!==j.purpose||![c.ambition,c.curiosity].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||c.ambition+c.curiosity<=75||typeof c.reason!=='string'||!point(c.selfPosition)||!point(c.partnerPosition)||distance(c.selfPosition,c.partnerPosition)>EXPEDITION_COMPANION_RULES.invitationDistance)fail('同行约定');
  if(JSON.stringify(c.selfPosition)!==JSON.stringify(peer.party.consent.partnerPosition)||JSON.stringify(c.partnerPosition)!==JSON.stringify(peer.party.consent.selfPosition))fail('双方当面位置');
  const w=j.partyWarning;
  if(w){const f=s.factsById[w.factId];if(!peer.encounter||w.factId!==`fact:disciple:${j.id}:party-warning`||w.sourceJourneyId!==peer.id||w.sourcePersonId!==peer.personId||!tick(w.sourceObservedTick)||!tick(w.receivedTick)||w.sourceObservedTick>w.receivedTick||w.sourceObservedTick<peer.encounter?.observedTick||w.sourceObservedTick>peer.encounter?.lastObservedTick||f?.kind!=='disciple-companion-warning'||f.journeyId!==j.id||f.personId!==j.personId||f.sourceJourneyId!==peer.id||f.sourcePersonId!==peer.personId||f.sourceObservedTick!==w.sourceObservedTick||f.atTick!==w.receivedTick||!localPoint(f.senderPosition)||!localPoint(f.receiverPosition)||f.dangerPosition?.sceneId!==VALLEY||!Number.isFinite(f.dangerPosition.x)||!Number.isFinite(f.dangerPosition.y)||distance(f.senderPosition,f.receiverPosition)>EXPEDITION_COMPANION_RULES.communicationDistance)fail('同伴提醒来源');}
  if(j.partyWait&&(!tick(j.partyWait.startedTick)||typeof j.partyWait.reason!=='string'||!['supply','exit-out','cohesion','medicine','lost','exit-home'].includes(j.partyWait.kind)||s.worldTick-j.partyWait.startedTick>EXPEDITION_COMPANION_RULES.waitTicks))fail('同行有限等候');
  if(j.partyLastSeen&&(!tick(j.partyLastSeen.atTick)||j.partyLastSeen.position?.sceneId!==VALLEY))fail('本人最后可见同行');
  if(j.partySeparated){const f=s.factsById[j.partySeparated.factId];if(!tick(j.partySeparated.atTick)||f?.kind!=='disciple-party-separation'||f.journeyId!==j.id||f.atTick!==j.partySeparated.atTick||f.peerJourneyId!==peer.id||typeof j.partySeparated.reason!=='string')fail('失散沿路撤回');}
  if(j.partySupport){const z=j.partySupport,u=peer.medicine?.use;if(z.kind!=='wait-for-medicine'||z.sourceJourneyId!==peer.id||!tick(z.startedTick)||!tick(z.lastTick)||z.lastTick<z.startedTick||!Number.isSafeInteger(z.ticks)||z.ticks<1||z.ticks>EXPEDITION_COMPANION_RULES.waitTicks||!u||z.startedTick<u.startedTick||u.completedTick!==undefined&&z.lastTick>u.completedTick)fail('真实等候同伴调药');}
 }
 for(const f of Object.values(s.factsById||{}))if(['disciple-companion-warning','disciple-party-separation'].includes(f.kind)){const j=journeys.find(j=>j.id===f.journeyId);if(!j?.party||![j.partyWarning?.factId,j.partySeparated?.factId].includes(f.id))fail('协作事实引用');}
 return true;
}
