/** IDLE-02–06 / U-139–141: current courtyard, one recorded world, real elapsed time.
 * PLAYWRIGHT_MODULE=/absolute/playwright node qa/courtyard-autonomy-desktop.mjs
 * --app=/absolute/App.app --source=/absolute/finished-world.json --output=/absolute/fresh/evidence
 * --mode=food-recovery checks manual food collection and delivery from a recorded
 * shortage checkpoint, preserving the existing policy and final long-run evidence.
 * All gameplay changes use visible UI. The courtyard QA bridge is read-only here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url), option = key => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length+3);
const app = option('app'), source = option('source'), output = option('output'), mode = option('mode') || 'autonomy';
assert(['autonomy','food-recovery'].includes(mode));
assert(app && source && output && [app,source,output].every(path.isAbsolute));
assert(!output.startsWith('/Volumes/Media/immortal/'), 'evidence belongs outside the repository');
const root = path.join(app,'Contents/Resources/app'), sample = path.join(root,'prototypes/pixel_scene_validation');
const {validateSect} = await import(pathToFileURL(path.join(sample,'sect-sim.mjs')));
const {toArt,isArtWalkable} = await import(pathToFileURL(path.join(sample,'courtyard-space.mjs')));
const {_electron} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const saveDirectory = path.join(output,'world'), savePath = path.join(saveDirectory,'sect-save.json');
const started = performance.now(), startedAt = new Date().toISOString(), initial = JSON.parse(await fs.readFile(source,'utf8'));
assert.equal(validateSect(initial),true); assert.equal(initial.state.speed,0);
const initialTick = initial.state.worldTick, initialLedgerId = initial.nextLedgerId, initialTransportIds = new Set(Object.values(initial.state.workOrdersById).filter(w=>w.kind==='transport').map(w=>w.id));
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const harnessBytes = await fs.readFile(new URL(import.meta.url)), harnessSha256 = hash(harnessBytes);
const wall = () => Number(((performance.now()-started)/1000).toFixed(3));
const checks=[], errors=[], samples=[], interactions=[], background=[], sessions=[], snapshots=[], events=new Map(), transports=new Map(), hashes={};
let electron,page,sessionStart=null,previous=null,runningSeconds=0,autonomousSeconds=0,phase='prepare',finished=false,recoveryOutcome=null;
let manualDone=false,idleDone=false,restartDone=false,budgetStarted=false,budgetDone=false,lastReport=0,lastSnapshot=0;
let backgroundUntil=null,backgroundStart=null,backgroundBefore=null,backgroundDone=false;
const person = (v,id='person:master') => v.people.find(p=>p.id===id);
const read = () => page.evaluate(()=>window.courtyardQA.view());
const snap = () => page.evaluate(()=>window.courtyardQA.snapshot());
const status = () => page.evaluate(()=>window.courtyardQA.status());
const key = k => page.locator('#management-body').locator(`[data-ui-key=${JSON.stringify(k)}]`);
const record = (name,detail={}) => { checks.push({name,ok:true,wallSeconds:wall(),autonomousSeconds,...detail}); console.log(`PASS ${name}`); };
async function click(locator,label) { await locator.click(); interactions.push({label,wallSeconds:wall(),tick:(await read()).tick}); }
const clickKey = k => click(key(k),k);
const tab = id => click(page.locator(`#${id}`),id);
async function closePanel() { if(await page.locator('#management').isVisible()) await click(page.locator('#close-management'),'收起管理'); }
async function pause(wanted) { if((await status()).manualPause!==wanted) await click(page.locator('#pause'),wanted?'手动暂停':'手动继续'); previous=null; }
async function policy({herbTarget,spendingCap,risk},control=null) {
  await tab('affairs'); await clickKey('affairs:policy');
  await key('policy:herbTarget').fill(String(herbTarget)); await key('policy:spendingCap').fill(String(spendingCap));
  await key('policy:risk').selectOption(risk); await clickKey('policy:save');
  assert.deepEqual((await read()).policy,{herbTarget,spendingCap,risk});
  if(control) await clickKey(`policy:${control}`); await closePanel(); previous=null;
}
async function control(mode) { await tab('affairs');await clickKey('affairs:policy');await clickKey(`policy:${mode}`);await closePanel();previous=null; }
async function capture(name) { await page.screenshot({path:path.join(output,`${name}.png`)}); await fs.writeFile(path.join(output,`${name}.txt`),await page.locator('body').innerText()); }
async function checkpoint(name) {
  const s=await snap();assert.equal(validateSect(s),true);await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(s)+'\n');
  snapshots.push({name,path:path.join(output,`${name}.json`),tick:s.state.worldTick,wallSeconds:wall(),autonomousSeconds,sha256:hash(JSON.stringify(s))});return s;
}
async function report() {
  const body={startedAt,finishedAt:new Date().toISOString(),status:checks.some(x=>!x.ok)||errors.length?'failed':finished?(recoveryOutcome==='refused'?'completed_with_refusal':'passed'):'running',phase,
    wallSeconds:wall(),runningSeconds,autonomousSeconds,minimumAutonomousSeconds:mode==='autonomy'?1200:0,mode,recoveryOutcome,
    timeMethod:'Monotonic wall time between consecutive read-only samples, both unpaused with advancing ticks. Autonomous time also requires auto control at both samples. Gaps longer than three seconds, UI interventions, pauses and closed processes are excluded.',
    app,source,sourceSha256:hash(await fs.readFile(source)),harnessSha256,initialTick,sourceHashes:hashes,saveDirectory,checks,errors,background,sessions,snapshots,interactions,
    scope:'Visible macOS courtyard package, same public-command source world, normal UI strategy/actions and real time.'};
  await Promise.all([fs.writeFile(path.join(output,'report.json'),JSON.stringify(body,null,2)+'\n'),fs.writeFile(path.join(output,'samples.json'),JSON.stringify(samples,null,2)+'\n'),
    fs.writeFile(path.join(output,'events.json'),JSON.stringify([...events.values()],null,2)+'\n'),fs.writeFile(path.join(output,'transports.json'),JSON.stringify([...transports.values()],null,2)+'\n')]);
}
async function observe() {
  const v=await read(),now=performance.now();
  const runtime = await page.evaluate(()=>window.courtyardQA.metrics());
  assert.deepEqual(runtime.errors,[],'courtyard runtime reports no errors');
  if(previous){const dt=(now-previous.now)/1000;if(dt<=3&&!previous.paused&&!v.paused&&v.tick>previous.tick){runningSeconds+=dt;if(previous.mode==='auto'&&v.control.mode==='auto')autonomousSeconds+=dt;}}
  previous={now,paused:v.paused,tick:v.tick,mode:v.control.mode};
  for(const e of v.ledger)if(e.id>=initialLedgerId&&!events.has(e.id))events.set(e.id,{...e,firstObservedWallSeconds:wall(),observedPolicy:{...v.policy}});
  for(const t of v.transports)if(!initialTransportIds.has(t.id))transports.set(t.id,{...t,observedTick:v.tick});
  samples.push({wallSeconds:wall(),runningSeconds,autonomousSeconds,tick:v.tick,paused:v.paused,policy:v.policy,control:v.control,resources:v.resources,budget:v.budget,patches:v.patches,crop:v.crop,economy:v.economy,
    people:v.people.filter(p=>p.resident).map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,energy:p.energy,wound:p.wound,xp:p.xp,realm:p.realm,activity:p.activity,activityId:p.activityId,detail:p.activityDetail})),reason:v.reason});
  assert.equal(v.budget.spent,0,'zero autonomous preparation allowance prevents spending');
  assert.equal(v.people.filter(p=>p.resident).length,2);assert.equal(v.sceneId,'scene:yunxiu-courtyard');
  return v;
}
async function launch() {
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  electron=await _electron.launch({executablePath:path.join(app,'Contents/MacOS/Electron'),args:[`--qa-dir=${saveDirectory}`,'--qa-scenario=native','--show'],env,timeout:30000});
  page=await electron.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden);
  assert(await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()));sessionStart=performance.now();previous=null;
}
async function closeNormally() {
  const done=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await done;
  sessions.push({seconds:(performance.now()-sessionStart)/1000,endWallSeconds:wall()});electron=null;page=null;sessionStart=null;previous=null;
}
async function lifecycle() {
  phase='pause-and-restart';await pause(true);await closePanel();
  const before=await checkpoint('05-pause-before'),beforeControl=before.control;await wait(2500);
  assert.deepEqual(await snap(),before,'manual pause preserves the entire session');record('手动暂停保持完整会话不推进',{tick:before.state.worldTick});
  const farmId=String(Object.values(before.state.buildingsById).find(b=>b.type==='farm').id);
  await tab('affairs');await clickKey(`building:${farmId}`);await pause(false);
  const reading=await snap();await wait(2200);assert.deepEqual(await snap(),reading,'building reading freezes the world');
  assert((await status()).pauseReasons.includes('建筑详情'));record('建筑详情阅读暂停世界',{tick:reading.state.worldTick});
  await pause(true);await closePanel();assert.equal((await status()).manualPause,true);
  const saved=await checkpoint('06-restart-before');await capture('06-restart-before');await click(page.locator('#save'),'手动保存');
  for(let i=0;i<100;i++){const disk=JSON.parse(await fs.readFile(savePath,'utf8'));if(disk.state.worldTick===saved.state.worldTick&&disk.state.speed===0)break;await wait(50);}
  assert.deepEqual(JSON.parse(await fs.readFile(savePath,'utf8')).state,saved.state);
  await closeNormally();const disk=JSON.parse(await fs.readFile(savePath,'utf8'));assert.deepEqual(disk.state,saved.state);
  const closedStart=performance.now();await wait(5000);await launch();const reopened=await checkpoint('06-restart-reopened');
  for(const field of ['state','policy','control','budget','automation','ledger','totals','carrySeconds'])assert.deepEqual(reopened[field],disk[field],`${field} survives the closed interval exactly`);
  assert.equal((await status()).manualPause,true);await capture('06-restart-reopened');
  record('正常关闭五秒重开保留完整世界与策略且无离线进度',{tick:saved.state.worldTick,closedWallSeconds:(performance.now()-closedStart)/1000,beforeControl});
  await pause(false);phase='autonomy';restartDone=true;
}
async function handover() {
  phase='manual-handover';await pause(true);const before=await snap();await control('manual');const taken=await snap();
  assert.equal((await read()).control.mode,'manual');assert.deepEqual(taken.state.activitiesById,before.state.activitiesById);record('接管保留两人已有活动');
  await click(page.locator('#home'),'回小院');
  const candidates=[[20,30],[24,30],[28,32],[16,40]].map(([x,y])=>({world:{x,y},art:toArt(x,y)})).filter(p=>isArtWalkable(p.art.x,p.art.y));
  const target=await page.evaluate(candidates=>{const r=window.courtyardQA.renderer,rect=document.getElementById('scene').getBoundingClientRect();for(const p of candidates){const s=r.artToScreen(p.art);if(s.x>30&&s.x<rect.width-30&&s.y>110&&s.y<rect.height-65&&!r.pickPeople(s.x,s.y).length&&!r.pickBuilding(s.x,s.y)&&!r.pickDomainSite(s.x,s.y))return{...p,screen:{x:s.x+rect.left,y:s.y+rect.top}};}return null;},candidates);
  assert(target);await page.mouse.click(target.screen.x,target.screen.y);interactions.push({label:'亲控点地行走',target,wallSeconds:wall()});
  assert((await page.evaluate(()=>window.courtyardQA.route())).destination,'ground click starts an actual route');
  const p0=person(await read());await pause(false);for(let i=0;i<4;i++){await wait(700);await observe();}const p1=person(await read());
  assert(Math.hypot(p1.x-p0.x,p1.y-p0.y)>.1);assert.equal((await read()).control.mode,'manual');
  await capture('03-manual-walk');record('亲控点击地面后人物实际移动',{before:{x:p0.x,y:p0.y},after:{x:p1.x,y:p1.y}});
  await control('auto');assert.equal((await read()).control.mode,'auto');record('玩家主动交回自主');manualDone=true;phase='autonomy';
}
async function recoverFood() {
  phase='manual-food-recovery';await control('manual');
  const before=await read(),originalPolicy={...before.policy},patch=before.operations.harvest.find(p=>p.id==='food');
  assert(before.economy.starvation>0,'recovery starts from the observed supply shortage');
  await tab('supply');await clickKey('subtab:sources');await clickKey('source:food');await capture('01-food-source');
  if(await key('source:harvest:food').isDisabled()){
    recoveryOutcome='refused';record('当前身体或来源条件拒绝亲采口粮',{patch,person:person(before)});await checkpoint('final-world');finished=true;return;
  }
  await clickKey('source:harvest:food');assert.equal(person(await read()).activityDetail?.kind,'sr-harvest');await closePanel();await pause(false);
  const until=async(predicate,label,limit=120)=>{
    const began=performance.now();
    while(true){
      await wait(700);const v=await observe();if(predicate(v))return v;
      if(performance.now()-began>limit*1000)throw Error(`Timed out: ${label}`);
      if(wall()-lastReport>30){console.log(`RECOVERY ${label}: ${Math.round((performance.now()-began)/1000)}s tick=${v.tick}`);await report();lastReport=wall();}
    }
  };
  const carried=v=>v.stockpiles.find(s=>s.id==='stockpile:carried:master')?.resources.food||0;
  await until(v=>carried(v)>=patch.batchSize&&person(v).activityDetail?.kind!=='sr-harvest','亲采口粮到随身货位');await pause(true);
  const gathered=await read();assert.equal(gathered.patches.food.remaining,before.patches.food.remaining-patch.batchSize);
  await checkpoint('02-food-carried');await capture('02-food-carried');record('正常亲采口粮进入随身货位',{quantity:carried(gathered),patchBefore:before.patches.food.remaining,patchAfter:gathered.patches.food.remaining,publicFoodBefore:before.resources.food,publicFoodAfter:gathered.resources.food});
  await tab('supply');await clickKey('subtab:stocks');await key('stocks:owner').selectOption('all');await clickKey('stock:stockpile:carried:master');await clickKey('stock:transfer:food');await clickKey('transfer:submit');
  const order=(await read()).transports.at(-1);await closePanel();await pause(false);
  await until(v=>v.transports.some(t=>t.id===order.id&&t.phase==='delivered'),'口粮实际搬回公库');await pause(true);
  const delivered=await read();assert(delivered.resources.food>0);assert.equal(carried(delivered),0);assert.deepEqual(delivered.policy,originalPolicy);
  await checkpoint('03-food-delivered');await capture('03-food-delivered');record('亲采口粮实际搬回公库且原自主策略保留',{order:delivered.transports.find(t=>t.id===order.id),publicFood:delivered.resources.food,starvation:delivered.economy.starvation});
  await control('auto');assert.equal((await read()).control.mode,'auto');await pause(false);
  const recovered=await until(v=>v.economy.starvation===0,'口粮补入后正式供给结算恢复',160);await pause(true);
  assert.deepEqual(recovered.policy,originalPolicy);await checkpoint('final-world');await capture('04-food-recovered');
  recoveryOutcome='manual_food_delivery_restored_supply';record('交回自主后由正式供给结算解除饥饿',{resources:recovered.resources,economy:recovered.economy,people:recovered.people.filter(p=>p.resident),policy:recovered.policy});
  const metrics=await page.evaluate(()=>window.courtyardQA.metrics());assert.deepEqual(metrics.errors,[]);await fs.writeFile(path.join(output,'runtime-metrics.json'),JSON.stringify(metrics,null,2)+'\n');record('恢复检查运行无未捕获错误',{renderedFrames:metrics.renderedFrames});finished=true;
}

try {
  await fs.mkdir(saveDirectory,{recursive:true});await fs.writeFile(savePath,JSON.stringify(initial)+'\n',{flag:'wx'});
  await fs.writeFile(path.join(output,'executed-harness.mjs'),harnessBytes);
  await fs.writeFile(path.join(output,'initial-world.json'),JSON.stringify(initial)+'\n');
  for(const n of ['courtyard-host.cjs','courtyard-main.mjs','courtyard-panels.mjs','sect-sim.mjs'])hashes[n]=hash(await fs.readFile(path.join(sample,n)));
  await launch();assert.deepEqual((await snap()).state,initial.state);const first=await read();
  assert.equal(first.provenance.kind,'normal-public-command-checkpoint');assert.equal(first.people.filter(p=>p.resident).length,2);
  assert.equal(first.domain.sites[0].status,'complete');await capture('00-same-world');record('同一东台完成档与两名正式住民进入候选包',{initialResources:first.resources});
  if(mode==='food-recovery')await recoverFood();
  else {
  await policy({herbTarget:30,spendingCap:0,risk:'cautious'},'auto');await pause(false);phase='autonomy';await observe();
  console.log('AUTONOMY CLOCK STARTED');
  while(autonomousSeconds<1200 || !backgroundDone || !restartDone || !manualDone || !idleDone){
    await wait(1000);let v=await observe();
    if(backgroundUntil!==null){
      if(performance.now()>=backgroundUntil){
        const elapsed=(performance.now()-backgroundStart)/1000;
        await electron.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();});
        assert(v.tick-backgroundBefore.tick>=elapsed*8.5);assert(v.tick-backgroundBefore.tick<=elapsed*11.5);
        background.push({startTick:backgroundBefore.tick,endTick:v.tick,wallSeconds:elapsed,startResources:backgroundBefore.resources,endResources:v.resources});
        await capture('02-background-return');record('原生最小化期间同一时钟与自主经营继续',background.at(-1));backgroundUntil=null;backgroundDone=true;
      }
    }else if(!backgroundDone&&autonomousSeconds>=60){
      await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());
      let minimized=false;for(let i=0;i<50&&!minimized;i++){minimized=await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());if(!minimized)await wait(100);}
      assert(minimized);backgroundBefore=await read();backgroundStart=performance.now();backgroundUntil=backgroundStart+180000;console.log('NATIVE BACKGROUND STARTED');
    }else if(!manualDone&&autonomousSeconds>=250&&(!person(v).activityDetail||person(v).activityDetail.kind==='facility'))await handover();
    else if(manualDone&&!idleDone&&autonomousSeconds>=280){
      await control('manual');const origin=(await read()).tick;const begin=performance.now();
      while((await read()).control.mode!=='auto'){await wait(1000);await observe();assert(performance.now()-begin<40000,'manual grace ends within normal wall time');}
      record('亲控三十秒未下行动后按目标恢复自主',{realWallSeconds:(performance.now()-begin)/1000,tickDifference:(await read()).tick-origin});idleDone=true;
    }else if(!restartDone&&autonomousSeconds>=340)await lifecycle();
    else if(!budgetStarted&&autonomousSeconds>=400&&v.targetMet){
      await checkpoint('07-goal-reached');await capture('07-goal-reached');record('自主公库灵草目标达到',{resources:v.resources,people:v.people.filter(p=>p.resident)});
      await policy({herbTarget:500,spendingCap:0,risk:'balanced'},'auto');budgetStarted=true;phase='budget-boundary';
    }else if(budgetStarted&&!budgetDone&&[...events.values()].some(e=>e.kind==='budget-blocked')){
      await checkpoint('08-budget-boundary');await capture('08-budget-boundary');record('来源不足且零自主整备额度时保留资源并暂缓支出',{patch:v.patches.herb,budget:v.budget,events:[...events.values()].filter(e=>e.kind==='budget-blocked')});
      budgetDone=true;await policy({herbTarget:30,spendingCap:0,risk:'cautious'},'auto');phase='autonomy';
    }
    if(wall()-lastSnapshot>=60&&backgroundUntil===null){await checkpoint(`minute-${Math.floor(autonomousSeconds/60)}`);lastSnapshot=wall();}
    if(wall()-lastReport>=30){console.log(`RUN auto=${autonomousSeconds.toFixed(1)}s live=${runningSeconds.toFixed(1)}s tick=${v.tick} herb=${v.resources.herb.toFixed(3)} source=${v.patches.herb.remaining} master=${person(v).activity} lu=${person(v,'person:lu-zhiwei').activity}`);await report();lastReport=wall();}
    assert(wall()<2100,'bounded 35-minute acceptance window');
  }
  await pause(true);const finalView=await read(),final=await checkpoint('final-world');await capture('09-twenty-minutes');
  const metrics=await page.evaluate(()=>window.courtyardQA.metrics());await fs.writeFile(path.join(output,'runtime-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  record('同一世界累计至少二十分钟真实自主运行',{autonomousSeconds,runningSeconds,wallSeconds:wall(),tickStart:initialTick,tickEnd:finalView.tick});
  const delivered=[...transports.values()].filter(t=>t.phase==='delivered'),farmStock=finalView.crop.stockpileId;
  assert(delivered.some(t=>t.sourceStockpileId==='stockpile:yunxiu'&&t.targetStockpileId===farmStock));
  assert(delivered.some(t=>t.sourceStockpileId===farmStock&&t.targetStockpileId==='stockpile:yunxiu'));
  record('种苗实际到田并将新收成实际搬回公库',{deliveries:delivered});
  const observedResidents=samples.flatMap(s=>s.people);assert(observedResidents.some(p=>p.id==='person:lu-zhiwei'&&p.activity==='plant'&&p.detail?.kind==='facility'&&p.detail?.phase==='executing'));
  record('两名正式住民持续参与劳动与生活',{people:finalView.people.filter(p=>p.resident),initialResources:first.resources,finalResources:finalView.resources});
  assert([...events.values()].some(e=>e.kind==='risk-blocked'));
  assert(![...events.values()].some(e=>e.autonomous&&e.action==='startMasterHarvest'&&e.observedPolicy.risk==='cautious'));
  record('守院偏好实际阻止自主采集',{riskEvents:[...events.values()].filter(e=>e.kind==='risk-blocked')});
  assert(budgetDone,'normal source exhaustion reached the zero-budget decision');assert.equal(final.budget.spent,0);record('累计自主整备支出保持零额度',{budget:finalView.budget,economy:finalView.economy});
  assert.deepEqual(metrics.errors,[]);assert.deepEqual(errors,[]);
  record('运行无未捕获错误',{renderedFrames:metrics.renderedFrames});finished=true;
  }
}catch(error){checks.push({name:phase,ok:false,error:error.stack,wallSeconds:wall(),autonomousSeconds});console.error(error.stack);process.exitCode=1;if(page){await capture('failure').catch(()=>{});await checkpoint('failure-world').catch(()=>{});}}
finally{if(electron)await closeNormally().catch(async e=>{errors.push(e.message);process.exitCode=1;await electron?.close().catch(()=>{});});await report();console.log(`Evidence: ${output}`);}
