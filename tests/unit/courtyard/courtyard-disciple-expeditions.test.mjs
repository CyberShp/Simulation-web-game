import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {setDiscipleExpeditions,advanceDiscipleExpeditions,validateDiscipleExpeditions,discipleExpeditionsView} from '../../../src/simulation/ea-disciple-expeditions.mjs';

test('closed expedition policy does not create records or consume supplies',()=>{
 const session=createSectSession(),s=session.state,before=structuredClone(s);
 assert.equal(discipleExpeditionsView(s).enabled,false);
 advanceDiscipleExpeditions(s);
 assert.deepEqual(s,before);
 assert.equal(validateDiscipleExpeditions(s),true);
});

test('policy requires explicit boolean and persists through the normal session codec',()=>{
 const session=createSectSession(),s=session.state;
 assert.throws(()=>setDiscipleExpeditions(s,{enabled:'true'}));
 setDiscipleExpeditions(s,{enabled:true});
 assert.equal(discipleExpeditionsView(s).enabled,true);
 const saved=snapshotSect(session),loaded=restoreSect(saved);
 assert.deepEqual(loaded.state.discipleExpeditions,s.discipleExpeditions);
 assert.equal(validateDiscipleExpeditions(loaded.state),true);
 setDiscipleExpeditions(loaded.state,{enabled:false});
 assert.equal(discipleExpeditionsView(loaded.state).enabled,false);
});

test('insufficient residents or supplies prevents departure without paying preparation cost',()=>{
 for(const reason of ['residents','supplies']){
  const {state:s}=createSectSession();
  if(reason==='residents')s.disciples.splice(1);
  else s.resources.food=0;
  setDiscipleExpeditions(s,{enabled:true});const food=s.resources.food;
  s.worldTick++;advanceDiscipleExpeditions(s);
  assert.equal(s.discipleExpeditions.journeys.length,0);
  assert.equal(s.resources.food,food);
 }
});
