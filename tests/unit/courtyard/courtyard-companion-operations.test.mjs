import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionOperationsScenario} from '../../fixtures/companion-operations.mjs';
import {advanceSect,commandSect,validateSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import {stockpileReceiptPreview} from '../../../src/simulation/ea-sr-economy.mjs';
const outings=f=>f.session.state.discipleExpeditions.journeys;
function command(f,r){const out=commandSect(f.session,r);assert(out.ok,out.error);return out;}
function step(f,n){if(n%100===0)command(f,{type:'manual'});advanceSect(f.session,.1);}
function until(f,predicate,max=4000){for(let n=0;n<max&&!predicate();n++)step(f,n);assert(predicate(),'bounded official world reaches endpoint');}
for(const condition of ['safe','encounter'])test(`five disciples: ${condition}, four daily settlements, finite hauling and both return to production`,()=>{
 const f=createCompanionOperationsScenario({condition}),seen=new Set(),daily=new Map(),production=new Map(),beds=new Set();let min=Infinity,minHome=Infinity,closed=false;
 command(f,{type:'disciple-expeditions',enabled:true,allowCompanions:true});
 for(let n=0;n<5000;n++){
  step(f,n);const s=f.session.state,js=outings(f);assert.equal(s.economy.starvation,0);assert.equal(s.homeMemberIds.length,5);
  const ps=f.travellerIds.map(id=>s.personsById[id]);if(ps.every(p=>p.location.kind==='local'&&p.location.sceneId==='scene:valley')){const d=Math.hypot(ps[0].location.x-ps[1].location.x,ps[0].location.y-ps[1].location.y);min=Math.min(min,d);assert(d>=.53-1e-7);}
  if(js.length===2&&js.some(j=>['preparing','approach','delivery'].includes(j.phase))&&ps.every(p=>p.location.kind==='local'&&p.location.sceneId==='scene:yunxiu-courtyard')){const d=Math.hypot(ps[0].location.x-ps[1].location.x,ps[0].location.y-ps[1].location.y);minHome=Math.min(minHome,d);assert(d>=.53-1e-7,'public-store and gate approaches preserve both bodies');}
  for(const fact of Object.values(s.factsById)){if(fact.kind==='daily-supply-relation'&&fact.atTick>f.metadata.startTick&&f.memberIds.includes(fact.personId)){assert(fact.supplied);daily.set(fact.id,fact);}if(fact.operation==='production')production.set(fact.id,fact);}
  for(const p of ps){const a=s.activitiesById[p.activityId];if(p.wound>5&&a?.kind==='facility'&&a.action==='heal'&&a.phase==='executing'){assert(a.slotId);beds.add(p.personId);}}
  for(const id of f.stayIds)assert(!js.some(j=>j.personId===id));
  if(!closed&&js.length===2&&js.every(j=>j.phase==='returned')){command(f,{type:'disciple-expeditions',enabled:false});closed=true;}
 }
 const s=f.session.state,js=outings(f);assert(closed);assert.equal(daily.size,20);assert.equal(js.length,2);
 const deliveries=Object.values(s.workOrdersById).filter(w=>w.kind==='transport'&&w.phase==='delivered'&&w.cargo.food>0&&w.targetStockpileId===f.sourceStockpileId);assert(deliveries.some(w=>f.stayIds.includes(w.carrierId)));assert(s.stockpilesById['stockpile:building:yunxiu:92'].resources.food>=2);
 for(const j of js){assert.deepEqual(j.cost,{food:2,energy:8});assert([...production.values()].some(x=>x.atTick>j.completedTick&&x.participantIds.includes(j.personId)));}
 if(condition==='encounter'){assert(js.every(j=>j.encounter.injury===10));assert.equal(js.filter(j=>j.medicine.use?.status==='consumed').length,1);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.heal,0);assert(beds.size);assert(f.travellerIds.every(id=>s.personsById[id].wound<=5));}
 else{assert(js.every(j=>j.growth.experience===8));assert.equal(s.stockpilesById[f.sourceStockpileId].pills.heal,1);}
 const before=JSON.stringify(s);viewSect(f.session);assert.equal(JSON.stringify(s),before);validateSect(f.session);
 console.log(JSON.stringify({condition,end:s.worldTick,minimumValleyDistance:min,minimumHomeDistance:minHome,daily:daily.size,foodDeliveries:deliveries.map(w=>({id:w.id,tick:w.finishedTick,carrier:w.carrierId,food:w.cargo.food})),beds:[...beds]}));
});
test('five-person food shortage refuses departures without charging expedition costs',()=>{
 const f=createCompanionOperationsScenario({condition:'food-shortage'});command(f,{type:'disciple-expeditions',enabled:true,allowCompanions:true});
 for(let n=0;n<30;n++)step(f,n);assert.equal(outings(f).length,0);assert(!Object.values(f.session.state.factsById).some(f=>f.kind==='disciple-expedition-supply'));validateSect(f.session);
});
test('two actual herb cargoes wait for a full public store, then master hauling frees capacity for unique handovers',()=>{
 const f=createCompanionOperationsScenario(),initial=f.session.state;initial.resources.wood=100;initial.resources.herb=0;
 for(const id of f.travellerIds)initial.personsById[id].mind.goal='沿路采药，补充草木药用';
 command(f,{type:'disciple-expeditions',enabled:true,allowCompanions:true});until(f,()=>outings(f).length===2&&outings(f).some(j=>j.phase==='delivery'));
 let s=f.session.state;assert(outings(f).every(j=>j.cargo.herb===6));
 // U-172 full-store checkpoint: the journey and each herb were earned above.
 s.stockpilesById[f.sourceStockpileId].capacity=Math.ceil(stockpileReceiptPreview(s,f.sourceStockpileId).used);
 const herb=s.resources.herb;for(let n=0;n<220;n++)step(f,n);
 assert(outings(f).some(j=>j.phase==='delivery'&&j.cargo.herb===6));assert.equal(f.session.state.resources.herb,herb);
 for(let trip=0;trip<2;trip++){const out=command(f,{type:'transport',sourceStockpileId:f.sourceStockpileId,targetStockpileId:'stockpile:building:yunxiu:80',cargo:{wood:40}});assert(out.result.accepted);until(f,()=>f.session.state.workOrdersById[out.result.id].phase==='delivered',1000);}
 until(f,()=>outings(f).every(j=>j.phase==='returned'));s=f.session.state;assert.equal(s.resources.herb,herb+12);assert(outings(f).every(j=>j.delivered.herb===6));assert.equal(s.stockpilesById[f.sourceStockpileId].pills.heal,1);
 assert(stockpileReceiptPreview(s,f.sourceStockpileId).used<=s.stockpilesById[f.sourceStockpileId].capacity);for(const j of outings(f))assert.equal(Object.values(s.factsById).filter(x=>x.id===`fact:disciple:${j.id}:delivery`).length,1);validateSect(f.session);
});
