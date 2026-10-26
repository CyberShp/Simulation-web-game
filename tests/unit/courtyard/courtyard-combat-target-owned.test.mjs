import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createSectCommandDriver,commandSect,advanceSect,restoreSect,snapshotSect,viewSectCombat,createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {setCombatActorHp} from '../../../src/simulation/ea-sr-combat.mjs';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';

const source=process.env.IMMORTAL_OWNED_SOURCE?JSON.parse(fs.readFileSync(process.env.IMMORTAL_OWNED_SOURCE,'utf8')):buildCombatGroupComponent().native;
const bytes=s=>JSON.stringify(snapshotSect(s));
function pair({noLivingEnemies=false}={}){
 const prepared=restoreSect(source);
 // Declared component initial injury, before ownership/adoption. No victory,
 // reward, receipt or result is injected; the next world step settles normally.
 if(noLivingEnemies)for(const enemy of prepared.state.combat.enemies)setCombatActorHp(prepared.state,enemy,0);
 const ordinary=restoreSect(snapshotSect(prepared)),owned=restoreSect(snapshotSect(prepared)),command=createSectCommandDriver(()=>owned);command.adopt();return {ordinary,owned,command};
}
function issue(p,request){
 const before=bytes(p.owned),refs={...p.owned},expected=commandSect(p.ordinary,request),actual=p.command(request);
 assert.deepEqual(actual,expected);assert.equal(bytes(p.owned),bytes(p.ordinary),'complete saved session differs');
 if(!actual.ok){assert.equal(bytes(p.owned),before,'failed selection changed authority');for(const key of Object.keys(refs))assert.equal(p.owned[key],refs[key],'failed selection replaced '+key);}
 return actual;
}
for(const paused of [true,false])test(`owned selection/clear/invalid targets match every public fact while ${paused?'paused':'active'}`,()=>{
 const p=pair();assert(issue(p,{type:'pause',paused}).ok);
 if(!paused){advanceSect(p.ordinary,.1);advanceSect(p.owned,.1);assert.equal(bytes(p.owned),bytes(p.ordinary));}
 for(const enemy of p.owned.state.combat.enemies){
  assert(issue(p,{type:'combat-target',targetId:enemy.id}).ok);assert.equal(p.owned.state.combat.selectedTargetId,enemy.id);
  assert.equal(viewSectCombat(p.owned).expedition.combat.selectedTargetId,enemy.id);
  if(enemy.personId)assert(issue(p,{type:'combat-target',targetId:enemy.personId}).ok);
 }
 assert(issue(p,{type:'combat-target',targetId:null}).ok);assert.equal(p.owned.state.combat.selectedTargetId,null);
 for(const targetId of ['enemy:expired-id','person:master',p.owned.state.combat.allies[0]?.id??'ally:missing',42,{},NaN])assert.equal(issue(p,{type:'combat-target',targetId}).ok,false);
 for(let i=0;i<3;i++){advanceSect(p.ordinary,.1);advanceSect(p.owned,.1);assert.equal(bytes(p.owned),bytes(p.ordinary),'following world step differs');}
});

test('selection keeps one complete isolated world draft and detached mutable session metadata',()=>{
 const p=pair(),before={...p.owned},clone=globalThis.structuredClone,inputs=[];let actual;
 globalThis.structuredClone=(value,...args)=>{inputs.push(value);return clone(value,...args);};
 try{actual=p.command({type:'combat-target',targetId:p.owned.state.combat.enemies[0].id});}finally{globalThis.structuredClone=clone;}
 assert(actual.ok,actual.error);assert.equal(inputs.filter(v=>v?.schemaVersion===6).length,1);assert.equal(inputs.filter(v=>v?.state?.schemaVersion===6).length,0);
 assert.notEqual(p.owned.state,before.state);assert.equal(p.owned.provenance,before.provenance);
 for(const key of ['policy','control','budget','automation','ledger','totals','baseline'])assert.notEqual(p.owned[key],before[key],key);
 assert.equal(before.state.combat.selectedTargetId,source.state.combat.selectedTargetId);
});

test('no living target permits clear, rejects stale target and then settles through the same real tick',()=>{
 const p=pair({noLivingEnemies:true}),id=p.owned.state.combat.enemies[0].id;
 assert(issue(p,{type:'combat-target',targetId:null}).ok);assert.equal(issue(p,{type:'combat-target',targetId:id}).ok,false);
 assert(issue(p,{type:'pause',paused:false}).ok);advanceSect(p.ordinary,.1);advanceSect(p.owned,.1);assert.equal(bytes(p.owned),bytes(p.ordinary));assert.equal(p.owned.state.combat.status,'won');
 assert.equal(issue(p,{type:'combat-target',targetId:id}).ok,false);
});

test('outside combat owned selection retains the public refusal and original complete state',()=>{
 const ordinary=createSectSession(),owned=restoreSect(snapshotSect(ordinary)),command=createSectCommandDriver(()=>owned);command.adopt();
 const before=bytes(owned),request={type:'combat-target',targetId:'enemy:missing'};assert.deepEqual(command(request),commandSect(ordinary,request));assert.equal(bytes(owned),before);assert.equal(bytes(owned),bytes(ordinary));
});

test('lower owned target dispatch retains revision, command-id and replay semantics',()=>{
 const s=restoreSect(source).state,target=s.combat.enemies[0].id,command={name:'setSRCombatTarget',args:[target],id:'command:'+s.transactions.nextCommandId,expectedRevision:s.revision};
 const before=JSON.stringify(s),actual=SIM.dispatchOwnedCombatCommand(s,command),expected=SIM.dispatchCommand(s,command);assert.deepEqual(actual,expected);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(SIM.dispatchOwnedCombatCommand(actual.state,command),SIM.dispatchCommand(expected.state,command));
 for(const request of [{...command,id:'command:'+actual.state.transactions.nextCommandId,expectedRevision:s.revision},{...command,args:[null]}]){
  let a,e;try{SIM.dispatchOwnedCombatCommand(actual.state,request);}catch(error){a=error.message;}try{SIM.dispatchCommand(expected.state,request);}catch(error){e=error.message;}assert(a);assert.equal(a,e);
 }
});

const main=fs.readFileSync(new URL('../../../apps/courtyard/courtyard-main.mjs',import.meta.url),'utf8'),start=main.indexOf('function issue(request){'),end=main.indexOf('\nfunction pauseReasons',start);
function projection({request={type:'combat-target'},ok=true,active=true,scene=true,complete=true,full=false,closing=false,importing=false,suspended=false,protectedSave=false}={}){
 const refreshes=[],result={ok},session={state:{combat:active?{status:'active'}:null}},context={session,closing,importing,suspended,persistence:{status:()=>({protected:protectedSave})},refresh:value=>refreshes.push(value),ownedCommand:()=>result,view:{expedition:{scene:{type:scene?'combat':'world'}},opening:{stage:complete?'complete':'intro'}},needsFullView:()=>full};
 assert(start>=0&&end>start);const issue=vm.runInNewContext(main.slice(start,end)+';issue',context),actual=issue(request);return {refreshes:JSON.parse(JSON.stringify(refreshes)),actual};
}
test('actual desktop issue uses a fresh battle projection for successful selection/auto and complete projection for every failed or gated case',()=>{
 for(const type of ['combat-target','combat-auto']){
  for(const request of [{type,targetId:null},{type,targetId:'enemy:1'}])assert.deepEqual(projection({request}).refreshes,[{automatic:true,force:true}]);
  for(const flags of [{ok:false},{active:false,scene:false},{scene:false},{complete:false},{full:true},{closing:true},{importing:true},{suspended:true},{protectedSave:true}])assert.deepEqual(projection({request:{type},...flags}).refreshes,[null],JSON.stringify(flags));
 }
 for(const type of ['combat-input','combat','pause'])assert.deepEqual(projection({request:{type}}).refreshes,[{automatic:true,force:true}]);
 assert.deepEqual(projection({request:{type:'world'}}).refreshes,[null]);
});
