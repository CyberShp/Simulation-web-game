import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../../../src/simulation/ea-data.mjs';
import {initial} from '../../../src/simulation/ea-opening-sim.mjs';
import {createGodotBridge} from '../../../src/simulation/ea-godot-bridge.mjs';
import {openingGoal,materialShortages} from '../../../archive/godot/estate_3d/web/opening-goal.mjs';

const HOME='scene:yunxiu-courtyard',VALLEY='scene:valley';
const sites=JSON.parse(readFileSync(new URL('../../../archive/godot/estate_2d/estate-sites.json',import.meta.url))).sites;
const options={sites,alchemyCost:BUILDINGS.alchemy.cost};
const read=state=>openingGoal(state,options);
const siteBuilding=(siteId,id)=>({id,...sites.find(site=>site.id===siteId),id,stage:'complete',condition:100});
function afterHarvest() {
  return {sceneId:HOME,masterId:'person:master',roster:[{role:'master',wound:0,energy:80}],
    resources:{jade:60,wood:25,stone:25,herb:4},
    openingHallPhase:'complete',openingStory:{step:2,invitation:'joined'},herbTerrace:{lastHarvest:{quantity:13.8}},
    buildings:[siteBuilding('site:main-house','1'),siteBuilding('site:herb-terrace','2')],
    crafting:{workstation:null,orders:[]},inventory:{stockpiles:[
      {id:'stockpile:yunxiu',access:'public',ownerId:'person:master',resources:{jade:60,wood:25,stone:25,herb:4},pills:{heal:0}},
      {id:'stockpile:carried:master',access:'private',ownerId:'person:master',resources:{},pills:{heal:0}},
      {id:'stockpile:sr-party',access:'public',resources:{},pills:{heal:0}},
    ],transports:[]},openingJourney:{healingCrafted:false,valleyGathered:false,firstBattle:null},world:{objects:[]}};
}
const stock=(state,id)=>state.inventory.stockpiles.find(item=>item.id===id);
function addFurnace(state) {
  state.buildings.push(siteBuilding('site:alchemy-court','3'));
  state.crafting.workstation={stockpileId:'stockpile:building:3'};
  state.inventory.stockpiles.push({id:'stockpile:building:3',access:'public',resources:{herb:10},pills:{heal:0}});
}
function freeze(value) {Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return value;}

test('real opening snapshot stays read-only and the established early sequence remains before the furnace',()=>{
  const bridge=createGodotBridge({state:initial({sr:true,mountainOpening:true}),sites});
  const saved=bridge.save();
  assert.equal(read(bridge.snapshot()).action.target,'heal');
  assert.equal(bridge.save(),saved);
  const state=afterHarvest();
  state.openingHallPhase='shelter';state.openingStory={visitor:{canTalk:false},step:0,invitation:'unasked',gifted:false};
  assert.equal(read(state).action.target,'clues');
  state.openingStory.step=1;
  assert.equal(read(state).id,'opening-gift');
  state.openingStory.gifted=true;
  assert.equal(read(state).id,'hall-site');
  state.openingHallPhase='building';assert.equal(read(state).id,'hall-building');
  state.openingHallPhase='complete';assert.equal(read(state).id,'opening-invite');
  state.openingStory.invitation='joined';state.herbTerrace={herbOnSite:0,seedNeeded:2};
  assert.equal(read(state).id,'farm-seeds');
  state.herbTerrace.seedTransports=[{phase:'carrying'}];assert.equal(read(state).id,'farm-seeds-moving');
  state.herbTerrace.seedTransports=[];state.herbTerrace.herbOnSite=2;assert.equal(read(state).id,'farm-care');
  state.herbTerrace.crop={phase:'paused:waterlogged'};assert.equal(read(state).id,'farm-crop');
  state.herbTerrace.lastHarvest={quantity:13.8};assert.equal(read(state).id,'alchemy-site');
});

test('construction shortages use current public amounts and are not funded by carried materials',()=>{
  const state=afterHarvest();
  stock(state,'stockpile:carried:master').resources={wood:40,stone:10};
  assert.deepEqual(materialShortages(stock(state,'stockpile:yunxiu').resources,BUILDINGS.alchemy.cost),[
    {resource:'jade',amount:5},{resource:'wood',amount:10},{resource:'stone',amount:5},
  ]);
  assert.equal(read(state).action.target,'site:alchemy-court');
  assert.match(read(state).copy,/灵石 5/);
  assert.match(read(state).copy,/木料 10/);
  assert.match(read(state).copy,/石料 5/);
  assert.deepEqual(materialShortages({jade:64.2},{jade:65}),[{resource:'jade',amount:.8}]);
});

test('active building, harvesting, transport and firing retain their actual stage',()=>{
  const state=afterHarvest();addFurnace(state);
  state.buildings[2].stage='foundation';
  state.construction={buildingId:'3',progress:.15};
  assert.equal(read(state).id,'construction');
  assert.equal(read(state).action.target,'site:alchemy-court');
  state.construction=null;
  assert.equal(read(state).id,'alchemy-site');
  state.buildings[2].stage='complete';state.harvest={activity:{resource:'wood',phase:'working'}};
  assert.equal(read(state).action.target,'sect');assert.equal(read(state).action.params.resource,'wood');
  state.harvest=null;
  state.inventory.transports=[{phase:'carrying',carrierId:state.masterId,sourceStockpileId:'stockpile:yunxiu',targetStockpileId:'stockpile:building:3',cargo:{herb:10}}];
  assert.equal(read(state).id,'transport');assert.equal(read(state).action.target,'crafts');
  state.inventory.transports[0].phase='delivered';
  state.crafting.orders=[{phase:'active',recipeId:'heal',activityPhase:'working'}];
  assert.equal(read(state).id,'crafting');
  state.crafting.orders[0]={phase:'completed',recipeId:'qi'};
  assert.equal(read(state).id,'first-healing-craft');
});

test('furnace and public pills are not carried pills; a collection in flight stays pending',()=>{
  const state=afterHarvest();addFurnace(state);state.openingJourney.healingCrafted=true;
  const furnace=stock(state,'stockpile:building:3'),carried=stock(state,'stockpile:carried:master');
  furnace.pills.heal=2;
  assert.equal(read(state).id,'carry-healing');assert.equal(read(state).action.target,'crafts');
  furnace.pills.heal=1;state.inventory.transports=[{phase:'carrying',carrierId:state.masterId,sourceStockpileId:furnace.id,targetStockpileId:carried.id,cargo:{'pill:heal':1}}];
  assert.equal(read(state).id,'transport');
  state.inventory.transports[0].phase='delivered';carried.pills.heal=1;
  assert.equal(read(state).id,'depart-valley');
  assert.deepEqual(read(state).action.params,{kind:'route',id:VALLEY});
  carried.pills.heal=0;furnace.pills.heal=0;stock(state,'stockpile:yunxiu').pills.heal=2;
  assert.equal(read(state).id,'carry-healing');assert.equal(read(state).action.target,'bag');
  stock(state,'stockpile:yunxiu').pills.heal=0;
  assert.equal(read(state).id,'replenish-healing');
});

test('valley guidance only targets supplied public objects and returns after a settled battle',()=>{
  const state=afterHarvest();state.sceneId=VALLEY;
  assert.equal(read(state).id,'valley-explore');
  assert.equal(read(state).action.params,undefined);
  state.world.objects=[{id:'seen-herbs',name:'溪边药丛',resourceRemaining:18,choices:[{action:'gather'}]},
    {id:'seen-beast',name:'山魈',choices:[{action:'engage'}]}];
  assert.equal(read(state).action.params.id,'seen-herbs');
  state.world.activity={kind:'gather'};assert.equal(read(state).id,'valley-activity');
  state.world.activity=null;state.openingJourney.valleyGathered=true;
  assert.equal(read(state).action.params.id,'seen-beast');
  state.combat={status:'active'};assert.equal(read(state).action,null);
  state.combat=null;state.openingJourney.firstBattle={result:'retreated',atTick:8134};
  assert.equal(read(state).id,'return-home');
  assert.deepEqual(read(state).action.params,{kind:'route',id:HOME});
});

test('returning wounded with four public herbs opens carried medicine; missing medicine has an actionable recovery route',()=>{
  const state=afterHarvest();state.roster[0].wound=2.06;state.openingJourney.firstBattle={result:'retreated',atTick:8134};
  const carried=stock(state,'stockpile:carried:master'),publicStock=stock(state,'stockpile:yunxiu');
  carried.pills.heal=1;
  assert.equal(read(state).id,'heal-pill');
  assert.equal(read(state).action.target,'bag');assert.deepEqual(read(state).action.params,{pill:'heal'});
  carried.pills.heal=0;publicStock.resources.herb=6;assert.equal(read(state).action.target,'heal');
  publicStock.resources.herb=4;assert.equal(read(state).action.target,'sect');
  carried.resources.herb=2;assert.equal(read(state).action.target,'bag');
  assert.equal(read(state).action.params.selected,'herb');
  carried.resources.herb=0;stock(state,'stockpile:sr-party').resources.herb=6;
  assert.equal(read(state).action.target,'world');
});

test('victory and retreat finish after healthy return and actual cargo delivery, without requiring medicine use',()=>{
  for(const result of ['won','retreated']) {
    const state=afterHarvest();state.openingJourney.firstBattle={result,atTick:8134};
    const party=stock(state,'stockpile:sr-party');party.resources={herb:6,food:3};
    assert.equal(read(state).id,'home-cargo');
    party.resources={};state.inventory.transports=[{phase:'carrying',carrierId:state.masterId,sourceStockpileId:party.id,targetStockpileId:'stockpile:yunxiu',cargo:{herb:6,food:3}}];
    assert.equal(read(state).id,'home-cargo');
    state.inventory.transports[0].phase='delivered';
    const saved=JSON.stringify(state),restored=JSON.parse(saved);
    assert.equal(read(freeze(state)).id,'opening-complete');
    assert.deepEqual(read(restored),read(state));
    assert.equal(JSON.stringify(state),saved);
  }
});
