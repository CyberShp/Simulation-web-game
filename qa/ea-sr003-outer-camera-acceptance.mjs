import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {initial,dispatchCommand,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {viewSRWorld,WORLD_SCENES} from '../dist/ea-sr-world.mjs';
import {spatialProject} from '../dist/ea-sr-spatial.mjs';
import {drawLocalSceneObject,worldObjectFootprint} from '../dist/ea-world-scene-art.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';

function context(){
 const paths=[];let current=[];
 const methods={beginPath(){current=[];},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},closePath(){},fill(){paths.push(current.slice());},measureText:text=>({width:text.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const ctx=new Proxy(methods,{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)});
 return {ctx,paths};
}
function canvas(width=820,height=600){const recording=context();return {...recording,element:{width,height,clientWidth:width,clientHeight:height,style:{},getContext:()=>recording.ctx,getBoundingClientRect:()=>({left:0,top:0,width,height})}};}
function bounds(renderer){const points=[{x:0,y:0},{x:64,y:0},{x:64,y:48},{x:0,y:48}].map(p=>renderer.projectPoint(p));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};}
function assertCoverage(renderer){const c=renderer.getCamera(),b=bounds(renderer),epsilon=.001;if(b.right-b.left>=c.w){assert.ok(b.left<=epsilon&&b.right>=c.w-epsilon,'the 64 m width covers the viewport');}else assert.ok(Math.abs(b.left+b.right-c.w)<epsilon,'the 64 m width stays centred');if(b.bottom-b.top>=c.h){assert.ok(b.top<=epsilon&&b.bottom>=c.h-epsilon,'the 48 m height covers the viewport');}else assert.ok(Math.abs(b.top+b.bottom-c.h)<epsilon,'the 48 m height stays centred');}
function eventAt(renderer,point){const p=renderer.projectPoint(point);return {clientX:p.x,clientY:p.y};}
function assertSamePoint(a,b){assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,`world point moved from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);}
function arrived(sceneId){let s=initial({sr:true});assert.ok(s.srWorld.knownScenes.includes(sceneId));s=dispatchCommand(s,{name:'srWorldCommand',args:[{action:'travel',destination:sceneId}],id:`command:qa-sr003-camera:${sceneId}`}).state;let steps=0;while(s.srWorld.activeTravelId){assert.ok(steps++<3000,'public travel arrives');tick(s,.1);}assert.equal(s.master.location.sceneId,sceneId);return validateSave(JSON.parse(JSON.stringify(s)));}
function wardArrival(){let s=initial({sr:true}),sequence=0;const send=payload=>{s=dispatchCommand(s,{name:'srWorldCommand',args:[payload],id:`command:qa-sr003-roof:${++sequence}`}).state;};const settle=()=>{let steps=0;while(s.srWorld.activeTravelId||s.srWorld.interaction){assert.ok(steps++<3000,'public movement or investigation settles');tick(s,.1);}};
 send({action:'travel',destination:'scene:valley'});settle();send({action:'move',x:26,y:23});settle();send({action:'investigate',sourceId:'object:valley:bridge'});settle();send({action:'travel',destination:'scene:quarry'});settle();send({action:'move',x:36,y:19});settle();send({action:'investigate',sourceId:'object:quarry:tools'});settle();send({action:'travel',destination:'scene:ward'});settle();assert.equal(s.master.location.sceneId,'scene:ward');assert.equal(s.personsById['person:xing-lie'].location.sceneId,'scene:ward');return validateSave(JSON.parse(JSON.stringify(s)));
}

test('SR-XF-003 outer local camera uses 45 degrees and the actual 64 by 48 metre projection without changing the save',async()=>{
 const s=arrived('scene:valley'),before=JSON.stringify(s),recording=canvas(),oldImage=globalThis.Image;globalThis.Image=class{set src(_value){queueMicrotask(()=>this.onerror?.());}};
 try{
  const renderer=createWorldRenderer(recording.element,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>null,getLocalScene:viewSRWorld});await renderer.ready;renderer.setScene('map');
  assert.equal(viewSRWorld(s).scene.width,64);assert.equal(viewSRWorld(s).scene.height,48);
  assert.ok(Math.abs(renderer.getCamera().rotation-Math.PI/4)<1e-12);assert.equal(renderer.getCamera().depth,.65);
  for(const p of [{x:2,y:2},{x:32,y:24},{x:62,y:46}])assertSamePoint(renderer.screenPoint(eventAt(renderer,p)),p);
  for(const pan of [{x:0,y:0},{x:9000,y:-9000},{x:-9000,y:9000}]){Object.assign(renderer.pan,pan);assertCoverage(renderer);}
  renderer.setOverview(true);assertCoverage(renderer);assert.ok(Math.abs(renderer.getCamera().scale- Math.min(820/(112/Math.SQRT2),600/(112/Math.SQRT2*.65))*.88)<1e-9);
  renderer.setZoom(.2);assertCoverage(renderer);const master=s.master.location,projected=renderer.projectPoint(master);assert.ok(projected.x>0&&projected.x<820&&projected.y>0&&projected.y<600,`overview button zoom focuses the current outer position: ${JSON.stringify(projected)}`);
  renderer.recenter();assertCoverage(renderer);for(const finger of [{clientX:25,clientY:50},{clientX:795,clientY:550}]){for(let i=0;i<8;i++){const held=renderer.screenPoint(finger);renderer.setZoom(-.13,finger);assertCoverage(renderer);assertSamePoint(renderer.screenPoint(finger),held);}}
  renderer.render();assert.equal(JSON.stringify(s),before,'render, camera and hit conversion are read-only');renderer.destroy();
 }finally{globalThis.Image=oldImage;}
});

test('SR-XF-003 outer objects retain world footprint picking after focus and zoom',async()=>{
 const s=arrived('scene:qixia'),before=JSON.stringify(s),recording=canvas(),oldImage=globalThis.Image,selection={kind:'world-object',id:'object:qixia:gate'};globalThis.Image=class{set src(_value){queueMicrotask(()=>this.onerror?.());}};
 try{
  const renderer=createWorldRenderer(recording.element,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>selection,getLocalScene:viewSRWorld});await renderer.ready;renderer.setScene('map');renderer.focus(0,0);renderer.render();
  const gate=WORLD_SCENES['scene:qixia'].objects.find(o=>o.id===selection.id),footprint=worldObjectFootprint(gate),picked=renderer.pick(eventAt(renderer,{x:gate.x,y:gate.y}));assert.equal(picked.kind,'world-object');assert.equal(picked.id,gate.id);assertSamePoint(picked,{x:gate.x,y:gate.y});
  for(const point of [{x:footprint.left+.1,y:gate.y},{x:footprint.right-.1,y:gate.y},{x:gate.x,y:footprint.top+.1},{x:gate.x,y:footprint.bottom-.1}])assert.equal(renderer.pick(eventAt(renderer,point)).id,gate.id,'all four footprint edges pick the drawn object');
  renderer.setOverview(true);renderer.setZoom(.2);assertCoverage(renderer);const after=renderer.projectPoint({x:gate.x,y:gate.y});assert.ok(after.x>0&&after.x<820&&after.y>0&&after.y<600,'selected outer object remains visible after overview zoom');
  assert.equal(JSON.stringify(s),before,'drawing and picking do not modify the save');renderer.destroy();
 }finally{globalThis.Image=oldImage;}
});

test('SR-XF-003 rotated local art draws all four projected footprint corners, including square arrays',()=>{
 const c={rotation:Math.PI/4,depth:.65,scale:32,ox:200,oy:50},cases=[['scene:ruins','object:ruins:seal'],['scene:market','object:market:merchant'],['scene:valley','object:valley:bridge']];
 for(const [sceneId,id] of cases){const scene=WORLD_SCENES[sceneId],object=scene.objects.find(o=>o.id===id),b=worldObjectFootprint(object),expected=[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}].map(point=>spatialProject(point,c)),recording=context();drawLocalSceneObject(recording.ctx,object,scene,c,spatialProject);const first=recording.paths[0];assert.equal(first.length,4,`${id} has a four-corner footprint`);for(let i=0;i<4;i++)assertSamePoint({x:first[i][0],y:first[i][1]},expected[i]);assert.ok(Math.max(...first.map(p=>p[0]))-Math.min(...first.map(p=>p[0]))>object.width*c.scale*.6,`${id} does not collapse to a vertical line`);}
});

test('SR-XF-003 ward roof hides an indoor actor from canvas and offers the same current actor by name',async()=>{
 const s=wardArrival(),before=JSON.stringify(s),view=viewSRWorld(s),records=view.scene.objects.find(o=>o.id==='object:ward:records'),xing=view.scene.actors.find(p=>p.personId==='person:xing-lie'),recording=canvas(),drawn=[],oldImage=globalThis.Image;
 assert.ok(records&&xing);assert.equal(xing.x,47);assert.equal(xing.y,33);globalThis.Image=class{set src(_value){queueMicrotask(()=>this.onerror?.());}};
 try{
  const renderer=createWorldRenderer(recording.element,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>null,getLocalScene:viewSRWorld,getAppearance:(_state,id)=>{drawn.push(id);return null;}});await renderer.ready;renderer.setScene('map');renderer.focus(records.x,records.y);drawn.length=0;renderer.render();
  assert.ok(!drawn.includes(xing.personId),'the roofed person is not drawn');
  const feet=renderer.pick(eventAt(renderer,{x:xing.x,y:xing.y}));assert.equal(feet.kind,'world-object');assert.equal(feet.id,records.id,'the indoor footpoint chooses the visible building');
  const roof=renderer.projectPoint({x:43,y:31});roof.y-=1.8*renderer.getCamera().scale;const pickedRoof=renderer.pick({clientX:roof.x,clientY:roof.y});assert.equal(pickedRoof.kind,'world-object');assert.equal(pickedRoof.id,records.id,'the raised roof remains selectable');
  const panel=renderSRPanel(s,SIM,'explore');assert.match(panel,/查看人物 · 邢烈/);assert.match(panel,new RegExp(`data-ui-action="chooseScenePerson" data-ui-args="\\[${s.personsById[xing.personId].id}\\]"`));assert.ok(!panel.includes('查看人物 · 青萝'),'the current-scene entry excludes remote people');
  assert.equal(JSON.stringify(s),before,'canvas, picking and current-scene projection are read-only');renderer.destroy();
 }finally{globalThis.Image=oldImage;}
});

test('SR-XF-003 open local encounter remains drawn and selectable',async()=>{
 const s=arrived('scene:valley'),before=JSON.stringify(s),guardian=viewSRWorld(s).scene.actors.find(p=>p.personId==='person:qing-luo'),recording=canvas(),drawn=[],oldImage=globalThis.Image;assert.ok(guardian);globalThis.Image=class{set src(_value){queueMicrotask(()=>this.onerror?.());}};
 try{const renderer=createWorldRenderer(recording.element,{getState:()=>s,getMode:()=> 'inspect',getSelection:()=>null,getLocalScene:viewSRWorld,getAppearance:(_state,id)=>{drawn.push(id);return null;}});await renderer.ready;renderer.setScene('map');renderer.focus(guardian.x,guardian.y);drawn.length=0;renderer.render();assert.ok(drawn.includes(guardian.personId),'the outdoor encounter is drawn');const picked=renderer.pick(eventAt(renderer,guardian));assert.equal(picked.kind,'person');assert.equal(picked.id,s.personsById[guardian.personId].id);assert.equal(JSON.stringify(s),before);renderer.destroy();}finally{globalThis.Image=oldImage;}
});
