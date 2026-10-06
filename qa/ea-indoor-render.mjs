/** Execute the production canvas renderer using a Node canvas backend.
 * This is a render snapshot, not a browser, DOM, touch or FPS test. */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import * as sim from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
const require=createRequire(import.meta.url),{createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath(fileURLToPath(new URL('../dist/assets/fonts/xianfu-brush.woff2',import.meta.url)),'serif');
globalThis.Image=class extends Image{set src(value){if(!value)return;const path=value.startsWith('file:')?fileURLToPath(value):value;queueMicrotask(()=>{super.src=path;});}};
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(fileURLToPath(url),'utf8'))});
globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.document={getElementById:()=>({classList:{toggle(){}}})};
let state=sim.initial(),selection=null;const out=new URL('./acceptance-indoor-v12/',import.meta.url);mkdirSync(out,{recursive:true});
const canvas=createCanvas(1366,900);canvas.clientWidth=1366;canvas.clientHeight=900;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:900});
let failures=[];const renderer=createWorldRenderer(canvas,{getState:()=>state,getMode:()=> 'inspect',getSelection:()=>selection,getCampaignScene:()=>null,getPrefs:()=>({reducedMotion:true}),onLoad:value=>{failures=value;}});
await renderer.ready;renderer.resize();if(failures.length)throw Error('Renderer asset failures: '+JSON.stringify(renderer.loadingState()));
const before=JSON.stringify(state);renderer.render(1000,true);if(JSON.stringify(state)!==before)throw Error('Rendering mutated the simulation');
writeFileSync(new URL('closed-roof.png',out),canvas.toBuffer('image/png'));
state=sim.dispatchCommand(state,{name:'masterAction',args:['heal']}).state;sim.tick(state,10);selection={kind:'person',id:'master'};renderer.setZoom(1.3);renderer.focus();renderer.render(2000,true);
writeFileSync(new URL('indoor-healing.png',out),canvas.toBuffer('image/png'));
writeFileSync(new URL('indoor-healing.json',out),JSON.stringify(state,null,2));
const activity=state.activitiesById[state.master.activityId];if(activity?.phase!=='executing'||activity.action!=='heal')throw Error('Snapshot did not reach actual indoor healing');
const report={generatedAt:new Date().toISOString(),rulesetVersion:state.rulesetVersion,backend:'@napi-rs/canvas',productionRenderer:'dist/ea-courtyard-renderer.mjs',assetFailures:failures,readOnlyRender:true,worldTick:state.worldTick,activity,snapshots:['closed-roof.png','indoor-healing.png'],browser:'blocked: local HTTP service is not reachable by cloud browser; ERR_CONNECTION_REFUSED',limitations:['This runner uses DOM stubs; it does not verify browser layout, UI pointer actions, touch, real-device lifecycle or FPS','The room is a bounded legacy-coordinate prototype, not complete spatial metre/free-placement migration']};
writeFileSync(new URL('render-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));renderer.destroy();
