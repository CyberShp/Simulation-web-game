import assert from 'node:assert/strict';
import {initial,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {knowledgeView,knownFactForObserver} from '../dist/ea-sr-contracts.mjs';
import {recordClaimSR,viewSRWorld,divinationSR,shareClaimSR,tickSRWorld,validateSRWorld,travelSR,moveWorldSR,investigateSR,discoverSceneSR} from '../dist/ea-sr-world.mjs';
import {startCrisisSR} from '../dist/ea-sr-crises.mjs';

const MASTER='person:master',TARGET='person:lu-zhiwei',results=[];
function check(name,run){run();results.push(name);}
function fresh(){const s=initial({sr:true});s.master.realm=6;s.master.knowledge.qingyuan=40;s.master.energy=100;s.resources.food=100;s.resources.herb=100;s.resources.crystal=20;s.resources.jade=1000;return s;}
function advance(s,n=1){for(let i=0;i<n;i++)tick(s,.1);}
function advanceWorldOnly(s,n=1){for(let i=0;i<n;i++){s.worldTick++;tickSRWorld(s);}}
function finish(s){let ticks=0;while(s.srWorld.activeTravelId||s.srWorld.interaction){assert(ticks++<3000);advance(s);}return ticks;}

check('World messages use the observer projection and actual receipt time',()=>{
 const s=fresh(),factId='fact:qa:private-anchor';
 s.factsById[factId]={id:factId,kind:'observation',topic:'shao',personId:'person:shao-heng',sceneId:'scene:supply',text:'PRIVATE_EVIDENCE_TEXT'};
 advance(s,20);
 recordClaimSR(s,{id:'claim:qa:rumor',topic:'shao',text:'旧口信',observedTick:3,verification:'corroborated',truthType:'mistake',rootSourceId:'source:private-root',evidenceFactIds:[factId],locationHint:{sceneId:'scene:supply',x:1.25,y:2.5}});
 recordClaimSR(s,{id:'claim:qa:public',text:'坊市公示',public:true,recipients:[]});
 recordClaimSR(s,{id:'claim:qa:other',text:'OTHER_PRIVATE_TEXT',recipients:[TARGET]});
 const before=JSON.stringify(s),known=knowledgeView(s),world=viewSRWorld(s),rumor=world.messages.find(m=>m.id==='claim:qa:rumor');
 assert.deepEqual(world.messages.map(m=>m.id),known.map(m=>m.id));
 assert.equal(rumor.observedAtTick,3);assert.equal(rumor.receivedAtTick,20);
 assert.equal(rumor.certainty,'unverified');assert.equal(rumor.locationHint,null);
 assert.deepEqual(rumor.evidenceFactIds,[]);assert.equal(rumor.canShare,true);
 assert.equal(world.messages.find(m=>m.id==='claim:qa:public').canShare,false);
 assert(!world.messages.some(m=>m.id==='claim:qa:other'));
 for(const field of ['verification','rootSourceId','truthType'])assert(!Object.hasOwn(rumor,field));
 assert(!JSON.stringify(world).includes('PRIVATE_EVIDENCE_TEXT'));
 assert.equal(JSON.stringify(s),before);
 validateSave(JSON.parse(before));
});

check('An unacquired evidence ID cannot become a divination anchor',()=>{
 const s=fresh(),factId='fact:qa:unacquired';
 s.factsById[factId]={id:factId,kind:'observation',topic:'shao',personId:'person:shao-heng',text:'UNACQUIRED_ANCHOR_TEXT'};
 recordClaimSR(s,{id:'claim:qa:unacquired',topic:'shao',text:'听说有凭证',verification:'corroborated',evidenceFactIds:[factId]});
 assert.equal(knownFactForObserver(s,MASTER,factId),false);
 assert(!viewSRWorld(s).divinationAnchors.includes(factId));
 const before=JSON.stringify(s);
 assert.throws(()=>divinationSR(s,'person:shao-heng',factId),/实际取得的锚点/);
 assert.equal(JSON.stringify(s),before);
});

check('Historical messages retain an unknown individual receipt time',()=>{
 const s=fresh(),claim=recordClaimSR(s,{id:'claim:qa:legacy-receipt',text:'旧档见闻'});
 for(const key of ['receiptFormatVersion','receiptOrigin','createdTick','initialRecipientIds','legacyRecipientIds','deliveryFactIds','receivedTickByPersonId'])delete claim[key];
 const loaded=validateSave(JSON.parse(JSON.stringify(s)));
 assert.equal(viewSRWorld(loaded).messages.find(m=>m.id===claim.id).receivedAtTick,null);
});

check('Actual investigation retains a paid, timed divination anchor after reload',()=>{
 const s=fresh();discoverSceneSR(s,'scene:market');travelSR(s,'scene:market');finish(s);
 moveWorldSR(s,12.5,16);finish(s);investigateSR(s,'object:market:ledger');finish(s);
 const factId='fact:investigation:object:market:ledger',world=viewSRWorld(s);
 assert.equal(knownFactForObserver(s,MASTER,factId),true);
 assert.deepEqual(world.knownLocations['person:shao-heng'],{sceneId:'scene:supply',observedTick:s.investigationsById['investigation:object:market:ledger'].startedTick});
 assert(world.divinationAnchors.includes(factId));
 assert(world.divination.anchorOptions.some(a=>a.factId===factId));
 const loaded=validateSave(JSON.parse(JSON.stringify(s))),before=loaded.stockpilesById['stockpile:sr-party'].resources.herb;
 divinationSR(loaded,'person:shao-heng',factId);
 assert.equal(loaded.srWorld.interaction.kind,'divine');assert.equal(loaded.stockpilesById['stockpile:sr-party'].resources.herb,before-3);
 advance(loaded,60);assert(loaded.factsById[`fact:divination:person:shao-heng:${factId}:revision:0`]);
 validateSave(JSON.parse(JSON.stringify(loaded)));
});

check('A received retelling does not certify the recipient belief',()=>{
 const s=fresh(),factId='fact:qa:master-observation';
 s.factsById[factId]={id:factId,kind:'observation',topic:'route',observerId:MASTER,text:'亲眼见到的路况'};
 const claim=recordClaimSR(s,{id:'claim:qa:master-observation',topic:'route',text:'这条路可通',verification:'corroborated',evidenceFactIds:[factId]});
 assert.equal(knownFactForObserver(s,MASTER,factId),true);
 assert.equal(knownFactForObserver(s,TARGET,factId),false);
 shareClaimSR(s,claim.id,TARGET);advanceWorldOnly(s,50);
 assert(claim.recipients.includes(TARGET));
 assert.equal(s.personsById[TARGET].beliefs.route.confidence,'uncertain');
 assert.equal(knowledgeView(s,{observerId:TARGET}).find(c=>c.id===claim.id).certainty,'unverified');
 assert.equal(claim.receivedTickByPersonId[TARGET],s.worldTick);
 validateSRWorld(JSON.parse(JSON.stringify(s)));
});

check('Historical location projection contains only supported coarse places',()=>{
 const s=fresh();
 s.srWorld.knownLocations['person:han-lichuan'].x=44.5;
 s.srWorld.knownLocations['person:han-lichuan'].y=10;
 s.srWorld.knownLocations['person:xing-lie']={sceneId:'scene:ward',observedTick:s.worldTick,sourceId:'source:private',x:12,y:13};
 const before=JSON.stringify(s),locations=viewSRWorld(s).knownLocations;
 assert.deepEqual(locations['person:han-lichuan'],{sceneId:'scene:qixia',observedTick:s.worldTick});
 assert.equal(locations['person:xing-lie'],undefined);
 assert.equal(JSON.stringify(s),before);
});

check('A delivered late report retains its old scene and observation time',()=>{
 const s=fresh(),crisis=startCrisisSR(s,{id:'crisis:sr:qa-delayed',personId:'person:su-yelan',durationTicks:900,messageDelayTicks:5});
 advance(s,5);
 const message=viewSRWorld(s).messages.find(m=>m.id===`claim:crisis:${crisis.id}`);
 assert.equal(message.observedAtTick,0);assert.equal(message.receivedAtTick,5);
 assert.deepEqual(viewSRWorld(s).knownLocations[crisis.personId],{sceneId:'scene:valley',observedTick:0});
 validateSave(JSON.parse(JSON.stringify(s)));
});

console.log(JSON.stringify({suite:'sr002-world-knowledge',passed:results.length,cases:results},null,2));
