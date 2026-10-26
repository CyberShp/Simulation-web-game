/** Native Canvas QA for the sword study integration.
 * --stage=prepare|preflight|run --scenario=head|normal|defeat|retreat
 * --source=/absolute/prepared/sect-save.json --output=/absolute/new-directory
 * --movement-probe diagnoses actual rendered movement; --motion-fixture prepares
 * a declared initial enemy cooldown for that narrow probe.
 * --startup-probe records real onset/release/reversal/blur/pause/wall behavior.
 * --dodge-clock extends normal victory with stop pixels and Q/J-to-Space clocks.
 * --long-performance --target-probe measures native target selection/clearing.
 * --long-performance --sustained-performance --duration=90 retains the original
 * long-save background and enemy through a real timed movement/input interval.
 * Preparation declares targeted initial conditions and uses formal commands.
 * Native execution uses keyboard, mouse and buttons. No recorder is created.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {createOpeningSectSession,commandSect,advanceSect,openingView,snapshotSect,restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {combatCanStand,combatClearLine} from '../../src/simulation/ea-combat-geometry.mjs';
import {STUDY_METADATA} from '../../src/simulation/ea-combat-sword-study-frames.mjs';

const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const stage=option('stage')||'preflight',scenario=option('scenario')||'normal',source=option('source'),output=option('output');
const movementProbe=process.argv.includes('--movement-probe');
const motionFixture=process.argv.includes('--motion-fixture');
const longPerformance=process.argv.includes('--long-performance');
const targetProbe=process.argv.includes('--target-probe');
const startupProbe=process.argv.includes('--startup-probe');
const dodgeClock=process.argv.includes('--dodge-clock');
const sustainedPerformance=process.argv.includes('--sustained-performance'),sustainedSeconds=Number(option('duration')||90);
const leanObserver=process.argv.includes('--lean-observer'),cdpProfile=process.argv.includes('--cdp-profile');
const resumeProbe=process.argv.includes('--resume-probe');
const profileHelper=option('profile-helper'),profileOutput=option('profile-output');
const responsePatch=option('response-patch');
const actionPixels=process.argv.includes('--action-pixels');
const verticalDownPixels=process.argv.includes('--vertical-down-pixels');
const PROFILE='sword-study-v1',FIELD='valley-open-v2',MASTER='person:master',FOE='person:valley-shanxiao';
const json=x=>JSON.stringify(x,null,2)+'\n',hash=x=>createHash('sha256').update(x).digest('hex');
assert(['prepare','preflight','run'].includes(stage),'unknown stage');
assert(['head','normal','defeat','retreat'].includes(scenario),'unknown scenario');
assert(!movementProbe||stage==='run'&&scenario==='normal','movement probes use the prepared normal source');
assert(!motionFixture||stage==='prepare'&&scenario==='normal','motion fixture is a normal-source preparation option');
assert(!longPerformance||stage!=='prepare'&&scenario==='normal'&&!movementProbe,'long-save performance uses its independently prepared normal source');
assert(!targetProbe||longPerformance&&stage==='run','target latency probes use the unchanged long-save source');
assert(!startupProbe||stage==='run'&&scenario==='normal'&&!movementProbe&&!longPerformance,'startup probes use the prepared normal motion source');
assert(!dodgeClock||stage==='run'&&scenario==='normal'&&!movementProbe&&!longPerformance&&!startupProbe,'dodge clocks extend the real normal-victory scenario');
assert(!sustainedPerformance||longPerformance&&stage==='run'&&!targetProbe&&sustainedSeconds>=60&&sustainedSeconds<=120,'sustained native observation uses 60–120 real seconds of the unchanged long source');
assert(!leanObserver||sustainedPerformance,'lean observation applies to the sustained long-save observation');
assert(!cdpProfile||stage==='run','CDP sampling requires a native run');
assert(!resumeProbe||stage==='run'&&scenario==='normal'&&!longPerformance&&!movementProbe&&!startupProbe&&!dodgeClock,'resume probe uses the independent normal motion source');
assert(!profileHelper||sustainedPerformance&&!cdpProfile&&path.isAbsolute(profileHelper)&&profileOutput&&path.isAbsolute(profileOutput),'window profile uses an explicit helper/output in a separate sustained native run');
assert(!verticalDownPixels||stage==='run'&&scenario==='defeat'&&!longPerformance&&!actionPixels,'vertical/down pixels use an independently declared defeat source');
assert(!actionPixels||stage==='run'&&scenario==='normal'&&!longPerformance&&!resumeProbe&&!dodgeClock&&!startupProbe&&!movementProbe,'action pixels use the independent normal motion source');
assert(!responsePatch||sustainedPerformance&&leanObserver&&!cdpProfile&&!profileHelper&&path.isAbsolute(responsePatch),'response patch is an independent lean branch-timing diagnostic');
assert(output&&path.isAbsolute(output),'absolute --output is required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'QA output must be outside repository');
assert(!process.argv.some(v=>/^--(?:video|record)(?:=|$)/.test(v)),'this harness captures screenshots and state only');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(output,{recursive:false});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));

function profileOf(c){return c?.rulesProfile??c?.profileId??c?.combatProfileId??null;}
function send(session,request,commands){const result=commandSect(session,request);commands.push({tick:session.state.worldTick,request:structuredClone(request),result:structuredClone(result)});assert(result.ok,result.error);return result;}
function advanceUntil(session,predicate,label,max=6000){for(let n=0;n<max&&!predicate();n++)advanceSect(session,.1);assert(predicate(),label);}
if(stage==='prepare'){
 const session=createOpeningSectSession(),commands=[],started=performance.now();
 const command=q=>send(session,q,commands),until=(p,label)=>advanceUntil(session,p,label);
 for(const page of [1,2])command({type:'opening-intro',page});
 command({type:'opening-intro',complete:true});command({type:'heal'});command({type:'choose-inheritance',lineage:'jinfeng'});
 until(()=>openingView(session).stage==='hall-ready','opening recovery');command({type:'establish-hall'});
 until(()=>openingView(session).stage==='complete','hall construction');command({type:'manual'});
 command({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});
 until(()=>!session.state.srWorld.interaction&&!session.state.master.scenic.path.length,'physical gate approach');
 command({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}}});
 until(()=>!session.state.srWorld.activeTravelId,'formal valley travel');
 command({type:'world',action:{action:'move',x:18,y:36}});
 until(()=>!session.state.srWorld.interaction&&!session.state.master.scenic.path.length,'formal enemy approach');
 const presets=[];
 if(scenario==='defeat'){
  presets.push({field:'master initial wound before engagement',before:session.state.master.wound,after:99,purpose:'one real hostile strike must cause defeat; initial injury is recorded in the formal combat session'});
  session.state.master.wound=99;
 }
 command({type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});
 const c=session.state.combat;
 assert.equal(c.geometryId,FIELD);assert.equal(profileOf(c),PROFILE,'prepare only after the sword profile is integrated');
 assert.equal(c.allies.length,0);assert.equal(c.enemies.length,1);assert.equal(c.enemies[0].personId,FOE);
 if(scenario==='head'||motionFixture){
  presets.push({field:'enemy initial cooldown',before:c.enemies[0].cooldown,after:5,purpose:motionFixture?'movement pixel sampling before the next real enemy warning':'neutral alpha head/miss fixture; the formal enemy remains inside its attack range with its original movement speed'});
  c.enemies[0].cooldown=5;
 }
 if(['head','defeat'].includes(scenario)){
  const from={x:c.player.x,y:c.player.y},at={x:from.x+(scenario==='head'?6:3),y:from.y};assert(combatCanStand(at,FIELD));
  if(scenario==='defeat')assert.equal(c.player.hp,1,'the formal HP projection must produce the one-HP fixture');
  presets.push({field:'enemy initial position',before:{x:c.enemies[0].x,y:c.enemies[0].y},after:at,purpose:scenario==='head'?'stationary body sample inside the actual eight metre range':'nearby real hostile attack'});
  Object.assign(c.enemies[0],at);
  const origin=c.sceneFrame.origin;
  session.state.personsById[FOE].location={kind:'local',sceneId:c.sceneFrame.sceneId,x:origin.x+at.x,y:origin.y+at.y};
 }
 command({type:'pause',paused:true});
 const prepared=snapshotSect(session);prepared.courtyardPresentation={version:2,manualPause:true};
 assert.equal(validateSect(prepared),true);assert.deepEqual(restoreSect(prepared).state,prepared.state);
 const bytes=json(prepared);await fs.writeFile(path.join(output,'sect-save.json'),bytes);
 const report={instrumentation:{observer:leanObserver?'scalar-rAF-with-tick-and-edge-semantic-snapshots':'rich-per-rAF',cdpProfile},status:'prepared',scope:'U-172 targeted initial conditions; Node formal opening, departure and engagement; no native execution',scenario,profileId:PROFILE,sourceSha256:hash(bytes),tick:session.state.worldTick,presets,commands,wallSeconds:(performance.now()-started)/1000};
 await fs.writeFile(path.join(output,'preparation.json'),json(report));
 console.log(json({status:report.status,source:path.join(output,'sect-save.json'),tick:report.tick,presets}));process.exit(0);
}

assert(source&&path.isAbsolute(source),'absolute --source is required');
const sourceBytes=await fs.readFile(source),original=JSON.parse(sourceBytes),restored=restoreSect(original);
await fs.writeFile(path.join(output,'source.json'),sourceBytes);
assert.equal(validateSect(restored),true);assert.deepEqual(restored.state,original.state,'canonical paused source required');
assert.equal(original.state.speed,0);assert.equal(original.courtyardPresentation?.manualPause,true);
assert.equal(original.state.combat?.status,'active');assert.equal(original.state.combat.geometryId,FIELD);
assert.equal(profileOf(original.state.combat),PROFILE,'new solo profile required');
assert.equal(original.state.combat.allies.length,0);assert.equal(original.state.combat.enemies.length,1);
assert.equal(original.state.combat.player.personId,MASTER);assert.equal(original.state.combat.enemies[0].personId,FOE);
let preparation=null;
try{preparation=JSON.parse(await fs.readFile(path.join(path.dirname(source),'preparation.json')));assert.equal(preparation.sourceSha256,hash(sourceBytes));assert.equal(preparation.scenario,longPerformance?'long-performance':scenario);}catch(error){throw Error('A matching explicit preparation.json is required: '+error.message);}
const sourceContext={source,sourceSha256:hash(sourceBytes),scenario,profileId:PROFILE,tick:original.state.worldTick,preparation};
if(stage==='preflight'){
 await fs.writeFile(path.join(output,'report.json'),json({status:'preflight',scope:'source validation only; Electron not launched',sourceContext,video:{status:'disabled'}}));
 console.log('PASS preflight');process.exit(0);
}

const directory=path.join(output,'world'),native=path.join(directory,'sect-save.json'),lockPath=path.join(os.tmpdir(),'immortal-native-sword-study-qa.lock');
await fs.mkdir(directory);await fs.writeFile(native,sourceBytes);
async function filesUnder(relative){return(await Promise.all((await fs.readdir(path.join(repositoryRoot,relative),{withFileTypes:true})).map(e=>e.isDirectory()?filesUnder(relative+'/'+e.name):relative+'/'+e.name))).flat();}
const runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json'];
const runtimeHashes=async(files=runtimeFiles)=>Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await fs.readFile(path.join(repositoryRoot,file)))])));
const combatDependency=file=>file.startsWith('assets/courtyard/combat')||/^apps\/courtyard\/courtyard-combat/.test(file)||/^src\/simulation\/ea-combat-/.test(file)||['apps/courtyard/sect-sim.mjs','apps/courtyard/sect-combat.mjs','apps/courtyard/courtyard-main.mjs','apps/courtyard/courtyard-host.cjs','apps/courtyard/courtyard-preload.cjs','src/simulation/ea-campaign.mjs','src/simulation/ea-sr-combat.mjs','src/simulation/ea-opening-sim.mjs','src/simulation/ea-sr-world.mjs','package.json','package-lock.json'].includes(file);
const runtimeBefore=await runtimeHashes(),checks=[],actions=[],errors=[],finalizationErrors=[],audioEvidence=[],started=performance.now();
let lock=null,electron=null,page=null,windowId=null,nativeClosed=true,complete=false,phase='launch',lastTick=original.state.worldTick,viewport=null;
let cpuSession=null,cpuProfileEvidence=null;
let windowProfilePending=null,windowProfileEvidence=null;
let responseEvidence=null;
const wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const record=(name,details={})=>{checks.push({name,ok:true,wallSeconds:wall(),...details});console.log('PASS '+name);};
const point=a=>({x:a.x,y:a.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const read=async({presentation=true}={})=>{const value=await page.evaluate(presentation=>{const q=window.courtyardQA,v=q.renderer.view,w=v.expedition.world;return {tick:v.tick,scene:structuredClone(v.expedition.scene),combat:structuredClone(v.expedition.combat),world:w?{scene:w.scene?{id:w.scene.id,player:structuredClone(w.scene.player)}:null,exits:structuredClone(w.exits),travel:structuredClone(w.travel),activity:structuredClone(w.activity)}:null,status:q.status(),input:q.expedition.inputState(),presentation:presentation?q.expedition.presentationState():null};},presentation);const data=value.presentation?.study?.audio,audio=data?.status??data;if(Number.isFinite(audio?.played)&&JSON.stringify(audioEvidence.at(-1)?.status)!==JSON.stringify(audio))audioEvidence.push({tick:value.tick,phase,status:audio});return value;};
async function checkpoint(name){const value=await page.evaluate(name=>{const q=window.courtyardQA,status=q.status();if(!status.manualPause)throw Error('Full QA snapshots require a paused checkpoint');const at=performance.now(),session=q.snapshot(),ended=performance.now();window.__swordStudyQA?.checkpointSpans.push({name,at,end:ended,durationMs:ended-at,tick:session.state.worldTick,paused:true});return {session,status,input:q.expedition.inputState(),presentation:q.expedition.presentationState()};},name);lastTick=value.session.state.worldTick;assert.equal(validateSect(value.session),true);await fs.writeFile(path.join(output,name+'.json'),json(value));return value;}
async function protocolStart(kind,name){return page.evaluate(({kind,name})=>{const q=window.courtyardQA,qa=window.__swordStudyQA;if(!qa)return null;const span={id:qa.protocolSpans.length+1,kind,name,at:performance.now(),tick:q.renderer.view.tick,paused:q.status().manualPause};qa.protocolSpans.push(span);return span.id;},{kind,name});}
async function protocolEnd(id){if(id===null)return;await page.evaluate(id=>{const q=window.courtyardQA,span=window.__swordStudyQA.protocolSpans.find(s=>s.id===id);if(span){span.end=performance.now();span.durationMs=span.end-span.at;span.afterTick=q.renderer.view.tick;span.pausedAfter=q.status().manualPause;}},id);}
async function capture(name){assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true,'QA screenshots require an explicit paused boundary');const id=await protocolStart('screenshot',name);await page.screenshot({path:path.join(output,name+'.png')});await protocolEnd(id);return checkpoint(name);}
async function until(predicate,label,timeoutMs=15000,{active=true}={}){const at=performance.now();while(performance.now()-at<timeoutMs){const value=await read();lastTick=value.tick;assert.deepEqual(value.status.errors,[]);if(predicate(value))return value;if(active)assert.equal(value.scene?.status,'active','combat ended while waiting for '+label);await sleep(20);}throw Error('Timed out '+label+' at '+lastTick);}
async function focusInput(){await electron.evaluate(({app,BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);app.focus({steal:true});w.focus();w.webContents.focus();},windowId);await page.locator('#expedition-canvas').focus();await page.waitForFunction(()=>document.hasFocus()&&window.courtyardQA.expedition.inputState().hostActive);}
async function pause(value){if((await page.evaluate(()=>window.courtyardQA.status().manualPause))!==value){const id=await protocolStart('pause-control',String(value));await page.locator('#pause').click();await protocolEnd(id);}assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),value);if(value)await page.evaluate(()=>{const qa=window.__swordStudyQA;if(qa){qa.lastActive=false;qa.lastActiveAt=null;qa.boundaries.push({at:performance.now(),kind:'pause-applied',tick:window.courtyardQA.renderer.view.tick});}});if(!value)await focusInput();}
async function key(code){await focusInput();await page.keyboard.press(code);actions.push({kind:'key',code,wallSeconds:wall()});return page.evaluate(()=>window.__swordStudyQA.inputEvents.at(-1));}
async function pointerHitTest(at){return page.evaluate(at=>{const canvas=document.getElementById('expedition-canvas'),box=canvas.getBoundingClientRect(),client={x:box.left+at.x,y:box.top+at.y},hit=document.elementFromPoint(client.x,client.y);return {client,canvas:hit===canvas,element:hit?{id:hit.id,tag:hit.tagName,className:String(hit.className)}:null};},at);}
async function moveAimPointer(screen,details){const hitTest=await pointerHitTest(screen),evidence={...details,screen,hitTest,wallSeconds:wall()};actions.push(evidence);assert.equal(hitTest.canvas,true,'native mouse aim is blocked by '+JSON.stringify(hitTest.element));await page.mouse.move(hitTest.client.x,hitTest.client.y);const input=await page.evaluate(()=>window.courtyardQA.expedition.inputState());evidence.inputAfterMove=input;assert.equal(input.pointer?.inside,true,'native aim must enter the actual combat canvas');assert(Math.hypot(input.pointer.clientX-hitTest.client.x,input.pointer.clientY-hitTest.client.y)<1,'native pointer must actually update to the requested CSS point');return evidence;}
async function aimWorld(at){const xy=await page.evaluate(at=>window.courtyardQA.expedition.worldToScreen(at.x,at.y),at);return moveAimPointer(xy,{kind:'aim-world',at});}
async function aimScreen(at){return moveAimPointer(at,{kind:'aim-css',at});}
const ready=(r,id)=>!r.combat?.pending&&!r.combat?.buffered&&r.combat?.manualActions?.some(a=>a.id===id&&!a.disabled&&!a.bufferable);
async function readyAction(id){return until(r=>ready(r,id),id+' available');}
async function label(name){phase=name;await page.evaluate(name=>window.__swordStudyQA.phase=name,name);}
async function launch(){
 const {_electron}=await import('playwright'),target=desktopTarget(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});nativeClosed=false;
 page=await electron.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.stack||String(error)));
 await page.waitForURL(url=>url.protocol==='http:'&&url.hostname==='127.0.0.1'&&['/','/courtyard.html'].includes(url.pathname),{waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>window.courtyardQA?.status().ready&&document.getElementById('loading')?.hidden,null,{timeout:60000});
 windowId=await(await electron.browserWindow(page)).evaluate(w=>w.id);
 const host=await electron.evaluate(({app,BrowserWindow},id)=>({userData:app.getPath('userData'),url:BrowserWindow.fromId(id)?.webContents.getURL()}),windowId);
 assert.equal(host.userData,path.join(directory,'electron-profile'));assert.equal(host.url,page.url());
 await page.addInitScript(()=>{
  const qa=window.__swordStudyQA={phase:'setup',enabled:false,captureStudy:false,frames:[],steps:[],hits:[],hitObservations:[],captures:[],focusEvents:[],semanticEdges:[],drawImages:[],pixelCaptures:[],pixelRequest:null,audioStarts:[],audioStops:[],audioContexts:[],longTasks:[],pumps:[],checkpointSpans:[],protocolSpans:[],boundaries:[],inputEvents:[],segment:0,lastActive:false,lastActiveAt:null,lastFrameAt:null,lastEntryAt:null,lastActiveEntryAt:null,lean:false};
  window.__swordStudyPixelCopies=[];
  window.__swordStudySemanticSnapshot=(kind,extra={})=>{const q=window.courtyardQA,v=q.renderer.view;return {kind,...extra,at:performance.now(),tick:v.tick,phase:qa.phase,scene:structuredClone(v.expedition.scene),combat:structuredClone(v.expedition.combat),presentation:q.expedition.presentationState(),input:q.expedition.inputState(),visibilityState:document.visibilityState,hasFocus:document.hasFocus()};};
  const focusState=kind=>{if(!qa.enabled)return;const q=window.courtyardQA;qa.focusEvents.push({kind,at:performance.now(),tick:q?.renderer.view.tick,phase:qa.phase,visibilityState:document.visibilityState,hasFocus:document.hasFocus(),hostActive:q?.expedition.inputState().hostActive});};
  for(const type of ['focus','blur'])addEventListener(type,()=>{focusState(type);queueMicrotask(()=>focusState(type+'-after'));});
  document.addEventListener('visibilitychange',()=>{focusState('visibilitychange');queueMicrotask(()=>focusState('visibilitychange-after'));});
  const seen=new Set(),raf=requestAnimationFrame.bind(window),interval=setInterval.bind(window);
  window.setInterval=(callback,delay,...args)=>interval(typeof callback==='function'&&callback.name==='pump'?function(...values){const at=performance.now(),before=window.courtyardQA?.renderer.view;try{return callback(...values);}finally{const after=window.courtyardQA?.renderer.view,end=performance.now();if(qa.enabled&&qa.pumps.length<(qa.pumpLimit||3000))qa.pumps.push({at,end,durationMs:end-at,beforeTick:before?.tick,afterTick:after?.tick,advancedTicks:(after?.tick??0)-(before?.tick??0),paused:before?.paused,combat:before?.expedition?.scene?.type==='combat',status:before?.expedition?.scene?.status,phase:qa.phase});}}:callback,delay,...args);
  const nativeStart=AudioBufferSourceNode.prototype.start,nativeStop=AudioBufferSourceNode.prototype.stop;
  const nativeDraw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){const result=nativeDraw.call(this,image,...args),src=image?.currentSrc||image?.src||'';if(qa.enabled&&qa.captureStudy&&this.canvas?.id==='expedition-canvas'&&src.includes('combat-sword-study-v1/frames/')&&qa.drawImages.length<12000){const t=this.getTransform();qa.drawImages.push({at:performance.now(),tick:window.courtyardQA?.renderer.view.tick,phase:qa.phase,file:src.slice(src.lastIndexOf('/')+1),args,transform:[t.a,t.b,t.c,t.d,t.e,t.f]});}return result;};
  AudioBufferSourceNode.prototype.start=function(...args){qa.audioStarts.push({at:performance.now(),phase:qa.phase,tick:window.courtyardQA?.renderer.view.tick,duration:this.buffer?.duration,sampleRate:this.buffer?.sampleRate,contextState:this.context?.state});return nativeStart.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){qa.audioStops.push({at:performance.now(),phase:qa.phase});return nativeStop.apply(this,args);};
  try{const observer=new PerformanceObserver(list=>{if(qa.enabled)for(const e of list.getEntries())qa.longTasks.push({at:e.startTime,durationMs:e.duration});});observer.observe({type:'longtask',buffered:true});}catch{}
  addEventListener('keydown',event=>{if(!qa.enabled||event.repeat)return;const entry={id:qa.inputEvents.length+1,code:event.code,at:performance.now(),phase:qa.phase,tick:window.courtyardQA?.renderer.view.tick};event.__swordStudyInputId=entry.id;qa.inputEvents.push(entry);if(qa.pixelRequest?.code===event.code&&qa.pixelRequest.eventType!=='keyup'&&qa.pixelRequest.startedAt===null)qa.pixelRequest.startedAt=entry.at;},true);
  addEventListener('click',event=>{if(qa.enabled&&qa.pixelRequest?.eventType==='resume'&&event.target.id==='pause'&&window.courtyardQA.status().manualPause&&qa.pixelRequest.startedAt===null)qa.pixelRequest.startedAt=performance.now();},true);
  addEventListener('keyup',event=>{if(qa.enabled&&qa.pixelRequest?.code===event.code&&qa.pixelRequest.eventType==='keyup'&&qa.pixelRequest.startedAt===null)qa.pixelRequest.startedAt=performance.now();},true);
  window.requestAnimationFrame=callback=>raf(at=>{const before=performance.now();callback(at);const ended=performance.now();if(!qa.enabled||callback.name!=='frame')return;const q=window.courtyardQA,v=q?.renderer.view,s=v?.expedition?.scene;if(s?.type!=='combat')return;
   const active=!v.paused&&s.status==='active';if(active&&!qa.lastActive)qa.segment++;
   const activeIntervalMs=active&&qa.lastActive?at-qa.lastActiveAt:null;qa.lastActive=active;qa.lastActiveAt=active?at:null;
   const rawIntervalMs=qa.lastFrameAt===null?null:at-qa.lastFrameAt;qa.lastFrameAt=at;
   const rawCallbackIntervalMs=qa.lastEntryAt===null?null:before-qa.lastEntryAt,activeCallbackIntervalMs=active&&qa.lastActiveEntryAt!==null?before-qa.lastActiveEntryAt:null;qa.lastEntryAt=before;qa.lastActiveEntryAt=active?before:null;
   const frame={at,enteredAt:before,ended,drawJsMs:ended-before,tick:s.tick,status:s.status,paused:v.paused,active,segment:qa.segment,activeIntervalMs,rawIntervalMs,rawCallbackIntervalMs,activeCallbackIntervalMs,phase:qa.phase,visibilityState:document.visibilityState,hasFocus:document.hasFocus(),hostActive:q.expedition.inputState().hostActive};
   if(!qa.lean)Object.assign(frame,{player:{...s.player,motion:structuredClone(s.player.motion)},enemies:s.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,motion:structuredClone(e.motion)})),pending:structuredClone(v.expedition.combat?.pending),projectiles:structuredClone(s.projectiles||[]),groundStrikes:structuredClone(s.groundStrikes||[])});
   if(qa.captureStudy&&!qa.lean){const p=q.expedition.presentationState();frame.rendererStudy=p.study?.actors.find(a=>a?.id==='master')||null;frame.renderedPlayer=p.scene?{x:p.scene.player.x,y:p.scene.player.y,motion:p.scene.player.motion,poseTick:p.scene.player.poseTick,animationElapsedTicks:p.scene.player.animationElapsedTicks,stopPresentation:p.scene.player.stopPresentation,runTailPresentation:p.scene.player.runTailPresentation}:null;frame.camera=p.camera;}
   const request=qa.pixelRequest;if(!v.paused&&request?.eventType==='down'&&request.startedAt===null&&s.player.hp===0&&frame.renderedPlayer?.motion?.phase==='down'){const hit=(s.effects||[]).find(e=>e.kind==='hit'&&e.targetId==='master'&&e.amount>0&&e.tick>request.afterTick);if(hit){request.startedAt=performance.now();request.hitEvent=structuredClone(hit);}}if(active&&request?.eventType==='hit'&&request.startedAt===null&&frame.renderedPlayer?.motion?.phase==='hit'){const hit=(s.effects||[]).find(e=>e.kind==='hit'&&e.targetId==='master'&&e.amount>0&&e.tick>request.afterTick);if(hit){request.startedAt=performance.now();request.hitEvent=structuredClone(hit);}}if((active||!v.paused&&request?.eventType==='down'&&s.player.hp===0)&&request&&request.startedAt!==null){for(const slot of window.__swordStudyPixelCopies.filter(slot=>slot.label===request.label&&!slot.metadata)){const elapsed=performance.now()-request.startedAt,pending=v.expedition.combat?.pending;if(slot.targetMs==='down-first'||slot.targetMs==='down-middle'||slot.targetMs==='down-final'){const downed=s.player.downedTick??frame.renderedPlayer?.motion?.startedTick,age=(frame.renderedPlayer?.poseTick-downed)*100;if(!Number.isInteger(downed)||frame.renderedPlayer?.motion?.phase!=='down'||s.player.hp!==0)continue;if(slot.targetMs==='down-first'&&!(age>=0&&age<150)||slot.targetMs==='down-middle'&&!(age>=150&&age<300)||slot.targetMs==='down-final'&&!(age>=300))continue;}else if(slot.targetMs==='stop-206'){if(frame.rendererStudy?.key!=='stop-206')continue;}else if(slot.targetMs==='attack-windup'){if(!(pending?.action==='attack'&&!pending.executed&&frame.renderedPlayer?.motion?.phase==='windup'))continue;}else if(slot.targetMs==='attack-release'||slot.targetMs==='attack-release-plus30'){if(!(pending?.action==='attack'&&pending.executed&&s.tick===pending.executedTick&&frame.renderedPlayer?.motion?.phase==='release'))continue;if(slot.targetMs==='attack-release-plus30'&&(!request.releaseAt||performance.now()-request.releaseAt<30))continue;}else if(slot.targetMs==='run-after-release'){if(!(pending?.action==='attack'&&pending.executed&&s.tick>pending.executedTick&&frame.rendererStudy?.key.startsWith('run-')))continue;}else if(slot.targetMs==='hit-first'||slot.targetMs==='hit-next'){if(frame.renderedPlayer?.motion?.phase!=='hit'||!request.hitEvent)continue;if(slot.targetMs==='hit-next'&&(!request.firstHitKey||frame.rendererStudy?.key===request.firstHitKey))continue;}else if(slot.targetMs==='after-release'){if(!(pending?.action==='attack'&&pending.executed&&s.tick>pending.executedTick&&s.player.motion?.phase==='recovery'))continue;}else if(typeof slot.targetMs==='string'&&slot.targetMs.startsWith('dodge-')){const shown=frame.renderedPlayer;if(slot.targetMs==='dodge-wait'){if(shown?.motion?.action!=='dodge'||shown.motion.phase!=='windup'||shown.motion.dodgePath)continue;}else{if(shown?.motion?.dodgePath)request.dodgePath=structuredClone(shown.motion.dodgePath);const path=shown?.motion?.dodgePath||request.dodgePath,age=(shown?.poseTick??NaN)-(path?.startedTick??NaN);if(!path||shown.motion.action!=='dodge')continue;if(slot.targetMs==='dodge-late-tail'){if(shown.motion.dodgePath||age<path.durationTicks+1.2)continue;}else if(slot.targetMs==='dodge-tail'){if(age<path.durationTicks+.1)continue;}else if(age<0||age>=path.durationTicks||Math.min(3,Math.floor(age/path.durationTicks*4))!==Number(slot.targetMs.slice(6)))continue;}}else if(elapsed<slot.targetMs)continue;const copyAt=performance.now();slot.ctx.drawImage(q.expedition.canvas,0,0);const copyEnd=performance.now(),metadata={label:slot.label,targetMs:slot.targetMs,actualMs:elapsed,at:copyAt,copyMs:copyEnd-copyAt,tick:s.tick,frameKey:frame.rendererStudy?.key,file:frame.rendererStudy?.file,foot:frame.rendererStudy?.foot,mirror:frame.rendererStudy?.mirror,root:frame.rendererStudy?.root,scale:frame.rendererStudy?.scale,authorityHp:s.player.hp,downedTick:s.player.hp<=0&&frame.renderedPlayer?.motion?.phase==='down'?(s.player.downedTick??frame.renderedPlayer.motion.startedTick):null,runTailPresentation:frame.renderedPlayer?.runTailPresentation,hitEvent:request.hitEvent,worldFoot:frame.renderedPlayer?{x:frame.renderedPlayer.x,y:frame.renderedPlayer.y}:null,authorityFoot:{x:s.player.x,y:s.player.y},stopPresentation:frame.renderedPlayer?.stopPresentation,motion:frame.renderedPlayer?.motion,pending:structuredClone(pending),poseTick:frame.renderedPlayer?.poseTick,animationElapsedTicks:frame.renderedPlayer?.animationElapsedTicks};slot.metadata=metadata;if(slot.targetMs==='attack-release')request.releaseAt=performance.now();if(slot.targetMs==='hit-first')request.firstHitKey=frame.rendererStudy?.key;qa.pixelCaptures.push(metadata);}}
   if(qa.frames.length<(qa.frameLimit||16000))qa.frames.push(frame);
   if(qa.steps.at(-1)?.tick!==s.tick&&qa.steps.length<2500)qa.steps.push(qa.lean?window.__swordStudySemanticSnapshot('world-tick',{frameAt:at,enteredAt:before}):frame);
   for(const event of s.effects||[]){const id=event.eventId??event.id;if(event.kind!=='hit'||seen.has(id))continue;seen.add(id);qa.hits.push(structuredClone(event));qa.hitObservations.push({eventId:id,tick:s.tick,phase:qa.phase,at:performance.now(),drawEndedAt:ended,fontStatus:document.fonts?.status??null});}
   frame.observerEnd=performance.now();frame.observerJsMs=frame.observerEnd-ended;
  });
 });
 if(responsePatch)await installResponsePatch();
 await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__swordStudyQA&&window.courtyardQA?.status().ready&&document.getElementById('loading')?.hidden,null,{timeout:60000});
 if(responseEvidence){assert.deepEqual(responseEvidence.errors,[]);assert(responseEvidence.requests.length>0,'the exact target module was not intercepted');}
 await page.evaluate(({capture,sustained,lean})=>{const qa=window.__swordStudyQA;qa.captureStudy=capture;qa.lean=lean;qa.frameLimit=sustained?40000:16000;qa.pumpLimit=sustained?5000:3000;},{capture:movementProbe||startupProbe||dodgeClock||sustainedPerformance||resumeProbe||actionPixels||verticalDownPixels,sustained:sustainedPerformance,lean:leanObserver});
 await page.evaluate(()=>{
  const finish=event=>{const entry=window.__swordStudyQA.inputEvents.find(e=>e.id===event.__swordStudyInputId);if(entry){const q=window.courtyardQA;entry.end=performance.now();entry.durationMs=entry.end-entry.at;entry.afterTick=q.renderer.view.tick;entry.afterSelected=q.renderer.view.expedition.combat?.selectedTargetId;entry.afterPending=structuredClone(q.renderer.view.expedition.combat?.pending);entry.notice=document.getElementById('notice')?.textContent||'';}};
  addEventListener('keydown',finish);
  addEventListener('change',event=>{const qa=window.__swordStudyQA;if(!qa.enabled||event.target.id!=='combat-target-select')return;const entry={id:qa.inputEvents.length+1,code:'Change:combat-target-select',at:performance.now(),phase:qa.phase,tick:window.courtyardQA.renderer.view.tick};event.__swordStudyInputId=entry.id;qa.inputEvents.push(entry);},true);
  addEventListener('change',finish);
 });
 if(startupProbe||sustainedPerformance||dodgeClock||resumeProbe||actionPixels||verticalDownPixels)await page.evaluate(()=>{
  const qa=window.__swordStudyQA;qa.edges=[];
  const capture=event=>{if(!qa.enabled||event.repeat)return;const at=performance.now(),q=window.courtyardQA,semantic=qa.lean?window.__swordStudySemanticSnapshot('input-before',{kindOfEdge:event.type,code:event.code}):null,p=semantic?.presentation||q.expedition.presentationState(),scene=q.renderer.view.expedition.scene,entry={id:qa.edges.length+1,kind:event.type,code:event.code,at,tick:q.renderer.view.tick,phase:qa.phase,authority:scene?{x:scene.player.x,y:scene.player.y}:null,rendered:p.scene?{x:p.scene.player.x,y:p.scene.player.y,motion:p.scene.player.motion}:null,input:q.expedition.inputState()};event.__startupEdgeId=entry.id;qa.edges.push(entry);if(semantic)qa.semanticEdges.push({...semantic,edgeId:entry.id});};
  const finish=event=>{const edge=qa.edges.find(e=>e.id===event.__startupEdgeId);if(edge){edge.end=performance.now();edge.durationMs=edge.end-edge.at;if(qa.lean)qa.semanticEdges.push(window.__swordStudySemanticSnapshot('input-after',{edgeId:edge.id,kindOfEdge:event.type,code:event.code}));}};
  for(const type of ['keydown','keyup']){addEventListener(type,capture,true);addEventListener(type,finish);}
 });
 await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).setContentSize(1672,941),windowId);
 await page.waitForFunction(()=>{const q=window.courtyardQA,p=q.expedition.presentationState();return p.study?.actors?.length===2&&p.study.actors.every(a=>a&&a.file)&&p.camera?.width===q.expedition.canvas.clientWidth;},null,{timeout:10000});
 viewport=await page.evaluate(()=>{const c=window.courtyardQA.expedition.canvas;return {window:{width:innerWidth,height:innerHeight},devicePixelRatio,canvas:{width:c.clientWidth,height:c.clientHeight,backingWidth:c.width,backingHeight:c.height}};});
 const loaded=await checkpoint('loaded'),comparable=structuredClone(loaded.session.state),initialInputReset=!original.state.combat.controls&&!!comparable.combat.controls;
 let initialManualIdleReset=null;
 if(initialInputReset){assert.deepEqual(comparable.combat.controls,{autoAttack:false,move:{x:0,y:0},moveUntilTick:original.state.worldTick+5},'startup may only establish the formal cleared-input expiry');delete comparable.combat.controls;if(comparable.masterControl?.idleMs!==original.state.masterControl?.idleMs){assert.equal(comparable.masterControl.mode,'manual');assert.equal(original.state.masterControl.mode,'manual');assert.equal(comparable.masterControl.idleMs,0,'the startup input may reset manual idle only to zero');assert(Number.isFinite(original.state.masterControl.idleMs)&&original.state.masterControl.idleMs>=0);initialManualIdleReset={from:original.state.masterControl.idleMs,to:0};comparable.masterControl.idleMs=original.state.masterControl.idleMs;}}
 assert.deepEqual(comparable,original.state,'native startup must preserve the prepared world');
 const r=await read();assert.equal(r.scene.presentation,'independent-arena');assert.equal(r.scene.arena.width,48);assert.equal(r.scene.arena.height,32);assert.equal(r.presentation.camera.viewMetres,22);
 record('independent native world profile and 48x32m/22m camera',{tick:lastTick,host,profileId:PROFILE,scenario,initialInputReset,initialManualIdleReset});
 await page.evaluate(()=>{const qa=window.__swordStudyQA;qa.enabled=true;qa.focusEvents.push({kind:'observation-enabled',at:performance.now(),tick:window.courtyardQA.renderer.view.tick,phase:qa.phase,visibilityState:document.visibilityState,hasFocus:document.hasFocus(),hostActive:window.courtyardQA.expedition.inputState().hostActive});});
}
async function close(){if(!electron)return;const app=electron,p=app.process();if(p&&(p.exitCode!==null||p.signalCode!==null)){nativeClosed=true;electron=null;page=null;return;}const closed=app.waitForEvent('close',{timeout:30000}).then(()=>true);await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.close(),windowId);await closed;nativeClosed=true;electron=null;page=null;}
async function installResponsePatch(){
 const manifest=JSON.parse(await fs.readFile(responsePatch,'utf8')),original=await fs.readFile(manifest.sourcePath),instrumented=await fs.readFile(manifest.instrumentedPath);assert.equal(hash(original),manifest.originalSha256);assert.equal(hash(instrumented),manifest.instrumentedSha256);
 responseEvidence={scope:'QA-only instrumented module response; filesystem runtime hashes describe original files, not the delivered module bytes',manifestPath:responsePatch,manifest,sourceDiskSha256:hash(original),deliveredSha256:hash(instrumented),deliveredBytes:instrumented.length,requests:[],errors:[]};
 await page.route(manifest.urlPattern,async route=>{try{const response=await route.fetch(),body=await response.body(),sourceSha256=hash(body);assert.equal(sourceSha256,manifest.originalSha256,'fetched module differs from attested source');const headers={...response.headers()};for(const name of ['content-length','content-encoding','etag','last-modified'])delete headers[name];await route.fulfill({status:response.status(),headers,body:instrumented});responseEvidence.requests.push({url:route.request().url(),originalResponseSha256:sourceSha256,deliveredSha256:hash(instrumented),originalBytes:body.length,deliveredBytes:instrumented.length});}catch(error){responseEvidence.errors.push(error.stack||String(error));await route.continue();}});
}
async function collectResponseProbe(){
 if(!responseEvidence)return;const m=responseEvidence.manifest,value=await page.evaluate(({rows,error})=>({rows:globalThis[rows]||[],error:globalThis[error]??null}),{rows:m.recordsGlobal,error:m.recordErrorGlobal});responseEvidence.recordError=value.error;responseEvidence.rows=value.rows;
 await fs.writeFile(path.join(output,'route-branch-probe.json'),json(responseEvidence));assert.equal(value.error,null);assert(value.rows.some(row=>row.tick===266160),'missing target-tick branch samples');assert(value.rows.every(row=>row.tick>=m.tickWindowInclusive[0]&&row.tick<=m.tickWindowInclusive[1]));
}
async function profileMark(){return page.evaluate(()=>({at:performance.now(),tick:window.courtyardQA.renderer.view.tick,paused:window.courtyardQA.status().manualPause}));}
async function startRendererProfile(){
 if(!cdpProfile)return;cpuSession=await page.context().newCDPSession(page);await cpuSession.send('Profiler.enable');await cpuSession.send('Profiler.setSamplingInterval',{interval:1000});
 cpuProfileEvidence={samplingIntervalUs:1000,startRequested:await profileMark(),scope:'optional renderer V8 CPU samples; profiling overhead retained; JS callbacks and GC only, not GPU/display FPS'};await cpuSession.send('Profiler.start');cpuProfileEvidence.startAcknowledged=await profileMark();
}
async function stopRendererProfile(){
 if(!cpuSession)return;cpuProfileEvidence.stopRequested=await profileMark();const {profile}=await cpuSession.send('Profiler.stop');cpuProfileEvidence.stopAcknowledged=await profileMark();cpuProfileEvidence.profileStartTimeUs=profile.startTime;cpuProfileEvidence.profileEndTimeUs=profile.endTime;cpuProfileEvidence.samples=profile.samples?.length||0;
 await fs.writeFile(path.join(output,'renderer.cpuprofile'),json(profile));await fs.writeFile(path.join(output,'renderer-profile-clock.json'),json(cpuProfileEvidence));await cpuSession.detach();cpuSession=null;
}

async function returnHome(expectedStatus){
 await pause(true);const result=await capture('combat-result'),s=result.session.state,c=s.combat;
 assert.equal(c.status,expectedStatus);assert.equal(c.player.personId,MASTER);assert.equal(c.enemies[0].personId,FOE);
 assert.equal(s.personsById[MASTER].activityId,null);assert.equal(s.personsById[MASTER].combatSessionId,null);
 const factId=c.result.factId,fact=structuredClone(s.factsById[factId]),death=structuredClone(s.deathRecordsByPersonId[FOE]??null);
 assert.equal(fact.result,expectedStatus);assert.equal(s.combatSessionsById[c.sessionId].result,expectedStatus);
 assert.equal(c.rewardApplied,expectedStatus==='won');
 assert.equal(s.personsById[FOE].lifeStatus,expectedStatus==='won'?'dead':'alive');
 if(expectedStatus==='lost'){assert.equal(c.player.hp,0);assert(s.personsById[MASTER].wound>0);}
 const resultTick=s.worldTick;
 await pause(false);await until(r=>r.tick>=resultTick+13,'terminal pose clock',5000,{active:false});await pause(true);
 const stable=await capture('terminal-pose'),later=stable.session.state;
 assert.deepEqual(later.factsById[factId],fact);assert.deepEqual(later.deathRecordsByPersonId[FOE]??null,death);
 record('one formal terminal result releases the original body',{status:expectedStatus,factId,sessionId:c.sessionId,death,wound:later.personsById[MASTER].wound});
 await page.locator('#combat-acknowledge').click();actions.push({kind:'click',selector:'#combat-acknowledge',wallSeconds:wall()});
 const acknowledged=await checkpoint('acknowledged');assert.equal(acknowledged.session.state.combat,null);
 assert.equal(acknowledged.session.state.personsById[MASTER].position.sceneId,'scene:valley');
 await label('return-home');const returnState=await read(),alreadyAtExit=returnState.world.exits.some(e=>e.id==='exit:valley-yunxiu'&&e.near);
 if(!alreadyAtExit){
  await page.locator('#expedition-exit').click();actions.push({kind:'click',selector:'#expedition-exit',purpose:'walk to the real exit',wallSeconds:wall()});await pause(false);
  await until(r=>r.world.exits.some(e=>e.id==='exit:valley-yunxiu'&&e.near)&&r.world.activity?.kind!=='walk','physical return exit approach',20000,{active:false});await pause(true);
 }
 const atExit=await capture('actual-return-exit');assert.equal(atExit.session.state.personsById[MASTER].position.sceneId,'scene:valley');
 await page.locator('#expedition-exit').click();actions.push({kind:'click',selector:'#expedition-exit',wallSeconds:wall()});await pause(false);
 await until(r=>r.world.scene?.id==='scene:yunxiu-courtyard'&&!r.world.travel,'formal return travel',20000,{active:false});await pause(true);
 const home=await capture('returned-home'),hs=home.session.state;
 assert.equal(hs.personsById[MASTER].position.sceneId,'scene:yunxiu-courtyard');assert.equal(hs.personsById[MASTER].personId,MASTER);
 assert.equal(hs.personsById[FOE].lifeStatus,expectedStatus==='won'?'dead':'alive');
 assert.deepEqual(hs.factsById[factId],fact);assert.deepEqual(hs.deathRecordsByPersonId[FOE]??null,death);
 if(expectedStatus==='lost')assert(hs.personsById[MASTER].wound>0);
 record('same master returns by the actual exit and travel',{status:expectedStatus,alreadyAtExit,fromTick:resultTick,toTick:hs.worldTick,position:hs.personsById[MASTER].position,wound:hs.personsById[MASTER].wound});
}
async function defeatScenario(){
 await label('real-defeat');await key('Tab');await pause(false);
 const before=await read();assert.equal(before.scene.player.hp,1);
 const ended=await until(r=>r.scene.status==='lost','actual hostile defeat',15000,{active:false});
 assert.equal(ended.scene.player.hp,0);
 await page.waitForFunction(t=>window.__swordStudyQA.hits.some(e=>e.tick>t&&e.targetId==='master'&&e.amount>0),before.tick);
 const hits=await page.evaluate(()=>window.__swordStudyQA.hits.filter(e=>e.targetId==='master'&&e.amount>0));assert(hits.length>0,'defeat requires a real damaging hostile event');
 record('hostile action causes defeat and authoritative wound',{fromTick:before.tick,toTick:ended.tick,hits});await returnHome('lost');
}
async function retreatScenario(){
 await label('empty-ground-strike');await key('Tab');await pause(false);let r=await readyAction('ground-sword');
 const empty={x:r.scene.player.x-3,y:r.scene.player.y-3},enemyHp=r.scene.enemies[0].hp;
 await aimWorld(empty);const request=await key('q');assert.equal(request?.afterPending?.action,'ground-sword','Q native request rejected: '+(request?.notice||'no formal pending action'));
 await until(v=>v.combat.pending?.action==='ground-sword','Q request');
 r=await until(v=>ready(v,'attack')&&!v.scene.groundStrikes?.length,'Q empty landing');assert.equal(r.scene.enemies[0].hp,enemyHp);
 record('Q empty ground landing preserves enemy HP',{target:empty,tick:r.tick,hp:enemyHp});
 await aimWorld({x:r.scene.player.x-2,y:r.scene.player.y});await key('Space');await until(v=>v.combat.pending?.action==='dodge'||v.scene.player.motion?.action==='dodge','native dodge');
 await until(v=>ready(v,'attack'),'dodge completes');
 await label('active-retreat');const from=await read();await page.locator('[data-combat-action="retreat"]').click();actions.push({kind:'click',selector:'[data-combat-action="retreat"]',wallSeconds:wall()});
 const ended=await until(v=>v.scene.status==='retreated','physical combat retreat',20000,{active:false});
 assert(distance(from.scene.player,ended.scene.player)>1);const exit=ended.scene.landmarks.find(e=>e.id==='exit');assert(distance(ended.scene.player,exit)<=exit.radius+1e-7);
 record('retreat physically reaches the shared combat exit',{from:point(from.scene.player),to:point(ended.scene.player),exit});await returnHome('retreated');
}
function studyActor(r,personId=FOE){const actors=r.presentation.study?.actors;assert(actors,'the frozen renderer must expose study.actors');const list=Array.isArray(actors)?actors:Object.values(actors);const actor=list.find(a=>a.personId===personId||a.id===(personId===FOE?'enemy-1':'master')||a.actorId===(personId===FOE?'enemy-1':'master'));assert(actor,'current study actor descriptor missing');assert.equal(typeof actor.file,'string');return actor;}
function bodySample(r,label){const actor=studyActor(r),sample=actor.points?.[label]??actor.samples?.[label]??actor[label];assert(Number.isFinite(sample?.x)&&Number.isFinite(sample?.y),'current '+label+' CSS alpha sample missing');return {actor,sample:{x:sample.x,y:sample.y}};}
async function aimVisibleEnemy(){
 const started=performance.now();
 while(performance.now()-started<10000){
  const r=await read();assert.equal(r.scene.status,'active','enemy aim requires an actual active battle');const p=r.scene.player,e=r.scene.enemies[0],range=r.scene.actionRanges.find(a=>a.id==='attack').range;
  const candidates=await Promise.all(['torso','head'].map(async name=>{const body=bodySample(r,name);return {name,...body,hitTest:await pointerHitTest(body.sample)};})),visible=candidates.find(c=>c.hitTest.canvas);
  if(visible&&distance(p,e)<range-1){await aimScreen(visible.sample);actions.push({kind:'aim-visible-enemy',tick:r.tick,range,distance:distance(p,e),sample:visible,wallSeconds:wall()});return visible;}
  actions.push({kind:'approach-visible-enemy',tick:r.tick,player:point(p),enemy:point(e),range,candidates,wallSeconds:wall()});
  const dx=e.x-p.x,dy=e.y-p.y,codes=[...(Math.abs(dx)>.2?[dx>0?'d':'a']:[]),...(Math.abs(dy)>.2?[dy>0?'s':'w']:[])];assert(codes.length,'enemy is occluded with no formal approach direction');
  for(const code of codes)await page.keyboard.down(code);try{await sleep(180);}finally{for(const code of codes)await page.keyboard.up(code);}await sleep(120);
 }
 throw Error('No visible in-range native enemy alpha sample after formal WASD approach');
}
async function headScenario(){
 await label('native-head');await key('Tab');let before=await read(),body=bodySample(before,'head'),initialFoot=point(before.scene.enemies[0]),hp=before.scene.enemies[0].hp;
 await aimScreen(body.sample);await pause(false);await key('j');
 const hit=await until(r=>r.scene.enemies[0].hp<hp,'mouse current alpha head contact',5000);
 await page.waitForFunction(t=>window.__swordStudyQA.hits.some(e=>e.tick>t&&e.sourceId==='master'&&e.targetId==='enemy-1'&&e.amount>0),before.tick);
 await until(r=>r.presentation.study.audio.cues.lightHit>0,'head contact native sound',3000);await pause(true);
 const hits=await page.evaluate(t=>window.__swordStudyQA.hits.filter(e=>e.tick>t&&e.sourceId==='master'&&e.targetId==='enemy-1'&&e.amount>0),before.tick);
 assert.equal(hits.length,1,'one head shot must create one authoritative damage event');assert(hits[0].projectileId,'head contact must belong to a released shot');
 const approach=await page.evaluate(({from,to})=>window.__swordStudyQA.frames.filter(f=>f.tick>=from&&f.tick<to&&f.phase==='native-head').map(f=>f.enemies[0]),{from:before.tick,to:hits[0].tick});
 assert(approach.length>0);for(const enemy of approach)assert(distance(enemy,initialFoot)<1e-8,'head fixture enemy moved before collision');
 const headEvidence=await capture('head-contact');record('native mouse alpha head sample causes one formal hit',{sample:body,fromHp:hp,toHp:hit.scene.enemies[0].hp,event:hits[0],enemyFootBefore:initialFoot,enemyFramesBeforeHit:approach.length});
 await label('native-clear-above');await pause(false);await readyAction('attack');await pause(true);before=await read();body=bodySample(before,'above');hp=before.scene.enemies[0].hp;
 await aimScreen(body.sample);const box=await page.locator('#expedition-canvas').boundingBox();await page.mouse.click(box.x+body.sample.x,box.y+body.sample.y);actions.push({kind:'click-alpha-above',sample:body,wallSeconds:wall()});await pause(false);
 await until(r=>r.tick>=before.tick+10&&ready(r,'attack')&&!r.scene.projectiles?.length,'above-head shot expires',5000);await pause(true);const clear=await capture('clear-above');assert.equal(clear.session.state.combat.enemies[0].hp,hp);
 record('native left-click above alpha body misses',{sample:body,hp,tick:clear.session.state.worldTick});
 assert.equal(headEvidence.session.state.personsById[FOE].lifeStatus,'alive');
 await pause(false);await page.locator('[data-combat-action="retreat"]').click();await until(r=>r.scene.status==='retreated','head fixture formal retreat',20000,{active:false});await returnHome('retreated');
}
async function normalScenario(){
 await label('continuous-movement');await key('Tab');await pause(false);let before=await read();const enemyAt=point(before.scene.enemies[0]),playerAt=point(before.scene.player);
 await page.keyboard.down('a');await sleep(1050);await page.keyboard.up('a');await page.keyboard.down('d');await sleep(1350);if(dodgeClock)await armPixelCopies('normal-stop','KeyD',[25,60,100,200],'keyup');await page.keyboard.up('d');if(dodgeClock)await sleep(240);let r=await read();
 assert(distance(r.scene.player,playerAt)>.2);assert(distance(r.scene.enemies[0],enemyAt)>.1,'normal battle must include actual hostile pursuit');
 assert(Math.hypot(r.input.lastMove.x,r.input.lastMove.y)<1e-8);record('continuous native movement and hostile pursuit',{playerFrom:playerAt,playerTo:point(r.scene.player),enemyFrom:enemyAt,enemyTo:point(r.scene.enemies[0]),worldTicks:r.tick-before.tick});
 if(dodgeClock){await pause(true);await exportPixelCopies('normal-stop');await verifyNativeStop('normal-stop');await pause(false);}
 await label('moving-attack');await readyAction('attack');let sample=await aimVisibleEnemy();before=await read();await page.keyboard.down('w');await key('j');
 const movingRelease=await until(v=>v.scene.projectiles.some(p=>p.kind==='sword-qi'),'moving J actual projectile release',5000);assert(distance(before.scene.player,movingRelease.scene.player)>.1);await page.keyboard.up('w');
 await until(v=>ready(v,'attack')&&!v.scene.projectiles?.length,'moving attack contact',5000);await pause(true);await capture('moving-attack');record('J releases sword qi during actual WASD movement',{from:point(before.scene.player),to:point(movingRelease.scene.player),projectiles:movingRelease.scene.projectiles});
 await label('q-release-move-dodge');await pause(false);await readyAction('ground-sword');r=await read();const target=point(r.scene.enemies[0]);assert(distance(r.scene.player,target)<8);
 await aimWorld(target);await page.keyboard.down('w');const request=await key('q');assert.equal(request?.afterPending?.action,'ground-sword','Q native request rejected: '+(request?.notice||'no formal pending action'));const actualTarget=structuredClone(request.afterPending.target),queued=await until(v=>v.combat.pending?.action==='ground-sword','Q formal windup',3000),actionId=queued.combat.pending.id,at=point(queued.scene.player);
 const released=await until(v=>v.scene.groundStrikes?.some(s=>s.actionId===actionId),'Q actual release',3000),strike=released.scene.groundStrikes.find(s=>s.actionId===actionId);
 assert(distance(released.scene.player,at)<1e-8,'Q windup must stop real feet');assert.equal(strike.releasedTick-queued.combat.pending.startedTick,3);assert.equal(strike.landTick-strike.releasedTick,1);assert.equal(strike.radius,1.1);assert.deepEqual(strike.target,actualTarget);
 const moving=await until(v=>distance(v.scene.player,at)>.1,'movement resumes after Q release',3000);assert(moving.tick<=released.tick+2);
 if(dodgeClock){await armPixelCopies('q-space','Space',['dodge-wait','dodge-0','dodge-1','dodge-2','dodge-3','dodge-tail','dodge-late-tail']);const current=await read(),p=current.scene.player,e=current.scene.enemies[0],length=Math.hypot(p.x-e.x,p.y-e.y)||1;await aimWorld({x:p.x+(p.x-e.x)/length*3,y:p.y+(p.y-e.y)/length*3});}
 await key('Space');await page.keyboard.up('w');await until(v=>v.combat.pending?.action==='dodge'||v.scene.player.motion?.action==='dodge','Space after released Q',3000);await until(v=>ready(v,'attack'),'post-Q dodge recovery',5000);if(dodgeClock)await waitForDodgePixels('q-space');
 await pause(true);const qResult=await capture('q-move-dodge');const locks=await page.evaluate(id=>window.__swordStudyQA.steps.filter(f=>f.pending?.id===id&&!f.pending.executed),actionId);assert(locks.length>=2);for(const f of locks)assert(distance(f.player,at)<1e-8);
 const landed=await page.evaluate(id=>window.__swordStudyQA.hits.filter(e=>e.actionId===id&&e.amount>0),actionId);assert.equal(landed.length,1,'locked Q ground strike must hit once');assert.equal(qResult.session.state.srCombat.cooldowns['ground-sword'],strike.releasedTick+18);
 record('Q three-tick windup releases one delayed ground strike then permits movement and Space',{actionId,target:actualTarget,mouseWorldPointBeforeHeldMovement:target,at,startedTick:queued.combat.pending.startedTick,releaseTick:released.tick,landTick:strike.landTick,moveTick:moving.tick,locks:locks.map(f=>({tick:f.tick,player:point(f.player)})),hits:landed,cooldownUntil:qResult.session.state.srCombat.cooldowns['ground-sword']});
 if(dodgeClock){
  await exportPixelCopies('q-space');await verifyDodgeClock('q-space');
  await label('j-release-space');await pause(false);await readyAction('dodge');await readyAction('attack');r=await read();const p=r.scene.player,e=r.scene.enemies[0],length=Math.hypot(p.x-e.x,p.y-e.y)||1;await aimWorld({x:p.x+(p.x-e.x)/length*3,y:p.y+(p.y-e.y)/length*3});await page.keyboard.down('w');
  await key('j');const shot=await until(v=>v.scene.projectiles.some(p=>p.kind==='sword-qi'),'pre-dodge real basic release',3000),shotId=shot.scene.projectiles.find(p=>p.kind==='sword-qi').id;
  await armPixelCopies('j-space','Space',['dodge-wait','dodge-0','dodge-1','dodge-2','dodge-3','dodge-tail','dodge-late-tail']);await key('Space');await page.keyboard.up('w');const following=await until(v=>v.scene.player.motion?.action==='dodge','Space after released basic attack',3000);assert(following.scene.projectiles.some(p=>p.id===shotId),'dodge must retain the already released basic projectile');await until(v=>ready(v,'attack'),'basic-dodge recovery',5000);await waitForDodgePixels('j-space');await pause(true);await exportPixelCopies('j-space');await verifyDodgeClock('j-space');
 }
 await label('original-spell');await pause(false);await readyAction('spell');before=await read();await aimWorld({x:before.scene.player.x-2,y:before.scene.player.y-2});await key('2');
 const spell=await until(v=>v.scene.projectiles.some(p=>p.kind==='spell'),'original 2 spell projectile',3000);await until(v=>ready(v,'attack')&&!v.scene.projectiles?.length,'original 2 spell completes',5000);record('original 2 spell remains a separate formal projectile',{projectiles:spell.scene.projectiles});
 await label('normal-victory');
 for(let n=0;n<30;n++){
  r=await read();if(r.scene.status!=='active')break;
  if(!ready(r,'attack')){await until(v=>v.scene.status!=='active'||ready(v,'attack'),'ordinary attack cooldown',5000,{active:false});continue;}
  sample=await aimVisibleEnemy();r=await read();await key('j');await until(v=>v.scene.status!=='active'||v.tick>=r.tick+7&&ready(v,'attack'),'ordinary attack outcome',5000,{active:false});
 }
 r=await read();assert.equal(r.scene.status,'won','normal live enemy must be defeated through actual attacks');await page.waitForFunction(()=>window.__swordStudyQA.frames.some(f=>f.status==='won'));record('normal native attacks defeat the actual enemy',{tick:r.tick,playerHp:r.scene.player.hp,enemyHp:r.scene.enemies[0].hp});await returnHome('won');
}
async function runScenario(){
 if(verticalDownPixels)return verticalDownPixelsScenario();
 if(actionPixels)return actionPixelsScenario();
 if(resumeProbe)return resumeProbeScenario();
 if(sustainedPerformance)return sustainedPerformanceScenario();
 if(startupProbe)return startupProbeScenario();
 if(targetProbe)return targetProbeScenario();
 if(movementProbe)return movementProbeScenario();
 if(longPerformance)return longPerformanceScenario();
 if(scenario==='defeat')return defeatScenario();
 if(scenario==='retreat')return retreatScenario();
 if(scenario==='head')return headScenario();
 return normalScenario();
}
async function actionPixelsScenario(){
 for(const [name,code,direction]of [['D','d','right'],['A','a','left'],['W','w','up'],['S','s','down']]){
  await label('pixels-'+name);await armPixelCopies('move-'+name,'Key'+name,[150,350]);await pause(false);await page.keyboard.down(code);await sleep(430);await armPixelCopies('stop-'+name,'Key'+name,name==='A'?[25,60,100,'stop-206']:[25,100],'keyup');await page.keyboard.up(code);await sleep(150);await pause(true);await exportPixelCopies('move-'+name);await exportPixelCopies('stop-'+name);
  const samples=await page.evaluate(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label),'move-'+name);assert.equal(samples.length,2);assert.equal(new Set(samples.map(p=>p.frameKey)).size,2);assert(samples.every(p=>STUDY_METADATA.player.move[direction].includes(p.frameKey)));record('actual '+name+' moving pixels',{samples});
 }
 await label('pixels-moving-J');await armPixelCopies('moving-J','KeyJ',['attack-windup','attack-release','attack-release-plus30','run-after-release']);await pause(false);await page.keyboard.down('d');await sleep(140);const before=await read();await aimWorld({x:before.scene.player.x+3,y:before.scene.player.y});await key('j');await page.waitForFunction(()=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='moving-J').length===4,null,{timeout:4000});await page.keyboard.up('d');await pause(true);await exportPixelCopies('moving-J');
 const j=await page.evaluate(()=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='moving-J'));assert(j.find(p=>p.targetMs==='attack-release').pending.executed);assert(j.find(p=>p.targetMs==='run-after-release').frameKey.startsWith('run-'));assert(distance(j[0].worldFoot,j.at(-1).worldFoot)>.1);record('held J actual windup release and following run pixels',{samples:j});
 for(const [facing,mirror]of [['right',false],['left',true]]){
  await label('pixels-hit-'+facing);await pause(false);
  if(facing==='left'){let r=await read();await page.keyboard.down('d');await until(v=>v.scene.player.x>=v.scene.enemies[0].x+3.4,'cross to actual left-facing hit position',6000);await page.keyboard.up('d');await page.keyboard.down('a');await sleep(130);await page.keyboard.up('a');}
  else {await page.keyboard.down('d');await sleep(120);await page.keyboard.up('d');}
  const before=await read();await armPixelCopies('hit-'+facing,null,['hit-first','hit-next'],'hit');await page.waitForFunction(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label).length===2,'hit-'+facing,{timeout:15000});await pause(true);await exportPixelCopies('hit-'+facing);
  const samples=await page.evaluate(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label),'hit-'+facing);assert(samples.every(p=>p.hitEvent.amount>0&&p.authorityHp<before.scene.player.hp&&p.motion.phase==='hit'&&p.mirror===mirror));assert.equal(new Set(samples.map(p=>p.frameKey)).size,2);record('actual hostile damage while facing '+facing,{hpBefore:before.scene.player.hp,samples});
 }
}
async function verticalDownPixelsScenario(){
 assert.equal(original.state.combat.player.hp,1);assert.equal(original.state.combat.enemies[0].cooldown,5);
 for(const [name,code,direction,idle]of [['W','w','up','cast-07'],['S','s','down','cast-11']]){
  await label('vertical-'+name);await armPixelCopies('vertical-move-'+name,'Key'+name,[150,350]);await pause(false);await page.keyboard.down(code);await sleep(430);await armPixelCopies('vertical-stop-'+name,'Key'+name,[25,100,200],'keyup');await page.keyboard.up(code);await sleep(250);await pause(true);await exportPixelCopies('vertical-move-'+name);await exportPixelCopies('vertical-stop-'+name);
  const pixels=await page.evaluate(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label),'vertical-stop-'+name),last=pixels.find(p=>p.targetMs===200);assert.equal(last.frameKey,idle);assert(distance(last.worldFoot,last.authorityFoot)<.001);record('vertical '+name+' tail reaches current authored idle',{pixels});
 }
 await label('real-down-three');await armPixelCopies('real-down',null,['down-first','down-middle','down-final'],'down');await pause(false);await page.waitForFunction(()=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='real-down').length===3,null,{timeout:15000});await pause(true);await exportPixelCopies('real-down');const pixels=await page.evaluate(()=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='real-down'));
 assert.deepEqual(pixels.map(p=>p.frameKey),['down-00','down-01','down-02']);assert(pixels.every(p=>p.authorityHp===0&&p.hitEvent.amount>0&&p.motion.phase==='down'));assert(pixels.every(p=>p.downedTick===pixels[0].downedTick));const final=await checkpoint('real-down-final');assert.equal(final.session.state.combat.status,'lost');assert.equal(final.session.state.combat.player.hp,0);assert.equal(final.session.state.combat.player.downedTick,pixels[0].downedTick,'rendered down clock must equal the authoritative downedTick');record('real enemy lethal hit displays all three down stages',{pixels,downedTick:pixels[0].downedTick,result:final.session.state.combat.result});
}
async function resumeProbeScenario(){
 await label('resume-stop-setup');const initial=await read();await pause(false);await page.keyboard.down('d');await until(r=>r.tick>=initial.tick+3&&r.scene.player.x-r.presentation.scene.player.x>.22,'real move has a confirmed displayed tail',5000);await key('Escape');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true);await page.keyboard.up('d');await pause(true);
 const frozen=await read();assert(studyActor(frozen,MASTER).key.startsWith('run-'),'pause must freeze the actually moving run pose');assert(frozen.scene.player.x-frozen.presentation.scene.player.x>.02,'the actual pause needs an unfinished confirmed tail');assert.deepEqual(frozen.input.held,[]);await sleep(180);const still=await read();assert.deepEqual(point(still.presentation.scene.player),point(frozen.presentation.scene.player));assert.equal(still.tick,frozen.tick);
 await label('resume-stop-no-input');await armPixelCopies('resume-stop','resume',[25,60,100,200],'resume');await pause(false);await sleep(280);await pause(true);await exportPixelCopies('resume-stop');
 const data=await page.evaluate(()=>({pixels:window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='resume-stop'),frames:window.__swordStudyQA.frames.filter(f=>f.phase==='resume-stop-no-input'&&f.active&&f.renderedPlayer).map(f=>({at:f.at,enteredAt:f.enteredAt,ended:f.ended,tick:f.tick,rendered:f.renderedPlayer,renderer:f.rendererStudy,authority:f.player}))})),stopKeys=STUDY_METADATA.player.stop,origin=point(frozen.presentation.scene.player),backward=Math.max(0,...data.frames.map(f=>origin.x-f.rendered.x)),standingSkid=data.frames.filter((f,i)=>i>0&&distance(f.rendered,data.frames[i-1].rendered)>.001&&distance(f.rendered,f.authority)>.02&&!stopKeys.includes(f.renderer.key));
 await fs.writeFile(path.join(output,'resume-stop-trace.json'),json({frozen,data,maximumBackwardMeters:backward,standingSkid}));assert.equal(data.pixels.length,4);assert.equal(standingSkid.length,0,'resume slid before the visible stop finished');assert(backward<=.001);const last=data.frames.at(-1);assert(distance(last.rendered,last.authority)<.001);const seenStopKeys=[...new Set(data.frames.map(f=>f.renderer.key).filter(key=>stopKeys.includes(key)))];assert.deepEqual(seenStopKeys,stopKeys);record('native pause resumes held-move tail through stop frames without idle sliding or backward feet',{frozenRun:studyActor(frozen,MASTER).key,frozenAuthority:point(frozen.scene.player),frozenDisplay:point(frozen.presentation.scene.player),seenStopKeys,pixels:data.pixels.map(p=>({target:p.targetMs,key:p.frameKey,foot:p.worldFoot})),maximumBackwardMeters:backward,standingSkid:standingSkid.length});
}
async function startupProbeScenario(){
 const wallLeft=.6,initial=await read();assert.equal(initial.scene.status,'active');
 async function activePixels(name,code,times,action){await label(name);await armPixelCopies(name,code,times);await pause(false);await focusInput();await action();await pause(true);await exportPixelCopies(name);}
 await activePixels('startup-D','KeyD',[25,60,100,200],async()=>{await page.keyboard.down('d');await sleep(620);await page.keyboard.up('d');await sleep(220);});
 record('startup keydown and release recorded in actual native rAF');
 await activePixels('startup-reverse','KeyA',[25,60,100,200],async()=>{await page.keyboard.down('d');await sleep(280);await page.keyboard.up('d');await page.keyboard.down('a');await sleep(350);await page.keyboard.up('a');await sleep(220);});
 record('startup opposite direction recorded in actual native rAF');
 await label('startup-blur');await armPixelCopies('startup-blur','KeyD',[25,100]);await pause(false);await page.keyboard.down('d');await sleep(180);
 const blurAt=await protocolStart('native-window-blur','startup-blur');await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).blur(),windowId);await sleep(350);await protocolEnd(blurAt);let r=await read();assert.equal(r.input.hostActive,false);assert.deepEqual(r.input.held,[]);assert.equal(r.input.lastMove.x,0);assert.equal(r.input.lastMove.y,0);await focusInput();await page.keyboard.up('d');await pause(true);await exportPixelCopies('startup-blur');record('actual native blur clears held intent while world keeps running');
 await label('startup-pause');await armPixelCopies('startup-pause','KeyD',[25,100]);await pause(false);await page.keyboard.down('d');await sleep(180);await pause(true);const frozen=await read();assert.deepEqual(frozen.input.held,[]);await sleep(280);r=await read();assert.equal(r.tick,frozen.tick);assert.deepEqual(point(r.presentation.scene.player),point(frozen.presentation.scene.player));await page.keyboard.up('d');await exportPixelCopies('startup-pause');record('explicit pause clears intent and freezes actual render foot and world tick');
 await label('startup-wall');await armPixelCopies('startup-wall','KeyA',[25,100,200]);await pause(false);await page.keyboard.down('a');await until(r=>r.scene.player.x<=wallLeft+.0001,'real left boundary',9000);await sleep(260);r=await read();assert(r.presentation.scene.player.x>=wallLeft-1e-6);assert(r.scene.player.x>=wallLeft-1e-6);await page.keyboard.up('a');await sleep(220);await pause(true);await exportPixelCopies('startup-wall');record('real wall collision bounds authoritative and displayed feet',{authority:point(r.scene.player),rendered:point(r.presentation.scene.player)});
 const traces=await page.evaluate(()=>({edges:window.__swordStudyQA.edges,frames:window.__swordStudyQA.frames.filter(f=>f.phase.startsWith('startup-')),pixels:window.__swordStudyQA.pixelCaptures})),metrics=[];
 for(const edge of traces.edges.filter(e=>['KeyA','KeyD'].includes(e.code))){
  const next=traces.edges.find(e=>e.id>edge.id&&e.phase===edge.phase),frames=traces.frames.filter(f=>f.phase===edge.phase&&f.ended>=edge.at&&(!next||f.ended<next.at)&&f.renderedPlayer),origin=edge.rendered;
  const first=origin&&frames.find(f=>distance(f.renderedPlayer,origin)>.001),moving=frames.filter(f=>f.active&&f.renderedPlayer.motion?.moving&&['idle','move'].includes(f.renderedPlayer.motion.phase));let maxPlateauMs=0,platform=null;
  for(const frame of moving){if(!platform||distance(frame.renderedPlayer,platform.position)>.001)platform={at:frame.at,position:point(frame.renderedPlayer)};else maxPlateauMs=Math.max(maxPlateauMs,frame.at-platform.at);}
  metrics.push({edgeId:edge.id,phase:edge.phase,kind:edge.kind,code:edge.code,inputMs:edge.durationMs,sampledFrames:frames.length,firstRenderedDisplacementMs:first?first.ended-edge.at:null,firstRenderedTick:first?.tick,maxFootPlateauMs:maxPlateauMs,maximumDisplayLeadMeters:Math.max(0,...frames.map(f=>distance(f.renderedPlayer,f.player))),keys:[...new Set(frames.map(f=>f.rendererStudy?.key))]});
 }
 await fs.writeFile(path.join(output,'startup-native-trace.json'),json({...traces,metrics,note:'actual Electron rAF and displayed world feet; CSS player foot follows the camera; plateaus include wall collision and are labelled by phase; source pixels copied while active and PNG encoded only after pause; raw rAF/task spans remain in observations'}));
 const movingMetrics=metrics.filter(m=>m.kind==='keydown'&&m.phase!=='startup-wall');assert(movingMetrics.every(m=>m.firstRenderedDisplacementMs!==null));
 const final=await read();assert.equal(final.scene.status,'active');record('native onset and foot-platform measurements retained',{metrics,pixels:traces.pixels.length,initialTick:initial.tick,finalTick:final.tick});
}
async function targetProbeScenario(){
 const initial=await read(),targetId=initial.scene.enemies[0].id,start=initial.tick;
 for(const active of [false,true]){
  await label('target-probe-'+(active?'active':'paused'));await pause(!active);if(active)await page.keyboard.down('d');
  for(let index=0;index<20;index++){
   await key('Tab');const r=await read();assert.equal(r.combat.selectedTargetId,targetId);assert.equal(r.scene.status,'active');
   if(index%4===3){await page.locator('#combat-target-select').selectOption('');assert.equal((await read()).combat.selectedTargetId,null);}
   await sleep(active?70:20);
  }
  if(active)await page.keyboard.up('d');await pause(true);
  const inputs=await page.evaluate(phase=>window.__swordStudyQA.inputEvents.filter(e=>e.phase===phase&&['Tab','Change:combat-target-select'].includes(e.code)),'target-probe-'+(active?'active':'paused'));
  const tabs=inputs.filter(e=>e.code==='Tab'),clears=inputs.filter(e=>e.code!=='Tab'),stats=distribution(inputs.map(e=>e.durationMs));assert.equal(tabs.length,20);assert.equal(clears.length,5);
  await fs.writeFile(path.join(output,'target-probe-'+(active?'active':'paused')+'.json'),json({scope:'actual native capture-to-bubble synchronous input span; no CPU attribution beyond the handler',inputs,stats}));
  assert(stats.p95<=50,'target input p95 exceeds 50ms: '+stats.p95);assert(stats.max<=100,'target input exceeds 100ms: '+stats.max);
  record('native target selection and clearing '+(active?'active':'paused'),{tabs:20,clears:5,stats});
  await capture('target-probe-'+(active?'active':'paused')+'-final');
 }
 const final=await read();assert(final.tick>start,'the active target probe must really advance the background world');assert.equal(final.scene.status,'active');record('target probe preserves live battle and original background world',{startTick:start,finalTick:final.tick,actualTicks:final.tick-start});
}
async function movementProbeScenario(){
 await key('Tab');
 for(const [letter,code] of [['D','d'],['A','a'],['W','w'],['S','s']]){
  await label('movement-'+letter);await armPixelCopies('movement-'+letter,'Key'+letter,[150,300,450]);await pause(false);await page.keyboard.down(code);const started=performance.now(),samples=[];
  for(const targetMs of [150,300,450,600]){const remaining=targetMs-(performance.now()-started);if(remaining>0)await sleep(remaining);const r=await read();samples.push({requestedMs:targetMs,wallMs:performance.now()-started,tick:r.tick,authority:point(r.scene.player),authorityMotion:r.scene.player.motion,renderer:studyActor(r,MASTER),rendered:r.presentation.scene?{motion:r.presentation.scene.player.motion,poseTick:r.presentation.scene.player.poseTick,animationElapsedTicks:r.presentation.scene.player.animationElapsedTicks}:null});}
  await pause(true);await exportPixelCopies('movement-'+letter);await capture('movement-'+letter+'-paused-held');await page.keyboard.up(code);await pause(false);await sleep(140);await pause(true);await capture('movement-'+letter+'-stopped');
  const frames=await page.evaluate(letter=>window.__swordStudyQA.frames.filter(f=>f.phase==='movement-'+letter&&f.active&&f.renderedPlayer?.motion?.moving&&f.renderedPlayer.motion.phase==='move').map(f=>({at:f.at,tick:f.tick,renderer:f.rendererStudy,rendered:f.renderedPlayer})),letter);
  await fs.writeFile(path.join(output,'movement-'+letter+'-samples.json'),json({scope:'native movement diagnosis; renderer descriptors and actual Canvas drawImage calls; pause clears held input before the paused-held screenshot',letter,samples,frames}));
  record('movement diagnostic '+letter,{requestedHeldMs:600,actualHeldMs:samples.at(-1).wallMs,rendererKeys:[...new Set(frames.map(f=>f.renderer?.key))],sourceFiles:[...new Set(frames.map(f=>f.renderer?.file))],samples:samples.map(s=>({requestedMs:s.requestedMs,tick:s.tick,key:s.renderer.key,animationElapsedTicks:s.rendered?.animationElapsedTicks,motion:s.authorityMotion.phase}))});
 }
 await label('movement-J-return');await armPixelCopies('movement-J-return','KeyJ',[100,220,350,500,'after-release']);await pause(false);await page.keyboard.down('d');await sleep(420);await readyAction('attack');const before=await read(),target=bodySample(before,'torso');await aimScreen(target.sample);const request=await key('j');assert.equal(request?.afterPending?.action,'attack','moving J must create a formal action');await sleep(620);await pause(true);await exportPixelCopies('movement-J-return');await page.keyboard.up('d');await capture('movement-J-return-paused-held');
 const samples=await page.evaluate(()=>({pixels:window.__swordStudyQA.pixelCaptures.filter(p=>p.label==='movement-J-return'),frames:window.__swordStudyQA.frames.filter(f=>f.phase==='movement-J-return').map(f=>({at:f.at,tick:f.tick,pending:f.pending,renderer:f.rendererStudy,rendered:f.renderedPlayer}))}));
 await fs.writeFile(path.join(output,'movement-J-return-samples.json'),json({scope:'actual moving J windup, release and post-release Canvas pixels; diagnostic only',...samples}));const postRelease=samples.pixels.find(p=>p.targetMs==='after-release');assert(postRelease,'a real post-release recovery frame must be copied');assert(postRelease.frameKey.startsWith('run-'),'held horizontal movement must display its run frame after release');record('moving J return diagnostic',{samples:samples.pixels});
}
async function armPixelCopies(label,code,times,eventType='keydown'){await page.evaluate(({label,code,times,eventType})=>{const q=window.courtyardQA,qa=window.__swordStudyQA,c=q.expedition.canvas;qa.pixelRequest={label,code,eventType,startedAt:null,afterTick:q.renderer.view.tick};for(const targetMs of times){const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;window.__swordStudyPixelCopies.push({label,targetMs,canvas:copy,ctx:copy.getContext('2d'),metadata:null});}},{label,code,times,eventType});}
async function verifyNativeStop(label){
 const data=await page.evaluate(label=>{const qa=window.__swordStudyQA,edge=qa.edges.findLast(e=>e.kind==='keyup'&&e.code==='KeyD'&&e.phase==='continuous-movement');return {edge,pixels:qa.pixelCaptures.filter(p=>p.label===label),frames:qa.frames.filter(f=>f.phase==='continuous-movement'&&f.ended>=edge.at&&f.ended<=edge.at+240&&f.renderedPlayer).map(f=>({at:f.at,ended:f.ended,tick:f.tick,rendered:f.renderedPlayer,renderer:f.rendererStudy,authority:f.player}))};},label);
 assert.equal(data.pixels.length,4);const origin=data.edge.rendered,backward=Math.max(0,...data.frames.map(f=>origin.x-f.rendered.x)),stopKeys=STUDY_METADATA.player.stop,seenStopKeys=[...new Set(data.frames.map(f=>f.renderer.key).filter(key=>stopKeys?.includes(key)))],standingSkid=data.frames.filter((frame,index)=>index>0&&frame.rendered.x-data.frames[index-1].rendered.x>.001&&distance(frame.rendered,frame.authority)>.02&&!stopKeys?.includes(frame.renderer.key));await fs.writeFile(path.join(output,label+'-trace.json'),json({...data,maximumBackwardMeters:backward,seenStopKeys,standingSkid}));assert(backward<=.001,'keyup visibly pulled the real rendered foot backward by '+backward+'m');assert.deepEqual(seenStopKeys,stopKeys,'all three actual stop frames must be displayed in order');assert.equal(standingSkid.length,0,'standing art slid before the visible foot settled');record('native side stop retains forward foot progression',{pixels:data.pixels.map(p=>({targetMs:p.targetMs,key:p.frameKey,worldFoot:p.worldFoot})),maximumBackwardMeters:backward,seenStopKeys,standingSkidFrames:standingSkid.length,frames:data.frames.length});
}
async function verifyDodgeClock(label){
 const pixels=await page.evaluate(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label),label),keys=STUDY_METADATA.player.evade,first=pixels.find(p=>p.targetMs==='dodge-0'),lateTail=pixels.find(p=>p.targetMs==='dodge-late-tail');
 assert(first&&lateTail,'real flight start and path-free tail must be copied');const dodgePath=first.motion.dodgePath;
 const trace=await page.evaluate(({firstAt,lastAt})=>{const qa=window.__swordStudyQA,input=qa.inputEvents.findLast(e=>e.code==='Space'&&e.at<=firstAt);if(!input)throw Error('missing actual Space keydown');return {input,frames:qa.frames.filter(f=>f.phase===input.phase&&f.ended>=input.at&&f.ended<=lastAt+25&&f.renderedPlayer?.motion?.action==='dodge').map(f=>({at:f.at,ended:f.ended,tick:f.tick,rendered:f.renderedPlayer,renderer:f.rendererStudy,authority:f.player,pending:f.pending}))};},{firstAt:first.at,lastAt:lateTail.at});
 const frames=trace.frames;await fs.writeFile(path.join(output,label+'-clock.json'),json({scope:'actual native Space keydown, waiting first tick, authoritative two-tick path and path-free evade tail; Canvas pixels copied during active rAF',input:trace.input,path:dodgePath,pixels,frames}));
 assert.equal(pixels.filter(p=>p.targetMs!=='dodge-wait').length,6,'each real dodge must copy four flight frames and both tails');assert.equal(dodgePath.durationTicks,2);
 for(let index=0;index<4;index++){const pixel=pixels.find(p=>p.targetMs==='dodge-'+index);assert(pixel);assert.equal(pixel.frameKey,keys[index]);assert.deepEqual(pixel.motion.dodgePath,dodgePath);const age=pixel.poseTick-dodgePath.startedTick;assert(age>=index*.5&&age<(index+1)*.5);}
 const waiting=frames.filter(f=>f.rendered.motion.phase==='windup'&&!f.rendered.motion.dodgePath);for(const frame of waiting)assert.equal(frame.renderer.key,keys[0],'waiting for the first real tick preplayed dodge frames');const waitPixel=pixels.find(p=>p.targetMs==='dodge-wait');if(waitPixel)assert.equal(waitPixel.frameKey,keys[0]);
 const tail=pixels.find(p=>p.targetMs==='dodge-tail');assert.equal(tail.frameKey,keys[3]);assert(tail.poseTick-dodgePath.startedTick>=2.1);assert.equal(lateTail.frameKey,keys[3]);assert.equal(lateTail.motion.dodgePath,undefined);assert(lateTail.poseTick-dodgePath.startedTick>=3.2);
 let previous=-1;for(const frame of frames){const index=keys.indexOf(frame.renderer.key);assert(index>=0);assert(index>=previous,'dodge request/release/recovery restarted an earlier whole frame');previous=index;}
 assert.deepEqual([...new Set(frames.map(f=>f.renderer.key))],keys);record(label+' uses one two-tick whole-frame dodge clock',{path:dodgePath,input:trace.input,waitingFrames:waiting.length,frames:frames.length,keys,pixels:pixels.map(p=>({target:p.targetMs,actualMs:p.actualMs,poseTick:p.poseTick,key:p.frameKey}))});
}
async function waitForDodgePixels(label){await page.waitForFunction(label=>window.__swordStudyQA.pixelCaptures.filter(p=>p.label===label&&p.targetMs!=='dodge-wait').length===6,label,{timeout:3000});}

async function exportPixelCopies(label){assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true);const id=await protocolStart('deferred-pixel-export',label),copies=await page.evaluate(label=>window.__swordStudyPixelCopies.filter(slot=>slot.label===label&&slot.metadata).map(slot=>({metadata:slot.metadata,png:slot.canvas.toDataURL('image/png')})),label);await protocolEnd(id);assert(copies.length>0,'the active rAF must copy real Canvas pixels');for(const copy of copies){const pixels=Buffer.from(copy.png.split(',')[1],'base64');copy.metadata.captureSha256=hash(pixels);copy.metadata.sourceFileSha256=runtimeBefore['assets/courtyard/'+copy.metadata.file]??null;await fs.writeFile(path.join(output,copy.metadata.label+'-active-'+copy.metadata.targetMs+'.png'),pixels);}await fs.writeFile(path.join(output,label+'-active-pixels.json'),json(copies.map(copy=>copy.metadata)));}
async function longPerformanceScenario(){
 await label('long-save-short-input');assert.equal(original.state.worldTick,265430);assert.equal(Object.keys(original.state.personsById).length,120);assert(!original.state.personsById[MASTER].artsById.swordbasic&&!original.state.personsById[MASTER].artsById.sword,'the long source must retain its real unschooled sword state');
 const start=original.state.worldTick;await key('Tab');await pause(false);await page.keyboard.down('w');await until(r=>r.tick>=start+4,'initial real W movement');let r=await read();await aimScreen(bodySample(r,'torso').sample);const attack=await key('j');assert.equal(attack.afterPending?.action,'attack');await until(r=>r.tick>=start+10,'cross the original cold tick 265440');await page.keyboard.up('w');await page.keyboard.down('a');await until(r=>r.tick>=start+15&&ready(r,'attack'),'ready after moving J');
 const beforeQ=await read(),q=await key('q');assert(!q.afterPending,'unlearned Q must not create an action');assert(/剑术|剑法|掌握/.test(q.notice),'Q must reject the actual missing sword requirement');const afterQ=await read();assert(afterQ.scene.player.qi>=beforeQ.scene.player.qi-.001,'rejected Q must not spend qi');record('long save unlearned Q rejects without an action',{input:q,qiBefore:beforeQ.scene.player.qi,qiAfter:afterQ.scene.player.qi});
 await readyAction('spell');r=await read();await aimWorld(point(r.scene.enemies[0]));const spell=await key('2');assert.equal(spell.afterPending?.action,'spell');await until(r=>r.scene.projectiles.some(p=>p.kind==='spell'),'long save original spell actual release',5000);await key('Space');await page.keyboard.up('a');await page.keyboard.down('s');await until(r=>r.tick>=start+30,'actual S movement');await page.keyboard.up('s');await page.keyboard.down('d');await until(r=>r.tick>=start+40,'forty target ticks');await page.keyboard.up('d');await pause(true);
 const final=await capture('long-save-short-final'),s=final.session.state;assert.equal(s.combat.status,'active');assert.equal(s.combat.player.personId,MASTER);assert.equal(s.combat.allies.length,0);assert.equal(Object.keys(s.personsById).length,120);assert(!s.personsById[MASTER].artsById.swordbasic&&!s.personsById[MASTER].artsById.sword);
 const background=s.homeMemberIds.map(personId=>{const p=s.personsById[personId],a=s.activitiesById[p.activityId];return {personId,position:p.position,activityId:p.activityId,activity:a,workOrder:a?.workOrderId?s.workOrdersById[a.workOrderId]:null};});await fs.writeFile(path.join(output,'background-after-short-test.json'),json(background));
 record('long save real world crosses 265440 with WASD J spell and dodge',{startTick:start,finalTick:s.worldTick,actualTicks:s.worldTick-start,targetTicks:40,hp:s.combat.player.hp,enemyHp:s.combat.enemies[0].hp,persons:120,backgroundCount:background.length,scope:'Fresh Electron process plus an instrumentation reload before unpause; initial view is built and assets prepared; no active warm-up world steps before 265430; not untouched OS-cold startup'});
}
async function sustainedPerformanceScenario(){
 assert.equal(original.state.worldTick,265430);assert.equal(Object.keys(original.state.personsById).length,120);assert(!original.state.personsById[MASTER].artsById.swordbasic&&!original.state.personsById[MASTER].artsById.sword);
 const start=await read(),waypoints=[{x:8,y:24,key:'a',axis:'x',sign:-1},{x:8,y:6,key:'w',axis:'y',sign:-1},{x:30,y:6,key:'d',axis:'x',sign:1},{x:30,y:26,key:'s',axis:'y',sign:1},{x:8,y:26,key:'a',axis:'x',sign:-1}],events=[],samples=[];
 const scheduled=[{at:.4,key:'j',action:'attack',enemyAim:true},{at:1.5,key:'q',rejectSword:true},...[10,35,65].map(at=>({at,key:'2',action:'spell'})),...[7,26,50,77].map(at=>({at,key:'Space',action:'dodge'})),...[12,22,32,42,52,62,72,82].map(at=>({at,key:'j',action:'attack'})),...[6,14,23,31,39,47,55,63,71,79].map(at=>({at,key:'Tab'}))].sort((a,b)=>a.at-b.at);
 let waypoint=0,held=null,nextStop=17,nextSample=0,nextLog=15,endedEarly=false,activeWallSeconds=0;
 const emptyAim=r=>{const p=r.scene.player,e=r.scene.enemies[0],dx=p.x-e.x,dy=p.y-e.y,base=Math.atan2(dy,dx);for(const offset of [0,.4,-.4,.8,-.8,1.4,-1.4,Math.PI]){const t={x:p.x+Math.cos(base+offset)*3,y:p.y+Math.sin(base+offset)*3};if(combatCanStand(t,FIELD)&&combatClearLine(p,t,FIELD))return t;}throw Error('no legal empty aiming point in the actual field');};
 const hold=async code=>{if(held===code)return;if(held)await page.keyboard.up(held);held=code;if(code)await page.keyboard.down(code);};
 await label('sustained-real-combat');await pause(false);const at=performance.now();await hold('a');
 while(performance.now()-at<sustainedSeconds*1000){
  const elapsed=(performance.now()-at)/1000,r=await read({presentation:!leanObserver});activeWallSeconds=elapsed;assert.deepEqual(r.status.errors,[]);assert.equal(r.status.persistence.protected,false,'save protection interrupted live combat');assert.deepEqual(r.status.pauseReasons,[],'a reading or pause gate interrupted live combat');
  if(r.scene?.status!=='active'){endedEarly=true;events.push({kind:'real-terminal',elapsed,tick:r.tick,status:r.scene?.status});break;}
  const target=waypoints[waypoint],position=r.scene.player;if((position[target.axis]-target[target.axis])*target.sign>=-.22){waypoint=waypoint===waypoints.length-1?1:waypoint+1;await hold(waypoints[waypoint].key);events.push({kind:'turn',elapsed,tick:r.tick,waypoint,position:point(position)});}
  if(elapsed>=nextStop){await hold(null);await sleep(220);const stopped=await read();assert.deepEqual(stopped.input.held,[]);events.push({kind:'real-keyup-stop',elapsed,tick:stopped.tick,player:point(stopped.scene.player)});await hold(waypoints[waypoint].key);nextStop+=17;}
  const due=scheduled.find(item=>!item.done&&elapsed>=item.at);
  if(due&&(due.key==='Tab'||due.rejectSword&&ready(r,'attack')||due.action&&ready(r,due.action))){
   due.done=true;if(due.action){if(due.enemyAim)await aimScreen(bodySample(leanObserver?await read():r,'torso').sample);else await aimWorld(emptyAim(r));}
   const beforeQi=r.scene.player.qi,input=await key(due.key),after=await read({presentation:!leanObserver});
   if(due.rejectSword){assert(/剑术|剑法|掌握/.test(input.notice));assert(!input.afterPending);assert(after.scene.player.qi>=beforeQi-.001);}
   else if(due.action)assert.equal(input.afterPending?.action,due.action,'scheduled native action refused: '+input.notice);
   else assert.equal(after.combat.selectedTargetId,after.scene.enemies[0].id);
   events.push({kind:'native-action',elapsed,tick:after.tick,key:due.key,action:due.action,expectedSwordRefusal:!!due.rejectSword,inputMs:input.durationMs,hp:after.scene.player.hp,enemyHp:after.scene.enemies[0].hp,qi:after.scene.player.qi});
  }
  if(elapsed>=nextSample){samples.push({elapsed,tick:r.tick,player:point(r.scene.player),enemy:point(r.scene.enemies[0]),hp:r.scene.player.hp,enemyHp:r.scene.enemies[0].hp,qi:r.scene.player.qi,held:r.input.held,status:r.scene.status});nextSample+=1;}
  if(elapsed>=nextLog){console.log('OBSERVED active '+elapsed.toFixed(1)+'s tick '+r.tick+' HP '+r.scene.player.hp+' enemy '+r.scene.enemies[0].hp);nextLog+=15;}
  await sleep(90);
 }
 if(!endedEarly)activeWallSeconds=(performance.now()-at)/1000;await hold(null);await pause(true);const final=await capture('sustained-final'),s=final.session.state,worldContinuity=sustainedWorldContinuity(original.state,s);assert(!s.personsById[MASTER].artsById.swordbasic&&!s.personsById[MASTER].artsById.sword);
 const trace=await page.evaluate(()=>({edges:window.__swordStudyQA.edges,inputs:window.__swordStudyQA.inputEvents,framesCapped:window.__swordStudyQA.frames.length>=window.__swordStudyQA.frameLimit,pumpsCapped:window.__swordStudyQA.pumps.length>=window.__swordStudyQA.pumpLimit})),inputStats=distribution(trace.edges.map(e=>e.durationMs)),inputByCode=Object.fromEntries([...new Set(trace.edges.map(e=>e.kind+':'+e.code))].map(code=>[code,distribution(trace.edges.filter(e=>e.kind+':'+e.code===code).map(e=>e.durationMs))]));
 const background=s.homeMemberIds.map(personId=>{const person=s.personsById[personId];return {personId,position:person.position,activityId:person.activityId,activity:s.activitiesById[person.activityId]};});
 const evidence={scope:'real native wall-clock combat; no invulnerability, enemy edits, world suspension or injected damage; most later casts aim at legal empty ground to retain the real opponent',requestedSeconds:sustainedSeconds,activeWallSeconds,endedEarly,initialTick:start.tick,finalTick:s.worldTick,actualTicks:s.worldTick-start.tick,initialPlayerHp:start.scene.player.hp,finalPlayerHp:s.combat?.player.hp,initialEnemyHp:start.scene.enemies[0].hp,finalEnemyHp:s.combat?.enemies[0].hp,status:s.combat?.status,events,samples,scheduled,trace,inputStats,inputByCode,background,worldContinuity};
 await fs.writeFile(path.join(output,'sustained-native-evidence.json'),json(evidence));assert.equal(trace.framesCapped,false);assert.equal(trace.pumpsCapped,false);
 if(!endedEarly){assert(s.worldTick-start.tick>=Math.floor(activeWallSeconds*10)-5,'the live background world did not keep advancing at its wall-clock rate');assert(samples.some(sample=>distance(sample.enemy,start.scene.enemies[0])>1),'the original hostile must actually move');assert(s.combat.enemies[0].hp<start.scene.enemies[0].hp,'the first aimed basic release must cause actual hostile damage');for(const action of ['attack','spell','dodge'])assert(events.some(e=>e.action===action));assert(events.some(e=>e.expectedSwordRefusal));}
 for(const [code,stats]of Object.entries(inputByCode))assert(stats.p95<=50,code+' input p95 exceeds 50ms: '+stats.p95);assert(inputStats.p95<=50,'sustained common input p95 exceeds 50ms: '+inputStats.p95);assert(inputStats.max<=100,'sustained common input exceeds 100ms: '+inputStats.max);record('sustained native live-combat observation',{requestedSeconds:sustainedSeconds,activeWallSeconds,endedEarly,initialTick:start.tick,finalTick:s.worldTick,status:s.combat?.status,inputStats,inputByCode,events:events.length});
}
function sustainedWorldContinuity(before,after){
 // long-sustained-01 remains failed: its old final-count assertion rejected a
 // real south-road seeker. Preserve the original population and audit each new
 // identity's actual world provenance rather than freezing world generation.
 const originalIds=Object.keys(before.personsById);assert.equal(originalIds.length,120);
 for(const id of originalIds){assert(after.personsById[id],'original person disappeared: '+id);for(const key of ['id','personId','name','appearance'])assert.deepEqual(after.personsById[id][key],before.personsById[id][key],'original identity changed: '+id+'/'+key);}
 const facts=Object.values(after.factsById),newIds=Object.keys(after.personsById).filter(id=>!before.personsById[id]),newPeople=newIds.map(id=>{
  const person=after.personsById[id],source=after.factsById[`fact:courtyard-seeker:${id}:source`],start=facts.find(f=>f.kind==='courtyard-seeker-event'&&f.personId===id&&f.event==='start'),arrival=facts.find(f=>f.kind==='courtyard-seeker-event'&&f.personId===id&&f.event==='arrived'&&f.visitNumber===start?.visitNumber);
  assert.equal(source?.kind,'courtyard-seeker-source');assert.equal(source.personId,id);assert.equal(source.version,person.courtyardSeekerSource);assert(source.atTick>before.worldTick&&source.atTick<=after.worldTick);assert.equal(source.atTick,person.lifeHistory.originTick);assert(Number.isSafeInteger(source.rngBefore)&&Number.isSafeInteger(source.rngAfter));assert(start&&arrival,'new person needs actual source/start/arrival facts: '+id);assert.equal(start.atTick,person.courtyardVisit.startedTick);assert.equal(arrival.atTick,person.courtyardVisit.arrivedTick);assert(arrival.atTick>=start.atTick&&arrival.atTick<=after.worldTick);return {id,name:person.name,source,start,arrival};
 });
 const background=before.homeMemberIds.map(id=>{assert(after.homeMemberIds.includes(id));const a=before.personsById[id],b=after.personsById[id],initial={position:a.position,activity:before.activitiesById[a.activityId],energy:a.energy,xp:a.xp},final={position:b.position,activity:after.activitiesById[b.activityId],energy:b.energy,xp:b.xp};assert.notDeepEqual(final,initial,'original background person did not advance: '+id);return {id,initial,final};});assert.equal(background.length,5);
 return {initialPersons:120,finalPersons:Object.keys(after.personsById).length,originalIdsPreserved:true,originalIdentitiesPreserved:true,newPeople,background};
}
function assertAudioCoverage(){const latest=audioEvidence.at(-1)?.status;assert(latest,'the renderer must expose actual sword-study audio status');assert.equal(latest.ready,true);assert.equal(latest.error,null);const required={head:['swordRelease','lightHit'],normal:['swordRelease','lightHit','heavyCharge','heavyImpact','dodge'],defeat:['enemySlam','playerHit'],retreat:['heavyCharge','groundStrike','dodge']}[scenario];for(const cue of required)assert(latest.cues[cue]>0,'missing native sound cue '+cue);assert.equal(Object.values(latest.cues).reduce((sum,n)=>sum+n,0),latest.played);assert.equal(new Set(latest.recentCues.map(c=>c.key)).size,latest.recentCues.length,'recent cue IDs must be unique');record('formal cue events reach native WebAudio',{required,status:latest});}

let observations=null;
function distribution(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),at=p=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];return {n:sorted.length,min:sorted[0]??null,p50:at(.5)??null,p95:at(.95)??null,max:sorted.at(-1)??null};}
try{
 lock=await fs.open(lockPath,'wx');await lock.writeFile(json({pid:process.pid,output,source,startedAt:new Date().toISOString()}));
 await launch();
 if(profileHelper){const {captureRestSwitchProfile}=await import(pathToFileURL(profileHelper).href);windowProfilePending=captureRestSwitchProfile(page,profileOutput).catch(error=>({status:'failed',error:error.stack||String(error)}));}
 await startRendererProfile();await runScenario();
 if(responseEvidence)await collectResponseProbe();
 if(windowProfilePending){windowProfileEvidence=await windowProfilePending;assert.equal(windowProfileEvidence.status,'captured-target-window',windowProfileEvidence.error);assert.equal(windowProfileEvidence.exactSingleTick,true,'window profile must include the exact target world step');assert(windowProfileEvidence.startAfter.tick<266160);}
 if(!movementProbe&&!longPerformance&&!startupProbe&&!resumeProbe&&!actionPixels&&!verticalDownPixels)assertAudioCoverage();await pause(true);await capture('complete');complete=true;phase='complete';
}catch(error){errors.push(error.stack||String(error));console.error(error.stack||String(error));process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});}}
finally{
 if(page&&responseEvidence&&!responseEvidence.rows){try{await pause(true);await collectResponseProbe();}catch(error){finalizationErrors.push(error.stack||String(error));}}
 if(page&&cpuSession){try{await pause(true);await stopRendererProfile();}catch(error){finalizationErrors.push(error.stack||String(error));}}
 if(page){try{await pause(true);await read();observations=await page.evaluate(()=>({...window.__swordStudyQA,saveTimings:window.courtyardQA.saveTimings()}));await fs.writeFile(path.join(output,'observations.json'),json(observations));for(let i=0;i<(observations?.captures?.length||0);i++){const item=observations.captures[i];await fs.writeFile(path.join(output,`contact-${String(i+1).padStart(2,'0')}.png`),Buffer.from(item.canvas.split(',')[1],'base64'));delete item.canvas;}await checkpoint('final-world');}catch(error){finalizationErrors.push(error.stack||String(error));}}
 try{await close();}catch(error){finalizationErrors.push(error.stack||String(error));}
 if(windowProfilePending&&!windowProfileEvidence)windowProfileEvidence=await windowProfilePending;
 const runtimeAfterFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json'],runtimeAfter=await runtimeHashes(runtimeAfterFiles),runtimeUnchanged=JSON.stringify(runtimeAfter)===JSON.stringify(runtimeBefore),sourceUnchanged=hash(await fs.readFile(source))===hash(sourceBytes);
 const runtimeChangedPaths=[...new Set([...runtimeFiles,...runtimeAfterFiles])].filter(file=>runtimeBefore[file]!==runtimeAfter[file]).map(file=>({file,classification:combatDependency(file)?'combat-dependency':'parallel-world-or-assets'})),combatRuntimeUnchanged=!runtimeChangedPaths.some(change=>change.classification==='combat-dependency');
 if(complete){const latest=audioEvidence.at(-1)?.status;try{assert.equal(observations.audioStarts.length,latest.played,'native AudioBufferSource starts must match the study cue ledger');assert(observations.audioStarts.every(voice=>voice.contextState==='running'));}catch(error){finalizationErrors.push(error.stack||String(error));}}
 const performanceEvidence=observations?{scope:'native renderer rAF callback intervals and JavaScript pump spans; active statistics exclude explicit paused boundaries; raw intervals and protocol spans retain those boundaries; not physical display FPS',viewport,actors:2,fieldMetres:{width:48,height:32},cameraViewMetres:22,rawRafIntervalMs:distribution(observations.frames.map(f=>f.rawIntervalMs)),activeRafIntervalMs:distribution(observations.frames.map(f=>f.activeIntervalMs)),activeCallbackIntervalMs:distribution(observations.frames.map(f=>f.activeCallbackIntervalMs)),rawCallbackIntervalMs:distribution(observations.frames.map(f=>f.rawCallbackIntervalMs)),focusEvents:observations.focusEvents||[],activeDrawJsMs:distribution(observations.frames.filter(f=>f.active).map(f=>f.drawJsMs)),qaObserverJsMs:distribution(observations.frames.filter(f=>f.active).map(f=>f.observerJsMs)),activeWorldPumpJsMs:distribution(observations.pumps.filter(p=>p.combat&&!p.paused&&p.status==='active'&&p.advancedTicks>0).map(p=>p.durationMs)),activeZeroTickPumpJsMs:distribution(observations.pumps.filter(p=>p.combat&&!p.paused&&p.status==='active'&&p.advancedTicks===0).map(p=>p.durationMs)),inputEvents:observations.inputEvents,protocolSpans:observations.protocolSpans,checkpointSpans:observations.checkpointSpans,edgeEvents:observations.edges||[],saveTimings:observations.saveTimings||null,longTaskScope:'all tasks after observation started, including pause, checkpoint and screenshot work; timestamps permit separate attribution',longTasks:observations.longTasks}:null;
 const latencyPeaks=observations?{thresholdMs:500,inputHandlers:observations.inputEvents.filter(e=>e.durationMs>=500),activeRaf:observations.frames.filter(f=>f.activeIntervalMs>=500),rawRaf:observations.frames.filter(f=>f.rawIntervalMs>=500),worldPump:observations.pumps.filter(p=>p.durationMs>=500)}:null;
 const report={instrumentation:{observer:leanObserver?'scalar-rAF-with-tick-and-edge-semantic-snapshots':'rich-per-rAF',cdpProfile,cpuProfileEvidence,responsePatch:responseEvidence,windowProfile:profileHelper?{helper:profileHelper,output:profileOutput,...windowProfileEvidence}:null},status:complete&&!errors.length&&!finalizationErrors.length&&nativeClosed&&sourceUnchanged&&combatRuntimeUnchanged?(movementProbe||longPerformance||startupProbe||resumeProbe||actionPixels||verticalDownPixels?'observed':'passed'):'failed',diagnostic:movementProbe||longPerformance||startupProbe||resumeProbe||actionPixels||verticalDownPixels,phase,scope:verticalDownPixels?'macOS native vertical tail and real lethal-hit three-stage down pixels':actionPixels?'macOS native actual four-direction movement, held-J windup/release/run and two facing hit pixels':responsePatch?'macOS native branch-timing diagnosis with an explicitly instrumented module response; not performance acceptance':profileHelper||cdpProfile?'macOS native CPU profile diagnosis only; profiling overhead retained; not performance acceptance':resumeProbe?'macOS native unfinished-stop pause/resume with actual active Canvas copies':sustainedPerformance?'macOS native long-save sustained live combat and common input timing; exact active duration and terminal status recorded':startupProbe?'macOS native startup, release, reversal, blur, pause and wall movement observation with actual active Canvas copies; no full smoothness acceptance':longPerformance?'macOS native long-save 40-target-tick input/performance observation; original background world runs; no terminal outcome chain or full smoothness acceptance':movementProbe?'macOS native movement diagnosis only; renderer keys and actual drawImage trace; no final motion acceptance':'macOS source Electron targeted initial conditions; formal native keyboard/mouse/button actions; screenshots and state; no save/reopen long chain',sourceContext,video:{status:'disabled'},sourceUnchanged,runtimeUnchanged,combatRuntimeUnchanged,runtimeChangedPaths,runtimeBefore,runtimeAfter,nativeClosed,initialTick:original.state.worldTick,finalTick:lastTick,wallSeconds:wall(),checks,actions,errors,finalizationErrors,audioEvidence,performanceEvidence,latencyPeaks,observations:observations?{audioStarts:observations.audioStarts,audioStops:observations.audioStops,hitCount:observations.hits.length,frameCount:observations.frames.length,stepCount:observations.steps.length}:null};
 await fs.writeFile(path.join(output,'report.json'),json(report));
 if(lock){await lock.close();if(nativeClosed)await fs.unlink(lockPath);}
 console.log(json({status:report.status,report:path.join(output,'report.json')}));if(!['passed','observed'].includes(report.status))process.exitCode=1;
}
