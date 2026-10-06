/** Local scene renderer + public walking; explicit scene fixtures, not natural discovery or device evidence. */
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {LOCAL_SCENE_PALETTES,worldObjectFootprint} from '../dist/ea-world-scene-art.mjs';

const OldImage=globalThis.Image;
globalThis.Image=class{set src(v){queueMicrotask(()=>this.onload?.());}};
let count=0;
try{
 for(const sceneId of ['scene:valley','scene:market','scene:quarry','scene:ruins','scene:prison','scene:supply','scene:qixia']){
  let s=S.initial({sr:true});s.master.wound=0;s.master.energy=90;
  s.master.location={kind:'local',sceneId,x:32,y:46};s.master.position={kind:'scene',sceneId,x:32,y:46};
  const draw=[],ctx=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>k in o?o[k]:(...args)=>draw.push({op:k,args}),set:(o,k,v)=>(o[k]=v,true)});
  const canvas={width:820,height:1180,clientWidth:820,clientHeight:1180,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0})};
  const r=createWorldRenderer(canvas,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>null,getLocalScene:S.viewSRWorld,getAppearance:S.appearanceView});
  await r.ready;assert(LOCAL_SCENE_PALETTES[sceneId]);
  for(const o of S.WORLD_SCENES[sceneId].objects){
   const b=worldObjectFootprint(o),x=b.left+.1,y=o.y;r.focusScenic(x,y);
   const before=JSON.stringify(s);r.render();assert.equal(JSON.stringify(s),before,'render never advances or writes facts');
   const hit=r.pick({clientX:410,clientY:590});
   assert.equal(hit.kind,'world-object',`${sceneId}/${o.id} visible left half selects real centred object`);assert.equal(hit.id,o.id);
   assert(hit.approachPoint.y>b.bottom,'click approaches outside its blocked base');
   s=S.dispatchCommand(s,{name:'srWorldCommand',args:[{action:'move',...hit.approachPoint}]}).state;
   for(let n=0;n<1500&&s.srWorld.interaction;n++)S.tick(s,.1);
   assert.equal(s.srWorld.interaction,null,`${o.id} actual path reaches safe approach point`);
   assert(Math.hypot(s.master.location.x-hit.approachPoint.x,s.master.location.y-hit.approachPoint.y)<.1);
   count++;
  }
  S.validateSave(JSON.parse(JSON.stringify(s)));assert(draw.some(d=>d.op==='ellipse'));r.destroy();
  console.log(`PASS ${sceneId}: visible object selection, public path and render purity`);
 }
}finally{globalThis.Image=OldImage;}
console.log(JSON.stringify({suite:'sr-local-scene-art',scenes:7,objects:count,failed:0,scope:'renderer/collision/command fixtures; not browser touch or physical devices'}));
