import assert from 'node:assert/strict';
import {initial,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {recordClaimSR,publishFactSR,travelSR,moveWorldSR,investigateSR,viewSRWorld,discoverSceneSR} from '../dist/ea-sr-world.mjs';
import {recordPermanentDeathSR} from '../dist/ea-sr-crises.mjs';
import {challengeSR,tickSRStory,viewSRStory,initSRStory,validateSRStory} from '../dist/ea-sr-story.mjs';

const results=[];
function check(name,run){run();results.push(name);}
function fresh(){const s=initial({sr:true});s.master.energy=100;s.resources.food=100;return s;}
function saved(s){return validateSave(JSON.parse(JSON.stringify(s)));}
function finishWorld(s){let n=0;while(s.srWorld.activeTravelId||s.srWorld.interaction){assert(n++<3000,'world activity did not finish');tick(s,.1);}}

check('Ordinary corroborated claims do not reveal the two additional responsible people',()=>{
 const s=fresh();
 const factId='fact:qa:unseen-responsibility';
 s.factsById[factId]={id:factId,kind:'observation',topic:'shao',sceneId:'scene:supply',text:'后台未得来源'};
 recordClaimSR(s,{id:'claim:qa:responsibility',topic:'shao',verification:'corroborated',evidenceFactIds:[factId],text:'坊间称邵衡经手'});
 recordClaimSR(s,{id:'claim:migration:shao',topic:'shao',sourceId:'legacy:ledger',verification:'corroborated',text:'无旧账册字段的伪迁移消息'});
 s.srWorld.knownLocations['person:shao-heng']={sceneId:'scene:supply',observedTick:s.worldTick,sourceId:'legacy:ledger',x:1,y:2};
 const before=JSON.stringify(s),story=viewSRStory(s);
 assert.equal(story.targets.filter(t=>t.known).length,1);
 assert(!story.targets.some(t=>t.personId==='person:shao-heng'));
 assert(!JSON.stringify(story).includes('scene:supply'));
 assert.equal(JSON.stringify(s),before);
 assert.equal(saved(s).story.revenge.requiredTargetIds.length,3);
 assert.throws(()=>challengeSR(s,'person:shao-heng'),/可靠事实/);
});

check('Actual paid investigation reveals responsibility and only a coarse sourced place',()=>{
 const s=fresh();discoverSceneSR(s,'scene:market');travelSR(s,'scene:market');finishWorld(s);
 moveWorldSR(s,12.5,16);finishWorld(s);investigateSR(s,'object:market:ledger');finishWorld(s);
 const story=viewSRStory(s),shao=story.targets.find(t=>t.personId==='person:shao-heng');
 assert.equal(shao.known,true);assert.equal(shao.sceneId,'scene:supply');
 assert.deepEqual(viewSRWorld(s).knownLocations['person:shao-heng'],{sceneId:'scene:supply',observedTick:s.investigationsById['investigation:object:market:ledger'].startedTick});
 s.srWorld.knownLocations['person:shao-heng'].x=1.25;
 assert(!JSON.stringify(viewSRStory(s)).includes('1.25'));
 const loaded=saved(s);assert.equal(viewSRStory(loaded).targets.find(t=>t.personId==='person:shao-heng').sceneId,'scene:supply');
});

check('Legacy clue grants only its corresponding responsibility, old completed story stays complete',()=>{
 const s=fresh();delete s.story.revenge;s.story.clues.push('ledger');initSRStory(s);
 let story=viewSRStory(saved(s));
 assert.equal(story.targets.find(t=>t.personId==='person:shao-heng').known,true);
 assert.equal(story.targets.find(t=>t.personId==='person:shao-heng').sceneId,'scene:supply');
 assert(!story.targets.some(t=>t.personId==='person:xing-lie'));
 const testimony=fresh();delete testimony.story.revenge;testimony.story.clues.push('testimony');initSRStory(testimony);
 story=viewSRStory(saved(testimony));
 assert.equal(story.targets.find(t=>t.personId==='person:xing-lie').known,true);
 assert(!story.targets.some(t=>t.personId==='person:shao-heng'));
 const old=fresh();delete old.story.revenge;old.story.completed=true;old.story.step=10;old.story.ending='rebuild';
 initSRStory(old);validateSRStory(old);
 assert.equal(viewSRStory(old).legacyEndingPreserved,true);
});

check('A delivered death rumor does not settle or permit remote confirmation',()=>{
 const s=fresh(),death=recordPermanentDeathSR(s,'person:han-lichuan',{sceneId:'scene:qixia',cause:'独立世界结果'});
 recordClaimSR(s,{id:'claim:qa:death-rumor',topic:'death',verification:'corroborated',evidenceFactIds:[death.id],text:'远处听说韩厉川身死'});
 const loaded=saved(s);loaded.worldTick++;tickSRStory(loaded);
 assert.equal(loaded.story.revenge.settled['person:han-lichuan'],undefined);
 assert.equal(viewSRStory(loaded).settledCount,0);
 assert.throws(()=>challengeSR(loaded,'person:han-lichuan'),/死亡尚未核实/);
 assert.equal(saved(loaded).story.revenge.settled['person:han-lichuan'],undefined);
});

check('Physical body check confirms death once and survives reload',()=>{
 const s=fresh(),death=recordPermanentDeathSR(s,'person:han-lichuan',{sceneId:'scene:qixia',cause:'独立世界结果'});
 travelSR(s,'scene:qixia');finishWorld(s);moveWorldSR(s,35,22);finishWorld(s);
 assert.equal(challengeSR(s,'person:han-lichuan').id,death.id);
 assert.equal(s.story.revenge.settled['person:han-lichuan'],death.id);
 assert.equal(viewSRStory(saved(s)).settledCount,1);
});

check('An acquired direct death fact permits settlement on the next world step',()=>{
 const s=fresh(),death=recordPermanentDeathSR(s,'person:han-lichuan',{sceneId:'scene:qixia',cause:'独立世界结果'});
 publishFactSR(s,death.id);
 const loaded=saved(s);loaded.worldTick++;tickSRStory(loaded);
 assert.equal(loaded.story.revenge.settled['person:han-lichuan'],death.id);
 assert.equal(viewSRStory(saved(loaded)).settledCount,1);
});

console.log(JSON.stringify({suite:'sr002-story-knowledge',passed:results.length,cases:results},null,2));
