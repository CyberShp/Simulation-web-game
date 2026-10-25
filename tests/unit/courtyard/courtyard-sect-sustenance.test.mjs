import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {sectSustenanceCandidate,beginSectSustenance} from '../../../src/simulation/ea-sect-sustenance.mjs';

test('a willing resident physically collects grain and delivers once across native save restore',()=>{
 // Isolated transport fixture, separate from the five-resident ordinary-save run.
 let run=createSectSession(),s=run.state,d=s.disciples[0],b=s.buildings.find(b=>b.type==='farm');
 b.type='granary';b.prefabId='prefab:granary:units:v1';b.enabled=true;
 const source=s.stockpilesById[`stockpile:${b.instanceId}`],home=s.stockpilesById['stockpile:yunxiu'];
 source.resources.food=14;home.resources.food=1;d.energy=80;d.wound=0;d.mind.satiety=90;d.mind.commitUntil=0;d.schedule.commitUntilTick=0;d.mind.activity='rest';d.mind.relationships.master.trust=80;d.mind.traits[3]=80;
 const candidate=sectSustenanceCandidate(s,d);assert(candidate);assert.equal(candidate.quantity,12);
 const started=beginSectSustenance(s,d,candidate);assert(started.accepted);assert.equal(source.resources.food,2);assert.equal(home.resources.food,1);
 assert.equal(s.workOrdersById[started.id].phase,'to-source');
 run=restoreSect(snapshotSect(run));s=run.state;s.speed=1;
 for(let n=0;n<2000&&s.workOrdersById[started.id].phase!=='delivered';n++)tick(s,.1);
 const order=s.workOrdersById[started.id];assert.equal(order.phase,'delivered');assert.equal(s.stockpilesById['stockpile:yunxiu'].resources.food,13);
 const receipt=s.factsById[`fact:transport:${started.id}`];assert.deepEqual(receipt.quantities,{food:12});assert.equal(receipt.sourceStockpileId,source.id);
 run.control.idleMs=s.masterControl.idleMs;
 const restored=restoreSect(snapshotSect(run));assert.deepEqual(snapshotSect(restored),snapshotSect(run));
 assert.equal(Object.values(s.factsById).filter(f=>f.id===receipt.id).length,1);
});
