/** Native keyboard and mouse first encounter, SR-XF-013 partial acceptance.
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
import {masterOf,atExit,arrivedIn,walkSettled,pendingDone,actionReady,guardActive,injuredReady,retreatComplete,manualActionReady,movementCleared,combatPoint,firstEnemy,distanceBetween,projectilePresent,attackSettled,automaticAttackProven} from './courtyard-combat-observations.mjs';
import {createOpeningSectSession,commandSect,advanceSect,openingView,restoreSect,validateSect,viewSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const stage=option('stage')||'run',output=option('output'),source=option('source'),combatOnly=process.argv.includes('--combat-only'),resumeCombat=process.argv.includes('--resume-combat'),resumeAfterBlur=process.argv.includes('--resume-after-blur');
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
const target=desktopTarget(),runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json','tests/acceptance/courtyard-combat-normal-desktop.mjs','tests/acceptance/courtyard-combat-direct-desktop.mjs','tests/acceptance/desktop-target.mjs','tests/acceptance/courtyard-combat-observations.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeBefore=await hashes(),checks=[],actions=[],errors=[],finalizationErrors=[],started=performance.now();
let electron,page,gameWindowId,lastTick=initial.state.worldTick,complete=false,phase='launch';
const wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const record=(name,extra={})=>{checks.push({name,ok:true,wallSeconds:wall(),...extra});console.log('PASS '+name);};
const read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view(),status:window.courtyardQA.status(),errors:window.courtyardQA.metrics().errors,input:window.courtyardQA.expedition.inputState(),hasFocus:document.hasFocus()}));
async function click(selector){await page.locator(selector).click();actions.push({selector,wallSeconds:wall(),tick:await page.evaluate(()=>window.courtyardQA.metrics().tick)});}
async function pause(value){if((await page.evaluate(()=>window.courtyardQA.status().manualPause))!==value)await click('#pause');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),value);}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function checkpoint(name){const r=await read();lastTick=r.session.state.worldTick;if(!combatOnly){assert.equal(validateSect(r.session),true);if(r.status.manualPause)assert.deepEqual(restoreSect(r.session).state,r.session.state);}await fs.writeFile(path.join(output,name+'.json'),json(r));return r;}
async function until(predicate,label,seconds=120){const start=performance.now();while(performance.now()-start<seconds*1000){const r=await read();lastTick=r.session.state.worldTick;assert.deepEqual(r.errors,[]);if(predicate(r)){return r;}await sleep(100);}throw Error('Timed out '+label+' at '+lastTick);}
async function launch(){const {_electron}=await import('playwright');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();gameWindowId=await(await electron.browserWindow(page)).evaluate(w=>w.id);page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.stack||e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
async function close(){
 if(!electron)return;const app=electron,process=app.process();
 if(process&&(process.exitCode!==null||process.signalCode!==null)){electron=null;page=null;return;}
 const closed=app.waitForEvent('close',{timeout:30000}).then(()=>({ok:true}),error=>({ok:false,error}));
 let commandError=null;try{await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.close(),gameWindowId);}catch(error){commandError=error;}
 const result=await closed;electron=null;page=null;if(!result.ok)throw commandError?new AggregateError([commandError,result.error],'native close failed'):result.error;
}
async function reopen(name){if(combatOnly){await capture(name);return;}await pause(true);const before=await checkpoint(name+'-before');await capture(name);await click('#save');for(let n=0;n<100;n++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(before.session.state))break;await sleep(100);}assert.deepEqual(JSON.parse(await fs.readFile(native)).state,before.session.state);await close();const closed=await fs.readFile(native);await fs.writeFile(path.join(output,name+'-closed-native.json'),closed);assert.deepEqual(JSON.parse(closed).state,before.session.state);assert.equal(JSON.parse(closed).courtyardPresentation.manualPause,true);await sleep(500);await launch();const after=await checkpoint(name+'-reopened');assert.deepEqual(after.session.state,before.session.state);assert.equal(after.status.manualPause,true);record('native save close reopen '+name,{tick:lastTick});}
async function runUntil(predicate,label,seconds=120){await pause(false);await until(predicate,label,seconds);await pause(true);return read();}
async function action(id){await until(r=>actionReady(r,id),id+' available');await pause(true);await click(`[data-combat-action="${id}"]`);return checkpoint('queued-'+id);}
try{
 await launch();assert.deepEqual((await read()).session.state,original.state);await pause(true);record('source exact native load',{tick:lastTick});
 const position=()=>read().then(combatPoint);
 async function aim(point){const q=await page.evaluate(point=>window.courtyardQA.expedition.worldToScreen(point.x,point.y),point),box=await page.locator('#expedition-canvas').boundingBox();assert(box);await page.mouse.move(box.x+q.x,box.y+q.y);}
 async function held(keys,ms){await pause(false);const before=await read();for(const key of keys)await page.keyboard.down(key);await sleep(ms);const during=await read();for(const key of keys.slice().reverse())await page.keyboard.up(key);await pause(true);const after=await read();assert(movementCleared(after));return {before,during,after};}
 let r,stopped;if(!resumeCombat){
 phase='outbound';await click('#expedition-open');
 await runUntil(r=>atExit(r,'exit:yunxiu-valley'),'actual mountain gate approach');
 record('master physically reached courtyard exit',{location:masterOf(await read()).position});
 await click('#expedition-open');await runUntil(r=>arrivedIn(r,'scene:valley'),'valley arrival');await capture('valley-arrival');
 await click('#expedition-approach');await runUntil(walkSettled,'approach visible opponent');
 await click('#expedition-engage');r=await checkpoint('engaged');assert.equal(r.session.state.combat.status,'active');assert.equal(r.view.expedition.scene.presentation,'independent-arena');assert.equal(r.session.state.combat.enemies[0].personId,'person:valley-shanxiao');
 phase='direct-input';
 const outsideBefore=await read(),outsideTick=outsideBefore.session.state.worldTick,outsidePoint=combatPoint(outsideBefore);assert(distanceBetween(outsidePoint,firstEnemy(outsideBefore))>1.9);await click('#combat-auto');r=await runUntil(r=>r.session.state.worldTick>=outsideTick+2,'short out of range auto observation');assert.deepEqual(combatPoint(r),outsidePoint);assert.equal(firstEnemy(r).hp,firstEnemy(outsideBefore).hp);assert.equal(r.session.state.combat.player.target,null);await click('#combat-auto');record('out of range auto does not chase or cast');
 let motion=await held(['w'],400);assert(combatPoint(motion.after).y<combatPoint(motion.before).y);record('held W moves and keyup clears direction',{from:combatPoint(motion.before),to:combatPoint(motion.after)});
 stopped=await position();await pause(false);await sleep(400);await pause(true);assert.deepEqual(await position(),stopped);record('keyup stops actual movement');
 motion=await held(['s','d'],400);const v=motion.during.view.expedition.combat.controls.move;assert(Math.hypot(v.x,v.y)<=1.000001);assert(combatPoint(motion.after).x>combatPoint(motion.before).x);assert(combatPoint(motion.after).y>combatPoint(motion.before).y);record('diagonal held input is normalized',{move:v});
 await pause(false);await page.keyboard.down('a');await until(r=>combatPoint(r).x<=.61,'left movement boundary',8);await click('#pause');await page.keyboard.up('a');r=await read();assert(movementCleared(r));assert(combatPoint(r).x>=.599999);record('battle edge blocks held movement and pause clears input');
 stopped=await position();await sleep(400);assert.deepEqual(await position(),stopped);await pause(false);await sleep(400);await pause(true);assert.deepEqual(await position(),stopped);record('resume does not replay paused held input');
 }else{r=await checkpoint('resumed-battle');assert.equal(r.session.state.combat.status,'active');assert.equal(r.view.expedition.scene.presentation,'independent-arena');}
 if(!resumeAfterBlur){
 await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await pause(false);await page.keyboard.down('d');await sleep(300);const blurBefore=await checkpoint('native-focus-before');await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).blur(),gameWindowId);await sleep(300);r=await checkpoint('native-focus-after');const nativeFocused=await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).isFocused(),gameWindowId);assert.equal(nativeFocused,false);assert(movementCleared(r));assert.deepEqual(r.input.held,[]);assert(r.session.state.worldTick>blurBefore.session.state.worldTick,'native blur keeps background world advancing');stopped=combatPoint(r);await sleep(300);assert.deepEqual(await position(),stopped);await page.keyboard.up('d');await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await page.waitForFunction(()=>document.hasFocus());await pause(true);record('native blur clears held input',{gameWindowId,nativeFocused,rendererHasFocus:r.hasFocus,worldTicksWhileBlurred:r.session.state.worldTick-blurBefore.session.state.worldTick});
 await capture('direct-movement');
 // Separate actual bodies before an empty-direction cast so the projectile does
 // not begin inside an opponent's collision radius. This is ordinary held input.
 await held(['w'],500);}
 // Mouse aim is the released direction; empty space is a valid intentional cast.
 r=await read();assert(distanceBetween(combatPoint(r),firstEnemy(r))>.45);let p=combatPoint(r),e=firstEnemy(r);
 const empty=[{x:.8,y:.8},{x:.8,y:7.2},{x:11.2,y:.8},{x:11.2,y:7.2}].sort((a,b)=>((a.x-p.x)*(e.x-p.x)+(a.y-p.y)*(e.y-p.y))/Math.hypot(a.x-p.x,a.y-p.y)-((b.x-p.x)*(e.x-p.x)+(b.y-p.y)*(e.y-p.y))/Math.hypot(b.x-p.x,b.y-p.y))[0];await aim(empty);
 const beforeEmpty=await read(),spellArt=beforeEmpty.view.expedition.combat.manualActions.find(a=>a.id==='spell').art,practiceBefore=structuredClone(masterOf(beforeEmpty).artsById[spellArt]);await page.keyboard.press('2');r=await checkpoint('paused-empty-spell');assert.equal(r.session.state.srCombat.pending.action,'spell');assert.equal(r.session.state.combat.player.qi,beforeEmpty.session.state.combat.player.qi);await reopen('combat-pending');
 r=await runUntil(attackSettled,'empty directional spell');assert.equal(firstEnemy(r).hp,firstEnemy(beforeEmpty).hp);assert(r.session.state.combat.player.qi<beforeEmpty.session.state.combat.player.qi);assert.deepEqual(masterOf(r).artsById[spellArt],practiceBefore);record('mouse aimed empty spell misses and pays actual cost');await capture('empty-spell');
 await pause(false);await until(r=>manualActionReady(r,'spell'),'manual spell cooldown');await pause(true);
 r=await read();await aim(firstEnemy(r));const beforeHit=await read();
 await page.evaluate(()=>{window.__projectileWatch={hit:false,error:null};window.__projectileWatchTimer=setInterval(()=>{try{const raw=window.courtyardQA.snapshot();if(raw.state.combat?.projectiles?.length&&!window.__projectileWatch.hit){if(!window.courtyardQA.status().manualPause)document.getElementById('pause').click();window.__projectileWatch.hit=true;clearInterval(window.__projectileWatchTimer);}}catch(error){window.__projectileWatch.error=String(error);clearInterval(window.__projectileWatchTimer);}},15);});
 await page.keyboard.press('2');await pause(false);await until(r=>projectilePresent(r)&&r.status.manualPause,'actual released projectile checkpoint',12);r=await checkpoint('projectile-in-flight');assert.equal(firstEnemy(r).hp,firstEnemy(beforeHit).hp);assert.deepEqual(masterOf(r).artsById[spellArt],masterOf(beforeHit).artsById[spellArt]);await reopen('combat-projectile');record(combatOnly?'actual projectile holds before collision damage':'actual projectile saves before collision damage');
 r=await runUntil(r=>attackSettled(r)&&firstEnemy(r).hp<firstEnemy(beforeHit).hp,'mouse directed projectile hit');record('mouse enemy direction deals damage at projectile collision');await capture('direct-spell-hit');
 // Auto mode must never write a movement target or emit a manual spell.
 await click('#combat-auto');r=await read();assert.equal(r.view.expedition.combat.controls.autoAttack,true);const beforeAuto=structuredClone(r.session.state.combat),autoFoot=combatPoint(r),executionStart=r.session.state.srCombat.executions.length;
 r=await runUntil(r=>firstEnemy(r).hp<beforeAuto.enemies[0].hp,'automatic normal attack');assert.deepEqual(combatPoint(r),autoFoot);assert.equal(r.session.state.combat.player.target,null);assert(automaticAttackProven(r,executionStart),'observed damage must include a real automatic attack action');await click('#combat-auto');assert.equal((await read()).view.expedition.combat.controls.autoAttack,false);await pause(false);await until(pendingDone,'last automatic attack recovery');await pause(true);const afterOff=await read();await pause(false);await sleep(1600);await pause(true);r=await read();assert.equal(firstEnemy(r).hp,firstEnemy(afterOff).hp);record('auto attacks in range without walking or casting and switch off stops it');await capture('auto-off');
 await pause(false);await until(r=>manualActionReady(r,'guard'),'guard ready');await pause(true);await page.keyboard.press('3');r=await runUntil(guardActive,'keyboard guard effect');record('keyboard guard has real duration');await capture('guard-effect');await pause(false);await until(pendingDone,'guard recovery');await pause(true);
 await aim({x:combatPoint(await read()).x,y:7.2});const beforeDodge=await position();await page.keyboard.press('Space');r=await runUntil(pendingDone,'space dodge');assert.notDeepEqual(combatPoint(r),beforeDodge);record('space dodges toward mouse direction');await capture('dodge-effect');
 r=await runUntil(injuredReady,'actual injury');assert(r.session.state.combat.player.hp<r.session.state.combat.player.maxHp);record('actual enemy damage persists on master',{wound:masterOf(r).wound});await capture('injured-combat');
 phase='retreat';await click('[data-combat-action="retreat"]');r=await runUntil(retreatComplete,'physical retreat');assert.equal(masterOf(r).position.sceneId,'scene:valley');assert(masterOf(r).wound>0);assert(Math.hypot(masterOf(r).position.x-21.7,masterOf(r).position.y-36)<.4);record('retreat reaches real valley safety point',{location:masterOf(r).position,wound:masterOf(r).wound});await reopen('retreated-result');
 if(combatOnly){await click('#combat-acknowledge');r=await checkpoint('combat-returned-valley');assert.equal(masterOf(r).position.sceneId,'scene:valley');await capture('combat-returned-valley');}else{
 await click('#combat-acknowledge');await click('#expedition-exit');await runUntil(r=>atExit(r,'exit:valley-yunxiu'),'return exit approach');
 await click('#expedition-exit');r=await runUntil(r=>arrivedIn(r,'scene:yunxiu-courtyard'),'return home');assert.equal(masterOf(r).personId,'person:master');assert(masterOf(r).wound>0);record('injured same master returns home',{location:masterOf(r).position,wound:masterOf(r).wound});await reopen('injured-home');
 const homeBefore=(await read()).session.state;for(const selector of ['#affairs','#growth','#supply']){await click(selector);assert(await page.locator('#management').isVisible());await click('#close-management');assert.deepEqual((await read()).session.state,homeBefore);}record('home management growth and supply entries remain usable and read only');await capture('home-controls');}
 await checkpoint('complete-world');assert.deepEqual((await read()).errors,[]);assert.deepEqual(errors,[]);complete=true;phase='complete';
}catch(e){errors.push(e.stack||String(e));console.error(e.stack);process.exitCode=1;if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{
 if(page){try{await pause(true);await click('#save');await sleep(300);await checkpoint('final-world');}catch(e){finalizationErrors.push(String(e.stack||e));}}
 try{await close();}catch(e){finalizationErrors.push(String(e.stack||e));}
 const runtimeAfter=await hashes(),sourceUnchanged=hash(await fs.readFile(source))===hash(bytes),runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter);let nativeExact=false;
 try{nativeExact=JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(JSON.parse(await fs.readFile(path.join(output,'final-world.json'))).session.state);}catch(e){finalizationErrors.push(String(e));}
 const report={status:complete&&!errors.length&&!finalizationErrors.length&&sourceUnchanged&&runtimeUnchanged&&nativeExact?'passed':'failed',phase,source,sourceSha256:hash(bytes),sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,nativeExact,initialTick:initial.state.worldTick,finalTick:lastTick,wallSeconds:wall(),combatOnly,resumeCombat,resumeAfterBlur,scope:combatOnly?'visible macOS source Electron; direct battle keyboard/mouse; screenshots and final state evidence':'visible macOS source Electron; public controls; sampled state; actual wall time; source preparation recorded separately',checks,actions,errors,finalizationErrors};await fs.writeFile(path.join(output,'report.json'),json(report));console.log(json({status:report.status,report:path.join(output,'report.json')}));if(report.status!=='passed')process.exitCode=1;
}
