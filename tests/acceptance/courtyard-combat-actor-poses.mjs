/** Offline art inspection at the runtime's 111px reference height. No world runs. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {loadCombatActorAssets,createCombatActorRenderer,sampleCombatActor} from '../../apps/courtyard/courtyard-combat-actors.mjs';
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9);
assert(output&&path.isAbsolute(output),'absolute --output required');await fs.mkdir(output,{recursive:true});
const root=path.resolve(new URL('../..',import.meta.url).pathname),assets=await loadCombatActorAssets({loadImage:name=>loadImage(path.join(root,'assets/courtyard',name)),loadJson:async name=>JSON.parse(await fs.readFile(path.join(root,'assets/courtyard',name),'utf8')),makeCanvas:createCanvas});assert.deepEqual(assets.issues,[]);
const canvas=createCanvas(1536,930),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const renderer=createCombatActorRenderer({ctx,worldToScreen:(x,y)=>({x,y}),getTransform:()=>({sx:111/1.45,sy:44}),assets});
const samples=[],checks=[];
const record=(name,extra={})=>checks.push({name,ok:true,...extra});
function cell(name,action,phase,{left=false,beast=false,progress=.5,tick=100,kind=null}={}){
 const n=samples.length,col=n%8,row=Math.floor(n/8),x=col*192+96,y=row*186+151;
 const a={id:beast?'shanxiao':'master',personId:beast?'person:valley-shanxiao':'person:master',entityKind:beast?'beast':'person',x,y,hp:phase==='down'?0:100,maxHp:100,
  hitReaction:kind?{kind}:null,motion:{action,phase,direction:{x:left?-1:1,y:0},phaseStartedTick:tick-Math.floor(progress*10),phaseDurationTicks:10,phaseProgressTicks:progress*10}};
 const b={tick,player:a,enemies:[],allies:[]},before=JSON.stringify(b);ctx.fillStyle=row%2?'#bbb5a5':'#38493d';ctx.fillRect(col*192,row*186,192,186);
 ctx.strokeStyle='#da877b';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();
 const metric=renderer.draw(a,b,tick);assert.equal(JSON.stringify(b),before);assert.equal(metric.height,111);assert.equal(metric.foot.x,x);assert.equal(metric.foot.y,y);
 ctx.fillStyle=row%2?'#26392d':'#edf0d7';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(name,x,row*186+176);
 const sample=metric.sample;samples.push({name,image:sample.pose.image,crop:sample.pose.crop,foot:sample.foot,hand:metric.hand,releaseHand:metric.releaseHand,clipId:sample.clipId||null,clipAction:sample.clipAction||null,frameKey:sample.frameKey,assetFallback:sample.assetFallback});
 return {actor:a,battle:b,metric};
}
cell('R idle','idle','idle');cell('R walk A','move','move',{tick:102});cell('R walk B','move','move',{tick:106});cell('R sword load','attack','windup');cell('R sword release','attack','release');cell('R cast gather','spell','windup');const right=cell('R cast release','spell','release');cell('R guard','guard','guard');
cell('L idle','idle','idle',{left:true});cell('L walk A','move','move',{left:true,tick:102});cell('L walk B','move','move',{left:true,tick:106});cell('L sword load','attack','windup',{left:true});cell('L sword release','attack','release',{left:true});cell('L cast gather','spell','windup',{left:true});const left=cell('L cast release','spell','release',{left:true});cell('L guard','guard','guard',{left:true});
cell('R short step','dodge','evade');cell('L short step','dodge','evade',{left:true});cell('Light stagger','hit','hit',{kind:'light'});cell('Heavy stagger','hit','hit',{kind:'heavy'});cell('Cultivator down','down','down');cell('Ape walk A','move','move',{beast:true,tick:100});cell('Ape walk B','move','move',{beast:true,tick:102});cell('Ape load','strike','windup',{beast:true});
cell('Ape release','strike','release',{beast:true});cell('Ape recovery','strike','recovery',{beast:true});cell('Ape light','hit','hit',{beast:true,kind:'light'});cell('Ape heavy','hit','hit',{beast:true,kind:'heavy'});cell('Ape down','down','down',{beast:true});cell('R cast return','spell','recovery',{progress:.7});cell('L cast return','spell','recovery',{left:true,progress:.7});cell('Ape idle','idle','idle',{beast:true});
const leftLight=cell('L light stagger','hit','hit',{left:true,kind:'light'}),leftHeavy=cell('L heavy stagger','hit','hit',{left:true,kind:'heavy'});
cell('Ape R load','strike','windup',{beast:true});cell('Ape L load','strike','windup',{beast:true,left:true});
assert(right.metric.releaseHand.x>right.metric.foot.x);assert(left.metric.releaseHand.x<left.metric.foot.x);record('left/right release hand agrees with horizontal aim');
const scene=left.battle,before=JSON.stringify(scene),a=left.actor;
assert.deepEqual(sampleCombatActor(a,scene,100.5),sampleCombatActor(a,scene,100.5));assert.equal(JSON.stringify(scene),before);record('repeat sampling at a frozen tick is deterministic and read only');
assert.equal(left.metric.sample.pose.image,'leftSpell');assert.equal(right.metric.sample.clipAction,'spell');assert.equal(right.metric.sample.pose.phase,'release');assert(right.metric.sample.frameKey.includes('/spell-right/manifest.json#'));assert.equal(right.metric.sample.mirrored,false);record('current right spell atlas and separate left cast fallback retain their actual sources');
record('36 pose foot anchors match world-to-screen reference height 111px');
for(const phase of ['windup','release','recovery'])assert.equal(sampleCombatActor({...a,motion:{...a.motion,action:'dodge',phase}},scene).phase,'evade');record('formal dodge preparation release and recovery each retain short-step body');
const hit={...a,facing:{x:1,y:0},hitReaction:{kind:'light'},motion:{...a.motion,action:'hit',phase:'hit',direction:{x:-1,y:0}}};assert.equal(sampleCombatActor(hit,scene).facing,'right');record('hit recoil uses incoming direction without reversing actor facing');
assert.equal(leftLight.metric.sample.pose.image,'leftActions');assert.equal(leftHeavy.metric.sample.pose.image,'leftContinuity');record('left light and heavy stagger retain separate left-facing source art');
assert.equal(samples[34].image,'foeActions');assert.equal(sampleCombatActor({...a,entityKind:'beast',motion:{...a.motion,direction:{x:1,y:0}}},scene).mirrored,true);assert.equal(sampleCombatActor(a,scene).mirrored,false);record('unarmed ape follows target side while cultivator retains independent anatomy');
assert(samples[4].frameKey.includes('/attack-right/manifest.json#'));assert(samples[12].frameKey.includes('/attack-left/manifest.json#'));assert(samples[35].frameKey.includes('/shanxiao/attack-left/manifest.json#'));record('registered right and left sword attacks and left ape strike resolve to current manifest files');
const clipSources=await Promise.all([...assets.actorLibrary.entries()].flatMap(([visualIdentity,{clips}])=>clips.map(async clip=>({visualIdentity,path:clip.path,id:clip.id,action:clip.action,direction:clip.direction,frames:clip.frames.length,sha256:createHash('sha256').update(await fs.readFile(path.join(root,'assets/courtyard',clip.path))).digest('hex')}))));
const png=canvas.toBuffer('image/png');await fs.writeFile(path.join(output,'actor-poses-111.png'),png);
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({scope:'offline Canvas drawing of current registry and runtime actor renderer, not desktop play',checks,samples,clipSources,sha256:createHash('sha256').update(png).digest('hex')},null,2)+'\n');
console.log(JSON.stringify({status:'passed',checks:checks.length,image:path.join(output,'actor-poses-111.png'),report:path.join(output,'report.json')}));
