/** Formal desktop first encounter, SR-XF-013 partial acceptance (41 / 05).
 * Prepare: --stage=prepare --output=/absolute/fresh-directory
 * Run: --stage=run --source=/absolute/native.json --output=/absolute/fresh-directory
 * Preparation uses public commands and integer simulation steps. Run uses visible
 * desktop controls and wall time; each directory retains its own native world.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {masterOf,atExit,arrivedIn,walkSettled,pendingDone,actionReady,guardActive,injuredReady,retreatComplete} from './courtyard-combat-observations.mjs';
import {createOpeningSectSession,commandSect,advanceSect,openingView,restoreSect,validateSect,viewSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const stage=option('stage')||'run',output=option('output'),source=option('source');
assert(output&&path.isAbsolute(output),'absolute --output required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'QA output must be outside repository');
assert(['prepare','run','preflight'].includes(stage),'unknown stage');
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
await fs.mkdir(output,{recursive:false});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
if(stage==='prepare'){
 const session=createOpeningSectSession(),commands=[],initial=snapshotSect(session),started=performance.now();
 const send=request=>{const result=commandSect(session,request);commands.push({tick:session.state.worldTick,request,result});assert(result.ok,result.error);};
 const until=(predicate,label)=>{for(let n=0;n<5000&&!predicate();n++)advanceSect(session,.1);assert(predicate(),label);};
 for(const page of [1,2])send({type:'opening-intro',page});
 send({type:'opening-intro',complete:true});send({type:'heal'});send({type:'choose-inheritance',lineage:'qinglan'});
 until(()=>openingView(session).stage==='hall-ready','opening injury recovery');
 send({type:'establish-hall'});until(()=>openingView(session).stage==='complete','real hall construction');
 send({type:'manual'});send({type:'pause',paused:true});
 const prepared=snapshotSect(session);prepared.courtyardPresentation={version:2,manualPause:true};
 assert.equal(validateSect(prepared),true);assert.deepEqual(restoreSect(prepared).state,prepared.state);
 await fs.writeFile(path.join(output,'initial.json'),json(initial));
 const native=json(prepared);await fs.writeFile(path.join(output,'sect-save.json'),native);
 await fs.writeFile(path.join(output,'preparation.json'),json({scope:'public desktop opening commands; integer advanceSect preparation simulation; no Electron run',commands,initialTick:0,finalTick:session.state.worldTick,wallSeconds:(performance.now()-started)/1000,sourceSha256:hash(native),master:session.state.master.location,terrain:session.state.spatial.courtyardTerrain??null,opening:openingView(session)}));
 console.log(json({status:'prepared',source:path.join(output,'sect-save.json'),tick:session.state.worldTick,sha256:hash(native)}));process.exit(0);
}
assert(source&&path.isAbsolute(source),'absolute --source required');
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original);
assert.deepEqual(initial.state,original.state,'source must restore canonically');assert.equal(validateSect(initial),true);
await fs.writeFile(path.join(output,'source.json'),bytes);
if(stage==='preflight'){
 await fs.writeFile(path.join(output,'report.json'),json({status:'preflight',scope:'read only; no Electron or world advancement',source,sha256:hash(bytes),tick:initial.state.worldTick,master:initial.state.master.location,opening:openingView(initial),expedition:viewSect(initial).expedition}));process.exit(0);
}
assert.equal(initial.state.speed,0,'source must be paused');assert.equal(openingView(initial).stage,'complete');
const directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');await fs.mkdir(directory);await fs.writeFile(native,bytes);
async function filesUnder(relative){const entries=await fs.readdir(path.join(repositoryRoot,relative),{withFileTypes:true});return(await Promise.all(entries.map(e=>e.isDirectory()?filesUnder(relative+'/'+e.name):relative+'/'+e.name))).flat();}
const target=desktopTarget(),runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json','tests/acceptance/courtyard-combat-normal-desktop.mjs','tests/acceptance/desktop-target.mjs','tests/acceptance/courtyard-combat-observations.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeBefore=await hashes(),checks=[],actions=[],errors=[],finalizationErrors=[],started=performance.now();
let electron,page,lastTick=initial.state.worldTick,complete=false,phase='launch';
const wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const record=(name,extra={})=>{checks.push({name,ok:true,wallSeconds:wall(),...extra});console.log('PASS '+name);};
const read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view(),status:window.courtyardQA.status(),errors:window.courtyardQA.metrics().errors}));
async function click(selector){await page.locator(selector).click();actions.push({selector,wallSeconds:wall(),tick:await page.evaluate(()=>window.courtyardQA.metrics().tick)});}
async function pause(value){if((await page.evaluate(()=>window.courtyardQA.status().manualPause))!==value)await click('#pause');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),value);}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function checkpoint(name){const r=await read();lastTick=r.session.state.worldTick;assert.equal(validateSect(r.session),true);assert.deepEqual(restoreSect(r.session).state,r.session.state);await fs.writeFile(path.join(output,name+'.json'),json(r));return r;}
async function until(predicate,label,seconds=120){const start=performance.now();while(performance.now()-start<seconds*1000){const r=await read();lastTick=r.session.state.worldTick;assert.deepEqual(r.errors,[]);if(predicate(r)){return r;}await sleep(100);}throw Error('Timed out '+label+' at '+lastTick);}
async function launch(){const {_electron}=await import('playwright');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.stack||e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
async function close(){
 if(!electron)return;const app=electron,process=app.process();
 if(process&&(process.exitCode!==null||process.signalCode!==null)){electron=null;page=null;return;}
 const closed=app.waitForEvent('close',{timeout:30000}).then(()=>({ok:true}),error=>({ok:false,error}));
 let commandError=null;try{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0]?.close());}catch(error){commandError=error;}
 const result=await closed;electron=null;page=null;if(!result.ok)throw commandError?new AggregateError([commandError,result.error],'native close failed'):result.error;
}
async function reopen(name){await pause(true);const before=await checkpoint(name+'-before');await capture(name);await click('#save');for(let n=0;n<100;n++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(before.session.state))break;await sleep(100);}assert.deepEqual(JSON.parse(await fs.readFile(native)).state,before.session.state);await close();const closed=await fs.readFile(native);await fs.writeFile(path.join(output,name+'-closed-native.json'),closed);assert.deepEqual(JSON.parse(closed).state,before.session.state);assert.equal(JSON.parse(closed).courtyardPresentation.manualPause,true);await sleep(500);await launch();const after=await checkpoint(name+'-reopened');assert.deepEqual(after.session.state,before.session.state);assert.equal(after.status.manualPause,true);record('native save close reopen '+name,{tick:lastTick});}
async function runUntil(predicate,label,seconds=120){await pause(false);await until(predicate,label,seconds);await pause(true);return read();}
async function action(id){await until(r=>actionReady(r,id),id+' available');await pause(true);await click(`[data-combat-action="${id}"]`);return checkpoint('queued-'+id);}
try{
 await launch();assert.deepEqual((await read()).session.state,original.state);await pause(true);record('source exact native load',{tick:lastTick});
 phase='outbound';await click('#expedition-open');
 await runUntil(r=>atExit(r,'exit:yunxiu-valley'),'actual mountain gate approach');
 record('master physically reached courtyard exit',{location:masterOf(await read()).position});
 await click('#expedition-open');await runUntil(r=>arrivedIn(r,'scene:valley'),'valley arrival');await capture('valley-arrival');
 await click('#expedition-approach');await runUntil(walkSettled,'approach visible opponent');
 await click('#expedition-engage');await click('#expedition-target');let r=await checkpoint('engaged');assert.equal(r.session.state.combat.status,'active');assert.equal(r.session.state.combat.enemies[0].personId,'person:valley-shanxiao');
 phase='paused-plan';const before=r.session.state,qi=before.combat.player.qi,hp=before.combat.enemies[0].hp;
 await click('[data-combat-action="spell"]');r=await checkpoint('paused-spell-plan');assert.equal(r.session.state.worldTick,before.worldTick);assert.equal(r.session.state.combat.player.qi,qi);assert.equal(r.session.state.combat.enemies[0].hp,hp);assert.equal(r.session.state.srCombat.pending.action,'spell');await sleep(600);assert.deepEqual((await read()).session.state,r.session.state);record('paused spell plan holds tick qi and damage');
 await reopen('combat-pending');phase='combat';
 r=await runUntil(pendingDone,'spell execution');assert(r.session.state.combat.enemies[0].hp<hp);assert(r.session.state.combat.player.qi<qi);record('spell executes after resume');
 await pause(false);await action('attack');const enemyHp=(await read()).session.state.combat.enemies[0].hp;r=await runUntil(pendingDone,'attack');assert(r.session.state.combat.enemies[0].hp<enemyHp);record('attack deals actual damage');
 await pause(false);await action('guard');r=await runUntil(guardActive,'guard effect');assert(r.session.state.combat.player.guard>0);await capture('guard-effect');record('guard has actual duration');await pause(false);await until(pendingDone,'guard recovery');
 await pause(true);const feet=structuredClone(masterOf(await read()).position);await click('[data-combat-dodge="down"]');r=await runUntil(pendingDone,'dodge');assert.notDeepEqual(masterOf(r).position,feet);record('dodge changes actual world feet');await capture('dodge-effect');
 r=await runUntil(injuredReady,'actual injury');assert(r.session.state.combat.player.hp<r.session.state.combat.player.maxHp);const injury=masterOf(r).wound;await capture('injured-combat');record('actual enemy hit wounds same master',{wound:injury});
 phase='retreat';await click('[data-combat-action="retreat"]');r=await runUntil(retreatComplete,'physical retreat');assert.equal(masterOf(r).position.sceneId,'scene:valley');assert(masterOf(r).wound>0);assert(Math.hypot(masterOf(r).position.x-21.7,masterOf(r).position.y-36)<.4);record('retreat reaches real valley safety point',{location:masterOf(r).position,wound:masterOf(r).wound});await reopen('retreated-result');
 await click('#combat-acknowledge');await click('#expedition-exit');await runUntil(r=>atExit(r,'exit:valley-yunxiu'),'return exit approach');
 await click('#expedition-exit');r=await runUntil(r=>arrivedIn(r,'scene:yunxiu-courtyard'),'return home');assert.equal(masterOf(r).personId,'person:master');assert(masterOf(r).wound>0);record('injured same master returns home',{location:masterOf(r).position,wound:masterOf(r).wound});await reopen('injured-home');
 await checkpoint('complete-world');assert.deepEqual((await read()).errors,[]);assert.deepEqual(errors,[]);complete=true;phase='complete';
}catch(e){errors.push(e.stack||String(e));console.error(e.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{
 if(page){try{await pause(true);await click('#save');await sleep(300);await checkpoint('final-world');}catch(e){finalizationErrors.push(String(e.stack||e));}}
 try{await close();}catch(e){finalizationErrors.push(String(e.stack||e));}
 const runtimeAfter=await hashes(),sourceUnchanged=hash(await fs.readFile(source))===hash(bytes),runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter);let nativeExact=false;
 try{nativeExact=JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(JSON.parse(await fs.readFile(path.join(output,'final-world.json'))).session.state);}catch(e){finalizationErrors.push(String(e));}
 const report={status:complete&&!errors.length&&!finalizationErrors.length&&sourceUnchanged&&runtimeUnchanged&&nativeExact?'passed':'failed',phase,source,sourceSha256:hash(bytes),sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,nativeExact,initialTick:initial.state.worldTick,finalTick:lastTick,wallSeconds:wall(),scope:'visible macOS source Electron; public controls; sampled state; actual wall time; source preparation recorded separately',checks,actions,errors,finalizationErrors};await fs.writeFile(path.join(output,'report.json'),json(report));console.log(json({status:report.status,report:path.join(output,'report.json')}));if(report.status!=='passed')process.exitCode=1;
}
