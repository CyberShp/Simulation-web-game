/** One unchanged normal-command source, followed by visible desktop UI actions.
 * node tests/acceptance/courtyard-residential-build-desktop.mjs --source=/absolute/source-v2-world.json --output=/absolute/fresh-directory
 * Resume an interrupted post-GC09 segment with --resume=/absolute/prior-directory/report.json.
 * Uses real elapsed time, screenshots and exact save/reopen; all QA hooks are reads.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect,commandSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
import {toArt,isArtWalkable} from '../../apps/courtyard/courtyard-space.mjs';
import {firstSite,eastResidenceSites,EAST_RESIDENCES_VERSION} from '../../src/simulation/ea-sect-domain.mjs';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=option('source'),requestedOutput=option('output'),resumeReportPath=option('resume');
assert(source&&requestedOutput&&path.isAbsolute(source)&&path.isAbsolute(requestedOutput),'Pass absolute --source and --output paths.');
assert(!resumeReportPath||path.isAbsolute(resumeReportPath),'Pass an absolute --resume report path.');
await fs.mkdir(path.dirname(requestedOutput),{recursive:true});
const repository=await fs.realpath(repositoryRoot),output=path.join(await fs.realpath(path.dirname(requestedOutput)),path.basename(requestedOutput));
assert(output!==repository&&!output.startsWith(repository+path.sep),'Evidence must be outside the repository.');
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original),hash=value=>createHash('sha256').update(value).digest('hex');
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);
assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',LU='person:lu-zhiwei';
const siteId=number=>number===9?firstSite.id:`site:domain:gc-${number}`,atSite=(state,number)=>Object.values(state.buildingsById).find(building=>building.domainSiteId===siteId(number));
assert(initial.state.stockpilesById[HOME].resources.jade>=180);for(const number of [9,10,11,12])assert(!atSite(initial.state,number));
let resume=null,startBytes=bytes,startOriginal=original;
if(resumeReportPath){
 const priorDirectory=path.dirname(resumeReportPath),reportBytes=await fs.readFile(resumeReportPath),prior=JSON.parse(reportBytes),nativePath=path.join(priorDirectory,'world/sect-save.json'),nativeBytes=await fs.readFile(nativePath),native=JSON.parse(nativeBytes),lifecycleBytes=await fs.readFile(path.join(priorDirectory,'world/lifecycle.jsonl')),gc9Bytes=await fs.readFile(path.join(priorDirectory,'gc9-complete.json')),gc9=JSON.parse(gc9Bytes);
 assert.equal(prior.sourceSha256,hash(bytes));assert.equal(prior.sourceUnchanged,true);assert.equal(prior.phase,'supply-gc10');assert(prior.checks.some(c=>c.ok&&c.number===9&&c.beds?.length===4));assert(prior.checks.some(c=>c.ok&&c.name==='正式开通三院道路并保留原世界事实'));assert(prior.checks.at(-1).error.includes('Target page, context or browser has been closed'));
 assert.deepEqual(prior.runtimeSha256After,prior.runtimeSha256);assert.equal(validateSect(native),true);assert.deepEqual(restoreSect(native).state,native.state);assert.equal(native.state.speed,0);assert.equal(native.state.worldTick,gc9.state.worldTick);assert.equal(native.state.spatial.eastResidences.version,EAST_RESIDENCES_VERSION);for(const number of [10,11,12])assert(!atSite(native.state,number));assert.equal(atSite(native.state,9).level,1);
 // Reproduce only the logged paused UI commands on a detached verifier. The
 // actual continuation copies the native file byte-for-byte into its own slot.
 const verifier=restoreSect(gc9);assert(commandSect(verifier,{type:'enable-residences'}).ok);assert(commandSect(verifier,{type:'manual'}).ok);assert.deepEqual(snapshotSect(verifier).state,native.state);
 const lifecycle=lifecycleBytes.toString().trim().split('\n').map(line=>JSON.parse(line));assert.equal(lifecycle.at(-1).type,'closed');assert(lifecycle.some(e=>e.type==='close-requested'));
 resume={reportPath:resumeReportPath,reportSha256:hash(reportBytes),nativePath,nativeSha256:hash(nativeBytes),lifecycleSha256:hash(lifecycleBytes),gc9CheckpointSha256:hash(gc9Bytes),previousWallSeconds:prior.wallSeconds,previousInitialTick:prior.initialTick,resumeTick:native.state.worldTick,runtimeSha256:prior.runtimeSha256,priorSuccessfulChecks:prior.checks.filter(c=>c.ok),closedAt:lifecycle.at(-1).at};
 startBytes=nativeBytes;startOriginal=native;
}
const warehouse=Object.values(initial.state.buildingsById).find(b=>b.type==='warehouse'),WAREHOUSE=`stockpile:${warehouse.instanceId}`;
const target=desktopTarget(),directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const started=performance.now(),checks=[],errors=[],journey=[],interactions=[],saved=[];
let electron,page,phase='prepare',complete=false,lastTick=startOriginal.state.worldTick;
const wall=()=>Number(((performance.now()-started)/1000).toFixed(3)),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const read=()=>page.evaluate(()=>({view:window.courtyardQA.view(),session:window.courtyardQA.snapshot(),status:window.courtyardQA.status()}));
const view=async()=>(await read()).view,snapshot=async()=>(await read()).session;
const key=name=>page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=(name,data={})=>{checks.push({name,ok:true,wallSeconds:wall(),...data});console.log(`PASS ${name}`);};
async function click(locator,label){await locator.click();interactions.push({kind:'click',label,wallSeconds:wall(),tick:(await view()).tick});}
const tab=name=>click(page.locator(`#${name}`),name),clickKey=name=>click(key(name),name);
async function selectKey(name,value){await key(name).selectOption(value);interactions.push({kind:'select',label:name,value,wallSeconds:wall(),tick:(await view()).tick});}
async function fillKey(name,value){await key(name).fill(String(value));interactions.push({kind:'fill',label:name,value,wallSeconds:wall(),tick:(await view()).tick});}
async function pause(wanted){if((await read()).status.manualPause!==wanted)await tab('pause');}
async function closePanel(){if(await page.locator('#management').isVisible())await tab('close-management');}
async function manual(){await tab('affairs');await clickKey('affairs:policy');await clickKey('policy:manual');await closePanel();}
async function resumeWorld(){await pause(true);await manual();await pause(false);}
async function openSite(number){await tab('affairs');await selectKey('domain:region','Z-02');await clickKey(`domain:site:${siteId(number)}`);}
async function openBuilding(number){await openSite(number);await clickKey('domain:building');}
async function openStock(id){await tab('supply');await clickKey('subtab:stocks');await selectKey('stocks:owner','all');await clickKey(`stock:${id}`);}
async function capture(name){await page.screenshot({path:path.join(output,`${name}.png`)});await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText());}
async function checkpoint(name){const session=await snapshot();assert.equal(validateSect(session),true);lastTick=session.state.worldTick;const file=`${name}.json`;await fs.writeFile(path.join(output,file),JSON.stringify(session)+'\n');saved.push({name,file,tick:session.state.worldTick,sha256:hash(JSON.stringify(session))});return session;}
async function report(){await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':checks.some(check=>!check.ok)||errors.length?'failed':'running',phase,source,sourceSha256:hash(bytes),platform:process.platform,scope:'Local source macOS Electron; one funded source; four preset residences, actual hauling/construction/relocation; UI mutations, real wall time and screenshots.',sourceProvenance:original.provenance,resume,runtimeSha256,runtimeSha256After,sourceUnchanged:hash(await fs.readFile(source))===hash(bytes),wallSeconds:wall(),segments:[...(resume?[{reportPath:resume.reportPath,wallSeconds:resume.previousWallSeconds,fromTick:resume.previousInitialTick,toTick:resume.resumeTick}]:[]),{reportPath:path.join(output,'report.json'),wallSeconds:wall(),fromTick:startOriginal.state.worldTick,toTick:lastTick}],totalActiveWallSeconds:(resume?.previousWallSeconds||0)+wall(),initialTick:initial.state.worldTick,segmentInitialTick:startOriginal.state.worldTick,finalTick:lastTick,simulatedSeconds:(lastTick-initial.state.worldTick)/10,checks,errors,interactions,saved,journey},null,2)+'\n');}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});}
async function close(){const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
async function until(predicate,label,seconds=180){
 const begin=performance.now();let renew=begin,announce=begin,last=-1;
 while(performance.now()-begin<seconds*1000){
  const {view:v,session}=await read(),s=session.state;lastTick=v.tick;
  if(v.tick!==last){
   const people=v.people.filter(person=>[MASTER,LU].includes(person.id)).map(person=>({id:person.id,x:person.x,y:person.y,art:toArt(person.x,person.y),indoor:person.indoor}));
   for(const person of people)if(!person.indoor&&!isArtWalkable(person.art.x,person.art.y,{valley:v.domain.valleyEnabled,west:v.domain.westEnabled,domain:v.domain.enabled,residences:v.domain.residencesEnabled})){await fs.writeFile(path.join(output,'first-invalid-foot.json'),JSON.stringify({tick:v.tick,wallSeconds:wall(),phase,person,session},null,2)+'\n');assert.fail(`${person.id} foot remains on active terrain`);}
   journey.push({tick:v.tick,wallSeconds:wall(),phase,people,construction:v.construction&&{progressTicks:v.construction.progressTicks,phase:v.construction.phase,flow:v.construction.materialFlow?.phase,cargo:v.construction.materialFlow?.cargo}});last=v.tick;
  }
  if(predicate(v,s))return{v,s};
  if(performance.now()-renew>18000){const wasPaused=(await read()).status.manualPause;await pause(true);await manual();await pause(wasPaused);renew=performance.now();}
  if(performance.now()-announce>30000){console.log(`WAIT ${label} tick=${v.tick} ${v.construction?.reason||v.operations.farms.filter(farm=>farm.crop).map(farm=>`${farm.crop.phase}: growth ${farm.crop.growthElapsedTicks}/${farm.crop.maturityRequiredTicks}, care ${farm.crop.careContribution}`).join('; ')||v.operations.master.activity?.reason||''}`);await capture('progress-current');await report();announce=performance.now();}
  await wait(120);
 }
 throw Error(`Timed out: ${label}`);
}
async function saveReopen(name,{focusSite=null}={}){
 await pause(true);if(focusSite!==null){await openSite(focusSite);await clickKey('domain:focus');}await closePanel();const before=await checkpoint(`${name}-before`),camera=await page.evaluate(()=>({...window.courtyardQA.renderer.camera}));await capture(name);await tab('save');
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
 assert.equal(queued.stockpilesById[targetId].resources[resource],before.stockpilesById[targetId].resources[resource],'destination is credited only on physical delivery');
 await closePanel();await tab('follow');await resumeWorld();
 const pickup=await until((v,s)=>s.workOrdersById[order.id]?.phase==='carrying'||!saveDuring&&s.workOrdersById[order.id]?.phase==='delivered',`${resource} pickup`),carryingObserved=pickup.s.workOrdersById[order.id].phase==='carrying';
 if(saveDuring){assert(carryingObserved);await saveReopen(saveDuring);}
 await resumeWorld();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered',`${resource} delivery`);await pause(true);
 const delivered=(await snapshot()).state;assert(Math.abs(delivered.stockpilesById[targetId].resources[resource]-before.stockpilesById[targetId].resources[resource]-quantity)<1e-8);
 record('物资实际取货并送达指定货位',{orderId:order.id,sourceId,targetId,resource,quantity,carryingObserved});return order;
}
const sourceFiles=[...(await fs.readdir(path.join(repository,'src/simulation'))).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...(await fs.readdir(path.join(repository,'apps/courtyard'))).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...(await fs.readdir(path.join(repository,'assets/courtyard'))).filter(x=>/^(east-residences|east-terrace|residence)/.test(x)).map(x=>'assets/courtyard/'+x)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await fs.readFile(path.join(repository,file)))])));
const runtimeSha256=await codeHashes();let runtimeSha256After=null;
if(resume)assert.deepEqual(runtimeSha256,resume.runtimeSha256,'A resumed segment uses the same frozen runtime and residential assets.');
async function supplies(){
 await prepareMaster('daily supply');let current=(await snapshot()).state;
 if(current.stockpilesById[HOME].resources.food<12){
  await tab('supply');await clickKey('subtab:sources');await clickKey('source:food');await clickKey('source:harvest:food');const activity=(await view()).operations.master.activity;assert.equal(activity.kind,'sr-harvest');
  await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>!s.activitiesById[activity.id]&&(s.stockpilesById[CARRIED]?.resources.food||0)>=16,'finite food harvest');await pause(true);await transfer(CARRIED,HOME,'food',16);record('亲采有限口粮并实际送回HOME',{quantity:16});
 }
 current=(await snapshot()).state;
 if(current.personsById[MASTER].energy<40){
  await tab('growth');await clickKey('growth:rest');if(await key('confirm-action').count())await clickKey('confirm-action');await closePanel();await resumeWorld();await until((v,s)=>s.personsById[MASTER].energy>=90,'master rests at an actual bed',180);await pause(true);record('掌门到床实际休息恢复精力');
 }
}
async function buildResidence(number,{reopen=false}={}){
 phase=`build-gc${number}`;if(number!==9)await supplies();await prepareMaster(`GC${number}`);await openSite(number);
 const before=(await snapshot()).state,preview=(await view()).domain.sites.find(x=>x.id===siteId(number));assert.deepEqual(preview.cost,{jade:45,wood:40,stone:20});
 assert(await key(`domain:build:${siteId(number)}`).isEnabled(),preview.reason);await clickKey(`domain:build:${siteId(number)}`);
 const queued=(await snapshot()).state,order=Object.values(queued.workOrdersById).find(o=>o.kind==='construction'&&!before.workOrdersById[o.id]);assert(order);
 for(const[k,n]of Object.entries(preview.cost))assert.equal(before.stockpilesById[HOME].resources[k]-queued.stockpilesById[HOME].resources[k],n);
 assert.equal(queued.worldTick,before.worldTick);record('暂停时正式预留一院营造材料',{number,workOrderId:order.id,cost:preview.cost});
 if(number===9){await tab('affairs');await clickKey('building:2');if((await snapshot()).state.buildingsById['building:yunxiu:2'].enabled)await clickKey('farm:toggle');await closePanel();record('药圃正式暂停，保留其已有材料与工单');}
 await closePanel();await tab('follow');await resumeWorld();
 await until((v,s)=>s.workOrdersById[order.id]?.materialFlow?.phase==='carrying',`GC${number} first material pickup`);await pause(true);await checkpoint(`gc${number}-carrying`);
 if(reopen){await resumeWorld();await until((v,s)=>s.personsById[MASTER].position.x>160&&s.workOrdersById[order.id]?.materialFlow?.phase==='carrying','materials enter new eastern ground',360);await saveReopen(`gc${number}-new-domain-carrying`);}
 await resumeWorld();await until((v,s)=>(s.workOrdersById[order.id]?.progressTicks||0)>=25,`GC${number} onsite construction`,480);await pause(true);
 const constructing=(await snapshot()).state,active=constructing.workOrdersById[order.id];assert(active.materialFlow.trips.every(t=>t.phase==='delivered'));assert(Object.values(active.materialFlow.cargo).every(n=>n===0));assert(active.progressTicks>0);
 await openSite(number);await clickKey('domain:focus');await closePanel();await capture(`gc${number}-construction`);await checkpoint(`gc${number}-construction`);
 if(reopen)await saveReopen(`gc${number}-onsite-recovery`,{focusSite:number});
 await resumeWorld();await until(v=>v.domain.sites.find(x=>x.id===siteId(number))?.status==='complete',`GC${number} completion`,180);await pause(true);
 const completed=await checkpoint(`gc${number}-complete`),building=atSite(completed.state,number),site=[firstSite,...eastResidenceSites].find(x=>x.number===number);
 assert(building);assert.deepEqual(building.transform,{x:site.x,y:site.y,orientation:'south'});const beds=(await view()).housing.beds.filter(b=>b.buildingId===building.instanceId);assert.equal(beds.length,4);assert.equal(new Set(beds.map(b=>b.slotId)).size,4);assert(beds.every(b=>b.usable));
 const receipt=completed.state.spatial.completedOrders.find(x=>x.id===order.id);assert(receipt);assert.equal(completed.state.spatial.completedOrders.filter(x=>x.id===order.id).length,1);
 await openSite(number);await clickKey('domain:focus');await closePanel();await capture(`gc${number}-scene`);await openBuilding(number);await capture(`gc${number}-beds`);assert.match(await page.locator('#management-body').innerText(),/住处与床位/);await closePanel();
 record('住宅完成实际运料和到场营造，四张独立床可用',{number,buildingId:building.instanceId,position:building.transform,beds:beds.map(b=>b.slotId)});return building;
}
async function refillMaterials(number){phase=`supply-gc${number}`;await supplies();for(const[resource,targetAmount]of[['wood',40],['stone',20]]){const s=(await snapshot()).state,need=Math.max(0,targetAmount-s.stockpilesById[HOME].resources[resource]);if(need>0)await transfer(WAREHOUSE,HOME,resource,need,{saveDuring:number===10&&resource==='wood'?'gc24-wood-carrying':null});}}
async function relocateMaster(number){
 phase=`relocate-gc${number}`;await prepareMaster('master relocation');await openBuilding(number);const before=(await snapshot()).state,oldHome=before.residentialHousing.recordsByPersonId[MASTER].home;
 assert(oldHome,'earlier normal rests retained an existing home');const building=atSite(before,number),bed=(await view()).housing.beds.find(b=>b.buildingId===building.instanceId&&b.masterRest.available&&!b.homePersonId&&!b.pendingPersonId);assert(bed);
 await clickKey('housing:rest:'+bed.slotId);if(await key('confirm-action').count())await clickKey('confirm-action');const chosen=(await snapshot()).state.residentialHousing.recordsByPersonId[MASTER];assert.deepEqual(chosen.home,oldHome);assert.equal(chosen.pending.slotId,bed.slotId);record('掌门选择新院床，赴床时保留旧住处',{oldHome,targetBed:bed.slotId});
 await closePanel();await tab('follow');await resumeWorld();await until((v,s)=>s.activitiesById[s.personsById[MASTER].activityId]?.phase==='navigating'&&s.personsById[MASTER].position.x>160,'master crosses east ground toward the chosen bed',180);await pause(true);
 assert.deepEqual((await snapshot()).state.residentialHousing.recordsByPersonId[MASTER].home,oldHome);await saveReopen('master-relocation-carrying');await resumeWorld();
 await until((v,s)=>s.residentialHousing.recordsByPersonId[MASTER].home?.slotId===bed.slotId,'actual arrival settles new home',180);await pause(true);
 const s=(await snapshot()).state,r=s.residentialHousing.recordsByPersonId[MASTER],body=s.activitiesById[s.personsById[MASTER].activityId];assert.equal(r.pending,null);assert.equal(body.slotId,bed.slotId);assert.equal(body.phase,'executing');assert(Math.hypot(s.personsById[MASTER].position.x-bed.position.x,s.personsById[MASTER].position.y-bed.position.y)<.04);
 assert(!(await view()).housing.beds.find(x=>x.slotId===oldHome.slotId).homePersonId);await openBuilding(number);await capture('master-new-home');await closePanel();record('实际到床后登记新住处并释放旧床',{bed:bed.slotId,oldBed:oldHome.slotId});
}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,startBytes,{flag:'wx'});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
if(resume){await fs.writeFile(path.join(output,'resume-native-source.json'),startBytes,{flag:'wx'});await fs.writeFile(path.join(output,'resume.json'),JSON.stringify(resume,null,2)+'\n');}
try{
 await launch();assert.deepEqual((await snapshot()).state,startOriginal.state);assert.equal((await read()).status.manualPause,true);
 if(resume){const camera=await page.evaluate(()=>({...window.courtyardQA.renderer.camera})),savedCamera=toArt(startOriginal.courtyardPresentation.camera.x,startOriginal.courtyardPresentation.camera.y);assert(Math.hypot(camera.x-savedCamera.x,camera.y-savedCamera.y)<1e-6);assert.equal(camera.zoom,startOriginal.courtyardPresentation.camera.zoom);await checkpoint('resumed-native-exact');await capture('resumed-native-exact');record('原生关闭档精确续接，关闭期间世界时钟保持',{tick:startOriginal.state.worldTick,nativeSha256:resume.nativeSha256,previousReport:resume.reportPath,previousReportSha256:resume.reportSha256});}
 else record('四院备料来源原样载入',{tick:initial.state.worldTick,sourceSha256:hash(bytes)});await pause(true);await manual();
 if(!resume){
 await buildResidence(9);phase='open-east-residences';await openSite(10);const before=(await snapshot()).state;assert.equal((await view()).domain.residencesEnabled,false);await capture('east-residences-locked');await clickKey('domain:enable-residences');const opened=(await snapshot()).state;
 assert.equal(opened.spatial.eastResidences.version,EAST_RESIDENCES_VERSION);for(const name of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(opened[name],before[name]);await clickKey('domain:focus');await closePanel();await capture('east-residences-open');record('正式开通三院道路并保留原世界事实');
 }
 for(const number of [10,11,12]){await refillMaterials(number);await buildResidence(number,{reopen:number===10});}
 await relocateMaster(12);await saveReopen('final-recovery');const final=await checkpoint('four-residences-complete'),v=await view();lastTick=final.state.worldTick;
 for(const number of [9,10,11,12])assert.equal(atSite(final.state,number).level,1);assert.equal(v.housing.beds.length,20);assert.equal(v.housing.beds.filter(b=>b.buildingId!==final.state.stockpilesById[HOME].buildingId).length,16);
 for(const[id,person]of Object.entries(initial.state.personsById)){assert.equal(final.state.personsById[id]?.personId,person.personId);assert.equal(final.state.personsById[id]?.id,person.id);assert.deepEqual(final.state.personsById[id]?.appearance,person.appearance);}assert.deepEqual(final.state.homeMemberIds,initial.state.homeMemberIds);
 const owned=(s,key)=>Object.values(s.stockpilesById).filter(st=>st.ownerId===MASTER).reduce((n,st)=>n+(st.resources[key]||0),0);
 for(const[resource,spent]of[['jade',180],['wood',160],['stone',80]])assert(Math.abs(owned(initial.state,resource)-owned(final.state,resource)-spent)<1e-7,`${resource} matches four actual construction costs`);
 assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);assert.equal(hash(await fs.readFile(source)),hash(bytes));record('四院16床与主殿4床保存一致，身份保留且运行错误为零');complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async error=>{errors.push(error.message);await electron?.close().catch(()=>{});});runtimeSha256After=await codeHashes();if(JSON.stringify(runtimeSha256After)!==JSON.stringify(runtimeSha256)){errors.push('Runtime source or loaded residential assets changed during the run');process.exitCode=1;}if(hash(await fs.readFile(source))!==hash(bytes)){errors.push('Source file changed');process.exitCode=1;}await report();console.log(`Evidence: ${output}`);}
