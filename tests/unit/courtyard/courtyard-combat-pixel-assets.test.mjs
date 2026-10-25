import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {COMBAT_ACTOR_REGISTRY_PATH} from '../../../apps/courtyard/courtyard-combat-frame-metadata.mjs';
import {loadCombatActorAssets,createCombatActorRenderer,sampleCombatActor} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {combatBackdrop,combatBackdropProps,combatBackdropDecorations,drawCombatBackdropProp,combatGroundTiles} from '../../../apps/courtyard/courtyard-combat-backdrops.mjs';
import {combatCameraTransform,combatWorldToScreen,COMBAT_GROUND_Y_SCALE} from '../../../apps/courtyard/courtyard-combat-camera.mjs';
import {projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';

const base=new URL('../../../assets/courtyard/',import.meta.url),read=async path=>JSON.parse(await fs.readFile(new URL(path,base),'utf8'));
const assetsPromise=loadCombatActorAssets({loadImage:name=>loadImage(new URL(name,base).pathname),loadJson:read,makeCanvas:createCanvas});
const directions=[['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]];
const actor=(identity='shen-yan',motion={},extra={})=>({id:identity==='shen-yan'?'master':'foe',personId:identity==='shen-yan'?'person:master':'person:valley-shanxiao',visualIdentity:identity,entityKind:identity==='shen-yan'?'person':'beast',x:4,y:4,hp:100,facing:{x:1,y:0},motion:{action:'idle',phase:'idle',phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:false,moveIntent:{x:0,y:0},direction:{x:1,y:0},...motion},...extra});
const scene=(tick=1111,player=actor())=>({type:'combat',sessionId:'pixel-assets',geometryId:'valley-open-v2',tick,width:48,height:32,arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player,allies:[],enemies:[],projectiles:[],effects:[],obstacles:[{id:'object:valley:herbs',x:7,y:2.5,w:4,h:3},{id:'object:valley:bridge',x:21.5,y:9.5,w:7,h:3},{id:'object:valley:cave',x:38,y:16.5,w:6,h:5}]});
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('the actual default PNG loader loads forty pixel clips at common per-identity scale and retains all other identities',async()=>{
 assert.equal(COMBAT_ACTOR_REGISTRY_PATH,'combat-pixel-v1/registry.json');const assets=await assetsPromise,index=await read('combat-pixel-v1/pack-index.json'),registry=await read(COMBAT_ACTOR_REGISTRY_PATH),old=await read('combat-actors-v3/registry.json');assert.deepEqual(assets.issues,[]);assert.equal(assets.actorLibrary.size,6);
 let count=0;for(const identity of ['shen-yan','shanxiao']){
  assert.deepEqual(registry.actors[identity],index.actors[identity]);const clips=assets.actorLibrary.get(identity).clips;count+=clips.length;
  for(const clip of clips){assert.equal(clip.visualIdentity,identity);assert(clip.path.startsWith('combat-pixel-v1/'+identity+'/'));for(const frame of clip.frames){assert.deepEqual(frame.foot,[96,126]);assert.equal(frame.sourceHeight,identity==='shen-yan'?49:45);assert.deepEqual(frame.crop.slice(2),[192,192]);assert.equal(frame.image,'frame-atlas:combat-pixel-v1/'+identity+'/atlas.png');}}
 }
 assert.equal(count,40);
 for(const [identity,definition]of Object.entries(old.actors))if(!['shen-yan','shanxiao'].includes(identity))assert.deepEqual(registry.actors[identity].clips,definition.clips.map(ref=>({...ref,manifest:'../combat-actors-v3/'+ref.manifest})));
});

test('four actual move clips enter at zero, show all eight frames in 460ms, turn without phase reset and pause',async()=>{
 const {actorLibrary}=await assetsPromise;
 for(const [name,x,y]of directions){
  const presenter=createCombatPresentation(),seen=new Set(),move={x,y};
  // Observe every authoritative boundary and sample the centre of each pose.
  const centres=new Map(Array.from({length:8},(_,index)=>[(index+.5)*57.5,index])),times=[...new Set([0,100,200,300,400,...centres.keys()])].sort((a,b)=>a-b);
  for(const ms of times){const tick=1111+Math.floor(ms/100),b=scene(tick,actor('shen-yan',{phaseStartedTick:tick})),shown=presenter.sample(b,{now:ms,intent:move}),sample=sampleCombatActor(shown.player,shown,shown.visualTick,actorLibrary);assert.equal(sample.clipId,'pixel-v1-shen-yan-move-'+name);assert.equal(sample.clipDirection,name);assert.equal(sample.directionalFallback,false);assert.equal(sample.actionFallback,false);assert.equal(sample.phaseFallback,false);near(shown.player.animationElapsedTicks,ms/100);if(ms===0)assert.equal(sample.pose.index,0);if(centres.has(ms)){assert.equal(sample.pose.index,centres.get(ms));seen.add(sample.pose.index);}}
  assert.equal(seen.size,8);
  const b=scene(1115),paused=presenter.sample(b,{now:460,paused:true}),held=presenter.sample(b,{now:9000,paused:true});assert.deepEqual(held.player,paused.player);
  const stopped=presenter.sample(b,{now:9001,intent:{x:0,y:0}}),idle=sampleCombatActor(stopped.player,stopped,stopped.visualTick,actorLibrary);assert.equal(idle.clipAction,'idle');assert.equal(idle.pose.index,0);
 }
});

test('actual dodge manifests map projected authoritative stages once and hold the last crop through evade',async()=>{
 const {actorLibrary}=await assetsPromise;
 for(const [,x,y]of directions)for(const [step,progress,executed,evade,index]of [[0,0,false,0,0],[1,1,true,0,1],[2,2,true,0,2],[3,null,false,.5,3],[4,null,false,.4,3],[7,null,false,.1,3]]){
  const tick=100+step,p=actor('shen-yan',{}, {facing:{x,y},evade}),pending=progress===null?null:{id:'dodge:pixel',action:'dodge',startedTick:100,progressTicks:progress,executed,...(executed?{executedTick:101}:{}),direction:{x,y}};
  const state={worldTick:tick,combat:{status:'active',player:p,allies:[],controls:{move:{x:1,y:0}}},srCombat:{pending}};p.motion=projectCombatActorMotion(state,p);
  for(const fraction of [0,.5,.99]){const sample=sampleCombatActor({...p,poseTick:tick+fraction},scene(tick,p),tick+fraction,actorLibrary);assert.equal(sample.clipAction,'dodge');assert.equal(sample.pose.index,index);assert.equal(sample.phaseFallback,false);assert.equal(sample.directionalFallback,false);if(index>=1){const clip=actorLibrary.get('shen-yan').clips.find(c=>c.id===sample.clipId);assert.deepEqual(sample.pose.crop,clip.frames[1].crop);}}
 }
});

test('pixel reaction fallback names its front source and death holds its own final pose',async()=>{
 const {actorLibrary}=await assetsPromise;
 for(const identity of ['shen-yan','shanxiao'])for(const [name,x,y]of directions)for(const phase of ['hit','down'])for(const elapsed of [0,2,6,12,30]){
  const tick=100+elapsed,p=actor(identity,{action:phase,phase,phaseStartedTick:100,phaseDurationTicks:12,phaseProgressTicks:elapsed,direction:{x,y}},{facing:{x,y},hp:phase==='down'?0:100}),sample=sampleCombatActor(p,scene(tick,p),tick,actorLibrary);
  assert.equal(sample.clipAction,phase);assert.equal(sample.clipDirection,'down');assert.equal(sample.directionalFallback,name!=='down');assert.equal(sample.phaseFallback,false);assert.equal(sample.actionFallback,false);assert.equal(sample.mirrored,false);if(phase==='down'&&elapsed>=12)assert.equal(sample.pose.index,3);
 }
});

test('pixel bodies use one complete blit at the shared world foot, and spell release uses its registered hand',async()=>{
 const assets=await assetsPromise,calls=[],ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(...args){calls.push(args);}},project=(x,y)=>({x:100+x*20,y:220+y*10});
 const render=createCombatActorRenderer({ctx,worldToScreen:project,getTransform:()=>({sx:80,sy:40}),assets:{...assets,makeCanvas(){throw Error('pixel bodies must not allocate a pose canvas');}}});await render.prewarm();assert.equal(render.cacheStats().beast.entries,0);
 for(const identity of ['shen-yan','shanxiao'])for(const [action,phase]of [['idle','idle'],['move','move'],['attack','windup'],['attack','release'],['attack','recovery'],['hit','hit'],['down','down']]){
  const p=actor(identity,{action,phase},{hp:phase==='down'?0:100}),b=scene(1111,p),before=structuredClone(b),start=calls.length,shown=render.draw(p,b);assert(shown.sample.pose.atlas);assert.equal(calls.length,start+1);const args=calls.at(-1),pose=shown.sample.pose,k=116/pose.sourceHeight;assert.equal(args.length,9);assert.deepEqual(args.slice(1,5),pose.crop);near(args[5]+96*k,project(p.x,p.y).x);near(args[6]+126*k,project(p.x,p.y).y);near(args[7]/192,args[8]/192);assert.deepEqual(b,before);
 }
 for(const [,x,y]of directions){const p=actor('shen-yan',{action:'spell',phase:'release',direction:{x,y},movementLocked:true},{facing:{x,y}}),shown=render.presentation(p,scene(1111,p)),hand=shown.sample.pose.anchors.hand,k=116/49;assert(hand);near(shown.releaseHand.x,project(p.x,p.y).x+(hand[0]-96)*k);near(shown.releaseHand.y,project(p.x,p.y).y+(hand[1]-126)*k);}
});

test('native pixel ground remains square while all three props and edge trees use their declared atlas-local feet',async()=>{
 const b=scene(),config=combatBackdrop(b),environment=await read('combat-pixel-v1/environment/manifest.json');assert.equal(config.image,'combat-pixel-v1/environment/grass.png');assert.equal(config.propsImage,'combat-pixel-v1/environment/atlas.png');near(config.tileMetres[1],4/COMBAT_GROUND_Y_SCALE);
 for(const size of [{width:1024,height:600},{width:1672,height:816},{width:2560,height:1315}]){
  const t=combatCameraTransform(b,size),tiles=combatGroundTiles(config,t);for(const tile of tiles)assert(Math.abs(tile.width-tile.height)<=1,'rounding may differ by one device-independent pixel');
  for(const prop of [...combatBackdropProps(config,b),...combatBackdropDecorations(config,t)]){
   const key=prop.id.includes('herbs')?'herbs':prop.id.includes('bridge')?'bridge':prop.id.includes('cave')?'cave':'pine',source=environment.assets[key],expectedFoot=source.foot.map((n,i)=>n+source.sourceRect[i]);assert.deepEqual(prop.sourceRect,source.sourceRect);assert.deepEqual(prop.foot,expectedFoot);
   let args;drawCombatBackdropProp({drawImage(...value){args=value;}},{},prop,t);const k=prop.worldWidth*t.sx/prop.sourceRect[2],foot=combatWorldToScreen(t,prop.x,prop.y);near(args[5]+source.foot[0]*k,foot.x);near(args[6]+source.foot[1]*k,foot.y);
  }
 }
});
