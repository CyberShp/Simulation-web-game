/** SR-XF-008-I01: daily food supply gives each person's trust change one persistent source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {normalOpening, harness} from './ea-sr-integration-acceptance.mjs';
import {tickSociety} from '../dist/ea-society.mjs';

const supplyFacts=(s,dayIndex)=>Object.values(s.factsById).filter(f=>f.kind==='daily-supply-relation'&&f.dayIndex===dayIndex);

test('SR-XF-008-I01: an opening-era schema-6 save keeps its earlier relation baseline',()=>{
  const s=SIM.initial({sr:false}),before=s.personsById['person:lu-zhiwei'].mind.relationships.master.trust;
  for(let i=0;i<1500&&s.society.lastDay===0;i++)SIM.tick(s,.1);
  assert.equal(s.society.lastDay,1);
  assert.equal(supplyFacts(s,1).length,0,'the opening-era supply fallback has no formal daily supply record');
  const restored=SIM.validateSave(s);
  assert.equal(restored.personsById['person:lu-zhiwei'].mind.relationships.master.trust,before);
});

test('SR-XF-008-I01: real daily supply and shortage settle one fact per person and survive exact saves',()=>{
  const h=normalOpening(), firstDay=h.s.society.lastDay, ids=[...h.s.homeMemberIds];
  h.until(s=>s.society.lastDay>firstDay,'next actual daily meal',1500);
  const healthyDay=h.s.society.lastDay, healthyFacts=supplyFacts(h.s,healthyDay);
  assert.equal(healthyFacts.length,ids.length);
  for(const id of ids){const fact=healthyFacts.find(f=>f.personId===id);assert(fact?.supplied);assert.equal(fact.sourceDay,healthyDay);assert.equal(fact.starvation,0);assert.equal(fact.trustAfter-fact.trustBefore,fact.deltaTrust);}
  h.save();
  const quest=h.s.society.quests.find(q=>q.status==='offered');
  assert(quest,'a normal disciple has a public personal request');
  const questPerson=h.s.disciples.find(d=>d.id===quest.discipleId);
  const sameDayFact=healthyFacts.find(f=>f.personId===questPerson.personId),factSnapshot=structuredClone(sameDayFact);
  h.act('resolvePersonalQuest',quest.id,'decline');
  assert.notEqual(h.s.personsById[questPerson.personId].mind.relationships.master.trust,factSnapshot.trustAfter,'a later public decision may change trust on the same day');
  assert.deepEqual(h.s.factsById[factSnapshot.id],factSnapshot,'the earlier supply source keeps its own settled result');
  h.save();

  const farm=h.s.buildings.find(b=>b.type==='farm');
  assert(farm?.enabled,'the normal opening built an active food source');
  h.act('toggleBuilding',farm.id);
  h.until(s=>s.economy.starvation>0,'finite food runs out after disabling its real production source',9000);
  const hungryDay=h.s.society.lastDay, hungryFacts=supplyFacts(h.s,hungryDay);
  assert.equal(hungryFacts.length,ids.length);
  for(const id of ids){const fact=hungryFacts.find(f=>f.personId===id);assert(fact&&!fact.supplied);assert.equal(fact.sourceDay,hungryDay);assert.equal(fact.starvation,h.s.economy.starvation);assert.equal(fact.deltaTrust,Math.max(0,fact.trustBefore-2)-fact.trustBefore);}
  h.save();

  const replay=SIM.validateSave(JSON.parse(JSON.stringify(h.s))), before=new Map(ids.map(id=>[id,replay.personsById[id].mind.relationships.master.trust]));
  const count=supplyFacts(replay,hungryDay).length;
  replay.society.lastDay=hungryDay-1; // Explicit internal replay probe; the public path above never edits the state.
  tickSociety(replay,1);
  assert.equal(supplyFacts(replay,hungryDay).length,count,'the same day cannot create a second source fact');
  for(const id of ids)assert.equal(replay.personsById[id].mind.relationships.master.trust,before.get(id),'replaying the day cannot change that trust twice');

  const previous=JSON.parse(JSON.stringify(h.s));
  for(const [id,f]of Object.entries(previous.factsById))if(f.kind==='daily-supply-relation')delete previous.factsById[id];
  const oldRelation=new Map(ids.map(id=>[id,previous.personsById[id].mind.relationships.master.trust]));
  const migrated=harness(SIM.validateSave(previous),'legacy-relationship-baseline');
  migrated.save();
  for(const id of ids)assert.equal(migrated.s.personsById[id].mind.relationships.master.trust,oldRelation.get(id),'existing v1 trust remains a baseline');
  migrated.until(s=>s.society.lastDay>hungryDay,'first daily meal after a legacy relation baseline',1500);
  assert.equal(supplyFacts(migrated.s,migrated.s.society.lastDay).length,ids.length,'only new days receive new facts');
  migrated.save();

  const corrupted=structuredClone(h.s),fact=supplyFacts(corrupted,hungryDay)[0];
  corrupted.factsById[fact.id].sourceDay++;
  assert.throws(()=>SIM.validateSave(corrupted),/每日供给关系来源/,'broken source reference must be rejected');
  const wrongKind=structuredClone(h.s);
  wrongKind.factsById[fact.id].kind='unrelated';
  assert.throws(()=>SIM.validateSave(wrongKind),/每日供给关系来源/,'a daily source ID cannot be repurposed');
  console.log(JSON.stringify({publicCommands:h.counts.commands,exactSaveReads:h.counts.saves,healthyDay,hungryDay,people:ids.length}));
});
