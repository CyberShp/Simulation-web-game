import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createCourtyardRoutePlanner} from '../../../apps/courtyard/courtyard-route-planner.mjs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repository=fileURLToPath(new URL('../../../',import.meta.url)),target=process.env.IMMORTAL_COMBAT_INPUT_ROOT||repository,rules=process.env.IMMORTAL_COMBAT_RULES_ROOT||repository;
const load=(root,file)=>import(pathToFileURL(path.join(root,file))),{createCombatAudio,synthesizeCombatCue}=await load(target,'apps/courtyard/courtyard-combat-audio.mjs');
const main=await fs.readFile(path.join(target,'apps/courtyard/courtyard-main.mjs'),'utf8'),controls=await fs.readFile(path.join(target,'apps/courtyard/courtyard-combat.mjs'),'utf8');
const body=(source,name,next)=>source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'('));
function device({broken=false}={}){
 const calls={construct:0,resume:0,buffers:[],starts:0,stops:0,closes:0};
 class Audio{
  constructor(){calls.construct++;this.state='suspended';this.sampleRate=8000;this.destination={};}
  createGain(){return {gain:{value:0},connect(){}};}
  createBuffer(channels,length,rate){if(broken)throw Error('device allocation failed');const pcm=new Float32Array(length);calls.buffers.push({channels,length,rate,pcm});return {getChannelData:()=>pcm};}
  createBufferSource(){return {connect(){},disconnect(){},start(){calls.starts++;},stop(){calls.stops++;}};}
  async resume(){calls.resume++;this.state='running';}
  async close(){calls.closes++;this.state='closed';}
 }
 return {Audio,calls};
}
const scene=(tick,effects=[])=>({sessionId:'prepared-audio',tick,visualTick:tick,effects});
const hit=tick=>({id:tick,eventId:'hit:'+tick,kind:'hit',tick,sourceId:'master',targetId:'enemy-1',amount:10,outcome:'hit',reaction:'light'});

test('prepare builds each unchanged cue once without resume, voices or sound',()=>{
 const {Audio,calls}=device(),audio=createCombatAudio({AudioContextClass:Audio});assert.equal(audio.prepare(),true);assert.equal(audio.prepare(),true);assert.equal(calls.construct,1);assert.equal(calls.resume,0);assert.equal(calls.starts,0);assert.equal(calls.buffers.length,9);
 const kinds=['swing','cast','bladeHit','spellHit','heavyHit','guard','evade','land','ward'];for(let i=0;i<kinds.length;i++)assert.deepEqual(calls.buffers[i].pcm,synthesizeCombatCue(kinds[i],8000));audio.dispose();assert.equal(calls.closes,1);
});
test('the first gesture only resumes prepared audio and the first contact reuses its PCM buffer',async()=>{
 const {Audio,calls}=device(),audio=createCombatAudio({AudioContextClass:Audio});audio.prepare();const buffers=calls.buffers.length;audio.update(scene(1));assert.equal(await audio.unlock(),true);assert.equal(await audio.unlock(),true);assert.equal(calls.construct,1);assert.equal(calls.resume,1);assert.equal(calls.starts,0);assert.equal(calls.buffers.length,buffers);
 const b=scene(2,[hit(2)]);audio.update(b);audio.update(b);assert.equal(calls.starts,1);assert.equal(calls.buffers.length,buffers);audio.update(b,{paused:true});assert.equal(calls.stops,1);audio.update(b);assert.equal(calls.starts,1);audio.dispose();assert.equal(await audio.unlock(),false);
});
test('unavailable audio and allocation failure preserve event consumption and later cleanup',async()=>{
 class Missing{constructor(){throw Error('no audio device');}}
 for(const Audio of [Missing,device({broken:true}).Audio]){const audio=createCombatAudio({AudioContextClass:Audio});assert.equal(audio.prepare(),false);assert.equal(await audio.unlock(),false);audio.update(scene(1));assert.equal(audio.update(scene(2,[hit(2)])).length,1);assert.deepEqual(audio.update(scene(2,[hit(2)])),[]);audio.dispose();}
});
test('the actual combat loader prepares audio before asset work and continues if audio is unavailable',async()=>{
 const begin=controls.indexOf('async load(){'),end=controls.indexOf('\n  dispose(){',begin);assert(begin>0&&end>begin);const method=controls.slice(begin,end).replace(/,\s*$/,'');
 for(const available of [true,false]){const calls=[],context={combatAudio:{prepare(){calls.push('prepare');return available;}},studyAudio:{prepare(){calls.push('study-prepare');return available;}},loadSwordStudyImages:async()=>({}),loadSwordStudyGround:async()=>({}),COMBAT_BACKDROPS:{forest:{id:'forest',image:'forest.png'}},loadImage:async()=>{calls.push('image');return {};},loadJson(){},loadCombatActorAssets:async()=>({issues:[]}),createCombatActorRenderer:()=>({async prewarm(){calls.push('prewarm');},presentation(){}}),createCombatEffectsRenderer:()=>({}),ctx:{},worldToScreen(){},transform:{},coordinates(){},announce(){},images:null,actorRenderer:null,effectRenderer:null};const load=vm.runInNewContext('({'+method+'}).load',context);await load();assert.deepEqual(calls.slice(0,2),['prepare','study-prepare']);assert(calls.includes('image'));assert(calls.includes('prewarm'));assert(context.images.backgrounds.forest);}
});

function host(session,ownedCommand,view,update){
 const calls=[],announcements=[],context={approachPlanner:createCourtyardRoutePlanner(),session,view,ownedCommand,closing:false,importing:false,suspended:false,needsFullView:()=>false,persistence:{status:()=>({protected:false})},route:[1],activeWaypoint:1,destination:1,renderer:{target:1},pendingApproach:1,ui(){calls.push({ui:true});},canInteract:()=>true,announce:text=>announcements.push(text)};
 context.refresh=options=>{calls.push({refresh:options||{}});return context.view=update(options);};vm.runInNewContext(body(main,'issue','pauseReasons')+body(main,'manageCommand','moveArt'),context);context.command=context.manageCommand;vm.runInNewContext(body(controls,'send','world'),context);return {context,calls,announcements,send:request=>context.send(request)};
}
test('failed commands still use complete views outside the visible battle-only boundary',()=>{
 const full={domain:{}},view=()=>({opening:{stage:'complete'},expedition:{scene:{type:'combat'}}});
 for(const change of [c=>{c.needsFullView=()=>true;},c=>{c.suspended=true;},c=>{c.closing=true;},c=>{c.importing=true;},c=>{c.persistence.status=()=>({protected:true});},c=>{c.session.state.combat=null;},c=>{c.session.state.combat.status='won';},c=>{c.view.expedition.scene.type='world';},c=>{c.view.opening.stage='intro';}]){const s={state:{combat:{status:'active'}}},result={ok:false,error:'实际拒绝'},h=host(s,()=>result,view(),()=>full);change(h.context);assert.equal(h.send({type:'combat',actionId:'spell'}).ok,false);assert.deepEqual(h.calls.find(c=>c.refresh)?.refresh,{});assert.equal(h.context.view,full);assert.equal(h.announcements.length,1);}
 // Pause remains a lightweight visible combat read; its speed/body facts come
 // from the same current session rather than a reused earlier projection.
 const s={state:{combat:{status:'active'}}},light=view(),h=host(s,()=>({ok:true}),view(),()=>light);assert(h.send({type:'pause',paused:true}).ok);assert.equal(h.calls[0].refresh.automatic,true);assert.equal(h.calls[0].refresh.force,true);
});

const SIM=await load(rules,'src/simulation/ea-opening-sim.mjs'),{valleyEncounterDefinition}=await load(rules,'src/simulation/ea-campaign.mjs'),{createSectSession,createSectCommandDriver,commandSect,advanceSect,snapshotSect,restoreSect,viewSect,viewSectCombat,createSectViewRefresh}=await load(rules,'apps/courtyard/sect-sim.mjs');
function publicBattle(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:createHash('sha256').update(JSON.stringify(state)).digest('hex')}}}),send=q=>{const result=commandSect(s,q);assert.equal(result.ok,true,result.error);},until=(predicate,label)=>{for(let i=0;i<3500&&!predicate(s.state);i++)advanceSect(s,.1);assert(predicate(s.state),label);};
 send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});until(v=>!v.master.scenic.path.length,'gate');send({type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}}});until(v=>!v.srWorld.activeTravelId,'travel');send({type:'world',action:{action:'move',...valleyEncounterDefinition().approach}});until(v=>!v.srWorld.interaction,'approach');send({type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});return snapshotSect(s);
}
test('actual successful and refused public skills retain identical state/results/errors while both refresh a fresh combat view',()=>{
 const source=publicBattle();for(const actionId of ['attack','spell','guard','dodge']){
  const s=restoreSect(source),reference=restoreSect(source),raw=createSectCommandDriver(()=>reference),update=createSectViewRefresh(()=>s),h=host(s,createSectCommandDriver(()=>s),viewSectCombat(s),update),p=s.state.combat.player,request={type:'combat',actionId,...(actionId==='guard'?{}:{target:{x:p.x+1,y:p.y}})};let refused=false;
  for(let i=0;i<4;i++){const prior=h.context.view,before=structuredClone(s.state),expected=raw(request),actual=h.send(request);assert.deepEqual(actual,expected);assert.deepEqual(s.state,reference.state);assert.notEqual(h.context.view,prior);assert.equal(h.context.view.domain,undefined,'same-tick command uses combat projection');assert.equal(h.calls.filter(c=>c.refresh).at(-1).refresh.force,true);assert.deepEqual(h.context.view.expedition,viewSect(reference).expedition);if(!actual.ok){assert.deepEqual(s.state,before);assert.equal(h.announcements.at(-1),expected.error);refused=true;break;}}
  assert(refused,'a repeated real skill must reach its actual busy/buffer refusal: '+actionId);
 }
});
