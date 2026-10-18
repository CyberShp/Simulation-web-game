/** U-167/T-21: one funded world, kitchen construction and physical food service.
 * node tests/acceptance/courtyard-kitchen-desktop.mjs --source=/absolute/source-v2-world.json --output=/absolute/fresh-directory
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
const source=option('source'),requestedOutput=option('output'),resumePath=option('resume'),transitionPath=option('runtime-transition');
assert(source&&requestedOutput&&path.isAbsolute(source)&&path.isAbsolute(requestedOutput),'Pass absolute --source and --output.');
await fs.mkdir(path.dirname(requestedOutput),{recursive:true});
const repository=await fs.realpath(repositoryRoot),output=path.join(await fs.realpath(path.dirname(requestedOutput)),path.basename(requestedOutput));
assert(output!==repository&&!output.startsWith(repository+path.sep));
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original),hash=value=>createHash('sha256').update(value).digest('hex');
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',LU='person:lu-zhiwei',MERCHANT='person:merchant-qingxi',MARKET='stockpile:qingxi';
const siteId=number=>`site:domain:gc-${number}`,atSite=(state,number)=>Object.values(state.buildingsById).find(b=>b.domainSiteId===siteId(number));
assert(!atSite(initial.state,13));assert(initial.state.stockpilesById[HOME].resources.jade>=45);
const target=desktopTarget(),directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const started=performance.now(),checks=[],errors=[],journey=[],interactions=[],saved=[],launchTimings=[],uiTimings=[],mealObservations=[];let timingOffset=0;
let resume=null,startBytes=bytes,startOriginal=original;
if(resumePath){
 assert(path.isAbsolute(resumePath));const priorBytes=await fs.readFile(resumePath),prior=JSON.parse(priorBytes),priorDir=path.dirname(resumePath),nativePath=path.join(priorDir,'world/sect-save.json'),nativeBytes=await fs.readFile(nativePath),native=JSON.parse(nativeBytes),lifecycleBytes=await fs.readFile(path.join(priorDir,'world/lifecycle.jsonl')),continuingCook=prior.phase==='cook-1',evidenceFiles={};let existingOrderId=null;
 assert.equal(prior.sourceSha256,hash(bytes));assert.equal(prior.sourceUnchanged,true);assert.deepEqual(prior.runtimeSha256After,prior.runtimeSha256);assert(['build-gc13','water-purchase','cook-1'].includes(prior.phase));assert.equal(validateSect(native),true);assert.deepEqual(restoreSect(native).state,native.state);assert.equal(native.state.speed,0);
 if(continuingCook){
  const sealed=JSON.parse(await fs.readFile(path.join(priorDir,'sealed-readback.json'))),workingReopen=sealed.status==='saved-working-order-reopened-after-readiness-timeout';
  for(const name of ['sealed-readback.json',...(workingReopen?['meal-working-before.json','failure-world.json']:['root-requested-pause-world.json','root-requested-pause-readback.json'])])evidenceFiles[path.join(priorDir,name)]=hash(await fs.readFile(path.join(priorDir,name)));
  assert.deepEqual(sealed.runtimeErrors,[]);
  if(workingReopen){
   assert.equal(sealed.nativeSha256,hash(nativeBytes));assert.equal(sealed.reportSha256,hash(priorBytes));assert.equal(sealed.lifecycleSha256,hash(lifecycleBytes));assert.equal(sealed.tick,native.state.worldTick);assert.deepEqual(prior.errors,[]);assert(/page.waitForFunction: Timeout 30000ms/.test(prior.checks.at(-1).error));
   assert.deepEqual(native.state,JSON.parse(await fs.readFile(path.join(priorDir,'meal-working-before.json'))).state);assert.deepEqual(native.state,JSON.parse(await fs.readFile(path.join(priorDir,'failure-world.json'))).state);
   assert(lifecycleBytes.toString().includes('close-requested'));
  }else{
   const readback=JSON.parse(await fs.readFile(path.join(priorDir,'root-requested-pause-world.json'))),diagnostic=JSON.parse(await fs.readFile(path.join(priorDir,'root-requested-pause-readback.json')));
   assert.equal(sealed.status,'paused-for-readonly-service-query-repair');assert.equal(sealed.continuation.nativeSha256,hash(nativeBytes));assert.equal(sealed.continuation.reportSha256,hash(priorBytes));assert.equal(sealed.continuation.lifecycleSha256,hash(lifecycleBytes));assert.deepEqual(diagnostic.metrics.errors,[]);assert.deepEqual(native.state,readback.state);assert.deepEqual(native.state,diagnostic.state.state);assert(diagnostic.status.manualPause);assert.equal(sealed.segment.closedTick,native.state.worldTick);
   assert(/Target page, context or browser has been closed/.test(prior.checks.at(-1).error));assert(prior.errors.every(error=>error.startsWith('electronApplication.evaluate: Target page, context or browser has been closed')));
  }
  const serviceOrders=Object.values(native.state.workOrdersById).filter(o=>o.kind==='sr-site-service');assert.equal(serviceOrders.length,1);const o=serviceOrders[0];assert.deepEqual(o,sealed.order);assert.equal(o.phase,workingReopen?'working':'moving');assert(workingReopen?o.progressTicks>=25&&o.progressTicks<o.durationTicks:o.progressTicks===0);assert.deepEqual(o.usedInput,workingReopen?{food:9,cleanWater:2,wood:1}:{});assert.equal(o.workerId,MASTER);assert.equal(o.recipeId,'meal');assert.equal(o.resultFactId,null);assert.deepEqual(native.state.reservationsById[o.reservationId].remainingCost,workingReopen?{food:0,cleanWater:0,wood:0}:{food:9,cleanWater:2,wood:1});assert.equal(native.state.activitiesById[native.state.personsById[MASTER].activityId].serviceOrderId,o.id);existingOrderId=o.id;
 }else{
  const failure=JSON.parse(await fs.readFile(path.join(priorDir,'failure-world.json')));assert.equal(prior.errors.length,0);assert(/page\.screenshot: Timeout|locator\.click: Timeout|transfer:submit|foot remains on active terrain/.test(prior.checks.at(-1).error));assert.deepEqual(native.state,failure.state);
 }
 const construction=Object.values(native.state.workOrdersById).filter(o=>o.kind==='construction'&&o.domainSiteId===siteId(13));if(prior.phase==='build-gc13'){assert.equal(construction.length,1);assert.equal(construction[0].progressTicks,0);assert(construction[0].materialFlow.trips.some(t=>t.phase==='delivered'));}else{assert.equal(atSite(native.state,13)?.level,1);if(!continuingCook)assert.equal(Object.values(native.state.workOrdersById).filter(o=>o.kind==='sr-site-service').length,0);}
 const lifecycle=lifecycleBytes.toString().trim().split('\n').map(x=>JSON.parse(x));assert.equal(lifecycle.at(-1).type,'closed');if(!continuingCook)assert(lifecycle.some(e=>e.type==='close-requested'));
 resume={stage:prior.phase,existingOrderId,evidenceFiles,reportPath:resumePath,reportSha256:hash(priorBytes),nativePath,nativeSha256:hash(nativeBytes),lifecycleSha256:hash(lifecycleBytes),previousWallSeconds:prior.totalActiveWallSeconds||prior.wallSeconds,previousSegmentWallSeconds:prior.wallSeconds,previousResume:prior.resume||null,previousInitialTick:prior.initialTick,resumeTick:native.state.worldTick,runtimeSha256:prior.runtimeSha256,priorSuccessfulChecks:prior.checks.filter(c=>c.ok)};startBytes=nativeBytes;startOriginal=native;
}
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
async function pause(wanted){if((await read()).status.manualPause!==wanted)await tab('pause');}
async function closePerson(){if(await page.locator('#dialog').isVisible())await tab('close-person');}
async function closePanel(){if(await page.locator('#management').isVisible())await tab('close-management');}
async function manual(){await tab('affairs');await clickKey('affairs:policy');await clickKey('policy:manual');await closePanel();}
async function resumeWorld(){await pause(true);await manual();await pause(false);}
async function openSite(number){await tab('affairs');await selectKey('domain:region','Z-02');await clickKey(`domain:site:${siteId(number)}`);}
async function openBuilding(number){await openSite(number);await clickKey('domain:building');}
async function openStock(id){await tab('supply');await clickKey('subtab:stocks');await selectKey('stocks:owner','all');await clickKey(`stock:${id}`);}
async function capture(name){await page.screenshot({path:path.join(output,`${name}.png`),timeout:60000});await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText());}
async function checkpoint(name){const session=await snapshot();assert.equal(validateSect(session),true);lastTick=session.state.worldTick;const file=`${name}.json`;await fs.writeFile(path.join(output,file),JSON.stringify(session)+'\n');saved.push({name,file,tick:session.state.worldTick,sha256:hash(JSON.stringify(session))});return session;}
async function collectTiming(){if(page&&!page.isClosed()){const entries=await page.evaluate(offset=>(window.__kitchenReadOnlyTiming||[]).slice(offset),timingOffset).catch(()=>[]);timingOffset+=entries.length;uiTimings.push(...entries);}}
async function report(){await collectTiming();await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':checks.some(c=>!c.ok)||errors.length?'failed':'running',phase,source,sourceSha256:hash(bytes),sourceProvenance:original.provenance,platform:process.platform,resume,segmentInitialTick:startOriginal.state.worldTick,totalActiveWallSeconds:wall()+(resume?.previousWallSeconds||0),runtimeTransition,scope:'macOS source Electron; one unchanged funded world; actual kitchen construction, merchant water purchase, on-site cooking and meals; public UI and wall clock.',runtimeSha256,runtimeSha256After,sourceUnchanged:hash(await fs.readFile(source))===hash(bytes),wallSeconds:wall(),initialTick:initial.state.worldTick,finalTick:lastTick,simulatedSeconds:(lastTick-initial.state.worldTick)/10,checks,errors,interactions,saved,journey,launchTimings,uiTimings,mealObservations},null,2)+'\n');}
async function launch(){const launchStarted=performance.now();const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});timingOffset=0;launchTimings.push({wallSeconds:wall(),readyMilliseconds:performance.now()-launchStarted});
 await page.evaluate(()=>{const log=window.__kitchenReadOnlyTiming=[];const sample=()=>({at:Date.now(),mono:performance.now(),tick:window.courtyardQA.metrics().tick,paused:window.courtyardQA.status().manualPause});new PerformanceObserver(list=>{for(const e of list.getEntries())log.push({kind:'longtask',start:e.startTime,duration:e.duration,at:Date.now()});}).observe({type:'longtask',buffered:true});document.addEventListener('click',e=>{if(e.target.id!=='pause')return;const before={kind:'pause-click',...sample()};log.push(before);requestAnimationFrame(()=>log.push({kind:'pause-next-frame',from:before.mono,...sample()}));},{capture:true,passive:true});});}
async function close(){await collectTiming();const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
async function until(predicate,label,seconds=180){
 const begin=performance.now();let renew=begin,announce=begin,last=-1;
 while(performance.now()-begin<seconds*1000){
  const {view:v,session}=await read(),s=session.state;lastTick=v.tick;
  if(v.tick!==last){
   const people=v.people.filter(person=>[MASTER,LU].includes(person.id)).map(person=>({id:person.id,x:person.x,y:person.y,art:toArt(person.x,person.y),indoor:person.indoor}));
   for(const person of people)if(!person.indoor&&!isArtWalkable(person.art.x,person.art.y,{valley:v.domain.valleyEnabled,west:v.domain.westEnabled,domain:v.domain.enabled,residences:v.domain.residencesEnabled,services:v.domain.servicesEnabled})){await fs.writeFile(path.join(output,'first-invalid-foot.json'),JSON.stringify({tick:v.tick,wallSeconds:wall(),phase,person,session},null,2)+'\n');assert.fail(`${person.id} foot remains on active terrain`);}
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
const sourceFiles=[...(await fs.readdir(path.join(repository,'src/simulation'))).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...(await fs.readdir(path.join(repository,'apps/courtyard'))).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...(await fs.readdir(path.join(repository,'assets/courtyard'))).filter(x=>/^(east-services|east-residences|east-terrace|residence|north-library)/.test(x)).map(x=>'assets/courtyard/'+x)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await fs.readFile(path.join(repository,file)))])));
const runtimeSha256=await codeHashes();let runtimeSha256After=null,runtimeTransition=null;
if(resume&&JSON.stringify(runtimeSha256)!==JSON.stringify(resume.runtimeSha256)){
 assert(transitionPath&&path.isAbsolute(transitionPath),'A changed runtime requires an explicit reviewed transition manifest.');const transitionBytes=await fs.readFile(transitionPath),transition=JSON.parse(transitionBytes);assert.deepEqual(transition.from,resume.runtimeSha256);assert.deepEqual(transition.to,runtimeSha256);assert(transition.reason&&transition.evidencePaths?.length);runtimeTransition={manifestPath:transitionPath,manifestSha256:hash(transitionBytes),...transition};
} else if(resume)assert.deepEqual(runtimeSha256,resume.runtimeSha256);
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
async function buildKitchen(){
 phase='build-gc13';const completedBuilding=atSite((await snapshot()).state,13);if(completedBuilding){record('精确续接已完工膳房',{buildingId:completedBuilding.instanceId});return completedBuilding;}const existing=Object.values((await snapshot()).state.workOrdersById).find(o=>o.kind==='construction'&&o.domainSiteId===siteId(13));if(!existing)await prepareMaster('GC13');await openSite(13);
 const before=(await snapshot()).state,preview=(await view()).domain.sites.find(x=>x.id===siteId(13));assert.deepEqual(preview.cost,{jade:45,wood:35,stone:20});
 let order=existing;if(!existing){assert(await key(`domain:build:${siteId(13)}`).isEnabled(),preview.reason);await clickKey(`domain:build:${siteId(13)}`);
 const queued=(await snapshot()).state;order=Object.values(queued.workOrdersById).find(o=>o.kind==='construction'&&!before.workOrdersById[o.id]);assert(order);
 for(const[k,n]of Object.entries(preview.cost))assert.equal(before.stockpilesById[HOME].resources[k]-queued.stockpilesById[HOME].resources[k],n);
 assert.equal(queued.worldTick,before.worldTick);record('暂停时正式预留膳房营造材料',{workOrderId:order.id,cost:preview.cost});}else record('从原生关闭档继续已有膳房营造',{workOrderId:order.id,materialFlow:order.materialFlow});
 await closePanel();await tab('follow');await resumeWorld();
 await until((v,s)=>s.workOrdersById[order.id]?.materialFlow?.phase==='carrying'&&s.personsById[MASTER].position.x>186,'kitchen materials enter the new service ground',480);await saveReopen('gc13-materials-carrying');
 await resumeWorld();await until((v,s)=>(s.workOrdersById[order.id]?.progressTicks||0)>=25,'kitchen onsite construction',480);await pause(true);
 const active=(await snapshot()).state.workOrdersById[order.id];assert(active.materialFlow.trips.every(t=>t.phase==='delivered'));assert(Object.values(active.materialFlow.cargo).every(n=>n===0));
 await saveReopen('gc13-construction',{focusSite:13});await resumeWorld();await until(v=>v.domain.sites.find(x=>x.id===siteId(13))?.status==='complete','kitchen completion');await pause(true);
 const completed=await checkpoint('gc13-complete'),b=atSite(completed.state,13);assert(b);assert.equal(b.level,1);assert.equal(b.serviceVersion,'site-services:yunxiu:v1');
 assert.equal(facilitySlots(completed.state,b,'work').length,2);assert.equal(facilitySlots(completed.state,b,'eat').length,4);assert.equal(completed.state.stockpilesById[`stockpile:${b.instanceId}`].capacity,320);
 await openSite(13);await clickKey('domain:focus');await closePanel();await capture('gc13-scene');await openBuilding(13);await capture('gc13-services');await closePanel();
 record('膳房实际运料与施工完成，两灶四用膳位及现场货位成立',{buildingId:b.instanceId,position:b.transform,commission:completed.state.factsById[`fact:site-service:${b.instanceId}`]});return b;
}
async function buyWater(){
 phase='water-purchase';await prepareMaster('water funding');let current=(await snapshot()).state,carried=current.stockpilesById[CARRIED].resources,needsSale=(carried.jade||0)<16&&current.stockpilesById[HOME].resources.jade+(carried.jade||0)<16;
 const fromHome=Math.max(0,(needsSale?7:16)-(carried.jade||0));if(fromHome)await transfer(HOME,CARRIED,'jade',fromHome);
 if(needsSale&&(carried.stone||0)<10){await tab('supply');await clickKey('subtab:sources');await clickKey('source:stone');await clickKey('source:harvest:stone');const activity=(await view()).operations.master.activity;assert.equal(activity.kind,'sr-harvest');await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>!s.activitiesById[activity.id]&&(s.stockpilesById[CARRIED].resources.stone||0)>=10,'finite stone harvest for water funding',360);await pause(true);record('实际亲采有限10石补足买水资金',{activityId:activity.id});}

 const merchantHere=s=>{const p=s.personsById[MERCHANT];return p.position.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard'&&p.courtyardVisit?.phase==='present';};
 let met=false;
 for(let attempt=0;attempt<8&&!met;attempt++){
  await closePerson();await closePanel();await resumeWorld();await until((v,s)=>merchantHere(s)&&(s.stockpilesById[MARKET].resources.cleanWater||0)>=20&&(!needsSale||s.stockpilesById[MARKET].resources.jade>=9),'finite water procurement and merchant arrival',600);await pause(true);
  await tab('supply');await clickKey('supply:water-merchant');
  if(await page.locator('#approach-person').isVisible()){await tab('approach-person');await resumeWorld();await until((v,s)=>!merchantHere(s)||Math.hypot(s.personsById[MASTER].position.x-s.personsById[MERCHANT].position.x,s.personsById[MASTER].position.y-s.personsById[MERCHANT].position.y)<3,'master actually approaches visiting merchant',360);}
  current=(await snapshot()).state;met=merchantHere(current)&&Math.hypot(current.personsById[MASTER].position.x-current.personsById[MERCHANT].position.x,current.personsById[MASTER].position.y-current.personsById[MERCHANT].position.y)<3;
  if(!met)record('商人已按时离场，等待下一次真实到访',{attempt:attempt+1,tick:current.worldTick});
 }
 assert(met,'the master must actually meet the merchant');
 assert(await key('person:trade').isVisible());
 if(needsSale){await clickKey('person:trade');const beforeSale=(await snapshot()).state;assert(await key('person:trade-confirm').isEnabled());await clickKey('person:trade-confirm');const sold=(await snapshot()).state;assert.equal(beforeSale.stockpilesById[CARRIED].resources.stone-sold.stockpilesById[CARRIED].resources.stone,10);assert.equal(sold.stockpilesById[CARRIED].resources.jade-beforeSale.stockpilesById[CARRIED].resources.jade,9);assert.deepEqual(sold.stockpilesById[HOME].resources,beforeSale.stockpilesById[HOME].resources);record('当面出售实际10石取得9随身灵石',{history:sold.srEconomy.tradeHistory.at(-1)});}
 await clickKey('person:trade');await selectKey('person:trade-resource','cleanWater');await selectKey('person:trade-side','buy');await selectKey('person:trade-batches','2');
 const before=(await snapshot()).state;assert(await key('person:trade-confirm').isEnabled());await capture('water-buy-quote');await wait(1000);assert.deepEqual((await snapshot()).state,before);await clickKey('person:trade-confirm');
 const after=(await snapshot()).state;assert.equal(after.stockpilesById[CARRIED].resources.cleanWater-(before.stockpilesById[CARRIED].resources.cleanWater||0),20);assert.equal(before.stockpilesById[CARRIED].resources.jade-after.stockpilesById[CARRIED].resources.jade,16);assert.equal(before.stockpilesById[MARKET].resources.cleanWater-after.stockpilesById[MARKET].resources.cleanWater,20);assert.deepEqual(after.stockpilesById[HOME].resources,before.stockpilesById[HOME].resources);
 record('当面支付16随身灵石，取得商人实际运来的20洁水',{tick:after.worldTick,history:after.srEconomy.tradeHistory.at(-1)});await closePerson();await saveReopen('water-purchased');
}
async function cook(b,index,{existingOrderId=null}={}){
 phase=`cook-${index}`;const stock=`stockpile:${b.instanceId}`;let o;
 if(existingOrderId){
  const current=(await snapshot()).state;o=current.workOrdersById[existingOrderId];assert.equal(o.targetId,b.instanceId);assert.deepEqual(o,startOriginal.state.workOrdersById[existingOrderId]);assert.deepEqual(current.reservationsById[o.reservationId],startOriginal.state.reservationsById[o.reservationId]);assert.equal(current.activitiesById[current.personsById[MASTER].activityId].serviceOrderId,o.id);record('同一料理工单与实际材料账原样续接',{orderId:o.id,tick:current.worldTick,progressTicks:o.progressTicks});
 }else{
  await supplies();await prepareMaster('cooking');await openBuilding(13);const before=(await snapshot()).state;
  await clickKey('service:start:meal');const queued=(await snapshot()).state;o=Object.values(queued.workOrdersById).find(o=>o.kind==='sr-site-service'&&!before.workOrdersById[o.id]);assert(o);assert.equal(o.progressTicks,0);assert.deepEqual(o.recipeSnapshot.input,{food:9,cleanWater:2,wood:1});assert.equal(o.durationTicks,120);
  const reserved=queued.reservationsById[o.reservationId];assert.deepEqual(reserved.remainingCost,o.recipeSnapshot.input);for(const[k,n]of Object.entries(o.recipeSnapshot.input))assert.equal(before.stockpilesById[stock].resources[k]-queued.stockpilesById[stock].resources[k],n);
  await clickKey(`service:master:${o.id}`);const assigned=(await snapshot()).state,body=assigned.activitiesById[assigned.personsById[MASTER].activityId];assert.equal(body.serviceOrderId,o.id);assert.equal(o.progressTicks,0);assert.equal(assigned.workOrdersById[o.id].progressTicks,0);
 }
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].progressTicks>=25,'actual stove work',360);await pause(true);
 const working=(await snapshot()).state,w=working.workOrdersById[o.id],a=working.activitiesById[working.personsById[MASTER].activityId],slot=facilitySlots(working,b,'work').find(x=>x.id===a.slotId);assert.equal(a.phase,'executing');assert.equal(a.slotId,`${b.instanceId}/slot:work:1`);assert(Math.hypot(working.personsById[MASTER].position.x-slot.position.x,working.personsById[MASTER].position.y-slot.position.y)<.04);assert.deepEqual(w.usedInput,o.recipeSnapshot.input);
 await openBuilding(13);await capture(`meal-${index}-working`);await closePanel();if(index===1)await saveReopen('meal-working');
 await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].phase==='completed','meal batch completion');await pause(true);const done=(await snapshot()).state,result=done.factsById[done.workOrdersById[o.id].resultFactId];assert(result);assert.equal(done.workOrdersById[o.id].progressTicks,120);assert.deepEqual(result.output,{meal:10});assert.equal(Object.values(done.factsById).filter(f=>f.workOrderId===o.id&&f.kind==='site-service-completed').length,1);
 await checkpoint(`meal-${index}-complete`);record('实际到灶后完成一批饭食并生成唯一结果',{index,orderId:o.id,output:result.output,finishedTick:done.workOrdersById[o.id].finishedTick});
}
async function eatAndSettle(b){
 phase='eat-and-daily-settlement';await prepareMaster('meal');let s=(await snapshot()).state;
 const commission=s.factsById[`fact:site-service:${b.instanceId}`],firstDay=Math.floor((worldTime(s)-(s.worldTick-commission.atTick)/10)/120);
 if(day(s)<=firstDay){await resumeWorld();await until((v,x)=>day(x)>firstDay,'first eligible meal day',150);await pause(true);}
 for(let i=0;i<2;i++){
  await openBuilding(13);const before=(await snapshot()).state;assert(await key('service:eat:meal').isEnabled());await clickKey('service:eat:meal');const queued=(await snapshot()).state,o=Object.values(queued.workOrdersById).find(o=>o.kind==='sr-site-meal'&&o.personId===MASTER&&!before.workOrdersById[o.id]);assert(o);assert.equal(o.resultFactId,null);assert.equal(queued.reservationsById[o.reservationId].remainingCost.meal,1);
  const slot=facilitySlots(queued,b,'eat').find(x=>x.id===o.slotId);
  await page.evaluate(({orderId,personId,slot})=>{
   const observation=window.__kitchenMealObservation={orderId,slot,samples:[],firstResult:null,stopped:false};let last=-1;
   const observe=()=>{if(observation.stopped)return;const tick=window.courtyardQA.metrics().tick;if(tick!==last){last=tick;const s=window.courtyardQA.snapshot().state,o=s.workOrdersById[orderId],p=s.personsById[personId],sample={tick:s.worldTick,at:Date.now(),phase:o.phase,orderSlotId:o.slotId,position:{...p.position},resultFactId:o.resultFactId};observation.samples.push(sample);if(o.resultFactId){observation.firstResult={...sample,fact:s.factsById[o.resultFactId]};observation.stopped=true;return;}if(o.phase==='cancelled'){observation.stopped=true;return;}}requestAnimationFrame(observe);};requestAnimationFrame(observe);
  },{orderId:o.id,personId:MASTER,slot});
  await closePanel();await resumeWorld();await until((v,x)=>x.workOrdersById[o.id].phase==='completed','master reaches actual dining seat');await pause(true);s=(await snapshot()).state;const fact=s.factsById[s.workOrdersById[o.id].resultFactId],observation=await page.evaluate(()=>window.__kitchenMealObservation);mealObservations.push(observation);await fs.writeFile(path.join(output,`meal-${i+1}-arrival-observation.json`),JSON.stringify(observation,null,2)+'\n');await checkpoint(`meal-${i+1}-paused-after-arrival`);
  const arrival=observation.firstResult;assert(arrival,'read-only frame observation must capture the meal result');assert.equal(fact.personId,MASTER);assert.equal(arrival.fact.id,fact.id);assert.equal(arrival.orderSlotId,o.slotId);assert(Math.hypot(arrival.position.x-slot.position.x,arrival.position.y-slot.position.y)<.04);record('掌门实际到用膳位消耗一份饭食',{orderId:o.id,slotId:o.slotId,fact,arrivalTick:arrival.tick,pausedTick:s.worldTick});
 }
 await openBuilding(13);assert(await key('service:eat:meal').isDisabled());await capture('master-dining');await closePanel();await saveReopen('meal-credit-recovery');
 const before=(await snapshot()).state,mealDay=day(before),ownMeals=Object.values(before.factsById).filter(f=>f.kind==='site-meal-consumed'&&f.personId===MASTER&&f.dayIndex===mealDay);assert.equal(ownMeals.length,2);
 await resumeWorld();await until((v,x)=>day(x)>mealDay,'next day settles only uneaten food',150);await pause(true);const after=(await snapshot()).state;
 const debt=[MASTER,...before.homeMemberIds].filter(id=>after.personsById[id].lifeStatus!=='dead').reduce((sum,id)=>sum+Math.max(0,2-Object.values(after.factsById).filter(f=>f.kind==='site-meal-consumed'&&f.personId===id&&f.dayIndex===mealDay).length),0);
 assert(Math.abs(before.stockpilesById[HOME].resources.food-after.stockpilesById[HOME].resources.food-debt)<1e-7);record('次日日结只扣各人未吃份额，掌门两份熟食不再扣原粮',{mealDay,debt,homeFoodBefore:before.stockpilesById[HOME].resources.food,homeFoodAfter:after.stockpilesById[HOME].resources.food});
}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,startBytes,{flag:'wx'});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await snapshot()).state,startOriginal.state);record(resume?'原生关闭世界精确续接':'膳房筹资来源完整原样载入',{tick:startOriginal.state.worldTick,nativeSha256:resume?.nativeSha256});await pause(true);await manual();
 if(!resume){phase='open-services';await openSite(13);const before=(await snapshot()).state;await capture('gc13-locked');await clickKey('domain:enable-services');const opened=(await snapshot()).state;for(const name of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(opened[name],before[name]);await clickKey('domain:focus');await closePanel();await capture('services-open');record('显式开通服务道路，既有人物与物资保持');
 await tab('supply');await clickKey('supply:enable-services');await closePanel();const supply=(await snapshot()).state;assert.equal(supply.stockpilesById['stockpile:qingxi-supplier'].resources.cleanWater,320);assert.equal(supply.stockpilesById[MARKET].resources.cleanWater||0,0);record('有限320洁水来源已登记，商人仍需真实采购');}
 const b=await buildKitchen(),stock=`stockpile:${b.instanceId}`;if(resume?.stage!=='cook-1'){await buyWater();await transfer(CARRIED,stock,'cleanWater',4,{saveDuring:'water-to-kitchen'});await supplies({foodTarget:30});await transfer(HOME,stock,'food',18);await transfer(HOME,stock,'wood',2);}
 await cook(b,1,{existingOrderId:resume?.existingOrderId});await cook(b,2);await eatAndSettle(b);await saveReopen('final-recovery');const final=await checkpoint('kitchen-complete');lastTick=final.state.worldTick;
 assert.equal(Object.values(final.state.workOrdersById).filter(o=>o.kind==='sr-site-service'&&o.targetId===b.instanceId&&o.phase==='completed').length,2);assert.equal(final.state.stockpilesById[stock].resources.food,0);assert.equal(final.state.stockpilesById[stock].resources.wood,0);assert.equal(final.state.stockpilesById[stock].resources.cleanWater,0);
 const meals=Object.values(final.state.factsById).filter(f=>f.kind==='site-meal-consumed'&&f.buildingId===b.instanceId);assert.equal(final.state.stockpilesById[stock].resources.meal+meals.length,20);
 for(const[id,p]of Object.entries(initial.state.personsById)){assert.equal(final.state.personsById[id]?.personId,p.personId);assert.deepEqual(final.state.personsById[id]?.appearance,p.appearance);}assert.deepEqual(final.state.homeMemberIds,initial.state.homeMemberIds);assert.equal((await view()).housing.beds.length,20);
 assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);await openBuilding(13);await capture('kitchen-final');await closePanel();record('两批投入产出与用膳守恒，20床和既有人物保留，运行错误为零');complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async error=>{errors.push(error.message);await electron?.close().catch(()=>{});});runtimeSha256After=await codeHashes();if(JSON.stringify(runtimeSha256After)!==JSON.stringify(runtimeSha256)){errors.push('Runtime source or loaded assets changed during the run');process.exitCode=1;}if(hash(await fs.readFile(source))!==hash(bytes)){errors.push('Source file changed');process.exitCode=1;}if(resume){for(const[file,expected]of[[resume.nativePath,resume.nativeSha256],[resume.reportPath,resume.reportSha256],[path.join(path.dirname(resume.reportPath),'world/lifecycle.jsonl'),resume.lifecycleSha256],...Object.entries(resume.evidenceFiles||{})])if(hash(await fs.readFile(file))!==expected){errors.push('Continuation evidence changed: '+file);process.exitCode=1;}}await report();console.log(`Evidence: ${output}`);}
