/** SR-XF-020-AC-03: a normal rescue claim keeps its source and one-time social effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const KIN='person:su-mingzhi',GU='person:gu-wanyi',UNINFORMED='person:zhou-an';
const FACT='fact:social:crisis:rain:su-yelan:rescue',CLAIM=`claim:fact:${FACT}:person:master`;
const evidenceDir=process.env.XIANFU_QA_SR020_AC03_DIR;

test('reading, sharing and loading a rescued-person claim preserve source and social settlement',()=>{
 const h=harness(),persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr020-ac03'});
 const claim=()=>h.s.claimsById[CLAIM];
 const truth=()=>({text:claim().text,topic:claim().topic,truthType:claim().truthType,sourceId:claim().sourceId,rootSourceId:claim().rootSourceId,observedTick:claim().observedTick,issuedTick:claim().issuedTick,evidenceFactIds:claim().evidenceFactIds});
 const social=()=>({kin:h.s.personsById[KIN].mind.relationships.master.trust,gu:h.s.personsById[GU].mind.relationships.master.trust,uninformed:h.s.personsById[UNINFORMED].mind.relationships.master.trust,guFaction:h.s.factionsById[h.s.personsById[GU].factionId].reputation,portrait:h.s.srWorld.portrait,receipts:claim().receivedTickByPersonId,deliveryFactIds:claim().deliveryFactIds,personRelations:h.s.srWorld.personRelations});
 const settlement=s=>({kin:s.personsById[KIN].mind.relationships.master.trust,gu:s.personsById[GU].mind.relationships.master.trust,uninformed:s.personsById[UNINFORMED].mind.relationships.master.trust,guFaction:s.factionsById[s.personsById[GU].factionId].reputation,portrait:s.srWorld.portrait,receipts:s.claimsById[CLAIM].receivedTickByPersonId,deliveryFactIds:s.claimsById[CLAIM].deliveryFactIds});
 const viewRead=label=>{const raw=JSON.stringify(h.s),tick=h.s.worldTick;for(let n=0;n<3;n++){const html=renderSRPanel(h.s,SIM,'journal'),message=SIM.viewSRWorld(h.s).messages.find(m=>m.id===CLAIM);assert(message);assert.equal(message.observedTick,claim().observedTick);assert.equal(message.receivedAtTick,claim().receivedTickByPersonId['person:master']);assert(html.includes(claim().text));assert(html.includes(`观察世界刻${message.observedTick}`));assert(html.includes(`收到世界刻${message.receivedAtTick}`));assert(!html.includes('truthType'));}assert.equal(JSON.stringify(h.s),raw,`${label}: read-only UI`);assert.equal(h.s.worldTick,tick,`${label}: read-only clock`);};
 const checkpoint=(label)=>{h.save();const raw=JSON.stringify(h.s),exported=persistence.exportState(h.s,{slot:1}),parsed=persistence.parseImport(exported);assert.equal(parsed.ok,true,`${label}: native import`);assert.equal(JSON.stringify(parsed.state),raw,`${label}: exact native reload`);assert.equal(renderSRPanel(parsed.state,SIM,'journal'),renderSRPanel(h.s,SIM,'journal'),`${label}: journal reload`);if(evidenceDir){const dir=resolve(evidenceDir);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`${label}-import.json`),exported);writeFileSync(resolve(dir,`${label}-provenance.json`),JSON.stringify({kind:'normal-public-command-checkpoint',acceptanceId:'SR-XF-020-AC-03',label,counts:h.counts}));}return parsed.state;};

 h.act('masterAction','heal');h.until(s=>s.master.wound===0,'normal initial healing');
 h.act('advanceStory');h.until(s=>s.weatherByRegionId['region:yunxiu'].phase==='rain','natural rain',3000);
 h.act('srStoryCommand',{action:'activateRainChain'});h.until(s=>s.crisesById['crisis:rain:su-yelan']?.messageDelivered,'actual rain clue',500);
 h.travel('scene:valley');h.worldWalk(47,35);
 h.act('srCrisisCommand',{action:'search',crisisId:'crisis:rain:su-yelan'});
 h.act('srCrisisCommand',{action:'treat',crisisId:'crisis:rain:su-yelan'});
 h.until(s=>s.crisesById['crisis:rain:su-yelan'].outcome==='rescued','actual eight-herb rescue');
 assert(claim()?.recipients.includes('person:master'));
 const initialTruth=JSON.stringify(truth());checkpoint('rescue-claim');
 h.act('setSpeed',0);viewRead('first journal reading');h.act('setSpeed',1);
 const remote=JSON.stringify(h.s);assert.throws(()=>h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:KIN}),/会面/);assert.equal(JSON.stringify(h.s),remote,'remote share cannot settle');

 h.travel('scene:market');h.worldWalk(28,27);
 const kinBefore=h.s.personsById[KIN].mind.relationships.master.trust;
 const kinShare=h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:KIN});assert.equal(kinShare.durationTicks,50);
 h.until(s=>!s.srWorld.interaction,'actual kin delivery');SIM.tick(h.s,.1);
 assert.equal(h.s.personsById[KIN].mind.relationships.master.trust,kinBefore+9);
 const kinReceipt=claim().receivedTickByPersonId[KIN];assert.equal(kinReceipt,h.s.factsById[claim().deliveryFactIds[0]].atTick);
 assert.equal(claim().deliveryFactIds.length,1);
 assert.equal(JSON.stringify(truth()),initialTruth);checkpoint('kin-delivered');
 h.act('setSpeed',0);viewRead('repeated kin journal reading');const afterKin=JSON.stringify(social());
 assert.equal(h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:KIN}),false);
 assert.equal(JSON.stringify(social()),afterKin,'same recipient cannot receive another social settlement');
 assert.equal(claim().receivedTickByPersonId[KIN],kinReceipt);h.act('setSpeed',1);

 const gu=h.s.personsById[GU];h.worldWalk(gu.position.x,gu.position.y);
 const guBefore=gu.mind.relationships.master.trust,factionBefore=h.s.factionsById[gu.factionId].reputation,unknownBefore=h.s.personsById[UNINFORMED].mind.relationships.master.trust;
 h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:GU});h.until(s=>!s.srWorld.interaction,'actual Gu delivery');SIM.tick(h.s,.1);
 assert.equal(h.s.personsById[GU].mind.relationships.master.trust,guBefore+3);
 assert.equal(h.s.factionsById[gu.factionId].reputation,factionBefore+3);
 assert.equal(h.s.personsById[UNINFORMED].mind.relationships.master.trust,unknownBefore);
 assert.equal(claim().deliveryFactIds.length,2);
 const guReceipt=claim().receivedTickByPersonId[GU],delivered=JSON.stringify(social());
 assert.equal(JSON.stringify(truth()),initialTruth);
 h.act('setSpeed',0);viewRead('shared claim journal reading');const loaded=checkpoint('two-recipients-delivered');
 assert.equal(h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:KIN}),false);
 assert.equal(h.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:GU}),false);
 assert.equal(JSON.stringify(social()),delivered);
 assert.equal(claim().receivedTickByPersonId[KIN],kinReceipt);
 assert.equal(claim().receivedTickByPersonId[GU],guReceipt);
 assert.equal(JSON.stringify(truth()),initialTruth);
 const resumed=harness(loaded,'resumed'),settled=JSON.stringify(settlement(h.s)),restoredTruth=JSON.stringify(loaded.claimsById[CLAIM]),restoredTick=loaded.worldTick;
 assert.equal(resumed.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:KIN}),false);
 assert.equal(resumed.act('srWorldCommand',{action:'share',claimId:CLAIM,recipientId:GU}),false);
 assert.equal(JSON.stringify(resumed.s.claimsById[CLAIM]),restoredTruth,'repeated delivery keeps source and receipts');
 assert.equal(JSON.stringify(settlement(resumed.s)),settled,'repeated delivery keeps social settlement');
 assert.equal(resumed.s.worldTick,restoredTick,'repeated delivery does not advance time');
 resumed.act('setSpeed',1);const beforeStep=resumed.s.worldTick;SIM.tick(resumed.s,.1);
 assert.equal(resumed.s.worldTick,beforeStep+1,'loaded world resumes on the common clock');
 assert.equal(JSON.stringify(settlement(resumed.s)),settled,'first resumed world step does not resettle');
 console.log(JSON.stringify({counts:h.counts,claimId:CLAIM,kinReceipt,guReceipt,deliveryFacts:claim().deliveryFactIds.length,publicSharing:true}));
});
