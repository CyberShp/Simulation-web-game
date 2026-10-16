import assert from 'node:assert/strict';
import * as sim from '../../src/simulation/ea-opening-sim.mjs';

const act=(state,name,...args)=>sim.dispatchCommand(state,{name,args}).state;
const save=state=>sim.validateSave(JSON.parse(JSON.stringify(state)));
function until(state,predicate,label,limit=1200){
 for(let n=0;n<limit&&!predicate(state);n++)sim.tick(state,.1);
 assert.ok(predicate(state),`${label} did not finish`);
 return state;
}
function healedOpening(){
 let state=sim.initial({sr:true,mountainOpening:true});
 assert.equal(state.story.opening.hallPhase,'shelter');
 assert.throws(()=>act(state,'establishHall'),/养伤/);
 state=act(state,'masterAction','heal');
 assert.equal(state.story.opening.inheritance.status,'pending');
 state=act(state,'chooseOpeningInheritance','qinglan');
 return until(state,s=>s.master.wound===0,'initial healing');
}

{
 let state=healedOpening();
 const hall=state.buildings.find(b=>b.type==='hall'),before={...state.resources};
 assert.throws(()=>act(state,'build','farm',12,40),/主殿/);
 state=act(state,'establishHall');
 assert.equal(state.story.opening.hallPhase,'building');
 assert.equal(state.buildings.find(b=>b.type==='hall').instanceId,hall.instanceId);
 assert.deepEqual(Object.fromEntries(Object.keys(sim.HALL_ESTABLISH_COST).map(k=>[k,before[k]-state.resources[k]])),sim.HALL_ESTABLISH_COST);
 assert.equal(sim.viewSpatial(state).operation,'establish');
 assert.throws(()=>act(state,'establishHall'),/身体活动|营造/);
 until(state,s=>s.workOrdersById['work:construction:1']?.progressTicks>=60,'actual construction');
 const progress=state.workOrdersById['work:construction:1'].progressTicks;
 state=save(state);
 assert.equal(state.story.opening.hallPhase,'building');
 assert.equal(state.workOrdersById['work:construction:1'].progressTicks,progress);
 until(state,s=>s.story.opening.hallPhase==='complete','main hall construction');
 assert.equal(state.buildings.filter(b=>b.type==='hall').length,1);
 assert.equal(state.buildings.find(b=>b.type==='hall').instanceId,hall.instanceId);
 assert.equal(state.buildings.find(b=>b.type==='hall').level,1);
 assert.deepEqual(state.spatial.completedOrders.at(-1).usedCost,sim.HALL_ESTABLISH_COST);
 assert.equal(save(state).story.opening.hallPhase,'complete');
 assert.throws(()=>act(state,'establishHall'),/主殿营造已安排/);
}

{
 let state=healedOpening();
 const before={...state.resources};
 state=act(state,'establishHall');
 until(state,s=>s.workOrdersById['work:construction:1']?.progressTicks>=60,'partial construction');
 state=act(state,'cancelConstruction');
 until(state,s=>s.story.opening.hallPhase==='shelter','material return');
 assert.equal(state.spatial.completedOrders.at(-1).phase,'cancelled');
 for(const [resource,cost]of Object.entries(sim.HALL_ESTABLISH_COST)){
  const used=state.spatial.completedOrders.at(-1).usedCost[resource];
  assert.equal(state.resources[resource],before[resource]-used);
  assert.ok(used>0&&used<cost);
 }
 assert.equal(save(state).story.opening.hallPhase,'shelter');
}

{
 const existing=JSON.parse(JSON.stringify(sim.initial({sr:true})));
 assert.equal(existing.story.opening.hallPhase,'complete');
 delete existing.story.opening.hallPhase;
 const loaded=sim.validateSave(existing);
 assert.equal(loaded.story.opening.hallPhase,'complete');
 assert.equal(loaded.buildings.find(b=>b.type==='hall').instanceId,'building:yunxiu:1');
}

console.log('Opening main hall: healing gate, material work, save/load, cancellation, prior save passed.');
