/** SR-XF-002/030 shared contract QA. No screenshots, formal slots or report artifacts. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Opening from '../dist/ea-opening-sim.mjs';
import {createEAPersistence,slotKeys} from '../dist/ea-persistence.mjs';
import {memoryStorage,memoryLocks} from './ea-storage-fixture.mjs';
import * as Legacy from '../dist/ea-sim.mjs';
import {CELLS} from '../dist/ea-data.mjs';
import * as Old from '../dist/sect-sim.mjs';
import * as V1 from '../dist/model.mjs';
import * as V2 from '../dist/world.mjs';
import * as V3 from '../dist/living-world.mjs';
import {initSpatial,placementIssue,validateSpatial} from '../dist/ea-sr-spatial.mjs';
import {migrateState,cloneState,validateV6Shape,legacyProjection} from '../dist/ea-state-v6.mjs';
import {initContracts,validateContracts,validateContentDefinitions,executeContractCommand,beginContractTick,knowledgeView,prepareMigration,commitMigration,SR_CONTENT_VERSION} from '../dist/ea-sr-contracts.mjs';
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
const fresh=()=>migrateState(Legacy.initial({seed:713}),{newGame:true});
const prepare=raw=>prepareMigration(raw,{validateLegacy:Legacy.validateSave,migrate:migrateState,validate:validateV6Shape});
test('SR-XF-030-AC-01 v5 migration preserves source, assets, RNG, phase and identities',()=>{
 const raw=Legacy.initial({seed:777,name:'迁移守恒'});Legacy.tick(raw,3.25);const before=structuredClone(raw);
 const s=migrateState(raw);assert.deepEqual(raw,before);assert.equal(s.rngState,raw.sim.seed);assert.equal(s.worldTick,32);assert.equal(s.master.name,raw.master.name);assert.deepEqual(s.resources,raw.resources);assert.equal(s.master.personId,'person:master');assert.ok(Math.abs(s.sim.carry-.05)<1e-12);validateV6Shape(s);
});
test('SR-XF-030-AC-01 v1-v4 supported legacy chain keeps time and members',()=>{
 for(const generator of [V1,V2,V3,Old]){const raw=generator.initial();const version=raw.version;const prepared=prepare(raw);assert.equal(prepared.offlineTicksApplied,0);assert.equal(prepared.state.time,raw.time);assert.equal(prepared.state.homeMemberIds.length,raw.disciples.length);assert.equal(prepared.fromVersion,version);}
});
test('SR-XF-030-AC-01 completed ending guard preserves ending with no new targets',()=>{
 // Existing committed fixture has a full legal EA completion; loaded below asynchronously.
 const s=fresh();s.story.completed=true;s.story.ending='return';initContracts(s);assert.equal(s.migrationLedger.storyFacts.ending.additionalTargetsAllowed,false);assert.equal(s.story.ending,'return');assert.equal(Object.keys(s.itemsById).length,0);
});
test('SR-XF-030-AC-03 legacy knowledge maps once without doubling understanding and mastery',()=>{
 const s=fresh();const first=structuredClone(s.migrationLedger.legacyKnowledge);assert.ok(Object.keys(first).length);initContracts(s);initContracts(s);assert.deepEqual(s.migrationLedger.legacyKnowledge,first);for(const k of Object.values(first)){assert.equal(k.understanding,k.legacyMastery);assert.equal(k.mastery,0);}assert.deepEqual(s.migrationLedger.appliedKeys,['sr-contracts-v1']);
});
test('SR-XF-002-AC-02 repeat after 128 receipt eviction applies once, changed ID rejects',()=>{
 let s=fresh();const handlers={spend:x=>{x.resources.herb--;return x.resources.herb;}};
 const first={id:'command:1',name:'spend',args:[],expectedRevision:s.revision};const a=executeContractCommand(s,first,{handlers,clone:cloneState,validate:validateV6Shape});assert.equal(a.status,'committed');s=a.state;const initialBalance=s.resources.herb;
 for(let i=2;i<=140;i++){const r=executeContractCommand(s,{id:`command:${i}`,name:'noop',args:[],expectedRevision:s.revision},{handlers:{noop:()=>true},clone:cloneState,validate:validateV6Shape});assert.equal(r.status,'committed');s=r.state;}
 const repeat=executeContractCommand(s,first,{handlers,clone:cloneState,validate:validateV6Shape});assert.equal(repeat.status,'already-applied');assert.equal(repeat.state.resources.herb,initialBalance);assert.equal(s.transactions.receipts.length,128);assert.equal(executeContractCommand(s,{...first,args:[9]},{handlers}).reasonCodes[0],'command-id-conflict');
});
test('SR-XF-002-AC-02 invalid references/late revision rollback all partial changes',()=>{
 const s=fresh(),before=JSON.stringify(s);const r=executeContractCommand(s,{id:'command:1',name:'bad',args:[],expectedRevision:0},{handlers:{bad:x=>{x.resources.herb--;x.personsById['person:master'].activityId='activity:missing';}},clone:cloneState,validate:validateV6Shape});assert.equal(r.status,'rejected');assert.equal(r.reasonCodes[0],'invalid-reference');assert.equal(JSON.stringify(s),before);
 const late=executeContractCommand(s,{id:'command:1',name:'bad',args:[],expectedRevision:9},{handlers:{bad:()=>true}});assert.equal(late.reasonCodes[0],'stale-revision');
});
test('SR-XF-002-AC-01 canonical person reference survives travel/combat table and roundtrip',()=>{
 const s=fresh(),p=s.master;s.routesById['route:test']={id:'route:test'};s.travelsById['travel:test']={id:'travel:test',routeId:'route:test',personId:p.personId};s.combatSessionsById['combat:test']={id:'combat:test',personId:p.personId};p.combatSessionId='combat:test';p.position={kind:'worldTravel',travelId:'travel:test'};validateContracts(s);
 const loaded=cloneState(JSON.parse(JSON.stringify(s)));assert.equal(loaded.personsById[loaded.travelsById['travel:test'].personId],loaded.master);assert.equal(loaded.personsById[loaded.combatSessionsById['combat:test'].personId],loaded.master);assert.equal(Object.keys(loaded.personsById).filter(id=>id==='person:master').length,1);assert.equal(loaded.rngState,s.rngState);assert.equal(loaded.worldTick,s.worldTick);
});
test('SR-XF-002-AC-02 knowledge query is read-only and excludes hidden author truths',()=>{
 const s=fresh();s.claimsById['claim:public']={id:'claim:public',public:true,text:'昨日有人走过石桥',truth:'hidden',receivedAtTick:0};s.claimsById['claim:secret']={id:'claim:secret',public:false,text:'秘闻'};const before=JSON.stringify(s);assert.deepEqual(knowledgeView(s),[{id:'claim:public',text:'昨日有人走过石桥',sourcePersonId:null,observedAtTick:null,receivedAtTick:0,locationHint:null,certainty:'unverified'}]);assert.equal(JSON.stringify(s),before);
});
test('SR-XF-002-AC-03 content version and missing ref reject isolated definitions precisely',()=>{
 const d={version:1,contentVersion:SR_CONTENT_VERSION,persons:{},items:{},scenes:{'scene:a':{id:'scene:a',references:[]}},routes:{},claims:{},crises:{},activities:{},authorCards:{}};assert.deepEqual(validateContentDefinitions(d),d);d.routes['route:x']={id:'route:x',references:['scene:missing']};const before=JSON.stringify(d);assert.throws(()=>validateContentDefinitions(d),e=>e.code==='invalid-reference'&&e.path==='definitions.routes.route:x.references');assert.equal(JSON.stringify(d),before);assert.throws(()=>validateContentDefinitions({...d,contentVersion:'future'}),/unsupported-version/);
});
test('SR-XF-030-AC-02 unknown schema and item/location reject without original mutation',()=>{
 const raw=Legacy.initial();raw.version=99;const before=JSON.stringify(raw);assert.throws(()=>prepare(raw),/unsupported-version/);assert.equal(JSON.stringify(raw),before);
 const s=fresh();s.itemsById['item:test']={id:'item:test',definitionId:'def:test',ownerId:'person:master',condition:1,location:{kind:'person',id:'person:missing'}};assert.throws(()=>validateContracts(s),e=>e.code==='invalid-reference'&&e.path==='itemsById.item:test.location.id');
 const actual=Opening.initial({sr:true}),item=actual.itemsById['item:sr-equipment:1'];item.location={kind:'person',id:'person:missing',slot:'weapon'};const actualBefore=JSON.stringify(actual);assert.throws(()=>Opening.validateSave(actual),e=>e.code==='invalid-reference'&&e.path==='itemsById.item:sr-equipment:1.location.id');assert.equal(JSON.stringify(actual),actualBefore,'failed real load leaves the source save intact');
 const missingBuilding=Legacy.initial();missingBuilding.buildings[0].type='missing-building';const missingBefore=JSON.stringify(missingBuilding);assert.throws(()=>Opening.validateSave(missingBuilding,{upgrade:true}),/建筑字段或地块重复/);assert.equal(JSON.stringify(missingBuilding),missingBefore,'unknown old building definition does not rewrite the old save');
});
test('SR-XF-030-AC-02 legal crowded v5 layout records deterministic alternative positions without changing source',()=>{
 const old=Legacy.initial({seed:713});assert.equal(Legacy.placementLock(old,'farm',0,2),'');const farm=Legacy.build(old,'farm',0,2);assert.equal(Legacy.placementLock(old,'lumber',2,0),'');const lumber=Legacy.build(old,'lumber',2,0);Legacy.validateSave(old);
 const unchanged=JSON.stringify(old),ids=old.buildings.map(b=>b.id),time=old.time,resources=structuredClone(old.resources),rng=old.sim.seed;
 const migrated=Opening.validateSave(old,{upgrade:true}),repair=migrated.spatial.migrations.find(m=>m.kind==='building-unit-grid'&&m.entityId===`building:yunxiu:${lumber.id}`);
 assert(repair&&repair.from&&repair.to&&JSON.stringify(repair.from)!==JSON.stringify(repair.to)&&repair.reason,'the old lumber plot needs a logged legal alternative');
 assert.match(placementIssue(migrated,'lumber',4,6,{ignoreId:lumber.id,checkPeople:false,checkReservations:false}),/灵草田.*入口/,'nearest old plot is blocked by the real farm doorway');assert.equal(repair.to.x,4);assert.equal(repair.to.y,4);assert.equal(migrated.buildings.find(b=>b.id===farm.id).type,'farm');
 assert.deepEqual(migrated.buildings.map(b=>b.id),ids,'all old buildings keep their identity');
 assert.deepEqual(migrated.resources,resources);assert.equal(migrated.time,time);assert.equal(migrated.rngState,rng);assert.equal(JSON.stringify(old),unchanged,'failed first placement and successful migration never write the original');
 const saved=JSON.stringify(migrated);assert.equal(JSON.stringify(Opening.validateSave(JSON.parse(saved))),saved,'the selected compatible layout survives an exact reload');
});
test('SR-XF-030-AC-02 legal but unplaceable v5 source refuses upgrade without losing a building',()=>{
 const old=Legacy.initial({seed:713}),hall=old.buildings[0],cells=CELLS.filter(c=>c.x!==hall.x||c.y!==hall.y);old.sect.founded=true;
 for(const cell of cells.slice(0,75)){assert.equal(Legacy.placementLock(old,'farm',cell.x,cell.y),'');old.buildings.push({id:old.nextId++,type:'farm',x:cell.x,y:cell.y,level:3,progress:0,condition:100,enabled:true});}
 Legacy.validateSave(old);const original=JSON.stringify(old);assert.throws(()=>Opening.validateSave(old,{upgrade:true}),/空间迁移无法安置|单位格迁移无法合法安置/);
 assert.equal(JSON.stringify(old),original);assert.equal(old.buildings.length,76);
});
test('SR-XF-030-AC-03 backup failure never overwrites, quota failure preserves export state',()=>{
 const p=prepare(JSON.stringify(Legacy.initial()));let writes=0,original='old raw';const failed=commitMigration(p,{backup:()=>{throw Error('quota');},write:()=>{writes++;}});assert.equal(failed.ok,false);assert.equal(writes,0);assert.equal(failed.originalRaw,p.originalRaw);
 const failedWrite=commitMigration(p,{backup:raw=>{original=raw;},write:()=>{throw Error('quota');}});assert.equal(failedWrite.state.worldTick,p.atTick);assert.equal(original,p.originalRaw);assert.equal(failedWrite.saveStatus,'save-failed');
});
test('completed/delivered historical orders may retain released reservation, active cannot',()=>{
 const s=fresh();s.workOrdersById['work:old']={id:'work:old',kind:'production',phase:'completed',reservationId:'reservation:released'};for(const phase of ['completed','delivered','returned']){s.workOrdersById['work:old'].phase=phase;validateContracts(s);}s.workOrdersById['work:old'].phase='active';assert.throws(()=>validateContracts(s),e=>e.code==='invalid-reference');
});
test('canonical legacy validation preserves metre geometry, positions and source object',()=>{
 const s=fresh();initContracts(s,{activate:true});initSpatial(s);s.buildings[0].x=24.5;s.buildings[0].y=4.5;s.master.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:s.master.scenic.x,y:s.master.scenic.y};const before=JSON.stringify(s);Legacy.validateSave(legacyProjection(s),{canonical:true});validateSpatial(s);assert.equal(JSON.stringify(s),before);assert.equal(s.master.scenic.geometry,'spatial-metres-1');
});
test('canonical validation still rejects malformed person/asset fields without repairing',()=>{
 const s=fresh();initContracts(s,{activate:true});initSpatial(s);s.master.energy=101;const before=JSON.stringify(s);assert.throws(()=>Legacy.validateSave(legacyProjection(s),{canonical:true}),/人物基本字段/);assert.equal(JSON.stringify(s),before);assert.throws(()=>Legacy.validateSave(legacyProjection(fresh()),{canonical:true}),/canonical/);
});
test('shared tick cursor deduplicates same tick without becoming another clock',()=>{
 const s=fresh();assert.equal(beginContractTick(s,'test'),true);assert.equal(beginContractTick(s,'test'),false);assert.equal(s.worldTick,0);s.worldTick=1;assert.equal(beginContractTick(s,'test'),true);assert.equal(s.contracts.moduleTicks.test,1);validateContracts(s);
});
// Replay a committed fixture, do not rely on the synthetic ending guard alone.
try{const raw=JSON.parse(await readFile(new URL('./acceptance-1.4.2/legacy-full.json',import.meta.url)));const source=raw.state??raw;const old=Legacy.validateSave(source),s=migrateState(old);assert.equal(s.story.completed,old.story.completed);assert.equal(s.story.ending,old.story.ending);assert.deepEqual(s.story.claimed,old.story.claimed);assert.deepEqual(s.resources,old.resources);validateV6Shape(s);checks++;console.log('PASS actual legal v5 full fixture preserved');}catch(error){if(error.code==='ENOENT')console.log('SKIP fixture absent: legal full v5 fixture');else throw error;}
test('actual gateway travel/save/reload/retry arrives once with the same canonical body',()=>{
 let s=Opening.initial({sr:true});const request={id:`command:${s.transactions.nextCommandId}`,name:'srWorldCommand',args:[{action:'travel',destination:'scene:valley'}],expectedRevision:s.revision};const r=Opening.dispatchCommand(s,request);s=r.state;assert.equal(r.status,'committed');assert.equal(s.master.position.kind,'worldTravel');const before=JSON.stringify(s);s=Opening.validateSave(JSON.parse(before));assert.equal(JSON.stringify(s),before);assert.equal(s.master.location.kind,'travel');assert.ok(s.srWorld.routes);const repeat=Opening.dispatchCommand(s,request);assert.equal(repeat.status,'already-applied');assert.equal(repeat.state,s);Opening.tick(s,10);assert.equal(s.master.location.sceneId,'scene:valley');assert.equal(s.srWorld.activeTravelId,null);assert.equal(Object.keys(s.personsById).filter(id=>id==='person:master').length,1);Opening.validateSave(s);
});
test('actual gateway refuses a second local body during world travel and preserves assets',()=>{
 let s=Opening.initial({sr:true});s=Opening.dispatchCommand(s,{name:'srWorldCommand',args:[{action:'travel',destination:'scene:valley'}]}).state;const before=JSON.stringify(s);assert.throws(()=>Opening.dispatchCommand(s,{name:'craftEquipment',args:['equipment:iron-sword']}));assert.equal(JSON.stringify(s),before);assert.equal(s.master.position.kind,'worldTravel');
});
for(const failedKey of ['backups','primary']){
 const storage=memoryStorage(),originalSet=storage.setItem.bind(storage),keys=slotKeys(1,'qa-sr-contracts:');let failKey=null;
 storage.setItem=(key,value)=>{if(key===failKey)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});originalSet(key,value);};
 let s;const persistence=createEAPersistence({onChange:event=>{if(s&&event.result?.ok===false)s.speed=0;},namespace:'qa-sr-contracts:',getStorage:()=>storage,locks:memoryLocks(),validate:Opening.validateSave,dataVersion:6,gameVersion:'1.6.0-sr-test',channelFactory:null,eventTarget:null});
 await persistence.open(1);s=Opening.initial({sr:true});assert.equal(persistence.saveNow(s).ok,true);const original=storage.getItem(keys.primary);
 s=Opening.dispatchCommand(s,{name:'setSpeed',args:[2]}).state;failKey=keys[failedKey];assert.equal(persistence.saveNow(s).ok,false);assert.equal(storage.getItem(keys.primary),original);assert.equal(persistence.parseImport(persistence.exportState(s)).state.revision,s.revision);assert.equal(s.speed,0);persistence.release();checks++;console.log('PASS actual SR persistence '+failedKey+' failure keeps original and exports committed memory');
}
{
 const namespace='qa-sr030-layout:',storage=memoryStorage(),keys=slotKeys(1,namespace);
 const store=createEAPersistence({namespace,getStorage:()=>storage,locks:memoryLocks(),validate:raw=>Opening.validateSave(raw,{upgrade:true}),dataVersion:6,channelFactory:null,eventTarget:null});
 const old=Legacy.initial({seed:713});Legacy.build(old,'farm',0,2);Legacy.build(old,'lumber',2,0);Legacy.validateSave(old);
 const template=JSON.parse(store.exportState(Opening.initial({sr:true}))),raw=JSON.stringify({...template,dataVersion:5,state:old});storage.setItem(keys.primary,raw);
 const opened=await store.open(1);assert.equal(opened.status,'migration-available');assert.equal(store.saveNow(Opening.initial({sr:true})).ok,false);assert.equal(store.exportSlot(1),raw);
 const migrated=await store.migrateLegacy(1,{source:'primary'});assert.equal(migrated.ok,true);assert.deepEqual(migrated.state.buildings.map(b=>b.id),old.buildings.map(b=>b.id));
 assert.equal(store.inspect(1).status,'ready');assert.ok(store.inspect(1).preserved.some(p=>store.exportSlot(1,{source:p.id})===raw));
 assert.equal(storage.getItem(keys.primary),store.exportSlot(1));store.release();checks++;console.log('PASS SR030 crowded legacy slot migrates with exact source export');
}
{
 const namespace='qa-sr030-broken-ref:',storage=memoryStorage(),keys=slotKeys(1,namespace),locks=memoryLocks();
 const make=()=>createEAPersistence({namespace,getStorage:()=>storage,locks,validate:raw=>Opening.validateSave(raw,{upgrade:true}),dataVersion:6,channelFactory:null,eventTarget:null});
 const first=make();await first.open(1);assert.equal(first.saveNow(Opening.initial({sr:true})).ok,true);assert.equal(first.saveNow(Opening.initial({sr:true})).ok,true);
 const current=first.parseImport(storage.getItem(keys.primary));assert.equal(current.ok,true);const damaged=JSON.parse(first.exportState(current.state));first.release();
 damaged.state.itemsById['item:sr-equipment:1'].location={kind:'person',id:'person:missing',slot:'weapon'};
 const raw=JSON.stringify(damaged);storage.setItem(keys.primary,raw);const second=make(),opened=await second.open(1);
 assert.equal(opened.status,'recovery-required');assert.equal(opened.state,null);assert.equal(second.saveNow(Opening.initial({sr:true})).ok,false);assert.equal(storage.getItem(keys.primary),raw);
 assert.equal(second.exportSlot(1),raw);assert.equal(JSON.parse(second.exportBundle(1)).raw.primary,raw);
 const backup=opened.backups.find(b=>b.valid);assert(backup,'known-good rolling backup remains available');const restored=await second.recover(1,backup.id);
 assert.equal(restored.ok,true);assert.equal(second.inspect(1).status,'ready');assert.ok(second.inspect(1).preserved.some(p=>second.exportSlot(1,{source:p.id})===raw));
 second.release();checks++;console.log('PASS SR030 broken reference slot refuses writes and retains export through backup recovery');
}
{
 const namespace='qa-sr030-no-space:',storage=memoryStorage(),keys=slotKeys(1,namespace),locks=memoryLocks();
 const make=()=>createEAPersistence({namespace,getStorage:()=>storage,locks,validate:raw=>Opening.validateSave(raw,{upgrade:true}),dataVersion:6,channelFactory:null,eventTarget:null});
 const first=make();await first.open(1);assert.equal(first.saveNow(Opening.initial({sr:true})).ok,true);assert.equal(first.saveNow(Opening.initial({sr:true})).ok,true);
 const old=Legacy.initial({seed:713}),hall=old.buildings[0];old.sect.founded=true;for(const cell of CELLS.filter(c=>c.x!==hall.x||c.y!==hall.y).slice(0,75)){assert.equal(Legacy.placementLock(old,'farm',cell.x,cell.y),'');old.buildings.push({id:old.nextId++,type:'farm',x:cell.x,y:cell.y,level:3,progress:0,condition:100,enabled:true});}
 Legacy.validateSave(old);const current=first.parseImport(storage.getItem(keys.primary));assert.equal(current.ok,true);const envelope=JSON.parse(first.exportState(current.state)),raw=JSON.stringify({...envelope,dataVersion:5,state:old});first.release();storage.setItem(keys.primary,raw);
 const second=make(),opened=await second.open(1);assert.equal(opened.status,'recovery-required');assert.equal(second.saveNow(Opening.initial({sr:true})).ok,false);assert.equal(second.exportSlot(1),raw);
 assert.equal(JSON.parse(second.exportBundle(1)).raw.primary,raw);const backup=opened.backups.find(b=>b.valid);assert(backup);assert.equal((await second.recover(1,backup.id)).ok,true);
 assert.ok(second.inspect(1).preserved.some(p=>second.exportSlot(1,{source:p.id})===raw));second.release();checks++;console.log('PASS SR030 unplaceable legacy slot protects raw bytes and recovers from selected backup');
}
console.log(JSON.stringify({checks,passed:checks,scope:'Node shared schema/transactions/migration; domain end-to-end, UI, devices and real players require separate QA'}));
