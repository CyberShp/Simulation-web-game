import test from 'node:test';
import assert from 'node:assert/strict';
import {createSwordStudyAudio} from '../../../apps/courtyard/courtyard-combat-sword-study-audio.mjs';

class AudioFixture {
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.sources=[];this.buffers=[];this.resumeCalls=0;}
 createGain(){const gain={value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}};return this.master={gain,connect(){}};}
 createDynamicsCompressor(){return this.limiter={threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}};}
 createBuffer(channels,length,sampleRate){const pcm=new Float32Array(length),buffer={length,sampleRate,getChannelData(){return pcm;}};this.buffers.push(buffer);return buffer;}
 createBufferSource(){const source={buffer:null,started:false,stopped:false,connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};this.sources.push(source);return source;}
 createStereoPanner(){return {pan:{value:0},connect(){},disconnect(){}};}
 resume(){this.resumeCalls++;this.state='running';return Promise.resolve();}
 close(){this.state='closed';return Promise.resolve();}
}
const base=()=>({rulesProfile:'sword-study-v1',sessionId:'combat:one',tick:100,status:'active',player:{id:'master',x:10,y:10,motion:{action:'idle',phase:'idle'}},effects:[],projectiles:[]});
const hit=(id,tick,{sourceId='master',targetId='enemy-1',amount=15,outcome='hit',...other}={})=>({id,eventId:'impact:'+id,kind:'hit',tick,sourceId,targetId,amount,outcome,contact:{x:15,y:10},...other});
async function ready(){const context=new AudioFixture(),audio=createSwordStudyAudio({createContext:()=>context});assert.equal(audio.prepare(),true);await audio.unlock();const scene=base();audio.update(scene);return {audio,context,scene};}

test('all eight original WAVs prepare as actual PCM, moderate master and compressor protect up to eight voices',async()=>{
 const {audio,context}=await ready();assert.equal(context.buffers.length,8);assert(context.buffers.every(buffer=>buffer.sampleRate===48000));
 assert(context.buffers.every(buffer=>buffer.getChannelData(0).some(value=>value!==0)));assert(context.buffers.every(buffer=>buffer.getChannelData(0).every(value=>Math.abs(value)<1)));
 assert.equal(audio.status().volume,.35);assert.equal(context.limiter.threshold.value,-6);assert.equal(context.limiter.ratio.value,20);assert.equal(context.limiter.attack.value,.001);
 const copy=audio.status();copy.cues.lightHit=99;assert.equal(audio.status().cues.lightHit,0);
});

test('prepare stays suspended and gesture unlock calls resume before its returned promise settles',async()=>{
 const context=new AudioFixture(),audio=createSwordStudyAudio({createContext:()=>context});assert.equal(audio.prepare(),true);assert.equal(context.resumeCalls,0);
 const pending=audio.unlock();assert.equal(context.resumeCalls,1);assert.equal(await pending,true);assert.equal(audio.status().ready,true);assert.equal(audio.status().unlocked,true);
});

test('formal projectile releases and true hits play once across repeated projections',async()=>{
 const {audio,scene}=await ready();scene.tick=101;scene.projectiles=[{id:1,kind:'sword-qi',launchedTick:101,from:{x:10,y:9}}];audio.update(scene);audio.update(scene);
 scene.tick=102;scene.projectiles=[];scene.effects=[{id:2,kind:'attack',tick:102,sourceId:'master'},hit(3,102)];audio.update(scene);audio.update(scene);
 assert.equal(audio.status().played,2);assert.equal(audio.status().cues.swordRelease,1);assert.equal(audio.status().cues.lightHit,1);
});

test('a consumed projectile still has one stable release cue after a multi-tick pump and produces no hit feedback',async()=>{
 const {audio,scene}=await ready();scene.tick=102;scene.projectiles=[];
 scene.effects=[{id:1,eventId:'impact:1',kind:'attack',projectileRelease:true,projectileId:7,actionId:'a7',sourceId:'master',tick:101,amount:0}];
 audio.update(scene);audio.update(scene);assert.equal(audio.status().cues.swordRelease,1);assert.equal(audio.status().cues.lightHit,0);
 scene.projectiles=[{id:7,kind:'sword-qi',launchedTick:101}];audio.update(scene);assert.equal(audio.status().played,1);
});

test('Q charge, true heavy contact, empty ground, dodge, enemy release and player contact use the eight-cue vocabulary',async()=>{
 const {audio,scene}=await ready();scene.tick=101;scene.player.motion={action:'ground-sword',phase:'windup',actionId:'q1',startedTick:101};audio.update(scene);
 scene.tick=103;scene.player.motion={action:'ground-sword',phase:'release'};scene.effects=[{id:1,kind:'impact',tick:103,groundSword:true,groundStrikeId:1},hit(2,103,{groundSword:true,groundStrikeId:1})];audio.update(scene);
 scene.tick=104;scene.effects=[{id:3,kind:'impact',tick:104,groundSword:true,groundStrikeId:2}];audio.update(scene);
 scene.tick=105;scene.effects=[{id:4,kind:'dodge',tick:105,sourceId:'master'},{id:5,kind:'impact',tick:105,sourceId:'enemy-1'},hit(6,105,{sourceId:'enemy-1',targetId:'master',amount:10})];audio.update(scene);
 const cues=audio.status().cues;for(const cue of ['heavyCharge','heavyImpact','groundStrike','dodge','enemySlam','playerHit'])assert.equal(cues[cue],1,cue);
});

test('zero damage, evaded and guarded contacts do not invent a body-hit sound',async()=>{
 const {audio,scene}=await ready();scene.tick=101;scene.effects=[hit(1,101,{amount:0}),hit(2,101,{outcome:'evaded'}),hit(3,101,{outcome:'guarded'})];audio.update(scene);assert.equal(audio.status().played,0);
});

test('locked and muted events are consumed immediately and never queued for later playback',async()=>{
 const context=new AudioFixture(),audio=createSwordStudyAudio({createContext:()=>context}),scene=base();audio.prepare();audio.update(scene);
 scene.tick=101;scene.effects=[hit(1,101)];audio.update(scene);await audio.unlock();audio.update(scene);assert.equal(audio.status().played,0);
 audio.setMuted(true);scene.tick=102;scene.effects=[hit(2,102)];audio.update(scene);audio.setMuted(false);audio.update(scene);assert.equal(audio.status().played,0);
 scene.tick=103;scene.effects=[hit(3,103)];audio.update(scene);assert.equal(audio.status().played,1);
});

test('pause and loss of focus stop voices, baseline background effects and resume only fresh sounds',async()=>{
 const {audio,context,scene}=await ready();scene.tick=101;scene.effects=[hit(1,101)];audio.update(scene);assert.equal(audio.status().activeVoices,1);
 scene.tick=102;scene.effects=[hit(2,102)];audio.update(scene,{paused:true});assert(context.sources[0].stopped);audio.update(scene);assert.equal(audio.status().played,1);
 scene.tick=103;scene.effects=[hit(3,103)];audio.update(scene);assert.equal(audio.status().played,2);
 scene.tick=104;scene.effects=[hit(4,104)];audio.update(scene,{active:false});assert.equal(audio.status().activeVoices,0);audio.update(scene);assert.equal(audio.status().played,2);
 scene.tick=105;scene.effects=[hit(5,105)];audio.update(scene);assert.equal(audio.status().played,3);
});

test('session changes, time rewind and old/future effects establish baselines without replay',async()=>{
 const {audio,scene}=await ready();scene.tick=101;scene.effects=[hit(1,101)];audio.update(scene);
 scene.sessionId='combat:two';scene.effects=[hit(1,101)];audio.update(scene);assert.equal(audio.status().played,1);assert.equal(audio.status().activeVoices,0);
 scene.tick=90;scene.effects=[hit(2,90)];audio.update(scene);assert.equal(audio.status().played,1);
 scene.tick=100;scene.effects=[hit(3,95),hit(4,101)];audio.update(scene);assert.equal(audio.status().played,1);
 scene.tick=101;audio.update(scene);assert.equal(audio.status().played,1);
});

test('charge cancellation stops its voice and a later independent Q has its own event identity',async()=>{
 const {audio,context,scene}=await ready();scene.tick=101;scene.player.motion={action:'ground-sword',phase:'windup',actionId:'q1',startedTick:101};audio.update(scene);assert.equal(audio.status().activeVoices,1);
 scene.player.motion={action:'dodge',phase:'release'};audio.update(scene);assert(context.sources[0].stopped);assert.equal(audio.status().activeVoices,0);
 scene.tick=102;scene.player.motion={action:'ground-sword',phase:'windup',actionId:'q2',startedTick:102};audio.update(scene);assert.equal(audio.status().cues.heavyCharge,2);
});

test('voice cap, zero volume, profile exit and disposal release sources without affecting old combat',async()=>{
 const {audio,context,scene}=await ready();scene.tick=101;scene.effects=Array.from({length:12},(_,i)=>hit(i+1,101));audio.update(scene);
 assert.equal(audio.status().activeVoices,8);assert.equal(context.sources.filter(source=>source.stopped).length,4);
 audio.setVolume(0);assert.equal(audio.status().activeVoices,0);scene.tick=102;scene.effects=[hit(15,102)];audio.update(scene);audio.setVolume(2);audio.update(scene);assert.equal(audio.status().played,12);assert.equal(audio.status().volume,1);
 scene.tick=103;scene.effects=[hit(16,103)];audio.update(scene);scene.rulesProfile=null;audio.update(scene);assert.equal(audio.status().activeVoices,0);
 audio.dispose();assert.equal(context.state,'closed');assert.equal(audio.status().disposed,true);assert.equal(await audio.unlock(),false);
});

test('unsupported WebAudio and malformed source bytes report technical failure without throwing into combat',async()=>{
 const unsupported=createSwordStudyAudio({AudioContextClass:null});assert.equal(unsupported.prepare(),false);assert.match(unsupported.status().error,/unavailable/);assert.equal(await unsupported.unlock(),false);
 const malformed=createSwordStudyAudio({createContext:()=>new AudioFixture(),assets:{}});assert.equal(malformed.prepare(),false);assert.match(malformed.status().error,/WAV/);
 const scene=base();malformed.update(scene);scene.tick++;scene.effects=[hit(1,scene.tick)];assert.doesNotThrow(()=>malformed.update(scene));assert.equal(malformed.status().played,0);
});

test('official multi-tick attack contact keeps one release sound after its projectile has been removed',async()=>{
 const SIM=await import('../../../src/simulation/ea-opening-sim.mjs'),{getCampaignScene}=await import('../../../src/simulation/ea-campaign.mjs');
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 const send=(name,...args)=>{state=SIM.dispatchCommand(state,{name,args}).state;};
 const until=(predicate,label)=>{for(let i=0;i<3500&&!predicate();i++)SIM.tick(state,.1);assert(predicate(),label);};
 send('masterAction','heal');send('chooseOpeningInheritance','jinfeng');until(()=>state.master.wound===0,'heal');
 send('srWorldCommand',{action:'exit',exitId:'exit:yunxiu-valley'});until(()=>!state.master.scenic.path.length,'gate');
 send('srWorldCommand',{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});until(()=>!state.srWorld.activeTravelId,'valley');
 send('srWorldCommand',{action:'move',x:21,y:36});until(()=>!state.srWorld.interaction,'approach');send('srWorldCommand',{action:'engage',objectId:'object:valley:shanxiao'});
 while(Math.hypot(state.combat.player.x-state.combat.enemies[0].x,state.combat.player.y-state.combat.enemies[0].y)>1){send('setSRCombatInput',{x:1,y:0});SIM.tick(state,.1);}send('setSRCombatInput',{x:0,y:0});
 const context=new AudioFixture(),audio=createSwordStudyAudio({createContext:()=>context});audio.prepare();await audio.unlock();audio.update(getCampaignScene(state));
 const foe=state.combat.enemies[0];send('combatAction','attack',{x:foe.x,y:foe.y-1.2/.5857646528643004});SIM.tick(state,.3);
 assert.equal(state.combat.projectiles.length,0);assert.equal(state.combat.effects.filter(effect=>effect.projectileRelease).length,1);
 assert.equal(state.combat.effects.filter(effect=>effect.projectileRelease&&effect.kind==='hit').length,0);
 audio.update(getCampaignScene(state));audio.update(getCampaignScene(state));assert.equal(audio.status().cues.swordRelease,1);assert.equal(audio.status().cues.lightHit,1);
});
