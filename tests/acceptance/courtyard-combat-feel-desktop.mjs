/** Visible source Electron acceptance for the forest combat feel sample.
 * --source=/absolute/public-command-native.json --output=/absolute/fresh-directory
 * --stage=preflight validates the paused source without launching Electron.
 * --scenario=hand-repair records the short hand / contact regression.
 * --include-buffer appends the native short-input checks to hand-repair.
 * --no-video keeps native screenshots and state observation without recording.
 * Inputs use native keyboard / mouse / buttons; observation never edits the world.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=option('source'),output=option('output'),scenario=option('scenario')||'all',preflight=option('stage')==='preflight';
const includeBuffer=process.argv.includes('--include-buffer');
const recordingEnabled=!process.argv.includes('--no-video');
assert(['all','focused','buffer','hand-repair'].includes(scenario),'unknown scenario');
assert(source&&path.isAbsolute(source),'absolute --source required');assert(output&&path.isAbsolute(output),'absolute --output required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'external QA directory required');
const json=x=>JSON.stringify(x,null,2)+'\n',hash=x=>createHash('sha256').update(x).digest('hex');
const sourceBytes=await fs.readFile(source),original=JSON.parse(sourceBytes),restored=restoreSect(original);
assert.equal(validateSect(restored),true);assert.deepEqual(restored.state,original.state);assert.equal(original.state.speed,0,'paused source required');assert.equal(original.state.combat.status,'active');
await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));await fs.writeFile(path.join(output,'source.json'),sourceBytes);
if(preflight){await fs.writeFile(path.join(output,'report.json'),json({status:'preflight',source,sourceSha256:hash(sourceBytes),tick:original.state.worldTick,scenario,includeBuffer,scope:'read-only paused native combat source; Electron not launched'}));console.log('Preflight passed');process.exit(0);}
const directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');await fs.mkdir(directory);await fs.writeFile(native,sourceBytes);
async function filesUnder(relative){return(await Promise.all((await fs.readdir(path.join(repositoryRoot,relative),{withFileTypes:true})).map(e=>e.isDirectory()?filesUnder(relative+'/'+e.name):relative+'/'+e.name))).flat();}
const runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeBefore=await hashes(),target=desktopTarget(),checks=[],actions=[],errors=[],finalizationErrors=[];
const started=performance.now(),wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let electron,page,gameWindowId,phase='launch',complete=false,lastTick=original.state.worldTick,trace=null,video=null,viewport=null;
const record=(name,details={})=>{checks.push({name,ok:true,wallSeconds:wall(),...details});console.log('PASS '+name);};
const point=p=>({x:p.x,y:p.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const read=()=>page.evaluate(()=>{const q=window.courtyardQA,s=q.snapshot().state,v=q.renderer.view;return {tick:s.worldTick,state:s,scene:v.expedition.scene,combat:v.expedition.combat,presentation:q.expedition.presentationState(),input:q.expedition.inputState(),status:q.status(),errors:q.metrics().errors,audio:window.__feelQA.audio};});
const ready=(r,id)=>!r.state.srCombat.pending&&!r.state.srCombat.buffered&&r.combat.manualActions.some(a=>a.id===id&&!a.disabled&&!a.bufferable);
async function focusNativeInput(){
 const before=await read();
 await electron.evaluate(({app,BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);app.focus({steal:true});w.focus();w.webContents.focus();},gameWindowId);
 await page.locator('#expedition-canvas').focus();
 try{await page.waitForFunction(()=>{const i=window.courtyardQA.expedition.inputState();return document.hasFocus()&&i.hostActive&&i.active;},null,{timeout:1200});}
 finally{const after=await read(),native=await electron.evaluate(({BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);return {focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized()};},gameWindowId);actions.push({kind:'native-focus-readback',wallSeconds:wall(),native,input:after.input});await saveEvidence('native-focus-'+actions.length,{before,after,native});assert(native.focused&&after.input.hostActive&&after.input.active,'native focus did not enable the formal input gate');}
}
async function inputReady(){assert(await page.evaluate(()=>{const i=window.courtyardQA.expedition.inputState();return document.hasFocus()&&i.hostActive&&i.active;}),'native input gate became inactive before key input');}
async function pause(value){if((await page.evaluate(()=>window.courtyardQA.status().manualPause))!==value)await page.locator('#pause').click();assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),value);if(!value)await focusNativeInput();}
async function until(predicate,label,ms=10000){const at=performance.now();while(performance.now()-at<ms){const r=await read();lastTick=r.tick;assert.deepEqual(r.errors,[]);if(predicate(r))return r;assert.equal(r.scene.status,'active','combat ended while waiting for '+label);await sleep(12);}throw Error('Timed out '+label+' at tick '+lastTick);}
async function aim(p){const xy=await page.evaluate(p=>window.courtyardQA.expedition.worldToScreen(p.x,p.y),p),box=await page.locator('#expedition-canvas').boundingBox();await page.mouse.move(box.x+xy.x,box.y+xy.y);}
async function press(key){await inputReady();await page.keyboard.press(key);actions.push({kind:'press',key,wallSeconds:wall()});}
async function hold(key){await inputReady();await page.keyboard.down(key);actions.push({kind:'down',key,wallSeconds:wall()});}
async function release(key){await page.keyboard.up(key);actions.push({kind:'up',key,wallSeconds:wall()});}
async function label(value){phase=value;await page.evaluate(value=>window.__feelQA.phase=value,value);}
async function capture(name){await page.locator('#expedition-canvas').screenshot({path:path.join(output,name+'.png')});const r=await read();await fs.writeFile(path.join(output,name+'.json'),json(r));return r;}
async function settledReady(id){return until(r=>ready(r,id),id+' immediately ready',12000);}
const observationMark=()=>page.evaluate(()=>window.__feelQA.commandObservations.length);
const observationsSince=mark=>page.evaluate(mark=>window.__feelQA.commandObservations.slice(mark),mark);
async function saveEvidence(name,evidence){await fs.writeFile(path.join(output,name+'.json'),json(evidence));}
function classifyBufferReset(queued,cleared,pendingId){
 if(!queued||!cleared)return 'missing-post-handler-observation';
 if(queued.buffered?.action!=='spell'||queued.pending?.id!==pendingId)return 'not-buffered';
 if(cleared.pending?.id!==pendingId)return 'consumed-or-interrupted-before-reset';
 if(cleared.tick>queued.buffered.expiresTick)return 'expired-before-reset';
 if(cleared.buffered)return 'retained-after-reset';
 return 'cleared-before-consumption';
}
async function sourceLaunch(){
 const {_electron}=await import('playwright'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();gameWindowId=await(await electron.browserWindow(page)).evaluate(w=>w.id);
 page.on('pageerror',e=>errors.push(e.stack||String(e)));page.setDefaultTimeout(10000);
 await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});
 await page.addInitScript(()=>{
  const qa=window.__feelQA={enabled:false,phase:'setup',frames:[],inputs:[],focus:[],commandObservations:[],captures:[],handCaptures:[],handCase:null,flightCaptures:[],captureProjectile:false,audio:{contexts:[],starts:[],stops:[]}};
  const snap=()=>{const q=window.courtyardQA,v=q?.renderer.view,world=v?.expedition?.scene,shown=q?.expedition.presentationState?.();return {world,shown:shown?.scene,cache:shown?.cache,combat:v?.expedition?.combat,input:q?.expedition.inputState?.()};};
  const originalRAF=requestAnimationFrame.bind(window);let last=null;
  window.requestAnimationFrame=callback=>originalRAF(at=>{const before=performance.now();callback(at);const end=performance.now();if(!qa.enabled||callback.name!=='frame')return;const s=snap();if(!s.shown)return;
   const simplify=a=>({id:a.id,x:a.x,y:a.y,hp:a.hp,qi:a.qi,motion:a.motion,poseTick:a.poseTick});
   const frame={at,end,dt:last===null?null:at-last,drawJsMs:end-before,phase:qa.phase,focus:document.hasFocus(),visibility:document.visibilityState,worldTick:s.world.tick,visualTick:s.shown.visualTick,worldPlayer:simplify(s.world.player),shownPlayer:simplify(s.shown.player),worldEnemies:s.world.enemies.map(simplify),shownEnemies:s.shown.enemies.map(simplify),projectiles:s.shown.projectiles,effects:s.shown.effects,pending:s.combat.pending,buffered:s.combat.buffered,cache:s.cache,input:s.input,audioVoiceStarts:qa.audio.starts.length};qa.frames.push(frame);last=at;
   if(qa.captureProjectile&&frame.projectiles.length&&qa.flightCaptures.at(-1)?.worldTick!==frame.worldTick&&qa.flightCaptures.length<8)qa.flightCaptures.push({worldTick:frame.worldTick,visualTick:frame.visualTick,projectiles:frame.projectiles,canvas:window.courtyardQA.expedition.canvas.toDataURL()});
   const freshHit=frame.effects.find(e=>e.kind==='hit'&&e.tick===frame.worldTick&&e.amount>0),captureKind=freshHit?'contact-'+freshHit.targetId:frame.shownPlayer.motion?.phase==='release'?'release-'+frame.shownPlayer.motion.action:null;
   if(captureKind&&!qa.captures.some(c=>c.kind===captureKind)&&qa.captures.length<6)qa.captures.push({kind:captureKind,tick:frame.worldTick,visualTick:frame.visualTick,event:freshHit||null,canvas:window.courtyardQA.expedition.canvas.toDataURL()});
   const handCase=qa.handCase,motion=frame.shownPlayer.motion,caseFrames=qa.handCaptures.filter(c=>c.caseName===handCase?.name);
   if(handCase&&motion.action===handCase.action&&['windup','release','recovery'].includes(motion.phase)&&caseFrames.length<8&&!caseFrames.some(c=>c.tick===frame.worldTick&&c.motion.phase===motion.phase))qa.handCaptures.push({caseName:handCase.name,kind:'hand-'+handCase.name+'-'+motion.phase+'-'+frame.worldTick,tick:frame.worldTick,visualTick:frame.visualTick,poseTick:frame.shownPlayer.poseTick,at:end,motion:structuredClone(motion),worldPlayer:frame.worldPlayer,shownPlayer:frame.shownPlayer,shownEnemies:frame.shownEnemies,projectiles:frame.projectiles,effects:frame.effects,canvas:window.courtyardQA.expedition.canvas.toDataURL()});
   for(const input of qa.inputs){if(input.firstDrawAt!==undefined||input.phase!==qa.phase)continue;const moving=/^Key[WASD]$/.test(input.code);const changed=moving?Math.hypot(frame.shownPlayer.x-input.before.x,frame.shownPlayer.y-input.before.y)>.0001:frame.shownPlayer.motion?.phase!==input.before.motion?.phase||frame.pending?.id!==input.before.pending;
    if(changed){input.firstDrawAt=end;input.delayMs=end-input.at;input.after={x:frame.shownPlayer.x,y:frame.shownPlayer.y,worldTick:frame.worldTick,visualTick:frame.visualTick,motion:frame.shownPlayer.motion,pending:frame.pending?.id};}}
  });
  // Capture observes input before the application's handlers. The matching
  // after-handler listener is registered only once the application is ready.
  for(const kind of ['keydown','keyup'])addEventListener(kind,event=>{if(!qa.enabled||event.repeat)return;const s=snap();if(!s.shown)return;const eventId=qa.inputs.length+1;event.__feelInputEventId=eventId;qa.inputs.push({eventId,kind,code:event.code,at:performance.now(),phase:qa.phase,before:{x:s.shown.player.x,y:s.shown.player.y,motion:s.shown.player.motion,pending:s.combat.pending?.id},beforeSnapshot:window.courtyardQA.snapshot(),worldTick:s.world.tick,focus:document.hasFocus()});},true);
  for(const kind of ['blur','focus'])addEventListener(kind,()=>qa.focus.push({kind,at:performance.now(),phase:qa.phase}));
  const Native=window.AudioContext||window.webkitAudioContext;
  const nativeConnect=AudioNode.prototype.connect,tapped=new WeakSet();AudioNode.prototype.connect=function(...args){const result=nativeConnect.apply(this,args),context=this.context;if(args[0]===context.destination&&context.__feelRecordingDestination&&!tapped.has(this)){nativeConnect.call(this,context.__feelRecordingDestination);tapped.add(this);}return result;};
  if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);this.__feelRecordingDestination=this.createMediaStreamDestination();qa.audio.contexts.push(this);}createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source);source.start=(...args)=>{qa.audio.starts.push({at:performance.now(),phase:qa.phase,contextState:this.state,worldTick:window.courtyardQA?.renderer.view.tick,duration:source.buffer?.duration});return start(...args);};source.stop=(...args)=>{qa.audio.stops.push({at:performance.now(),phase:qa.phase});return stop(...args);};return source;}};
 });
 await page.reload();await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});
 await page.evaluate(()=>{
  // Window listeners run in registration order. Main's synchronous bubble
  // handlers are already installed, so this reads their committed result.
  const qa=window.__feelQA;
  for(const kind of ['keydown','keyup','blur'])addEventListener(kind,event=>{
   if(!qa.enabled||event.repeat)return;
   const q=window.courtyardQA,state=q.snapshot(),v=q.renderer.view;
   qa.commandObservations.push({eventId:event.__feelInputEventId??null,kind,code:event.code??null,at:performance.now(),phase:qa.phase,stage:'after-main-bubble',tick:state.state.worldTick,pending:structuredClone(v.expedition.combat.pending),buffered:structuredClone(v.expedition.combat.buffered),input:q.expedition.inputState(),status:q.status(),snapshot:state});
  });
 });
 await electron.evaluate(({app,BrowserWindow},id)=>{const w=BrowserWindow.fromId(id);w.setContentSize(1672,941);app.focus({steal:true});w.focus();},gameWindowId);
 await page.locator('#expedition-canvas').focus();await page.waitForFunction(()=>window.courtyardQA.expedition.presentationState?.().scene?.type==='combat');
 viewport=await page.evaluate(()=>{const q=window.courtyardQA,c=q.expedition.canvas,a=q.expedition.worldToScreen(0,0),b=q.expedition.worldToScreen(.33,.33);return {window:{width:innerWidth,height:innerHeight},canvas:{width:c.clientWidth,height:c.clientHeight,backingWidth:c.width,backingHeight:c.height},devicePixelRatio,screenStep033m:{x:b.x-a.x,y:b.y-a.y},focused:document.hasFocus(),visibility:document.visibilityState};});
 const loaded=await read(),loadedComparable=structuredClone(loaded.state),initialTransientInputReset=!original.state.combat.controls&&!!loadedComparable.combat.controls;
 if(initialTransientInputReset){assert.deepEqual(loadedComparable.combat.controls,{autoAttack:false,move:{x:0,y:0},moveUntilTick:original.state.worldTick+5});delete loadedComparable.combat.controls;}assert.deepEqual(loadedComparable,original.state);assert.equal(loaded.scene.presentation,'independent-arena');
 await page.locator('#expedition-canvas').click({position:{x:700,y:350}});await page.waitForFunction(()=>window.__feelQA.audio.contexts.some(c=>c.state==='running'));
 record('isolated public-command source world and initial input reset',{source,tick:loaded.tick,sourceSha256:hash(sourceBytes),initialTransientInputReset,loadedControls:loaded.state.combat.controls??null});
}
async function startVideo(){
 if(!recordingEnabled){video={status:'disabled',reason:'--no-video'};return;}
 video=await page.evaluate(()=>{const canvas=window.courtyardQA.expedition.canvas,stream=canvas.captureStream(30);for(const context of window.__feelQA.audio.contexts)for(const track of context.__feelRecordingDestination?.stream.getAudioTracks()||[])stream.addTrack(track);const chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2200000});window.__feelVideo={recorder,stream,chunks};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const startedAt=performance.now();window.__feelQA.videoTiming={startedAt};recorder.start(500);return {mimeType:recorder.mimeType,startedAt,requestedCaptureFramesPerSecond:30,canvasWidth:canvas.width,canvasHeight:canvas.height,audioRecorded:stream.getAudioTracks().length>0,audioTrackCount:stream.getAudioTracks().length};});
}
async function stopVideo(){if(!recordingEnabled||!video||video.saved)return;const b64=await page.evaluate(async()=>{const v=window.__feelVideo;if(v.recorder.state!=='inactive'){await new Promise(resolve=>{v.recorder.addEventListener('stop',resolve,{once:true});v.recorder.stop();});}window.__feelQA.videoTiming.stoppedAt=performance.now();v.stream.getTracks().forEach(t=>t.stop());const buffer=await new Blob(v.chunks,{type:v.recorder.mimeType}).arrayBuffer();let text='';for(const byte of new Uint8Array(buffer))text+=String.fromCharCode(byte);return btoa(text);});await fs.writeFile(path.join(output,'combat-feel-sample.webm'),Buffer.from(b64,'base64'));video.saved=true;video.audioDecode=await page.evaluate(async()=>{try{const v=window.__feelVideo,bytes=await new Blob(v.chunks,{type:v.recorder.mimeType}).arrayBuffer(),context=window.__feelQA.audio.contexts[0],decoded=await context.decodeAudioData(bytes);let sum=0,peak=0,n=0;for(let channel=0;channel<decoded.numberOfChannels;channel++)for(const value of decoded.getChannelData(channel)){sum+=value*value;peak=Math.max(peak,Math.abs(value));n++;}return {status:'decoded',decodedPcmDurationSeconds:decoded.duration,durationScope:'decoded PCM length; demux packet timestamps determine recording coverage',sampleRate:decoded.sampleRate,channels:decoded.numberOfChannels,peak,rms:Math.sqrt(sum/n)};}catch(e){return {status:'unverified',error:String(e)};}});}
async function continuous(){
 await label('continuous');await page.evaluate(()=>window.__feelQA.enabled=true);await startVideo();await pause(false);
 const continuousStart=performance.now();
 for(let i=0;i<24;i++){
  const key=['a','d','a','d','w','s','w','s'][i%8];await hold(key);let r=await read();await aim(point(r.scene.enemies[0]));
  if(i===1){
   await aim({x:11,y:1});await press('2');const queued=await until(r=>r.state.srCombat.pending?.action==='spell','held spell queued');const spellId=queued.state.srCombat.pending.id,from=point(queued.scene.player);const released=await until(r=>r.state.srCombat.pending?.id===spellId&&r.state.srCombat.pending.executed,'held spell real release');
   assert.equal(released.state.srCombat.pending.failure,undefined);assert(distance(from,released.scene.player)<1e-7);assert(released.scene.projectiles.some(p=>p.actionId===spellId));
   const restored=await until(r=>r.tick>released.tick&&distance(r.scene.player,from)>.1,'held movement after spell release');assert(restored.tick<=released.tick+2);
   record('held WASD spell stops then releases and restores movement',{spellId,from,releaseTick:released.tick,resumeTick:restored.tick,to:point(restored.scene.player)});
   const qi=restored.scene.player.qi,cooldown=restored.state.srCombat.cooldowns.spell,shotIds=restored.scene.projectiles.map(p=>p.id);assert(shotIds.length,'live projectile needed for retained-flight proof');await aim({x:2,y:2});await press('Space');
   const dodge=await until(r=>r.state.srCombat.pending?.action==='dodge','Space replaces released spell recovery');assert.equal(dodge.state.srCombat.cooldowns.spell,cooldown);assert(shotIds.every(id=>dodge.scene.projectiles.some(p=>p.id===id)),'released projectile retained');assert(dodge.scene.player.qi>=qi-.01,'request itself pays nothing');
   await until(r=>r.state.srCombat.pending?.action==='dodge'&&r.state.srCombat.pending.executed,'spell follow-up dodge release');record('released spell accepts Space and retains projectile cost and cooldown',{spellId,cooldown,shotIds});
  }else if(i===9){
   await press('1');const attack=await until(r=>r.state.srCombat.pending?.action==='attack'&&r.state.srCombat.pending.executed,'attack real release');const old=attack.state.srCombat.pending.id,cooldown=attack.state.srCombat.cooldowns.attack;await aim({x:2,y:6});await press('Space');const dodge=await until(r=>r.state.srCombat.pending?.action==='dodge','Space replaces released attack recovery');assert.equal(dodge.state.srCombat.cooldowns.attack,cooldown);record('released normal attack accepts immediate Space',{attackId:old,attackReleaseTick:attack.tick,dodgeRequestTick:dodge.tick});
  }else if(i===17)await press('3');
  await sleep(650);await release(key);await sleep(85);
 }
 const elapsed=performance.now()-continuousStart;if(elapsed<20000)await sleep(20000-elapsed);
 let nearby=await until(r=>ready(r,'attack')&&distance(r.scene.player,r.scene.enemies[0])<=1.8&&(r.scene.enemies[0].staggerImmuneUntilTick||0)<=r.tick,'ordinary enemy approach for real sword contact',8000);await aim(point(nearby.scene.enemies[0]));const contactStart=nearby.tick;await press('1');
 const contacted=await until(r=>r.scene.effects.some(e=>e.kind==='hit'&&e.sourceId==='master'&&!e.projectileId&&e.tick>contactStart&&e.amount>0),'real sword contact',3000),hit=contacted.scene.effects.find(e=>e.kind==='hit'&&e.sourceId==='master'&&!e.projectileId&&e.tick>contactStart&&e.amount>0);assert.equal(contacted.scene.enemies[0].motion.phase,'hit');record('real sword contact and enemy hit reaction share one event',{event:hit,enemyMotion:contacted.scene.enemies[0].motion});
 await settledReady('spell');nearby=await read();await aim(point(nearby.scene.enemies[0]));await page.evaluate(()=>window.__feelQA.captureProjectile=true);const projectileContactStart=nearby.tick;await press('2');const projectileContact=await until(r=>r.scene.effects.some(e=>e.kind==='hit'&&e.sourceId==='master'&&e.projectileId&&e.tick>projectileContactStart&&e.amount>0),'real projectile contact',4000);record('actual projectile contact preserves one authoritative hit',{event:projectileContact.scene.effects.find(e=>e.kind==='hit'&&e.sourceId==='master'&&e.projectileId&&e.tick>projectileContactStart&&e.amount>0)});await sleep(100);
 await pause(true);await stopVideo();const r=await capture('continuous-final');record('sustained directional native input sample',{wallMilliseconds:performance.now()-continuousStart,fromTick:original.state.worldTick,toTick:r.tick,hp:r.scene.player.hp});
}
async function stableAndBlur(){
 await label('pause');await pause(false);await hold('d');await sleep(135);await press('Escape');await release('d');assert.equal((await read()).status.manualPause,true);await sleep(150);const a=await read(),pixels=await page.locator('#expedition-canvas').evaluate(c=>c.toDataURL());await sleep(450);const b=await read(),laterPixels=await page.locator('#expedition-canvas').evaluate(c=>c.toDataURL());assert.deepEqual(a.state,b.state);assert.deepEqual(a.presentation.scene,b.presentation.scene);assert.equal(pixels,laterPixels);record('pause freezes world render positions pose clocks effects and pixels',{tick:b.tick,pixelsSha256:hash(pixels)});
 await label('resume');await pause(false);await sleep(80);const resumed=await read();assert(resumed.tick<=b.tick+3,'resume must not compensate the paused wall time');record('resume observes current display and authority without offline catchup',{pauseTick:b.tick,resumeTick:resumed.tick,pausedShown:point(b.presentation.scene.player),resumedShown:point(resumed.presentation.scene.player),resumeDisplacementWorld:distance(b.presentation.scene.player,resumed.presentation.scene.player)});await label('native-blur');await hold('d');await sleep(250);const before=await read();await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).blur(),gameWindowId);await sleep(350);const after=await read(),focused=await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).isFocused(),gameWindowId);assert.equal(focused,false);assert.deepEqual(after.input.held,[]);assert.deepEqual(after.combat.controls.move,{x:0,y:0});assert.equal(after.state.srCombat.buffered,undefined);assert(after.tick>before.tick);const at=point(after.scene.player);await sleep(250);assert.deepEqual(point((await read()).scene.player),at);await release('d');await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await pause(true);await capture('native-blur-restored');record('native blur clears held and buffered input while world advances',{fromTick:before.tick,toTick:after.tick});
}
async function shortBuffer(){
 await label('short-buffer');await page.evaluate(()=>window.__feelQA.enabled=true);await pause(false);
 await settledReady('guard');await aim({x:.8,y:.8});await press('3');
 const consumptionMark=await observationMark(),guard=await until(r=>r.state.srCombat.pending?.action==='guard'&&r.state.srCombat.pending.progressTicks===5,'guard short continuation window',2000);
 await press('1');await aim({x:11,y:7});
 const consumptionEvents=await observationsSince(consumptionMark),queued=consumptionEvents.find(o=>o.kind==='keydown'&&o.code==='Digit1');
 // Save the immediate post-handler snapshot even when the buffer was not formed.
 await saveEvidence('buffer-consumption-queued',{guard,events:consumptionEvents,queued});
 assert(queued?.buffered?.action==='attack'&&queued.pending?.id===guard.state.srCombat.pending.id,'post-handler snapshot must contain a real short input');
 const consumed=await until(r=>r.state.srCombat.pending?.action==='attack','buffer consumption'),target=queued.buffered.target,id=consumed.state.srCombat.pending.id;
 assert.deepEqual(consumed.state.srCombat.pending.target,target);assert(!consumed.state.srCombat.buffered);
 await until(r=>!r.state.srCombat.pending,'buffered action completion');const completed=await read();
 await saveEvidence('buffer-consumption-completed',{queued,consumed,completed});
 assert.equal(completed.state.srCombat.executions.filter(e=>e.id===id).length,1);
 record('short input freezes target and consumes once',{guardId:guard.state.srCombat.pending.id,target,attackId:id,requestTick:queued.tick,observedConsumeTick:consumed.tick});

 await settledReady('attack');const pauseMark=await observationMark();await press('1');
 const beforePause=await until(r=>r.state.srCombat.pending?.action==='attack'&&r.state.srCombat.pending.progressTicks===3,'attack early pause-clear window',1500),pausedPending=beforePause.state.srCombat.pending.id;
 // Consecutive native events: no snapshot read or animation-frame wait between them.
 await page.keyboard.down('2');await page.keyboard.down('Escape');await page.keyboard.up('Escape');await page.keyboard.up('2');
 const pauseEvents=await observationsSince(pauseMark),pauseQueue=pauseEvents.find(o=>o.kind==='keydown'&&o.code==='Digit2'),pauseClear=pauseEvents.find(o=>o.kind==='keydown'&&o.code==='Escape');
 const pauseResult=classifyBufferReset(pauseQueue,pauseClear,pausedPending);
 await saveEvidence('buffer-pause-events',{beforePause,events:pauseEvents,queuedAfter:pauseQueue,resetAfter:pauseClear,result:pauseResult});
 assert.equal(pauseResult,'cleared-before-consumption','pause short-input outcome: '+pauseResult);
 assert.equal(pauseClear.status.manualPause,true);assert.deepEqual(pauseClear.input.held,[]);
 record('explicit pause clears a real queued short input',{queued:pauseQueue.buffered,requestTick:pauseQueue.tick,resetTick:pauseClear.tick,evidence:'buffer-pause-events.json'});
 await capture('buffer-pause-final');

 await pause(false);await settledReady('attack');const blurMark=await observationMark();await press('1');
 const beforeBlur=await until(r=>r.state.srCombat.pending?.action==='attack'&&r.state.srCombat.pending.progressTicks===3,'attack early blur-clear window',1500);
 await page.keyboard.down('2');await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).blur(),gameWindowId);
 // Wait for the durable event record, rather than polling the short-lived buffer.
 await page.waitForFunction(mark=>window.__feelQA.commandObservations.slice(mark).some(o=>o.kind==='blur'),blurMark);
 const blurEvents=await observationsSince(blurMark),blurQueue=blurEvents.find(o=>o.kind==='keydown'&&o.code==='Digit2'),blurClear=blurEvents.find(o=>o.kind==='blur'),blurResult=classifyBufferReset(blurQueue,blurClear,beforeBlur.state.srCombat.pending.id);
 await saveEvidence('buffer-blur-events',{beforeBlur,events:blurEvents,queuedAfter:blurQueue,resetAfter:blurClear,result:blurResult});
 assert.equal(blurResult,'cleared-before-consumption','blur short-input outcome: '+blurResult);assert.deepEqual(blurClear.input.held,[]);
 await page.keyboard.up('2');await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await pause(true);
 record('native blur clears a real queued short input',{requestTick:blurQueue.tick,resetTick:blurClear.tick,queued:blurQueue.buffered,evidence:'buffer-blur-events.json'});await capture('buffer-blur-final');
}
async function focusedSample(){
 await label('focused');await page.evaluate(()=>window.__feelQA.enabled=true);await startVideo();await pause(false);const at=performance.now();
 for(let i=0;i<18;i++){const key=['a','d','w','s'][i%4];await hold(key);const r=await read();await aim(point(r.scene.enemies[0]));if(i===3)await press('2');if(i===8)await press('1');if(i===12)await press('3');if(i===15)await press('Space');await sleep(650);await release(key);await sleep(110);}
 await pause(true);await stopVideo();await capture('focused-final');record('current presentation stop turn and actual sound sample',{wallMilliseconds:performance.now()-at});
}
async function queueHandAction(action,key,caseName,targetPoint){
 await settledReady(action);await aim(targetPoint);
 await page.evaluate(({name,action})=>{window.__feelQA.handCase={name,action};},{name:caseName,action});
 const mark=await observationMark();await press(key);
 const events=await observationsSince(mark),queued=events.find(e=>e.kind==='keydown');
 await saveEvidence('hand-'+caseName+'-queued',{events,queued});
 assert(queued?.pending?.action===action&&!queued.buffered,'hand case needs an immediately started '+action);
 if(caseName.endsWith('-left'))assert(queued.pending.target.x<queued.snapshot.state.combat.player.x,'left sample requires an actual left target');
 if(caseName.endsWith('-right'))assert(queued.pending.target.x>queued.snapshot.state.combat.player.x,'right sample requires an actual right target');
 return queued;
}
async function releasedHandAction(queued){
 return until(r=>r.state.srCombat.pending?.id===queued.pending.id&&r.state.srCombat.pending.executed||r.state.srCombat.executions.some(e=>e.id===queued.pending.id&&e.executed),'hand action real release');
}
async function finishedHandAction(queued,caseName){
 const completed=await until(r=>r.state.srCombat.executions.some(e=>e.id===queued.pending.id),'hand action completion'),execution=completed.state.srCombat.executions.find(e=>e.id===queued.pending.id);
 await saveEvidence('hand-'+caseName+'-completed',{queued,completed,execution});
 assert.equal(execution.executed,true);assert.equal(execution.failure,undefined);
 record('hand action completed '+caseName,{actionId:queued.pending.id,action:queued.pending.action,requestedTick:queued.tick,executedTick:execution.executedTick,phase:execution.phase});return completed;
}
async function moveNormallyIntoMelee({min,max,diagonal}){
 const held=new Set(),at=performance.now();let r=await read();
 const center=(min+max)/2,enemy=r.scene.enemies[0],side=diagonal?1:Math.sign(r.scene.player.x-enemy.x)||-1;
 let offset={x:diagonal?center/Math.SQRT2:side*center,y:diagonal?center/Math.SQRT2:0};
 if(enemy.x+offset.x>11.2||enemy.x+offset.x<.8)offset.x*=-1;if(enemy.y+offset.y>7.2)offset.y*=-1;
 const inBand=r=>{const p=r.scene.player,e=r.scene.enemies[0],d=distance(p,e),dx=Math.abs(p.x-e.x),dy=Math.abs(p.y-e.y);return d>=min&&d<=max&&(diagonal?dx>.4&&dy>.4&&dx/dy>.5&&dx/dy<2:dy<=.15);};
 try{
  while(!inBand(r)){
   assert(r.input.hostActive&&r.input.active,'native input gate became inactive during normal WASD approach');
   assert(performance.now()-at<6000,'normal WASD did not reach the melee sample band');
   const p=r.scene.player,e=r.scene.enemies[0],target={x:e.x+offset.x,y:e.y+offset.y},next=new Set();
   // Approach the diagonal case around the side, then across at its final depth.
   if(Math.abs(target.y-p.y)>.12)next.add(target.y>p.y?'s':'w');
   else if(Math.abs(target.x-p.x)>.08)next.add(target.x>p.x?'d':'a');
   for(const key of held)if(!next.has(key)){await release(key);held.delete(key);}
   for(const key of next)if(!held.has(key)){await hold(key);held.add(key);}
   await sleep(20);r=await read();
  }
 }finally{for(const key of held)await release(key);}
 return read();
}
async function safeSpellWindow(){return until(r=>ready(r,'spell')&&(!r.scene.enemies[0].telegraph||r.scene.enemies[0].telegraph.remaining>=.7),'normal spell opening and cooldown',12000);}
async function handMeleeContact(caseName,{diagonal=false}={}){
 const band=diagonal?{min:1.3,max:1.7,diagonal:true}:{min:1,max:1.4,diagonal:false};
 await settledReady('attack');await moveNormallyIntoMelee(band);
 const readyState=await until(r=>ready(r,'attack')&&(!r.scene.enemies[0].telegraph||r.scene.enemies[0].telegraph.remaining>=.5),'normal sword opening',3000);
 const queued=await queueHandAction('attack','1',caseName,point(readyState.scene.enemies[0]));
 const contact=await until(r=>r.scene.effects.some(e=>e.kind==='hit'&&e.actionId===queued.pending.id&&!e.projectileId&&e.amount>0),'actual '+caseName+' sword contact',2500);
 const event=contact.scene.effects.find(e=>e.kind==='hit'&&e.actionId===queued.pending.id&&!e.projectileId&&e.amount>0),actualDistance=distance(event.from,event.to);
 await saveEvidence('hand-'+caseName+'-contact',{band,queued,contact,event,actualDistance,visualContactReview:'pending native sword-body to contact inspection'});
 assert(event.amount>0);assert(!event.projectileId);assert.equal(event.actionId,queued.pending.id);
 assert(actualDistance>=band.min&&actualDistance<=band.max,'actual sword impact must stay in its declared sample distance band');
 if(diagonal)assert(Math.abs(event.direction.x)>.25&&Math.abs(event.direction.y)>.25,'actual sword contact direction must be diagonal');
 else assert(Math.abs(event.from.y-event.to.y)<=.15,'horizontal sword contact needs horizontal body positions');
 record('actual hand sample sword contact '+caseName,{actionId:queued.pending.id,event,actualDistance,band});
 await finishedHandAction(queued,caseName);
}
async function handRepairSample(){
 await label('hand-repair');await page.evaluate(()=>window.__feelQA.enabled=true);await startVideo();await pause(false);const at=performance.now();let r=await read();
 await handMeleeContact('attack-right');let queued;
 r=await read();queued=await queueHandAction('attack','1','attack-left',{x:.8,y:r.scene.player.y});await finishedHandAction(queued,'attack-left');

 // Hold a real movement key across the left cast; release, move and dodge
 // remain formal world events, while the marked frames show the repaired hand.
 await safeSpellWindow();await hold('a');r=await read();queued=await queueHandAction('spell','2','spell-left',{x:.6,y:r.scene.player.y});
 const released=await releasedHandAction(queued),from=point(released.scene.player),moved=await until(r=>r.tick>released.tick&&distance(r.scene.player,from)>.1,'left cast resumes held walking',1000);
 assert(moved.tick<=released.tick+2);await release('a');
 const p=moved.scene.player,dodgeTarget={x:Math.max(.6,p.x-2),y:Math.max(.6,p.y-1.3)};
 await aim(dodgeTarget);await page.evaluate(()=>window.__feelQA.handCase={name:'cast-move-dodge',action:'dodge'});
 const dodgeMark=await observationMark();await press('Space');const dodgeEvents=await observationsSince(dodgeMark),dodge=dodgeEvents.find(e=>e.kind==='keydown');
 await saveEvidence('hand-cast-move-dodge',{queued,released,moved,dodgeEvents});assert.equal(dodge?.pending?.action,'dodge');await finishedHandAction(dodge,'cast-move-dodge');
 record('repaired hand cast move dodge chain',{spellId:queued.pending.id,releaseTick:released.tick,movementTick:moved.tick,dodgeId:dodge.pending.id});

 await handMeleeContact('attack-diagonal-contact',{diagonal:true});
 await pause(true);await stopVideo();await capture('hand-repair-final');record('short hand repair native sample captured',{wallMilliseconds:performance.now()-at,visualApproval:'pending independent frame inspection'});
}
function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b),q=t=>a[Math.floor((a.length-1)*t)]??null;return {n:a.length,p50:q(.5),p95:q(.95),max:a.at(-1)??null,mean:a.length?a.reduce((s,v)=>s+v,0)/a.length:null};}
function summarize(t){const frames=t.frames.filter(f=>['continuous','focused','hand-repair'].includes(f.phase)),moves=frames.slice(1).filter((f,i)=>distance(f.shownPlayer,frames[i].shownPlayer)>.0001),withinTick=moves.filter(f=>frames[frames.indexOf(f)-1]?.worldTick===f.worldTick);
 const directions={KeyD:{x:1,y:0},KeyA:{x:-1,y:0},KeyW:{x:0,y:-1},KeyS:{x:0,y:1}},responses=[];
 for(const input of t.inputs.filter(i=>['continuous','focused','hand-repair'].includes(i.phase)&&directions[i.code])){const nextInput=t.inputs.find(i=>i.at>input.at&&i.kind==='keydown'&&directions[i.code]),dir=directions[input.code],sample=frames.filter(f=>f.end>=input.at&&f.end<(nextInput?.at??Infinity)).slice(0,3);let previous=input.before,totalBacktrack=0;
  const signedSteps=sample.map(f=>{const d=(f.shownPlayer.x-previous.x)*dir.x+(f.shownPlayer.y-previous.y)*dir.y;previous=f.shownPlayer;if(d<0)totalBacktrack-=d;return d;});responses.push({kind:input.kind,code:input.code,at:input.at,worldTick:input.worldTick,firstThreeSignedWorldSteps:signedSteps,totalBacktrackWorld:totalBacktrack,firstNonzeroSignedWorldStep:signedSteps.find(d=>Math.abs(d)>.0001)??null,firstDrawDelayMs:sample[0]?sample[0].end-input.at:null});}
 const contacts=frames.filter(f=>f.effects.some(e=>e.kind==='hit'&&e.tick===f.worldTick&&e.amount>0)),contactEvidence=[];for(const f of contacts){for(const e of f.effects.filter(e=>e.kind==='hit'&&e.tick===f.worldTick&&e.amount>0)){if(contactEvidence.some(c=>c.eventId===e.eventId))continue;const actor=[f.shownPlayer,...f.shownEnemies].find(a=>a.id===e.targetId);const previous=frames[Math.max(0,frames.indexOf(f)-1)],oldShot=previous?.projectiles.find(p=>p.id===e.projectileId),terminal=f.projectiles.find(p=>p.id===e.projectileId),jump=oldShot&&terminal?{world:distance(oldShot,terminal),cssPixels:Math.hypot((terminal.x-oldShot.x)*(viewport.screenStep033m.x/.33),(terminal.y-oldShot.y)*(viewport.screenStep033m.y/.33)),from:point(oldShot),to:point(terminal),lastFlightWorldTick:previous.worldTick,impactWorldTick:f.worldTick,terminal:terminal.terminal===true}:null;contactEvidence.push({projectileContactDisplayJump:jump,eventId:e.eventId,tick:e.tick,visualTick:f.visualTick,sourceId:e.sourceId,targetId:e.targetId,contact:e.contact,outcome:e.outcome,reaction:e.reaction,shownTargetMotion:actor?.motion,shownTargetPoint:actor?point(actor):null,audioVoiceStarts:f.audioVoiceStarts,precedingVoiceStarts:frames[Math.max(0,frames.indexOf(f)-1)]?.audioVoiceStarts});}}
 return {frames:frames.length,actualContactEvidence:contactEvidence,directionalResponses:responses,keyupFirstThreeFrameBacktrackWorld:stats(responses.filter(r=>r.kind==='keyup').map(r=>r.totalBacktrackWorld)),rafCallbackIntervalMs:stats(frames.slice(1).map(f=>f.dt)),completedFrameCanvasJsMs:stats(frames.map(f=>f.drawJsMs)),renderPositionChanges:moves.length,renderChangesWithinSameAuthorityTick:withinTick.length,renderWorldDistance:stats(moves.map(f=>distance(f.shownPlayer,f.worldPlayer))),wasdInputToFirstCompletedChangedDrawMs:stats(t.inputs.filter(i=>i.kind==='keydown'&&['continuous','focused','hand-repair'].includes(i.phase)&&/^Key[WASD]$/.test(i.code)).map(i=>i.delayMs)),inputToFirstCompletedChangedDrawMs:stats(t.inputs.filter(i=>i.kind==='keydown'&&['continuous','focused','hand-repair'].includes(i.phase)).map(i=>i.delayMs)),focusedFraction:frames.length?frames.filter(f=>f.focus).length/frames.length:null,visibleFraction:frames.length?frames.filter(f=>f.visibility==='visible').length/frames.length:null,cacheFinal:frames.at(-1)?.cache};}
try{
 await sourceLaunch();await label('setup');await capture('initial-paused');if(scenario==='hand-repair')await handRepairSample();else if(scenario==='focused')await focusedSample();else if(scenario!=='buffer'){await continuous();await stableAndBlur();}if(scenario!=='hand-repair'||includeBuffer)await shortBuffer();await pause(true);await capture('final-world');assert.deepEqual(errors,[]);complete=true;
}catch(e){errors.push(e.stack||String(e));console.error(e.stack||String(e));if(page){await pause(true).catch(()=>{});await stopVideo().catch(()=>{});await capture('failure').catch(()=>{});}}
finally{
 if(page){try{await pause(true);trace=await page.evaluate(()=>{window.__feelQA.enabled=false;const q=window.__feelQA;return {...q,audio:{...q.audio,contexts:q.audio.contexts.map(c=>({state:c.state,sampleRate:c.sampleRate,baseLatency:c.baseLatency,outputLatency:c.outputLatency}))}};});for(const c of trace.flightCaptures)c.kind='flight-'+c.worldTick;trace.captures.push(...trace.flightCaptures,...trace.handCaptures);delete trace.flightCaptures;delete trace.handCaptures;for(const [i,c] of trace.captures.entries()){const bytes=Buffer.from(c.canvas.split(',')[1],'base64'),filename='observed-'+String(i).padStart(2,'0')+'-'+c.kind.replaceAll(':','-')+'.png';await fs.writeFile(path.join(output,filename),bytes);delete c.canvas;c.filename=filename;c.sha256=hash(bytes);}await fs.writeFile(path.join(output,'trace.json'),json(trace));const r=await read();lastTick=r.tick;await page.locator('#save').click();await sleep(300);await fs.copyFile(native,path.join(output,'final-native.json'));await fs.writeFile(path.join(output,'final-observed.json'),json(r));}catch(e){finalizationErrors.push(e.stack||String(e));}}
 if(electron){try{const closed=electron.waitForEvent('close',{timeout:30000});await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.close(),gameWindowId);await closed;}catch(e){finalizationErrors.push(e.stack||String(e));}}
 const runtimeAfter=await hashes(),sourceUnchanged=hash(await fs.readFile(source))===hash(sourceBytes),runtimeUnchanged=JSON.stringify(runtimeAfter)===JSON.stringify(runtimeBefore),checksPassed=complete&&!errors.length&&!finalizationErrors.length&&runtimeUnchanged&&sourceUnchanged,report={status:checksPassed?(scenario==='hand-repair'?'checks-passed-visual-pending':'passed'):'failed',scope:'visible macOS source Electron; native keyboard mouse buttons; read-only completed Canvas frame observation, separate from physical display FPS or human/audio approval',source,sourceSha256:hash(sourceBytes),sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,initialTick:original.state.worldTick,finalTick:lastTick,wallSeconds:wall(),phase,scenario,includeBuffer,visualReview:{status:'pending-independent-inspection',handFrameCount:trace?.captures.filter(c=>c.caseName).length??0,knownBoundaries:scenario==='hand-repair'?[{kind:'maximum-horizontal-reach',distanceMeters:1.9,status:'open',note:'Blade/contact scale alignment at the maximum horizontal reach remains a separate visual debt.'}]:[]},viewport,checks,actions,metrics:trace?summarize(trace):null,audio:trace?.audio,video,errors,finalizationErrors};
 await fs.writeFile(path.join(output,'report.json'),json(report));console.log(json({status:report.status,report:path.join(output,'report.json'),metrics:report.metrics?{frames:report.metrics.frames,wasdInputToFirstCompletedChangedDrawMs:report.metrics.wasdInputToFirstCompletedChangedDrawMs,rafCallbackIntervalMs:report.metrics.rafCallbackIntervalMs,completedFrameCanvasJsMs:report.metrics.completedFrameCanvasJsMs}:null,errors,finalizationErrors}));if(!checksPassed)process.exitCode=1;
}
