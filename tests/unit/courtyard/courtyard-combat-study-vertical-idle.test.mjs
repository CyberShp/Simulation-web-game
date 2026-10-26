import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {sampleSwordStudyBody,STUDY_METADATA,STUDY_FRAMES} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';

const zero={x:0,y:0};
function scene(sign,tick=100,y=15,motion={}){const d={x:0,y:sign};return {type:'combat',sessionId:'vertical-tail-'+sign,rulesProfile:'sword-study-v1',geometryId:'valley-open-v2',tick,arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player:{id:'master',personId:'person:master',x:12,y,hp:100,facing:d,motion:{phase:'move',action:'move',moving:true,moveIntent:d,direction:d,movementLocked:false,...motion}},allies:[],enemies:[],effects:[],projectiles:[]};}
const key=b=>sampleSwordStudyBody(b.player,b.player.poseTick).key;
function running(sign){const p=createCombatPresentation(),d={x:0,y:sign};let b,r;for(let ms=0;ms<=350;ms+=10){const tick=100+Math.floor(ms/100);b=scene(sign,tick,15+sign*.33*(tick-100));r=p.sample(b,{now:ms,intent:d});}return {p,b,r,d};}

test('true vertical idle uses existing grounded battle-ready frames at the original shared H275 scale',()=>{
 assert.deepEqual(STUDY_METADATA.player.idleByDirection,{up:'cast-07',down:'cast-11'});
 for(const [sign,expected]of [[-1,'cast-07'],[1,'cast-11']]){const b=scene(sign,100,15,{phase:'idle',action:'idle',moving:false,moveIntent:zero});for(const tick of [100,101,999])assert.equal(sampleSwordStudyBody(b.player,tick).key,expected);assert.equal(STUDY_FRAMES[expected].sourceHeight,275);assert.equal(STUDY_FRAMES[expected].bodyHeightMeters,1.45);}
});

test('W/S confirmed tails keep the original run clock and last direction until settled, then plant both feet',()=>{
 for(const [sign,name,ready]of [[-1,'up','cast-07'],[1,'down','cast-11']]){const {p,b,r}=running(sign),before=structuredClone(b),keys=new Set();let last=r.player.y;
  for(let ms=351;ms<=450;ms++){const shown=p.sample(b,{now:ms,intent:zero});assert(!shown.player.stopPresentation,'vertical tails must not use the side stopping clip');assert((shown.player.y-last)*sign>=-1e-9);if(Math.abs(shown.player.y-b.player.y)>1e-6){assert(STUDY_METADATA.player.move[name].includes(key(shown)));assert.equal(shown.player.motion.phase,'move');assert.equal(shown.player.facing.y,sign);assert(shown.player.animationElapsedTicks>=r.player.animationElapsedTicks);keys.add(key(shown));}else assert.equal(key(shown),ready);last=shown.player.y;}
  assert(keys.size>=2,'a tail across a source-frame boundary must continue the existing four-frame run');assert(Math.abs(last-b.player.y)<1e-6);assert.deepEqual(b,before);
 }
});

test('vertical run interrupted by pause resumes its confirmed tail without borrowing a side stop or switching early to idle',()=>{
 for(const [sign,name,ready]of [[-1,'up','cast-07'],[1,'down','cast-11']]){const {p,b,r}=running(sign);const frozen=p.sample(b,{now:351,paused:true,intent:zero});const held=p.sample(b,{now:4000,paused:true,intent:zero});assert.equal(key(held),key(frozen));assert.equal(held.player.y,r.player.y);const resumed=p.sample(b,{now:5000,intent:zero});assert.equal(resumed.player.y,r.player.y);assert(STUDY_METADATA.player.move[name].includes(key(resumed)));assert(!resumed.player.stopPresentation);assert(resumed.player.runTailPresentation);const end=p.sample(b,{now:5100,intent:zero});assert(Math.abs(end.player.y-b.player.y)<1e-6);assert.equal(key(end),ready);}
});

test('new keys and attack/Q/Space/hit/down immediately outrank vertical run tails',()=>{
 for(const sign of [-1,1]){
  {const {p,b}=running(sign);p.sample(b,{now:351,intent:zero});const shown=p.sample(b,{now:360,intent:{x:1,y:0}});assert(!shown.player.runTailPresentation);assert(key(shown).startsWith('run-'));}
  for(const [action,phase,locked,hp]of [['attack','windup',false,100],['ground-sword','windup',true,100],['dodge','release',false,100],['hit','hit',true,100],['down','down',true,0]]){const {p,b}=running(sign);p.sample(b,{now:351,intent:zero});const changed={...b,player:{...b.player,hp,motion:{...b.player.motion,action,phase,movementLocked:locked,phaseStartedTick:103,phaseDurationTicks:2}}},shown=p.sample(changed,{now:360,intent:zero});assert(!shown.player.runTailPresentation,action);assert(!STUDY_METADATA.player.move[sign<0?'up':'down'].includes(key(shown)),action);}
 }
});

test('zero confirmed tail goes directly to grounded vertical guard without replaying movement',()=>{
 for(const [sign,ready]of [[-1,'cast-07'],[1,'cast-11']]){const p=createCombatPresentation(),b=scene(sign,100,15,{phase:'idle',action:'idle',moving:false,moveIntent:zero});const shown=p.sample(b,{now:0,intent:zero});assert.equal(key(shown),ready);assert(!shown.player.runTailPresentation);assert(!shown.player.stopPresentation);assert.equal(shown.player.y,15);}
});
