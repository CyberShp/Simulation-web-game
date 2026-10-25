import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {sampleCombatActor} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
const actor=(motion={},extra={})=>({id:'master',personId:'person:master',x:3.649999953137634,y:4.8999995066541215,hp:151,facing:{x:1,y:0},motion:{action:'move',phase:'move',phaseStartedTick:265380,phaseDurationTicks:1,phaseProgressTicks:0,moveIntent:{x:1,y:0},direction:{x:1,y:0},...motion},...extra});
const scene=(tick=265380,p=actor(),extra={})=>({type:'combat',sessionId:'pause-continuity',geometryId:'legacy',tick,player:p,allies:[],enemies:[],projectiles:[],effects:[],...extra});
const tickOf=(body,b)=>sampleCombatActor(body,b,b.visualTick).tick;

test('same-snapshot pause/resume retains the already displayed fractional pose tick, including the native 99ms case',()=>{
 for(const milliseconds of [99,0,1,50,100]){
  const presenter=createCombatPresentation(),p=actor(),b=scene(265380,p,{allies:[{...p,id:'ally',personId:'person:ally',x:5}]}),before=structuredClone(b);
  presenter.sample(b,{now:0});const shown=presenter.sample(b,{now:milliseconds}),paused=presenter.sample(b,{now:200,paused:true}),later=presenter.sample(b,{now:10000,paused:true}),resumed=presenter.sample(b,{now:10001});
  assert.equal(shown.visualTick,265380+Math.min(1,milliseconds/100));assert.deepEqual(later,paused);assert.equal(resumed.visualTick,paused.visualTick);
  for(const [a,z]of [[resumed.player,paused.player],[resumed.allies[0],paused.allies[0]]]){assert.equal(a.poseTick,z.poseTick);assert.equal(tickOf(a,resumed),tickOf(z,paused));}
  assert.deepEqual(b,before);
 }
});

test('repeated pauses exclude paused wall time and a later authoritative step removes the old fractional offset',()=>{
 const presenter=createCombatPresentation(),b=scene(),before=structuredClone(b);presenter.sample(b,{now:0});presenter.sample(b,{now:49});const frozen=presenter.sample(b,{now:50,paused:true});
 assert.equal(presenter.sample(b,{now:10000}).visualTick,frozen.visualTick);assert.equal(presenter.sample(b,{now:10020}).visualTick,b.tick+.69);
 const second=presenter.sample(b,{now:10021,paused:true});assert.equal(presenter.sample(b,{now:20000}).visualTick,second.visualTick);
 assert.equal(presenter.sample(b,{now:20100}).visualTick,b.tick+1);assert.equal(presenter.sample(b,{now:90000}).visualTick,b.tick+1);
 const next=scene(b.tick+1,actor({phaseStartedTick:b.tick+1},{x:b.player.x+.33})),fresh=presenter.sample(next,{now:90001});assert.equal(fresh.visualTick,next.tick);assert.equal(fresh.player.poseTick,next.tick);assert.equal(presenter.sample(next,{now:90051}).visualTick,next.tick+.5);assert.deepEqual(b,before);
 const advancedBeforeResume=createCombatPresentation();advancedBeforeResume.sample(b,{now:0});advancedBeforeResume.sample(b,{now:99});advancedBeforeResume.sample(b,{now:100,paused:true});assert.equal(advancedBeforeResume.sample(next,{now:10000}).visualTick,next.tick);
});

test('resuming a capped windup cannot synthesize release, motion, damage or another world step',()=>{
 const tick=100,p=actor({action:'attack',phase:'windup',actionId:'attack:1',startedTick:tick,executeAtTick:tick+1,phaseStartedTick:tick,phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:true,moveIntent:{x:0,y:0}}),b=scene(tick,p,{enemies:[{...p,id:'foe',personId:'person:foe',hp:80}]}),before=structuredClone(b),presenter=createCombatPresentation();
 presenter.sample(b,{now:0});presenter.sample(b,{now:99});presenter.sample(b,{now:100,paused:true});const resumed=presenter.sample(b,{now:10000}),waiting=presenter.sample(b,{now:90000});
 for(const r of [resumed,waiting]){assert.equal(r.worldTick,tick);assert(r.visualTick<=tick+1);assert.equal(r.player.motion.phase,'windup');assert.equal(sampleCombatActor(r.player,r).phase,'windup');assert.equal(r.enemies[0].hp,80);assert.equal(r.player.x,p.x);}
 const release=scene(tick+1,actor({...p.motion,phase:'release',phaseStartedTick:tick+1}),{enemies:[{...b.enemies[0],hp:53}]}),shown=presenter.sample(release,{now:90001});assert.equal(shown.visualTick,tick+1);assert.equal(sampleCombatActor(shown.player,shown).phase,'release');assert.equal(shown.enemies[0].hp,53);assert.deepEqual(b,before);
});

test('a new plan created while paused starts at its own displayed beginning rather than inheriting an earlier fraction',()=>{
 const presenter=createCombatPresentation(),b=scene(100,actor({action:'idle',phase:'idle',moveIntent:{x:0,y:0}}));presenter.sample(b,{now:0});presenter.sample(b,{now:99});presenter.sample(b,{now:100,paused:true});
 const planned=scene(100,actor({action:'spell',phase:'windup',actionId:'spell:new',startedTick:100,executeAtTick:104,phaseStartedTick:100,phaseDurationTicks:4,phaseProgressTicks:0,movementLocked:true,moveIntent:{x:0,y:0}})),before=structuredClone(planned),shown=presenter.sample(planned,{now:1000,paused:true});assert.equal(shown.player.poseTick,100);
 assert.equal(presenter.sample(planned,{now:2000,paused:true}).player.poseTick,100);const resumed=presenter.sample(planned,{now:2001});assert.equal(resumed.player.poseTick,100);assert.equal(resumed.player.motion.actionId,'spell:new');assert.equal(sampleCombatActor(resumed.player,resumed).phase,'windup');assert.deepEqual(planned,before);
});

test('pause/resume preserves the visible contact hold age without spending paused wall time',()=>{
 const p=actor({action:'hit',phase:'hit',moveIntent:{x:0,y:0},movementLocked:true}),b=scene(100,p,{effects:[{id:1,eventId:'impact:1',kind:'hit',tick:100,sourceId:'foe',targetId:'master',outcome:'hit'}]}),presenter=createCombatPresentation(),before=structuredClone(b);
 presenter.sample(b,{now:0});const shown=presenter.sample(b,{now:50}),paused=presenter.sample(b,{now:1000,paused:true});assert.equal(paused.player.poseTick,shown.player.poseTick);
 const later=presenter.sample(b,{now:10000,paused:true}),resumed=presenter.sample(b,{now:10001});assert.equal(later.player.poseTick,paused.player.poseTick);assert.equal(resumed.player.poseTick,paused.player.poseTick);assert(presenter.sample(b,{now:10011}).player.poseTick>=resumed.player.poseTick);assert.deepEqual(b,before);
});

test('battle changes, backwards readback and explicit same-tick reinitialization discard presentation residue',()=>{
 const presenter=createCombatPresentation(),b=scene();presenter.sample(b,{now:0});presenter.sample(b,{now:99});presenter.sample(b,{now:100,paused:true});
 const other=scene(42,actor({phaseStartedTick:42}),{sessionId:'other-battle'});assert.equal(presenter.sample(other,{now:10000}).visualTick,42);presenter.sample(other,{now:10099});presenter.sample(other,{now:10100,paused:true});
 const rollback=scene(40,actor({phaseStartedTick:40}),{sessionId:'other-battle'});assert.equal(presenter.sample(rollback,{now:20000}).visualTick,40);presenter.sample(rollback,{now:20099});presenter.sample(rollback,{now:20100,paused:true});
 presenter.reset();assert.equal(presenter.sample(structuredClone(rollback),{now:30000,paused:true}).visualTick,40);
 // The product's recovery path reloads the page and creates a fresh presenter.
 const loaded=createCombatPresentation();assert.equal(loaded.sample(structuredClone(rollback),{now:40000,paused:true}).player.poseTick,40);
});
