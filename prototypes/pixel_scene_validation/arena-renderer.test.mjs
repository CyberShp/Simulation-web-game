import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaRenderer } from './arena-renderer.mjs';

function fakeContext() {
  const calls = [];
  return new Proxy({
    calls,
    drawImage(...args) { calls.push({op:'image',args}); },
    fillRect(...args) { assert.ok(args.every(Number.isFinite)); },
    save() {},restore() {}
  },{
    get(target,key) { return key in target?target[key]:(()=>{}); },
    set(target,key,value) { target[key]=value;return true; }
  });
}

function fakeCanvas(width=1600,height=900) {
  const ctx=fakeContext();
  return {width,height,ctx,getContext:()=>ctx,getBoundingClientRect:()=>({left:12,top:18,width,height})};
}

globalThis.document={createElement:()=>fakeCanvas()};
globalThis.Image=class {
  set src(value) {
    this._src=value;
    this.naturalWidth=this.width=value.includes('trail-terrain')?1182:1672;
    this.naturalHeight=this.height=value.includes('trail-terrain')?1330:941;
    queueMicrotask(()=>this.onload());
  }
  get src() {return this._src;}
};

const actor=(id,x,y)=>({id,name:id,team:id==='master'?'blue':'red',appearance:id==='master'?'blue':'red',x,y,hp:100,maxHp:100,qi:50,maxQi:50,shield:0,shieldUntil:0,dir:1,back:false,distance:0,moving:false,action:null,path:[],cooldowns:{}});
const freeze=value=>{
  if(value&&typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};
async function setup() {const renderer=new ArenaRenderer(fakeCanvas());await renderer.load();return renderer;}

test('long world retains the courtyard pixel scale and follows the master',async()=>{
  const renderer=await setup();
  const fit=renderer.viewport.fit;
  renderer.setMode('trail');
  renderer.followActor({x:700,y:2300},{snap:true});
  assert.deepEqual(renderer.worldBounds,{width:1672,height:2823});
  assert.equal(renderer.viewport.fit,fit);
  assert.equal(renderer.camera.zoom,1.25);
  assert.equal(renderer.camera.y,2230);
  const screen=renderer.worldToScreen(700,2300),back=renderer.screenToWorld(screen.x,screen.y);
  assert.ok(Math.hypot(back.x-700,back.y-2300)<1e-8);
  const before=renderer.worldToScreen(700,2223),after=renderer.worldToScreen(700,2300);
  assert.ok(Math.abs((after.y-before.y)-77*fit*1.25)<1e-8);
});

test('overview fits the complete trail and close follow restores readable scale',async()=>{
  const renderer=await setup();
  renderer.setMode('trail32');renderer.showOverview();
  assert.ok(renderer.camera.zoom>=.33&&renderer.camera.zoom<.34);
  const view=renderer.getVisibleWorldRect();
  assert.ok(view.y<=1e-8&&view.y+view.h>=2823-1e-8);
  renderer.followActor({x:800,y:2000},{snap:true});
  assert.equal(renderer.camera.zoom,1.25);
  renderer.setMode('duel');
  assert.equal(renderer.worldBounds.height,941);
  assert.equal(renderer.minimapRect,null);
  assert.ok(renderer.getVisibleWorldRect().y+renderer.getVisibleWorldRect().h<=941+1e-8);
});

test('valley combat framing keeps both lines above the skill bar',async()=>{
  const renderer=await setup();
  const state=freeze({mode:'trail32',trail:{phase:'combat'},playerId:'master',actors:[actor('master',830,2320),actor('north',730,2220),actor('south',1000,2540)]});
  renderer.setWorldForState(state);renderer.followBattle(state,{snap:true});
  for(const fighter of state.actors){
    const head=renderer.worldToScreen(fighter.x,fighter.y-78),feet=renderer.worldToScreen(fighter.x,fighter.y);
    assert.ok(head.y>128,'head remains below the top HUD');
    assert.ok(feet.y<760,'feet remain above the skill bar');
  }
});

test('render clips terrain and actors without changing any battle facts',async()=>{
  const renderer=await setup();
  const state=freeze({mode:'trail',tick:10,status:'active',playerId:'master',selectedTargetId:null,actors:[actor('master',700,1500),actor('north',700,600),actor('south',900,2450)],events:[]});
  const before=JSON.stringify(state);
  renderer.setWorldForState(state);renderer.followActor(state.actors[0],{snap:true});
  renderer.render(state);
  assert.equal(JSON.stringify(state),before);
  assert.equal(renderer.lastFrameStats.actorsTotal,3);
  assert.equal(renderer.lastFrameStats.actorsDrawn,1);
  assert.equal(renderer.lastFrameStats.propsDrawn,0);
  const terrainCalls=renderer.ctx.calls.filter(call=>call.args[0]===renderer.trail);
  assert.ok(terrainCalls.length>0);
  assert.ok(terrainCalls.every(call=>call.args.length===9));
  assert.ok(terrainCalls[0].args[4]<1330);
  const r=renderer.minimapRect;
  assert.ok(r&&r.y===128);
  const map=renderer.minimapToWorld(r.mapX+r.mapW/2,r.mapY+r.mapH/2);
  assert.deepEqual(map,{x:836,y:1411.5});
  assert.equal(renderer.minimapToWorld(r.x-1,r.y),null);
});

test('the courtyard and trail both render across the shared boundary',async()=>{
  const renderer=await setup();
  renderer.setMode('trail');renderer.camera={x:836,y:941,zoom:1.25};
  const state=freeze({mode:'trail',tick:0,playerId:'master',selectedTargetId:null,actors:[actor('master',830,950)],events:[]});
  renderer.ctx.calls.length=0;renderer.render(state);
  assert.ok(renderer.ctx.calls.some(call=>call.args[0]===renderer.ground));
  assert.ok(renderer.ctx.calls.some(call=>call.args[0]===renderer.trail));
  assert.equal(renderer.lastFrameStats.actorsDrawn,1);
});

test('a distant hit is omitted from drawing and remains in the snapshot',async()=>{
  const renderer=await setup();
  const event={id:1,kind:'hit',skill:'fire',atTick:10,sourceId:'north',targetId:'south',from:{x:700,y:600},to:{x:900,y:2450},amount:28};
  const state=freeze({mode:'trail32',tick:10,playerId:'master',selectedTargetId:null,actors:[actor('master',700,700),actor('north',700,600),actor('south',900,2450)],events:[event]});
  renderer.setWorldForState(state);renderer.followActor(state.actors[0],{snap:true});renderer.render(state);
  assert.equal(renderer.lastFrameStats.effectsDrawn,0);
  assert.equal(state.events[0].amount,28);
  renderer.followActor(state.actors[2],{snap:true});renderer.render(state);
  assert.equal(renderer.lastFrameStats.effectsDrawn,1);
});
