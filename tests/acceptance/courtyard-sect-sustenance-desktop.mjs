/** Same-source SR008/009/010 rehearsal and serialized native acceptance.
 * --stage=node|desktop --source=/absolute/save.json --output=/absolute/fresh-dir
 * Only public commands/controls advance the independently copied QA world.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {viewSRWorld} from '../../src/simulation/ea-sr-world.mjs';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,commandSect,advanceSect,snapshotSect,viewSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
const opt=k=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3),source=opt('source'),output=opt('output'),stage=opt('stage')||'node';
assert(source&&output&&path.isAbsolute(source)&&path.isAbsolute(output));assert(!path.resolve(output).startsWith(repositoryRoot+'/'));
const bytes=await fs.readFile(source),hash=b=>createHash('sha256').update(b).digest('hex'),run=restoreSect(JSON.parse(bytes)),initial=structuredClone(run.state),HOME='stockpile:yunxiu',PARTY='stockpile:sr-party',herbs='object:valley:herbs';
await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'source.json'),bytes);await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
const preparationReceipts=[];
const save=(n,v)=>fs.writeFile(path.join(output,n+'.json'),JSON.stringify(v,null,2)+'\n'),started=performance.now(),actions=[],samples=[],errors=[];
const runtimeFiles=['apps/courtyard/sect-sim.mjs','apps/courtyard/sect-combat.mjs','apps/courtyard/courtyard-combat.mjs','apps/courtyard/courtyard-expedition-resources.mjs','src/simulation/ea-sect-sustenance.mjs','src/simulation/ea-society.mjs','src/simulation/ea-sr-world.mjs','src/simulation/ea-site-services.mjs','src/simulation/ea-sr-spatial.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeBefore=await hashes(),readNode=()=>({session:run,view:{expedition:{world:viewSRWorld(run.state)}}}),state=r=>r.session.state;
const settled=r=>!state(r).srWorld.interaction&&!state(r).personsById['person:master'].scenic.path.length;
const exitReady=(r,id)=>r.view.expedition.world.exits.some(e=>e.id===id&&e.near)&&settled(r);
const arrived=(r,id)=>state(r).personsById['person:master'].position?.kind==='scene'&&state(r).personsById['person:master'].position.sceneId===id&&!state(r).srWorld.activeTravelId;
let statisticsBaseline=initial;
const facts=(s,kind)=>Object.values(s.factsById).filter(f=>f.atTick>statisticsBaseline.worldTick&&(kind?f.kind===kind:true));
const summarize=s=>structuredClone({tick:s.worldTick,time:s.time,starvation:s.economy.starvation,home:s.stockpilesById[HOME].resources,party:s.stockpilesById[PARTY]?.resources,production:facts(s).filter(f=>f.operation==='production'),supply:facts(s,'daily-supply-relation'),meals:facts(s,'site-meal-consumed'),transfers:facts(s).filter(f=>f.kind==='cargo-transfer'||f.operation==='delivery'),members:initial.homeMemberIds.map(id=>({id,skills:s.personsById[id].mind.skills,knowledge:s.personsById[id].mind.knowledge,activity:s.personsById[id].mind.activity}))});
const growth=s=>initial.homeMemberIds.some(id=>['skills','knowledge'].some(field=>Object.entries(s.personsById[id].mind[field]||{}).some(([k,v])=>v>(statisticsBaseline.personsById[id].mind[field]?.[k]||0))));
const foodDelivery=s=>facts(s).some(f=>f.atTick>awayTick&&f.operation==='delivery'&&f.targetStockpileId===HOME&&(f.quantities?.food||0)>0&&s.workOrdersById[f.workOrderId]?.carrierId!=='person:master'&&s.workOrdersById[f.workOrderId]?.startedTick>=awayTick&&s.workOrdersById[f.workOrderId]?.finishedTick>awayTick);
const foodProduction=s=>facts(s).some(f=>f.operation==='production'&&(f.quantities?.food||0)>0);
const awayStarvation=[];let awayWindowStart=null,awayWindowEnd=null;const monitor=s=>{if(awayWindowStart!==null&&awayWindowEnd===null){if(s.economy.starvation>0)awayStarvation.push({tick:s.worldTick,starvation:s.economy.starvation});}};
let nativeClosed=null,nativeExact=null,nativePath=null;let app,page,success=false,awayTick,awayBaseline,awayHome,gatherId,gatherStock,gatherStarted,terminal;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let renewManual=true,lastManualTick=initial.worldTick;
let read=readNode,send=async request=>{const result=commandSect(run,request);actions.push({tick:run.state.worldTick,request,result});assert(result.ok,result.error);};
let until=async(predicate,label,limit=18000)=>{for(let n=0;n<limit;n++){const r=readNode();monitor(state(r));if(predicate(r))return r;if(renewManual&&state(r).worldTick-lastManualTick>=100){await pause(true);await manual();await pause(false);}advanceSect(run,.1);if(n%300===0){samples.push(summarize(run.state));await save('progress',{label,tick:run.state.worldTick});}}throw Error('bounded Node wait: '+label);};
let pause=async paused=>send({type:'pause',paused});
let checkpoint=async name=>{await pause(true);const r=await read();if(stage==='node')r.session=snapshotSect(run);validateSect(r.session);assert.deepEqual(restoreSect(r.session).state,state(r));await save(name,r);if(stage==='node')Object.assign(run,restoreSect(r.session));return r;};
// Bind a batch to its physical master-carried transport, including an autonomous
// order accepted between the harvest receipt and the next paused observation.
const matchingTransport=(s,sourceId,resource,quantity,minTick)=>Object.values(s.workOrdersById).filter(o=>o.kind==='transport'&&o.carrierId==='person:master'&&o.sourceStockpileId===sourceId&&o.targetStockpileId===HOME&&o.startedTick>=minTick&&Object.keys(o.cargo).length===1&&o.cargo[resource]===quantity&&['to-source','carrying','delivered'].includes(o.phase)).sort((a,b)=>a.startedTick-b.startedTick)[0];
async function receiveBatch({sourceId,resource,quantity,minTick,label,harvestFact=null,expectedOrderId=null}){
 await pause(true);let s=state(await read()),order=matchingTransport(s,sourceId,resource,quantity,minTick),continued=!!order;
 if(expectedOrderId)assert.equal(order?.id,expectedOrderId,'resume must continue the exact source transport');
 if(!order){assert((s.stockpilesById[sourceId]?.resources[resource]||0)>=quantity,'the actual batch remains at its source');await send({type:'transport',sourceStockpileId:sourceId,targetStockpileId:HOME,cargo:{[resource]:quantity}});s=state(await read());order=matchingTransport(s,sourceId,resource,quantity,minTick);assert(order,'public transport must create the exact physical order');}
 const orderId=order.id;
 if(order.phase!=='delivered'){
  const master=s.personsById['person:master'];assert.equal(s.activitiesById[master.activityId]?.workOrderId,orderId,'continue the same active master body transport');
  await pause(false);await until(r=>state(r).workOrdersById[orderId]?.phase==='delivered',label);await pause(true);
 }
 s=state(await read());const delivered=s.workOrdersById[orderId],receipts=Object.values(s.factsById).filter(f=>f.operation==='delivery'&&f.workOrderId===orderId);assert.equal(delivered.phase,'delivered');assert.equal(receipts.length,1);const fact=receipts[0];assert.equal(fact.sourceStockpileId,sourceId);assert.equal(fact.targetStockpileId,HOME);assert.deepEqual(fact.quantities,{[resource]:quantity});assert.equal(fact.atTick,delivered.finishedTick);
 const evidence={label,continued,harvestFact,orderId,startedTick:delivered.startedTick,finishedTick:delivered.finishedTick,deliveryFact:fact};preparationReceipts.push(structuredClone(evidence));await save('physical-deliveries',preparationReceipts);return evidence;
}
let resumeHarvest=null,resumeTransportId=null;
if(opt('resume-preparation')){
 assert.equal(opt('resume-preparation'),'true');
 const candidates=Object.values(initial.factsById).filter(f=>f.operation==='manual-harvest'&&f.resource==='food'&&f.quantity===16&&f.actorId==='person:master'&&f.targetStockpileId==='stockpile:carried:master').sort((a,b)=>b.atTick-a.atTick);
 resumeHarvest=candidates.find(f=>matchingTransport(initial,'stockpile:carried:master','food',16,f.atTick));assert(resumeHarvest,'resume requires an existing physical food16 harvest and matching active or delivered transport');
 const order=matchingTransport(initial,'stockpile:carried:master','food',16,resumeHarvest.atTick);resumeTransportId=order.id;assert(!candidates.some(f=>f.atTick>resumeHarvest.atTick&&f.atTick<=order.startedTick),'resumed batch must have an unambiguous harvest receipt');
 await save('resume-preparation-source',{sourceSha256:hash(bytes),tick:initial.worldTick,harvestFact:resumeHarvest,order:structuredClone(order)});
}
let resumedOutboundTrip=null;
if(opt('resume-outbound')){
 assert.equal(opt('resume-outbound'),'true');assert(!opt('resume-preparation'),'choose the actual retained phase');
 const position=initial.personsById['person:master'].position;
 assert(position?.kind==='worldTravel'||position?.kind==='scene'&&position.sceneId==='scene:valley','outbound resume requires actual journey or valley presence');
 const travels=Object.values(initial.travelsById).filter(t=>t.from==='scene:yunxiu-courtyard'&&t.destination==='scene:valley'&&t.participantIds.includes('person:master')&&['traveling','arrived'].includes(t.status)).sort((a,b)=>b.startedTick-a.startedTick);
 resumedOutboundTrip=position.kind==='worldTravel'?travels.find(t=>t.id===position.travelId&&t.id===initial.srWorld.activeTravelId):travels.find(t=>t.status==='arrived');assert(resumedOutboundTrip,'retained outbound journey must match canonical master position');
 await save('resume-outbound-source',{sourceSha256:hash(bytes),tick:initial.worldTick,position,trip:resumedOutboundTrip,awayWindowStart:resumedOutboundTrip.startedTick,observationBeginsAtTick:initial.worldTick});
}
let returnResumeEvidence=null;
if(opt('resume-return')){
 assert.equal(opt('resume-return'),'true');assert(!opt('resume-outbound')&&!opt('resume-preparation'),'resume-return is the retained completed valley phase');
 const baselinePath=opt('away-baseline');assert(baselinePath&&path.isAbsolute(baselinePath),'absolute --away-baseline required');const baselineBytes=await fs.readFile(baselinePath),raw=JSON.parse(baselineBytes),b=raw.session?.state||raw.state;assert(b&&Number.isSafeInteger(b.worldTick));assert(initial.worldTick>=b.worldTick);
 assert.deepEqual(initial.homeMemberIds,b.homeMemberIds,'same original members');for(const id of ['person:master',...b.homeMemberIds]){assert.equal(initial.personsById[id]?.personId,b.personsById[id]?.personId);assert.equal(initial.personsById[id]?.name,b.personsById[id]?.name);assert.deepEqual(initial.personsById[id]?.appearance,b.personsById[id]?.appearance);}
 assert.equal(initial.schemaVersion,b.schemaVersion);assert.equal(initial.contentVersion,b.contentVersion);
 const summarizedHistory={weather:[],'daily-supply-relation':[]};
 for(const [id,fact]of Object.entries(b.factsById)){
  if(initial.factsById[id]){assert.deepEqual(initial.factsById[id],fact,'inherited fact unchanged: '+id);continue;}
  const weather=fact.kind==='weather'&&id===`fact:weather:yunxiu:${fact.atTick}`&&fact.regionId==='region:yunxiu';
  const daily=fact.kind==='daily-supply-relation'&&id===`fact:person-daily-supply:${fact.personId}:${fact.dayIndex}`&&b.homeMemberIds.includes(fact.personId)&&fact.source==='economy.daily-supply';
  assert(weather||daily,'baseline business facts remain inherited: '+id);summarizedHistory[fact.kind].push(fact);
 }
 const historyEvidence={};for(const [kind,records]of Object.entries(summarizedHistory))if(records.length){
  const before=b.historyRetention?.summaries?.[kind],after=initial.historyRetention?.summaries?.[kind];assert(before&&after&&Number.isSafeInteger(before.count)&&Number.isSafeInteger(after.count));
  assert(after.count-before.count>=records.length&&after.lastTick>=Math.max(...records.map(f=>f.atTick))&&after.firstTick<=Math.min(...records.map(f=>f.atTick))&&after.lastTick>=before.lastTick,'legitimate '+kind+' summary carries retained count and time');
  historyEvidence[kind]={before,after,summarizedBaselineFacts:records};
 }
 assert(arrived({session:{state:initial}},'scene:valley'));assert(!initial.srWorld.interaction,'retained source has completed gathering');
 const gathers=Object.values(initial.factsById).filter(f=>f.id.startsWith(`fact:interaction:${herbs}:gather:`)&&f.atTick>b.worldTick);assert.equal(gathers.length,1,'one exact gathered batch since arrival');const fact=gathers[0],start=Number(fact.id.slice(`fact:interaction:${herbs}:gather:`.length));assert(Number.isSafeInteger(start)&&fact.atTick-start===30&&fact.actorId==='person:master'&&fact.sceneId==='scene:valley');
 assert.equal(initial.stockpilesById[PARTY].resources.herb,b.stockpilesById[PARTY].resources.herb+6);assert.equal(initial.srWorld.resourcePatches[herbs],(b.srWorld.resourcePatches?.[herbs]??18)-6);
 const trip=Object.values(initial.travelsById).filter(t=>t.from==='scene:yunxiu-courtyard'&&t.destination==='scene:valley'&&t.status==='arrived'&&t.participantIds.includes('person:master')&&t.startedTick<=b.worldTick).sort((a,c)=>c.startedTick-a.startedTick)[0];assert(trip);assert.deepEqual(trip,b.travelsById[trip.id],'the original outward journey is inherited');
 statisticsBaseline=b;awayTick=b.worldTick;awayBaseline=structuredClone(b);awayHome=structuredClone(b.stockpilesById[HOME].resources);awayWindowStart=trip.startedTick;gatherStarted=start;gatherStock=structuredClone(b.stockpilesById[PARTY].resources);gatherId=fact.id;renewManual=false;
 assert(foodProduction(initial)&&foodDelivery(initial)&&growth(initial),'retained source already contains autonomous food production delivery and growth');assert(!Object.values(initial.factsById).some(f=>f.kind==='daily-supply-relation'&&f.atTick>=awayWindowStart&&!f.supplied));assert.equal(initial.economy.starvation,0);
 returnResumeEvidence={baselinePath,baselineSha256:hash(baselineBytes),baselineTick:b.worldTick,sourceTick:initial.worldTick,tripId:trip.id,awayWindowStart,gatherFact:fact,summarizedHistory:historyEvidence};await save('resume-return-source',returnResumeEvidence);
}
async function manual(){await send({type:'manual'});lastManualTick=state(await read()).worldTick;}
let launch;
try{
 if(stage==='desktop'){
  const {_electron}=await import('playwright'),target=desktopTarget(),directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');await fs.mkdir(directory);await fs.writeFile(native,bytes);nativePath=native;
  launch=async()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show']});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});};
  await launch();read=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view()}));assert.deepEqual(state(await read()),initial,'first native read must preserve exact source state before any world step');
  const click=async selector=>{await page.locator(selector).click();actions.push({selector,tick:state(await read()).worldTick});};
  pause=async value=>{if(await page.evaluate(()=>window.courtyardQA.status().manualPause)!==value)await click('#pause');};
  until=async(predicate,label,seconds=600)=>{const start=performance.now();while(performance.now()-start<seconds*1000){const r=await read();assert.deepEqual(errors,[]);monitor(state(r));if(predicate(r))return r;if(renewManual&&state(r).worldTick-lastManualTick>=100){assert(state(r).worldTick-lastManualTick<300,'bounded public manual handoff');await pause(true);await manual();await pause(false);}await sleep(1000);}throw Error('bounded desktop wait: '+label);};
  send=async request=>{
   if(request.type==='manual'){await click('#affairs');await click('[data-ui-key="affairs:policy"]');await click('[data-ui-key="policy:manual"]');await click('#close-management');}
   else if(request.type==='toggle-building'){await page.evaluate(id=>{const q=window.courtyardQA;const b=q.snapshot().state.buildingsById[id];q.openBuilding(q.view().buildings.find(v=>String(v.id)===String(b.id)));},request.buildingId);await click('[data-ui-key="farm:toggle"]');await click('#close-management');}
   else if(request.type==='disciple-work-focus'){await click('#affairs');await page.locator('[data-ui-key="development:focus"]').selectOption(request.value);await click('[data-ui-key="development:save-focus"]');await click('#close-management');}
   else if(request.type==='harvest'){await click('#supply');await click('[data-ui-key="subtab:sources"]');await click(`[data-ui-key="source:${request.resource}"]`);await click(`[data-ui-key="source:harvest:${request.resource}"]`);await click('#close-management');}
   else if(request.type==='transport'){const resource=Object.keys(request.cargo)[0];await click('#supply');await click('[data-ui-key="subtab:stocks"]');await page.locator('[data-ui-key="stocks:owner"]').selectOption('all');await click(`[data-ui-key="stock:${request.sourceStockpileId}"]`);await page.locator('[data-ui-key="stock:destination"]').selectOption(request.targetStockpileId);await click(`[data-ui-key="stock:transfer:${resource}"]`);await page.locator('[data-ui-key="transfer:quantity"]').fill(String(request.cargo[resource]));await click('[data-ui-key="transfer:submit"]');await click('#close-management');}
   else if(request.type==='world'){
    const a=request.action;if(a.action==='exit'){if(a.exitId==='exit:yunxiu-valley'){await click('#expedition-open');if(await page.locator('#expedition-departure').isVisible()){await save('departure-supply-note',{tick:state(await read()).worldTick,text:await page.locator('#expedition-supply-note').innerText()});await page.screenshot({path:path.join(output,'departure-preparation.png')});await click('#expedition-depart-confirm');}}else await click('#expedition-exit');}
    else if(a.action==='move')await click(`[data-ui-key="expedition-resource-approach:${herbs}"]`);
    else if(a.action==='interact')await click(`[data-ui-key="expedition-resource-gather:${herbs}"]`);
   }else throw Error('unknown desktop request');
  };
  checkpoint=async name=>{await pause(true);const before=await read();validateSect(before.session);await save(name,before);await page.screenshot({path:path.join(output,name+'.png')});await click('#save');for(let n=0;n<100;n++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(state(before)))break;await sleep(100);}assert.deepEqual(JSON.parse(await fs.readFile(native)).state,state(before));await app.close();app=null;await launch();const after=await read();assert.deepEqual(state(after),state(before),'full native save close reopen');await save(name+'-reopened',after);return after;};
 }else assert.equal(stage,'node');
 if(!returnResumeEvidence){
 if(!resumedOutboundTrip){
 await pause(true);await manual();
 if(resumeHarvest){
  await receiveBatch({sourceId:'stockpile:carried:master',resource:'food',quantity:16,minTick:resumeHarvest.atTick,label:'resume first physical food delivery',harvestFact:resumeHarvest,expectedOrderId:resumeTransportId});await checkpoint('prepared-food-1');
 }
 for(const b of Object.values(initial.buildingsById).filter(b=>b.type==='granary'&&b.enabled===false))await send({type:'toggle-building',buildingId:b.instanceId});
 await send({type:'disciple-work-focus',value:'food'});await checkpoint('policy');
 for(let batch=resumeHarvest?2:1;batch<=2;batch++){
  const before=state(await read()),beforeIds=new Set(Object.keys(before.factsById)),beforeDeliveryIds=new Set(Object.values(before.factsById).filter(f=>f.operation==='delivery').map(f=>f.id));
  let current=state(await read()),activity=current.activitiesById[current.personsById['person:master'].activityId],continuedHarvest=false;
  if(activity){assert(activity.kind==='sr-harvest'&&activity.resource==='food'&&activity.reservedQuantity===16,'preparation continues only the exact existing food16 body harvest');continuedHarvest=true;}
  else{await send({type:'harvest',resource:'food'});current=state(await read());activity=current.activitiesById[current.personsById['person:master'].activityId];assert(activity?.kind==='sr-harvest'&&activity.resource==='food'&&activity.reservedQuantity===16);}
  const activityId=activity.id,harvestFactId='fact:manual-harvest:'+activityId;await save('preparation-harvest-'+batch,{activityId,continuedHarvest,sourceActivity:structuredClone(activity)});
  await pause(false);await until(r=>!!state(r).factsById[harvestFactId],'prepare exact food harvest '+activityId);await pause(true);
  const harvest=state(await read()).factsById[harvestFactId];assert(harvest&&harvest.resource==='food'&&harvest.quantity===16&&harvest.actorId==='person:master'&&!beforeIds.has(harvest.id),'the exact retained activity produces one new food16 receipt');
  const receipt=await receiveBatch({sourceId:'stockpile:carried:master',resource:'food',quantity:16,minTick:harvest.atTick,label:'prepare food physical delivery '+batch,harvestFact:harvest});assert(!beforeDeliveryIds.has(receipt.deliveryFact.id),'delivery belongs to this newly harvested batch');await checkpoint('prepared-food-'+batch);
 }await pause(false);
 await send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});await until(r=>exitReady(r,'exit:yunxiu-valley'),'physical mountain gate');await pause(true);
 await manual();renewManual=false;awayWindowStart=state(await read()).worldTick;await send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4},companions:[]}});await pause(false);await until(r=>arrived(r,'scene:valley'),'outbound journey');
 }else{awayWindowStart=resumedOutboundTrip.startedTick;renewManual=false;await pause(false);await until(r=>arrived(r,'scene:valley'),'retained outbound journey');}
 let r=await checkpoint('valley-arrived');awayTick=state(r).worldTick;awayBaseline=structuredClone(state(r));awayHome=structuredClone(state(r).stockpilesById[HOME].resources);await pause(false);
 await send({type:'world',action:{action:'move',x:11.5,y:16}});await until(settled,'walk to herb patch');await pause(true);
 r=await read();gatherStock=structuredClone(state(r).stockpilesById[PARTY].resources);const patchBefore=state(r).srWorld.resourcePatches?.[herbs]??18;
 await send({type:'world',action:{action:'interact',objectId:herbs,choice:'gather'}});r=await read();gatherId=state(r).srWorld.interaction.id;gatherStarted=state(r).srWorld.interaction.startedTick;await checkpoint('gather-pending');await pause(false);await until(r=>!state(r).srWorld.interaction,'real gathering duration');
 r=await checkpoint('gathered');assert.equal(state(r).stockpilesById[PARTY].resources.herb,gatherStock.herb+6);assert.equal(state(r).srWorld.resourcePatches[herbs],patchBefore-6);assert.equal(facts(state(r)).filter(f=>f.id===`fact:interaction:${herbs}:gather:${gatherStarted}`).length,1);
 }
 await pause(false);if(!opt('route-only'))await until(r=>foodProduction(state(r))&&foodDelivery(state(r))&&growth(state(r))&&facts(state(r)).some(f=>f.atTick>awayTick&&f.operation==='production'&&(f.quantities?.food||0)>0)&&initial.homeMemberIds.some(id=>['skills','knowledge'].some(field=>Object.entries(state(r).personsById[id].mind[field]||{}).some(([k,v])=>v>(awayBaseline.personsById[id].mind[field]?.[k]||0))))&&facts(state(r),'daily-supply-relation').some(f=>f.atTick>awayTick&&f.supplied),'autonomous food production growth and daily supply');
 await checkpoint('away-sustenance');renewManual=false;await pause(false);await send({type:'world',action:{action:'exit',exitId:'exit:valley-yunxiu'}});await until(r=>exitReady(r,'exit:valley-yunxiu'),'physical return exit');await pause(true);
 await send({type:'world',action:{action:'exit',exitId:'exit:valley-yunxiu'}});await pause(false);await until(r=>arrived(r,'scene:yunxiu-courtyard'),'return journey');awayWindowEnd=state(await read()).worldTick;terminal=await checkpoint('home-returned');assert.deepEqual(awayStarvation,[],'every observed away step must preserve food supply');assert(!facts(state(terminal),'daily-supply-relation').some(f=>f.atTick>=awayWindowStart&&f.atTick<=awayWindowEnd&&!f.supplied),'every away daily settlement must be supplied');
 renewManual=true;await manual();await receiveBatch({sourceId:PARTY,resource:'herb',quantity:6,minTick:gatherStarted,label:'actual gathered herb delivery'});terminal=await checkpoint('herbs-stored');assert.equal(state(terminal).stockpilesById[PARTY].resources.herb,gatherStock.herb,'gathered herb unloaded home');if(!opt('route-only')){assert(growth(state(terminal)));assert(foodProduction(state(terminal)));assert(foodDelivery(state(terminal)));assert.equal(state(terminal).economy.starvation,0);}
 await save('outcomes',{...summarize(state(terminal)),economy:state(terminal).economy,foodDeliveries:facts(state(terminal)).filter(f=>f.operation==='delivery'&&(f.quantities?.food||0)>0).map(f=>({fact:f,workOrder:state(terminal).workOrdersById[f.workOrderId]})),awayTick,returnTick:state(terminal).worldTick});success=true;
}catch(e){errors.push(e.stack||String(e));process.exitCode=1;try{await pause(true);const r=await read();await save('failure',r);if(page)await page.screenshot({path:path.join(output,'failure.png')});}catch(e){errors.push(String(e));}}
finally{if(app){const nativeProcess=app.process();await app.close();for(let n=0;n<100&&nativeProcess&&nativeProcess.exitCode===null&&nativeProcess.signalCode===null;n++)await sleep(100);nativeClosed=!!nativeProcess&&(nativeProcess.exitCode!==null||nativeProcess.signalCode!==null);app=null;}if(nativePath&&terminal){try{nativeExact=JSON.stringify(JSON.parse(await fs.readFile(nativePath)).state)===JSON.stringify(state(terminal));}catch(e){nativeExact=false;errors.push(String(e));}}if(stage==='desktop'&&success&&(!nativeClosed||!nativeExact)){success=false;process.exitCode=1;errors.push('native process exit and exact terminal persistence required');}const runtimeAfter=await hashes(),runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter);await save('result',{success,stage,nativeClosed,nativeExact,resumeReturn:returnResumeEvidence,resumeOutbound:!!resumedOutboundTrip,resumePreparation:!!resumeHarvest,preparationReceipts,awayWindowStart,awayWindowEnd,awayStarvation,routeOnly:!!opt('route-only'),source,sourceSha256:hash(bytes),sourceUnchanged:hash(await fs.readFile(source))===hash(bytes),runtimeBefore,runtimeAfter,runtimeUnchanged,exploratory:!runtimeUnchanged,awayTick,awayHome,gatherId,gatherStock,actions,samples,errors,wallSeconds:(performance.now()-started)/1000});console.log(JSON.stringify({success,stage,output,errors}));}
