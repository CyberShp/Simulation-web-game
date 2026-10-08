/** U-101 / PERF-01: completed building art is reused at the current display scale. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createEstateExteriorRasterCache,drawEstateExterior} from '../dist/ea-estate-assets.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';

test('U-101: full-resolution building sprites reuse only matching art and scale',async()=>{
 const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
 const previous=globalThis.OffscreenCanvas;
 globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h);}};
 try{
  const hall=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/hall-stages-v2.png',import.meta.url)));
  const house=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/house-stages-v2.png',import.meta.url)));
  const building=type=>({id:`qa:${type}`,type,level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:{x:12,y:12,orientation:'south'}});
  const hallBuilding=building('hall'),houseBuilding=building('house');
  const camera={w:1200,h:849,scale:32,depth:.62,rotation:Math.PI/4,ox:600,oy:-100};
  const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
  const images={hallStages:hall,houseStages:house},size=[2100,1486];
  const canvas=()=>{const c=createCanvas(...size),ctx=c.getContext('2d');ctx.setTransform(1.75,0,0,1.75,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';return{c,ctx};};
  const before=JSON.stringify(hallBuilding),original=canvas(),cached=canvas(),cache=createEstateExteriorRasterCache();
  assert.equal(drawEstateExterior(original.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete'}),true);
  assert.equal(drawEstateExterior(cached.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:cache}),true);
  assert.deepEqual(cache.snapshot().entries,1);
  const firstBytes=cache.snapshot().bytes;
  assert.ok(firstBytes>0&&firstBytes<32*1024*1024);
  cached.ctx.clearRect(0,0,camera.w,camera.h);
  drawEstateExterior(cached.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:cache});
  assert.deepEqual(cache.snapshot(),{entries:1,bytes:firstBytes},'unchanged art and screen scale reuse one bitmap');

  const a=original.ctx.getImageData(0,0,...size).data,b=cached.ctx.getImageData(0,0,...size).data;
  let difference=0,strongPixels=0;
  const bounds=[{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity},{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}];
  for(let i=0;i<a.length;i+=4){
   difference+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
   if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>24)strongPixels++;
   const x=(i/4)%size[0],y=Math.floor(i/4/size[0]);
   for(const [index,pixels]of [[0,a],[1,b]])if(pixels[i+3]>96){const bound=bounds[index];bound.left=Math.min(bound.left,x);bound.top=Math.min(bound.top,y);bound.right=Math.max(bound.right,x);bound.bottom=Math.max(bound.bottom,y);}
  }
  const meanDifference=difference/(size[0]*size[1]*3),strongShare=strongPixels/(size[0]*size[1]);
  assert.ok(meanDifference<3&&strongShare<.02,`the same stage and anchor remain legible: mean ${meanDifference.toFixed(2)}, strong ${strongShare.toFixed(4)}`);
  for(const edge of ['left','top','right','bottom'])assert.ok(Math.abs(bounds[0][edge]-bounds[1][edge])<=2,`${edge} edge and entrance remain anchored`);
  assert.equal(JSON.stringify(hallBuilding),before,'rendering keeps the building fact unchanged');

  const paced=createEstateExteriorRasterCache();
  paced.beginFrame();
  drawEstateExterior(cached.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:paced});
  drawEstateExterior(cached.ctx,houseBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:paced});
  assert.equal(paced.snapshot().entries,1,'only one new full-resolution sprite is prepared per frame');
  paced.beginFrame();
  drawEstateExterior(cached.ctx,houseBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:paced});
  assert.equal(paced.snapshot().entries,2,'the deferred building is cached on the next frame');

  drawEstateExterior(cached.ctx,hallBuilding,camera,images,{...geometry,visualStage:'damaged',rasterCache:cache});
  drawEstateExterior(cached.ctx,hallBuilding,{...camera,scale:35},images,{...geometry,visualStage:'complete',rasterCache:cache});
  assert.equal(cache.snapshot().entries,3,'stage and zoom each get their own raster');
  const replacement=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/hall-stages-v2.png',import.meta.url)));
  drawEstateExterior(cached.ctx,hallBuilding,camera,{hallStages:replacement},{...geometry,visualStage:'complete',rasterCache:cache});
  assert.equal(cache.snapshot().entries,4,'reloaded art has a distinct identity');

  const budget=Math.ceil(firstBytes*1.2),bounded=createEstateExteriorRasterCache({maxBytes:budget});
  drawEstateExterior(cached.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:bounded});
  drawEstateExterior(cached.ctx,houseBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:bounded});
  assert.ok(bounded.snapshot().bytes<=budget&&bounded.snapshot().entries<=1,'zoom and art changes cannot grow the cache beyond its budget');
  bounded.clear();assert.deepEqual(bounded.snapshot(),{entries:0,bytes:0});

  globalThis.OffscreenCanvas=undefined;
  const fallback=canvas();
  drawEstateExterior(fallback.ctx,hallBuilding,camera,images,{...geometry,visualStage:'complete',rasterCache:cache});
  assert.deepEqual(fallback.c.toBuffer('image/png'),original.c.toBuffer('image/png'),'unsupported offscreen canvas draws the original art');
  console.log(JSON.stringify({bitmap:size,meanDifference:+meanDifference.toFixed(2),strongShare:+strongShare.toFixed(4),cacheBytes:firstBytes}));
 }finally{if(previous===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=previous;}
});
