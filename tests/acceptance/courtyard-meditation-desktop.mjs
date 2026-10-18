/** U-167/T-24: same-world GC03 survey, construction, progression and maintenance.
 * node tests/acceptance/courtyard-meditation-desktop.mjs --source=/absolute/source-v2-world.json --output=/absolute/fresh-directory
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
import {facilitySlots,slotById} from '../../src/simulation/ea-facility-slots.mjs';
import {sceneUnits} from '../../src/simulation/ea-sr-spatial.mjs';
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
assert(atSite(initial.state,2));assert(atSite(initial.state,16));assert(!atSite(initial.state,3));assert(initial.state.story.step>=4);assert(initial.state.stockpilesById[HOME].resources.jade>=60);
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
async function collectTiming(){if(page&&!page.isClosed()){const entries=await page.evaluate(offset=>(window.__meditationReadOnlyTiming||[]).slice(offset),timingOffset).catch(()=>[]);timingOffset+=entries.length;uiTimings.push(...entries);}}
async function report(){await collectTiming();await fs.writeFile(path.join(output,'report.json'),JSON.stringify({startedAt,status:complete&&!errors.length?'passed':checks.some(c=>!c.ok)||errors.length?'failed':'running',phase,source,sourceSha256:hash(bytes),sourceProvenance:original.provenance,platform:process.platform,resume,segmentInitialTick:startOriginal.state.worldTick,totalActiveWallSeconds:wall()+(resume?.previousWallSeconds||0),runtimeTransition,scope:'macOS source Electron; one unchanged funded world; actual GC03 survey, construction, qi-layer breakthrough, seated cultivation and onsite maintenance; public UI and wall clock.',runtimeSha256,runtimeSha256After,sourceUnchanged:hash(await fs.readFile(source))===hash(bytes),wallSeconds:wall(),initialTick:initial.state.worldTick,finalTick:lastTick,simulatedSeconds:(lastTick-initial.state.worldTick)/10,checks,errors,interactions,saved,journey,launchTimings,uiTimings,recovery},null,2)+'\n');}
async function launch(){const launchStarted=performance.now();const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});timingOffset=0;launchTimings.push({wallSeconds:wall(),readyMilliseconds:performance.now()-launchStarted});
 await page.evaluate(()=>{const log=window.__meditationReadOnlyTiming=[];const sample=()=>({at:Date.now(),mono:performance.now(),tick:window.courtyardQA.metrics().tick,paused:window.courtyardQA.status().manualPause});new PerformanceObserver(list=>{for(const e of list.getEntries())log.push({kind:'longtask',start:e.startTime,duration:e.duration,at:Date.now()});}).observe({type:'longtask',buffered:true});document.addEventListener('click',e=>{if(e.target.id!=='pause')return;const before={kind:'pause-click',...sample()};log.push(before);requestAnimationFrame(()=>log.push({kind:'pause-next-frame',from:before.mono,...sample()}));},{capture:true,passive:true});});}
async function close(){await collectTiming();const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
// The measured north road's positive-y edge is x47.36; include its .26m body radius.
// The pre-existing east road beyond x47.62 retains the whole-scene centre check.
function circleOnGround(person,domain){for(let i=-1;i<16;i++){const a=toArt(person.x+(i<0?0:.26*Math.cos(i*Math.PI/8)),person.y+(i<0?0:.26*Math.sin(i*Math.PI/8)));if(!isArtWalkable(a.x,a.y,{valley:domain.valleyEnabled,west:domain.westEnabled,domain:domain.enabled,residences:domain.residencesEnabled,services:domain.servicesEnabled,northLibrary:domain.northLibraryEnabled,northMeditation:domain.northMeditationEnabled}))return false;}return true;}
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
   for(const person of people)if(!person.indoor&&!(recovery&&[MASTER,'person:lin-changfeng'].includes(person.id)&&(!recovery.recoveredAt[person.id]||v.tick<recovery.recoveredAt[person.id]))&&(!isArtWalkable(person.art.x,person.art.y,{valley:v.domain.valleyEnabled,west:v.domain.westEnabled,domain:v.domain.enabled,residences:v.domain.residencesEnabled,services:v.domain.servicesEnabled,northLibrary:v.domain.northLibraryEnabled,northMeditation:v.domain.northMeditationEnabled})||(v.domain.northLibraryEnabled&&(person.y<1||person.x>=18&&person.x<=47.62&&person.y>=1&&person.y<=34)&&!circleOnGround(person,v.domain)))){await fs.writeFile(path.join(output,'first-invalid-foot.json'),JSON.stringify({tick:v.tick,wallSeconds:wall(),phase,person,session},null,2)+'\n');assert.fail(`${person.id} foot remains on active terrain`);}
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
const sourceFiles=[...(await fs.readdir(path.join(repository,'src/simulation'))).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...(await fs.readdir(path.join(repository,'apps/courtyard'))).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...(await fs.readdir(path.join(repository,'assets/courtyard'))).filter(x=>/^(north-meditation|north-library|west-forest|east-services|east-residences|east-terrace|residence)/.test(x)).map(x=>'assets/courtyard/'+x)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await fs.readFile(path.join(repository,file)))])));
const runtimeSha256=await codeHashes();let runtimeSha256After=null,runtimeTransition=null;
if(original.provenance.runtimeTransition&&!transitionFile){runtimeTransition=original.provenance.runtimeTransition;for(const[file,sha]of Object.entries(runtimeTransition.manifest.to))assert.equal(runtimeSha256[file],sha,`funding-to-desktop runtime ${file}`);}
if(transitionFile){assert(resumeFrom&&path.isAbsolute(transitionFile));const manifestBytes=await fs.readFile(transitionFile),manifest=JSON.parse(manifestBytes);assert.deepEqual(manifest.to,runtimeSha256);runtimeTransition={path:transitionFile,sha256:hash(manifestBytes),manifest};}
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
 await until((v,s)=>s.workOrdersById[order.id]?.materialFlow?.phase==='carrying'&&(number===3?s.personsById[MASTER].position.y<-24:s.personsById[MASTER].position.y<0),'materials enter the preset region',480);
 await saveReopen(`gc${number}-materials-carrying`);await resumeWorld();
 await until((v,s)=>(s.workOrdersById[order.id]?.progressTicks||0)>=25,'actual onsite construction',480);await pause(true);
 const working=(await snapshot()).state.workOrdersById[order.id];assert(working.materialFlow.trips.every(t=>t.phase==='delivered'));assert(Object.values(working.materialFlow.cargo).every(n=>n===0));
 await saveReopen(`gc${number}-construction`,{focusSite:number});await resumeWorld();}
 await until(v=>v.domain.sites.find(x=>x.id===siteId(number))?.status==='complete','facility completes');await pause(true);
 const done=await checkpoint(`gc${number}-complete`),b=atSite(done.state,number);assert(b);assert.equal(b.level,1);
 await openSite(number);await clickKey('domain:focus');await closePanel();await capture(`gc${number}-scene`);
 record('材料全部送达后实际施工完工',{site:number,buildingId:b.instanceId,transform:b.transform});return b;
}

async function survey(){
 phase='survey-source';await supplies();await prepareMaster('survey');await openSite(3);
 const before=(await snapshot()).state;assert.equal(before.spiritSources,undefined);assert(!(await key(`domain:build:${siteId(3)}`).isEnabled()));
 await clickKey('meditation:survey');const queued=(await snapshot()).state,o=Object.values(queued.workOrdersById).find(o=>o.kind==='sr-spirit-survey'&&!before.workOrdersById[o.id]);assert(o);assert.equal(o.progressTicks,0);assert.equal(queued.spiritSources.discoveredAtTick,null);assert.equal(queued.personsById[MASTER].xp,before.personsById[MASTER].xp);assert.deepEqual(queued.stockpilesById,before.stockpilesById);
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].progressTicks>=20,'actual onsite survey',480);await saveReopen('meditation-survey-in-progress');await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].phase==='completed','survey completes');await pause(true);
 const done=(await snapshot()).state;assert.equal(done.workOrdersById[o.id].progressTicks,80);assert.equal(done.spiritSources.discoveredAtTick,done.workOrdersById[o.id].finishedTick);assert(done.factsById[done.workOrdersById[o.id].resultFactId]);record('掌门实际勘察后开放聚灵台营造',{orderId:o.id,discoveredAtTick:done.spiritSources.discoveredAtTick});
}
async function progressQi(){
 const sourceState=(await snapshot()).state;if(sourceState.personsById[MASTER].xp<(await view()).operations.master.xpNeed)return;
 phase='qi-layer-breakthrough';await supplies();await prepareMaster(phase);await tab('growth');
 const before=(await snapshot()).state,v=(await view()).operations.master.breakthrough;assert(v.entryAvailable,v.entryReason);await clickKey('growth:breakthrough');
 const queued=(await snapshot()).state,o=Object.values(queued.srCultivation.orders).find(o=>o.kind==='breakthrough'&&!before.srCultivation.orders[o.id]);assert(o);assert.equal(o.progressTicks,0);assert.equal(o.consumed,false);for(const[k,n]of Object.entries(v.cost))assert.equal(before.stockpilesById[HOME].resources[k]-queued.stockpilesById[HOME].resources[k],n);
 const observations=[];
 const observe=(v,s)=>{const current=s.srCultivation.orders[o.id],p=s.personsById[MASTER],body=s.activitiesById[p.activityId];
  if(current.progressTicks>0&&current.phase!=='completed'){
   const slot=slotById(s,body?.slotId);assert(slot,'breakthrough uses an actual reserved seat');assert.equal(body.orderId,o.id);assert.equal(slot.buildingId,s.buildingsById[current.workstationId]?.id);assert.equal(s.reservationsById[body.reservationId]?.slotId,slot.id);
   assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<=sceneUnits(s,1)+1e-6,'actual feet reached the cultivation seat');
   assert.equal(current.consumed,current.progressTicks>=30);assert.equal(current.refineStarted,current.progressTicks>=30);
   if(observations.at(-1)?.tick!==s.worldTick)observations.push({tick:s.worldTick,progressTicks:current.progressTicks,consumed:current.consumed,refineStarted:current.refineStarted,workstationId:current.workstationId,slotId:slot.id,position:{...p.position},sourceStockpileId:current.sourceStockpileId,cost:current.cost});
  }return current.progressTicks>=40;
 };
 await closePanel();await tab('follow');await resumeWorld();await until(observe,'actual refining at cultivation seat',360);
 assert(observations.some(x=>x.progressTicks>0&&x.progressTicks<30&&!x.consumed),'observe actual pre-refining preparation');assert(observations.some(x=>x.progressTicks>=30&&x.consumed),'observe actual material refining');
 await fs.writeFile(path.join(output,'qi-layer-observations.json'),JSON.stringify(observations,null,2)+'\n');await saveReopen('qi-refining');await resumeWorld();await until((v,s)=>s.srCultivation.orders[o.id].phase==='completed','qi breakthrough completes');await pause(true);
 const done=(await snapshot()).state;assert.equal(done.personsById[MASTER].realm,before.personsById[MASTER].realm+1);assert.equal(done.personsById[MASTER].xp,0);assert.equal(done.srCultivation.orders[o.id].progressTicks,180);assert(done.srCultivation.orders[o.id].consumed);record('正式突破在实际练位完成并只提升一层',{orderId:o.id,cost:v.cost,realm:done.personsById[MASTER].realm});
}
async function practice(building){
 phase='seated-cultivation';await supplies();await prepareMaster(phase);await openBuilding(3);const source=(await view()).operations.meditation.buildings.find(x=>x.buildingId===building.instanceId),seat=source.seats.find(x=>x.available);assert(seat,JSON.stringify(source.seats));
 const before=(await snapshot()).state;await clickKey(`meditation:cultivate:${seat.slotId}`);const queued=(await snapshot()).state;assert.equal(queued.personsById[MASTER].xp,before.personsById[MASTER].xp);assert.equal(queued.spiritSources.extractedMilli,before.spiritSources.extractedMilli);
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.spiritSources.lastPulse?.allocations.some(a=>a.personId===MASTER&&a.slotId===seat.slotId&&a.afterXp>a.beforeXp),'selected seat supplies actual cultivation',360);await pause(true);
 const active=(await snapshot()).state,a=active.activitiesById[active.personsById[MASTER].activityId],slot=facilitySlots(active,building,'cultivate').find(x=>x.id===seat.slotId);assert.equal(a.phase,'executing');assert.equal(a.slotId,seat.slotId);assert(Math.hypot(active.personsById[MASTER].position.x-slot.position.x,active.personsById[MASTER].position.y-slot.position.y)<.04);assert(active.spiritSources.extractedMilli>before.spiritSources.extractedMilli);assert(active.personsById[MASTER].xp>before.personsById[MASTER].xp);
 await saveReopen('meditation-supplied-seat',{focusSite:3});await openBuilding(3);await capture('meditation-source-and-seat');record('掌门到指定蒲团后按实际灵气获得修为',{slotId:seat.slotId,pulse:active.spiritSources.lastPulse});
 await tab('growth');await clickKey('growth:rest');if(await key('confirm-action').count())await clickKey('confirm-action');await closePanel();
}
async function maintenance(building){
 phase='onsite-maintenance';const sid=`stockpile:${building.instanceId}`;await transfer(HOME,sid,'wood',2);await transfer(HOME,sid,'stone',1);await prepareMaster(phase);await openBuilding(3);
 const before=(await snapshot()).state,account=before.spiritSources.buildingsById[building.instanceId];assert(account.remainingMilli<account.initialMilli,'actual prior cultivation wore the facility');await clickKey('meditation:maintain');
 const queued=(await snapshot()).state,o=Object.values(queued.workOrdersById).find(o=>o.kind==='sr-meditation-maintenance'&&!before.workOrdersById[o.id]);assert(o);assert.equal(o.progressTicks,0);assert.deepEqual(o.usedInput,{});assert.equal(before.stockpilesById[sid].resources.wood-queued.stockpilesById[sid].resources.wood,2);assert.equal(before.stockpilesById[sid].resources.stone-queued.stockpilesById[sid].resources.stone,1);
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].progressTicks>=20,'actual onsite maintenance',360);await saveReopen('meditation-maintenance');await resumeWorld();await until((v,s)=>s.workOrdersById[o.id].phase==='completed','maintenance completes');await pause(true);
 const done=(await snapshot()).state,finalAccount=done.spiritSources.buildingsById[building.instanceId];assert.equal(done.workOrdersById[o.id].progressTicks,80);assert.deepEqual(done.workOrdersById[o.id].usedInput,{wood:2,stone:1});assert.equal(finalAccount.events.find(e=>e.kind==='maintenance'&&e.workOrderId===o.id).afterMilli,2400000);assert.equal(finalAccount.remainingMilli,finalAccount.initialMilli+finalAccount.restoredMilli+finalAccount.upgradeDeltaMilli-finalAccount.usedMilli);assert(done.factsById[done.workOrdersById[o.id].resultFactId].restoredMilli>0);assert.equal(done.spiritSources.reserveMilli,1200000+done.spiritSources.recoveredMilli-done.spiritSources.extractedMilli);record('现场木石和实际检修恢复引流设施',{orderId:o.id,restoredMilli:done.factsById[done.workOrdersById[o.id].resultFactId].restoredMilli});
}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,startBytes,{flag:'wx'});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await snapshot()).state,startOriginal.state);record('同源正常筹资世界原样载入',{tick:startOriginal.state.worldTick});await pause(true);await manual();
 phase='open-meditation-road';await openSite(3);const before=(await snapshot()).state;await clickKey('domain:enable-north-meditation');const opened=(await snapshot()).state;for(const field of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(opened[field],before[field]);assert.equal(opened.spiritSources,undefined);await clickKey('domain:focus');await closePanel();await capture('meditation-empty');record('正式开通聚灵台山道保留既有世界事实');
 await survey();const building=await construct(3,{jade:60,wood:40,stone:25});const built=(await snapshot()).state;assert.equal(facilitySlots(built,building,'cultivate').length,4);assert.equal(facilitySlots(built,building,'work').length,2);const stock=built.stockpilesById[`stockpile:${building.instanceId}`];assert.equal(stock.capacity,80);assert(Object.values(stock.resources).every(n=>n===0));record('四蒲团两维护位与零初始现场物资',{buildingId:building.instanceId});
 await progressQi();await practice(building);await maintenance(building);await saveReopen('final-recovery',{focusSite:3});const final=await checkpoint('meditation-complete');
 for(const[id,p]of Object.entries(initial.state.personsById)){assert.equal(final.state.personsById[id]?.personId,p.personId);assert.deepEqual(final.state.personsById[id]?.appearance,p.appearance);}assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);await openBuilding(3);await capture('meditation-final');await closePanel();record('同一来源的勘察营造修炼检修连续链完成');complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async error=>{errors.push(error.message);await electron?.close().catch(()=>{});});runtimeSha256After=await codeHashes();if(JSON.stringify(runtimeSha256After)!==JSON.stringify(runtimeSha256)){errors.push('Runtime source or loaded assets changed during the run');process.exitCode=1;}if(hash(await fs.readFile(source))!==hash(bytes)){errors.push('Source file changed');process.exitCode=1;}await report();console.log(`Evidence: ${output}`);}
