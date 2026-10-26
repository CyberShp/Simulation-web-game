import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,createSectCommandDriver,commandSect,advanceSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';

const sources=new Map();
const send=(session,request)=>{const result=commandSect(session,request);assert.equal(result.ok,true,result.error);return result;};
const step=(session,n=1)=>{for(let i=0;i<n;i++)advanceSect(session,.1);};
function battle(kit='jinfeng'){
 if(!sources.has(kit)){
  let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
  for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',[kit]]])state=SIM.dispatchCommand(state,{name,args}).state;
  while(state.master.wound>0)SIM.tick(state,.1);
  const session=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'ground-sword-public-route'}}});
  const until=(predicate,label)=>{for(let i=0;i<3500&&!predicate();i++)step(session);assert(predicate(),label);};
  send(session,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});until(()=>!session.state.master.scenic.path.length,'gate');
  send(session,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}}});until(()=>!session.state.srWorld.activeTravelId,'valley');
  send(session,{type:'world',action:{action:'move',x:21,y:36}});until(()=>!session.state.srWorld.interaction,'approach');
  send(session,{type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});sources.set(kit,snapshotSect(session));
 }
 return restoreSect(sources.get(kit));
}
const aim=session=>({x:session.state.combat.enemies[0].x,y:session.state.combat.enemies[0].y});
const cast=(session,target=aim(session))=>send(session,{type:'combat',actionId:'ground-sword',target});

test('commandSect routes Q through the formal three-step release and one delayed hit with exactly one cost',()=>{
 const s=battle(),target=aim(s),requested={...target},qi=s.state.combat.player.qi;
 const reply=cast(s,requested);assert.equal(reply.result.pending,true);requested.x-=4;step(s,2);
 assert.equal(s.state.srCombat.pending.action,'ground-sword');assert.deepEqual(s.state.srCombat.pending.target,target);assert.equal(s.state.combat.player.qi,qi);
 step(s);assert.equal(s.state.srCombat.pending,null);assert.equal(s.state.combat.player.qi,qi-16);
 const strike=structuredClone(s.state.combat.groundStrikes[0]);assert.equal(s.state.srCombat.cooldowns['ground-sword'],s.state.worldTick+18);step(s);
 assert.equal(s.state.combat.groundStrikes.length,0);assert.equal(s.state.combat.effects.filter(e=>e.kind==='hit'&&e.groundStrikeId===strike.id).length,1);
 const before=snapshotSect(s),again=commandSect(s,{type:'combat',actionId:'ground-sword',target});assert.equal(again.ok,false);assert.match(again.error,/冷却/);assert.deepEqual(snapshotSect(s),before);
});

test('commandSect Space cancels unreleased Q and charges only the actual dodge',()=>{
 const s=battle(),qi=s.state.combat.player.qi;cast(s);step(s);
 send(s,{type:'combat',actionId:'dodge',target:{x:s.state.combat.player.x,y:s.state.combat.player.y-2.8}});step(s,4);
 assert.equal(s.state.srCombat.cooldowns['ground-sword'],undefined);assert.equal(s.state.combat.groundStrikes?.length||0,0);assert(!s.state.combat.effects.some(e=>e.groundSword));
 assert(s.state.combat.player.qi>=qi-8);assert.equal(s.state.srCombat.executions.filter(e=>e.action==='ground-sword'&&e.phase==='interrupted').length,1);
});

test('public paused Q plans without payment and releases only after three resumed world steps',()=>{
 const s=battle(),qi=s.state.combat.player.qi;send(s,{type:'pause',paused:true});cast(s);const frozen=snapshotSect(s);step(s,8);assert.deepEqual(snapshotSect(s),frozen);
 send(s,{type:'pause',paused:false});step(s,2);assert.equal(s.state.combat.player.qi,qi);step(s);assert.equal(s.state.combat.player.qi,qi-16);assert.equal(s.state.combat.groundStrikes.length,1);
});

test('desktop owned Q uses one isolated world draft and matches public receipts and all following world facts',()=>{
 const ordinary=battle(),owned=restoreSect(snapshotSect(ordinary)),driver=createSectCommandDriver(()=>owned);driver.adopt();
 const request={type:'combat',actionId:'ground-sword',target:aim(ordinary)},original=globalThis.structuredClone,worlds=[];let actual;
 globalThis.structuredClone=(value,...rest)=>{if(value?.schemaVersion===6)worlds.push(value);return original(value,...rest);};
 try{actual=driver(request);}finally{globalThis.structuredClone=original;}
 assert.equal(actual.ok,true,actual.error);assert.equal(worlds.length,1,'Q follows the same owned path as other formal combat skills');
 assert.deepEqual(actual,commandSect(ordinary,request));assert.deepEqual(snapshotSect(owned),snapshotSect(ordinary));
 for(let i=0;i<5;i++){step(owned);step(ordinary);assert.deepEqual(snapshotSect(owned),snapshotSect(ordinary));}
});

test('owned Q cancellation preserves public body, costs and frozen input outcomes',()=>{
 const ordinary=battle(),owned=restoreSect(snapshotSect(ordinary)),driver=createSectCommandDriver(()=>owned);
 const issue=request=>{const actual=driver(request);assert.equal(actual.ok,true,actual.error);assert.deepEqual(actual,commandSect(ordinary,request));assert.deepEqual(snapshotSect(owned),snapshotSect(ordinary));};
 issue({type:'combat',actionId:'ground-sword',target:aim(ordinary)});step(ordinary);step(owned);
 issue({type:'combat',actionId:'dodge',target:{x:ordinary.state.combat.player.x,y:ordinary.state.combat.player.y-2.8}});
 for(let i=0;i<4;i++){step(ordinary);step(owned);assert.deepEqual(snapshotSect(owned),snapshotSect(ordinary));}
 assert.equal(owned.state.srCombat.cooldowns['ground-sword'],undefined);assert.equal(owned.state.combat.groundStrikes?.length||0,0);
});

test('recognized Q still rejects unavailable sword knowledge and invalid targets atomically',()=>{
 const unlearned=battle('qinglan'),before=snapshotSect(unlearned),reply=commandSect(unlearned,{type:'combat',actionId:'ground-sword',target:aim(unlearned)});
 assert.equal(reply.ok,false);assert.match(reply.error,/剑术/);assert.deepEqual(snapshotSect(unlearned),before);
 const s=battle();for(const target of [null,{x:NaN,y:0},{x:s.state.combat.player.x+9,y:s.state.combat.player.y}]){
  const before=snapshotSect(s),result=commandSect(s,{type:'combat',actionId:'ground-sword',target});assert.equal(result.ok,false);assert.deepEqual(snapshotSect(s),before);
 }
});
