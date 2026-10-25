/** Normal-save rehearsal and native acceptance of an existing disciple lesson.
 * --stage=prepare|node|desktop --source=/absolute/native.json --output=/absolute/fresh-dir
 * Optional --prepare-food-batches=2 --max-ticks=12000 --max-wall=1800.
 * Native core may continue an attested --resume-prepared=true source with
 * --lineage-source=/original.json --preparation-record=/preparation-lineage.json.
 * --resume-grown=true --core-report=/prior/report.json starts a new branch from
 * that report's attested cultivating-reopened.json, retaining prior failures.
 * Desktop execution belongs to the coordinating agent after the Node rehearsal.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,commandSect,advanceSect,snapshotSect,viewSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {inspectCourtyard} from '../../apps/courtyard/courtyard-inspection.mjs';
import {toWorld} from '../../apps/courtyard/courtyard-space.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
import {breakthroughView} from '../../src/simulation/ea-sr-cultivation.mjs';
import {developmentContact} from '../../src/simulation/ea-disciple-development.mjs';
import {saveNativePaused,setPausedIdempotent,runtimeHashes} from './courtyard-six-residents-body.mjs';

const arg=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=arg('source'),output=arg('output'),stage=arg('stage')||'node';
const ui=arg('resume-ui')==='true',resumed=arg('resume-prepared')==='true',grown=arg('resume-grown')==='true'||ui,batches=Number(arg('prepare-food-batches')??(resumed||grown?0:2)),maxTicks=Number(arg('max-ticks')||12000),maxWall=Number(arg('max-wall')||1800);
assert(!(resumed&&grown),'choose one actual continuation phase');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));
assert(!path.resolve(output).startsWith(repositoryRoot+'/'),'evidence belongs outside the repository');
assert(['prepare','node','desktop'].includes(stage));assert(Number.isInteger(batches)&&batches>=0&&batches<=8);
assert(Number.isInteger(maxTicks)&&maxTicks>0);assert(maxWall>0&&maxWall<=3600);
const LIN='person:lin-changfeng',MASTER='person:master',HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master';
const bytes=await fs.readFile(source),hash=v=>createHash('sha256').update(v).digest('hex'),original=JSON.parse(bytes);
const worldRoute=r=>({...r,waypoints:(r.waypoints||[]).map(p=>toWorld(p.x,p.y)),destination:r.destination?toWorld(r.destination.x,r.destination.y):null,active:r.active?{world:r.active.world,tick:r.active.tick,exit:!!r.active.exit,...(r.active.adjusted?{adjusted:true}:{})}:null});
let lineage=null,inheritedCore=null,inheritedUi=null;const inheritedEvidence=[];
if(ui){
 assert.equal(stage,'desktop','resume-ui requires the native renderer to continue its saved waypoint queue');
 const reportPath=arg('segment-report');assert(reportPath&&path.isAbsolute(reportPath));const reportBytes=await fs.readFile(reportPath),segment=JSON.parse(reportBytes),directory=path.dirname(reportPath);
 const nativePath=path.join(directory,'world/sect-save.json'),failurePath=path.join(directory,'failure.json'),nativeBytes=await fs.readFile(nativePath),failureBytes=await fs.readFile(failurePath),nativeSession=JSON.parse(nativeBytes),failure=JSON.parse(failureBytes);
 assert.equal(segment.stage,'desktop');assert.equal(segment.success,false);assert(segment.sourceUnchanged&&segment.runtimeUnchanged);assert.equal(hash(bytes),hash(nativeBytes));assert.deepEqual(original,nativeSession);assert.deepEqual(original.state,failure.state,'failure diagnostic and actual native save have the same full canonical state');
 assert.equal(original.state.economy.starvation,0);const presentation=original.courtyardPresentation;assert(presentation.route?.length&&presentation.activeWaypoint?.world&&presentation.destination);
 const receipt=original.state.transactions.receipts.find(r=>{const [name,actor,args]=JSON.parse(r.signature);return name==='moveScenicMaster'&&actor===MASTER&&r.status==='committed'&&r.result===true&&Math.hypot(args[0]-presentation.activeWaypoint.world.x,args[1]-presentation.activeWaypoint.world.y)<1e-7;});assert(receipt,'saved active waypoint must have a committed master move');
 assert(segment.segmentGrowth?.physical&&segment.segmentGrowth.tick<original.state.worldTick&&original.state.personsById[LIN].xp>segment.afterReopenXp);
 assert(segment.daily.length&&segment.daily.every(d=>Math.abs(d.actualDayFoodExpense-d.expectedFood)<1e-9&&d.receipts.length===original.state.homeMemberIds.length&&d.receipts.every(f=>{assert.deepEqual(original.state.factsById[f.id],f);return f.supplied;})));
 assert.equal(hash(await fs.readFile(segment.source)),segment.sourceSha256,'native segment source remains unchanged');
 inheritedUi={reportPath,reportSha256:hash(reportBytes),nativePath,nativeSha256:hash(nativeBytes),failurePath,failureSha256:hash(failureBytes),sourceTick:original.state.worldTick,coreReportPath:segment.inheritedCore.reportPath,coreReportSha256:segment.inheritedCore.reportSha256,growth:segment.segmentGrowth,daily:segment.daily,acceptedWaypoint:receipt,presentation:structuredClone(presentation),errors:segment.errors,scope:'Native segment growth and daily supply inherited; this continuation verifies the saved public approach, read-only UI and final native save/reopen'};
 inheritedEvidence.push({path:reportPath,sha256:hash(reportBytes)},{path:nativePath,sha256:hash(nativeBytes)},{path:failurePath,sha256:hash(failureBytes)});
}
if(grown){
 assert(stage!=='prepare'&&batches===0,'grown continuation starts after an actual native growth checkpoint');
 const reportPath=ui?inheritedUi.coreReportPath:arg('core-report');assert(reportPath&&path.isAbsolute(reportPath),'absolute --core-report required');
 const reportBytes=await fs.readFile(reportPath),core=JSON.parse(reportBytes),directory=path.dirname(reportPath);
 if(ui)assert.equal(hash(reportBytes),inheritedUi.coreReportSha256);
 assert.equal(core.stage,'desktop');assert.equal(core.sourceUnchanged,true);assert.equal(core.runtimeUnchanged,true);
 const checkpoint=core.checkpoints.find(c=>c.tick===core.firstCheckpointTick&&c.nativeExact===true);assert(checkpoint,'attested native checkpoint required');
 const beforePath=path.join(directory,checkpoint.name+'.json'),reopenedPath=path.join(directory,checkpoint.name+'-reopened.json');
 const beforeBytes=await fs.readFile(beforePath),reopenedBytes=await fs.readFile(reopenedPath),before=JSON.parse(beforeBytes),reopened=JSON.parse(reopenedBytes);
 assert.deepEqual(before.state,reopened.state,'prior native save and reopen have the entire same canonical state');
 if(!ui){assert.deepEqual(original,reopened,'branch source is the complete attested reopened session');assert.equal(hash(bytes),hash(reopenedBytes));assert.equal(original.state.worldTick,core.firstCheckpointTick);assert.equal(original.state.personsById[LIN].xp,core.afterReopenXp);}
 assert(core.completedLessonTick<=core.firstGrowth.tick&&core.firstGrowth.tick<=core.firstCheckpointTick);
 assert(core.proofChecks.originalCourseMadeProgress&&core.proofChecks.originalCourseCompleted&&core.proofChecks.actualCultivationStation);
 assert(core.firstGrowth.physical&&core.firstGrowth.xp>0);assert.equal(original.state.personsById[LIN].mind.learning,null);assert.equal(original.state.economy.starvation,0);
 const preparedBytes=await fs.readFile(core.source),prepared=JSON.parse(preparedBytes);assert.equal(hash(preparedBytes),core.sourceSha256);
 assert.equal(prepared.state.personsById[LIN].mind.learning.id,'qingguard');assert(prepared.state.worldTick<core.completedLessonTick);
 let priorFailure=null;
 if(core.success===false){const failurePath=path.join(directory,'failure.json'),failureBytes=await fs.readFile(failurePath),failure=JSON.parse(failureBytes);priorFailure={path:failurePath,sha256:hash(failureBytes),tick:failure.state.worldTick,starvation:failure.state.economy.starvation,errors:core.errors};inheritedEvidence.push({path:failurePath,sha256:hash(failureBytes)});}
 inheritedCore={reportPath,reportSha256:hash(reportBytes),originalBranchSuccess:core.success,priorFailure,checkpoint:{...checkpoint,beforePath,beforeSha256:hash(beforeBytes),reopenedPath,reopenedSha256:hash(reopenedBytes)},originalLesson:prepared.state.personsById[LIN].mind.learning,completedLessonTick:core.completedLessonTick,maxLessonProgress:core.maxLessonProgress,firstGrowth:core.firstGrowth,afterReopenXp:core.afterReopenXp,scope:'Inherited old-lesson completion, physical first growth and one native reopen; this run is a separate branch from that checkpoint'};
 inheritedEvidence.push({path:reportPath,sha256:hash(reportBytes)},{path:beforePath,sha256:hash(beforeBytes)},{path:reopenedPath,sha256:hash(reopenedBytes)},{path:core.source,sha256:hash(preparedBytes)});
 lineage=structuredClone(core.lineage);assert(lineage?.source&&lineage.sourceSha256);assert.equal(hash(await fs.readFile(lineage.source)),lineage.sourceSha256);
 const preparationBytes=await fs.readFile(lineage.preparationRecord);assert.equal(hash(preparationBytes),lineage.recordSha256,'inherited normal preparation record remains unchanged');inheritedEvidence.push({path:lineage.preparationRecord,sha256:hash(preparationBytes)});
}
if(resumed){
 assert(stage!=='prepare'&&batches===0,'prepared continuation begins with the accepted lesson in progress');
 const ancestor=arg('lineage-source'),recordPath=arg('preparation-record');assert(ancestor&&recordPath&&path.isAbsolute(ancestor)&&path.isAbsolute(recordPath));
 const ancestorBytes=await fs.readFile(ancestor),recordBytes=await fs.readFile(recordPath),record=JSON.parse(recordBytes),a=JSON.parse(ancestorBytes).state;
 assert.equal(record.sourceSha256,hash(ancestorBytes));assert.equal(record.preparedSha256,hash(bytes));assert.equal(record.preparedTick,original.state.worldTick);
 assert.deepEqual(original.state.homeMemberIds,a.homeMemberIds);for(const id of [MASTER,...a.homeMemberIds])assert.deepEqual(original.state.personsById[id].appearance,a.personsById[id].appearance);
 assert.equal(original.state.personsById[LIN].name,a.personsById[LIN].name);assert(original.state.worldTick>a.worldTick);
 assert(original.state.personsById[LIN].mind.learning.progress>=75&&original.state.personsById[LIN].mind.learning.progress<original.state.personsById[LIN].mind.learning.total);
 lineage={source:ancestor,sourceSha256:hash(ancestorBytes),sourceTick:a.worldTick,preparedSource:source,preparationRecord:recordPath,recordSha256:hash(recordBytes)};
}
const initial=structuredClone(original.state),run=restoreSect(original),geometry=restoreSect(original).state;
assert.equal(validateSect(run),true);assert(initial.personsById[LIN]);
assert.equal(initial.speed,0,'start from a naturally paused native checkpoint');assert.equal(original.courtyardPresentation?.manualPause,true,'native presentation retains the actual manual pause');
const sourceLesson=structuredClone(initial.personsById[LIN].mind.learning),originalLesson=structuredClone(inheritedCore?.originalLesson||sourceLesson);
assert.equal(originalLesson?.id,'qingguard');assert.equal(initial.personsById[LIN].artsById.qingguard.understanding,100);
await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});
if(lineage)await fs.copyFile(grown?lineage.preparationRecord:arg('preparation-record'),path.join(output,'inherited-preparation-lineage.json'));
if(inheritedCore){await fs.copyFile(inheritedCore.reportPath,path.join(output,'inherited-core-report.json'));await fs.writeFile(path.join(output,'inherited-core.json'),JSON.stringify(inheritedCore,null,2)+'\n');}
if(inheritedUi)await fs.writeFile(path.join(output,'inherited-ui.json'),JSON.stringify(inheritedUi,null,2)+'\n');
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
const write=(name,v)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(v,null,2)+'\n');
const started=performance.now(),wall=()=>Math.round((performance.now()-started))/1000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const actions=[],events=[],daily=[],preparation=[],errors=[],checkpoints=[],responseLimits=[];
const runtimeBefore=await runtimeHashes();let runtimeAfter,success=false,terminal,app,page,native,nativeClosed=null,nativeExact=null;
let completedLessonTick=inheritedCore?.completedLessonTick??null,maxLessonProgress=inheritedCore?.maxLessonProgress??originalLesson.progress,firstGrowth=structuredClone(inheritedCore?.firstGrowth||null),segmentGrowth=null,afterReopenXp=inheritedCore?.afterReopenXp??null,lastDay=initial.economy.day;
let lastEvidenceTick=initial.worldTick,firstCheckpointTick=grown?initial.worldTick:null,publicPanel=null;
const trace=async(event,data={})=>{const value={event,wallSeconds:wall(),...structuredClone(data)};events.push(value);await fs.appendFile(path.join(output,'events.jsonl'),JSON.stringify(value)+'\n');};
const brief=s=>{const p=s.personsById[LIN];return structuredClone({tick:s.worldTick,personId:LIN,name:p.name,realm:p.realm,xp:p.xp,energy:p.energy,wound:p.wound,learning:p.mind.learning,activity:p.mind.activity,reason:p.mind.reason,position:p.position,body:s.activitiesById[p.activityId]||null,food:s.stockpilesById[HOME].resources.food,starvation:s.economy.starvation});};
function physicalCultivation(s){
 const p=s.personsById[LIN],a=s.activitiesById[p.activityId],r=s.reservationsById[a?.reservationId];
 if(a?.kind!=='facility'||a.action!=='cultivate'||a.phase!=='executing'||r?.personId!==LIN||r.activityId!==a.id||r.slotId!==a.slotId)return null;
 // This scenario does not build, move, upgrade or demolish facilities.
 const slot=slotById(geometry,a.slotId);assert(slot&&slot.kind==='cultivate');
 assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04,'xp evidence requires the actual occupied cultivation station');
 return {slot,activity:a,reservation:r,position:p.position};
}
function monitor(s){
 assert.deepEqual(s.homeMemberIds,initial.homeMemberIds,'original residents remain in the same world');
 assert.equal(s.economy.starvation,0,'ordinary cultivation must retain daily food supply');
 const p=s.personsById[LIN],lesson=p.mind.learning;
 assert.equal(p.personId,LIN);assert.equal(p.name,initial.personsById[LIN].name);
 if(completedLessonTick===null){
  if(lesson){assert.equal(lesson.id,originalLesson.id,'finish the accepted lesson before a new course');assert(lesson.progress>=maxLessonProgress,'accepted progress must not restart');assert.equal(lesson.total,originalLesson.total);maxLessonProgress=lesson.progress;}
  else{assert(maxLessonProgress>originalLesson.progress,'the old course must have made real progress');completedLessonTick=s.worldTick;}
 }else if(lesson&&!lesson.research)assert(!['qingguard','qingwind'].includes(lesson.id),'a fully understood spell must not start another identical course');
 if(s.economy.day>lastDay){
  assert.equal(s.economy.day,lastDay+1,'sample every daily settlement');
  const day=s.economy.day,all=[MASTER,...s.homeMemberIds],meals=Object.values(s.factsById).filter(f=>f.kind==='site-meal-consumed'&&f.dayIndex===day-1&&all.includes(f.personId));
  const expectedFood=all.filter(id=>s.personsById[id].lifeStatus!=='dead').reduce((n,id)=>n+Math.max(0,2-meals.filter(f=>f.personId===id).length),0);
  const receipts=s.homeMemberIds.map(id=>s.factsById[`fact:person-daily-supply:${id}:${day}`]);
  assert(receipts.every(f=>f?.supplied&&f.sourceDay===day&&f.starvation===0),'every original disciple needs this exact day receipt');
  assert(Math.abs(s.economy.expense.food-expectedFood)<1e-9,'this ordinary path has one exact daily food debit after actual meal credits');
  daily.push(structuredClone({tick:s.worldTick,day,expectedFood,actualDayFoodExpense:s.economy.expense.food,homeFood:s.stockpilesById[HOME].resources.food,mealFacts:meals,receipts}));lastDay=day;
 }
 if(p.xp>initial.personsById[LIN].xp&&!segmentGrowth){
  assert(completedLessonTick!==null,'cultivation follows completion of the old lesson');const physical=physicalCultivation(s);assert(physical,'first growth must be measured while actually cultivating');
  segmentGrowth=structuredClone({...brief(s),physical});if(!firstGrowth)firstGrowth=structuredClone(segmentGrowth);
 }
}
let read=async()=>snapshotSect(run);
let send=async request=>{const result=commandSect(run,request);actions.push({tick:run.state.worldTick,request,result});assert(result.ok,result.error);};
let closePanels=async()=>{};
let pause=async value=>send({type:'pause',paused:value});
let contact=s=>developmentContact(s,s.personsById[LIN]).available;
let routeFinished=s=>!s.personsById[MASTER].scenic.path.length;
const masterCanWalk=s=>{const a=s.activitiesById[s.personsById[MASTER].activityId];return !a||a.kind==='facility'&&!a.serviceOrderId&&!a.serviceMealOrderId;};
let wait=async(predicate,label,{manual=false,tickLimit=maxTicks,returnAtLimit=false}={})=>{
 const begin=run.state.worldTick;for(let n=0;n<tickLimit;n++){
  monitor(run.state);if(predicate(run.state))return snapshotSect(run);
  if(manual&&n%100===0)await send({type:'manual'});advanceSect(run,.1);
  if(run.state.worldTick-lastEvidenceTick>=600){lastEvidenceTick=run.state.worldTick;await trace('progress',{label,sample:brief(run.state)});}
 }if(returnAtLimit){monitor(run.state);return snapshotSect(run);}throw Error(`bounded Node wait: ${label}, start=${begin}`);
};
let checkpoint=async name=>{
 await pause(true);const before=await read();validateSect(before);await write(name,before);
 const restored=restoreSect(before);assert.deepEqual(restored.state,before.state);Object.assign(run,restored);
 checkpoints.push({name,tick:before.state.worldTick,scope:'Node serialization round trip'});return before;
};
let inspectPublic=async()=>{
 await pause(true);await send({type:'manual'});await pause(false);await wait(masterCanWalk,'finish the master accepted task before approaching',{manual:true});await pause(true);
 for(let attempt=0;attempt<8&&!contact(run.state);attempt++){
  const person=inspectCourtyard(run).people.find(p=>p.id===LIN),target=person.location.focus||person.location;
  await send({type:'move',x:target.x,y:target.y});const movedAt=run.state.worldTick;await pause(false);await wait(s=>contact(s)||s.worldTick>=movedAt+10&&routeFinished(s),'normal public approach',{manual:true,tickLimit:150,returnAtLimit:true});await pause(true);await trace('approach-attempt',{attempt:attempt+1,startTick:movedAt,endTick:run.state.worldTick,contact:contact(run.state),sample:brief(run.state)});
 }
 assert(contact(run.state),'bounded actual nearby conversation required');const before=snapshotSect(run),member=viewSect(run).discipleDevelopment.members.find(m=>m.personId===LIN);
 assert.equal(member.cultivation?.xp,before.state.personsById[LIN].xp);assert(member.cultivation.required>0);assert.deepEqual(snapshotSect(run).state,before.state,'reading cultivation projection is read-only');
 publicPanel={scope:'Node public projection only',member:structuredClone(member),tick:before.state.worldTick,readOnlyExact:true};await write('public-cultivation',publicPanel);
};

try{
 if(stage==='desktop'){
  const {_electron}=await import('playwright'),target=desktopTarget(),directory=path.join(output,'world');
  await fs.mkdir(directory);native=path.join(directory,'sect-save.json');await fs.writeFile(native,bytes,{flag:'wx'});
  async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show']});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
  await launch();let publicContact=false,lastRoute=null;
  read=async()=>{const observation=await page.evaluate(id=>{const q=window.courtyardQA;return {session:q.snapshot(),contact:q.view().discipleDevelopment.members.find(m=>m.personId===id)?.contact.available===true,route:q.route()};},LIN);publicContact=observation.contact;lastRoute=worldRoute(observation.route);return observation.session;};
  contact=()=>publicContact;routeFinished=()=>!!lastRoute&&(!!lastRoute.failure||lastRoute.remaining===0&&!lastRoute.active);
  assert.deepEqual((await read()).state,initial,'native load must preserve canonical source fields before advancing');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true,'prepared native first screen remains paused');
  if(ui){assert.equal(lastRoute.remaining,inheritedUi.presentation.route.length);assert.equal(lastRoute.waypoints.length,inheritedUi.presentation.route.length);lastRoute.waypoints.forEach((p,i)=>assert(Math.hypot(p.x-inheritedUi.presentation.route[i].x,p.y-inheritedUi.presentation.route[i].y)<1e-7));const active=inheritedUi.presentation.activeWaypoint;assert(lastRoute.active);assert.equal(lastRoute.active.tick,active.tick);assert.equal(lastRoute.active.exit,active.exit);assert.equal(!!lastRoute.active.adjusted,!!active.adjusted);assert(Math.hypot(lastRoute.active.world.x-active.world.x,lastRoute.active.world.y-active.world.y)<1e-7);assert(Math.hypot(lastRoute.destination.x-inheritedUi.presentation.destination.x,lastRoute.destination.y-inheritedUi.presentation.destination.y)<1e-7);assert(!lastRoute.failure);inheritedUi.rendererRouteRestored=true;}
  closePanels=async()=>{for(const id of ['#dialog-close','#close-person','#close-management']){const l=page.locator(id);if(await l.isVisible())await l.click();}};
  const click=async selector=>{
   const l=page.locator(selector);await l.scrollIntoViewIfNeeded();assert(await l.isVisible(),selector+' must be visible');assert(await l.isEnabled(),selector+' must be enabled');
   const before=selector==='#approach-person'?await read():null,startedAt=performance.now();
   try{await l.click();}catch(error){
    if(selector!=='#approach-person'||error.name!=='TimeoutError'||!String(error.message).includes('performing click action'))throw error;
    const after=await read(),dom=await page.evaluate(()=>({closed:document.getElementById('dialog').hidden,route:window.courtyardQA.route()}));dom.route=worldRoute(dom.route);
    const target=inspectCourtyard(restoreSect(before)).people.find(p=>p.id===LIN)?.location,point=target?.focus||target,waypoint=dom.route.active?.world;
    const receipt=after.state.transactions.receipts.find(r=>{const [name,actor,args]=JSON.parse(r.signature);return Number(r.id.split(':').at(-1))>=before.state.transactions.nextCommandId&&name==='moveScenicMaster'&&actor===MASTER&&r.status==='committed'&&r.result===true&&waypoint&&Math.hypot(args[0]-waypoint.x,args[1]-waypoint.y)<1e-7;});
    if(!receipt||!dom.closed||dom.route.failure||!point||!dom.route.destination||Math.hypot(point.x-dom.route.destination.x,point.y-dom.route.destination.y)>1e-6)throw error;
    const limitation={selector,seconds:(performance.now()-startedAt)/1000,error:error.stack||String(error),receipt,route:dom.route,functionalCommandAccepted:true,responsivenessPassed:false};responseLimits.push(limitation);await trace('accepted-action-click-timeout',limitation);
   }
   actions.push({selector,tick:(await read()).state.worldTick});
  };
  pause=async value=>{await closePanels();return setPausedIdempotent({wanted:value,readStatus:()=>page.evaluate(()=>window.courtyardQA.status().manualPause),click:()=>click('#pause')});};
  send=async request=>{
   if(['manual','auto'].includes(request.type)){await click('#affairs');await click('[data-ui-key="affairs:policy"]');await click(`[data-ui-key="policy:${request.type}"]`);await click('#close-management');}
   else if(request.type==='harvest'){await click('#supply');await click('[data-ui-key="subtab:sources"]');await click('[data-ui-key="source:food"]');await click('[data-ui-key="source:harvest:food"]');await click('#close-management');}
   else if(request.type==='transport'){await click('#supply');await click('[data-ui-key="subtab:stocks"]');await page.locator('[data-ui-key="stocks:owner"]').selectOption('all');await click(`[data-ui-key="stock:${request.sourceStockpileId}"]`);await page.locator('[data-ui-key="stock:destination"]').selectOption(HOME);await click('[data-ui-key="stock:transfer:food"]');await page.locator('[data-ui-key="transfer:quantity"]').fill('16');await click('[data-ui-key="transfer:submit"]');await click('#close-management');}
   else throw Error('desktop request has no public-control adapter: '+request.type);
  };
  wait=async(predicate,label,{manual=false,tickLimit=maxTicks,returnAtLimit=false}={})=>{
   let lastManual=(await read()).state.worldTick;const begin=lastManual;
   for(;;){assert(wall()<maxWall,'native observation wall boundary');assert.deepEqual(errors,[]);const raw=await read(),s=raw.state;monitor(s);if(predicate(s))return raw;if(s.worldTick-begin>=tickLimit){if(returnAtLimit)return raw;throw Error('native world tick boundary: '+label);}
    if(manual&&s.worldTick-lastManual>=100){await pause(true);await send({type:'manual'});lastManual=(await read()).state.worldTick;await pause(false);}
    if(s.worldTick-lastEvidenceTick>=100){lastEvidenceTick=s.worldTick;await trace('progress',{label,sample:brief(s)});}await sleep(returnAtLimit?100:500);
   }
  };
  checkpoint=async name=>{
   await pause(true);const before=await read();validateSect(before);await write(name,before);
   await page.screenshot({path:path.join(output,name+'.png')});
   const saved=await saveNativePaused({pause,closeDialogs:closePanels,snapshot:async()=>{const raw=await read();return {manualPause:await page.evaluate(()=>window.courtyardQA.status().manualPause),tick:raw.state.worldTick,state:raw.state};},clickSave:()=>click('#save'),readNative:()=>fs.readFile(native),validate:raw=>validateSect(restoreSect(raw))});
   assert.deepEqual(saved.saved.state,before.state);await app.close();app=null;await launch();const after=await read();assert.deepEqual(after.state,before.state,'native save / close / reopen retains the entire canonical state');await write(name+'-reopened',after);
   checkpoints.push({name,tick:before.state.worldTick,nativeExact:true,scope:'macOS source Electron'});return after;
  };
  inspectPublic=async()=>{
   await pause(true);await send({type:'manual'});await pause(false);await wait(masterCanWalk,'finish the master accepted task before approaching',{manual:true});await pause(true);
   const open=async()=>{await closePanels();await click('#people');await click(`[data-ui-key="person:${LIN}"]`);await click(`[data-ui-key="person:inspect:${LIN}"]`);};
   for(let attempt=0;attempt<8;attempt++){
    let raw=await read();if(contact(raw.state))break;
    const continuing=!!lastRoute&&!lastRoute.failure&&!!lastRoute.destination&&(lastRoute.remaining>0||!!lastRoute.active);
    if(!continuing){await open();raw=await read();if(contact(raw.state))break;await click('#approach-person');}
    const movedAt=(await read()).state.worldTick;await pause(false);
    await wait(s=>contact(s)||s.worldTick>=movedAt+10&&routeFinished(s),'normal public approach',{manual:true,tickLimit:150,returnAtLimit:true});await pause(true);const stopped=await read();await trace('approach-attempt',{attempt:attempt+1,startTick:movedAt,endTick:stopped.state.worldTick,contact:contact(stopped.state),route:lastRoute,sample:brief(stopped.state)});
   }
   await open();const before=await read();assert(contact(before.state),'bounded public progress requires actual formal contact');
   const node=page.locator('[data-ui-key="person:cultivation-progress"]');await node.scrollIntoViewIfNeeded();assert(await node.isVisible(),'actual cultivation progress must be visible');
   const member=await page.evaluate(id=>window.courtyardQA.view().discipleDevelopment.members.find(m=>m.personId===id),LIN),text=await node.innerText();
   assert.equal(member.cultivation?.xp,before.state.personsById[LIN].xp);assert(text.includes(String(Math.round(member.cultivation.xp*10)/10)+' / '+member.cultivation.required));
   assert(text.includes('灵石')&&text.includes('尚缺'),'material shortfall is visible without starting an unprepared breakthrough');
   await sleep(800);const after=await read();assert.deepEqual(after.state,before.state,'paused dialogue reading does not advance any world state');
   await page.screenshot({path:path.join(output,'public-cultivation.png')});publicPanel={scope:'macOS source Electron, visible native DOM',tick:before.state.worldTick,text,member,readOnlyExact:true};await write('public-cultivation',publicPanel);await closePanels();
  };
 }
 await pause(true);await trace('source',{sourceSha256:hash(bytes),sample:brief(initial),sourceLesson,originalLesson,inheritedCore,sourcePolicy:original.policy,sourceControl:original.control});
 for(let batch=1;batch<=batches;batch++){
  await send({type:'manual'});let s=(await read()).state,a=s.activitiesById[s.personsById[MASTER].activityId];
  assert(!a||a.kind==='sr-harvest'&&a.resource==='food','preparation preserves an already accepted body task');
  if(!a){await send({type:'harvest',resource:'food'});s=(await read()).state;a=s.activitiesById[s.personsById[MASTER].activityId];}
  assert(a?.kind==='sr-harvest'&&a.resource==='food'&&a.reservedQuantity===16);const id=a.id,fid='fact:manual-harvest:'+id;
  await pause(false);await wait(s=>!!s.factsById[fid],'physical food harvest '+batch,{manual:true});await pause(true);
  s=(await read()).state;const harvest=s.factsById[fid];assert.equal(harvest.quantity,16);assert.equal(harvest.actorId,MASTER);
  let order=Object.values(s.workOrdersById).find(o=>o.kind==='transport'&&o.carrierId===MASTER&&o.sourceStockpileId===CARRIED&&o.targetStockpileId===HOME&&o.cargo.food===16&&o.startedTick>=harvest.atTick&&['to-source','carrying','delivered'].includes(o.phase));
  const continued=!!order;if(!order){await send({type:'transport',sourceStockpileId:CARRIED,targetStockpileId:HOME,cargo:{food:16}});s=(await read()).state;order=s.workOrdersById[s.activitiesById[s.personsById[MASTER].activityId].workOrderId];}
  const orderId=order.id;assert.equal(order.cargo.food,16);await pause(false);await wait(s=>s.workOrdersById[orderId].phase==='delivered','physical food delivery '+batch,{manual:true});await pause(true);
  s=(await read()).state;const receipts=Object.values(s.factsById).filter(f=>f.operation==='delivery'&&f.workOrderId===orderId);assert.equal(receipts.length,1);assert.equal(receipts[0].targetStockpileId,HOME);assert.deepEqual(receipts[0].quantities,{food:16});
  preparation.push(structuredClone({batch,continued,harvest,order:s.workOrdersById[orderId],delivery:receipts[0],sample:brief(s)}));await write('preparation',preparation);
 }
 if(!ui){await send({type:'auto'});await pause(false);}
 if(stage==='prepare'){
  await wait(s=>{const l=s.personsById[LIN].mind.learning;return l?.id===originalLesson.id&&l.progress>=75&&l.progress<l.total;},'normal preparation leaves the accepted lesson near completion');
  await pause(true);terminal=await read();validateSect(terminal);assert.equal(terminal.state.personsById[LIN].xp,initial.personsById[LIN].xp);assert.equal(terminal.state.economy.starvation,0);assert.equal(terminal.state.speed,0);assert.equal(terminal.courtyardPresentation?.manualPause,true);assert.deepEqual(restoreSect(terminal).state,terminal.state,'prepared canonical session restores exactly');
  const preparedBytes=JSON.stringify(terminal,null,2)+'\n';await fs.writeFile(path.join(output,'prepared.json'),preparedBytes);
  const preparedState=restoreSect(terminal).state,breakthrough=breakthroughView(preparedState,LIN),materials=Object.entries(breakthrough.cost).map(([id,required])=>({id,required,available:preparedState.resources[id]||0}));
  await write('preparation-lineage',{scope:'Node public-command preparation; native core remains unverified',source,sourceSha256:hash(bytes),sourceTick:initial.worldTick,preparedSha256:hash(preparedBytes),preparedTick:terminal.state.worldTick,breakthrough:{conditions:breakthrough.locks,materials},preparation,daily,actions});success=true;
 }else{
 if(!grown){
 await wait(s=>!!segmentGrowth&&physicalCultivation(s)&&s.personsById[LIN].xp>initial.personsById[LIN].xp,'old lesson completes, then autonomous cultivation gains xp');
 const midway=await checkpoint('cultivating');firstCheckpointTick=midway.state.worldTick;afterReopenXp=midway.state.personsById[LIN].xp;
 }
 if(!ui){await pause(false);await wait(s=>s.personsById[LIN].xp>afterReopenXp&&daily.some(d=>d.tick>firstCheckpointTick),'continued cultivation and a subsequent actual daily settlement');}
 await inspectPublic();
 terminal=await checkpoint('terminal');monitor(terminal.state);
 const restored=restoreSect(terminal),s=terminal.state,p=s.personsById[LIN];
 if(grown){assert(completedLessonTick<initial.worldTick);assert.equal(sourceLesson,null);if(!ui)assert(segmentGrowth,'new branch needs its own physical cultivation growth');assert.equal(checkpoints.length,1);}else{assert(completedLessonTick>initial.worldTick);assert.equal(checkpoints.length,2);}
 assert(firstGrowth&&firstGrowth.tick>=completedLessonTick);if(!ui){assert(p.xp>afterReopenXp);assert(daily.length);}
 assert.deepEqual(p.appearance,initial.personsById[LIN].appearance);assert.deepEqual(s.residentialHousing.recordsByPersonId[LIN].home,initial.residentialHousing.recordsByPersonId[LIN].home);
 await write('outcomes',{inheritedCore,inheritedUi,sourceLesson,originalLesson,maxLessonProgress,completedLessonTick,firstGrowth,segmentGrowth,afterReopenXp,terminal:brief(s),publicPanel,breakthrough:{scope:'read-only diagnostic of actual terminal rules',...breakthroughView(restored.state,LIN)},daily,preparation,checkpoints});success=true;
 }
}catch(error){errors.push(error.stack||String(error));process.exitCode=1;try{await pause(true);const raw=await read();await write('failure',raw);if(page)await page.screenshot({path:path.join(output,'failure.png')});}catch(error){errors.push('failure preservation: '+error.message);}}
finally{
 if(app){const process=app.process();await app.close();for(let n=0;n<100&&process.exitCode===null&&process.signalCode===null;n++)await sleep(100);nativeClosed=process.exitCode!==null||process.signalCode!==null;app=null;}
 if(native&&terminal)nativeExact=JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(terminal.state);
 runtimeAfter=await runtimeHashes();const runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter),sourceUnchanged=hash(await fs.readFile(source))===hash(bytes),lineageSourceUnchanged=!lineage||hash(await fs.readFile(lineage.source))===lineage.sourceSha256;
 const inheritedEvidenceUnchanged=(await Promise.all(inheritedEvidence.map(async f=>hash(await fs.readFile(f.path))===f.sha256))).every(Boolean);
 if(!runtimeUnchanged||!sourceUnchanged||!lineageSourceUnchanged||!inheritedEvidenceUnchanged||stage==='desktop'&&(!nativeClosed||!nativeExact)){success=false;process.exitCode=1;errors.push('source/runtime/native finalization invariant failed');}
 await write('report',{success,functionalSuccess:success,stage,resumeGrown:grown&&!ui,resumeUI:ui,inheritedCore,inheritedUi,inheritedEvidenceUnchanged,lineage,lineageSourceUnchanged,
  scope:ui?'macOS source Electron public UI and final native save/reopen continuation; growth and paid daily supply inherited from the failed prior segment':grown?(stage==='node'?'Node rehearsal of a new branch from the attested native growth checkpoint':'macOS source Electron new branch from the attested native growth checkpoint'):stage==='prepare'?'Node public-command preparation only':stage==='node'?'Node normal-path rehearsal':'macOS source Electron core continuation',
  source,sourceSha256:hash(bytes),sourceUnchanged,runtimeUnchanged,runtimeBefore,runtimeAfter,nativeClosed,nativeExact,firstCheckpointTick,completedLessonTick,maxLessonProgress,firstGrowth,segmentGrowth,afterReopenXp,terminalTick:terminal?.state.worldTick,publicPanel,checkpoints,preparation,daily,actions,errors,wallSeconds:wall(),
  responsivenessPassed:false,responsePerformance:{verified:false,currentClickTimeouts:responseLimits,inheritedClickTimeouts:inheritedUi?.errors.filter(e=>e.includes('locator.click: Timeout'))||[]},limits:{maxTicks,maxWall,approachTickLimit:150,approachAttempts:8},
  proofChecks:{originalCourseMadeProgress:maxLessonProgress>originalLesson.progress,originalCourseCompleted:completedLessonTick!==null,actualCultivationStation:!!firstGrowth?.physical,
   ...(ui?{inheritedNativeSegmentGrowth:!!inheritedUi.growth.physical,inheritedPaidDailySupply:inheritedUi.daily.length>0,rendererRouteRestored:inheritedUi.rendererRouteRestored===true}:{newSegmentPhysicalGrowth:!!segmentGrowth?.physical,xpContinuesAfterReopen:!!terminal&&afterReopenXp!==null&&terminal.state.personsById[LIN].xp>afterReopenXp,paidDailySupply:daily.length>0&&daily.every(d=>Math.abs(d.actualDayFoodExpense-d.expectedFood)<1e-9&&d.receipts.every(f=>f.supplied))}),
   sameResidentIdentity:!!terminal&&terminal.state.personsById[LIN].personId===LIN,publicReadOnlyExact:!!publicPanel?.readOnlyExact,...(grown?{finalSaveReopen:checkpoints.length===1&&checkpoints[0].name==='terminal'}:{twoSaveReopens:checkpoints.length===2})}});
 console.log(JSON.stringify({success,stage,output,completedLessonTick,firstGrowthTick:firstGrowth?.tick,terminalTick:terminal?.state.worldTick,errors}));
}
