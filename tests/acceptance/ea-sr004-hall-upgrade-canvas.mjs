/** SR-XF-004-AC-01: source-backed hall upgrade state and prefab checks. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {validateSave} from '../../src/simulation/ea-opening-sim.mjs';
import {spatialPrefab,viewSpatial} from '../../src/simulation/ea-sr-spatial.mjs';

const source=resolve(process.argv[2]||'/tmp/immortal-sr004-stage-sources');
const sourceReport=JSON.parse(readFileSync(join(source,'hall-report.json'),'utf8'));
assert.equal(sourceReport.source,'tests/fixtures/ea-reference-world.json');
assert.equal(sourceReport.sourceBuildings,40);
assert.equal(sourceReport.sourcePeople,30);
for(const stage of ['preview','upgrading','upgraded']){
 const file=`hall-${stage}.json`,raw=JSON.parse(readFileSync(join(source,file),'utf8'));
 const state=validateSave(raw),saved=JSON.stringify(raw);
 assert.equal(JSON.stringify(state),saved,`${stage} exact source save load`);
 const check=sourceReport.checks.find(item=>item.type==='hall'&&item.stage===stage);
 assert(check&&check.file===file&&check.worldTick===state.worldTick);
 const hall=state.buildings.find(b=>b.type==='hall');
 assert(hall&&hall.instanceId==='building:yunxiu:1');
 const work=viewSpatial(state);
 if(stage==='upgrading')assert(work?.operation==='upgrade'&&work.progress>0&&work.progress<1);
 else assert.equal(work,null);
 const candidate=stage==='preview'?{...hall,level:hall.level+1}:stage==='upgrading'?work.building:hall;
 const prefab=spatialPrefab(candidate);
 assert.equal(prefab.indoor,true);
 assert.deepEqual({width:prefab.width,height:prefab.height},{width:10,height:10});
 assert.equal(JSON.stringify(state),saved,`${stage} shared projections leave the save unchanged`);
}
console.log('SR004 hall upgrade: 3 source-backed state and prefab stages');
