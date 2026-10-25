import test from 'node:test';
import assert from 'node:assert/strict';
import {expeditionPartyPlan} from '../../../apps/courtyard/courtyard-expedition-party.mjs';
import {combatBackdrop} from '../../../apps/courtyard/courtyard-combat-backdrops.mjs';
import {worldSceneObjectsSR,sceneObjectNearSR} from '../../../src/simulation/ea-sr-world.mjs';

const party={maxCompanions:2,candidates:[{personId:'person:lu-zhiwei',name:'陆知微',available:true,reason:'愿意同行'},{personId:'person:lin-changfeng',name:'林长风',available:true,reason:'愿意同行'},{personId:'person:busy',name:'在途门人',available:false,reason:'本人另有行程'}]};
test('departure begins as a solo local plan without selecting or changing any willing person',()=>{
 const before=structuredClone(party),plan=expeditionPartyPlan(party);assert.deepEqual(plan.selected,[]);assert.equal(plan.available,true);assert.equal(plan.label,'掌门独行出谷');assert.deepEqual(party,before);
 const invited=expeditionPartyPlan(party,['person:lu-zhiwei']);assert.deepEqual(invited.selected,['person:lu-zhiwei']);assert.equal(invited.available,true);assert.equal(invited.label,'与1位门人出谷');assert.deepEqual(party,before);
});
test('a changed or missing candidate retains the requested selection and explains why departure needs a new choice',()=>{
 const selected=['person:lu-zhiwei'],changed={...party,candidates:party.candidates.map(p=>p.personId===selected[0]?{...p,available:false,reason:'本人另有行程'}:p)},plan=expeditionPartyPlan(changed,selected);
 assert.equal(plan.available,false);assert.deepEqual(plan.selected,selected);assert.match(plan.reason,/陆知微.*本人另有行程/);assert.equal(expeditionPartyPlan({...party,candidates:[]},selected).available,false);
 assert.equal(expeditionPartyPlan(changed,[]).available,true,'the player can explicitly choose to travel alone');
});
test('the projected party limit and exact stable person identities govern the local invitation plan',()=>{
 const selected=['person:lu-zhiwei','person:lin-changfeng'],plan=expeditionPartyPlan(party,selected);assert.equal(plan.available,true);assert.deepEqual(plan.selected,selected);
 assert.equal(expeditionPartyPlan({...party,maxCompanions:1},selected).available,false);assert.equal(expeditionPartyPlan(party,['person:busy']).available,false);assert.deepEqual(expeditionPartyPlan(party,[selected[0],selected[0]]).selected,[selected[0]]);
});
test('the prison geometry selects its own painted ground while the forest keeps its existing registration',()=>{
 const prison=combatBackdrop({geometryId:'prison-forecourt'}),compatibility=combatBackdrop({sceneFrame:{geometryId:'prison-forecourt'}}),forest=combatBackdrop({geometryId:'legacy'});
 assert.equal(prison.image,'prison-forecourt-v1.png');assert.equal(compatibility,prison);assert.equal(forest.image,'valley-battlefield-v2.png');assert.equal(prison.exitLabel,'← 西侧退路');assert.deepEqual(prison.clearGround,forest.clearGround);
});
test('the rescue entrance projects formal edge proximity and the existing cultivation prerequisite without changing the world',()=>{
 const state={master:{realm:10,location:{kind:'local',sceneId:'scene:prison',x:26,y:20.5}},story:{preparations:{witness:false}},personsById:{'person:shen-witness':{lifeStatus:'alive'}}},before=structuredClone(state),foe=worldSceneObjectsSR(state,'scene:prison').find(object=>object.encounterId);
 assert.equal(foe.id,'object:prison:gate');assert.deepEqual(foe.approach,{x:26,y:20.5});assert.equal(foe.available,true);assert.equal(foe.near,true);assert(Math.hypot(state.master.location.x-foe.x,state.master.location.y-foe.y)>foe.interactionRadius);assert.equal(sceneObjectNearSR(state.master.location,foe),true);assert.equal(sceneObjectNearSR({x:26,y:25},foe),false);assert.deepEqual(state,before);
 const low=worldSceneObjectsSR({...state,master:{...state.master,realm:7}},'scene:prison').find(object=>object.encounterId);assert.equal(low.available,false);assert.match(low.reason,/筑基/);
 const rescued=worldSceneObjectsSR({...state,story:{preparations:{witness:true}}},'scene:prison').find(object=>object.encounterId);assert.equal(rescued.available,false);assert.match(rescued.reason,/已获救/);
});
