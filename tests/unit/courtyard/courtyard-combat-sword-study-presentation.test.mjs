import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {STUDY_FRAMES,STUDY_GROUND_Y_SCALE,sampleSwordStudyBody} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';
import {swordStudyPresentation,drawSwordStudyActor} from '../../../apps/courtyard/courtyard-combat-sword-study.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {createSwordStudyEffects} from '../../../apps/courtyard/courtyard-combat-sword-study-effects.mjs';
import {createCombatEffectsRenderer} from '../../../apps/courtyard/courtyard-combat-effects.mjs';
import {SWORD_STUDY_GROUND} from '../../../apps/courtyard/courtyard-combat-sword-study-ground.mjs';

const root=new URL('../../../',import.meta.url),asset=f=>new URL('assets/courtyard/'+f,root);
function rgbaPng(buffer){
 const w=buffer.readUInt32BE(16),h=buffer.readUInt32BE(20);assert.equal(buffer[24],8);assert.equal(buffer[25],6);assert.equal(buffer[28],0);
 const blocks=[];for(let at=8;at<buffer.length;){const n=buffer.readUInt32BE(at),type=buffer.toString('ascii',at+4,at+8);if(type==='IDAT')blocks.push(buffer.subarray(at+8,at+8+n));at+=n+12;}
 const raw=inflateSync(Buffer.concat(blocks)),stride=w*4,pixels=Buffer.alloc(w*h*4);let input=0;
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<h;y++){const filter=raw[input++];assert(filter>=0&&filter<=4);for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;pixels[i]=(raw[input++]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
 return {w,h,pixels};
}
const context=()=>{const calls=[];const ctx=new Proxy({calls,globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});return ctx;};
const t={sx:80,sy:80*STUDY_GROUND_Y_SCALE,ox:10,oy:20};
const world=(x,y)=>({x:t.ox+x*t.sx,y:t.oy+y*t.sy});
const player={id:'master',personId:'person:master',x:8,y:10,hp:100,facing:{x:1,y:0},motion:{phase:'idle',action:'idle'}};

test('all registered images are present with exact source dimensions, scale and digest',()=>{
 assert.equal(Object.keys(STUDY_FRAMES).length,81);
 for(const f of Object.values(STUDY_FRAMES)){const bytes=fs.readFileSync(asset(f.file));assert.equal(bytes.readUInt32BE(16),f.width);assert.equal(bytes.readUInt32BE(20),f.height);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);assert(Math.abs(f.scale*f.sourceHeight-f.bodyHeightMeters)<1e-12);assert(f.root.every(Number.isFinite));}
});

test('twelve masks exactly match native RGBA alpha64, including transparent holes',()=>{
 const bodies=Object.values(STUDY_FRAMES).filter(f=>f.rows.length);assert.equal(bodies.length,12);
 for(const f of bodies){const {w,h,pixels}=rgbaPng(fs.readFileSync(asset(f.file))),rows=[];for(let y=0;y<h;y++){const runs=[y];let active=false;for(let x=0;x<=w;x++){const next=x<w&&pixels[(y*w+x)*4+3]>=64;if(next!==active){runs.push(x);active=next;}}if(runs.length>1)rows.push(runs);}assert.deepEqual(rows,f.rows,f.key);}
});

test('beast frame and CSS samples use authority tick despite private presentation timers',()=>{
 for(const facing of [{x:-1,y:0},{x:1,y:0}])for(const phase of ['idle','move','windup','release','recovery','hit','down']){
  const actor={id:'foe',personId:'person:valley-shanxiao',x:14,y:9,hp:phase==='down'?0:100,facing,motion:{phase,action:phase==='move'?'move':'strike',phaseStartedTick:20,phaseDurationTicks:4},poseTick:99,animationElapsedTicks:1234};
  const expected=sampleSwordStudyBody(actor,21),shown=swordStudyPresentation(actor,{tick:21,worldTick:21,visualTick:21.8},{worldToScreen:world,transform:t,images:{}});
  assert.equal(shown.study.key,expected.key);assert.equal(shown.study.tick,21);assert.equal(shown.study.mirror,expected.mirror);assert.deepEqual(shown.study.root,expected.root);
  for(const [name,native] of Object.entries(expected.samples)){const p=shown.study.samples[name],foot=world(actor.x,actor.y);assert(Math.abs(p.x-foot.x-(native[0]-expected.root[0])*expected.scale*t.sx*(expected.mirror?-1:1))<1e-9);assert(Math.abs(p.y-foot.y-(native[1]-expected.root[1])*expected.scale*t.sx)<1e-9);}
 }
});

test('visible contact remains direct; legacy contact retains explicit body height; release is not hit FX',()=>{
 const b={rulesProfile:'sword-study-v1',tick:10,player,enemies:[],effects:[]},f={id:1,tick:10,kind:'hit',amount:12,contact:{x:5,y:8},targetId:'master',contactHeight:.9};
 for(const visible of [false,true]){const ctx=context(),r=createSwordStudyEffects({ctx,worldToScreen:world,getTransform:()=>t,getActorPresentation:()=>({height:180})});r.drawForeground({...b,effects:[{...f,...(visible?{space:'visible-body-v1'}:{})}]},10);const text=ctx.calls.find(c=>c[0]==='fillText');assert(text);assert.equal(text[3],world(5,8).y-(visible?0:90)-14);}
 const ctx=context(),r=createSwordStudyEffects({ctx,worldToScreen:world,getTransform:()=>t});r.drawForeground({...b,effects:[{...f,kind:'attack',amount:0,projectileRelease:true}]},10);assert.equal(ctx.calls.length,0);
});

test('new-profile projectile dispatch keeps old spell on legacy flight',()=>{
 const ctx=context(),foot=world(player.x,player.y),metrics=()=>({height:116,foot,hand:foot,releaseHand:foot,swordTrail:[],swingWeight:0});
 const renderer=createCombatEffectsRenderer({ctx,worldToScreen:world,getTransform:()=>t,getActorPresentation:metrics});
 const shot={id:1,kind:'sword-qi',sourceId:'master',x:10,y:9,from:{x:8,y:9},direction:{x:.8,y:.6},launchedTick:10};
 renderer.drawProjectiles({rulesProfile:'sword-study-v1',tick:10,player,enemies:[],projectiles:[{...shot,space:'visible-body-v1'},{...shot,id:2,kind:'spirit-qi'}]},10);
 const rotations=ctx.calls.filter(c=>c[0]==='rotate');assert.equal(rotations.length,1);assert.equal(rotations[0][1],Math.atan2(.6,.8));
});

test('registered wide ground preserves camera aspect and obstacle identity at the same metre scale',()=>{
 const g=SWORD_STUDY_GROUND.ground,[,,w,h]=g.registeredRect;assert(Math.abs(w/h-48/(32*STUDY_GROUND_Y_SCALE))<1e-12);assert.deepEqual(g.worldRect,[0,0,48,32]);
 for(const p of [g,...Object.values(SWORD_STUDY_GROUND.props)])assert(fs.existsSync(asset(p.file)));
 assert.deepEqual(Object.keys(SWORD_STUDY_GROUND.props),['object:valley:herbs','object:valley:bridge','object:valley:cave']);
 assert(fs.readFileSync(asset('combat-sword-study-v1/CREDITS.txt'),'utf8').includes('Kling'));
});

test('shared module URLs resolve inside the formal simulation route',()=>{
 const sampler=new URL('../../src/simulation/ea-combat-sword-study-frames.mjs','http://local/courtyard-combat-sword-study.mjs');
 assert.equal(sampler.pathname,'/src/simulation/ea-combat-sword-study-frames.mjs');assert.equal(new URL('./ea-combat-sword-study-data.mjs',sampler).pathname,'/src/simulation/ea-combat-sword-study-data.mjs');
});

function movingSegment({recovering=false}={}){
 const presenter=createCombatPresentation(),ctx=context(),drawn=[],images=Object.fromEntries(Object.values(STUDY_FRAMES).map(f=>[f.file,{file:f.file,width:f.width,height:f.height}]));
 const base=103;
 function sample(ms,moving){
  const tick=base+Math.floor(ms/100),recovery=recovering&&ms<200,move={x:moving?1:0,y:0};
  const motion={action:recovery?'attack':moving?'move':'idle',phase:recovery?'recovery':moving?'move':'idle',moving,moveIntent:move,movementLocked:false,startedTick:100,executeAtTick:102,phaseStartedTick:recovery?103:tick,phaseDurationTicks:recovery?2:1,phaseProgressTicks:recovery?tick-103:0,recoveryUntilTick:105,direction:{x:1,y:0}};
  const actor={...player,x:8+Math.min(ms,500)/1000*3.3,motion};
  const scene={type:'combat',sessionId:'movement-segment',rulesProfile:'sword-study-v1',geometryId:'valley-open-v2',tick,player:actor,enemies:[],allies:[],effects:[],projectiles:[],arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}}};
  const b=presenter.sample(scene,{now:ms,paused:false,intent:move}),shown=swordStudyPresentation(b.player,b,{worldToScreen:world,transform:t,images});
  drawSwordStudyActor(ctx,shown);const image=ctx.calls.filter(c=>c[0]==='drawImage').at(-1)?.[1];assert(image,'the actual renderer must submit a source image');drawn.push(image.file);return shown.study.key;
 }
 return {sample,drawn};
}

test('one continuous nonmirrored movement segment submits real run images, stops, then holds idle',()=>{
 const run=movingSegment(),keys=new Set();for(let ms=0;ms<=480;ms+=20)keys.add(run.sample(ms,true));
 assert(keys.size>=12,'a moving body must advance source frames instead of sliding one stance');assert([...keys].every(k=>k.startsWith('run-')));assert(new Set(run.drawn).size>=12);
 assert.equal(run.sample(500,false),'stop-203');assert.equal(run.sample(650,false),'action-03');assert.equal(run.sample(900,false),'action-03');
});

test('accepted movement resumes real run images after the release tick, preserving action priorities',()=>{
 const run=movingSegment({recovering:true}),keys=new Set();for(let ms=0;ms<=480;ms+=20)keys.add(run.sample(ms,true));assert(keys.size>=12);assert([...keys].every(k=>k.startsWith('run-')));
 const actor={...player,motion:{action:'attack',phase:'release',moveIntent:{x:1,y:0},moving:true,movementLocked:false,executeAtTick:102,phaseStartedTick:102,phaseDurationTicks:1,direction:{x:1,y:0}},animationElapsedTicks:1};
 assert(!sampleSwordStudyBody(actor,102.9).key.startsWith('run-'),'the actual release tick retains its full attack image');
 assert(sampleSwordStudyBody({...actor,motion:{...actor.motion,phase:'recovery'}},103).key.startsWith('run-'));
 for(const [action,phase]of[['attack','windup'],['ground-sword','windup'],['ground-sword','release'],['dodge','evade']])assert(!sampleSwordStudyBody({...actor,motion:{...actor.motion,action,phase}},103).key.startsWith('run-'),action+'/'+phase);
 assert(!sampleSwordStudyBody({...actor,motion:{...actor.motion,phase:'recovery',movementLocked:true}},103).key.startsWith('run-'));
 assert.equal(run.sample(500,false),'stop-203');assert.equal(run.sample(800,false),'action-03');
});
