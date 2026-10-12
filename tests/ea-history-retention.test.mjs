import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as sim from '../dist/ea-opening-sim.mjs';
import {HISTORY_POLICY,pruneHistory,validateHistoryRetention} from '../dist/ea-history-retention.mjs';
import {foundingStatusSR,peakStatusSR} from '../dist/ea-sr-organization.mjs';
import {PEAK_DIRECTIONS} from '../dist/ea-society.mjs';
import {knownFactForObserver} from '../dist/ea-sr-contracts.mjs';
import {resourceSource} from '../dist/ea-sr-equipment.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {memoryStorage,memoryLocks} from '../qa/ea-storage-fixture.mjs';
const json=s=>JSON.parse(JSON.stringify(s));
const fresh=()=>sim.validateSave(sim.initial({sr:true,seed:713}));
function auditFixture(){
 // Artificial audit rows isolate reference/compaction behavior; no playability claim.
 const s=fresh();s.worldTick=100000;
 s.community.day=s.economy.day=s.economy.lastSupplyDay=s.society.lastDay=Math.floor(s.worldTick/s.ticksPerDay);
 s.society.clock=s.time;
 for(let tick=1;tick<=160;tick++){
  const id=`fact:weather:yunxiu:${tick}`;s.factsById[id]={id,kind:'weather',atTick:tick,phase:'rain',regionId:'region:yunxiu'};
  const crop=`fact:crop-water:${tick}`;s.factsById[crop]={id:crop,kind:'ecology-damage',atTick:tick,sceneId:'scene:yunxiu-courtyard',cause:'waterlogging',quantity:1,resource:'herb'};
  const travel=`travel:merchant:in:${tick}`;s.travelsById[travel]={id:travel,kind:'merchant-travel',status:'completed',participantIds:['person:merchant-qingxi'],sourceSceneId:'scene:market',destinationSceneId:'scene:yunxiu-courtyard',startedTick:tick,completedTick:tick+300,lastStepTick:tick+300,durationTicks:300,progressTicks:300,cargoStockpileId:'stockpile:qingxi'};
 }
 return s;
}
test('pure audit rows become bounded summaries while nested references and their transitive closure survive',()=>{
 const s=auditFixture(),weather='fact:weather:yunxiu:1',crop='fact:crop-water:2',travel='travel:merchant:in:3';
 s.factsById[weather].relatedFactId=crop;s.factsById[crop].journeyEvidenceId=travel;
 s.regressionReferenceFixture={nested:[{evidenceFactIds:[weather]}],keyed:{'fact:weather:yunxiu:4':true}};
 s.weatherByRegionId['region:yunxiu'].sourceFactId='fact:weather:yunxiu:5';
 s.ecologiesBySceneId['scene:yunxiu-courtyard'].traceFactIds=['fact:crop-water:6'];
 const before=json(s),removed=pruneHistory(s,{force:true});
 assert.ok(removed.facts>0&&removed.travels>0);
 for(const id of [weather,crop,'fact:weather:yunxiu:4','fact:weather:yunxiu:5','fact:crop-water:6'])assert.deepEqual(s.factsById[id],before.factsById[id]);
 assert.deepEqual(s.travelsById[travel],before.travelsById[travel]);
 assert.equal(s.historyRetention.summaries.weather.count+Object.values(s.factsById).filter(f=>f.kind==='weather').length,160);
 assert.deepEqual(json(sim.validateSave(s)),json(s));
 const stable=json(s);assert.deepEqual(pruneHistory(s,{force:true}),{facts:0,travels:0});assert.deepEqual(json(s),stable);
});
test('live or blocked journeys, general arrived journeys and production evidence retain their gameplay semantics',()=>{
 const s=auditFixture();
 const active='travel:merchant:in:1';s.travelsById[active].status='blocked';
 const general='travel:sr:regression';s.travelsById[general]={id:general,from:'scene:yunxiu-courtyard',destination:'scene:market',status:'arrived',participantIds:['person:lu-zhiwei'],startedTick:1,durationTicks:100,progressTicks:100,routeIds:['route:home-valley','route:valley-market']};
 s.personsById['person:lu-zhiwei'].location={kind:'local',sceneId:'scene:market',x:20,y:20};
 s.stockpilesById['stockpile:sr-party']={id:'stockpile:sr-party',ownerId:'person:master',position:{sceneId:'scene:market',x:20,y:20},resources:{...s.resources}};
 for(let i=0;i<200;i++){const id=`fact:production:regression:${i}`;s.factsById[id]={id,kind:'inventory-transaction',operation:'production',atTick:i,quantities:{herb:1,stone:1}};}
 const directions=Object.keys(PEAK_DIRECTIONS),before=json(s),founding=foundingStatusSR(s),peaks=directions.map(d=>peakStatusSR(s,d));
 assert.ok(peaks.every(p=>!p.reasons.includes('需已兑现的两批实际生产支撑用途')));
 assert.equal(resourceSource(s,'person:lu-zhiwei').id,'stockpile:sr-party');
 pruneHistory(s,{force:true});
 assert.deepEqual(s.travelsById[active],before.travelsById[active]);assert.deepEqual(s.travelsById[general],before.travelsById[general]);
 for(let i=0;i<200;i++)assert.deepEqual(s.factsById[`fact:production:regression:${i}`],before.factsById[`fact:production:regression:${i}`]);
 assert.deepEqual(foundingStatusSR(s),founding);assert.deepEqual(directions.map(d=>peakStatusSR(s,d)),peaks);
 assert.equal(resourceSource(s,'person:lu-zhiwei').id,'stockpile:sr-party');
});
test('implicit daily-supply keys survive alongside two latest receipts per person',()=>{
 const s=auditFixture(),personId='person:lu-zhiwei';s.society.lastDay=1;s.economy.lastSupplyDay=2;
 for(let dayIndex=1;dayIndex<=60;dayIndex++){const id=`fact:person-daily-supply:${personId}:${dayIndex}`;s.factsById[id]={id,kind:'daily-supply-relation',personId,dayIndex,atTick:dayIndex*1200,source:'economy.daily-supply',sourceDay:dayIndex,starvation:0,supplied:true,trustBefore:60,trustAfter:60,deltaTrust:0};}
 const trust=s.personsById[personId].mind.relationships.master.trust;
 pruneHistory(s,{force:true});
 const days=Object.values(s.factsById).filter(f=>f.kind==='daily-supply-relation').map(f=>f.dayIndex).sort((a,b)=>a-b);
 assert.deepEqual(days,[1,2,59,60]);assert.equal(s.historyRetention.summaries['daily-supply-relation'].count,56);
 assert.equal(s.personsById[personId].mind.relationships.master.trust,trust);
});
test('acquired knowledge recorded only on an old audit fact remains queryable',()=>{
 const s=auditFixture(),id='fact:weather:yunxiu:1';
 s.factsById[id].knownByPersonIds=['person:master'];
 s.factsById['fact:crop-water:2'].knownByIds=['person:lu-zhiwei'];
 s.factsById['fact:crop-water:3'].knownBy=['person:master'];
 s.factsById['fact:weather:yunxiu:4'].public=true;
 s.factsById['fact:weather:yunxiu:5'].observerId='person:master';
 s.factsById['fact:crop-water:6'].actorId='person:master';
 s.factsById['fact:weather:yunxiu:7'].actorId='person:lu-zhiwei';
 assert.equal(knownFactForObserver(s,'person:master',id),true);
 assert.equal(knownFactForObserver(s,'person:lu-zhiwei','fact:weather:yunxiu:7'),true);
 pruneHistory(s,{force:true});
 assert.equal(knownFactForObserver(s,'person:master',id),true);
 assert.equal(knownFactForObserver(s,'person:lu-zhiwei','fact:weather:yunxiu:7'),true);
 for(const key of [id,'fact:crop-water:2','fact:crop-water:3','fact:weather:yunxiu:4','fact:weather:yunxiu:5','fact:crop-water:6','fact:weather:yunxiu:7'])assert.ok(Object.hasOwn(s.factsById,key));
 sim.validateSave(s);
});
test('unrecognized kinds and malformed candidates are retained for strict validation',()=>{
 const s=auditFixture(),bad='fact:weather:yunxiu:1';s.factsById[bad].atTick=NaN;
 s.factsById['fact:crop-water:2'].quantity=-1;
 s.travelsById['travel:merchant:in:3'].participantIds=['person:missing'];
 const id='fact:future-rule:1';s.factsById[id]={id,kind:'future-gameplay-kind',atTick:0};
 pruneHistory(s,{force:true});
 for(const key of [bad,'fact:crop-water:2',id])assert.ok(Object.hasOwn(s.factsById,key));
 assert.ok(Object.hasOwn(s.travelsById,'travel:merchant:in:3'));assert.throws(()=>sim.validateSave(s));
});
test('old schema-6 saves are fully validated without pruning; broken old evidence never disappears at load',()=>{
 const old=json(auditFixture()),copy=structuredClone(old),loaded=sim.validateSave(old);
 assert.deepEqual(old,copy);assert.deepEqual(json(loaded),old);assert.equal(loaded.historyRetention,undefined);
 const broken=structuredClone(old);broken.factsById['fact:weather:yunxiu:1'].sourceFactId='fact:missing';
 const before=structuredClone(broken);assert.throws(()=>sim.validateSave(broken),/invalid-reference/);assert.deepEqual(broken,before);
 sim.tick(loaded,.1);assert.equal(loaded.worldTick,old.worldTick+1);assert.ok(loaded.historyRetention);
});
test('v5 migration retains original text, resources, identities, time and existing ending',()=>{
 const raw=JSON.parse(readFileSync(new URL('../qa/ea-travel-world.json',import.meta.url))),before=structuredClone(raw);
 const s=sim.validateSave(raw,{upgrade:true});assert.deepEqual(raw,before);assert.deepEqual(s.resources,raw.resources);
 assert.equal(s.master.name,raw.master.name);assert.equal(s.time,raw.time);assert.equal(s.story.ending,raw.story.ending);
 assert.deepEqual(json(sim.validateSave(s)),json(s));
});
test('archive metadata rejects unsupported versions, future cursors and inconsistent summaries',()=>{
 const s=auditFixture();pruneHistory(s,{force:true});
 for(const mutate of [h=>h.version='future',h=>h.lastPrunedTick=s.worldTick+1,h=>h.summaries.weather.count=-1,h=>h.summaries.weather.firstTick=h.summaries.weather.lastTick+1]){
  const broken=json(s);mutate(broken.historyRetention);assert.throws(()=>validateHistoryRetention(broken));assert.throws(()=>sim.validateSave(broken));
 }
});
test('world-step retention boundaries stay identical in batch and individual tick replay',()=>{
 const batched=fresh(),steps=sim.cloneState(batched);
 sim.tick(batched,60.1);for(let i=0;i<601;i++)sim.tick(steps,.1);
 assert.equal(batched.worldTick,601);assert.equal(batched.historyRetention.lastPrunedTick,600);
 assert.deepEqual(json(batched),json(steps));
});
test('compacted history survives the real save codec, backup and command replay',async()=>{
 const s=auditFixture();pruneHistory(s,{force:true});
 const command={name:'setSpeed',args:[1]},committed=sim.dispatchCommand(s,command).state;
 const storage=memoryStorage(),store=createEAPersistence({getStorage:()=>storage,locks:memoryLocks(),validate:sim.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',namespace:'qa-issue6',channelFactory:null});
 try{
  await store.open(1);const saved=store.saveNow(s);assert.equal(saved.ok,true,saved.message);assert.equal(store.saveNow(committed).ok,true);
  const reopened=await store.open(1);assert.deepEqual(json(reopened.state),json(committed));assert.ok(reopened.backups.length);
  const replay=sim.dispatchCommand(reopened.state,{...command,id:`command:${s.transactions.nextCommandId}`});
  assert.equal(replay.replayed,true);assert.deepEqual(json(replay.state),json(committed));
 }finally{store.close();}
});
test('six real game hours plateau after warmup, and restored continuation matches uninterrupted simulation',()=>{
 let s=fresh();sim.tick(s,10800);const first=json(s),restored=sim.validateSave(first);
 sim.tick(s,10800);sim.tick(restored,10800);assert.equal(s.worldTick,216000);assert.deepEqual(json(restored),json(s));
 assert.ok(Object.keys(s.factsById).length<550);assert.ok(s.historyRetention.summaries.weather.count>=200);
 assert.ok(Object.values(s.factsById).filter(f=>f.kind==='weather').length<=HISTORY_POLICY.weather);
 assert.deepEqual(json(sim.validateSave(s)),json(s));
 const state=json(s);sim.viewWeather(s);sim.viewEconomy(s);sim.viewSRWorld(s);sim.validateSave(s);assert.deepEqual(json(s),state,'reads and validation cannot advance or prune history');
});
