/** Short original PCM cues driven by the formal combat projection. */
import {SWORD_STUDY_AUDIO_DATA} from './courtyard-combat-sword-study-audio-data.mjs';

const PROFILE='sword-study-v1';
const CUES=['swordRelease','lightHit','heavyCharge','heavyImpact','dodge','enemySlam','playerHit','groundStrike'];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

/** Generated mono PCM16 WAVs are copied into WebAudio buffers synchronously.
 * Embedded source bytes make preparation independent of fetch/file protocols. */
function pcmBuffer(context,uri){
 if(typeof uri!=='string'||!uri.startsWith('data:audio/wav;base64,'))throw Error('Missing combat WAV');
 const raw=atob(uri.slice(uri.indexOf(',')+1)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
 const text=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));
 if(bytes.length<44||text(0,4)!=='RIFF'||text(8,4)!=='WAVE')throw Error('Invalid combat WAV');
 let format=null,data=null;
 for(let at=12;at+8<=bytes.length;){
  const id=text(at,4),size=view.getUint32(at+4,true),start=at+8;
  if(start+size>bytes.length)throw Error('Truncated combat WAV');
  if(id==='fmt '&&size>=16)format={type:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),bits:view.getUint16(start+14,true)};
  if(id==='data')data={start,size};at=start+size+(size%2);
 }
 if(!format||format.type!==1||format.channels!==1||format.bits!==16||format.rate<8000||!data||data.size%2)throw Error('Unsupported combat PCM');
 const count=data.size/2,buffer=context.createBuffer(1,count,format.rate),pcm=buffer.getChannelData(0);
 for(let i=0;i<count;i++)pcm[i]=view.getInt16(data.start+i*2,true)/32768;
 return buffer;
}

function projectedCues(scene){
 const result=[],effects=scene.effects||[],tick=scene.worldTick??scene.tick;
 const add=(key,cue,at,point)=>result.push({key,cue,tick:at,point});
 for(const shot of scene.projectiles||[])if(shot.kind==='sword-qi')add('shot:'+shot.id,'swordRelease',shot.launchedTick,shot.from);
 const motion=scene.player?.motion;
 if(motion?.action==='ground-sword'&&motion.phase==='windup')add('charge:'+motion.actionId,'heavyCharge',motion.startedTick,scene.player);
 for(const effect of effects){
  const key=effect.eventId??effect.id,at=effect.tick??tick,point=effect.contact||effect.to;
  if(effect.kind==='attack'&&effect.projectileRelease===true&&effect.sourceId==='master')add('shot:'+effect.projectileId,'swordRelease',at,effect.from);
  else if(effect.kind==='hit'&&effect.outcome==='hit'&&effect.amount>0){
   if(effect.targetId==='master')add('hit:'+key,'playerHit',at,point);
   else if(effect.sourceId==='master')add('hit:'+key,effect.groundSword||effect.reaction==='heavy'?'heavyImpact':'lightHit',at,point);
  }else if(effect.kind==='dodge'&&effect.sourceId==='master')add('dodge:'+key,'dodge',at,effect.to);
  else if(effect.kind==='impact'){
   if(!effect.groundSword)add('slam:'+key,'enemySlam',at,point);
   else if(!effects.some(hit=>hit.kind==='hit'&&hit.groundStrikeId===effect.groundStrikeId&&hit.amount>0))add('ground:'+key,'groundStrike',at,point);
  }
 }
 return result.sort((a,b)=>a.tick-b.tick);
}

export function createSwordStudyAudio({assets=SWORD_STUDY_AUDIO_DATA,volume=.35,muted=false,
 AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,createContext=null,maxVoices=8,maxAgeTicks=1.5}={}){
 let context=null,master=null,limiter=null,buffers=null,session=null,lastTick=null,wasActive=false,disposed=false,error=null,unlocked=false,played=0,dropped=0;
 volume=Number.isFinite(volume)?clamp(volume,0,1):.35;muted=!!muted;
 maxVoices=Number.isFinite(maxVoices)?clamp(Math.floor(maxVoices),1,8):8;
 maxAgeTicks=Number.isFinite(maxAgeTicks)?Math.max(0,maxAgeTicks):1.5;
 const voices=new Set(),seen=new Set(),order=[],recent=[],counts=Object.fromEntries(CUES.map(cue=>[cue,0]));
 const remember=key=>{if(seen.has(key))return;seen.add(key);order.push(key);if(order.length>256)seen.delete(order.shift());};
 function remove(voice){voices.delete(voice);try{voice.source.disconnect();voice.pan?.disconnect();}catch{/* Already detached. */}}
 function stop(voice){try{voice.source.stop();}catch{/* Already finished. */}remove(voice);}
 function stopAll(){for(const voice of [...voices])stop(voice);}
 function stopCharge(exceptAction=null){for(const voice of [...voices])if(voice.cue==='heavyCharge'&&voice.key!==exceptAction)stop(voice);}
 function status(){return {played,cues:{...counts},recentCues:recent.map(cue=>({...cue})),muted,volume,ready:!!buffers,unlocked:unlocked&&context?.state==='running',activeVoices:voices.size,sessionId:session,dropped,error,disposed};}
 function prepare(){
  if(disposed)return false;if(buffers)return true;
  try{
   if(!context){context=createContext?createContext():AudioContextClass?new AudioContextClass({latencyHint:'interactive'}):null;if(!context)throw Error('WebAudio unavailable');
    master=context.createGain();master.gain.value=muted?0:volume;limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-6;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.06;
    master.connect(limiter);limiter.connect(context.destination);
   }
   buffers=Object.fromEntries(CUES.map(cue=>[cue,pcmBuffer(context,assets[cue])]));error=null;return true;
  }catch(cause){buffers=null;error=String(cause?.message||cause);return false;}
 }
 /** Invoke directly in the gesture callback: resume starts before returning. */
 function unlock(){
  if(!prepare())return Promise.resolve(false);
  try{const resumed=context.state==='running'?Promise.resolve():context.resume();return Promise.resolve(resumed).then(()=>{unlocked=!disposed&&context.state==='running';return unlocked;}).catch(cause=>{error=String(cause?.message||cause);unlocked=false;return false;});}
  catch(cause){error=String(cause?.message||cause);unlocked=false;return Promise.resolve(false);}
 }
 function play(cue,scene){
  if(!buffers||!unlocked||context.state!=='running'||muted||volume<=0||disposed){dropped++;return;}
  try{
   while(voices.size>=maxVoices)stop(voices.values().next().value);
   const source=context.createBufferSource();source.buffer=buffers[cue.cue];const pan=context.createStereoPanner?.();
   if(pan){pan.pan.value=clamp(((cue.point?.x??scene.player?.x??0)-(scene.player?.x??0))/11,-.55,.55);source.connect(pan);pan.connect(master);}else source.connect(master);
   const voice={source,pan,cue:cue.cue,key:cue.key};voices.add(voice);source.onended=()=>remove(voice);source.start(context.currentTime);
   played++;counts[cue.cue]++;recent.push({cue:cue.cue,key:cue.key,tick:cue.tick,sessionId:session});if(recent.length>16)recent.shift();
  }catch(cause){error=String(cause?.message||cause);dropped++;}
 }
 function update(scene,{paused=false,active=true}={}){
  if(disposed)return status();
  if(!scene||scene.rulesProfile!==PROFILE){stopAll();session=null;lastTick=null;wasActive=false;seen.clear();order.length=0;return status();}
  const id=scene.sessionId||scene.encounterId||'combat',tick=scene.worldTick??scene.tick;
  if(!Number.isFinite(tick)){stopAll();error='Missing combat tick';return status();}
  const reset=session!==id||lastTick===null||tick<lastTick,live=!!active&&!paused,baseline=reset||!live||!wasActive;
  if(reset){stopAll();seen.clear();order.length=0;session=id;}
  if(!live)stopAll();
  const motion=scene.player?.motion,charge=motion?.action==='ground-sword'&&motion.phase==='windup'?'charge:'+motion.actionId:null;
  stopCharge(charge);
  for(const cue of projectedCues(scene)){
   const key=id+':'+cue.key;if(seen.has(key))continue;remember(key);
   if(baseline)continue;
   if(cue.tick>tick||tick-cue.tick>maxAgeTicks){dropped++;continue;}
   play(cue,scene);
  }
  lastTick=tick;wasActive=live;return status();
 }
 function gain(){if(disposed||!master)return;const at=context.currentTime;master.gain.cancelScheduledValues(at);master.gain.setTargetAtTime(muted?0:volume,at,.012);}
 function setMuted(value){muted=!!value;if(muted)stopAll();gain();return status();}
 function setVolume(value){if(Number.isFinite(value))volume=clamp(value,0,1);if(volume===0)stopAll();gain();return status();}
 function dispose(){stopAll();disposed=true;unlocked=false;try{context?.close()?.catch?.(()=>{});}catch{/* Already closed. */}}
 return {prepare,unlock,update,setMuted,setVolume,status,dispose};
}
