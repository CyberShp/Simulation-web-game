/** Prepare one continuous four-site world through public simulation commands.
 * node tests/acceptance/prepare-west-valley-checkpoint.mjs --source=/absolute/source.json --output=/absolute/new-directory
 * Snapshots are paused desktop sessions. Advancement uses the shared simulation
 * clock; the report records simulated time separately from elapsed tool time.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';

const option = key => {
 const prefix=`--${key}=`, inline=process.argv.find(value=>value.startsWith(prefix));
 if(inline)return inline.slice(prefix.length);
 const index=process.argv.indexOf(`--${key}`);return index<0?undefined:process.argv[index+1];
};
const source=option('source'),output=option('output');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output),'--source and --output must be absolute paths');
const repository=await fs.realpath(fileURLToPath(new URL('../..',import.meta.url)));
const outputParent=await fs.realpath(path.dirname(output)),resolvedOutput=path.join(outputParent,path.basename(output));
assert(resolvedOutput!==repository&&!resolvedOutput.startsWith(repository+path.sep),'--output must be outside the repository');
assert(path.basename(resolvedOutput)!=='.'&&path.basename(resolvedOutput)!=='..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceBytes=await fs.readFile(source),sourceSha256=hash(sourceBytes),original=JSON.parse(sourceBytes),session=restoreSect(original);
assert.equal(session.provenance.kind,'normal-public-command-checkpoint','source must retain normal public-command provenance');
assert.deepEqual(session.state,original.state,'source state must already be canonical');
let state=session.state;
const sourceTick=state.worldTick,initialJade=state.stockpilesById['stockpile:yunxiu'].resources.jade;
const trace=[],checkpoints=[],started=performance.now(),HOME='stockpile:yunxiu',MASTER='person:master';
const siteIds=[17,24,18,19].map(number=>`site:domain:gc-${number}`);
for(const id of siteIds)assert(!state.buildings.some(building=>building.domainSiteId===id),`source already contains ${id}`);
assert(!state.claimed.includes('quarry'),'source quarry reward must be unclaimed');
await fs.mkdir(resolvedOutput);
await fs.writeFile(path.join(resolvedOutput,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
const copy=value=>structuredClone(value);
const stockView=()=>Object.fromEntries(Object.entries(state.stockpilesById).map(([id,stock])=>[id,{ownerId:stock.ownerId,custodianId:stock.custodianId,capacity:stock.capacity,resources:copy(stock.resources),...(stock.pills?{pills:copy(stock.pills)}:{})}]));
const metrics=()=>({worldTick:state.worldTick,publicResources:copy(state.stockpilesById[HOME].resources),finiteSources:Object.fromEntries(Object.entries(state.srEconomy.patches).map(([key,value])=>[key,value.remaining])),stocks:stockView()});
function changes(before,after){
 const result={};
 for(const id of new Set([...Object.keys(before.stocks),...Object.keys(after.stocks)])){
  const from=before.stocks[id],to=after.stocks[id];if(JSON.stringify(from)===JSON.stringify(to))continue;
  result[id]={before:from||null,after:to||null,resourceDelta:Object.fromEntries(Object.keys(SIM.RESOURCES).map(key=>[key,(to?.resources?.[key]||0)-(from?.resources?.[key]||0)]).filter(([,quantity])=>quantity!==0))};
 }
 return result;
}
function record(entry,before){
 const after=metrics();const item={index:trace.length+1,...entry,fromTick:before.worldTick,toTick:after.worldTick,publicBefore:before.publicResources,publicAfter:after.publicResources,finiteSourcesBefore:before.finiteSources,finiteSourcesAfter:after.finiteSources,inventoryChanges:changes(before,after)};
 trace.push(item);console.log(JSON.stringify({index:item.index,kind:item.kind,name:item.name||item.label,fromTick:item.fromTick,toTick:item.toTick,publicAfter:item.publicAfter,result:item.result}));return item;
}
function command(name,...args){
 const before=metrics();
 try{const response=SIM.dispatchCommand(state,{name,args});state=response.state;record({kind:'command',name,args,result:copy(response.result??null)},before);return response.result;}
 catch(error){record({kind:'command',name,args,error:error.message},before);throw error;}
}
function until(predicate,label,maxTicks=10000){
 const before=metrics();let steps=0;
 while(!predicate(state)&&steps<maxTicks){SIM.tick(state,.1);steps++;}
 record({kind:'advance',label,steps,simulatedSeconds:steps/10,reached:predicate(state)},before);
 assert(predicate(state),`${label}: unfinished after ${steps} shared world steps`);
}
async function checkpoint(label,{resume=true}={}){
 command('setSpeed',0);
 const canonical=SIM.validateSave(state);assert.deepEqual(canonical,state,`${label}: exact simulation reload`);
 const snapshot={...copy(session),state:copy(state),control:copy(state.masterControl),provenance:{kind:'normal-public-command-checkpoint',label,source,sourceSha256,sourceProvenance:copy(original.provenance),stateSha256:hash(JSON.stringify(state)),counts:{commands:trace.filter(entry=>entry.kind==='command').length,worldTick:state.worldTick,simulatedSeconds:(state.worldTick-sourceTick)/10},trace:copy(trace)}};
 assert.equal(validateSect(snapshot),true);assert.deepEqual(restoreSect(snapshot).state,state,`${label}: exact desktop reload`);
 const filename=`${label}.json`;await fs.writeFile(path.join(resolvedOutput,filename),JSON.stringify(snapshot)+'\n',{flag:'wx'});
 checkpoints.push({label,filename,worldTick:state.worldTick,stateSha256:snapshot.provenance.stateSha256,publicResources:copy(state.stockpilesById[HOME].resources)});
 if(resume)command('setSpeed',1);return snapshot;
}
function builtAt(siteId){return state.buildings.find(building=>building.domainSiteId===siteId);}
async function finishBuild(siteId,label){
 const result=command('buildDomainSite',siteId);
 until(s=>!s.workOrdersById[result.workOrderId],`${label} construction complete`);
 assert(builtAt(siteId));return builtAt(siteId);
}
function deliverCarriedWood(quantity){
 const result=command('startTransport','stockpile:carried:master',HOME,MASTER,{wood:quantity});
 until(s=>s.workOrdersById[result.id]?.phase==='delivered',`deliver ${quantity} gathered wood`);
}

let complete=false,failure=null;
try{
 await checkpoint('00-source');
 for(const name of ['enableSectDomain','enableCourtyardTerrain','enableWestValley'])command(name);
 await checkpoint('01-gc17-before-build');
 const quarryOrder=command('buildDomainSite',siteIds[0]);
 until(s=>s.workOrdersById[quarryOrder.workOrderId]?.materialFlow?.phase==='carrying'&&s.master.scenic.x< -25,'GC17 materials enter the valley');
 await checkpoint('02-gc17-carrying');
 until(s=>(s.workOrdersById[quarryOrder.workOrderId]?.progressTicks||0)>=30,'GC17 actual construction');
 await checkpoint('03-gc17-building');
 until(s=>!s.workOrdersById[quarryOrder.workOrderId],'GC17 construction complete');
 assert(builtAt(siteIds[0]));command('claim','quarry');
 command('toggleBuilding',builtAt(siteIds[0]).id);
 assert.equal(builtAt(siteIds[0]).enabled,false);await checkpoint('04-gc17-claimed');
 for(let batch=0;batch<3;batch++){
  const result=command('startMasterHarvest','wood');until(s=>!s.activitiesById[result.id],`gather wood batch ${batch+1}`);
 }
 deliverCarriedWood(36);
 const fourth=command('startMasterHarvest','wood');until(s=>!s.activitiesById[fourth.id],'gather wood batch 4');deliverCarriedWood(12);
 await finishBuild(siteIds[1],'GC24');await checkpoint('05-gc24-complete');
 await finishBuild(siteIds[2],'GC18');await checkpoint('06-gc18-complete');
 await finishBuild(siteIds[3],'GC19');
 for(const id of siteIds.slice(2)){
  const building=builtAt(id);assert.equal(state.stockpilesById[`stockpile:${building.instanceId}`].resources.food,0);
  assert(!state.workOrdersById[`work:production:${building.instanceId}`]?.crop,'field has not been sown');
 }
 assert.equal(state.claimed.filter(id=>id==='quarry').length,1);
 await checkpoint('07-four-sites-unseeded',{resume:false});complete=true;
}catch(error){failure=error.stack;console.error(failure);process.exitCode=1;}
finally{
 const sourceSha256After=hash(await fs.readFile(source)),sourceUnchanged=sourceSha256===sourceSha256After;
 if(!sourceUnchanged){complete=false;process.exitCode=1;failure=[failure,'Source SHA-256 changed during preparation'].filter(Boolean).join('\n');}
 await fs.writeFile(path.join(resolvedOutput,'trace.json'),JSON.stringify(trace,null,2)+'\n');
 await fs.writeFile(path.join(resolvedOutput,'report.json'),JSON.stringify({status:complete?'passed':'failed',scope:'Public simulation commands and shared world steps; desktop session checkpoints for subsequent UI validation.',source,sourceSha256Before:sourceSha256,sourceSha256After,sourceUnchanged,sourceTick,finalTick:state.worldTick,simulatedSeconds:(state.worldTick-sourceTick)/10,elapsedToolSeconds:(performance.now()-started)/1000,initialJade,finalPublicResources:state.stockpilesById[HOME].resources,completedSites:siteIds.filter(id=>builtAt(id)),checkpoints,commandCount:trace.filter(entry=>entry.kind==='command').length,failure},null,2)+'\n');
 console.log(`Evidence: ${resolvedOutput}`);
}
