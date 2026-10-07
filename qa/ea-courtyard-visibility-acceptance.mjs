/** U-101 / SR-XF-004: real public activity in one closed and one open-air facility. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {harness} from './ea-sr-integration-acceptance.mjs';
import * as S from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialFootprint,polygonContains} from '../dist/ea-sr-spatial.mjs';

test('closed hall hides its real student while the actual farm worker remains visible and selectable',async()=>{
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
 const original=JSON.stringify(s),require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas');
 const globals=Object.fromEntries(['Image','fetch','devicePixelRatio','document','ResizeObserver'].map(key=>[key,globalThis[key]]));
 globalThis.Image=class extends Image{set src(value){queueMicrotask(()=>{super.src=value.startsWith('file:')?fileURLToPath(value):value;});}};
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(fileURLToPath(url),'utf8'))});
 globalThis.devicePixelRatio=1;
 globalThis.document={createElement:()=>createCanvas(1,1),getElementById:()=>({classList:{toggle(){}}})};
 globalThis.ResizeObserver=class{observe(){} disconnect(){}};
 let renderer;
 try{
  const canvas=createCanvas(1366,900);canvas.clientWidth=1366;canvas.clientHeight=900;
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:900});
  const ctx=canvas.getContext('2d'),drawImage=ctx.drawImage.bind(ctx),images=[];
  ctx.drawImage=(...args)=>{images.push([args[0].width,args[0].height]);return drawImage(...args);};
  renderer=createWorldRenderer(canvas,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>({kind:'person',id:lu.id}),getCampaignScene:()=>null,getAppearance:S.appearanceView,getPrefs:()=>({reducedMotion:true})});
  await renderer.ready;assert.deepEqual(renderer.loadingState().failed,[]);
  renderer.focusScenic(lu.mind.scenic.x,lu.mind.scenic.y);renderer.render(0,true);
  assert(images.some(([width,height])=>width===1536&&height===1024),'the open-air worker uses the character art');
  const luFoot=renderer.projectPoint(lu.mind.scenic),luHit=renderer.pick({clientX:luFoot.x,clientY:luFoot.y-20});
  assert((luHit.candidates||[luHit]).some(person=>person.id===lu.id),`the farm worker can be selected on canvas: ${JSON.stringify(luHit)}`);
  const linFoot=renderer.projectPoint(lin.mind.scenic),linHit=renderer.pick({clientX:linFoot.x,clientY:linFoot.y});
  assert(!(linHit.candidates||[linHit]).some(person=>person.id===lin.id),'the hall roof hides its student from canvas picking');
  assert.deepEqual(renderer.getPersonPosition(lin.id),lin.mind.scenic,'the closed room keeps the real person position');
  assert.equal(JSON.stringify(s),original,'rendering and picking do not alter a saved world');
  if(process.env.XIANFU_QA_VISIBILITY_PNG)writeFileSync(process.env.XIANFU_QA_VISIBILITY_PNG,canvas.toBuffer('image/png'));
 }finally{
  renderer?.destroy();
  for(const [key,value] of Object.entries(globals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
 }
});
