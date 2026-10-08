/** SR-XF-002/030 version gate: legal sources, malformed versions and source preservation. */
import assert from 'node:assert/strict';
import * as Legacy from '../dist/ea-sim.mjs';
import * as Opening from '../dist/ea-opening-sim.mjs';
import {migrateState,validateV6Shape} from '../dist/ea-state-v6.mjs';
import {prepareMigration} from '../dist/ea-sr-contracts.mjs';

let checks=0;
function check(name,run){run();checks++;console.log(`PASS ${name}`);}
function roundtrip(state){const raw=JSON.stringify(state),loaded=Opening.validateSave(JSON.parse(raw));assert(JSON.stringify(loaded)===raw,'validated save must reload byte-for-byte');return loaded;}
function rejected(source,change,path){
 const state=structuredClone(source),original=JSON.stringify(state);change(state);
 const damaged=JSON.stringify(state);
 assert.throws(()=>Opening.validateSave(state),error=>error.code==='unsupported-version'&&error.path===path,`${path} must identify the rejected field`);
 assert.equal(JSON.stringify(state),damaged,'failed load must not change the input');
 assert.equal(JSON.stringify(source),original,'failed load must not change the legal source');
}

const old=Legacy.initial({seed:713}),oldRaw=JSON.stringify(old);
const v5=migrateState(old),legacy=Opening.validateSave(old),opening=Opening.initial(),sr=Opening.validateSave(Opening.initial({sr:true}));
check('legal v5 migration preserves input, identity, time, resources and RNG',()=>{
 assert.equal(JSON.stringify(old),oldRaw);
 assert.equal(legacy.schemaVersion,6);assert.equal(legacy.rulesetVersion,'opening-runtime-2');assert.equal(legacy.contentVersion,'legacy-ea-1.4.2');
 assert.equal(legacy.master.personId,'person:master');assert.equal(legacy.time,old.time);assert.deepEqual(legacy.resources,old.resources);assert.equal(legacy.rngState,old.sim.seed);
 roundtrip(legacy);const upgraded=Opening.validateSave(old,{upgrade:true});assert.equal(upgraded.rulesetVersion,'sr-runtime-v1.2');roundtrip(upgraded);assert.equal(JSON.stringify(old),oldRaw);
});
check('registered schema 6 combinations validate and opening sources migrate',()=>{
 const opening1=migrateState(Legacy.initial({seed:714}),{newGame:true});
 const opening2=structuredClone(opening);opening2.rulesetVersion='opening-runtime-2';
 for(const state of [v5,legacy,opening1,opening2,opening,sr])validateV6Shape(state);
 assert.equal(Opening.validateSave(opening1).rulesetVersion,'opening-runtime-3');
 assert.equal(Opening.validateSave(opening2).rulesetVersion,'opening-runtime-3');
 roundtrip(opening);roundtrip(sr);
});
check('known but unregistered rule/content pairs reject before SR initialization',()=>{
 for(const [source,change]of [
  [legacy,s=>{s.rulesetVersion='opening-runtime-3';}],
  [opening,s=>{s.contentVersion='legacy-ea-1.4.2';}],
  [opening,s=>{s.contentVersion='sr-content-v1.2';}],
  [sr,s=>{s.contentVersion='opening-v1.2';}],
  [sr,s=>{s.rulesetVersion='opening-runtime-3';}],
 ])rejected(source,change,'rulesetVersion+contentVersion');
});
check('unknown rule, content and schema versions identify the field',()=>{
 rejected(opening,s=>{s.rulesetVersion='opening-runtime-future';},'rulesetVersion');
 rejected(sr,s=>{s.contentVersion='sr-content-future';},'contentVersion');
 rejected(opening,s=>{s.schemaVersion=7;},'schemaVersion');
});
check('opening files without SR contracts remain readable; mixed SR modules reject',()=>{
 const historical=structuredClone(opening);delete historical.contracts;delete historical.migrationLedger;
 const raw=JSON.stringify(historical),loaded=Opening.validateSave(historical);
 assert.equal(JSON.stringify(historical),raw);assert.equal(loaded.contentVersion,'opening-v1.2');
 rejected(opening,s=>{s.srWorld={version:1};},'srWorld.version');
 rejected(opening,s=>{s.spatial={version:'spatial-metres-1'};},'spatial.version');
 rejected(opening,s=>{s.contracts.version=2;},'contracts.version');
});
check('unknown or missing core SR module versions reject before automatic initialization',()=>{
 for(const field of ['contracts','migrationLedger','spatial','srWorld','srGeography','srTransport','srWorldContent','srCrises','srEconomy','srOrganization','srEquipment','srCultivation','srCombat','srCovenants','srMother']){
  rejected(sr,s=>{s[field].version='future';},`${field}.version`);
  rejected(sr,s=>{delete s[field];},`${field}.version`);
 }
});
check('spatial and building subversions reject unknown explicit markers',()=>{
 for(const field of ['extentVersion','buildingGridVersion','interiorLayoutVersion'])rejected(sr,s=>{s.spatial[field]='future';},`spatial.${field}`);
 const buildingId=Object.keys(sr.buildingsById)[0];
 for(const field of ['buildingGridVersion','interiorLayoutVersion','prefabId'])rejected(sr,s=>{s.buildingsById[buildingId][field]='future';},`buildingsById.${buildingId}.${field}`);
});
check('later SR versions reject unknown markers and compatible absence initializes on a copy',()=>{
 for(const field of ['srDescent','srAftermath'])rejected(sr,s=>{s[field].version='future';},`${field}.version`);
 const historical=structuredClone(sr);delete historical.srDescent;delete historical.srAftermath;
 const raw=JSON.stringify(historical),loaded=Opening.validateSave(historical);
 assert.equal(JSON.stringify(historical),raw);assert.equal(loaded.srDescent.version,1);assert.equal(loaded.srAftermath.version,'aftermath:yunxiu:v1');
 rejected(sr,s=>{s.srLateEconomy={version:'future'};},'srLateEconomy.version');
});
check('migration API requires a complete validator and rejects bad versions before initialization',()=>{
 const options={validateLegacy:Legacy.validateSave,migrate:migrateState,validate:Opening.validateSave};
 const valid=prepareMigration(JSON.stringify(sr),options);
 assert.equal(valid.state.rulesetVersion,sr.rulesetVersion);
 const oldPrepared=prepareMigration(JSON.stringify(old),options);
 assert.equal(oldPrepared.state.rulesetVersion,'opening-runtime-2');
 assert.equal(oldPrepared.state.contentVersion,'legacy-ea-1.4.2');
 assert.throws(()=>prepareMigration(sr),error=>error.code==='invalid-contract'&&error.path==='validate');
 for(const change of [
  s=>{s.rulesetVersion='opening-runtime-3';},
  s=>{s.contentVersion='sr-content-future';},
  s=>{s.srWorld.version=9;},
  s=>{delete s.srWorld;},
 ]){
  const damaged=structuredClone(sr);change(damaged);const raw=JSON.stringify(damaged);
  assert.throws(()=>prepareMigration(raw,options),error=>error.code==='unsupported-version');
  assert.equal(JSON.stringify(damaged),raw);
 }
});
console.log(JSON.stringify({checks,passed:checks,scope:'Node loader version matrix and subversions; browser storage and later historical module provenance require separate acceptance'}));
