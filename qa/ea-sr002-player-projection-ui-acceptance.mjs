/** SR-XF-002: player-facing message times and finite crisis positioning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';

const journalMessage=(message,actors=[])=>renderSRPanel(
 {srWorld:{},master:{location:{kind:'local',sceneId:'scene:yunxiu-courtyard',x:28,y:12}}},
 {srEnabled:()=>true,viewSRWorld:()=>({messages:[{id:'claim:qa:timing',text:'旧口信',speakerName:'传话人',verification:'unverified',...message}],scene:{actors}})},
 'journal'
);

test('SR002 journal separates observation from actual receipt, including world tick zero',()=>{
 const html=journalMessage({observedTick:11,issuedTick:12,receivedAtTick:19});
 assert.match(html,/观察世界刻11 · 收到世界刻19/);
 assert.doesNotMatch(html,/获知世界刻11/);
 assert.match(journalMessage({observedTick:0,receivedAtTick:0}),/观察世界刻0 · 收到世界刻0/);
});

test('SR002 legacy message with no receipt evidence displays unknown instead of issue time',()=>{
 const html=journalMessage({observedTick:4,issuedTick:17,receivedAtTick:null});
 assert.match(html,/观察世界刻4 · 收到世界刻未知/);
 assert.doesNotMatch(html,/收到世界刻17/);
 assert.match(journalMessage({observedTick:4,issuedTick:17}),/收到世界刻未知/);
});

test('SR002 journal shares only claims originally received by the master',()=>{
 const actors=[{personId:'person:lu-zhiwei',name:'陆知微'}];
 assert.doesNotMatch(journalMessage({canShare:false},actors),/当面分享消息/);
 assert.match(journalMessage({canShare:true},actors),/当面分享消息/);
});

test('SR002 journal shows supported facts and retellings at their actual certainty',()=>{
 const s=SIM.initial({sr:true});
 const acquired=SIM.recordFactSR(s,'fact:qa:journal-known',{kind:'observation',observerId:'person:master',text:'掌门亲见水痕'});
 const direct=SIM.publishFactSR(s,acquired.id);
 const unacquired=SIM.recordFactSR(s,'fact:qa:journal-hearsay',{kind:'observation',observerId:'person:lu-zhiwei',text:'同伴声称见到路况'});
 const retelling=SIM.recordClaimSR(s,{id:'claim:qa:journal-retelling',text:'同伴转述路况',speakerId:'person:lu-zhiwei',verification:'corroborated',evidenceFactIds:[unacquired.id]});
 const html=renderSRPanel(s,SIM,'journal');
 const card=id=>{const start=html.indexOf(`data-key="claim-${id}"`);assert(start>=0);return html.slice(start,html.indexOf('</article>',start));};
 assert.match(card(direct.id),/有事实互证/);
 assert.match(card(retelling.id),/尚未核实/);
 assert.doesNotMatch(card(retelling.id),/有事实互证/);
});

test('SR002 searched crisis retains an in-scene approach without exposing a remote point',()=>{
 const s=SIM.initial({sr:true});
 const c=SIM.startCrisisSR(s,{id:'crisis:sr:qa-projection',personId:'person:su-yelan',sceneId:'scene:valley',x:47,y:34.5});
 s.master.location={kind:'local',sceneId:'scene:valley',x:47,y:34.5};
 SIM.searchCrisisSR(s,c.id);
 assert.deepEqual(SIM.viewSRCrises(s).known.find(v=>v.id===c.id).approachPoint,{x:47,y:34.5});
 s.master.location={kind:'local',sceneId:'scene:valley',x:2,y:2};
 assert.deepEqual(SIM.viewSRCrises(s).known.find(v=>v.id===c.id).approachPoint,{x:47,y:34.5});
 s.master.location={kind:'local',sceneId:'scene:yunxiu-courtyard',x:28,y:12};
 const before=JSON.stringify(s);
 const remote=SIM.viewSRCrises(s).known.find(v=>v.id===c.id);
 assert.equal(remote.approachPoint,null);
 assert.equal(remote.locationHint,'云岫山谷 · 听雨侧洞一带');
 assert.equal(remote.remainingEstimate,null);
 assert.equal(JSON.stringify(s),before,'the view does not change world state');
});

test('SR002 crisis appears from its delivered signal, not an unrelated claim citing the signal ID',()=>{
 const s=SIM.initial({sr:true});
 const c=SIM.startCrisisSR(s,{id:'crisis:sr:qa-signal',personId:'person:su-yelan',sceneId:'scene:valley',messageDelayTicks:60});
 const factId=`fact:crisis:${c.id}:signal`;
 SIM.recordFactSR(s,factId,{kind:'delayed-message',personId:c.personId,sceneId:c.sceneId,observedTick:s.worldTick,text:'迟到求援口信'});
 SIM.recordClaimSR(s,{id:'claim:qa:unrelated-signal',text:'未经核验的转述',sourceId:'source:rumor',verification:'unverified',evidenceFactIds:[factId]});
 assert.equal(SIM.viewSRCrises(s).known.some(v=>v.id===c.id),false);
 SIM.recordClaimSR(s,{id:`claim:crisis:${c.id}`,text:'迟到求援口信',sourceId:factId,observedTick:s.worldTick,verification:'unverified',evidenceFactIds:[factId]});
 assert.equal(SIM.viewSRCrises(s).known.some(v=>v.id===c.id),true);
});

test('SR002 an unverified death report cannot reveal the remote crisis outcome',()=>{
 const s=SIM.initial({sr:true});
 const c=SIM.startCrisisSR(s,{id:'crisis:sr:qa-remote-death',personId:'person:su-yelan',sceneId:'scene:valley',durationTicks:2,messageDelayTicks:0});
 SIM.tick(s,.2);
 assert.equal(c.outcome,'dead');
 s.srCrises.rainChain={crisisId:c.id,activatedTick:0};
 SIM.recordClaimSR(s,{id:'claim:qa:remote-death-rumor',text:'据说药师已亡',verification:'unverified',evidenceFactIds:[c.deathFactId]});
 const rumor=SIM.viewSRCrises(s);
 assert.equal(rumor.known.find(v=>v.id===c.id).outcome,null);
 assert.equal(rumor.known.find(v=>v.id===c.id).status,'unconfirmed');
 assert.equal(rumor.rainChain.stage,'awaiting-confirmation');
 assert.equal(rumor.cooldownUntil,null);
 SIM.publishFactSR(s,c.deathFactId);
 const verified=SIM.viewSRCrises(s);
 assert.equal(verified.known.find(v=>v.id===c.id).outcome,'dead');
 assert.equal(verified.rainChain.stage,'aftermath');
});
