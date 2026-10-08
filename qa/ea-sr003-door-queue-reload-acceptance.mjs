/** SR-XF-003: completed construction keeps door ownership saveable. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

test('normal house, three recruits, and workshop preserve exact door queue reload',()=>{
 const h=normalOpening();
 h.build('house');
 for(let n=0;n<3;n++){h.resources({jade:70,herb:10,food:10});h.act('recruit');}
 h.build('workshop');
 const s=h.s,person=s.personsById['person:lin-changfeng'],entryId='building:yunxiu:5/entry:south';
 assert.equal(s.worldTick,20315);
 assert(!s.spatial.doorQueuesByEntryId?.[entryId]?.waiting.some(w=>w.personId===person.personId));
 assert.equal(s.activitiesById[person.activityId]?.kind,'facility','the original bed activity remains');
 const saved=JSON.stringify(s),loaded=S.validateSave(JSON.parse(saved));
 assert.equal(JSON.stringify(loaded),saved,'normal public construction reload is exact');

 const stale={entryId,personId:person.personId,firstArrivalTick:s.worldTick,activityId:person.activityId,target:{x:22.316666666666666,y:17},phase:'in'};
 s.spatial.doorQueuesByEntryId??={};s.spatial.doorQueuesByEntryId[entryId]={entryId,holder:null,waiting:[stale],lastPassTick:-1};
 const feet={x:person.mind.scenic.x,y:person.mind.scenic.y},activityId=person.activityId;
 S.tick(s,.1);
 assert(!s.spatial.doorQueuesByEntryId?.[entryId]?.waiting.some(w=>w.firstArrivalTick===stale.firstArrivalTick&&w.personId===stale.personId),'the next real world step removes an obsolete arrival');
 assert.equal(person.activityId,activityId);
 assert(Math.hypot(person.mind.scenic.x-feet.x,person.mind.scenic.y-feet.y)<=.13+1e-6,'body movement remains physically bounded');
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(JSON.stringify(s)))),JSON.stringify(s));
});
