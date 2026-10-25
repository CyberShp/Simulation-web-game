import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';
import {createSectSession,createSectCommandDriver,createSectViewRefresh,viewSect,snapshotSect,restoreSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';

const main=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-main.mjs',import.meta.url),'utf8');
const controls=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-combat.mjs',import.meta.url),'utf8');
const body=(source,name,next)=>{const a=source.indexOf('function '+name+'('),b=source.indexOf('function '+next+'(',a);assert(a>=0&&b>a);return source.slice(a,b);};
// Declared component source; every test restores its own actual bodies and world.
const source=buildCombatGroupComponent().native;
function host(input=source){
 const session=restoreSect(input),reference=restoreSect(input),update=createSectViewRefresh(()=>session),driver=createSectCommandDriver(()=>session),referenceDriver=createSectCommandDriver(()=>reference);
 driver.adopt();referenceDriver.adopt();
 const listeners={},callbacks={},elements=new Map(),calls=[],commands=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:''});return elements.get(id);};
 const add=(name,callback)=>{(listeners[name]??=[]).push(callback);};
 const c={session,view:update(),ready:true,closing:false,importing:false,suspended:false,manualPause:session.state.speed===0,
  modal:null,panelReading:false,openingReading:false,departureReading:false,pendingApproach:null,activeWaypoint:null,
  route:[],destination:null,renderer:{reference:false,target:null},persistence:{status:()=>({protected:false})},
  held:new Set(),lastMove:{x:0,y:0},hostActive:true,hoveredActorId:'actor',focus:true,
  MOVE_KEYS:new Set(['KeyW','KeyA','KeyS','KeyD']),document:{addEventListener:add,hasFocus:()=>c.focus},addEventListener:add,
  setInterval(){return 1;},performance:{now:()=>10},lastPump:0,$:element,
  ui(){},canInteract:()=>true,announce(){},host:{onActivity:callback=>{callbacks.activity=callback;},onPower:callback=>{callbacks.power=callback;}},
  running:()=>c.hostActive&&c.session.state.speed!==0&&c.focus,
  battle:()=>c.view.expedition?.scene?.type==='combat'?c.view.expedition.scene:null,
  ownedCommand(request){
   commands.push(structuredClone(request));
   const expected=referenceDriver(request),actual=driver(request);
   assert.deepEqual(actual,expected,'the actual callback retains the same public command result');
   assert.deepEqual(snapshotSect(session),snapshotSect(reference),'the callback command has the same complete authoritative session');
   return actual;
  }};
 c.refresh=options=>{calls.push(options||{});c.view=update(options);return c.view;};
 vm.createContext(c);
 vm.runInContext(main.split('\n').find(line=>line.startsWith('const needsFullView='))+'\n'+body(main,'issue','pauseReasons')+body(main,'pauseReasons','syncPause')+body(main,'syncPause','manageCommand')+body(main,'manageCommand','moveArt'),c);
 c.command=c.manageCommand;
 vm.runInContext(body(controls,'send','world')+body(controls,'movement','target'),c);
 const a=controls.indexOf('setHostActivity:')+'setHostActivity:'.length,b=controls.indexOf(',canvas,worldToScreen',a);
 assert(a>0&&b>a);c.combatUI={clearInput:c.clearInput,setHostActivity:vm.runInContext('('+controls.slice(a,b)+')',c)};
 const begin=main.indexOf('function refreshActivity()'),end=main.indexOf('try{\n const settings=',begin);assert(begin>0&&end>begin);
 vm.runInContext(main.slice(begin,end),c);
 for(const name of ['onActivity','onPower'])vm.runInContext(main.split('\n').find(line=>line.includes('host.'+name+'(')),c);
 return {c,session,reference,calls,commands,callbacks,element,emit(name){for(const callback of listeners[name]||[])callback();},
  advance(seconds){advanceSect(session,seconds);advanceSect(reference,seconds);assert.deepEqual(snapshotSect(session),snapshotSect(reference));},
  fresh(){const full=viewSect(reference);for(const key of ['tick','time','timeLabel','paused','masterWound','expedition','opening'])assert.deepEqual(c.view[key],full[key],key);}};
}

test('native activity clears real held input before a forced fresh battle projection without advancing or pausing the world',()=>{
 const h=host(),c=h.c;c.manualPause=false;c.syncPause();
 c.held.add('KeyD');c.movement(true);assert.equal(c.view.expedition.combat.controls.move.x,1);
 const prior=c.view,tick=h.session.state.worldTick;h.calls.length=0;
 h.callbacks.activity({active:false,minimized:true});
 assert.equal(c.hostActive,false);assert.equal(c.held.size,0);assert.equal(c.view.expedition.combat.controls.move.x,0);
 assert.equal(c.view.expedition.combat.controls.move.y,0);assert.equal(c.view.paused,false);assert.equal(h.session.state.worldTick,tick);
 assert.notEqual(c.view,prior);assert.equal(c.view.domain,undefined);assert(h.calls.every(x=>x.automatic&&x.force),'neither the reset nor native activity callback rebuilds hidden courtyard UI');h.fresh();
 h.advance(.1);assert.equal(h.session.state.worldTick,tick+1,'the same world continues in the background');
 const stale=c.view;h.callbacks.activity({active:true});assert.notEqual(c.view,stale);assert.equal(c.view.tick,tick+1);assert.equal(c.hostActive,true);assert.equal(c.held.size,0);h.fresh();
 const before=JSON.stringify(h.session);c.view.expedition.scene.player.hp=-1;assert.equal(JSON.stringify(h.session),before,'the new activity view is detached');
});

test('actual DOM blur, focus and visibility callbacks all obtain current combat facts and blur retains the real reset handler',()=>{
 const h=host(),c=h.c;c.manualPause=false;c.syncPause();c.held.add('KeyW');c.movement(true);const tick=h.session.state.worldTick;
 c.focus=false;h.calls.length=0;h.emit('blur');assert.equal(c.held.size,0);assert.equal(c.view.expedition.combat.controls.move.y,0);assert.equal(c.view.paused,false);assert(h.calls.every(x=>x.automatic&&x.force));
 for(const event of ['focus','visibilitychange']){const prior=c.view;c.focus=true;h.emit(event);assert.notEqual(c.view,prior);assert.equal(c.view.domain,undefined);h.fresh();}
 assert.equal(h.session.state.worldTick,tick);
});

test('all reading, route, lifecycle, protection and opening guards retain complete fresh activity queries',()=>{
 const guards=[c=>{c.modal='dialog';},c=>{c.panelReading=true;},c=>{c.openingReading=true;},c=>{c.departureReading=true;},c=>{c.pendingApproach='person';},c=>{c.activeWaypoint={};},(_c,h)=>{h.element('management').hidden=false;},c=>{c.closing=true;},c=>{c.importing=true;},c=>{c.suspended=true;},c=>{c.persistence.status=()=>({protected:true});},c=>{c.view.opening.stage='intro';},c=>{c.view.expedition.scene.type='world';}];
 for(const change of guards){const h=host();change(h.c,h);const before=JSON.stringify(h.session),prior=h.c.view;h.callbacks.activity({active:true});assert.notEqual(h.c.view,prior);assert(h.c.view.domain);assert.deepEqual(h.c.view,viewSect(h.reference));assert.equal(JSON.stringify(h.session),before);}
 const pending=host();pending.c.ready=false;pending.calls.length=0;pending.callbacks.activity({active:true});pending.emit('focus');assert.equal(pending.calls.length,0,'initialization still waits for the original ready boundary');
 const home=host(snapshotSect(createSectSession()));home.callbacks.activity({active:true});assert(home.c.view.domain);assert.deepEqual(home.c.view,viewSect(home.reference));
});

test('manual pause, resume and system power keep formal reset/speed commands, with power queries remaining complete',()=>{
 const h=host(),c=h.c,tick=h.session.state.worldTick;
 h.callbacks.activity({active:true});assert(c.view.paused);assert.equal(c.view.domain,undefined);const frozen=JSON.stringify(h.session.state);h.advance(.2);assert.equal(JSON.stringify(h.session.state),frozen);
 c.manualPause=false;c.syncPause();c.held.add('KeyD');c.movement(true);h.callbacks.power({suspended:true});assert(c.view.paused);assert(c.view.domain);assert.equal(c.held.size,0);assert.equal(c.view.expedition.combat.controls.move.x,0);
 const suspended=JSON.stringify(h.session.state);h.advance(.2);assert.equal(JSON.stringify(h.session.state),suspended);
 h.callbacks.power({suspended:false});assert.equal(c.view.paused,false);assert(c.view.domain,'the power resume contract keeps a complete query');h.advance(.1);assert.equal(h.session.state.worldTick,tick+1);
 c.manualPause=true;c.syncPause();assert(c.view.paused);h.callbacks.activity({active:false});assert(c.view.paused);assert.equal(h.session.state.speed,0);h.fresh();
});

test('real retreat/acknowledgement leave the battle projection, and current authority still saves and restores independently',()=>{
 const h=host(),c=h.c;c.manualPause=false;c.syncPause();assert(c.issue({type:'combat',actionId:'retreat'}).ok);
 for(let i=0;i<300&&h.session.state.combat.status==='active';i++)h.advance(.1);
 assert.equal(h.session.state.combat.status,'retreated');h.callbacks.activity({active:true});assert(c.view.domain,'an ended battle obtains the full transition view');
 assert(c.issue({type:'combat-acknowledge'}).ok);h.callbacks.activity({active:true});assert(c.view.domain);assert.equal(c.view.expedition.scene,null);assert.equal(c.view.expedition.world.scene.id,'scene:prison');assert.deepEqual(c.view,viewSect(h.reference));
 Object.assign(c,{snapshotSect,saveJS:(_kind,callback)=>callback(),opening:{snapshotPresentation:()=>({version:1,introFrame:5,bundle:{phase:'open',frame:3}})},toWorld:(x,y)=>({x,y}),renderer:{reference:false,camera:{x:0,y:0,zoom:1}},structuredClone});
 const save=vm.runInContext('('+main.split('\n').find(line=>line.startsWith('function saveSnapshot('))+')',c),prior=c.view,saved=save();assert.equal(c.view,prior,'saving reads authority without a display refresh');assert.deepEqual(saved.state,h.session.state);
 const restored=restoreSect(saved);assert.equal(JSON.stringify(snapshotSect(restored)),JSON.stringify(saved),'the complete saved representation survives restore byte-for-byte');assert.deepEqual(viewSect(restored).expedition,viewSect(h.reference).expedition);
});
