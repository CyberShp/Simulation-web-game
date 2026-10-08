import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {drawEstateField} from '../dist/ea-estate-ground-art.mjs';
import {spatialPrefab,spatialProject,spatialTransform} from '../dist/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../dist/ea-building-grid.mjs';

const require=createRequire(import.meta.url);
const {createCanvas}=require('@napi-rs/canvas');
const geometry={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
const camera={w:512,h:384,scale:32,depth:.62,rotation:Math.PI/4,ox:260,oy:-120};
const world=()=>({
  workOrdersById:{},
  ecologiesBySceneId:{'scene:yunxiu-courtyard':{surfaceZones:{'zone:yard-path':{wetness:.2}}}},
});
const building=type=>({id:`field:${type}`,instanceId:`field:${type}`,type,level:1,buildingGridVersion:BUILDING_GRID.version,transform:{x:10,y:10,orientation:'south'}});
const pixels=ctx=>ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
const reset=ctx=>{ctx.fillStyle='#19382a';ctx.fillRect(0,0,camera.w,camera.h);};
const context=dpr=>{const ctx=createCanvas(Math.round(camera.w*dpr),Math.round(camera.h*dpr)).getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);reset(ctx);return ctx;};
function fieldPixels(ctx,b,c,dpr){
  const d=spatialPrefab(b),t=spatialTransform(b),corners=[[0,0],[d.width,0],[d.width,d.height],[0,d.height]].map(([x,y])=>spatialProject({x:t.x+x,y:t.y+y},c));
  const pad=c.scale+10,x=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.x))-pad)*dpr)),y=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.y))-pad)*dpr));
  const right=Math.min(ctx.canvas.width,Math.ceil((Math.max(...corners.map(p=>p.x))+pad)*dpr)),bottom=Math.min(ctx.canvas.height,Math.ceil((Math.max(...corners.map(p=>p.y))+pad)*dpr));
  return ctx.getImageData(x,y,right-x,bottom-y).data;
}
function difference(a,b){
  let sum=0,changed=0,max=0;
  for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);sum+=delta;if(delta)changed++;max=Math.max(max,delta);}
  return {mean:sum/a.length,changed,max};
}

test('field bitmap retains the original picture and updates only when its visible inputs change',()=>{
  const originalDocument=globalThis.document,originalOffscreen=globalThis.OffscreenCanvas;
  try{
    for(const dpr of [1,1.75])for(const type of ['farm','granary']){
      const s=world(),b=building(type),before=JSON.stringify({s,b}),direct=context(dpr);
      globalThis.document=undefined;globalThis.OffscreenCanvas=undefined;
      assert.equal(drawEstateField(direct,b,s,camera,geometry),true);
      const reference=fieldPixels(direct,b,camera,dpr);

      let allocations=0;
      globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');allocations++;return createCanvas(1,1);}};
      const cached=context(dpr);
      assert.equal(drawEstateField(cached,b,s,camera,geometry),true);
      const first=pixels(cached),matching=difference(reference,fieldPixels(cached,b,camera,dpr));
      assert.ok(matching.mean<.5&&matching.max<=2,`${type}@${dpr}: field region differs from direct paint: ${JSON.stringify(matching)}`);
      assert.equal(allocations,1,`${type}: one field bitmap is built`);
      reset(cached);
      drawEstateField(cached,b,s,camera,geometry);
      assert.equal(allocations,1,`${type}: unchanged field reuses the bitmap`);
      assert.deepEqual(pixels(cached),first,`${type}: repeated frame has the same pixels`);

      const moved={...camera,ox:camera.ox+16,oy:camera.oy+8};
      reset(cached);
      drawEstateField(cached,b,s,moved,geometry);
      assert.equal(allocations,1,`${type}: pixel-aligned panning reuses the bitmap`);
      const movedDirect=context(dpr);
      globalThis.document=undefined;drawEstateField(movedDirect,b,s,moved,geometry);
      const movedMatch=difference(fieldPixels(cached,b,moved,dpr),fieldPixels(movedDirect,b,moved,dpr));
      assert.ok(movedMatch.mean<.5&&movedMatch.max<=2,`${type}@${dpr}: moved image differs: ${JSON.stringify(movedMatch)}`);
      globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');allocations++;return createCanvas(1,1);}};

      s.workOrdersById[`work:production:${b.instanceId}`]={phase:'executing',progressTicks:80,durationTicks:100};
      reset(cached);
      const stateBefore=JSON.stringify({s,b});
      drawEstateField(cached,b,s,moved,geometry);
      assert.equal(allocations,2,`${type}: production progress rebuilds crops`);
      assert.ok(difference(fieldPixels(cached,b,moved,dpr),fieldPixels(movedDirect,b,moved,dpr)).changed>100,`${type}: crop growth changes pixels`);
      assert.equal(JSON.stringify({s,b}),stateBefore,`${type}: drawing does not change world state`);

      s.ecologiesBySceneId['scene:yunxiu-courtyard'].surfaceZones['zone:yard-path'].wetness=.8;
      drawEstateField(cached,b,s,moved,geometry);
      assert.equal(allocations,3,`${type}: wet surface changes field bitmap`);
      drawEstateField(cached,b,s,{...moved,scale:34},geometry);
      assert.equal(allocations,4,`${type}: zoom changes field bitmap`);
      cached.globalAlpha=.4;
      drawEstateField(cached,b,s,moved,geometry);
      assert.equal(allocations,4,`${type}: translucent preview uses the direct painter`);
      cached.globalAlpha=1;
      reset(cached);cached.translate(.25,.5);
      drawEstateField(cached,b,s,moved,geometry);
      const translatedDirect=context(dpr);translatedDirect.translate(.25,.5);
      globalThis.document=undefined;drawEstateField(translatedDirect,b,s,moved,geometry);
      assert.equal(allocations,4,`${type}: translated context uses direct painting`);
      assert.equal(difference(fieldPixels(cached,b,moved,dpr),fieldPixels(translatedDirect,b,moved,dpr)).max,0,`${type}: translated field keeps exact pixels`);
      globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');allocations++;return createCanvas(1,1);}};
      const shadow=context(dpr);shadow.shadowColor='#f4c861';shadow.shadowOffsetX=3;shadow.shadowOffsetY=2;shadow.shadowBlur=0;
      drawEstateField(shadow,b,s,moved,geometry);
      const shadowDirect=context(dpr);shadowDirect.shadowColor='#f4c861';shadowDirect.shadowOffsetX=3;shadowDirect.shadowOffsetY=2;shadowDirect.shadowBlur=0;
      globalThis.document=undefined;drawEstateField(shadowDirect,b,s,moved,geometry);
      assert.equal(allocations,4,`${type}: offset shadow uses direct painting`);
      assert.equal(difference(fieldPixels(shadow,b,moved,dpr),fieldPixels(shadowDirect,b,moved,dpr)).max,0,`${type}: offset shadow keeps exact pixels`);
      globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');allocations++;return createCanvas(1,1);}};
      const joined=context(dpr);joined.lineJoin='round';
      drawEstateField(joined,b,s,moved,geometry);
      const joinedDirect=context(dpr);joinedDirect.lineJoin='round';
      globalThis.document=undefined;drawEstateField(joinedDirect,b,s,moved,geometry);
      assert.equal(allocations,4,`${type}: round line joins use direct painting`);
      assert.equal(difference(fieldPixels(joined,b,moved,dpr),fieldPixels(joinedDirect,b,moved,dpr)).max,0,`${type}@${dpr}: round line joins keep exact pixels`);
      globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');allocations++;return createCanvas(1,1);}};
      assert.notEqual(JSON.stringify({s,b}),before,'test exercised real visual state changes');
    }

    let allocations=0;
    globalThis.document={createElement:()=>{allocations++;return createCanvas(1,1);}};
    globalThis.OffscreenCanvas=undefined;
    const many=context(1.75),s=world();
    const fields=Array.from({length:25},(_,i)=>({...building(i%2?'farm':'granary'),id:`field:${i}`,instanceId:`field:${i}`}));
    for(const b of fields)drawEstateField(many,b,s,camera,geometry);
    assert.equal(allocations,25,'the 25 visible fields all keep a bitmap');
    for(const b of fields)drawEstateField(many,b,s,camera,geometry);
    assert.equal(allocations,25,'a second 25-field frame does not evict and rebuild the first fields');
  }finally{globalThis.document=originalDocument;globalThis.OffscreenCanvas=originalOffscreen;}
});
