import test from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {validatePersons,inviteWork} from '../../../src/simulation/ea-sr-persons.mjs';
import {discipleExpeditionsView} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {createExpeditionRecoveryScenario} from '../../fixtures/expedition-recovery.mjs';

for(const condition of ['healthy','injured','no-medicine'])test(`${condition}: a real return settles once, recovery uses its owned bed, and voluntary work resumes`,()=>{
 const f=createExpeditionRecoveryScenario({condition}),s=f.s,p=s.personsById[f.returneeId],companion=s.personsById[f.companionId];
 const journey=s.discipleExpeditions.journeys.find(j=>j.id===f.journeyId),initialHerb=s.resources.herb,initialSkill=companion.mind.skills.industry;
 let returned=false,healed=false,resumed=false,healingSteps=0,medicine=0,returnTick=null;
 for(let n=0;n<900;n++){
  const wound=p.wound,herb=s.resources.herb,wasHealing=s.activitiesById[p.activityId]?.action==='heal';
  tick(s,.1);
  const body=s.activitiesById[p.activityId];
  if(journey.phase==='returned'&&!returned){
   returned=true;returnTick=s.worldTick;assert.equal(journey.completedTick,returnTick);assert.equal(journey.delivered.herb,condition==='no-medicine'?0:2);
   assert.equal(s.resources.herb,initialHerb+journey.delivered.herb);
   assert.equal(p.mind.activity,condition==='healthy'?'rest':'heal');assert.equal(p.mind.recovering,condition==='healthy'?undefined:true);
   if(condition==='no-medicine')assert.match(p.mind.reason,/缺少草药.*自然调养/);
   if(condition!=='healthy'){const reply=inviteWork(s,p.personId,f.buildingIds.industry);assert.equal(reply.accepted,false);assert.match(reply.publicReason,/调养/);}
  }
  if(!returned)continue;
  if(condition!=='healthy'&&p.wound>5){assert.equal(p.mind.recovering,true);assert.notEqual(p.mind.activity,'work');assert.equal(p.job,null);}
  if(body?.action==='heal'&&body.phase==='executing'){
   const slot=slotById(s,body.slotId),reservation=s.reservationsById[body.reservationId];assert(slot);assert.equal(reservation.personId,p.personId);assert.equal(reservation.slotId,slot.id);
   assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);
  }
  if(wound>p.wound&&(wasHealing||body?.action==='heal')){
   healingSteps++;const paid=herb-s.resources.herb;if(paid>0){assert.equal(paid,1);medicine++;assert(Math.abs(wound-p.wound-4.1)<1e-8);}else assert(Math.abs(wound-p.wound-.1)<1e-8);
  }
  if(condition!=='healthy'&&p.wound<=5){healed=true;assert.equal(p.mind.recovering,undefined);}
  if(p.mind.activity==='work'&&body?.phase==='executing')resumed=true;
 }
 assert(returned);assert(resumed,'the returnee physically resumes a chosen ordinary job');
 assert.equal(journey.completedTick,returnTick);assert.equal(Object.values(s.factsById).filter(x=>x.id===`fact:disciple:${journey.id}:delivery`).length,1);
 assert.equal(s.discipleExpeditions.journeys.length,1,'the recovery scene creates no second outing');
 assert.equal(companion.mind.activity,'work');assert(companion.mind.skills.industry>initialSkill);assert(Object.values(s.factsById).some(x=>x.operation==='production'&&x.participantIds?.includes(companion.personId)));
 if(condition==='healthy'){assert.equal(healingSteps,0);assert.equal(medicine,0);}else{assert(healed);assert(healingSteps>0);assert.equal(medicine,condition==='no-medicine'?0:2);}
 assert.equal(s.resources.herb,initialHerb+journey.delivered.herb-medicine);assert.equal(validatePersons(s),true);
});

test('recovery is optional validated data, observation does not create it, and real steps clear completed or dead intent',()=>{
 const f=createExpeditionRecoveryScenario({condition:'healthy'}),s=f.s,p=s.personsById[f.returneeId];
 const before=JSON.stringify(s);validatePersons(s);discipleExpeditionsView(s);assert.equal(JSON.stringify(s),before);assert(!Object.hasOwn(p.mind,'recovering'));
 p.mind.recovering='yes';assert.throws(()=>validatePersons(s),/调养意图/);p.mind.recovering=true;p.wound=0;tick(s,1);assert(!Object.hasOwn(p.mind,'recovering'));
 const q=s.personsById[f.companionId];q.mind.recovering=true;q.wound=12;q.lifeStatus='dead';tick(s,1);assert(!Object.hasOwn(q.mind,'recovering'));
});
