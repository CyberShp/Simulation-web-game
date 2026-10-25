import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect} from '../../../apps/courtyard/sect-sim.mjs';
import {medicineMaterialNeeds,medicineMaterialWorkCandidate,medicineMaterialTransportCandidate,beginMedicineMaterialTransport} from '../../../src/simulation/ea-medicine-materials.mjs';
import {cropRecipeFor} from '../../../src/simulation/ea-sr-economy.mjs';
import {createMedicineSupplyScenario} from '../../fixtures/medicine-supply.mjs';
function fixture(){const f=createMedicineSupplyScenario();assert.equal(commandSect(f.session,{type:'medicine-supply',enabled:true,target:2}).ok,true);f.s=f.session.state;return f;}

test('material needs and transport are read-only, reserve one real recipe and subtract already committed raw cargo',()=>{
 const f=fixture(),s=f.s,p=s.personsById[f.workerId],before=JSON.stringify(s),n=medicineMaterialNeeds(s),c=medicineMaterialTransportCandidate(s,p);
 assert.equal(JSON.stringify(s),before);assert.equal(n.siteStockpileId,f.siteStockpileId);assert.equal(n.materials.herb.required,10);assert.equal(n.materials.cleanWater.required,2);assert.equal(n.materials.wood.required,1);assert.equal(n.materials.herb.productionDeficit,0);assert.deepEqual(c.cargo,{herb:10,cleanWater:2,wood:1});
 assert.equal(beginMedicineMaterialTransport(s,p,c).accepted,true);assert.equal(p.job,null);assert.equal(p.mind.activity,'rest');assert.equal(s.activitiesById[p.activityId].kind,'sr-transport');
 const next=medicineMaterialNeeds(s);assert.equal(next.materials.herb.transit,10);assert.equal(next.materials.herb.site,0);assert.equal(next.materials.herb.deficit,0);assert.equal(next.materials.cleanWater.deficit,0);assert.equal(medicineMaterialTransportCandidate(s,s.personsById[f.travellerId]),null);
 let delivered=false;
 for(let i=0;i<2000;i++){if(i%100===0)commandSect(f.session,{type:'manual'});advanceSect(f.session,.1);const w=Object.values(f.session.state.workOrdersById).find(w=>w.kind==='transport'&&w.targetStockpileId===f.siteStockpileId&&w.cargo.herb===10);if(w?.phase==='delivered'){delivered=true;break;}}
 assert(delivered,'the existing transport body really deposits the material');const done=f.session.state;assert.equal(done.stockpilesById[f.siteStockpileId].resources.herb,10);assert.equal(done.stockpilesById[f.siteStockpileId].resources.cleanWater,2);
});

test('real field seed requirements are withheld from each public source, while private material never counts',()=>{
 for(const nursery of [false,true]){
  const f=fixture(),s=f.s,p=s.personsById[f.workerId],farm=s.buildings.find(b=>b.type==='farm'),stock=s.stockpilesById['stockpile:'+farm.instanceId];
  if(nursery)farm.domainSiteId='site:domain:gc-22';s.resources.herb=0;s.resources.cleanWater=0;s.resources.wood=0;const reserve=cropRecipeFor(farm).seedCost.herb;stock.resources.herb=reserve+1;
  const candidate=medicineMaterialTransportCandidate(s,p);assert(candidate);assert.equal(candidate.cargo.herb,1);const needs=medicineMaterialNeeds(s);assert.equal(needs.materials.herb.available,1);assert.equal(needs.materials.herb.productionDeficit,9);
  stock.access='private';const before=JSON.stringify(s);assert.equal(medicineMaterialNeeds(s).materials.herb.available,0);assert.equal(medicineMaterialTransportCandidate(s,p),null);assert.equal(JSON.stringify(s),before);
 }
});

test('food protection, disabled medicine policy and an existing promise remove only the new preferences',()=>{
 const f=fixture(),s=f.s,p=s.personsById[f.workerId],farm=s.buildings.find(b=>b.type==='farm');s.resources.herb=0;s.stockpilesById['stockpile:'+farm.instanceId].resources.herb=2;
 const work=medicineMaterialWorkCandidate(s,p,farm);assert.equal(work.resource,'herb');assert.equal(work.scoreBonus,24);
 for(const state of ['food','disabled','target-zero','promise']){
  const copy=structuredClone(s),q=copy.personsById[p.personId],b=copy.buildingsById[farm.instanceId];
  if(state==='food')copy.stockpilesById['stockpile:yunxiu'].resources.food=34.9;if(state==='disabled')copy.medicineSupply.enabled=false;if(state==='target-zero')copy.medicineSupply.target=0;if(state==='promise')q.mind.commitUntil=copy.time+20;
  const before=JSON.stringify(copy);assert.equal(medicineMaterialWorkCandidate(copy,q,b),null,state);assert.equal(medicineMaterialTransportCandidate(copy,q),null,state);assert.equal(JSON.stringify(copy),before,state+' projection does not rewrite a promise, job, stock or policy');
 }
});
