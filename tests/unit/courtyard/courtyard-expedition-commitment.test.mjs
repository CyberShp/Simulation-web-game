import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpeditionPurposeScenario} from '../../fixtures/expedition-purpose.mjs';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';
import {discipleExpeditionsView,considerDiscipleExpeditionDeparture,advanceDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';

function setup({lesson=false}={}){
 const f=createExpeditionPurposeScenario({condition:'well-supplied'});assert(commandSect(f.session,{type:'disciple-expeditions',enabled:false}).ok);
 let s=f.session.state,p=s.personsById[f.travellerId];
 for(const b of s.buildings)if(['farm','lumber'].includes(b.type))b.enabled=false;
 const hall=s.buildings.find(b=>b.type==='hall'),slot=facilitySlots(s,hall,lesson?'study':'cultivate')[0];
 Object.assign(p.mind.scenic,{...slot.position,path:[],goal:null,revision:geometryRevision(s)});p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...slot.position};p.location={kind:'local',sceneId:'scene:yunxiu-courtyard',...slot.position};
 Object.assign(s.master.scenic,{x:p.position.x+1,y:p.position.y,path:[],goal:null,revision:geometryRevision(s)});s.master.position={...p.position,x:p.position.x+1};
 p.mind.lastDecision=-100;p.mind.traits[4]=100;
 if(lesson){
  // Initial understanding is configured in both canonical and legacy views.
  // The recommendation, lesson selection and first work step are real.
  p.mind.knowledge.qingyuan=20;p.artsById.qingyuan.understanding=20;p.artsById.qingyuan.legacyMastery=20;
  const r=commandSect(f.session,{type:'recommend-disciple-technique',personId:p.personId,techniqueId:'qingyuan'});assert(r.ok);assert.equal(r.result.accepted,true);
 }
 let ready=false;
 for(let n=0;n<100;n++){advanceSect(f.session,.1);s=f.session.state;p=s.personsById[f.travellerId];const a=s.activitiesById[p.activityId];if(a?.action===(lesson?'study':'cultivate')&&a.phase==='executing'){ready=true;break;}}
 assert(ready,'formal autonomous selection reaches its actual station');validateSect(f.session);
 return{...f,p};
}
function enable(f){const r=commandSect(f.session,{type:'disciple-expeditions',enabled:true});assert(r.ok);}
const member=(f)=>discipleExpeditionsView(f.session.state).members.find(p=>p.personId===f.travellerId);

test('a formally selected lesson retains its body and progress until completion before considering departure',()=>{
 const f=setup({lesson:true}),s=f.session.state,p=s.personsById[f.travellerId],id=p.activityId,learning=structuredClone(p.mind.learning),food=s.resources.food;
 assert(learning.progress>0&&learning.progress<learning.total);assert(p.mind.commitUntil>s.time);enable(f);
 const before=JSON.stringify(f.session.state);assert.match(member(f).reason,/未完成的功课/);assert.equal(JSON.stringify(f.session.state),before);
 advanceSect(f.session,.1);let current=f.session.state;assert.equal(current.discipleExpeditions.journeys.length,0);assert.equal(current.personsById[p.personId].activityId,id);assert.deepEqual(current.personsById[p.personId].mind.learning,learning);assert.equal(current.resources.food,food);
 let departed=false;
 for(let i=0;i<1000;i++){advanceSect(f.session,.1);current=f.session.state;const now=current.personsById[p.personId];if(current.discipleExpeditions.journeys.length){assert.equal(now.mind.learning,null);assert(now.mind.knowledge.qingyuan>20);departed=true;break;}assert.equal(now.activityId,id);}
 assert(departed,'completed lesson releases the resident to consider a new outing');validateSect(f.session);
});

for(const clock of ['mind','schedule'])test(`an active ${clock} cultivation promise blocks departure while an expired promise permits it`,()=>{
 const f=setup(),s=f.session.state,p=s.personsById[f.travellerId],activityId=p.activityId;
 assert.equal(s.activitiesById[activityId].action,'cultivate');assert.equal(p.mind.learning,null);
 // Keep the original real cultivation deadline. The schedule case adds a
 // configured later deadline, then waits for both through normal world steps.
 const deadline=p.mind.commitUntil;assert(deadline>s.time);
 if(clock==='schedule')p.schedule.commitUntilTick=Math.ceil(deadline*10)+10;
 validateSect(f.session);enable(f);assert.match(member(f).reason,/尚未到期的承诺/);
 advanceSect(f.session,.1);let current=f.session.state;assert.equal(current.discipleExpeditions.journeys.length,0);assert.equal(current.personsById[p.personId].activityId,activityId);
 for(let i=0;i<600&&!current.discipleExpeditions.journeys.length;i++){advanceSect(f.session,.1);current=f.session.state;}assert.equal(current.discipleExpeditions.journeys.length,1,JSON.stringify({tick:current.worldTick,time:current.time,commit:current.personsById[p.personId].mind.commitUntil,schedule:current.personsById[p.personId].schedule.commitUntilTick,reason:member(f).reason}));assert.equal(current.discipleExpeditions.journeys[0].personId,p.personId);assert.equal(current.discipleExpeditions.journeys[0].phase,'preparing');assert(current.time>=deadline);validateSect(f.session);
 const sameTick=JSON.stringify(current),tick=current.worldTick;assert.equal(considerDiscipleExpeditionDeparture(current,p.personId),false);advanceDiscipleExpeditions(current);assert.equal(current.worldTick,tick);assert.equal(JSON.stringify(current),sameTick);
});
