/** U-172: five disciples, finite grain and one public dose; outcomes use official ticks. */
import {createExpeditionCompanionsScenario} from './expedition-companions.mjs';
import {validateSect,commandSect} from '../../apps/courtyard/sect-sim.mjs';
export function createCompanionOperationsScenario({condition='safe'}={}){
 if(!['safe','encounter','food-shortage'].includes(condition))throw Error('Unknown operations condition');
 const f=createExpeditionCompanionsScenario({memberCount:5}),s=f.session.state;
 s.resources.food=condition==='food-shortage'?3:24;s.stockpilesById[f.sourceStockpileId].pills.heal=1;
 if(condition==='encounter'){
  const foe=s.personsById['person:valley-shanxiao'];foe.location={kind:'local',sceneId:'scene:valley',x:9,y:27};foe.position={kind:'scene',sceneId:'scene:valley',x:9,y:27};
 }
 // Shortage branch has no accessible harvest; no future result is configured.
 if(condition==='food-shortage')for(const b of s.buildings)if(['granary','warehouse'].includes(b.type)){const st=s.stockpilesById[`stockpile:${b.instanceId}`];if(st)st.resources.food=0;}
 commandSect(f.session,{type:'policy',policy:{foodTarget:0,herbTarget:0,spendingCap:0,risk:'cautious'}});
 validateSect(f.session);
 return {...f,stayIds:f.memberIds.filter(id=>!f.travellerIds.includes(id)),metadata:{...f.metadata,id:'companion-operations-v1',condition,homeFood:s.resources.food,homeMedicine:1,foe:structuredClone(s.personsById['person:valley-shanxiao'].location),scope:'Five disciples plus master, configured facilities and finite food/medicine. Two choose their own outing; three keep their original bodies and commitments. Public policy and every subsequent result use official commands and world ticks.'}};
}
