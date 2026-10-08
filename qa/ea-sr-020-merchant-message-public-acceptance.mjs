/** SR-XF-020-AC-01: original merchant words compared with records earned by normal play. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

const claimId='claim:rain:merchant';
const evidenceDir=process.env.XIANFU_QA_SR020_MESSAGE_DIR;
const persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr020-message'});
const card=(s)=>{
 const html=renderSRPanel(s,SIM,'journal'),start=html.indexOf(`data-key="claim-${claimId}"`);
 assert(start>=0,'merchant message is visible in the normal journal');
 return html.slice(start,html.indexOf('</article>',start));
};
const view=s=>SIM.viewSRWorld(s).messages.find(m=>m.id===claimId);
const checkpoint=(h,label,expectedRecords)=>{
 const raw=JSON.stringify(h.s),tick=h.s.worldTick,seen=view(h.s),html=card(h.s);
 assert.equal(seen.comparison.records.length,expectedRecords,label);
 assert.equal(seen.certainty,'unverified','an independent record does not certify every merchant assertion');
 assert.equal(seen.text,'侧洞确有药材，采出便可救急。');
 assert.match(html,/姚仲原话：侧洞确有药材，采出便可救急。/);
 assert.match(html,/尚未核实/);
 assert.match(html,/据已知推测/);
 assert(!html.includes('truthType')&&!html.includes('omission'),'author truth stays private');
 assert.equal(JSON.stringify(h.s),raw,'view and journal reading are read-only');
 h.save();
 assert.equal(h.s.worldTick,tick,'exact save/reload does not advance the world clock');
 assert.deepEqual(view(h.s),seen,'knowledge comparison survives exact reload');
 assert.equal(card(h.s),html,'journal card survives exact reload');
 if(evidenceDir){const dir=resolve(evidenceDir);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`${label.replaceAll(' ','-')}-import.json`),persistence.exportState(h.s,{slot:1}));}
 return {label,tick,observedTick:seen.observedTick,receivedAtTick:seen.receivedAtTick,records:seen.comparison.records.map(r=>({source:r.sourceName,tick:r.observedTick}))};
};

// Normal public chain: normalOpening performs the published opening, then only
// world ticks and public commands create rain, travel, inspections and dialogue.
const h=normalOpening(),evidence=[];
let weatherWait=0;
while(h.s.weatherByRegionId['region:yunxiu'].phase!=='rain'&&weatherWait++<3600)SIM.tick(h.s,.1);
assert.equal(h.s.weatherByRegionId['region:yunxiu'].phase,'rain','rain occurs in the normal world clock');
h.act('srStoryCommand',{action:'activateRainChain'});
const originalClaim=JSON.stringify(h.s.claimsById[claimId]);
evidence.push(checkpoint(h,'merchant account received',0));
assert.equal(view(h.s).observedTick,view(h.s).receivedAtTick,'directly delivered message retains its actual issue/receipt tick');
assert(!card(h.s).includes('旧约交换药草'),'old agreement is not leaked before investigation');

h.travel('scene:valley',{cargo:{food:3}});
h.worldWalk(47,35);
h.act('srWorldCommand',{action:'interact',objectId:'object:valley:cave',choice:'inspect'});
h.until(s=>!s.srWorld.interaction,'actual cave investigation',100);
evidence.push(checkpoint(h,'cave observation',1));
assert.match(card(h.s),/洞口药篓与足印/);
assert(!card(h.s).includes('旧约交换药草'),'cave traces do not reveal the guardian conversation');

h.worldWalk(43,24);
h.act('srWorldCommand',{action:'interact',objectId:'object:valley:guardian',choice:'talk'});
h.until(s=>!s.srWorld.interaction,'actual guardian conversation',100);
evidence.push(checkpoint(h,'guardian conversation',2));
assert.match(card(h.s),/青萝当面说明的旧约/);
assert.match(card(h.s),/已核实的现场记录/);
const beforeRepeat=JSON.stringify(h.s),beforeMessage=view(h.s);
h.act('srWorldCommand',{action:'interact',objectId:'object:valley:guardian',choice:'talk'});
assert.equal(h.s.worldTick,evidence.at(-1).tick,'repeat conversation is idempotent');
assert.deepEqual(view(h.s),beforeMessage,'repeat interaction does not refresh either message or evidence times');
assert.equal(JSON.stringify(h.s.factsById['fact:rain:guardian']),JSON.stringify(JSON.parse(beforeRepeat).factsById['fact:rain:guardian']));
assert.equal(JSON.stringify(h.s.claimsById[claimId]),originalClaim,'original merchant words, source and receipt are unchanged');

// Control fixture only: a fact recorded for someone else is not master's evidence.
const control=SIM.initial({sr:true});
SIM.recordClaimSR(control,{id:claimId,topic:'herbalist',speakerId:'person:yao-zhong',sourceId:'source:yao-personal',text:'侧洞确有药材，采出便可救急。',truthType:'omission'});
SIM.recordFactSR(control,'fact:rain:guardian',{kind:'agreement',observerId:'person:qing-luo',sceneId:'scene:valley',text:'青萝记录的未送达旧约'});
assert.equal(view(control).comparison.records.length,0,'private remote fact is not projected as master knowledge');
assert(!card(control).includes('青萝记录的未送达旧约'));

console.log(JSON.stringify({suite:'SR-XF-020-AC-01 merchant message',normalPublicChain:{opening:'normalOpening / seed 618033',weatherWait,commands:h.counts.commands,saves:h.counts.saves,evidence},controlFixture:'undelivered guardian fact remains hidden',passed:1},null,2));
