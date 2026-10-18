/** One paused normal-command source: preset plan, west construction, production,
 * physical delivery and exact close/reopen through the visible desktop UI.
 * node tests/acceptance/courtyard-west-desktop.mjs --source=/absolute/source.json --output=/absolute/fresh/directory
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {toArt,isArtWalkable} from '../../apps/courtyard/courtyard-space.mjs';

const option=key=>process.argv.find(v=>v.startsWith(`--${key}=`))?.slice(key.length+3);
const source=option('source'),output=option('output');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!output.startsWith(repositoryRoot+path.sep));
const target=desktopTarget(),bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original);
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);
assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const hash=v=>createHash('sha256').update(v).digest('hex');
const directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const SITE='site:domain:west-lumber-1',MASTER='person:master',LU='person:lu-zhiwei';
const started=performance.now(),checks=[],errors=[],journey=[],interactions=[];
let electron,page,phase='prepare',complete=false;
const wall=()=>Number(((performance.now()-started)/1000).toFixed(3));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const view=()=>page.evaluate(()=>window.courtyardQA.view());
const snapshot=()=>page.evaluate(()=>window.courtyardQA.snapshot());
const status=()=>page.evaluate(()=>window.courtyardQA.status());
const key=name=>page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=(name,data={})=>{checks.push({name,ok:true,wallSeconds:wall(),...data});console.log(`PASS ${name}`);};
async function click(locator,label){await locator.click();interactions.push({label,wallSeconds:wall(),tick:(await view()).tick});}
const tab=name=>click(page.locator(`#${name}`),name);
const clickKey=name=>click(key(name),name);
async function pause(wanted){if((await status()).manualPause!==wanted)await tab('pause');}
async function closePanel(){if(await page.locator('#management').isVisible())await tab('close-management');}
async function capture(name){await page.screenshot({path:path.join(output,`${name}.png`)});await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText());}
async function checkpoint(name){const data=await snapshot();assert.equal(validateSect(data),true);await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(data)+'\n');return data;}
async function report(){await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':checks.some(c=>!c.ok)||errors.length?'failed':'running',phase,wallSeconds:wall(),source,sourceSha256:hash(bytes),platform:process.platform,scope:'Local source Electron, one normal-command source, UI mutations and real elapsed time; screenshots only.',checks,errors,interactions,journey},null,2)+'\n');}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});}
async function close(){const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;page=null;}
async function manual(){await tab('affairs');await clickKey('affairs:policy');await clickKey('policy:manual');await closePanel();}
async function until(predicate,label,seconds=150){const begin=performance.now();let renew=begin,announce=begin,last=-1;while(performance.now()-begin<seconds*1000){const v=await view(),s=await snapshot(),p=v.people.find(p=>p.id===MASTER);if(v.tick!==last){const art=toArt(p.x,p.y);journey.push({tick:v.tick,wallSeconds:wall(),master:{x:p.x,y:p.y,art},construction:v.construction&&{progressTicks:v.construction.progressTicks,phase:v.construction.phase,flow:v.construction.materialFlow?.phase,cargo:v.construction.materialFlow?.cargo}});if(p.x<0)assert(isArtWalkable(art.x,art.y),'negative-world foot remains on the visible west surface');last=v.tick;}if(predicate(v,s))return{v,s};if(performance.now()-renew>18000){await manual();renew=performance.now();}if(performance.now()-announce>30000){console.log(`WAIT ${label} tick=${v.tick} x=${p.x.toFixed(2)} ${v.construction?.reason||''}`);await report();announce=performance.now();}await wait(120);}throw Error(`Timed out: ${label}`);}
async function saveReopen(name){await pause(true);await closePanel();const before=await checkpoint(`${name}-before`),camera=await page.evaluate(()=>({...window.courtyardQA.renderer.camera}));await capture(name);await tab('save');for(let i=0;i<100;i++){const disk=JSON.parse(await fs.readFile(savePath,'utf8'));if(disk.state.worldTick===before.state.worldTick&&disk.state.speed===0)break;await wait(50);}assert.deepEqual(JSON.parse(await fs.readFile(savePath,'utf8')).state,before.state);await close();await wait(1200);await launch();const after=await checkpoint(`${name}-reopened`);assert.deepEqual(after.state,before.state);assert.equal((await status()).manualPause,true);const restoredCamera=await page.evaluate(()=>({...window.courtyardQA.renderer.camera}));assert(Math.hypot(restoredCamera.x-camera.x,restoredCamera.y-camera.y)<1e-6);assert.equal(restoredCamera.zoom,camera.zoom);record(name,{tick:before.state.worldTick,camera});}
async function openSite(){await tab('affairs');await clickKey(`domain:site:${SITE}`);}

try{
 await fs.mkdir(directory,{recursive:true});await fs.writeFile(savePath,JSON.stringify(initial)+'\n',{flag:'wx'});
 await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
 await launch();assert.deepEqual((await snapshot()).state,original.state);record('同源暂停世界原样载入');
 phase='plan';await tab('domain');const plans=(await view()).domain.plannedSites;assert.equal(plans.length,31);
 const targetPlan=plans.find(s=>s.planId==='GC-31');
 const pos=await page.evaluate(site=>{const r=window.courtyardQA.renderer,t=r.planningTransform(),b=document.getElementById('scene').getBoundingClientRect();return{x:b.left+t.x+site.diagramPosition[0]*t.scale,y:b.top+t.y+(site.diagramPosition[1]+site.diagramOffsetY)*t.scale};},targetPlan);
 await page.mouse.click(pos.x,pos.y);assert(await key(`domain:build:${targetPlan.id}`).isDisabled());assert.equal(await key('domain:walk').count(),0);await capture('01-plan-detail');record('31号规划可点选且筹备状态正确');
 await closePanel();await tab('home');await tab('affairs');await clickKey('domain:enable');const opened=await view();assert.equal(opened.domain.westEnabled,true);assert.equal(opened.bounds.x,-34);
 await openSite();await clickKey('domain:focus');await closePanel();await capture('02-west-ground');record('西林通路显式启用与实景定位');
 phase='construction';await manual();await openSite();const before=await snapshot();assert(await key(`domain:build:${SITE}`).isEnabled());await clickKey(`domain:build:${SITE}`);await closePanel();await tab('follow');await pause(false);
 await until(v=>v.people.find(p=>p.id===MASTER).x<0&&v.construction?.materialFlow?.phase==='carrying','carry across west bridge');
 await saveReopen('03-west-carrying');assert(journey.some(j=>j.master.x<0&&j.construction?.flow==='carrying'));
 await tab('follow');await pause(false);await until(v=>v.construction?.progressTicks>=30,'build on site');await saveReopen('04-west-building');
 await pause(false);await until(v=>v.domain.sites.find(s=>s.id===SITE)?.status==='complete','finish west lumber');await pause(true);const built=await checkpoint('05-west-complete');
 const lumber=Object.values(built.state.buildingsById).find(b=>b.type==='lumber');assert(lumber);assert.equal(lumber.transform.x,-18);assert.equal(lumber.transform.y,28);
 const publicBefore=before.state.stockpilesById['stockpile:yunxiu'].resources,publicBuilt=built.state.stockpilesById['stockpile:yunxiu'].resources;
 assert.equal(publicBefore.wood-publicBuilt.wood,20);assert.equal(publicBefore.stone-publicBuilt.stone,8);
 await openSite();await clickKey('domain:focus');await closePanel();await capture('05-west-scene');await openSite();await capture('05-west-complete');assert.match(await page.locator('#management-body').innerText(),/2处作业工位/);record('西桥实际运料与到场施工完成，20木8石投入，2个真实工位');
 phase='production';await clickKey('domain:building');assert(await key(`workplace:invite:${LU}`).isEnabled());await clickKey(`workplace:invite:${LU}`);const answer=(await snapshot()).state.personsById[LU].schedule.invitations[`work:${lumber.instanceId}`];assert.equal(answer?.accepted,true,answer?.reason||'work invitation has no accepted answer');await closePanel();await pause(false);
 const stockId=`stockpile:${lumber.instanceId}`;
 await until((v,s)=>(s.state.stockpilesById[stockId]?.resources.wood||0)>=6,'Lu walks to work and produces lumber');await pause(true);const produced=await checkpoint('06-site-production');await capture('06-site-production');
 assert.equal(produced.state.stockpilesById['stockpile:yunxiu'].resources.wood,publicBuilt.wood);
 const lu=produced.state.personsById[LU];assert(lu.mind.scenic.x<0);record('陆知微到真实工位产木，木材留在场边货位',{siteWood:produced.state.stockpilesById[stockId].resources.wood});
 phase='delivery';await tab('supply');await clickKey('subtab:stocks');await clickKey(`stock:${stockId}`);await clickKey('stock:transfer:wood');await key('transfer:quantity').fill('6');await clickKey('transfer:submit');
 const transport=Object.values((await snapshot()).state.workOrdersById).find(o=>o.kind==='transport'&&o.sourceStockpileId===stockId&&!['delivered','cancelled'].includes(o.phase));assert(transport);await closePanel();await tab('follow');await pause(false);
 await until((v,s)=>s.state.workOrdersById[transport.id]?.phase==='carrying','collect site wood');await pause(true);await capture('07-wood-carried');await pause(false);
 await until((v,s)=>s.state.workOrdersById[transport.id]?.phase==='delivered','deliver to public storage');await pause(true);const delivered=await checkpoint('08-wood-delivered');
 assert.equal(delivered.state.stockpilesById['stockpile:yunxiu'].resources.wood,publicBuilt.wood+6);record('掌门把场边6份实产木材搬回公库',{orderId:transport.id});
 await saveReopen('09-complete-recovery');const metrics=await page.evaluate(()=>window.courtyardQA.metrics());assert.deepEqual(metrics.errors,[]);assert.deepEqual(errors,[]);record('页面与运行错误为零');
 assert.equal(hash(await fs.readFile(source)),hash(bytes));complete=true;phase='complete';
}catch(error){checks.push({name:phase,ok:false,error:error.stack});console.error(error.stack);process.exitCode=1;if(page){await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await close().catch(async e=>{errors.push(e.message);await electron?.close().catch(()=>{});});await report();console.log(`Evidence: ${output}`);}
