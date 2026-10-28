import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createSectCommandDriver,commandSect,advanceSect,restoreSect,snapshotSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';
import {createCourtyardPersistence} from '../../../apps/courtyard/courtyard-persistence.mjs';

const native=buildCombatGroupComponent().native;
function pair(){const ordinary=restoreSect(native),owned=restoreSect(native),command=createSectCommandDriver(()=>owned);assert.equal(command({type:'invalid-owner-adoption-probe'}).ok,false);return {ordinary,owned,command};}
const same=p=>assert.deepEqual(snapshotSect(p.owned),snapshotSect(p.ordinary));
function issue(p,request){const before=snapshotSect(p.owned),actual=p.command(request),expected=commandSect(p.ordinary,request);assert.deepEqual(actual,expected);same(p);if(!actual.ok)assert.deepEqual(snapshotSect(p.owned),before,'a rejected owned transaction preserves the entire session');return actual;}
function tick(p,n){for(let i=0;i<n;i++){advanceSect(p.ordinary,.1);advanceSect(p.owned,.1);same(p);}}

for(const actionId of ['attack','spell','guard','dodge','retreat'])test(`owned ${actionId} retains formal receipts, bodies, RNG and every following 100ms world step`,()=>{
 const p=pair();issue(p,{type:'pause',paused:false});const e=p.ordinary.state.combat.enemies[0],a=p.ordinary.state.combat.player;
 assert(issue(p,{type:'combat',actionId,target:actionId==='spell'?{x:e.x,y:e.y}:{x:a.x,y:a.y+.9}}).ok);tick(p,12);
 assert.deepEqual(viewSect(p.owned),viewSect(p.ordinary));assert.deepEqual(snapshotSect(restoreSect(snapshotSect(p.owned))),snapshotSect(p.owned));
});

test('owned command rejection priority and rollback match arbitrary-state public commands',()=>{
 const requests=[null,{type:'combat',actionId:'unknown'},{type:'combat',actionId:'attack',target:{x:NaN,y:0}},{type:'combat',actionId:'guard',target:{x:0,y:0,extra:Infinity}},{type:'combat',actionId:'guard',target:{x:0,y:0,extra:undefined}},{type:'combat',actionId:'guard',target:{x:0,y:0,constructor:'forbidden'}},{type:'combat',actionId:'guard',target:{x:0,y:0,extra:1n}},{type:'combat-auto',enabled:1},{type:'pause',paused:1},{type:'combat-input',move:{x:2,y:0}}];
 const cycle={x:0,y:0};cycle.self=cycle;requests.push({type:'combat',actionId:'guard',target:cycle});
 const deep={x:0,y:0};let at=deep;for(let i=0;i<45;i++)at=at.child={};requests.push({type:'combat',actionId:'guard',target:deep},{type:'combat',actionId:'guard',target:{x:0,y:0,extra:'x'.repeat(21000)}});
 for(const request of requests)assert.equal(issue(pair(),request).ok,false);
});

test('held input, pause, cooldown and auto toggles keep the complete world and clear controls identically',()=>{
 const p=pair();issue(p,{type:'pause',paused:false});issue(p,{type:'combat-input',move:{x:1,y:0}});tick(p,1);issue(p,{type:'combat',actionId:'guard'});issue(p,{type:'pause',paused:true});assert.deepEqual(p.owned.state.combat.controls.move,{x:0,y:0});const frozen=snapshotSect(p.owned);tick(p,5);assert.deepEqual(snapshotSect(p.owned),frozen);issue(p,{type:'pause',paused:false});tick(p,3);issue(p,{type:'combat',actionId:'guard'});issue(p,{type:'combat',actionId:'dodge',target:{x:1,y:0}});tick(p,4);issue(p,{type:'combat-auto',enabled:true});tick(p,6);issue(p,{type:'combat-auto',enabled:false});
});

test('private owner uses one whole-world isolated draft; public commands and replaced invalid inputs retain full validation',()=>{
 const owned=restoreSect(native),commandBeforeReady=createSectCommandDriver(()=>owned),beforeAdopt=snapshotSect(owned),p={owned,command:commandBeforeReady},original=globalThis.structuredClone,worlds=[];
 const adoptionLine=main.split('\n').find(line=>line.trim()==='ownedCommand.adopt();');assert(adoptionLine);assert(main.indexOf(adoptionLine)<main.indexOf('ready=true'));vm.runInNewContext(adoptionLine,{ownedCommand:commandBeforeReady});assert.deepEqual(snapshotSect(owned),beforeAdopt,'explicit ready adoption never changes world/session facts');
 globalThis.structuredClone=(value,...rest)=>{if(value?.schemaVersion===6)worlds.push(value);return original(value,...rest);};
 try{assert(p.command({type:'combat',actionId:'guard'}).ok);}finally{globalThis.structuredClone=original;}
 assert.equal(worlds.length,1);assert.notEqual(p.owned.state,worlds[0]);
 const q=pair();issue(q,{type:'policy',policy:{foodTarget:43}});
 let current=restoreSect(native);const command=createSectCommandDriver(()=>current);assert(command({type:'pause',paused:true}).ok);current=structuredClone(native);current.state.personsById['person:master'].wound=NaN;
 const before=structuredClone(current);assert.throws(()=>command({type:'combat',actionId:'guard'}));assert.deepEqual(current,before);assert.equal(commandSect(current,{type:'combat',actionId:'guard'}).ok,false);
});

const main=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-main.mjs',import.meta.url),'utf8');
function saveHost(qa=true){
 let now=0,resolve,hostCalls=0,snapshotCalls=0,refreshes=0;const completion=new Promise(r=>resolve=r),session={state:{worldTick:31,speed:1,combat:{status:'active'},story:{}}};
 const context={session,performance:{now:()=>now},host:{save(data){hostCalls++;now+=15;assert.equal(data.state.worldTick,31);return completion;}},refresh(){refreshes++;now+=20;},snapshotSect:s=>{snapshotCalls++;return structuredClone(s);},manualPause:false,openingReading:false,opening:{snapshotPresentation:()=>({})},route:[],activeWaypoint:null,destination:null,renderer:{camera:{x:0,y:0,zoom:1}},toWorld:(x,y)=>({x,y})};
 const start=main.indexOf('let qaSaveTiming='),end=main.indexOf('let persistence;',start);assert(start>=0&&end>start);
 const api=vm.runInNewContext(main.slice(start,end)+`;qaSaveTiming=${qa};({saveJS,submitSave,read:()=>({spans:qaSaveSpans.map(span=>({...span})),capped:qaSaveSpansCapped})})`,context);
 context.saveJS=api.saveJS;const snapshot=vm.runInNewContext('('+main.split('\n').find(line=>line.startsWith('function saveSnapshot('))+')',context);
 return {api,session,snapshot,context,resolve,advance:n=>now+=n,counts:()=>({hostCalls,snapshotCalls,refreshes})};
}
test('actual QA save callbacks separate fresh snapshot JS, bridge submission JS and async waiting without changing save timing or state',async()=>{
 const h=saveHost(),before=structuredClone(h.session),persistence=createCourtyardPersistence({getSnapshot:h.snapshot,saveSnapshot:h.api.submitSave}),pending=persistence.save({reason:'auto'});
 await new Promise(r=>setImmediate(r));assert.deepEqual(h.counts(),{hostCalls:1,snapshotCalls:1,refreshes:0});assert.equal(persistence.status().saving,true);
 h.advance(400);h.resolve({ok:true});assert.equal((await pending).ok,true);assert.deepEqual(h.session,before);
 const spans=JSON.parse(JSON.stringify(h.api.read().spans));assert.deepEqual(spans.map(s=>[s.kind,s.durationMs]),[['get-snapshot-js',0],['host-save-submit-js',15],['host-save-await-context',400]]);
 const read=h.api.read();read.spans[0].durationMs=-1;assert.equal(h.api.read().spans[0].durationMs,0);
});
test('non-QA saves retain their callbacks; synchronous throws and host rejection still reach save protection',async()=>{
 const ordinary=saveHost(false),persistence=createCourtyardPersistence({getSnapshot:ordinary.snapshot,saveSnapshot:ordinary.api.submitSave}),pending=persistence.save();await new Promise(r=>setImmediate(r));ordinary.resolve({ok:true});assert.equal((await pending).ok,true);assert.equal(ordinary.api.read().spans.length,0);
 const throwing=saveHost();throwing.context.host.save=()=>{throw Error('bridge unavailable');};const failed=createCourtyardPersistence({getSnapshot:throwing.snapshot,saveSnapshot:throwing.api.submitSave});assert.equal((await failed.save()).protected,true);assert.match(failed.status().error,/bridge unavailable/);assert.equal(throwing.api.read().spans.at(-1).outcome,'threw');
 const rejecting=saveHost();rejecting.context.host.save=()=>Promise.reject(Error('disk rejected'));const rejected=createCourtyardPersistence({getSnapshot:rejecting.snapshot,saveSnapshot:rejecting.api.submitSave});assert.equal((await rejected.save()).protected,true);assert.match(rejected.status().error,/disk rejected/);assert.equal(rejecting.api.read().spans.at(-1).outcome,'rejected');
});
test('native trace attaches only synchronous save spans as blocking attribution and labels await as context',()=>{
 const harness=fs.readFileSync(new URL('../../acceptance/courtyard-combat-party-desktop.mjs',import.meta.url),'utf8'),start=harness.indexOf('function statistics('),end=harness.indexOf('\ntry{\n lock=',start);assert(start>=0&&end>start);
 const measure=vm.runInNewContext(harness.slice(start,end)+';combatPerformance'),trace={frames:[{at:0,active:true,segment:1,drawJsMs:1},{at:100,active:true,segment:1,drawJsMs:1}],pumps:[],observations:[],longTasks:[],hits:[],saveTimings:{spans:[{kind:'get-snapshot-js',at:10,end:30,durationMs:20},{kind:'host-save-await-context',at:30,end:430,durationMs:400}],capped:false}};
 const report=measure(trace);assert.equal(report.saveTiming.synchronousJavaScript['get-snapshot-js'].max,20);assert.equal(report.saveTiming.awaitContextMs.max,400);assert.equal(report.slowActiveIntervals[0].saveSynchronousJs.length,1);assert.equal(report.slowActiveIntervals[0].saveAwaitContext.length,1);assert.match(report.saveTiming.note,/not blocking CPU attribution/);
});

test('actual save callback captures current complete authority across play/read/route/closing contexts without consulting any UI view',()=>{
 const s=restoreSect(native);assert(commandSect(s,{type:'pause',paused:false}).ok);const staleTick=s.state.worldTick;advanceSect(s,.3);assert(s.state.worldTick>staleTick);
 const fn=main.split('\n').find(line=>line.startsWith('function saveSnapshot('));
 for(const flags of [{manualPause:false},{manualPause:true},{openingReading:true},{modal:'dialog'},{closing:true},{route:[{x:3,y:4}],activeWaypoint:{world:{x:5,y:6},tick:s.state.worldTick,exit:true,adjusted:true},destination:{x:7,y:8}}]){
  const expected=snapshotSect(s),before=snapshotSect(s),presentation={version:1,introFrame:2,bundle:{frame:1}},context={structuredClone,session:s,view:{tick:staleTick},snapshotSect,saveJS:(_kind,callback)=>callback(),refresh:()=>{throw Error('UI projection is unrelated to saving');},manualPause:false,openingReading:false,opening:{snapshotPresentation:()=>structuredClone(presentation)},route:[],activeWaypoint:null,destination:null,renderer:{camera:{x:9,y:10,zoom:1.25}},toWorld:(x,y)=>({x,y}),...flags};
  const save=vm.runInNewContext('('+fn+')',context),actual=save();expected.state.speed=context.manualPause||context.openingReading?0:1;
  assert.deepEqual(actual.state,expected.state);assert.equal(actual.state.worldTick,s.state.worldTick);assert.equal(context.view.tick,staleTick);assert.deepEqual(snapshotSect(s),before);assert.notEqual(actual.state,s.state);assert.deepEqual(JSON.parse(JSON.stringify(actual.courtyardPresentation.opening)),presentation);assert.equal(actual.courtyardPresentation.manualPause,context.manualPause);assert.deepEqual(JSON.parse(JSON.stringify(actual.courtyardPresentation.route)),context.route);
  actual.state.personsById['person:master'].wound=99;assert.deepEqual(snapshotSect(s),before,'saved output stays detached from the live world');
 }
});
