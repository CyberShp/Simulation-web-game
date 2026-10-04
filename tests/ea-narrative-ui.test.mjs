import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sim from '../dist/ea-sim.mjs';
import { createEAUI } from '../dist/ea-ui.mjs';

// Real UI event handlers with a minimal template recorder. This verifies command
// plumbing and read state only, without browser layout/FPS claims or long runs.
function harness(state,extra={}) {
  const nodes=new Map(),listeners=new Map(),fragments=[],commands=[],notices=[];
  const makeNode=()=>({childNodes:[],textContent:'',scrollTop:0,dataset:{},style:{},open:false,
    classList:{toggle(){},add(){},remove(){},contains(){return false;}},
    setAttribute(){},removeAttribute(){},scrollIntoView(){},querySelectorAll(){return [];},
    addEventListener(name,handler){this.events??={};this.events[name]=handler;}});
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,makeNode());return nodes.get(selector);};
  globalThis.window={matchMedia:()=>({matches:false})};
  globalThis.document={activeElement:null,body:makeNode(),querySelector:node,querySelectorAll:()=>[],getElementById:id=>node('#'+id),
    createElement(name){assert.equal(name,'template');return {set innerHTML(html){fragments.push(html);},content:{childNodes:[]}};},
    addEventListener(name,handler){listeners.set(name,handler);}};
  let body='';
  const close=()=>{node('#modal').open=false;node('#modal').events?.close?.();};
  const ui=createEAUI({getState:()=>state,getTab:()=>'self',setTab(){},getScene:()=>'map',getSelection:()=>null,
    act(name,...args){commands.push({name,args:structuredClone(args)});return sim[name](state,...args);},
    openModal(title,html){node('#modal').open=true;node('#modal-title').textContent=title;body=html;},closeModal:close,toast:text=>notices.push(text),...extra});
  function click(action,args=[]) {
    const button={disabled:false,dataset:{uiAction:action,uiArgs:JSON.stringify(args)}};
    listeners.get('click')({target:{closest:selector=>selector==='[data-ui-action]'?button:null},preventDefault(){}});
  }
  function buttonArgs(action,last=false){const matches=[...body.matchAll(new RegExp(`data-ui-action="${action}" data-ui-args="([^"]+)"`,'g'))],match=last?matches.at(-1):matches[0];assert.ok(match,`rendered ${action} button`);return JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));}
  return {ui,state,node,commands,notices,click,close,buttonArgs,get body(){return body;},fragments};
}
function healedWorld(){const s=sim.initial();sim.acknowledgeIntro(s);sim.masterAction(s,'heal');for(let i=0;s.master.wound&&i<100;i++)sim.tick(s,1);assert.equal(s.master.wound,0);return s;}

test('real intro skip handler acknowledges intro once without advancing the story',()=>{
  const h=harness(sim.initial()),before=structuredClone(h.state);h.ui.openPrologue();
  assert.ok(h.node('#modal').open);h.click('beginChapter',['skip']);
  assert.equal(h.state.story.intro,true);assert.equal(h.state.story.step,0);
  assert.deepEqual(h.state.resources,before.resources);
  assert.equal(h.node('#modal').open,false);
  assert.deepEqual(h.commands.map(c=>c.name),['acknowledgeIntro']);
});

test('actual narrative page handler persists a resumable cursor and finish only acknowledges prose',()=>{
  const s=healedWorld();sim.advanceStory(s);const h=harness(s),before=structuredClone(s);
  h.ui.maybeNarrative();assert.equal(h.node('#modal').open,true);
  assert.equal(s.story.narrative.cursor.id,'chapter:1');
  h.click('narrativePage',h.buttonArgs('narrativePage'));
  assert.deepEqual(s.story.narrative.cursor,{id:'chapter:1',page:1});
  assert.deepEqual(sim.validateSave(s).story.narrative.cursor,s.story.narrative.cursor);
  h.click('narrativeFinish',h.buttonArgs('narrativeFinish'));
  assert.equal(h.node('#modal').open,false);assert.ok(s.story.narrative.acknowledged.includes('chapter:1'));
  h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  assert.deepEqual(s.resources,before.resources);assert.equal(s.story.step,before.story.step);
  assert.deepEqual(s.story.claimed,before.story.claimed);
});

test('home dialogue encodes an argument array and invokes the authoritative gift command once',()=>{
  const s=healedWorld();sim.advanceStory(s);const h=harness(s),herb=s.resources.herb;
  h.ui.openHomeInteraction();assert.match(h.body,/陆知微/);
  const args=h.buttonArgs('homeChoice');assert.deepEqual(args,[[]]);
  h.click('homeChoice',args);
  assert.equal(s.story.step,2);assert.equal(s.resources.herb,herb-10);
  assert.equal(s.disciples.filter(d=>d.name==='陆知微').length,1);
  assert.deepEqual(h.commands.at(-1),{name:'advanceStory',args:[]});
});

test('archive review never writes a page or repeats the campaign result',()=>{
  const s=healedWorld();sim.advanceStory(s);sim.acknowledgeNarrative(s,'chapter:1');
  const h=harness(s),before=structuredClone(s);h.click('narrativeReview',['chapter:1']);
  h.click('narrativePage',h.buttonArgs('narrativePage'));h.click('narrativeFinish',h.buttonArgs('narrativeFinish'));
  assert.deepEqual(s,before);assert.equal(h.commands.length,0);
});

test('closing the introductory dialog acknowledges skipping instead of disabling later chapter scenes',()=>{
  const h=harness(sim.initial());h.ui.openPrologue();h.close();
  assert.equal(h.state.story.intro,true);
  assert.equal(h.state.story.step,0);
  assert.deepEqual(h.commands.map(c=>c.name),['acknowledgeIntro']);
});

test('closing an unread scene leaves it resumable without forcing an immediate reopen loop',()=>{
  const s=healedWorld();sim.advanceStory(s);const h=harness(s);h.ui.maybeNarrative();
  h.click('narrativePage',h.buttonArgs('narrativePage'));h.close();
  const writes=h.commands.length;
  for(let i=0;i<20;i++)h.ui.maybeNarrative();
  assert.equal(h.node('#modal').open,false);assert.equal(h.commands.length,writes);
  assert.deepEqual(s.story.narrative.cursor,{id:'chapter:1',page:1});
  assert.ok(!s.story.narrative.acknowledged.includes('chapter:1'));
  h.ui.resetNarrative();h.ui.maybeNarrative();
  assert.equal(h.node('#modal').open,true);assert.match(h.body,/2 \/ 2/);
});

test('a resumed cursor takes precedence over an earlier dismissed unread chapter after world reopen',()=>{
  const s=healedWorld();sim.advanceStory(s);const h=harness(s);h.ui.maybeNarrative();h.close();
  sim.advanceStory(s);h.ui.maybeNarrative();
  assert.equal(s.story.narrative.cursor.id,'chapter:2');
  h.click('narrativePage',h.buttonArgs('narrativePage'));h.close();
  const retained=sim.validateSave(s).story.narrative.cursor;
  assert.deepEqual(retained,{id:'chapter:2',page:1});
  h.ui.resetNarrative();h.ui.maybeNarrative();
  assert.deepEqual(s.story.narrative.cursor,retained);
  assert.match(h.body,/陆知微|留下/);
});

test('both ending dialogue buttons spread their actual encoded argument into the campaign and show its response',()=>{
  // A retained completed reference world provides an adversarial UI fixture at
  // the ending gate. This is argument/reward verification, not a new playthrough.
  const input=JSON.parse(readFileSync(new URL('../qa/ea-reference-world.json',import.meta.url),'utf8'));
  for(const choice of ['rebuild','return']) {
    const s=sim.validateSave(input.state||input);
    s.story.step=9;s.story.completed=false;s.story.ending=null;
    s.story.claimed=s.story.claimed.filter(id=>id!=='story:9');
    s.story.narrative.acknowledged=s.story.narrative.acknowledged.filter(id=>!id.startsWith('ending:'));
    s.story.narrative.cursor=null;
    sim.acknowledgeIntro(s);
    sim.validateSave(s);
    const h=harness(s),resources={...s.resources};h.ui.openHomeInteraction();
    const matches=[...h.body.matchAll(/data-ui-action="homeChoice" data-ui-args="([^"]+)"/g)];
    const args=matches.map(m=>JSON.parse(m[1].replaceAll('&quot;','"'))).find(args=>args[0][0]===choice);
    assert.deepEqual(args,[[choice]]);h.click('homeChoice',args);
    assert.equal(s.story.ending,choice);assert.equal(s.story.completed,true);assert.equal(s.story.step,10);
    assert.deepEqual(h.commands.at(-1),{name:'advanceStory',args:[choice]});
    h.ui.maybeNarrative();assert.equal(s.story.narrative.cursor.id,`ending:${choice}`);
    assert.match(h.body,choice==='rebuild'?/重新有人烟/:/传承从来不只/);
    h.click('narrativePage',h.buttonArgs('narrativePage'));assert.match(h.body,/同道|传承|护脉|退路/);
    h.click('narrativePage',h.buttonArgs('narrativePage',true));assert.match(h.body,/复仇大篇章已经结束/);
    h.click('narrativeFinish',h.buttonArgs('narrativeFinish'));
    assert.deepEqual(s.resources,resources);sim.validateSave(s);
  }
});

function pendingInvestigation(){const saved=JSON.parse(readFileSync(new URL('../qa/ea-pending-world.json',import.meta.url),'utf8'));return sim.validateSave(saved.state||saved);}

test('locate landmark delegates to the app approach flow without issuing a duplicate UI movement',()=>{
  const s=pendingInvestigation(),before=structuredClone(s);let calls=0;
  const h=harness(s,{approachRegion(){calls++;}});h.click('locateLandmark');
  assert.equal(calls,1);assert.deepEqual(h.commands,[]);
  assert.deepEqual(s,before,'arrival scheduling belongs to the app and does not rewrite campaign choices');
});

test('already-near landmark handoff opens the actual scene dialogue and retains its original authoritative choice',()=>{
  const s=pendingInvestigation();sim.trade(s,'herb','sell',sim.day(s),2);assert.equal(sim.explorationOptions(s).active.canInteract,true);
  let calls=0;const h=harness(s,{approachRegion(){calls++;h.ui.openRegionInteraction();}});
  const before=structuredClone(s);h.click('locateLandmark');
  assert.equal(calls,1);assert.equal(h.node('#modal').open,true);assert.deepEqual(h.commands,[]);assert.deepEqual(s,before);
  assert.match(h.body,/旧商号掌柜/);
  const args=h.buttonArgs('regionChoice'),original=sim.explorationOptions(s).active.choices.find(c=>c.id===args[0]);
  assert.equal(original.disabled,false);h.click('regionChoice',args);
  assert.deepEqual(h.commands,[{name:'resolveExploration',args}]);
  assert.ok(s.story.clues.includes('ledger'));assert.equal(s.world.exploration.resolved,true);
  for(const [resource,amount]of Object.entries(original.cost))assert.equal(s.resources[resource],before.resources[resource]-amount);
});

test('walk-near scene button closes its modal and uses the same app approach callback without rewriting the current event',()=>{
  const s=pendingInvestigation();s.world.exploration.position={x:1.3,y:4};s.world.exploration.target=null;
  sim.validateSave(s);let calls=0;const h=harness(s,{approachRegion(){calls++;}}),before=structuredClone(s);
  h.ui.openRegionInteraction();assert.match(h.body,/沿路走近此处/);
  h.click('regionApproach',h.buttonArgs('regionApproach'));
  assert.equal(calls,1);assert.equal(h.node('#modal').open,false);assert.deepEqual(h.commands,[]);assert.deepEqual(s,before);
});

test('dynamic next-step journey guidance also hands off to the app arrival/dialogue flow',()=>{
  const s=pendingInvestigation(),before=structuredClone(s);let calls=0;
  const h=harness(s,{approachRegion(){calls++;}});h.click('guideNext');
  assert.equal(calls,1);assert.deepEqual(h.commands,[]);assert.deepEqual(s,before);
});
