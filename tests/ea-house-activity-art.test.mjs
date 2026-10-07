import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
  ESTATE_ART_URLS,ESTATE_SPRITES,HOUSE_STAGE_ART,estateSpriteBounds,drawEstateExterior,houseStageImageReady,
} from '../dist/ea-estate-assets.mjs';
import {estateBuildingVisualStage} from '../dist/ea-courtyard-renderer.mjs';
import {drawEstateOutdoorFallback} from '../dist/ea-estate-ground-art.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';
import {
  CULTIVATOR_ATLAS,CULTIVATOR_ACTIVITY_ATLAS,cultivatorSpriteFrame,drawCultivator,
  registerCultivatorActivityAtlas,hasCultivatorActivityAtlas,
} from '../dist/ea-character-art.mjs';

const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const camera={scale:32};
const geometry={
  project:({x,y})=>({x:(x-y)*20,y:(x+y)*11}),
  prefab:()=>({width:6,height:6,door:{x:3,y:6}}),
  transform:()=>({x:10,y:10}),
};
const house=Object.freeze({id:'qa:house',type:'house',level:1});
function recorder(){
  const calls=[];
  const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  return {ctx,calls};
}

test('SR-XF-004: seven house images share one metre footprint and use closed geometry when missing',()=>{
  const stages=['preview','foundation','structure','finishing','complete','upgrade','damaged'];
  const stageImage={width:1774,height:887},lifeImage={width:1280,height:1280};
  const images={houseStages:stageImage,life:lifeImage},before=JSON.stringify(house);
  const complete=estateSpriteBounds(house,camera,{...geometry,visualStage:'complete'});
  const crops=new Set();
  for(const visualStage of stages){
    const box=estateSpriteBounds(house,camera,{...geometry,visualStage});
    const {ctx,calls}=recorder();
    assert.equal(drawEstateExterior(ctx,house,camera,images,{...geometry,visualStage}),true);
    const draw=calls.find(c=>c[0]==='drawImage');
    assert.equal(draw[1],stageImage);
    assert.deepEqual(draw.slice(2,6),HOUSE_STAGE_ART[visualStage].rect);
    crops.add(draw.slice(2,6).join(','));
    assert.deepEqual(box.corners,complete.corners);
    assert.deepEqual(box.door,complete.door);
    assert.equal(box.bottom,complete.bottom);
  }
  assert.equal(crops.size,7,'each stage has distinct source artwork');
  const {ctx,calls}=recorder();
  assert.equal(drawEstateExterior(ctx,house,camera,{life:lifeImage},{...geometry,visualStage:'foundation'}),false);
  assert.equal(calls.some(c=>c[0]==='drawImage'),false);
  const invalid={width:1,height:1};
  assert.equal(houseStageImageReady(invalid),false);
  const broken=recorder();
  assert.equal(drawEstateExterior(broken.ctx,house,camera,{houseStages:invalid,life:lifeImage},{...geometry,visualStage:'upgrade'}),false);
  assert.equal(broken.calls.some(c=>c[0]==='drawImage'),false,'old-sized art must use the closed geometry fallback');
  assert.equal(drawEstateExterior(recorder().ctx,house,camera,{houseStages:invalid,life:invalid},{...geometry,visualStage:'upgrade'}),false,'broken fallback allows metre-aligned geometry');
  assert.equal(ESTATE_ART_URLS.houseStages,'./assets/estate-v1/house-stages-v2.png');
  assert.equal(JSON.stringify(house),before,'rendering cannot change house progress or footprint');
});

test('SR-XF-004: old house stage follows the actual construction operation',()=>{
 const orderId='work:construction:8';
 const s={workOrdersById:{[orderId]:{operation:'upgrade'}}};
 const b={type:'house',spatialLock:orderId,condition:100};
 assert.equal(estateBuildingVisualStage(s,b),'upgrade');
 s.workOrdersById[orderId].operation='relocate';
 assert.equal(estateBuildingVisualStage(s,b),'complete');
 s.workOrdersById[orderId].operation='demolish';
 assert.equal(estateBuildingVisualStage(s,b),'complete');
 b.condition=30;
 assert.equal(estateBuildingVisualStage(s,b),'damaged');
});

test('SR-XF-004: missing outdoor art paints every authoritative work and cultivation place',()=>{
  const c={w:1024,h:768,scale:32,depth:.65,ox:60,oy:60};
  const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
  for(const [type,grid] of [['lumber',true],['quarry',true],['meditation',true],['well',true],['well',false]]){
    const b=Object.freeze({id:`qa:${type}:${grid}`,type,level:1,...(grid?{buildingGridVersion:BUILDING_GRID.version}:{}),transform:Object.freeze({x:10,y:10,orientation:'south'})});
    const before=JSON.stringify(b),d=spatialPrefab(b),canvas=createCanvas(c.w,c.h),ctx=canvas.getContext('2d');
    assert.equal(drawEstateOutdoorFallback(ctx,b,c,geometry),true,`${type} has visible vector art`);
    const slots=d.slots.filter(slot=>['work','cultivate'].includes(slot.kind));
    assert.ok(slots.length>0,`${type} has actual places`);
    for(const slot of slots){
      const p=spatialProject({x:b.transform.x+slot.position.x,y:b.transform.y+slot.position.y},c);
      assert.ok(ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data[3]>0,`${type} ${slot.suffix} is visibly marked at its real position`);
    }
    assert.equal(JSON.stringify(b),before,`${type} artwork cannot change its saved state`);
  }
  for(const type of ['farm','granary','house']){
    const b={type,level:1,transform:{x:10,y:10}};
    assert.equal(drawEstateOutdoorFallback(createCanvas(c.w,c.h).getContext('2d'),b,c,geometry),false,`${type} keeps its own renderer`);
  }
  const tower={type:'watchtower',level:1,buildingGridVersion:BUILDING_GRID.version,transform:{x:10,y:10}};
  const towerCanvas=createCanvas(c.w,c.h),towerContext=towerCanvas.getContext('2d');
  assert.equal(spatialPrefab(tower).slots.length,0);
  assert.equal(drawEstateOutdoorFallback(towerContext,tower,c,geometry),true,'tower remains recognizable without invented capacity');
  const middle=spatialProject({x:12,y:12},c);
  assert.ok(towerContext.getImageData(Math.round(middle.x),Math.round(middle.y),1,1).data[3]>0);
});

test('SR-XF-004: registered source crops contain isolated alpha and distinguish construction from completion',async()=>{
  const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/house-stages-v2.png',import.meta.url)));
  assert.equal(image.width,1774);assert.equal(image.height,887);
  const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,image.width,image.height).data;
  const signatures=[];
  for(const [stage,{rect:[x,y,w,h]}] of Object.entries(HOUSE_STAGE_ART)){
    let opaque=0,red=0,green=0,blue=0;
    for(let yy=y;yy<y+h;yy+=3)for(let xx=x;xx<x+w;xx+=3){
      const i=(yy*image.width+xx)*4,a=data[i+3];
      if(a>96){opaque++;red+=data[i];green+=data[i+1];blue+=data[i+2];}
    }
    assert.ok(opaque>400,`${stage} has visible authored pixels`);
    signatures.push([opaque,Math.round(red/opaque),Math.round(green/opaque),Math.round(blue/opaque)].join(','));
  }
  assert.equal(new Set(signatures).size,7);
});

test('SR-XF-007: six persistent identities use real static waiting and seated-study bodies without changing state',()=>{
  const base={width:CULTIVATOR_ATLAS.width,height:CULTIVATOR_ATLAS.height,complete:true};
  const activity={width:CULTIVATOR_ACTIVITY_ATLAS.width,height:CULTIVATOR_ACTIVITY_ATLAS.height,complete:true};
  assert.equal(registerCultivatorActivityAtlas(activity),true);
  try{
    for(let spriteIndex=0;spriteIndex<6;spriteIndex++)for(const action of ['waiting','study']){
      const view=Object.freeze({spriteIndex,action,recipe:Object.freeze({height:1.75}),mounts:Object.freeze({})});
      const before=JSON.stringify(view),{ctx,calls}=recorder();
      const pose=drawCultivator(ctx,view,{atlas:base,activityAtlas:activity,tick:13});
      const draw=calls.find(c=>c[0]==='drawImage');
      assert.equal(draw[1],activity);
      assert.deepEqual(draw.slice(2,6),Object.values(CULTIVATOR_ACTIVITY_ATLAS.frames[action][spriteIndex]).slice(0,4));
      assert.equal(pose.art.column,spriteIndex);
      assert.equal(pose.art.sourcePose,action);
      assert.equal(pose.art.dedicatedPoseAvailable,true);
      assert.equal(pose.art.animated,false);
      assert.deepEqual(cultivatorSpriteFrame(view,2),cultivatorSpriteFrame(view,19));
      assert.equal(JSON.stringify(view),before);
    }
  }finally{registerCultivatorActivityAtlas(null);}
});

test('SR-XF-007: missing activity art, portraits and back views preserve the original identity atlas',()=>{
  const base={width:1536,height:1024,complete:true},wrong={width:1,height:1024,complete:true};
  assert.equal(registerCultivatorActivityAtlas(wrong),false);
  assert.equal(hasCultivatorActivityAtlas(),false);
  const view={spriteIndex:3,action:'study',recipe:{height:1.75}};
  let shot=recorder();drawCultivator(shot.ctx,view,{atlas:base});
  assert.equal(shot.calls.find(c=>c[0]==='drawImage')[1],base);
  assert.equal(cultivatorSpriteFrame(view).dedicatedPoseAvailable,false);
  const activity={width:1536,height:1024,complete:true};registerCultivatorActivityAtlas(activity);
  try{
    for(const extra of [{portrait:true},{facing:'north'}]){
      shot=recorder();const result=drawCultivator(shot.ctx,view,{atlas:base,...extra});
      assert.equal(shot.calls.find(c=>c[0]==='drawImage')[1],base);
      assert.equal(result.art.column,3);
    }
    shot=recorder();drawCultivator(shot.ctx,{...view,action:'rest'},{atlas:base});
    assert.equal(shot.calls.find(c=>c[0]==='drawImage')[1],base);
  }finally{registerCultivatorActivityAtlas(null);}
});

test('SR-XF-007: activity crops contain one visible person each and exclude the extra source row',async()=>{
  const image=await loadImage(fileURLToPath(new URL('../dist/assets/estate-v1/characters-wait-study-v1.png',import.meta.url)));
  assert.equal(image.width,1536);assert.equal(image.height,1024);
  const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,image.width,image.height).data;
  for(const action of ['waiting','study'])for(let column=0;column<6;column++){
    const {x,y,w,h}=CULTIVATOR_ACTIVITY_ATLAS.frames[action][column];
    assert.ok(x>=column*256&&x+w<=(column+1)*256,`${action} ${column} stays in its identity column`);
    assert.ok(y+h<740,`${action} ${column} excludes unregistered lower row`);
    let visible=0;
    for(let yy=y;yy<y+h;yy+=2)for(let xx=x;xx<x+w;xx+=2)
      if(data[(yy*image.width+xx)*4+3]>96)visible++;
    assert.ok(visible>600,`${action} ${column} is a painted body`);
  }
});
