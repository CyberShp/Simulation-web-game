/** SR-XF-017-AC-03: refusal and renewed cooperation from a normal public save. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {WORLD_CONTENT_CARDS} from '../dist/ea-sr-world-content.mjs';
import {LOCAL_FACTIONS} from '../dist/ea-sr-world.mjs';
import {LOCAL_INDUSTRY_OFFERS, viewLocalIndustrySR} from '../dist/ea-sr-local-industry.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

const care=WORLD_CONTENT_CARDS.find(c=>c.id==='card:local:medicine-care:v1');
const priority=WORLD_CONTENT_CARDS.find(c=>c.id==='card:local:priority-price:v1');
const guard=LOCAL_INDUSTRY_OFFERS.find(o=>o.definitionId==='local-industry:baiji-guard-a1');
const orgId='organization:baiji-exchange';
const evidenceDir=process.env.XIANFU_QA_SR017_AC03_DIR;

test('declining a local offer preserves related people, finite trade and later cooperation',()=>{
 const h=normalOpening(),persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr017-ac03'});
 assert(care&&priority&&guard);
 const authorFacts=[care,priority].map(c=>JSON.stringify(h.s.factsById[`fact:author:${c.id}`]));
 const stableIds=Object.keys(h.s.personsById),itemIds=Object.keys(h.s.itemsById);
 const checkpoint=(label,kind='normal-public-command-checkpoint')=>{
  h.save();const raw=JSON.stringify(h.s),exported=persistence.exportState(h.s,{slot:1}),parsed=persistence.parseImport(exported);
  assert.equal(parsed.ok,true,`${label}: native import`);
  assert.equal(JSON.stringify(parsed.state),raw,`${label}: exact state after import`);
  assert.equal(renderSRPanel(parsed.state,SIM,'explore'),renderSRPanel(h.s,SIM,'explore'),`${label}: visible history after import`);
  assert.deepEqual(Object.keys(h.s.personsById),stableIds);assert.deepEqual(Object.keys(h.s.itemsById),itemIds);
  for(let n=0;n<2;n++)assert.equal(JSON.stringify(h.s.factsById[`fact:author:${[care,priority][n].id}`]),authorFacts[n]);
  if(evidenceDir){const dir=resolve(evidenceDir);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`${label}.json`),JSON.stringify({provenance:{kind,acceptanceId:'SR-XF-017-AC-03',label,counts:h.counts},state:h.s}));writeFileSync(resolve(dir,`${label}-import.json`),exported);}
 };
 const wait=label=>h.until(s=>!s.srWorld.interaction,label,6000);
 const approach=personId=>{
  const p=h.s.personsById[personId];assert.equal(p.location.sceneId,h.s.master.location.sceneId);
  const {x,y}=p.location;for(const [px,py] of [[x,y],[x-2,y],[x+2,y],[x,y+2],[x,y-2]])try{h.worldWalk(px,py);return;}catch(error){if(!/阻挡/.test(error.message))throw error;}
  assert.fail(`${personId}: no reachable contact position`);
 };
 const offer=card=>{
  for(let n=0;n<5000;n++){
   const status=h.s.srWorldContent.records[card.id].status;if(status==='offered'||status==='verified')return;
   assert.equal(status,'dormant',`${card.id}: unexpected status`);
   const pending=SIM.viewSRWorld(h.s).content.cards.filter(c=>['offered','verified'].includes(c.status));
   if(pending.length>=3){const other=pending.find(c=>c.sceneId===h.s.master.location.sceneId&&c.id!==card.id);assert(other,'reachable capacity release');approach(other.personId);h.act('srWorldCommand',{action:'content',cardId:other.id,choice:'decline'});}else SIM.tick(h.s,.1);
  }
  assert.fail(`${card.id}: no offer in bounded normal play`);
 };
 const industry=choice=>h.act('srWorldCommand',{action:'content',choice,organizationId:orgId});

 h.resources({jade:55,wood:12,food:30});h.travel('scene:market',{cargo:{jade:50,wood:12,food:25}});
 offer(care);approach(care.personId);
 h.act('srWorldCommand',{action:'content',cardId:care.id,choice:'accept'});wait('goodwill exchange settled');
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3);
 const careFactId=`fact:content:${care.id}:result`,careFact=JSON.stringify(h.s.factsById[careFactId]);
 assert.equal(h.s.stockpilesById[`stockpile:content:${care.id.replaceAll(':','-')}`].resources.herb,0);
 checkpoint('care-cooperation');

 offer(priority);approach(priority.personId);
 const beforeDecline=JSON.stringify(h.s.stockpilesById['stockpile:sr-party'].resources),priorityStock=JSON.stringify(h.s.stockpilesById[`stockpile:content:${priority.id.replaceAll(':','-')}`].resources),guReputation=h.s.factionsById['faction:yunxiu-herb'].reputation;
 h.act('srWorldCommand',{action:'content',cardId:priority.id,choice:'decline'});
 assert.equal(h.s.srWorldContent.records[priority.id].status,'declined');
 assert.equal(JSON.stringify(h.s.stockpilesById['stockpile:sr-party'].resources),beforeDecline);
 assert.equal(JSON.stringify(h.s.stockpilesById[`stockpile:content:${priority.id.replaceAll(':','-')}`].resources),priorityStock);
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3);
 assert.equal(JSON.stringify(h.s.factsById[careFactId]),careFact);
 assert.equal(h.s.factionsById['faction:yunxiu-herb'].reputation,guReputation);
 assert.equal(h.s.factsById[`fact:content:${priority.id}:declined`].personId,priority.personId);
 const refusedState=JSON.stringify(h.s);
 assert.throws(()=>h.act('srWorldCommand',{action:'content',cardId:priority.id,choice:'accept'}),/已结束/);
 assert.equal(JSON.stringify(h.s),refusedState,'refused batch cannot be sold afterward');
 checkpoint('priority-declined');

 h.worldWalk(37,22);
 const partyBefore=h.s.stockpilesById['stockpile:sr-party'].resources,herbBefore=partyBefore.herb,jadeBefore=partyBefore.jade,sourceBefore=h.s.factionsById['faction:yunxiu-herb'].resources.herb;
 h.act('srWorldCommand',{action:'interact',objectId:'object:market:merchant',choice:'trade'});wait('same-faction shop cooperation settled');
 assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.jade,jadeBefore-18);
 assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.herb,herbBefore+6);
 assert.equal(h.s.factionsById['faction:yunxiu-herb'].resources.herb,sourceBefore-6);
 assert.equal(h.s.srWorldContent.records[priority.id].status,'declined');
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3);
 checkpoint('herb-shop-cooperation');

 approach('person:luo-ming');const puppetReputation=h.s.factionsById['faction:yunxiu-puppet'].reputation;
 industry('declineIndustry');assert.equal(h.s.srWorldContent.industry.meetings[orgId].status,'declined');
 assert.equal(h.s.factionsById['faction:yunxiu-puppet'].reputation,puppetReputation);
 const declinedMeetingState=JSON.stringify(h.s);
 assert.throws(()=>h.act('srWorldCommand',{action:'content',choice:'purchase',cardId:guard.id}),/先本人当面核对/);
 assert.equal(JSON.stringify(h.s),declinedMeetingState,'purchase still requires renewed permission');
 checkpoint('baiji-contact-declined');
 industry('meet');wait('baiji actual meeting');assert.equal(h.s.srWorldContent.industry.meetings[orgId].status,'accepted');
 assert.equal(viewLocalIndustrySR(h.s).offers.find(o=>o.id===guard.id).remaining,1);
 checkpoint('baiji-contact-accepted');
 h.act('srWorldCommand',{action:'content',choice:'purchase',cardId:guard.id});wait('finite guard puppet trade');
 const purchase=h.s.itemsById[guard.itemId].industry.purchaseFactId,history=JSON.stringify(h.s.factionsById['faction:yunxiu-puppet'].history);
 assert.equal(h.s.itemsById[guard.itemId].ownerId,'person:master');assert(h.s.factsById[purchase]);
 checkpoint('baiji-trade-completed');
 industry('declineIndustry');assert.equal(h.s.srWorldContent.industry.meetings[orgId].status,'declined');
 assert.equal(h.s.itemsById[guard.itemId].industry.purchaseFactId,purchase);
 assert.equal(JSON.stringify(h.s.factionsById['faction:yunxiu-puppet'].history),history);
 checkpoint('baiji-after-trade-declined');
 industry('meet');wait('baiji renewed meeting');
 assert.equal(h.s.srWorldContent.industry.meetings[orgId].status,'accepted');
 assert.equal(viewLocalIndustrySR(h.s).offers.find(o=>o.id===guard.id).remaining,0);
 assert.equal(h.s.itemsById[guard.itemId].ownerId,'person:master');
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3);
 checkpoint('baiji-reopened');

 // Compatibility fixture: there is no player command for changing another person's display name.
 const beforeRename={careFact:JSON.stringify(h.s.factsById[careFactId]),purchaseFact:JSON.stringify(h.s.factsById[purchase]),careRelation:JSON.stringify(h.s.srWorld.personRelations[care.personId]),history:JSON.stringify(h.s.factionsById['faction:yunxiu-puppet'].history)};
 for(const faction of LOCAL_FACTIONS)h.s.personsById[faction.contactId].name=`${faction.contact}新名`;
 checkpoint('display-name-compatibility','controlled-display-name-fixture');
 const journalPanel=renderSRPanel(h.s,SIM,'journal');
 for(const faction of LOCAL_FACTIONS){
  const contact=h.s.personsById[faction.contactId];
  assert.equal(contact.personId,faction.contactId);
  assert.equal(SIM.viewSRWorld(h.s).reputation.factions.find(f=>f.id===faction.id).contact,contact.name,`${faction.id}: current display name in public faction view`);
  assert(journalPanel.includes(`${faction.name} · 接洽${contact.name}`),`${faction.id}: current display name in journal`);
 }
 assert.equal(h.s.personsById[care.personId].personId,care.personId);
 assert.equal(h.s.personsById['person:luo-ming'].personId,'person:luo-ming');
 assert.equal(JSON.stringify(h.s.factsById[careFactId]),beforeRename.careFact);
 assert.equal(JSON.stringify(h.s.factsById[purchase]),beforeRename.purchaseFact);
 assert.equal(JSON.stringify(h.s.srWorld.personRelations[care.personId]),beforeRename.careRelation);
 assert.equal(JSON.stringify(h.s.factionsById['faction:yunxiu-puppet'].history),beforeRename.history);
 assert.equal(h.s.itemsById[guard.itemId].ownerId,'person:master');
 assert(SIM.viewSRWorld(h.s).content.cards.find(c=>c.id===care.id).personName==='顾婉仪新名');
 assert.equal(viewLocalIndustrySR(h.s).organizations.find(o=>o.id===orgId).personName,'罗铭新名');
 assert(renderSRPanel(h.s,SIM,'explore').includes('罗铭新名'));
 console.log(JSON.stringify({counts:h.counts,contentDeclined:priority.id,sameFactionTrade:true,industryReopened:true,purchaseFactId:purchase,renameProof:'controlled fixture only'}));
});
