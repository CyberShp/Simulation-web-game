import assert from 'node:assert/strict';
import {initial,dispatchCommand,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {knowledgeView,knownFactForObserver} from '../dist/ea-sr-contracts.mjs';
import {recordClaimSR,recordFactSR,publishFactSR} from '../dist/ea-sr-world.mjs';

let state=initial({sr:true}),serial=0;
const master='person:master',listener='person:qing-luo',stranger='person:yin-shu';
function command(action,payload={}){
 const result=dispatchCommand(state,{name:'srWorldCommand',args:[{action,...payload}],id:`command:qa-knowledge:${++serial}`});
 assert.equal(result.status,'committed',result.message);state=result.state;
}
function finish(){let steps=0;while(state.srWorld.activeTravelId||state.srWorld.interaction){assert(steps++<1000);tick(state,.1);}}
const view=(personId,id)=>knowledgeView(state,{observerId:personId}).find(c=>c.id===id);

command('travel',{destination:'scene:valley'});finish();
command('move',{x:47,y:35});finish();
command('investigate',{sourceId:'object:valley:cave'});finish();
const factId='fact:investigation:object:valley:cave',claimId=`claim:fact:${factId}:${master}`;
assert.equal(state.factsById[factId].observerId,master);
assert.equal(knownFactForObserver(state,master,factId),true);
assert.equal(knownFactForObserver(state,listener,factId),false);
assert.equal(view(stranger,claimId),undefined);
command('move',{x:42,y:24});finish();
command('share',{claimId,recipientId:listener});
for(let i=0;i<49;i++)tick(state,.1);
assert.equal(view(listener,claimId),undefined);
tick(state,.1);
state=validateSave(JSON.parse(JSON.stringify(state)));
const claim=state.claimsById[claimId],receivedTick=state.worldTick;
assert.equal(view(stranger,claimId),undefined);
assert.equal(view(listener,claimId).observedAtTick,claim.observedTick);
assert.equal(view(listener,claimId).receivedAtTick,receivedTick);
assert.equal(view(master,claimId).receivedAtTick,claim.issuedTick);
assert.equal(view(listener,claimId).sourcePersonId,master);
assert.equal(view(listener,claimId).certainty,'unverified');
assert.equal(view(master,claimId).certainty,'corroborated');
assert.equal(view(master,'claim:shen:direct').certainty,'unverified');
assert.equal(knownFactForObserver(state,listener,factId),false);
assert.equal(knownFactForObserver(state,stranger,factId),false);
assert.equal(state.claimsById[claimId].deliveryFactIds.length,1);

// A direct publication names its original observer; sharing that account does not share the underlying fact.
const direct=recordFactSR(state,'fact:qa:direct-publication',{kind:'observation',text:'旧桥水痕',sceneId:'scene:valley'});
const directClaim=publishFactSR(state,direct.id);
assert.equal(knownFactForObserver(state,master,direct.id),true);
assert.equal(knownFactForObserver(state,listener,direct.id),false);
assert.equal(knownFactForObserver(state,stranger,direct.id),false);
assert.equal(view(listener,directClaim.id),undefined);

// Precise coordinates remain in the save, but only a known supporting observation yields a coarse hint.
claim.locationHint={sceneId:'scene:valley',x:47,y:35,factId,observedTick:state.worldTick};
assert.deepEqual(view(master,claimId).locationHint,{sceneId:'scene:valley',observedTick:state.factsById[factId].atTick});
assert.equal(view(listener,claimId).locationHint,null);
assert(!JSON.stringify(view(master,claimId)).includes('"x"'));
assert(!JSON.stringify(view(master,claimId)).includes('"y"'));

// Public knowledge and explicit historical knowledge need not invent a personal delivery time.
const publicClaim=recordClaimSR(state,{id:'claim:qa:public-notice',public:true,recipients:[],text:'石桥告示',speakerId:master});
for(const personId of [master,listener,stranger])assert.equal(view(personId,publicClaim.id).receivedAtTick,null);
const knownClaim=recordClaimSR(state,{id:'claim:qa:known-only',public:false,recipients:[],knownByIds:[stranger],text:'已有来源的私下消息',speakerId:master});
assert.equal(view(stranger,knownClaim.id).receivedAtTick,null);
assert.equal(view(listener,knownClaim.id),undefined);
assert.equal(view(master,knownClaim.id),undefined);

const secretPerson='person:great:guiyuan:hidden';
const secretClaim=recordClaimSR(state,{id:'claim:qa:secret-speaker',text:'未署名消息',speakerId:secretPerson,recipients:[master],truthType:'author-secret'});
assert.equal(view(master,secretClaim.id).sourcePersonId,null);
assert(!JSON.stringify(view(master,secretClaim.id)).includes('truthType'));
const authorFact=recordFactSR(state,'fact:qa:author-private',{kind:'author-hidden',public:true,text:'内部作者真相'});
assert.equal(knownFactForObserver(state,master,authorFact.id),false);

state=validateSave(JSON.parse(JSON.stringify(state)));
const before=JSON.stringify(state),projection=knowledgeView(state,{observerId:listener});
assert.equal(JSON.stringify(state),before);
projection.find(c=>c.id===claimId).text='仅修改返回对象';
assert.equal(JSON.stringify(state),before);
assert.equal(knownFactForObserver(state,'person:missing',factId),false);
assert.equal(knownFactForObserver(state,listener,'fact:missing'),false);

const old=JSON.parse(JSON.stringify(state)),oldClaim=old.claimsById[claimId];
for(const id of oldClaim.deliveryFactIds)delete old.factsById[id];
for(const field of ['receiptFormatVersion','receiptOrigin','createdTick','initialRecipientIds','legacyRecipientIds','deliveryFactIds','receivedTickByPersonId'])delete oldClaim[field];
oldClaim.receivedAtTick=oldClaim.issuedTick;
const oldDirect=old.claimsById[directClaim.id];
for(const field of ['receiptFormatVersion','receiptOrigin','createdTick','initialRecipientIds','legacyRecipientIds','deliveryFactIds','receivedTickByPersonId'])delete oldDirect[field];
const oldRaw=JSON.stringify(old);state=validateSave(JSON.parse(oldRaw));
assert.equal(JSON.stringify(old),oldRaw);
assert.equal(view(master,claimId).receivedAtTick,null);
assert.equal(view(listener,claimId).receivedAtTick,null);
assert.equal(knownFactForObserver(state,master,factId),true);
assert.equal(knownFactForObserver(state,listener,factId),false);
assert.equal(knownFactForObserver(state,master,direct.id),true);
assert.equal(knownFactForObserver(state,listener,direct.id),false);

console.log(JSON.stringify({suite:'sr002-knowledge-projection',passed:5,cases:['actual observation and delayed private receipt','observer-specific fact and certainty','source-aware coarse location','public versus private and read-only projections','legacy unknown receipt time']},null,2));
