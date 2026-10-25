import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {cancelMasterHarvest} from '../../../src/simulation/ea-sr-economy.mjs';

function movingHarvest(){
 let s=validateSave(structuredClone(seed.state));
 for(const name of ['enableCourtyardTerrain','enableNorthLibrary','startMasterHarvest'])s=dispatchCommand(s,{name,args:name==='startMasterHarvest'?['wood']:[]}).state;
 // A valid saved walker can retain this action while the harvest owns its route.
 s.master.action='walk';
 s=validateSave(JSON.parse(JSON.stringify(s)));
 assert.equal(s.activitiesById[s.master.activityId].phase,'moving');
 assert(s.master.scenic.path.length);
 return s;
}
function conserved(s){return structuredClone({tick:s.worldTick,position:s.master.position,feet:{x:s.master.scenic.x,y:s.master.scenic.y},energy:s.master.energy,stocks:s.stockpilesById,patches:s.srEconomy.patches,facts:s.factsById,orders:s.workOrdersById});}
function cancelAndCheck(s){
 const before=conserved(s),oldActivity=s.master.activityId;
 const request={name:'cancelMasterHarvest',id:`command:${s.transactions.nextCommandId}`,expectedRevision:s.revision};
 const result=dispatchCommand(s,request);s=result.state;
 assert.deepEqual(result.result,{cancelled:true});
 assert.equal(s.master.action,'rest');assert.equal(s.master.activityId,null);
 assert.equal(s.activitiesById[oldActivity],undefined);assert.deepEqual(s.master.scenic.path,[]);assert.equal(s.master.scenic.goal,null);
 assert.deepEqual(conserved(s),before,'cancellation changes no inventory, source, work result, feet or elapsed time');
 const bytes=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(bytes))),bytes,'cancelled state roundtrips through the complete save validator');
 const replay=dispatchCommand(s,request);assert.equal(replay.replayed,true);assert.equal(JSON.stringify(replay.state),bytes,'retry resolves the original receipt without a second effect');
 return s;
}
test('public cancellation commits a moving harvest and preserves its physical state',()=>{cancelAndCheck(movingHarvest());});
test('public cancellation of a partly worked harvest neither consumes nor grants its reserved batch',()=>{
 let s=movingHarvest(),id=s.master.activityId;
 for(let n=0;n<1500&&(s.activitiesById[id]?.progressTicks||0)<10;n++)tick(s,.1);
 assert.equal(s.activitiesById[id]?.phase,'working');assert(s.activitiesById[id].progressTicks>=10);assert(s.activitiesById[id].progressTicks<100);
 cancelAndCheck(s);
});
test('a fresh cancellation after completion is rejected atomically',()=>{
 const s=cancelAndCheck(movingHarvest()),before=JSON.stringify(s);
 assert.throws(()=>dispatchCommand(s,{name:'cancelMasterHarvest'}),/没有掌门采集事务/);
 assert.equal(JSON.stringify(s),before,'rejection preserves the state and transaction counters');
});
test('cancelling while another body task is current preserves that task',()=>{
 let s=validateSave(structuredClone(seed.state));s=dispatchCommand(s,{name:'masterAction',args:['rest']}).state;
 const before=JSON.stringify(s);assert.throws(()=>dispatchCommand(s,{name:'cancelMasterHarvest'}),/没有掌门采集事务/);assert.equal(JSON.stringify(s),before);
});
test('the cancellation implementation refuses a harvest belonging to another person before mutation',()=>{
 const s=movingHarvest();s.activitiesById[s.master.activityId].personId='person:lu-zhiwei';
 const before=JSON.stringify(s);assert.throws(()=>cancelMasterHarvest(s),/没有掌门采集事务/);assert.equal(JSON.stringify(s),before);
});
