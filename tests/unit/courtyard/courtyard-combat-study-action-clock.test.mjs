import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';
import {sampleSwordStudyBody,STUDY_METADATA} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';
import {swordStudyPresentation} from '../../../apps/courtyard/courtyard-combat-sword-study.mjs';

const right={x:1,y:0},base={id:'master',personId:'person:master',x:12,y:15,hp:100,facing:right};
function dodgeAt(tick,{direction=right,prior='attack'}={}){
 const player={...base,facing:direction,evade:tick>=100?1:0,...(tick>=100?{dodgePath:{from:{x:12,y:15},to:{x:12+direction.x*2.8,y:15+direction.y*2.8},startedTick:100,durationTicks:2}}:{})};
 const pending=tick<102?{id:'dodge:1',action:'dodge',startedTick:99,executed:tick>=100,executedTick:tick>=100?100:undefined,progressTicks:tick-99}:null;
 const state={worldTick:tick,combat:{status:'active',player,controls:{move:right}},srCombat:{pending,executions:[{id:prior+':1',action:prior,executed:true,executedTick:99}]}};
 player.motion=projectCombatActorMotion(state,player);return {state,player};
}
function drawnFrame(player,tick){return swordStudyPresentation({...player,poseTick:tick},{tick:Math.floor(tick),worldTick:Math.floor(tick),visualTick:tick},{worldToScreen:(x,y)=>({x:x*60,y:y*35}),transform:{sx:60,sy:35},images:{}}).study.key;}

test('formal Space release and recovery share one two-tick whole-frame clock, then hold the landing image',()=>{
 const observed=[];
 for(const [time,key]of [[99,'counter-04'],[99.25,'counter-04'],[99.5,'counter-04'],[99.9,'counter-04'],[100,'counter-04'],[100.5,'counter-05'],[101,'counter-06'],[101.5,'counter-07'],[102,'counter-07'],[102.75,'counter-07'],[103,'counter-07'],[103.75,'counter-07']]){
  const {state,player}=dodgeAt(Math.floor(time)),before=structuredClone(state);assert.equal(drawnFrame(player,time),key);assert.deepEqual(state,before);observed.push(key);
 }
 assert.deepEqual([...new Set(observed)],['counter-04','counter-05','counter-06','counter-07']);
});

test('Space from ordinary attack or Q uses its own path clock and keeps mirrored side frames explicit',()=>{
 for(const prior of ['attack','ground-sword'])for(const direction of [right,{x:-1,y:0},{x:0,y:-1},{x:0,y:1}]){
  const {player}=dodgeAt(100,{prior,direction});player.animationElapsedTicks=9999;assert.equal(sampleSwordStudyBody(player,100.5).key,'counter-05');assert.equal(sampleSwordStudyBody(player,100.5).mirror,direction.x<0);
  assert.equal(sampleSwordStudyBody({...player,motion:{...player.motion,phase:'hit',action:'hit',phaseStartedTick:100,phaseDurationTicks:2}},100.5).key,'action-05');assert.equal(sampleSwordStudyBody({...player,hp:0},100.5).visualPhase,'down');
 }
});

test('after the formal dodge action and evade state clear, real running and idle replace the landing hold',()=>{
 const {state,player}=dodgeAt(108);player.evade=0;player.movedTick=108;delete player.dodgePath;state.combat.controls.move=right;
 player.motion=projectCombatActorMotion(state,player);assert.equal(player.motion.action,'move');assert.equal(player.motion.phase,'move');assert(!player.motion.dodgePath);
 const keys=new Set();for(let ms=0;ms<480;ms+=5)keys.add(sampleSwordStudyBody({...player,animationElapsedTicks:ms/100},108+ms/100).key);assert.equal(keys.size,19);assert([...keys].every(k=>k.startsWith('run-')));
 state.worldTick=109;state.combat.controls.move={x:0,y:0};player.motion=projectCombatActorMotion(state,player);assert.equal(player.motion.action,'idle');assert.equal(player.motion.phase,'idle');assert.equal(drawnFrame(player,109),'action-03');
});

test('existing four movement directions use their complete source frames at 480ms, with stable idle after keyup',()=>{
 for(const [name,direction,count]of [['right',right,19],['left',{x:-1,y:0},19],['up',{x:0,y:-1},4],['down',{x:0,y:1},4]]){
  const actor={...base,facing:direction,motion:{action:'move',phase:'move',moveIntent:direction,direction,moving:true}},keys=new Set();
  for(let ms=0;ms<480;ms++){const f=sampleSwordStudyBody({...actor,animationElapsedTicks:ms/100},100+ms/100);keys.add(f.key);assert.equal(f.mirror,name==='left');}assert.equal(keys.size,count);
  const idle={...actor,motion:{action:'idle',phase:'idle',moveIntent:{x:0,y:0},direction,moving:false}},key=sampleSwordStudyBody(idle,105).key;for(const tick of [105.5,106,1000])assert.equal(sampleSwordStudyBody(idle,tick).key,key);
 }
 assert(Math.abs(STUDY_METADATA.player.runDurationMs.reduce((a,b)=>a+b,0)-480)<1e-9);
});

test('side hit/down preserve the facing half-plane and cannot be replaced by a transient stopping pose',()=>{
 for(const x of [-1,1])for(const phase of ['hit','down']){const actor={...base,hp:phase==='down'?0:100,facing:{x,y:0},stopPresentation:{elapsedMs:20,durationMs:60,direction:{x:-x,y:0}},motion:{phase,action:phase,phaseStartedTick:100,phaseDurationTicks:2}};const f=sampleSwordStudyBody(actor,100.5);assert.equal(f.mirror,x<0);assert(!f.key.startsWith('stop-'));assert.equal(f.visualPhase,phase);}
});

test('player down follows its persistent downedTick at 0/150/300ms and holds the final whole frame',()=>{
 for(const x of [-1,1]){const actor={...base,hp:0,downedTick:100,facing:{x,y:0},motion:{phase:'down',action:'down',phaseStartedTick:100,phaseDurationTicks:12}};
  for(const [tick,key]of [[100,'down-00'],[101.49,'down-00'],[101.5,'down-01'],[102.99,'down-01'],[103,'down-02'],[113,'down-02'],[999,'down-02']]){const f=sampleSwordStudyBody({...actor,motion:{...actor.motion,phaseStartedTick:Math.floor(tick)}},tick);assert.equal(f.key,key);assert.equal(f.mirror,x<0);}
  const legacy={...actor};delete legacy.downedTick;for(const tick of [100,101,113,999])assert.equal(sampleSwordStudyBody(legacy,tick).key,'down-02','a legacy missing downedTick cannot restart the kneeling pose each step');
 }
});
