import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createCombatEffectsRenderer,combatSwordRibbon} from '../../../apps/courtyard/courtyard-combat-effects.mjs';
import {createCombatSoundEvents,createCombatAudio,synthesizeCombatCue} from '../../../apps/courtyard/courtyard-combat-audio.mjs';
import {createCombatActorRenderer} from '../../../apps/courtyard/courtyard-combat-actors.mjs';

const event=(kind,tick,extra={})=>({kind,id:tick,eventId:'battle:impact:'+tick,tick,sourceId:'master',targetId:'enemy-1',from:{x:40,y:110},to:{x:180,y:110},contact:{x:177,y:110},direction:{x:1,y:0},contactHeight:.9,total:.75,amount:20,outcome:'hit',reaction:'light',...extra});
const scene=(tick,effects=[])=>({sessionId:'battle',tick,player:{id:'master',x:40,y:110},enemies:[{id:'enemy-1',x:180,y:110}],allies:[],projectiles:[],effects});

test('empty swings, damaging contacts, guarded contacts and evasion have distinct sound cues',()=>{
 const stream=createCombatSoundEvents();stream.update(scene(10));
 assert.deepEqual(stream.update(scene(11,[event('attack',11)])).map(c=>c.kind),['swing']);
 const hits=[event('hit',12),event('hit',13,{outcome:'guarded'}),event('hit',14,{outcome:'evaded',amount:0}),event('hit',15,{projectileId:9,reaction:'heavy'})];
 assert.deepEqual(hits.map(f=>stream.update(scene(f.tick,[f]))[0]?.kind),['bladeHit','guard','evade','spellHit']);
});

test('one formal attack action with two visual records sounds once, each contact remains unique',()=>{
 const stream=createCombatSoundEvents();stream.update(scene(1));
 const a=event('attack',2,{actionId:'attack:1'}),duplicate={...a,actionId:undefined,id:3,eventId:'battle:impact:3',to:{x:190,y:110}};
 const b=scene(2,[a,duplicate,event('hit',2,{id:4,eventId:'battle:impact:4'})]),before=structuredClone(b);
 assert.deepEqual(stream.update(b).map(c=>c.kind),['swing','bladeHit']);assert.deepEqual(stream.update(b),[]);assert.deepEqual(b,before);
});

test('pause, loss of focus, restore and a new battle establish silent baselines',()=>{
 const stream=createCombatSoundEvents();stream.update(scene(1));
 const b=scene(2,[event('hit',2)]);assert.deepEqual(stream.update(b,{paused:true}),[]);assert.deepEqual(stream.update(b),[]);
 assert.deepEqual(stream.update(scene(3,[event('hit',3)]),{active:false}),[]);assert.deepEqual(stream.update(scene(3,[event('hit',3)])),[]);
 assert.equal(stream.update(scene(4,[event('hit',4)])).length,1);
 assert.deepEqual(stream.update(scene(2,[event('hit',2)])),[]);
 assert.deepEqual(stream.update({...scene(5,[event('hit',5)]),sessionId:'other-battle'}),[]);
});

test('sound waits for the shared display tick and discards stale contacts',()=>{
 const stream=createCombatSoundEvents();stream.update(scene(1));
 const b=scene(2,[event('hit',2)]);assert.deepEqual(stream.update({...b,visualTick:1.7}),[]);
 assert.equal(stream.update({...b,visualTick:2}).length,1);
 assert.deepEqual(stream.update(scene(8,[event('hit',5)])),[]);
 const shot={id:7,launchedTick:9,from:{x:3,y:4}};
 assert.deepEqual(stream.update({...scene(9),projectiles:[shot]}).map(c=>c.kind),['cast']);
 assert.deepEqual(stream.update({...scene(9),projectiles:[shot]}),[]);
});

test('synthesized cues are finite, bounded, declicked and distinct',()=>{
 const kinds=['swing','cast','bladeHit','spellHit','heavyHit','guard','evade','land','ward'],signatures=new Set();
 for(const kind of kinds){
  const pcm=synthesizeCombatCue(kind),repeat=synthesizeCombatCue(kind);assert.deepEqual(pcm,repeat);assert.equal(Math.abs(pcm[0]),0);assert.equal(pcm.at(-1),0);
  let energy=0,peak=0;for(const v of pcm){assert(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}
  assert(energy>1,kind+' has audible signal energy');assert(peak<=.7);assert(pcm.length<22050*.3);
  signatures.add(Buffer.from(pcm.buffer).toString('base64'));
 }assert.equal(signatures.size,kinds.length);
});

test('audio unlock failure leaves event consumption and visual execution usable',async()=>{
 class Unavailable{constructor(){throw Error('audio device unavailable');}}
 const audio=createCombatAudio({AudioContextClass:Unavailable});assert.equal(await audio.unlock(),false);audio.update(scene(1));
 assert.equal(audio.update(scene(2,[event('hit',2)])).length,1);assert.deepEqual(audio.update(scene(2,[event('hit',2)])),[]);audio.dispose();
});

test('gesture unlock enables one playback per contact and pause stops its tail',async()=>{
 let created=0,started=0,stopped=0,closed=0;
 class Device{
  constructor(){created++;this.state='suspended';this.sampleRate=22050;this.destination={};}
  createGain(){return {gain:{value:0},connect(){}};}
  async resume(){this.state='running';}
  createBuffer(channels,length){const samples=new Float32Array(length);return {getChannelData:()=>samples};}
  createBufferSource(){return {connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}
  async close(){closed++;this.state='closed';}
 }
 const audio=createCombatAudio({AudioContextClass:Device});audio.update(scene(1));assert.equal(created,0);
 assert.equal(await audio.unlock(),true);assert.equal(await audio.unlock(),true);assert.equal(created,1);
 const b=scene(2,[event('hit',2)]);audio.update(b);audio.update(b);assert.equal(started,1);
 audio.update(b,{paused:true});assert.equal(stopped,1);audio.update(b);assert.equal(started,1);audio.dispose();assert.equal(closed,1);
});

function render(b,tick,{trail=[],weight=0}={}){
 const canvas=createCanvas(260,160),ctx=canvas.getContext('2d');
 const renderer=createCombatEffectsRenderer({ctx,worldToScreen:(x,y)=>({x,y}),getTransform:()=>({sx:1,sy:1}),getActorPresentation:a=>({height:100,foot:{x:a.x+10,y:a.y},hand:{x:a.x+20,y:a.y-50},swordTrail:a.id==='master'?trail:[],swingWeight:a.id==='master'?weight:0})});
 renderer.drawForeground(b,tick);return ctx.getImageData(0,0,260,160).data;
}

test('sword ribbon follows supplied blade anchors and changes with their movement',()=>{
 const trail=[{grip:{x:130,y:100},tip:{x:180,y:40},alpha:.3},{grip:{x:140,y:100},tip:{x:210,y:60},alpha:1}],before=structuredClone(trail);
 const pixels=render(scene(1),1,{trail,weight:1});let count=0,minX=260,maxX=0;
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]){count++;const x=((i-3)/4)%260;minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
 assert(count>20);assert(minX>150,'ribbon stays at blade instead of the body foot');assert(maxX>=209);
 assert(render(scene(1),1,{trail,weight:0}).every(v=>v===0));
 const shifted=trail.map(p=>({...p,grip:{x:p.grip.x+4,y:p.grip.y-6},tip:{x:p.tip.x+4,y:p.tip.y-6}}));
 const a=combatSwordRibbon({swordTrail:trail,swingWeight:1}),b=combatSwordRibbon({swordTrail:shifted,swingWeight:1});
 for(let i=0;i<a[0].points.length;i++){assert.equal(b[0].points[i].x-a[0].points[i].x,4);assert.equal(b[0].points[i].y-a[0].points[i].y,-6);}
 assert.deepEqual(trail,before);
});

test('contact begins at its event tick, differs from guard/evasion and is deterministic/read only',()=>{
 const b=scene(20,[event('hit',20)]),before=structuredClone(b);
 assert(render(b,19.9).every(v=>v===0));const impact=render(b,20.1);assert(impact.some(v=>v!==0));assert.deepEqual(impact,render(b,20.1));
 assert.notDeepEqual(impact,render(scene(20,[event('hit',20,{outcome:'guarded'})]),20.1));
 assert.notDeepEqual(impact,render(scene(20,[event('hit',20,{outcome:'evaded',amount:0})]),20.1));
 assert.deepEqual(b,before);
});

test('projectile release offset keeps its launch direction through opposite movement, dodge and paused redraws',()=>{
 const canvas=createCanvas(260,160),ctx=canvas.getContext('2d'),worldToScreen=(x,y)=>({x,y}),getTransform=()=>({sx:1,sy:1});
 // Texture pixels are irrelevant here; use the real actor presentation and its
 // fixed frame anchors to exercise the actor/effect integration contract.
 const blank=createCanvas(1536,1024),images=Object.fromEntries(['foeActions','person','reactions','leftActions','leftContinuity','leftSpell','castBody6','castWeapon6'].map(key=>[key,blank]));
 const actorRenderer=createCombatActorRenderer({ctx,worldToScreen,getTransform,assets:{images,makeCanvas:createCanvas}});
 const renderer=createCombatEffectsRenderer({ctx,worldToScreen,getTransform,getActorPresentation:actorRenderer.presentation});
 const shot={id:7,sourceId:'master',launchedTick:20,x:90,y:110,from:{x:40,y:110},direction:{x:1,y:0}};
 const motion={action:'spell',phase:'recovery',direction:{x:1,y:0},executeAtTick:20,phaseStartedTick:21,phaseDurationTicks:3,recoveryUntilTick:24};
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const draw=(player,projectile=shot)=>{
  const b=freeze({...scene(21),player,projectiles:[projectile]}),before=structuredClone(b);
  ctx.clearRect(0,0,260,160);renderer.drawProjectiles(b,21.25);const pixels=ctx.getImageData(0,0,260,160).data;
  ctx.clearRect(0,0,260,160);renderer.drawProjectiles(b,21.25);
  assert.deepEqual(ctx.getImageData(0,0,260,160).data,pixels,'paused redraw at the same tick is identical');
  assert.deepEqual(b,before,'drawing preserves the snapshot and projectile');return pixels;
 };
 const owner={id:'master',x:40,y:110,facing:{x:1,y:0},motion},expected=draw(owner);
 assert(expected.some(v=>v!==0));
 const opposite={x:-1,y:0};
 for(const changed of [
  {...motion,moveIntent:opposite,movementLocked:false},
  {action:'move',phase:'move',direction:opposite},
  {action:'dodge',phase:'recovery',direction:opposite,executeAtTick:21,phaseStartedTick:21,phaseDurationTicks:2,recoveryUntilTick:23},
 ])assert.deepEqual(draw({...owner,x:34,facing:opposite,motion:changed}),expected,'turning after release does not move the projectile offset');
 assert.notDeepEqual(draw(owner,{...shot,direction:opposite}),expected,'the projectile launch direction still controls its orientation');
});
