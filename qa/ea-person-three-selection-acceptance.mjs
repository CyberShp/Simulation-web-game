/** SR-XF-007-AC-01: three earned courtyard identities in the production Canvas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {registerCultivatorAtlas, registerCultivatorActivityAtlas, registerCultivatorRestAtlas} from '../dist/ea-character-art.mjs';

test('SR-XF-007-AC-01: production Canvas selects three public opening identities without changing their activity',async t=>{
 const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas');
 const h=normalOpening();h.walk(40,35);assert.equal(h.s.master.scenic.path.length,0);assert.equal(S.appearanceView(h.s,'person:master').action,'groundRest');h.save();const lumber=h.s.buildings.find(b=>b.type==='lumber');assert.equal(h.act('inviteWork','person:lu-zhiwei',lumber.instanceId).accepted,true);h.until(s=>s.activitiesById[s.personsById['person:lu-zhiwei'].activityId]?.phase==='executing','actual outdoor work arrival',500);assert.equal(h.act('inviteWork','person:lin-changfeng',lumber.instanceId).accepted,true);h.until(s=>{const p=s.personsById['person:lin-changfeng'],a=s.activitiesById[p.activityId];return a?.targetId===lumber.instanceId&&['waiting','executing'].includes(a.phase)&&!p.mind.scenic.path.length&&p.mind.scenic.y>12;},'second outdoor worker arrival',500);h.act('setSpeed',0);h.save();assert(h.s.master.scenic.path.length>0);assert.equal(S.appearanceView(h.s,'person:master').action,'walk');
 const ids=['person:master',...h.s.homeMemberIds],saved=JSON.stringify(h.s);
 assert.equal(ids.length,3);assert.equal(new Set(ids.map(id=>S.appearanceView(h.s,id).spriteIndex)).size,3);
 const previous=Object.fromEntries(['Image','fetch','devicePixelRatio','document','ResizeObserver'].map(key=>[key,globalThis[key]]));
 globalThis.Image=class extends Image{set src(value){if(value)queueMicrotask(()=>{super.src=value.startsWith('file:')?fileURLToPath(value):value;});}};
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(fileURLToPath(url),'utf8'))});
 globalThis.devicePixelRatio=1;
 globalThis.document={createElement:()=>createCanvas(1,1),getElementById:()=>({classList:{toggle(){}}})};
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 const canvas=createCanvas(1366,900);canvas.clientWidth=1366;canvas.clientHeight=900;
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:900});
 let selected=null,renderer;
 try{
  renderer=createWorldRenderer(canvas,{getState:()=>h.s,getMode:()=> 'inspect',getSelection:()=>selected,getAppearance:S.appearanceView,getPrefs:()=>({reducedMotion:true}),getCampaignScene:()=>null});
  await renderer.ready;
  assert.equal(renderer.loadingState().assets.people.status,'loaded');
  renderer.focusScenic(32,26);renderer.setZoom(1);
  const output=process.env.XIANFU_QA_PERSON_DIR;
  if(output){const dir=resolve(output),root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),rel=relative(root,dir);assert(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'QA images belong outside the repository');mkdirSync(dir,{recursive:true});const persistence=createEAPersistence({validate:S.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr007-ac01',now:()=>Date.now()});writeFileSync(resolve(dir,'sr007-three-people-import.json'),persistence.exportState(h.s,{slot:1}));}
  for(const id of ids){
   const person=h.s.personsById[id],sceneId=id==='person:master'?'master':person.id,position=person.scenic||person.mind?.scenic;
   selected={kind:'person',id:sceneId};renderer.render(0,true);
   const foot=renderer.projectPoint(position),hit=renderer.pick({clientX:foot.x,clientY:foot.y});
   assert((hit.candidates||[hit]).some(candidate=>candidate.id===sceneId),`${person.name} remains selectable at the actual foot point`);
   assert.equal(S.appearanceView(h.s,id).personId,id);
   if(output)writeFileSync(resolve(output,`sr007-${sceneId}.png`),canvas.toBuffer('image/png'));
  }
  assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);
  assert.equal(JSON.stringify(h.s),saved);
  t.diagnostic(`public commands ${h.counts.commands}, exact save/reloads ${h.counts.saves}, world tick ${h.s.worldTick}; selected ${ids.map(id=>h.s.personsById[id].name).join('、')}`);
 }finally{
  renderer?.destroy();registerCultivatorAtlas(null);registerCultivatorActivityAtlas(null);registerCultivatorRestAtlas(null);
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
});
