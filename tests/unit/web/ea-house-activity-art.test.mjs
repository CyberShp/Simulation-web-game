import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';
import {
  CULTIVATOR_ATLAS,CULTIVATOR_ACTIVITY_ATLAS,cultivatorSpriteFrame,drawCultivator,
  registerCultivatorActivityAtlas,hasCultivatorActivityAtlas,
} from '../../../apps/web/ea-character-art.mjs';

// U-156 retires the estate scene artwork; shared slots and character art remain covered.
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
function recorder(){
  const calls=[];
  const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  return {ctx,calls};
}

test('SR-XF-004: outdoor work and cultivation places remain in the shared prefab',()=>{
  for(const [type,grid] of [['lumber',true],['quarry',true],['meditation',true],['well',true],['well',false]]){
    const b={type,level:1,...(grid?{buildingGridVersion:BUILDING_GRID.version}:{})};
    const slots=spatialPrefab(b).slots.filter(slot=>['work','cultivate'].includes(slot.kind));
    assert.ok(slots.length>0,`${type} has actual places`);
  }
  assert.equal(spatialPrefab({type:'watchtower',level:1,buildingGridVersion:BUILDING_GRID.version}).slots.length,0);
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
  const image=await loadImage(fileURLToPath(new URL('../../../assets/web/estate-v1/characters-wait-study-v1.png',import.meta.url)));
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
