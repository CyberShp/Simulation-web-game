import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../dist/ea-sim.mjs';
import {createEAUI} from '../dist/ea-ui.mjs';
import {Player} from '../qa/ea-player.mjs';

// Evaluate the real panel templates and event handlers. This covers progressive
// disclosure and read-only state projection, not browser layout or native focus.
function harness(state){
  const nodes=new Map(),listeners=new Map(),fragments=[];
  const makeNode=()=>({childNodes:[],textContent:'',scrollTop:0,dataset:{},style:{},open:false,
    classList:{toggle(){},add(){},remove(){},contains(){return false;}},
    setAttribute(){},removeAttribute(){},addEventListener(){},scrollIntoView(){},querySelectorAll(){return [];}});
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,makeNode());return nodes.get(selector);};
  globalThis.window={matchMedia:()=>({matches:false})};
  globalThis.document={activeElement:null,body:makeNode(),querySelector:node,querySelectorAll:()=>[],getElementById:id=>node('#'+id),
    createElement(name){assert.equal(name,'template');return {set innerHTML(html){fragments.push(html);},content:{childNodes:[]}};},
    addEventListener(name,handler){listeners.set(name,handler);}};
  let tab='build';
  const ui=createEAUI({getState:()=>state,getTab:()=>tab,setTab:value=>{tab=value;},getScene:()=>'map',getSelection:()=>null,toast(){}});
  return {render(next=tab){tab=next;ui.renderTab();return fragments.at(-1);},click(action,args=[]){
    const button={disabled:false,dataset:{uiAction:action,uiArgs:JSON.stringify(args)}};
    listeners.get('click')({target:{closest:selector=>selector==='[data-ui-action]'?button:null},preventDefault(){}});
  }};
}
const visible=html=>html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
const cards=(html,prefix)=>[...html.matchAll(new RegExp('data-key="'+prefix+'-([^" ]+)"','g'))].map(m=>m[1]);
function gifted(){const s=sim.initial();sim.masterAction(s,'heal');sim.tick(s,15);sim.advanceStory(s);sim.advanceStory(s);return s;}

test('opening building panels prioritize daily needs without removing any facility actions',()=>{
  const s=gifted(),before=structuredClone(s),h=harness(s),html=h.render();
  assert.match(html,/<details[^>]*data-key="opening-build-later">/);
  assert.deepEqual(cards(visible(html),'build'),['farm','lumber','house','granary','kitchen']);
  assert.deepEqual(cards(html,'build').sort(),Object.keys(sim.BUILDINGS).filter(id=>id!=='hall').sort());
  assert.deepEqual(s,before);
});

test('built facilities and the current library objective stay directly available',()=>{
  const player=new Player(gifted());player.build('alchemy');player.build('farm');player.build('lumber');player.action('advanceStory');
  const s=player.state,before=structuredClone(s),html=harness(s).render();
  for(const id of ['alchemy','farm','lumber','library'])assert.ok(cards(visible(html),'build').includes(id),id+' is immediately visible');
  assert.deepEqual(s,before);
});

test('explicit building categories show their full contents rather than a second hidden list',()=>{
  const h=harness(gifted());h.click('filter',['build','practice']);const html=h.render();
  assert.doesNotMatch(html,/<details\b/);
  assert.deepEqual(cards(html,'build').sort(),['library','meditation','well','watchtower'].sort());
});

test('system overview and legacy saves produce the same complete panels',()=>{
  const s=gifted(),full=harness(s);full.click('allSystems');
  const html=Object.fromEntries(['build','production','sect'].map(tab=>[tab,full.render(tab)]));
  const legacy=structuredClone(s);delete legacy.story.onboarding;const old=harness(legacy);
  for(const tab of Object.keys(html)){assert.doesNotMatch(html[tab],/<details\b/);assert.equal(old.render(tab),html[tab]);}
});

test('completed opening restores all panel contents without requiring the overview toggle',()=>{
  const s=new Player().chapterOne().state,before=structuredClone(s),h=harness(s);
  for(const tab of ['build','production','sect'])assert.doesNotMatch(h.render(tab),/<details\b/);
  assert.deepEqual(s,before);
});

test('selecting alchemy retains its furnace explanation and all recipes remain reachable',()=>{
  const s=gifted(),before=structuredClone(s),h=harness(s);h.click('productionSection',['alchemy']);const html=h.render('production');
  assert.match(html,/data-production-view="alchemy"/);assert.match(visible(html),/丹炉尚未建成/);
  assert.match(html,/<details[^>]*data-key="opening-recipes-later">/);
  assert.deepEqual(cards(html,'recipe').sort(),Object.keys(sim.RECIPES).sort());
  assert.equal(cards(visible(html),'recipe').length,0);assert.deepEqual(s,before);
});

test('a built furnace exposes usable basics and keeps held or active advanced recipes visible',()=>{
  const player=new Player(gifted());player.build('alchemy');const s=player.state;
  let html=harness(s).render('production');for(const id of ['heal','qi'])assert.ok(cards(visible(html),'recipe').includes(id));assert.ok(!cards(visible(html),'recipe').includes('foundation'));
  // Edge-state projections: owned pills or a paused recipe must never disappear
  // merely because today's realm/facility does not meet the next-craft gate.
  s.master.realm=1;for(const d of s.disciples)d.realm=1;s.pills.foundation=1;s.crafting={recipeId:'spirit',remaining:12,total:35,yield:2};
  const before=structuredClone(s);html=harness(s).render('production');
  assert.deepEqual(cards(visible(html),'recipe').sort(),Object.keys(sim.RECIPES).sort());assert.deepEqual(s,before);
});

test('early sect panels fold future organization while keeping rules and active affairs in the main flow',()=>{
  const s=gifted(),before=structuredClone(s),h=harness(s),html=h.render('sect'),shown=visible(html);
  for(const key of ['founding','offices','peaks'])assert.match(html,new RegExp('<details[^>]*data-key="opening-sect-'+key+'">'));
  for(const text of ['院规与差事','待议事务','山门来客与个人牵挂'])assert.ok(shown.includes(text));
  assert.doesNotMatch(shown,/举行立派仪式|商议立峰|邀请任职/);
  assert.match(html,/举行立派仪式/);assert.match(html,/商议立峰/);assert.deepEqual(s,before);
});
