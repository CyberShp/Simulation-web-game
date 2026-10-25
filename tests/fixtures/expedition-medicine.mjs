/** U-172 medicine conditions; loading, injury, use and return stay authoritative. */
import {createExpeditionPurposeScenario} from './expedition-purpose.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';

export const EXPEDITION_MEDICINE_SCENARIO=Object.freeze({id:'expedition-medicine-v1',conditions:Object.freeze(['medicine-contact','no-medicine-contact','medicine-safe','no-permission']),maxWorldSteps:5000});
const HOME='stockpile:yunxiu',FOE='person:valley-shanxiao',VALLEY='scene:valley';
export function createExpeditionMedicineScenario({condition='medicine-contact'}={}){
 if(!EXPEDITION_MEDICINE_SCENARIO.conditions.includes(condition))throw Error('Unknown medicine condition: '+condition);
 const f=createExpeditionPurposeScenario({condition:'well-supplied'}),{session,travellerId,companionId}=f;
 let s=session.state;const initialTick=s.worldTick,initialHomePills=condition==='no-medicine-contact'?0:1,carryStockpileId=`stockpile:carried:${travellerId.slice(7)}`;
 s.stockpilesById[HOME].pills.heal=initialHomePills;s.doctrine.pillRule=condition==='no-permission'?'permission':'shared';
 s.personsById[travellerId].mind.pillPermitDay=-1;s.personsById[travellerId].mind.lastPillDay=-1;
 const prelude={worldSteps:0,phases:[],initialHomePills,initialCarriedPills:s.stockpilesById[carryStockpileId]?.pills?.heal||0};
 // Contact scenes start after a real preparation and outward walk. This leaves
 // a genuine retreat trail long enough to leave the six-metre danger area.
 if(condition!=='medicine-safe'){
  let phase=null,ready=false;
  for(let n=0;n<EXPEDITION_MEDICINE_SCENARIO.maxWorldSteps;n++){
   if(n%100===0){const r=commandSect(session,{type:'manual'});if(!r.ok)throw Error(r.error);}
   advanceSect(session,.1);s=session.state;const p=s.personsById[travellerId],j=s.discipleExpeditions.journeys[0];
   if(j&&j.phase!==phase){prelude.phases.push({tick:s.worldTick,phase:j.phase,homePills:s.stockpilesById[HOME].pills.heal,carriedPills:s.stockpilesById[carryStockpileId]?.pills?.heal||0});phase=j.phase;}
   if(j?.phase==='scouting'&&!j.encounter&&p.location?.sceneId===VALLEY&&p.location.x>=15&&Math.hypot(p.location.x-7,p.location.y-27)>8){prelude.worldSteps=n+1;ready=true;break;}
  }
  if(!ready)throw Error('Medicine setup did not reach the actual uninjured mid-valley trail');
  const p=s.personsById[travellerId],j=s.discipleExpeditions.journeys[0],foe=s.personsById[FOE];
  if(p.wound!==0||j.encounter)throw Error('Configured crisis must precede observed injury');
  const point={x:p.location.x,y:p.location.y+2};foe.location={kind:'local',sceneId:VALLEY,...point};foe.position={kind:'scene',sceneId:VALLEY,...point};
  prelude.crisis={configuredAtTick:s.worldTick,travellerPosition:structuredClone(p.location),foePosition:structuredClone(foe.location),distance:2,woundBefore:0,phase:j.phase,actualTrailPoints:j.valleyTrail.length};
 }
 s=session.state;validateSect(session);const j=s.discipleExpeditions.journeys[0];
 return{session,state:s,s,travellerId,companionId,homeStockpileId:HOME,carryStockpileId,metadata:{id:EXPEDITION_MEDICINE_SCENARIO.id,condition,initialTick,startTick:s.worldTick,travellerId,companionId,sourceFixture:f.metadata,prelude,
  initialConditions:{initialHomePills,initialCarriedPills:prelude.initialCarriedPills,pillRule:s.doctrine.pillRule,permitDay:-1,lastPillDay:-1,foePosition:structuredClone(s.personsById[FOE].location)},
  actualAtStart:{homePills:s.stockpilesById[HOME].pills.heal,carriedPills:s.stockpilesById[carryStockpileId]?.pills?.heal||0,journeyId:j?.id||null,phase:j?.phase||null,wound:s.personsById[travellerId].wound,medicine:structuredClone(j?.medicine||null)},
  scope:'Initial HOME medicine and permission are configured. Contact scenes then actually prepare, load and walk to the middle of the valley before configuring a two-metre enemy crisis; observation, damage, treatment and return are not prewritten.'}};
}
