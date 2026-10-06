import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import * as S from '../dist/ea-sim.mjs';
import {recommendedPlot,onboardingView,availableSystems} from '../dist/ea-onboarding.mjs';
import {nextObjective} from '../dist/ea-scene-state.mjs';
import {runAcceptance} from './ea-130-acceptance.mjs';

const directory=new URL('./acceptance-1.4/',import.meta.url);await mkdir(directory,{recursive:true});
const fixtures={};
const cases=[];
function check(name,run){try{cases.push({name,status:'passed',evidence:run()});}catch(e){cases.push({name,status:'failed',error:e.stack});}}
check('First autonomous harvest via healing, gift and recommended real buildings',()=>{
 const s=S.initial();S.setIntroPage(s,2);S.acknowledgeIntro(s);S.masterAction(s,'heal');S.tick(s,15);S.advanceStory(s);
 fixtures['gift-ready']=structuredClone(s);S.advanceStory(s);
 for(const type of ['farm','lumber']){const p=recommendedPlot(s,type,S.placementLock);assert.ok(p);S.build(s,type,p.x,p.y);}
 fixtures['farm-waiting']=structuredClone(s);let wait=0;
 while(!s.story.onboarding.productions.some(e=>e.type==='farm')&&wait<300){S.tick(s,1);wait++;}
 const event=s.story.onboarding.productions.find(e=>e.type==='farm');assert.ok(event,'real autonomous harvest');
 fixtures['first-harvest']=structuredClone(s);const restored=S.validateSave(s);assert.deepEqual(restored,s);
 S.acknowledgeOnboarding(restored,event.id);const resources={...restored.resources};S.acknowledgeOnboarding(restored,event.id);assert.deepEqual(restored.resources,resources);
 assert.equal(onboardingView(restored).feedback,null);
 return {gameSecondsToHarvest:wait,totalGameSeconds:s.time,worker:event.name,actualOutput:event.out,manuallyAssignedWorkers:0};
});
check('Early mistaken herb sale recovers by publicly gathering and paying the original costs',()=>{
 const s=S.initial();S.acknowledgeIntro(s);S.trade(s,'herb','sell',S.day(s),2);assert.equal(nextObjective(s).kind,'gather');
 S.masterAction(s,'herb');S.tick(s,10);S.masterAction(s,'heal');S.tick(s,15);S.advanceStory(s);
 S.masterAction(s,'herb');S.tick(s,10);S.advanceStory(s);assert.equal(s.disciples.length,1);S.validateSave(s);
 return {gameSeconds:s.time,firstFollower:s.disciples[0].name,remainingHerb:s.resources.herb};
});
check('Interrupted prologue resumes its page without repeating a reward or starting healing',()=>{
 const s=S.initial();S.setIntroPage(s,1);const restored=S.validateSave(s);assert.deepEqual(restored,s);
 assert.equal(restored.story.onboarding.introPage,1);assert.equal(restored.story.intro,false);assert.equal(restored.master.action,'rest');
 return {page:1,storyStep:0,herb:restored.resources.herb};
});
const old=JSON.parse(await readFile(new URL('./ea-reference-world.json',import.meta.url),'utf8'));
check('Existing v5 full world keeps all systems, resources and its completed campaign',()=>{
 const s=S.validateSave(old.state||old),before=structuredClone(s);assert.equal(s.story.onboarding,undefined);
 assert.equal(availableSystems(s).length,8);assert.equal(onboardingView(s).feedback,null);assert.deepEqual(S.validateSave(s),before);
 fixtures['legacy-full']=s;return {people:s.disciples.length,buildings:s.buildings.length,storyStep:s.story.step};
});
for(const[name,state]of Object.entries(fixtures)){S.validateSave(state);await writeFile(new URL(name+'.json',directory),JSON.stringify(state,null,2)+'\n');}
const campaign=runAcceptance();
const report={version:S.GAME_VERSION,generatedAt:new Date().toISOString(),opening:cases,campaign,passed:cases.filter(c=>c.status==='passed').length+campaign.passed,failed:cases.filter(c=>c.status==='failed').length+campaign.failed,limitations:['Public command automation does not measure real player learning time or browser FPS','Friend unassisted playtest and real iOS/Android device lifecycle not performed']};
await writeFile(new URL('independent-command-report.json',directory),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.version,passed:report.passed,failed:report.failed,opening:cases,campaign:campaign.cases.map(c=>({name:c.name,status:c.status,error:c.error}))},null,2));
if(report.failed)process.exitCode=1;
