/** Same-native six-resident continuation. Run only under the root executor. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
import {inspectSixResidentSample,installSixResidentBrowserReader,setPausedIdempotent,saveNativePaused,runtimeHashes} from './courtyard-six-residents-body.mjs';
import {fileURLToPath} from 'node:url';
const opt=n=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3);
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=path.resolve(opt('source')||path.join(repositoryRoot,'.qa-dsh-parallel/15-funding/runs/merchant-harvest-01/world/sect-save.json'));
const expectedSha=opt('source-sha256')||'e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6';
const stage=opt('stage')||'settlement';assert(['settlement','living'].includes(stage));
const root='/Volumes/Media/immortal-qa/sol-six-residents-20261020';
const output=path.resolve(opt('output')||path.join(root,stage+'-'+Date.now()));assert(output.startsWith(root+path.sep));
const maxWall=Number(opt('max-wall')||(stage==='settlement'?180:600));assert(maxWall>0&&maxWall<=1200);
const bytes=fs.readFileSync(source);assert.equal(sha(bytes),expectedSha,'source native bytes');
const original=JSON.parse(bytes),initial=original.state;assert.equal(validateSect(restoreSect(original)),true);assert.equal(initial.speed,0);assert.equal(original.courtyardPresentation.manualPause,true);assert.equal(initial.homeMemberIds.length,5);assert(!initial.homeMemberIds.includes('person:master'));
const initialMembers=[...initial.homeMemberIds],startTick=initial.worldTick,nextSettlement=(Math.floor(startTick/initial.ticksPerDay)+1)*initial.ticksPerDay;
const preflight={stage,source,sha256:sha(bytes),startTick,nextSettlement,residents:6,members:initialMembers,maxWall,electronStarted:false};
if(process.argv.includes('--preflight-only')){console.log(JSON.stringify(preflight,null,2));process.exit(0)}
assert(!fs.existsSync(output),'output must be new');fs.mkdirSync(path.join(output,'world'),{recursive:true});
const savePath=path.join(output,'world/sect-save.json');fs.writeFileSync(savePath,bytes,{flag:'wx'});fs.writeFileSync(path.join(output,'source-native.json'),bytes,{flag:'wx'});
for(const script of [fileURLToPath(import.meta.url),fileURLToPath(new URL('./courtyard-six-residents-body.mjs',import.meta.url))])fs.copyFileSync(script,path.join(output,path.basename(script)));
const target=desktopTarget(),started=performance.now(),wall=()=>Number(((performance.now()-started)/1000).toFixed(6));
const beforeHashes=await runtimeHashes();fs.writeFileSync(path.join(output,'runtime-before.json'),JSON.stringify(beforeHashes,null,2));
let electron,page,last=null,phase='load',status='running',error=null,saved=null,reopen=null,stopping=false;const checks=[],daily=[],beds={},errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const write=(name,data)=>fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n');
const trace=data=>fs.appendFileSync(path.join(output,'trace.jsonl'),JSON.stringify({wallSeconds:wall(),phase,...data})+'\n');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true});
function budget(){if(stopping||fs.existsSync(path.join(output,'STOP')))throw new Error('requested-stop');if(wall()>maxWall)throw new Error('observation-wall-boundary');}
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,`--qa-dir=${path.join(output,'world')}`,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:30000});await installSixResidentBrowserReader(page,initialMembers,startTick);}
async function closePanels(){for(const id of ['#close-management','#close-person','#dialog-close']){const l=page.locator(id);if(await l.isVisible().catch(()=>false))await l.click();}}
const pause= wanted=>setPausedIdempotent({wanted,readStatus:()=>page.evaluate(()=>window.courtyardQA.status().manualPause),click:()=>page.locator('#pause').click()});
async function resume(){await closePanels();await pause(false);const st=await page.evaluate(()=>({status:window.courtyardQA.status(),speed:window.courtyardQA.snapshot().state.speed}));assert.equal(st.speed,1,'normal 1x resume');assert.equal(st.status.manualPause,false);}
async function sample(full=false){const t=performance.now();const v=await page.evaluate(full=>window.__sixResidentRead(full),full);v.readMs=performance.now()-t;last=v;const s=v.raw.state;assert.deepEqual(s.homeMemberIds,initialMembers);assert(s.speed===0||s.speed===1);const inspection=v.inspection;if(inspection.invalid.length){write('first-invalid-sample.json',await page.evaluate(()=>window.__sixResidentInvalidEvidence));throw new Error(inspection.invalid.join(',')+' remains on active visible ground');}for(const observation of inspection.beds){const id=observation.personId;if(!beds[id]){beds[id]=observation;const evidence=await page.evaluate(id=>window.__sixResidentBedEvidence[id],id);assert.equal(evidence.session.state.worldTick,observation.tick);write('bed-'+id.replace(/[^a-z0-9]/gi,'-')+'.json',evidence);}}

 trace({tick:s.worldTick,readMs:v.readMs,browserInspectMs:v.browserInspectMs,full:v.full,inheritedRecovery:v.inspection.inheritedRecovery,recoveredInheritedIds:v.inspection.recoveredInheritedIds,home:s.stockpilesById['stockpile:yunxiu'].resources,globalStarvation:s.economy.starvation,people:v.view.people.map(p=>({id:p.id,x:p.x,y:p.y,indoor:p.indoor})),beds:Object.keys(beds),renderedFrames:v.metrics.renderedFrames});assert(!errors.length,errors.join(';'));return v;}
async function until(predicate,label){phase=label;let signature=null,changedAt=wall();for(;;){budget();const v=await sample();if(predicate(v.raw.state,v))return v;const s=v.raw.state;const progress=JSON.stringify(['person:master',...initialMembers].map(id=>{const p=s.personsById[id],a=s.activitiesById[p.activityId];return[id,p.position,p.energy,p.xp,p.wound,a?.id,a?.phase,a?.progressTicks,(p.scenic||p.mind?.scenic)?.path]}));if(progress!==signature){signature=progress;changedAt=wall();}if(wall()-changedAt>20){write('stalled-state.json',{sample:v,session:await page.evaluate(()=>window.__sixResidentLastRaw)});throw new Error('body-progress-stalled:'+label);}await sleep(100);}}
const key=n=>page.locator(`[data-ui-key=${JSON.stringify(n)}]`);
async function enableAutonomousFood(){
 await pause(true);await closePanels();await page.locator('#affairs').click();await key('affairs:policy').click();await key('policy:risk').selectOption('balanced');await key('policy:save').click();await key('policy:auto').click();await closePanels();const raw=await page.evaluate(()=>window.courtyardQA.snapshot());assert.equal(raw.policy.risk,'balanced');assert.equal(raw.control.mode,'auto');assert.equal(raw.policy.foodTarget,original.policy.foodTarget);checks.push({name:'public-balanced-autonomous',tick:raw.state.worldTick,policy:raw.policy});write('autonomous-policy.json',raw);
}

async function save(){const r=await saveNativePaused({pause,closeDialogs:closePanels,snapshot:async()=>{const x=await page.evaluate(()=>({raw:window.courtyardQA.snapshot(),manualPause:window.courtyardQA.status().manualPause}));return{...x.raw,state:x.raw.state,tick:x.raw.state.worldTick,manualPause:x.manualPause}},clickSave:()=>page.locator('#save').click(),readNative:()=>fs.readFileSync(savePath),validate:d=>validateSect(restoreSect(d)),timeoutMs:15000});return{path:savePath,sha256:sha(r.bytes),tick:r.tick,stateEqual:r.stateEqual,paused:r.paused};}
async function close(){if(!electron)return;const e=electron;electron=null;await e.close();page=null;}
try{await launch();const loaded=await sample(true);assert(isDeepStrictEqual(loaded.raw.state,initial),'initial native complete state equality');assert.equal(loaded.status.manualPause,true);checks.push({name:'initial-native-state-equal',tick:startTick});write('loaded.json',loaded.raw);await resume();let v=await until(s=>s.worldTick>=nextSettlement,'first-settlement');await pause(true);v=await sample(true);const s=v.raw.state,day=Math.floor(nextSettlement/s.ticksPerDay);const facts=initialMembers.map(id=>s.factsById[`fact:person-daily-supply:${id}:${day}`]);assert(facts.every(f=>f&&f.atTick===nextSettlement&&f.supplied&&f.starvation===0&&f.source==='economy.daily-supply'));assert.equal(s.economy.starvation,0);const beforeFood=initial.stockpilesById['stockpile:yunxiu'].resources.food,afterFood=s.stockpilesById['stockpile:yunxiu'].resources.food;assert(afterFood<beforeFood,'first daily consumption deducts HOME food');daily.push(...facts);checks.push({name:'first-settlement',tick:nextSettlement,beforeFood,afterFood,consumed:beforeFood-afterFood,membersSupplied:facts.length});write('first-settlement.json',v.raw);
 if(stage==='living'){
  const baselineFacts=new Set(Object.keys(s.factsById));await enableAutonomousFood();await resume();
  await until(s=>{const harvest=Object.values(s.factsById).find(f=>!baselineFacts.has(f.id)&&f.operation==='manual-harvest'&&f.resource==='food'&&f.actorId==='person:master');const delivery=Object.values(s.factsById).find(f=>!baselineFacts.has(f.id)&&f.operation==='delivery'&&f.quantities?.food>0&&f.targetStockpileId==='stockpile:yunxiu'&&f.sourceStockpileId==='stockpile:carried:master');if(harvest&&delivery){checks.push({name:'autonomous-harvest-delivery',harvest,delivery});return true;}return false;},'autonomous-food');
  await pause(true);const base=(await sample(true)).raw.state;const next=(Math.floor(base.worldTick/base.ticksPerDay)+1)*base.ticksPerDay;
  await resume();await until(s=>s.worldTick>=next,'continued-daily-consumption');await pause(true);const end=(await sample(true)).raw.state,day=Math.floor(next/end.ticksPerDay);for(const id of initialMembers){const f=end.factsById[`fact:person-daily-supply:${id}:${day}`];assert(f?.supplied&&f.starvation===0);daily.push(f);}checks.push({name:'continued-daily-supply',tick:next});
  if(!['person:yunxiu:73','person:yunxiu:75'].every(id=>beds[id])){await resume();await until(s=>['person:yunxiu:73','person:yunxiu:75'].every(id=>beds[id]),'pending-beds-arrival');await pause(true);}
 }

 saved=await save();const beforeReopen=JSON.parse(fs.readFileSync(savePath));await close();await launch();const after=await sample(true);assert.deepEqual(after.raw.state,beforeReopen.state);assert.equal(after.status.manualPause,true);reopen={stateEqual:true,tick:after.raw.state.worldTick};status='passed';
}catch(e){error={message:e.message,stack:e.stack};status=['requested-stop','observation-wall-boundary'].includes(e.message)?'incomplete':'failed';if(page){try{saved=await save()}catch(se){error.saveError=se.message;}}}
finally{try{await close()}catch(e){error={...(error||{}),closeError:e.message};status='failed';}const afterHashes=await runtimeHashes();write('runtime-after.json',afterHashes);const sourceUnchanged=sha(fs.readFileSync(source))===expectedSha,runtimeUnchanged=isDeepStrictEqual(beforeHashes,afterHashes);if(!sourceUnchanged||!runtimeUnchanged)status='failed';write('report.json',{...preflight,status,accepted:status==='passed',electronStarted:true,phase,error,checks,daily,beds,saved,reopen,lastTick:last?.raw.state.worldTick??null,segmentSeconds:wall(),sourceUnchanged,runtimeUnchanged,errors,scope:stage==='settlement'?'one daily settlement and exact native reopen':'daily supply, observed pending beds, autonomous harvest delivery, continued daily supply and exact reopen',sampling:'full visible body/doorway policy at each 100ms requested observation; trace reports actual ticks/read latency; no unobserved-tick traversal claim'});console.log(JSON.stringify({status,output,saved,error},null,2));process.exitCode=status==='passed'?0:1;}
