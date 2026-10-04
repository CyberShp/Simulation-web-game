import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-sim.mjs';
import {facilityRecords,courtyardDestination,scenicHomeActors,nextObjective,sceneSnapshot} from '../dist/ea-scene-state.mjs';
import {scenicCanStand} from '../dist/ea-scene-geometry.mjs';
import {Player} from '../qa/ea-player.mjs';

test('new courtyard shows exactly the surviving house and an actionable recovery objective',()=>{
 const s=S.initial(),before=structuredClone(s),view=sceneSnapshot(s);
 assert.deepEqual(view.facilities.map(r=>r.type),['hall']);assert.equal(view.people.length,0);assert.equal(view.objective.kind,'heal');
 assert.deepEqual(s,before,'scene projection must be read-only');
 S.masterAction(s,'heal');assert.equal(nextObjective(s).kind,'self');S.tick(s,16);assert.equal(nextObjective(s).kind,'journal');
 s.story.step=2;s.resources.wood=0;assert.equal(nextObjective(s).kind,'production');assert.match(nextObjective(s).text,/灵木 25/);
});
test('build, upgrade, relocation, pause, demolition and restore project the exact facility IDs',()=>{
 const s=S.initial();Object.assign(s.resources,{wood:200,stone:200,jade:300});
 const farm=S.build(s,'farm',5,3),lumber=S.build(s,'lumber',6,3);
 assert.deepEqual(new Set(facilityRecords(s).map(r=>r.id)),new Set(s.buildings.map(b=>b.id)));
 S.upgrade(s,farm.id);assert.equal(facilityRecords(s).find(r=>r.id===farm.id).building.level,2);
 const pos={...facilityRecords(s).find(r=>r.id===lumber.id).position};S.relocate(s,lumber.id,7,3);
 assert.notDeepEqual(facilityRecords(s).find(r=>r.id===lumber.id).position,pos);
 S.toggleBuilding(s,farm.id);assert.equal(facilityRecords(s).find(r=>r.id===farm.id).active,false);
 S.demolish(s,lumber.id);assert.ok(!facilityRecords(s).some(r=>r.id===lumber.id));
 const restored=S.validateSave(s);assert.deepEqual(sceneSnapshot(restored),sceneSnapshot(s));
});
test('NPC destinations use existing active facilities, and away people never appear at home',()=>{
 const s=new Player().chapterOne().state,d=s.disciples[0],farm=s.buildings.find(b=>b.type==='farm');
 d.job=farm.id;d.mind.activity='work';assert.equal(courtyardDestination(s,d).id,farm.id);
 S.toggleBuilding(s,farm.id);assert.notEqual(courtyardDestination(s,d).id,farm.id);
 d.mind.activity='study';assert.equal(courtyardDestination(s,d).type,'library');
 S.demolish(s,s.buildings.find(b=>b.type==='library').id);assert.equal(courtyardDestination(s,d).type,'hall','no phantom library');
 assert.ok(scenicHomeActors(s).some(p=>p.id===d.id));d.mind.away={kind:'errand',id:'valley_path'};assert.ok(!scenicHomeActors(s).some(p=>p.id===d.id));
});
test('map discovers in chapter order while temporary locks do not erase known places',()=>{
 const s=S.initial();assert.equal(S.explorationOptions(s).regions.length,0);
 s.story.step=2;assert.deepEqual(S.explorationOptions(s).regions.map(r=>r.id),['valley']);
 s.story.step=4;assert.deepEqual(S.explorationOptions(s).regions.map(r=>r.id),['valley','market','quarry','ruins']);
 s.master.energy=0;assert.equal(S.explorationOptions(s).regions.length,4);assert.ok(S.explorationOptions(s).regions.every(r=>r.locked));
 s.story.step=6;assert.equal(S.explorationOptions(s).regions.length,8);s.story.step=7;assert.equal(S.explorationOptions(s).regions.length,9);
});
test('hidden routes cannot be published through the command and can always be withdrawn from an old save',()=>{
 const s=S.initial(),before=structuredClone(s);assert.throws(()=>S.offerRoute(s,'valley_path'),/先赠药/);assert.deepEqual(s,before);
 s.doctrine.routes.push('lake_depths');S.offerRoute(s,'lake_depths');assert.deepEqual(s.doctrine.routes,[]);
 s.story.step=2;S.offerRoute(s,'valley_path');assert.deepEqual(s.doctrine.routes,['valley_path']);assert.throws(()=>S.offerRoute(s,'lake_shore'),/整理遗卷/);
 assert.throws(()=>S.startMasterTravel(s,'lake_shore'),/寒潭差事/);
});
test('exploration stays on the visible road spine and restores a pending walk without duplicate rewards',()=>{
 const s=new Player().chapterOne().state;S.startExploration(s,'valley');S.tick(s,15);S.moveExploration(s,8,1);
 assert.equal(s.world.exploration.target.y,4);S.tick(s,12);assert.equal(S.explorationOptions(s).active.canInteract,true);
 const restore=S.validateSave(s),before=structuredClone(restore.resources);S.tick(restore,1);assert.deepEqual(restore.resources,before);
});
test('intro acknowledgment survives reload without rewards, recruits or story advancement',()=>{
 const s=S.initial(),before=structuredClone(s);S.acknowledgeIntro(s);S.acknowledgeIntro(s);
 assert.deepEqual(s.resources,before.resources);assert.equal(s.story.step,0);assert.equal(s.disciples.length,0);
 assert.equal(S.validateSave(s).story.intro,true);
});
test('home story prerequisites require working facilities and give a repair or resume destination',()=>{
 const s=new Player().chapterOne().state;s.story.step=2;
 const farm=s.buildings.find(b=>b.type==='farm');S.toggleBuilding(s,farm.id);
 assert.equal(S.storyReady(s),false);assert.equal(nextObjective(s).kind,'facility');assert.equal(nextObjective(s).id,farm.id);
 const before=structuredClone(s);assert.throws(()=>S.advanceStory(s),/灵草田可运行/);assert.deepEqual(s,before);
 S.toggleBuilding(s,farm.id);assert.equal(S.storyReady(s),true);
 s.story.step=3;const library=s.buildings.find(b=>b.type==='library');library.condition=0;
 assert.equal(S.storyReady(s),false);assert.equal(nextObjective(s).id,library.id);
 Object.assign(s.resources,{wood:100,stone:100});S.repairBuilding(s,library.id);assert.equal(S.storyReady(s),true);
});
test('all facilities in the full campaign have named access points on registered paths',()=>{
 const s=new Player().foundation().prepareRevenge().finishRevenge().establishTwoPeaks().referenceWorld().state,records=facilityRecords(s);
 assert.equal(records.length,s.buildings.length);assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 for(const r of records)assert.equal(scenicCanStand(s,r.access),true,`${r.name} must have a path access point`);
 for(const d of scenicHomeActors(s))assert.ok(records.some(r=>r.id===courtyardDestination(s,d,records).id&&r.active));
 assert.deepEqual(sceneSnapshot(S.validateSave(s)),sceneSnapshot(s));
});
