import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {isSwordStudy} from '../../../apps/courtyard/courtyard-combat-sword-study.mjs';
import {createSwordStudyAudio} from '../../../apps/courtyard/courtyard-combat-sword-study-audio.mjs';
import {createHash} from 'node:crypto';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,createSectCommandDriver,advanceSect,viewSect,viewSectCombat,createSectViewRefresh,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';
import {combatPointerScreenPoint,combatScreenToWorld} from '../../../apps/courtyard/courtyard-combat-camera.mjs';

const HOME='scene:yunxiu-courtyard',MASTER='person:master';
const main=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-main.mjs',import.meta.url),'utf8');
const controls=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-combat.mjs',import.meta.url),'utf8');
const harness=fs.readFileSync(new URL('../../acceptance/courtyard-combat-party-desktop.mjs',import.meta.url),'utf8');
const body=(source,name,next)=>source.slice(source.indexOf(`function ${name}(`),source.indexOf(`function ${next}(`));
const send=(s,q)=>{const r=commandSect(s,q);assert.equal(r.ok,true,r.error);return r;};
const until=(s,p,label)=>{for(let i=0;i<3500&&!p(s.state);i++)advanceSect(s,.1);assert(p(s.state),label);};
function exit(s,id){const first=send(s,{type:'world',action:{action:'exit',exitId:id,cargo:{food:4}}});if(first.result.phase==='approaching'){until(s,v=>!v.srWorld.interaction&&!v.master.scenic.path.length,'walk to exit');send(s,{type:'world',action:{action:'exit',exitId:id,cargo:{food:4}}});}until(s,v=>!v.srWorld.activeTravelId,'real journey');}
function battleSource(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:createHash('sha256').update(JSON.stringify(state)).digest('hex')}}});
 exit(s,'exit:yunxiu-valley');send(s,{type:'world',action:{action:'move',x:24.5,y:36}});until(s,v=>!v.srWorld.interaction,'approach');send(s,{type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});
 return snapshotSect(s);
}
// The source is formed once by public rules; every case restores an independent body/world.
const native=battleSource(),battle=()=>restoreSect(structuredClone(native));
function equivalent(s){
 const before=JSON.stringify(s),light=viewSectCombat(s),full=viewSect(s);assert(light);
 for(const key of ['tick','time','timeLabel','paused','masterWound','expedition','opening'])assert.deepEqual(light[key],full[key],key);
 assert.equal(light.masterWound,s.state.master.wound);
 assert.equal(light.masterActivityReason,full.people.find(p=>p.id===MASTER)?.activityDetail?.reason||'');assert.equal(JSON.stringify(s),before);return light;
}
function host(s){
 const update=createSectViewRefresh(()=>s),calls=[];
 const context={session:s,commandSect,ownedCommand:createSectCommandDriver(()=>s),closing:false,importing:false,suspended:false,needsFullView:()=>false,persistence:{status:()=>({protected:false})},view:update(),isSwordStudy,studyAudio:createSwordStudyAudio({AudioContextClass:null})};
 context.getView=()=>context.view;
 context.refresh=options=>{calls.push(options||{});return context.view=update(options);};
 const issue=vm.runInNewContext(`(${body(main,'issue','pauseReasons')})`,context);
 return {context,calls,issue,update};
}

test('battle projection matches complete public fields and neither read nor returned-object edits can alter the world',()=>{
 const s=battle();
 for(let i=0;i<15;i++){equivalent(s);advanceSect(s,.1);}
 const before=JSON.stringify(s),a=viewSectCombat(s),b=viewSectCombat(s);
 const owned=new WeakSet(),collect=v=>{if(v&&typeof v==='object'&&!owned.has(v)){owned.add(v);Object.values(v).forEach(collect);}};collect(s);
 const detached=v=>{if(v&&typeof v==='object'){assert.equal(owned.has(v),false,'no new projection object aliases the authoritative session');Object.values(v).forEach(detached);}};detached(a);detached(b);
 a.expedition.scene.enemies[0].hp=-999;a.opening.masterName='edited';assert.notEqual(b.expedition.scene.enemies[0].hp,-999);assert.notEqual(b.opening.masterName,'edited');assert.equal(JSON.stringify(s),before);
 const full=viewSect(s),next=viewSect(s);full.provenance.kind='edited';full.domain.initialOpenAreas[0].polygon[0][0]=999;assert.notEqual(next.provenance.kind,'edited');assert.notEqual(next.domain.initialOpenAreas[0].polygon[0][0],999);assert.equal(JSON.stringify(s),before);
 assert.equal(viewSectCombat(createSectSession()),null);
});

test('the declared group component retains all two companions, two persistent guards and full geometry in the same projection',()=>{
 const {native}=buildCombatGroupComponent(),s=restoreSect(native),v=equivalent(s),scene=v.expedition.scene;
 assert.equal(scene.allies.length,2);assert.equal(scene.enemies.length,2);assert(scene.sceneFrame);assert(scene.arena);
 assert.deepEqual(scene.enemies.map(e=>e.visualIdentity),['prison-guard-armored','prison-guard-cloth']);
 send(s,{type:'pause',paused:false});for(let i=0;i<5;i++){advanceSect(s,.1);equivalent(s);}
});

test('actual host issue refreshes same-tick input, failures and policy; pause, save and load preserve the authoritative body',()=>{
 let s=battle();const h=host(s),tick=s.state.worldTick,revision=s.state.revision;
 const first=h.update({automatic:true,advanced:true});assert.equal(h.update({automatic:true}),first);
 assert(h.issue({type:'combat-input',move:{x:1,y:0}}).ok);assert.equal(s.state.worldTick,tick);assert.equal(s.state.revision,revision);
 assert.equal(h.context.view.expedition.combat.controls.move.x,1);assert.equal(h.context.view.domain,undefined,'successful visible battle input immediately builds a fresh battle projection');assert.notEqual(h.context.view,first);
 assert.equal(h.update({automatic:true}),h.context.view,'0-tick reuse retains the already fresh input view');
 const before=JSON.stringify(s.state),prior=h.context.view;assert.equal(h.issue({type:'combat-input',move:{x:2,y:0}}).ok,false);assert.notEqual(h.context.view,prior);assert.equal(JSON.stringify(s.state),before);
 h.context.view=h.update({automatic:true,advanced:true});h.context.persistence.status=()=>({protected:true});assert.equal(h.issue({type:'combat-input',move:{x:0,y:0}}).ok,false);assert(h.context.view.domain);assert.equal(JSON.stringify(s.state),before);h.context.persistence.status=()=>({protected:false});
 assert(h.issue({type:'policy',policy:{foodTarget:41}}).ok);assert.equal(h.context.view.policy.foodTarget,41);
 assert(h.issue({type:'pause',paused:true}).ok);assert.equal(h.context.view.domain,undefined);assert(h.context.view.paused);assert.deepEqual(h.context.view.expedition.combat.controls.move,{x:0,y:0});const frozen=JSON.stringify(s.state);advanceSect(s,1);assert.equal(JSON.stringify(s.state),frozen);assert(equivalent(s).paused);
 const saved=snapshotSect(s);s=restoreSect(saved);assert.deepEqual(snapshotSect(s),saved);assert(equivalent(s).paused);
 assert(send(s,{type:'pause',paused:false}).ok);const after=viewSectCombat(s);assert.equal(after.paused,false);assert.deepEqual(after.expedition.combat.controls.move,{x:0,y:0});
});

test('the actual pump advances every elapsed slice and refreshes once, reusing only a no-tick display',()=>{
 const s=battle(),h=host(s),c=h.context;let now=50,uiCalls=0;
 Object.assign(c,{performance:{now:()=>now},lastPump:0,lastUI:-300,lastSave:0,ready:true,modal:null,suspended:false,host:null,noticeUntil:0,advanceSect,needsFullView:()=>false,advanceApproach(){},advanceRoute(){},syncPause(){},fail(e){throw e;},ui(){uiCalls++;}});
 const pump=vm.runInNewContext(`(${body(main,'pump','frame')})`,c),start=s.state.worldTick,initial=c.view;
 pump();assert.equal(s.state.worldTick,start);assert.equal(s.carrySeconds,.05);assert.equal(c.view,initial);assert.equal(h.calls.length,1);assert.equal(uiCalls,1,'the due UI branch shares this pump projection');
 now=100;pump();assert.equal(s.state.worldTick,start+1);assert(!c.view.domain,'automatic combat reads the dedicated projection');const light=c.view;
 now=150;pump();assert.equal(s.state.worldTick,start+1);assert.equal(c.view,light);assert.equal(h.calls.length,3);
 assert(h.issue({type:'combat-input',move:{x:-1,y:0}}).ok);const fresh=c.view;now=175;pump();assert.equal(s.state.worldTick,start+1);assert.equal(c.view,fresh);assert.equal(c.view.expedition.combat.controls.move.x,-1);
 c.needsFullView=()=>true;now=200;pump();assert(c.view.domain,'a pending reading/route uses a complete projection');
});

test('real keyboard handlers send once per edge plus five-Hz held intent; pointer motion changes aim without a world command',()=>{
 const s=battle(),h=host(s),c=h.context,requests=[],listeners={};let heartbeat;
 Object.assign(c,{held:new Set(),lastMove:{x:0,y:0},aim:null,pointer:null,transform:{width:200,height:200,sx:1,sy:1,ox:0,oy:0},combatPointerScreenPoint,combatScreenToWorld,hoveredActorId:null,hostActive:true,MOVE_KEYS:new Set(['KeyW','KeyA','KeyS','KeyD']),SHORTCUTS:{},running:()=>true,active:()=>true,battle:()=>c.view.expedition.scene,departure:{open:false},artCredits:{open:false},combatAudio:{unlock(){}},canInteract:()=>true,send:q=>{requests.push(structuredClone(q));return h.issue(q);},setInterval:callback=>{heartbeat=callback;return 1;},addEventListener:(name,callback)=>{listeners[name]=callback;},canvas:{getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})},screenToWorld:(x,y)=>({x,y}),actorAt:()=>null,document:{hasFocus:()=>true}});
 vm.runInNewContext(body(controls,'movement','target')+body(controls,'key','exit'),c);
 const key=vm.runInNewContext('key',c);
 const event=(repeat=false)=>({code:'KeyW',repeat,target:{closest:()=>null},preventDefault(){}});
 key(event());for(let i=0;i<20;i++)key(event(true));assert.equal(requests.length,1);
 for(let i=0;i<5;i++)heartbeat();assert.equal(requests.length,6);assert.equal(s.state.worldTick,native.state.worldTick);assert.equal(c.view.expedition.combat.controls.move.y,-1);
 vm.runInNewContext(controls.slice(controls.indexOf(' function updatePointerAim('),controls.indexOf(" canvas.addEventListener('pointermove'")),c);
 const line=controls.split('\n').find(line=>line.includes("canvas.addEventListener('pointermove'")),callback=line.slice(line.indexOf("'pointermove',")+14,line.lastIndexOf(');'));
 const pointer=vm.runInNewContext(`(${callback})`,c);for(let i=0;i<100;i++)pointer({clientX:i,clientY:i+1});assert.equal(requests.length,6);assert.equal(c.aim.x,99);assert.equal(c.aim.y,100);
 listeners.keyup(event());assert.equal(requests.length,7);assert.deepEqual(c.view.expedition.combat.controls.move,{x:0,y:0});
 key(event());listeners.blur();assert.equal(requests.length,9);assert.deepEqual(c.view.expedition.combat.controls.move,{x:0,y:0});assert.equal(s.state.worldTick,native.state.worldTick);
});

test('every real host reading, management and pending-route guard keeps successful input on a complete fresh projection',()=>{
 const s=battle(),h=host(s),c=h.context,management={hidden:true};
 Object.assign(c,{modal:null,panelReading:false,openingReading:false,departureReading:false,pendingApproach:null,activeWaypoint:null,$:()=>management});
 c.needsFullView=vm.runInNewContext(`(()=>{${main.split('\n').find(line=>line.startsWith('const needsFullView='))}return needsFullView;})()`,c);
 for(const flag of ['modal','panelReading','openingReading','departureReading','pendingApproach','activeWaypoint']){
  c[flag]=true;assert(h.issue({type:'combat-input',move:{x:0,y:0}}).ok);assert(c.view.domain,flag);c[flag]=null;
 }
 management.hidden=false;assert(h.issue({type:'combat-input',move:{x:0,y:0}}).ok);assert(c.view.domain);
 management.hidden=true;assert(h.issue({type:'combat-input',move:{x:1,y:0}}).ok);assert.equal(c.view.domain,undefined);assert.equal(c.view.expedition.combat.controls.move.x,1);
});

test('retreat and acknowledgement leave the light surface and real travel returns a complete fresh courtyard',()=>{
 const s=battle(),update=createSectViewRefresh(()=>s);assert(viewSectCombat(s));
 send(s,{type:'combat',actionId:'retreat'});until(s,v=>v.combat.status==='retreated','actual retreat');equivalent(s);
 const h=host(s);assert(h.issue({type:'combat-acknowledge'}).ok);assert(h.context.view.domain,'acknowledgement immediately publishes a complete post-combat view');const outside=update({automatic:true,advanced:true});assert.equal(viewSectCombat(s),null);assert(outside.domain);assert.equal(outside.expedition.world.scene.id,'scene:valley');
 exit(s,'exit:valley-yunxiu');const home=update({automatic:true,advanced:true});assert.equal(home.expedition.away,false);assert.equal(home.sceneId,HOME);assert(home.domain);assert(home.people.some(p=>p.id===MASTER));assert.deepEqual(home,viewSect(s));
});

test('successful manual battle actions immediately project official plans and retain identical world facts through release',()=>{
 for(const actionId of ['attack','spell','guard','dodge','retreat']){
  const s=battle(),control=battle(),h=host(s),p=s.state.combat.player;
  const request={type:'combat',actionId,...(['attack','spell','dodge'].includes(actionId)?{target:{x:p.x,y:p.y+.9}}:{})};
  assert(h.issue(request).ok,actionId);send(control,request);assert.equal(JSON.stringify(s.state),JSON.stringify(control.state));assert.equal(h.context.view.domain,undefined,actionId);assert.deepEqual(h.context.view.expedition,viewSect(s).expedition);
  const invalid={type:'combat',actionId:'missing-action'};assert.equal(h.issue(invalid).ok,false);assert.equal(commandSect(control,invalid).ok,false);assert.equal(h.context.view.domain,undefined,'a refused skill still refreshes the visible battle projection');assert.deepEqual(h.context.view.expedition,viewSect(s).expedition);
  for(let n=0;n<7;n++){advanceSect(s,.1);advanceSect(control,.1);h.context.refresh({automatic:true,advanced:true});assert.equal(JSON.stringify(s.state),JSON.stringify(control.state),actionId+' world step');assert.deepEqual(h.context.view.expedition,viewSect(s).expedition);}
 }
});

test('pause uses fresh battle state while closing, power and reading guards retain complete queries and the same formal command',()=>{
 for(const guard of ['closing','importing','suspended','reading']){
  const s=battle(),control=battle(),h=host(s);send(s,{type:'combat-input',move:{x:1,y:0}});send(control,{type:'combat-input',move:{x:1,y:0}});
  if(guard==='reading')h.context.needsFullView=()=>true;else h.context[guard]=true;
  assert(h.issue({type:'pause',paused:true}).ok);send(control,{type:'pause',paused:true});assert(h.context.view.domain,guard);assert.equal(JSON.stringify(s.state),JSON.stringify(control.state));assert.deepEqual(h.context.view.expedition.combat.controls.move,{x:0,y:0});
 }
});

test('actual QA status returns detached error records and active combat polling cannot invoke complete metrics',async()=>{
 const s=battle(),errors=[{message:'retained diagnostic',tick:s.state.worldTick}],context={ready:true,manualPause:false,panelReading:false,openingReading:false,pauseReasons:()=>[],persistence:{status:()=>({protected:false})},importing:false,errors};
 const qaAt=main.indexOf('window.courtyardQA='),at=main.indexOf('status:()=>',qaAt)+'status:'.length,end=main.indexOf(',setPaused:',at);assert(at>qaAt&&end>at);
 const status=vm.runInNewContext(`(${main.slice(at,end)})`,context),one=status(),two=status();one.errors[0].message='view edit';one.errors.push({message:'view addition'});assert.equal(errors[0].message,'retained diagnostic');assert.equal(two.errors.length,1);assert.equal(two.errors[0].message,'retained diagnostic');
 let fullQueries=0;const view=viewSectCombat(s),qa={enabled:true,observations:[],inputEvents:[],actions:{},projectiles:{},steps:[],hits:[]};
 const q={renderer:{view},status,metrics:()=>{fullQueries++;throw Error('complete metrics forbidden in active polling');},view:()=>{fullQueries++;throw Error('complete view forbidden in active polling');},snapshot:()=>{fullQueries++;throw Error('world snapshot forbidden in active polling');},expedition:{inputState:()=>({held:[]})}};
 const pollContext={window:{courtyardQA:q,__combatPartyQA:qa},performance:{now:()=>1},document:{getElementById:()=>null},page:{evaluate:fn=>fn()}};
 const poll=vm.runInNewContext(`(()=>{${harness.slice(harness.indexOf('const readCombat='),harness.indexOf('const actionReady='))}return readCombat;})()`,pollContext),before=JSON.stringify(s.state),result=await poll();
 assert.equal(result.errors[0].message,'retained diagnostic');result.errors[0].message='poll edit';assert.equal(status().errors[0].message,'retained diagnostic');assert.equal(fullQueries,0);assert.equal(qa.observations[0].kind,'combat-status-read');assert.equal(qa.observations[0].observed,true);assert.equal(JSON.stringify(s.state),before);
 // Execute the real metrics lambda too: it must keep its complete-query contract.
 const metricsAt=main.indexOf('metrics:()=>',qaAt)+'metrics:'.length,open=main.indexOf('{',metricsAt);let depth=1,close=open+1;for(;depth&&close<main.length;close++){if(main[close]==='{')depth++;if(main[close]==='}')depth--;}
 Object.assign(context,{session:s,view,renderedFrames:0,routeSteps:0,routeFailure:null,renderer:{w:1672,h:941,dpr:1,sceneTop:()=>0,sceneRight:()=>1672,sceneLeft:()=>0},SERVICES_ART_RIGHT:1672,RESIDENCES_ART_RIGHT:1672,DOMAIN_ART_WIDTH:1672,refresh:()=>{fullQueries++;context.view=viewSect(s);return context.view;}});
 const metrics=vm.runInNewContext(`(${main.slice(metricsAt,close)})`,context),complete=metrics();assert.equal(fullQueries,1);assert(context.view.domain);assert.equal(complete.tick,s.state.worldTick);assert.equal(complete.errors[0].message,'retained diagnostic');
});

test('actual host saves current authority without UI projection and active focus/visibility obtain fresh combat views',()=>{
 const s=battle(),h=host(s),c=h.context,listeners={};
 const light=()=>{c.refresh({automatic:true,advanced:true});assert.equal(c.view.domain,undefined);};
 Object.assign(c,{ready:true,addEventListener:(name,callback)=>{listeners[name]=callback;},document:{addEventListener:(name,callback)=>{listeners[name]=callback;}},snapshotSect,saveJS:(_kind,callback)=>callback(),manualPause:false,openingReading:false,opening:{snapshotPresentation:()=>({})},route:[],activeWaypoint:null,destination:null,renderer:{camera:{x:0,y:0,zoom:1}},toWorld:(x,y)=>({x,y})});
 const begin=main.indexOf("function refreshActivity()"),end=main.indexOf('try{\n const settings=',begin);assert(begin>=0&&end>begin);
 vm.runInNewContext(main.slice(begin,end),c);
 const before=JSON.stringify(s.state);
 for(const event of ['blur','focus','visibilitychange']){light();const prior=c.view;listeners[event]();assert.notEqual(c.view,prior);assert.equal(c.view.domain,undefined);assert.deepEqual(c.view.expedition,viewSect(s).expedition);}
 const save=vm.runInNewContext(`(${main.split('\n').find(line=>line.startsWith('function saveSnapshot('))})`,c);
 light();const currentView=c.view,saved=save();assert.equal(c.view,currentView,'saving does not rebuild the displayed projection');assert.equal(c.view.domain,undefined);assert.deepEqual(saved.state,s.state);assert.equal(JSON.stringify(s.state),before);
 let current=s;const update=createSectViewRefresh(()=>current),old=update({automatic:true,advanced:true});current=restoreSect(snapshotSect(s));assert.notEqual(update({automatic:true}),old,'a replaced loaded session cannot reuse an older projection');assert.deepEqual(update(),viewSect(current));
});
