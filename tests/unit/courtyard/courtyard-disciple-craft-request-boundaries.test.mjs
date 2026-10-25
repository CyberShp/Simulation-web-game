import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscipleCraftRequestScenario} from '../../fixtures/disciple-craft-request.mjs';
import {commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {requestDiscipleCraft,discipleCraftRequestsView,advanceDiscipleCraftRequests} from '../../../src/simulation/ea-disciple-craft-request.mjs';

const view=f=>discipleCraftRequestsView(f.session.state).members.find(p=>p.personId===f.personId);
const physical=s=>JSON.stringify({tick:s.worldTick,time:s.time,stockpiles:s.stockpilesById,activities:s.activitiesById,reservations:s.reservationsById,people:s.personsById,economy:s.srEconomy});

test('remote or undisclosed pharmacists expose no current recipe details and cannot receive a request',()=>{
 for(const condition of ['remote','hidden']){
  const f=createDiscipleCraftRequestScenario({condition}),s=f.session.state,before=JSON.stringify(s),v=view(f);
  assert.equal(v.contact.available,false);assert.deepEqual(v.recipes,[]);assert.equal(v.active,null);
  assert.throws(()=>requestDiscipleCraft(s,f.request));
  assert.equal(JSON.stringify(s),before,'blocked contact neither leaks current details nor records a new command');
 }
 const f=createDiscipleCraftRequestScenario(),s=f.session.state,before=JSON.stringify(s);
 assert.throws(()=>requestDiscipleCraft(s,{...f.request,personId:'person:master'}));
 assert.equal(JSON.stringify(s),before,'the consultation cannot install the master as an NPC worker');
});

test('personal refusal and either existing commitment keep materials, stations and the current body intact',()=>{
 for(const condition of ['unwilling','commitment','schedule-only']){
  const f=createDiscipleCraftRequestScenario({condition:condition==='schedule-only'?'ready':condition}),s=f.session.state;
  if(condition==='schedule-only')s.personsById[f.personId].schedule.commitUntilTick=s.worldTick+100;
  const before=physical(s),answer=requestDiscipleCraft(s,f.request);
  assert.equal(answer.accepted,false);assert.equal(answer.craftOrderId,null);
  assert.equal(physical(s),before,'a reply cannot consume inputs or replace a body');
  const repeated=JSON.stringify(s);assert.deepEqual(requestDiscipleCraft(s,f.request),answer);
  assert.equal(JSON.stringify(s),repeated,'the same refusal is stable without a second receipt');
  assert.equal(validateSect(f.session),true);
 }
});

test('another persons private furnace stock stays private during a public consultation',()=>{
 const f=createDiscipleCraftRequestScenario(),s=f.session.state,site=s.stockpilesById[f.siteStockpileId];
 site.access='private';site.ownerId=f.travellerId;
 const before=physical(s),v=view(f);
 assert(!v.recipes.some(r=>(r.materials||[]).some(m=>m.sourceStockpileId===site.id&&typeof m.available==='number')),'private exact inventory is not public recipe availability');
 const answer=requestDiscipleCraft(s,f.request);assert.equal(answer.accepted,false);
 assert.equal(physical(s),before);assert.equal(answer.craftOrderId,null);
 assert.equal(validateSect(f.session),true);
});

test('the accepted public request owns one batch and repeated clicks or reads never make medicine',()=>{
 const f=createDiscipleCraftRequestScenario(),initial=f.session.state,tick=initial.worldTick,master=JSON.stringify(initial.master);
 const first=commandSect(f.session,f.request);assert.equal(first.ok,true,first.error);
 const s=f.session.state,r=first.result,w=s.workOrdersById[r.craftOrderId];
 assert.equal(r.accepted,true);assert.equal(w.personId,f.personId);assert.equal(w.progressTicks,0);
 assert.equal(w.recipeId,'foundation');assert.equal(s.factsById[w.choiceFactId].actorId,f.personId);
 assert.equal(s.stockpilesById[f.sourceStockpileId].resources.jade,20);
 assert.equal(s.stockpilesById[f.siteStockpileId].resources.herb,0);
 assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,0);
 assert.equal(s.stockpilesById[f.siteStockpileId].pills.foundation,0);
 assert.equal(s.factsById[`fact:craft:${w.id}`],undefined);
 const before=JSON.stringify(s);
 assert.deepEqual(requestDiscipleCraft(s,f.request),r);
 for(let n=0;n<5;n++){view(f);advanceDiscipleCraftRequests(s);}
 assert.equal(JSON.stringify(s),before);assert.equal(s.worldTick,tick);
 assert.equal(JSON.stringify(s.master),master);
 assert.equal(s.discipleCraftRequests.records.filter(x=>x.accepted).length,1);
 assert.equal(validateSect(f.session),true);
});
