/** U-101 / SR-XF-004: real public activity in one closed and one open-air facility. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './ea-sr-integration-acceptance.mjs';
import {spatialPrefab,spatialFootprint,polygonContains} from '../../src/simulation/ea-sr-spatial.mjs';

test('actual hall student and farm worker occupy their respective indoor and outdoor facilities',()=>{
 const h=harness();
 h.act('acknowledgeIntro');h.act('masterAction','heal');h.until(s=>s.master.wound===0,'opening healing');
 h.act('advanceStory');h.walkPerson('person:lu-zhiwei');h.act('advanceStory','gift');h.act('advanceStory','invite');
 h.build('farm');h.build('lumber');h.walkPerson('person:lin-changfeng');h.act('advanceStory');
 h.until(s=>Object.values(s.factsById).some(f=>f.kind==='inventory-transaction'&&f.operation==='production'),'earned farm batch',6000);
 h.save();
 const s=h.s,lu=s.personsById['person:lu-zhiwei'],lin=s.personsById['person:lin-changfeng'];
 const farm=s.buildings.find(b=>b.type==='farm'),hall=s.buildings.find(b=>b.type==='hall');
 assert.equal(s.activitiesById[lu.activityId]?.phase,'executing');
 assert.equal(s.activitiesById[lin.activityId]?.phase,'executing');
 assert.equal(spatialPrefab(farm).indoor,false);assert.equal(spatialPrefab(hall).indoor,true);
 assert(polygonContains(lu.mind.scenic,spatialFootprint(farm)));
 assert(polygonContains(lin.mind.scenic,spatialFootprint(hall)));
});
