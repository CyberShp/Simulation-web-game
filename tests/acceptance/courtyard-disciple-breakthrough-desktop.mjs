/** Ordinary-source autonomous disciple breakthrough.
 * --stage=node|desktop --source=/absolute/save.json --output=/absolute/fresh-dir
 * --prepare-only=true records the public food preparation without claiming core acceptance.
 * A core continuation accepts --preparation-report=/absolute/report.json and that
 * report's exact prepared.json source. Electron is launched only by stage=desktop.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,commandSect,advanceSect,snapshotSect,viewSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {inspectCourtyard} from '../../apps/courtyard/courtyard-inspection.mjs';
import {developmentContact} from '../../src/simulation/ea-disciple-development.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
import {sceneUnits} from '../../src/simulation/ea-sr-spatial.mjs';
import {saveNativePaused,setPausedIdempotent,runtimeHashes} from './courtyard-six-residents-body.mjs';

const arg=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=arg('source'),output=arg('output'),stage=arg('stage')||'node',prepareOnly=arg('prepare-only')==='true';
const maxTicks=Number(arg('max-ticks')||8000),maxWall=Number(arg('max-wall')||1800),preparationReport=arg('preparation-report');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!path.resolve(output).startsWith(repositoryRoot+'/'));assert(['node','desktop'].includes(stage));
assert(Number.isInteger(maxTicks)&&maxTicks>0&&maxTicks<=20000);assert(maxWall>0&&maxWall<=3600);
const LIN='person:lin-changfeng',MASTER='person:master',HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master';
const hash=v=>createHash('sha256').update(v).digest('hex'),bytes=await fs.readFile(source),original=JSON.parse(bytes),initial=structuredClone(original.state);
const run=restoreSect(original);assert.equal(validateSect(run),true);assert.deepEqual(run.state,initial,'read-only loading preserves the source');
assert.equal(initial.speed,0);assert.equal(original.courtyardPresentation?.manualPause,true);
assert.equal(initial.personsById[LIN].realm,1);assert.equal(initial.economy.starvation,0);
let inherited=null;
if(preparationReport){
 assert(path.isAbsolute(preparationReport)&&!prepareOnly);const raw=await fs.readFile(preparationReport),report=JSON.parse(raw);
 assert(report.success&&report.prepareOnly&&report.sourceUnchanged&&report.runtimeUnchanged);
 assert.equal(hash(bytes),report.preparedSha256);assert.equal(initial.worldTick,report.terminalTick);
 assert.equal(hash(await fs.readFile(report.source)),report.sourceSha256);
 inherited={path:preparationReport,sha256:hash(raw),source:report.source,sourceSha256:report.sourceSha256,preparation:report.preparation,daily:report.daily};
}
await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
const write=(name,v)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(v,null,2)+'\n');
const start=performance.now(),wall=()=>(performance.now()-start)/1000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const actions=[],events=[],daily=[],preparation=[],checkpoints=[],errors=[];
const runtimeBefore=await runtimeHashes(),oldOrders=new Set(Object.keys(initial.srCultivation.orders));
let app,page,native,terminal,preparedSha256,success=false,nativeClosed=null,nativeExact=null,lastDay=initial.economy.day,lastTrace=initial.worldTick;
let firstOrder=null,firstPhysical=null,completion=null,publicPanel=null,lastObserved={worldTick:initial.worldTick,resources:{...initial.stockpilesById[HOME].resources}};
const trace=async(event,data={})=>{const e={event,wallSeconds:wall(),...structuredClone(data)};events.push(e);await fs.appendFile(path.join(output,'events.jsonl'),JSON.stringify(e)+'\n');};
const brief=s=>{const p=s.personsById[LIN];return structuredClone({tick:s.worldTick,realm:p.realm,xp:p.xp,energy:p.energy,position:p.position,body:s.activitiesById[p.activityId]||null,home:s.stockpilesById[HOME].resources,starvation:s.economy.starvation});};
const newOrders=s=>Object.values(s.srCultivation.orders).filter(o=>o.personId===LIN&&o.kind==='breakthrough'&&!oldOrders.has(o.id));
function monitor(s){
 assert.deepEqual(s.homeMemberIds,initial.homeMemberIds);assert.equal(s.economy.starvation,0,'ordinary path must retain daily supply');
 for(const id of [MASTER,...initial.homeMemberIds]){const p=s.personsById[id],before=initial.personsById[id];assert.equal(p.personId,id);assert.equal(p.name,before.name);assert.deepEqual(p.appearance,before.appearance);assert.notEqual(p.lifeStatus,'dead');}
 if(s.economy.day>lastDay){
  assert.equal(s.economy.day,lastDay+1,'observe each actual day');const day=s.economy.day,all=[MASTER,...s.homeMemberIds];
  const meals=Object.values(s.factsById).filter(f=>f.kind==='site-meal-consumed'&&f.dayIndex===day-1&&all.includes(f.personId));
  const expectedFood=all.reduce((n,id)=>n+Math.max(0,2-meals.filter(f=>f.personId===id).length),0),receipts=s.homeMemberIds.map(id=>s.factsById[`fact:person-daily-supply:${id}:${day}`]);
  assert(receipts.every(f=>f?.supplied&&f.sourceDay===day&&f.starvation===0));assert(Math.abs(s.economy.expense.food-expectedFood)<1e-9);
  daily.push(structuredClone({tick:s.worldTick,day,expectedFood,actualDayFoodExpense:s.economy.expense.food,meals,receipts,homeFood:s.stockpilesById[HOME].resources.food}));lastDay=day;
 }
 const orders=newOrders(s);assert(orders.length<=1,'one autonomous attempt, not repeated material reservations');
 if(orders.length){const o=orders[0],p=s.personsById[LIN];assert.deepEqual(o.cost,{jade:24,herb:8});assert.equal(o.sourceStockpileId,HOME);assert.equal(o.parameters.fromRealm,1);
  const fact=s.factsById[o.startFactId];assert(fact&&fact.orderId===o.id&&fact.personId===LIN);assert.deepEqual(fact.cost,o.cost);
  if(!firstOrder){firstOrder=structuredClone({order:o,fact,sample:brief(s),previousTick:lastObserved.worldTick,previousHome:lastObserved.resources});}
  if(o.phase==='executing'){
   const a=s.activitiesById[p.activityId],r=s.reservationsById[a?.reservationId],slot=slotById(run.state,a?.slotId);
   assert(a?.kind==='sr-cultivation'&&a.orderId===o.id&&a.phase==='executing');assert(r?.personId===LIN&&r.activityId===a.id&&r.slotId===a.slotId);assert(slot?.kind==='cultivate');
   assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<=sceneUnits(run.state,1)+1e-8,'breakthrough work requires the actual reserved mat arrival radius');
   if(!firstPhysical)firstPhysical=structuredClone({tick:s.worldTick,order:o,activity:a,reservation:r,slot,position:p.position});
  }
  if(o.phase==='completed'){assert.equal(o.progressTicks,180);assert(o.consumed&&o.refineStarted);assert.equal(p.realm,2);if(!completion)completion=structuredClone({tick:s.worldTick,order:o,sample:brief(s)});}
 }
 lastObserved={worldTick:s.worldTick,resources:{...s.stockpilesById[HOME].resources}};
}
let read=async()=>snapshotSect(run),closePanels=async()=>{};
let send=async request=>{const result=commandSect(run,request);actions.push({tick:run.state.worldTick,request,result});assert(result.ok,result.error||result.message);return result.result;};
let pause=async paused=>send({type:'pause',paused});
let contact=s=>developmentContact(s,s.personsById[LIN]).available,routeFinished=s=>!s.personsById[MASTER].scenic.path.length;
let wait=async(predicate,label,{tickLimit=maxTicks,returnAtLimit=false}={})=>{
 const begin=run.state.worldTick;for(let n=0;n<=tickLimit;n++){
  monitor(run.state);if(predicate(run.state))return snapshotSect(run);if(n===tickLimit)break;
  if(n%100===0)await send({type:'manual'});advanceSect(run,.1);
  if(run.state.worldTick-lastTrace>=600){lastTrace=run.state.worldTick;await trace('progress',{label,sample:brief(run.state)});}
 }if(returnAtLimit)return snapshotSect(run);throw Error(`bounded Node wait ${label}: ${begin}→${run.state.worldTick}`);
};
let checkpoint=async name=>{await pause(true);const before=await read();assert.equal(validateSect(restoreSect(before)),true);await write(name,before);const after=restoreSect(before);assert.deepEqual(after.state,before.state);Object.assign(run,after);await write(name+'-reopened',snapshotSect(run));checkpoints.push({name,tick:before.state.worldTick,scope:'Node codec round trip'});return before;};
let inspectPublic=async()=>{
 await pause(true);await send({type:'manual'});
 for(let attempt=0;attempt<12&&!contact(run.state);attempt++){
  const p=inspectCourtyard(run).people.find(p=>p.id===LIN),target=p.location.focus||p.location;await send({type:'move',x:target.x,y:target.y});const begin=run.state.worldTick;
  await pause(false);await wait(s=>contact(s)||s.worldTick>=begin+10&&routeFinished(s),'public approach',{tickLimit:150,returnAtLimit:true});await pause(true);
 }
 assert(contact(run.state),'actual nearby public contact');const before=await read(),member=viewSect(run).discipleDevelopment.members.find(m=>m.personId===LIN);
 assert.equal(member.cultivation.xp,before.state.personsById[LIN].xp);assert.deepEqual((await read()).state,before.state);publicPanel={scope:'Node public projection',member,tick:before.state.worldTick,readOnlyExact:true};await write('public-breakthrough',publicPanel);
};

try{
 if(stage==='desktop'){
  const {_electron}=await import('playwright'),target=desktopTarget(),directory=path.join(output,'world');await fs.mkdir(directory);native=path.join(directory,'sect-save.json');await fs.writeFile(native,bytes,{flag:'wx'});
  async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show']});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
  await launch();let nearby=false,route=null;
  read=async()=>{const o=await page.evaluate(id=>{const q=window.courtyardQA;return {session:q.snapshot(),contact:q.view().discipleDevelopment.members.find(m=>m.personId===id)?.contact.available===true,route:q.route()};},LIN);nearby=o.contact;route=o.route;return o.session;};
  contact=()=>nearby;routeFinished=()=>!!route&&(!!route.failure||route.remaining===0&&!route.active);assert.deepEqual((await read()).state,initial);
  closePanels=async()=>{for(const id of ['#dialog-close','#close-person','#close-management'])if(await page.locator(id).isVisible())await page.locator(id).click();};
  const click=async selector=>{const node=page.locator(selector);await node.scrollIntoViewIfNeeded();assert(await node.isVisible());assert(await node.isEnabled());await node.click();actions.push({selector,tick:(await read()).state.worldTick});};
  pause=async wanted=>{await closePanels();await setPausedIdempotent({wanted,readStatus:()=>page.evaluate(()=>window.courtyardQA.status().manualPause),click:()=>click('#pause')});};
  send=async request=>{
   await closePanels();
   if(request.type==='manual'){await click('#affairs');await click('[data-ui-key="affairs:policy"]');await click('[data-ui-key="policy:manual"]');}
   else if(request.type==='claim-progress-reward'){await click('#affairs');await click('[data-ui-key="progress:reward:alchemy"]');}
   else if(['harvest','replenish'].includes(request.type)){await click('#supply');await click('[data-ui-key="subtab:sources"]');await click('[data-ui-key="source:food"]');await click(`[data-ui-key="source:${request.type}:food"]`);}
   else if(request.type==='transport'){await click('#supply');await click('[data-ui-key="subtab:stocks"]');await page.locator('[data-ui-key="stocks:owner"]').selectOption('all');await click(`[data-ui-key="stock:${CARRIED}"]`);await page.locator('[data-ui-key="stock:destination"]').selectOption(HOME);await click('[data-ui-key="stock:transfer:food"]');await page.locator('[data-ui-key="transfer:quantity"]').fill('16');await click('[data-ui-key="transfer:submit"]');}
   else throw Error('no public UI adapter: '+request.type);
   await closePanels();
  };
  wait=async(predicate,label,{tickLimit=maxTicks,returnAtLimit=false}={})=>{
   const begin=(await read()).state.worldTick;let lastManual=begin;
   for(;;){assert(wall()<maxWall,'native wall bound');assert.deepEqual(errors,[]);const raw=await read(),s=raw.state;monitor(s);if(predicate(s))return raw;
    if(s.worldTick-begin>=tickLimit){if(returnAtLimit)return raw;throw Error('native tick bound: '+label);}
    if(s.worldTick-lastManual>=100){await pause(true);await send({type:'manual'});lastManual=(await read()).state.worldTick;await pause(false);}
    if(s.worldTick-lastTrace>=300){lastTrace=s.worldTick;await trace('progress',{label,sample:brief(s)});}await sleep(100);
   }
  };
  checkpoint=async name=>{
   await pause(true);const before=await read();assert.equal(validateSect(restoreSect(before)),true);await write(name,before);await page.screenshot({path:path.join(output,name+'.png')});
   const saved=await saveNativePaused({pause,closeDialogs:closePanels,snapshot:async()=>{const raw=await read();return {manualPause:await page.evaluate(()=>window.courtyardQA.status().manualPause),tick:raw.state.worldTick,state:raw.state};},clickSave:()=>click('#save'),readNative:()=>fs.readFile(native),validate:raw=>validateSect(restoreSect(raw))});
   assert.deepEqual(saved.saved.state,before.state);await app.close();app=null;await launch();const after=await read();assert.deepEqual(after.state,before.state);await write(name+'-reopened',after);checkpoints.push({name,tick:before.state.worldTick,nativeExact:true,scope:'macOS source Electron save/close/reopen'});return after;
  };
  inspectPublic=async()=>{
   await pause(true);await send({type:'manual'});
   const open=async()=>{await closePanels();await click('#people');await click(`[data-ui-key="person:${LIN}"]`);await click(`[data-ui-key="person:inspect:${LIN}"]`);};
   for(let attempt=0;attempt<12;attempt++){
    const raw=await read();if(contact(raw.state))break;const continuing=route&&!route.failure&&route.destination&&(route.remaining>0||route.active);
    if(!continuing){await open();if(contact((await read()).state))break;await click('#approach-person');}
    const begin=(await read()).state.worldTick;await pause(false);await wait(s=>contact(s)||s.worldTick>=begin+10&&routeFinished(s),'public approach',{tickLimit:150,returnAtLimit:true});await pause(true);await trace('approach',{attempt,sample:brief((await read()).state),route});
   }
   await open();const before=await read();assert(contact(before.state));const node=page.locator('[data-ui-key="person:cultivation-progress"]');await node.scrollIntoViewIfNeeded();assert(await node.isVisible());
   const member=await page.evaluate(id=>window.courtyardQA.view().discipleDevelopment.members.find(m=>m.personId===id),LIN),text=await node.innerText();assert.equal(before.state.personsById[LIN].realm,2);assert(text.includes(member.cultivation.realm));assert.equal(member.cultivation.xp,before.state.personsById[LIN].xp);
   await sleep(800);assert.deepEqual((await read()).state,before.state,'reading the paused public panel is read-only');await page.screenshot({path:path.join(output,'public-breakthrough.png')});publicPanel={scope:'visible native DOM',tick:before.state.worldTick,text,member,readOnlyExact:true};await write('public-breakthrough',publicPanel);await closePanels();
  };
 }
 await pause(true);await trace('source',{sourceSha256:hash(bytes),sample:brief(initial),inherited});
 if(!inherited){
  assert(initial.factsById['fact:craft:work:craft:505'],'existing ordinary craft result qualifies the reward');const before=(await read()).state;
  await send({type:'claim-progress-reward',rewardId:'alchemy'});const claimed=(await read()).state;assert.equal(claimed.stockpilesById[HOME].resources.jade-before.stockpilesById[HOME].resources.jade,70);assert(Math.abs(claimed.stockpilesById[HOME].resources.herb-before.stockpilesById[HOME].resources.herb-30)<1e-9);assert.equal(claimed.claimed.filter(id=>id==='alchemy').length,1);
  preparation.push({kind:'earned-reward',tick:claimed.worldTick,craftFact:initial.factsById['fact:craft:work:craft:505'],reward:{jade:70,herb:30}});
  await send({type:'manual'});await send({type:'replenish',resource:'food'});let s=(await read()).state;const restoreId=s.personsById[MASTER].activityId;assert(s.activitiesById[restoreId]?.kind==='sr-replenish');
  await pause(false);await wait(s=>!s.activitiesById[restoreId],'restore the actual food source');await pause(true);s=(await read()).state;preparation.push({kind:'replenished',tick:s.worldTick,patch:structuredClone(s.srEconomy.patches.food)});
  for(let batch=1;batch<=2;batch++){
   await send({type:'harvest',resource:'food'});s=(await read()).state;const a=s.activitiesById[s.personsById[MASTER].activityId];assert(a?.kind==='sr-harvest'&&a.reservedQuantity===16);const fid='fact:manual-harvest:'+a.id;
   await pause(false);await wait(s=>!!s.factsById[fid],'physical harvest '+batch);await pause(true);s=(await read()).state;const harvest=s.factsById[fid];assert.equal(harvest.quantity,16);assert.equal(harvest.actorId,MASTER);
   const old=new Set(Object.keys(s.workOrdersById));await send({type:'transport',sourceStockpileId:CARRIED,targetStockpileId:HOME,cargo:{food:16}});s=(await read()).state;
   const orders=Object.values(s.workOrdersById).filter(o=>!old.has(o.id)&&o.kind==='transport'&&o.carrierId===MASTER&&o.sourceStockpileId===CARRIED&&o.targetStockpileId===HOME&&o.cargo.food===16);assert.equal(orders.length,1);const id=orders[0].id;
   await pause(false);await wait(s=>s.workOrdersById[id].phase==='delivered','physical delivery '+batch);await pause(true);s=(await read()).state;
   const facts=Object.values(s.factsById).filter(f=>f.operation==='delivery'&&f.workOrderId===id);assert.equal(facts.length,1);assert.deepEqual(facts[0].quantities,{food:16});assert.equal(facts[0].targetStockpileId,HOME);preparation.push(structuredClone({batch,harvest,order:s.workOrdersById[id],delivery:facts[0],sample:brief(s)}));
  }
  const prepared=prepareOnly?await checkpoint('prepared'):await read();assert.equal(validateSect(restoreSect(prepared)),true);const b=JSON.stringify(prepared,null,2)+'\n';await fs.writeFile(path.join(output,'prepared.json'),b);preparedSha256=hash(b);await write('preparation',preparation);
 }
 if(prepareOnly){terminal=await read();success=true;}
 else{
  await pause(false);await wait(s=>newOrders(s).length===1,'autonomous breakthrough reserves its own materials');await pause(true);await checkpoint('breakthrough-reserved');
  await pause(false);await wait(s=>newOrders(s)[0]?.phase==='executing','real breakthrough station starts work');await pause(true);
  const mid=await checkpoint('breakthrough-mid');const o=newOrders(mid.state)[0];assert(o.progressTicks>0&&o.progressTicks<180,'actual unfinished breakthrough survives the reopen');assert(firstPhysical);
  await pause(false);await wait(s=>newOrders(s)[0]?.phase==='completed'&&s.personsById[LIN].realm===2,'autonomous breakthrough completes');await pause(true);await checkpoint('breakthrough-completed');
  assert(completion);assert.equal(newOrders((await read()).state).length,1);await inspectPublic();terminal=await checkpoint('terminal');monitor(terminal.state);assert.equal(terminal.state.personsById[LIN].realm,2);assert(daily.length||inherited?.daily.length);assert(publicPanel?.readOnlyExact);success=true;
 }
}catch(error){errors.push(error.stack||String(error));process.exitCode=1;try{await pause(true);await write('failure',await read());if(page)await page.screenshot({path:path.join(output,'failure.png')});}catch(e){errors.push('failure preservation: '+e.message);}}
finally{
 if(app){const proc=app.process();await app.close();for(let n=0;n<100&&proc.exitCode===null&&proc.signalCode===null;n++)await sleep(100);nativeClosed=proc.exitCode!==null||proc.signalCode!==null;app=null;}
 if(native&&terminal)nativeExact=JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(terminal.state);
 const runtimeAfter=await runtimeHashes(),runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter),sourceUnchanged=hash(await fs.readFile(source))===hash(bytes);
 const inheritedUnchanged=!inherited||(hash(await fs.readFile(inherited.path))===inherited.sha256&&hash(await fs.readFile(inherited.source))===inherited.sourceSha256);
 if(errors.length||!runtimeUnchanged||!sourceUnchanged||!inheritedUnchanged||stage==='desktop'&&(!nativeClosed||!nativeExact)){success=false;process.exitCode=1;errors.push('source/runtime/native invariant failed');}
 await write('report',{success,stage,prepareOnly,scope:stage==='node'?'Node normal public-command rehearsal':'macOS source Electron public UI',source,sourceSha256:hash(bytes),sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,inherited,inheritedUnchanged,preparedSha256,terminalTick:terminal?.state.worldTick,nativeClosed,nativeExact,firstOrder,firstPhysical,completion,publicPanel,checkpoints,preparation,daily,actions,events,errors,wallSeconds:wall(),limits:{maxTicks,maxWall}});
 console.log(JSON.stringify({success,stage,prepareOnly,output,terminalTick:terminal?.state.worldTick,errors}));
}
