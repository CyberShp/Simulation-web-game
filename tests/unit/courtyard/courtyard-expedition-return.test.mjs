import test from 'node:test';
import assert from 'node:assert/strict';
import {expeditionReturnPlan} from '../../../apps/courtyard/courtyard-expedition-return.mjs';
import {expeditionCommand} from '../../../apps/courtyard/sect-combat.mjs';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect} from '../../../apps/courtyard/sect-sim.mjs';
const HOME='scene:yunxiu-courtyard';
test('valley return retains the actual local approach and departure exit',()=>{
 for(const near of [false,true]){const plan=expeditionReturnPlan({scene:{id:'scene:valley'},exits:[{id:'exit:valley-yunxiu',destination:HOME,available:true,near}],destinations:[{id:HOME,reachable:true}]});assert.equal(plan.kind,'exit');assert.equal(plan.label,near?'启程返院':'走向归院道');assert.deepEqual(plan.request,{action:'exit',exitId:'exit:valley-yunxiu'});}
});
test('prison without a local exit exposes the known public travel route and original party',()=>{
 const world={scene:{id:'scene:prison'},exits:[],party:{companionIds:['person:lu-zhiwei','person:lin-changfeng']},destinations:[{id:HOME,reachable:true,reason:'需亲自赶路',cost:{food:6,jade:0}}]},before=structuredClone(world),plan=expeditionReturnPlan(world);
 assert.equal(plan.available,true);assert.equal(plan.kind,'travel');assert.match(plan.reason,/口粮6/);assert.deepEqual(plan.request,{action:'travel',destination:HOME,companions:world.party.companionIds});assert.deepEqual(expeditionCommand({type:'world',action:plan.request}).command,{name:'srWorldCommand',args:[plan.request]});assert.deepEqual(world,before);
});
test('known route denials remain visible and cannot enable departure',()=>{
 for(const destination of [{id:HOME,reachable:false,reason:'道路不通'},{id:HOME,reachable:true,available:false,reason:'行囊口粮不足'}]){const plan=expeditionReturnPlan({scene:{id:'scene:prison'},destinations:[destination]});assert.equal(plan.available,false);assert.match(plan.reason,new RegExp(destination.reason));}
 const missing=expeditionReturnPlan({scene:{id:'scene:prison'},destinations:[]});assert.equal(missing.available,false);assert.equal(missing.request,null);
 assert.equal(expeditionReturnPlan({scene:{id:HOME}}),null);assert.equal(expeditionReturnPlan({travel:{id:'travel:1'}}),null);
});

test('actual insufficient return supplies are refused atomically and the UI announces the real reason',async()=>{
 // Explicit component setup, never a player save: known prison/foundation
 // preconditions and an empty return bag. Outbound party travel is public.
 const session=createSectSession(),s=session.state,personId=s.homeMemberIds[0];s.master.realm=10;s.srWorld.knownScenes.push('scene:prison');
 const sent=commandSect(session,{type:'world',action:{action:'travel',destination:'scene:prison',companions:[personId],cargo:{food:6}}});assert.equal(sent.ok,true,sent.error);
 for(let tick=0;tick<2000&&session.state.srWorld.activeTravelId;tick++)advanceSect(session,.1);assert.equal(session.state.srWorld.activeTravelId,null);assert.equal(session.state.master.location.sceneId,'scene:prison');
 session.state.stockpilesById['stockpile:sr-party'].resources.food=0;
 const plan=expeditionReturnPlan(viewSect(session).expedition.world),before=snapshotSect(session);assert.equal(plan.available,true);assert.deepEqual(plan.request.companions,[personId]);const refused=commandSect(session,{type:'world',action:plan.request});assert.equal(refused.ok,false);assert.match(refused.error,/物资不足/);assert.deepEqual(session.state,before.state);assert.deepEqual(plan.request.companions,[personId]);
 const source=await fs.readFile(new URL('../../../apps/courtyard/courtyard-combat.mjs',import.meta.url),'utf8'),sendSource=source.slice(source.indexOf(' function send('),source.indexOf(' function world('));let notice='';const context={canInteract:()=>true,command:()=>refused,announce:message=>{notice=message;}};vm.createContext(context);vm.runInContext(sendSource+';globalThis.sendToUI=send;',context);context.sendToUI({type:'world',action:plan.request});assert.equal(notice,refused.error);
});

test('the prison return projection starts an actual public trip for the original companions and arrives home',()=>{
 const session=createSectSession(),s=session.state,personId=s.homeMemberIds[0];s.master.realm=10;s.srWorld.knownScenes.push('scene:prison');
 assert.equal(commandSect(session,{type:'world',action:{action:'travel',destination:'scene:prison',companions:[personId],cargo:{food:6}}}).ok,true);
 for(let tick=0;tick<2000&&session.state.srWorld.activeTravelId;tick++)advanceSect(session,.1);assert.equal(session.state.master.location.sceneId,'scene:prison');
 const plan=expeditionReturnPlan(viewSect(session).expedition.world),sent=commandSect(session,{type:'world',action:plan.request});assert.equal(sent.ok,true,sent.error);const travel=session.state.travelsById[session.state.srWorld.activeTravelId];assert.deepEqual(travel.participantIds,['person:master',personId]);assert.equal(travel.destination,HOME);assert.notEqual(travel.status,'arrived');
 for(let tick=0;tick<2000&&session.state.srWorld.activeTravelId;tick++)advanceSect(session,.1);assert.equal(session.state.srWorld.activeTravelId,null);assert.equal(session.state.personsById[personId].location.sceneId,HOME);assert.equal(session.state.master.location.sceneId,HOME);
});
