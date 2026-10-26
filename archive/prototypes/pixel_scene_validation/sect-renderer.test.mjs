import test from 'node:test';
import assert from 'node:assert/strict';
import { SectRenderer } from './sect-renderer.mjs';

function canvas(width=1600,height=900) {
  const calls=[];
  const ctx=new Proxy({calls,drawImage(...args){calls.push(args);}}, {
    get:(target,key)=>key in target?target[key]:()=>{},
    set:(target,key,value)=>(target[key]=value,true)
  });
  return {width,height,ctx,getContext:()=>ctx,getBoundingClientRect:()=>({width,height,left:40,top:20})};
}
globalThis.Image=class {
  set src(value){this.path=value;this.naturalWidth=1536;this.naturalHeight=1024;queueMicrotask(()=>this.onload());}
};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const person=(id,x,y,extra={})=>({id,name:id,x,y,appearance:0,moving:true,indoor:false,resident:true,...extra});
async function setup(){const renderer=new SectRenderer(canvas());await renderer.load();return renderer;}

test('walking changes frames across formal ticks even while integer seconds are unchanged',async()=>{
  const renderer=await setup(),master=person('person:master',12.5,45.5);
  const frames=[];
  for(const tick of [100,102,104]){renderer.view={tick,time:10};frames.push(renderer.personFrame(master).frame);}
  assert.equal(new Set(frames).size,3);
  renderer.view={tick:104,time:10};
  assert.equal(renderer.personFrame({...master,moving:false}).frame,renderer.personFrame({...master,moving:false},false).frame);
});

test('low crops are drawn before people on northern field rows and do not change their coordinates',async()=>{
  const renderer=await setup();
  const view=freeze({tick:100,time:10,sceneId:'scene:yunxiu-courtyard',people:[person('person:lu-zhiwei',12.9,41.1,{appearance:1}),person('person:master',24.95,7,{indoor:true})],buildings:[{id:'2',type:'farm',name:'灵草田',x:12,y:40,width:4,height:4,cropVisual:'ripe',stage:'complete'}],stockpiles:[]});
  const before=JSON.stringify(view);renderer.draw(view,.016);
  const crop=renderer.ctx.calls.findIndex(call=>call[0]===renderer.objects);
  const actor=renderer.ctx.calls.findIndex(call=>call[0]===renderer.peopleAtlas);
  assert.ok(crop>=0&&actor>crop,'a person at y41 must be above the field whose front is y44');
  assert.ok(renderer.ctx.calls.every(call=>call[0]!==renderer.masterAtlas),'indoor bodies stay hidden');
  assert.equal(JSON.stringify(view),before);
  const foot=renderer.worldToScreen(12.9,41.1);
  assert.equal(renderer.pickPerson(foot.x,foot.y-15)?.id,'person:lu-zhiwei');
});
