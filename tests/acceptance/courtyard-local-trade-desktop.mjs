/** Local Electron UI acceptance from one unchanged public-command checkpoint. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=option('source'),output=option('output');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep));
const bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=restoreSect(original);
assert.deepEqual(initial.state,original.state);assert.equal(initial.state.speed,0);
assert.equal(initial.provenance.kind,'normal-public-command-checkpoint');
const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MERCHANT='person:merchant-qingxi',MARKET='stockpile:qingxi';
const target=desktopTarget(),directory=path.join(output,'world'),savePath=path.join(directory,'sect-save.json');
const start=performance.now(),checks=[],errors=[],actions=[];
let electron,page,complete=false,phase='prepare';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),hash=v=>createHash('sha256').update(v).digest('hex');
const read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view(),status:window.courtyardQA.status()}));
const state=async()=>(await read()).session.state,key=name=>page.locator(`[data-ui-key=${JSON.stringify(name)}]`);
const record=(name,data={})=>{checks.push({name,ok:true,...data});console.log('PASS '+name);};
async function click(locator,label){await locator.click();actions.push({label,tick:(await state()).worldTick});}
const id=name=>click(page.locator('#'+name),name),act=name=>click(key(name),name);
async function pause(value){if((await read()).status.manualPause!==value)await id('pause');}
async function closePanel(){if(await page.locator('#management').isVisible())await id('close-management');}
async function closePerson(){if(await page.locator('#dialog').isVisible())await id('close-person');}
async function manual(){await id('affairs');await act('affairs:policy');await act('policy:manual');await closePanel();}
async function resume(){await pause(true);await manual();await pause(false);}
async function until(predicate,label,seconds=180){
 const began=performance.now();let renewed=began;
 while(performance.now()-began<seconds*1000){
  const current=await read();if(predicate(current))return current;
  if(performance.now()-renewed>18000){await pause(true);await manual();await pause(false);renewed=performance.now();console.log(`WAIT ${label} tick=${current.view.tick}`);}
  await wait(100);
 }
 throw Error('Timed out: '+label);
}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${directory}`,'--qa-scenario=native','--show'],timeout:30000});
 page=await electron.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>!!window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});
}
async function close(){const closed=electron.waitForEvent('close',{timeout:20000});await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;electron=null;}
async function capture(name){await page.screenshot({path:path.join(output,name+'.png')});await fs.writeFile(path.join(output,name+'.txt'),await page.locator('body').innerText());}
async function reopen(name){
 await pause(true);await closePerson();await closePanel();const before=(await read()).session;assert(validateSect(before));
 await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(before)+'\n');await id('save');await close();await wait(1000);await launch();
 assert.deepEqual(await state(),before.state);record(name,{tick:before.state.worldTick});
}
async function stock(sid){await id('supply');await act('subtab:stocks');await key('stocks:owner').selectOption('all');await act('stock:'+sid);}
async function transfer(from,to,resource,quantity){
 await pause(true);await manual();await stock(from);await key('stock:destination').selectOption(to);
 const before=await state();await act('stock:transfer:'+resource);await key('transfer:quantity').fill(String(quantity));await act('transfer:submit');
 const queued=await state(),order=Object.values(queued.workOrdersById).find(o=>o.kind==='transport'&&!before.workOrdersById[o.id]);assert(order);
 assert.equal(queued.stockpilesById[to].resources[resource],before.stockpilesById[to]?.resources[resource]||0);
 await closePanel();await resume();await until(({session})=>session.state.workOrdersById[order.id]?.phase==='delivered',resource+' delivery');await pause(true);
 const after=await state();assert.equal(after.stockpilesById[to].resources[resource],(before.stockpilesById[to]?.resources[resource]||0)+quantity);
 record('现场搬运到指定货位',{from,to,resource,quantity,orderId:order.id});
}
async function merchant(){await id('people');await act('person:'+MERCHANT);await act('person:inspect:'+MERCHANT);}

await fs.mkdir(output);await fs.mkdir(directory);await fs.writeFile(savePath,bytes,{flag:'wx'});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
try{
 await launch();assert.deepEqual(await state(),original.state);record('来源档原样加载');
 phase='pickup';await transfer(HOME,CARRIED,'stone',20);
 phase='approach';await merchant();if(await page.locator('#approach-person').isVisible()){
  await id('approach-person');await resume();await until(asyncRead=>asyncRead.status.pauseReasons.includes('详情阅读'),'actual merchant approach');
 }
 assert(await key('person:trade').isVisible());const arrived=await state();
 assert(arrived.personsById[MERCHANT].position.kind==='scene');record('实际走近商人后进入同一交谈窗',{tick:arrived.worldTick});
 phase='quote';await act('person:trade');await key('person:trade-batches').selectOption('2');const before=await state();
 assert(await key('person:trade-confirm').isEnabled());await wait(1200);assert.deepEqual(await state(),before);
 await capture('01-quote');await act('person:trade-cancel');assert.deepEqual(await state(),before);record('选择报价与取消保持世界状态和阅读暂停');
 await act('person:trade');await key('person:trade-batches').selectOption('3');assert(await key('person:trade-confirm').isDisabled());assert.deepEqual(await state(),before);
 await capture('02-insufficient');await act('person:trade-cancel');record('超过随身现货时确认不可用');
 phase='sale';await act('person:trade');await key('person:trade-batches').selectOption('2');await act('person:trade-confirm');
 const sold=await state();assert.equal(sold.stockpilesById[CARRIED].resources.stone,before.stockpilesById[CARRIED].resources.stone-20);
 assert.equal(sold.stockpilesById[CARRIED].resources.jade,before.stockpilesById[CARRIED].resources.jade+18);
 assert.deepEqual(sold.stockpilesById[HOME].resources,before.stockpilesById[HOME].resources);
 assert.equal(sold.stockpilesById[MARKET].resources.stone,before.stockpilesById[MARKET].resources.stone+20);
 assert.equal(sold.stockpilesById[MARKET].resources.jade,before.stockpilesById[MARKET].resources.jade-18);
 assert.equal(sold.worldTick,before.worldTick);await capture('03-sale');record('确认出售只当面交换实物与随身货款');
 await reopen('04-sale-reopen');const restored=await state();assert.equal(restored.srEconomy.tradeHistory.length,sold.srEconomy.tradeHistory.length);
 phase='purchase';await merchant();await act('person:trade');await key('person:trade-resource').selectOption('food');await key('person:trade-side').selectOption('buy');
 assert(await key('person:trade-confirm').isEnabled());await capture('05-buy-quote');await act('person:trade-confirm');
 const bought=await state(),cost=restored.stockpilesById[CARRIED].resources.jade-bought.stockpilesById[CARRIED].resources.jade;
 assert.equal(bought.stockpilesById[CARRIED].resources.food,restored.stockpilesById[CARRIED].resources.food+10);assert(cost>0);
 assert.equal(restored.stockpilesById[MARKET].resources.food-bought.stockpilesById[MARKET].resources.food,10);
 assert.equal(bought.stockpilesById[MARKET].resources.jade-restored.stockpilesById[MARKET].resources.jade,cost);
 assert.deepEqual(bought.stockpilesById[HOME].resources,restored.stockpilesById[HOME].resources);record('购买消耗随身灵石与商人有限现货',{cost});
 await closePerson();phase='money-return';const money=bought.stockpilesById[CARRIED].resources.jade;assert(money>0);await transfer(CARRIED,HOME,'jade',money);
 await reopen('06-money-delivered-reopen');await capture('07-complete');
 assert.equal(hash(await fs.readFile(source)),hash(bytes));assert.deepEqual((await page.evaluate(()=>window.courtyardQA.metrics())).errors,[]);
 assert.deepEqual(errors,[]);record('来源未改且运行无页面报错');complete=true;
}catch(e){checks.push({name:phase,ok:false,error:e.stack});console.error(e);if(page)await capture('failure').catch(()=>{});process.exitCode=1;}
finally{
 if(page)await fs.writeFile(path.join(output,'final.json'),JSON.stringify((await read()).session)+'\n').catch(()=>{});
 if(electron)await close().catch(e=>errors.push(e.message));
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:complete&&!errors.length?'passed':'failed',source,sourceSha256:hash(bytes),phase,checks,errors,actions,wallSeconds:(performance.now()-start)/1000,scope:'Local source Electron, one unchanged checkpoint, public UI actions, real elapsed time, screenshots.'},null,2)+'\n');
}
