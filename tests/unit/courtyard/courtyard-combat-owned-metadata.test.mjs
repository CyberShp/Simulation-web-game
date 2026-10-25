import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSectCommandDriver,commandSect,restoreSect,snapshotSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';

// An attested native source can be selected for the same component assertions.
// The default remains the repository's explicit group component fixture.
const native=process.env.IMMORTAL_OWNED_SOURCE?JSON.parse(fs.readFileSync(process.env.IMMORTAL_OWNED_SOURCE,'utf8')):buildCombatGroupComponent().native;
const bytes=s=>JSON.stringify(snapshotSect(s));
function pair(){
 const owned=restoreSect(native),ordinary=restoreSect(native);
 // Metadata-only isolation probe; no character, resource or world edits.
 for(const s of [owned,ordinary])s.metadataIsolationProbe={nested:{entries:[1,2,3]}};
 const command=createSectCommandDriver(()=>owned);command.adopt();return {owned,ordinary,command};
}
const equal=p=>assert.equal(bytes(p.owned),bytes(p.ordinary),'complete saved session bytes differ from the public gateway');

test('owned combat reuses only provenance, clones all mutable metadata and retains one complete world draft',()=>{
 const p=pair(),before={...p.owned},ordinaryProvenance=p.ordinary.provenance,provenanceBytes=JSON.stringify(before.provenance),clone=globalThis.structuredClone,inputs=[];
 globalThis.structuredClone=(value,...args)=>{inputs.push(value);return clone(value,...args);};
 let actual;try{actual=p.command({type:'combat',actionId:'guard'});}finally{globalThis.structuredClone=clone;}
 const expected=commandSect(p.ordinary,{type:'combat',actionId:'guard'});assert(actual.ok,actual.error);assert.deepEqual(actual,expected);equal(p);
 assert.equal(p.owned.provenance,before.provenance);assert.notEqual(p.ordinary.provenance,ordinaryProvenance,'public commands retain their full trial isolation');assert.equal(JSON.stringify(p.owned.provenance),provenanceBytes);
 const metadata=inputs.find(v=>v?.format===p.owned.format&&!Object.hasOwn(v,'state'));assert(metadata);assert.equal(Object.hasOwn(metadata,'provenance'),false);assert.equal(inputs.filter(v=>v?.schemaVersion===6).length,1);
 for(const key of ['policy','control','budget','automation','ledger','totals','baseline','metadataIsolationProbe'])assert.notEqual(p.owned[key],before[key],key+' must retain a separate mutable trial');
 assert.notEqual(p.owned.metadataIsolationProbe.nested,before.metadataIsolationProbe.nested);assert.notEqual(p.owned.metadataIsolationProbe.nested.entries,before.metadataIsolationProbe.nested.entries);
 p.owned.metadataIsolationProbe.nested.entries.push(4);assert.deepEqual(before.metadataIsolationProbe.nested.entries,[1,2,3]);p.owned.metadataIsolationProbe.nested.entries.pop();equal(p);
 const saved=snapshotSect(p.owned);saved.provenance.kind='edited returned snapshot';assert.equal(JSON.stringify(p.owned.provenance),provenanceBytes);const projected=viewSect(p.owned);projected.provenance.kind='edited returned view';assert.equal(JSON.stringify(p.owned.provenance),provenanceBytes);assert.equal(bytes(restoreSect(snapshotSect(p.owned))),bytes(p.owned));
});

test('a real busy-action refusal preserves every metadata reference and the complete saved session',()=>{
 const p=pair();for(const s of [p.owned,p.ordinary])assert(commandSect(s,{type:'combat',actionId:'guard'}).ok);const before=bytes(p.owned),references={...p.owned},request={type:'combat',actionId:'attack',target:{x:p.owned.state.combat.player.x+1,y:p.owned.state.combat.player.y}},actual=p.command(request),expected=commandSect(p.ordinary,request);
 assert.equal(actual.ok,false);assert.deepEqual(actual,expected);assert.match(actual.error,/起手|收势|冷却/);assert.equal(bytes(p.owned),before);equal(p);for(const key of Object.keys(references))assert.equal(p.owned[key],references[key],key+' escaped failed-transaction rollback');
});

test('housing corruption is still rejected by both gateways without changing the supplied world',()=>{
 const input=SIM.cloneState(restoreSect(native).state);input.residentialHousing={version:'invalid',activatedAtTick:input.worldTick,recordsByPersonId:{}};const before=JSON.stringify(input),request={name:'combatAction',args:['guard'],id:'command:'+input.transactions.nextCommandId,expectedRevision:input.revision};
 let ordinary,owned;try{SIM.dispatchCommand(input,request);}catch(error){ordinary=error.message;}try{SIM.dispatchOwnedCombatCommand(input,request);}catch(error){owned=error.message;}
 assert(ordinary);assert.equal(owned,ordinary);assert.match(owned,/住宅|residentialHousing|版本/);assert.equal(JSON.stringify(input),before);
});
