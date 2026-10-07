import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
 ESTATE_ART_URLS,ESTATE_SPRITES,FARM_STAGE_ART,LUMBER_STAGE_ART,QUARRY_STAGE_ART,MEDITATION_STAGE_ART,
 drawEstateExterior,estateSpriteBounds,estateStageImageReady,
} from '../dist/ea-estate-assets.mjs';
import {estateBuildingVisualStage} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const stages=['preview','foundation','structure','finishing','complete','upgrade','damaged'];
const camera={w:1024,h:768,scale:32,depth:.62,rotation:Math.PI/4,ox:500,oy:100};
const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
const cases={farm:{art:FARM_STAGE_ART,work:4,cultivate:0},lumber:{art:LUMBER_STAGE_ART,work:2,cultivate:0},quarry:{art:QUARRY_STAGE_ART,work:2,cultivate:0},meditation:{art:MEDITATION_STAGE_ART,work:2,cultivate:4}};
const building=type=>Object.freeze({id:`qa:${type}`,instanceId:99,type,level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:Object.freeze({x:12,y:12,orientation:'south'})});

for(const [type,{art,work,cultivate}] of Object.entries(cases))test(`SR-XF-004-AC-01: ${type} seven stage sprites keep the real prefab and access`,async()=>{
 const b=building(type),before=JSON.stringify(b),prefab=spatialPrefab(b);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='work').length,work);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='cultivate').length,cultivate);
 assert.deepEqual(Object.keys(art),stages);
 assert.equal(ESTATE_ART_URLS[`${type}Stages`],`./assets/estate-v1/${type}-stages-v1.png`);
 const image=await loadImage(fileURLToPath(new URL(`../dist/assets/estate-v1/${type}-stages-v1.png`,import.meta.url)));
 assert.equal(estateStageImageReady(type,image),true);
 const source=createCanvas(image.width,image.height),sourceContext=source.getContext('2d');
 sourceContext.drawImage(image,0,0);const pixels=sourceContext.getImageData(0,0,image.width,image.height).data;
 const complete=estateSpriteBounds(b,camera,{...geometry,visualStage:'complete'}),signatures=new Set();
 for(const stage of stages){
  const box=estateSpriteBounds(b,camera,{...geometry,visualStage:stage}),[x,y,w,h]=art[stage].rect;
  assert.deepEqual(box.corners,complete.corners,`${stage} keeps metre footprint`);
  assert.deepEqual(box.door,complete.door,`${stage} keeps prefab entrance`);
  assert.equal(box.bottom,complete.bottom,`${stage} keeps ground anchor`);
  assert.ok(Math.abs(box.width-complete.width)<1e-8&&Math.abs(box.height-complete.height)<1e-8,`${stage} keeps displayed extent`);
  assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height);
  let count=0,red=0,green=0,blue=0;
  for(let yy=y;yy<y+h;yy+=3)for(let xx=x;xx<x+w;xx+=3){const index=(yy*image.width+xx)*4;if(pixels[index+3]<=96)continue;count++;red+=pixels[index];green+=pixels[index+1];blue+=pixels[index+2];}
  assert.ok(count>2500,`${stage} has authored visible art`);
  signatures.add([count,Math.round(red/count),Math.round(green/count),Math.round(blue/count)].join(','));
  assert.equal(drawEstateExterior(createCanvas(camera.w,camera.h).getContext('2d'),b,camera,{[`${type}Stages`]:image},{...geometry,visualStage:stage}),true);
 }
 assert.equal(signatures.size,7,'seven actual painted states are distinct');
 assert.equal(JSON.stringify(b),before,'painting leaves the saved building untouched');
});

test('SR-XF-004-AC-01: farm plot openings expose runtime crop paint',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/farm-stages-v1.png',import.meta.url)));
 const source=createCanvas(image.width,image.height),ctx=source.getContext('2d');ctx.drawImage(image,0,0);
 for(const [x,y] of [[220,610],[145,660],[300,660],[220,720]]){
  assert.ok(ctx.getImageData(x,y,1,1).data[3]<32,`growing plot at ${x},${y} is transparent`);
 }
});

test('SR-XF-004-AC-01: damaged and upgrade art follows the real spatial order',()=>{
 for(const type of Object.keys(cases)){
  const b={...building(type),spatialLock:'work:construction:99'},s={workOrdersById:{[b.spatialLock]:{operation:'upgrade'}}};
  assert.equal(estateBuildingVisualStage(s,b),'upgrade');
  s.workOrdersById[b.spatialLock].operation='relocate';
  assert.equal(estateBuildingVisualStage(s,b),'complete');
  b.condition=30;assert.equal(estateBuildingVisualStage(s,b),'damaged');
 }
});

test('SR-XF-004-AC-01: absent or invalid outdoor stage image uses prior art or field',()=>{
 const old={width:1536,height:1024},invalid={width:1,height:1};
 for(const type of ['lumber','quarry','meditation']){
  const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  assert.equal(drawEstateExterior(ctx,building(type),camera,{[`${type}Stages`]:invalid,outdoor:old},{...geometry,visualStage:'foundation'}),true);
  const draw=calls.find(call=>call[0]==='drawImage');assert.equal(draw[1],old);
  assert.deepEqual(draw.slice(2,6),ESTATE_SPRITES[type].rect);
 }
 const farm=building('farm');
 assert.equal(drawEstateExterior(createCanvas(camera.w,camera.h).getContext('2d'),farm,camera,{farmStages:invalid},{...geometry,visualStage:'complete'}),false);
});
