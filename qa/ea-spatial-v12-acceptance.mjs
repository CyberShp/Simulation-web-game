/** Production renderer snapshots with a canvas backend, not browser/phone QA. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import * as sim from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {buildingVisual} from '../dist/ea-scene-geometry.mjs';
import {constructionView} from '../dist/ea-construction-view.mjs';
import {runOpening} from './ea-opening-v12-acceptance.mjs';
import {runArtisan} from './ea-rain-artisan-acceptance.mjs';
const require=createRequire(import.meta.url),{createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath(fileURLToPath(new URL('../dist/assets/fonts/xianfu-brush.woff2',import.meta.url)),'serif');
globalThis.Image=class extends Image{set src(value){if(!value)return;queueMicrotask(()=>{super.src=value.startsWith('file:')?fileURLToPath(value):value;});}};
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(fileURLToPath(url),'utf8'))});
globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.document={getElementById:()=>({classList:{toggle(){}}})};
const out=new URL('./acceptance-spatial-v12/',import.meta.url);mkdirSync(out,{recursive:true});
const opening=['invite','decline'].map(invitation=>runOpening({invitation}));
const artisan=['treated','cancel-resume','declined'].map(outcome=>runArtisan({outcome}));
for(const scene of opening)writeFileSync(new URL(`opening-${scene.report.invitation}.json`,out),JSON.stringify(scene.state,null,2));
for(const scene of artisan)writeFileSync(new URL(`artisan-${scene.report.outcome}.json`,out),JSON.stringify(scene.state,null,2));
let state=opening[0].state,mode='inspect',selection=null,preview=null,failures=[];
const canvas=createCanvas(1366,900);canvas.clientWidth=1366;canvas.clientHeight=900;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:900});
const renderer=createWorldRenderer(canvas,{getState:()=>state,getMode:()=>mode,getSelection:()=>selection,getPreview:()=>preview,getCampaignScene:()=>null,getPrefs:()=>({reducedMotion:true}),onLoad:value=>{failures=value;}});
await renderer.ready;renderer.resize();assert.equal(failures.length,0,JSON.stringify(renderer.loadingState()));
const snapshots=[],checks=[];
function capture(name){const before=JSON.stringify(state);renderer.render(2000,true);assert.equal(JSON.stringify(state),before);writeFileSync(new URL(name+'.png',out),canvas.toBuffer('image/png'));snapshots.push(name+'.png');}
renderer.setZoom(.8);renderer.pan.x=80;renderer.pan.y=50;const event={clientX:600,clientY:400},point=renderer.screenPoint(event);
renderer.setGrid(true);assert.deepEqual(renderer.screenPoint(event),point);renderer.setGrid(false);assert.deepEqual(renderer.screenPoint(event),point);checks.push('Planning entry/exit preserves camera and world point');
capture('normal-courtyard');
const farm=state.buildings.find(b=>b.type==='farm');
mode='move';preview={type:farm.type,level:3,lock:'',recommended:null};renderer.setHoverPlot(farm);capture('upgraded-relocation-preview');
// Observe the actual atlas draw dimensions in the running renderer.
const ctx=canvas.getContext('2d'),original=ctx.drawImage.bind(ctx),draws=[];ctx.drawImage=(...args)=>{draws.push(args.slice(1));return original(...args);};
renderer.render(2000,true);const visual=buildingVisual({...farm,level:3});
assert.ok(draws.some(a=>a.length===8&&a[6]===visual.size&&a[7]===visual.size&&a[4]===visual.position.x-visual.size/2&&a[5]===visual.position.y-visual.size+20));
ctx.drawImage=original;checks.push('Actual upgraded relocation preview uses finished 68px size and anchor');
mode='inspect';preview=null;state=sim.initial();state=sim.dispatchCommand(state,{name:'masterAction',args:['heal']}).state;sim.tick(state,40);
state=sim.dispatchCommand(state,{name:'build',args:['farm',2,2]}).state;
for(const stage of ['foundation','structure','finishing']){
 for(let i=0;i<1500&&constructionView(state)?.stage!==stage;i++)sim.tick(state,.1);
 assert.equal(constructionView(state)?.stage,stage);capture('construction-'+stage);sim.validateSave(JSON.parse(JSON.stringify(state)));
}
for(let i=0;i<1500&&sim.constructionStatus(state);i++)sim.tick(state,.1);assert.equal(sim.constructionStatus(state),null);capture('construction-complete');
checks.push('Three work-order stages render from real simulation progress and finish once');
const report={generatedAt:new Date().toISOString(),gameVersion:sim.GAME_VERSION,schemaVersion:sim.SCHEMA_VERSION,rulesetVersion:state.rulesetVersion,backend:'@napi-rs/canvas',productionRenderer:'dist/ea-courtyard-renderer.mjs',assetFailures:failures,readOnlyRender:true,checks,snapshots,opening:opening.map(x=>x.report),artisan:artisan.map(x=>x.report),browser:'not-tested: browser binary absent; local service unavailable to cloud browser in preceding batch',limitations:['DOM is stubbed; no browser layout, pointer, touch, real-device, FPS or first-player experience pass','Legacy registered scene units remain; this is not full metre/free-placement/prefab art completion','No Pages deployment or GitHub upload completed']};
writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,assetFailures:failures,snapshots,opening:report.opening.map(x=>({invitation:x.invitation,commands:x.commands,gameSeconds:x.gameSeconds})),artisan:report.artisan.map(x=>({outcome:x.outcome,commands:x.commands,gameSeconds:x.gameSeconds}))},null,2));renderer.destroy();
