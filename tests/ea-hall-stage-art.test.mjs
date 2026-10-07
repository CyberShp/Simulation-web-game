import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
 ESTATE_ART_URLS,ESTATE_SPRITES,HALL_STAGE_ART,CLINIC_STAGE_ART,LIBRARY_STAGE_ART,
 drawEstateExterior,estateSpriteBounds,estateStageImageReady,
} from '../dist/ea-estate-assets.mjs';
import {estateBuildingVisualStage} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const camera={w:1024,h:768,scale:32,depth:.65,ox:80,oy:80};
const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
const hall=Object.freeze({id:1,type:'hall',level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:Object.freeze({x:10,y:10,orientation:'south'})});
const clinic=Object.freeze({id:2,type:'clinic',level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:Object.freeze({x:10,y:10,orientation:'south'})});
const library=Object.freeze({id:3,type:'library',level:1,condition:100,buildingGridVersion:BUILDING_GRID.version,transform:Object.freeze({x:10,y:10,orientation:'south'})});
const stages=['preview','foundation','structure','finishing','complete','upgrade','damaged'];

test('SR-XF-004-AC-01: hall stage crops are distinct, transparent and keep one prefab anchor',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/hall-stages-v2.png',import.meta.url)));
 assert.equal(estateStageImageReady('hall',image),true);
 assert.equal(ESTATE_ART_URLS.hallStages,'./assets/estate-v1/hall-stages-v2.png');
 const source=createCanvas(image.width,image.height),src=source.getContext('2d');src.drawImage(image,0,0);
 const pixels=src.getImageData(0,0,image.width,image.height).data;
 const before=JSON.stringify(hall),complete=estateSpriteBounds(hall,camera,{...geometry,visualStage:'complete'}),signatures=new Set();
 for(const stage of stages){
  const art=HALL_STAGE_ART[stage],box=estateSpriteBounds(hall,camera,{...geometry,visualStage:stage});
  assert.deepEqual(box.corners,complete.corners,`${stage} keeps footprint`);
  assert.deepEqual(box.door,complete.door,`${stage} keeps door`);
  assert.equal(box.bottom,complete.bottom,`${stage} keeps ground anchor`);
  assert.equal(box.width,complete.width,`${stage} keeps display width`);
  assert.equal(box.height,complete.height,`${stage} keeps display height`);
  const [x,y,w,h]=art.rect;let visible=0,red=0,green=0,blue=0,bottom=-1;
  for(let yy=y;yy<y+h;yy+=2)for(let xx=x;xx<x+w;xx+=2){
   const i=(yy*image.width+xx)*4,a=pixels[i+3];if(a<=96)continue;
   visible++;red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];bottom=Math.max(bottom,yy-y);
  }
  assert.ok(visible>5000,`${stage} contains painted architecture`);
  assert.ok(bottom>=374&&bottom<=378,`${stage} visible stone base stays aligned`);
  signatures.add([visible,Math.round(red/visible),Math.round(green/visible),Math.round(blue/visible)].join(','));
  const canvas=createCanvas(camera.w,camera.h),ctx=canvas.getContext('2d');
  assert.equal(drawEstateExterior(ctx,hall,camera,{hallStages:image}, {...geometry,visualStage:stage}),true);
  const foot=spatialProject({x:hall.transform.x+spatialPrefab(hall).door.x,y:hall.transform.y+spatialPrefab(hall).height},camera);
  const band=ctx.getImageData(Math.round(foot.x)-15,Math.round(box.bottom)-32,30,25).data;
  assert.ok(band.some((value,index)=>index%4===3&&value>96),`${stage} paints near actual entrance anchor`);
 }
 assert.equal(signatures.size,7,'all seven authored appearances differ');
 assert.equal(JSON.stringify(hall),before,'rendering does not change building state');
});

test('SR-XF-004-AC-01: missing or old-sized hall art falls back without changing the building',()=>{
 const old={width:1280,height:1280};
 const calls=[];
 const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
 assert.equal(estateStageImageReady('hall',{width:1,height:1}),false);
 assert.equal(drawEstateExterior(ctx,hall,camera,{hallStages:{width:1,height:1},core:old},{...geometry,visualStage:'foundation'}),false);
 assert.equal(calls.some(call=>call[0]==='drawImage'),false,'closed fallback must not reveal old interior atlas');
 assert.equal(drawEstateExterior(ctx,hall,camera,{hallStages:{width:1,height:1},core:{width:1,height:1}},{...geometry,visualStage:'foundation'}),false);
});

test('SR-XF-004-AC-01: clinic phases retain four visible physical beds and one entrance',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/clinic-stages-v2.png',import.meta.url)));
 assert.equal(estateStageImageReady('clinic',image),true);
 assert.equal(ESTATE_ART_URLS.clinicStages,'./assets/estate-v1/clinic-stages-v2.png');
 const prefab=spatialPrefab(clinic),beds=prefab.furniture.filter(item=>item.kind==='bed');
 assert.equal(beds.length,4);
 const source=createCanvas(image.width,image.height),src=source.getContext('2d');src.drawImage(image,0,0);
 const pixels=src.getImageData(0,0,image.width,image.height).data,complete=estateSpriteBounds(clinic,camera,{...geometry,visualStage:'complete'}),signatures=new Set();
 for(const stage of stages){
  const box=estateSpriteBounds(clinic,camera,{...geometry,visualStage:stage}),[x,y,w,h]=CLINIC_STAGE_ART[stage].rect;
  assert.deepEqual(box.corners,complete.corners);
  assert.deepEqual(box.door,complete.door);
  assert.equal(box.bottom,complete.bottom);
  assert.equal(box.width,complete.width);
  assert.equal(box.height,complete.height);
  let visible=0,red=0,green=0,blue=0,bottom=-1;
  for(let yy=y;yy<y+h;yy+=2)for(let xx=x;xx<x+w;xx+=2){const i=(yy*image.width+xx)*4;if(pixels[i+3]<=96)continue;visible++;red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];bottom=Math.max(bottom,yy-y);}
  assert.ok(visible>4000,`${stage} has painted clinic architecture`);
  assert.ok(bottom>=372&&bottom<=378,`${stage} keeps the visible stone base aligned`);
  signatures.add([visible,Math.round(red/visible),Math.round(green/visible),Math.round(blue/visible)].join(','));
  assert.equal(drawEstateExterior(createCanvas(camera.w,camera.h).getContext('2d'),clinic,camera,{clinicStages:image},{...geometry,visualStage:stage}),true);
 }
 assert.equal(signatures.size,7);
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
 assert.equal(drawEstateExterior(ctx,clinic,camera,{clinicStages:{width:1,height:1},life:{width:1280,height:1280}},{...geometry,visualStage:'foundation'}),false);
 assert.equal(calls.some(call=>call[0]==='drawImage'),false);
});

test('SR-XF-004-AC-01: library phases retain two physical study desks and one entrance',async()=>{
 const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/library-stages-v3.png',import.meta.url)));
 assert.equal(estateStageImageReady('library',image),true);
 assert.equal(ESTATE_ART_URLS.libraryStages,'./assets/estate-v1/library-stages-v3.png');
 const prefab=spatialPrefab(library);
 assert.equal(prefab.furniture.filter(item=>item.kind==='desk').length,2);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='study').length,2);
 const source=createCanvas(image.width,image.height),src=source.getContext('2d');src.drawImage(image,0,0);
 const pixels=src.getImageData(0,0,image.width,image.height).data,complete=estateSpriteBounds(library,camera,{...geometry,visualStage:'complete'}),signatures=new Set();
 for(const stage of stages){
  const box=estateSpriteBounds(library,camera,{...geometry,visualStage:stage}),[x,y,w,h]=LIBRARY_STAGE_ART[stage].rect;
  assert.deepEqual(box.corners,complete.corners);
  assert.deepEqual(box.door,complete.door);
  assert.equal(box.bottom,complete.bottom);
  assert.equal(box.width,complete.width);
  assert.equal(box.height,complete.height);
  let visible=0,red=0,green=0,blue=0,bottom=-1;
  for(let yy=y;yy<y+h;yy+=2)for(let xx=x;xx<x+w;xx+=2){const i=(yy*image.width+xx)*4;if(pixels[i+3]<=96)continue;visible++;red+=pixels[i];green+=pixels[i+1];blue+=pixels[i+2];bottom=Math.max(bottom,yy-y);}
  assert.ok(visible>4000,`${stage} has painted library architecture`);
  assert.ok(bottom>=352&&bottom<=358,`${stage} keeps the visible stair base aligned`);
  signatures.add([visible,Math.round(red/visible),Math.round(green/visible),Math.round(blue/visible)].join(','));
  assert.equal(drawEstateExterior(createCanvas(camera.w,camera.h).getContext('2d'),library,camera,{libraryStages:image},{...geometry,visualStage:stage}),true);
 }
 assert.equal(signatures.size,7);
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
 assert.equal(drawEstateExterior(ctx,library,camera,{libraryStages:{width:1,height:1},core:{width:1280,height:1280}},{...geometry,visualStage:'structure'}),false);
 assert.equal(calls.some(call=>call[0]==='drawImage'),false);
});

test('SR-XF-004-AC-01: hall visual condition follows the existing spatial order',()=>{
 const orderId='work:construction:1',s={workOrdersById:{[orderId]:{operation:'upgrade'}}};
 const b={...hall,spatialLock:orderId};
 assert.equal(estateBuildingVisualStage(s,b),'upgrade');
 s.workOrdersById[orderId].operation='relocate';
 assert.equal(estateBuildingVisualStage(s,b),'complete');
 b.condition=30;
 assert.equal(estateBuildingVisualStage(s,b),'damaged');
 const healing={...clinic,spatialLock:orderId};
 s.workOrdersById[orderId].operation='upgrade';
 assert.equal(estateBuildingVisualStage(s,healing),'upgrade');
 healing.condition=30;
 assert.equal(estateBuildingVisualStage(s,healing),'upgrade');
 const study={...library,spatialLock:orderId};
 assert.equal(estateBuildingVisualStage(s,study),'upgrade');
});
