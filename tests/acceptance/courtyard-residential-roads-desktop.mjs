/** Same normal checkpoint, visible desktop commands and real elapsed walking. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {toArt,isArtWalkable} from '../../apps/courtyard/courtyard-space.mjs';
const arg=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const source=arg('source'),output=arg('output');assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep));
const bytes=await fs.readFile(source),initial=JSON.parse(bytes);assert.deepEqual(restoreSect(initial).state,initial.state);assert.equal(initial.state.speed,0);assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const target=desktopTarget(),directory=path.join(output,'world'),MASTER='person:master',hash=v=>createHash('sha256').update(v).digest('hex');
const sourceFiles=[...(await fs.readdir(path.join(repositoryRoot,'src/simulation'))).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...(await fs.readdir(path.join(repositoryRoot,'apps/courtyard'))).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...(await fs.readdir(path.join(repositoryRoot,'assets/courtyard'))).filter(x=>/^(east-residences|east-terrace|residence)/.test(x)).map(x=>'assets/courtyard/'+x)];
const codeHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash(await fs.readFile(path.join(repositoryRoot,file)))])));
const runtimeSha256=await codeHashes();let runtimeSha256After=null;
const checks=[],errors=[],journey=[],started=performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));let electron,page,complete=false,phase='load',reopens=0;
const read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view(),status:window.courtyardQA.status(),route:window.courtyardQA.route()}));
const key=name=>page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=(name,extra={})=>{checks.push({name,ok:true,...extra});console.log('PASS '+name);};
const siteId=n=>n===9?'site:domain:east-residence-1':`site:domain:gc-${n}`;
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});}
async function close(){const event=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await event;electron=null;}
async function pause(value){if((await read()).status.manualPause!==value)await page.locator('#pause').click();}
async function closePanel(){if(await page.locator('#management').isVisible())await page.locator('#close-management').click();}
async function manual(){await page.locator('#affairs').click();await key('affairs:policy').click();await key('policy:manual').click();await closePanel();}
async function site(n){await page.locator('#affairs').click();await key('domain:region').selectOption('Z-02');await key('domain:site:'+siteId(n)).click();}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function checkpoint(name){const session=(await read()).session;assert(validateSect(session));await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(session)+'\n');return session;}
async function reopen(name){await pause(true);const before=(await read());await checkpoint(name);await page.locator('#save').click();await close();await wait(1000);await launch();const after=await read();assert.deepEqual(after.session.state,before.session.state);assert.equal(after.route.remaining,before.route.remaining);assert.equal(after.route.failure,before.route.failure);for(const field of ['active','destination']){assert.equal(!!after.route[field],!!before.route[field]);if(before.route[field])assert(Math.hypot(after.route[field].x-before.route[field].x,after.route[field].y-before.route[field].y)<1e-6);}reopens++;record('道路行走途中精确关闭重开',{name,tick:before.view.tick});}
async function walk(n,{joinReopen=false}={}){
 phase='walk-'+n;await pause(true);await manual();await site(n);const dest=(await read()).view.domain.sites.find(s=>s.id===siteId(n)).entrance;assert(dest);assert(await key('domain:walk').isEnabled());const before=performance.now();await key('domain:walk').click();if(await key('confirm-action').count())await key('confirm-action').click();const commandMs=performance.now()-before;
 await closePanel();assert.equal((await read()).route.failure,null);assert((await read()).route.active);await page.locator('#follow').click();await pause(false);
 let finished=false,savedJoin=false,last=-1,announce=performance.now();
 for(let i=0;i<2400;i++){
  const current=await read(),p=current.view.people.find(p=>p.id===MASTER),art=toArt(p.x,p.y);assert.equal(current.route.failure,null);
  if(current.view.tick!==last){assert(isArtWalkable(art.x,art.y,{terrain:true,domain:true,west:current.view.domain.westEnabled,valley:current.view.domain.valleyEnabled,residences:true}),`Actual foot ${art.x},${art.y}`);journey.push({tick:current.view.tick,phase,world:{x:p.x,y:p.y},art,path:p.path?.length||0,indoor:p.indoor});last=current.view.tick;}
  if(joinReopen&&!savedJoin&&art.x>6430&&art.x<6780){await pause(true);await capture('02-join-feet');await reopen('02-join-reopen');await pause(false);savedJoin=true;}
  if(Math.hypot(p.x-dest.x,p.y-dest.y)<.08&&!current.route.active){finished=true;break;}
  if(performance.now()-announce>30000){console.log(`WAIT GC${n} tick=${current.view.tick} x=${p.x.toFixed(2)} y=${p.y.toFixed(2)}`);announce=performance.now();}
  await wait(150);
 }
 assert(finished,`Reach GC${n} entrance`);if(joinReopen)assert(savedJoin,'Observed shared joining road');await pause(true);await site(n);await key('domain:focus').click();await closePanel();await capture(`gc${n}-entrance`);await checkpoint(`gc${n}-entrance`);record('沿真实道路到达独立住宅入口',{site:siteId(n),destination:dest,commandMs});
}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(path.join(directory,'sect-save.json'),bytes,{flag:'wx'});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await read()).session.state,initial.state);record('原正常档精确恢复');await manual();await site(10);assert.equal((await read()).view.domain.residencesEnabled,false);await capture('00-locked');const old=(await read()).session.state;await key('domain:enable-residences').click();const opened=(await read());assert(opened.view.domain.residencesEnabled);for(const field of ['personsById','buildingsById','stockpilesById','worldTick','rngState','activitiesById','workOrdersById'])assert.deepEqual(opened.session.state[field],old[field]);record('住宅道路显式开通且保留既有事实');
 await key('domain:focus').click();await closePanel();await capture('01-empty-residences');await checkpoint('01-opened');await walk(12,{joinReopen:true});await walk(11);await walk(10);await walk(9);await reopen('06-final-reopen');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);assert.equal(hash(await fs.readFile(source)),hash(bytes));await checkpoint('07-complete');record('原来源保持且运行错误为零');complete=true;
}catch(e){checks.push({name:phase,ok:false,error:e.stack});console.error(e);process.exitCode=1;if(page){await capture('failure').catch(()=>{});await checkpoint('failure').catch(()=>{});}}
finally{if(electron)await close().catch(e=>errors.push(e.message));runtimeSha256After=await codeHashes();try{assert.deepEqual(runtimeSha256After,runtimeSha256);}catch(e){errors.push('Runtime changed during acceptance');process.exitCode=1;}await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':'failed',scope:'Local source macOS Electron; normal source, UI actions, real elapsed time; residential roads only',source,sourceSha256:hash(bytes),runtimeSha256,runtimeSha256After,wallSeconds:(performance.now()-started)/1000,reopens,checks,errors,journey},null,2)+'\n');}
