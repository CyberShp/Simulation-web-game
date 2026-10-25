import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {createCombatSoundEvents} from '../../../apps/courtyard/courtyard-combat-audio.mjs';
import {createCombatEffectsRenderer} from '../../../apps/courtyard/courtyard-combat-effects.mjs';

// party-12/combat-observation.json: the ally hit at 265396 first appeared at
// 265398 after the browser skipped directly from 265393 (460.6 ms interval).
const hit={id:15,eventId:'combat:campaign:1:impact:15',tick:265396,kind:'hit',sourceId:1,targetId:'enemy-1',from:{x:4.36042317240112,y:3.46629420067066},to:{x:5.220000000000001,y:4},direction:{x:.8495625014530488,y:.5274879677536148},contact:{x:4.9226531244914336,y:3.815379211286235},contactHeight:.9,amount:10,remaining:.55,total:.75,actionId:'combat:campaign:1:1:attack:265394',rawAmount:10,preventedAmount:0,outcome:'hit',projectileId:null,reaction:'light',staggerTicks:0,staggerUntilTick:265385,interrupted:false};
const actor=(id,x,y)=>({id,personId:id===1?'person:lu-zhiwei':id==='master'?'person:master':'person:valley-shanxiao',hp:100,maxHp:100,x,y,facing:{x:1,y:0},motion:{action:'idle',phase:'idle',moveIntent:{x:0,y:0},movementLocked:false}});
const scene=(tick=265393,effects=[],extra={})=>({type:'combat',sessionId:'combat:campaign:1',status:'active',geometryId:'legacy',tick,player:actor('master',4.64,4.9),allies:[actor(1,4.36,3.47)],enemies:[actor('enemy-1',5.22,4)],effects,projectiles:[],...extra});
const marker=b=>b.effects.find(e=>e.eventId===hit.eventId)?.feedbackAgeMs;
function setup(){const presenter=createCombatPresentation(),sounds=createCombatSoundEvents(),base=scene();sounds.update(presenter.sample(base,{now:0}));return {presenter,sounds,base,late:scene(265398,[structuredClone(hit)])};}
function core(b){const rectangles=[],ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},strokeText(){},fillText(){},fillRect(...r){rectangles.push(r);}};
 const render=createCombatEffectsRenderer({ctx,worldToScreen:(x,y)=>({x:x*60,y:y*25+150}),getTransform:()=>({sx:60,sy:25}),getActorPresentation:a=>({height:87,foot:{x:a.x*60,y:a.y*25+150},hand:{x:a.x*60,y:a.y*25+100},swordTrail:[],swingWeight:0})});render.drawForeground(b,b.visualTick??b.tick);return rectangles.some(r=>r[2]===7&&r[3]===7);
}

test('the attested five-tick jump holds the actual ally and enemy briefly while the uninvolved master continues',()=>{
 const {presenter,late}=setup(),before=structuredClone(late),first=presenter.sample(late,{now:462}),next=presenter.sample(late,{now:482});assert.equal(marker(first),0);assert.equal(marker(next),20);
 assert.equal(next.allies[0].poseTick,first.allies[0].poseTick);assert.equal(next.enemies[0].poseTick,first.enemies[0].poseTick);assert(next.player.poseTick>first.player.poseTick);
 assert.deepEqual(next.player.motion,late.player.motion);assert.deepEqual(next.allies[0].motion,late.allies[0].motion);assert.equal(next.enemies[0].hp,late.enemies[0].hp);assert.equal(next.worldTick,late.tick);assert.deepEqual(late,before);
});

test('the attested delayed hit emits one blade contact cue and does not replay its old swing',()=>{
 const {presenter,sounds,late}=setup(),b=presenter.sample({...late,effects:[{...hit,id:14,eventId:'old-swing',kind:'attack'},hit]},{now:462});assert.deepEqual(sounds.update(b).map(c=>c.kind),['bladeHit']);assert.deepEqual(sounds.update(presenter.sample(late,{now:482})),[]);
 assert.deepEqual(sounds.update(presenter.sample(scene(265399,[hit]),{now:562})),[]);
});

test('the delayed hit receives one visible 90ms core without extending the original particle lifetime',()=>{
 const {presenter,late}=setup();assert.equal(core(late),false);const first=presenter.sample(late,{now:462});assert.equal(core(first),true);assert.equal(core(presenter.sample(late,{now:542})),true);assert.equal(core(presenter.sample(late,{now:557})),false);
 assert.equal(marker(presenter.sample(scene(265399,[hit]),{now:600})),undefined);assert.equal(core(presenter.sample(scene(265399,[hit]),{now:610})),false);
});

test('new hit admission is bounded to 500ms and does not catch up old unrelated cues',()=>{
 for(const [age,accepted]of [[5,true],[6,false]]){const {presenter,sounds}=setup(),tick=265396+age,b=presenter.sample(scene(tick,[hit]),{now:1000});assert.equal(marker(b)!==undefined,accepted);assert.equal(sounds.update(b).length,accepted?1:0);}
});

test('pause freezes first-seen age and resume cannot replay the contact or restart its hold',()=>{
 const {presenter,sounds,late}=setup(),first=presenter.sample(late,{now:462});assert.equal(sounds.update(first).length,1);const active=presenter.sample(late,{now:482}),paused=presenter.sample(late,{now:1000,paused:true}),held=presenter.sample(late,{now:9000,paused:true});sounds.update(paused,{paused:true});assert.equal(marker(active),20);assert.equal(marker(paused),20);assert.equal(marker(held),20);assert.deepEqual(held.allies,paused.allies);
 const resumed=presenter.sample(late,{now:9001});assert.equal(marker(resumed),20);assert.equal(resumed.allies[0].poseTick,held.allies[0].poseTick);assert.deepEqual(sounds.update(resumed),[]);assert.equal(core(resumed),true);assert.equal(core(presenter.sample(late,{now:9080})),false);
});

test('initial read restore rollback session changes and hits first seen while paused establish silent baselines',()=>{
 const late=scene(265398,[hit]),p=createCombatPresentation(),a=createCombatSoundEvents();let b=p.sample(late,{now:0});assert.equal(marker(b),undefined);assert.deepEqual(a.update(b),[]);
 p.reset();b=p.sample(late,{now:100});assert.equal(marker(b),undefined);assert.deepEqual(a.update(b,{paused:true}),[]);assert.deepEqual(a.update(b),[]);
 b=p.sample(scene(265397,[hit]),{now:200});assert.equal(marker(b),undefined);assert.deepEqual(a.update(b),[]);
 b=p.sample({...late,sessionId:'other-battle'},{now:300});assert.equal(marker(b),undefined);assert.deepEqual(a.update(b),[]);
 const q=createCombatPresentation();q.sample(scene(),{now:0});b=q.sample(late,{now:462,paused:true});assert.equal(marker(b),undefined);b=q.sample(late,{now:5000});assert.equal(marker(b),undefined);
});

test('zero damage guard evasion and misses keep their distinct feedback instead of becoming damage hits',()=>{
 for(const [outcome,amount,cue]of [['hit',0,null],['guarded',3,'guard'],['evaded',0,'evade'],['miss',0,null]]){const {presenter,sounds}=setup(),f={...hit,tick:265394,outcome,amount},b=presenter.sample(scene(265394,[f]),{now:100});assert.equal(marker(b),undefined);assert.equal(core(b),false);assert.deepEqual(sounds.update(b).map(c=>c.kind),cue?[cue]:[]);}
});

test('the final damaging event can present once on the won frame without reviving or rewinding the down actor',()=>{
 const {presenter,sounds}=setup(),terminal=scene(265398,[{...hit,reaction:'down'}],{status:'won'});terminal.enemies[0]={...terminal.enemies[0],hp:0,motion:{action:'down',phase:'down',startedTick:265396,phaseStartedTick:265396,phaseDurationTicks:12,phaseProgressTicks:2}};const before=structuredClone(terminal),shown=presenter.sample(terminal,{now:462});assert.equal(marker(shown),0);assert.equal(shown.enemies[0].hp,0);assert.equal(shown.enemies[0].motion.phase,'down');assert.deepEqual(sounds.update(shown).map(c=>c.kind),['heavyHit']);assert.deepEqual(sounds.update(presenter.sample(terminal,{now:482})),[]);assert.deepEqual(terminal,before);
});
