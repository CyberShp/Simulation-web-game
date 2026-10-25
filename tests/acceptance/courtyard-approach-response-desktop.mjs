/** Public approach response, physical arrival and native route persistence.
 * --source=ABS --output=FRESH_ABS --person-id=ID|auto-farthest
 * --reference=ABS: pre-optimization {sourceSha256,targetId?,route:ART_POINTS}.
 * Root alone launches Electron; Node planning never prewarms this process.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {runtimeHashes,saveNativePaused,setPausedIdempotent} from './courtyard-six-residents-body.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {inspectCourtyard} from '../../apps/courtyard/courtyard-inspection.mjs';
import {developmentContact} from '../../src/simulation/ea-disciple-development.mjs';
import {toWorld} from '../../apps/courtyard/courtyard-space.mjs';
const arg=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=arg('source'),output=arg('output'),reference=arg('reference'),requestedPerson=arg('person-id')||'person:lin-changfeng';
const latencyLimitMs=Number(arg('latency-ms')||200),maxTicks=Number(arg('max-ticks')||1200),maxWallSeconds=Number(arg('max-wall')||600);
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));assert(!path.resolve(output).startsWith(repositoryRoot+'/'));
assert(Number.isFinite(latencyLimitMs)&&latencyLimitMs>0&&latencyLimitMs<=200);assert(Number.isInteger(maxTicks)&&maxTicks>0&&maxTicks<=2400);assert(maxWallSeconds>0&&maxWallSeconds<=1200);
const bytes=await fs.readFile(source),original=JSON.parse(bytes),hash=x=>createHash('sha256').update(x).digest('hex'),sourceSha256=hash(bytes);
const isolated=restoreSect(original);assert.equal(validateSect(isolated),true);assert.deepEqual(isolated.state,original.state);assert.equal(original.courtyardPresentation?.manualPause,true);assert.equal(original.state.speed,0);
const MASTER='person:master',initial=isolated.state,inspection=inspectCourtyard(isolated),master=initial.master.position;
const candidates=initial.homeMemberIds.map(id=>{const p=initial.personsById[id],known=inspection.people.find(x=>x.id===id),point=known?.location?.focus||known?.location;return {id,name:p.name,point,near:developmentContact(initial,p).available,distance:point?Math.hypot(point.x-master.x,point.y-master.y):null};}).filter(p=>p.point&&Number.isFinite(p.distance)&&!p.near).sort((a,b)=>b.distance-a.distance||a.id.localeCompare(b.id));
const personId=requestedPerson==='auto-farthest'?candidates[0]?.id:requestedPerson;assert(personId&&initial.homeMemberIds.includes(personId));assert(!developmentContact(initial,initial.personsById[personId]).available,'source must start outside contact range');
const referenceBytes=reference?await fs.readFile(reference):null,referenceData=referenceBytes&&JSON.parse(referenceBytes);
if(referenceData){assert.equal(referenceData.sourceSha256,sourceSha256);assert(Array.isArray(referenceData.route)&&referenceData.route.length);if(referenceData.targetId)assert.equal(referenceData.targetId,personId);}
if(requestedPerson==='auto-farthest')assert(referenceData?.targetId===personId,'farthest selection needs its prechecked traversable route reference');
await fs.mkdir(output,{recursive:false});const world=path.join(output,'world');await fs.mkdir(world);const native=path.join(world,'sect-save.json');await fs.writeFile(native,bytes);await fs.writeFile(path.join(output,'source.json'),bytes);await fs.copyFile(new URL(import.meta.url),path.join(output,'executed-harness.mjs'));
const write=(name,value)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(value,null,2)+'\n');
const target=desktopTarget(),beforeHashes=await runtimeHashes(),started=performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[],actions=[],inputMeasurements=[],checkpoints=[],journey=[];let app,page,functionalSuccess=false,nativeClosed=false,terminal=null;
const elapsed=()=>(performance.now()-started)/1000;
const normalized=r=>({waypoints:(r.waypoints||[]).map(p=>toWorld(p.x,p.y)),active:r.active?{world:{...r.active.world},tick:r.active.tick,exit:!!r.active.exit,adjusted:!!r.active.adjusted}:null,destination:r.destination?toWorld(r.destination.x,r.destination.y):null,failure:r.failure??null});
const pointEqual=(a,b)=>assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-7,'world/art route coordinate mismatch');
function routeEqual(a,b){assert.equal(a.waypoints.length,b.waypoints.length);a.waypoints.forEach((p,i)=>pointEqual(p,b.waypoints[i]));assert.equal(!!a.active,!!b.active);if(a.active){pointEqual(a.active.world,b.active.world);assert.equal(a.active.tick,b.active.tick);assert.equal(a.active.exit,b.active.exit);assert.equal(a.active.adjusted,b.active.adjusted);}assert.equal(!!a.destination,!!b.destination);if(a.destination)pointEqual(a.destination,b.destination);assert.deepEqual(a.failure,b.failure);}
const read=()=>page.evaluate(()=>window.courtyardQA.snapshot()),readRoute=()=>page.evaluate(()=>window.courtyardQA.route());
// Observe the existing renderer projection on normal polls. Full refresh and
// serialization occur only after the actual input measurement has ended.
const light=()=>page.evaluate(id=>{const q=window.courtyardQA,v=q.renderer.view,p=v.people.find(p=>p.id===id),m=v.people.find(p=>p.id==='person:master'),status=q.status();return {tick:v.tick,master:{x:m.x,y:m.y},person:p?{x:p.x,y:p.y}:null,contact:v.discipleDevelopment?.members.find(p=>p.personId===id)?.contact.available===true,route:q.route(),manualPause:status.manualPause,pauseReasons:status.pauseReasons,statusErrors:status.errors};},personId);
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+world,'--qa-scenario=native','--show']});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
async function closePanels(){for(const s of ['#dialog-close','#close-person','#close-management'])if(await page.locator(s).isVisible())await page.locator(s).click();}
async function click(selector){const node=page.locator(selector);await node.scrollIntoViewIfNeeded();assert(await node.isVisible());assert(await node.isEnabled());await node.click();actions.push({selector,wallSeconds:elapsed()});}
async function pause(wanted){await closePanels();await setPausedIdempotent({wanted,readStatus:()=>page.evaluate(()=>window.courtyardQA.status().manualPause),click:()=>click('#pause')});}
async function openPerson(){await closePanels();await click('#people');await click(`[data-ui-key="person:${personId}"]`);await click(`[data-ui-key="person:inspect:${personId}"]`);}
async function checkpoint(name){
 await pause(true);const before=await read(),route=normalized(await readRoute());assert.equal(before.state.speed,0);await write(name,before);await write(name+'-route',route);
 const saved=await saveNativePaused({pause,closeDialogs:closePanels,snapshot:async()=>{const x=await read();return {manualPause:await page.evaluate(()=>window.courtyardQA.status().manualPause),tick:x.state.worldTick,state:x.state};},clickSave:()=>click('#save'),readNative:()=>fs.readFile(native),validate:x=>validateSect(restoreSect(x))});
 assert.deepEqual(saved.saved.state,before.state);const cp=saved.saved.courtyardPresentation;assert.equal(cp.route.length,route.waypoints.length);cp.route.forEach((p,i)=>pointEqual(p,route.waypoints[i]));assert.equal(!!cp.activeWaypoint,!!route.active);if(route.active){pointEqual(cp.activeWaypoint.world,route.active.world);assert.equal(cp.activeWaypoint.tick,route.active.tick);assert.equal(!!cp.activeWaypoint.exit,route.active.exit);assert.equal(!!cp.activeWaypoint.adjusted,route.active.adjusted);}if(route.destination)pointEqual(cp.destination,route.destination);
 await fs.writeFile(path.join(output,name+'-native.json'),saved.bytes);await app.close();app=null;await launch();const reopened=await read();assert.deepEqual(reopened.state,before.state);routeEqual(normalized(await readRoute()),route);await write(name+'-reopened',reopened);checkpoints.push({name,tick:before.state.worldTick,canonicalExact:true,routeExact:true,nativeSha256:hash(saved.bytes)});return reopened;
}
async function measuredApproach(attempt){
 await pause(true);await openPerson();const before=await read(),beforeReceipts=new Set(Object.values(before.state.transactions.receipts).map(r=>r.id));
 // Capture the real DOM event, independently of Playwright actionability/IPC.
 await page.evaluate(async()=>{
  window.__approachMeasure?.observer?.disconnect();const m=window.__approachMeasure={started:null,firstFrame:null,firstFeedbackText:null,firstFeedbackVisible:false,firstFramePlanning:null,beforeRequestId:window.courtyardQA.route().planning?.requestId??null,planning:null,done:false,finishing:false,gaps:[],longTasks:[],lastFrame:null,longTaskSupported:typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')===true};
  await new Promise(resolve=>requestAnimationFrame(()=>{m.lastFrame=performance.now();resolve();}));
  const frames=()=>{
   const now=performance.now();
   if(m.started!==null){
    if(m.firstFrame===null){const notice=document.getElementById('notice');m.firstFrame=now;m.firstFeedbackText=notice?.textContent??null;m.firstFeedbackVisible=!!notice&&!notice.hidden&&!!notice.textContent.trim();m.firstFramePlanning=structuredClone(window.courtyardQA.route().planning??null);}
    m.gaps.push(now-m.lastFrame);
    const planning=window.courtyardQA.route().planning;
    if(planning&&planning.requestId!==m.beforeRequestId&&['accepted','rejected','cancelled'].includes(planning.status)){
     m.planning=structuredClone(planning);m.finishing=true;requestAnimationFrame(()=>{m.done=true;});
    }
   }
   m.lastFrame=now;if(!m.done&&!m.finishing)requestAnimationFrame(frames);
  };requestAnimationFrame(frames);
  if(m.longTaskSupported){m.observer=new PerformanceObserver(list=>m.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));m.observer.observe({type:'longtask',buffered:false});}
  document.addEventListener('click',function capture(e){if(!e.target.closest('#approach-person'))return;m.started=performance.now();document.removeEventListener('click',capture,true);},{capture:true});
 });
 const wallStart=performance.now();let clickError=null;try{await page.locator('#approach-person').click({timeout:15000});}catch(error){clickError=error;}const clickWallMs=performance.now()-wallStart;
 if(clickError){const failed={attempt,clickWallMs,passed:false,clickError:clickError.stack||String(clickError)};inputMeasurements.push(failed);await write('input-'+attempt,failed);throw clickError;}
 await page.waitForFunction(()=>window.__approachMeasure.done,null,{timeout:15000});
 const measured=await page.evaluate(()=>{
  const m=window.__approachMeasure;m.observer?.disconnect();const p=m.planning,end=p?.acceptedAt??p?.commandFinishedAt??performance.now();
  return {eventStart:m.started,firstFrame:m.firstFrame,firstFeedbackText:m.firstFeedbackText,firstFeedbackVisible:m.firstFeedbackVisible,firstFramePlanning:m.firstFramePlanning,beforeRequestId:m.beforeRequestId,eventToFirstFrameMs:m.firstFrame-m.started,maxRafGapMs:Math.max(0,...m.gaps),longTaskSupported:m.longTaskSupported,maxLongTaskMs:m.longTaskSupported?Math.max(0,...m.longTasks.filter(e=>e.start<=end&&e.start+e.duration>=m.started).map(e=>e.duration)):null,longTasks:m.longTasks,planning:p,planningTotalMs:Number.isFinite(p?.workerFinishedAt)&&Number.isFinite(p?.startedAt)?p.workerFinishedAt-p.startedAt:null,workerDurationMs:p?.workerDurationMs??null,firstCommandDurationMs:Number.isFinite(p?.commandFinishedAt)&&Number.isFinite(p?.commandStartedAt)?p.commandFinishedAt-p.commandStartedAt:null,eventToAcceptedMs:Number.isFinite(p?.acceptedAt)?p.acceptedAt-m.started:null};
 });
 const sample={attempt,clickWallMs,...measured,limitMs:latencyLimitMs,passed:measured.planning?.status==='accepted'&&measured.firstFeedbackVisible&&Number.isSafeInteger(measured.firstFramePlanning?.requestId)&&measured.firstFramePlanning.requestId!==measured.beforeRequestId&&measured.eventToFirstFrameMs>=0&&measured.eventToFirstFrameMs<=latencyLimitMs&&measured.maxRafGapMs<=latencyLimitMs&&(measured.maxLongTaskMs===null||measured.maxLongTaskMs<=latencyLimitMs)&&Number.isFinite(measured.firstCommandDurationMs)&&measured.firstCommandDurationMs>=0&&measured.firstCommandDurationMs<=latencyLimitMs};
 inputMeasurements.push(sample);await write('input-'+attempt,sample);assert.equal(measured.planning?.status,'accepted','the new planning request must actually commit before route comparison');assert(Number.isFinite(measured.planningTotalMs)&&measured.planningTotalMs>=0);assert(Number.isFinite(measured.workerDurationMs)&&measured.workerDurationMs>=0);assert(Number.isFinite(measured.eventToAcceptedMs)&&measured.eventToAcceptedMs>=0);
 const after=await read(),route=await readRoute();assert.equal(after.state.worldTick,before.state.worldTick);assert.equal(after.state.speed,0);assert(!route.failure);assert(route.active?.world||route.waypoints.length);
 const receipts=Object.values(after.state.transactions.receipts).filter(r=>!beforeReceipts.has(r.id));assert(receipts.some(r=>r.status==='committed'&&r.signature.includes('moveScenicMaster')),'public approach must commit a real movement command');
 if(attempt===0&&referenceData){const planned=referenceData.route.map(p=>toWorld(p.x,p.y)),actual=[...(route.active?[route.active.world]:[]),...normalized(route).waypoints];assert.equal(actual.length,planned.length);actual.forEach((p,i)=>pointEqual(p,planned[i]));sample.originalWaypointsExact=true;}
 assert.equal(typeof measured.planning.commandId,'string');assert(receipts.some(r=>r.id===measured.planning.commandId&&r.status==='committed'));
 await write('input-'+attempt,sample);await write('after-click-'+attempt,after);await write('issued-route-'+attempt,{route:normalized(route),receipts});await page.screenshot({path:path.join(output,'after-click-'+attempt+'.png')});return after;
}
function identities(s){assert.deepEqual(s.homeMemberIds,original.state.homeMemberIds);for(const id of [MASTER,...s.homeMemberIds]){assert.equal(s.personsById[id].name,original.state.personsById[id].name);assert.deepEqual(s.personsById[id].appearance,original.state.personsById[id].appearance);}}
let midSaved=false,lastTick=original.state.worldTick,lastMotion=null,still=0,firstIssuedTick=null;
try{
 await launch();assert.deepEqual((await read()).state,original.state);const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));assert.deepEqual(viewport,{width:1672,height:941,dpr:1});await write('selection',{personId,requestedPerson,candidates,viewport,reference:reference?{path:reference,sha256:hash(referenceBytes)}:null});
 await measuredApproach(0);firstIssuedTick=(await read()).state.worldTick;
 for(let attempt=0;attempt<12;attempt++){
  await pause(false);let retry=false;
  for(;;){
   assert(elapsed()<maxWallSeconds,'native wall bound');assert.deepEqual(errors,[]);const q=await light();assert.deepEqual(q.statusErrors,[]);assert(q.tick>=lastTick);lastTick=q.tick;journey.push(q);assert(q.tick-firstIssuedTick<=maxTicks,'native world-tick bound');
   if(q.contact){await pause(true);break;}if(q.route.failure||q.route.remaining===0&&!q.route.active){await pause(true);retry=true;break;}
   const motion=JSON.stringify([q.master,q.route.steps,q.route.active?.world,q.route.remaining]);still=motion===lastMotion?still+1:0;lastMotion=motion;assert(still<100,'bounded route stagnation (100 lightweight polls)');
   if(!midSaved&&q.tick>firstIssuedTick&&Math.hypot(q.master.x-master.x,q.master.y-master.y)>.5&&(q.route.active||q.route.remaining)){
    const mid=await checkpoint('mid-route');assert(mid.state.worldTick>firstIssuedTick);const r=normalized(await readRoute());assert(r.active||r.waypoints.length);midSaved=true;await pause(false);
   }
   await sleep(100);
  }
  if((await light()).contact)break;assert(retry);await measuredApproach(attempt+1);
 }
 assert(midSaved,'actual moving-route checkpoint required');await pause(true);await openPerson();const before=await read(),s=restoreSect(before).state;identities(s);assert(developmentContact(s,s.personsById[personId]).available,'actual body must reach public contact range');assert.equal(s.economy.starvation,0);
 const node=page.locator('[data-ui-key="person:cultivation-progress"]');await node.scrollIntoViewIfNeeded();assert(await node.isVisible());const text=await node.innerText();assert.equal((await page.locator('#person-name').innerText()).trim(),initial.personsById[personId].name);assert(text.trim());await sleep(800);assert.deepEqual((await read()).state,before.state);await page.screenshot({path:path.join(output,'public-nearby.png')});await write('public-nearby',{personId,tick:s.worldTick,text,master:s.master.position,person:s.personsById[personId].position,actualDistance:Math.hypot(s.master.position.x-s.personsById[personId].position.x,s.master.position.y-s.personsById[personId].position.y),readOnlyExact:true});
 terminal=await checkpoint('terminal');assert(terminal.state.worldTick>firstIssuedTick);identities(restoreSect(terminal).state);functionalSuccess=true;
}catch(error){errors.push(error.stack||String(error));try{if(page){await pause(true);await write('failure',await read());await write('failure-route',normalized(await readRoute()));await page.screenshot({path:path.join(output,'failure.png')});}}catch(e){errors.push('failure preservation: '+e.message);}}
finally{
 if(app){const process=app.process();await app.close();for(let i=0;i<100&&process.exitCode===null&&process.signalCode===null;i++)await sleep(100);nativeClosed=process.exitCode!==null||process.signalCode!==null;}
 const afterHashes=await runtimeHashes(),sourceUnchanged=hash(await fs.readFile(source))===sourceSha256,runtimeUnchanged=JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),referenceUnchanged=!reference||hash(await fs.readFile(reference))===hash(referenceBytes),performancePassed=inputMeasurements.length>0&&inputMeasurements.every(x=>x.passed);
 const nativeData=JSON.parse(await fs.readFile(native)),nativeExact=!!terminal&&JSON.stringify(nativeData.state)===JSON.stringify(terminal.state),success=functionalSuccess&&performancePassed&&nativeClosed&&nativeExact&&sourceUnchanged&&runtimeUnchanged&&referenceUnchanged&&errors.length===0;
 await write('journey',journey);await write('report',{success,functionalSuccess,performancePassed,scope:'macOS Electron actual public click response plus physical nearby arrival and native route persistence',source,sourceSha256,sourceUnchanged,personId,requestedPerson,initialTick:original.state.worldTick,terminalTick:terminal?.state.worldTick,latencyLimitMs,inputMeasurements,checkpoints,midSaved,nativeClosed,nativeExact,nativeSha256:hash(await fs.readFile(native)),runtimeUnchanged,referenceUnchanged,beforeHashes,afterHashes,actions,errors,wallSeconds:elapsed(),limits:{maxTicks,maxWallSeconds},measurementScope:'200ms applies to first feedback frame, longest main-thread frame gap/long task through actual new-request acceptance, and synchronous first command duration. Async planning and event-to-accepted total time are separately reported. Full snapshots/screenshots/saves occur after acceptance. Click wall time includes Playwright waiting. Mid-route reload restores route/active/destination; pendingApproach is not persisted by this runtime.'});
 console.log(JSON.stringify({success,functionalSuccess,performancePassed,personId,output,terminalTick:terminal?.state.worldTick,errors}));if(!success)process.exitCode=1;
}
