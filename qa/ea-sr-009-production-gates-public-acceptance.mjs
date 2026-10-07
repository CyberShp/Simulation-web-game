/** SR-XF-009-AC-01: production gates from an earned public-command save.
 * Reproduce the source with:
 *   node qa/ea-sr-integration-acceptance.mjs --case 'normal fresh SR full artisan care' --checkpoint-dir /tmp/immortal-sr009-source
 * Run this check with:
 *   SR009_SOURCE=/tmp/immortal-sr009-source/physical-workshop-built.json node --test qa/ea-sr-009-production-gates-public-acceptance.mjs
 * The source and evidence stay outside the repository. No state is injected.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';
import {facilityRecords} from '../dist/ea-scene-state.mjs';
import {personLifeSummary} from '../dist/ea-life.mjs';
import {productionAvailability, productionInputAvailable} from '../dist/ea-sr-economy.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';

const sourcePath=process.env.SR009_SOURCE;
const source=sourcePath?JSON.parse(readFileSync(sourcePath,'utf8')):null;
const homeId='stockpile:yunxiu';
const siteId='stockpile:building:yunxiu:6';

function earned(){
 assert.equal(source?.provenance?.kind,'normal-public-command-checkpoint');
 assert.equal(source.provenance.label,'physical workshop built');
 const state=S.validateSave(source.state);
 assert.equal(JSON.stringify(state),JSON.stringify(source.state),'source must already be a canonical save');
 assert.equal(source.provenance.counts.worldTick,state.worldTick);
 assert(state.homeMemberIds.length>=5);
 assert.equal(state.buildingsById['building:yunxiu:6']?.type,'workshop');
 return harness(state);
}
function workshop(s){return s.buildingsById['building:yunxiu:6'];}
function site(s){return s.stockpilesById[siteId];}
function stockView(s,id){
 const actual=s.stockpilesById[id],visible=S.viewEconomy(s).stockpiles.find(st=>st.id===id);
 assert(actual&&visible,`stock ${id} is visible on the production management page`);
 assert.deepEqual(visible.resources,actual.resources,`management stock ${id} uses positioned inventory`);
 assert.deepEqual(visible.position,actual.position);
 return visible;
}
function stockCard(s,id,title){
 const html=renderSRPanel(s,S,'production'),start=html.indexOf(`data-key="stock-${id}"`);
 assert(start>=0,`${title} is rendered in the production management page`);
 const card=html.slice(start,html.indexOf('</article>',start));
 assert(card.includes(`<h4>${title}</h4>`));
 stockView(s,id);
 return card;
}
function transportCard(s,id,reason){
 const html=renderSRPanel(s,S,'production'),start=html.indexOf(`data-key="transport-${id}"`);
 assert(start>=0,'active transport is rendered on the production management page');
 const card=html.slice(start,html.indexOf('</article>',start));
 assert(card.includes('<h4>在途搬运</h4>'));
 assert(card.includes(reason),'the management page shows the transport order reason');
 return card;
}
function productionFacts(s,id){
 return Object.values(s.factsById).filter(f=>f.operation==='production'&&f.targetStockpileId===id).map(f=>f.id);
}
function exactSave(h,label){
 const before=JSON.stringify(h.s);
 h.save();
 assert.equal(JSON.stringify(h.s),before,`${label}: exact save and reload`);
}
function outputUnchanged(s,initialFacts){
 assert.equal(site(s).resources.jade,0,'workshop has no produced jade');
 assert.deepEqual(productionFacts(s,siteId),initialFacts,'workshop has no new production result fact');
 stockView(s,siteId);
}
function assertBuyerStatus(s,b){
 const merchant=s.personsById['person:merchant-qingxi'],availability=productionAvailability(s,b);
 if(merchant.position?.kind==='scene'&&merchant.position.sceneId==='scene:yunxiu-courtyard')assert.equal(availability.available,true,'onsite buyer can fund this batch');
 else assert.match(availability.reason,/买方尚未实际到达/,'buyer away from the courtyard cannot fund production');
}

if(!source){
 test('SR-XF-009-AC-01 source checkpoint', {skip:'Set SR009_SOURCE to the earned physical-workshop-built.json checkpoint.'},()=>{});
}else{
 test('no executing worker keeps an existing finite batch and output unchanged until arrival',()=>{
  const h=earned(),lumber=h.s.buildings.find(b=>b.type==='lumber');
  assert(lumber&&!lumber.enabled);
  const orderId=`work:production:${lumber.instanceId}`,pileId=`stockpile:${lumber.instanceId}`;
  const initialProgress=h.s.workOrdersById[orderId].progressTicks;
  const initialWood=h.s.stockpilesById[pileId].resources.wood;
  const initialFacts=productionFacts(h.s,pileId);
  assert(initialProgress>0&&initialProgress<h.s.workOrdersById[orderId].durationTicks,'earned unfinished batch is the test target');
  h.act('toggleBuilding',lumber.id);
  assert.equal(h.s.buildingsById[lumber.instanceId].enabled,true);
  assert.equal(productionAvailability(h.s,h.s.buildingsById[lumber.instanceId]).available,true);
  exactSave(h,'reopened source facility');
  let unstaffed=false,travelling=false,firstContribution=null;
  for(let i=0;i<300&&!firstContribution;i++){
   const row=facilityRecords(h.s).find(r=>r.id===lumber.id);
   if(row.workOrder.progressTicks>initialProgress){
    assert(row.slots.some(slot=>slot.kind==='work'&&slot.phase==='executing'),'the first contribution has an onsite worker');
    firstContribution={tick:h.s.worldTick,progress:row.workOrder.progressTicks};
    break;
   }
   assert.equal(row.workOrder.progressTicks,initialProgress,'waiting and travel do not contribute production');
   assert.equal(h.s.stockpilesById[pileId].resources.wood,initialWood);
   assert.deepEqual(productionFacts(h.s,pileId),initialFacts);
   if(row.workers.length===0)unstaffed=true;
   if(row.slots.some(slot=>slot.kind==='work'&&slot.phase==='navigating')){
    if(!travelling)exactSave(h,'assigned worker travelling before production');
    travelling=true;
   }
   S.tick(h.s,.1);
  }
  assert(unstaffed,'source begins before any worker is assigned');
  assert(travelling,'a worker travels to the facility before contributing');
  assert(firstContribution,'an onsite worker eventually contributes to the retained batch');
  stockView(h.s,pileId);
  exactSave(h,'first actual labour contribution');
  console.log(JSON.stringify({case:'no-worker',source:sourcePath,sourceCounts:source.provenance.counts,worldTick:h.s.worldTick,progressBefore:initialProgress,progressAfter:firstContribution.progress,checks:h.counts.saves}));
 });

 test('public work invitation explains missing material at the facility despite public inventory',()=>{
  const h=earned(),b=workshop(h.s),personId=h.s.homeMemberIds[0];
  const startingFacts=productionFacts(h.s,siteId);
  assert.equal(productionAvailability(h.s,b).available,true,'buyer and finite output are available');
  assert.equal(productionInputAvailable(h.s,b),false);
  assert(h.s.stockpilesById[homeId].resources.wood>=3&&h.s.stockpilesById[homeId].resources.stone>=2);
  assert.equal(site(h.s).resources.wood,0);
  assert.equal(site(h.s).resources.stone,0);
  assert(stockCard(h.s,siteId,'百工坊').includes('无额外材料'));
  const offer=h.act('inviteWork',personId,b.instanceId);
  assert.equal(offer.accepted,false);
  assert.match(offer.publicReason,/生产原料不足/);
  const opportunity=personLifeSummary(h.s,h.s.personsById[personId],{opportunities:true}).opportunities.find(o=>o.facilityId===b.id);
  assert.equal(opportunity?.available,false);
  assert.equal(opportunity.reason,offer.publicReason,'person management uses the same public reason');
  exactSave(h,'missing local input and work refusal');
  h.until(s=>s.personsById['person:merchant-qingxi'].position?.kind==='worldTravel','buyer departs after actual visit',1000);
  assertBuyerStatus(h.s,workshop(h.s));
  assert.equal(productionInputAvailable(h.s,workshop(h.s)),false);
  assert.equal(h.s.workOrdersById[`work:production:${b.instanceId}`],undefined);
  outputUnchanged(h.s,startingFacts);
  assert(stockCard(h.s,siteId,'百工坊').includes('无额外材料'));
  exactSave(h,'missing local input after world steps');
  console.log(JSON.stringify({case:'local-shortage',source:sourcePath,sourceCounts:source.provenance.counts,worldTick:h.s.worldTick,reason:offer.publicReason,home:stockView(h.s,homeId).resources,site:stockView(h.s,siteId).resources,checks:h.counts.saves}));
 });

 test('public material transport remains in transit until physical delivery to the facility',()=>{
  const h=earned(),b=workshop(h.s),startingFacts=productionFacts(h.s,siteId);
  const stone=h.act('startTransport',homeId,siteId,'person:master',{stone:2});
  exactSave(h,'stone reserved for transport');
  h.until(s=>s.workOrdersById[stone.id].phase==='delivered','physical stone delivery',1000);
  assert.equal(site(h.s).resources.stone,2);
  exactSave(h,'stone at facility');
  const homeWoodBefore=h.s.stockpilesById[homeId].resources.wood;
  const wood=h.act('startTransport',homeId,siteId,'person:master',{wood:3});
  const order=()=>h.s.workOrdersById[wood.id];
  assert.equal(order().phase,'to-source');
  assert.equal(h.s.stockpilesById[homeId].resources.wood,homeWoodBefore-3);
  assert.equal(site(h.s).resources.wood,0);
  assertBuyerStatus(h.s,workshop(h.s));
  assert.equal(productionInputAvailable(h.s,workshop(h.s)),false);
  const publicTransport=()=>S.viewEconomy(h.s).transports.find(t=>t.id===wood.id);
  assert.equal(publicTransport()?.phase,'to-source');
  transportCard(h.s,wood.id,order().reason);
  outputUnchanged(h.s,startingFacts);
  exactSave(h,'wood reserved but not picked up');
  h.until(s=>s.workOrdersById[wood.id].phase==='carrying','wood physically picked up',500);
  assert.equal(publicTransport()?.phase,'carrying');
  transportCard(h.s,wood.id,order().reason);
  assert.equal(site(h.s).resources.wood,0);
  assertBuyerStatus(h.s,workshop(h.s));
  outputUnchanged(h.s,startingFacts);
  exactSave(h,'wood carried but not delivered');
  h.until(s=>s.workOrdersById[wood.id].phase==='delivered','wood physical delivery',500);
  assert.equal(site(h.s).resources.wood,3);
  assert.equal(site(h.s).resources.stone,2);
  assert.equal(productionInputAvailable(h.s,workshop(h.s)),true);
  assert.equal(h.s.stockpilesById[homeId].resources.wood+site(h.s).resources.wood,homeWoodBefore);
  assert(stockCard(h.s,siteId,'百工坊').includes('灵木 3 · 青石 2'));
  outputUnchanged(h.s,startingFacts);
  exactSave(h,'material available only after arrival');
  console.log(JSON.stringify({case:'in-transit',source:sourcePath,sourceCounts:source.provenance.counts,worldTick:h.s.worldTick,transportId:wood.id,home:stockView(h.s,homeId).resources,site:stockView(h.s,siteId).resources,checks:h.counts.saves}));
 });
}
