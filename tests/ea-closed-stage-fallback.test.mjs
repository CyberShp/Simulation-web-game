import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {drawEstateExterior,estateStageImageReady} from '../dist/ea-estate-assets.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';

const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const versions={hall:'v2',house:'v2',clinic:'v2',library:'v3',alchemy:'v3',kitchen:'v3',workshop:'v3'};
const camera={w:1024,h:768,scale:32,depth:.65,ox:80,oy:80};
const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};

test('closed buildings reject same-size historical art and never draw exposed interior fallbacks',async()=>{
 for(const [type,version] of Object.entries(versions)){
  const source=path=>fileURLToPath(new URL(`../dist/assets/estate-v1/${path}`,import.meta.url));
  const current=await loadImage(source(`${type}-stages-${version}.png`));
  const historical=await loadImage(source(`${type}-stages-v1.png`));
  const canvasFactory=()=>createCanvas(1,1);
  assert.equal(estateStageImageReady(type,current,canvasFactory),true,`${type} current art`);
  assert.equal(estateStageImageReady(type,historical,canvasFactory),false,`${type} old art has the same dimensions but wrong contents`);
  const building={id:`qa:${type}`,type,level:1,condition:100,transform:{x:10,y:10,orientation:'south'}};
  const before=JSON.stringify(building),ctx=createCanvas(1024,768).getContext('2d');
  assert.equal(drawEstateExterior(ctx,building,camera,{[`${type}Stages`]:historical,core:historical,life:historical},{...geometry,visualStage:'complete'}),false,`${type} rejects same-size historical artwork`);
  const images={[`${type}Stages`]:{width:1,height:1},core:historical,life:historical};
  assert.equal(drawEstateExterior(ctx,building,camera,images,{...geometry,visualStage:'complete'}),false,`${type} uses sealed geometry fallback`);
  assert.equal(JSON.stringify(building),before,`${type} keeps actual footprint, slots and save state`);
 }
});
