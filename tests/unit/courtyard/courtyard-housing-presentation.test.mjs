import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,viewSect,snapshotSect,restoreSect,commandSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
import {residentialProjectionState} from '../../../src/simulation/ea-residential-housing.mjs';

const MASTER='person:master';
test('legacy desktop housing preview labels pending beds without writing the saved world',()=>{
 const session=createSectSession(),before=JSON.stringify(snapshotSect(session));
 assert(!Object.hasOwn(session.state,'residentialHousing'));
 for(let i=0;i<3;i++){
  const view=viewSect(session),master=view.housing.residents.find(person=>person.personId===MASTER);
  assert.equal(view.housing.counts.physical,4);assert.equal(view.housing.counts.pending,2);
  assert.equal(view.housing.counts.settled,0);assert.equal(master.homeLabel,null);
  assert.equal(master.statusLabel,'待入住');assert.match(master.pendingLabel,/主殿.*第\d+床/);
  assert.equal(JSON.stringify(snapshotSect(session)),before);
 }
});

test('legacy queries refresh after source facts change and discard a modified private preview',()=>{
 const session=createSectSession(),before=JSON.stringify(snapshotSect(session));
 const preview=residentialProjectionState(session.state);preview.residentialHousing.recordsByPersonId[MASTER].pending=null;
 assert(viewSect(session).housing.residents.find(person=>person.personId===MASTER).pending);
 assert.equal(JSON.stringify(snapshotSect(session)),before);
 // Isolated query fixture: an unavailable hall must immediately lose usable beds.
 const hall=Object.values(session.state.buildingsById).find(b=>b.type==='hall');hall.enabled=false;
 const changed=JSON.stringify(snapshotSect(session)),view=viewSect(session);
 assert.equal(view.housing.counts.usable,0);assert.equal(view.housing.residents.find(person=>person.personId===MASTER).pending,null);
 assert.equal(JSON.stringify(snapshotSect(session)),changed);
});

test('ordinary master rest displays arrival only after the real body reaches its promised bed and survives reload',()=>{
 let session=createSectSession();
 assert.equal(commandSect(session,{type:'rest'}).ok,true);
 assert.equal(commandSect(session,{type:'pause',paused:false}).ok,true);
 let home=null;
 for(let i=0;i<1000&&!home;i++){
  advanceSect(session,.1);
  const resident=viewSect(session).housing.residents.find(person=>person.personId===MASTER);
  home=resident.home;
  if(!home){assert.equal(resident.homeLabel,null);assert.equal(resident.statusLabel,'待入住');}
 }
 assert(home,'normal body must reach its bed');
 assert.equal(commandSect(session,{type:'pause',paused:true}).ok,true);
 const state=JSON.stringify(session.state),view=viewSect(session),resident=view.housing.residents.find(person=>person.personId===MASTER);
 assert.equal(resident.statusLabel,'已入住');assert.equal(resident.pendingLabel,null);assert.match(resident.homeLabel,/主殿.*第\d+床/);
 const physical=view.housing.beds.find(bed=>bed.slotId===home.slotId);
 assert.equal(physical.homePersonId,MASTER);assert.equal(physical.occupantPersonId,MASTER);assert.equal(physical.activityPhase,'executing');
 session=restoreSect(snapshotSect(session));assert.equal(JSON.stringify(session.state),state);
 assert.deepEqual(viewSect(session).housing,view.housing);
});
