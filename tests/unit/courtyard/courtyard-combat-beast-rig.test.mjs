import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createCombatBeastRig,sampleCombatBeastPose} from '../../../apps/courtyard/courtyard-combat-beast-rig.mjs';

test('山魈抬臂与髋肩分开发力，真实释放边界双掌接触并保留支撑脚',()=>{
 const idle=sampleCombatBeastPose({phase:'idle',tick:0}),load=sampleCombatBeastPose({phase:'windup',progress:.72}),end=sampleCombatBeastPose({phase:'windup',progress:1}),release=sampleCombatBeastPose({phase:'release',progress:0});
 assert.ok(load.nearHand.y<idle.nearHand.y-70);
 assert.ok(load.chest.y<idle.chest.y-10);
 assert.ok(load.hip.x>idle.hip.x+3);
 assert.deepEqual(load.supportFoot,idle.supportFoot);
 for(const key of ['nearHand','farHand','hip','chest','neck'])assert.deepEqual(end[key],release[key]);
 assert.ok(release.nearHand.y>load.nearHand.y+90);
 assert.deepEqual(release.supportFoot,idle.supportFoot);
 const restored=sampleCombatBeastPose({phase:'recovery',progress:1});
 for(const key of ['nearHand','farHand','hip','chest','neck'])assert.deepEqual(restored[key],idle[key]);
});

test('山魈轻重受击沿真实来向后仰并以另一只脚支撑',()=>{
 for(const facing of ['left','right']){
  const direction={x:facing==='left'?1:-1,y:0},idle=sampleCombatBeastPose({phase:'idle',facing,tick:0}),light=sampleCombatBeastPose({phase:'hit',progress:.28,facing,direction,reaction:'light'}),heavy=sampleCombatBeastPose({phase:'hit',progress:.28,facing,direction,reaction:'heavy'}),first=sampleCombatBeastPose({phase:'hit',progress:0,facing,direction,reaction:'heavy'});
  assert.ok((first.neck.x-idle.neck.x)*direction.x>4);
  assert.ok((heavy.neck.x-idle.neck.x)*direction.x>10);
  assert.ok(Math.abs(heavy.chest.x-idle.chest.x)>Math.abs(light.chest.x-idle.chest.x));
  assert.deepEqual(heavy.supportFoot,idle.supportFoot);
  assert.notDeepEqual(heavy.farFoot,idle.farFoot);
 }
});

test('山魈动作缓存预热后覆盖日常动作，同一暂停采样像素一致且内存有界',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../../../assets/courtyard/valley-shanxiao-actions-v1.png',import.meta.url)));let allocations=0;
 const rig=createCombatBeastRig({images:{foeActions:image},makeCanvas:(w,h)=>{allocations++;return createCanvas(w,h);}});
 await rig.prewarm();const warm=rig.cacheStats(),allocationStart=allocations;
 assert.equal(warm.entries,172);assert.ok(warm.pixelBytes<12*1024*1024);
 for(const facing of ['left','right'])for(const phase of ['windup','release','recovery','hit','idle','move'])for(let i=0;i<120;i++)rig.image({facing,phase,progress:i/119,tick:i/3,reaction:i%2?'heavy':'light'});
 assert.equal(allocations,allocationStart);
 const sample={phase:'windup',progress:.78,facing:'left',tick:900},before=structuredClone(sample),a=rig.image(sample),b=rig.image({...sample,tick:990});
 assert.equal(a,b);assert.deepEqual(a.canvas.toBuffer('image/png'),b.canvas.toBuffer('image/png'));assert.deepEqual(sample,before);
 const steadyMisses=rig.cacheStats().misses;
 for(let i=0;i<1000;i++)rig.image({phase:'idle',facing:'left',progress:i/1000,tick:1200+i});
 assert.equal(rig.cacheStats().misses,steadyMisses);
 for(let i=0;i<2000;i++)rig.image({phase:'hit',facing:i%2?'left':'right',progress:i/2000,reaction:i%3?'light':'heavy',direction:{x:i%5-2,y:i%7-3},tick:i});
 const stats=rig.cacheStats();assert.ok(stats.entries<=stats.limit);assert.ok(stats.pixelBytes<=stats.pixelLimit);
});
