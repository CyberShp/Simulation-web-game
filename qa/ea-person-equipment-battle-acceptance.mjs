/** SR-XF-007-AC-02: earned equipment changes through an actual battle and return.
 * Supply a normal public-command checkpoint and an output directory outside the repo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness,normalFinishRevenge} from './ea-sr-integration-acceptance.mjs';
import {sceneEquipmentMounts} from '../dist/ea-courtyard-renderer.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';

const SOURCE=process.env.XIANFU_QA_SR007_AC02_SOURCE;
const OUTPUT=process.env.XIANFU_QA_SR007_AC02_DIR;
const MASTER='person:master';
const SWORD='item:sr-equipment:1';
const TRAVEL_ROBE='item:sr-equipment:2';
const PULSE_ROBE='item:sr-equipment:5';

function equipped(s,slot){return Object.values(s.itemsById).find(i=>i.location?.kind==='person'&&i.location.id===MASTER&&i.location.slot===slot);}
function snapshot(h){h.save();return {state:h.s,counts:h.counts};}
function assertIdentity(s,identity){
 const view=S.appearanceView(s,MASTER),mounts=sceneEquipmentMounts(s,MASTER);
 assert.equal(JSON.stringify({id:view.personId,sprite:view.spriteIndex,accent:view.accent,recipe:view.recipe,portrait:view.portraitKey}),identity);
 assert.deepEqual(mounts,view.mounts);
 for(const [slot,mount] of Object.entries(mounts)){
  const item=equipped(s,slot);
  assert.equal(mount.itemId,item?.id);
  assert.equal(mount.definitionId,item?.definitionId);
  assert.equal(item?.ownerId,MASTER);
  assert(item.condition>0);
 }
 const raw=JSON.stringify(s);
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(raw))),raw,'exact save/reload');
 assert.equal(JSON.stringify(s),raw,'read-only appearance and mount views');
 return mounts;
}

test('SR-XF-007-AC-02: public change, artifact, real combat and return keep one equipped identity',()=>{
 assert(SOURCE&&OUTPUT,'set XIANFU_QA_SR007_AC02_SOURCE and XIANFU_QA_SR007_AC02_DIR');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dir=resolve(OUTPUT),rel=relative(root,dir);
 assert(rel==='..'||rel.startsWith(`..${sep}`),'QA output belongs outside the repository');
 const record=JSON.parse(readFileSync(SOURCE,'utf8'));
 assert.equal(record.provenance?.kind,'normal-public-command-checkpoint');
 assert.equal(record.provenance?.label,'sr002-outbound-before');
 const h=harness(S.validateSave(record.state));
 const person=S.appearanceView(h.s,MASTER),identity=JSON.stringify({id:person.personId,sprite:person.spriteIndex,accent:person.accent,recipe:person.recipe,portrait:person.portraitKey});
 assert.equal(equipped(h.s,'weapon')?.id,SWORD);
 assert.equal(equipped(h.s,'armor')?.id,PULSE_ROBE);
 const before=snapshot(h),travelOrder=h.act('equipItem',TRAVEL_ROBE,'armor');
 h.until(s=>s.srEquipment.orders[travelOrder.orderId]?.phase==='completed','travel robe change',100);
 const garment=snapshot(h);
 assert.equal(equipped(garment.state,'armor')?.id,TRAVEL_ROBE);
 assert.equal(garment.state.itemsById[PULSE_ROBE].location.slot,undefined);
 const restore=h.act('equipItem',PULSE_ROBE,'armor');
 h.until(s=>s.srEquipment.orders[restore.orderId]?.phase==='completed','combat robe restore',100);
 h.save();
 const craft=h.act('craftEquipment','equipment:ward-seal');
 h.until(s=>s.srEquipment.orders[craft.orderId]?.phase==='completed','earned ward seal',1000);
 h.save();
 const seal=Object.values(h.s.itemsById).find(i=>i.definitionId==='equipment:ward-seal'&&i.ownerId===MASTER);
 assert(seal,'one actually crafted ward seal');
 const equipSeal=h.act('equipItem',seal.id,'artifact');
 h.until(s=>s.srEquipment.orders[equipSeal.orderId]?.phase==='completed','actual artifact equip',100);
 const artifact=snapshot(h);
 assert.equal(equipped(artifact.state,'artifact')?.id,seal.id);
 h.resources({jade:40,food:100,herb:20,wood:15,stone:15});h.rest();
 h.travel('scene:market',{cargo:{jade:35,food:80,herb:12,wood:12,stone:12}});
 h.worldWalk(12.5,16);h.act('srWorldCommand',{action:'investigate',sourceId:'object:market:ledger'});
 h.until(s=>!s.srWorld.interaction,'actual ledger investigation');h.save();
 h.travel('scene:quarry');h.worldWalk(13.5,16);
 h.act('srWorldCommand',{action:'investigate',sourceId:'object:quarry:artisan'});
 h.until(s=>!s.srWorld.interaction,'actual artisan testimony');h.save();
 let battle=null;const save=h.save;
 h.save=()=>{save();if(!battle&&h.s.combat?.status==='active'&&h.s.story.revenge.activeEncounter?.personId==='person:shao-heng')battle={state:h.s,counts:h.counts};};
 const finished=normalFinishRevenge(h);
 assert(battle,'actual public first battle checkpoint');
 const returned={state:finished.completedH.s,counts:finished.completedH.counts};
 assert.equal(returned.state.master.position.sceneId,'scene:yunxiu-courtyard');
 assert.equal(returned.state.story.completed,true);
 assert.equal(returned.state.combat??null,null,'completed combat is acknowledged on return');
 assert.match(returned.state.story.revenge.settled['person:shao-heng'],/^fact:death:/);
 for(const [name,entry] of Object.entries({before,garment,artifact,battle,returned})){
  const mounts=assertIdentity(entry.state,identity);
  assert.equal(mounts.weapon?.itemId,SWORD,`${name}: same actual sword`);
  assert.equal(mounts.armor?.itemId,name==='garment'?TRAVEL_ROBE:PULSE_ROBE,`${name}: real armor slot`);
  assert.equal(mounts.artifact?.itemId,['artifact','battle','returned'].includes(name)?seal.id:undefined,`${name}: actual artifact only after equip`);
 }
 assert.equal(battle.state.combat.player.personId,MASTER);
 assert.equal(S.viewSRCombat(battle.state).equipmentDamageMultiplier,.85);
 mkdirSync(dir,{recursive:true});
 const persistence=createEAPersistence({validate:S.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr007-ac02',now:()=>Date.now()});
 for(const [name,entry] of Object.entries({before,garment,artifact,battle,returned})){
  writeFileSync(resolve(dir,`person-${name}.json`),JSON.stringify({provenance:{kind:'normal-public-command-checkpoint',label:`SR-XF-007-AC-02 ${name}`,source:SOURCE,counts:entry.counts},state:entry.state}));
  writeFileSync(resolve(dir,`person-${name}-import.json`),persistence.exportState(entry.state,{slot:1}));
 }
});
