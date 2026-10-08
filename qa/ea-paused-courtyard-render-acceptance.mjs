/** U-101: the legal dense courtyard keeps a paused frame until visible inputs change.
 * NODE_PATH may supply the existing @napi-rs/canvas test dependency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {cloneState} from '../dist/ea-state-v6.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialTransform} from '../dist/ea-sr-spatial.mjs';

test('U-101: paused dense courtyard redraws only for visible changes',async()=>{
 const require=createRequire(import.meta.url),{createCanvas,Image}=require('@napi-rs/canvas');
 const raw=JSON.parse(readFileSync(new URL('./ea-reference-world.json',import.meta.url),'utf8'));
 let state=S.validateSave(raw,{upgrade:true}),mode='inspect',selection=null,preview=null;
 assert.equal(state.buildings.length,40);assert.equal(state.disciples.length,30);
 state.speed=0;S.validateSave(state);
 const saved=JSON.stringify(state),globals={Image:globalThis.Image,devicePixelRatio:globalThis.devicePixelRatio,document:globalThis.document};
 let missingHall=false;
 globalThis.Image=class extends Image{set src(value){queueMicrotask(()=>{if(missingHall&&value.endsWith('/hall-stages-v2.png'))this.onerror?.(new Error('QA: image unavailable'));else super.src=value.startsWith('file:')?fileURLToPath(value):value;});}};
 globalThis.devicePixelRatio=1;
 const parent={insertBefore(){}},canvas=createCanvas(1200,849);
 canvas.clientWidth=1200;canvas.clientHeight=849;canvas.parentElement=parent;canvas.style={background:''};
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:canvas.clientWidth,height:canvas.clientHeight});
 globalThis.document={createElement:()=>{const layer=createCanvas(1,1);layer.style={};layer.setAttribute=()=>{};layer.remove=()=>{};return layer;}};
 const ctx=canvas.getContext('2d'),clearRect=ctx.clearRect.bind(ctx),drawImage=ctx.drawImage.bind(ctx);
 let clears=0,images=0;ctx.clearRect=(...args)=>{clears++;return clearRect(...args);};ctx.drawImage=(...args)=>{images++;return drawImage(...args);};
 let renderer,retryRenderer;
 try{
  renderer=createWorldRenderer(canvas,{getState:()=>state,getMode:()=>mode,getSelection:()=>selection,getPreview:()=>preview,getAppearance:S.appearanceView,getCampaignScene:()=>null});
  await renderer.ready;
  assert.deepEqual(renderer.loadingState().failed,[]);
  renderer.render(0,true);
  const initial=canvas.toBuffer('image/png');clears=images=0;
  for(let i=1;i<=180;i++)assert.equal(renderer.render(i*16),false);
  assert.equal(clears,0,'idle paused frames do not clear the full world canvas');
  assert.equal(images,0,'idle paused frames do not redraw buildings or people');
  const idleClears=clears,idleImages=images;
  assert.deepEqual(canvas.toBuffer('image/png'),initial,'skipping keeps every rendered pixel');

  const building=state.buildings.find(b=>b.type==='hall'),shape=spatialPrefab(building),at=spatialTransform(building);
  const point=renderer.projectPoint({x:at.x+shape.width/2,y:at.y+shape.height/2});
  const event={clientX:point.x,clientY:point.y};
  const beforePick=renderer.pick(event);
  renderer.setHover(event);assert.equal(renderer.render(3000),true,'hover invalidates the frame');
  assert.notDeepEqual(canvas.toBuffer('image/png'),initial,'hover feedback becomes visible');
  selection={kind:'building',id:building.id};assert.equal(renderer.render(3016),true,'selection invalidates the frame');
  assert.equal(renderer.pick(event).id,beforePick.id,'drawing changes do not change the picked object');
  assert.equal(renderer.render(3032),false);

  renderer.pan.x+=24;assert.equal(renderer.render(3048),true,'dragging the camera invalidates the frame');
  renderer.setZoom(.14);assert.equal(renderer.render(3064),true,'zoom invalidates the frame');
  canvas.clientWidth=820;canvas.clientHeight=1180;globalThis.devicePixelRatio=1.5;
  assert.equal(renderer.render(3080),true,'viewport and DPR changes invalidate the frame');
  assert.equal(canvas.width,1230);assert.equal(canvas.height,1770);
  mode='build';preview={type:'farm',level:1};assert.equal(renderer.render(3096),true,'planning is drawn');
  assert.equal(renderer.render(3112),true,'planning remains live while paused');
  mode='inspect';preview=null;assert.equal(renderer.render(3128),true,'leaving planning redraws');
  assert.equal(renderer.render(3144),false);

  const tick=state.worldTick,revision=state.revision,condition=building.condition;
  building.condition=40;assert.equal(renderer.render(3160),true,'in-place building art change invalidates the frame');
  building.condition=condition;assert.equal(renderer.render(3176),true);
  const actor=state.disciples.find(p=>p.mind?.scenic),x=actor.mind.scenic.x;
  actor.mind.scenic.x=x+.5;assert.equal(renderer.render(3192),true,'in-place person movement invalidates the frame');
  actor.mind.scenic.x=x;assert.equal(renderer.render(3208),true);
  assert.equal(state.worldTick,tick);assert.equal(state.revision,revision);
  state=cloneState(state);state.master.scenic.x+=.5;
  assert.equal(renderer.render(3224),true,'new world state invalidates the frame');
  state.master.scenic.x-=.5;state.speed=1;
  assert.equal(renderer.render(3240),true,'running world keeps drawing');
  assert.equal(renderer.render(3256),true,'running actors keep drawing every frame');
  state.speed=0;assert.equal(JSON.stringify(state),saved,'rendering did not mutate the legal save');
  missingHall=true;
  const retryCanvas=createCanvas(1200,849);
  retryCanvas.clientWidth=1200;retryCanvas.clientHeight=849;retryCanvas.parentElement=parent;retryCanvas.style={background:''};
  retryCanvas.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:849});
  retryRenderer=createWorldRenderer(retryCanvas,{getState:()=>state,getMode:()=>mode,getSelection:()=>selection,getAppearance:S.appearanceView,getCampaignScene:()=>null});
  await retryRenderer.ready;
  assert.deepEqual(retryRenderer.loadingState().failed.map(asset=>asset.id),['hallStages']);
  retryRenderer.render(3300,true);
  const fallback=retryCanvas.toBuffer('image/png');
  assert.equal(retryRenderer.render(3316),false);
  missingHall=false;await retryRenderer.retryAssets();
  assert.deepEqual(retryRenderer.loadingState().failed,[]);
  assert.equal(retryRenderer.render(3332),true,'newly loaded art invalidates the paused frame');
  assert.notDeepEqual(retryCanvas.toBuffer('image/png'),fallback,'the completed exterior replaces its fallback');
  assert.equal(retryRenderer.render(3348),false);
  console.log(JSON.stringify({source:'qa/ea-reference-world.json',viewport:'1200x849@1',pausedFrames:180,pausedClears:idleClears,pausedDrawImages:idleImages,pick:beforePick.kind}));
 }finally{
  renderer?.destroy();retryRenderer?.destroy();
  for(const [key,value]of Object.entries(globals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
});
