import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {createDiscipleAdvancementScenario} from '../../fixtures/disciple-advancement.mjs';
import {createDiscipleCraftRequestScenario} from '../../fixtures/disciple-craft-request.mjs';
import {considerDiscipleCraftPreparation,requestDiscipleCraftPreparation,discipleCraftRequestsView,validateDiscipleCraftRequests} from '../../../src/simulation/ea-disciple-craft-request.mjs';

function fixture(options={}){const f=createDiscipleCraftRequestScenario(options);f.session.state.stockpilesById[f.siteStockpileId].resources.herb=69;f.session.state.stockpilesById[f.sourceStockpileId].resources.herb=6;validateSect(f.session);return f;}
const request=f=>({type:'prepare-disciple-craft',personId:f.personId,recipeId:f.recipeId,buildingId:f.buildingId});
const rec=f=>f.session.state.discipleCraftRequests.records.find(r=>r.id===f.id);
function begin(){const f=fixture(),out=commandSect(f.session,request(f));assert(out.ok,out.error);assert(out.result.accepted,out.result.reason);f.id=out.result.id;return f;}
function step(f,n){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
function until(f,p,max=5000){for(let n=0;n<max&&!p();n++)step(f,n);assert(p(),'formal bounded endpoint');}

test('explicit preparation moves only six actual herbs, then the same person completes and delivers the original one-batch recipe',()=>{
 const f=fixture(),s=f.session.state,immediate=commandSect(f.session,f.request);assert.equal(immediate.ok,false);assert.match(immediate.error,/灵草需75/);assert.equal(s.stockpilesById[f.siteStockpileId].resources.herb,69);
 const out=commandSect(f.session,request(f));assert(out.ok,out.error);assert(out.result.accepted,out.result.reason);f.id=out.result.id;
 const start=f.session.state,initial=JSON.stringify(start),repeat=requestDiscipleCraftPreparation(start,request(f));assert.equal(repeat.id,f.id);assert.equal(JSON.stringify(start),initial);assert.equal(start.personsById[f.personId].activityId,null);assert.equal(rec(f).craftOrderId,null);
 const beforeView=JSON.stringify(start);discipleCraftRequestsView(start);assert.equal(JSON.stringify(start),beforeView);
 until(f,()=>rec(f).status!=='accepted');
 const end=f.session.state,r=rec(f),prep=r.preparation;assert.equal(r.status,'completed',r.reason);assert.equal(prep.materialTransportIds.length,1);
 const material=end.workOrdersById[prep.materialTransportIds[0]],craft=end.workOrdersById[r.craftOrderId],delivery=end.workOrdersById[r.deliveryOrderId];assert.deepEqual(material.cargo,{herb:6});assert.equal(material.phase,'delivered');assert.equal(material.sourceStockpileId,f.sourceStockpileId);assert.equal(material.targetStockpileId,f.siteStockpileId);assert.equal(material.carrierId,f.personId);assert(material.completedTick<=craft.startedTick||material.finishedTick<=craft.startedTick);
 assert.equal(craft.phase,'completed');assert.equal(craft.progressTicks,780);assert.equal(craft.personId,f.personId);assert.deepEqual(craft.cost,prep.cost);assert.deepEqual(craft.sourceStockpileIds,prep.sourceStockpileIds);assert.equal(craft.recipeVersion,prep.recipeVersion);assert.equal(delivery.phase,'delivered');assert.equal(end.stockpilesById[f.sourceStockpileId].pills.foundation,1);assert.equal(end.stockpilesById[f.siteStockpileId].resources.herb,0);validateSect(f.session);
 const malformed=structuredClone(end);malformed.discipleCraftRequests.records.find(x=>x.id===f.id).preparation.recipeVersion='supply-recipes:yunxiu:v2';assert.throws(()=>validateDiscipleCraftRequests(malformed));
});

test('withdrawing preparation preserves the accepted physical transport and never opens a furnace',()=>{
 const f=begin();until(f,()=>!!rec(f).preparation.activeTransportId,100);const id=rec(f).preparation.activeTransportId,s=f.session.state,before=structuredClone(s.workOrdersById[id]);
 const out=commandSect(f.session,{type:'cancel-disciple-craft-preparation',requestId:f.id});assert(out.ok,out.error);assert.equal(out.result.status,'interrupted');assert.deepEqual(f.session.state.workOrdersById[id],before);assert.equal(rec(f).craftOrderId,null);
 until(f,()=>f.session.state.workOrdersById[id].phase==='delivered',2000);assert.equal(rec(f).craftOrderId,null);assert.equal(f.session.state.stockpilesById[f.siteStockpileId].resources.herb,75);assert.equal(f.session.state.stockpilesById[f.sourceStockpileId].resources.herb,0);validateSect(f.session);
});

test('preparation structure cannot claim completion or mismatch status without an actual paid batch',()=>{
 const f=begin(),base=f.session.state;
 for(const change of [r=>r.status='completed',r=>{r.status='interrupted';r.phase='preparing';r.finishedTick=base.worldTick;},r=>{r.status='accepted';r.phase='interrupted';},r=>{r.status='interrupted';r.phase='interrupted';},r=>r.preparation.cost.herb=1,r=>r.preparation.sourceStockpileIds.herb=f.sourceStockpileId]){const s=structuredClone(base);change(s.discipleCraftRequests.records.find(r=>r.id===f.id));assert.throws(()=>validateDiscipleCraftRequests(s));}
});

test('a changed recipe snapshot pauses preparation without spending or adopting a new cost',()=>{
 const f=begin(),s=f.session.state,r=rec(f),before=JSON.stringify(Object.values(s.stockpilesById).map(st=>[st.id,st.resources,st.pills]));r.preparation.recipeVersion='supply-recipes:yunxiu:v2';r.preparation.cost={jade:180,herb:75,crystal:12,insight:15};r.preparation.sourceStockpileIds={jade:f.sourceStockpileId,herb:f.siteStockpileId,crystal:f.siteStockpileId,insight:f.sourceStockpileId};validateDiscipleCraftRequests(s);
 step(f,1);assert.equal(rec(f).craftOrderId,null);assert.equal(rec(f).preparation.materialTransportIds.length,0);assert.match(rec(f).reason,/配方或材料来源已变化/);assert.equal(JSON.stringify(Object.values(f.session.state.stockpilesById).map(st=>[st.id,st.resources,st.pills])),before);
});


test('a willing queued preparation keeps the original body and promise, then takes a natural expiry opportunity without manual job clearing',()=>{
 const f=fixture({condition:'commitment'}),s=f.session.state,p=s.personsById[f.personId],promise={activityId:p.activityId,job:p.job,commitUntil:p.mind.commitUntil,schedule:p.schedule.commitUntilTick};
 const out=commandSect(f.session,request(f));assert(out.ok,out.error);assert(out.result.accepted,out.result.reason);f.id=out.result.id;
 const now=f.session.state,worker=now.personsById[f.personId];assert.equal(worker.activityId,promise.activityId);assert.equal(worker.job,promise.job);assert.equal(worker.mind.commitUntil,promise.commitUntil);assert.equal(worker.schedule.commitUntilTick,promise.schedule);const body=JSON.stringify(now.activitiesById[worker.activityId]);assert.equal(considerDiscipleCraftPreparation(now,f.personId),false);assert.equal(JSON.stringify(now.activitiesById[worker.activityId]),body);
 until(f,()=>rec(f).preparation.materialTransportIds.length>0,1000);
 const current=f.session.state,r=rec(f),transport=current.workOrdersById[r.preparation.materialTransportIds[0]];assert(current.time>=promise.commitUntil);assert(transport.startedTick>=promise.schedule);assert.equal(transport.carrierId,f.personId);assert.deepEqual(transport.cargo,{herb:6});const sameTick=JSON.stringify(current);assert.equal(considerDiscipleCraftPreparation(current,f.personId),false);assert.equal(JSON.stringify(current),sameTick);validateSect(f.session);
});


test('full foundation preparation waits its real rest deadline instead of renewing it at the six-second reconsideration',()=>{
 // U-172 one initial pill isolates the scheduling seam; the scenario earns its own pill.
 const f=createDiscipleAdvancementScenario({initialFoundation:1}),s=f.session.state,p=s.personsById[f.targetId],deadline=s.time+8,start=s.worldTick;
 p.mind.activity='rest';p.mind.lastDecision=s.time;p.mind.commitUntil=deadline;p.schedule.commitUntilTick=s.worldTick;validateSect(f.session);
 let pickup=null;
 for(let n=0;n<600;n++){step(f,n);const current=f.session.state,target=current.personsById[f.targetId];if(current.time<deadline){assert.equal(target.mind.commitUntil,deadline);assert.equal(Object.values(current.workOrdersById).some(w=>w.kind==='transport'&&w.carrierId===f.targetId&&w.startedTick>=start),false);}pickup=Object.values(current.workOrdersById).find(w=>w.kind==='transport'&&w.carrierId===f.targetId&&w.startedTick>=start&&w.cargo['pill:foundation']===1);if(target.realm===10)break;}
 assert(pickup);assert(pickup.startedTick>=deadline*10);assert.equal(f.session.state.personsById[f.targetId].realm,10);assert.equal(f.session.state.stockpilesById[f.sourceStockpileId].pills.foundation,0);assert.equal(Object.values(f.session.state.srCultivation.orders).filter(o=>o.kind==='breakthrough'&&o.personId===f.targetId).length,1);validateSect(f.session);
});
