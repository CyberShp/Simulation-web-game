/** Original short synthesis cues; playback consumes formal events without changing them. */
import {usesCombatCamera} from './courtyard-combat-camera.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
const lengths={swing:.12,cast:.18,bladeHit:.15,spellHit:.2,heavyHit:.22,guard:.24,evade:.13,land:.2,ward:.22};
const hash=value=>{let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};

/** Offline-capable deterministic mono PCM. Nothing is downloaded or sampled. */
export function synthesizeCombatCue(kind,sampleRate=22050){
 if(!Object.hasOwn(lengths,kind))throw Error('Unknown combat cue: '+kind);
 const duration=lengths[kind],pcm=new Float32Array(Math.ceil(duration*sampleRate));
 let seed=hash(kind),low=0,previousLow=0,phase=0;
 for(let i=0;i<pcm.length;i++){
  const t=i/sampleRate,u=t/duration;
  seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
  const white=(seed>>>0)/2147483648-1;
  low+=.12*(white-low);const air=low-previousLow;previousLow=low;
  const attack=clamp(t/.003,0,1),tail=clamp((duration-t)/.018,0,1);
  let v=0;
  if(kind==='swing'||kind==='evade'){
   const bell=Math.sin(Math.PI*u)**1.4;
   v=(air*2.8+low*.28)*bell*(kind==='swing'?.7:.46);
  }else if(kind==='cast'){
   phase+=TAU*(490-270*u)/sampleRate;
   v=(Math.sin(phase)*.14+Math.sin(phase*2.03)*.045+air*1.5)*Math.sin(Math.PI*u)**.8;
  }else if(kind==='guard'||kind==='ward'){
   const base=kind==='guard'?1060:640;
   v=(Math.sin(TAU*base*t)*.16+Math.sin(TAU*base*1.48*t)*.075+Math.sin(TAU*base*2.17*t)*.025)*Math.exp(-t*20);
   v+=air*.7*Math.exp(-t*75);
  }else{
   const heavy=kind==='heavyHit'||kind==='land',spell=kind==='spellHit';
   phase+=TAU*((heavy?135:spell?270:190)-(heavy?80:spell?170:115)*u)/sampleRate;
   const body=Math.sin(phase)*(heavy?.48:.25)*Math.exp(-t*(heavy?20:32));
   const crack=(white*.36+air*1.1)*Math.exp(-t*(spell?45:85));
   const breath=low*(spell?.6:.25)*Math.exp(-t*25);
   v=body+crack+breath;
  }
  pcm[i]=clamp(v*attack*tail*.65,-.7,.7);
 }
 pcm[pcm.length-1]=0;
 return pcm;
}

function cuesFor(scene){
 const effects=scene.effects||[],cues=[];
 const center=usesCombatCamera(scene)?scene.camera?.center?.x??scene.player?.x??0:6,span=usesCombatCamera(scene)?(scene.camera?.viewMetres||22)/2:9;
 const add=(key,kind,tick,point,feedbackAgeMs)=>cues.push({key,kind,tick,pan:clamp(((point?.x??center)-center)/span,-.55,.55),...(Number.isFinite(feedbackAgeMs)?{feedbackAgeMs}:{})});
 for(const f of effects){
  const id=f.eventId??f.id,key=String(id),tick=f.tick??scene.tick;
  if(f.kind==='attack')add('swing:'+f.sourceId+':'+tick,'swing',tick,f.from);
  else if(f.kind==='hit'){
   const spellProjectile=f.projectileId!=null&&f.projectileKind!=='sword-qi';
   const kind=f.outcome==='evaded'?'evade':f.outcome==='guarded'?'guard':f.amount>0?(spellProjectile?'spellHit':f.reaction==='heavy'||f.reaction==='down'?'heavyHit':'bladeHit'):null;
   if(kind)add('hit:'+key,kind,tick,f.contact||f.to,f.feedbackAgeMs);
  }else if(f.kind==='impact'&&!effects.some(h=>h.kind==='hit'&&h.sourceId===f.sourceId&&h.tick===f.tick))add('ground:'+key,'land',tick,f.contact||f.to);
  else if(f.kind==='dodge')add('dodge:'+key,'evade',tick,f.to);
  else if(f.kind==='guard')add('ward:'+key,'ward',tick,f.from);
 }
 for(const shot of scene.projectiles||[])add(shot.kind==='sword-qi'?'swing:'+shot.sourceId+':'+shot.launchedTick:'launch:'+shot.id,shot.kind==='sword-qi'?'swing':'cast',shot.launchedTick,shot.from);
 return cues.sort((a,b)=>a.tick-b.tick);
}

/** A session baseline prevents restored, paused and background events from replaying. */
export function createCombatSoundEvents(){
 let session=null,lastTick=null,wasActive=false;const seen=new Set(),order=[];
 const remember=key=>{if(seen.has(key))return;seen.add(key);order.push(key);if(order.length>192)seen.delete(order.shift());};
 function update(scene,{paused=false,active=true}={}){
  if(!scene){session=null;lastTick=null;wasActive=false;seen.clear();order.length=0;return [];}
  const id=scene.sessionId||scene.encounterId||'combat',tick=scene.worldTick??scene.tick,visualTick=scene.visualTick??scene.tick;
  const reset=id!==session||lastTick===null||tick<lastTick;
  if(reset){session=id;seen.clear();order.length=0;}
  const live=!!active&&!paused,baseline=reset||!live||!wasActive,cues=cuesFor(scene),ready=[];
  for(const cue of cues){
   if(seen.has(cue.key))continue;
   if(baseline){remember(cue.key);continue;}
   if(cue.tick>visualTick)continue;
   remember(cue.key);
   // Presentation can admit one newly seen damaging hit after a short render gap.
   // Old swings and other stale cues retain their original cutoff and voice cap.
   const firstSeen=cue.feedbackAgeMs>=0&&cue.feedbackAgeMs<90&&tick-cue.tick<=5;
   if(visualTick-cue.tick<=1.5||firstSeen)ready.push(cue);
  }
  lastTick=tick;wasActive=live;
  return ready.slice(-4);
 }
 return {update};
}

export function createCombatAudio({AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,volume=.3}={}){
 const events=createCombatSoundEvents(),buffers=new Map(),voices=new Set();
 let context=null,master=null,failed=false,disposed=false;
 function stopVoices(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 function cueBuffer(kind){
  let buffer=buffers.get(kind);
  if(!buffer){const pcm=synthesizeCombatCue(kind,context.sampleRate);buffer=context.createBuffer(1,pcm.length,context.sampleRate);buffer.getChannelData(0).set(pcm);buffers.set(kind,buffer);}
  return buffer;
 }
 /** Prepare synchronously while the loading screen still owns the main thread.
  * A suspended context may allocate buffers; only a user gesture resumes it. */
 function prepare(){
  if(failed||disposed||!AudioContextClass)return false;
  try{
   if(!context){context=new AudioContextClass({latencyHint:'interactive'});master=context.createGain();master.gain.value=clamp(volume,0,.5);master.connect(context.destination);}
   for(const kind of Object.keys(lengths))cueBuffer(kind);
   return true;
  }catch{failed=true;return false;}
 }
 async function unlock(){
  if(failed||disposed||!AudioContextClass)return false;
  try{
   if(!context&&!prepare())return false;
   if(context.state==='suspended')await context.resume();return context.state==='running';
  }catch{failed=true;return false;}
 }
 function play(cue){
  if(failed||disposed||context?.state!=='running')return;
  try{
   const buffer=cueBuffer(cue.kind);
   const voice=context.createBufferSource();voice.buffer=buffer;
   const pan=context.createStereoPanner?.();if(pan){pan.pan.value=cue.pan;voice.connect(pan);pan.connect(master);}else voice.connect(master);
   voices.add(voice);voice.onended=()=>{voices.delete(voice);voice.disconnect();pan?.disconnect();};voice.start();
  }catch{failed=true;stopVoices();}
 }
 function update(scene,options={}){
  const ready=events.update(scene,options);
  if(!scene||options.paused||options.active===false)stopVoices();
  for(const cue of ready)play(cue);
  return ready;
 }
 function dispose(){disposed=true;stopVoices();buffers.clear();if(context){try{const closing=context.close();closing?.catch?.(()=>{});}catch{}}context=null;}
 return {prepare,unlock,update,dispose};
}
