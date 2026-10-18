/** One normal checkpoint, explicit master bed selection, real travel and save/reopen. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
const arg=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const source=arg('source'),output=arg('output');assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep));
const bytes=await fs.readFile(source),initial=JSON.parse(bytes);assert.deepEqual(restoreSect(initial).state,initial.state);
assert.equal(initial.state.speed,0);assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const target=desktopTarget(),directory=path.join(output,'world'),MASTER='person:master';
const checks=[],errors=[],started=performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
const hash=v=>createHash('sha256').update(v).digest('hex');let electron,page,complete=false;
const read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view(),status:window.courtyardQA.status()}));
const key=name=>page.locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=name=>{checks.push({name,ok:true});console.log('PASS '+name);};
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});}
async function close(){const event=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await event;electron=null;}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function pause(value){if((await read()).status.manualPause!==value)await page.locator('#pause').click();}
async function hall(){await page.locator('#affairs').click();await key('building:1').click();}
await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(path.join(directory,'sect-save.json'),bytes,{flag:'wx'});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual((await read()).session.state,initial.state);const before=JSON.stringify((await read()).session.state);
 await hall();const view=(await read()).view,bed=view.housing.beds.find(b=>b.masterRest.available&&!b.homePersonId&&!b.pendingPersonId);
 assert(bed);assert(await key('housing:rest:'+bed.slotId).isEnabled());await capture('01-select-bed');assert.equal(JSON.stringify((await read()).session.state),before);record('真实床位与可选休息入口只读显示');
 await key('housing:rest:'+bed.slotId).click();if(await key('confirm-action').count())await key('confirm-action').click();
 const commanded=(await read()).session.state,recorded=commanded.residentialHousing.recordsByPersonId[MASTER];
 assert.equal(recorded.pending.slotId,bed.slotId);assert.equal(recorded.home,null);assert.equal(commanded.worldTick,initial.state.worldTick);record('点击仅预约所选床，尚未记为入住');
 await page.locator('#close-management').click();await page.locator('#follow').click();await pause(false);
 let result;
 for(let n=0;n<900;n++){const current=await read();if(current.session.state.residentialHousing?.recordsByPersonId[MASTER]?.home?.slotId===bed.slotId){result=current;break;}await wait(100);}
 assert(result,'Master must reach the selected bed in real elapsed time');await pause(true);
 const at=(await read()).session.state,body=at.activitiesById[at.personsById[MASTER].activityId];
 assert.equal(body.slotId,bed.slotId);assert.equal(body.phase,'executing');assert.equal(at.residentialHousing.recordsByPersonId[MASTER].pending,null);
 assert(Math.hypot(at.personsById[MASTER].position.x-bed.position.x,at.personsById[MASTER].position.y-bed.position.y)<.04);record('掌门实际行走到指定床后登记入住');
 await hall();await capture('02-occupied-bed');assert.match(await page.locator('#management-body').innerText(),/正在使用/);
 await page.locator('#close-management').click();await page.locator('#people').click();await key('person:'+MASTER).click();await key('person:inspect:'+MASTER).click();
 assert.match(await page.locator('#person-content').innerText(),/已入住/);assert.match(await page.locator('#person-content').innerText(),/主殿/);await capture('03-person-home');record('人物交谈窗与建筑详情显示同一入住和身体占床');
 await page.locator('#close-person').click();await page.locator('#close-management').click();const saved=(await read()).session;assert(validateSect(saved));await page.locator('#save').click();await close();await wait(1000);await launch();
 assert.deepEqual((await read()).session.state,saved.state);record('关闭重开保持床位身份与身体活动');
 assert.equal(hash(await fs.readFile(source)),hash(bytes));assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.courtyardQA.metrics().errors),[]);record('原来源保留且页面无报错');complete=true;
}catch(e){checks.push({name:'desktop rest',ok:false,error:e.stack});console.error(e);if(page)await capture('failure').catch(()=>{});process.exitCode=1;}
finally{if(page)await fs.writeFile(path.join(output,'final.json'),JSON.stringify((await read()).session)+'\n').catch(()=>{});if(electron)await close().catch(e=>errors.push(e.message));await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':'failed',source,sourceSha256:hash(bytes),scope:'Local source macOS Electron; actual master rest in existing hall, not new house construction',checks,errors,wallSeconds:(performance.now()-started)/1000},null,2)+'\n');}
