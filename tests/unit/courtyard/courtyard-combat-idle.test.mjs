import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeCombatFrameManifest,sampleCombatFrameAtlas} from '../../../apps/courtyard/courtyard-combat-frame-metadata.mjs';
import {sampleCombatActor} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';

const base=new URL('../../../assets/courtyard/combat-actors-v3/',import.meta.url);
const readClip=async path=>normalizeCombatFrameManifest(JSON.parse(await fs.readFile(new URL(path,base))),{path});
const idle=await readClip('shen-yan/idle-right/manifest.json'),registry=JSON.parse(await fs.readFile(new URL('registry.json',base)));
const masterClips=await Promise.all(registry.actors['shen-yan'].clips.map(ref=>readClip(ref.manifest)));
// Keep this missing-move regression independent of later registered run clips.
const previous=new Map([['shen-yan',{clips:masterClips.filter(c=>!['idle','move','walk'].includes(c.action))}]]),current=new Map([['shen-yan',{clips:[...previous.get('shen-yan').clips,idle]}]]);
const actor=(motion={},extra={})=>({id:'master',personId:'person:master',visualIdentity:'shen-yan',x:4,y:4,hp:100,facing:{x:1,y:0},motion:{action:'idle',phase:'idle',phaseStartedTick:1200,phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:false,direction:{x:1,y:0},moveIntent:{x:0,y:0},...motion},...extra});
const scene=(tick=1200,p=actor())=>({type:'combat',sessionId:'idle-atlas',tick,worldTick:tick,player:p,allies:[],enemies:[],projectiles:[],effects:[]});
const pick=(p,b=scene(1200,p),library=current)=>sampleCombatActor(p,b,b.tick,library);
const legacyPose=s=>({image:s.pose.image,crop:s.pose.crop,foot:s.pose.foot,sourceHeight:s.pose.sourceHeight,castIndex:s.castIndex});
const synthetic=(identity,action,phases)=>normalizeCombatFrameManifest({schema:'combat-frame-atlas/v1',id:identity+':'+action,visualIdentity:identity,action,direction:'right',atlas:'atlas.png',frameSize:[16,24],sourceHeight:20,foot:[8,22],frames:phases.map((phase,index)=>({index,x:index*16,y:0,w:16,h:24,durationMs:100,phase}))},{path:identity+'/'+action});

test('adding the master idle atlas preserves its existing complete walking fallback',()=>{
 for(const motion of [{action:'move',phase:'move',moveIntent:{x:1,y:0}},{action:'spell',phase:'recovery',startedTick:1195,executeAtTick:1199,recoveryUntilTick:1202,moveIntent:{x:1,y:0}}]){
  const p=actor(motion),b=scene(1200,p),before=structuredClone(p),old=pick(p,b,previous),shown=pick(p,b);
  assert.equal(shown.clipAction,undefined);assert.equal(shown.phase,'move');assert.deepEqual(legacyPose(shown),legacyPose(old));assert.deepEqual(p,before);
 }
});

test('adding the master idle atlas preserves guard windup release recovery and the active guard pose',()=>{
 for(const phase of ['windup','release','recovery','guard']){
  const p=actor({action:'guard',phase,startedTick:1198,executeAtTick:1200,recoveryUntilTick:1204,phaseProgressTicks:0}),b=scene(1200,p),old=pick(p,b,previous),shown=pick(p,b);
  assert.equal(shown.clipAction,undefined,phase+' must retain the authored guard fallback');assert.deepEqual(legacyPose(shown),legacyPose(old));
 }
});

test('authored master walk and guard clips take precedence when those actions are available',()=>{
 const walk=synthetic('shen-yan','walk',['move']),guard=synthetic('shen-yan','guard',['windup','release','recovery','guard']),library=new Map([['shen-yan',{clips:[idle,walk,guard]}]]);
 assert.equal(pick(actor({action:'move',phase:'move'}),undefined,library).clipAction,'walk');
 for(const phase of ['windup','release','recovery','guard']){const shown=pick(actor({action:'guard',phase}),undefined,library);assert.equal(shown.clipAction,'guard');assert.equal(shown.pose.phase,phase);assert.equal(shown.actionFallback,false);}
});

test('other visual identities retain their established idle fallback contract',()=>{
 for(const identity of ['shanxiao','person:idle-fixture']){
  const library=new Map([[identity,{clips:[synthetic(identity,'idle',['idle'])]}]]);
  for(const [action,phase]of [['move','move'],['guard','windup'],['guard','release'],['guard','recovery'],['guard','guard']]){
   const shown=sampleCombatFrameAtlas(identity,{action,phase,runtimePhase:phase,direction:{x:1,y:0},facing:'right',tick:1200,progress:0},library);assert.equal(shown.clipAction,'idle');assert.equal(shown.actionFallback,true);assert.equal(shown.pose.index,0);
  }
 }
});

test('the real four-frame idle loops over twelve ticks despite reset authoritative idle phase progress',()=>{
 assert.deepEqual(idle.frames.map(f=>f.durationMs),[300,300,300,300]);assert.equal(idle.durationMs,1200);
 for(let tick=1200;tick<=1225;tick++)for(const fraction of [0,.25,.5,.99]){
  const p=actor(),state={worldTick:tick,combat:{status:'active',player:p,controls:{move:{x:0,y:0}}},srCombat:{pending:null}};p.motion=projectCombatActorMotion(state,p);assert.equal(p.motion.phaseProgressTicks,0);
  const b=scene(tick,p),shown=pick({...p,poseTick:tick+fraction},b);assert.equal(shown.pose.index,Math.floor(((tick+fraction)%12)/3));assert.equal(shown.clipAction,'idle');assert.equal(shown.actionFallback,false);
 }
});

test('idle pause and resume preserve the displayed remainder until the next authoritative step',()=>{
 const b=scene(1202),presenter=createCombatPresentation();presenter.sample(b,{now:0});const live=presenter.sample(b,{now:99}),paused=presenter.sample(b,{now:105,paused:true}),held=presenter.sample(b,{now:5000,paused:true}),resumed=presenter.sample(b,{now:5001});
 assert.equal(pick(live.player,live).pose.index,0);assert.deepEqual(held.player,paused.player);assert.equal(resumed.player.poseTick,held.player.poseTick);assert.equal(pick(resumed.player,resumed).frameKey,pick(held.player,held).frameKey);
 const next=presenter.sample(scene(1203),{now:5002});assert.equal(pick(next.player,next).pose.index,0);assert.equal(next.player.animationElapsedTicks,1);
});

test('attack hit and dodge clips immediately replace idle using their real authoritative phases',()=>{
 for(const [action,phase,index]of [['attack','windup',0],['attack','release',2],['hit','hit',0],['dodge','windup',0],['dodge','release',1],['dodge','recovery',2],['dodge','evade',3]]){
  const p=actor({action,phase,actionId:'new-action',startedTick:1200,executeAtTick:phase==='release'?1200:1202,recoveryUntilTick:1204},{hitReaction:{kind:'light'}}),shown=pick(p);assert.equal(shown.clipAction,action);assert.equal(shown.runtimePhase,phase);assert.equal(shown.pose.index,index);assert.equal(shown.actionFallback,false);assert.equal(shown.phaseFallback,false);
 }
});

test('right idle supports same-side angle fallback while the left half-plane retains its own legacy pose',()=>{
 for(const direction of [{x:1,y:0},{x:1,y:-1},{x:1,y:1},{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:-1,y:-1},{x:-1,y:1}]){
  const p=actor({direction},{facing:direction}),shown=pick(p);if(direction.x>=0){assert.equal(shown.clipAction,'idle');assert.equal(shown.directionalFallback,!!direction.y);assert.equal(shown.mirrored,false);}else{assert.equal(shown.clipAction,undefined);assert.equal(shown.pose.atlas,undefined);assert.deepEqual(legacyPose(shown),legacyPose(pick(p,scene(1200,p),previous)));}
 }
});
