/** SR-XF-017-AC-02: two named spirit growers receive the same public choice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {WORLD_CONTENT_CARDS} from '../dist/ea-sr-world-content.mjs';
import {LOCAL_FACTIONS} from '../dist/ea-sr-world.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

const pair=[WORLD_CONTENT_CARDS.find(c=>c.id==='card:local:medicine-care:v1'),WORLD_CONTENT_CARDS.find(c=>c.id==='card:local:priority-price:v1')];
const evidenceDir=process.env.XIANFU_QA_SR017_AC02_DIR;
const bankId=card=>`stockpile:content:${card.id.replaceAll(':','-')}`;
const balances=stock=>({...stock.resources});

test('same public herb exchange has distinct fixed motives, payments, evidence and saved outcomes',()=>{
 const [care,priority]=pair,h=normalOpening(),persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr017-ac02'});
 assert(care&&priority);assert.deepEqual(care.cost,priority.cost);assert.deepEqual(care.reward,priority.reward);
 assert.equal(LOCAL_FACTIONS.find(f=>f.id===h.s.personsById[care.personId].factionId).path,h.s.personsById[priority.personId].publicPath);
 assert.equal(h.s.personsById[care.personId].name,'顾婉仪');assert.equal(h.s.personsById[priority.personId].name,'顾守林');
 const authorFacts=pair.map(c=>JSON.stringify(h.s.factsById[`fact:author:${c.id}`]));
 assert(authorFacts[0].includes(care.motive));assert(authorFacts[1].includes(priority.motive));
 assert.equal(care.manipulationTag,false);assert.equal(priority.manipulationTag,true);
 const checkpoint=label=>{
  h.save();const raw=JSON.stringify(h.s),exported=persistence.exportState(h.s,{slot:1}),imported=persistence.parseImport(exported);
  assert.equal(imported.ok,true,`${label}: native import succeeds`);
  assert.equal(JSON.stringify(imported.state),raw,`${label}: exact state survives save/reload`);
  assert.equal(renderSRPanel(imported.state,SIM,'explore'),renderSRPanel(h.s,SIM,'explore'),`${label}: player explanation survives reload`);
  for(let i=0;i<pair.length;i++)assert.equal(JSON.stringify(h.s.factsById[`fact:author:${pair[i].id}`]),authorFacts[i],`${label}: author truth stays fixed`);
  if(evidenceDir){const dir=resolve(evidenceDir);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`${label}.json`),JSON.stringify({provenance:{kind:'normal-public-command-checkpoint',acceptanceId:'SR-XF-017-AC-02',label,counts:h.counts},state:h.s}));writeFileSync(resolve(dir,`${label}-import.json`),exported);}
 };
 const wait=label=>h.until(s=>!s.srWorld.interaction,label,6000);
 const approach=personId=>{
  const p=h.s.personsById[personId];assert.equal(p.location.sceneId,h.s.master.location.sceneId);
  const {x,y}=p.location;for(const [px,py]of [[x,y],[x-2,y],[x+2,y],[x,y+2],[x,y-2]])try{h.worldWalk(px,py);return;}catch(error){if(!/阻挡/.test(error.message))throw error;}
  assert.fail(`${personId}: no reachable contact position`);
 };
 const offer=card=>{
  for(let n=0;n<5000;n++){
   const status=h.s.srWorldContent.records[card.id].status;if(status==='offered'||status==='verified')return;
   assert.equal(status,'dormant',`${card.id}: unexpected disposition`);
   const pending=SIM.viewSRWorld(h.s).content.cards.filter(c=>['offered','verified'].includes(c.status));
   if(pending.length>=3){const other=pending.find(c=>c.sceneId===h.s.master.location.sceneId&&c.id!==card.id);assert(other,'local offer capacity has a reachable contact');approach(other.personId);h.act('srWorldCommand',{action:'content',cardId:other.id,choice:'decline'});}else SIM.tick(h.s,.1);
  }
  assert.fail(`${card.id}: no offer in bounded normal play`);
 };
 const publicOffer=card=>{
  offer(card);approach(card.personId);
  const view=SIM.viewSRWorld(h.s).content.cards.find(c=>c.id===card.id),panel=renderSRPanel(h.s,SIM,'explore');
  assert.equal(view.personId,card.personId);assert.equal(view.personName,h.s.personsById[card.personId].name);
  assert.deepEqual(view.cost,care.cost);assert.deepEqual(view.reward,care.reward);assert.equal(view.terms,null);
  assert(view.actions.some(a=>a.choice==='accept'&&!a.disabled));
  assert(view.publicRequest&&panel.includes(view.publicRequest),`${card.personId}: motive clue is visible before choosing`);
  assert(!panel.includes(card.motive)&&!panel.includes(card.authorTruth),'private author truth remains private');
  assert(!JSON.stringify(view).includes('"jade":6'),'undiscovered附费 is not leaked before checking');
  return view;
 };
 const choose=card=>{
  const bank=h.s.stockpilesById[bankId(card)],party=h.s.stockpilesById['stockpile:sr-party'];
  assert.equal(bank.ownerId,card.personId);assert.equal(bank.position.sceneId,'scene:market');
  const beforeBank=balances(bank),beforeParty=balances(party),beforeTick=h.s.worldTick;
  assert.equal(beforeBank.herb,8,`${card.personId}: first and finite herb batch`);
  h.act('srWorldCommand',{action:'content',cardId:card.id,choice:'accept'});checkpoint(`${card.personId.slice(7)}-started`);wait(`${card.personId}: same accept action settled`);
  const record=h.s.srWorldContent.records[card.id],afterBank=balances(h.s.stockpilesById[bankId(card)]),afterParty=balances(h.s.stockpilesById['stockpile:sr-party']);
  assert.equal(record.status,'completed');assert.equal(h.s.worldTick-beforeTick,60);
  for(const key of Object.keys(beforeBank))assert.ok(Math.abs(beforeBank[key]+beforeParty[key]-afterBank[key]-afterParty[key])<1e-9,`${card.personId}: ${key} conserved between actual owners`);
  assert.equal(afterParty.wood,beforeParty.wood-4);assert.equal(afterParty.food,beforeParty.food-2);assert.equal(afterParty.herb,beforeParty.herb+8);
  assert.equal(afterBank.wood,beforeBank.wood+4);assert.equal(afterBank.food,beforeBank.food+2);assert.equal(afterBank.herb,0);
  assert.equal(h.s.factsById[`fact:content:${card.id}:result`].personId,card.personId);
  checkpoint(`${card.personId.slice(7)}-accepted`);return {record,beforeBank,beforeParty,afterBank,afterParty};
 };

 h.resources({jade:10,wood:12,food:24});h.travel('scene:market',{cargo:{jade:10,wood:12,food:20}});
 publicOffer(care);checkpoint('care-before-choice');const good=choose(care);
 assert.deepEqual(good.record.paidTerms,{});assert.equal(good.afterParty.jade,good.beforeParty.jade);
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3);
 publicOffer(priority);checkpoint('priority-before-choice');const gain=choose(priority);
 assert.deepEqual(gain.record.paidTerms,{jade:6});assert.deepEqual(gain.record.unpaidTerms,{jade:0});
 assert.equal(gain.afterParty.jade,gain.beforeParty.jade-6);assert.equal(gain.afterBank.jade,gain.beforeBank.jade+6);
 assert.equal(h.s.srWorld.personRelations[priority.personId].trust,-4);
 assert.equal(h.s.srWorld.personRelations[care.personId].trust,3,'same path does not force both people to the same reaction');
 const paidPanel=renderSRPanel(h.s,SIM,'explore');assert(paidPanel.includes('已实际付出的附费：灵石 6'));assert(!paidPanel.includes('已退还：灵石 6'));
 const beforeVerify=SIM.viewSRWorld(h.s).content.cards.find(c=>c.id===priority.id);assert.equal(beforeVerify.terms,null);
 const verifyTick=h.s.worldTick,verifyParty=balances(h.s.stockpilesById['stockpile:sr-party']),verifyBank=balances(h.s.stockpilesById[bankId(priority)]);
 h.act('srWorldCommand',{action:'content',cardId:priority.id,choice:'verify'});wait('priority original checked');
 const checked=SIM.viewSRWorld(h.s).content.cards.find(c=>c.id===priority.id),evidence=h.s.factsById[`fact:content:${priority.id}:verified`];
 assert.equal(h.s.worldTick-verifyTick,35);assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.food,verifyParty.food-1);
 assert.equal(h.s.stockpilesById[bankId(priority)].resources.food,verifyBank.food+1);
 assert.equal(checked.terms.jade,6);assert.equal(checked.verified,true);assert(evidence.text.includes(priority.clue));
 assert(renderSRPanel(h.s,SIM,'explore').includes('已查原单附条'));
 checkpoint('priority-verified');
 const preCorrectionTick=h.s.worldTick,preCorrectionParty=balances(h.s.stockpilesById['stockpile:sr-party']),preCorrectionBank=balances(h.s.stockpilesById[bankId(priority)]);
 h.act('srWorldCommand',{action:'content',cardId:priority.id,choice:'correct'});wait('priority documented correction');
 assert.equal(h.s.worldTick-preCorrectionTick,40);
 assert.equal(h.s.srWorldContent.records[priority.id].corrected,true);
 assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.jade,preCorrectionParty.jade+6);
 assert.equal(h.s.stockpilesById[bankId(priority)].resources.jade,preCorrectionBank.jade-6);
 assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.food,preCorrectionParty.food-1);
 assert.equal(h.s.stockpilesById[bankId(priority)].resources.food,preCorrectionBank.food+1);
 assert(h.s.factsById[`fact:content:${priority.id}:corrected`]);
 const correctedPanel=renderSRPanel(h.s,SIM,'explore');assert(correctedPanel.includes('附费曾支付：灵石 6；已退还：灵石 6。'));assert(!correctedPanel.includes('已实际付出的附费：灵石 6'));
 assert.equal(h.s.srWorldContent.records[care.id].status,'completed');
 checkpoint('both-choices-and-correction');
 const frozen=JSON.stringify(h.s);assert.throws(()=>h.act('srWorldCommand',{action:'content',cardId:priority.id,choice:'accept'}),/已结束/);assert.equal(JSON.stringify(h.s),frozen);
 console.log(JSON.stringify({counts:h.counts,personIds:pair.map(c=>c.personId),sameCost:care.cost,sameReward:care.reward,paidTerms:gain.record.paidTerms,corrected:true}));
});
