import test from 'node:test';
import assert from 'node:assert/strict';
import {combatRigPose,createCombatRig} from '../../../apps/courtyard/courtyard-combat-rig.mjs';
import {loadCombatActorAssets} from '../../../apps/courtyard/courtyard-combat-actors.mjs';

const joints=['swordElbow','freeElbow','swordWrist','freeWrist','grip','hand','tip'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cases=[['right','attack'],['left','attack'],['left','spell']];

test('human sample keeps both arm bones at their authored lengths and limits the wrist',()=>{
 for(const [facing,action] of cases)for(const phase of ['windup','release','recovery'])for(let i=0;i<=120;i++){
  const q=combatRigPose({facing,action,phase,progress:i/120,direction:{x:facing==='left'?-1:1,y:0}});
  for(const [a,b,length] of [['swordShoulder','swordElbow',24],['swordElbow','swordWrist',21],['freeShoulder','freeElbow',24],['freeElbow','freeWrist',21]])assert(Math.abs(distance(q[a],q[b])-length)<1e-9);
  assert(q.wristBend<=70*Math.PI/180+1e-9);
 }
});

test('human sample has continuous rest, windup, contact and recovery boundaries',()=>{
 for(const [facing,action] of cases)for(const [a,ap,b,bp] of [['idle',0,'windup',0],['windup',1,'release',0],['release',1,'recovery',0],['recovery',1,'idle',0]]){
  const args={facing,direction:{x:facing==='left'?-1:1,y:0}};
  const q=combatRigPose({...args,action:a==='idle'?'idle':action,phase:a,progress:ap});
  const r=combatRigPose({...args,action:b==='idle'?'idle':action,phase:b,progress:bp});
  for(const field of joints)assert(distance(q[field],r[field])<1e-8,`${facing} ${action} ${a}->${b}: ${field}`);
 }
});

test('human authored elbow branch does not flip during the three sample actions',()=>{
 for(const [facing,action] of cases)for(const phase of ['windup','release','recovery']){
  let previous;
  for(let i=0;i<=1000;i++){
   const q=combatRigPose({facing,action,phase,progress:i/1000,direction:{x:facing==='left'?-1:1,y:0}});
   if(previous)for(const field of joints)assert(distance(q[field],previous[field])<2,`${facing} ${action} ${phase} ${i/1000}: ${field}`);
   previous=q;
  }
 }
});

test('historical rig cache contains complete blades within its returned bounds',async()=>{
 const {createCanvas,loadImage}=await import('@napi-rs/canvas');
 const assets=await loadCombatActorAssets({includeRigStudy:true,loadImage:name=>loadImage(new URL('../../../assets/courtyard/'+name,import.meta.url)),makeCanvas:createCanvas});
 const rig=createCombatRig(assets),reference=createCanvas(768,640),rctx=reference.getContext('2d'),origin={x:384,y:550};
 rctx.imageSmoothingEnabled=false;
 for(const [facing,action] of cases)for(const phase of ['windup','release','recovery']){
  const steps=phase==='windup'?12:phase==='release'?6:9;
  for(let i=0;i<=steps;i++){
   const f=rig.image({action,phase,progress:i/steps,facing,direction:{x:facing==='left'?-1:1,y:0}}),tip={x:f.origin.x+f.pose.tip.x*2,y:f.origin.y+f.pose.tip.y*2};
   assert(tip.x>=4&&tip.x<f.canvas.width-4&&tip.y>=4&&tip.y<f.canvas.height-4);
   rctx.clearRect(0,0,768,640);rctx.save();rctx.translate(origin.x,origin.y);rig.drawRaw(rctx,f.pose,222);rctx.restore();
   const pixels=rctx.getImageData(0,0,768,640).data;let left=768,right=0,top=640,bottom=0;
   for(let y=0;y<640;y++)for(let x=0;x<768;x++)if(pixels[(y*768+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   assert(left-origin.x>=-f.origin.x&&right-origin.x<f.canvas.width-f.origin.x,`${facing} ${action} ${phase} ${i}: horizontal clipping`);
   assert(top-origin.y>=-f.origin.y&&bottom-origin.y<f.canvas.height-f.origin.y,`${facing} ${action} ${phase} ${i}: vertical clipping`);
  }
 }
 // Production whole-frame blitting and anchor placement are covered by courtyard-combat-frames.test.mjs.
 const stats=rig.cacheStats();assert(stats.entries<=96);assert(stats.pixelBytes<=stats.pixelLimit);
});
