/** SR015/021/022/023/039 independent public travel, cargo and crisis acceptance.
 * Fresh paths never inject stock, realm, weather or clock. The distant transport
 * case uses the unchanged legal v5 completed acceptance fixture through upgrade.
 * Produces no dumps, images, registry changes or released game artifacts. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';
const HOME='scene:yunxiu-courtyard',MASTER='person:master',results=[];
function test(name,fn){try{results.push({name,passed:true,...fn()});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name+'\n'+e.stack);}}
function fresh(){const h=harness();h.act('masterAction','heal');h.until(s=>s.master.wound===0,'opening healing');h.act('advanceStory');return h;}
const cargoTotal=s=>Object.fromEntries(Object.keys(S.RESOURCES).map(k=>[k,Object.values(s.stockpilesById).reduce((n,st)=>n+(st.resources[k]||0),0)]));
function advance(h,ticks){const start=h.s.worldTick;for(let i=0;i<ticks;i++)S.tick(h.s,.1);assert.equal(h.s.worldTick,start+ticks);}
const wait=h=>h.until(s=>!s.srWorld.activeTravelId&&!s.srWorld.interaction&&!s.srCrises.activeTreatment,'travel/body completion',8000);

test('fresh public partial outbound / repeated return / repeated reload keeps real distance',()=>{
 const h=fresh(),before=cargoTotal(h.s),origin=structuredClone(h.s.master.position);
 const t=h.act('srWorldCommand',{action:'travel',destination:'scene:valley'});const now=cargoTotal(h.s);
 for(const k of Object.keys(before))assert(Math.abs(now[k]-(before[k]-(t.cost[k]||0)))<1e-8,'immediate travel cargo conservation '+k);
 advance(h,40);h.save();h.act('srWorldCommand',{action:'return'});assert.equal(h.s.travelsById[t.id].durationTicks,40);
 advance(h,10);h.save();const duration=h.s.travelsById[t.id].durationTicks,progress=h.s.travelsById[t.id].progressTicks;
 h.act('srWorldCommand',{action:'return'});assert.equal(h.s.travelsById[t.id].durationTicks,duration);assert.equal(h.s.travelsById[t.id].progressTicks,progress);
 advance(h,29);h.save();assert.equal(h.s.master.position.kind,'worldTravel');advance(h,1);assert.equal(h.s.master.position.sceneId,HOME);assert.equal(h.s.master.position.x,origin.x);assert.equal(h.s.master.position.y,origin.y);h.save();
 assert.equal(h.s.stockpilesById['stockpile:sr-party'].position.sceneId,HOME);return {setup:'fresh initial, normal healing and public commands only',...h.counts,returnDuration:40};
});

test('fresh physical local investigation / return to exact distant feet / paused single clock stays unchanged',()=>{
 const h=fresh();h.until(s=>s.srWorld.knownScenes.includes('scene:market'),'ordinary place knowledge');h.travel('scene:market');h.worldWalk(12.5,16);
 h.act('srWorldCommand',{action:'investigate',sourceId:'object:market:ledger'});advance(h,10);h.act('srWorldCommand',{action:'cancel'});h.save();
 const origin=structuredClone(h.s.master.position),out=h.act('srWorldCommand',{action:'travel',destination:'scene:valley'});advance(h,20);h.save();h.act('srWorldCommand',{action:'return'});wait(h);h.save();
 assert.deepEqual(h.s.master.position,origin);assert.deepEqual(h.s.stockpilesById['stockpile:sr-party'].position,{sceneId:origin.sceneId,x:origin.x,y:origin.y});
 assert.equal(h.s.travelsById[out.id].returning,true);h.act('setSpeed',0);const serialized=JSON.stringify(h.s);for(let i=0;i<10;i++){S.tick(h.s,100);S.viewSRWorld(h.s);S.viewSRCrises(h.s);}assert.equal(JSON.stringify(h.s),serialized);h.save();
 const invalid=JSON.parse(JSON.stringify(h.s));invalid.travelsById[out.id].originPositions[MASTER].sceneId='scene:qixia';assert.throws(()=>S.validateSave(invalid),/原出发位置/);
 return {setup:'fresh initial, ordinary place discovery and public movement/investigation only',...h.counts};
});

test('public earned partial return encoded in old SR fields / reload keeps return progress',()=>{
 const h=fresh(),t=h.act('srWorldCommand',{action:'travel',destination:'scene:valley'});advance(h,30);h.act('srWorldCommand',{action:'return'});advance(h,5);
 // An explicit serialization compatibility fixture removes only newly introduced metadata, never assets or progress.
 const old=JSON.parse(JSON.stringify(h.s));delete old.travelsById[t.id].returning;delete old.travelsById[t.id].originPositions;const q=harness(S.validateSave(old));
 assert.equal(q.s.travelsById[t.id].returning,true);q.act('srWorldCommand',{action:'return'});assert.equal(q.s.travelsById[t.id].durationTicks,30);assert.equal(q.s.travelsById[t.id].progressTicks,5);q.save();advance(q,24);assert.equal(q.s.master.position.kind,'worldTravel');advance(q,1);assert.equal(q.s.master.position.sceneId,HOME);q.save();
 return {setup:'explicit old field-shape compatibility fixture from unchanged public earned partial return',...q.counts};
});

test('fresh explicit invalid cargo refuses atomically without paying or moving',()=>{
 const h=fresh();for(const cargo of [{wood:100000},{food:-1},{jade:Infinity}]){const before=JSON.stringify(h.s);assert.throws(()=>h.act('srWorldCommand',{action:'travel',destination:'scene:valley',cargo}));assert.equal(JSON.stringify(h.s),before);}return {setup:'fresh initial, public rejection only',...h.counts};
});

test('normal opening / two willing companions / unique equipment / offsite inventory / real return',()=>{
 const h=normalOpening(),companions=[...h.s.homeMemberIds];assert.equal(companions.length,2);h.rest();
 const sword=Object.values(h.s.itemsById).find(i=>i.definitionId==='equipment:iron-sword'&&i.ownerId===MASTER);
 const equip=h.act('equipItem',sword.id,'weapon');h.until(s=>s.srEquipment.orders[equip.orderId].phase==='completed','actual equip');h.save();
 const stable=Object.fromEntries([MASTER,...companions].map(id=>[id,JSON.stringify(h.s.personsById[id].appearance)]));
 const before=cargoTotal(h.s),departureTick=h.s.worldTick,t=h.act('srWorldCommand',{action:'travel',destination:'scene:valley',companions});
 for(const k of Object.keys(before))assert(Math.abs(cargoTotal(h.s)[k]-(before[k]-(t.cost[k]||0)))<1e-8,'two-person immediate inventory conservation '+k);
 for(const id of t.participantIds)assert.deepEqual(h.s.personsById[id].position,{kind:'worldTravel',travelId:t.id});
 advance(h,30);h.save();for(const id of companions){assert.equal(h.s.personsById[id].position.kind,'worldTravel');assert(!h.s.activitiesById[h.s.personsById[id].activityId]||['travel','sr-travel'].includes(h.s.activitiesById[h.s.personsById[id].activityId].kind));}
 wait(h);h.save();for(const id of t.participantIds){assert.equal(h.s.personsById[id].position.sceneId,'scene:valley');assert.equal(JSON.stringify(h.s.personsById[id].appearance),stable[id]);}
 const localStocks=Object.values(h.s.stockpilesById).filter(st=>st.id.startsWith('stockpile:carried:')&&st.carrierId&&t.participantIds.includes(st.carrierId));for(const st of localStocks)assert.equal(h.s.personsById[st.carrierId].location.sceneId,'scene:valley');
 const equipped=h.s.itemsById[sword.id];assert.deepEqual(equipped.location,{kind:'person',id:MASTER,slot:'weapon'});assert.equal(equipped.ownerId,MASTER);
 h.worldWalk(11.5,16);assert.deepEqual(h.s.stockpilesById['stockpile:sr-party'].position,{sceneId:'scene:valley',x:h.s.master.position.x,y:h.s.master.position.y});
 const partyBefore=h.s.stockpilesById['stockpile:sr-party'].resources.herb;h.act('srWorldCommand',{action:'interact',objectId:'object:valley:herbs',choice:'gather'});wait(h);assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.herb,partyBefore+6);
 for(const fact of Object.values(h.s.factsById).filter(f=>f.atTick>=departureTick&&f.kind==='inventory-transaction'&&f.operation==='production'))assert(!fact.participantIds.some(id=>companions.includes(id)),'offsite companions cannot simultaneously produce in the courtyard');
 const returnCost=S.travelPreviewSR(h.s,HOME).cost,party=structuredClone(h.s.stockpilesById['stockpile:sr-party'].resources);h.act('srWorldCommand',{action:'return',companions});h.save();wait(h);h.save();
 for(const id of t.participantIds){assert.equal(h.s.personsById[id].position.sceneId,HOME);assert.equal(h.s.personsById[id].mind?.away??null,null);}
 for(const k of Object.keys(party))assert(Math.abs(h.s.stockpilesById['stockpile:sr-party'].resources[k]-(party[k]-(returnCost[k]||0)))<1e-8,'return cargo retained '+k);
 assert.equal(h.s.itemsById[sword.id].location.slot,'weapon');assert.equal(Object.values(h.s.itemsById).filter(i=>i.id===sword.id).length,1);return {setup:'normal initial opening and earned two members, no injections',...h.counts,participantIds:t.participantIds};
});

test('natural rain delayed message / cannot treat remotely / actual arrival / interrupted and resumed treatment',()=>{
 const h=fresh();h.until(s=>s.weatherByRegionId['region:yunxiu'].phase==='rain','natural rain',3600);h.act('srStoryCommand',{action:'activateRainChain'});h.until(s=>S.viewSRCrises(s).known.length>0,'actual delayed message',300);
 const cid='crisis:rain:su-yelan',before=JSON.stringify(h.s);assert.throws(()=>h.act('srCrisisCommand',{action:'treat',crisisId:cid}),/身边/);assert.equal(JSON.stringify(h.s),before);
 h.travel('scene:valley');h.worldWalk(47,35);h.act('srCrisisCommand',{action:'search',crisisId:cid});
 const herbs=h.s.stockpilesById['stockpile:sr-party'].resources.herb;h.act('srCrisisCommand',{action:'treat',crisisId:cid});advance(h,30);h.save();h.act('srCrisisCommand',{action:'cancel'});assert.equal(h.s.crisesById[cid].outcome,null);assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.herb,herbs-8);
 // Second treatment consumes a second actual dose. Obtain it from the known in-scene plant through public gathering.
 h.worldWalk(11.5,16);h.act('srWorldCommand',{action:'interact',objectId:'object:valley:herbs',choice:'gather'});wait(h);h.worldWalk(47,35);
 const secondBefore=h.s.stockpilesById['stockpile:sr-party'].resources.herb;assert(secondBefore>=8);h.act('srCrisisCommand',{action:'treat',crisisId:cid});assert.equal(h.s.stockpilesById['stockpile:sr-party'].resources.herb,secondBefore-8);h.save();
 const start=h.s.worldTick;advance(h,79);assert.equal(h.s.crisesById[cid].outcome,null);advance(h,1);assert.equal(h.s.worldTick,start+80);assert.equal(h.s.crisesById[cid].outcome,'rescued');assert.equal(h.s.personsById['person:su-yelan'].lifeStatus,'alive');h.save();return {setup:'fresh initial, natural weather, physical gathering for second dose',...h.counts,treatmentTicks:80};
});

test('actual legal completed v5 upgrade / waiting cancellation keeps exact feet and releases ticket / paid reverse port',()=>{
 const raw=JSON.parse(readFileSync(new URL('./acceptance-1.4.2/legacy-full.json',import.meta.url),'utf8'));const original=JSON.stringify(raw),h=harness(S.validateSave(raw.state??raw,{upgrade:true}));assert.equal(JSON.stringify(raw),original);h.act('setSpeed',1);
 h.travel('scene:market',{cargo:{jade:180,food:60,herb:20,wood:20,stone:20,crystal:20}});h.worldWalk(13,32);h.act('srWorldCommand',{action:'interact',objectId:'object:market:notice',choice:'studyMap'});wait(h);h.travel('scene:qingheng-capital');
 const feet=structuredClone(h.s.master.position),t=h.act('srWorldCommand',{action:'travel',destination:'scene:zhongtian-harbor'});assert.equal(t.waitingAtOrigin,true);const ticketId=t.ticketIds[0],departureId=h.s.srTransport.tickets[ticketId].departureId,cashId=h.s.srTransport.tickets[ticketId].operatorStockpileId;
 advance(h,Math.min(5,t.waitTicks-1));h.save();const bag=structuredClone(h.s.stockpilesById['stockpile:sr-party'].position),cash=h.s.stockpilesById[cashId].resources.jade,tick=h.s.worldTick;
 const request={name:'srWorldCommand',args:[{action:'return'}],id:`command:${h.s.transactions.nextCommandId}`,expectedRevision:h.s.revision},r=S.dispatchCommand(h.s,request),q=harness(r.state);
 assert.equal(q.s.worldTick,tick);assert.deepEqual(q.s.master.position,feet);assert.deepEqual(q.s.stockpilesById['stockpile:sr-party'].position,bag);assert.equal(q.s.srWorld.activeTravelId,null);assert.equal(q.s.srTransport.tickets[ticketId].status,'cancelled');assert.equal(q.s.srTransport.departures[departureId].reservedSeats,0);assert.equal(q.s.stockpilesById[cashId].resources.jade,cash);
 assert.equal(S.dispatchCommand(q.s,request).status,'already-applied');q.save();
 const next=q.act('srWorldCommand',{action:'travel',destination:'scene:zhongtian-harbor'});q.until(s=>s.master.position.kind==='worldTravel','actual boarding');q.save();const inTransit=JSON.stringify(q.s);assert.throws(()=>q.act('srWorldCommand',{action:'return'}),/先实际抵达/);assert.equal(JSON.stringify(q.s),inTransit);wait(q);q.save();assert.equal(q.s.master.position.sceneId,'scene:zhongtian-harbor');
 const source=q.s.stockpilesById['stockpile:operator:route:airship-zhongtian'],wood=source.resources.wood,back=q.act('srWorldCommand',{action:'travel',destination:'scene:qingheng-capital'}),reverse=q.s.srTransport.tickets[back.ticketIds[0]],d=q.s.srTransport.departures[reverse.departureId];assert.equal(d.commercialSeats,0);assert.equal(source.resources.wood,wood);assert.equal(q.s.stockpilesById[reverse.operatorStockpileId].position.sceneId,'scene:zhongtian-harbor');wait(q);q.save();assert.equal(q.s.master.position.sceneId,'scene:qingheng-capital');assert.equal(q.s.srTransport.tickets[reverse.id].status,'used');return {setup:'explicit unchanged legal completed v5 fixture, not a fresh progression claim',fixture:'qa/acceptance-1.4.2/legacy-full.json',...q.counts,commands:h.counts.commands+q.counts.commands+1,saves:h.counts.saves+q.counts.saves};
});
const report={suite:'sr-travel-continuity-public',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,notProven:['fresh normal end-to-end distant transport progression','physical multileg intermediate-port scenes','all SR acceptance closure','browser/touch/real device/FPS']};console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
