import test from 'node:test';
import assert from 'node:assert/strict';
import {spiritSourcePersonBusy} from '../../../src/simulation/ea-spirit-sources.mjs';
import {MEDITATION_SUPPLY_VERSION} from '../../../src/simulation/ea-meditation-definitions.mjs';

test('legacy worlds without activity tables remain readable without changing the old world',()=>{
 const legacy={master:{action:'rest'},buildings:[]},before=structuredClone(legacy);
 assert.equal(spiritSourcePersonBusy(legacy,legacy.master),false);assert.equal(spiritSourcePersonBusy(legacy),false);assert.deepEqual(legacy,before);
});
test('current survey and real meditation work remain occupied; other activities stay distinct',()=>{
 const s={activitiesById:{survey:{kind:'sr-spirit-survey'},work:{kind:'facility',action:'work',targetId:'meditation'},rest:{kind:'facility',action:'rest',targetId:'meditation'},other:{kind:'facility',action:'work',targetId:'lumber'}},buildingsById:{meditation:{type:'meditation',meditationSupplyVersion:MEDITATION_SUPPLY_VERSION},lumber:{type:'lumber'}}},before=structuredClone(s);
 assert.equal(spiritSourcePersonBusy(s,{activityId:'survey'}),true);assert.equal(spiritSourcePersonBusy(s,{activityId:'work'}),true);assert.equal(spiritSourcePersonBusy(s,{activityId:'rest'}),false);assert.equal(spiritSourcePersonBusy(s,{activityId:'other'}),false);assert.equal(spiritSourcePersonBusy(s,{activityId:'missing'}),false);assert.deepEqual(s,before);
});
