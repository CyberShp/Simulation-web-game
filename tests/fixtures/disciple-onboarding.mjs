/** U-172 initial conditions for an ordinary caller's admission and contribution. */
import {createWorkSpecializationScenario} from './work-specialization.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';

export const DISCIPLE_ONBOARDING_SCENARIO=Object.freeze({id:'disciple-onboarding-v1',conditions:Object.freeze(['ready','no-bed','no-food','unwilling']),maxWorldSteps:900});
const HOME='scene:yunxiu-courtyard';
export function createDiscipleOnboardingScenario({condition='ready'}={}){
 if(!DISCIPLE_ONBOARDING_SCENARIO.conditions.includes(condition))throw Error('Unknown onboarding condition: '+condition);
 const {session,buildingIds}=createWorkSpecializationScenario();let s=session.state;
 // The ordinary source owns identity, RNG, scheduling and all arrival facts.
 // Its short setup is run through the authoritative world clock, never rewritten.
 const opened=commandSect(session,{type:'set-reception',enabled:true});if(!opened.ok)throw Error(opened.error);
 const openedTick=session.state.worldTick;let candidateId=null,setupWorldSteps=0;
 for(;setupWorldSteps<1200;setupWorldSteps++){
  if(setupWorldSteps%100===0){const r=commandSect(session,{type:'manual'});if(!r.ok)throw Error(r.error);}
  advanceSect(session,.1);s=session.state;
  candidateId=Object.keys(s.courtyardSeekers.recordsByPersonId)[0];
  if(candidateId&&s.personsById[candidateId].courtyardVisit.phase==='present'){setupWorldSteps++;break;}
 }
 if(!candidateId||s.personsById[candidateId].courtyardVisit.phase!=='present')throw Error('Ordinary caller did not actually arrive within the setup bound');
 const p=s.personsById[candidateId],identity={personId:p.personId,id:p.id,name:p.name,appearance:structuredClone(p.appearance),talent:p.talent};
 // Configured before admission: readiness, known techniques and a useful skill.
 // No residence, employment, production or reward is assigned to this person.
 p.energy=10;p.wound=0;p.xp=0;p.mind.satiety=100;p.mind.main='qingyuan';p.mind.support=[];p.mind.learning=null;
 p.mind.goal='安稳生活，精进所长';p.mind.traits=condition==='unwilling'?[10,20,50,10,20]:[70,20,50,90,20];
 Object.assign(p.mind.relationships.master,{trust:condition==='unwilling'?10:80,respect:80});
 p.mind.knowledge=Object.fromEntries(s.doctrine.books.map(id=>[id,100]));p.mind.skills={plant:0,industry:80,learning:0,array:0,medicine:0};
 // The initial observer is in talking range, clear of the subsequent route home.
 const observer={x:29,y:26.285714285714285};Object.assign(s.master.scenic,{...observer,path:[],goal:null,revision:geometryRevision(s)});s.master.position={kind:'scene',sceneId:HOME,...observer};
 if(condition==='no-food')s.resources.food=0;
 if(condition==='no-bed')for(const b of s.buildings)if(['hall','house'].includes(b.type))b.enabled=false;
 session.control={mode:'manual',idleMs:0};s.masterControl={mode:'manual',idleMs:0};validateSect(session);
 const admissionRequest={type:'admit-visitor',personId:candidateId,rank:'outer',affiliationId:HOME,mentorId:null};
 return{session,state:s,s,candidateId,buildingIds,admissionRequest,metadata:{id:DISCIPLE_ONBOARDING_SCENARIO.id,condition,openedTick,startTick:s.worldTick,setupWorldSteps,candidateId,identity,buildingIds,
  conditions:{generatedOrdinaryCaller:true,actualSouthernRoadArrival:true,initialEnergy:p.energy,initialWound:p.wound,initialSatiety:p.mind.satiety,configuredTrust:p.mind.relationships.master.trust,configuredTraits:[...p.mind.traits],configuredIndustry:80,configuredKnowledge:structuredClone(p.mind.knowledge),publicFood:s.resources.food,disabledHousing:condition==='no-bed',observer:{...s.master.position}},
  scope:'Initial readiness conditions precede admission; actual bed arrival and first contribution must follow official autonomous ticks.'}};
}
