import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {localMarketQuote,merchantPresent} from '../../../src/simulation/ea-sr-economy.mjs';

const MASTER='person:master',MERCHANT='person:merchant-qingxi',HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master',MARKET='stockpile:qingxi';
const copy=x=>JSON.parse(JSON.stringify(x));
function harness(source=seed.state){
 let state=SIM.validateSave(copy(source));
 return {get s(){return state;},dispatch(command){const result=SIM.dispatchCommand(state,command);state=result.state;return result;},act(name,...args){const result=SIM.dispatchCommand(state,{name,args});state=result.state;return result.result;},
  until(predicate,label,max=5000){for(let n=0;n<max&&!predicate(state);n++)SIM.tick(state,.1);assert.ok(predicate(state),label);},
  save(){const raw=JSON.stringify(state);state=SIM.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(state),raw);return state;}};
}
let normalSource;
function ready(){
 if(!normalSource){
  const h=harness();const order=h.act('startTransport',HOME,CARRIED,MASTER,{stone:20});
  h.until(s=>s.workOrdersById[order.id].phase==='delivered','physical stone pickup');h.save();
  h.act('moveScenicMaster',30,13.6);
  h.until(s=>merchantPresent(s)&&!s.master.scenic.path.length,'actual approach to the existing visiting merchant');
  normalSource=copy(h.save());
 }
 return harness(normalSource);
}
const quote=(s,extra={})=>localMarketQuote(s,{resource:'stone',side:'sell',batches:2,stockpileId:CARRIED,...extra});
const totals=s=>Object.fromEntries(['stone','jade','food'].map(k=>[k,Object.values(s.stockpilesById).reduce((n,st)=>n+(st.resources[k]||0),0)]));
function rejected(h,extra={},pattern){
 const before=JSON.stringify(h.s),args={resource:'stone',side:'sell',batches:2,stockpileId:CARRIED,...extra},v=localMarketQuote(h.s,args);
 assert.equal(v.available,false);if(pattern)assert.match(v.reason,pattern);
 assert.throws(()=>h.act('marketTrade',args.resource,args.side,args.batches,{stockpileId:args.stockpileId}));
 assert.equal(JSON.stringify(h.s),before,'rejected trade preserves source state');
}

test('public pickup and approach permit one physical sale; money reaches home only after actual return transport',()=>{
 const h=ready(),before=JSON.stringify(h.s),home=copy(h.s.stockpilesById[HOME].resources),sum=totals(h.s);
 for(let n=0;n<3;n++){
  const v=quote(h.s);assert.equal(v.available,true,v.reason);assert.equal(v.quantity,20);assert.equal(v.price,18);assert.equal(v.maxBatches,2);
 }
 assert.equal(JSON.stringify(h.s),before,'quote never initializes or changes world facts');
 const command={name:'marketTrade',args:['stone','sell',2,{stockpileId:CARRIED}],id:`command:${h.s.transactions.nextCommandId}`,expectedRevision:h.s.revision};
 const result=h.dispatch(command).result;
 assert.equal(h.s.stockpilesById[CARRIED].resources.stone,0);assert.equal(h.s.stockpilesById[CARRIED].resources.jade,18);
 assert.deepEqual(h.s.stockpilesById[HOME].resources,home);assert.deepEqual(totals(h.s),sum);
 const fact=h.s.factsById[result.id];assert.equal(fact.sourceStockpileId,CARRIED);assert.equal(fact.targetStockpileId,MARKET);assert.equal(fact.quantity,20);
 h.save();const committed=JSON.stringify(h.s);h.dispatch(command);assert.equal(JSON.stringify(h.s),committed,'retry of the same receipt never exchanges goods or money twice');
 const tradeCount=h.s.srEconomy.tradeHistory.length;rejected(h,{},/物资|不足/);assert.equal(h.s.srEconomy.tradeHistory.length,tradeCount);
 const transfer=h.act('startTransport',CARRIED,HOME,MASTER,{jade:18});h.until(s=>s.workOrdersById[transfer.id].phase==='carrying','actual payment in transit');
 assert.equal(h.s.stockpilesById[HOME].resources.jade,home.jade);h.save();
 h.until(s=>s.workOrdersById[transfer.id].phase==='delivered','payment delivered to construction treasury');
 assert.equal(h.s.stockpilesById[HOME].resources.jade,home.jade+18);h.save();
});

test('physical buying exchanges carried money for finite merchant goods with exact save/load',()=>{
 const h=ready();h.act('marketTrade','stone','sell',2,{stockpileId:CARRIED});const sum=totals(h.s),home=copy(h.s.stockpilesById[HOME].resources);
 const v=quote(h.s,{resource:'food',side:'buy',batches:1});assert.equal(v.available,true,v.reason);
 h.act('marketTrade','food','buy',1,{stockpileId:CARRIED});
 assert.equal(h.s.stockpilesById[CARRIED].resources.food,10);assert.equal(h.s.stockpilesById[CARRIED].resources.jade,18-v.price);
 assert.deepEqual(totals(h.s),sum);assert.deepEqual(h.s.stockpilesById[HOME].resources,home);h.save();
});

// The following direct edits are isolated rejection fixtures, not normal play.
test('explicit local trade rejects a remote store, another owner and nonphysical goods',()=>{
 rejected(ready(),{stockpileId:HOME},/随身|货位|现场/);
 const privateOwner=ready();privateOwner.s.stockpilesById[CARRIED].ownerId='person:lu-zhiwei';rejected(privateOwner,{},/产权|本人|随身/);
 rejected(ready(),{resource:'insight'},/实物|交易|物资/);
});

test('distance, visitor departure and an existing body commitment cannot be bypassed by an old quote',()=>{
 const distant=ready();assert.equal(quote(distant.s).available,true);distant.act('moveScenicMaster',29,25);
 distant.until(s=>!s.master.scenic.path.length,'walk away from merchant');rejected(distant,{},/商人|现场|身边/);
 const departed=ready();departed.s.personsById[MERCHANT].position={kind:'worldTravel',travelId:'fixture:departed'};rejected(departed);
 const busy=ready(),transfer=busy.act('startTransport',CARRIED,HOME,MASTER,{stone:10});
 assert.equal(busy.s.workOrdersById[transfer.id].phase,'to-source');rejected(busy,{batches:1},/身体|履约|事务|搬运/);
});

test('finite cash, goods and final carried capacity bound quote and commit identically',()=>{
 const poor=ready();poor.s.stockpilesById[MARKET].resources.jade=8;rejected(poor,{batches:1},/本金|灵石/);assert.equal(quote(poor.s).maxBatches,0);
 const tight=ready();tight.s.stockpilesById[CARRIED].resources.crystal=20;
 // Crystal sells at a price that grows the occupied load; the unchanged 40-unit
 // bag cannot accept the payment even though it contains the goods offered.
 rejected(tight,{resource:'crystal',batches:1},/容量/);
 const empty=ready();empty.s.stockpilesById[MARKET].resources.food=0;rejected(empty,{resource:'food',side:'buy',batches:1},/现货/);
});
