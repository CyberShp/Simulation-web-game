import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAUI,scenePresentation,currentObjective,EA_SHELL} from '../dist/ea-ui.mjs';
import {prepareFacilityActivity} from '../dist/ea-facility-activities.mjs';
import {normalOpening} from '../qa/ea-sr-integration-acceptance.mjs';

function uiHarness(state){
 const nodes=new Map(),events=new Map(),fragments=[],commands=[],modals=[],choices=[];
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{childNodes:[],textContent:'',dataset:{},style:{},scrollTop:0,open:false,attributes:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}});return nodes.get(selector);};
 globalThis.window={matchMedia:()=>({matches:false})};
 globalThis.document={activeElement:null,body:node('body'),querySelector:node,getElementById:id=>node('#'+id),querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn),createElement:()=>({set innerHTML(v){fragments.push(v);},content:{childNodes:[]}})};
 const ui=createEAUI({getState:()=>state,getScene:()=>'map',getTab:()=>'self',openModal:(title,body)=>modals.push({title,body}),chooseScenePerson:id=>{choices.push(id);ui.renderDetail({kind:'person',id});},act(name,...args){commands.push({name,args});const d=SIM.dispatchCommand(state,{name,args,expectedRevision:state.revision});state=d.state;return d.result;},ensureRunning(){state.speed=1;}});
 const click=(action,args=[])=>events.get('click')({target:{closest:selector=>selector==='[data-ui-action]'?{dataset:{uiAction:action,uiArgs:JSON.stringify(args)}}:null},preventDefault(){}});
 return {ui,node,click,fragments,commands,modals,choices,get state(){return state;}};
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

test('SR-XF-029: building capacity and indoor selection read the actual reserved bed without issuing commands',()=>{
 const s=SIM.dispatchCommand(SIM.initial({sr:true}),{name:'masterAction',args:['heal']}).state;
 SIM.tick(s,1);
 const a=s.activitiesById[s.master.activityId];assert.equal(a.phase,'navigating');assert.ok(a.slotId);
 const before=JSON.stringify(s),h=uiHarness(s);h.ui.renderDetail({kind:'building',id:s.buildings[0].id});
 const html=h.fragments.at(-1);assert.match(html,/疗养位 1 \/ 1/);assert.match(html,/床位 0 \/ 3/);assert.match(html,/调养床 1 · 前往中/);assert.ok(html.includes(a.reason));
 assert.match(html,/灵石来自实际交易与差事/);assert.doesNotMatch(html,/凝聚少量灵石|产出：灵石/);
 assert.match(html,/class="portrait mini"/);assert.match(html,/data-ui-action="chooseScenePerson" data-ui-args="\[&quot;master&quot;\]"/);
 h.click('chooseScenePerson',['master']);assert.deepEqual(h.choices,['master']);assert.match(h.fragments.at(-1),/沈砚 · 掌门/);
 assert.equal(JSON.stringify(s),before);assert.equal(h.commands.length,0);
});

test('SR-XF-029: a patient waiting for all four beds stays visible with the real reason and no extra capacity',()=>{
 // Focused capacity fixture: reserve the four real beds before the patient applies.
 const s=SIM.initial({sr:true}),hall=s.buildings[0];
 for(let i=0;i<4;i++){const p=SIM.addDisciple(s);p.mind.activity='rest';prepareFacilityActivity(s,p,hall,'rest',0);}
 s.master.action='heal';prepareFacilityActivity(s,s.master,hall,'heal',0);
 const a=s.activitiesById[s.master.activityId];assert.equal(a.phase,'waiting');assert.equal(a.slotId,null);
 const before=JSON.stringify(s),h=uiHarness(s);h.ui.renderDetail({kind:'building',id:hall.id});const html=h.fragments.at(-1);
 assert.match(html,/床位 4 \/ 4/);assert.match(html,/沈砚 · 疗养伤势 · 等候/);assert.match(html,/工位已满，在门外独立位置等候/);
 assert.equal((html.match(/data-ui-action="chooseScenePerson"/g)||[]).length,5);assert.equal(JSON.stringify(s),before);assert.equal(h.commands.length,0);
});

test('SR-XF-029: overlapping people retain identity portraits and select the requested person read-only',()=>{
 const s=SIM.initial({sr:true}),visitor=s.personsById[s.story.opening.visitorId],before=JSON.stringify(s),h=uiHarness(s);
 h.ui.openNearbyPeople([{id:'master',name:s.master.name,activity:'heal'},{id:visitor.id,name:visitor.name,activity:'rest'}]);
 const {title,body}=h.modals.at(-1);assert.equal(title,'选择附近人物');assert.equal((body.match(/class="portrait mini"/g)||[]).length,2);
 assert.match(body,/沈砚 · 疗养伤势/);assert.match(body,/陆知微 · 调息休憩/);assert.doesNotMatch(body,/undefined|NaN/);
 h.click('chooseScenePerson',[visitor.id]);assert.deepEqual(h.choices,[visitor.id]);assert.match(h.fragments.at(-1),/陆知微/);
 assert.equal(JSON.stringify(s),before);assert.equal(h.commands.length,0);
});

test('SR-XF-007: a newly ordered study is shown as travelling until a real desk is reserved',()=>{
 const run=normalOpening();run.act('masterStudy','spring');
 const body=run.s.activitiesById[run.s.master.activityId];assert.equal(body.phase,'moving');assert.equal(body.slotId==null,true);
 const before=JSON.stringify(run.s),h=uiHarness(run.s);h.ui.renderDetail({kind:'person',id:'master'});
 assert.match(h.fragments.at(-1),/研习 · 前往研习位置/);
 assert.doesNotMatch(h.fragments.at(-1),/山外或等待机会/);
 assert.equal(JSON.stringify(run.s),before);assert.equal(h.commands.length,0);
});

test('SR-XF-007: a public harvest paused by a full pack is shown as waiting, not stale rest',()=>{
 const run=normalOpening(),study=run.act('masterStudy','spring');
 run.until(s=>s.srCultivation.orders[study.orderId]?.phase==='completed','real study completed',1000);
 for(let i=0;i<4;i++){
  const harvest=run.act('startMasterHarvest','wood');
  run.until(s=>!s.activitiesById[harvest.id]||s.activitiesById[harvest.id].phase==='paused','real harvest finished or paused',500);
 }
 run.act('setSpeed',0);run.save();
 const body=run.s.activitiesById[run.s.master.activityId],life=SIM.personLifeSummary(run.s,run.s.master);
 assert.equal(body.kind,'sr-harvest');assert.equal(body.phase,'paused');
 assert.equal(life.activity,'waiting');assert.equal(life.status,'waiting');assert.equal(life.facilityName,null);
 assert.equal(SIM.appearanceView(run.s,'person:master').action,'waiting');
 const before=JSON.stringify(run.s),h=uiHarness(run.s);h.ui.render();
 assert.ok(h.fragments.some(fragment=>fragment.includes('等候中')));
 h.ui.renderDetail({kind:'person',id:'master'});
 assert.match(h.fragments.at(-1),/等候 · 院中等候/);
 assert.match(h.fragments.at(-1),/随身包裹已满/);
 assert.doesNotMatch(h.fragments.at(-1),/休憩 · 别院主屋/);
 assert.equal(JSON.stringify(run.s),before);assert.equal(h.commands.length,0);
});
