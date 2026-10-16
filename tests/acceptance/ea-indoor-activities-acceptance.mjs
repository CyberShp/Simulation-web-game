/** SR-XF-004-AC-02 / U-101: three earned indoor activities keep their real reserved slots.
 * Optional XIANFU_QA_INDOOR_DIR writes source states outside the repository.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../../src/simulation/ea-opening-sim.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';
import {spatialAccess,spatialSlots} from '../../src/simulation/ea-sr-spatial.mjs';

function earnedStates(){
 const heal=harness();heal.act('acknowledgeIntro');heal.act('masterAction','heal');
 heal.until(s=>s.activitiesById[s.master.activityId]?.action==='heal'&&s.activitiesById[s.master.activityId]?.phase==='executing','real care bed arrival',200);
 heal.act('setSpeed',0);heal.save();
 const opening=normalOpening(),order=opening.act('masterStudy','spring');
 opening.until(s=>s.srCultivation.orders[order.orderId]?.phase==='executing','real library desk arrival',100);
 opening.act('setSpeed',0);opening.save();const study=S.validateSave(JSON.parse(JSON.stringify(opening.s)));
 opening.act('setSpeed',1);opening.until(s=>s.srCultivation.orders[order.orderId]?.phase==='completed','real study completion',100);
 opening.act('masterAction','rest');opening.until(s=>s.activitiesById[s.master.activityId]?.action==='rest'&&s.activitiesById[s.master.activityId]?.phase==='executing','real rest bed arrival',1000);
 opening.act('setSpeed',0);opening.save();
 return {heal:heal.s,study,rest:opening.s};
}

test('SR-XF-004-AC-02: earned care, library study and rest keep real reserved slots',()=>{
 const states=earnedStates(),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),output=process.env.XIANFU_QA_INDOOR_DIR;
 if(output){const dir=resolve(output),rel=relative(root,dir);assert(rel==='../..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'QA states belong outside the source repository');mkdirSync(dir,{recursive:true});for(const[k,s]of Object.entries(states))writeFileSync(resolve(dir,`indoor-${k}.json`),JSON.stringify(s));}
  for(const [kind,s] of Object.entries(states)){
   const raw=JSON.stringify(s),activity=s.activitiesById[s.master.activityId],slotId=activity.slotId,building=s.buildings.find(b=>slotId.startsWith(`${b.instanceId}/`));
   assert(building,`${kind}: reserved building still exists`);
   const slots=spatialSlots(building,kind==='study'?'study':kind==='heal'?'heal':'rest'),slot=slots.find(x=>x.id===slotId);
   assert(slot,`${kind}: reservation resolves to a real ${building.type} slot`);
   const life=S.personLifeSummary(s,s.master),appearance=S.appearanceView(s,'person:master');
   assert.equal(life.activity,kind,`${kind}: detail activity comes from the active body`);
   assert.equal(life.facilityName,S.BUILDINGS[building.type].name,`${kind}: detail names the reserved building`);
   assert.equal(life.slotName,slot.label,`${kind}: detail names the reserved station`);
   assert.equal(appearance.action,kind,`${kind}: the drawn pose follows the active body`);
   assert(Math.hypot(s.master.scenic.x-slot.position.x,s.master.scenic.y-slot.position.y)<.04,`${kind}: body is at the assigned slot`);
   assert(Math.hypot(slot.position.x-spatialAccess(building).x,slot.position.y-spatialAccess(building).y)>1,`${kind}: the entrance is not the work position`);
   assert.equal(s.speed,0,`${kind}: saved world is paused`);
   assert.equal(JSON.stringify(s),raw,`${kind}: activity and appearance projections preserve the saved world`);
  }
});
