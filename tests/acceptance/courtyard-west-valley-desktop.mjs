/** One unchanged normal-command source, followed by visible desktop UI actions.
 * node tests/acceptance/courtyard-west-valley-desktop.mjs --source=/absolute/source-v2-world.json --output=/absolute/fresh-directory
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
import {westValleySites,DOMAIN_VALLEY_EXTENT_VERSION} from '../../src/simulation/ea-sect-domain.mjs';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=option('source'),requestedOutput=option('output');
assert(source&&requestedOutput&&path.isAbsolute(source)&&path.isAbsolute(requestedOutput),'Pass absolute --source and --output paths.');
const repository=await fs.realpath(repositoryRoot),output=path.join(await fs.realpath(path.dirname(requestedOutput)),path.basename(requestedOutput));
assert(output!==repository&&!output.startsWith(repository+path.sep),'Evidence must be outside the repository.');
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original),hash=value=>createHash('sha256').update(value).digest('hex');
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);
assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',LU='person:lu-zhiwei';
const siteId=number=>`site:domain:gc-${number}`,atSite=(state,number)=>Object.values(state.buildingsById).find(building=>building.domainSiteId===siteId(number));
assert.equal(initial.state.stockpilesById[HOME].resources.jade,60,'This run starts at the unchanged 60-jade source.');
assert(!initial.state.claimed.includes('quarry'));for(const number of [17,18,19,24])assert(!atSite(initial.state,number));
const target=desktopTarget(),directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const started=performance.now(),checks=[],errors=[],journey=[],interactions=[],saved=[];
let electron,page,phase='prepare',complete=false,lastTick=initial.state.worldTick;
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
async function resume(){await pause(true);await manual();await pause(false);}
async function openSite(number){await tab('affairs');await clickKey(`domain:site:${siteId(number)}`);}
async function openBuilding(number){await openSite(number);await clickKey('domain:building');}
async function openStock(id){await tab('supply');await clickKey('subtab:stocks');await selectKey('stocks:owner','all');await clickKey(`stock:${id}`);}
async function capture(name){await page.screenshot({path:path.join(output,`${name}.png`)});await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText());}
async function checkpoint(name){const session=await snapshot();assert.equal(validateSect(session),true);const file=`${name}.json`;await fs.writeFile(path.join(output,file),JSON.stringify(session)+'\n');saved.push({name,file,tick:session.state.worldTick,sha256:hash(JSON.stringify(session))});return session;}
async function report(){await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':checks.some(check=>!check.ok)||errors.length?'failed':'running',phase,source,sourceSha256:hash(bytes),platform:process.platform,scope:'Local source Electron; one unchanged normal-command source; UI mutations and real elapsed time; screenshots.',wallSeconds:wall(),initialTick:initial.state.worldTick,finalTick:lastTick,simulatedSeconds:(lastTick-initial.state.worldTick)/10,checks,errors,interactions,saved,journey},null,2)+'\n');}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});}
async function close(){const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
async function until(predicate,label,seconds=180){
 const begin=performance.now();let renew=begin,announce=begin,last=-1;
 while(performance.now()-begin<seconds*1000){
  const {view:v,session}=await read(),s=session.state;lastTick=v.tick;
  if(v.tick!==last){
   const people=v.people.filter(person=>[MASTER,LU].includes(person.id)).map(person=>({id:person.id,x:person.x,y:person.y,art:toArt(person.x,person.y),indoor:person.indoor}));
   for(const person of people)if(person.x<0&&!person.indoor)assert(isArtWalkable(person.art.x,person.art.y,{valley:v.domain.valleyEnabled,west:v.domain.westEnabled,domain:v.domain.enabled}),`${person.id} foot remains on active terrain`);
   journey.push({tick:v.tick,wallSeconds:wall(),phase,people,construction:v.construction&&{progressTicks:v.construction.progressTicks,phase:v.construction.phase,flow:v.construction.materialFlow?.phase,cargo:v.construction.materialFlow?.cargo}});last=v.tick;
  }
  if(predicate(v,s))return{v,s};
  if(performance.now()-renew>18000){const wasPaused=(await read()).status.manualPause;await pause(true);await manual();await pause(wasPaused);renew=performance.now();}
  if(performance.now()-announce>30000){console.log(`WAIT ${label} tick=${v.tick} ${v.construction?.reason||v.operations.farms.filter(farm=>farm.crop).map(farm=>`${farm.crop.phase}: growth ${farm.crop.growthElapsedTicks}/${farm.crop.maturityRequiredTicks}, care ${farm.crop.careContribution}`).join('; ')||v.operations.master.activity?.reason||''}`);await report();announce=performance.now();}
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
  assert.equal(order.phase,'carrying');await closePanel();await resume();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered','existing carried cargo reaches its destination',360);await pause(true);
  const after=(await snapshot()).state;for(const [resource,quantity] of Object.entries(order.cargo))assert(Math.abs(after.stockpilesById[order.targetStockpileId].resources[resource]-before.stockpilesById[order.targetStockpileId].resources[resource]-quantity)<1e-8);
  record('新安排前等待已有携货实际交付',{nextTask:label,orderId:order.id,cargo:order.cargo});
 }
}
async function transfer(sourceId,targetId,resource,quantity,{saveDuring=null}={}){
 await prepareMaster(`transfer ${resource}`);await openStock(sourceId);await selectKey('stock:destination',targetId);const before=(await snapshot()).state;
 await clickKey(`stock:transfer:${resource}`);await fillKey('transfer:quantity',quantity);assert(await key('transfer:submit').isEnabled());await clickKey('transfer:submit');
 const queued=(await snapshot()).state,order=newTransport(before,queued);assert.equal(order.sourceStockpileId,sourceId);assert.equal(order.targetStockpileId,targetId);assert.equal(order.cargo[resource],quantity);
 assert.equal(queued.stockpilesById[targetId].resources[resource],before.stockpilesById[targetId].resources[resource],'destination is credited only on physical delivery');
 await closePanel();await resume();
 const pickup=await until((v,s)=>s.workOrdersById[order.id]?.phase==='carrying'||!saveDuring&&s.workOrdersById[order.id]?.phase==='delivered',`${resource} pickup`),carryingObserved=pickup.s.workOrdersById[order.id].phase==='carrying';
 if(saveDuring){assert(carryingObserved);await saveReopen(saveDuring);}
 await resume();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered',`${resource} delivery`);await pause(true);
 const delivered=(await snapshot()).state;assert(Math.abs(delivered.stockpilesById[targetId].resources[resource]-before.stockpilesById[targetId].resources[resource]-quantity)<1e-8);
 record('物资实际取货并送达指定货位',{orderId:order.id,sourceId,targetId,resource,quantity,carryingObserved});return order;
}
async function finishBuild(number,{reopen=false}={}){
 phase=`build-gc${number}`;await prepareMaster(`build GC${number}`);await openSite(number);const before=(await snapshot()).state,preview=(await view()).domain.sites.find(site=>site.id===siteId(number));
 assert(await key(`domain:build:${siteId(number)}`).isEnabled(),preview.reason);await clickKey(`domain:build:${siteId(number)}`);await closePanel();await tab('follow');await resume();
 if(reopen){
  await until(v=>v.people.find(person=>person.id===MASTER).x< -25&&v.construction?.materialFlow?.phase==='carrying','materials enter the valley');await saveReopen('03-quarry-carrying');
  await resume();await until(v=>(v.construction?.progressTicks||0)>=30,'onsite quarry construction');await saveReopen('04-quarry-building',{focusSite:17});await resume();
 }
 await until(v=>v.domain.sites.find(site=>site.id===siteId(number))?.status==='complete',`GC${number} construction`,360);await pause(true);const built=await checkpoint(`gc${number}-complete`),building=atSite(built.state,number),site=westValleySites.find(site=>site.number===number);
 assert(building);assert.equal(building.transform.x,site.x);assert.equal(building.transform.y,site.y);
 for(const resource of ['wood','stone'])assert.equal(before.stockpilesById[HOME].resources[resource]-built.state.stockpilesById[HOME].resources[resource],preview.cost[resource]||0);
 await openSite(number);await clickKey('domain:focus');await closePanel();await capture(`gc${number}-scene`);await openBuilding(number);await capture(`gc${number}-detail`);await closePanel();
 record('预设营造经真实运料与施工落成',{site:siteId(number),buildingId:building.instanceId,position:building.transform,cost:preview.cost});return building;
}
async function gatherWood(batch){
 phase='wood';await prepareMaster(`wood batch ${batch}`);const before=(await snapshot()).state,carriedBefore=before.stockpilesById[CARRIED]?.resources.wood||0;
 await tab('supply');await clickKey('subtab:sources');await clickKey('source:wood');await clickKey('source:harvest:wood');const activity=(await view()).operations.master.activity;assert.equal(activity.kind,'sr-harvest');
 await closePanel();await resume();await until((v,s)=>!s.activitiesById[activity.id]&&(s.stockpilesById[CARRIED]?.resources.wood||0)>=carriedBefore+12,`wood batch ${batch}`);await pause(true);
 const after=(await snapshot()).state;assert.equal(after.stockpilesById[HOME].resources.wood,before.stockpilesById[HOME].resources.wood);assert.equal(after.stockpilesById[CARRIED].resources.wood,carriedBefore+12);
 record('掌门亲采一批木材并随身携带',{batch,quantity:12,carried:carriedBefore+12});
}
async function invite(number,kind){
 await pause(true);await openBuilding(number);const building=atSite((await snapshot()).state,number),name=`${kind}:invite:${LU}`;assert(await key(name).isEnabled(),await page.locator('#management-body').innerText());await clickKey(name);
 const answer=(await snapshot()).state.personsById[LU].schedule.invitations[`work:${building.instanceId}`];assert.equal(answer?.accepted,true,answer?.publicReason||'No accepted invitation');await closePanel();
 record('陆知微接受现场作业邀请',{site:siteId(number),buildingId:building.instanceId,answer});
}
async function runField(number,warehouseStock,{reopen=false}={}){
 phase=`crop-gc${number}`;await prepareMaster(`seed GC${number}`);await openBuilding(number);const before=(await snapshot()).state,building=atSite(before,number),sid=`stockpile:${building.instanceId}`,wid=`work:production:${building.instanceId}`;
 assert.equal(before.stockpilesById[sid].resources.food,0);assert(!before.workOrdersById[wid]?.crop);assert(await key('farm:seed').isEnabled());await clickKey('farm:seed');assert.equal(await key('transfer:quantity').inputValue(),'2');await clickKey('transfer:submit');
 const queued=(await snapshot()).state,seedOrder=newTransport(before,queued);assert.deepEqual(seedOrder.cargo,{food:2});assert.equal(queued.stockpilesById[sid].resources.food,0);
 await closePanel();await resume();
 if(reopen){await until((v,s)=>s.workOrdersById[seedOrder.id]?.phase==='carrying','seed grain pickup');await saveReopen('09-seed-carrying');await resume();}
 await until((v,s)=>s.workOrdersById[seedOrder.id]?.phase==='delivered','seed grain arrives at field');await pause(true);
 assert.equal((await snapshot()).state.stockpilesById[sid].resources.food,2);await invite(number,'farm');await resume();
 if(reopen){
  await until((v,s)=>{const person=s.personsById[LU],activity=s.activitiesById[person.activityId];return activity?.targetId===building.instanceId&&activity.phase==='navigating';},'Lu follows the accepted route to the field');
  await pause(true);assert(!(await snapshot()).state.workOrdersById[wid]?.crop,'grain is sown only after actual arrival');await saveReopen('09-field-approach');await resume();
 }
 await until((v,s)=>(s.workOrdersById[wid]?.crop?.growthElapsedTicks||0)>=10,'crop growth',360);await pause(true);
 const growing=(await snapshot()).state,order=growing.workOrdersById[wid],batch=order.batch;assert.equal(order.crop.seedUsed,2);assert.equal(growing.stockpilesById[sid].resources.food,0);assert.equal(order.crop.maturedAtTick,null);
 if(reopen)await saveReopen('09-grain-growing');
 const patchBefore=growing.srEconomy.patches.food.remaining;
 await resume();await until((v,s)=>s.workOrdersById[wid]?.batch===batch&&s.workOrdersById[wid].crop.careContribution===200,'onsite care reaches 200',360);await pause(true);
 const cared=(await snapshot()).state;assert.equal(cared.workOrdersById[wid].crop.careContribution,200);assert(cared.workOrdersById[wid].contributions[LU]>0);await checkpoint(`gc${number}-care-complete`);
 await resume();await until((v,s)=>!!s.factsById[`fact:crop:harvest:${building.instanceId}:${batch}`],`GC${number} mature harvest`,360);await pause(true);
 await openBuilding(number);await clickKey('farm:toggle');const harvested=(await snapshot()).state,fact=harvested.factsById[`fact:crop:harvest:${building.instanceId}:${batch}`],production=harvested.factsById[`fact:production:${building.instanceId}:${batch}`];
 assert(fact.quantity>2);assert.equal(fact.sowFactId,order.crop.sowFactId);assert(fact.atTick>=order.crop.sownAtTick+120);assert(production.participantIds.includes(LU));
 assert(Math.abs(patchBefore-harvested.srEconomy.patches.food.remaining-production.grossOutput.food)<1e-8);assert(await key('farm:harvest').isEnabled());
 await capture(`gc${number}-harvest`);await checkpoint(`gc${number}-harvest`);
 // The field shortcut offers HOME; inventory destination selection sends this harvest to GC24.
 await clickKey('farm:harvest');assert(Number(await key('transfer:quantity').inputValue())>0);await openStock(sid);
 const quantity=Math.min(40,harvested.stockpilesById[sid].resources.food-2);await transfer(sid,warehouseStock,'food',quantity,{saveDuring:reopen?'10-grain-carrying':null});
 const delivered=(await snapshot()).state;assert(Math.abs(delivered.stockpilesById[sid].resources.food-harvested.stockpilesById[sid].resources.food+quantity)<1e-8);assert(delivered.stockpilesById[sid].resources.food>=2);
 record('灵稻田现场播种、成熟、照料与收成入库',{site:siteId(number),seedOrder:seedOrder.id,batch,harvest:fact.quantity,delivered:quantity,retained:delivered.stockpilesById[sid].resources.food});
}

await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,JSON.stringify(initial)+'\n',{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await snapshot()).state,original.state);record('60灵石来源档原样载入',{sourceSha256:hash(bytes),tick:initial.state.worldTick});
 phase='open-valley';await pause(true);await manual();await tab('affairs');await clickKey('domain:enable');
 const west=(await snapshot()).state;assert.equal((await view()).domain.westEnabled,true);assert.equal((await view()).domain.valleyEnabled,false);
 for(const number of [17,18,19,24])assert.equal((await view()).domain.sites.find(site=>site.id===siteId(number)).status,'locked');
 await openSite(17);assert.equal(await key(`domain:build:${siteId(17)}`).count(),0);await capture('01-valley-locked');await clickKey('domain:enable-valley');
 const opened=(await snapshot()).state;assert.equal(opened.spatial.extentVersion,DOMAIN_VALLEY_EXTENT_VERSION);assert.equal((await view()).bounds.x,-84);
 for(const name of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById'])assert.deepEqual(opened[name],west[name]);
 await clickKey('domain:focus');await closePanel();await capture('02-valley-open');record('西谷独立显式开通，原人物与实物坐标保留');
 const quarry=await finishBuild(17,{reopen:true});await openSite(17);const preReward=(await snapshot()).state.stockpilesById[HOME].resources;await clickKey('domain:reward:quarry');
 const rewarded=(await snapshot()).state;assert.equal(rewarded.stockpilesById[HOME].resources.jade-preReward.jade,60);assert.equal(rewarded.stockpilesById[HOME].resources.wood-preReward.wood,30);assert.equal(rewarded.claimed.filter(id=>id==='quarry').length,1);
 await openSite(17);assert.equal(await key('domain:reward:quarry').count(),0);await openBuilding(17);await clickKey('workplace:toggle');assert.equal(atSite((await snapshot()).state,17).enabled,false);await closePanel();record('开山奖励实际到账且只可领取一次');
 for(let batch=1;batch<=3;batch++)await gatherWood(batch);await transfer(CARRIED,HOME,'wood',36);await gatherWood(4);await transfer(CARRIED,HOME,'wood',12);
 const warehouse=await finishBuild(24),warehouseStock=`stockpile:${warehouse.instanceId}`;await finishBuild(18);await finishBuild(19);
 const four=await checkpoint('07-four-sites');assert.equal(four.state.stockpilesById[warehouseStock].capacity,2400);assert.equal(four.state.stockpilesById[warehouseStock].resources.food,0);assert.equal(four.state.stockpilesById[warehouseStock].resources.stone,0);assert.equal(four.state.stockpilesById[HOME].buildingId,initial.state.stockpilesById[HOME].buildingId);
 await openBuilding(24);await clickKey('warehouse:stock');assert.match(await page.locator('#management-body').innerText(),/2,?400/);await capture('07-warehouse-empty');await closePanel();record('四处落成，新公库有独立2400份货位与分类容量');
 phase='quarry-production';await openBuilding(17);await clickKey('workplace:toggle');const stoneBefore=(await snapshot()).state.srEconomy.patches.stone.remaining;await invite(17,'workplace');await resume();const quarryStock=`stockpile:${quarry.instanceId}`;
 await until((v,s)=>s.stockpilesById[quarryStock].resources.stone>=6,'finite quarry production');await pause(true);await openBuilding(17);await clickKey('workplace:toggle');const produced=(await snapshot()).state,stone=produced.stockpilesById[quarryStock].resources.stone;
 assert(Math.abs(stoneBefore-produced.srEconomy.patches.stone.remaining-stone)<1e-8);assert.equal(produced.stockpilesById[warehouseStock].resources.stone,0);assert(produced.personsById[LU].mind.scenic.x< -25);await capture('08-quarry-production');await checkpoint('08-quarry-production');
 await transfer(quarryStock,warehouseStock,'stone',Math.min(40,stone));record('采石消耗有限石源，场边实产石料实际送入新公库',{stone,remaining:produced.srEconomy.patches.stone.remaining});
 await runField(18,warehouseStock,{reopen:true});await runField(19,warehouseStock);
 phase='final-recovery';await openBuilding(24);await clickKey('warehouse:stock');await capture('11-warehouse-delivered');await closePanel();await saveReopen('12-final-recovery');
 const final=await checkpoint('13-complete');for(const number of [17,18,19,24])assert(atSite(final.state,number));assert(final.state.stockpilesById[warehouseStock].resources.food>0);assert(final.state.stockpilesById[warehouseStock].resources.stone>0);lastTick=final.state.worldTick;
 assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);assert.equal(hash(await fs.readFile(source)),hash(bytes));record('同一世界最终存读一致，原来源文件未改，页面运行错误为零');complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async error=>{errors.push(error.message);await electron?.close().catch(()=>{});});if(hash(await fs.readFile(source))!==hash(bytes)){errors.push('Source file changed');process.exitCode=1;}await report();console.log(`Evidence: ${output}`);}
