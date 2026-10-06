/** Opening QA: progression uses public simulation commands, never fabricated resources or NPC jobs. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as S from '../dist/ea-sim.mjs';
import {availableSystems,onboardingView,recommendedPlot} from '../dist/ea-onboarding.mjs';

const directory=new URL('./acceptance-1.4.2/',import.meta.url);
await mkdir(directory,{recursive:true});
const fixtures=new Map(),cases=[],commands={};
function act(s,name,...args){commands[name]=(commands[name]||0)+1;return S[name](s,...args);}
function readChapters(s){for(const entry of S.narrativeForState(s).archive)if(!entry.acknowledged)act(s,'acknowledgeNarrative',entry.id);}
function until(s,predicate,limit=600){let elapsed=0;while(!predicate()&&elapsed<limit){act(s,'tick',1);elapsed++;}assert.ok(predicate(),'Expected real simulation state was not reached');return elapsed;}
function build(s,type){const plot=recommendedPlot(s,type,S.placementLock);assert.ok(plot,'A reachable plot must exist for '+type);return act(s,'build',type,plot.x,plot.y);}
function observe(s){const before=structuredClone(s);let view;for(let n=0;n<3;n++)view=onboardingView(s);assert.deepEqual(s,before,'Observing must not advance time, move NPCs, consume RNG, or change resources');return view;}
function fixture(name,s,{pause=true}={}){
 const copy=structuredClone(s);
 // Match the game's public pause control. Only the clock flag changes; all
 // positions, decisions, resources, production and story facts are preserved.
 if(pause)copy.speed=0;
 assert.deepEqual(S.validateSave(copy),copy);
 if(pause){const before=structuredClone(copy);S.tick(copy,60);assert.deepEqual(copy,before,'A browser fixture must stay still until continued');}
 fixtures.set(name,copy);return copy;
}
function check(name,run){try{cases.push({name,status:'passed',evidence:run()});}catch(error){cases.push({name,status:'failed',error:error.stack});}}
function opening(){
 const s=S.initial({name:'沈砚'});act(s,'acknowledgeIntro');act(s,'masterAction','heal');until(s,()=>s.master.wound===0);
 act(s,'advanceStory');readChapters(s);act(s,'advanceStory');readChapters(s);return s;
}

check('Observation remains available after legally reaching chapter step 4 before the first crop',()=>{
 const s=S.initial({name:'沈砚'});fixture('fresh-memory',s,{pause:false});
 act(s,'acknowledgeIntro');act(s,'masterAction','heal');until(s,()=>s.master.wound===0);
 fixture('healed-before-visitor',s);
 act(s,'advanceStory');readChapters(s);assert.equal(s.story.step,1);fixture('gift-ready',s);
 act(s,'advanceStory');readChapters(s);assert.equal(s.story.step,2);fixture('gift-complete',s);
 build(s,'farm');build(s,'lumber');act(s,'advanceStory');readChapters(s);
 act(s,'masterAction','wood');until(s,()=>S.canPay(s,S.BUILDINGS.library.cost));
 build(s,'library');act(s,'advanceStory');readChapters(s);
 assert.equal(s.story.step,4);assert.equal(s.story.onboarding.productions.some(e=>e.type==='farm'),false);
 const view=observe(s);assert.equal(view.enabled,true);assert.ok(view.work);assert.equal(view.feedback,null);
 const paused=fixture('step4-first-work',s);assert.equal(onboardingView(paused).work.paused,true);
 return {storyStep:s.story.step,gameSeconds:s.time,observedPerson:view.work.name,activity:view.work.activity,phase:view.work.phase,firstCropOccurred:false,observationStillVisible:true,fixturePaused:true};
});

check('Actual autonomous travel, on-site progress and first harvest remain read-only observations',()=>{
 const s=opening(),farm=build(s,'farm');build(s,'lumber');const builtAt=s.time;
 until(s,()=>{const w=onboardingView(s).work;return w?.status==='moving'&&s.disciples.find(d=>d.id===w.personId)?.job===farm.id;});
 const moving=observe(s);assert.equal(moving.work.progress,null);assert.equal(moving.feedback,null);fixture('first-work-moving',s);
 const travelObservedAt=s.time;
 until(s,()=>onboardingView(s).work?.status==='working'&&farm.progress>0);
 const working=observe(s);assert.equal(working.work.progress.value,farm.progress);assert.equal(working.work.progress.total,S.BUILDINGS.farm.duration);assert.equal(working.work.progress.running,true);
 const paused=fixture('first-work-progress',s);assert.equal(onboardingView(paused).work.progress.running,false);
 const productionObservedAt=s.time,progressAtObservation=farm.progress;
 until(s,()=>s.story.onboarding.productions.some(e=>e.type==='farm'));
 const view=observe(s),event=s.story.onboarding.productions.find(e=>e.type==='farm');
 assert.equal(view.work,null);assert.equal(view.feedback.personId,event.personId);assert.ok(event.out.herb>0);assert.ok(s.resources.herb>=6+event.out.herb);assert.equal(s.society.stats.workCycles,1);
 fixture('first-harvest',s);
 const restored=S.validateSave(s);act(restored,'acknowledgeOnboarding',event.id);const resources={...restored.resources};act(restored,'acknowledgeOnboarding',event.id);assert.deepEqual(restored.resources,resources);assert.equal(onboardingView(restored).feedback,null);
 return {builtAtGameSecond:builtAt,travelObservedAtGameSecond:travelObservedAt,workObservedAtGameSecond:productionObservedAt,progressAtObservation,totalWorkRequired:S.BUILDINGS.farm.duration,firstHarvestAtGameSecond:s.time,elapsedGameSecondsSinceConstruction:s.time-builtAt,actualWorker:event.name,actualOutput:event.out,manuallyAssignedWorkers:0,readOnlyProjectionPreservedState:true,repeatedAcknowledgmentGrantedNothing:true};
});

const previous=JSON.parse(await readFile(new URL('./ea-reference-world.json',import.meta.url),'utf8'));
check('A legacy v5 world receives no new observation, reward or navigation restriction',()=>{
 const s=S.validateSave(previous.state||previous),before=structuredClone(s),view=observe(s);
 assert.equal(s.story.onboarding,undefined);assert.equal(view.enabled,false);assert.equal(view.work,null);assert.equal(view.feedback,null);assert.equal(availableSystems(s).length,8);assert.deepEqual(S.validateSave(s),before);
 fixture('legacy-full',s);
 return {storyStep:s.story.step,people:s.disciples.length,buildings:s.buildings.length,visibleSystems:availableSystems(s).length,newGuidanceInjected:false,originalFileModified:false};
});

for(const[name,state]of fixtures)await writeFile(new URL(name+'.json',directory),JSON.stringify(state,null,2)+'\n');
const report={version:S.GAME_VERSION,generatedAt:new Date().toISOString(),passed:cases.filter(c=>c.status==='passed').length,failed:cases.filter(c=>c.status==='failed').length,cases,publicCommandCounts:commands,fixtures:[...fixtures].map(([name,s])=>({file:name+'.json',storyStep:s.story.step,gameSeconds:s.time,paused:s.speed===0,productionEvents:s.story.onboarding?.productions.length||0})),provenance:{format:'Pure validated v5 state JSON, supported by the public paste-save/import interface',progression:'Public sim commands only; no direct resource, time, position, RNG, NPC job or reward edits',pause:'Fixture copies use speed=0, matching the public pause control; fresh-memory starts in its unread prologue',legacy:'The existing reference world is read and validated only; its original file is never written'},limitations:['Game seconds are simulation timestamps, not measured player learning time','These checks do not measure browser FPS or real iOS/Android lifecycle behavior','No unassisted human playtest was performed']};
await writeFile(new URL('independent-command-report.json',directory),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
