import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {discipleDevelopmentView} from '../../../src/simulation/ea-disciple-development.mjs';
import {beginPersonBreakthrough} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {renderPersonDevelopment} from '../../../apps/courtyard/courtyard-development-panel.mjs';

function fixture(){const session=createSectSession(),s=session.state,p=s.personsById[s.homeMemberIds[0]];s.master.scenic.x=p.mind.scenic.x;s.master.scenic.y=p.mind.scenic.y;return {session,s,p};}
const member=(s,p)=>discipleDevelopmentView(s).members.find(m=>m.personId===p.personId);
test('cultivation projection preserves state, exposes the actual shortage and survives save/reopen',()=>{
 const {session,s,p}=fixture();p.xp=24.75;s.resources.jade=0;
 const before=snapshotSect(session),view=member(s,p).cultivation;
 assert.equal(view.xp,24.75);assert.equal(view.required,100);assert.equal(view.realm,'炼气1层');
 assert(view.conditions.some(c=>c.includes('修为积累')));assert.deepEqual(view.materials.find(m=>m.id==='jade'),{id:'jade',label:'灵石',required:24,available:0});
 assert.deepEqual(snapshotSect(session),before);assert.deepEqual(member(restoreSect(before).state,p).cultivation,view);
});
test('cultivation details remain unavailable when the person cannot be consulted',()=>{
 const {s,p}=fixture();s.master.position.sceneId='scene:valley';assert.equal(member(s,p).contact.available,false);assert.equal(member(s,p).cultivation,undefined);
});
test('an ongoing breakthrough reports its real stage without requesting its reserved costs again',()=>{
 // Explicit isolated fixture with the existing material requirement available.
 const {s,p}=fixture();p.xp=100;p.energy=100;p.wound=0;s.resources.jade=24;s.resources.herb=8;
 const {orderId}=beginPersonBreakthrough(s,p.personId,{autonomous:true});
 const before=JSON.stringify(s),view=member(s,p).cultivation,order=s.srCultivation.orders[orderId];
 assert.equal(view.breakthrough.progress,order.progressTicks);assert.equal(view.breakthrough.total,180);assert.equal(view.breakthrough.reason,order.reason);
 assert.deepEqual(view.conditions,[]);assert.deepEqual(view.materials,[]);assert.equal(JSON.stringify(s),before);
});
test('person panel makes growth and missing materials readable without offering forced cultivation',()=>{
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};}append(...nodes){this.children.push(...nodes);}}
 const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const {s,p}=fixture();p.xp=24.75;s.resources.jade=0;const parent=new Element('div');renderPersonDevelopment(parent,{member:member(s,p),recommend(){}});
  const all=n=>[n,...n.children.flatMap(all)],nodes=all(parent),progress=nodes.find(n=>n.dataset.uiKey==='person:cultivation-progress');
  assert(progress);const text=all(progress).map(n=>n.textContent||'').join(' ');assert.match(text,/24.8 \/ 100/);assert.match(text,/突破所需灵石 24，公库现有 0，尚缺 24/);assert(!all(progress).some(n=>n.tagName==='button'));
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
