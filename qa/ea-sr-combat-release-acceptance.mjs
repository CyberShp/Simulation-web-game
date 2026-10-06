/** Combat reservation boundary fixtures; not a normal-play victory proof. */
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {reserveBody,ownedActivity} from '../dist/ea-sr-equipment.mjs';
import {initSRCombat,tickSRCombat} from '../dist/ea-sr-combat.mjs';
const passed=[];
function check(name,fn){fn();passed.push(name);}
function fixture(){const s=S.initial({sr:true,seed:618033});reserveBody(s,s.master,'combat','combat-action:fixture');s.master.action='combat';return s;}
check('a finished battle releases its body even when no pending action survives',()=>{
 const s=fixture();s.combat={status:'won'};s.srCombat.pending=null;s.worldTick++;
 tickSRCombat(s);assert.equal(ownedActivity(s,s.master),null);assert.equal(s.master.action,'rest');
});
check('an acknowledged old save can recover before the next public body command',()=>{
 const s=fixture();s.combat=null;s.srCombat.pending={id:'combat-action:fixture',action:'attack',phase:'recovery',progressTicks:4,executed:true};
 initSRCombat(s);assert.equal(ownedActivity(s,s.master),null);assert.equal(s.srCombat.pending,null);
 const before=JSON.stringify(s.srCombat.executions);initSRCombat(s);assert.equal(JSON.stringify(s.srCombat.executions),before);
 const legacy=fixture();legacy.combat=null;const r=S.dispatchCommand(legacy,{name:'masterAction',args:['rest']});assert.equal(r.state.master.action,'rest');assert.equal(ownedActivity(r.state,r.state.master)?.kind==='sr-combat',false);
});
check('active combat keeps its current reservation',()=>{
 const s=fixture();s.combat={status:'active'};initSRCombat(s);assert.equal(ownedActivity(s,s.master).kind,'sr-combat');
});
check('battle cleanup never releases a newer unrelated body activity',()=>{
 const s=S.initial({sr:true,seed:618033});reserveBody(s,s.master,'harvest','unrelated');s.combat=null;
 const before=JSON.stringify(ownedActivity(s,s.master));initSRCombat(s);s.worldTick++;tickSRCombat(s);
 assert.equal(JSON.stringify(ownedActivity(s,s.master)),before);
});
console.log(JSON.stringify({suite:'combat reservation release',passed:passed.length,failed:0,cases:passed,boundary:'Explicit finished/active combat fixtures; normal battle reachability is tracked by the separate public integration suite.'},null,2));
