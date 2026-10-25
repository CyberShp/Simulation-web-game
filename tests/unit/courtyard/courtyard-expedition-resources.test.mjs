import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {expeditionResourceOptions,createExpeditionResources} from '../../../apps/courtyard/courtyard-expedition-resources.mjs';
const PARTY='stockpile:sr-party',HOME='stockpile:yunxiu';
function send(r,action){const result=commandSect(r,{type:'world',action});assert.equal(result.ok,true,result.error);return result.result;}
function until(r,p,label,max=2000){for(let i=0;i<max&&!p();i++)advanceSect(r,.1);assert.ok(p(),label);}
function option(r){return expeditionResourceOptions(viewSect(r).expedition.world)[0];}
function valley(){const r=createSectSession();send(r,{action:'travel',destination:'scene:valley',cargo:{food:8}});until(r,()=>!r.state.srWorld.activeTravelId,'arrived valley');return r;}
function approach(r){const o=option(r);send(r,o.approach);until(r,()=>!r.state.srWorld.interaction,'walk finished');assert.equal(option(r).canGather,true);}
function harvest(r){send(r,option(r).gather);until(r,()=>!r.state.srWorld.interaction,'gather finished');}
test('public gather requires proximity and thirty real world ticks; active gather rejects reentry',()=>{
 const r=valley(),far=option(r);assert.equal(far.canGather,false);assert.equal(far.canApproach,true);
 const before=structuredClone(r.state);const denied=commandSect(r,{type:'world',action:far.gather});assert.equal(denied.ok,false);assert.deepEqual(r.state,before);
 approach(r);const start=r.state.worldTick,bag=r.state.stockpilesById[PARTY].resources.herb;
 send(r,option(r).gather);assert.equal(option(r).canGather,false);
 const busy=structuredClone(r.state);assert.equal(commandSect(r,{type:'world',action:option(r).gather}).ok,false);assert.deepEqual(r.state,busy);
 for(let i=0;i<29;i++)advanceSect(r,.1);assert.equal(r.state.worldTick,start+29);assert.equal(r.state.stockpilesById[PARTY].resources.herb,bag);
 advanceSect(r,.1);assert.equal(r.state.stockpilesById[PARTY].resources.herb,bag+6);assert.equal(option(r).remaining,12);
});
test('paused in-progress save preserves progress and completion is not repeated by reload',()=>{
 let r=valley();approach(r);send(r,option(r).gather);for(let i=0;i<12;i++)advanceSect(r,.1);
 r.state.speed=0;const saved=snapshotSect(r);r=restoreSect(saved);advanceSect(r,10);assert.deepEqual(snapshotSect(r),saved);
 r.state.speed=1;until(r,()=>!r.state.srWorld.interaction,'resumed gather');const herbs=r.state.stockpilesById[PARTY].resources.herb;
 r=restoreSect(snapshotSect(r));for(let i=0;i<30;i++)advanceSect(r,.1);assert.equal(r.state.stockpilesById[PARTY].resources.herb,herbs);assert.equal(herbs,6);assert.equal(option(r).remaining,12);
});
test('finite patch exhaustion agrees with resource controls and returned harvest uses actual transport',()=>{
 const r=valley();approach(r);for(let n=0;n<3;n++)harvest(r);
 assert.equal(option(r).remaining,0);assert.equal(option(r).canGather,false);assert.equal(option(r).canApproach,false);
 assert.equal(commandSect(r,{type:'world',action:option(r).gather}).ok,false);assert.equal(r.state.stockpilesById[PARTY].resources.herb,18);
 send(r,{action:'travel',destination:'scene:yunxiu-courtyard'});until(r,()=>!r.state.srWorld.activeTravelId,'arrived home');
 const home=r.state.stockpilesById[HOME].resources.herb,result=commandSect(r,{type:'transport',sourceStockpileId:PARTY,targetStockpileId:HOME,cargo:{herb:18}});
 assert.equal(result.ok,true,result.error);const id=result.result.id;assert.equal(r.state.stockpilesById[HOME].resources.herb,home);
 until(r,()=>r.state.workOrdersById[id].phase==='delivered','harvest delivered');assert.equal(r.state.stockpilesById[PARTY].resources.herb,0);assert.equal(r.state.stockpilesById[HOME].resources.herb,home+18);
});

test('resource control rendering and stale handlers recheck the current world',()=>{
 // Minimal DOM component fixture exercises actual handlers; browser rendering is separate.
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};}append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}setAttribute(){}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}}
 const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const r=valley(),parent=new Element('div'),calls=[];let world=viewSect(r).expedition.world;
  const component=createExpeditionResources(parent,{getWorld:()=>world,command:request=>calls.push(request)});component.render();
  const section=parent.children[0],row=section.children[0],approachButton=row.children[1],gatherButton=row.children[2];
  assert.equal(section.hidden,false);assert.equal(approachButton.disabled,false);assert.equal(gatherButton.disabled,true);
  approachButton.onclick();assert.deepEqual(calls.pop(),option(r).approach);
  approach(r);world=viewSect(r).expedition.world;component.render();assert.equal(gatherButton.disabled,false);assert.equal(approachButton.disabled,true);
  gatherButton.onclick();assert.deepEqual(calls.pop(),option(r).gather);
  world={...world,activity:{kind:'interact'}};gatherButton.onclick();assert.equal(calls.length,0,'a stale enabled button cannot submit during gathering');component.render();assert.equal(gatherButton.disabled,true);
  world={...world,activity:null,scene:{...world.scene,objects:world.scene.objects.map(object=>({...object,resourceRemaining:0}))}};component.render();assert.equal(gatherButton.disabled,true);assert.match(row.children[3].textContent,/余量不足/);
  world={scene:{id:'scene:yunxiu-courtyard'}};component.render();assert.equal(section.hidden,true);assert.equal(section.children.length,0);
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
