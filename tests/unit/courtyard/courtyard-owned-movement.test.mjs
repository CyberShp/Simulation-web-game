import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,createSectCommandDriver,commandSect,advanceSect,restoreSect,snapshotSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';

function pair(source=createSectSession()){
 const raw=snapshotSect(source),ordinary=restoreSect(raw),owned=restoreSect(raw),command=createSectCommandDriver(()=>owned);
 command.adopt();return {ordinary,owned,command};
}
const same=p=>assert.deepEqual(snapshotSect(p.owned),snapshotSect(p.ordinary));
function issue(p,request){
 const before=snapshotSect(p.owned),actual=p.command(request),expected=commandSect(p.ordinary,request);
 assert.deepEqual(actual,expected);same(p);if(!actual.ok)assert.deepEqual(snapshotSect(p.owned),before,'failed replacement retains the entire original session');return actual;
}
function steps(p,count){for(let n=0;n<count;n++){advanceSect(p.ordinary,.1);advanceSect(p.owned,.1);same(p);}}
function roundTrip(p){same(p);assert.deepEqual(snapshotSect(restoreSect(snapshotSect(p.owned))),snapshotSect(p.ordinary));}
function transport(phase){
 const s=createSectSession(),out=commandSect(s,{type:'transport',sourceStockpileId:'stockpile:yunxiu',targetStockpileId:'stockpile:building:yunxiu:2',cargo:{herb:1}});assert(out.ok);
 if(phase==='carrying'){assert(commandSect(s,{type:'pause',paused:false}).ok);for(let n=0;n<600&&s.state.workOrdersById[out.result.id].phase!=='carrying';n++)advanceSect(s,.1);}
 assert.equal(s.state.workOrdersById[out.result.id].phase,phase);return s;
}

test('owned movement retains exact public receipts, following world steps and save output',()=>{
 const p=pair();assert(issue(p,{type:'move',x:35,y:28}).ok);assert(p.owned.state.master.scenic.path.length);issue(p,{type:'pause',paused:false});steps(p,12);
 assert(issue(p,{type:'move',x:17,y:46}).ok);steps(p,8);roundTrip(p);assert.deepEqual(viewSect(p.owned),viewSect(p.ordinary));
});

test('no-path and malformed positions preserve walking and idle sessions',()=>{
 for(const walking of [false,true]){
  const p=pair();if(walking)assert(issue(p,{type:'move',x:35,y:28}).ok);
  for(const request of [{type:'move',x:110,y:20},{type:'move',x:999,y:999},{type:'move',x:NaN,y:20},{type:'move',x:20,y:Infinity},{type:'move',x:'20',y:30}])assert.equal(issue(p,request).ok,false);
  roundTrip(p);
 }
});

for(const phase of ['to-source','carrying'])test(`owned replacement isolates a ${phase} transport, cargo and cancellation receipts`,()=>{
 const p=pair(transport(phase)),before=snapshotSect(p.owned);
 assert.equal(issue(p,{type:'move',x:110,y:20}).ok,false);assert.deepEqual(snapshotSect(p.owned),before,'a failed move cannot commit its prior transport cancellation');
 assert.equal(issue(p,{type:'move',x:NaN,y:20}).ok,false);
 assert(issue(p,{type:'move',x:35,y:28}).ok);assert.equal(p.owned.state.master.activityId,null);roundTrip(p);steps(p,5);
});

test('owned replacement isolates an accepted study and refunds it only after a valid move',()=>{
 const s=createSectSession();assert(commandSect(s,{type:'study',artId:'qingwind'}).ok);const p=pair(s),id=p.owned.state.master.activityId;
 assert.equal(p.owned.state.activitiesById[id].kind,'sr-cultivation');assert.equal(issue(p,{type:'move',x:110,y:20}).ok,false);assert.equal(p.owned.state.master.activityId,id);
 assert(issue(p,{type:'move',x:35,y:28}).ok);roundTrip(p);steps(p,5);
});

test('only the adopted driver owns the lighter draft; new sessions and public inputs stay fully checked',()=>{
 let current=createSectSession();const command=createSectCommandDriver(()=>current);command.adopt();
 current=snapshotSect(current);current.state.personsById['person:master'].wound=NaN;const before=snapshotSect(current);
 assert.throws(()=>command({type:'move',x:35,y:28}));assert.deepEqual(snapshotSect(current),before);assert.equal(commandSect(current,{type:'move',x:35,y:28}).ok,false);assert.deepEqual(snapshotSect(current),before);
 current=createSectSession();assert(command({type:'move',x:35,y:28}).ok);roundTrip({owned:current,ordinary:restoreSect(snapshotSect(current))});
});
