import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionPurposeScenario} from '../../fixtures/expedition-purpose.mjs';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {advanceDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {stockpileReceiptPreview} from '../../../src/simulation/ea-sr-economy.mjs';

const HOME='stockpile:yunxiu';
const journey=f=>f.session.state.discipleExpeditions.journeys[0];
function until(f,predicate,max=2500){
 for(let n=0;n<max&&!predicate();n++){
  if(n%100===0)assert.equal(commandSect(f.session,{type:'manual'}).ok,true);
  advanceSect(f.session,.1);
 }
 assert(predicate(),'bounded actual journey reaches its delivery checkpoint');
}
function returning({explore=false,medicine=false}={}){
 const f=createExpeditionPurposeScenario({condition:explore?'well-supplied':'supply-shortage'});
 if(medicine){f.session.state.doctrine.pillRule='shared';f.session.state.stockpilesById[HOME].pills.heal=1;}
 until(f,()=>journey(f)?.phase==='delivery');
 assert.equal(journey(f).cargo.herb,explore?0:6);
 return f;
}
function held(f,body,homeHerb){
 const s=f.session.state,j=journey(f);
 assert.equal(j.phase,'delivery');assert.equal(j.cargo.herb,6);
 assert.equal(s.personsById[f.travellerId].activityId,body);
 assert.equal(s.stockpilesById[HOME].resources.herb,homeHerb);
 assert.equal(s.factsById[`fact:disciple:${j.id}:delivery`],undefined);
 assert.equal(j.growth,undefined);assert.equal(j.delivered,undefined);
}
function deliveredOnce(f,homeHerb){
 until(f,()=>journey(f).phase==='returned',30);
 const s=f.session.state,j=journey(f);assert.equal(j.cargo.herb,0);assert.equal(j.delivered.herb,6);
 assert.equal(s.stockpilesById[HOME].resources.herb,homeHerb+6);
 assert.equal(s.factsById[`fact:disciple:${j.id}:gather`].amount,6);
 assert.equal(s.factsById[`fact:disciple:${j.id}:delivery`].cargo.herb,6);
 const before=JSON.stringify(s);advanceDiscipleExpeditions(s);assert.equal(JSON.stringify(s),before);
 for(let n=0;n<100;n++)advanceSect(f.session,.1);
 assert.equal(f.session.state.stockpilesById[HOME].resources.herb,homeHerb+6);
 assert.equal(Object.values(f.session.state.factsById).filter(x=>x.id===`fact:disciple:${j.id}:delivery`).length,1);
 assert.equal(validateSect(f.session),true);
}

test('actual gathered cargo waits outside a full public inventory and is delivered exactly once after space returns',()=>{
 const f=returning(),s=f.session.state,home=s.stockpilesById[HOME],capacity=home.capacity,herbs=home.resources.herb,body=s.personsById[f.travellerId].activityId;
 home.capacity=Math.ceil(stockpileReceiptPreview(s,HOME).used);
 assert.equal(stockpileReceiptPreview(s,HOME,{herb:6}).available,false);
 for(let n=0;n<200;n++)advanceSect(f.session,.1);
 held(f,body,herbs);assert.equal(journey(f).deliveryBlocked,undefined);
 home.capacity=capacity;deliveredOnce(f,herbs);
});

test('private ownership and a closed store keep returning herbs personal until the public destination is restored',()=>{
 for(const condition of ['private','other-owner','closed-store']){
  const f=returning(),s=f.session.state,home=s.stockpilesById[HOME],herbs=home.resources.herb,owner=home.ownerId,buildingId=home.buildingId,body=s.personsById[f.travellerId].activityId,hall=s.buildings.find(b=>b.type==='hall');
  if(condition==='private')home.access='private';
  if(condition==='other-owner')home.ownerId=f.companionId;
  if(condition==='closed-store'){home.buildingId=hall.instanceId;hall.enabled=false;}
  for(let n=0;n<200;n++)advanceSect(f.session,.1);
  held(f,body,herbs);
  home.access='public';home.ownerId=owner;hall.enabled=true;
  if(buildingId===undefined)delete home.buildingId;else home.buildingId=buildingId;
  deliveredOnce(f,herbs);
 }
});

test('an unused borrowed pill uses real capacity before herb delivery and cannot make the combined handover overflow',()=>{
 const f=returning({medicine:true});assert.equal(journey(f).medicine.source,'public');
 until(f,()=>{const p=f.session.state.personsById[f.travellerId],goal=journey(f).deliveryGoal;return Math.hypot(p.position.x-goal.x,p.position.y-goal.y)<.5;},220);
 const s=f.session.state,home=s.stockpilesById[HOME],capacity=home.capacity,herbs=home.resources.herb,body=s.personsById[f.travellerId].activityId;
 home.capacity=Math.ceil(stockpileReceiptPreview(s,HOME).used)+6;
 assert.equal(stockpileReceiptPreview(s,HOME,{herb:6}).available,true);
 assert.equal(stockpileReceiptPreview(s,HOME,{herb:6,'pill:heal':1}).available,false);
 until(f,()=>journey(f).medicine.returned===1,10);
 const current=f.session.state,received=current.stockpilesById[HOME];
 held(f,body,herbs);assert.equal(received.pills.heal,1);
 assert.equal(stockpileReceiptPreview(current,HOME,{herb:6}).available,false);
 assert(stockpileReceiptPreview(current,HOME).used<=received.capacity);
 received.capacity=capacity;deliveredOnce(f,herbs);
 assert.equal(Object.values(f.session.state.factsById).filter(x=>x.id===`fact:disciple:${journey(f).id}:medicine-return`).length,1);
 assert.equal(f.session.state.stockpilesById[HOME].pills.heal,1);
});

test('completed exploration with zero herb cargo keeps its original return and experience semantics',()=>{
 const f=returning({explore:true}),s=f.session.state,home=s.stockpilesById[HOME],herbs=home.resources.herb;
 home.capacity=Math.ceil(stockpileReceiptPreview(s,HOME).used);home.access='private';
 until(f,()=>journey(f).phase==='returned',220);
 const j=journey(f);assert.equal(j.delivered.herb,0);assert.equal(j.growth.experience,8);
 assert.equal(f.session.state.stockpilesById[HOME].resources.herb,herbs);
 assert.equal(validateSect(f.session),true);
});
