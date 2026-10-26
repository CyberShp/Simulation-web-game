/** Self-contained local preview of original atlas pixels and current phase selection. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {normalizeCombatFrameManifest} from '../../apps/courtyard/courtyard-combat-frame-metadata.mjs';

const option=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),single=option('manifest'),registryFile=option('registry')||path.join(repo,'assets/courtyard/combat-actors-v3/registry.json'),output=option('output');
assert(output&&path.isAbsolute(output),'absolute --output=/new/directory required');
assert(!(single&&option('registry')),'choose --manifest or --registry');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=(base,ref)=>{assert(typeof ref==='string'&&!/^[a-z][a-z0-9+.-]*:/i.test(ref)&&!/[?#]/.test(ref),'local atlas and manifest paths required');return path.resolve(path.dirname(base),ref);};
let entries,registrySha256=null;
if(single)entries=[{file:path.resolve(single)}];
else{const bytes=await fs.readFile(registryFile),registry=JSON.parse(bytes);assert.equal(registry.schema,'combat-actor-registry/v1');registrySha256=sha(bytes);entries=Object.entries(registry.actors).flatMap(([identity,actor])=>actor.clips.map(ref=>({identity,file:local(registryFile,typeof ref==='string'?ref:ref.manifest)})));}
const clips=[],images={},files=[];
for(const entry of entries){
 const bytes=await fs.readFile(entry.file),manifest=JSON.parse(bytes),atlasFile=local(entry.file,manifest.atlas),atlas=await fs.readFile(atlasFile);
 assert.equal(atlas.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG atlas required');
 const image='atlas:'+atlasFile,clip=normalizeCombatFrameManifest(manifest,{path:entry.file,imageKey:image}),width=atlas.readUInt32BE(16),height=atlas.readUInt32BE(20);
 assert(!entry.identity||entry.identity===clip.visualIdentity,'registry and manifest visualIdentity differ');assert(clip.frames.every(f=>f.crop[0]+f.crop[2]<=width&&f.crop[1]+f.crop[3]<=height),'atlas crop exceeds PNG dimensions');
 images[image]='data:image/png;base64,'+atlas.toString('base64');clip.previewLoop=!!manifest.loop;clips.push(clip);files.push({manifest:entry.file,manifestSha256:sha(bytes),atlas:atlasFile,atlasSha256:sha(atlas),visualIdentity:clip.visualIdentity,action:clip.action,direction:clip.direction,frames:clip.frames.length,durationMs:clip.durationMs});
}
assert(clips.length,'no clips supplied');
const samplerFile=path.join(repo,'apps/courtyard/courtyard-combat-frame-metadata.mjs'),samplerBytes=await fs.readFile(samplerFile),samplerSource=samplerBytes.toString().replace(/^export /gm,'').replace(/<\/script/gi,'<\\/script');
const data=JSON.stringify({clips,images}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html=String.raw`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>完整帧 Atlas 预览</title>
<style>body{margin:24px;background:#18241f;color:#eee9dc;font:14px system-ui}h1{font-size:22px}p{max-width:1000px;line-height:1.6}button,select,input{font:inherit;margin:4px;padding:5px}label{display:inline-block;margin-right:10px}canvas{image-rendering:pixelated;background:#34463b;max-width:100%;height:auto}#grid,#contact{display:flex;flex-wrap:wrap;gap:12px}.card{background:#25362c;padding:8px;max-width:280px}.card pre{font:12px monospace;white-space:pre-wrap}#readout{white-space:pre-wrap;font:13px monospace}#seek{width:420px}#error{color:#ffb2a0}</style>
<h1>完整帧 Atlas 预览</h1><p>直接读取现有 atlas 原始像素。原片段模式按 manifest 的 durationMs 播放，循环可选；八方向模式调用本次导出的正式素材选择器，只采样指定 phase，不推进世界。方向缺失、动作回退与旧素材缺口均显示在文字中。此页面用于素材评看。</p>
<div><label>模式<select id="mode"><option value="clip">原片段循环</option><option value="phase">八方向阶段采样</option></select></label><label>片段<select id="clip"></select></label><label>身体高<input id="height" type="number" min="30" max="300" step="1" value="111"></label><label><input id="guides" type="checkbox" checked>脚点与方向线</label></div>
<div id="phaseControls" hidden><label>身份<select id="identity"></select></label><label>动作<select id="action"></select></label><label>正式 phase<select id="phase"></select></label></div>
<div><button id="play">播放</button><button id="prev">上一帧</button><button id="next">下一帧</button><label><input id="repeat" type="checkbox">循环</label><label>速度<select id="speed"><option value="0.25">¼</option><option value="0.5">½</option><option value="1" selected>1×</option></select></label><input id="seek" type="range" min="0" max="1000" value="0" step="1"></div>
<div id="readout"></div><div id="error"></div><canvas id="stage" width="660" height="440"></canvas><div id="grid" hidden></div><h2>片段逐帧</h2><div id="contact"></div>
<script>${samplerSource}
const previewData=${data};
const el=id=>document.getElementById(id),library=new Map(),loaded=new Map(),angles=[['right',1,0],['down-right',1,1],['down',0,1],['down-left',-1,1],['left',-1,0],['up-left',-1,-1],['up',0,-1],['up-right',1,-1]];
for(const clip of previewData.clips){if(!library.has(clip.visualIdentity))library.set(clip.visualIdentity,{clips:[]});library.get(clip.visualIdentity).clips.push(clip);}
const add=(select,value,label=value)=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);};
previewData.clips.forEach((c,i)=>add(el('clip'),i,c.visualIdentity+' / '+c.action+' / '+c.direction));for(const id of library.keys())add(el('identity'),id);
for(const action of ['idle','walk','attack','spell','guard','dodge','hit-light','hit-heavy','down'])add(el('action'),action);
for(const phase of ['idle','move','windup','release','recovery','guard','evade','hit','down'])add(el('phase'),phase);
let playing=false,time=0,last=null;
const chosen=()=>previewData.clips[Number(el('clip').value)],bodyHeight=()=>Math.max(30,Math.min(300,Number(el('height').value)||111));
function paint(canvas,pose,direction=null){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;const foot={x:canvas.width/2,y:canvas.height-42};if(pose){const k=bodyHeight()/pose.sourceHeight,[x,y,w,h]=pose.crop;ctx.drawImage(loaded.get(pose.image),x,y,w,h,foot.x-pose.foot[0]*k,foot.y-pose.foot[1]*k,w*k,h*k);}if(el('guides').checked){ctx.strokeStyle='#efbc90';ctx.beginPath();ctx.moveTo(foot.x-7,foot.y);ctx.lineTo(foot.x+7,foot.y);ctx.moveTo(foot.x,foot.y-7);ctx.lineTo(foot.x,foot.y+7);ctx.stroke();if(direction){ctx.strokeStyle='#b4dfdd';ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(foot.x+direction.x*50,foot.y+direction.y*25);ctx.stroke();}}}
function rawFrame(clip,t){let start=0;for(const frame of clip.frames){if(t<start+frame.durationMs)return {frame,start};start+=frame.durationMs;}return {frame:clip.frames.at(-1),start:clip.durationMs-clip.frames.at(-1).durationMs};}
function render(){const clip=chosen(),formal=el('mode').value==='phase';el('phaseControls').hidden=!formal;el('stage').hidden=formal;el('grid').hidden=!formal;for(const id of ['play','prev','next','speed','repeat'])el(id).disabled=formal;
 if(!formal){el('seek').max=clip.durationMs-1;const t=Math.min(clip.durationMs-1,time),{frame,start}=rawFrame(clip,t);el('seek').value=t;paint(el('stage'),frame);el('readout').textContent=clip.visualIdentity+' / '+clip.action+' / '+clip.direction+'\nframe #'+frame.index+' / phase '+frame.phase+' / '+Math.round(t)+' ms of '+clip.durationMs+' ms / frame interval ['+start+','+(start+frame.durationMs)+') ms';}
 else{el('seek').max=1000;const phase=el('phase').value,progress=Number(el('seek').value)/1000;el('readout').textContent='正式 phase '+phase+' / progress '+progress.toFixed(3)+' / tick '+(progress*10).toFixed(3)+'（阶段观察参数）';el('grid').replaceChildren();for(const [name,x,y]of angles){const card=document.createElement('div');card.className='card';const canvas=document.createElement('canvas');canvas.width=260;canvas.height=300;const label=document.createElement('pre'),action=el('action').value,sample={action:action.startsWith('hit')?'hit':action,phase,runtimePhase:phase,reaction:action==='hit-heavy'?'heavy':'light',facing:x<-.08?'left':'right',direction:{x,y},lookDirection:{x,y},progress,tick:progress*10},result=sampleCombatFrameAtlas(el('identity').value,sample,library);if(result){paint(canvas,result.pose,{x,y});const source=library.get(el('identity').value).clips.find(c=>c.id===result.clipId);label.textContent=name+' → '+source.action+'/'+source.direction+' #'+result.pose.index+' '+result.pose.phase+'\n方向回退 '+result.directionalFallback+' / 动作回退 '+result.actionFallback+' / 阶段回退 '+result.phaseFallback;}else{paint(canvas,null,{x,y});label.textContent=name+' → 无适用 atlas；正式角色将走旧素材路径，身份/动作需另查。';}card.append(canvas,label);el('grid').append(card);}}
}
function contact(){el('contact').replaceChildren();let elapsed=0;for(const frame of chosen().frames){const card=document.createElement('div');card.className='card';const canvas=document.createElement('canvas'),k=bodyHeight()/frame.sourceHeight,[x,y,w,h]=frame.crop;canvas.width=Math.ceil(w*k)+16;canvas.height=Math.ceil(h*k)+16;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(loaded.get(frame.image),x,y,w,h,8,8,w*k,h*k);const label=document.createElement('pre');label.textContent='#'+frame.index+' / '+frame.phase+' / '+frame.durationMs+'ms\n['+elapsed+','+(elapsed+frame.durationMs)+')ms';elapsed+=frame.durationMs;card.append(canvas,label);el('contact').append(card);}}
function stop(){playing=false;el('play').textContent='播放';last=null;}
el('play').onclick=()=>{playing=!playing;el('play').textContent=playing?'暂停':'播放';last=null;};
el('seek').oninput=()=>{stop();if(el('mode').value==='clip')time=Number(el('seek').value);render();};
for(const [id,step]of [['prev',-1],['next',1]])el(id).onclick=()=>{stop();const clip=chosen(),current=rawFrame(clip,time).frame,index=(clip.frames.indexOf(current)+step+clip.frames.length)%clip.frames.length;time=clip.frames.slice(0,index).reduce((n,f)=>n+f.durationMs,0);render();};
el('clip').onchange=()=>{stop();time=0;const c=chosen();el('repeat').checked=c.previewLoop;el('identity').value=c.visualIdentity;el('action').value=c.action;el('phase').value=c.frames[0].phase||'idle';contact();render();};
for(const id of ['mode','height','guides','identity','action','phase'])el(id).onchange=()=>{stop();if(id==='action'){const a=el('action').value;el('phase').value=a.startsWith('hit')?'hit':({walk:'move',dodge:'evade',attack:'windup',spell:'windup'})[a]||a;}contact();render();};
function loop(now){if(playing){if(last!==null){time+=(now-last)*Number(el('speed').value);if(time>=chosen().durationMs){if(el('repeat').checked)time%=chosen().durationMs;else{time=chosen().durationMs-1;stop();}}}if(playing)last=now;render();}requestAnimationFrame(loop);}
Promise.all(Object.entries(previewData.images).map(([key,url])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{loaded.set(key,image);resolve();};image.onerror=()=>reject(Error('atlas load failed: '+key));image.src=url;}))).then(()=>{el('clip').onchange();requestAnimationFrame(loop);}).catch(error=>{el('error').textContent=String(error);});
</script></html>`;
new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});await fs.writeFile(path.join(output,'index.html'),html);
const report={scope:'offline original-atlas playback and current selector phase inspection; no world advancement or art modification',registry:single?null:path.resolve(registryFile),registrySha256,sampler:samplerFile,samplerSha256:sha(samplerBytes),files,htmlSha256:sha(html),artReview:'pending-root-inspection'};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'created',page:path.join(output,'index.html'),report:path.join(output,'report.json'),clips:clips.length}));
