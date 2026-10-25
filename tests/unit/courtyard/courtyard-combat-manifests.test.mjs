import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {normalizeCombatFrameManifest,combatVisualIdentity,sampleCombatFrameAtlas} from '../../../apps/courtyard/courtyard-combat-frame-metadata.mjs';
import {sampleCombatActor,createCombatActorRenderer,loadCombatActorAssets} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatPresentation,combatDepthOrder,combatActorAtScreen} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {expeditionCommand} from '../../../apps/courtyard/sect-combat.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';

const manifest=(identity,action='attack',direction='right',phases=['windup','release','recovery'])=>({schema:'combat-frame-atlas/v1',id:identity+':'+action+':'+direction,visualIdentity:identity,action,direction,atlas:'atlas.png',frameSize:[16,24],sourceHeight:20,foot:[8,22],durationMs:phases.length*100,frames:phases.map((phase,index)=>({index,x:index*16,y:0,w:16,h:24,foot:[8,22],sourceHeight:20,durationMs:100,phase,anchors:{hand:[12,9],grip:[10,12],tip:[15,8]}}))});
const clip=(value,key=value.id)=>normalizeCombatFrameManifest(value,{imageKey:key,path:key});
const player=(extra={})=>({id:'master',personId:'person:master',visualIdentity:'shen-yan',faction:'sect',x:3.5,y:4,hp:100,maxHp:100,facing:{x:1,y:0},motion:{action:'attack',phase:'windup',startedTick:100,executeAtTick:102,phaseStartedTick:100,phaseDurationTicks:2,phaseProgressTicks:1,recoveryUntilTick:106,movementLocked:true,direction:{x:1,y:0}},...extra});
const scene=(tick,p=player(),extra={})=>({type:'combat',sessionId:'atlas-test',tick,worldTick:tick,player:p,allies:[],enemies:[],projectiles:[],effects:[],...extra});
const actorAt=(tick,motion={},extra={})=>player({...extra,motion:{...player().motion,...motion}});
const libraryFor=(identity,...clips)=>new Map([[identity,{clips}]]);

test('registered actors keep their own complete frames at formal phase and movement boundaries',()=>{
 const attack=clip(manifest('shen-yan')),walk=clip(manifest('shen-yan','walk','left',['move','move'])),dodge=clip(manifest('shen-yan','dodge','left')),hit=clip(manifest('shen-yan','hit-heavy','left',['hit'])),down=clip(manifest('shen-yan','down','left',['down'])),library=libraryFor('shen-yan',attack,walk,dodge,hit,down);
 const drawSample=(tick,motion,extra={})=>sampleCombatActor(actorAt(tick,motion,extra),scene(tick),tick,library);
 assert.equal(drawSample(101,{phase:'windup'}).pose.index,0);
 const release=drawSample(102,{phase:'release',phaseStartedTick:102,phaseDurationTicks:1,phaseProgressTicks:0,movementLocked:false,moveIntent:{x:-1,y:0}},{poseTick:102.99});
 assert.equal(release.pose.index,1);assert.equal(release.phase,'release');assert.equal(release.frameKey,attack.frames[1].key);
 const moving=drawSample(103,{phase:'recovery',movementLocked:false,moveIntent:{x:-1,y:0}});
 assert.equal(moving.clipAction,'walk');assert.equal(moving.runtimePhase,'recovery');assert.equal(moving.phase,'move');assert.equal(moving.visualOverride,'released-move');
 for(const [action,phase,expected,reaction,hp] of [['dodge','release','dodge',null,100],['attack','hit','hit-heavy',{kind:'heavy'},100],['attack','down','down',null,0]]){
  const state=drawSample(103,{action,phase,direction:{x:-1,y:0},movementLocked:false,moveIntent:{x:-1,y:0}},{facing:{x:-1,y:0},hitReaction:reaction,hp});
  assert.equal(state.clipAction,expected);assert.equal(state.visualOverride,null);assert(state.pose.atlas);
 }
});

test('atlas selection uses explicit identity across humans, beasts and NPC factions',()=>{
 const human=clip(manifest('disciple-blue')),beast=clip(manifest('forest-ape')),library=new Map([['disciple-blue',{clips:[human]}],['forest-ape',{clips:[beast]}]]);
 for(const [visualIdentity,entityKind,key] of [['disciple-blue','person',human.frames[0].key],['forest-ape','beast',beast.frames[0].key]])for(const faction of ['sect','hostile']){
  const actor=actorAt(101,{}, {id:'body:'+faction,personId:'person:npc',visualIdentity,entityKind,faction}),before=structuredClone(actor),sample=sampleCombatActor(actor,scene(101),101,library);
  assert.equal(sample.frameKey,key);assert.equal(sample.mirrored,false);assert.equal(sample.visualIdentity,visualIdentity);assert.deepEqual(sample.direction,{x:1,y:0});assert.deepEqual(actor,before);
 }
 const unknown=actorAt(101,{}, {personId:'person:lu-zhiwei',visualIdentity:'person:lu-zhiwei'}),fallback=sampleCombatActor(unknown,scene(101));
 assert.equal(fallback.pose.image,'disciples');assert.equal(fallback.assetFallback,true);assert.equal(fallback.castIndex,null);
 assert.equal(combatVisualIdentity({...unknown,visualIdentity:null,appearance:{visualIdentity:'persistent-robe'}}),'persistent-robe');
 const diagonal=sampleCombatActor(actorAt(101,{direction:{x:1,y:1}},{visualIdentity:'disciple-blue'}),scene(101),101,library);
 assert.equal(diagonal.directionalFallback,true);assert.equal(diagonal.mirrored,false);assert.equal(diagonal.frameKey,human.frames[0].key);
});

test('a partial identity registry never turns hit or down into an idle atlas frame',()=>{
 const identity='prison-guard-armored',idle=clip(manifest(identity,'idle','left',['idle'])),attack=clip(manifest(identity,'attack','left')),library=libraryFor(identity,idle,attack);
 for(const phase of ['hit','down']){
  const sample={phase,runtimePhase:phase,action:phase,facing:'left',direction:{x:-1,y:0},progress:.5,tick:100};
  assert.equal(sampleCombatFrameAtlas(identity,sample,library),null);
  const actor=actorAt(100,{action:phase,phase,direction:{x:-1,y:0}},{personId:null,visualIdentity:identity,facing:{x:-1,y:0},hp:phase==='down'?0:100}),fallback=sampleCombatActor(actor,scene(100),100,library);
  assert.equal(fallback.phase,phase);assert.equal(fallback.clipAction,undefined);assert.equal(fallback.pose.atlas,undefined);assert.equal(fallback.assetFallback,true);assert.equal(fallback.visualIdentity,identity);
 }
});

test('reaction clips with unrelated labelled phases remain unavailable instead of holding a standing frame',()=>{
 for(const phase of ['hit','down']){
  const identity='guard',sample={phase,runtimePhase:phase,action:phase,facing:'left',direction:{x:-1,y:0},progress:.5,tick:100},wrong=clip(manifest(identity,phase,'left',['idle'])),proper=clip(manifest(identity,phase,'left',[phase,phase]));
  assert.equal(sampleCombatFrameAtlas(identity,sample,libraryFor(identity,wrong)),null);
  const result=sampleCombatFrameAtlas(identity,sample,libraryFor(identity,proper));assert.equal(result.clipAction,phase);assert.equal(result.pose.phase,phase);assert.equal(result.pose.index,1);assert.equal(result.phaseFallback,false);assert.equal(result.actionFallback,false);
 }
});

test('current guard reactions retain their own left-side frames and hold the final down frame without looping',async()=>{
 const registryUrl=new URL('../../../assets/courtyard/combat-actors-v3/registry.json',import.meta.url),registry=JSON.parse(await fs.readFile(registryUrl,'utf8'));
 for(const identity of ['prison-guard-armored','prison-guard-cloth']){
  const clips=await Promise.all(registry.actors[identity].clips.map(async ref=>{const url=new URL(ref.manifest,registryUrl);return clip(JSON.parse(await fs.readFile(url,'utf8')),url.href);})),library=libraryFor(identity,...clips);
  for(const direction of [{x:-1,y:0},{x:-1,y:-1},{x:-1,y:1}]){
   for(const [phase,steps]of [['hit',[0,1,2]],['down',[0,1,2,3,4,6,11,12,20]]])for(const step of steps){
    const tick=100+step,actor=actorAt(tick,{action:phase,phase,phaseDurationTicks:phase==='down'?12:3,phaseProgressTicks:step,direction},{personId:null,visualIdentity:identity,facing:direction,hp:phase==='down'?0:100,hitReaction:{kind:'heavy'}}),sample=sampleCombatActor(actor,scene(tick),tick,library);
    assert.equal(sample.clipAction,phase);assert.equal(sample.pose.phase,phase);assert(sample.frameKey.includes('/'+identity+'/'+phase+'-left/manifest.json#'));assert.equal(sample.actionFallback,false);assert.equal(sample.phaseFallback,false);assert.equal(sample.pose.index,phase==='hit'?0:step<2?0:step<4?1:2);
   }
  }
  for(const direction of [{x:1,y:0},{x:1,y:-1},{x:1,y:1}])for(const phase of ['hit','down'])assert.equal(sampleCombatFrameAtlas(identity,{phase,runtimePhase:phase,action:phase,facing:'right',direction,progress:1,tick:120},library),null,'opposite half-plane has no authored reaction');
 }
});

test('the real right-only registry preserves existing left attack artwork across the left half-plane',async()=>{
 const registryUrl=new URL('../../../assets/courtyard/combat-actors-v3/registry.json',import.meta.url),registry=JSON.parse(await fs.readFile(registryUrl,'utf8'));
 const clips=await Promise.all(registry.actors['shen-yan'].clips.map(async reference=>{const url=new URL(reference.manifest,registryUrl);return clip(JSON.parse(await fs.readFile(url,'utf8')),url.href);}));
 const rightClips=clips.filter(c=>c.direction==='right'),library=libraryFor('shen-yan',...rightClips);assert(rightClips.some(c=>c.action==='attack'));
 for(const direction of [{x:-1,y:0},{x:-1,y:-1},{x:-1,y:1}]){
  const sample=sampleCombatActor(actorAt(102,{phase:'release',direction},{facing:direction}),scene(102),102,library);
  assert.equal(sample.pose.image,'leftActions');assert.equal(sample.pose.atlas,undefined);assert.equal(sample.facing,'left');
 }
 for(const direction of [{x:1,y:0},{x:1,y:-1},{x:1,y:1}])assert.equal(sampleCombatActor(actorAt(102,{phase:'release',direction}),scene(102),102,library).pose.atlas,true);
 const hit=clip(manifest('test-hit','hit-heavy','left',['hit'])),incoming={x:1,y:0},sample=sampleCombatActor(actorAt(103,{action:'hit',phase:'hit',direction:incoming},{visualIdentity:'test-hit',facing:{x:-1,y:0},hitReaction:{kind:'heavy'}}),scene(103),103,libraryFor('test-hit',hit));
 assert.equal(sample.atlasDirection,'left');assert.deepEqual(sample.direction,incoming,'contact direction remains available to effects');
});

test('the current up-right attack resolves the actual party07 direction without a directional fallback',async()=>{
 const registryUrl=new URL('../../../assets/courtyard/combat-actors-v3/registry.json',import.meta.url),registry=JSON.parse(await fs.readFile(registryUrl,'utf8')),clips=await Promise.all(registry.actors['shen-yan'].clips.map(async ref=>{const url=new URL(ref.manifest,registryUrl);return clip(JSON.parse(await fs.readFile(url,'utf8')),url.href);})),library=libraryFor('shen-yan',...clips),direction={x:.5417016133976641,y:-.840570854861366};
 for(const phase of ['windup','release','recovery']){
  const sample=sampleCombatActor(actorAt(102,{phase,direction,phaseProgressTicks:0},{facing:direction}),scene(102),102,library);
  assert.equal(sample.atlasDirection,'up-right');assert(sample.frameKey.includes('/attack-up-right/manifest.json#'));assert.equal(sample.pose.phase,phase);assert.equal(sample.directionalFallback,false);assert.equal(sample.actionFallback,false);assert.equal(sample.phaseFallback,false);
 }
});

test('the current spell atlas keeps its authored release hand while the body switches to a left walking fallback',async()=>{
 const base=new URL('../../../assets/courtyard/',import.meta.url),assets=await loadCombatActorAssets({loadImage:name=>loadImage(new URL(name,base).pathname),loadJson:async name=>JSON.parse(await fs.readFile(new URL(name,base),'utf8')),makeCanvas:createCanvas});assert.deepEqual(assets.issues,[]);
 const spell=assets.actorLibrary.get('shen-yan').clips.find(c=>c.action==='spell'&&c.direction==='right'),release=spell.frames.find(f=>f.phase==='release');assert(release.anchors.hand);
 const canvas=createCanvas(400,300),ctx=canvas.getContext('2d'),project=(x,y)=>({x:100+x*20,y:230+y*5}),renderer=createCombatActorRenderer({ctx,worldToScreen:project,getTransform:()=>({sx:80,sy:40}),assets});
 const releasing=actorAt(104,{action:'spell',phase:'release',executeAtTick:104,phaseStartedTick:104,phaseProgressTicks:0,movementLocked:false}),from=renderer.presentation(releasing,scene(104,releasing));assert.equal(from.sample.pose.atlas,true);assert.equal(from.sample.pose.key,release.key);
 const moving=actorAt(105,{action:'spell',phase:'recovery',executeAtTick:104,movementLocked:false,moveIntent:{x:-1,y:0}}),shown=renderer.presentation(moving,scene(105,moving));assert.equal(shown.sample.phase,'move');assert.equal(shown.sample.facing,'left');assert.deepEqual(shown.releaseHand,from.releaseHand);const foot=project(moving.x,moving.y);assert.deepEqual(shown.releaseHand,{x:foot.x+(release.hand[0]-release.foot[0])*116/release.sourceHeight,y:foot.y+(release.hand[1]-release.foot[1])*116/release.sourceHeight});
});

test('manifest validation rejects frames that would change body scale or foot registration',()=>{
 for(const change of [m=>m.frames[1].foot=[9,22],m=>m.frames[1].sourceHeight=19,m=>m.frames[1].w=15,m=>m.frames[1].durationMs=0,m=>m.frames[1].anchors.hand=[NaN,4],m=>m.frames[1].index=0]){
  const source=manifest('test');change(source);assert.throws(()=>clip(source));
 }
});

test('atlas loader preserves valid identities and exposes a failed identity without discarding fallback assets',async()=>{
 const value=manifest('disciple-blue'),atlas=createCanvas(48,24),fallback=createCanvas(1,1),requests=[];
 const registry={schema:'combat-actor-registry/v1',actors:{'disciple-blue':{clips:[{manifest:'blue/attack/manifest.json'}]},broken:{clips:[{manifest:'missing/manifest.json'}]}}};
 const assets=await loadCombatActorAssets({registry,registryPath:'combat-actors-v3/registry.json',loadJson:async path=>{requests.push(path);if(path.endsWith('/missing/manifest.json'))throw Error('fixture missing');return value;},loadImage:async path=>path==='combat-actors-v3/blue/attack/atlas.png'?atlas:fallback,makeCanvas:createCanvas});
 assert(assets.actorLibrary.has('disciple-blue'));assert(!assets.actorLibrary.has('broken'));assert.equal(assets.issues.length,1);assert.equal(assets.issues[0].identity,'broken');assert(assets.images.person);assert(assets.images.disciples);
 assert(requests.includes('combat-actors-v3/blue/attack/manifest.json'));
});

test('atlas renderer blits the registered rectangle at the real foot without per-frame canvases or source mutation',async()=>{
 const source=manifest('disciple-blue','idle','right',['idle']),atlas=createCanvas(16,24),sourceContext=atlas.getContext('2d');sourceContext.fillStyle='#c95231';sourceContext.fillRect(2,2,12,20);
 let allocations=0;const actorLibrary=libraryFor('disciple-blue',clip(source,'atlas'));actorLibrary.set('shanxiao',{clips:['left','right'].map(direction=>clip(manifest('shanxiao','idle',direction,['idle']),'atlas'))});
 for(const direction of ['left','right'])for(const action of ['hit-light','hit-heavy'])actorLibrary.get('shanxiao').clips.push(clip(manifest('shanxiao',action,direction,['hit']),'atlas'));
 const assets={images:{atlas},makeCanvas:(w,h)=>{allocations++;return createCanvas(w,h);},actorLibrary},canvas=createCanvas(240,180),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const project=(x,y)=>({x:40+x*10,y:130+y*2}),render=createCombatActorRenderer({ctx,worldToScreen:project,getTransform:()=>({sx:60,sy:30}),assets}),actor=player({visualIdentity:'disciple-blue',motion:{action:'idle',phase:'idle'}}),b=scene(100,actor),before=structuredClone(b),shown=render.draw(actor,b);
 assert.equal(shown.height,87);assert.deepEqual(shown.foot,project(actor.x,actor.y));assert.equal(shown.wholeFrame.key,'atlas#0');assert.equal(allocations,0);
 const pixels=canvas.toBuffer('image/png');ctx.clearRect(0,0,240,180);render.draw(actor,b);assert.deepEqual(canvas.toBuffer('image/png'),pixels);assert.deepEqual(b,before);
 await render.prewarm();for(let frame=0;frame<40;frame++)for(let body=0;body<32;body++)render.draw({...actor,id:'body:'+body,visualIdentity:body%2?'disciple-blue':'shanxiao',entityKind:body%2?'person':'beast'},b,100+frame/6);
 assert.equal(allocations,0,'registered human and beast atlases do not allocate body canvases during warmup or repeated group draws');
 const stats=render.cacheStats();assert.equal(stats.entries,0);assert.equal(stats.beast.entries,0);
});

test('attack-only beast registration warms remaining legacy idle, movement and reactions before first draw',async()=>{
 const base=new URL('../../../assets/courtyard/',import.meta.url),assets=await loadCombatActorAssets({loadImage:name=>loadImage(new URL(name,base).pathname),loadJson:async name=>JSON.parse(await fs.readFile(new URL(name,base),'utf8')),makeCanvas:createCanvas});assert.deepEqual(assets.issues,[]);
 const attacks=assets.actorLibrary.get('shanxiao').clips.filter(c=>c.action==='attack'&&c.direction==='left');assert(attacks.length);assets.actorLibrary.set('shanxiao',{clips:attacks});
 let allocations=0;assets.makeCanvas=(w,h)=>{allocations++;return createCanvas(w,h);};const ctx=createCanvas(600,400).getContext('2d'),render=createCombatActorRenderer({ctx,worldToScreen:(x,y)=>({x:x*40,y:200+y*10}),getTransform:()=>({sx:80,sy:40}),assets});
 await render.prewarm();const warmed=allocations,stats=render.cacheStats();assert.equal(stats.beast.entries,172);assert(warmed>0);
 for(const phase of ['idle','move','windup','release','recovery','hit'])for(const x of [-1,1])for(const reaction of phase==='hit'?['light','heavy']:['light']){
  const actor=player({id:'enemy',personId:'person:valley-shanxiao',visualIdentity:'shanxiao',entityKind:'beast',facing:{x,y:0},hitReaction:{kind:reaction},motion:{action:phase==='idle'||phase==='move'?phase:phase==='hit'?'hit':'strike',phase,phaseProgressTicks:0,phaseDurationTicks:1,direction:{x:phase==='hit'?-x:x,y:0}}});render.draw(actor,scene(100),100);
 }
 assert.equal(allocations,warmed,'first visible fallback frames must use the warmed rig cache');
});

test('complete beast atlas coverage across both half-planes leaves the legacy rig unallocated',async()=>{
 const clips=[];for(const direction of ['left','right'])for(const [action,phases]of [['idle',['idle']],['walk',['move']],['attack',['windup','release','recovery']],['hit-light',['hit']],['hit-heavy',['hit']]])clips.push(clip(manifest('shanxiao',action,direction,phases),'atlas'));
 let allocations=0;const assets={images:{atlas:createCanvas(48,24)},actorLibrary:libraryFor('shanxiao',...clips),makeCanvas:(w,h)=>{allocations++;return createCanvas(w,h);}},ctx=createCanvas(600,400).getContext('2d'),render=createCombatActorRenderer({ctx,worldToScreen:(x,y)=>({x:x*40,y:200+y*10}),getTransform:()=>({sx:80,sy:40}),assets});
 await render.prewarm();assert.equal(allocations,0);
 for(let angle=0;angle<8;angle++)for(const phase of ['idle','move','windup','release','recovery','hit'])for(const reaction of phase==='hit'?['light','heavy']:['light']){
  const direction={x:Math.cos(angle*Math.PI/4),y:Math.sin(angle*Math.PI/4)},actor=player({id:'enemy',personId:'person:valley-shanxiao',visualIdentity:'shanxiao',entityKind:'beast',facing:direction,hitReaction:{kind:reaction},motion:{action:phase==='idle'||phase==='move'?phase:phase==='hit'?'hit':'strike',phase,phaseProgressTicks:0,phaseDurationTicks:1,direction}});assert.equal(render.draw(actor,scene(100),100).sample.pose.atlas,true);
 }
 assert.equal(allocations,0);assert.equal(render.cacheStats().beast.entries,0);
});

test('paused multi-body presentation freezes frame sampling and all projected feet',()=>{
 const clips=[clip(manifest('shen-yan','walk','right',['move','move']))],library=libraryFor('shen-yan',...clips),presenter=createCombatPresentation();
 const p=player({motion:{action:'move',phase:'move',movementLocked:false,moveIntent:{x:1,y:0},direction:{x:1,y:0}}}),ally={...p,id:'ally',personId:'person:ally',x:4,y:4.1},enemy={...p,id:'enemy',personId:'person:enemy',faction:'hostile',x:6,y:4.2},b=scene(100,p,{allies:[ally],enemies:[enemy]}),before=structuredClone(b);
 presenter.sample(b,{now:0,intent:{x:1,y:0}});presenter.sample(b,{now:50,intent:{x:1,y:0}});
 const frozen=presenter.sample(b,{now:55,paused:true}),later=presenter.sample(b,{now:50000,paused:true});assert.deepEqual(later,frozen);
 const retargeted=presenter.sample({...b,selectedTargetId:'enemy'},{now:51000,paused:true});assert.equal(retargeted.selectedTargetId,'enemy');assert.equal(retargeted.visualTick,frozen.visualTick);assert.deepEqual(retargeted.player,frozen.player);assert.deepEqual(retargeted.enemies,frozen.enemies);
 for(const body of [frozen.player,...frozen.allies,...frozen.enemies]){
  const first=sampleCombatActor(body,frozen,100,library),same=sampleCombatActor(body,later,9999,library);assert.equal(first.frameKey,same.frameKey);assert.equal(first.tick,same.tick);assert.deepEqual(first.foot,same.foot);
 }
 assert.deepEqual(b,before);
});

test('projectile preview only contacts the opposing faction and keeps the authoritative state read-only',()=>{
 const p=player({x:3,y:4}),enemy={...p,id:'foe',personId:'person:foe',faction:'hostile',x:5,y:4},ally={...p,id:'ally',personId:'person:ally',x:4.5,y:4},friendly={...enemy,id:'foe-2',personId:'person:foe-2',x:4.25,y:4};
 const shot={id:1,sourceId:'foe',ownerFaction:'hostile',x:4.7,y:4,direction:{x:-1,y:0},speed:8,remainingDistance:5,radius:.45,launchedTick:100,from:{x:5,y:4}},b=scene(100,p,{allies:[ally],enemies:[enemy,friendly],projectiles:[shot]}),before=structuredClone(b),presenter=createCombatPresentation();
 presenter.sample(b,{now:0});const rendered=presenter.sample(b,{now:90});assert.equal(rendered.projectiles[0].x,4.7,'the allied target is already in the spell contact radius');assert.deepEqual(b,before);
 const playerShot={...shot,sourceId:'master',ownerFaction:'sect',x:4.25,direction:{x:1,y:0}},other=scene(101,p,{allies:[{...ally,x:4.3}],enemies:[{...enemy,x:5.5}],projectiles:[playerShot]}),next=createCombatPresentation();next.sample(other,{now:0});assert(next.sample(other,{now:90}).projectiles[0].x>4.9,'friendly bodies do not stop a sect projectile preview');
});

test('depth and body selection share stable foot order, while target and tactic requests preserve explicit arguments',()=>{
 const p=player({x:4,y:4}),back={...p,id:'back',personId:'person:back',faction:'hostile',y:3.8},front={...p,id:'front',personId:'person:front',faction:'hostile',y:4.2},b=scene(100,p,{enemies:[front,back]});
 assert.deepEqual(combatDepthOrder(b).map(a=>a.id),['back','master','front']);
 const project=(x,y)=>({x:x*30,y:y*30});assert.equal(combatActorAtScreen(b,{x:120,y:100},{worldToScreen:project}).id,'front');
 assert.equal(combatActorAtScreen(b,{x:0,y:0},{worldToScreen:project}),null);
 assert.deepEqual(expeditionCommand({type:'combat-target',targetId:'back'}).command,{name:'setSRCombatTarget',args:['back']});
 assert.deepEqual(expeditionCommand({type:'combat-target',targetId:null}).command,{name:'setSRCombatTarget',args:[null]});
 assert.deepEqual(expeditionCommand({type:'combat-tactic',tactic:'focus'}).command,{name:'setCombatTactic',args:['focus']});
 const target={x:2,y:7};assert.deepEqual(expeditionCommand({type:'combat',actionId:'spell',target}).command.args,['spell',target]);
});

test('public desktop target and tactic commands survive paused save/restore and leave explicit mouse skill plans intact',()=>{
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args] of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 let run=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'unit-target-checkpoint'}}});
 const send=request=>{const result=commandSect(run,request);assert.equal(result.ok,true,result.error);return result;},until=(predicate,label)=>{for(let i=0;i<3000&&!predicate();i++)advanceSect(run,.1);assert(predicate(),label);};
 send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});until(()=>!run.state.srWorld.interaction&&!run.state.master.scenic.path.length,'reach gate');
 send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}}});until(()=>!run.state.srWorld.activeTravelId,'reach valley');
 send({type:'world',action:{action:'move',x:24.5,y:36}});until(()=>!run.state.srWorld.interaction,'approach encounter');send({type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});send({type:'pause',paused:true});
 const tick=run.state.worldTick,qi=run.state.combat.player.qi,hp=run.state.combat.enemies[0].hp,targetId=run.state.combat.enemies[0].id;
 send({type:'combat-target',targetId});send({type:'combat-tactic',tactic:'focus'});
 assert.equal(viewSect(run).expedition.scene.selectedTargetId,targetId);assert.equal(viewSect(run).expedition.combat.tactic,'focus');
 for(const request of [{type:'combat-target',targetId:'master'},{type:'combat-tactic',tactic:'unknown'}]){const before=snapshotSect(run);assert.equal(commandSect(run,request).ok,false);assert.deepEqual(snapshotSect(run),before);}
 const saved=snapshotSect(run);run=restoreSect(saved);assert.deepEqual(snapshotSect(run),saved);
 const aim={x:.8,y:.8};send({type:'combat',actionId:'spell',target:aim});assert.deepEqual(run.state.srCombat.pending.target,aim);assert.equal(run.state.combat.selectedTargetId,targetId);
 advanceSect(run,5);assert.equal(run.state.worldTick,tick);assert.equal(run.state.combat.player.qi,qi);assert.equal(run.state.combat.enemies[0].hp,hp);
});


test('nearest same-side angle handles the actual solo01 vector and a full circle without changing the direction',async()=>{
 const registryUrl=new URL('../../../assets/courtyard/combat-actors-v3/registry.json',import.meta.url),registry=JSON.parse(await fs.readFile(registryUrl,'utf8')),clips=await Promise.all(registry.actors['shen-yan'].clips.map(async ref=>{const url=new URL(ref.manifest,registryUrl);return clip(JSON.parse(await fs.readFile(url,'utf8')),url.href);})),library=libraryFor('shen-yan',...clips);
 const vectors=[[{x:.37342646083107933,y:-.9276597858866009},'up-right'],[{x:0,y:-1},'up-right'],[{x:.02,y:-1},'up-right'],[{x:-.02,y:-1},'up-right'],[{x:0,y:1},'right'],[{x:1,y:1},'right'],[{x:-1,y:1},'left'],[{x:-1,y:-1},'left'],[{x:-.1,y:-1},'left']];
 for(const [direction,expected]of vectors){const before=structuredClone(direction),sample=sampleCombatActor(actorAt(102,{phase:'release',direction},{facing:direction}),scene(102),102,library);assert(sample.frameKey.includes('/attack-'+expected+'/manifest.json#'));assert.deepEqual(direction,before);assert.deepEqual(sample.direction,before);}
 const angles=['right','down-right','down','down-left','left','up-left','up','up-right'],horizontal=name=>name.includes('left')?'left':name.includes('right')?'right':null;
 for(let degree=0;degree<360;degree++){
  const radians=degree*Math.PI/180,direction={x:Math.cos(radians),y:Math.sin(radians)},sample=sampleCombatActor(actorAt(102,{phase:'release',direction},{facing:direction}),scene(102),102,library),requested=angles.indexOf(sample.atlasDirection),side=horizontal(sample.atlasDirection)||sample.facing,eligible=clips.filter(c=>c.action==='attack'&&(!horizontal(c.direction)||horizontal(c.direction)===side));
  let expected=null,bestDot=-Infinity;for(const candidate of eligible){const dot=Math.cos((requested-angles.indexOf(candidate.direction))*Math.PI/4);if(dot>bestDot+1e-12){bestDot=dot;expected=candidate;}}
  assert.equal(sample.clipId,expected.id,'degree '+degree);assert.equal(sample.mirrored,false);assert(!horizontal(expected.direction)||horizontal(expected.direction)===side,'degree '+degree+' must retain its side');
 }
});

test('direction ties retain registry order and default is used only after all marked angles',()=>{
 const identity='direction-fixture',defaultClip=clip(manifest(identity,'attack','default')),upper=clip(manifest(identity,'attack','up-right')),lower=clip(manifest(identity,'attack','down-right')),sample={phase:'release',runtimePhase:'release',action:'attack',facing:'right',direction:{x:1,y:0},progress:0,tick:100};
 assert.equal(sampleCombatFrameAtlas(identity,sample,libraryFor(identity,defaultClip,upper,lower)).clipId,upper.id);
 assert.equal(sampleCombatFrameAtlas(identity,sample,libraryFor(identity,defaultClip,lower,upper)).clipId,lower.id);
 assert.equal(sampleCombatFrameAtlas(identity,sample,libraryFor(identity,defaultClip)).clipId,defaultClip.id);
 const right=clip(manifest(identity,'attack','right'));
 for(const direction of [{x:-1,y:0},{x:-1,y:-1},{x:-1,y:1}])assert.equal(sampleCombatFrameAtlas(identity,{...sample,direction,facing:'left'},libraryFor(identity,right,upper,lower)),null);
});
