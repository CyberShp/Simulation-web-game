import assert from 'node:assert/strict';
import {initial,dispatchCommand,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {knowledgeView} from '../dist/ea-sr-contracts.mjs';
import {discoverSceneSR,recordFactSR,publishFactSR,validateSRWorld} from '../dist/ea-sr-world.mjs';

let state=initial({sr:true});
const fact=recordFactSR(state,'fact:qa:receipt',{kind:'observation',text:'旧路口有积水',observedTick:state.worldTick});
const claim=publishFactSR(state,fact.id);
const recipientId='person:qing-luo';
assert.equal(claim.receivedTickByPersonId['person:master'],0);
assert.equal(knowledgeView(state).find(c=>c.id===claim.id).receivedAtTick,0);
assert(!knowledgeView(state,{observerId:recipientId}).some(c=>c.id===claim.id));

let serial=0;
function command(action,payload={}){
 const result=dispatchCommand(state,{name:'srWorldCommand',args:[{action,...payload}],id:`command:qa-receipt:${++serial}`});
 assert.equal(result.status,'committed',result.message);
 state=result.state;
}
function finishActivity(){
 let steps=0;
 while(state.srWorld.activeTravelId||state.srWorld.interaction){assert(steps++<1000);tick(state,.1);}
}
command('travel',{destination:'scene:valley'});
finishActivity();
command('move',{x:42,y:24});
finishActivity();
const issuedTick=state.claimsById[claim.id].issuedTick;
command('share',{claimId:claim.id,recipientId});
for(let i=0;i<49;i++)tick(state,.1);
assert(!state.claimsById[claim.id].recipients.includes(recipientId));
assert(!knowledgeView(state,{observerId:recipientId}).some(c=>c.id===claim.id));
state=validateSave(JSON.parse(JSON.stringify(state)));
tick(state,.1);
const delivered=state.claimsById[claim.id];
const receivedTick=state.worldTick;
assert(receivedTick>issuedTick);
assert.equal(delivered.receivedTickByPersonId[recipientId],receivedTick);
assert.equal(delivered.receivedTickByPersonId['person:master'],issuedTick);
assert.equal(knowledgeView(state,{observerId:recipientId}).find(c=>c.id===claim.id).receivedAtTick,receivedTick);
const beforeQuery=JSON.stringify(state);
knowledgeView(state,{observerId:recipientId});
assert.equal(JSON.stringify(state),beforeQuery);
state=validateSave(JSON.parse(JSON.stringify(state)));
assert.equal(state.claimsById[claim.id].receivedTickByPersonId[recipientId],receivedTick);
assert.equal(knowledgeView(state,{observerId:recipientId}).find(c=>c.id===claim.id).receivedAtTick,receivedTick);
command('share',{claimId:claim.id,recipientId});
assert.equal(state.claimsById[claim.id].receivedTickByPersonId[recipientId],receivedTick);
validateSRWorld(state);

// Historical saves retain visibility but cannot reconstruct an individual receipt time.
const legacy=JSON.parse(JSON.stringify(state));
const base=legacy.claimsById[claim.id];
for(const factId of base.deliveryFactIds)delete legacy.factsById[factId];
for(const field of ['receiptFormatVersion','receiptOrigin','createdTick','initialRecipientIds','legacyRecipientIds','deliveryFactIds','receivedTickByPersonId'])delete base[field];
base.receivedAtTick=base.issuedTick;
legacy.claimsById['claim:qa:public']={...structuredClone(base),id:'claim:qa:public',public:true,recipients:[],receivedAtTick:base.issuedTick};
legacy.claimsById['claim:qa:known']={...structuredClone(base),id:'claim:qa:known',public:false,recipients:[],knownByIds:[recipientId],receivedAtTick:base.issuedTick};
const originalRaw=JSON.stringify(legacy);
const loaded=validateSave(JSON.parse(originalRaw));
assert.equal(JSON.stringify(legacy),originalRaw);
for(const id of [claim.id,'claim:qa:public','claim:qa:known']){
 assert.equal(knowledgeView(loaded,{observerId:recipientId}).find(c=>c.id===id).receivedAtTick,null);
}
assert.equal(loaded.claimsById[claim.id].receivedTickByPersonId,undefined);
assert.equal(loaded.claimsById['claim:qa:public'].receivedTickByPersonId,undefined);
assert.equal(loaded.claimsById['claim:qa:known'].receivedTickByPersonId,undefined);

const oldClaimId='claim:qa:legacy-share';
loaded.claimsById[oldClaimId]={...structuredClone(base),id:oldClaimId,public:false,recipients:['person:master']};
const legacyShare=dispatchCommand(loaded,{name:'srWorldCommand',args:[{action:'share',claimId:oldClaimId,recipientId}],id:'command:qa-receipt:legacy-share'});
assert.equal(legacyShare.status,'committed',legacyShare.message);
let legacyShared=legacyShare.state;
for(let i=0;i<50;i++)tick(legacyShared,.1);
const oldDelivered=legacyShared.claimsById[oldClaimId];
assert.equal(oldDelivered.receivedTickByPersonId['person:master'],undefined);
assert.equal(oldDelivered.receivedTickByPersonId[recipientId],legacyShared.worldTick);
assert.equal(knowledgeView(legacyShared).find(c=>c.id===oldClaimId).receivedAtTick,null);
assert.equal(knowledgeView(legacyShared,{observerId:recipientId}).find(c=>c.id===oldClaimId).receivedAtTick,legacyShared.worldTick);
legacyShared=validateSave(JSON.parse(JSON.stringify(legacyShared)));
assert.equal(legacyShared.claimsById[oldClaimId].receivedTickByPersonId[recipientId],legacyShared.worldTick);

let offerState=initial({sr:true});
discoverSceneSR(offerState,'scene:market');
const travel=dispatchCommand(offerState,{name:'srWorldCommand',args:[{action:'travel',destination:'scene:market'}],id:'command:qa-receipt:market'});
assert.equal(travel.status,'committed',travel.message);
offerState=travel.state;
let travelSteps=0;
while(offerState.srWorld.activeTravelId){assert(travelSteps++<1000);tick(offerState,.1);}
tick(offerState,.1);
const offer=Object.values(offerState.claimsById).find(c=>c.id.startsWith('claim:offer:'));
assert(offer);
assert.equal(offer.receivedTickByPersonId['person:master'],offerState.worldTick);
assert.equal(offer.createdTick,offerState.worldTick);
validateSave(JSON.parse(JSON.stringify(offerState)));

const bad=JSON.parse(JSON.stringify(state));
bad.claimsById[claim.id].receivedTickByPersonId[recipientId]=bad.worldTick+1;
assert.throws(()=>validateSave(bad),/消息送达时间/);
const lateInitial=JSON.parse(JSON.stringify(state));
lateInitial.claimsById[claim.id].receivedTickByPersonId['person:master']=10;
assert.throws(()=>validateSave(lateInitial),/消息送达时间/);
const missing=JSON.parse(JSON.stringify(state));
missing.claimsById[claim.id].receivedTickByPersonId={};
assert.throws(()=>validateSave(missing),/消息送达时间/);
const shiftedDelivery=JSON.parse(JSON.stringify(state));
shiftedDelivery.claimsById[claim.id].receivedTickByPersonId[recipientId]=receivedTick-1;
assert.throws(()=>validateSave(shiftedDelivery),/消息送达时间/);
const missingWhole=JSON.parse(JSON.stringify(state));
delete missingWhole.claimsById[claim.id].receivedTickByPersonId;
assert.throws(()=>validateSave(missingWhole),/消息送达时间/);
console.log(JSON.stringify({suite:'sr002-receipt-time',passed:5,issuedTick,receivedTick,cases:['public-command delayed delivery and read-only view','legacy recipient/public/known visibility after reload','legacy claim receives a new timed delivery without backfilling old recipients','world-content offer uses the same receipt format','tampered receipt rejected']},null,2));
