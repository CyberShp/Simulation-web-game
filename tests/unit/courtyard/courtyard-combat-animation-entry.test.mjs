import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCombatFrameManifest} from '../../../apps/courtyard/courtyard-combat-frame-metadata.mjs';
import {sampleCombatActor} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';

// Metadata fixtures exercise timing; they do not supply character artwork.
const clip=(identity,action,direction,phases,durationMs=80)=>normalizeCombatFrameManifest({
 schema:'combat-frame-atlas/v1',id:`entry:${identity}:${action}:${direction}`,visualIdentity:identity,action,direction,atlas:'fixture.png',frameSize:[32,48],sourceHeight:40,foot:[16,44],
 frames:phases.map((phase,index)=>({index,x:index*32,y:0,durationMs,phase})),
});
const library=new Map(['shen-yan','shanxiao'].map(identity=>[identity,{clips:['right','down','left','up'].flatMap(direction=>[
 clip(identity,'idle',direction,Array(4).fill('idle'),100),clip(identity,'move',direction,Array(6).fill('move'),83),
 clip(identity,'attack',direction,['windup','windup','release','recovery','recovery']),
 clip(identity,'spell',direction,['windup','windup','release','recovery','recovery']),
 clip(identity,'dodge',direction,['windup','release','recovery','evade']),
 clip(identity,'hit',direction,['hit','hit']),clip(identity,'down',direction,['down','down','down']),
])}]));
const body=(motion={},extra={})=>({id:'master',personId:'person:master',visualIdentity:'shen-yan',x:4,y:4,hp:100,facing:{x:1,y:0},motion:{action:'idle',phase:'idle',phaseStartedTick:1111,phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:false,moveIntent:{x:0,y:0},direction:{x:1,y:0},...motion},...extra});
const scene=(tick=1111,player=body(),extra={})=>({type:'combat',sessionId:'entry-test',geometryId:'legacy',tick,player,allies:[],enemies:[],projectiles:[],effects:[],...extra});
const pick=(shown,actor=shown.player)=>sampleCombatActor(actor,shown,shown.visualTick,library);
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('idle and run enter at frame zero at an arbitrary world tick and keep playing through reset motion starts',()=>{
 const presenter=createCombatPresentation();
 for(let ms=0;ms<=700;ms+=20){
  const tick=1111+Math.floor(ms/100),move=ms>=40?{x:1,y:0}:{x:0,y:0},authority=scene(tick,body({phaseStartedTick:tick})),before=structuredClone(authority),shown=presenter.sample(authority,{now:ms,intent:move}),sample=pick(shown);
  assert.equal(sample.clipAction,ms<40?'idle':'move');
  near(shown.player.animationElapsedTicks,(ms-(ms<40?0:40))/100);
  assert.equal(sample.pose.index,ms<40?0:Math.floor(((ms-40)%498)/83));assert.deepEqual(authority,before);
 }
});

test('direction changes retain the run phase, while stopping and restarting enter their own first frame',()=>{
 const presenter=createCombatPresentation(),b=scene();presenter.sample(b,{now:0,intent:{x:1,y:0}});
 for(const direction of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}]){
  const shown=presenter.sample(b,{now:90,intent:direction}),sample=pick(shown);assert.equal(sample.pose.index,1);near(shown.player.animationElapsedTicks,.9);assert.equal(sample.directionalFallback,false);
 }
 const stopped=presenter.sample(b,{now:91,intent:{x:0,y:0}});assert.equal(pick(stopped).clipAction,'idle');assert.equal(pick(stopped).pose.index,0);assert.equal(stopped.player.animationElapsedTicks,0);
 const restarted=presenter.sample(b,{now:92,intent:{x:-1,y:0}});assert.equal(pick(restarted).clipAction,'move');assert.equal(pick(restarted).pose.index,0);assert.equal(restarted.player.animationElapsedTicks,0);
});

test('a release owns its actual step before the following accepted movement enters run at frame zero',()=>{
 for(const action of ['attack','spell','guard']){
  const presenter=createCombatPresentation(),motion={action,phase:'release',actionId:action+':1',startedTick:1109,executeAtTick:1111,recoveryUntilTick:1116,moveIntent:{x:1,y:0}};
  const release=presenter.sample(scene(1111,body(motion)),{now:0,intent:{x:1,y:0}});assert.equal(pick(release).phase,'release');assert.notEqual(pick(release).clipAction,'move');
  const recovery=scene(1112,body({...motion,phase:'recovery',phaseStartedTick:1112,phaseDurationTicks:4})),run=presenter.sample(recovery,{now:100,intent:{x:1,y:0}}),sample=pick(run);
  assert.equal(sample.runtimePhase,'recovery');assert.equal(sample.phase,'move');assert.equal(sample.pose.index,0);assert.equal(sample.clipAction,'move');assert.equal(run.player.animationElapsedTicks,0);
 }
});

test('attack spell hit dodge and death take their authoritative phase immediately, and recovered running restarts',()=>{
 for(const [action,phase,index]of [['attack','release',2],['spell','release',2],['hit','hit',0],['dodge','windup',0],['dodge','release',1],['dodge','recovery',2],['dodge','evade',3],['down','down',0]]){
  const presenter=createCombatPresentation(),b=scene(1111,body({action:'move',phase:'move',moveIntent:{x:1,y:0}}));presenter.sample(b,{now:0,intent:{x:1,y:0}});presenter.sample(b,{now:99,intent:{x:1,y:0}});
  const next=scene(1112,body({action,phase,actionId:'reaction:1',startedTick:1112,executeAtTick:1112,recoveryUntilTick:1114,movementLocked:true},{hp:phase==='down'?0:100})),shown=presenter.sample(next,{now:100,intent:{x:1,y:0}}),sample=pick(shown);
  assert.equal(sample.clipAction,action);assert.equal(sample.pose.index,index);assert.equal(shown.player.animationElapsedTicks,undefined);
  if(phase!=='down'){const restored=presenter.sample(scene(1113,body({action:'move',phase:'move',moveIntent:{x:1,y:0}})),{now:200,intent:{x:1,y:0}});assert.equal(pick(restored).pose.index,0);assert.equal(restored.player.animationElapsedTicks,0);}
 }
});

test('pause and resume preserve loop elapsed and fractional frame, independent of paused wall time',()=>{
 const presenter=createCombatPresentation(),b=scene(1111,body({action:'move',phase:'move',moveIntent:{x:1,y:0}}));presenter.sample(b,{now:0,intent:{x:1,y:0}});presenter.sample(b,{now:99,intent:{x:1,y:0}});
 const paused=presenter.sample(b,{now:100,paused:true}),held=presenter.sample(b,{now:9000,paused:true}),resumed=presenter.sample(b,{now:9001,intent:{x:1,y:0}});
 assert.deepEqual(held.player,paused.player);assert.equal(pick(resumed).frameKey,pick(paused).frameKey);near(resumed.player.animationElapsedTicks,paused.player.animationElapsedTicks);
 const next=presenter.sample(scene(1112,body({action:'move',phase:'move',phaseStartedTick:1112,moveIntent:{x:1,y:0}})),{now:9002,intent:{x:1,y:0}});near(next.player.animationElapsedTicks,1);assert.equal(pick(next).pose.index,1);
});

test('loop origins belong to each visual identity and reset on battle change, readback, exit and explicit reset',()=>{
 const presenter=createCombatPresentation(),b=scene(1111,body({action:'move',phase:'move'}),{enemies:[body({action:'move',phase:'move'},{id:'foe',personId:'person:valley-shanxiao',visualIdentity:'shanxiao',entityKind:'beast',x:8})]});
 presenter.sample(b,{now:0});const advanced=presenter.sample(b,{now:99});assert.equal(pick(advanced).pose.index,1);assert.equal(pick(advanced,advanced.enemies[0]).pose.index,1);
 const swapped=scene(1111,{...b.player,visualIdentity:'shanxiao'},{enemies:b.enemies}),changed=presenter.sample(swapped,{now:100});assert.equal(changed.player.animationElapsedTicks,0);near(changed.enemies[0].animationElapsedTicks,1);
 for(const next of [scene(1110,b.player),scene(400,b.player,{sessionId:'other'}),scene(400,b.player,{sessionId:'third'})]){const fresh=presenter.sample(next,{now:1000});assert.equal(fresh.player.animationElapsedTicks,0);assert.equal(pick(fresh).pose.index,0);}
 presenter.sample(scene(400,b.player,{sessionId:'third'}),{now:1099});presenter.sample({type:'travel'},{now:1100});assert.equal(presenter.sample(scene(400,b.player,{sessionId:'third'}),{now:2000}).player.animationElapsedTicks,0);
 presenter.sample(scene(400,b.player,{sessionId:'third'}),{now:2099});presenter.reset();assert.equal(presenter.sample(scene(400,b.player,{sessionId:'third'}),{now:3000,paused:true}).player.animationElapsedTicks,0);
});

test('identical projected snapshots and elapsed ticks yield identical samples, and the final death pose holds',()=>{
 const presenter=createCombatPresentation(),b=scene();presenter.sample(b,{now:0});const shown=presenter.sample(b,{now:90});assert.deepEqual(pick(shown),pick(structuredClone(shown)));
 const down=body({action:'down',phase:'down',phaseStartedTick:1100,phaseDurationTicks:12,phaseProgressTicks:12},{hp:0});
 for(const tick of [1112,1113,1200]){const death=scene(tick,down),sample=sampleCombatActor(down,death,tick,library);assert.equal(sample.pose.index,2);assert.equal(sample.clipAction,'down');}
});

test('a single front reaction reports its actual source direction when reused by other facings',()=>{
 const frontOnly=new Map([['shen-yan',{clips:[clip('shen-yan','hit','down',['hit']),clip('shen-yan','down','down',['down','down','down'])]}]]);
 for(const direction of [{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1},{x:0,y:-1},{x:1,y:-1}])for(const phase of ['hit','down']){
  const actor=body({action:phase,phase,direction},{facing:direction,hp:phase==='down'?0:100}),sample=sampleCombatActor(actor,scene(1111,actor),1111,frontOnly);
  assert.equal(sample.clipDirection,'down');assert.equal(sample.directionalFallback,!(direction.x===0&&direction.y>0));assert.equal(sample.mirrored,false);assert.equal(sample.clipAction,phase);assert.equal(sample.actionFallback,false);assert.equal(sample.phaseFallback,false);
 }
});
