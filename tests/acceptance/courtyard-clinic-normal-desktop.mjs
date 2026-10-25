/** GC14 normal desktop acceptance. Root runs Electron serially.
 * --source=/absolute/native.json --output=/absolute/fresh-directory
 * --stage=preflight|actions|build14 --plan=/absolute/plan.json
 * Actions use public UI and real world time; observations are at least 3s apart.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect,viewSect} from '../../apps/courtyard/sect-sim.mjs';
import {meterFindPath,nearestVisibleBodyTarget,COURTYARD_WALK_RATE} from '../../src/simulation/ea-sr-spatial.mjs';
import {BUILDINGS} from '../../src/simulation/ea-data.mjs';
import {buildingAccess} from '../../src/simulation/ea-scene-geometry.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=option('source'),output=option('output'),stage=option('stage')||'preflight';
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output),'absolute source/output required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'QA output belongs outside repository');
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original),initialView=viewSect(initial);
if(stage==='recover')assert([0,1].includes(original.state.speed),'recover source must use normal 0/1 speed');else{assert.deepEqual(initial.state,original.state,'canonical source must restore exactly');assert.equal(initial.state.speed,0);}assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const hash=b=>createHash('sha256').update(b).digest('hex'),copy=x=>structuredClone(x);
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MASTER='person:master',MERCHANT='person:merchant-qingxi';
const siteId=n=>initialView.domain.sites.find(site=>site.number===n)?.id,building=(s,n)=>Object.values(s.buildingsById).find(b=>b.domainSiteId===siteId(n));
const known=(p,id)=>p.artsById?.[id]?.understanding??p.mind?.knowledge?.[id]??0;
const preflight={source,sourceSha256:hash(bytes),tick:initial.state.worldTick,stage,home:initial.state.stockpilesById[HOME],
 finiteSources:initial.state.srEconomy.patches,sites:initialView.domain.sites.filter(s=>[14,25,26].includes(s.number)),
 claimed:initial.state.claimed,localStocks:Object.values(initial.state.stockpilesById).filter(s=>s.ownerId===MASTER||s.id==='stockpile:qingxi').map(s=>({id:s.id,resources:s.resources})),
 clinic:{qualified:['person:master',...initial.state.homeMemberIds].filter(id=>{const p=initial.state.personsById[id];return known(p,'spring')>=20||known(p,'alchemy')>=20;}),
 patients:Object.values(initial.state.personsById).filter(p=>p.wound>0&&p.position?.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard').map(p=>p.personId)},
 costs:{build14:initialView.domain.sites.find(s=>s.number===14).cost,build25:{jade:100,wood:65,stone:45},build26:{jade:65,wood:35,stone:30},paper:{wood:2,herb:2},heal:{jade:10,herb:10,cleanWater:2,wood:1}},
 scope:'read-only preflight; no world step or Electron launch'};
await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'preflight.json'),JSON.stringify(preflight,null,2)+'\n');
await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
if(stage==='preflight'){console.log(JSON.stringify(preflight,null,2));process.exit(0);}
assert(['actions','build14','clinic'].includes(stage));
const plan=stage==='actions'?JSON.parse(await fs.readFile(option('plan'),'utf8')):null;if(plan){assert(Array.isArray(plan));await fs.writeFile(path.join(output,'plan.json'),JSON.stringify(plan,null,2)+'\n');}
const target=desktopTarget(),directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');await fs.mkdir(directory);await fs.writeFile(native,bytes,{flag:'wx'});
const runtimeFiles=[...(await fs.readdir(path.join(repositoryRoot,'src/simulation'))).filter(f=>f.endsWith('.mjs')).map(f=>'src/simulation/'+f),...(await fs.readdir(path.join(repositoryRoot,'apps/courtyard'))).filter(f=>/\.(mjs|cjs|html|css)$/.test(f)).map(f=>'apps/courtyard/'+f),...(await fs.readdir(path.join(repositoryRoot,'assets/courtyard'))).filter(f=>/\.(png|json|webp)$/.test(f)).map(f=>'assets/courtyard/'+f)];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeSha256=await hashes(),started=performance.now(),checks=[],errors=[],actions=[],saved=[],observations=[];let electron,page,phase=stage,complete=false,stopRequested=false,lastTick=initial.state.worldTick;
const stopFile=option('stop-file')||path.join(output,'STOP');
async function checkStop(){if(stopRequested)return;try{await fs.access(stopFile);}catch(e){if(e.code==='ENOENT')return;throw e;}stopRequested=true;const e=new Error('STOP file requested a paused native checkpoint');e.code='HARNESS_STOP';throw e;}
const wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=n=>new Promise(r=>setTimeout(r,n));
const read=()=>page.evaluate(()=>({view:window.courtyardQA.view(),session:window.courtyardQA.snapshot(),status:window.courtyardQA.status()}));
const watchedOrders=new Set();
const progress=()=>page.evaluate(({ids,initialTick})=>{const raw=window.courtyardQA.snapshot(),s=raw.state,v=window.courtyardQA.renderer.view;return{view:{tick:v.tick,domain:v.domain,people:v.people,operations:{master:v.operations.master}},session:{state:{worldTick:s.worldTick,economy:s.economy,speed:s.speed,spatial:s.spatial,personsById:Object.fromEntries([...new Set(['person:master','person:merchant-qingxi',...s.homeMemberIds,...v.people.map(p=>p.id)])].filter(id=>s.personsById[id]).map(id=>[id,s.personsById[id]])),homeMemberIds:s.homeMemberIds,buildingsById:s.buildingsById,activitiesById:s.activitiesById,reservationsById:s.reservationsById,workOrdersById:Object.fromEntries(Object.entries(s.workOrdersById).filter(([id,o])=>ids.includes(id)||!['completed','cancelled','delivered'].includes(o.phase))),stockpilesById:Object.fromEntries(Object.entries(s.stockpilesById).filter(([,st])=>st.ownerId==='person:master'||st.id==='stockpile:qingxi')),factsById:Object.fromEntries(Object.entries(s.factsById).filter(([,f])=>(['production','pill-production'].includes(f.operation)||f.kind==='daily-supply-relation')&&f.atTick>=initialTick))}},status:window.courtyardQA.status()};},{ids:[...watchedOrders],initialTick:initial.state.worldTick});
const state=()=>page.evaluate(()=>window.courtyardQA.snapshot().state),view=()=>page.evaluate(()=>window.courtyardQA.view()),key=k=>page.locator(`[data-ui-key=${JSON.stringify(k)}]`);
const record=(name,data={})=>{checks.push({name,ok:true,wallSeconds:wall(),...data});console.log('PASS '+name);};
async function click(locator,label,options){await checkStop();await locator.click(options);const tick=await page.evaluate(()=>window.courtyardQA.metrics().tick);actions.push({label,tick,wallSeconds:wall()});}
const id=k=>click(page.locator('#'+k),k),act=k=>click(key(k),k);
async function closePerson(){if(await page.locator('#dialog').isVisible())await id('close-person');}
async function closePanel(){if(await page.locator('#management').isVisible())await id('close-management');}
async function pause(wanted){if(await page.evaluate(wanted=>{const watch=window.__physicalCheckpoint;if(!watch?.active)return false;const target=!!watch.hit||wanted;if(window.courtyardQA.status().manualPause!==target){const button=document.getElementById('pause');if(!button||button.disabled)throw Error('public pause button unavailable');button.click();}if(window.courtyardQA.status().manualPause!==target)throw Error('public pause button did not reach armed checkpoint state');return true;},wanted))return;for(let attempt=0;attempt<3;attempt++){if(wanted)await closePerson();if(await page.evaluate(()=>window.courtyardQA.status().manualPause)===wanted)return;try{await click(page.locator('#pause'),'pause',{timeout:30000});return;}catch(error){const dialogVisible=await page.locator('#dialog').isVisible(),blockedByDialog=/id=["']dialog["'][\s\S]*intercepts pointer events/.test(String(error.message));if(!dialogVisible||!blockedByDialog||attempt===2)throw error;record('详情自动打开拦截暂停按钮后公开关闭重试',{wanted,attempt:attempt+1,error:String(error.message)});await closePerson();}}}
// Install while paused: observe real snapshots and use only the public pause button.
async function armPhysicalCheckpoint(spec){await page.evaluate(spec=>{clearInterval(window.__physicalCheckpointTimer);window.__physicalCheckpoint={spec,active:true,hit:null,error:null,lastTick:null,observations:0,maxSnapshotMs:0};window.__physicalCheckpointTimer=setInterval(()=>{const watch=window.__physicalCheckpoint;if(watch.hit||watch.error)return;try{const tick=window.courtyardQA.renderer.view.tick;if(tick===watch.lastTick)return;watch.lastTick=tick;const started=performance.now(),s=window.courtyardQA.snapshot().state;watch.observations++;watch.maxSnapshotMs=Math.max(watch.maxSnapshotMs,performance.now()-started);const p=s.personsById['person:master'],y=p.scenic?.bodyYield,o=s.workOrdersById[spec.orderId];let match=false;if(spec.kind==='retreat')match=y?.kind==='transport-retreat'&&y.requestedBy===spec.blockerId&&y.activityId===spec.activityId&&y.workOrderId===spec.orderId&&Math.hypot(p.scenic.x-spec.origin.x,p.scenic.y-spec.origin.y)>.04;else if(spec.kind==='delivery')match=o?.phase==='delivered';else{const process=o?.process;if(process?.stageIndex>spec.stageIndex)throw Error('alchemy stage passed its armed physical checkpoint');match=process?.stageIndex===spec.stageIndex&&process.stageProgressTicks>=2;}if(match){if(!window.courtyardQA.status().manualPause){const button=document.getElementById('pause');if(!button||button.disabled)throw Error('public pause button unavailable');button.click();}if(!window.courtyardQA.status().manualPause)throw Error('public pause did not hold physical checkpoint');watch.hit={tick:s.worldTick,observed:spec.kind==='retreat'?{bodyYield:JSON.parse(JSON.stringify(y))}:spec.kind==='delivery'?{phase:o.phase}:{stageIndex:o.process.stageIndex,stageProgressTicks:o.process.stageProgressTicks}};clearInterval(window.__physicalCheckpointTimer);}}catch(e){watch.error=String(e.stack||e);clearInterval(window.__physicalCheckpointTimer);}},3000);},spec);}
async function awaitPhysicalCheckpoint(label,seconds=1200){const start=Date.now();while(Date.now()-start<seconds*1000){if(stopRequested){await page.evaluate(()=>clearInterval(window.__physicalCheckpointTimer));await checkStop();}await checkStop();const observation=await page.evaluate(()=>window.__physicalCheckpoint);assert(!observation.error,observation.error);if(observation.hit){await page.evaluate(()=>{window.__physicalCheckpoint.active=false;});record('公开按钮捕获实际身体短窗口',{label,...observation.hit,spec:observation.spec,observations:observation.observations,maxSnapshotMs:observation.maxSnapshotMs});return;}await sleep(250);}await page.evaluate(()=>clearInterval(window.__physicalCheckpointTimer));throw Error('Timed out waiting for '+label);}
async function manual(){await id('affairs');await act('affairs:policy');await act('policy:manual');await closePanel();}
async function resume(){await pause(true);await manual();await pause(false);}
async function site(n){const selected=(await view()).domain.sites.find(site=>site.number===n);assert(selected,'known domain site '+n);await id('affairs');await key('domain:region').selectOption(selected.zoneId);await act('domain:site:'+siteId(n));}
async function openBuilding(n){await site(n);await act('domain:building');}
async function stock(sid){await id('supply');await act('subtab:stocks');await key('stocks:owner').selectOption('all');await act('stock:'+sid);}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png'),timeout:60000});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function checkpoint(name){await flushTrail();await collectSupply();const r=await read(),snapshot=r.session;assert.equal(validateSect(snapshot),true);assert.deepEqual(restoreSect(snapshot).state,snapshot.state);lastTick=snapshot.state.worldTick;await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(snapshot)+'\n');saved.push({file:name+'.json',tick:lastTick,sha256:hash(JSON.stringify(snapshot))});return snapshot;}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});await page.evaluate(()=>{window.__workshopTrail=[];let last=-1;window.__workshopTrailTimer=setInterval(()=>{const v=window.courtyardQA.renderer.view;if(v.tick===last)return;const previousTick=last;last=v.tick;window.__workshopTrail.push({tick:v.tick,previousTick,gapTicks:previousTick<0?null:v.tick-previousTick,readAtMs:performance.now(),people:v.people.map(p=>({id:p.id,x:p.x,y:p.y,indoor:p.indoor,path:(p.path||[]).map(q=>({x:q.x,y:q.y}))}))});},3000);});}
async function close(){
 const app=electron;
 if(!app){page=null;return;}
 const process=app.process();
 if(process&&(process.exitCode!==null||process.signalCode!==null)){electron=null;page=null;return;}
 // Attach rejection handling immediately: evaluate can reject before close fires.
 const closed=app.waitForEvent('close',{timeout:30000}).then(()=>({ok:true}),error=>({ok:false,error}));
 let commandError=null;
 try{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());}catch(error){commandError=error;}
 const result=await closed;
 if(commandError&& !result.ok)throw new AggregateError([commandError,result.error],'Window close and application close both failed');
 if(commandError)throw commandError;
 if(!result.ok)throw result.error;
 electron=null;page=null;
}
async function flushTrail(){const trail=await page.evaluate(()=>window.__workshopTrail?.splice(0)||[]);if(trail.length)await fs.appendFile(path.join(output,'actual-sampled-trail.jsonl'),trail.map(x=>JSON.stringify(x)).join('\n')+'\n');}
const supplyEvidence=new Map();
async function collectSupply(){const raw=(await read()).session;for(const f of Object.values(raw.state.factsById)){if(f.kind==='daily-supply-relation'&&f.atTick>=initial.state.worldTick&&initial.state.homeMemberIds.includes(f.personId))supplyEvidence.set(f.id,f);}return [...supplyEvidence.values()];}
const geometrySampleState={};
async function until(predicate,label,seconds=1200,{pauseOnMatch=false,inspectionRunMs=3000}={}){
 const start=performance.now();let last=-1;
 while(performance.now()-start<seconds*1000){await checkStop();const r=await progress();lastTick=r.view.tick;
 if(foodRecoveryPolicy)checkRecoveryFood(r.session.state);
 if(last!==lastTick){last=lastTick;observations.push({phase,tick:last,wallSeconds:wall()});}
 if(await predicate(r.view,r.session.state,r.status)){if(pauseOnMatch)await pause(true);return r;}
 await sleep(Math.max(3000,inspectionRunMs));
 }throw Error('Timed out '+label+' tick='+lastTick);
}
async function reopen(name){await pause(true);await closePanel();const before=await checkpoint(name+'-before');await capture(name);await id('save');for(let i=0;i<100;i++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(before.state))break;await sleep(100);}assert.deepEqual(JSON.parse(await fs.readFile(native)).state,before.state);await close();const closedBytes=await fs.readFile(native);await fs.writeFile(path.join(output,name+'-closed-native.json'),closedBytes);const closedNative=JSON.parse(closedBytes);assert.equal(closedNative.courtyardPresentation?.manualPause,true,'closed native retains manual pause');assert.deepEqual(closedNative.state,before.state,'closed native full state equals checkpoint');await sleep(1000);await launch();const reopened=await read();await fs.writeFile(path.join(output,name+'-reopened.json'),JSON.stringify(reopened,null,2)+'\n');assert.deepEqual(reopened.session.state,before.state);assert.equal(reopened.status.manualPause,true,'reopened native remains manually paused');record('原生关闭重开精确恢复 '+name,{tick:before.state.worldTick});}
async function prepare(){await pause(true);await manual();let s=await state(),a=s.activitiesById[s.personsById[MASTER].activityId];if(!a||a.kind==='facility')return;
 if(a.kind==='sr-transport'){const order=s.workOrdersById[a.workOrderId];watchedOrders.add(order.id);await resume();await until((v,s)=>s.workOrdersById[order.id]?.phase==='delivered','retained transport delivery');await pause(true);return;}
 await closePanel();await resume();await until((v,s)=>!s.activitiesById[a.id],`finish retained ${a.kind}`,900);await pause(true);}
function quantity(s,sid,r){return r.startsWith('pill:')?(s.stockpilesById[sid]?.pills?.[r.slice(5)]||0):(s.stockpilesById[sid]?.resources?.[r]||0);}
function carriedPhysicalTotal(s){const bag=s.stockpilesById[CARRIED];return Object.values(bag?.resources||{}).reduce((n,q)=>n+q,0)+Object.values(bag?.pills||{}).reduce((n,q)=>n+q,0);}
async function transfer(from,to,resource,amount,{save=false,viaPaper=false,bundle=false,inspectionRunMs=3000}={}){assert(amount>0&&amount<=40);await prepare();await productionFoodCheckpoint(null,{force:true});if(viaPaper){assert.equal(from,HOME);const b=building(await state(),25);assert.equal(to,'stockpile:'+b.instanceId);await openBuilding(25);}else{await stock(from);await key('stock:destination').selectOption(to);}const before=await state();if(viaPaper)await act('workplace:process:paper:'+resource);else await act('stock:transfer:'+resource);await key('transfer:quantity').fill(String(amount));assert(await key('transfer:submit').isEnabled());await act('transfer:submit');const queued=await state(),order=Object.values(queued.workOrdersById).find(o=>o.kind==='transport'&&!before.workOrdersById[o.id]);assert(order);watchedOrders.add(order.id);assert.equal(order.sourceStockpileId,from);assert.equal(order.targetStockpileId,to);assert.equal(order.cargo[resource],amount);assert.equal(quantity(queued,to,resource),quantity(before,to,resource));assert.equal(queued.worldTick,before.worldTick);assert(Math.abs(quantity(before,from,resource)-quantity(queued,from,resource)-amount)<1e-7,'source stock moves into the real reserved cargo');const stockSum=s=>Object.keys(s.stockpilesById).reduce((sum,id)=>sum+quantity(s,id,resource),0);assert(Math.abs(stockSum(before)-stockSum(queued)-order.cargo[resource])<1e-7,'queued cargo conserves all physical stock at the unchanged world tick');await closePanel();if(bundle){await pause(true);await manual();await armPhysicalCheckpoint({kind:'delivery',orderId:order.id});await pause(false);}else await resume();let deliveryStartTick=queued.worldTick;if(save){await awaitManualTask((v,s)=>s.workOrdersById[order.id]?.phase==='carrying','actual cargo pickup',{startTick:queued.worldTick,inspectionRunMs});await reopen('carrying-'+saved.length);await manual();deliveryStartTick=(await state()).worldTick;await pause(false);}if(bundle)await awaitManualTask((v,s)=>s.workOrdersById[order.id]?.phase==='delivered','delivery '+resource,{startTick:queued.worldTick,seconds:1200,inspectionRunMs:3000,guard:s=>assert(quantity(s,HOME,'food')>=productionDaily*2,'bundled medicine transport keeps actual two-day food reserve')});else await awaitManualTask((v,s)=>s.workOrdersById[order.id]?.phase==='delivered','delivery '+resource,{startTick:deliveryStartTick,inspectionRunMs});if(bundle)await awaitPhysicalCheckpoint('medicine bundle actual delivery');await pause(true);const afterRaw=(await read()).session,after=afterRaw.state,delivered=after.workOrdersById[order.id],deliveryFacts=Object.values(after.factsById).filter(f=>f.operation==='delivery'&&f.workOrderId===order.id);assert.equal(delivered.phase,'delivered');assert.equal(delivered.sourceStockpileId,from);assert.equal(delivered.targetStockpileId,to);assert.deepEqual(delivered.cargo,{[resource]:amount});assert.equal(deliveryFacts.length,1);const fact=deliveryFacts[0];assert.equal(fact.sourceStockpileId,from);assert.equal(fact.targetStockpileId,to);assert.deepEqual(fact.quantities,delivered.cargo);assert.equal(fact.atTick,delivered.finishedTick);assert(fact.atTick>=queued.worldTick&&fact.atTick<=after.worldTick);assert.equal(validateSect(afterRaw),true,'formal transport and production accounting remain valid');assert.deepEqual(restoreSect(afterRaw).state,after,'canonical full-state accounting and exact restore');const postings=[{stockpileId:from,delta:-fact.quantities[resource]},{stockpileId:to,delta:fact.quantities[resource]}];assert.equal(postings.reduce((sum,p)=>sum+p.delta,0),0,'the delivery receipt has balanced source and destination postings');const evidence={from,to,resource,amount,orderId:order.id,fact,postings,phase:delivered.phase,beforeDestination:quantity(before,to,resource),afterDestination:quantity(after,to,resource),destinationChangeIncludingConcurrentWorld:quantity(after,to,resource)-quantity(before,to,resource),fromTick:before.worldTick,toTick:after.worldTick,accountingValidated:true};if(!checks.some(c=>c.name==='实际送达'))await fs.writeFile(path.join(output,'first-delivery-evidence.json'),JSON.stringify({evidence,session:afterRaw},null,2)+'\n');record('实际送达',evidence);await productionFoodCheckpoint(null,{force:true});}
async function awaitManualTask(predicate,label,{startTick,guard=null,seconds=600,inspectionRunMs=3000}={}){
 let lastManualTick=startTick;
 // Observe running logistics at three-second intervals; pause for public control renewal.
 return until(async(v,s)=>{if(foodRecoveryPolicy)checkRecoveryFood(s);else assert(quantity(s,HOME,'food')>=productionDaily*2,'manual logistics retains actual two-day food reserve');if(guard)guard(s);if(predicate(v,s))return true;assert(s.worldTick-lastManualTick<300,'public task retains its manual handoff interval');if(s.worldTick-lastManualTick>=100){await pause(true);await manual();const renewed=await state();lastManualTick=renewed.worldTick;record('正式任务公开续亲控',{label,tick:lastManualTick});if(guard)guard(renewed);if(predicate(null,renewed))return true;await pause(false);}return false;},label,seconds,{pauseOnMatch:true,pauseForInspection:true,inspectionRunMs});
}
async function sourceAction(resource,replenish=false){
 await prepare();const before=await state(),carriedBefore=quantity(before,CARRIED,resource),batch={wood:12,stone:10,herb:10,food:16}[resource];if(!replenish)assert(carriedPhysicalTotal(before)+batch<=40,'actual harvest batch must fit existing real carried cargo');
 await id('supply');await act('subtab:sources');await act('source:'+resource);await act(`source:${replenish?'replenish':'harvest'}:${resource}`);const s=await state(),a=s.activitiesById[s.personsById[MASTER].activityId];assert.equal(a.kind,replenish?'sr-replenish':'sr-harvest');await closePanel();await resume();await awaitManualTask((v,s)=>!s.activitiesById[a.id],`${resource} ${replenish?'replenish':'harvest'}`,{startTick:s.worldTick});await pause(true);
 const after=await state(),fact=replenish?null:after.factsById['fact:manual-harvest:'+a.id];if(!replenish){assert(fact?.operation==='manual-harvest'&&fact.resource===resource&&fact.quantity===batch&&fact.targetStockpileId===CARRIED&&fact.actorId===MASTER,'this exact public harvest produced its physical batch');assert(carriedPhysicalTotal(after)<=40);if(resource==='wood')assert.equal(quantity(after,CARRIED,resource)-carriedBefore,batch,'all newly harvested wood remains actually carried for the planned sale');}
 const result={resource,replenish,activityId:a.id,carriedBefore,fact};record('真实来源作业完成',result);return result;
}
function harvestTransport(s,harvest){
 const fact=harvest.fact;assert(fact?.operation==='manual-harvest'&&fact.resource===harvest.resource&&fact.targetStockpileId===CARRIED&&fact.actorId===MASTER);assert.equal(harvest.carriedBefore,0,'harvest-to-home receipt binds an initially empty resource pocket');
 const matched=Object.values(s.workOrdersById).filter(o=>o.kind==='transport'&&o.carrierId===MASTER&&o.sourceStockpileId===CARRIED&&o.targetStockpileId===HOME&&o.startedTick>=fact.atTick&&Object.keys(o.cargo).length===1&&o.cargo[harvest.resource]===fact.quantity).sort((a,b)=>a.startedTick-b.startedTick)[0]||null;if(matched)assert(!Object.values(s.factsById).some(f=>f.operation==='manual-harvest'&&f.resource===harvest.resource&&f.actorId===MASTER&&f.atTick>fact.atTick&&f.atTick<=matched.startedTick),'harvest receipt must have an unambiguous next physical delivery');return matched;
}
async function receiveHarvestHome(harvest){
 let s=await state(),existing=harvestTransport(s,harvest);
 if(existing){if(existing.phase!=='delivered'){assert.equal(s.activitiesById[s.personsById[MASTER].activityId]?.workOrderId,existing.id,'continue only the actual retained delivery body task');assert(!['cancelled'].includes(existing.phase),'automatic harvest delivery must remain a real live transport');watchedOrders.add(existing.id);const foodEnabledBefore=productionFoodEnabled;productionFoodEnabled=false;try{await resume();await awaitManualTask((v,s)=>s.workOrdersById[existing.id]?.phase==='delivered','existing real harvest delivery '+existing.id,{startTick:s.worldTick,guard:s=>{const current=s.workOrdersById[existing.id];assert(current?.id===existing.id&&current.sourceStockpileId===CARRIED&&current.targetStockpileId===HOME,'same existing harvest transport');assert.notEqual(current.phase,'cancelled');if(current.phase!=='delivered')assert.equal(s.activitiesById[s.personsById[MASTER].activityId]?.workOrderId,existing.id,'existing harvest cargo remains the actual body task');if(foodEnabledBefore)assert(quantity(s,HOME,'food')>=productionDaily*2,'existing food transport retains the actual two-day food floor');}});}finally{productionFoodEnabled=foodEnabledBefore;}s=await state();existing=s.workOrdersById[existing.id];}assert.equal(existing.phase,'delivered');const facts=Object.values(s.factsById).filter(f=>f.operation==='delivery'&&f.workOrderId===existing.id);assert.equal(facts.length,1);const delivered=facts[0];assert.equal(delivered.sourceStockpileId,CARRIED);assert.equal(delivered.targetStockpileId,HOME);assert.deepEqual(delivered.quantities,{[harvest.resource]:harvest.fact.quantity});assert.equal(delivered.atTick,existing.finishedTick);assert.equal(validateSect((await read()).session),true);record('本批采集沿真实既有运输实收入库',{harvestFact:harvest.fact,transportOrderId:existing.id,deliveryFact:delivered});return;}
 assert.equal(quantity(s,CARRIED,harvest.resource),harvest.fact.quantity,'unshipped harvest batch remains actually carried');await transfer(CARRIED,HOME,harvest.resource,harvest.fact.quantity);
}
function inspectRestActivity(s,expected){
 const person=s.personsById[MASTER],activity=s.activitiesById[person?.activityId];
 assert(activity&&activity.kind==='facility'&&activity.action==='rest','explicit bed rest must remain the active body activity');
 assert.equal(activity.id,expected.id,'explicit rest activity must remain unchanged');assert.equal(activity.slotId,expected.slotId,'explicit rest keeps its physical bed');
 const slot=slotById({...s,buildings:Object.values(s.buildingsById)},activity.slotId);assert(slot,'explicit rest has a real bed slot');
 const atBed=activity.phase==='executing'&&Math.hypot(person.position.x-slot.position.x,person.position.y-slot.position.y)<.04;
 return{activity,slot,atBed,energy:person.energy};
}
async function rest(energy=90){
 await prepare();await id('growth');await act('growth:rest');if(await key('confirm-action').count())await act('confirm-action');await closePanel();
 const requested=await state(),activity=requested.activitiesById[requested.personsById[MASTER].activityId];assert(activity?.slotId,'explicit rest must reserve an actual bed');
 const expected={id:activity.id,slotId:activity.slotId};inspectRestActivity(requested,expected);let lastRenewTick=requested.worldTick,arrived=false;
 record('公开休息指令绑定实际床位',{activityId:expected.id,slotId:expected.slotId,tick:lastRenewTick,targetEnergy:energy});await resume();
 await until(async(v,s)=>{const result=inspectRestActivity(s,expected);
  if(result.atBed&&!arrived){arrived=true;record('掌门本次休息实际到床执行',{activityId:expected.id,slotId:expected.slotId,tick:s.worldTick,position:s.personsById[MASTER].position,energy:result.energy});}
  if(s.worldTick-lastRenewTick>=100){await pause(true);await manual();const renewed=await state();inspectRestActivity(renewed,expected);lastRenewTick=renewed.worldTick;record('公开续亲控并保留本次休息',{activityId:expected.id,slotId:expected.slotId,tick:lastRenewTick});await pause(false);}
  return arrived&&result.atBed&&result.energy>=energy;
 },'same explicit bed rest reaches target energy');await pause(true);const final=inspectRestActivity(await state(),expected);assert(final.atBed&&final.energy>=energy,'actual executing bed rest reaches requested energy');
}
async function trade(resource,side,batches){
 await prepare();const beforeWait=await state(),retainedResources=copy(beforeWait.stockpilesById[CARRIED]?.resources||{}),retainedPills=copy(beforeWait.stockpilesById[CARRIED]?.pills||{}),daily=(await view()).foodSupply.dailyDemand;
 const cargoGuard=s=>{assert.deepEqual(s.stockpilesById[CARRIED]?.resources||{},retainedResources,'trade waiting retains actual carried goods and payment');assert.deepEqual(s.stockpilesById[CARRIED]?.pills||{},retainedPills);assert(quantity(s,HOME,'food')>=daily*2,'trade waiting keeps actual two-day food reserve');};cargoGuard(beforeWait);
 const ready=s=>{const p=s.personsById[MERCHANT];return p?.position?.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard'&&(!p.courtyardVisit||p.courtyardVisit.phase==='present')&&!p.activityId;};
 if(!ready(beforeWait)){await resume();await awaitManualTask((v,s)=>ready(s)||quantity(s,HOME,'food')<=daily*2,'merchant real arrival before the two-day food floor',{startTick:beforeWait.worldTick,guard:cargoGuard,seconds:900});await pause(true);const arrived=await state();cargoGuard(arrived);assert(ready(arrived),'Merchant did not arrive before the actual HOME food floor; retained trade cargo is saved for continuation');}
 await id('people');await act('person:'+MERCHANT);await act('person:inspect:'+MERCHANT);
 if(await page.locator('#approach-person').isVisible()){const approachTick=(await state()).worldTick;await id('approach-person');await resume();await awaitManualTask((v,s)=>ready(s)&&v?.people?.find(p=>p.id===MERCHANT)?.admission?.distance?.near===true,'actual merchant approach',{startTick:approachTick,guard:cargoGuard});cargoGuard(await state());await id('people');await act('person:'+MERCHANT);await act('person:inspect:'+MERCHANT);}
 cargoGuard(await state());await act('person:trade');await key('person:trade-resource').selectOption(resource);await key('person:trade-side').selectOption(side);await key('person:trade-batches').selectOption(String(batches));const before=await state();assert(await key('person:trade-confirm').isEnabled(),'finite merchant quote must accept this exact exchange');await act('person:trade-confirm');const after=await state(),sign=side==='buy'?1:-1;assert.equal(quantity(after,CARRIED,resource)-quantity(before,CARRIED,resource),10*batches*sign);assert.deepEqual(after.stockpilesById[HOME],before.stockpilesById[HOME]);assert.equal(after.worldTick,before.worldTick);record('现场交易实物与随身货款',{resource,side,batches});await closePerson();await pause(true);
}
async function supplies(){const s=await state();assert(quantity(s,HOME,'food')>=24,'first retain at least two six-resident daily meals before a production segment');if(s.personsById[MASTER].energy<45)await rest();}
async function prepareConstructionFood(n){
 const raw=(await read()).session,s=restoreSect(raw).state,v=await view(),plan=v.domain.sites.find(x=>x.number===n),home=s.stockpilesById[HOME].position;
 const routeLength=(from,to)=>{const route=meterFindPath(s,from,to,{maxSnap:0});assert(route,`safe construction budget route ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);let length=0,previous=from;for(const p of route){length+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;}return length;};
 const materials=Object.entries(plan.cost).filter(([r])=>r!=='jade').reduce((sum,[,q])=>sum+q,0),trips=Math.ceil(materials/40),out=routeLength(home,plan.entrance),back=routeLength(plan.entrance,home),approach=routeLength(s.master.scenic,home);
 // Full material trips, the existing 200-tick solo work, and a return for food.
 // Crew help can shorten work; waiting can lengthen travel. Keep two meals beyond
 // the estimate and 25% of the nominal travel/work time for ordinary waiting.
 const metres=approach+out*trips+back*(trips-1),labourTicks=200,nominalTicks=Math.ceil(metres/(.144*COURTYARD_WALK_RATE))+labourTicks,returnTicks=Math.ceil(back/(.144*COURTYARD_WALK_RATE)),budgetTicks=Math.ceil((nominalTicks+returnTicks)*1.25),daily=v.foodSupply.dailyDemand,dayTicks=s.ticksPerDay||1200,target=(Math.ceil(budgetTicks/dayTicks)+2)*daily;
 record('施工前按正式道路与40份运力核算口粮',{site:n,trips,materials,outMetres:out,backMetres:back,approachMetres:approach,labourTicks,nominalTicks,returnTicks,budgetTicks,dailyDemand:daily,targetFood:target,startingEnergy:s.master.energy,estimatedCarryEnergy:(nominalTicks-labourTicks)*.01,soloLabourEnergy:labourTicks*.015});
 if(s.master.energy<80)await rest(95);
 await maintainFunding({foodTarget:target});
 if((await state()).personsById[MASTER].energy<80)await rest(95);
 await maintainFunding({foodTarget:target});
 assert(quantity(await state(),HOME,'food')>=target,'physical HOME food covers construction estimate and two-day reserve');
 assert((await state()).personsById[MASTER].energy>=80,'food preparation leaves at least 80 energy before construction');
}
function retainedConstruction(s,n){
 const orders=Object.values(s.workOrdersById).filter(o=>o.kind==='construction'&&o.domainSiteId===siteId(n)&&!['completed','cancelled'].includes(o.phase));assert(orders.length<=1,'one active construction per fixed site');if(!orders.length)return null;
 const order=orders[0],actor=s.personsById[MASTER],activity=s.activitiesById[actor.activityId],reservation=s.reservationsById[order.reservationId];
 assert(activity?.kind==='construction'&&activity.workOrderId===order.id&&activity.personId===MASTER,'retained site construction is the master body activity');assert.equal(activity.reservationId,order.reservationId);assert.equal(reservation?.activityId,activity.id);assert.equal(reservation.kind,'construction-material');assert.equal(order.materialFlow?.carrierId,MASTER);assert.equal(order.materialFlow.cancelRequested,false);return order;
}
function verifyConstructionComplete(s,n,o){
 const built=building(s,n),completed=s.spatial.completedOrders.find(item=>item.id===o.id);assert(built,'actual fixed building exists');assert(completed,'real completed construction receipt exists');assert.equal(completed.phase,'completed');assert.equal(completed.domainSiteId,siteId(n));assert.equal(completed.operation,'build');assert.equal(completed.progressTicks,o.durationTicks);assert.deepEqual(completed.usedCost,preflight.costs['build'+n]);
 assert(!s.workOrdersById[o.id],'completed construction removed active work order');assert(!s.reservationsById[o.reservationId],'completed material reservation released');assert(!Object.values(s.activitiesById).some(a=>a.workOrderId===o.id),'construction body activities released');
 assert(!s.stockpilesById[o.materialFlow.sourceStockpileId]&&!s.stockpilesById[o.materialFlow.siteStockpileId],'temporary construction stocks cleared');
 const delivered={};for(const trip of completed.materialTrips){assert.equal(trip.phase,'delivered');assert.equal(trip.carrierId,MASTER);assert.equal(trip.sourceStockpileId,o.materialFlow.sourceStockpileId);assert.equal(trip.targetStockpileId,o.materialFlow.siteStockpileId);for(const [resource,amount]of Object.entries(trip.cargo))delivered[resource]=(delivered[resource]||0)+amount;}
 assert.deepEqual(delivered,Object.fromEntries(Object.entries(completed.usedCost).filter(([resource])=>resource!=='jade')),'actual material trips cover all installed construction materials');
 const fact=s.factsById['fact:site-service:'+built.instanceId];assert.equal(fact?.kind,'site-service-commissioned');assert.equal(fact.buildingId,built.instanceId);assert.equal(fact.siteId,siteId(n));assert.equal(fact.atTick,completed.tick);
 record('固定医庐实际完工及施工材料结清',{building:structuredClone(built),completion:structuredClone(completed),commission:structuredClone(fact),deliveredMaterials:delivered});
}
async function continueConstruction(n,o,{retainedBudget=false}={}){
 watchedOrders.add(o.id);let blocked=null;
 if(retainedBudget){
  const s=await state(),order=s.workOrdersById[o.id],flow=order.materialFlow,gs={...s,buildings:Object.values(s.buildingsById)},source=s.stockpilesById[flow.sourceStockpileId],site=s.stockpilesById[flow.siteStockpileId];
  assert(!flow.cancelRequested&&['carrying','to-source','ready'].includes(flow.phase),'bounded continuation requires normal delivery material flow');
  const sum=resources=>Object.values(resources||{}).reduce((a,b)=>a+b,0),sourceQuantity=sum(source.resources),siteQuantity=sum(site.resources),cargoQuantity=sum(flow.cargo),legs=[];
  assert(cargoQuantity<=40,'actual construction carry capacity');let current=s.personsById[MASTER].position;
  const leg=target=>{const route=meterFindPath(gs,current,target,{maxSnap:0});assert(route,'normal retained construction road');let length=0,last=current;for(const point of route){length+=Math.hypot(point.x-last.x,point.y-last.y);last=point;}legs.push({from:{...current},to:{...target},metres:length,ticks:Math.ceil(length/(.144*COURTYARD_WALK_RATE))});current=target;};
  if(cargoQuantity>0)leg(site.position);
  for(let remaining=sourceQuantity;remaining>1e-8;remaining-=40){leg(source.position);leg(site.position);}
  if(!legs.length)leg(site.position);
  const labourTicks=Math.max(0,order.durationTicks-order.progressTicks),demand=(await view()).foodSupply.dailyDemand,budget=constructionBudget(s.worldTick,legs.map(x=>x.ticks),labourTicks,demand,s.ticksPerDay||1200);
  assert(quantity(s,HOME,'food')>=budget.requiredFood,'actual HOME food covers retained construction daily settlements');
  foodRecoveryPolicy={startTick:s.worldTick,...budget};record('既有施工有限续接口粮预算',{policy:'temporary QA retained construction: actual daily affordability, zero starvation and budget deadline; standard two-day guard resumes at completion',orderId:o.id,sourceQuantity,siteQuantity,cargoQuantity,remainingTrips:Math.ceil(sourceQuantity/40)+(cargoQuantity>0?1:0),legs,labourTicks,timeMargin:1.25,menuBufferTicks:200,demand,startingFood:quantity(s,HOME,'food'),...foodRecoveryPolicy});checkRecoveryFood(s);
 }
 try{await resume();
 await awaitManualTask((v,s)=>{
  if(building(s,n))return true;
  const order=s.workOrdersById[o.id],person=s.personsById[MASTER],activity=s.activitiesById[person.activityId];
  if(activity?.kind!=='construction'||activity.workOrderId!==o.id||(activity.phase!=='blocked'&&!person.scenic?.waitingForPersonId)){blocked=null;return false;}
  const current={position:{x:person.position.x,y:person.position.y},materialPhase:order.materialFlow?.phase,deliveredTrips:(order.materialFlow?.trips||[]).filter(trip=>trip.phase==='delivered').length,progressTicks:order.progressTicks};
  const signature=JSON.stringify(current);
  if(!blocked||blocked.signature!==signature)blocked={signature,sinceTick:s.worldTick};
  assert(s.worldTick-blocked.sinceTick<=300,'Construction waiting without movement or material/labour progress for over 300 world ticks: '+JSON.stringify({orderId:o.id,sinceTick:blocked.sinceTick,tick:s.worldTick,...current}));
  return false;
 },'GC'+n+' actual construction',{startTick:(await state()).worldTick,seconds:1800});
 await pause(true);const completedState=await state();verifyConstructionComplete(completedState,n,o);if(foodRecoveryPolicy)checkRecoveryFood(completedState);foodRecoveryPolicy=null;await reopen('gc'+n+'-complete');return building(await state(),n);
 }finally{if(retainedBudget)foodRecoveryPolicy=null;}
}

async function construct(n){const initialState=await state(),retained=retainedConstruction(initialState,n);if(retained){await pause(true);await manual();const after=await state();assert.deepEqual(after.workOrdersById[retained.id],retained,'retained construction and cargo remain unchanged before continuation');record('绑定原营造工单继续',{site:n,orderId:retained.id,actorId:MASTER,reservationId:retained.reservationId,cargo:retained.materialFlow?.cargo,progressTicks:retained.progressTicks});return continueConstruction(n,retained,{retainedBudget:true});}await prepare();let s=await state();if(building(s,n)){record('沿用既有建筑',{site:n});return building(s,n);}await site(n);if(await key('domain:enable-west-workshops').count())await act('domain:enable-west-workshops');await closePanel();await prepareConstructionFood(n);await prepare();await site(n);const before=await state(),preview=(await view()).domain.sites.find(x=>x.number===n);assert.deepEqual(preview.cost,preflight.costs['build'+n]);assert(await key('domain:build:'+siteId(n)).isEnabled(),preview.reason);await act('domain:build:'+siteId(n));s=await state();const o=Object.values(s.workOrdersById).find(o=>o.kind==='construction'&&!before.workOrdersById[o.id]);if(!o){const messages=await page.locator('.management-feedback.failure:visible, #notice:visible').allTextContents();assert(o,'Public build command created no construction order: '+(messages.map(x=>x.trim()).filter(Boolean).join(' | ')||'no visible command feedback'));}watchedOrders.add(o.id);for(const[k,v]of Object.entries(preview.cost))assert.equal(quantity(before,HOME,k)-quantity(s,HOME,k),v);await closePanel();return continueConstruction(n,o);}
// Food checks use real HOME balance after each daily boundary and each finished
// material trip. An active craft/cargo is retained; a low floor stops and saves.
let productionFoodEnabled=false,productionFoodBusy=false,productionDaily=12,productionFoodDay=null,productionTopups=0;
async function productionFoodCheckpoint(sample=null,{force=false}={}){
 if(!productionFoodEnabled||productionFoodBusy)return false;
 const s=sample||await state(),day=Math.floor(s.worldTick/(initial.state.ticksPerDay||1200)),available=quantity(s,HOME,'food');
 assert(available>=productionDaily*2,'production wait reached its two-day food safety floor; save before another day');
 if(!force&&productionFoodDay===day)return false;
 const body=s.activitiesById[s.personsById[MASTER]?.activityId];
 if(body&&body.kind!=='facility')return false;
 // Six residents consume 12/day: trigger below five days (60), refill to eight (96).
 // The two-day (24) stop-and-save floor is checked above; explicit food-floor and construction budgets stay separate.
 productionFoodDay=day;if(available>=60)return false;
 assert(productionTopups++<24,'bounded production food top-ups exhausted');
 const wasPaused=(await read()).status.manualPause;let filled=false;
 productionFoodBusy=true;try{await maintainFunding({foodTarget:96});record('按实际公库余额补足生产口粮',{day,target:96,homeFood:quantity(await state(),HOME,'food')});filled=true;}finally{productionFoodBusy=false;if(filled&&!stopRequested)await pause(wasPaused);}
 return true;
}
async function unload(){let s=await state();for(const[r,n]of Object.entries(s.stockpilesById[CARRIED]?.resources||{})){if(n>0){assert(['jade','wood','stone','herb','food'].includes(r),'unload unsupported retained resource '+r);let left=n;while(left>1e-8){const q=Math.min(40,left);await transfer(CARRIED,HOME,r,q);left-=q;}}}}
async function maintainFunding({foodTarget=null}={}){await prepare();await unload();let s=await state(),demand=(await view()).foodSupply.dailyDemand;
 if(s.personsById[MASTER].energy<45)await rest(90);
 const target=foodTarget??demand*3;
 for(let tries=0;quantity(await state(),HOME,'food')<target&&tries<24;tries++){
  s=await state();if(s.srEconomy.patches.food.remaining<16){assert(quantity(s,HOME,'food')>=8+demand*2&&quantity(s,HOME,'jade')>=4,'finite food source cannot be restored while keeping two-day reserve');await sourceAction('food',true);}
  const harvested=await sourceAction('food');await receiveHarvestHome(harvested);
 }
 assert(quantity(await state(),HOME,'food')>=target,'physical food target must be met from actual HOME balance');
 assert(quantity(await state(),HOME,'food')>=demand*2,'two-day food floor');
}
async function sell(resource,amount){await maintainFunding();await transfer(HOME,CARRIED,resource,amount);await trade(resource,'sell',amount/10);await unload();}
async function buy(resource){await maintainFunding();await transfer(HOME,CARRIED,'jade',{stone:22,herb:25}[resource]);await trade(resource,'buy',1);await unload();}
async function gatherHome(resource){await maintainFunding();let s=await state();const batch={wood:12,herb:10,food:16}[resource];assert(s.srEconomy.patches[resource].remaining>=batch,'finite '+resource+' patch exhausted');const harvested=await sourceAction(resource);if(resource==='food')await receiveHarvestHome(harvested);else await transfer(CARRIED,HOME,resource,batch);}
async function claimRewards(){await pause(true);const ready=(await view()).progressRewards.filter(r=>r.eligible&&!r.claimed);for(const r of ready){assert(r.available,r.reason);await id('affairs');const before=await state();await act('progress:reward:'+r.id);const after=await state();for(const[k,n]of Object.entries(r.resources))assert(Math.abs(quantity(after,HOME,k)-quantity(before,HOME,k)-n)<1e-7);assert(after.claimed.includes(r.id));assert.equal(after.worldTick,before.worldTick);record('正式面板确认既有院务所得',{reward:r});}await closePanel();await reopen('progress-rewards-claimed');}
let foodRecoveryPolicy=null;
function constructionBudget(tick,legTicks,labourTicks,demand,dayTicks){
 const budgetTicks=Math.ceil((legTicks.reduce((a,b)=>a+b,0)+labourTicks)*1.25)+200,latestDeliveryTick=tick+budgetTicks;
 const settlements=Math.floor(latestDeliveryTick/dayTicks)-Math.floor(tick/dayTicks);
 return {budgetTicks,latestDeliveryTick,settlements,requiredFood:settlements*demand};
}
function recoveryBudget(tick,travelTicks,demand,dayTicks){
 const budgetTicks=Math.ceil((travelTicks+100)*1.25)+200,latestDeliveryTick=tick+budgetTicks;
 const settlements=Math.floor(latestDeliveryTick/dayTicks)-Math.floor(tick/dayTicks);
 return {budgetTicks,latestDeliveryTick,settlements,requiredFood:settlements*demand};
}
function checkRecoveryFood(s){
 assert.equal(s.economy.starvation,0,'budgeted QA continuation must never incur starvation');
 assert(quantity(s,HOME,'food')>=0,'actual food remains nonnegative');
 assert(s.worldTick<=foodRecoveryPolicy.latestDeliveryTick,'budgeted QA continuation exceeded its world-tick deadline');
 for(const f of Object.values(s.factsById))if(f.kind==='daily-supply-relation'&&f.atTick>=foodRecoveryPolicy.startTick){assert.equal(f.supplied,true,'actual daily resident food supply');assert.equal(f.starvation,0);supplyEvidence.set(f.id,f);}
 const dayTicks=initial.state.ticksPerDay||1200;for(let day=Math.floor(foodRecoveryPolicy.startTick/dayTicks)+1;day<=Math.floor(s.worldTick/dayTicks);day++)for(const personId of s.homeMemberIds){const factId='fact:person-daily-supply:'+personId+':'+day,fact=s.factsById[factId]||supplyEvidence.get(factId);assert(fact,'each elapsed settlement has its actual resident supply fact in live or captured evidence');assert.equal(fact.id,factId);assert.equal(fact.personId,personId);assert.equal(fact.dayIndex,day);assert(fact.atTick>=foodRecoveryPolicy.startTick&&fact.atTick<=s.worldTick,'captured supply belongs to this observed budget interval');assert.equal(fact.supplied,true);assert.equal(fact.starvation,0);}
}
async function recoverFood(target=60){
 assert.equal(target,60,'bounded recovery target is sixty real HOME food');await prepare();
 try{for(let turn=0;quantity(await state(),HOME,'food')<target&&turn<16;turn++){
  await pause(true);const s=await state(),gs={...s,buildings:Object.values(s.buildingsById)},person=s.personsById[MASTER],patch=s.srEconomy.patches.food;
  assert(patch.remaining>=16,'food recovery requires existing finite source; replenish needs separate budgeting');
  assert.equal(carriedPhysicalTotal(s),0,'recovery starts each harvest with an empty real carried stock');
  assert(person.energy>=15,'recovery requires harvest-ready actual energy');
  const producer=gs.buildings.find(b=>Object.hasOwn(BUILDINGS[b.type].out||{},'food')&&b.enabled!==false&&b.condition>0),anchor=producer?buildingAccess(gs,producer):patch.position;
  assert(anchor,'existing normal food source position');const sourcePoint=nearestVisibleBodyTarget(gs,person.scenic,anchor,[],{maxDistance:3});assert(sourcePoint,'actual food source foot point');
  const routeLength=(from,to)=>{const route=meterFindPath(gs,from,to,{maxSnap:0});assert(route,'normal food recovery road');let length=0,last=from;for(const point of route){length+=Math.hypot(point.x-last.x,point.y-last.y);last=point;}return length;};
  const outwardMetres=routeLength(person.position,sourcePoint),returnMetres=routeLength(sourcePoint,s.stockpilesById[HOME].position),travelTicks=Math.ceil((outwardMetres+returnMetres)/(.144*COURTYARD_WALK_RATE)),demand=(await view()).foodSupply.dailyDemand;
  const budget=recoveryBudget(s.worldTick,travelTicks,demand,s.ticksPerDay||1200);assert(quantity(s,HOME,'food')>=budget.requiredFood,'actual food must cover every budgeted daily settlement before delivery');
  foodRecoveryPolicy={startTick:s.worldTick,...budget};record('正常口粮恢复预算',{policy:'temporary QA recovery: actual daily affordability and zero starvation until HOME food sixty; standard two-day guard resumes afterward',target,outwardMetres,returnMetres,travelTicks,harvestLabourTicks:100,timeMargin:1.25,menuBufferTicks:200,demand,startingFood:quantity(s,HOME,'food'),...foodRecoveryPolicy});checkRecoveryFood(s);
  const harvest=await sourceAction('food');await receiveHarvestHome(harvest);const after=await state();checkRecoveryFood(after);record('正常口粮恢复实际入库',{tick:after.worldTick,food:quantity(after,HOME,'food'),harvestFact:harvest.fact});foodRecoveryPolicy=null;
 }
 assert(quantity(await state(),HOME,'food')>=target,'bounded recovery reaches real HOME food target');
 }finally{foodRecoveryPolicy=null;}
}
async function clinic(){
 await prepare();await pause(true);const before=await state(),b=building(before,14),patientId=option('patient')||'person:cheng-wenzhou';assert(b,'GC14 must be completed');
 const sid='stockpile:'+b.instanceId;assert(quantity(before,sid,'herb')>=1&&quantity(before,sid,'cleanWater')>=1,'real clinic inputs must already be delivered');
 await openBuilding(14);const startKey='service:start:treatment:'+patientId;assert(await key(startKey).isEnabled(),'patient must be eligible in public clinic UI');await act(startKey);
 let s=await state();const o=Object.values(s.workOrdersById).find(o=>o.kind==='sr-site-service'&&o.recipeId==='treatment'&&!before.workOrdersById[o.id]);assert(o);assert.equal(o.patientId,patientId);assert.equal(o.durationTicks,80);watchedOrders.add(o.id);
 await act('service:master:'+o.id);await closePanel();await resume();let onsite=false;
 await awaitManualTask((v,s)=>{const order=s.workOrdersById[o.id];if(order.phase==='working'){
 const worker=s.personsById[MASTER],patient=s.personsById[patientId],a=s.activitiesById[worker.activityId],pa=s.activitiesById[patient.activityId];
 assert.equal(a?.serviceOrderId,o.id);assert.equal(pa?.serviceOrderId,o.id);assert.equal(pa.slotId,order.patientSlotId);
 for(const [person,activity] of [[worker,a],[patient,pa]]){const slot=slotById({...s,buildings:Object.values(s.buildingsById)},activity.slotId);assert(slot);assert(Math.hypot(person.position.x-slot.position.x,person.position.y-slot.position.y)<.04);}
 if(!onsite){onsite=true;record('医患各自实际到诊疗工位',{orderId:o.id,workerSlot:a.slotId,patientSlot:pa.slotId,tick:s.worldTick,worker:structuredClone({personId:MASTER,position:worker.position,slotPosition:slotById({...s,buildings:Object.values(s.buildingsById)},a.slotId).position,activity:a}),patient:structuredClone({personId:patientId,position:patient.position,slotPosition:slotById({...s,buildings:Object.values(s.buildingsById)},pa.slotId).position,activity:pa})});}
 }return order.phase==='completed';},'one physical clinic treatment',{startTick:s.worldTick,seconds:1200});
 await pause(true);s=await state();const done=s.workOrdersById[o.id],fact=s.factsById[done.resultFactId];assert(onsite,'working medical and patient slots must have been observed');assert.equal(done.progressTicks,80);assert.equal(done.workerId,MASTER);assert.equal(fact.kind,'site-service-completed');assert.deepEqual(fact.input,{herb:1,cleanWater:1});assert.equal(fact.effect.woundAfter,Math.max(0,fact.effect.woundBefore-4));assert.equal(s.personsById[patientId].wound,fact.effect.woundAfter);assert.equal(quantity(before,sid,'herb')-quantity(s,sid,'herb'),1);assert.equal(quantity(before,sid,'cleanWater')-quantity(s,sid,'cleanWater'),1);record('真实诊疗材料消耗及伤势下降',{orderId:o.id,fact});await capture('clinic-completed');
}
try{await launch();{assert.deepEqual(await state(),original.state);await pause(true);await manual();record('同源原生世界精确载入',{tick:lastTick});if(stage==='actions'){for(const action of plan){phase='action:'+actions.length+':'+action.type;switch(action.type){case'food-recovery':await recoverFood(action.quantity??60);break;case'clinic':await clinic();break;case'toggle-building':{await prepare();await openBuilding(action.site);const b=building(await state(),action.site);assert(b);if(b.enabled!==action.enabled)await act('workplace:toggle');assert.equal(building(await state(),action.site).enabled,action.enabled);await closePanel();record('实际设施启停',{site:action.site,enabled:action.enabled});break;}case'transfer':await transfer(action.from,action.to,action.resource,action.quantity,{save:!!action.save});break;case'harvest':await sourceAction(action.resource);break;case'replenish':await sourceAction(action.resource,true);break;case'trade':await trade(action.resource,action.side,action.batches);break;case'food-floor':assert(Number.isFinite(action.quantity)&&action.quantity>=24&&action.quantity<=160,'bounded physical food target');await maintainFunding({foodTarget:action.quantity});break;case'rest':await rest(action.energy||90);break;default:throw Error('Unsupported public UI plan operation '+action.type);}if(action.reopen)await reopen('action-'+saved.length);}}else if(stage==='build14')await construct(14);else await clinic();}await pause(true);await closePanel();await reopen('complete-world');await checkpoint('complete-world');assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.deepEqual(errors,[]);complete=true;phase='complete';}
catch(e){if(e.code==='HARNESS_STOP'){checks.push({name:'requested-stop',ok:true,phase,wallSeconds:wall()});console.log(e.message);}else{errors.push(e.stack);console.error(e.stack);process.exitCode=1;}if(page){await pause(true).catch(()=>{});await capture(stopRequested?'stopped':'failure').catch(()=>{});await checkpoint(stopRequested?'stopped-world':'failure-world').catch(()=>{});}}
finally{
 const finalizationErrors=[];
 const failed=(operation,error)=>{const detail={operation,message:error.message,code:error.code??null,path:error.path??null,syscall:error.syscall??null};finalizationErrors.push(detail);errors.push(JSON.stringify(detail));process.exitCode=1;};
 if(page){await page.evaluate(()=>window.__physicalCheckpoint??null).then(observation=>fs.writeFile(path.join(output,'observer-final.json'),JSON.stringify(observation,null,2)+'\n')).catch(e=>failed('final-observer-read',e));await page.evaluate(()=>clearInterval(window.__physicalCheckpointTimer)).catch(e=>failed('final-observer-cleanup',e));await pause(true).catch(e=>failed('final-pause',e));await id('save').catch(e=>failed('final-save',e));}
 if(electron)await close().catch(e=>failed('final-close',e));
 let runtimeSha256After=null,sourceUnchanged=null,runtimeUnchanged=null;
 try{runtimeSha256After=await hashes();runtimeUnchanged=JSON.stringify(runtimeSha256After)===JSON.stringify(runtimeSha256);}catch(e){failed('runtime-hashes-readback',e);}
 try{sourceUnchanged=hash(await fs.readFile(source))===hash(bytes);}catch(e){failed('source-readback',e);}
 if(sourceUnchanged===false||runtimeUnchanged===false){errors.push('source/runtime changed');process.exitCode=1;}
 let nativeExact=false;
 try{const disk=JSON.parse(await fs.readFile(native));const last=saved.at(-1);if(last)nativeExact=JSON.stringify(disk.state)===JSON.stringify(JSON.parse(await fs.readFile(path.join(output,last.file))).state);}catch(e){failed('native-checkpoint-readback',e);}
 const report={status:stopRequested&&!errors.length&&nativeExact?'stopped':complete&&!errors.length&&nativeExact?'passed':'failed',stopFile,stopRequested,stage,phase,source,sourceSha256:hash(bytes),sourceUnchanged,runtimeSha256,runtimeSha256After,runtimeUnchanged,nativeExact,initialTick:initial.state.worldTick,finalTick:lastTick,wallSeconds:wall(),scope:'source Electron; public UI; bounded logistics observations; actual wall clock and exact native save reopen',dailySupplyFacts:[...supplyEvidence.values()],checks,errors,finalizationErrors,actions,saved,observations};
 const reportText=JSON.stringify(report,null,2)+'\n';
 try{await fs.writeFile(path.join(output,'report.json'),reportText);}catch(e){process.exitCode=1;console.error('Report write failed: '+JSON.stringify({message:e.message,code:e.code,path:e.path}));console.error(reportText);}
 if(!nativeExact||errors.length)process.exitCode=1;console.log('Evidence: '+output);
}
