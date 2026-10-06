import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../dist/ea-sim.mjs';
import * as narrative from '../dist/ea-narrative.mjs';
import { Player } from '../qa/ea-player.mjs';

let chapterCache, foundationCache;
function chapter(){chapterCache||=new Player().chapterOne().state;return new Player(structuredClone(chapterCache));}
function foundation(){foundationCache||=chapter().foundation().state;return new Player(structuredClone(foundationCache));}
function metadata(s,{legacy=false}={}){if(s.story.narrative===undefined)narrative.initNarrative(s,{legacy});sim.acknowledgeIntro(s);return s;}
function readAll(s){for(let i=0;i<50;i++){const pending=narrative.narrativeForState(s).pending;if(!pending)return;narrative.acknowledgeNarrative(s,pending.id);}assert.fail('narrative queue must settle');}

test('prologue owns the initial pause; pure narrative queries never mutate or grant anything',()=>{
  const s=sim.initial();narrative.initNarrative(s);const original=structuredClone(s);
  assert.equal(narrative.narrativeForState(s).pending,null);
  assert.equal(narrative.regionInteractions(s).length,0);
  assert.equal(narrative.homeInteractions(s)[0].kind,'object');
  assert.equal(narrative.sceneDialogue(s,'chapter:8'),null);
  assert.deepEqual(s,original);
  assert.throws(()=>narrative.acknowledgeNarrative(s,'chapter:8'),/尚未发生/);
  assert.deepEqual(s,original,'future acknowledgement is rejected before metadata mutation');
});

test('scene pages resume exactly and acknowledgement is idempotent without story or resource side effects',()=>{
  const p=new Player();metadata(p.state);p.action('masterAction','heal');p.until(s=>s.master.wound===0,{limit:100,chunk:1});p.action('advanceStory');
  const s=p.state,before=structuredClone(s),pending=narrative.narrativeForState(s).pending;
  assert.equal(pending.id,'chapter:1');
  narrative.setNarrativePage(s,pending.id,1);
  const restored=sim.validateSave(s);
  assert.equal(narrative.narrativeForState(restored).pending.cursor,1);
  assert.equal(narrative.acknowledgeNarrative(restored,pending.id),true);
  const once=structuredClone(restored);
  assert.equal(narrative.acknowledgeNarrative(restored,pending.id),false);
  assert.deepEqual(restored,once);
  assert.deepEqual(restored.resources,before.resources);
  assert.equal(restored.story.step,before.story.step);
  assert.deepEqual(restored.story.claimed,before.story.claimed);
  assert.deepEqual(restored.disciples,before.disciples);
  assert.equal(restored.story.narrative.cursor,null);
  assert.throws(()=>narrative.setNarrativePage(restored,pending.id,0),/已读完/);
});

test('old progressed worlds baseline already-earned scenes and only new evidence enters the queue',()=>{
  const p=chapter();delete p.state.story.narrative;sim.acknowledgeIntro(p.state);
  const old=structuredClone(p.state);
  assert.equal(narrative.narrativeForState(p.state).pending,null,'missing metadata does not imply a new game');
  narrative.initNarrative(p.state,{legacy:true});
  assert.equal(narrative.narrativeForState(p.state).pending,null);
  assert.deepEqual(p.state.resources,old.resources);
  p.explore('market','repair',{wood:20,stone:10});
  const pending=narrative.narrativeForState(p.state).pending;
  assert.equal(pending.id,'clue:ledger');
  assert.match(pending.pages.map(p=>p.text).join(''),/原册|誊本/);
  assert.deepEqual(narrative.narrativeForState(p.state).clues.map(c=>c.id),['ledger']);
  assert.equal(narrative.sceneDialogue(p.state,'clue:testimony'),null,'unfound evidence is not spoiled');
  const loaded=sim.validateSave(p.state);narrative.acknowledgeNarrative(loaded,pending.id);
  assert.equal(narrative.narrativeForState(loaded).pending,null);
});

test('on-site dialogue uses the real landmark and campaign choices, including distance and costs',()=>{
  const p=chapter();metadata(p.state);readAll(p.state);p.rest();p.action('startExploration','market');
  assert.deepEqual(narrative.regionInteractions(p.state),[],'no remote interaction during travel');
  p.until(s=>s.world.exploration.status==='exploring',{limit:100,chunk:1});
  let interaction=narrative.regionInteractions(p.state)[0];
  assert.equal(interaction.kind,'person');assert.deepEqual(interaction.position,{x:8,y:4});
  assert.ok(interaction.choices.every(c=>c.disabled&&/走近/.test(c.reason)));
  p.action('moveExploration',8,4);p.until(s=>sim.explorationOptions(s).active.canInteract,{limit:100,chunk:1});
  interaction=narrative.regionInteractions(p.state)[0];
  const authoritative=sim.explorationOptions(p.state).active.choices;
  assert.deepEqual(interaction.choices.map(({id,cost,disabled})=>({id,cost,disabled})),authoritative.map(({id,cost,disabled})=>({id,cost,disabled})));
  for(const c of interaction.choices){assert.equal(c.command,'resolveExploration');assert.deepEqual(c.args,[c.id]);}
  const before=structuredClone(p.state);interaction.choices[0].cost.jade=999;interaction.pages[0].text='changed';
  assert.deepEqual(p.state,before,'UI projections do not share mutable state');
});

test('the first knock appears after healing and listening never changes state by itself',()=>{
 const s=sim.initial();assert.equal(narrative.homeInteractions(s)[0].kind,'object');
 sim.masterAction(s,'heal');sim.tick(s,15);const before=structuredClone(s),arrival=narrative.homeInteractions(s)[0];
 assert.equal(arrival.kind,'person');assert.equal(arrival.name,'院外来客');assert.match(arrival.pages[0].text,/叩门声/);
 assert.equal(arrival.choices[0].disabled,false);assert.deepEqual(s,before);
});

test('home visitor dialogue references authoritative stage requirements and does not recruit by reading',()=>{
  const p=new Player();metadata(p.state);p.action('masterAction','heal');p.until(s=>s.master.wound===0,{limit:100,chunk:1});p.action('advanceStory');
  const before=structuredClone(p.state),visitor=narrative.homeInteractions(p.state)[0];
  assert.equal(visitor.name,'陆知微');assert.equal(visitor.kind,'person');assert.match(visitor.pages[0].text,/十份灵草/);
  assert.equal(visitor.choices[0].command,'advanceStory');
  assert.deepEqual(p.state,before);
  p.resources({herb:10});p.action('advanceStory');
  assert.equal(narrative.homeInteractions(p.state)[0].name,'林长风');
  assert.equal(p.state.disciples.filter(d=>d.name==='陆知微').length,1);
});

test('battle outcome controls take priority and defeat keeps a normal heal and retry path',()=>{
  const p=foundation();metadata(p.state);readAll(p.state);p.prepareRevenge();p.action('resolveExploration','challenge');
  assert.equal(narrative.narrativeForState(p.state).pending,null,'active combat is never hidden by cutscenes');
  p.until(s=>s.combat.status!=='active',{limit:200,chunk:1});
  assert.equal(p.state.combat.status,'lost');
  const view=narrative.narrativeForState(p.state);
  assert.equal(view.pending,null,'combat result acknowledgement remains available');
  assert.deepEqual(view.recovery.args,['heal']);assert.equal(view.recovery.command,'masterAction');
  const id=`recovery:${p.state.combat.journeyId}:lost`;
  assert.match(narrative.sceneDialogue(p.state,id).pages[0].text,/根基没有受损|不会.*消失/);
  narrative.setNarrativePage(p.state,id,0);
  assert.equal(p.state.story.narrative.cursor,null,'failure has no cursor tied to a removable combat object');
  narrative.acknowledgeNarrative(p.state,id);p.action('acknowledgeCombat');
  p.validate();p.resources({herb:6});p.action('masterAction','heal');
  p.until(s=>s.master.wound===0,{limit:100,chunk:1});
  assert.equal(narrative.narrativeForState(p.state).recovery,null);
  p.explore('qixia','challenge',{}, {leave:false});assert.equal(p.state.combat.status,'active');
});

test('resolved regional evidence speaks of the retained result instead of asking for duplicate proof',()=>{
  const p=chapter();metadata(p.state);p.explore('market','repair',{wood:20,stone:10},{leave:false});
  const interaction=narrative.regionInteractions(p.state)[0];
  assert.match(interaction.pages[0].text,/证据已誊录带走/);
  assert.equal(interaction.completed,true);
  assert.deepEqual(interaction.choices,[]);
  const resources={...p.state.resources};narrative.acknowledgeNarrative(p.state,'clue:ledger');
  assert.deepEqual(p.state.resources,resources);
});

test('reading metadata rejects invalid pages and duplicate ids without touching the world',()=>{
  const p=chapter();metadata(p.state);const before=structuredClone(p.state);
  assert.throws(()=>narrative.setNarrativePage(p.state,'chapter:4',99),/幕次/);
  assert.deepEqual(p.state,before);
  const malformed=structuredClone(p.state);malformed.story.narrative.acknowledged=['chapter:1','chapter:1'];
  assert.throws(()=>narrative.validateNarrative(malformed),/阅读记录/);
  const cursor=structuredClone(p.state);cursor.story.narrative.cursor={id:'ending:return',page:0};
  assert.throws(()=>narrative.validateNarrative(cursor),/阅读记录/);
});

test('both real campaign endings respond to preparations and close revenge without repeated rewards',()=>{
  const p=foundation();metadata(p.state);p.prepareRevenge();readAll(p.state);
  p.action('resolveExploration','challenge');assert.equal(p.fight(),'won');
  assert.equal(narrative.narrativeForState(p.state).pending,null);
  p.action('acknowledgeCombat');readAll(p.state);p.action('advanceStory');readAll(p.state);
  assert.equal(p.state.story.step,9);
  for(const choice of ['return','rebuild']) {
    const s=structuredClone(p.state);sim.advanceStory(s,choice);
    const pending=narrative.narrativeForState(s).pending;
    assert.equal(pending.id,`ending:${choice}`);
    const text=pending.pages.map(p=>p.text).join('');
    assert.match(text,choice==='return'?/带回云岫/:/重新有人烟/);
    assert.match(text,/复仇大篇章已经结束/);
    const responses=narrative.choiceResponses(s);
    assert.ok(responses.some(r=>r.id==='witness'&&/赎救/.test(r.text)));
    assert.ok(responses.some(r=>r.id==='supply'&&/粮食/.test(r.text)));
    assert.ok(responses.some(r=>r.id==='array'));
    assert.ok(responses.some(r=>r.id==='public'));
    const before=structuredClone(s);
    narrative.acknowledgeNarrative(s,pending.id);narrative.acknowledgeNarrative(s,pending.id);
    assert.deepEqual(s.resources,before.resources);
    assert.deepEqual(s.story.claimed,before.story.claimed);
    assert.equal(s.story.completed,true);sim.validateSave(s);
  }
});
