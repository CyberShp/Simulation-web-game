import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeCombatFrameManifest} from '../../../apps/courtyard/courtyard-combat-frame-metadata.mjs';
import {sampleCombatActor} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';

// Frame metadata only: these fixtures do not supply or approve character art.
const directions=[['right',1,0],['down-right',1,1],['down',0,1],['down-left',-1,1],['left',-1,0],['up-left',-1,-1],['up',0,-1],['up-right',1,-1]];
const moveClip=(direction,period=600,action='move')=>normalizeCombatFrameManifest({schema:'combat-frame-atlas/v1',id:`move-fixture:${direction}:${period}`,visualIdentity:'shen-yan',action,direction,atlas:'fixture.png',frameSize:[16,24],sourceHeight:20,foot:[8,22],frames:Array.from({length:16},(_,index)=>({index,x:index*16,y:0,durationMs:period/16,phase:'move'}))});
const base=new URL('../../../assets/courtyard/combat-actors-v3/',import.meta.url),realClips=await Promise.all(['idle-right','attack-right','spell-right','dodge-right','hit-right','down-right'].map(async name=>normalizeCombatFrameManifest(JSON.parse(await fs.readFile(new URL('shen-yan/'+name+'/manifest.json',base))),{path:'shen-yan/'+name+'/manifest.json'})));
const library=(period=600,action='move',angles=directions.map(d=>d[0]))=>new Map([['shen-yan',{clips:[...realClips,...angles.map(name=>moveClip(name,period,action))]}]]);
const actor=(motion={},extra={})=>({id:'master',personId:'person:master',visualIdentity:'shen-yan',x:4,y:4,hp:100,facing:{x:1,y:0},motion:{action:'move',phase:'move',phaseStartedTick:1200,phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:false,direction:{x:1,y:0},moveIntent:{x:1,y:0},...motion},...extra});
const scene=(tick=1200,p=actor(),extra={})=>({type:'combat',sessionId:'move-atlas',geometryId:'legacy',tick,worldTick:tick,player:p,allies:[],enemies:[],projectiles:[],effects:[],...extra});
const pick=(b,lib)=>sampleCombatActor(b.player,b,b.visualTick??b.tick,lib);
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('sixteen complete move frames follow fractional poseTick across reset formal motion phases',()=>{
 for(const period of [500,600])for(const action of ['move','walk']){
  const lib=library(period,action),presenter=createCombatPresentation(),seen=new Set();
  for(let ms=0;ms<=period*2;ms+=12.5){
   const tick=1200+Math.floor(ms/100),p=actor({}, {x:4+(tick-1200)*.33,movedTick:tick}),state={worldTick:tick,combat:{status:'active',player:p,controls:{move:{x:1,y:0}}},srCombat:{pending:null}};
   p.motion=projectCombatActorMotion(state,p);assert.equal(p.motion.phaseProgressTicks,0);assert.equal(p.motion.phaseDurationTicks,1);
   const b=scene(tick,p),before=structuredClone(b),shown=presenter.sample(b,{now:ms,intent:{x:1,y:0}}),s=pick(shown,lib);
   near(s.tick,1200+ms/100);assert.equal(s.pose.index,Math.floor((ms%period)/(period/16)));assert.equal(s.clipAction,action);assert.equal(s.phaseFallback,false);assert.equal(s.actionFallback,false);assert.deepEqual(s.pose.foot,[8,22]);assert.equal(s.pose.sourceHeight,20);seen.add(s.pose.index);assert.deepEqual(b,before);
  }
  assert.equal(seen.size,16);
 }
});

test('live input changes all eight authored move directions without restarting the cycle and stops the body immediately',()=>{
 const lib=library(),b=scene(),before=structuredClone(b),presenter=createCombatPresentation();presenter.sample(b,{now:0,intent:{x:1,y:0}});
 for(const [name,x,y]of directions){const shown=presenter.sample(b,{now:45,intent:{x,y}}),s=pick(shown,lib);assert.equal(s.atlasDirection,name);assert.equal(s.directionalFallback,false);assert.equal(s.clipId,`move-fixture:${name}:600`);assert.equal(s.pose.index,1);assert.equal(s.phase,'move');}
 const stopped=presenter.sample(b,{now:46,intent:{x:0,y:0}}),idle=pick(stopped,lib);assert.equal(idle.phase,'idle');assert.equal(idle.clipAction,'idle');assert.equal(idle.visualOverride,null);
 assert.equal(pick(presenter.sample(b,{now:90,intent:{x:0,y:0}}),lib).clipAction,'idle');assert.deepEqual(b,before);
});

test('a right-only move clip keeps missing left art explicit while same-side diagonals preserve cycle phase',()=>{
 const lib=library(600,'move',['right']);
 for(const [name,x,y]of directions){const p=actor({direction:{x,y}},{facing:{x,y},poseTick:1200.45}),s=pick(scene(1200,p),lib);if(x>=0){assert.equal(s.clipAction,'move');assert.equal(s.pose.index,1);assert.equal(s.directionalFallback,name!=='right');}else{assert.equal(s.clipAction,undefined);assert.equal(s.assetFallback,true);assert.equal(s.pose.atlas,undefined);assert.equal(s.facing,'left');}}
});

test('the authoritative release step retains its action before a following accepted move takes the atlas',()=>{
 const lib=library();for(const action of ['attack','spell','guard']){
  const motion={action,phase:'release',startedTick:1200,executeAtTick:1202,recoveryUntilTick:1208,movementLocked:false,moveIntent:{x:1,y:0}},p=actor(motion,{poseTick:1202.99}),released=pick(scene(1202,p),lib);assert.equal(released.phase,'release');assert.equal(released.action,action);assert.equal(released.visualOverride,null);
  const walking=pick(scene(1203,actor({...motion,phase:'recovery',phaseStartedTick:1203,phaseDurationTicks:5,phaseProgressTicks:0},{poseTick:1203.25})),lib);assert.equal(walking.runtimePhase,'recovery');assert.equal(walking.runtimeAction,action);assert.equal(walking.phase,'move');assert.equal(walking.clipAction,'move');assert.equal(walking.visualOverride,'released-move');assert.equal(walking.pose.index,8);
  const blocked=pick(scene(1203,actor({...motion,phase:'recovery',movementLocked:true})),lib);assert.equal(blocked.phase,'recovery');assert.notEqual(blocked.clipAction,'move');
 }
});

test('formal dodge stages and hit/down retain priority over move clips and held movement',()=>{
 const lib=library();for(const [phase,index]of [['windup',0],['release',1],['recovery',2],['evade',3]]){
  const p=actor({action:'dodge',phase,startedTick:1200,executeAtTick:1201,recoveryUntilTick:1202,phaseProgressTicks:0},{poseTick:1202.75}),s=pick(scene(1202,p),lib);assert.equal(s.clipAction,'dodge');assert.equal(s.pose.index,index);assert.equal(s.visualOverride,null);assert.equal(s.phase,'evade');
 }
 for(const phase of ['hit','down']){const p=actor({action:phase,phase},{hp:phase==='down'?0:100,hitReaction:{kind:'heavy'}}),s=pick(scene(1203,p),lib);assert.equal(s.clipAction,phase);assert.equal(s.phase,phase);assert.equal(s.visualOverride,null);}
});

test('move pause/resume freezes fractional frames and new ticks, sessions and resets reanchor to authority',()=>{
 const lib=library(),b=scene(),before=structuredClone(b),presenter=createCombatPresentation();presenter.sample(b,{now:0,intent:{x:1,y:0}});presenter.sample(b,{now:99,intent:{x:1,y:0}});
 const paused=presenter.sample(b,{now:100,paused:true,intent:{x:1,y:0}}),held=presenter.sample(b,{now:9000,paused:true,intent:{x:-1,y:0}}),resumed=presenter.sample(b,{now:9001,intent:{x:1,y:0}});assert.deepEqual(held.player,paused.player);assert.equal(pick(held,lib).frameKey,pick(paused,lib).frameKey);assert.equal(pick(resumed,lib).frameKey,pick(paused,lib).frameKey);near(resumed.player.poseTick,paused.player.poseTick);
 const advanced=presenter.sample(scene(1201),{now:9002,intent:{x:1,y:0}});near(advanced.player.poseTick,1201);assert.equal(pick(advanced,lib).pose.index,2);
 for(const next of [scene(1199),scene(100,actor(),{sessionId:'new-battle'})]){const fresh=presenter.sample(next,{now:9500,intent:{x:1,y:0}});near(fresh.player.poseTick,next.tick);assert.equal(fresh.player.animationElapsedTicks,0);assert.equal(pick(fresh,lib).pose.index,0);}
 presenter.reset();const loaded=presenter.sample(b,{now:10000,intent:{x:1,y:0}});near(loaded.player.poseTick,1200);assert.equal(pick(loaded,lib).pose.index,0);assert.deepEqual(b,before);
});
