/** SR-XF-017-AC-01: one earned Gu family first-contact and finite exchange. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';

const CARD_ID='card:local:medicine-care:v1';
const BANK_ID='stockpile:content:card-local-medicine-care-v1';
const outputArg=process.argv.indexOf('--output-dir');
const outputDir=outputArg>=0?process.argv[outputArg+1]:null;
if(outputArg>=0&&!outputDir)throw Error('--output-dir requires a directory');
const evidence={suite:'SR-XF-017-AC-01 Gu first contact',base:'fresh initial({sr:true})',branches:{},publicCommands:{committed:0,replayed:0,rejected:0},exactSaveReads:0};
const checkpoints={};
let nextCommand=0;

function harness(state){
 let s=state;
 function command(name,...args){
  const id=`command:sr017-gu:${++nextCommand}`;
  return send({name,args,id});
 }
 function send(request){
  try{
   const result=SIM.dispatchCommand(s,request);
   s=result.state;
   if(result.status==='already-applied')evidence.publicCommands.replayed++;
   else evidence.publicCommands.committed++;
   return result;
  }catch(error){evidence.publicCommands.rejected++;throw error;}
 }
 function world(payload){return command('srWorldCommand',payload);}
 function step(count=1){for(let i=0;i<count;i++)SIM.tick(s,.1);}
 function until(predicate,label,max=6000){
  let elapsed=0;
  while(!predicate(s)&&elapsed++<max)step();
  assert(predicate(s),`${label} did not complete within ${max} world ticks`);
  return elapsed;
 }
 function settle(){return until(v=>!v.srWorld.activeTravelId&&!v.srWorld.interaction,'world activity');}
 function move(x,y){world({action:'move',x,y});settle();}
 function read(label){
  const raw=JSON.stringify(s);
  const restored=SIM.validateSave(JSON.parse(raw));
  assert.equal(JSON.stringify(restored),raw,`${label}: exact JSON readback`);
  s=restored;
  evidence.exactSaveReads++;
  checkpoints[label]=raw;
  return restored;
 }
 return {get state(){return s;},command,send,world,step,until,settle,move,read};
}

function resourceTotals(s){
 const result={};
 for(const key of Object.keys(s.resources)){
  result[key]=Object.values(s.stockpilesById).reduce((sum,stock)=>sum+(stock.resources[key]||0),0);
  if(s.srWorld.interaction?.kind==='content')result[key]+=s.srWorld.interaction.cost[key]||0;
 }
 return result;
}
function sameTotals(actual,expected,label){
 for(const key of Object.keys(expected))assert(Math.abs(actual[key]-expected[key])<1e-8,`${label}: ${key} conserved`);
}
function card(s){return SIM.viewSRWorld(s).content.cards.find(item=>item.id===CARD_ID);}
function rejectWithoutChange(h,operation,pattern){
 const before=JSON.stringify(h.state);
 assert.throws(operation,pattern);
 assert.equal(JSON.stringify(h.state),before,'rejected public command preserves authoritative state');
}
function panel(s){
 const before=JSON.stringify(s),html=renderSRPanel(s,SIM,'explore');
 assert.equal(JSON.stringify(s),before,'read-only panel does not advance or mutate the world');
 return html;
}

const opening=harness(SIM.initial({sr:true,seed:618033}));
opening.command('masterAction','heal');
opening.until(s=>s.master.wound===0,'normal healing');
opening.command('advanceStory');
opening.until(s=>s.srWorld.knownScenes.includes('scene:market'),'market discovery');
opening.world({action:'travel',destination:'scene:market'});
opening.settle();
opening.step();
const openingTravel=Object.values(opening.state.travelsById).find(travel=>travel.destination==='scene:market'&&travel.loadedCargo);
assert.equal(openingTravel.loadedCargo.wood,10,'wood is packed from the actual opening store');
assert.equal(openingTravel.loadedCargo.food,12,'food is packed from the actual opening store');
assert.equal(opening.state.master.location.sceneId,'scene:market');
assert.deepEqual(opening.state.srWorldContent.records[CARD_ID].status,'offered');
assert.equal(card(opening.state).personId,'person:gu-wanyi');
assert.equal(card(opening.state).personName,'顾婉仪');
assert.match(card(opening.state).publicRequest,/救急用药需要木架与行粮补给/);
assert.deepEqual(card(opening.state).cost,{wood:4,food:2});
assert.deepEqual(card(opening.state).reward,{herb:8});
assert.equal(card(opening.state).terms,null,'unverified terms are not disclosed');
assert.equal(opening.state.stockpilesById[BANK_ID].resources.herb,8);
assert.match(panel(opening.state),/溪口药材互助/);
assert.match(panel(opening.state),/顾婉仪/);
assert.match(panel(opening.state),/救急用药需要木架与行粮补给/);
opening.read('offered');
evidence.branches.opening={worldTick:opening.state.worldTick,sceneId:opening.state.master.location.sceneId,cardStatus:card(opening.state).status,guStockHerb:opening.state.stockpilesById[BANK_ID].resources.herb};

const normal=harness(SIM.validateSave(JSON.parse(checkpoints.offered)));
rejectWithoutChange(normal,()=>normal.world({action:'content',cardId:CARD_ID,choice:'accept'}),/同地三米/);
normal.move(33,27);
normal.read('beside-gu');
const party=normal.state.stockpilesById['stockpile:sr-party'];
const atMeeting={wood:party.resources.wood,food:party.resources.food,herb:party.resources.herb};
const verifyRequest={name:'srWorldCommand',args:[{action:'content',cardId:CARD_ID,choice:'verify'}],id:`command:sr017-gu:${++nextCommand}`};
normal.send(verifyRequest);
assert.equal(normal.send(verifyRequest).status,'already-applied');
normal.read('verifying');
normal.step(34);
assert.equal(normal.state.srWorldContent.records[CARD_ID].verified,false);
normal.read('before-verified');
normal.step();
assert.equal(normal.state.srWorldContent.records[CARD_ID].verified,true);
assert.deepEqual(card(normal.state).terms,{});
assert.equal(normal.state.stockpilesById['stockpile:sr-party'].resources.food,atMeeting.food-1);
normal.read('verified');
const beforeExchange=resourceTotals(normal.state);
const seller=normal.state.stockpilesById[BANK_ID];
const sellerBefore={wood:seller.resources.wood,food:seller.resources.food,herb:seller.resources.herb};
const acceptRequest={name:'srWorldCommand',args:[{action:'content',cardId:CARD_ID,choice:'accept'}],id:`command:sr017-gu:${++nextCommand}`};
normal.send(acceptRequest);
assert.equal(normal.send(acceptRequest).status,'already-applied');
normal.read('delivering');
normal.step(59);
assert.equal(normal.state.srWorldContent.records[CARD_ID].status,'verified');
normal.read('before-delivered');
normal.step();
assert.equal(normal.state.srWorldContent.records[CARD_ID].status,'completed');
const source=normal.state.stockpilesById['stockpile:sr-party'];
const settledSeller=normal.state.stockpilesById[BANK_ID];
assert.equal(source.resources.wood,atMeeting.wood-4);
assert.equal(source.resources.food,atMeeting.food-3);
assert.equal(source.resources.herb,atMeeting.herb+8);
assert.equal(settledSeller.resources.wood,sellerBefore.wood+4);
assert.equal(settledSeller.resources.food,sellerBefore.food+2);
assert.equal(settledSeller.resources.herb,sellerBefore.herb-8);
sameTotals(resourceTotals(normal.state),beforeExchange,'completed exchange');
assert.equal(normal.state.factsById[`fact:content:${CARD_ID}:result`].personId,'person:gu-wanyi');
assert.equal(normal.state.srWorldContent.completedOrder.filter(id=>id===CARD_ID).length,1);
rejectWithoutChange(normal,()=>normal.world({action:'content',cardId:CARD_ID,choice:'accept'}),/已结束/);
assert.equal(normal.send(acceptRequest).status,'already-applied');
normal.read('completed');
assert.equal(card(normal.state).status,'completed');
assert.match(panel(normal.state),/已完成/);
evidence.branches.normal={verifiedTick:normal.state.factsById[`fact:content:${CARD_ID}:verified`].atTick,completedTick:normal.state.worldTick,guStockHerb:normal.state.stockpilesById[BANK_ID].resources.herb,resultFacts:1};

const interrupted=harness(SIM.validateSave(JSON.parse(checkpoints.offered)));
interrupted.move(33,27);
const originalTotals=resourceTotals(interrupted.state);
interrupted.world({action:'content',cardId:CARD_ID,choice:'accept'});
interrupted.step(20);
interrupted.read('partial-delivery');
interrupted.world({action:'cancel'});
assert.equal(interrupted.state.srWorld.interaction,null);
assert.equal(interrupted.state.srWorldContent.records[CARD_ID].status,'offered');
assert(!interrupted.state.factsById[`fact:content:${CARD_ID}:result`]);
sameTotals(resourceTotals(interrupted.state),originalTotals,'cancelled exchange');
rejectWithoutChange(interrupted,()=>interrupted.world({action:'cancel'}),/没有世界活动/);
interrupted.read('cancelled');
interrupted.world({action:'content',cardId:CARD_ID,choice:'accept'});
interrupted.settle();
assert.equal(interrupted.state.srWorldContent.records[CARD_ID].status,'completed');
assert.equal(interrupted.state.stockpilesById[BANK_ID].resources.herb,0);
sameTotals(resourceTotals(interrupted.state),originalTotals,'resumed exchange');
interrupted.read('resumed');
evidence.branches.cancelResume={cancelFactCount:Object.keys(interrupted.state.factsById).filter(id=>id.startsWith('fact:content-cancel:')).length,completedOnce:interrupted.state.srWorldContent.completedOrder.filter(id=>id===CARD_ID).length===1};

const shortage=harness(SIM.validateSave(JSON.parse(checkpoints.offered)));
shortage.until(s=>s.personsById['person:merchant-qingxi'].position?.sceneId==='scene:market','merchant returns to market');
shortage.move(37,25);
const sold=shortage.command('marketTrade','wood','sell',1).result;
assert.equal(sold.quantity,10);
shortage.move(33,27);
assert.equal(shortage.state.stockpilesById['stockpile:sr-party'].resources.wood,0);
rejectWithoutChange(shortage,()=>shortage.world({action:'content',cardId:CARD_ID,choice:'accept'}),/身边实际物资不足/);
shortage.read('shortage');
shortage.move(37,25);
const bought=shortage.command('marketTrade','wood','buy',1).result;
assert.equal(bought.quantity,10);
shortage.move(33,27);
shortage.world({action:'content',cardId:CARD_ID,choice:'accept'});
shortage.settle();
assert.equal(shortage.state.srWorldContent.records[CARD_ID].status,'completed');
assert.equal(shortage.state.stockpilesById[BANK_ID].resources.herb,0);
shortage.read('shortage-recovered');
evidence.branches.shortageRecovery={woodSold:sold.quantity,woodBought:bought.quantity,completedOnce:shortage.state.srWorldContent.completedOrder.filter(id=>id===CARD_ID).length===1};

if(outputDir){
 await mkdir(outputDir,{recursive:true});
 for(const name of ['offered','beside-gu','verified','delivering','completed','cancelled','resumed','shortage','shortage-recovered']){
  await writeFile(`${outputDir}/sr017-gu-${name}.json`,checkpoints[name]+'\n');
 }
 await writeFile(`${outputDir}/sr017-gu-evidence.json`,JSON.stringify(evidence,null,2)+'\n');
}
console.log(JSON.stringify(evidence,null,2));
