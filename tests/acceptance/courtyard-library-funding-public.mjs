/** U-167 / designs 63-64: fund GC16 and GC02 through public commands.
 * node tests/acceptance/courtyard-library-funding-public.mjs --source=/absolute/session.json --output=/absolute/new-directory
 * Node shared-world-step evidence. Its simulated time is separate from desktop
 * wall-clock acceptance; all source snapshots and failed attempts are retained.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import {localMarketQuote,HARVEST_BATCH} from '../../src/simulation/ea-sr-economy.mjs';
import {buildingAccess} from '../../src/simulation/ea-scene-geometry.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';

const option=key=>{const prefix=`--${key}=`,inline=process.argv.find(v=>v.startsWith(prefix));if(inline)return inline.slice(prefix.length);const i=process.argv.indexOf(`--${key}`);return i<0?undefined:process.argv[i+1];};
const source=option('source'),output=option('output');
const resumeFrom=option('resume-from'),transitionPath=option('runtime-transition');
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output),'absolute --source and --output are required');
const repository=await fs.realpath(fileURLToPath(new URL('../..',import.meta.url)));
await fs.mkdir(path.dirname(output),{recursive:true});const outputRoot=path.join(await fs.realpath(path.dirname(output)),path.basename(output));
assert(outputRoot!==repository&&!outputRoot.startsWith(repository+path.sep),'evidence belongs outside the repository');
await fs.mkdir(outputRoot);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),copy=x=>JSON.parse(JSON.stringify(x));
const bytes=await fs.readFile(source),sourceSha256=hash(bytes),original=JSON.parse(bytes),session=restoreSect(original);
assert.equal(session.provenance.kind,'normal-public-command-checkpoint');assert.deepEqual(copy(session.state),original.state,'source is already canonical');
let resume=null,runtimeTransition=null;
if(resumeFrom){
 assert(path.isAbsolute(resumeFrom)&&source===path.join(resumeFrom,'failure-state.json'),'resume uses the preceding actual failed world');
 const priorBytes=await fs.readFile(path.join(resumeFrom,'report.json')),prior=JSON.parse(priorBytes),sealBytes=await fs.readFile(path.join(resumeFrom,'failure-sealed-readback.json')),seal=JSON.parse(sealBytes);
 assert.equal(prior.status,'failed');assert.equal(prior.finalTick,original.state.worldTick);assert(prior.sourceUnchanged&&prior.runtimeUnchanged);
 assert.equal(seal.files['report.json'],hash(priorBytes));assert.equal(seal.files['failure-state.json'],sourceSha256);
 assert.equal(hash(await fs.readFile(prior.source)),prior.sourceSha256,'original kitchen source remains unchanged');
 resume={priorDirectory:resumeFrom,priorReportSha256:hash(priorBytes),priorSealSha256:hash(sealBytes),source:prior.source,sourceSha256:prior.sourceSha256,priorFinalTick:prior.finalTick,priorElapsedNodeSeconds:prior.elapsedNodeSeconds};
 assert(transitionPath&&path.isAbsolute(transitionPath),'runtime repair resume requires its explicit transition manifest');
 const transitionBytes=await fs.readFile(transitionPath);runtimeTransition={path:transitionPath,sha256:hash(transitionBytes),manifest:JSON.parse(transitionBytes)};
}
await fs.writeFile(path.join(outputRoot,'source.json'),bytes,{flag:'wx'});
await fs.writeFile(path.join(outputRoot,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
const sourceReport=path.join(path.dirname(source),'report.json');let sourceReportSha256=null;
try{const report=await fs.readFile(sourceReport);sourceReportSha256=hash(report);await fs.writeFile(path.join(outputRoot,'source-report.json'),report,{flag:'wx'});}catch(error){if(error.code!=='ENOENT')throw error;}
const runtimeNames=(await fs.readdir(path.join(repository,'src/simulation'))).filter(n=>n.endsWith('.mjs'));
const codeHashes=async()=>Object.fromEntries(await Promise.all(runtimeNames.map(async name=>[name,hash(await fs.readFile(path.join(repository,'src/simulation',name)))])));
const runtimeSha256=await codeHashes();
if(runtimeTransition){
 const from=runtimeTransition.manifest.from,to=runtimeTransition.manifest.to;
 assert(from&&to&&Object.keys(from).length===Object.keys(to).length,'transition binds the complete loaded runtime');
 for(const[file,sha]of Object.entries(to))assert.equal(hash(await fs.readFile(path.join(repository,file))),sha,`transition current file ${file}`);
 const prior=JSON.parse(await fs.readFile(path.join(resumeFrom,'report.json')));
 for(const[name,sha]of Object.entries(prior.runtimeSha256After))assert.equal(from[`src/simulation/${name}`],sha,`transition previous simulation ${name}`);
}
let s=session.state;const sourceTick=s.worldTick,started=performance.now(),initialBuildingIds=Object.keys(s.buildingsById),initialExtent=s.spatial.extentVersion;
const MASTER='person:master',MERCHANT='person:merchant-qingxi',HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MARKET='stockpile:qingxi';
const warehouse=Object.values(s.buildingsById).find(b=>b.type==='warehouse');assert(warehouse,'source has the completed public warehouse');const WAREHOUSE=`stockpile:${warehouse.instanceId}`;
const quarry=Object.values(s.buildingsById).find(b=>b.type==='quarry');assert(quarry);
const seedStocks=Object.values(s.buildingsById).filter(b=>b.type==='granary').map(b=>`stockpile:${b.instanceId}`);
const initialSeeds=Object.fromEntries(seedStocks.map(id=>[id,s.stockpilesById[id].resources.food]));
const trace=[],paths=[],facts=[],checkpoints=[],seenFacts=new Set(Object.keys(s.factsById));
const resources=id=>s.stockpilesById[id]?.resources||{},quantity=(id,key)=>resources(id)[key]||0;
const stockTotal=id=>Object.values(resources(id)).reduce((n,v)=>n+v,0);
const materials=()=>Object.fromEntries(['jade','wood','stone'].map(key=>[key,quantity(HOME,key)+quantity(WAREHOUSE,key)]));
const feet=id=>copy(s.personsById[id].position);
const metrics=()=>({tick:s.worldTick,master:{position:feet(MASTER),energy:s.master.energy,wound:s.master.wound,activityId:s.master.activityId},merchant:{position:feet(MERCHANT),phase:s.srEconomy.merchantSchedulePhase,visit:copy(s.personsById[MERCHANT].courtyardVisit||null)},stocks:Object.fromEntries(Object.values(s.stockpilesById).filter(st=>st.ownerId===MASTER||[MARKET,'stockpile:wholesale-treasury'].includes(st.id)).map(st=>[st.id,{resources:copy(st.resources),capacity:st.capacity,access:st.access}])),patches:copy(s.srEconomy.patches),rngState:s.rngState});
function changes(before,after){const result={};for(const id of new Set([...Object.keys(before.stocks),...Object.keys(after.stocks)])){const a=before.stocks[id],b=after.stocks[id];if(JSON.stringify(a)!==JSON.stringify(b))result[id]={before:a??null,after:b??null};}return result;}
function collectFacts(){for(const[id,fact]of Object.entries(s.factsById))if(!seenFacts.has(id)){seenFacts.add(id);facts.push(copy(fact));}}
function record(item,before){const after=metrics(),entry={index:trace.length+1,...item,fromTick:before.tick,toTick:after.tick,masterBefore:before.master,masterAfter:after.master,merchantBefore:before.merchant,merchantAfter:after.merchant,inventoryChanges:changes(before,after),patchesBefore:before.patches,patchesAfter:after.patches,rngBefore:before.rngState,rngAfter:after.rngState};trace.push(entry);collectFacts();console.log(JSON.stringify({index:entry.index,kind:entry.kind,name:entry.name||entry.label,from:entry.fromTick,to:entry.toTick,home:resources(HOME),materials:materials(),error:entry.error}));return entry;}
function command(name,...args){const before=metrics();try{const r=SIM.dispatchCommand(s,{name,args});s=r.state;record({kind:'command',name,args,result:copy(r.result??null)},before);return r.result;}catch(error){record({kind:'command',name,args,error:error.message},before);throw error;}}
function step(){const from=feet(MASTER),merchantFrom=feet(MERCHANT);SIM.tick(s,.1);for(const[id,previous]of[[MASTER,from],[MERCHANT,merchantFrom]]){const now=feet(id);if(JSON.stringify(previous)!==JSON.stringify(now)){const a=s.activitiesById[s.personsById[id].activityId];paths.push({tick:s.worldTick,personId:id,from:previous,to:now,activityId:a?.id??null,kind:a?.kind??null,phase:a?.phase??null});}}collectFacts();}
function until(predicate,label,maxTicks=12000){const before=metrics(),pathStart=paths.length;let n=0;while(!predicate(s)&&n<maxTicks){assert(s.speed>0,'world must be running');step();n++;}record({kind:'advance',label,steps:n,simulatedSeconds:n/10,reached:!!predicate(s),pathRange:[pathStart,paths.length],body:copy(s.activitiesById[s.master.activityId]||null)},before);assert(predicate(s),`${label}: ${n} official ticks elapsed without completion`);}
async function checkpoint(label,{resume=true}={}){command('setSpeed',0);const canonical=SIM.validateSave(copy(s));assert.deepEqual(copy(canonical),copy(s),'exact simulation save/load');s=canonical;
 const snapshot={...copy(session),state:copy(s),control:copy(s.masterControl),provenance:{kind:'normal-public-command-checkpoint',label,source,sourceSha256,sourceReportSha256,sourceProvenance:copy(original.provenance),resume,runtimeTransition,stateSha256:hash(JSON.stringify(s)),scope:'Node official public commands and world steps',trace:copy(trace)}};
 assert.equal(validateSect(snapshot),true);assert.deepEqual(copy(restoreSect(snapshot).state),copy(s),'exact desktop-session restore');
 const filename=`${label}.json`;await fs.writeFile(path.join(outputRoot,filename),JSON.stringify(snapshot)+'\n',{flag:'wx'});checkpoints.push({label,filename,worldTick:s.worldTick,materials:materials(),home:copy(resources(HOME)),warehouse:copy(resources(WAREHOUSE)),stateSha256:snapshot.provenance.stateSha256});if(resume)command('setSpeed',1);return snapshot;
}
function transport(from,to,cargo,label){const order=command('startTransport',from,to,MASTER,cargo);until(x=>x.workOrdersById[order.id]?.phase==='delivered',label||`deliver ${JSON.stringify(cargo)} ${from} -> ${to}`);return order;}
function maintain(){
 if(s.master.energy<20){command('masterAction','rest');until(x=>x.master.energy>=60,'recover through actual rest');}
 const foodPatch=s.srEconomy.patches.food;
 if(foodPatch.remaining<=foodPatch.max*.25&&quantity(HOME,'food')>=8&&quantity(HOME,'jade')>=4){
  const order=command('replenishPatch','food');
  until(x=>!x.activitiesById[order.id],'pay seed food and jade, travel and replenish the finite food source');
 }
 if(quantity(HOME,'food')<12){
  const q=Math.min(20,quantity(WAREHOUSE,'food'));if(q>0)transport(WAREHOUSE,HOME,{food:q},'bring existing warehouse food home');
  else if(stockTotal(CARRIED)<.0001){const a=command('startMasterHarvest','food');until(x=>!x.activitiesById[a.id],'gather food from the finite local source');transport(CARRIED,HOME,{food:16});}
 }
}
function gather(resource,batches){for(let i=0;i<batches;i++){assert(stockTotal(CARRIED)+HARVEST_BATCH[resource]<=40+1e-8);const order=command('startMasterHarvest',resource);until(x=>!x.activitiesById[order.id],`actual ${resource} harvest ${i+1}/${batches}`);}}
const merchantArrived=()=>{const p=s.personsById[MERCHANT];return p.position.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard'&&(!p.courtyardVisit||p.courtyardVisit.phase==='present');};
function approachMerchant(){
 for(let attempt=0;attempt<8;attempt++){
  until(()=>merchantArrived(),'wait for the merchant actual road arrival');const p=feet(MERCHANT);
  command('moveScenicMaster',p.x+1,p.y);until(()=>!s.master.scenic.path.length,'walk to the visiting merchant');
  if(merchantArrived())return;
 }
 throw Error('merchant departed before eight actual approaches could meet');
}
async function sellCarriedStone(){
 while(quantity(CARRIED,'stone')>=10){
  approachMerchant();const quote=localMarketQuote(s,{resource:'stone',side:'sell',batches:1,stockpileId:CARRIED});
  if(!quote.maxBatches){
   const oldCash=quantity(MARKET,'jade');record({kind:'quote',label:'finite merchant cash is unavailable',quote},metrics());
   until(()=>quantity(MARKET,'jade')>oldCash&&quantity(MARKET,'jade')>=9,'wait for actual market resale and funded return');continue;
  }
  const batches=Math.min(quote.maxBatches,Math.floor(quantity(CARRIED,'stone')/10));
  const before=copy(resources(HOME)),totalBefore=Object.values(s.stockpilesById).reduce((n,x)=>n+(x.resources.jade||0),0);
  command('marketTrade','stone','sell',batches,{stockpileId:CARRIED});assert.deepEqual(resources(HOME),before,'trade money stays at the actor');assert.equal(Object.values(s.stockpilesById).reduce((n,x)=>n+(x.resources.jade||0),0),totalBefore,'trade conserves jade');
 }
 const amount=quantity(CARRIED,'jade');if(amount){const order=command('startTransport',CARRIED,HOME,MASTER,{jade:amount});until(x=>x.workOrdersById[order.id]?.phase==='carrying','earned jade is physically in transit');if(!checkpoints.some(c=>c.label==='01-first-payment-carrying'))await checkpoint('01-first-payment-carrying');until(x=>x.workOrdersById[order.id]?.phase==='delivered','earned jade physically reaches HOME');}
}
async function fundJade(target){for(let turn=0;quantity(HOME,'jade')+1e-8<target&&turn<40;turn++){
 maintain();assert(stockTotal(CARRIED)<1e-8);const batches=Math.min(4,Math.ceil((target-quantity(HOME,'jade'))/9)),quarryStock=`stockpile:${quarry.instanceId}`;
 const producedBatches=Math.min(batches,Math.floor(quantity(quarryStock,'stone')/10));
 if(producedBatches)transport(quarryStock,CARRIED,{stone:producedBatches*10},'collect stone actually produced at the quarry');
 else gather('stone',batches);
 await sellCarriedStone();
 }assert(quantity(HOME,'jade')+1e-8>=target,'funded target uses delivered money');}
function stockMaterial(resource,target,destination){for(let turn=0;(destination===HOME?quantity(HOME,resource):materials()[resource])+1e-8<target&&turn<40;turn++){
 maintain();const current=destination===HOME?quantity(HOME,resource):materials()[resource],deficit=target-current;
 const nearby=Object.values(s.stockpilesById).find(st=>st.ownerId===MASTER&&st.access==='public'&&st.id!==HOME&&st.id!==destination&&(st.resources[resource]||0)>0);
 if(nearby){transport(nearby.id,destination,{[resource]:Math.min(40,deficit,nearby.resources[resource])});continue;}
 const batches=Math.min(Math.floor(40/HARVEST_BATCH[resource]),Math.ceil(deficit/HARVEST_BATCH[resource]));gather(resource,batches);transport(CARRIED,destination,{[resource]:quantity(CARRIED,resource)});
 }assert((destination===HOME?quantity(HOME,resource):materials()[resource])+1e-8>=target);
}
let status='failed',failure=null;
try{
 await checkpoint('00-source');
 // Leave the retained residential bed through a real, recorded walk before gathering.
 const body=s.activitiesById[s.master.activityId];
 if(body?.kind==='facility'){
  const b=s.buildingsById[body.targetId];assert(b,'the current bed belongs to an existing building');
  const entrance=buildingAccess(s,b);command('moveScenicMaster',entrance.x,entrance.y);until(()=>!s.master.scenic.path.length,'walk out from the saved residence');
 }
 // Put the preceding kitchen segment's remaining carried goods into reachable
 // public storage before gathering; every item retains its actual quantity.
 if(resume&&quantity(CARRIED,'stone')>=10)await sellCarriedStone();
 const remaining=Object.fromEntries(Object.entries(resources(CARRIED)).filter(([,q])=>q>0));
 if(Object.keys(remaining).length){
  const kitchen=Object.values(s.buildingsById).find(b=>b.type==='kitchen'&&b.serviceVersion);
  const kitchenStock=kitchen&&s.stockpilesById[`stockpile:${kitchen.instanceId}`];
  const nearbyWater=Object.keys(remaining).every(k=>k==='cleanWater')&&kitchenStock&&stockTotal(kitchenStock.id)+remaining.cleanWater<=kitchenStock.capacity;
  const extended=Object.keys(remaining).some(k=>!Object.hasOwn(resources(WAREHOUSE),k));
  if(!nearbyWater&&extended)command('enableWarehouseServiceStorage',WAREHOUSE);
  transport(CARRIED,nearbyWater?kitchenStock.id:WAREHOUSE,remaining,nearbyWater?'unload retained clean water at the nearby kitchen stock':'deliver carried kitchen remainder to the public warehouse');
 }
 maintain();if(!quarry.enabled)command('toggleBuilding',quarry.id);
 // GC16 costs25 jade/20 wood/8 stone; GC02 costs65 jade/45 wood/20 stone.
 // The extra20 jade/5 wood/2 stone and food remain visible travel/upkeep reserves.
 stockMaterial('stone',30,HOME);stockMaterial('wood',70,HOME);await fundJade(110);
 for(let i=0;quantity(HOME,'food')<48&&i<8;i++){
  maintain();assert(stockTotal(CARRIED)<1e-8);gather('food',1);transport(CARRIED,HOME,{food:16});
 }
 assert.deepEqual(Object.keys(s.buildingsById),initialBuildingIds);assert.equal(s.spatial.extentVersion,initialExtent);
 assert.deepEqual(s.spatial.eastResidences,original.state.spatial.eastResidences);
 for(const[id,n]of Object.entries(initialSeeds))assert.equal(quantity(id,'food'),n,'grain seed reserves remain at their fields');
 assert(quantity(HOME,'jade')>=90&&quantity(HOME,'wood')>=65&&quantity(HOME,'stone')>=28&&quantity(HOME,'food')>=48);
 await checkpoint('02-library-and-lumber-materials-ready',{resume:false});status='passed';
}catch(error){failure=error.stack;console.error(failure);process.exitCode=1;await fs.writeFile(path.join(outputRoot,'failure-state.json'),JSON.stringify({...copy(session),state:copy(s),control:copy(s.masterControl)})+'\n');}
finally{
 const sourceSha256After=hash(await fs.readFile(source)),runtimeSha256After=await codeHashes();const sourceUnchanged=sourceSha256===sourceSha256After,runtimeUnchanged=JSON.stringify(runtimeSha256)===JSON.stringify(runtimeSha256After);
 if(!sourceUnchanged||!runtimeUnchanged){status='failed';failure=[failure,'source or loaded runtime hashes changed during the run'].filter(Boolean).join('\n');process.exitCode=1;}
 await fs.writeFile(path.join(outputRoot,'trace.json'),JSON.stringify(trace,null,2)+'\n');await fs.writeFile(path.join(outputRoot,'paths.jsonl'),paths.map(x=>JSON.stringify(x)).join('\n')+'\n');await fs.writeFile(path.join(outputRoot,'facts.jsonl'),facts.map(x=>JSON.stringify(x)).join('\n')+'\n');
 await fs.writeFile(path.join(outputRoot,'report.json'),JSON.stringify({status,resume,runtimeTransition,scope:'Node official public commands and shared world steps; desktop wall-clock acceptance remains separate',source,sourceSha256,sourceSha256After,sourceUnchanged,sourceReportSha256,sourceProvenance:original.provenance,runtimeSha256,runtimeSha256After,runtimeUnchanged,sourceTick,finalTick:s.worldTick,simulatedSeconds:(s.worldTick-sourceTick)/10,elapsedNodeSeconds:(performance.now()-started)/1000,checkpoints,commandCount:trace.filter(x=>x.kind==='command').length,pathSamples:paths.length,finalHome:resources(HOME),finalWarehouse:resources(WAREHOUSE),finalMaterials:materials(),remainingFiniteSources:s.srEconomy.patches,merchantCash:quantity(MARKET,'jade'),failure},null,2)+'\n');console.log(`Evidence: ${outputRoot}`);
}
