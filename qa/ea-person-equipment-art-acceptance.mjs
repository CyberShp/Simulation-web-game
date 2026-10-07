/** Render the earned SR-XF-007-AC-02 states with the production painted body. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as S from '../dist/ea-opening-sim.mjs';
import {drawAppearance} from '../dist/ea-courtyard-renderer.mjs';

const require=createRequire(import.meta.url);
const dir=process.env.XIANFU_QA_SR007_AC02_DIR;
const names=['before','garment','artifact','battle','returned'];
function changed(a,b){let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;}

test('SR-XF-007-AC-02: actual portrait art changes only with earned equipment',async()=>{
 assert(dir,'set XIANFU_QA_SR007_AC02_DIR to earned checkpoint directory');
 const {createCanvas,loadImage}=require('@napi-rs/canvas');
 const atlas=await loadImage(readFileSync(new URL('../dist/yunxiu-courtyard/assets/characters.webp',import.meta.url)));
 assert.equal(atlas.width,1536);assert.equal(atlas.height,1024);
 const pixels={};
 for(const name of names){
  const record=JSON.parse(readFileSync(resolve(dir,`person-${name}.json`),'utf8'));
  assert.equal(record.provenance?.kind,'normal-public-command-checkpoint');
  const s=S.validateSave(record.state),view=S.appearanceView(s,'person:master');
  if(name==='battle'){
   const life=S.personLifeSummary(s,s.master);
   assert.equal(life.activity,'combat');
   assert.equal(life.label,'临敌交锋');
   assert.equal(life.facilityId,null);
   assert.equal(life.slotId,null);
   assert.equal(life.progress,null);
  }
  if(name==='returned')assert.notEqual(S.personLifeSummary(s,s.master).activity,'combat');
  const canvas=createCanvas(220,280),ctx=canvas.getContext('2d');
  ctx.fillStyle='#263d32';ctx.fillRect(0,0,220,280);
  drawAppearance(ctx,{...view,action:'stand'},{x:110,y:255,scale:130,portrait:true,reducedMotion:true,atlas});
  pixels[name]=ctx.getImageData(0,0,220,280).data;
  writeFileSync(resolve(dir,`portrait-${name}.png`),canvas.toBuffer('image/png'));
 }
 assert(changed(pixels.before,pixels.garment)>100,'real robe change is visible');
 assert(changed(pixels.garment,pixels.artifact)>200,'restored robe and crafted artifact are visible');
 assert.equal(changed(pixels.artifact,pixels.battle),0,'battle retains the same static portrait and equipment');
 assert.equal(changed(pixels.artifact,pixels.returned),0,'return retains the same identity and equipment art');
});
