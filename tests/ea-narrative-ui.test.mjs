import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sim from '../dist/ea-sim.mjs';
import { Player } from '../qa/ea-player.mjs';
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
  let body='',now=0;
  const close=()=>{node('#modal').open=false;node('#modal').events?.close?.();};
  const ui=createEAUI({now:()=>now,getState:()=>state,getTab:()=>'self',setTab(){},getScene:()=>'map',getSelection:()=>null,
    act(name,...args){commands.push({name,args:structuredClone(args)});return sim[name](state,...args);},
    openModal(title,html){node('#modal').open=true;node('#modal-title').textContent=title;body=html;},closeModal:close,toast:text=>notices.push(text),...extra});
  function click(action,args=[]) {
    const button={disabled:false,dataset:{uiAction:action,uiArgs:JSON.stringify(args)}};
    listeners.get('click')({target:{closest:selector=>selector==='[data-ui-action]'?button:null},preventDefault(){}});
  }
  function buttonArgs(action,last=false){const matches=[...body.matchAll(new RegExp(`data-ui-action="${action}" data-ui-args="([^"]+)"`,'g'))],match=last?matches.at(-1):matches[0];assert.ok(match,`rendered ${action} button`);return JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));}
  return {event:(name,value)=>listeners.get(name)?.(value),advanceClock:ms=>{now+=ms;},ui,state,node,commands,notices,click,close,buttonArgs,get body(){return body;},fragments};
}
function healedWorld(){const s=sim.initial();sim.acknowledgeIntro(s);sim.masterAction(s,'heal');for(let i=0;s.master.wound&&i<100;i++)sim.tick(s,1);assert.equal(s.master.wound,0);return s;}

test('opening next button approaches the real main-house story point without remotely gifting or advancing',()=>{
 const s=healedWorld();sim.advanceStory(s);const before=structuredClone(s),calls=[];
 const h=harness(s,{interact:(...args)=>{calls.push(args);return {ready:false};}});h.click('guideNext');
 assert.deepEqual(calls,[['building',s.buildings[0].id,'story']]);assert.deepEqual(s,before);assert.equal(h.commands.length,0);
});
test('newcomer skips remain guided, while explicitly showing every system restores the full hero controls',()=>{
 const h=harness(sim.initial());h.ui.openPrologue();h.click('beginChapter',['skip']);h.ui.renderTab();
 assert.ok(h.fragments.at(-1).includes('母亲另包了一剂备用药'));assert.ok(!h.fragments.at(-1).includes('稳妥突破'));
 h.click('allSystems');h.ui.renderTab();assert.ok(h.fragments.at(-1).includes('稳妥突破'));
 assert.equal(h.state.story.step,0);assert.equal(h.state.story.intro,true);
});
test('intro next button records the actual page for a reload and never repeats costs',()=>{
 const h=harness(sim.initial()),before=structuredClone(h.state.resources);h.ui.openPrologue();
 h.click('prologue',h.buttonArgs('prologue'));assert.equal(h.state.story.onboarding.introPage,1);
 assert.deepEqual(sim.validateSave(h.state).story.onboarding.introPage,1);assert.deepEqual(h.state.resources,before);assert.equal(h.state.story.intro,false);
});
test('queued native close from a previous dialog cannot acknowledge a reopened prologue',()=>{
 const h=harness(sim.initial());h.ui.openPrologue(1);h.node('#modal').events.close();
 assert.equal(h.state.story.intro,false);assert.equal(h.state.story.onboarding.introPage,1);
 assert.equal(h.node('#modal').open,true);assert.equal(h.commands.filter(c=>c.name==='acknowledgeIntro').length,0);
 h.close();assert.equal(h.state.story.intro,true);
});
test('memory opening explains export and each page reflects the actual sound preference',()=>{
 let sound=false;const h=harness(sim.initial(),{isMemorySession:()=>true,getIntroSoundEnabled:()=>sound});
 h.ui.openPrologue();assert.match(h.body,/关页前请从设置导出进度/);assert.doesNotMatch(h.body,/从本机存档续玩/);
 assert.match(h.body,/aria-pressed="false">开启雨声与音效/);sound=true;h.click('prologue',[1]);
 assert.match(h.body,/aria-pressed="true">关闭雨声与音效/);assert.equal(h.state.story.intro,false);
});
test('selling the early medicine reserve requires a specific warning and one authoritative sale',()=>{
 const h=harness(sim.initial()),before=structuredClone(h.state);h.click('trade',['herb','sell',0,2]);
 assert.match(h.body,/疗伤需 6 份，赠药需 10 份/);assert.deepEqual(h.state,before);assert.equal(h.commands.length,0);
 h.click('confirmReservedTrade',h.buttonArgs('confirmReservedTrade'));assert.equal(h.state.resources.herb,before.resources.herb-20);
 assert.deepEqual(h.commands,[{name:'trade',args:['herb','sell',0,2]}]);
});
test('material recovery from the next button starts real gathering and resumes a paused clock',()=>{
 const s=healedWorld();sim.advanceStory(s);sim.trade(s,'herb','sell',0,1);s.speed=0;let resumes=0;
 const h=harness(s,{ensureRunning:()=>{s.speed=1;resumes++;}});h.click('guideNext');
 assert.equal(s.master.action,'herb');assert.equal(s.speed,1);assert.equal(resumes,1);assert.equal(s.story.step,1);
 sim.tick(s,10);assert.ok(s.resources.herb>=10);assert.deepEqual(h.commands,[{name:'masterAction',args:['herb']}]);
});
test('resume recap is read-only until the player selects the pending objective',()=>{
 const s=healedWorld();sim.advanceStory(s);const h=harness(s),before=structuredClone(s);h.ui.showResume();
 assert.match(h.body,/第 1 日/);assert.match(h.body,/院外|陆知微/);assert.deepEqual(s,before);assert.equal(h.commands.length,0);
 h.click('closeModal');assert.deepEqual(s,before);
});
test('paused opening healing resumes without repeating the medicine command or its cost',()=>{
 const s=sim.initial();sim.masterAction(s,'heal');s.speed=0;const before={...s.resources};let resumes=0;
 const h=harness(s,{ensureRunning:()=>{s.speed=1;resumes++;}});h.click('guideNext');
 assert.equal(resumes,1);assert.equal(s.speed,1);assert.deepEqual(s.resources,before);assert.deepEqual(h.commands,[]);
 sim.tick(s,15);assert.equal(s.master.wound,0);
});
test('listening to the first visitor opens the gift choice without remotely recruiting or paying',()=>{
 const s=healedWorld(),h=harness(s),before={...s.resources};
 h.click('homeChoice',[[]]);assert.equal(s.story.step,1);assert.equal(s.disciples.length,0);assert.deepEqual(s.resources,before);
 assert.match(h.body,/陆知微/);assert.match(h.body,/赠药救人/);assert.equal(h.node('#modal').open,true);
 h.click('homeChoice',h.buttonArgs('homeChoice'));assert.equal(s.disciples.length,1);assert.equal(s.resources.herb,before.herb-10);assert.equal(h.node('#modal').open,false);
});

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
  h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);h.click('narrativeRead',['chapter:1']);assert.equal(h.node('#modal').open,true);
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
  const s=healedWorld();sim.advanceStory(s);const h=harness(s);h.click('narrativeRead',['chapter:1']);
  h.click('narrativePage',h.buttonArgs('narrativePage'));h.close();
  const writes=h.commands.length;
  for(let i=0;i<20;i++)h.ui.maybeNarrative();
  assert.equal(h.node('#modal').open,false);assert.equal(h.commands.length,writes);
  assert.deepEqual(s.story.narrative.cursor,{id:'chapter:1',page:1});
  assert.ok(!s.story.narrative.acknowledged.includes('chapter:1'));
  h.ui.resetNarrative();h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);h.click('narrativeRead',['chapter:1']);
  assert.equal(h.node('#modal').open,true);assert.match(h.body,/2 \/ 2/);
});

test('a resumed cursor takes precedence over an earlier dismissed unread chapter after world reopen',()=>{
  const s=healedWorld();sim.advanceStory(s);const h=harness(s);h.click('narrativeRead',['chapter:1']);h.close();
  sim.advanceStory(s);h.click('narrativeRead',['chapter:2']);
  assert.equal(s.story.narrative.cursor.id,'chapter:2');
  h.click('narrativePage',h.buttonArgs('narrativePage'));h.close();
  const retained=sim.validateSave(s).story.narrative.cursor;
  assert.deepEqual(retained,{id:'chapter:2',page:1});
  h.ui.resetNarrative();h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);h.click('narrativeRead',['chapter:2']);
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
    h.advanceClock(1500);h.ui.maybeNarrative();assert.equal(s.story.narrative.cursor.id,`ending:${choice}`);
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


test('journal and a retained early advance button both route to the same physical story point',()=>{
  const p=new Player();p.action('acknowledgeIntro');p.action('masterAction','heal');p.tick(15);
  for(let step=0;step<4;step++){
    if(step===2){p.build('farm');p.build('lumber');}
    if(step===3)p.build('library');
    assert.equal(p.state.story.step,step);const before=structuredClone(p.state),calls=[];
    const h=harness(p.state,{getTab:()=>'journal',interact:(...args)=>{calls.push(args);}});h.ui.renderTab();
    const html=h.fragments.at(-1);assert.match(html,/data-ui-action="guideNext"/);assert.doesNotMatch(html,/data-ui-action="advanceStory"/);
    h.click('guideNext');h.click('advanceStory');
    assert.equal(calls.length,2);assert.equal(calls[0][2],'story');assert.deepEqual(calls[0],calls[1]);assert.deepEqual(p.state,before);assert.deepEqual(h.commands,[]);
    p.action('advanceStory');
  }
});

test('early recollections stay as readable reminders without interrupting play or marking themselves read',()=>{
  const s=healedWorld();sim.advanceStory(s);sim.advanceStory(s);const before=structuredClone(s),h=harness(s);
  h.ui.render();assert.match(h.fragments.join(''),/旧事回响 · 2 段待读/);
  for(let i=0;i<4;i++){h.advanceClock(10000);h.ui.maybeNarrative();}
  assert.equal(h.node('#modal').open,false);assert.deepEqual(s,before);assert.deepEqual(h.commands,[]);
  h.click('narrativeRead',['chapter:2']);assert.equal(h.node('#modal').open,true);assert.match(h.body,/留下|陆知微/);
});

test('major chapters wait for placement, walking, panels and a quiet gap, and dismissal does not loop',()=>{
  const s=new Player().chapterOne().state;sim.acknowledgeIntro(s);let mode='build';
  const h=harness(s,{getMode:()=>mode}),before=structuredClone(s);
  h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);mode='inspect';
  h.advanceClock(1499);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  h.ui.unfold();h.advanceClock(2000);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  h.ui.fold();h.advanceClock(1500);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,true);assert.equal(s.story.narrative.cursor.id,'chapter:4');
  assert.deepEqual(s.resources,before.resources);h.close();h.advanceClock(2000);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  h.ui.resetNarrative();sim.requestSceneInteraction(s,'building',s.buildings[0].id,'inspect');h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  sim.cancelSceneInteraction(s);sim.masterAction(s,'rest');h.advanceClock(1500);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,true);
});


test('holding a pointer on the map defers major scenes until release and the quiet gap',()=>{
  const s=new Player().chapterOne().state;sim.acknowledgeIntro(s);const h=harness(s);
  h.event('pointerdown',{pointerId:7});h.advanceClock(5000);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  h.event('pointerup',{pointerId:7});h.advanceClock(1499);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,false);
  h.advanceClock(1);h.ui.maybeNarrative();assert.equal(h.node('#modal').open,true);assert.equal(s.story.narrative.cursor.id,'chapter:4');
});
