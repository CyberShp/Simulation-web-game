import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {sampleCombatActor,createCombatActorRenderer,loadCombatActorAssets} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';

const actor=(motion={},extra={})=>({id:'master',personId:'person:master',x:3.5,y:4,hp:100,facing:{x:1,y:0},motion:{action:'spell',phase:'windup',startedTick:100,executeAtTick:104,phaseStartedTick:100,phaseDurationTicks:4,phaseProgressTicks:2,recoveryUntilTick:110,movementLocked:true,moveIntent:{x:1,y:0},direction:{x:1,y:0},...motion},...extra});
const scene=(tick,player)=>({type:'combat',sessionId:'frame-test',tick,worldTick:tick,player,allies:[],enemies:[],projectiles:[],effects:[]});
const sample=(tick,motion,extra)=>sampleCombatActor(actor(motion,extra),{tick,worldTick:tick});

test('release keeps its complete action frame for the release step, then accepted movement selects a complete walk frame',()=>{
 const windup=sample(103,{movementLocked:false});
 assert.equal(windup.phase,'windup');assert.equal(windup.action,'spell');assert.equal(windup.visualOverride,null);
 const earlyDisplay=sampleCombatActor(actor({phase:'release',movementLocked:false},{poseTick:104.9}),{tick:103.9,worldTick:103});
 assert.equal(earlyDisplay.phase,'release');assert.equal(earlyDisplay.castIndex,5);assert.equal(earlyDisplay.visualOverride,null);
 for(const action of ['spell','attack','guard']){
  const released=sample(104,{action,phase:'release',phaseStartedTick:104,movementLocked:false},{poseTick:104.9});
  assert.equal(released.phase,'release',action+' release must remain visible through its world step');
  assert.equal(released.runtimePhase,'release');assert.equal(released.visualOverride,null);
  const walking=sample(105,{action,phase:'recovery',movementLocked:false,moving:false,moveIntent:{x:-1,y:0}});
  assert.equal(walking.phase,'move');assert.equal(walking.action,'move');assert.equal(walking.runtimePhase,'recovery');assert.equal(walking.runtimeAction,action);
  assert.equal(walking.visualOverride,'released-move');assert.equal(walking.facing,'left');assert.equal(walking.pose.image,'leftContinuity');
 }
 for(const blocked of [{movementLocked:true},{moveIntent:{x:0,y:0},moving:true}]){
  const held=sample(105,{phase:'recovery',movementLocked:false,...blocked});
  assert.equal(held.phase,'recovery');assert.equal(held.action,'spell');assert.equal(held.visualOverride,null);
 }
});

test('formal dodge, hit and down states take priority over accepted movement',()=>{
 for(const [action,phase,expected,hp] of [['dodge','windup','evade',100],['dodge','recovery','evade',100],['spell','hit','hit',100],['attack','down','down',0]]){
  const a=actor({action,phase,movementLocked:false,phaseProgressTicks:2,moveIntent:{x:-1,y:0}},{hp}),b=scene(105,a),before=structuredClone(b),s=sampleCombatActor(a,b);
  assert.equal(s.phase,expected);assert.equal(s.runtimePhase,phase);assert.equal(s.runtimeAction,action);assert.equal(s.visualOverride,null);
  assert.deepEqual(b,before);
 }
});

const imagePath=name=>new URL('../../../assets/courtyard/'+name,import.meta.url);
const assetsPromise=loadCombatActorAssets({loadImage:name=>loadImage(imagePath(name)),makeCanvas:createCanvas});
const screen=(x,y)=>({x:360+x*8,y:260+y*4});
function renderer(assets,sx=80){
 const canvas=createCanvas(800,360),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 return {canvas,draw:createCombatActorRenderer({ctx,worldToScreen:screen,getTransform:()=>({sx,sy:sx}),assets}).draw};
}

// Fixed source crops are independent references to the existing complete artwork.
// These checks establish source fidelity, not the quality of the source animation.
const pixelCases=[
 {name:'right attack release',motion:{action:'attack',phase:'release'},files:['cultivator-v1.png'],crop:[770,660,390,335],foot:[163,329],height:323},
 {name:'left attack release',motion:{action:'attack',phase:'release',direction:{x:-1,y:0}},files:['combat-actors-v1/master-left-actions.png'],crop:[934,0,602,512],foot:[400,480],height:449},
 {name:'right spell windup with movement intent',tick:102,motion:{phase:'windup',moveIntent:{x:1,y:0}},files:['combat-actors-v1/cast/weapon-002.png','combat-actors-v1/cast/body-002.png'],crop:[0,0,640,512],foot:[255,456],height:384},
 {name:'right spell release with movement intent',motion:{phase:'release',moveIntent:{x:1,y:0}},files:['combat-actors-v1/cast/weapon-005.png','combat-actors-v1/cast/body-005.png'],crop:[0,0,640,512],foot:[255,456],height:384},
 {name:'left spell release',motion:{phase:'release',direction:{x:-1,y:0}},files:['combat-actors-v1/master-left-spell.png'],crop:[0,0,1536,1024],foot:[840,960],height:932},
 {name:'right complete walk',motion:{action:'move',phase:'move'},files:['cultivator-v1.png'],crop:[55,18,250,335],foot:[173,328],height:321},
 {name:'left complete walk',motion:{action:'move',phase:'move',direction:{x:-1,y:0}},files:['combat-actors-v1/master-left-continuity.png'],crop:[0,512,768,512],foot:[447,487],height:480},
 {name:'released spell reverses into complete left walk',tick:105,motion:{phase:'recovery',moveIntent:{x:-1,y:0}},files:['combat-actors-v1/master-left-continuity.png'],crop:[0,512,768,512],foot:[447,487],height:480},
 {name:'left dodge existing complete artwork',motion:{action:'dodge',phase:'windup',direction:{x:-1,y:0}},files:['combat-actors-v1/master-left-continuity.png'],crop:[0,512,768,512],foot:[447,487],height:480},
];
const referenceImages=new Map();
async function referenceImage(filename){
 if(referenceImages.has(filename))return referenceImages.get(filename);
 const image=await loadImage(imagePath(filename)),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const rgba=ctx.getImageData(0,0,image.width,image.height);
 // The accepted texture import uses a binary 166-alpha threshold.
 for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=rgba.data[i]<166?0:255;
 ctx.putImageData(rgba,0,0);referenceImages.set(filename,canvas);return canvas;
}
async function expectedPixels(fixture,foot,height){
 const canvas=createCanvas(800,360),ctx=canvas.getContext('2d'),[x,y,w,h]=fixture.crop,k=height/fixture.height;ctx.imageSmoothingEnabled=false;
 for(const filename of fixture.files){
  const original=await referenceImage(filename),crop=createCanvas(w,h);
  crop.getContext('2d').putImageData(original.getContext('2d').getImageData(x,y,w,h),0,0);
  ctx.drawImage(crop,foot.x-fixture.foot[0]*k,foot.y-fixture.foot[1]*k,w*k,h*k);
 }
 return canvas;
}
function compareAboveShadow(actual,expected,foot,label){
 const rows=Math.floor(foot.y-9),a=actual.getContext('2d').getImageData(0,0,800,rows).data,b=expected.getContext('2d').getImageData(0,0,800,rows).data;
 let mismatches=0,opaque=0,first=null;
 for(let i=0;i<a.length;i+=4){if(b[i+3])opaque++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]){mismatches++;first??={x:(i/4)%800,y:Math.floor(i/4/800)};}}
 assert(opaque>300,label+' reference must contain visible body and weapon pixels');
 assert.equal(mismatches,0,label+' changed source pixels above the ground shadow; first='+JSON.stringify(first));
}

test('human renderer preserves complete source pixels at two ordinary scales, including same-index cast weapon and body',async()=>{
 const assets=await assetsPromise;assert.equal(assets.images.rigLimbs,undefined);
 for(const fixture of pixelCases)for(const [sx,height] of [[95/1.45,95],[112/1.45,112]]){
  const a=actor({movementLocked:false,moveIntent:{x:0,y:0},...fixture.motion}),b=scene(fixture.tick??104,a),before=structuredClone(b),r=renderer(assets,sx),shown=r.draw(a,b),foot=screen(a.x,a.y);
  assert.equal(shown.height,height);assert.deepEqual(shown.foot,foot);
  compareAboveShadow(r.canvas,await expectedPixels(fixture,foot,height),foot,fixture.name+' @ '+height);
  assert.deepEqual(b,before);
 }
});

test('released spell anchor keeps the formal launch direction when complete walking turns the body',async()=>{
 const assets=await assetsPromise,a=actor({phase:'recovery',movementLocked:false,moveIntent:{x:-1,y:0},direction:{x:1,y:0}}),b=scene(105,a),r=renderer(assets),shown=r.draw(a,b),foot=screen(a.x,a.y);
 assert.equal(shown.sample.facing,'left');assert.equal(shown.sample.visualOverride,'released-move');
 assert.deepEqual(shown.releaseHand,{x:foot.x+(452.8896-255)*116/384,y:foot.y+(142.2822-456)*116/384});
});

test('paused presenter freezes complete frame selection, pixels and coordinates for the same snapshot',async()=>{
 const assets=await assetsPromise,a=actor({action:'move',phase:'move',movementLocked:false}),b=scene(104,a),before=structuredClone(b),presenter=createCombatPresentation();
 presenter.sample(b,{now:0,intent:{x:1,y:0}});presenter.sample(b,{now:25,intent:{x:1,y:0}});
 const frozen=presenter.sample(b,{paused:true,now:35,intent:{x:1,y:0}}),later=presenter.sample(b,{paused:true,now:50000,intent:{x:-1,y:0}});
 assert.deepEqual(later,frozen);assert.equal(later.player.poseTick,frozen.player.poseTick);
 const first=renderer(assets),second=renderer(assets),x=first.draw(frozen.player,frozen,104),y=second.draw(later.player,later,99999);
 assert.equal(y.sample.frameKey,x.sample.frameKey);assert.equal(y.sample.tick,x.sample.tick);assert.deepEqual(y.foot,x.foot);
 assert.deepEqual(second.canvas.toBuffer('image/png'),first.canvas.toBuffer('image/png'));assert.deepEqual(b,before);
});
