/** U-167/T-22: same-world GC16, formal admission and GC02 study.
 * node tests/acceptance/courtyard-library-desktop.mjs --source=/absolute/source-v2-world.json --output=/absolute/fresh-directory
 * Uses real elapsed time, screenshots and exact save/reopen; all QA hooks are reads.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {toArt,isArtWalkable} from '../../apps/courtyard/courtyard-space.mjs';
import {facilitySlots} from '../../src/simulation/ea-facility-slots.mjs';
const worldTime=s=>s.schemaMigration.clockOriginTime+Math.floor((s.worldTick-s.schemaMigration.clockOriginTick)/10);
const day=s=>Math.floor(worldTime(s)/120);

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=option('source'),requestedOutput=option('output');
const resumeFrom=option('resume-from'),transitionFile=option('runtime-transition');
assert(source&&requestedOutput&&path.isAbsolute(source)&&path.isAbsolute(requestedOutput),'Pass absolute --source and --output.');
await fs.mkdir(path.dirname(requestedOutput),{recursive:true});
const repository=await fs.realpath(repositoryRoot),output=path.join(await fs.realpath(path.dirname(requestedOutput)),path.basename(requestedOutput));
assert(output!==repository&&!output.startsWith(repository+path.sep));
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original),hash=value=>createHash('sha256').update(value).digest('hex');
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',LU='person:lu-zhiwei',MERCHANT='person:merchant-qingxi',MARKET='stockpile:qingxi';
const siteId=number=>number===16?'site:domain:west-lumber-1':number===20?'site:domain:original-farm':`site:domain:gc-${String(number).padStart(2,'0')}`,atSite=(state,number)=>Object.values(state.buildingsById).find(b=>b.domainSiteId===siteId(number));
assert(atSite(initial.state,13));assert(!atSite(initial.state,16));assert(!atSite(initial.state,2));assert(initial.state.stockpilesById[HOME].resources.jade>=90);
const target=desktopTarget(),directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const started=performance.now(),startedAt=new Date().toISOString(),checks=[],errors=[],journey=[],interactions=[],saved=[],launchTimings=[],uiTimings=[];let timingOffset=0;
let resume=null,startBytes=bytes,startOriginal=original,recovery=null,recoveryOffset=0;
let electron,page,phase='prepare',complete=false,lastTick=startOriginal.state.worldTick;
const wall=()=>Number(((performance.now()-started)/1000).toFixed(3)),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const read=()=>page.evaluate(()=>({view:window.courtyardQA.view(),session:window.courtyardQA.snapshot(),status:window.courtyardQA.status()}));
const view=async()=>(await read()).view,snapshot=async()=>(await read()).session;
const key=name=>page.locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=(name,data={})=>{checks.push({name,ok:true,wallSeconds:wall(),...data});console.log(`PASS ${name}`);};
async function click(locator,label){const issuedWallSeconds=wall(),issuedAt=Date.now();await locator.click();const confirmedWallSeconds=wall(),current=await read();interactions.push({kind:'click',label,issuedAt,issuedWallSeconds,confirmedWallSeconds,actionMilliseconds:(confirmedWallSeconds-issuedWallSeconds)*1000,wallSeconds:wall(),tick:current.view.tick,manualPause:current.status.manualPause});}
const tab=name=>click(page.locator(`#${name}`),name),clickKey=name=>click(key(name),name);
async function selectKey(name,value){await key(name).selectOption(value);interactions.push({kind:'select',label:name,value,wallSeconds:wall(),tick:(await view()).tick});}
async function fillKey(name,value){await key(name).fill(String(value));interactions.push({kind:'fill',label:name,value,wallSeconds:wall(),tick:(await view()).tick});}
async function pause(wanted){if(wanted)await closePerson();if((await read()).status.manualPause!==wanted)await tab('pause');}
async function closePerson(){if(await page.locator('#dialog').isVisible())await tab('close-person');}
async function closePanel(){if(await page.locator('#management').isVisible())await tab('close-management');}
async function manual(){await tab('affairs');await clickKey('affairs:policy');await clickKey('policy:manual');await closePanel();}
async function resumeWorld(){await pause(true);await manual();await pause(false);}
async function openSite(number){await tab('affairs');await selectKey('domain:region',number===16?'Z-03':'Z-01');await clickKey(`domain:site:${siteId(number)}`);}
async function openBuilding(number){await openSite(number);await clickKey('domain:building');}
async function openStock(id){await tab('supply');await clickKey('subtab:stocks');await selectKey('stocks:owner','all');await clickKey(`stock:${id}`);}
async function capture(name){await page.screenshot({path:path.join(output,`${name}.png`),timeout:60000});await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText());}
async function checkpoint(name){const session=await snapshot();assert.equal(validateSect(session),true);lastTick=session.state.worldTick;const file=`${name}.json`;await fs.writeFile(path.join(output,file),JSON.stringify(session)+'\n');saved.push({name,file,tick:session.state.worldTick,sha256:hash(JSON.stringify(session))});return session;}
async function collectTiming(){if(page&&!page.isClosed()){const entries=await page.evaluate(offset=>(window.__libraryReadOnlyTiming||[]).slice(offset),timingOffset).catch(()=>[]);timingOffset+=entries.length;uiTimings.push(...entries);}}
async function report(){await collectTiming();await fs.writeFile(path.join(output,'report.json'),JSON.stringify({startedAt,status:complete&&!errors.length?'passed':checks.some(c=>!c.ok)||errors.length?'failed':'running',phase,source,sourceSha256:hash(bytes),sourceProvenance:original.provenance,platform:process.platform,resume,segmentInitialTick:startOriginal.state.worldTick,totalActiveWallSeconds:wall()+(resume?.previousWallSeconds||0),runtimeTransition,scope:'macOS source Electron; one unchanged funded world; actual GC16 and GC02 construction, Lin Changfeng admission, family notes and study; public UI and wall clock.',runtimeSha256,runtimeSha256After,sourceUnchanged:hash(await fs.readFile(source))===hash(bytes),wallSeconds:wall(),initialTick:initial.state.worldTick,finalTick:lastTick,simulatedSeconds:(lastTick-initial.state.worldTick)/10,checks,errors,interactions,saved,journey,launchTimings,uiTimings,recovery},null,2)+'\n');}
async function launch(){const launchStarted=performance.now();const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});timingOffset=0;launchTimings.push({wallSeconds:wall(),readyMilliseconds:performance.now()-launchStarted});
 await page.evaluate(()=>{const log=window.__libraryReadOnlyTiming=[];const sample=()=>({at:Date.now(),mono:performance.now(),tick:window.courtyardQA.metrics().tick,paused:window.courtyardQA.status().manualPause});new PerformanceObserver(list=>{for(const e of list.getEntries())log.push({kind:'longtask',start:e.startTime,duration:e.duration,at:Date.now()});}).observe({type:'longtask',buffered:true});document.addEventListener('click',e=>{if(e.target.id!=='pause')return;const before={kind:'pause-click',...sample()};log.push(before);requestAnimationFrame(()=>log.push({kind:'pause-next-frame',from:before.mono,...sample()}));},{capture:true,passive:true});});}
async function close(){await collectTiming();const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
// The measured north road's positive-y edge is x47.36; include its .26m body radius.
// The pre-existing east road beyond x47.62 retains the whole-scene centre check.
function circleOnGround(person,domain){for(let i=-1;i<16;i++){const a=toArt(person.x+(i<0?0:.26*Math.cos(i*Math.PI/8)),person.y+(i<0?0:.26*Math.sin(i*Math.PI/8)));if(!isArtWalkable(a.x,a.y,{valley:domain.valleyEnabled,west:domain.westEnabled,domain:domain.enabled,residences:domain.residencesEnabled,services:domain.servicesEnabled,northLibrary:domain.northLibraryEnabled}))return false;}return true;}
async function recoveryFrames(v){
 if(!recovery||recovery.complete)return;
 const samples=await page.evaluate(offset=>(window.__northRecoveryFrames||[]).slice(offset),recoveryOffset);recoveryOffset+=samples.length;
 for(const sample of samples){for(const person of sample.people){
  const valid=circleOnGround(person,v.domain),previous=recovery.samples.filter(x=>x.id===person.id).at(-1);
  if(previous){const delta=sample.tick-previous.tick,step=Math.hypot(person.x-previous.x,person.y-previous.y);assert(step<=delta*(person.id===MASTER?.3168:.286)+1e-6,'recovery follows the existing movement budget');}
  if(valid&&!recovery.recoveredAt[person.id])recovery.recoveredAt[person.id]=sample.tick;
  if(recovery.recoveredAt[person.id])assert(valid,`${person.id} stays on ground after physical recovery`);
  recovery.samples.push({...person,tick:sample.tick,valid});
 }if(Object.keys(recovery.recoveredAt).length===2){recovery.complete=true;recovery.completedTick=sample.tick;break;}}
 if(recovery.complete){await fs.writeFile(path.join(output,'north-physical-recovery.json'),JSON.stringify(recovery,null,2)+'\n');record('原北路工单经真实步行回到道路',{initialTick:recovery.initialTick,recoveredAt:recovery.recoveredAt});}
 else assert(v.tick-recovery.initialTick<=30,'old northern route returns to visible ground within its measured recovery journey');
}
async function until(predicate,label,seconds=180){
 const begin=performance.now();let renew=begin,announce=begin,last=-1;
 while(performance.now()-begin<seconds*1000){
  const {view:v,session}=await read(),s=session.state;lastTick=v.tick;
  if(v.tick!==last){
   await recoveryFrames(v);
   const people=v.people.filter(person=>[MASTER,LU,'person:lin-changfeng'].includes(person.id)).map(person=>({id:person.id,x:person.x,y:person.y,art:toArt(person.x,person.y),indoor:person.indoor}));
   for(const person of people)if(!person.indoor&&!(recovery&&[MASTER,'person:lin-changfeng'].includes(person.id)&&(!recovery.recoveredAt[person.id]||v.tick<recovery.recoveredAt[person.id]))&&(!isArtWalkable(person.art.x,person.art.y,{valley:v.domain.valleyEnabled,west:v.domain.westEnabled,domain:v.domain.enabled,residences:v.domain.residencesEnabled,services:v.domain.servicesEnabled,northLibrary:v.domain.northLibraryEnabled})||(v.domain.northLibraryEnabled&&(person.y<1||person.x>=18&&person.x<=47.62&&person.y>=1&&person.y<=34)&&!circleOnGround(person,v.domain)))){await fs.writeFile(path.join(output,'first-invalid-foot.json'),JSON.stringify({tick:v.tick,wallSeconds:wall(),phase,person,session},null,2)+'\n');assert.fail(`${person.id} foot remains on active terrain`);}
   journey.push({tick:v.tick,wallSeconds:wall(),phase,people,construction:v.construction&&{progressTicks:v.construction.progressTicks,phase:v.construction.phase,flow:v.construction.materialFlow?.phase,cargo:v.construction.materialFlow?.cargo}});last=v.tick;
  }
  if(predicate(v,s))return{v,s};
  if(performance.now()-renew>18000){const wasPaused=(await read()).status.manualPause;await pause(true);await manual();await pause(wasPaused);renew=performance.now();}
  if(performance.now()-announce>30000){console.log(`WAIT ${label} tick=${v.tick} ${v.construction?.reason||v.operations.farms.filter(farm=>farm.crop).map(farm=>`${farm.crop.phase}: growth ${farm.crop.growthElapsedTicks}/${farm.crop.maturityRequiredTicks}, care ${farm.crop.careContribution}`).join('; ')||v.operations.master.activity?.reason||''}`);const paused=(await read()).status.manualPause;await pause(true);await capture('progress-current');await report();await pause(paused);announce=performance.now();}
  await wait(120);
 }
 throw Error(`Timed out: ${label}`);
}
async function saveReopen(name,{focusSite=null}={}){
 await pause(true);await closePerson();if(focusSite!==null){await openSite(focusSite);await clickKey('domain:focus');}await closePanel();const before=await checkpoint(`${name}-before`),camera=await page.evaluate(()=>({...window.courtyardQA.renderer.camera}));await capture(name);await tab('save');
 for(let i=0;i<100;i++){const disk=JSON.parse(await fs.readFile(savePath,'utf8'));if(disk.state.worldTick===before.state.worldTick&&disk.state.speed===0)break;await wait(50);}
 assert.deepEqual(JSON.parse(await fs.readFile(savePath,'utf8')).state,before.state);await close();await wait(1200);await launch();
 const after=await checkpoint(`${name}-reopened`);assert.deepEqual(after.state,before.state);assert.equal((await read()).status.manualPause,true);
 const restored=await page.evaluate(()=>({...window.courtyardQA.renderer.camera}));assert(Math.hypot(restored.x-camera.x,restored.y-camera.y)<1e-6);assert.equal(restored.zoom,camera.zoom);
 record(name,{tick:before.state.worldTick,camera,closedWallSeconds:1.2});
}
function newTransport(before,after){const ids=new Set(Object.keys(before.workOrdersById));const orders=Object.values(after.workOrdersById).filter(order=>order.kind==='transport'&&!ids.has(order.id));assert.equal(orders.length,1);return orders[0];}
async function prepareMaster(label){
 await pause(true);await manual();const before=(await snapshot()).state,person=before.personsById[MASTER],activity=before.activitiesById[person.activityId];
 if(!activity||activity.kind==='facility')return;
 assert.equal(activity.kind,'sr-transport',`${label}: ${activity.kind} must finish before another task`);const order=before.workOrdersById[activity.workOrderId];
 if(order.phase==='to-source'){
  await tab('growth');await clickKey('growth:cancel');if(await key('confirm-action').count())await clickKey('confirm-action');
  const after=(await snapshot()).state;assert.equal(after.workOrdersById[order.id].phase,'cancelled');assert(!after.reservationsById[order.reservationId]);assert(!after.personsById[MASTER].activityId);
  for(const [resource,quantity] of Object.entries(order.cargo))assert(Math.abs(after.stockpilesById[order.sourceStockpileId].resources[resource]-before.stockpilesById[order.sourceStockpileId].resources[resource]-quantity)<1e-8);
  record('新安排前通过正式入口中止未取货自主搬运并核对返还',{nextTask:label,orderId:order.id,cargo:order.cargo});await closePanel();
 }else{
  assert.equal(order.phase,'carrying');await closePanel();await resumeWorld();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered','existing carried cargo reaches its destination',360);await pause(true);
  const after=(await snapshot()).state;for(const [resource,quantity] of Object.entries(order.cargo))assert(Math.abs(after.stockpilesById[order.targetStockpileId].resources[resource]-before.stockpilesById[order.targetStockpileId].resources[resource]-quantity)<1e-8);
  record('新安排前等待已有携货实际交付',{nextTask:label,orderId:order.id,cargo:order.cargo});
 }
}
async function transfer(sourceId,targetId,resource,quantity,{saveDuring=null}={}){
 await prepareMaster(`transfer ${resource}`);await openStock(sourceId);await selectKey('stock:destination',targetId);const before=(await snapshot()).state;
 await clickKey(`stock:transfer:${resource}`);await fillKey('transfer:quantity',quantity);assert(await key('transfer:submit').isEnabled());await clickKey('transfer:submit');
 const queued=(await snapshot()).state,order=newTransport(before,queued);assert.equal(order.sourceStockpileId,sourceId);assert.equal(order.targetStockpileId,targetId);assert.equal(order.cargo[resource],quantity);
 assert.equal(queued.stockpilesById[targetId].resources[resource]||0,before.stockpilesById[targetId].resources[resource]||0,'destination is credited only on physical delivery');
 await closePanel();await tab('follow');await resumeWorld();
 const pickup=await until((v,s)=>s.workOrdersById[order.id]?.phase==='carrying'||!saveDuring&&s.workOrdersById[order.id]?.phase==='delivered',`${resource} pickup`),carryingObserved=pickup.s.workOrdersById[order.id].phase==='carrying';
 if(saveDuring){assert(carryingObserved);await saveReopen(saveDuring);}
 await resumeWorld();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered',`${resource} delivery`,360);await pause(true);
 const delivered=(await snapshot()).state;assert(Math.abs(delivered.stockpilesById[targetId].resources[resource]-(before.stockpilesById[targetId].resources[resource]||0)-quantity)<1e-8);
 record('物资实际取货并送达指定货位',{orderId:order.id,sourceId,targetId,resource,quantity,carryingObserved});return order;
}
const sourceFiles=[...(await fs.readdir(path.join(repository,'src/simulation'))).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...(await fs.readdir(path.join(repository,'apps/courtyard'))).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...(await fs.readdir(path.join(repository,'assets/courtyard'))).filter(x=>/^(north-library|west-forest|east-services|east-residences|east-terrace|residence)/.test(x)).map(x=>'assets/courtyard/'+x)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await fs.readFile(path.join(repository,file)))])));
const runtimeSha256=await codeHashes();let runtimeSha256After=null,runtimeTransition=null;
if(original.provenance.runtimeTransition&&!transitionFile){runtimeTransition=original.provenance.runtimeTransition;for(const[file,sha]of Object.entries(runtimeTransition.manifest.to))assert.equal(runtimeSha256[file],sha,`funding-to-desktop runtime ${file}`);}
if(transitionFile){assert(resumeFrom&&path.isAbsolute(transitionFile));const manifestBytes=await fs.readFile(transitionFile),manifest=JSON.parse(manifestBytes);assert.deepEqual(manifest.to,runtimeSha256);runtimeTransition={path:transitionFile,sha256:hash(manifestBytes),manifest};}
if(resumeFrom){
 assert(path.isAbsolute(resumeFrom));
 const priorBytes=await fs.readFile(path.join(resumeFrom,'report.json')),prior=JSON.parse(priorBytes),nativeBytes=await fs.readFile(path.join(resumeFrom,'world/sect-save.json')),native=JSON.parse(nativeBytes),lifecycleBytes=await fs.readFile(path.join(resumeFrom,'world/lifecycle.jsonl'));
 assert.equal(prior.status,'failed');assert.equal(prior.sourceSha256,hash(bytes));assert(prior.sourceUnchanged);assert.deepEqual(prior.errors,[]);assert.deepEqual(prior.runtimeSha256,prior.runtimeSha256After);
 assert.deepEqual(prior.runtimeSha256After,transitionFile?runtimeTransition.manifest.from:runtimeSha256);
 assert.equal(lifecycleBytes.toString().trim().split('\n').map(line=>JSON.parse(line)).at(-1).type,'closed');
 startBytes=await fs.readFile(path.join(resumeFrom,'failure-world.json'));startOriginal=JSON.parse(startBytes);
 assert.equal(validateSect(startOriginal),true);assert.deepEqual(restoreSect(startOriginal).state,startOriginal.state);
 assert(atSite(startOriginal.state,16));assert(!atSite(startOriginal.state,2));
 let kind,scope;
 if(prior.phase==='admit-lin'){
  assert(prior.checks.at(-1).error.includes('intercepts pointer events'));
  const {speed:nativeSpeed,...nativeFacts}=native.state,{speed:pausedSpeed,...pausedFacts}=startOriginal.state;
  assert.equal(nativeSpeed,1);assert.equal(pausedSpeed,0);assert.deepEqual(nativeFacts,pausedFacts);assert.equal(startOriginal.courtyardPresentation.manualPause,true);assert.equal(native.courtyardPresentation.manualPause,false);assert.equal(startOriginal.state.story.step,2);
  const a=startOriginal.state.personsById[MASTER],b=startOriginal.state.personsById['person:lin-changfeng'];assert(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<=1.5);assert.equal(a.scenic.path.length,0);
  kind='dialog-admission';scope='Exact paused-dialog checkpoint; native speed/manualPause normalization is retained as a separate recorded fact.';
 }else{
  assert.equal(prior.phase,'build-gc2');assert(prior.checks.at(-1).error.includes('foot remains on active terrain'));assert(transitionFile);assert.deepEqual(native.state,startOriginal.state);assert.equal(startOriginal.state.speed,0);assert.equal(startOriginal.state.worldTick,prior.finalTick);if(prior.resume?.kind==='north-approach')assert(prior.recovery.complete);else assert.equal(startOriginal.state.worldTick,90667);assert.equal(startOriginal.state.story.step,3);assert.equal(startOriginal.state.spatial.northLibrary.version,'north-library-1');
  const orders=Object.values(startOriginal.state.workOrdersById).filter(o=>o.kind==='construction');assert.equal(orders.length,1);const order=orders[0];assert.equal(order.domainSiteId,siteId(2));assert.equal(order.id,'work:construction:13');assert(order.progressTicks>=0&&order.progressTicks<order.durationTicks);if(order.materialFlow.phase==='ready'){assert(prior.resume?.kind==='north-approach');assert(order.materialFlow.trips.every(t=>t.phase==='delivered'));assert.deepEqual(order.materialFlow.cargo,{});}else{assert.equal(order.progressTicks,0);assert.equal(order.materialFlow.phase,'carrying');assert.deepEqual(order.materialFlow.cargo,{wood:40});}assert.equal(startOriginal.state.personsById[MASTER].activityId,'activity:build:13');
  kind='north-approach';scope='Exact paused original material trip; the first official moving steps restore the route while all prior world facts remain intact.';recovery=prior.resume?.kind==='north-approach'?structuredClone(prior.recovery):{initialTick:startOriginal.state.worldTick,orderId:order.id,initialCargo:order.materialFlow.cargo,recoveredAt:{},samples:[],complete:false};
 }
 resume={kind,priorDirectory:resumeFrom,checkpoint:path.join(resumeFrom,'failure-world.json'),checkpointSha256:hash(startBytes),priorReportSha256:hash(priorBytes),nativeSha256:hash(nativeBytes),lifecycleSha256:hash(lifecycleBytes),previousWallSeconds:prior.wallSeconds+(prior.resume?.previousWallSeconds||0),segments:[...(prior.resume?.segments||[]),{directory:resumeFrom,wallSeconds:prior.wallSeconds,initialTick:prior.segmentInitialTick,finalTick:prior.finalTick}],previousChecks:prior.checks.filter(c=>c.ok),worldTick:startOriginal.state.worldTick,scope};
 lastTick=startOriginal.state.worldTick;
}
async function supplies({foodTarget=12}={}){
 await prepareMaster('daily supply');let current=(await snapshot()).state;
 if(current.stockpilesById[HOME].resources.food<foodTarget){
  await tab('supply');await clickKey('subtab:sources');await clickKey('source:food');await clickKey('source:harvest:food');const activity=(await view()).operations.master.activity;assert.equal(activity.kind,'sr-harvest');
  await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>!s.activitiesById[activity.id]&&(s.stockpilesById[CARRIED]?.resources.food||0)>=16,'finite food harvest');await pause(true);await transfer(CARRIED,HOME,'food',16);record('亲采有限口粮并实际送回HOME',{quantity:16});
 }
 current=(await snapshot()).state;
 if(current.personsById[MASTER].energy<40){
  await tab('growth');await clickKey('growth:rest');if(await key('confirm-action').count())await clickKey('confirm-action');await closePanel();await resumeWorld();await until((v,s)=>s.personsById[MASTER].energy>=90,'master rests at an actual bed',180);await pause(true);record('掌门到床实际休息恢复精力');
 }
}

async function construct(number,cost,{existingOrderId=null}={}){
 phase=`build-gc${number}`;let order;
 if(existingOrderId){order=(await snapshot()).state.workOrdersById[existingOrderId];assert(order&&order.domainSiteId===siteId(number));record('继续原已预留材料的营造工单',{site:number,workOrderId:order.id,cargo:order.materialFlow.cargo});}
 else {await supplies({foodTarget:20});await prepareMaster(`GC${number}`);await openSite(number);
 const before=(await snapshot()).state,preview=(await view()).domain.sites.find(x=>x.id===siteId(number));assert.deepEqual(preview.cost,cost);
 assert(await key(`domain:build:${siteId(number)}`).isEnabled(),preview.reason);await clickKey(`domain:build:${siteId(number)}`);
 const queued=(await snapshot()).state;order=Object.values(queued.workOrdersById).find(o=>o.kind==='construction'&&!before.workOrdersById[o.id]);assert(order);
 for(const[k,n]of Object.entries(cost))assert.equal(before.stockpilesById[HOME].resources[k]-queued.stockpilesById[HOME].resources[k],n);
 assert.equal(queued.worldTick,before.worldTick);record('暂停时预留本处实际营造材料',{site:number,workOrderId:order.id,cost});

 }
 if(existingOrderId&&order.materialFlow.phase==='ready'&&order.progressTicks>=25){await saveReopen(`gc${number}-construction`,{focusSite:number});await resumeWorld();}
 else {await closePanel();await tab('follow');await resumeWorld();
 await until((v,s)=>s.workOrdersById[order.id]?.materialFlow?.phase==='carrying'&&(number===2?s.personsById[MASTER].position.y<0:s.personsById[MASTER].position.x<0),'materials enter the preset region',480);
 await saveReopen(`gc${number}-materials-carrying`);await resumeWorld();
 await until((v,s)=>(s.workOrdersById[order.id]?.progressTicks||0)>=25,'actual onsite construction',480);await pause(true);
 const working=(await snapshot()).state.workOrdersById[order.id];assert(working.materialFlow.trips.every(t=>t.phase==='delivered'));assert(Object.values(working.materialFlow.cargo).every(n=>n===0));
 await saveReopen(`gc${number}-construction`,{focusSite:number});await resumeWorld();}
 await until(v=>v.domain.sites.find(x=>x.id===siteId(number))?.status==='complete','facility completes');await pause(true);
 const done=await checkpoint(`gc${number}-complete`),b=atSite(done.state,number);assert(b);assert.equal(b.level,1);
 await openSite(number);await clickKey('domain:focus');await closePanel();await capture(`gc${number}-scene`);
 record('材料全部送达后实际施工完工',{site:number,buildingId:b.instanceId,transform:b.transform});return b;
}
async function openLin(){await tab('people');await clickKey('person:person:lin-changfeng');await clickKey('person:inspect:person:lin-changfeng');assert.equal(await page.locator('#person-name').innerText(),'林长风');}
async function admitLin(){
 phase='admit-lin';await prepareMaster('formal admission');await openLin();
 if(!(await view()).people.find(p=>p.id==='person:lin-changfeng').admission.distance.near){await tab('approach-person');await resumeWorld();
 await until((v,s)=>{const a=s.personsById[MASTER].position,b=s.personsById['person:lin-changfeng'].position;return Math.hypot(a.x-b.x,a.y-b.y)<=1.5&&!s.personsById[MASTER].scenic.path.length;},'master reaches Lin Changfeng',360);}
 await closePerson();await pause(true);await openLin();const before=await snapshot();
 await clickKey('person:admission');await selectKey('person:rank','outer');await clickKey('person:admission-cancel');assert.deepEqual(await snapshot(),before);record('取消门籍表单保持整个世界');
 await clickKey('person:admission');await selectKey('person:rank','outer');await clickKey('person:admission-confirm');
 const after=await checkpoint('lin-admitted'),membership=after.state.courtyardAdmissions.recordsByPersonId['person:lin-changfeng'];
 assert.equal(after.state.story.step,3);assert.equal(membership.rank,'outer');assert.equal(membership.affiliationId,'scene:yunxiu-courtyard');assert.equal(membership.mentorId,null);
 assert.deepEqual(after.state.homeMemberIds,[...before.state.homeMemberIds,'person:lin-changfeng']);assert.deepEqual(after.state.stockpilesById[HOME].resources,before.state.stockpilesById[HOME].resources);
 const oldPerson=before.state.personsById['person:lin-changfeng'],person=after.state.personsById['person:lin-changfeng'];assert.equal(person.personId,oldPerson.personId);assert.deepEqual(person.appearance,oldPerson.appearance);assert.deepEqual(person.position,oldPerson.position);
 await capture('lin-formal-admission');await closePerson();await closePanel();await saveReopen('three-members-recovery');record('当面确认外门门籍并保留同一林长风',{membership});
}
async function readAtLibrary(building,kind,index=0){
 phase=kind==='family-notes'?'family-notes':`spring-study-${index}`;await supplies();await prepareMaster(phase);await openBuilding(2);
 const before=(await snapshot()).state,action=kind==='family-notes'?'library:collate':'library:study:spring';assert(await key(action).isEnabled());await clickKey(action);
 const queued=(await snapshot()).state,o=Object.values(queued.srCultivation.orders).find(o=>!before.srCultivation.orders[o.id]);assert(o);assert.equal(o.kind,kind);assert.equal(o.parameters.preferredBuildingId,building.instanceId);assert.equal(o.progressTicks,0);assert.equal(before.stockpilesById[HOME].resources.food-queued.stockpilesById[HOME].resources.food,2);
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.srCultivation.orders[o.id].progressTicks>=20,'actual reading at library desk',240);await pause(true);
 const active=(await snapshot()).state,a=active.activitiesById[active.personsById[MASTER].activityId],slot=facilitySlots(active,building,'study').find(slot=>slot.id===a.slotId);assert(slot);assert.equal(a.phase,'executing');assert(Math.hypot(active.personsById[MASTER].position.x-slot.position.x,active.personsById[MASTER].position.y-slot.position.y)<.04);
 if(kind==='family-notes')await saveReopen('family-notes-reading');await resumeWorld();await until((v,s)=>s.srCultivation.orders[o.id].phase==='completed','reading completes');await pause(true);
 const finished=await checkpoint(phase+'-complete');assert.equal(finished.state.srCultivation.orders[o.id].progressTicks,80);
 if(kind==='family-notes'){assert.equal(finished.state.story.step,4);assert(finished.state.factsById['fact:revenge:family-notes']);assert(finished.state.doctrine.books.includes('spring'));assert(finished.state.doctrine.books.includes('foundation'));assert.equal(finished.state.personsById[MASTER].artsById.spring?.understanding||0,0);}
 else assert.equal(finished.state.personsById[MASTER].artsById.spring.understanding,index*12);
 record('到阅卷席后按世界时钟完成阅读',{kind,index,orderId:o.id,buildingId:building.instanceId,slotId:slot.id,tick:finished.state.worldTick});
}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,startBytes,{flag:'wx'});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await snapshot()).state,startOriginal.state);
 if(recovery&&!recovery.complete)await page.evaluate(()=>{const frames=window.__northRecoveryFrames=[];let tick=-1;const first=window.courtyardQA.metrics().tick;function observe(){const now=window.courtyardQA.metrics().tick;if(now!==tick){tick=now;const s=window.courtyardQA.snapshot().state;frames.push({tick,people:['person:master','person:lin-changfeng'].map(id=>{const p=s.personsById[id],a=p.scenic||p.mind.scenic;return{id,x:p.position.x,y:p.position.y,next:a.path[0]||null,steps:a.steps,activityId:p.activityId};})});}if(now-first<100)requestAnimationFrame(observe);}observe();});
 record(resume?'同世界暂停检查点原样续接':'同源筹资世界原样载入',{tick:startOriginal.state.worldTick});await pause(true);await manual();
 phase='restore-original-farm';await openBuilding(20);const oldFarm=Object.values((await snapshot()).state.buildingsById).find(b=>b.type==='farm');assert(oldFarm);if(!oldFarm.enabled)await clickKey('farm:toggle');assert((await snapshot()).state.buildingsById[oldFarm.instanceId].enabled);await closePanel();record('从正式入口恢复原药圃',{buildingId:oldFarm.instanceId});
 if(!resume)await construct(16,{jade:25,wood:20,stone:8});
 if(resume?.kind!=='north-approach'){await admitLin();
 phase='open-north-library';await openSite(2);const before=(await snapshot()).state;await capture('library-locked');await clickKey('domain:enable-north-library');const opened=(await snapshot()).state;for(const field of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(opened[field],before[field]);await clickKey('domain:focus');await closePanel();await capture('library-empty');record('开通北台道路并保留既有人物与资源');}
 const library=await construct(2,{jade:65,wood:45,stone:20},{existingOrderId:resume?.kind==='north-approach'?'work:construction:13':null});assert.equal(facilitySlots((await snapshot()).state,library,'study').length,2);assert.equal(facilitySlots((await snapshot()).state,library,'teach').length,1);
 await readAtLibrary(library,'family-notes');await readAtLibrary(library,'study',1);await readAtLibrary(library,'study',2);await saveReopen('final-recovery');const final=await checkpoint('library-complete');
 assert.equal(final.state.story.step,4);assert.equal(final.state.personsById[MASTER].artsById.spring.understanding,24);assert.equal((await view()).housing.beds.length,20);
 for(const[id,p]of Object.entries(initial.state.personsById)){assert.equal(final.state.personsById[id]?.personId,p.personId);assert.deepEqual(final.state.personsById[id]?.appearance,p.appearance);}
 assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);await openBuilding(2);await capture('library-final');await closePanel();record('家传获得与药理理解有实际阅读来源，身份及20床保留');complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async error=>{errors.push(error.message);await electron?.close().catch(()=>{});});runtimeSha256After=await codeHashes();if(JSON.stringify(runtimeSha256After)!==JSON.stringify(runtimeSha256)){errors.push('Runtime source or loaded assets changed during the run');process.exitCode=1;}if(hash(await fs.readFile(source))!==hash(bytes)){errors.push('Source file changed');process.exitCode=1;}await report();console.log(`Evidence: ${output}`);}
