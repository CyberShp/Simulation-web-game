import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {cultivatorSpriteFrame,drawCultivator,registerCultivatorAtlas,hasCultivatorAtlas} from '../dist/ea-character-art.mjs';

const atlas={width:1536,height:1024,complete:true};
const view={personId:'person:qa-painted',spriteIndex:4,accent:'#b29cc5',recipe:{id:'qa:identity',height:1.71,body:'slim',hair:'braid'},action:'stand',mounts:{}};
const actions=['stand','waiting','walk','transport','plant','gather','work','study','teach','rest','groundRest','heal','cultivate','cast','hit','down'];
function recordingContext(){
  const calls=[],values={};
  const ctx=new Proxy(values,{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,calls.push(['set',k,v]),true)});
  return {ctx,calls};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}

test('SR-XF-007: every activity and direction keeps the saved painted identity, without changing the view',()=>{
  const original=freeze(structuredClone(view));
  for(const action of actions)for(const facing of ['east','west','north','nw']){
    const actor=freeze({...original,action}),before=JSON.stringify(actor),{ctx,calls}=recordingContext();
    const pose=drawCultivator(ctx,actor,{atlas,x:102,y:207,scale:36,tick:17,facing});
    assert.equal(pose.art.column,original.spriteIndex);
    assert.equal(calls.filter(c=>c[0]==='drawImage').length,1,'one painted body for work, rest and combat as well as walking');
    assert.equal(JSON.stringify(actor),before);
    assert.equal(pose.art.fullAnimationAvailable,false);
    if(['north','nw'].includes(facing))assert.equal(pose.art.sourcePose,'back');
  }
});

test('SR-XF-007: work is not a walking loop, pause is deterministic, and back/reduced-motion frames remain static',()=>{
  for(const action of actions.filter(a=>!['walk','transport'].includes(a))){
    const a=cultivatorSpriteFrame({...view,action},3),b=cultivatorSpriteFrame({...view,action},17);
    assert.deepEqual(a,b,action);
    assert.equal(a.animated,false);
  }
  const moving={...view,action:'walk'};
  assert.notEqual(cultivatorSpriteFrame(moving,3).row,cultivatorSpriteFrame(moving,17).row);
  assert.deepEqual(cultivatorSpriteFrame(moving,17),cultivatorSpriteFrame(moving,17));
  assert.deepEqual(cultivatorSpriteFrame(moving,3,{facing:'north'}),cultivatorSpriteFrame(moving,17,{facing:'north'}));
  assert.deepEqual(cultivatorSpriteFrame(moving,3,{reducedMotion:true}),cultivatorSpriteFrame(moving,17,{reducedMotion:true}));
  assert.equal(cultivatorSpriteFrame({...view,action:'study'},3).dedicatedPoseAvailable,false);
  assert.equal(cultivatorSpriteFrame({...view,action:'rest'},3).dedicatedPoseAvailable,false);
});

test('SR-XF-007: registered boot anchors meet the world origin in both mirrored directions and keep metre height',()=>{
  for(let spriteIndex=0;spriteIndex<6;spriteIndex++)for(const facing of ['east','west','north','nw'])for(const tick of [3,17]){
    const actor={...view,spriteIndex,action:'walk'},sprite=cultivatorSpriteFrame(actor,tick,{facing}),{ctx,calls}=recordingContext();
    drawCultivator(ctx,actor,{atlas,x:103,y:209,scale:32,tick,facing});
    const [,image,sx,sy,sw,sh,dx,dy,dw,dh]=calls.find(c=>c[0]==='drawImage');
    assert.equal(image,atlas);assert.ok(sx>=0&&sy>=0&&sx+sw<=atlas.width&&sy+sh<=atlas.height);
    assert.ok(Math.abs(dx+sprite.frame.footX*dw/sw)<1e-10);
    assert.ok(Math.abs(dy+sprite.frame.footY*dh/sh)<1e-10);
    assert.ok(Math.abs(-dy*(sprite.height/1.75)-view.recipe.height)<1e-10);
    assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===103&&c[2]===209));
  }
});

test('SR-XF-007/012: equipment changes its overlay without replacing identity or advancing any state',()=>{
  const base=recordingContext(),equipped=recordingContext();
  drawCultivator(base.ctx,view,{atlas,tick:10});
  const withGear=freeze({...view,mounts:{weapon:{itemId:'item:qa-sword',definitionId:'equipment:iron-sword'},armor:{itemId:'item:qa-robe',definitionId:'equipment:pulse-robe'}}});
  const before=JSON.stringify(withGear);drawCultivator(equipped.ctx,withGear,{atlas,tick:10});
  assert.deepEqual(base.calls.find(c=>c[0]==='drawImage'),equipped.calls.find(c=>c[0]==='drawImage'));
  assert.notDeepEqual(base.calls,equipped.calls);
  assert.equal(JSON.stringify(withGear),before);
});

test('SR-XF-007: shared scene/portrait asset registration rejects failed images and can be cleared',()=>{
  registerCultivatorAtlas(null);assert.equal(hasCultivatorAtlas(),false);
  assert.equal(registerCultivatorAtlas({...atlas,complete:false}),false);
  assert.equal(registerCultivatorAtlas({...atlas,width:1}),false);
  assert.equal(registerCultivatorAtlas(atlas),true);assert.equal(hasCultivatorAtlas(),true);
  const {ctx,calls}=recordingContext();drawCultivator(ctx,{...view,action:'work'},{portrait:true,tick:10});
  assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);
  registerCultivatorAtlas(null);assert.equal(hasCultivatorAtlas(),false);
});

test('SR-XF-007: actual atlas crops exclude the following head and preserve the complete back head',async()=>{
  const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
  const image=await loadImage(fileURLToPath(new URL('../dist/yunxiu-courtyard/assets/characters.webp',import.meta.url)));
  const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,image.width,image.height).data;
  for(let column=0;column<6;column++){
    const walk=cultivatorSpriteFrame({...view,spriteIndex:column,action:'walk'},17).frame;
    const back=cultivatorSpriteFrame({...view,spriteIndex:column,back:true},0).frame;
    assert.ok(walk.y+walk.h<back.y,`column ${column} contains separate walk and back figures`);
    // Every substantial pixel of this original back-view figure is included;
    // in the old 768 cut, columns 0/2/3/4 silently lost hair and forehead.
    for(let y=741;y<1024;y++)for(let x=column*256;x<(column+1)*256;x++){
      if(pixels[(y*image.width+x)*4+3]<=96)continue;
      assert.ok(x>=back.x&&x<back.x+back.w&&y>=back.y&&y<back.y+back.h,`back ${column}: source pixel ${x},${y} clipped`);
    }
  }
});
