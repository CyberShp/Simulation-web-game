/** SR-XF-007-AC-01: three earned courtyard identities retain their activities and saved appearance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../../src/simulation/ea-opening-sim.mjs';
import {createEAPersistence} from '../../src/simulation/ea-persistence.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

test('SR-XF-007-AC-01: three public opening identities preserve their distinct appearance and saved activity',t=>{
 const h=normalOpening();h.walk(40,35);assert.equal(h.s.master.scenic.path.length,0);assert.equal(S.appearanceView(h.s,'person:master').action,'groundRest');h.save();const lumber=h.s.buildings.find(b=>b.type==='lumber');assert.equal(h.act('inviteWork','person:lu-zhiwei',lumber.instanceId).accepted,true);h.until(s=>s.activitiesById[s.personsById['person:lu-zhiwei'].activityId]?.phase==='executing','actual outdoor work arrival',500);assert.equal(h.act('inviteWork','person:lin-changfeng',lumber.instanceId).accepted,true);h.until(s=>{const p=s.personsById['person:lin-changfeng'],a=s.activitiesById[p.activityId];return a?.targetId===lumber.instanceId&&['waiting','executing'].includes(a.phase)&&!p.mind.scenic.path.length&&p.mind.scenic.y>12;},'second outdoor worker arrival',500);h.act('setSpeed',0);h.save();assert(h.s.master.scenic.path.length>0);assert.equal(S.appearanceView(h.s,'person:master').action,'walk');
 const ids=['person:master',...h.s.homeMemberIds],saved=JSON.stringify(h.s);
 assert.equal(ids.length,3);assert.equal(new Set(ids.map(id=>S.appearanceView(h.s,id).spriteIndex)).size,3);
  const output=process.env.XIANFU_QA_PERSON_DIR;
  if(output){const dir=resolve(output),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),rel=relative(root,dir);assert(rel==='../..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'QA saves belong outside the repository');mkdirSync(dir,{recursive:true});const persistence=createEAPersistence({validate:S.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr007-ac01',now:()=>Date.now()});writeFileSync(resolve(dir,'sr007-three-people-import.json'),persistence.exportState(h.s,{slot:1}));}
 for(const id of ids)assert.equal(S.appearanceView(h.s,id).personId,id);
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);
 assert.equal(JSON.stringify(h.s),saved);
 t.diagnostic(`public commands ${h.counts.commands}, exact save/reloads ${h.counts.saves}, world tick ${h.s.worldTick}; identities ${ids.map(id=>h.s.personsById[id].name).join('、')}`);
});
