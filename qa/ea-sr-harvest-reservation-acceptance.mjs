/** SR-XF-009/010 component boundary fixtures; not a normal-play progression claim. */
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {harvestAvailable,consumeHarvest} from '../dist/ea-sr-economy.mjs';

function fixture(quantity){const s=S.initial({sr:true});s.master.wound=0;s.master.energy=90;s.srEconomy.patches.herb.remaining=quantity;return s;}
function command(s,name,...args){return S.dispatchCommand(s,{name,args}).state;}
const short=fixture(9),before=JSON.stringify(short);
assert.throws(()=>command(short,'startMasterHarvest','herb'),/整批来源不足/);
assert.equal(JSON.stringify(short),before);
console.log('PASS full batch required before physical harvest starts; rejection is atomic');

let s=command(fixture(10),'startMasterHarvest','herb');
const activityId=s.master.activityId;
assert.equal(s.activitiesById[activityId].reservedQuantity,10);
assert.equal(harvestAvailable(s,'herb',1),false);
assert.equal(consumeHarvest(s,'herb',1),false);
assert.equal(s.srEconomy.patches.herb.remaining,10);
s=S.validateSave(JSON.parse(JSON.stringify(s)));
assert.equal(harvestAvailable(s,'herb',1),false);
for(let n=0;n<3000&&s.activitiesById[activityId];n++)S.tick(s,.1);
assert.equal(s.activitiesById[activityId],undefined);
assert.equal(s.srEconomy.patches.herb.remaining,0);
assert.equal(s.stockpilesById['stockpile:carried:master'].resources.herb,10);
assert.equal(s.factsById['fact:manual-harvest:'+activityId].quantity,10);
S.validateSave(JSON.parse(JSON.stringify(s)));
console.log('PASS reserved source survives reload and competing consumption; actual harvest settles once into carried stock');

s=command(fixture(10),'startMasterHarvest','herb');
s=command(s,'cancelMasterHarvest');
assert.equal(harvestAvailable(s,'herb',10),true);
assert.equal(s.srEconomy.patches.herb.remaining,10);
assert.equal(consumeHarvest(s,'herb',10),true);
assert.equal(consumeHarvest(s,'herb',1),false);
console.log('PASS cancelling releases unconsumed source without creating or refunding resources');

console.log(JSON.stringify({suite:'sr-harvest-reservation',passed:3,failed:0,scope:'explicit component source/body fixtures; public command and clock execution'}));
