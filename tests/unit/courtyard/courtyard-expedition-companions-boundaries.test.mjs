import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectConcurrencyScenario} from '../../fixtures/sect-concurrency.mjs';
import {createExpeditionCompanionsScenario} from '../../fixtures/expedition-companions.mjs';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';
import {advanceDiscipleExpeditions,discipleExpeditionsView,setDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';

const HOME='scene:yunxiu-courtyard';
function ready(s,p,x,y){
 releaseBodyActivity(s,p);p.job=null;p.activityId=null;p.wound=0;p.energy=100;
 Object.assign(p.mind,{main:'qingyuan',activity:'rest',learning:null,office:null,away:null,journey:null,satiety:100,lastDecision:-100,commitUntil:0,goal:'沿路采药，补充草木药用',traits:[70,50,50,80,50]});
 delete p.mind.recovering;p.schedule.commitUntilTick=s.worldTick;
 Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;delete p.mind.scenic.waitingForPersonId;
 p.position={kind:'scene',sceneId:HOME,x,y};p.location={kind:'local',sceneId:HOME,x,y};
}
// Declared initial conditions only: three formally generated residents, two
// nearby volunteers and one existing committed resident who remains home.
function scenario({allowCompanions=true}={}){
 const f=createSectConcurrencyScenario({memberCount:3});
 assert(commandSect(f.session,{type:'medicine-supply',enabled:false,target:2}).ok);
 assert(commandSect(f.session,{type:'manual'}).ok);
 const s=f.session.state,leader=s.personsById[f.travellerId],peer=s.personsById[f.pharmacistId];
 ready(s,leader,28,12.6);ready(s,peer,28.9,12.6);leader.mind.traits[1]=60;
 s.resources.herb=0;s.resources.food=100;s.stockpilesById[f.sourceStockpileId].pills.heal=1;
 setDiscipleExpeditions(s,{enabled:true,allowCompanions});validateSect(f.session);
 return{...f,leaderId:leader.personId,peerId:peer.personId};
}
const journeys=f=>f.session.state.discipleExpeditions.journeys;
function firstDecision(f){advanceSect(f.session,.1);assert(journeys(f).length>0,'a real world step makes the departure choice');return journeys(f);}

test('companion policy is explicit and pure reads, repeated owner calls and pause cannot create or advance a second body tick',()=>{
 const f=scenario(),s=f.session.state;
 const before=JSON.stringify(s);for(let n=0;n<3;n++)discipleExpeditionsView(s);assert.equal(JSON.stringify(s),before);
 const js=firstDecision(f);assert.equal(js.length,2);assert.equal(new Set(js.map(j=>j.personId)).size,2);
 for(const j of js){const p=s.personsById[j.personId],a=s.activitiesById[p.activityId];assert.equal(a.personId,p.personId);assert.equal(a.kind,'sr-disciple-expedition');assert.equal(j.party.consent.purpose,j.purpose);assert.equal(j.phase,'preparing');}
 const after=JSON.stringify(s);advanceDiscipleExpeditions(s);advanceDiscipleExpeditions(s);assert.equal(JSON.stringify(s),after);
 const out=commandSect(f.session,{type:'pause',paused:true});assert(out.ok,out.error);const paused=JSON.stringify(f.session.state);advanceSect(f.session,10);assert.equal(JSON.stringify(f.session.state),paused);
});

test('a peer who declines, owes a promise, is recovering or is too far away is not conscripted into the willing residents outing',()=>{
 for(const condition of ['unwilling','mind-promise','schedule-promise','recovering','distant']){
  const f=scenario(),s=f.session.state,p=s.personsById[f.peerId];
  if(condition==='unwilling')p.mind.traits[1]=p.mind.traits[4]=0;
  if(condition==='mind-promise')p.mind.commitUntil=s.time+60;
  if(condition==='schedule-promise')p.schedule.commitUntilTick=s.worldTick+600;
  if(condition==='recovering'){p.wound=12;p.mind.recovering=true;}
  if(condition==='distant')ready(s,p,18,32);
  const job=p.job,body=p.activityId,deadline=p.mind.commitUntil,schedule=p.schedule.commitUntilTick;
  const js=firstDecision(f);assert.equal(js.length,1,condition);assert.equal(js[0].personId,f.leaderId,condition);assert.equal(js[0].party,undefined,condition);
  assert.equal(p.mind.away,null,condition);assert.notEqual(s.activitiesById[p.activityId]?.kind,'sr-disciple-expedition',condition);
  if(condition.endsWith('promise')){assert.equal(p.activityId,body,condition);assert.equal(p.job,job,condition);assert.equal(p.mind.commitUntil,deadline,condition);assert.equal(p.schedule.commitUntilTick,schedule,condition);}
 }
});

test('old single-person policy stays single and malformed optional party references cannot become a valid journey',()=>{
 const old=scenario({allowCompanions:false});delete old.session.state.discipleExpeditions.allowCompanions;
 firstDecision(old);assert.equal(journeys(old).length,1);assert.equal(journeys(old)[0].party,undefined);validateSect(old.session);
 const f=scenario();firstDecision(f);const a=journeys(f)[0],b=journeys(f)[1];
 assert.equal(a.party.peerJourneyId,b.id);assert.equal(b.party.peerJourneyId,a.id);
 for(const corrupt of [()=>{a.party.peerJourneyId=a.id;},()=>{a.party.peerJourneyId='outing:missing';},()=>{a.party.leaderJourneyId='outing:missing';},()=>{a.party.consent.purpose=a.purpose==='supply'?'explore':'supply';}]){
  const original=structuredClone(a.party);corrupt();assert.throws(()=>validateSect(f.session));a.party=original;
 }
 validateSect(f.session);
});

test('only a companion within six real metres hears the observed warning and hearing does not fabricate a personal encounter',()=>{
 for(const separation of [6.5,6]){
  const f=createExpeditionCompanionsScenario({condition:'contact-shortage'}),s=f.session.state;
  const sender=s.personsById[f.leaderId],receiver=s.personsById[f.companionId],source=journeys(f).find(j=>j.personId===sender.personId),heard=journeys(f).find(j=>j.personId===receiver.personId);
  assert.equal(source.phase,'scouting');assert.equal(heard.phase,'scouting');assert.equal(source.encounter,undefined);assert.equal(heard.encounter,undefined);
  // A declared local crisis starts after the factory's real uninjured valley
  // walk. Only the initial feet change; no observation, injury or warning does.
  const origin={x:sender.location.x,y:sender.location.y};
  receiver.location={kind:'local',sceneId:'scene:valley',x:origin.x-separation,y:origin.y};receiver.position={kind:'scene',sceneId:'scene:valley',x:origin.x-separation,y:origin.y};
  const foe=s.personsById['person:valley-shanxiao'];foe.location={kind:'local',sceneId:'scene:valley',x:origin.x+2,y:origin.y};foe.position={kind:'scene',sceneId:'scene:valley',x:origin.x+2,y:origin.y};
  assert(Math.hypot(receiver.location.x-foe.location.x,receiver.location.y-foe.location.y)>6);
  advanceSect(f.session,.1);
  assert(source.encounter,'the sender really observes the nearby living enemy');assert.equal(heard.encounter,undefined,'hearing cannot become first-hand risk knowledge');assert.equal(receiver.wound,0);
  if(separation<=6){
   assert.equal(heard.partyWarning.sourceJourneyId,source.id);assert.equal(heard.partyWarning.sourcePersonId,sender.personId);assert.equal(heard.phase,'valley-return');
   const fact=s.factsById[heard.partyWarning.factId];assert.equal(fact.sourceObservedTick,source.encounter.lastObservedTick);assert.equal(fact.senderPosition.x,origin.x);assert.equal(fact.receiverPosition.x,origin.x-separation);
   const before=JSON.stringify(s);discipleExpeditionsView(s);advanceDiscipleExpeditions(s);assert.equal(JSON.stringify(s),before);
   assert.equal(discipleExpeditionsView(s).journeys.find(j=>j.id===heard.id).report,null,'remote UI waits for a real return report');
   const original=fact.receiverPosition.x;fact.receiverPosition.x=NaN;assert.throws(()=>validateSect(f.session),'non-finite warning geometry is not a valid communication source');fact.receiverPosition.x=original;
   for(let n=0;n<2500&&journeys(f).find(j=>j.id===heard.id).phase!=='returned';n++){
    if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);
   }
   const returned=journeys(f).find(j=>j.id===heard.id);assert.equal(returned.phase,'returned');assert.equal(returned.encounter,undefined);
   assert.match(returned.report,/同伴|提醒/);assert.doesNotMatch(returned.report,/亲眼发现风险后折返|途中近身受伤/,'a received warning is not a first-hand sighting');
   assert.equal(returned.growth.experience,0,'incomplete observation cannot inherit the other travellers reward');
  }else{assert.equal(heard.partyWarning,undefined);assert.equal(s.factsById[`fact:disciple:${heard.id}:party-warning`],undefined);}
  validateSect(f.session);
 }
});

test('a lethal real contact leaves the dead persons finite medicine and result intact while the living companion returns independently',()=>{
 const f=createExpeditionCompanionsScenario({condition:'contact-shortage'}),s=f.session.state;
 const victimJourney=journeys(f).find(j=>j.medicine.status==='carried'),survivorJourney=journeys(f).find(j=>j!==victimJourney),victim=s.personsById[victimJourney.personId];
 assert(victimJourney,'one finite public dose was actually picked up before the crisis');
 const bagId=victimJourney.medicine.stockpileId;assert.equal(s.stockpilesById[bagId].pills.heal,1);
 // Initial injury for this lethal-risk branch; death itself must come from the
 // subsequent real encounter, not a fabricated lifeStatus or death receipt.
 victim.wound=99;const xp=victim.xp;advanceSect(f.session,.1);
 assert.equal(victim.lifeStatus,'dead');assert.equal(victim.wound,100);assert.equal(victim.xp,xp);
 for(let n=0;n<2500&&journeys(f).find(j=>j.id===survivorJourney.id).phase!=='returned';n++){
  if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);
 }
 const end=f.session.state,dead=end.personsById[victim.personId],alive=end.personsById[survivorJourney.personId],js=journeys(f),lost=js.find(j=>j.id===victimJourney.id),returned=js.find(j=>j.id===survivorJourney.id);
 assert.equal(lost.phase,'dead');assert.equal(dead.lifeStatus,'dead');assert.equal(dead.wound,100);assert.equal(dead.xp,xp);assert.equal(dead.activityId,null);
 assert.equal(end.stockpilesById[bagId].pills.heal,1);assert.equal(lost.medicine.use,undefined);assert.equal(lost.medicine.returned,0);assert.equal(lost.growth,undefined);
 assert.equal(alive.lifeStatus,'alive');assert.equal(returned.phase,'returned');assert.equal(returned.encounter.injury,10);
 assert.equal(Object.values(end.factsById).filter(x=>x.kind==='death'&&x.personId===victim.personId).length,1);
 const before=JSON.stringify(end);advanceDiscipleExpeditions(end);assert.equal(JSON.stringify(end),before);validateSect(f.session);
});

test('an unavailable paired handover keeps valid pending goals and retries after the actual public destination becomes reachable',()=>{
 const f=createExpeditionCompanionsScenario({condition:'contact-shortage'});
 let arriving=false;
 for(let n=0;n<1500;n++){
  if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);
  const s=f.session.state;if(journeys(f).some(j=>j.phase==='returning'&&s.travelsById[j.travelId].progressTicks===s.travelsById[j.travelId].durationTicks-1)){arriving=true;break;}
 }
 assert(arriving,'the voluntary pair actually walks back and completes its return travel');
 const home=f.session.state.stockpilesById[f.sourceStockpileId],original=structuredClone(home.position);
 // A declared inaccessible handover location triggers the same no-legal-point
 // branch as occupied standing points. Stock, cargo and outcomes are untouched.
 home.position={sceneId:HOME,x:0,y:0};
 for(let n=0;n<4;n++)advanceSect(f.session,.1);
 for(const j of journeys(f)){assert.equal(j.phase,'delivery');assert.equal(j.deliveryBlocked,true);assert(Number.isFinite(j.deliveryGoal.x)&&Number.isFinite(j.deliveryGoal.y));assert.equal(j.delivered,undefined);assert.equal(j.growth,undefined);}
 validateSect(f.session);
 f.session.state.stockpilesById[f.sourceStockpileId].position=original;
 for(let n=0;n<2500&&journeys(f).some(j=>j.phase!=='returned');n++){
  if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);
 }
 for(const j of journeys(f)){assert.equal(j.phase,'returned');assert.equal(j.deliveryBlocked,false);assert.equal(f.session.state.factsById[`fact:disciple:${j.id}:delivery`].personId,j.personId);}
 validateSect(f.session);
});
