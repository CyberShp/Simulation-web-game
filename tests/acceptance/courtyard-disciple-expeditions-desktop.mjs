/** Native-source preflight; Electron runs are serialized by the root agent.
 * --source=/absolute/sect-save.json --output=/absolute/fresh-directory
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,commandSect,validateSect,advanceSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=option('source'),output=option('output');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output),'absolute source/output required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'QA output belongs outside repository');
const bytes=await fs.readFile(source),raw=JSON.parse(bytes),session=restoreSect(raw);let s=session.state;
assert.equal(validateSect(session),true);
const resources=structuredClone(s.stockpilesById['stockpile:yunxiu']),initialWorkerWood=s.stockpilesById['stockpile:building:yunxiu:12'].resources.wood;
const recovery=option('resume')?{ok:true,message:'resume preserved public checkpoint'}:commandSect(session,{type:'toggle-building',buildingId:'building:yunxiu:12'});
assert.equal(recovery.ok,true,recovery.error);
const invitation=option('resume')?{ok:true,result:{accepted:true}}:commandSect(session,{type:'invite-work',personId:'person:yunxiu:71',buildingId:'building:yunxiu:12'});
assert.equal(invitation.ok,true,invitation.error);
assert.equal(invitation.result.accepted,true);s=session.state;
assert.deepEqual(s.stockpilesById['stockpile:yunxiu'],resources,'public preparation does not inject or consume stock');
let resumePauseReceipt=null;
if(option('resume')){const before=structuredClone(session.state);resumePauseReceipt=commandSect(session,{type:'pause',paused:true});assert.equal(resumePauseReceipt.ok,true,resumePauseReceipt.error);s=session.state;assert.equal(s.worldTick,before.worldTick,'pause must not advance captured world');assert.deepEqual(s.personsById,before.personsById,'pause must preserve every captured person');assert.deepEqual(s.stockpilesById,before.stockpilesById,'pause must preserve captured resources');assert.deepEqual(s.discipleExpeditions,before.discipleExpeditions,'pause must preserve captured journey');}
const preparedState=structuredClone(session.state);
const report={source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),tick:s.worldTick,target:desktopTarget(),preparation:[recovery,invitation,...(resumePauseReceipt?[resumePauseReceipt]:[])],members:s.homeMemberIds.map(id=>{const p=s.personsById[id];return{id,name:p.name,realm:p.realm,wound:p.wound,energy:p.energy,goal:p.mind.goal,job:p.job,phase:p.schedule.phase};}),scope:option('stage')==='node'?'normal source public commands and simulated world steps':option('stage')==='desktop'?'native Electron public UI and real elapsed time':'public-command preflight',requiredEndpoints:['voluntary preparation and physical gate departure','finite valley resources and risk decision','retained worker production and daily supply','mid-route native close/reopen','return report and unique settlement after reopen']};
await fs.mkdir(output,{recursive:false});
await fs.writeFile(path.join(output,'source.json'),bytes,{flag:'wx'});
await fs.writeFile(path.join(output,'preflight.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await fs.writeFile(path.join(output,'normal-source-prepared.json'),JSON.stringify(session)+'\n',{flag:'wx'});
console.log(JSON.stringify({source,sourceSha256:report.sourceSha256,tick:report.tick,preparation:report.preparation}));

if(option('stage')==='node'){
 const command=request=>{const r=commandSect(session,request);assert.equal(r.ok,true,r.error);return r;};
 command({type:'disciple-expeditions',enabled:true});command({type:'pause',paused:false});s=session.state;
 const seen=new Set(),trail=[],started=performance.now();let last,completed=false,workerProgress=false;
 try{for(let i=0;i<12000;i++){
  advanceSect(session,.1);s=session.state;
  if(i%100===0)await fs.writeFile(path.join(output,'active.json'),JSON.stringify({iteration:i,tick:s.worldTick,expeditions:s.discipleExpeditions,people:s.homeMemberIds.map(id=>({id,scenic:s.personsById[id].mind.scenic,activity:s.personsById[id].activityId}))}));
  const j=s.discipleExpeditions?.journeys?.[0];
  const order=s.workOrdersById['work:production:building:yunxiu:12'];
  workerProgress ||= !!order?.progressTicks || s.personsById['person:yunxiu:71'].mind.skills.industry>1.77;
  if(j?.phase==='valley-return'){assert(j.encounter?.personId,'encounter must identify an actual person');assert(j.encounter.observedTick<=s.worldTick);assert.equal(j.retreated,true);assert.equal(j.encounter.risk,'high');}
  if(j&&j.phase!==last){if(j.phase==='approach'){const p=s.personsById[j.personId],supply=s.stockpilesById['stockpile:yunxiu'].position;assert(Math.hypot(p.position.x-supply.x,p.position.y-supply.y)<2,'preparation must collect food at the real public stock');}last=j.phase;seen.add(last);validateSect(session);assert.deepEqual(restoreSect(snapshotSect(session)).state,s);
   const checkpoint={tick:s.worldTick,phase:last,journey:structuredClone(j),person:structuredClone(s.personsById[j.personId]),worker:structuredClone(s.personsById['person:yunxiu:71']),order:structuredClone(order),resources:structuredClone(s.resources)};
   trail.push(checkpoint);await fs.writeFile(path.join(output,`phase-${last}.json`),JSON.stringify(snapshotSect(session))+'\n');console.log('PHASE',last,s.worldTick);
  }
  if(j?.phase==='returned'){completed=true;command({type:'disciple-expeditions',enabled:false});s=session.state;const current=s.discipleExpeditions.journeys[0],herb=s.resources.herb,xp=s.personsById[current.personId].xp,delivery=structuredClone(current.delivered);for(let n=0;n<20;n++)advanceSect(session,.1);s=session.state;const after=s.discipleExpeditions.journeys[0];assert.equal(s.personsById[after.personId].xp,xp);assert.deepEqual(after.delivered,delivery);assert.equal(after.cargo.herb,0);assert.equal(s.resources.herb,herb);break;}
 }
 assert(completed,'first voluntary journey did not complete');assert(workerProgress,'retained worker did not progress');assert(s.stockpilesById['stockpile:building:yunxiu:12'].resources.wood>initialWorkerWood,'retained worker must actually produce lumber');for(const phase of ['preparing','approach','outbound','exploring','scouting','returning','delivery','returned'])assert(seen.has(phase)||option('resume')&&['preparing','approach'].includes(phase),`missing ${phase}`);
 }finally{await fs.writeFile(path.join(output,'node-trail.json'),JSON.stringify({completed,workerProgress,sourceSha256:report.sourceSha256,sourceUnchanged:Buffer.compare(await fs.readFile(source),bytes)===0,wallSeconds:(performance.now()-started)/1000,trail},null,2));await fs.writeFile(path.join(output,'node-final.json'),JSON.stringify(snapshotSect(session))+'\n');}
}
if(option('stage')==='desktop'){
 const {_electron}=await import('playwright');const target=desktopTarget(),directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');
 await fs.mkdir(directory);await fs.writeFile(native,JSON.stringify(session));
 let app,page,success=false;const errors=[],seen=new Set(),started=performance.now();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show']});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
 const read=()=>page.evaluate(()=>window.courtyardQA.snapshot());
 async function pause(wanted){if(await page.evaluate(()=>window.courtyardQA.status().manualPause)!==wanted)await page.locator('#pause').click();}
 async function save(name){await pause(true);const raw=await read();validateSect(raw);await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(raw));await page.screenshot({path:path.join(output,name+'.png')});await page.locator('#save').click();for(let i=0;i<100;i++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(raw.state))return raw;await sleep(100);}throw Error('native save did not flush');}
 async function reopen(name){const before=await save(name+'-before');await app.close();await launch();const after=await read();assert.deepEqual(after.state,before.state,'native reopen must preserve complete world');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true);await fs.writeFile(path.join(output,name+'-reopened.json'),JSON.stringify(after));}
 try{await launch();await pause(true);if(option('resume')){const resumed=await read();assert.deepEqual(resumed.state,preparedState,'resume launch preserves the publicly paused preparation exactly');assert.equal(resumed.state.worldTick,raw.state.worldTick);assert.deepEqual(resumed.state.personsById,raw.state.personsById);assert.deepEqual(resumed.state.stockpilesById,raw.state.stockpilesById);await fs.writeFile(path.join(output,'resume-payload.json'),JSON.stringify({sourceSha256:report.sourceSha256,tick:resumed.state.worldTick,journey:resumed.state.discipleExpeditions?.journeys?.[0],policyEnabled:resumed.state.discipleExpeditions?.enabled},null,2));await reopen('resumed-preparation');}const enabled=await page.evaluate(()=>window.courtyardQA.snapshot().state.discipleExpeditions?.enabled===true);if(!enabled){await page.locator('#affairs').click();await page.locator('[data-ui-key="disciple-expeditions-policy"]').click();await page.locator('#close-management').click();}await pause(false);
 let mid=false,returned=false;
 for(let sample=0;sample<1200;sample++){
  await sleep(3000);const raw=await read(),j=raw.state.discipleExpeditions?.journeys?.[0];if(!j)continue;
  if(!seen.has(j.phase)){const people=await page.evaluate(()=>window.courtyardQA.view().people),body=people.find(p=>p.id===j.personId);if(['preparing','approach','delivery','returned'].includes(j.phase))assert(body,`in-courtyard traveler missing from public people during ${j.phase}`);if(j.phase==='approach'){assert.equal(!!body.indoor,false,'departure on courtyard road must be outdoors');assert(body.moving||body.path?.length>0,'departure must expose real body movement');}if(['outbound','exploring','scouting','valley-return','returning'].includes(j.phase))assert.equal(body,undefined,'traveler outside courtyard must not remain in courtyard people');seen.add(j.phase);await fs.writeFile(path.join(output,'public-people-'+j.phase+'.json'),JSON.stringify({tick:raw.state.worldTick,people}));await fs.writeFile(path.join(output,'observed-'+j.phase+'.json'),JSON.stringify(raw));await page.screenshot({path:path.join(output,'observed-'+j.phase+'.png')});console.log('DESKTOP PHASE',j.phase,raw.state.worldTick);}
  if(!mid&&j.phase==='outbound'){await reopen('mid-route');mid=true;await pause(false);}
  if(j.phase==='returned'){await pause(true);await page.locator('#affairs').click();await page.getByText('归来汇报',{exact:true}).scrollIntoViewIfNeeded();await fs.writeFile(path.join(output,'returned-public-panel.txt'),await page.locator('#management-body').innerText());await page.screenshot({path:path.join(output,'returned-public-report.png')});await page.locator('[data-ui-key="disciple-expeditions-policy"]').click();await page.locator('#close-management').click();await reopen('returned');returned=true;break;}
 }
 assert(mid,'outbound native checkpoint missing');assert(returned,'no returned journey');const before=await read(),j=before.state.discipleExpeditions.journeys[0];assert(j.encounter?.personId);assert(j.encounter.observedTick<=j.completedTick);assert.equal(j.retreated,true);await pause(false);await sleep(5000);await pause(true);const after=await save('terminal');assert.deepEqual(after.state.discipleExpeditions.journeys[0].delivered,j.delivered);assert.equal(after.state.personsById[j.personId].xp,before.state.personsById[j.personId].xp);assert.equal(after.state.discipleExpeditions.journeys.length,1);assert(after.state.stockpilesById['stockpile:building:yunxiu:12'].resources.wood>initialWorkerWood,'retained worker must actually produce lumber');assert.deepEqual(errors,[]);success=true;
 }catch(error){const message=String(error.message||error);errors.push(message.slice(0,2000));process.exitCode=1;console.error('DESKTOP FAIL '+message.slice(0,2000));if(page){try{await fs.writeFile(path.join(output,'failure-snapshot.json'),JSON.stringify(await read()));await fs.writeFile(path.join(output,'failure-status.json'),JSON.stringify(await page.evaluate(()=>window.courtyardQA.status()),null,2));await page.screenshot({path:path.join(output,'failure.png'),timeout:30000});}catch(captureError){errors.push('failure evidence: '+String(captureError.message).slice(0,1000));}}}
 finally{await fs.writeFile(path.join(output,'desktop-result.json'),JSON.stringify({success,sourceSha256:report.sourceSha256,sourceUnchanged:Buffer.compare(await fs.readFile(source),bytes)===0,wallSeconds:(performance.now()-started)/1000,phases:[...seen],errors,initialWorkerWood,terminalWorkerWood:app?(await read()).state.stockpilesById['stockpile:building:yunxiu:12'].resources.wood:null,retainedWorker:app?((await read()).state.personsById['person:yunxiu:71']):null},null,2));if(app)await app.close();}
}
