/** SR-XF-004-D01: source-backed closed-building construction stages. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {validateSave} from '../../src/simulation/ea-opening-sim.mjs';
import {viewSpatial,spatialPrefab} from '../../src/simulation/ea-sr-spatial.mjs';

const source=resolve(process.argv[2]||'/tmp/immortal-sr004-stage-sources');
// Keep the established CLI position for the requested building type.
const type=process.argv[4]||'library';
const stages=['foundation','structure','finishing'];
const sourceReport=JSON.parse(readFileSync(join(source,['alchemy','kitchen','watchtower'].includes(type)?'unique-report.json':'report.json'),'utf8'));
assert.equal(sourceReport.source,'tests/fixtures/ea-reference-world.json');
assert.equal(sourceReport.sourceBuildings,40);
assert.equal(sourceReport.sourcePeople,30);
for(const stage of stages){
 const file=join(source,`${type}-${stage}.json`),raw=JSON.parse(readFileSync(file,'utf8'));
 const state=validateSave(raw),saved=JSON.stringify(state),work=viewSpatial(state);
 assert.equal(saved,JSON.stringify(raw),`${type}/${stage} exact source save round trip`);
 const origin=sourceReport.checks.find(check=>check.type===type&&check.stage===stage);
 assert(origin&&origin.file===`${type}-${stage}.json`&&origin.worldTick===state.worldTick,'stage is listed in the public-command source report');
 assert.equal(work?.stage,stage,`${type}/${stage} comes from a real construction work order`);
 assert.equal(work?.building?.type,type);
 assert.equal(spatialPrefab(work.building).indoor,true,'source fixture must be a closed building');
 assert.equal(JSON.stringify(state),saved,`${type}/${stage} shared projections leave the save unchanged`);
}
console.log(`SR004 closed construction: ${stages.length} source-backed ${type} stages`);
