import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscipleAdvancementScenario} from '../../fixtures/disciple-advancement.mjs';
import {advanceSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {breakthroughPillAvailability,prepareBreakthroughPillPickup,reserveBreakthroughPill,carriedStockpile} from '../../../src/simulation/ea-sr-economy.mjs';
import {beginPersonBreakthrough,autonomousBreakthroughChoice} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {discipleAdvancementView} from '../../../src/simulation/ea-disciple-advancement.mjs';
import {inviteOffice} from '../../../src/simulation/ea-society.mjs';
import {day,xpNeed} from '../../../src/simulation/ea-data.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';

function nearHome(f){
 const s=f.session.state,p=s.personsById[f.targetId],home=s.stockpilesById[f.sourceStockpileId],at={x:home.position.x+.3,y:home.position.y};
 Object.assign(p.mind.scenic,{...at,path:[],goal:null,revision:geometryRevision(s)});
 p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...at};p.location={kind:'local',sceneId:p.position.sceneId,...at};
}
const breakthroughs=(s,id)=>Object.values(s.srCultivation.orders).filter(o=>o.personId===id&&o.kind==='breakthrough');

test('nearby public foundation pills still require todays permission and all demand reads stay pure',()=>{
 for(const permission of ['none','today','restricted']){
  const f=createDiscipleAdvancementScenario({condition:'no-permission',initialFoundation:1});nearHome(f);
  const s=f.session.state,p=s.personsById[f.targetId];
  if(permission!=='none')p.mind.pillPermitDay=day(s);
  if(permission==='restricted')p.mind.restrictedUntil=s.time+120;
  const before=JSON.stringify(s),q=breakthroughPillAvailability(s,f.targetId);
  discipleAdvancementView(s);assert.equal(JSON.stringify(s),before);
  assert.equal(q.publicAllowed,permission==='today');assert.equal(q.available,permission==='today'?1:0);
  if(permission!=='today'){
   assert.throws(()=>beginPersonBreakthrough(s,f.targetId,{autonomous:true}));
   assert.equal(JSON.stringify(s),before,'no permission cannot reserve a nearby public dose or charge breakthrough costs');
  }
  assert.equal(validateSect(f.session),true);
 }
});

test('mixed nearby sources reserve only a persons own private pill when public use is forbidden',()=>{
 for(const owner of ['self','other']){
  const f=createDiscipleAdvancementScenario({condition:'no-permission',initialFoundation:1});nearHome(f);
  const s=f.session.state,p=s.personsById[f.targetId],home=s.stockpilesById[f.sourceStockpileId],id='stockpile:advancement:private';
  s.stockpilesById[id]={id,ownerId:owner==='self'?f.targetId:f.alchemistId,access:'private',capacity:40,position:{sceneId:'scene:yunxiu-courtyard',x:home.position.x+1.2,y:home.position.y},resources:Object.fromEntries(Object.keys(home.resources).map(k=>[k,0])),pills:{...home.pills,foundation:1}};
  const q=breakthroughPillAvailability(s,f.targetId);assert.equal(q.publicAllowed,false);
  assert.equal(q.available,owner==='self'?1:0);
  if(owner==='self'){
   const a=reserveBreakthroughPill(s,f.targetId,{reservationId:'pill-allocation:advancement-private'});
   assert.deepEqual(a.parts,[{stockpileId:id,quantity:1}]);assert.equal(a.phase,'reserved');
   assert.equal(s.stockpilesById[id].pills.foundation,0);
  }else{const before=JSON.stringify(s);assert.throws(()=>reserveBreakthroughPill(s,f.targetId));assert.equal(JSON.stringify(s),before);}
  assert.equal(home.pills.foundation,1,'the closer but unauthorized public pill stays untouched');
  assert.equal(p.realm,9);assert.equal(validateSect(f.session),true);
 }
});

test('two willing residents compete for one physical dose without reserving or creating it twice',()=>{
 const f=createDiscipleAdvancementScenario({initialFoundation:1}),s=f.session.state,other=s.personsById[f.alchemistId];
 other.xp=xpNeed(9);other.mind.traits[1]=50;other.mind.knowledge.foundation=100;other.artsById.foundation={artId:'foundation',access:true,understanding:100,mastery:0,source:'configured-U172',chapter:'foundation'};
 assert.equal(autonomousBreakthroughChoice(s,f.targetId).available,true);assert.equal(autonomousBreakthroughChoice(s,f.alchemistId).available,true);
 assert.equal(breakthroughPillAvailability(s,f.targetId).needsPickup,true);assert.equal(breakthroughPillAvailability(s,f.alchemistId).needsPickup,true);
 const first=prepareBreakthroughPillPickup(s,f.targetId);assert.equal(first.accepted,true,first.reason);
 const w=s.workOrdersById[first.id];assert.equal(w.carrierId,f.targetId);assert.deepEqual(w.cargo,{'pill:foundation':1});
 assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,0);
 const readBefore=JSON.stringify(s),projection=discipleAdvancementView(s).members.find(p=>p.personId===f.targetId);
 assert.equal(projection.needsFoundation,false,'the held pickup is not a new missing dose');assert.deepEqual(projection.cost,{});assert.deepEqual(projection.locks,[]);
 assert.equal(JSON.stringify(s),readBefore);
 assert.equal(prepareBreakthroughPillPickup(s,f.alchemistId).accepted,false);
 assert.equal(prepareBreakthroughPillPickup(s,f.targetId).accepted,false);
 assert.equal(Object.values(s.workOrdersById).filter(o=>o.kind==='transport'&&o.cargo['pill:foundation']).length,1);
 assert.equal(Object.values(s.reservationsById).filter(r=>r.kind==='transport-cargo').reduce((n,r)=>n+(r.cost?.['pill:foundation']||0),0),1);
 assert.equal(Object.values(s.srEconomy.pillAllocations).length,0,'a pending pickup is not yet breakthrough consumption');
 assert.equal(validateSect(f.session),true);
});

test('an existing accepted work commitment keeps its actual body before either pickup or breakthrough',()=>{
 const f=createDiscipleAdvancementScenario({condition:'commitment',initialFoundation:1}),initial=f.session.state,p=initial.personsById[f.targetId],body=p.activityId,job=p.job;
 assert.equal(autonomousBreakthroughChoice(initial,f.targetId).available,false);
 const before=JSON.stringify(initial);assert.equal(prepareBreakthroughPillPickup(initial,f.targetId).accepted,false);assert.equal(JSON.stringify(initial),before);
 for(let n=0;n<30;n++)advanceSect(f.session,.1);
 const s=f.session.state,current=s.personsById[f.targetId];
 assert.equal(current.activityId,body);assert.equal(current.job,job);assert.equal(current.mind.activity,'work');
 assert.equal(breakthroughs(s,f.targetId).length,0);
 assert(!Object.values(s.workOrdersById).some(w=>w.kind==='transport'&&w.carrierId===f.targetId));
 assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,1);assert.equal(validateSect(f.session),true);
});

test('an accepted permanent office does not permanently forbid its holder from advancing',()=>{
 const f=createDiscipleAdvancementScenario(),s=f.session.state,p=s.personsById[f.targetId];
 // An established organization is an isolated initial condition; this test
 // exercises the real office invitation rather than the founding campaign.
 s.society.formal=true;s.society.foundedAt=s.society.clock;s.sect.founded=true;s.sect.level=2;
 assert.equal(inviteOffice(s,p.id,'steward').accepted,true);assert.equal(p.mind.office,'steward');
 const bag=carriedStockpile(s,f.targetId);s.stockpilesById[bag].pills.foundation=1;
 assert.equal(autonomousBreakthroughChoice(s,f.targetId).available,true);
 for(let n=0;n<30&&!breakthroughs(f.session.state,f.targetId).length;n++)advanceSect(f.session,.1);
 const current=f.session.state;assert.equal(breakthroughs(current,f.targetId).length,1);
 assert.equal(current.personsById[f.targetId].mind.office,'steward');assert.equal(current.society.officers.steward,p.id);
 const readBefore=JSON.stringify(current),projection=discipleAdvancementView(current).members.find(p=>p.personId===f.targetId);
 assert.equal(projection.needsFoundation,false);assert.deepEqual(projection.cost,{});assert.deepEqual(projection.locks,[]);
 assert.equal(JSON.stringify(current),readBefore);
 assert.equal(validateSect(f.session),true);
});

test('a full personal bag rejects the single-dose pickup without crashing the world or charging the source',()=>{
 const f=createDiscipleAdvancementScenario({initialFoundation:1}),s=f.session.state,p=s.personsById[f.targetId],bag=s.stockpilesById[carriedStockpile(s,f.targetId)];
 for(const key of Object.keys(bag.resources))bag.resources[key]=0;
 for(const key of Object.keys(bag.pills))bag.pills[key]=0;
 bag.resources.wood=40;assert.equal(bag.capacity,40);
 const before=JSON.stringify(s),body=p.activityId;let answer;
 assert.doesNotThrow(()=>{answer=prepareBreakthroughPillPickup(s,f.targetId);});
 assert.equal(answer.accepted,false);assert.match(answer.reason,/容量|库位|背|满/);
 assert.equal(JSON.stringify(s),before);assert.equal(p.activityId,body);
 assert.doesNotThrow(()=>{for(let n=0;n<10;n++)advanceSect(f.session,.1);});
 const current=f.session.state;assert.equal(current.stockpilesById[f.sourceStockpileId].pills.foundation,1);
 assert(!Object.values(current.workOrdersById).some(w=>w.kind==='transport'&&w.carrierId===f.targetId));
 assert.equal(breakthroughs(current,f.targetId).length,0);assert.equal(validateSect(f.session),true);
});
