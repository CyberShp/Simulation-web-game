import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-sim.mjs';
import {availableSystems,onboardingView,recommendedPlot,resourceReserve,resumeSummary} from '../dist/ea-onboarding.mjs';
import {nextObjective} from '../dist/ea-scene-state.mjs';

function gift(){const s=S.initial();S.acknowledgeIntro(s);S.masterAction(s,'heal');S.tick(s,15);S.advanceStory(s);S.advanceStory(s);return s;}
function addOpeningFarm(s){const p=recommendedPlot(s,'farm',S.placementLock);return S.build(s,'farm',p.x,p.y);}
function until(s,predicate,limit=300){for(let i=0;i<limit&&!predicate();i++)S.tick(s,1);assert.ok(predicate(),'expected autonomous state within the time limit');}
test('new opening has a spare dose while older saves keep every resource and all navigation',()=>{
 const s=S.initial();assert.equal(resourceReserve(s),16);assert.equal(s.resources.herb,22);
 assert.deepEqual(availableSystems(s),['self','journal']);
 const old=structuredClone(s);delete old.story.onboarding;const restored=S.validateSave(old);
 assert.deepEqual(restored,old);assert.equal(availableSystems(restored).length,8);assert.equal(onboardingView(restored).feedback,null);
});
test('intro page survives closing the browser without advancing the story or paying twice',()=>{
 const s=S.initial(),resources={...s.resources};S.setIntroPage(s,2);
 const resumed=S.validateSave(s);assert.equal(resumed.story.onboarding.introPage,2);assert.equal(resumed.story.intro,false);
 assert.equal(resumed.story.step,0);assert.deepEqual(resumed.resources,resources);
 assert.throws(()=>S.setIntroPage(s,-1));assert.throws(()=>S.setIntroPage(s,3));
 S.acknowledgeIntro(resumed);S.setIntroPage(resumed,0);assert.equal(resumed.story.onboarding.introPage,2);
});
test('healing and gift lead to an actual home interaction, not an unrelated management page',()=>{
 const s=S.initial();S.masterAction(s,'heal');assert.equal(resourceReserve(s),10);S.tick(s,15);
 assert.equal(nextObjective(s).kind,'home');assert.equal(nextObjective(s).id,s.buildings[0].id);
 S.advanceStory(s);assert.match(nextObjective(s).label,/陆知微/);S.advanceStory(s);
 assert.equal(s.disciples[0].name,'陆知微');assert.equal(s.resources.herb,6);assert.equal(nextObjective(s).kind,'build');
 assert.ok(availableSystems(s).includes('disciples'));assert.ok(!availableSystems(s).includes('manuals'));
});
test('mistaken herb sales have a real recovery route even before the wounded character heals',()=>{
 const s=S.initial();S.trade(s,'herb','sell',S.day(s),2);assert.equal(s.resources.herb,2);
 const missing=nextObjective(s);assert.equal(missing.kind,'gather');assert.equal(missing.id,'herb');
 S.masterAction(s,'herb');S.tick(s,10);assert.ok(s.resources.herb>=6);S.masterAction(s,'heal');S.tick(s,15);S.advanceStory(s);
 const giftRecovery=nextObjective(s);assert.equal(giftRecovery.kind,'gather');S.masterAction(s,giftRecovery.id);S.tick(s,10);S.advanceStory(s);
 assert.equal(s.disciples.length,1);S.validateSave(s);
});
test('recommended plots pass real collision and road validation and failed placement never charges',()=>{
 const s=gift();for(const type of ['farm','lumber']){const p=recommendedPlot(s,type,S.placementLock);assert.ok(p);assert.equal(S.placementLock(s,type,p.x,p.y),'');
 const before={...s.resources},b=S.build(s,type,p.x,p.y);for(const[k,v]of Object.entries(S.BUILDINGS[type].cost))assert.equal(s.resources[k],before[k]-v);
 const after=structuredClone(s);assert.throws(()=>S.build(s,type,b.x,b.y));assert.deepEqual(s,after);}
 assert.equal(nextObjective(s).kind,'home');S.validateSave(s);
});
test('first harvest is observed at a real autonomous production event and acknowledgment never grants again',()=>{
 const s=gift();for(const type of ['farm','lumber']){const p=recommendedPlot(s,type,S.placementLock);S.build(s,type,p.x,p.y);}
 let elapsed=0;while(!s.story.onboarding.productions.length&&elapsed++<300)S.tick(s,1);
 assert.ok(elapsed<300,'first autonomous crop must arrive without assigning work');
 const event=s.story.onboarding.productions[0];assert.equal(event.type,'farm');assert.equal(event.name,'陆知微');assert.ok(event.out.herb>0);
 assert.ok(s.resources.herb>=6+event.out.herb);assert.equal(s.society.stats.workCycles,1);
 const copy=S.validateSave(s),before=structuredClone(copy);assert.deepEqual(onboardingView(copy).feedback.out,event.out);assert.deepEqual(copy,before,'projection is read-only');
 S.acknowledgeOnboarding(copy,event.id);const resources={...copy.resources};S.acknowledgeOnboarding(copy,event.id);
 assert.deepEqual(copy.resources,resources);assert.equal(onboardingView(S.validateSave(copy)).feedback,null);
 S.tick(copy,120);assert.equal(copy.story.onboarding.productions.filter(e=>e.type==='farm').length,1);S.validateSave(copy);
});
test('first farm observation survives early chapter progression and legacy worlds never acquire it',()=>{
 const s=gift();addOpeningFarm(s);const p=recommendedPlot(s,'lumber',S.placementLock);S.build(s,'lumber',p.x,p.y);S.advanceStory(s);
 S.masterAction(s,'wood');until(s,()=>s.resources.wood>=45&&s.resources.jade>=65);
 const library=recommendedPlot(s,'library',S.placementLock);S.build(s,'library',library.x,library.y);S.advanceStory(s);
 assert.equal(s.story.step,4);assert.equal(s.story.onboarding.productions.length,0);
 assert.equal(onboardingView(s).enabled,true);assert.ok(onboardingView(s).work);
 const old=structuredClone(s);delete old.story.onboarding;const before=structuredClone(old);
 assert.equal(onboardingView(old).enabled,false);assert.equal(onboardingView(old).work,null);assert.equal(onboardingView(old).feedback,null);assert.deepEqual(old,before);
 until(s,()=>s.story.onboarding.productions.some(e=>e.type==='farm'),600);
 assert.equal(onboardingView(s).work,null);S.acknowledgeOnboarding(s,'harvest:farm');assert.equal(onboardingView(s).work,null);S.validateSave(s);
});
test('first farm guidance separates travel from real production and paused progress stays unchanged',()=>{
 const s=gift(),farm=addOpeningFarm(s);until(s,()=>onboardingView(s).work?.status==='moving'&&s.disciples[0].job===farm.id);
 let view=onboardingView(s);assert.match(view.work.phase,/前往灵草田/);assert.equal(view.work.progress,null);assert.equal(view.feedback,null);
 const before=structuredClone(s);for(let n=0;n<5;n++)onboardingView(s);assert.deepEqual(s,before,'observing does not move a person or produce a crop');
 until(s,()=>onboardingView(s).work?.status==='working'&&farm.progress>0);
 view=onboardingView(s);assert.equal(view.work.progress.value,farm.progress);assert.equal(view.work.progress.total,S.BUILDINGS.farm.duration);assert.equal(view.work.progress.running,true);
 const relocated=structuredClone(s),plot=recommendedPlot(relocated,'farm',S.placementLock);S.relocate(relocated,farm.id,plot.x,plot.y);
 assert.equal(onboardingView(relocated).work.status,'moving');assert.equal(onboardingView(relocated).work.progress,null,'moving a working facility requires arriving at its new entrance');
 s.speed=0;const paused=structuredClone(s);S.tick(s,30);view=onboardingView(s);
 assert.equal(view.work.paused,true);assert.equal(view.work.progress.running,false);assert.match(view.work.text,/时序已暂停/);assert.deepEqual(s,paused);
 s.speed=1;until(s,()=>!!onboardingView(s).feedback);assert.equal(onboardingView(s).work,null);S.validateSave(s);
});
test('rest and unavailable facilities explain the actual reason without claiming a producing farm',()=>{
 const s=gift(),farm=addOpeningFarm(s),d=s.disciples[0];until(s,()=>onboardingView(s).work?.status==='working'&&farm.progress>0);
 const progress=farm.progress;d.energy=10;S.tick(s,1);
 let work=onboardingView(s).work;assert.equal(work.activity,'rest');assert.match(work.reason,/精力不足/);assert.equal(work.progress,null);assert.equal(farm.progress,progress);
 S.toggleBuilding(s,farm.id);work=onboardingView(s).work;assert.match(work.text,/药圃已停用/);assert.equal(work.progress,null);assert.equal(onboardingView(s).feedback,null);
 S.toggleBuilding(s,farm.id);farm.condition=0;assert.match(onboardingView(s).work.text,/药圃已损坏/);S.validateSave(s);
});
test('first farm guidance follows the person who actually chose the work rather than always Lu',()=>{
 const s=gift(),farm=addOpeningFarm(s);s.disciples[0].energy=10;
 const worker=S.addDisciple(s,{name:'程青木',main:'qingyuan',mastery:50,traits:[82,44,78,95,20],goal:'精研草木'});S.tick(s,1);
 assert.equal(worker.job,farm.id);assert.equal(worker.mind.activity,'work');const work=onboardingView(s).work;
 assert.equal(work.personId,worker.id);assert.equal(work.name,worker.name);assert.equal(work.buildingId,farm.id);assert.equal(work.status,'moving');
 until(s,()=>!!onboardingView(s).feedback);const feedback=onboardingView(s).feedback;
 assert.equal(feedback.personId,worker.id);assert.equal(feedback.buildingName,'灵草田');assert.match(feedback.observeLabel,/程青木.*灵草田/);assert.ok(feedback.out.herb>0);S.validateSave(s);
});
test('onboarding validator refuses fabricated acknowledgments, future events and duplicate observations',()=>{
 const s=gift();const p=recommendedPlot(s,'farm',S.placementLock);S.build(s,'farm',p.x,p.y);for(let i=0;i<300&&!s.story.onboarding.productions.length;i++)S.tick(s,1);
 assert.ok(s.story.onboarding.productions.length);for(const mutate of [o=>o.introPage=4,o=>o.seen.push('harvest:unknown'),o=>o.productions[0].time=s.time+1,o=>o.productions.push({...o.productions[0]}),o=>o.productions[0].out.herb=-1]){const copy=structuredClone(s);mutate(copy.story.onboarding);assert.throws(()=>S.validateSave(copy),/开局指引/);}
 assert.throws(()=>S.acknowledgeOnboarding(S.initial(),'harvest:farm'),/尚未发生/);
});
test('resume summary reads recent facts and pending travel/combat without modifying or unpausing them',()=>{
 const s=gift(),before=structuredClone(s),summary=resumeSummary(s,nextObjective(s));assert.match(summary.text,/陆知微/);assert.equal(summary.next.kind,'build');assert.deepEqual(s,before);
 S.startExploration(s,'valley');const journey=resumeSummary(s,nextObjective(s));assert.match(journey.detail,/前往/);assert.equal(journey.next.kind,'journey');S.validateSave(s);
});
