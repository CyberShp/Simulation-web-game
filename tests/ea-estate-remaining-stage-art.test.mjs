import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
 ESTATE_ART_URLS,ESTATE_SPRITES,ALCHEMY_STAGE_ART,WELL_STAGE_ART,GRANARY_STAGE_ART,
 KITCHEN_STAGE_ART,WORKSHOP_STAGE_ART,WATCHTOWER_STAGE_ART,
 drawEstateExterior,estateSpriteBounds,estateStageImageReady,
} from '../dist/ea-estate-assets.mjs';
import {estateBuildingVisualStage} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';

const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const stages=['preview','foundation','structure','finishing','complete','upgrade','damaged'];
const camera={w:1024,h:768,scale:32,depth:.62,rotation:Math.PI/4,ox:500,oy:100};
const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
const cases={alchemy:{art:ALCHEMY_STAGE_ART,work:1,furniture:'furnace',fallback:'core'},well:{art:WELL_STAGE_ART,work:1,fallback:'outdoor'},granary:{art:GRANARY_STAGE_ART,work:4},kitchen:{art:KITCHEN_STAGE_ART,work:1,furniture:'stove',fallback:'life'},workshop:{art:WORKSHOP_STAGE_ART,work:2,furniture:'bench',fallback:'core'},watchtower:{art:WATCHTOWER_STAGE_ART,work:0,fallback:'life'}};
const building=type=>Object.freeze({id:`qa:${type}`,instanceId:'building:yunxiu:99',type,level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:Object.freeze({x:12,y:12,orientation:'south'})});

for(const [type,{art,work,furniture,fallback}] of Object.entries(cases))test(`SR-XF-004-AC-01: ${type} seven states retain one prefab and visual scale`,async()=>{
 const b=building(type),before=JSON.stringify(b),prefab=spatialPrefab(b);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='work').length,work);
 if(furniture)assert.ok(prefab.furniture.some(item=>item.kind===furniture));
 assert.deepEqual(Object.keys(art),stages);
 const version=['alchemy','kitchen','workshop'].includes(type)?'v3':'v1';
 assert.equal(ESTATE_ART_URLS[`${type}Stages`],`./assets/estate-v1/${type}-stages-${version}.png`);
 const image=await loadImage(fileURLToPath(new URL(`../dist/assets/estate-v1/${type}-stages-${version}.png`,import.meta.url)));
 assert.equal(estateStageImageReady(type,image),true);
 const source=createCanvas(image.width,image.height),sc=source.getContext('2d');sc.drawImage(image,0,0);
 const pixels=sc.getImageData(0,0,image.width,image.height).data,signatures=new Set();
 const complete=estateSpriteBounds(b,camera,{...geometry,visualStage:'complete'});
 for(const stage of stages){
  const box=estateSpriteBounds(b,camera,{...geometry,visualStage:stage}),[x,y,w,h]=art[stage].rect;
  assert.deepEqual(box.corners,complete.corners,`${stage} keeps footprint`);
  assert.deepEqual(box.door,complete.door,`${stage} keeps entrance`);
  assert.equal(box.bottom,complete.bottom,`${stage} keeps base anchor`);
  assert.ok(Math.abs(box.width-complete.width)<1e-8&&Math.abs(box.height-complete.height)<1e-8,`${stage} keeps display dimensions`);
  assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height);
  let visible=0,red=0,green=0,blue=0;
  for(let yy=y;yy<y+h;yy+=3)for(let xx=x;xx<x+w;xx+=3){const i=(yy*image.width+xx)*4;if(pixels[i+3]<=96)continue;visible++;red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];}
  assert.ok(visible>2000,`${stage} has painted artwork`);
  signatures.add([visible,Math.round(red/visible),Math.round(green/visible),Math.round(blue/visible)].join(','));
  assert.equal(drawEstateExterior(createCanvas(camera.w,camera.h).getContext('2d'),b,camera,{[`${type}Stages`]:image},{...geometry,visualStage:stage}),true);
 }
 assert.equal(signatures.size,7,`${type} has seven distinct visuals`);
 assert.equal(JSON.stringify(b),before,'rendering preserves saved state');
 const invalid={width:1,height:1},calls=[];
 const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
 const images={[`${type}Stages`]:invalid,...(fallback?{[fallback]:fallback==='outdoor'?{width:1536,height:1024}:{width:1280,height:1280}}:{})};
 const closed=['alchemy','kitchen','workshop'].includes(type);
 assert.equal(drawEstateExterior(ctx,b,camera,images,{...geometry,visualStage:'structure'}),!!fallback&&!closed);
 if(fallback&&!closed)assert.deepEqual(calls.find(call=>call[0]==='drawImage').slice(2,6),ESTATE_SPRITES[type].rect);
});

test('SR-XF-004-AC-01: spirit-rice openings expose the runtime field',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/granary-stages-v1.png',import.meta.url)));
 const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 for(const [x,y] of [[220,610],[140,660],[300,660],[220,720]])assert.ok(ctx.getImageData(x,y,1,1).data[3]<32,`${x},${y} exposes live rice growth`);
});

test('SR-XF-004-AC-01: construction operation and damage select the matching six atlases',()=>{
 for(const type of Object.keys(cases)){
  const b={...building(type),spatialLock:'work:construction:99'},s={workOrdersById:{[b.spatialLock]:{operation:'upgrade'}}};
  assert.equal(estateBuildingVisualStage(s,b),'upgrade');
  s.workOrdersById[b.spatialLock].operation='relocate';assert.equal(estateBuildingVisualStage(s,b),'complete');
  b.condition=30;assert.equal(estateBuildingVisualStage(s,b),'damaged');
 }
});
