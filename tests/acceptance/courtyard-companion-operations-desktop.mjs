/** Configured native Electron round: real policy UI, real elapsed world, real consequences. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {createCompanionOperationsScenario} from '../fixtures/companion-operations.mjs';
import {commandSect,restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
const arg=k=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3),output=arg('output'),condition=arg('condition')||'safe';
assert(output&&path.isAbsolute(output)&&!output.startsWith(repositoryRoot));await fs.mkdir(output,{recursive:false});
const f=createCompanionOperationsScenario({condition}),start=f.session.state.worldTick,initialFacts=new Set(Object.keys(f.session.state.factsById));
assert(commandSect(f.session,{type:'pause',paused:true}).ok);
const world=path.join(output,'world');await fs.mkdir(world);await fs.writeFile(path.join(world,'sect-save.json'),JSON.stringify(f.session));await fs.writeFile(path.join(output,'initial.json'),JSON.stringify(f.session));
const files=['src/simulation/ea-courtyard-visible-ground.mjs','apps/courtyard/courtyard-panels.mjs','src/simulation/ea-sect-domain.mjs','src/simulation/ea-static-polygon-index.mjs','src/simulation/ea-disciple-expeditions.mjs','src/simulation/ea-disciple-expedition-cooperation.mjs','src/simulation/ea-disciple-expedition-walk.mjs','src/simulation/ea-sr-world.mjs','src/simulation/ea-sect-sustenance.mjs','src/simulation/ea-society.mjs','src/simulation/ea-sr-persons.mjs','src/simulation/ea-sr-spatial.mjs','apps/courtyard/sect-sim.mjs','apps/courtyard/courtyard-main.mjs','apps/courtyard/courtyard-expeditions-panel.mjs','tests/fixtures/companion-operations.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async x=>[x,createHash('sha256').update(await fs.readFile(path.join(repositoryRoot,x))).digest('hex')])));
const report={success:false,condition,configured:f.metadata,startTick:start,runtimeRoot:repositoryRoot,runtimeBefore:await hashes(),checks:[],phases:[],daily:[],production:[],foodDeliveries:[],beds:[],errors:[],actions:[],snapshots:[]};
const started=performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));let app,page,last,terminal,policyClosed=false,profileClient;const seen=new Set(),factsSeen=new Set(initialFacts);
const write=(name,data)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(data,null,2));
async function read(){return page.evaluate(()=>{const before=performance.now(),raw=window.courtyardQA.snapshot();window.__ops?.probes.push({start:before,end:performance.now()});return raw;});}
async function click(selector){await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).click();report.actions.push({selector,wallSeconds:(performance.now()-started)/1000});}
async function closePanels(){for(const selector of ['#dialog-close','#close-person','#close-management'])if(await page.locator(selector).isVisible())await click(selector);}
async function pause(value){await closePanels();if(await page.evaluate(()=>window.courtyardQA.status().manualPause)!==value)await click('#pause');}
async function checkpoint(label){const raw=await read();await write(label,raw);await page.screenshot({path:path.join(output,label+'.png')});report.snapshots.push({label,tick:raw.state.worldTick});return raw;}
async function affairs(){await closePanels();await click('#affairs');}
try{
 const target=desktopTarget(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:target.executable,args:[...target.args,'--qa-dir='+world,'--qa-scenario=native','--show'],env});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});
 if(arg('profile')==='true'){profileClient=await page.context().newCDPSession(page);await profileClient.send('Performance.enable');await profileClient.send('Profiler.enable');await profileClient.send('Profiler.setSamplingInterval',{interval:1000});const before=await page.evaluate(()=>performance.now()),metrics=await profileClient.send('Performance.getMetrics'),after=await page.evaluate(()=>performance.now());report.profileClock={before,after,metrics};await profileClient.send('Profiler.start');}
 report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,userAgent:navigator.userAgent}));
 await page.evaluate(()=>{
  const m=window.__ops={gaps:[],longTasks:[],clicks:[],probes:[],last:performance.now(),active:false};
  const frame=()=>{const now=performance.now(),active=window.courtyardQA.status().pauseReasons.length===0;if(active&&m.active)m.gaps.push({at:now,ms:now-m.last});m.last=now;m.active=active;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>m.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask'});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const c={id:b.id||b.dataset.uiKey||b.textContent,start:performance.now()};m.clicks.push(c);requestAnimationFrame(()=>{c.frame=performance.now();c.responseMs=c.frame-c.start;});},true);
 });
 assert.equal((await read()).state.worldTick,start);await affairs();await checkpoint('initial-policy');
 await click('[data-ui-key="disciple-expeditions-companions"]');await affairs();await click('[data-ui-key="disciple-expeditions-policy"]');await closePanels();
 const policy=await read();assert.equal(policy.state.discipleExpeditions.enabled,true);assert.equal(policy.state.discipleExpeditions.allowCompanions,true);assert.equal(policy.state.worldTick,start);report.checks.push('actual policy buttons keep paused world unchanged');await pause(false);
 let lastDay=Math.floor(start/f.session.state.ticksPerDay),outbound=false,inflightPanel=false,returnedPanel=false;
 for(let sample=0;sample<700;sample++){
  await sleep(1000);const raw=await read(),s=raw.state;last=raw;assert.equal(s.homeMemberIds.length,5);assert.equal(s.economy.starvation,0,'every observed daily settlement is supplied');
  const js=s.discipleExpeditions.journeys.filter(j=>f.travellerIds.includes(j.personId));
  const key=js.map(j=>j.phase).join('/');if(!seen.has(key)){seen.add(key);report.phases.push({tick:s.worldTick,phases:js.map(j=>({id:j.id,personId:j.personId,phase:j.phase,position:s.personsById[j.personId].position}))});await checkpoint('phase-'+report.phases.length);console.log('PHASE',s.worldTick,key);}
  for(const fact of Object.values(s.factsById))if(!factsSeen.has(fact.id)){
   factsSeen.add(fact.id);if(fact.operation==='production')report.production.push(fact);
   if(fact.kind==='daily-supply-relation'&&f.memberIds.includes(fact.personId)){assert(fact.supplied);report.daily.push(fact);}
  }
  for(const w of Object.values(s.workOrdersById))if(w.kind==='transport'&&w.phase==='delivered'&&w.cargo.food>0&&w.targetStockpileId===f.sourceStockpileId&&!report.foodDeliveries.some(x=>x.id===w.id))report.foodDeliveries.push(w);
  for(const id of f.travellerIds){const p=s.personsById[id],a=s.activitiesById[p.activityId];if(p.wound>5&&a?.kind==='facility'&&a.action==='heal'&&a.phase==='executing'&&!report.beds.some(b=>b.id===id))report.beds.push({id,tick:s.worldTick,wound:p.wound,body:a,position:p.position});}
  if(js.some(j=>['outbound','exploring','scouting','valley-return','returning'].includes(j.phase)))outbound=true;
  if(outbound&&!inflightPanel&&js.some(j=>j.phase!=='returned')){
   await pause(true);await affairs();const v=await page.evaluate(()=>window.courtyardQA.view().discipleExpeditions);assert(v.journeys.filter(j=>j.knownStatus!=='本人已归院').every(j=>j.report===null));
   await page.locator('[data-ui-key="disciple-expeditions-policy"]').scrollIntoViewIfNeeded();await checkpoint('inflight-policy');await fs.writeFile(path.join(output,'inflight-panel.txt'),await page.locator('#management-body').innerText());inflightPanel=true;await pause(false);
  }
  if(js.length===2&&js.every(j=>j.phase==='returned')&&!returnedPanel){
   await pause(true);await affairs();await page.getByText('归来汇报',{exact:true}).first().scrollIntoViewIfNeeded();await checkpoint('return-report');await fs.writeFile(path.join(output,'return-panel.txt'),await page.locator('#management-body').innerText());
   const v=await page.evaluate(()=>window.courtyardQA.view().discipleExpeditions);assert(v.journeys.every(j=>j.report));await click('[data-ui-key="disciple-expeditions-policy"]');policyClosed=true;returnedPanel=true;await pause(false);
  }
  const returned=js.length===2&&js.every(j=>j.phase==='returned'),bothProduced=returned&&f.travellerIds.every(id=>report.production.some(p=>p.atTick>js.find(j=>j.personId===id).completedTick&&p.participantIds?.includes(id)));
  if(sample%20===0){await write('progress',{tick:s.worldTick,wallSeconds:(performance.now()-started)/1000,phases:key,daily:report.daily.length,production:report.production.length,foodDeliveries:report.foodDeliveries.length,beds:report.beds});console.log('PROGRESS',s.worldTick,report.daily.length,bothProduced);}
  if(returned&&bothProduced&&report.daily.length>=10&&report.foodDeliveries.length>=2){terminal=raw;break;}
 }
 assert(terminal,'native round reaches both own production and two supplied daily settlements');assert(outbound&&inflightPanel&&returnedPanel&&policyClosed);assert(report.foodDeliveries.some(w=>f.stayIds.includes(w.carrierId)),'retained disciple physically transports food');
 const js=terminal.state.discipleExpeditions.journeys;assert.equal(js.length,2);assert(js.every(j=>j.cost.food===2&&j.cost.energy===8));
 if(condition==='encounter'){assert(js.every(j=>j.encounter.injury===10));assert.equal(js.filter(j=>j.medicine.use?.status==='consumed').length,1);assert(report.beds.length,'untreated traveller reaches real bed');assert(f.travellerIds.every(id=>terminal.state.personsById[id].wound<=5));}
 await pause(true);await click('#people');await checkpoint('terminal-people');terminal=await read();validateSect(restoreSect(terminal));await write('terminal',terminal);
 report.checks.push('two separately willing travellers pay own costs and return','three retained identities continue official activity','five supplied people across two daily settlements','finite source actually hauled by retained disciple','each returned traveller produces again','inflight privacy and actual returned report');if(condition==='encounter')report.checks.push('one dose consumed once and untreated traveller recovers in bed');
 report.measurements=await page.evaluate(()=>window.__ops);report.status=await page.evaluate(()=>window.courtyardQA.status());assert.deepEqual(report.status.errors,[]);assert.deepEqual(report.errors,[]);report.runtimeAfter=await hashes();assert.deepEqual(report.runtimeAfter,report.runtimeBefore);report.success=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;if(page){try{last=await checkpoint('failure');}catch(c){report.errors.push('capture: '+c.message);}}}
finally{
 if(profileClient){try{const {profile}=await profileClient.send('Profiler.stop');await write('renderer-profile',profile);await profileClient.detach();report.profileCaptured=true;}catch(e){report.errors.push('profile: '+e.message);report.success=false;process.exitCode=1;}}
 if(page){try{await pause(true);await write('last-state',await read());report.measurements??=await page.evaluate(()=>window.__ops);report.saveTimings=await page.evaluate(()=>window.courtyardQA.saveTimings());}catch(e){report.errors.push('final capture: '+e.message);}}
 if(app){try{await app.close();report.closed=true;}catch(e){report.errors.push('close: '+e.message);report.success=false;}}
 report.endTick=terminal?.state.worldTick||last?.state.worldTick;report.wallSeconds=(performance.now()-started)/1000;await write('report',report);console.log(JSON.stringify({success:report.success,condition,output,tick:report.endTick,checks:report.checks.length,errors:report.errors}));
}
