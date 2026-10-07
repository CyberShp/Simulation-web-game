/** SR-XF-004-D01: render legal construction snapshots with stage art unavailable. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {validateSave} from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {viewSpatial,spatialAccess,spatialPrefab,spatialProject} from '../dist/ea-sr-spatial.mjs';

const require=createRequire(import.meta.url),{createCanvas}=require('@napi-rs/canvas');
const source=resolve(process.argv[2]||'/tmp/immortal-sr004-stage-sources');
const out=resolve(process.argv[3]||'/tmp/immortal-sr004-closed-fallback');
const type=process.argv[4]||'library';
const stages=['foundation','structure','finishing'];
const sourceReport=JSON.parse(readFileSync(join(source,['alchemy','kitchen','watchtower'].includes(type)?'unique-report.json':'report.json'),'utf8'));
assert.equal(sourceReport.source,'qa/ea-reference-world.json');
assert.equal(sourceReport.sourceBuildings,40);
assert.equal(sourceReport.sourcePeople,30);
mkdirSync(out,{recursive:true});
const originalImage=globalThis.Image;
globalThis.Image=class MissingStageImage{
 set src(_value){queueMicrotask(()=>this.onerror?.(new Error('QA: stage art unavailable')));}
};
const report={source,sourceReport:sourceReport.source,output:out,type,art:'all stage images unavailable by QA loader',checks:[]};
try{
 for(const stage of stages){
  const file=join(source,`${type}-${stage}.json`),raw=JSON.parse(readFileSync(file,'utf8'));
  const state=validateSave(raw),saved=JSON.stringify(state),work=viewSpatial(state);
  assert.equal(saved,JSON.stringify(raw),`${type}/${stage} exact source save round trip`);
  const origin=sourceReport.checks.find(check=>check.type===type&&check.stage===stage);
  assert(origin&&origin.file===`${type}-${stage}.json`&&origin.worldTick===state.worldTick,'stage is listed in the public-command source report');
  assert.equal(work?.stage,stage,`${type}/${stage} comes from a real construction work order`);
  assert.equal(work?.building?.type,type);
  assert.equal(spatialPrefab(work.building).indoor,true,'fallback fixture must be a closed building');
  const image=createCanvas(1024,768);
  const canvas={width:1024,height:768,clientWidth:1024,clientHeight:768,style:{},parentElement:null,
   getContext:kind=>image.getContext(kind),getBoundingClientRect:()=>({left:0,top:0,width:1024,height:768})};
  const renderer=createWorldRenderer(canvas,{getState:()=>state,getMode:()=>null,getSelection:()=>null,getCampaignScene:()=>null});
  const access=spatialAccess(work.building);
  renderer.focusScenic(access.x,access.y);
  assert.equal(renderer.render(0,true),true);
  const camera=renderer.getCamera(),prefab=spatialPrefab(work.building),anchor=work.building.transform;
  const centre=spatialProject({x:anchor.x+prefab.width/2,y:anchor.y+prefab.height/2},camera);
  const probe={x:Math.round(centre.x-.4*camera.scale),y:Math.round(centre.y-Math.min(2.4*camera.scale,100))};
  const pixel=[...image.getContext('2d').getImageData(probe.x,probe.y,1,1).data];
  const closedRoof=pixel[0]===67&&pixel[1]===91&&pixel[2]===83;
  assert.equal(closedRoof,stage==='finishing',`${type}/${stage} missing art uses ${stage==='finishing'?'sealed roof':'open construction'} at ${probe.x},${probe.y}`);
  const screenshot=join(out,`${type}-${stage}-missing-art.png`);
  writeFileSync(screenshot,image.toBuffer('image/png'));
  assert.equal(JSON.stringify(state),saved,`${type}/${stage} render leaves state and save unchanged`);
  report.checks.push({stage,worldTick:state.worldTick,buildingId:work.building.instanceId,
   workOrderId:state.master.activityId&&state.activitiesById[state.master.activityId]?.workOrderId,
   metres:{width:prefab.width,height:prefab.height},access,roofProbe:{...probe,pixel,closedRoof},screenshot});
  renderer.destroy();
 }
}finally{globalThis.Image=originalImage;}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(`SR004 closed fallback: ${report.checks.length} source-backed stages; ${out}`);
