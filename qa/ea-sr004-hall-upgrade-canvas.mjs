/** SR-XF-004-AC-01: source-backed hall upgrade through the production Canvas renderer. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateSave} from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialAccess,viewSpatial} from '../dist/ea-sr-spatial.mjs';

const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas');
const source=resolve(process.argv[2]||'/tmp/immortal-sr004-stage-sources');
const out=resolve(process.argv[3]||'/tmp/immortal-sr004-hall-upgrade-canvas');
const sourceReport=JSON.parse(readFileSync(join(source,'hall-report.json'),'utf8'));
assert.equal(sourceReport.source,'qa/ea-reference-world.json');
assert.equal(sourceReport.sourceBuildings,40);
assert.equal(sourceReport.sourcePeople,30);
mkdirSync(out,{recursive:true});
const originalImage=globalThis.Image;
globalThis.Image=class LocalImage extends Image{
 set src(value){if(value)queueMicrotask(()=>{super.src=value.startsWith('file:')?fileURLToPath(value):value;});}
};
const report={source:sourceReport.source,backend:'@napi-rs/canvas',renderer:'dist/ea-courtyard-renderer.mjs',checks:[]};
try{
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
  const prefab=spatialPrefab(candidate),access=spatialAccess(candidate);
  assert.equal(prefab.indoor,true);
  assert.deepEqual({width:prefab.width,height:prefab.height},{width:10,height:10});
  const image=createCanvas(1024,768),canvas={width:1024,height:768,clientWidth:1024,clientHeight:768,style:{},parentElement:null,
   getContext:kind=>image.getContext(kind),getBoundingClientRect:()=>({left:0,top:0,width:1024,height:768})};
  const preview=stage==='preview'?{type:'hall',level:2,buildingId:hall.id,lock:'',selected:true}:null;
  const renderer=createWorldRenderer(canvas,{getState:()=>state,getMode:()=>preview?'build':null,getSelection:()=>null,getPreview:()=>preview,getCampaignScene:()=>null});
  await renderer.ready;
  renderer.focusScenic(access.x,access.y);
  if(preview)renderer.setHoverPlot(candidate.transform);
  assert.equal(renderer.render(0,true),true);
  const screenshot=join(out,`hall-${stage}.png`);
  writeFileSync(screenshot,image.toBuffer('image/png'));
  assert.equal(JSON.stringify(state),saved,`${stage} Canvas leaves the save unchanged`);
  report.checks.push({stage,worldTick:state.worldTick,level:candidate.level,metres:{width:prefab.width,height:prefab.height},door:access,screenshot});
  renderer.destroy();
 }
}finally{globalThis.Image=originalImage;}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(`SR004 hall upgrade Canvas: ${report.checks.length} source-backed stages; ${out}`);
