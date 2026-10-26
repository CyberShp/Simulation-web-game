import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {sampleSwordStudyBody,STUDY_FRAMES} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';

const zero={x:0,y:0},right={x:1,y:0};
function scene(tick=100,x=12,motion={}){return {type:'combat',sessionId:'confirmed-stop',rulesProfile:'sword-study-v1',tick,geometryId:'valley-open-v2',arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player:{id:'master',personId:'person:master',x,y:15,hp:100,facing:right,motion:{phase:'move',action:'move',moveIntent:right,moving:true,movementLocked:false,...motion}},allies:[],enemies:[],effects:[],projectiles:[]};}
const sample=(p,b,now,intent=right,options={})=>p.sample(b,{now,intent,...options});
const frame=b=>sampleSwordStudyBody(b.player,b.player.poseTick).key;
function stopping(direction=1){const p=createCombatPresentation(),d={x:direction,y:0};sample(p,scene(),0,d);sample(p,scene(),80,d);const b=scene(101,12+direction*.33,{moveIntent:d,direction:d});sample(p,b,100,d);sample(p,b,150,d);const stopped=sample(p,b,151,zero);return {p,b,stopped,d};}

test('confirmed side displacement finishes in three existing stop frames, never idle-slides or runs backward',()=>{
 for(const direction of [1,-1]){const {p,b,stopped}=stopping(direction),before=structuredClone(b),keys=[];let last=stopped.player.x;
  for(const ms of [151,171,191,211,300]){const shown=sample(p,b,ms,zero),key=frame(shown);assert((shown.player.x-last)*direction>=-1e-9);if(Math.abs(shown.player.x-b.player.x)>1e-6)assert(key.startsWith('stop-'),'moving feet must use the selected whole stopping frame');keys.push(key);last=shown.player.x;}
  assert.deepEqual(keys,['stop-203','stop-206','stop-209','action-03','action-03']);assert(Math.abs(last-b.player.x)<1e-6);assert.deepEqual(b,before);
  for(const key of keys.slice(0,3)){assert.equal(STUDY_FRAMES[key].sourceHeight,58);assert.equal(STUDY_FRAMES[key].scale,STUDY_FRAMES['run-058'].scale);assert.deepEqual(STUDY_FRAMES[key].root,STUDY_FRAMES['run-058'].root);}
 }
});

test('the planted stop-209 frame is shown only after the confirmed foot translation has finished',()=>{
 const {p,b}=stopping();for(let ms=152;ms<211;ms++){const shown=sample(p,b,ms,zero);if(frame(shown)==='stop-209')assert(Math.abs(shown.player.x-b.player.x)<1e-6,'both planted boots must not slide across the last third of the stop');}assert.equal(frame(sample(p,b,211,zero)),'action-03');
});

test('a new movement key immediately replaces stopping with real run, without waiting for the stop clock',()=>{
 const {p,b}=stopping();sample(p,b,166,zero);const restarted=sample(p,b,167,right);assert(!restarted.player.stopPresentation);assert(frame(restarted).startsWith('run-'));assert.equal(frame(sample(p,b,187,right)).startsWith('run-'),true);
});

test('a changed authority endpoint during stopping is incorporated without resetting the stop pose clock',()=>{
 const {p,b}=stopping(),before=sample(p,b,160,zero),next={...b,tick:102,player:{...b.player,x:b.player.x+.1}},changed=sample(p,next,170,zero);assert(changed.player.x>=before.player.x);assert.equal(changed.player.stopPresentation.elapsedMs,19);const final=sample(p,next,211,zero);assert(Math.abs(final.player.x-next.player.x)<1e-6);assert.equal(frame(final),'action-03');
});

test('attack, Q, Space, hit and down retain priority over a transient stopping pose',()=>{
 for(const [action,phase,locked,hp]of [['attack','windup',false,100],['ground-sword','windup',true,100],['dodge','release',false,100],['hit','hit',true,100],['down','down',true,0]]){
  const {p,b}=stopping(),changed={...b,player:{...b.player,hp,motion:{...b.player.motion,action,phase,movementLocked:locked,phaseStartedTick:101,phaseDurationTicks:2}}},shown=sample(p,changed,166,zero);assert(!shown.player.stopPresentation,action);assert(!frame(shown).startsWith('stop-'),action);if(['hit','down'].includes(phase))assert.equal(shown.player.x,changed.player.x);
 }
});

test('Q movement lock consumes a confirmed display tail during windup instead of snapping a full step',()=>{
 const p=createCombatPresentation();sample(p,scene(),0);sample(p,scene(),100);const b=scene(101,12.33);sample(p,b,110);const before=sample(p,b,140),locked={...b,player:{...b.player,motion:{action:'ground-sword',phase:'windup',movementLocked:true,moveIntent:right,phaseStartedTick:101,phaseDurationTicks:2}}},atLock=sample(p,locked,141);assert(Math.abs(atLock.player.x-before.player.x)<.01,'locking Q must not snap the .33m interpolation remainder');assert.equal(atLock.player.motion.phase,'windup');assert(!atLock.player.stopPresentation);const end=sample(p,locked,241);assert(Math.abs(end.player.x-locked.player.x)<1e-6);assert.equal(locked.player.x,12.33);assert.equal(end.worldTick,101);
});

test('pause preserves both the stop image and position and resume spends only its remaining display time',()=>{
 const {p,b}=stopping(),before=sample(p,b,166,zero),paused=sample(p,b,170,zero,{paused:true}),held=sample(p,b,5000,zero,{paused:true});assert.equal(frame(paused),frame(before));assert.equal(frame(held),frame(before));assert.equal(held.player.x,before.player.x);const resumed=sample(p,b,5001,zero);assert.equal(frame(resumed),frame(before));assert.equal(resumed.player.x,before.player.x);assert.equal(frame(sample(p,b,5046,zero)),'action-03');
});

test('pause while running clears keys, then resume consumes the confirmed tail in stop frames rather than sliding idle',()=>{
 for(const direction of [1,-1]){const p=createCombatPresentation(),d={x:direction,y:0};sample(p,scene(),0,d);const b=scene(101,12+.33*direction,{moveIntent:d,direction:d});sample(p,b,100,d);const before=sample(p,b,150,d);sample(p,b,151,zero,{paused:true});sample(p,b,5000,zero,{paused:true});
  const resumed=sample(p,b,5001,zero);assert.equal(resumed.player.x,before.player.x);assert.equal(frame(resumed),'stop-203');assert.equal(frame(sample(p,b,5021,zero)),'stop-206');const planted=sample(p,b,5041,zero);assert.equal(frame(planted),'stop-209');assert(Math.abs(planted.player.x-b.player.x)<1e-6);assert.equal(frame(sample(p,b,5061,zero)),'action-03');assert.equal(b.tick,101);
 }
 const p=createCombatPresentation();sample(p,scene(),0);const b=scene(101,12.33);sample(p,b,100);sample(p,b,150);sample(p,b,151,zero,{paused:true});const held=sample(p,b,5000,right);assert(!held.player.stopPresentation);assert(frame(held).startsWith('run-'),'a movement key on resume bypasses stopping immediately');
});

test('no displacement means no repeated stop, and vertical movement does not borrow side-view stopping art',()=>{
 const p=createCombatPresentation(),b=scene(100,12,{phase:'idle',action:'idle',moveIntent:zero});sample(p,b,0,zero);assert(!sample(p,b,100,zero).player.stopPresentation);
 for(const d of [{x:0,y:-1},{x:0,y:1}]){const p=createCombatPresentation();sample(p,scene(),0,d);sample(p,scene(),50,d);const stopped=sample(p,scene(),51,zero);assert(!stopped.player.stopPresentation);assert(!frame(stopped).startsWith('stop-'));}
});
