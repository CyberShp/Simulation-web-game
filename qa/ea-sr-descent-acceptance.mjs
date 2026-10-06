/** SR-XF-039-AC-03 explicit high-realm boundary fixtures, not a natural high-tier playthrough.
 * Legal legacy-completed migration provides the ending; realm, array knowledge, arrival and
 * party budget are explicitly arranged for component acceptance. Actual descent/paths/hazards
 * run the production module. No screenshots, process files or state dumps are written.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import * as Legacy from '../dist/ea-sim.mjs';
import * as D from '../dist/ea-sr-descent.mjs';
import {releaseBodyActivity} from '../dist/ea-facility-activities.mjs';
const ORIGIN='scene:immortal-origin',SITE='scene:immortal-descent-outpost',ENVOY='person:immortal:yunhe-envoy';
const cases=[];
function test(name,fn){if(process.argv[2]&&!name.includes(process.argv[2]))return;fn();cases.push(name);console.log('PASS '+name);}
function fixture(mode='avatar'){
 const source=JSON.parse(readFileSync(new URL('./acceptance-1.4.2/legacy-full.json',import.meta.url),'utf8'));
 const legal=Legacy.validateSave(source.state??source);const s=S.validateSave(legal,{upgrade:true});D.initDescentSR(s);
 releaseBodyActivity(s,s.master);s.speed=1;s.master.realm=mode==='avatar'?13:22;s.master.xp=0;s.master.wound=0;s.master.energy=100;s.master.journey={kind:'sr',routeId:SITE,status:'exploring',remaining:0,total:1};s.world.exploration=null;
 s.master.knowledge.array=70;s.master.artsById.array={artId:'array',understanding:70,mastery:50};
 s.master.position={kind:'scene',sceneId:SITE,x:28.3,y:24};s.srWorld.localSceneId=SITE;
 if(!s.srWorld.knownScenes.includes(SITE))s.srWorld.knownScenes.push(SITE);
 s.stockpilesById['stockpile:sr-party']={id:'stockpile:sr-party',ownerId:'person:master',access:'private',capacity:400,position:{sceneId:SITE,x:28.3,y:24},resources:{...Object.fromEntries(Object.keys(s.resources).map(k=>[k,0])),jade:280,crystal:60,herb:35,stone:20}};
 return s;
}
function step(s,n){for(let i=0;i<n;i++)S.tick(s,.1);}
function until(s,predicate,label,max=2000){for(let n=0;n<max&&!predicate();n++)step(s,1);assert(predicate(),label);}
function differences(a,b,path='state',out=[]){if(out.length>=8||a===b)return out;if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(path+': '+JSON.stringify(a)+' -> '+JSON.stringify(b));return out;}for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'.'+k,out);return out;}
function reload(s){const original=JSON.parse(JSON.stringify(s));const loaded=S.validateSave(copy(original));D.validateDescentSR(loaded);const diff=differences(original,JSON.parse(JSON.stringify(loaded)));assert.equal(diff.length,0,'load does not move bodies, restore spent stock, advance time or change outcomes: '+diff.join('; '));return loaded;}
function begin(s,mode='avatar'){const r=D.requestDescent(s,mode,true);assert.equal(r.accepted,true);return s.srDescent.records[r.descentId];}
function arrive(s,mode='avatar'){const r=begin(s,mode),d=D.DESCENT_MODES[mode];step(s,d.channelTicks+d.transitTicks);assert.equal(r.phase,'present');return r;}
const party=s=>s.stockpilesById['stockpile:sr-party'].resources;
function rejectUnchanged(s,fn,pattern){const before=JSON.stringify(s);assert.throws(fn,pattern);assert.equal(JSON.stringify(s),before);}

test('modes have separate realm/array admission, informed consent and actual lower anchor',()=>{
 const s=fixture();rejectUnchanged(s,()=>D.requestDescent(s,'avatar',false),/知情/);
 s.master.realm=12;rejectUnchanged(s,()=>D.requestDescent(s,'avatar',true),/境界/);
 s.master.realm=13;rejectUnchanged(s,()=>D.requestDescent(s,'original',true),/境界/);
 s.master.artsById.array.understanding=39;rejectUnchanged(s,()=>D.requestDescent(s,'avatar',true),/阵术/);
 s.master.artsById.array.understanding=70;s.master.position.sceneId='scene:otherworld-outpost';
 rejectUnchanged(s,()=>D.requestDescent(s,'avatar',true),/独立下界前哨/);
 assert.notEqual(S.WORLD_SCENES[ORIGIN].worldId,S.WORLD_SCENES['scene:otherworld-outpost'].worldId);
});
test('upper sender can refuse; budget and actor identity are conserved',()=>{
 const s=fixture();s.personsById[ENVOY].descentConsent.avatarAllowed=false;
 const before=JSON.stringify(s),r=D.requestDescent(s,'avatar',true);
 assert.equal(r.accepted,false);assert.equal(JSON.stringify(s),before);
 s.personsById[ENVOY].descentConsent.avatarAllowed=true;s.stockpilesById['stockpile:immortal:yunhe-reserve'].resources.crystal=0;
 const next=JSON.stringify(s);assert.equal(D.requestDescent(s,'avatar',true).accepted,false);assert.equal(JSON.stringify(s),next);
});
test('pause, readonly UI and same tick never advance or double spend a channel',()=>{
 const s=fixture(),r=begin(s),p=copy(s.master.position);step(s,50);s.speed=0;
 const before=JSON.stringify(s);D.tickDescentSR(s);S.tick(s,100);D.viewDescentSR(s);
 assert.equal(JSON.stringify(s),before);s.speed=1;step(s,1);const after=JSON.stringify(s);D.tickDescentSR(s);assert.equal(JSON.stringify(s),after);assert.equal(r.progressTicks,51);assert.deepEqual(s.master.position,p);reload(s);
});
function copy(v){return structuredClone(v);}
test('half-complete cancellation consumes actual half and leaves unused budgets at the lower anchor once',()=>{
 let s=fixture();const before=copy(party(s)),upper=copy(s.stockpilesById['stockpile:immortal:yunhe-reserve'].resources),r=begin(s);step(s,80);
 const result=D.descentCommand(s,{action:'cancel',descentId:r.id});assert.equal(result.refundedFraction,.5);assert.equal(r.returnAllocation.phase,'refunded');
 const crate=s.stockpilesById[r.recoveryStockpileId];assert.equal(crate.position.sceneId,SITE);assert.equal(crate.resources.jade,40);assert.equal(crate.resources.crystal,10);assert.equal(crate.resources.herb,4);
 assert.equal(party(s).jade,before.jade-80,'cancel does not teleport retained materials into moved party stock');
 assert.equal(s.stockpilesById['stockpile:immortal:yunhe-reserve'].resources.crystal,upper.crystal-3);
 s=reload(s);rejectUnchanged(s,()=>D.descentCommand(s,{action:'cancel',descentId:r.id}),/已发生/);
 D.descentCommand(s,{action:'recover',descentId:r.id});assert.equal(party(s).jade,before.jade-40);assert.equal(party(s).crystal,before.crystal-6);assert.equal(party(s).herb,before.herb-4);
 assert.equal(D.descentCommand(s,{action:'recover',descentId:r.id}).recovered,false);reload(s);
});
test('avatar travels/stabilizes/returns with limited local power, keeps the upper body and master separate across saves',()=>{
 let s=fixture(),origin=copy(s.personsById[ENVOY].position),master=copy(s.master.position),stock=copy(party(s)),r=begin(s);
 step(s,159);assert.equal(r.actorPersonId,null);s=reload(s);r=s.srDescent.records[r.id];step(s,1);assert.equal(r.phase,'descending');assert.equal(s.personsById[r.actorPersonId].position.kind,'worldTravel');
 step(s,79);assert.equal(r.phase,'descending');step(s,1);assert.equal(r.phase,'present');assert.notEqual(r.actorPersonId,ENVOY);assert.equal(s.personsById[r.actorPersonId].originPersonId,ENVOY);
 assert.deepEqual(s.personsById[ENVOY].position,origin);assert.deepEqual(s.master.position,master);assert.equal(D.descentEffectiveRealmSR(s,s.personsById[r.actorPersonId]),13);
 assert.equal(party(s).jade,stock.jade-80);assert.equal(party(s).crystal,stock.crystal-16);
 D.descentCommand(s,{action:'aid',descentId:r.id,informed:true});step(s,80);assert.equal(r.aid.phase,'walking');s=reload(s);r=s.srDescent.records[r.id];
 until(s,()=>r.aid.progressTicks===60,'avatar actual half-maintenance');assert.equal(s.srDescent.rift.pressure,18,'avatar fixed lower power suppresses only half the pressure in 60 actual work ticks');
 until(s,()=>r.phase==='returned','bounded real-world-step avatar return');assert.equal(r.aid.progressTicks,120);assert.equal(r.aid.effectiveRealm,13);assert.equal(r.returnAllocation.phase,'consumed');assert.equal(r.returnPayments.length,1);
 assert.equal(s.personsById[r.actorPersonId].position.sceneId,ORIGIN);assert.deepEqual(s.personsById[ENVOY].position,origin);assert.deepEqual(s.master.position,master);assert.equal(party(s).crystal,stock.crystal-19);
 assert.equal(s.srDescent.rift.status,'stabilized');s=reload(s);const raw=JSON.stringify(s);D.viewDescentSR(s);assert.equal(JSON.stringify(s),raw);
});
test('offsite projection retains last observation, cannot disclose current position or send free remote rescue',()=>{
 const s=fixture(),r=arrive(s);D.descentCommand(s,{action:'aid',descentId:r.id,informed:true});step(s,20);const old=copy(D.viewDescentSR(s).active[0]);
 s.master.position={kind:'scene',sceneId:'scene:valley',x:12,y:27};step(s,100);const now=D.viewDescentSR(s).active[0];assert.equal(now.observedTick,old.observedTick);assert.deepEqual(now.position,old.position);assert.equal(now.hp,old.hp);
 rejectUnchanged(s,()=>D.returnDescent(s,r.id,true),/实际走近/);rejectUnchanged(s,()=>D.descentCommand(s,{action:'aid',descentId:r.id,informed:true}),/实际走近/);
 assert.equal(s.personsById[r.actorPersonId].position.sceneId,SITE);assert.equal(s.personsById[ENVOY].position.sceneId,ORIGIN);
});
test('original descends as one persistent upper person, retains realm/knowledge but has fixed effective realm and real paid return',()=>{
 let s=fixture('original'),realm=s.personsById[ENVOY].realm,knowledge=copy(s.personsById[ENVOY].mind.knowledge);s.personsById[ENVOY].hp=101;let r=arrive(s,'original');assert.equal(r.actorPersonId,ENVOY);assert.equal(s.personsById[ENVOY].position.sceneId,SITE);assert.equal(s.personsById[ENVOY].hp,101,'descent must not heal existing true-body damage');
 assert.equal(s.personsById[ENVOY].realm,realm);assert.equal(D.descentEffectiveRealmSR(s,s.personsById[ENVOY]),16);assert.deepEqual(s.personsById[ENVOY].mind.knowledge,knowledge);
 D.descentCommand(s,{action:'aid',descentId:r.id,informed:true});step(s,60);s=reload(s);r=s.srDescent.records[r.id];until(s,()=>r.aid.progressTicks===60,'original actual half-maintenance');assert.equal(s.srDescent.rift.pressure,0,'fixed higher local power contains danger sooner');until(s,()=>r.phase==='returned','original actual paid return');
 assert.equal(s.personsById[ENVOY].realm,realm);assert.deepEqual(s.personsById[ENVOY].mind.knowledge,knowledge);assert.equal(s.personsById[ENVOY].position.sceneId,ORIGIN);assert.equal(r.returnPayments.length,1);assert.equal(r.returnPayments[0].cost.crystal,10);assert.equal(D.descentEffectiveRealmSR(s,s.personsById[ENVOY]),realm);reload(s);
});
function actualTraps(s,r){const p=s.personsById[r.actorPersonId];for(let i=0;i<3;i++){const id=`descent-boundary-trap:${i}`;s.srCrises.traps[id]={id,status:'armed',sceneId:SITE,x:p.position.x,y:p.position.y};}}
test('avatar is actually killed by lower traps; upper soul/body feedback occurs once after 30 ticks and reload',()=>{
 let s=fixture(),r=arrive(s),origin=s.personsById[ENVOY],wound=origin.wound,energy=origin.energy;actualTraps(s,r);step(s,1);assert.equal(r.phase,'destroyed');assert.equal(s.personsById[r.actorPersonId].lifeStatus,'dead');assert.equal(origin.lifeStatus,'alive');assert.equal(origin.position.sceneId,ORIGIN);assert.equal(s.srCrises.traps['descent-boundary-trap:2'].status,'armed');assert.equal(origin.wound,wound);
 step(s,29);assert.equal(r.feedbackApplied,false);s=reload(s);r=s.srDescent.records[r.id];step(s,1);assert.equal(r.feedbackApplied,true);assert.equal(s.personsById[ENVOY].wound,wound+15);assert.equal(s.personsById[ENVOY].energy,energy-10);
 const after=copy(s.personsById[ENVOY]);step(s,100);assert.equal(s.personsById[ENVOY].energy,after.energy);assert.equal(s.personsById[ENVOY].wound,after.wound);assert.equal(s.personsById[r.actorPersonId].lifeStatus,'dead');reload(s);
});
test('original lower death is permanent, preserves one identity and cannot be re-created by init/reload',()=>{
 let s=fixture('original'),r=arrive(s,'original');actualTraps(s,r);step(s,1);assert.equal(r.phase,'dead');assert.equal(s.personsById[ENVOY].lifeStatus,'dead');assert(s.deathRecordsByPersonId[ENVOY]);const source=copy(s.personsById[ENVOY]);
 s=reload(s);D.initDescentSR(s);assert.equal(s.personsById[ENVOY].lifeStatus,'dead');assert.deepEqual(s.personsById[ENVOY].mind.knowledge,source.mind.knowledge);assert.equal(Object.keys(s.personsById).filter(id=>id===ENVOY).length,1);assert.equal(s.personsById[ENVOY].position.sceneId,SITE);assert.equal(s.srDescent.records[r.id].feedbackApplied,false);
});
test('missed original window strands the real body; one timed physical repair reopens a paid return window',()=>{
 let s=fixture('original'),r=arrive(s,'original');s.srDescent.lowerAnchor.condition=0;s.routesById['route:immortal-descent-link'].condition='blocked';
 until(s,()=>r.phase==='stranded','original window closes',1000);assert.equal(s.personsById[ENVOY].position.sceneId,SITE);assert.equal(r.returnAllocation.phase,'reserved');s=reload(s);r=s.srDescent.records[r.id];
 const before=copy(party(s));D.descentCommand(s,{action:'repair',descentId:r.id,informed:true});assert.equal(party(s).jade,before.jade-20);assert.equal(party(s).crystal,before.crystal-6);assert.equal(party(s).stone,before.stone-12);
 step(s,119);assert.equal(r.phase,'stranded');s=reload(s);r=s.srDescent.records[r.id];step(s,1);assert.equal(r.returnReopens,1);assert.equal(r.deadlineTick-s.worldTick,240);until(s,()=>r.phase==='returned','real return after repair',300);assert.equal(r.returnPayments.length,1);assert.equal(s.personsById[ENVOY].position.sceneId,ORIGIN);reload(s);
});
test('failed in-transit return walks back the already traveled duration and preserves first payment; repair reserves a new return',()=>{
 let s=fixture('original');
 // Explicit initial component position/budget at the public notice and finite home
 // funding (the completed legacy fixture has expensive ongoing wages). All permits,
 // cargo loading, road payments, walking and the later resupply use production commands.
 s.resources.jade=4000;
 s.master.position={kind:'scene',sceneId:'scene:market',x:13.6,y:32};s.srWorld.localSceneId='scene:market';s.master.journey.routeId='scene:market';s.stockpilesById['stockpile:sr-party'].position={sceneId:'scene:market',x:13.6,y:32};
 Object.assign(party(s),{jade:310,crystal:41,herb:20,stone:12,food:17});assert.equal(Object.values(party(s)).reduce((a,b)=>a+b,0),400);
 S.srWorldCommand(s,{action:'interact',objectId:'object:market:notice',choice:'studyMap'});until(s,()=>!s.srWorld.interaction,'public timed navigation charter');assert(s.srWorld.transportPermits['route:descent-outpost']);
 S.srWorldCommand(s,{action:'travel',destination:SITE});until(s,()=>!s.srWorld.activeTravelId,'actual paid initial approach',2000);S.srWorldCommand(s,{action:'move',x:28.3,y:24});until(s,()=>!s.srWorld.interaction,'actual walk to independent anchor');
 let r=arrive(s,'original');D.returnDescent(s,r.id,true);until(s,()=>r.phase==='returning','actual start return');step(s,37);assert.equal(s.travelsById[r.travelId].progressTicks,37);
 s.srDescent.lowerAnchor.condition=0;s.routesById['route:immortal-descent-link'].condition='blocked';until(s,()=>r.returnInterrupted===true,'actual finite gate closure');assert.equal(s.personsById[ENVOY].position.kind,'worldTravel');assert.equal(r.durationTicks,37);step(s,36);assert.equal(s.personsById[ENVOY].position.kind,'worldTravel');step(s,1);assert.equal(r.phase,'stranded');assert.equal(s.personsById[ENVOY].position.sceneId,SITE);assert.equal(r.returnPayments.length,1);
 s=reload(s);r=s.srDescent.records[r.id];rejectUnchanged(s,()=>D.descentCommand(s,{action:'repair',descentId:r.id,informed:true}),/身边材料不足/);
 S.srWorldCommand(s,{action:'travel',destination:'scene:yunxiu-courtyard'});until(s,()=>!s.srWorld.activeTravelId,'real homeward supply trip',2000);const homeBefore=copy(s.resources);
 S.srWorldCommand(s,{action:'travel',destination:SITE,cargo:{jade:100,crystal:10,food:20}});assert.equal(s.resources.jade,homeBefore.jade-120,'outward charter fares and newly packed jade come from actual home stock');assert.equal(s.resources.crystal,homeBefore.crystal-10);
 until(s,()=>!s.srWorld.activeTravelId,'real return with paid finite cargo',2000);S.srWorldCommand(s,{action:'move',x:28.3,y:24});until(s,()=>!s.srWorld.interaction,'actual walk back to stranded visitor');s=reload(s);r=s.srDescent.records[r.id];
 const before=copy(party(s));D.descentCommand(s,{action:'repair',descentId:r.id,informed:true});assert.equal(party(s).crystal,before.crystal-16);assert.equal(party(s).jade,before.jade-70);step(s,120);until(s,()=>r.phase==='returned','paid second return',300);assert.equal(r.returnPayments.length,2);assert.deepEqual(r.returnPayments[0].cost,r.returnPayments[1].cost);reload(s);
});
test('failed outbound gate has a finite wait and the same original body walks back to its real upper origin',()=>{
 let s=fixture('original'),r=begin(s,'original'),budget=copy(party(s));step(s,240+37);assert.equal(r.phase,'descending');assert.equal(s.travelsById[r.travelId].progressTicks,37);
 s.srDescent.lowerAnchor.condition=0;s.routesById['route:immortal-descent-link'].condition='blocked';
 until(s,()=>r.outboundInterrupted===true,'finite outbound gate wait',250);assert.equal(s.worldTick,r.travelDeadlineTick);assert.equal(r.durationTicks,37);assert.equal(s.personsById[ENVOY].position.kind,'worldTravel');s=reload(s);r=s.srDescent.records[r.id];
 step(s,36);assert.equal(s.personsById[ENVOY].position.kind,'worldTravel');step(s,1);assert.equal(r.phase,'cancelled');assert.equal(r.transitAborted,true);assert.equal(s.personsById[ENVOY].position.sceneId,ORIGIN);assert.equal(s.personsById[ENVOY].activityId,null);assert.equal(r.launchConsumedFraction,1);assert.equal(r.returnAllocation.phase,'refunded');assert.deepEqual(party(s),budget,'failed actual launch does not reset any spent caller stock');
 const crate=s.stockpilesById[r.recoveryStockpileId];assert.deepEqual({jade:crate.resources.jade,crystal:crate.resources.crystal},D.DESCENT_MODES.original.returnCost);assert.equal(r.returnPayments,undefined);reload(s);
});
test('component batched descent ticks equal individual ticks at channel/transit boundary',()=>{
 const a=fixture();const r=begin(a);step(a,150);const b=reload(a);step(a,30);b.worldTick+=30;b.revision+=30;D.tickDescentSR(b);D.validateDescentSR(b);
 assert.deepEqual(a.srDescent,b.srDescent);assert.deepEqual(a.personsById[ENVOY].position,b.personsById[ENVOY].position);assert.deepEqual(party(a),party(b));assert.deepEqual(a.travelsById[b.srDescent.records[r.id].travelId],b.travelsById[b.srDescent.records[r.id].travelId]);
});
test('public command gateway keeps descent request retry-safe and completes actual local aid/paid return across saves',()=>{
 let s=fixture();const request={name:'descentCommand',args:[{action:'request',mode:'avatar',informed:true}],id:`command:${s.transactions.nextCommandId}`,expectedRevision:s.revision};
 const first=S.dispatchCommand(s,request);s=first.state;assert.equal(first.result.accepted,true);const id=first.result.descentId;
 const raw=JSON.stringify(s),replay=S.dispatchCommand(s,request);assert.equal(replay.status,'already-applied');assert.equal(replay.state,s);assert.equal(JSON.stringify(s),raw,'retried command neither duplicates upper avatar nor charges a second budget');
 step(s,80);s=reload(s);until(s,()=>s.srDescent.records[id].phase==='present','public gateway real descending arrival');
 const aid=S.dispatchCommand(s,{name:'descentCommand',args:[{action:'aid',descentId:id,informed:true}]});s=aid.state;assert.equal(aid.result.accepted,true);step(s,80);s=reload(s);
 until(s,()=>s.srDescent.records[id].phase==='returned','public command local aid and finite paid return');s=reload(s);assert.equal(s.srDescent.records[id].returnPayments.length,1);assert.equal(s.personsById[ENVOY].position.sceneId,ORIGIN);assert.equal(s.master.position.sceneId,SITE);
});
test('public cancellation gateway releases its owned contact activity and preserves physical refund',()=>{
 let s=fixture();const request=S.dispatchCommand(s,{name:'descentCommand',args:[{action:'request',mode:'avatar',informed:true}]});s=request.state;const id=request.result.descentId;step(s,40);
 const out=S.dispatchCommand(s,{name:'descentCommand',args:[{action:'cancel',descentId:id}]});s=out.state;assert.equal(s.srDescent.records[id].phase,'cancelled');assert.equal(s.master.activityId,null);assert.equal(s.personsById[ENVOY].activityId,null);assert.equal(s.stockpilesById[s.srDescent.records[id].recoveryStockpileId].position.sceneId,SITE);reload(s);
});
assert(cases.length>0,'suite selection must run at least one actual case');
console.log(JSON.stringify({suite:'immortal descent component acceptance',passed:cases.length,failed:0,cases,boundary:'Explicit legal-ending/high-realm/array/arrival/budget and hostile-trap/gate-damage fixtures; runtime body movement, timing, costs, death and reload are real. Does not prove a natural high-tier campaign, real-device experience or player ascension.'},null,2));
