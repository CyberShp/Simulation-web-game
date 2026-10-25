import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {npcScheduleDecision} from '../../../src/simulation/ea-sr-persons.mjs';
import {ensureResidentialHousing,residentialAdmissionView,reserveResidentialBed,reconcileResidentialHousing} from '../../../src/simulation/ea-residential-housing.mjs';
import {prepareFacilityActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {hydrateState} from '../../../src/simulation/ea-state-v6.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {meterSweep,spatialRoom} from '../../../src/simulation/ea-sr-spatial.mjs';
const ID='person:lu-zhiwei';
function fixture(){
 const s=SIM.initial({sr:true});s.story.opening.hallPhase='complete';s.srCultivation=null;s.worldTick=300;
 ensureResidentialHousing(s);const offer=residentialAdmissionView(s,ID);assert(offer.candidate);reserveResidentialBed(s,ID,offer.candidate.slotId,{source:'admission'});s.homeMemberIds.push(ID);
 const p=s.personsById[ID];p.energy=93;p.wound=0;p.mind.satiety=90;p.mind.activity='rest';p.schedule.commitUntilTick=s.worldTick;p.mind.commitUntil=s.time;
 const b=s.buildingsById[offer.candidate.buildingId];prepareFacilityActivity(s,p,b,'rest');assert(['waiting','navigating'].includes(s.activitiesById[p.activityId]?.phase));return{s,p,b};
}
test('accepted pending-bed rest survives the energy threshold and daytime decision until physical arrival, including midway save/reopen',()=>{
 let {s,p,b}=fixture();const slotId=s.residentialHousing.recordsByPersonId[ID].pending.slotId,positions=[{...p.position}],door=spatialRoom(b).door;let roundtripped=false;
 assert.equal(npcScheduleDecision(s,p),true,'daytime must preserve the already accepted pending-bed journey at energy 93');
 let arrived=false;
 for(let i=0;i<300;i++){
  s.worldTick++;const before={...p.position};npcScheduleDecision(s,p);prepareFacilityActivity(s,p,b,'rest');positions.push({...p.position});assert.equal(meterSweep(s,before,p.position).blocked,false);
  if(i===2){roundtripped=true;const text=JSON.stringify(s);s=hydrateState(JSON.parse(text));assert.equal(JSON.stringify(s),text);p=s.personsById[ID];b=s.buildingsById[b.instanceId];}
  if(s.residentialHousing.recordsByPersonId[ID].home){arrived=true;break;}
 }
 assert(roundtripped,'midway state was restored before arrival');assert(positions.some((x,i)=>i>0&&(positions[i-1].y-door.y)*(x.y-door.y)<=0),'actual body crosses the entrance line');assert(arrived,'actual movement must cross the doorway and settle the accepted bed');assert(positions.some(x=>Math.hypot(x.x-positions[0].x,x.y-positions[0].y)>.1));assert.equal(s.residentialHousing.recordsByPersonId[ID].pending,null);const a=s.activitiesById[p.activityId];assert.equal(a.phase,'executing');assert.equal(a.slotId,slotId);const slot=slotById(s,slotId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);
});
test('invalid pending bed and urgent wounds release the journey through existing boundaries',()=>{
 for(const kind of ['disabled','wound','hunger']){const {s,p,b}=fixture();if(kind==='disabled'){b.enabled=false;reconcileResidentialHousing(s);assert.equal(s.residentialHousing.recordsByPersonId[ID].pending,null);}else if(kind==='wound')p.wound=21;else p.mind.satiety=10;
  assert.equal(npcScheduleDecision(s,p),false,kind+' must reach existing interruption/decision');if(kind==='wound')assert.equal(p.activityId,null);if(kind==='disabled'){prepareFacilityActivity(s,p,b,'rest');assert.equal(s.activitiesById[p.activityId]?.targetId===b.instanceId&&s.activitiesById[p.activityId]?.phase==='navigating',false);}
 }
});

test('an already protected arrival rechecks hunger and an invalidated bed on the next decision',()=>{
 for(const kind of ['hunger','disabled']){const {s,p,b}=fixture();const commitment=p.schedule.commitUntilTick;assert.equal(npcScheduleDecision(s,p),true);assert.equal(p.schedule.commitUntilTick,commitment,'arrival does not extend a new uninterruptible commitment');s.worldTick++;
 if(kind==='hunger')p.mind.satiety=10;else{b.enabled=false;reconcileResidentialHousing(s);}
 assert.equal(npcScheduleDecision(s,p),false,kind+' returns to the ordinary decision after protection was active');
 }
});
