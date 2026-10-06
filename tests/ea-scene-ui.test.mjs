import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAUI,scenePresentation,currentObjective,EA_SHELL} from '../dist/ea-ui.mjs';

function uiHarness(state){
 const nodes=new Map(),events=new Map(),fragments=[],commands=[];
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{childNodes:[],textContent:'',dataset:{},style:{},scrollTop:0,open:false,attributes:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}});return nodes.get(selector);};
 globalThis.window={matchMedia:()=>({matches:false})};
 globalThis.document={activeElement:null,body:node('body'),querySelector:node,getElementById:id=>node('#'+id),querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn),createElement:()=>({set innerHTML(v){fragments.push(v);},content:{childNodes:[]}})};
 const ui=createEAUI({getState:()=>state,getScene:()=>'map',getTab:()=>'self',act(name,...args){commands.push({name,args});const d=SIM.dispatchCommand(state,{name,args,expectedRevision:state.revision});state=d.state;return d.result;},ensureRunning(){state.speed=1;}});
 const click=(action,args=[])=>events.get('click')({target:{closest:selector=>selector==='[data-ui-action]'?{dataset:{uiAction:action,uiArgs:JSON.stringify(args)}}:null},preventDefault(){}});
 return {ui,node,click,fragments,commands,get state(){return state;}};
}
function travelToValley(){
 let s=SIM.initial({sr:true});s=SIM.dispatchCommand(s,{name:'srWorldCommand',args:[{action:'travel',destination:'scene:valley'}],expectedRevision:s.revision}).state;
 return s;
}

test('SR-XF-016: public travel progress and arrival project the same physical scene without advancing time',()=>{
 const s=travelToValley(),depart=JSON.stringify(s),travel=scenePresentation(s);
 assert.equal(travel.title,'前往云岫山谷');assert.equal(travel.travel,true);assert.equal(JSON.stringify(s),depart);
 for(let i=0;i<85&&s.srWorld.activeTravelId;i++)SIM.tick(s,.1);
 assert.equal(s.master.location.sceneId,'scene:valley');const arrived=JSON.stringify(s),view=scenePresentation(s);
 assert.equal(view.title,'云岫山谷');assert.equal(view.sceneId,s.master.location.sceneId);assert.notEqual(view.title,'云岫别院');assert.equal(JSON.stringify(s),arrived);
});

test('SR-XF-029: established foundation has no contradictory preparation objective',()=>{
 const s=SIM.initial({sr:true});s.story.step=5;s.master.realm=10; // Unit fixture for a persisted chapter/realm combination.
 const before=JSON.stringify(s),next=currentObjective(s);assert.equal(next.kind,'explore');assert.doesNotMatch(next.label,/准备筑基/);assert.match(next.text,/筑基已成/);assert.equal(JSON.stringify(s),before);
 s.master.realm=9;assert.equal(currentObjective(s).label,'准备筑基');
});

test('SR-XF-016: market title and weather use current facts; distant unknown climate is not invented',()=>{
 const s=SIM.initial({sr:true});s.master.location={kind:'local',sceneId:'scene:market',x:12,y:24};s.weatherByRegionId['region:yunxiu'].phase='rain';
 const before=JSON.stringify(s);assert.equal(scenePresentation(s).title,'青溪坊市');assert.equal(scenePresentation(s).weather,'雨');assert.equal(JSON.stringify(s),before);
 s.master.location={kind:'local',sceneId:'scene:otherworld-outpost',x:12,y:24};assert.equal(scenePresentation(s).weather,'此地天时尚未查明');
});

test('SR-XF-029: objective starts collapsed, expands read-only, and selection uses a compact card',()=>{
 assert.match(EA_SHELL,/id="quest-toggle"[^>]+aria-expanded="false"/);assert.match(EA_SHELL,/id="quest" hidden/);
 const s=SIM.initial({sr:true}),before=JSON.stringify(s),h=uiHarness(s);h.ui.render();assert.equal(h.node('#quest').hidden,true);h.click('toggleQuest');assert.equal(h.node('#quest').hidden,false);h.click('toggleQuest');assert.equal(h.node('#quest').hidden,true);
 h.ui.renderDetail({kind:'building',id:s.buildings[0].id});assert.match(h.fragments.at(-1),/<details class="detail-management">/);assert.match(h.fragments.at(-1),/走近互动/);assert.equal(JSON.stringify(s),before);assert.equal(h.commands.length,0);
});

test('SR-XF-016/029: local object approach button dispatches actual movement; remote interaction stays locked',()=>{
 const s=travelToValley();for(let i=0;i<85&&s.srWorld.activeTravelId;i++)SIM.tick(s,.1);
 const h=uiHarness(s),id='object:valley:herbs',before=JSON.stringify(s);h.ui.renderDetail({kind:'world-object',id});
 assert.match(h.fragments.at(-1),/溪边药丛/);assert.match(h.fragments.at(-1),/data-ui-action="approachWorldObject"/);assert.match(h.fragments.at(-1),/disabled title="须先走近此处"/);assert.equal(JSON.stringify(s),before);
 h.click('approachWorldObject',[id]);assert.deepEqual(h.commands,[{name:'srWorldCommand',args:[{action:'move',x:15,y:18.5}]}]);assert.equal(h.state.srWorld.interaction.kind,'walk');assert.equal(h.state.master.location.sceneId,'scene:valley');
});
