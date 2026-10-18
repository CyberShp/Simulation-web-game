import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
const HOME='stockpile:yunxiu',SITE='site:domain:gc-26';
function send(run,name,...args){const out=dispatchCommand(run.state,{name,args});run.state=out.state;return out.result;}
function exact(run){run.control={...run.state.masterControl};const raw=snapshotSect(run),copy=restoreSect(raw);assert.deepEqual(snapshotSect(copy),raw);viewSect(copy);assert.deepEqual(snapshotSect(copy),raw);return copy;}
function until(run,predicate,label,max=9000){run.state.speed=1;for(let n=0;n<max&&!predicate(run.state);n++)tick(run.state,.1);assert(predicate(run.state),label);}

test('canonical GC26 world preserves real construction, four physical stages and exact full saves',()=>{
 let run=createSectSession();
 // Finite supplies fixture: checks the canonical negative-coordinate world,
 // full save and public command integration, not normal funding or desktop play.
 enableServiceResources(run.state);Object.assign(run.state.resources,{jade:200,wood:80,stone:80,herb:20,food:100,cleanWater:4});
 for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableWestWorkshops'])send(run,name);
 run=exact(run);const construction=send(run,'buildDomainSite',SITE);
 until(run,s=>s.workOrdersById[construction.workOrderId]?.materialFlow.phase==='carrying','physical construction cargo');run=exact(run);
 until(run,s=>!s.workOrdersById[construction.workOrderId],'canonical construction completes');run=exact(run);
 const b=run.state.buildings.find(b=>b.domainSiteId===SITE);assert(b);assert.deepEqual(b.transform,{x:-76,y:2,orientation:'south'});const stockId=`stockpile:${b.instanceId}`;
 const transport=send(run,'startTransport',HOME,stockId,'person:master',{herb:10,cleanWater:2,wood:1});until(run,s=>s.workOrdersById[transport.id]?.phase==='delivered','recipe materials reach actual GC26');run=exact(run);
 const result=commandSect(run,{type:'craft-pill',buildingId:b.instanceId,recipeId:'heal'});assert(result.ok,result.error);const id=result.result.id;const slots=[];
 for(let index=0;index<4;index++){
  until(run,s=>s.workOrdersById[id]?.process?.stageIndex===index&&s.workOrdersById[id].process.stageProgressTicks>=5,`work at stage ${index}`,2500);
  const s=run.state,w=s.workOrdersById[id],a=s.activitiesById[w.activityId],slot=slotById(s,a.slotId);assert.equal(a.phase,'working');assert(Math.hypot(s.master.position.x-slot.position.x,s.master.position.y-slot.position.y)<.04);slots.push(slot.id);assert.equal(s.stockpilesById[stockId].pills.heal,0);run=exact(run);
 }
 until(run,s=>s.workOrdersById[id].phase==='completed','sealed pills completed',500);const w=run.state.workOrdersById[id];assert.equal(w.progressTicks,280);assert.equal(new Set(slots).size,4);assert.equal(run.state.stockpilesById[stockId].pills.heal,2);assert.equal(run.state.stockpilesById[HOME].pills.heal,0);run=exact(run);
 for(let i=0;i<10;i++)tick(run.state,.1);assert.equal(run.state.stockpilesById[stockId].pills.heal,2);assert.equal(Object.values(run.state.factsById).filter(f=>f.workOrderId===id&&f.operation==='pill-production').length,1);exact(run);
});
