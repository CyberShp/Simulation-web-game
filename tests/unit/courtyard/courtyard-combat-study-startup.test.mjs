import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {combatCanStand,combatClearLine} from '../../../src/simulation/ea-combat-geometry.mjs';
import {combatCameraTransform} from '../../../apps/courtyard/courtyard-combat-camera.mjs';
import {sampleSwordStudyBody} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';

const zero={x:0,y:0},right={x:1,y:0},near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function scene({tick=100,x=12,y=15,motion={},profile='sword-study-v1'}={}){
 return {type:'combat',sessionId:'startup-test',rulesProfile:profile,tick,geometryId:'valley-open-v2',arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player:{id:'master',personId:'person:master',x,y,hp:100,facing:right,motion:{action:'idle',phase:'idle',moving:false,moveIntent:zero,movementLocked:false,...motion}},allies:[],enemies:[],projectiles:[],effects:[]};
}
function at(p,b,now,intent=right,extra={}){return p.sample(b,{now,intent,...extra});}
const xy=b=>({x:b.player.x,y:b.player.y});

test('first step advances on every rAF instead of a 25ms preview followed by a 75ms platform',()=>{
 for(const direction of [right,{x:0,y:-1}]){
  const p=createCombatPresentation(),b=scene(),before=structuredClone(b);at(p,b,0,zero);at(p,b,8.6,direction);
  const points=[8.6,25.3,42,58.7,75.4,92.1,108.6].map(ms=>xy(at(p,b,ms,direction)));
  for(let i=1;i<points.length;i++)assert(Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)>.001,'each 16.7ms sample advances before the one-tick horizon');
  near(Math.hypot(points.at(-1).x-12,points.at(-1).y-15),.045);
  assert.deepEqual(b,before);assert.equal(at(p,b,108.6,direction).worldTick,100);
 }
});

test('new authority steps retain elapsed display motion and do not lose a rendering interval',()=>{
 const p=createCombatPresentation();let last=12;
 for(let ms=0;ms<=480;ms+=16){const tick=100+Math.floor(ms/100),b=scene({tick,x:12+.33*(tick-100)}),shown=at(p,b,ms);if(ms)assert(shown.player.x>last,'no held frame at a world-step boundary');last=shown.player.x;assert(shown.player.x<=b.player.x+.045001);assert(shown.player.x>=b.player.x-.4,'one confirmed step plus a sampled rAF interval may remain to interpolate');}
});

test('a tap cancelled before its first world step has only the small initial preview to reconcile',()=>{
 for(const reason of ['keyup','blur']){
  const p=createCombatPresentation(),b=scene();at(p,b,0);const moving=at(p,b,50),stop=at(p,b,51,zero);let last=stop.player.x;
  assert(stop.player.x<=moving.player.x+.004);
  assert(stop.player.x-12<=.045001,'the unresolved tap is bounded to 3.42px at the native 76px/m scale');
  for(const ms of [60,80,100,150,1000]){const shown=at(p,b,ms,zero);assert(shown.player.x<=last+1e-9,reason);assert(shown.player.x>=12-1e-9);assert.equal(sampleSwordStudyBody(shown.player,shown.visualTick).key,ms<111?(ms<71?'stop-203':ms<91?'stop-206':'stop-209'):'action-03');last=shown.player.x;}
  near(last,12);
 }
});

test('reverse starts from the currently displayed point and cannot cross an obstruction or rebound through it',()=>{
 const p=createCombatPresentation(),b=scene({x:6.4,y:3}),before=structuredClone(b);at(p,b,0);const front=at(p,b,50),reverse=at(p,b,51,{x:-1,y:0});assert(reverse.player.x>=front.player.x);let last=reverse.player.x;
 for(const ms of [60,80,100,151,1000]){const shown=at(p,b,ms,{x:-1,y:0});assert(shown.player.x<=last+1e-9);assert(combatCanStand(shown.player,b.geometryId));assert(combatClearLine(b.player,shown.player,b.geometryId,{movement:true}));assert(Math.hypot(shown.player.x-b.player.x,shown.player.y-b.player.y)<=.330001);last=shown.player.x;}
 assert.deepEqual(b,before);
 const wall=createCombatPresentation(),w=scene({x:6.54,y:3});at(wall,w,0);for(const ms of [25,50,75,100,1000]){const shown=at(wall,w,ms);assert(shown.player.x<=6.550001);assert(combatCanStand(shown.player,w.geometryId));assert(combatClearLine(w.player,shown.player,w.geometryId,{movement:true}));}
});

test('steady right-to-left reversal never draws an opposite step or spends a world interval on a held foot',()=>{
 const p=createCombatPresentation();for(let ms=0;ms<=500;ms+=5){const tick=100+Math.floor(ms/100);at(p,scene({tick,x:12+.33*(tick-100)}),ms);}
 let last,stillAt=null,maxPlateau=0;
 for(let ms=501;ms<=850;ms+=5){const steps=Math.floor((ms-500)/100),b=scene({tick:105+steps,x:13.65-.33*steps}),shown=at(p,b,ms,{x:-1,y:0});if(last){assert(shown.player.x<=last.x+1e-9,'authority catch-up must not draw against the held reverse direction');if(Math.abs(shown.player.x-last.x)<1e-8){stillAt??=last.at;maxPlateau=Math.max(maxPlateau,ms-stillAt);}else stillAt=null;}last={x:shown.player.x,at:ms};}
 assert(maxPlateau<=10,'the one-step display delay must not become a 100ms reversal platform');
});

test('pause, hit, down and cast movement locks cannot spend additional preview movement',()=>{
 for(const phase of ['hit','down','windup']){
  const p=createCombatPresentation(),b=scene();at(p,b,0);at(p,b,40);
  const lock=scene({tick:101,motion:{action:phase==='windup'?'ground-sword':phase,phase,movementLocked:true}});if(phase==='down')lock.player.hp=0;
  const first=at(p,lock,50);let last=first.player.x;
  for(const ms of [60,100,150,1000]){const shown=at(p,lock,ms);assert(shown.player.x<=last+1e-9);assert.equal(shown.player.motion.phase,phase);last=shown.player.x;}near(last,12);
 }
 const p=createCombatPresentation(),b=scene();at(p,b,0);const before=at(p,b,40),paused=at(p,b,50,right,{paused:true}),later=at(p,b,5000,right,{paused:true});assert.deepEqual(xy(paused),xy(before));assert.deepEqual(xy(later),xy(paused));const resumed=at(p,b,5001);assert.deepEqual(xy(resumed),xy(paused));
});

test('a stalled world caps display preview at one step and never invents damage, warnings or world time',()=>{
 const p=createCombatPresentation(),b=scene();b.enemies=[{id:'foe',x:12.2,y:15,hp:100,motion:{phase:'idle'}}];const before=structuredClone(b);at(p,b,0);
 const edge=at(p,b,100),late=at(p,b,10000);near(edge.player.x,12.045);near(late.player.x,edge.player.x);assert.equal(late.tick,100);assert.equal(late.worldTick,100);assert.equal(late.enemies[0].hp,100);assert.equal(late.enemies[0].motion.phase,'idle');assert.deepEqual(late.projectiles,[]);assert.deepEqual(late.effects,[]);assert.deepEqual(b,before);
});

test('display foot, follow camera and inverse pointer use one transform while the world remains unchanged',()=>{
 const p=createCombatPresentation(),b=scene({x:25,y:15}),before=structuredClone(b),size={width:1200,height:800};at(p,b,0);
 let previousCenter;
 for(const ms of [20,40,60,80,100]){const shown=at(p,b,ms),t=combatCameraTransform(shown,size);if(previousCenter!==undefined)assert(t.center.x>previousCenter);previousCenter=t.center.x;const target={x:29,y:14},screen={x:t.ox+target.x*t.sx,y:t.oy+target.y*t.sy};near((screen.x-t.ox)/t.sx,target.x);near((screen.y-t.oy)/t.sy,target.y);const foot={x:t.ox+shown.player.x*t.sx,y:t.oy+shown.player.y*t.sy};assert(Number.isFinite(foot.x)&&Number.isFinite(foot.y));}assert.deepEqual(b,before);
});

test('legacy battles retain the existing bounded .045m presentation contract',()=>{
 const p=createCombatPresentation(),b=scene({profile:null});at(p,b,0);near(at(p,b,25).player.x,12.045);near(at(p,b,1000).player.x,12.045);
});
