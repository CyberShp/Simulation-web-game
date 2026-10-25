/** Root-operated, screenshot/state-only native QA. No recorder is created.
 * --stage=preflight|run --mode=solo|party|resume|group-fixture
 * --source=/absolute/paused-native.json --output=/absolute/new-directory
 * --companions=person:lu-zhiwei[,person:...] chooses existing willing people.
 * solo/party use the real gate, preparation dialog, travel and forest approach.
 * group-fixture requires an already engaged supplied source and records its
 * component scope separately from normal growth and departure evidence.
 * resume requires --resume-report=/absolute/report.json and a checkpoint
 * actually saved by that native run. Its inherited departure scope is retained.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect,viewSect} from '../../apps/courtyard/sect-sim.mjs';

const option=key=>process.argv.find(value=>value.startsWith(`--${key}=`))?.slice(key.length+3);
const stage=option('stage')||'preflight',mode=option('mode')||'party',source=option('source'),output=option('output'),resumeReport=option('resume-report');
const requestedIds=(option('companions')||'').split(',').filter(Boolean),json=value=>JSON.stringify(value,null,2)+'\n',hash=value=>createHash('sha256').update(value).digest('hex');
assert(['preflight','run'].includes(stage),'unknown stage');assert(['solo','party','resume','group-fixture'].includes(mode),'unknown mode');
assert(source&&path.isAbsolute(source),'absolute --source is required');assert(output&&path.isAbsolute(output),'absolute --output is required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'QA output must be outside the repository');
assert(!process.argv.includes('--video'),'this harness only captures screenshots and state');
await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
let sourceBytes,original,initial,initialView,available,companionIds,resumeContext=null;
const canonicalMaster=s=>s.personsById['person:master'],position=p=>p.position||p.location;
try{
 sourceBytes=await fs.readFile(source);await fs.writeFile(path.join(output,'source.json'),sourceBytes);original=JSON.parse(sourceBytes);initial=restoreSect(original);initialView=viewSect(initial);
 assert.equal(validateSect(initial),true);assert.deepEqual(initial.state,original.state,'canonical source restore must preserve the complete world');
 assert.equal(initial.state.speed,0,'paused source required');assert.equal(original.courtyardPresentation?.manualPause,true,'native source must retain a manual pause');
 available=initialView.expedition.world?.party?.candidates?.filter(person=>person.available)||[];
 companionIds=mode==='party'?(requestedIds.length?requestedIds:[available[0]?.personId].filter(Boolean)):[];
 if(mode==='resume'){
  assert(resumeReport&&path.isAbsolute(resumeReport),'resume requires an absolute --resume-report');
  const prior=JSON.parse(await fs.readFile(resumeReport)),priorDirectory=path.dirname(resumeReport);
  for(const flag of ['sourceUnchanged','runtimeUnchanged','nativeClosed','nativeExact'])assert.equal(prior[flag],true,`resume provenance requires ${flag}`);
  assert.equal(path.dirname(path.resolve(source)),path.resolve(priorDirectory),'resume source must be a native checkpoint in the recorded run');
  let checkpoint=prior.nativeCheckpoints?.find(c=>c.file===path.basename(source)&&c.sha256===hash(sourceBytes)&&c.tick===initial.state.worldTick);
  // The first native party harness saved this checkpoint before it acquired a
  // checkpoint index. Its close/reopen check still attests the exact saved tick.
  if(!checkpoint&&path.basename(source)==='party-travel-closed-native.json'&&prior.checks?.some(c=>c.ok&&c.name==='party-travel'&&c.tick===initial.state.worldTick)){
   const before=await fs.readFile(path.join(priorDirectory,'party-travel-before-native.json'));assert.equal(hash(sourceBytes),hash(before),'legacy native close/reopen checkpoint bytes differ');
   assert(initial.state.srWorld.activeTravelId,'legacy resume checkpoint must retain its real outbound travel');checkpoint={file:path.basename(source),sha256:hash(sourceBytes),tick:initial.state.worldTick,attestation:'native close/reopen in the originating report'};
  }
  assert(checkpoint,'resume source is not an indexed, actually saved native checkpoint');
  const travel=initial.state.travelsById[initial.state.srWorld.activeTravelId];
  assert(initial.state.combat?.status==='active'||travel,'resume needs an active battle or an existing outbound party travel');
  companionIds=initial.state.combat?initial.state.combat.allies.map(a=>a.personId):(travel.participantIds||[]).filter(id=>id!=='person:master');
  assert.deepEqual(companionIds,prior.sourceContext.companionIds,'resume must retain the original party identities');
  resumeContext={report:resumeReport,reportSha256:hash(await fs.readFile(resumeReport)),checkpoint,sourceContext:prior.sourceContext};
 }else if(mode==='group-fixture'){
  assert.equal(initial.state.combat?.status,'active','a supplied engaged group source is required');
  assert(initial.state.combat.allies.length>=1&&initial.state.combat.enemies.length>=2,'group component source must contain an ally and multiple enemies');
  companionIds=initial.state.combat.allies.map(a=>a.personId);
 }else{
  assert.equal(position(canonicalMaster(initial.state)).sceneId,'scene:yunxiu-courtyard','normal departure source must be in the courtyard');
  assert(!initial.state.combat,'normal departure source must not already be in combat');
  if(mode==='party'){assert(companionIds.length>=1&&companionIds.length<=2,'one or two existing companions are required');for(const id of companionIds)assert(available.some(person=>person.personId===id),`source has no currently willing candidate ${id}`);}
 }
}catch(error){
 await fs.writeFile(path.join(output,'report.json'),json({status:'preflight-failed',scope:'source and prerequisites only; Electron not launched',sourceContext:{source,sha256:sourceBytes?hash(sourceBytes):null,tick:initial?.state.worldTick??original?.state?.worldTick??null,mode,requestedIds,available:available||[],party:initialView?.expedition.world?.party||null},video:{status:'disabled'},errors:[error.stack||String(error)]}));
 console.error(error.stack||String(error));process.exit(1);
}
const sourceContext={source,sha256:hash(sourceBytes),tick:initial.state.worldTick,mode,companionIds,resume:resumeContext,sourceCombatParticipants:initial.state.combat?{sessionId:initial.state.combat.sessionId,allies:initial.state.combat.allies.map(a=>({id:a.id,personId:a.personId})),enemies:initial.state.combat.enemies.map(a=>({id:a.id,personId:a.personId}))}:null,provenance:original.source||null,scope:mode==='resume'?'continuation of an attested native checkpoint; prior departure evidence is linked by report':mode==='group-fixture'?'supplied pre-engaged group component; no normal growth, route discovery or departure proof':'existing source followed through public courtyard departure and forest controls',master:{personId:'person:master',realm:canonicalMaster(initial.state).realm,position:position(canonicalMaster(initial.state))},party:initialView.expedition.world?.party};
if(stage==='preflight'){await fs.writeFile(path.join(output,'report.json'),json({status:'preflight',scope:'read-only source validation; no Electron or world advancement',sourceContext,video:{status:'disabled'}}));console.log(json({status:'preflight',report:path.join(output,'report.json')}));process.exit(0);}

// A stale lock is retained after an unsuccessful native close for root review.
const lockPath=path.join(os.tmpdir(),'immortal-native-combat-party-qa.lock');let lock=null;
const directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');
async function filesUnder(relative){return(await Promise.all((await fs.readdir(path.join(repositoryRoot,relative),{withFileTypes:true})).map(entry=>entry.isDirectory()?filesUnder(relative+'/'+entry.name):relative+'/'+entry.name))).flat();}
let runtimeFiles,runtimeBefore;
const runtimeHashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async file=>[file,hash(await fs.readFile(path.join(repositoryRoot,file)))])));
try{await fs.mkdir(directory);await fs.writeFile(native,sourceBytes);runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json'];runtimeBefore=await runtimeHashes();}
catch(error){await fs.writeFile(path.join(output,'report.json'),json({status:'setup-failed',scope:'independent QA storage and runtime inventory; Electron not launched',sourceContext,video:{status:'disabled'},errors:[error.stack||String(error)]}));console.error(error.stack||String(error));process.exit(1);}
const checks=[],actions=[],nativeCheckpoints=[],errors=[],finalizationErrors=[],started=performance.now();
const wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let electron=null,page=null,windowId=null,nativeClosed=true,phase='launch',complete=false,last=null,trace=null,travelId=null;
const record=(name,details={})=>{checks.push({name,ok:true,wallSeconds:wall(),...details});console.log('PASS '+name);};
let fullReadId=0;
const read=async()=>{const id=++fullReadId,value=await page.evaluate(id=>{const q=window.courtyardQA,c=q.expedition.canvas,at=performance.now(),paused=q.renderer.view.paused,session=q.snapshot(),snapshotMs=performance.now()-at,viewAt=performance.now(),view=q.view(),viewMs=performance.now()-viewAt,result={session,view,status:q.status(),errors:q.metrics().errors,input:q.expedition.inputState(),presentation:q.expedition.presentationState(),route:q.route(),notice:document.getElementById('notice')?.textContent||'',viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,canvas:{width:c.clientWidth,height:c.clientHeight,backingWidth:c.width,backingHeight:c.height}}};window.__combatPartyQA?.observations.push({id,kind:'full-world-read',at,end:performance.now(),javascriptEnd:performance.now(),paused,combat:q.renderer.view.expedition.scene?.type==='combat',observed:window.__combatPartyQA?.enabled,snapshotMs,viewMs});return result;},id);await page.evaluate(id=>{const record=window.__combatPartyQA?.observations.findLast(o=>o.kind==='full-world-read'&&o.id===id);if(record){record.end=performance.now();record.includesProtocolReturn=true;}},id);return value;};
async function click(selector){await page.locator(selector).click();actions.push({kind:'click',selector,wallSeconds:wall()});}
async function pause(paused){if(await page.evaluate(()=>window.courtyardQA.status().manualPause)!==paused){await page.evaluate(()=>window.__combatPartyQA?.breakSegment('public pause transition'));await click('#pause');}assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),paused);}
async function until(predicate,label,seconds=30){const at=performance.now();while(performance.now()-at<seconds*1000){const value=await read();last=value;assert.deepEqual(value.errors,[]);if(predicate(value))return value;await sleep(35);}throw Error(`Timed out ${label} at tick ${last?.session.state.worldTick}`);}
async function runUntil(predicate,label,seconds=30){await pause(false);await until(predicate,label,seconds);await pause(true);return read();}
async function capture(name){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await sleep(300);
 const value=await read();last=value;assert.equal(value.view.paused,true,'full screenshots require an explicit paused/read-only world');await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.json'),json(value));await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());return value;
}
async function focusInput(){await electron.evaluate(({app,BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);app.focus({steal:true});w.focus();w.webContents.focus();},windowId);await page.locator('#expedition-canvas').focus();assert(await page.evaluate(()=>document.hasFocus()&&window.courtyardQA.expedition.inputState().hostActive),'native combat focus required');}
async function launch(){
 const {_electron}=await import('playwright'),target=desktopTarget(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const observation={kind:'native-launch',wallSeconds:wall(),events:[],stderr:'',process:null,initialReady:null,reloadedReady:null};actions.push(observation);
 const app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});electron=app;nativeClosed=false;
 const nativeProcess=app.process();observation.process={pid:nativeProcess?.pid??null,exitCode:nativeProcess?.exitCode??null,signalCode:nativeProcess?.signalCode??null};
 nativeProcess?.stderr?.on('data',bytes=>{observation.stderr=(observation.stderr+String(bytes)).slice(-16000);});
 nativeProcess?.once('exit',(exitCode,signalCode)=>{Object.assign(observation.process,{exitCode,signalCode});observation.events.push({kind:'process-exit',wallSeconds:wall(),exitCode,signalCode});});
 app.once('close',()=>{nativeClosed=true;observation.events.push({kind:'application-close',wallSeconds:wall()});});
 const selectedPage=await app.firstWindow();page=selectedPage;page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.stack||String(error)));
 page.on('framenavigated',frame=>{if(frame===selectedPage.mainFrame())observation.events.push({kind:'main-navigation',wallSeconds:wall(),url:frame.url()});});
 page.once('close',()=>observation.events.push({kind:'page-close',wallSeconds:wall()}));page.once('crash',()=>observation.events.push({kind:'page-crash',wallSeconds:wall()}));
 // BrowserWindow creation precedes host.loadURL(). firstWindow() can therefore
 // return about:blank; reloading it would abort the host's initial navigation.
 const courtyardURL=url=>url.protocol==='http:'&&url.hostname==='127.0.0.1'&&['/','/courtyard.html'].includes(url.pathname);
 await page.waitForURL(courtyardURL,{waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>window.courtyardQA?.status().ready&&document.getElementById('loading')?.hidden,null,{timeout:60000});
 assert(!page.isClosed(),'the initial courtyard window closed before instrumentation');
 windowId=await(await app.browserWindow(page)).evaluate(w=>w.id);
 const initialURL=page.url(),host=await app.evaluate(({app,BrowserWindow},id)=>{const window=BrowserWindow.fromId(id);return {userData:app.getPath('userData'),window:window&&!window.isDestroyed()?{id:window.id,url:window.webContents.getURL()}:null};},windowId);
 assert.equal(host.userData,path.join(directory,'electron-profile'),'the native window must use this run\'s independent QA profile');assert.equal(host.window?.url,initialURL,'the selected BrowserWindow must own the loaded courtyard page');
 observation.initialReady={windowId,url:initialURL,userData:host.userData,tick:(await read()).session.state.worldTick};
 await page.addInitScript(()=>{
  const qa=window.__combatPartyQA={enabled:false,startTick:Infinity,frames:[],draws:[],steps:[],pumps:[],longTasks:[],observations:[],boundaries:[],inputEvents:[],hits:[],captures:[],motionCaptures:[],spellActionId:null,actions:{},projectiles:{},seen:new Set(),capped:false,segment:0,lastActive:false},raf=requestAnimationFrame.bind(window),interval=setInterval.bind(window);
  qa.breakSegment=reason=>{qa.lastActive=false;qa.boundaries.push({at:performance.now(),reason});};
  window.setInterval=(callback,delay,...args)=>interval(typeof callback==='function'&&callback.name==='pump'?function(...values){const at=performance.now(),before=window.courtyardQA?.renderer.view;try{return callback(...values);}finally{const after=window.courtyardQA?.renderer.view,end=performance.now();if(qa.enabled&&qa.pumps.length<6000)qa.pumps.push({at,end,durationMs:end-at,beforeTick:before?.tick,afterTick:after?.tick,paused:before?.paused,advancedTicks:(after?.tick??0)-(before?.tick??0)});}}:callback,delay,...args);
  qa.recordLongTasks=entries=>{for(const task of entries)if(task.startTime>=qa.observationStart&&task.startTime<(qa.observationEnd??Infinity)&&qa.longTasks.length<1000)qa.longTasks.push({at:task.startTime,end:task.startTime+task.duration,durationMs:task.duration,name:task.name});};
  try{qa.longTaskObserver=new PerformanceObserver(list=>qa.recordLongTasks(list.getEntries()));qa.longTaskObserver.observe({type:'longtask',buffered:true});qa.longTasksSupported=true;}catch{qa.longTasksSupported=false;}
  window.requestAnimationFrame=callback=>raf(at=>{const before=performance.now();callback(at);const after=performance.now();if(!qa.enabled||callback.name!=='frame')return;const scene=window.courtyardQA?.renderer.view.expedition?.scene;if(scene?.type!=='combat')return;
   const view=window.courtyardQA.renderer.view,active=!view.paused&&scene.status==='active';if(active&&!qa.lastActive)qa.segment++;qa.lastActive=active;
   const draw={at,startedAt:before,endedAt:after,drawJsMs:after-before,tick:scene.tick,status:scene.status,paused:view.paused,active,segment:qa.segment,selectedTargetId:scene.selectedTargetId,actors:1+scene.allies.length+scene.enemies.length,alive:1+scene.allies.filter(a=>a.hp>0).length+scene.enemies.filter(a=>a.hp>0).length};if(qa.draws.length<60000)qa.draws.push(draw);else qa.capped=true;
   if(qa.frames.at(-1)?.at!==at&&qa.frames.length<30000)qa.frames.push(draw);
   const controls=view.expedition.combat,pending=controls?.pending;if(pending)qa.actions[pending.id]=structuredClone(pending);
   if(qa.steps.at(-1)?.tick!==scene.tick&&qa.steps.length<2000)qa.steps.push({at,tick:scene.tick,active,player:{x:scene.player.x,y:scene.player.y,qi:scene.player.qi,guard:scene.player.guard,evade:scene.player.evade,motion:structuredClone(scene.player.motion),dodgePath:structuredClone(scene.player.dodgePath)},pending:structuredClone(pending),controls:structuredClone(controls?.controls),held:window.courtyardQA.expedition.inputState().held});
   for(const projectile of scene.projectiles||[])qa.projectiles[projectile.id]=structuredClone(projectile);
   const spell=qa.actions[qa.spellActionId],m=scene.player.motion,phase=spell&&m?.actionId===spell.id?m.phase:null,label=phase==='windup'?'spell-windup':phase==='release'?'spell-release':spell?.executedTick<scene.tick&&Math.hypot(scene.player.x-qa.spellStart.x,scene.player.y-qa.spellStart.y)>.001&&m?.moveIntent?.x?'spell-moving':m?.action==='dodge'&&['release','evade'].includes(m.phase)?'dodge':null;
   if(label&&!qa.motionCaptures.some(c=>c.label===label)){const start=performance.now();qa.motionCaptures.push({label,tick:scene.tick,player:structuredClone(scene.player),canvas:window.courtyardQA.expedition.canvas.toDataURL()});qa.observations.push({kind:'discrete-motion-canvas',at:start,end:performance.now(),paused:view.paused});}
   for(const hit of scene.effects||[])if(hit.kind==='hit'&&hit.tick>qa.startTick&&!qa.seen.has(hit.eventId||hit.id)){qa.seen.add(hit.eventId||hit.id);qa.hits.push(structuredClone(hit));const kind=String(hit.sourceId)+'-'+String(hit.targetId)+'-'+hit.outcome;if(hit.tick===scene.tick&&hit.amount>0&&qa.captures.length<8&&!qa.captures.some(c=>c.kind===kind)){const start=performance.now();qa.captures.push({kind,tick:scene.tick,event:structuredClone(hit),presentation:window.courtyardQA.expedition.presentationState(),canvas:window.courtyardQA.expedition.canvas.toDataURL()});qa.observations.push({kind:'contact-canvas-export',at:start,end:performance.now(),paused:view.paused});}}
   draw.observerJsMs=performance.now()-after;
  });
 });
 // Install once, then reload once after the host's own load has completed.
 // A close, crash or navigation failure is reported; no launch retry is used.
 await page.reload({waitUntil:'load',timeout:60000});await page.waitForURL(initialURL,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>window.__combatPartyQA&&window.courtyardQA?.status().ready&&document.getElementById('loading')?.hidden,null,{timeout:60000});await app.evaluate(({BrowserWindow},id)=>{const window=BrowserWindow.fromId(id);if(!window||window.isDestroyed())throw Error('The selected courtyard BrowserWindow closed during instrumentation');window.setContentSize(1672,941);},windowId);
 await page.evaluate(()=>{const before=new WeakMap(),sample=()=>{const v=window.courtyardQA.renderer.view,c=v.expedition.combat;return {tick:v.tick,paused:v.paused,pending:structuredClone(c?.pending),buffered:structuredClone(c?.buffered),player:v.expedition.scene?.player?{x:v.expedition.scene.player.x,y:v.expedition.scene.player.y}:null};};addEventListener('keydown',event=>{if(['Digit2','Digit3','Space','KeyW','KeyA','KeyS','KeyD','Escape'].includes(event.code))before.set(event,sample());},true);addEventListener('keydown',event=>{const prior=before.get(event);if(prior&&window.__combatPartyQA.inputEvents.length<2000)window.__combatPartyQA.inputEvents.push({code:event.code,at:performance.now(),before:prior,after:sample()});});});
 const value=await read();observation.reloadedReady={windowId,url:page.url(),tick:value.session.state.worldTick};assert.equal(value.status.manualPause,true);assert.deepEqual(value.errors,[]);return value;
}
async function close(){
 if(!electron)return;const app=electron,nativeProcess=app.process();if(nativeClosed||nativeProcess&&(nativeProcess.exitCode!==null||nativeProcess.signalCode!==null)){nativeClosed=true;electron=null;page=null;return;}const closed=app.waitForEvent('close',{timeout:30000}).then(()=>({ok:true}),error=>({ok:false,error}));let commandError=null;try{await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.close(),windowId);}catch(error){commandError=error;}const result=await closed;if(!result.ok)throw commandError?new AggregateError([commandError,result.error],'native close failed'):result.error;nativeClosed=true;electron=null;page=null;
}
async function saveExact(name){
 await pause(true);
 // Saving notifies the UI and synchronizes pause/input before taking its
 // snapshot. Enter the same public pause boundary before observing that world.
 if(await page.evaluate(()=>window.courtyardQA.renderer.view.expedition.scene?.interactive===true)){
  await focusInput();await page.keyboard.press('Escape');actions.push({kind:'key',key:'Escape',purpose:'explicit combat pause before save observation',wallSeconds:wall()});assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true);
 }
 const value=await capture(name);await click('#save');let exact=false;for(let i=0;i<100;i++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(value.session.state)){exact=true;break;}await sleep(50);}assert(exact,'native save must contain the observed complete world');const bytes=await fs.readFile(native),file=name+'-native.json';assert.equal(JSON.parse(bytes).courtyardPresentation.manualPause,true);await fs.writeFile(path.join(output,file),bytes);nativeCheckpoints.push({file,sha256:hash(bytes),tick:value.session.state.worldTick,combatStatus:value.session.state.combat?.status||null,sessionId:value.session.state.combat?.sessionId||null,phase,via:'public #save; complete state equals the paused native observation'});return value;
}
async function reopen(name){const before=await saveExact(name+'-before');await close();await fs.copyFile(native,path.join(output,name+'-closed-native.json'));await launch();const after=await capture(name+'-reopened');assert.deepEqual(after.session.state,before.session.state);assert.equal(after.status.manualPause,true);record('native party save close reopen',{checkpointName:name,tick:after.session.state.worldTick});}
const atGate=r=>{const exit=r.view.expedition.world.exits.find(e=>e.id==='exit:yunxiu-valley');return exit?.near&&!r.session.state.srWorld.interaction&&!canonicalMaster(r.session.state).scenic.path.length;};
const readGate=()=>page.evaluate(()=>{const q=window.courtyardQA,v=q.renderer.view,m=v.people.find(p=>p.id==='person:master');return {tick:v.tick,paused:v.paused,control:v.control,position:m?{x:m.x,y:m.y}:null,pathLength:m?.path?.length||0,pathGoal:m?.path?.at(-1)||null,activity:m?.activityDetail||null,exit:v.expedition.world.exits.find(e=>e.id==='exit:yunxiu-valley'),route:q.route(),notice:document.getElementById('notice')?.textContent||'',errors:q.metrics().errors};});
async function walkToGate(){
 await click('#expedition-open');
 if(await page.locator('[data-ui-key="confirm-action"]').isVisible()){await capture('gate-cancel-confirmation');await click('[data-ui-key="confirm-action"]');}
 const requested=await read();await fs.writeFile(path.join(output,'gate-requested.json'),json(requested));
 assert.equal(requested.session.control.mode,'manual','the public move must take control');assert.equal(requested.session.automation.activeAction,'manual-walk','the public gate walk was refused: '+requested.notice);assert(requested.route.active||requested.route.remaining,'the public gate walk did not create route waypoints: '+requested.notice);
 await pause(false);const observations=[],started=performance.now();let previous=await readGate(),progressTick=previous.tick,progressAt=performance.now(),failure=null;
 try{while(true){const current=await readGate();assert.deepEqual(current.errors,[]);const moved=current.position&&previous.position?Math.hypot(current.position.x-previous.position.x,current.position.y-previous.position.y):0,routeChanged=current.route.steps!==previous.route.steps||current.route.remaining!==previous.route.remaining;
   if(moved>.0001||routeChanged){progressTick=current.tick;progressAt=performance.now();}
   if(moved>.05||routeChanged||current.tick!==previous.tick&&current.tick%10===0||current.activity?.id!==previous.activity?.id)observations.push(current);
   if(current.exit?.near&&!current.pathLength&&!current.route.remaining)break;
   assert(!current.route.failure,'gate route failed: '+current.route.failure);
   assert(!current.paused,'gate walk unexpectedly paused: '+current.notice);
   assert(current.pathLength||current.route.active||current.route.remaining,'gate route ended before arrival: '+current.notice);
   assert(!current.activity||current.activity.kind==='facility'&&current.control.mode==='manual','another body activity replaced the gate walk: '+current.activity?.reason);
   assert(current.tick-progressTick<=50&&performance.now()-progressAt<15000,'gate walk made no physical or waypoint progress: '+current.notice);
   assert(performance.now()-started<180000,'gate walk exceeded its bounded observation period');previous=current;await sleep(30);
  }
 }catch(error){failure=error.stack||String(error);throw error;}
 finally{await fs.writeFile(path.join(output,'gate-progress.json'),json({scope:'read-only native positions and public route waypoints; no world injection',observations,failure}));}
 await pause(true);const arrived=await read();assert(atGate(arrived),'formal world and native route must agree on gate arrival');record('public gate waypoints retain control through actual arrival',{tick:arrived.session.state.worldTick,control:arrived.session.control,route:arrived.route});
}
async function departureChecks(){
 phase='gate';if(!atGate(await read()))await walkToGate();await capture('gate-arrived');
 await click('#expedition-open');assert.equal(await page.locator('#expedition-departure').evaluate(d=>d.open),true);let value=await read();assert.equal(value.status.manualPause,true);assert(value.status.pauseReasons.includes('出行准备'));await sleep(350);assert.deepEqual((await read()).session.state,value.session.state);await click('#expedition-depart-cancel');let closed=await read();assert.equal(closed.status.manualPause,true);assert.equal(closed.view.paused,true);assert.equal(closed.session.state.worldTick,value.session.state.worldTick);record('departure dialog preserves an existing manual pause');
 await pause(false);await click('#expedition-open');value=await read();assert.equal(value.status.manualPause,false);assert.equal(value.view.paused,true);assert(value.status.pauseReasons.includes('出行准备'));await sleep(350);assert.deepEqual((await read()).session.state,value.session.state);await click('#expedition-depart-cancel');closed=await read();assert.equal(closed.status.manualPause,false);assert.equal(closed.view.paused,false);await until(r=>r.session.state.worldTick>value.session.state.worldTick,'resume after departure reading',2);await pause(true);record('departure dialog resumes the prior running world without changing manual pause');
 await click('#expedition-open');value=await read();const current=value.view.expedition.world.party;
 for(const id of companionIds){const candidate=current.candidates.find(p=>p.personId===id);assert(candidate?.available,`${candidate?.name||id} no longer willing at the actual gate: ${candidate?.reason||'not present'}`);await page.locator(`[data-companion-id="${id}"]`).check();}
 assert.deepEqual((await read()).session.state,value.session.state,'choosing candidates must not invite, move or consume resources');await capture('departure-selected');await click('#expedition-depart-confirm');
 const departed=await read(),travel=departed.session.state.travelsById[departed.session.state.srWorld.activeTravelId];assert(travel,'public exit command must register a real travel');travelId=travel.id;assert.deepEqual(travel.participantIds,['person:master',...companionIds]);assert.equal(departed.status.manualPause,true);assert.equal(departed.view.paused,true);assert.equal(departed.session.state.worldTick,value.session.state.worldTick);record('public departure records the chosen stable party',{travelId,participantIds:travel.participantIds,originPositions:travel.originPositions});await reopen('party-travel');
 await outboundChecks();
}
async function outboundChecks(){
 travelId=(await read()).session.state.srWorld.activeTravelId||travelId;
 phase='outbound';await runUntil(r=>!r.session.state.srWorld.activeTravelId&&position(canonicalMaster(r.session.state)).sceneId==='scene:valley','real valley arrival',120);const arrived=await capture('valley-arrived');for(const id of companionIds)assert.equal(position(arrived.session.state.personsById[id]).sceneId,'scene:valley');assert.deepEqual(arrived.view.expedition.world.party.companionIds,companionIds);record('same party physically arrives in the valley',{travelId,companionIds});
 await click('#expedition-approach');await runUntil(r=>!r.session.state.srWorld.interaction,'real party walk to forest encounter',120);await capture('forest-approach');await click('#expedition-engage');const engaged=await saveExact('engaged-paused');assert.equal(engaged.session.state.combat.status,'active');assert.deepEqual(engaged.session.state.combat.allies.map(a=>a.personId),companionIds);record('public encounter projects the same arrived companions',{sessionId:engaged.session.state.combat.sessionId,companionIds});
}
// Active combat reads its already built projection. Full-world snapshots and
// screenshots are taken only after an explicit pause, outside action windows.
// Error polling uses status(), whose detached error copy does not build a view.
const readCombat=()=>page.evaluate(()=>{const at=performance.now(),q=window.courtyardQA,v=q.renderer.view,b=v.expedition.scene,c=v.expedition.combat,qa=window.__combatPartyQA;const result={tick:v.tick,paused:v.paused,status:b?.status||null,sessionId:b?.sessionId,player:b?.player,enemies:b?.enemies,allies:b?.allies,bounds:b?.arena?.bounds,selectedTargetId:b?.selectedTargetId,pending:c?.pending,buffered:c?.buffered,manualActions:c?.manualActions||[],autoAttack:c?.controls.autoAttack,move:c?.controls.move,tactic:c?.tactic,input:q.expedition.inputState(),inputEvents:qa.inputEvents.slice(-12),observedActions:Object.values(qa.actions),observedProjectiles:Object.values(qa.projectiles),steps:qa.steps.slice(-40),hits:qa.hits,notice:document.getElementById('notice')?.textContent||'',errors:q.status().errors};if(qa.observations.length<6000)qa.observations.push({kind:'combat-status-read',at,end:performance.now(),paused:v.paused,combat:b?.type==='combat',observed:qa.enabled});else qa.capped=true;return result;});
const actionReady=(r,id)=>!r.pending&&!r.buffered&&r.manualActions.some(a=>a.id===id&&!a.disabled&&!a.bufferable);
function qaTarget(r){return r.enemies.find(e=>e.id===r.selectedTargetId&&e.hp>0)||r.enemies.find(e=>e.hp>0);}
function qaApproach(r){const enemy=qaTarget(r),range=r.manualActions.find(a=>a.id==='attack')?.range;assert(enemy&&range>0,'live target and official melee range required');const dx=enemy.x-r.player.x,dy=enemy.y-r.player.y,distance=Math.hypot(dx,dy);return {enemy,range,distance,key:distance<=range-.06?null:Math.abs(dx)>=Math.abs(dy)?dx>0?'KeyD':'KeyA':dy>0?'KeyS':'KeyW'};}
function qaSpellProof(steps,action,start){
 const during=steps.filter(s=>s.pending?.id===action.id&&!s.pending.executed&&s.tick>action.startedTick),release=steps.find(s=>s.tick===action.executedTick&&s.player.motion?.phase==='release'),moving=steps.find(s=>s.tick>action.executedTick&&Math.hypot(s.player.x-start.x,s.player.y-start.y)>.001&&Math.hypot(s.player.motion?.moveIntent?.x||0,s.player.motion?.moveIntent?.y||0)>0);
 return {windup:during.length>0&&during.some(s=>s.held.length>0)&&during.every(s=>Math.hypot(s.player.x-start.x,s.player.y-start.y)<1e-8),release:!!release,moving:!!moving,firstMoveTick:moving?.tick};
}
function qaDodgeEvidence(value,input){
 const accepted=input.after.pending?.action==='dodge'?input.after.pending:null,requestedTick=accepted?.startedTick??input.before.tick;
 const action=value.observedActions.find(a=>a.action==='dodge'&&a.executed&&(accepted?a.id===accepted.id:a.startedTick>=requestedTick));
 // A pump may finish the entire short step between browser frames. Preserve
 // an already observed path after its two-world-step presentation lifetime.
 const paths=[{path:value.player.dodgePath||value.player.motion?.dodgePath,source:'current-projection'},...value.steps.map(step=>({path:step.player.dodgePath||step.player.motion?.dodgePath,source:'observed-world-step',observedTick:step.tick}))];
 const found=paths.find(item=>item.path?.startedTick>requestedTick&&(!action||item.path.startedTick===action.executedTick));
 return found?{...found,action,acceptedId:accepted?.id??null,requestedTick}:null;
}
async function untilCombat(predicate,label,seconds=10){const at=performance.now();while(true){const value=await readCombat();assert.deepEqual(value.errors,[]);assert(value.status,'combat projection disappeared before result acknowledgement');if(value.status!=='active'||predicate(value))return value;assert(performance.now()-at<seconds*1000,`${label}: no progress at tick ${value.tick}; ${value.notice}`);await sleep(25);}}
async function aimEnemy(enemy){const screen=await page.evaluate(p=>window.courtyardQA.expedition.worldToScreen(p.x,p.y),enemy),box=await page.locator('#expedition-canvas').boundingBox();await page.mouse.move(box.x+screen.x,box.y+screen.y);}
async function manualAction(id,key){
 let current=await readCombat();if(current.status!=='active')return false;
 if(!actionReady(current,id)){await pause(false);current=await untilCombat(r=>actionReady(r,id),`manual ${id} readiness`);await pause(true);if(current.status!=='active')return false;}
 await focusInput();current=await readCombat();if(current.status!=='active')return false;assert(actionReady(current,id),`${id} not ready: ${current.notice}`);
 const enemy=current.enemies.find(e=>e.id===current.selectedTargetId&&e.hp>0)||current.enemies.find(e=>e.hp>0);if(id==='spell'){assert(enemy,'manual spell requires a living aim point');await aimEnemy(enemy);}
 await page.keyboard.press(key);const planned=await readCombat();actions.push({kind:'key',key,action:id,tick:planned.tick,wallSeconds:wall()});
 assert.equal(planned.pending?.action,id,`native ${key} did not plan ${id}: ${planned.notice}`);assert(!planned.pending.automatic,`${id} must be a manual request`);const actionId=planned.pending.id;
 await pause(false);const acted=await untilCombat(r=>r.observedActions.some(a=>a.id===actionId&&a.executed),`manual ${id} release`);await pause(true);
 const executed=acted.observedActions.find(a=>a.id===actionId&&a.executed);if(!executed)return false;assert(!executed.failure,`${id} execution failed: ${executed.failure}`);
 const evidence=await capture('manual-'+id+'-executed');
 if(id==='guard')assert(evidence.session.state.combat.player.guard>0||evidence.session.state.combat.effects.some(e=>e.kind==='guard'&&e.tick>=executed.executedTick),'guard must actually activate');
 else assert(acted.observedProjectiles.some(p=>p.actionId===actionId)||acted.hits.some(e=>e.actionId===actionId),'manual spell must actually launch or contact');
 record('native '+key+' performs a real manual '+id,{actionId,startedTick:executed.startedTick,executedTick:executed.executedTick,result:executed.result,aim:id==='spell'?{x:enemy.x,y:enemy.y}:null});
 if(acted.status!=='active')return true;
 await pause(false);await untilCombat(r=>!r.pending,`manual ${id} recovery`);await pause(true);return true;
}
async function spellMoveDodgeChecks(){
 let current=await readCombat();if(current.status!=='active')return false;
 if(!actionReady(current,'spell')){await pause(false);current=await untilCombat(r=>actionReady(r,'spell'),'spell movement readiness');await pause(true);if(current.status!=='active')return false;}
 await focusInput();current=await readCombat();await aimEnemy(qaTarget(current));await page.keyboard.press('Digit2');const planned=await readCombat();assert.equal(planned.pending?.action,'spell','Digit2 must create the manual spell');const actionId=planned.pending.id,start={x:planned.player.x,y:planned.player.y},backKey=start.x>1.5?'KeyA':'KeyD';
 actions.push({kind:'key',key:'Digit2',action:'spell',tick:planned.tick,wallSeconds:wall()});await page.evaluate(({actionId,start})=>{window.__combatPartyQA.spellActionId=actionId;window.__combatPartyQA.spellStart=start;},{actionId,start});
 const bounds=planned.bounds||{left:.6,right:11.4,top:.6,bottom:7.4},destination={x:Math.max(bounds.left+.1,Math.min(bounds.right-.1,start.x+(backKey==='KeyA'?-1.5:1.5))),y:Math.max(bounds.top+.1,Math.min(bounds.bottom-.1,start.y+(start.y<6?.9:-.9)))};await aimEnemy(destination);assert.deepEqual((await readCombat()).pending.target,planned.pending.target,'preparing the next cursor point must preserve the frozen spell aim');actions.push({kind:'mouse-aim',purpose:'prepare the next short step after freezing the spell target',destination,wallSeconds:wall()});
 let moved;await pause(false);try{await page.keyboard.down(backKey);actions.push({kind:'keydown',key:backKey,purpose:'held movement during spell windup',tick:planned.tick,wallSeconds:wall()});moved=await untilCombat(r=>{const action=r.observedActions.find(a=>a.id===actionId&&a.executed);if(action?.failure)throw Error('manual spell failed: '+action.failure);if(r.player.motion?.phase==='hit'&&!r.pending&& !action)throw Error('real impact interrupted the planned spell');return action&&qaSpellProof(r.steps,action,start).moving;},'spell release followed by real held-key movement',6);}finally{await page.keyboard.up(backKey);actions.push({kind:'keyup',key:backKey,wallSeconds:wall()});}
 if(moved.status!=='active'){await pause(true);return false;}
 const spell=moved.observedActions.find(a=>a.id===actionId&&a.executed),proof=qaSpellProof(moved.steps,spell,start);assert(proof.windup,'held movement must remain stopped during observed spell windup');assert(proof.release,'the formal spell release step was not observed');assert(proof.moving,'the released spell must permit actual movement');
 const beforeDodge=await readCombat();if(beforeDodge.status!=='active'){await pause(true);return false;}await page.keyboard.press('Space');const requested=await readCombat();actions.push({kind:'key',key:'Space',action:'dodge',tick:requested.tick,destination,wallSeconds:wall()});
 const input=requested.inputEvents.findLast(event=>event.code==='Space');assert.equal(input?.before.pending?.id,actionId,'Space must actually arrive during this spell recovery');assert.equal(input.before.pending.executed,true,'the spell must have released before Space replaces recovery');assert.equal(input.before.pending.phase,'recovery','Space must arrive within the original recovery stage');assert(input.after.pending?.action==='dodge'||input.after.buffered?.action==='dodge','Space must enter the legal dodge request path');
 const dodged=qaDodgeEvidence(requested,input)?requested:await untilCombat(r=>!!qaDodgeEvidence(r,input),'real Space dodge release',6),observed=qaDodgeEvidence(dodged,input);await pause(true);if(!observed)return false;
 const evidence=await capture('spell-move-dodge'),runtime=evidence.session.state.srCombat,executions=[...(runtime.executions||[]),...(runtime.pending?[runtime.pending]:[])],dodge=executions.find(a=>a.action==='dodge'&&a.executed&&(observed.acceptedId?a.id===observed.acceptedId:a.startedTick>=observed.requestedTick));assert(dodge,'the accepted Space action must have a canonical execution');assert(!dodge.failure,dodge.failure);assert.equal(dodge.executedTick,observed.path.startedTick,'observed movement must belong to that exact executed short step');
 assert(Math.hypot(observed.path.from.x-input.before.player.x,observed.path.from.y-input.before.player.y)<1e-6,'the short step must start at the actual Space input position');assert(Math.hypot(observed.path.to.x-observed.path.from.x,observed.path.to.y-observed.path.from.y)>.05,'short step must physically move');
 assert(evidence.session.state.srCombat.cooldowns.spell>spell.executedTick,'dodge must preserve the released spell cooldown');assert(evidence.session.state.srCombat.cooldowns.dodge>dodge.executedTick,'short step must pay its cooldown');assert(dodged.observedProjectiles.some(s=>s.actionId===actionId)||dodged.hits.some(s=>s.actionId===actionId),'released projectile must survive the move/dodge continuation');
 record('native Digit2 locks windup then resumes real WASD movement',{actionId,startedTick:spell.startedTick,executedTick:spell.executedTick,...proof,start,afterMove:{x:moved.player.x,y:moved.player.y}});record('native Space replaces recovery with a real paid short step',{actionId:dodge.id,executedTick:dodge.executedTick,path:observed.path,pathEvidence:observed.source,pathObservedTick:observed.observedTick??dodged.tick,spellActionId:actionId,qiBefore:planned.player.qi,qiAfter:dodged.player.qi});return true;
}
async function walkIntoMelee(){
 let current=await readCombat();if(current.status!=='active')return false;await focusInput();const start={x:current.player.x,y:current.player.y},started=performance.now();let pulses=0;
 while(current.status==='active'){
  const approach=qaApproach(current);if(!approach.key){record('real WASD places the player inside the official melee range',{tick:current.tick,range:approach.range,distance:approach.distance,pulses,start,position:{x:current.player.x,y:current.player.y}});return true;}
  assert(++pulses<=40&&performance.now()-started<30000,'public WASD approach exceeded its bounded progress window');
  if(current.player.motion?.movementLocked){await pause(false);current=await untilCombat(r=>!r.player.motion?.movementLocked,'movement lock recovery',8);await pause(true);continue;}
  const before=current;await pause(false);try{await page.keyboard.down(approach.key);actions.push({kind:'keydown',key:approach.key,purpose:'public melee approach',tick:before.tick,wallSeconds:wall()});current=await untilCombat(r=>{assert(r.tick-before.tick<=5||Math.hypot(r.player.x-before.player.x,r.player.y-before.player.y)>.001,'WASD approach made no real positional progress');return Math.hypot(r.player.x-before.player.x,r.player.y-before.player.y)>.001||qaTarget(r)?.id!==approach.enemy.id;},'one real WASD approach step',3);}finally{await page.keyboard.up(approach.key);actions.push({kind:'keyup',key:approach.key,wallSeconds:wall()});await pause(true);}
  current=await readCombat();assert.deepEqual(current.input.held,[],'approach must release held keys');
 }
 return false;
}
async function combatChecks(){
 phase='combat';let value=await read(),battle=value.session.state.combat,sessionId=battle.sessionId,initialEnemies=battle.enemies.map(e=>({id:e.id,hp:e.hp,personId:e.personId})),allyKeys=new Set(battle.allies.flatMap(a=>[String(a.id),a.personId].filter(Boolean)));
 assert.equal(value.presentation.background.loaded,true,'the registered painted battlefield must be loaded');if(value.view.expedition.scene.geometryId==='prison-forecourt')assert.equal(value.presentation.background.id,'prison-forecourt');
 assert.equal(battle.status,'active');await focusInput();const target=battle.enemies.find(e=>e.hp>0);await page.locator('#combat-target-select').selectOption(target.id);if(battle.allies.length){await page.locator('#combat-tactic-select').selectOption('focus');assert.equal((await read()).session.state.srCombat.tactic,'focus');}
 value=await read();assert.equal(value.session.state.combat.selectedTargetId,target.id);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));value=await read();assert.equal(value.presentation.scene.selectedTargetId,target.id);
 if(battle.enemies.length>1){await focusInput();await page.keyboard.press('Tab');value=await read();assert.equal(value.session.state.combat.selectedTargetId,battle.enemies[1].id);record('native Tab selects another living enemy',{targetId:value.session.state.combat.selectedTargetId});}
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));value=await read();const paused=value.session.state,shown=value.presentation.scene;await sleep(400);const unchanged=await read();assert.deepEqual(unchanged.session.state,paused);assert.deepEqual(unchanged.presentation.scene,shown);await capture('combat-target-paused');record('paused target and tactic controls preserve the world and rendered bodies');
 const combatStartTick=value.session.state.worldTick,missing=[];await page.evaluate(tick=>{const qa=window.__combatPartyQA;qa.startTick=tick;qa.observationStart=performance.now();qa.enabled=true;},combatStartTick);
 if((await readCombat()).autoAttack)await click('#combat-auto');assert.equal((await readCombat()).autoAttack,false,'manual checks begin before automatic melee');
 if(!await manualAction('guard','Digit3'))missing.push('battle ended before manual guard executed');
 if(!await spellMoveDodgeChecks())missing.push('spell lock/move/dodge continuation was not completed before terminal');
 let light=await readCombat();if(light.status==='active'&&await walkIntoMelee()){
  await click('#combat-auto');assert.equal((await readCombat()).autoAttack,true);record('public automatic melee enabled after real player approach');await pause(false);const started=performance.now();
  while(true){light=await readCombat();assert.deepEqual(light.errors,[]);if(light.status!=='active')break;assert(performance.now()-started<120000,'combat did not reach an actual terminal result');const approach=qaApproach(light);if(approach.distance>approach.range+.01){await pause(true);if(!await walkIntoMelee())break;await pause(false);}await sleep(25);}
 }else missing.push('battle ended before public automatic melee could be enabled');
 await pause(true);const terminal=await capture('combat-terminal');assert.equal(terminal.session.state.combat.status,'won','defeat or retreat is retained as a failed victory scenario');assert(terminal.session.state.combat.enemies.every(e=>e.hp===0));assert.equal(terminal.session.state.combat.rewardApplied,true);assert.equal(terminal.session.state.combatSessionsById[sessionId].phase,'ended');await sleep(400);assert.deepEqual((await read()).session.state,terminal.session.state);record('actual victory settles once and remains stable',{sessionId,initialEnemies,result:terminal.session.state.combat.result,finalWounds:Object.fromEntries(['person:master',...battle.allies.map(a=>a.personId)].filter(Boolean).map(id=>[id,terminal.session.state.personsById[id].wound]))});
 if(terminal.session.state.combat.encounterId==='rescue'){assert.equal(terminal.session.state.story.preparations.witness,true);assert.equal(terminal.session.state.factsById['fact:preparation:witness']?.personId,'person:shen-witness');record('real rescue settlement records the same witness',{personId:'person:shen-witness',position:position(terminal.session.state.personsById['person:shen-witness'])});}
 await flushCombatObservation();
 if(battle.allies.length){const hits=trace.hits.filter(e=>allyKeys.has(String(e.sourceId))&&e.amount>0);if(hits.length)record('companion acts through a real timed contact',{events:hits});else missing.push('no autonomous companion contact was observed');}
 const automaticHits=trace.hits.filter(e=>e.sourceId==='master'&&e.amount>0&&!e.projectileId&&trace.actions.some(a=>a.id===e.actionId&&a.automatic&&a.executed));if(automaticHits.length)record('automatic melee contacts after actual player WASD approach',{events:automaticHits});else missing.push('no real player automatic melee contact was observed');
 await reopen('combat-result');await returnChecks(sessionId,terminal);assert.deepEqual(missing,[],'required combat action checks were not completed before the real terminal result');
}
async function flushCombatObservation(){
 if(trace||!page||page.isClosed())return;
 trace=await page.evaluate(()=>{const qa=window.__combatPartyQA;qa.observationEnd=performance.now();qa.recordLongTasks(qa.longTaskObserver?.takeRecords?.()||[]);qa.enabled=false;return {saveTimings:window.courtyardQA.saveTimings(),frames:qa.frames,draws:qa.draws,steps:qa.steps,pumps:qa.pumps,longTasks:qa.longTasks,longTasksSupported:qa.longTasksSupported,observations:qa.observations,boundaries:qa.boundaries,inputEvents:qa.inputEvents,hits:qa.hits,captures:qa.captures,motionCaptures:qa.motionCaptures,actions:Object.values(qa.actions),projectiles:Object.values(qa.projectiles),capped:qa.capped};});
 for(const [kind,captures]of [['contact',trace.captures],['motion',trace.motionCaptures]])for(const [index,capture]of captures.entries()){const filename=kind+'-'+String(index).padStart(2,'0')+'.png',bytes=Buffer.from(capture.canvas.split(',')[1],'base64');await fs.writeFile(path.join(output,filename),bytes);delete capture.canvas;capture.filename=filename;capture.sha256=hash(bytes);}
 await fs.writeFile(path.join(output,'combat-observation.json'),json(trace));
}
const readJourney=()=>page.evaluate(()=>{const q=window.courtyardQA,v=q.renderer.view,w=v.expedition.world;return {tick:v.tick,paused:v.paused,sceneId:w.scene?.id,position:w.scene?.player?.position,travel:w.travel,activity:w.activity,exits:w.exits,destinations:w.destinations,party:w.party,notice:document.getElementById('notice')?.textContent||'',returnDisabled:document.getElementById('expedition-exit')?.disabled,returnReason:document.getElementById('expedition-return-note')?.textContent||'',errors:q.metrics().errors};});
async function journeyUntil(predicate,label,seconds=120){const start=performance.now();let lastTick=null,progressAt=performance.now();while(true){const r=await readJourney();assert.deepEqual(r.errors,[]);if(predicate(r))return r;if(r.tick!==lastTick){lastTick=r.tick;progressAt=performance.now();}assert(!r.paused,label+' unexpectedly paused: '+r.notice);assert(r.travel||r.activity,label+' route ended before arrival: '+r.notice);assert(r.travel?.status!=='blocked',label+' blocked: '+r.travel?.reason);assert(performance.now()-progressAt<10000,label+' world made no tick progress');assert(performance.now()-start<seconds*1000,label+' exceeded bounded travel time');await sleep(35);}}
async function returnChecks(sessionId,terminal){
 phase='return';const roster=['person:master',...terminal.session.state.combat.allies.map(a=>a.personId)],factId=terminal.session.state.combat.result.factId,factIds=[factId,...(terminal.session.state.combat.encounterId==='rescue'?['fact:preparation:witness']:[])].filter(Boolean),facts=Object.fromEntries(factIds.map(id=>[id,terminal.session.state.factsById[id]]));
 await click('#combat-acknowledge');const acknowledged=await capture('combat-acknowledged');assert.equal(acknowledged.session.state.combat,null);assert.equal(acknowledged.session.state.combatSessionsById[sessionId].phase,'ended');for(const id of factIds)assert.deepEqual(acknowledged.session.state.factsById[id],facts[id]);record('public result acknowledgement preserves the unique ended session',{sessionId,sceneId:position(canonicalMaster(acknowledged.session.state)).sceneId,factId});
 let journey=await readJourney();assert.deepEqual(journey.party.companionIds,roster.slice(1));assert.equal(journey.returnDisabled,false,'public return unavailable: '+journey.returnReason+' '+journey.notice);const localExit=journey.exits.find(e=>e.destination==='scene:yunxiu-courtyard');
 if(localExit&&!localExit.near){await click('#expedition-exit');journey=await readJourney();assert(journey.activity?.kind==='walk','the public return approach was refused: '+journey.notice);await pause(false);await journeyUntil(r=>r.exits.some(e=>e.id===localExit.id&&e.near)&&!r.activity,'actual walk to the homeward exit');await pause(true);await capture('return-exit-arrived');}
 await click('#expedition-exit');journey=await readJourney();assert(journey.travel,'public return did not start a real travel: '+journey.notice);assert.equal(journey.travel.destinationId,'scene:yunxiu-courtyard');let saved=await read();const travel=saved.session.state.travelsById[saved.session.state.srWorld.activeTravelId];assert.deepEqual(travel.participantIds,roster);record('public return travel retains original party identities',{travelId:travel.id,participantIds:travel.participantIds,from:travel.from});await reopen('party-return-travel');
 await pause(false);await journeyUntil(r=>!r.travel&&r.sceneId==='scene:yunxiu-courtyard','actual party arrival home',180);await pause(true);const home=await capture('party-home');for(const id of roster)assert.equal(position(home.session.state.personsById[id]).sceneId,'scene:yunxiu-courtyard');assert.equal(home.session.state.srWorld.activeTravelId,null);assert.equal(home.session.state.combat,null);assert.equal(home.session.state.combatSessionsById[sessionId].phase,'ended');for(const id of factIds)assert.deepEqual(home.session.state.factsById[id],facts[id]);record('original party physically returns home after the actual ended battle',{sessionId,travelId:travel.id,tick:home.session.state.worldTick,roster});await reopen('party-home');
}
function statistics(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),quantile=p=>sorted[Math.floor((sorted.length-1)*p)]??null;return {n:sorted.length,p50:quantile(.5),p95:quantile(.95),max:sorted.at(-1)??null};}
function combatPerformance(trace){
 const draws=trace.draws||trace.frames,byTimestamp=new Map();for(const draw of draws){const list=byTimestamp.get(draw.at)||[];list.push(draw);byTimestamp.set(draw.at,list);}const frames=[...byTimestamp].map(([at,calls])=>({at,calls,active:calls.every(c=>c.active),segment:calls[0].segment,mixed:calls.some(c=>c.segment!==calls[0].segment||c.active!==calls[0].active)})),intervals=[];
 for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i];if(a.active&&b.active&&!a.mixed&&!b.mixed&&a.segment===b.segment)intervals.push({at:a.at,end:b.at,milliseconds:b.at-a.at});}
 const saveSpans=trace.saveTimings?.spans||[],overlap=(a,b)=>a.at<b.end&&b.at<a.end,active=frames.filter(f=>f.active&&!f.mixed),slow=intervals.filter(i=>i.milliseconds>=50).map(i=>({...i,pumps:trace.pumps.filter(p=>overlap(i,p)),longTasks:trace.longTasks.filter(p=>overlap(i,p)),observations:trace.observations.filter(p=>overlap(i,p)),saveSynchronousJs:saveSpans.filter(p=>p.kind!=='host-save-await-context'&&overlap(i,p)),saveAwaitContext:saveSpans.filter(p=>p.kind==='host-save-await-context'&&overlap(i,p))}));
 return {saveTiming:{synchronousJavaScript:Object.fromEntries(['get-snapshot-js','host-save-submit-js'].map(kind=>[kind,statistics(saveSpans.filter(s=>s.kind===kind).map(s=>s.durationMs))])),awaitContextMs:statistics(saveSpans.filter(s=>s.kind==='host-save-await-context').map(s=>s.durationMs)),spans:saveSpans,capped:!!trace.saveTimings?.capped,note:'get-snapshot-js includes the complete fresh view and snapshot. host-save-submit-js measures only the synchronous call into the host bridge. host-save-await-context is elapsed async wait, not blocking CPU attribution. The persistence layer snapshot copy between callbacks is outside these spans.'},scope:'unique browser rAF timestamps within uninterrupted active segments; Canvas callback cost, world pump and QA observation cost are separate; no physical display FPS claim',browserFrames:frames.length,activeBrowserFrames:active.length,canvasCallbacks:draws.length,duplicateTimestampCallbacks:draws.length-frames.length,activeSegments:[...new Set(active.map(f=>f.segment))].length,actorCounts:[...new Set(draws.filter(d=>d.active).map(d=>d.actors))],rafFrameIntervalMs:statistics(intervals.map(i=>i.milliseconds)),completedCanvasCallbackJsMs:statistics(draws.filter(d=>d.active).map(d=>d.drawJsMs)),observerCallbackJsMs:statistics(draws.filter(d=>d.active).map(d=>d.observerJsMs)),canvasJsPerBrowserFrame:statistics(active.map(f=>f.calls.reduce((n,c)=>n+c.drawJsMs,0))),worldPumpJsMs:statistics(trace.pumps.filter(p=>!p.paused&&p.advancedTicks>0).map(p=>p.durationMs)),worldTicksPerPump:statistics(trace.pumps.filter(p=>!p.paused&&p.advancedTicks>0).map(p=>p.advancedTicks)),fullWorldReads:trace.observations.filter(o=>o.kind==='full-world-read'),activeCombatFullWorldReadCount:trace.observations.filter(o=>o.kind==='full-world-read'&&o.combat&&o.observed&&!o.paused).length,activeCombatStatusReadCount:trace.observations.filter(o=>o.kind==='combat-status-read'&&o.combat&&o.observed&&!o.paused).length,activeCombatStatusReadJsMs:statistics(trace.observations.filter(o=>o.kind==='combat-status-read'&&o.combat&&o.observed&&!o.paused).map(o=>o.end-o.at)),longTasksSupported:trace.longTasksSupported,longTasks:trace.longTasks,slowActiveIntervals:slow,capped:trace.capped,actualContacts:trace.hits.length,note:'All continuous active intervals, including slow ones and contact-export overhead, are retained. Pause boundaries start a new segment. QA observation spans remain attached for attribution. Active combat status/error polling is timed separately and does not query complete metrics; full-world reads retain their own count.'};
}
try{
 lock=await fs.open(lockPath,'wx');await lock.writeFile(json({source,output,mode,pid:process.pid}));
 const loaded=await launch();assert.deepEqual(loaded.session.state,original.state);record('isolated source exact native load',{tick:loaded.session.state.worldTick,sourceSha256:hash(sourceBytes)});
 if(mode==='resume'){record('attested native checkpoint resumed',{checkpoint:resumeContext.checkpoint,originatingReport:resumeReport});if(!loaded.session.state.combat)await outboundChecks();}
 else if(mode!=='group-fixture')await departureChecks();await combatChecks();complete=true;phase='complete';
}catch(error){errors.push(error.stack||String(error));console.error(error.stack||String(error));if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});}}
finally{
 if(page&&!page.isClosed())for(const key of ['KeyW','KeyA','KeyS','KeyD'])try{await page.keyboard.up(key);}catch(error){finalizationErrors.push('key release '+key+': '+String(error));}
 if(page&&!page.isClosed())try{await flushCombatObservation();}catch(error){finalizationErrors.push('observation export: '+(error.stack||String(error)));}
 if(page&&!page.isClosed())try{last=await saveExact('final-world');}catch(error){finalizationErrors.push(error.stack||String(error));}
 else if(page)finalizationErrors.push('Native QA page closed before a final world snapshot could be captured; see native-launch events.');
 try{await close();}catch(error){finalizationErrors.push(error.stack||String(error));}
 let runtimeAfter=null,sourceUnchanged=false;try{runtimeAfter=await runtimeHashes();}catch(error){finalizationErrors.push(String(error));}try{sourceUnchanged=hash(await fs.readFile(source))===hash(sourceBytes);}catch(error){finalizationErrors.push(String(error));}const runtimeUnchanged=JSON.stringify(runtimeAfter)===JSON.stringify(runtimeBefore);
 let nativeExact=false;try{nativeExact=JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(last?.session.state);}catch(error){finalizationErrors.push(String(error));}
 if(lock)try{if(nativeClosed){await lock.close();await fs.unlink(lockPath);}else{await lock.close();finalizationErrors.push('Native process close unconfirmed; retained QA lock '+lockPath);}}catch(error){finalizationErrors.push(String(error));}
 const passed=complete&&!errors.length&&!finalizationErrors.length&&sourceUnchanged&&runtimeUnchanged&&nativeExact;
 const report={status:passed?'checks-passed-visual-pending':'failed',scope:sourceContext.scope,sourceContext,sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,nativeExact,nativeClosed,initialTick:initial.state.worldTick,finalTick:last?.session.state.worldTick,wallSeconds:wall(),phase,checks,actions,nativeCheckpoints,viewport:last?.viewport||null,metrics:trace?combatPerformance(trace):null,video:{status:'disabled'},visualReview:'pending root inspection',errors,finalizationErrors};await fs.writeFile(path.join(output,'report.json'),json(report));console.log(json({status:report.status,report:path.join(output,'report.json')}));if(!passed)process.exitCode=1;
}
