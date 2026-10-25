import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {usesCombatCamera,combatCameraTransform,combatHudSafeBottom,legacyCombatTransform,combatWorldToScreen,combatScreenToWorld,combatPointerWorldPoint,combatPointerScreenPoint,combatSceneBounds,combatExitLandmark,COMBAT_GROUND_Y_SCALE} from '../../../apps/courtyard/courtyard-combat-camera.mjs';
import {combatBackdrop,combatGroundTiles,combatBackdropProps,drawCombatBackdropProp} from '../../../apps/courtyard/courtyard-combat-backdrops.mjs';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {combatActorHeight} from '../../../apps/courtyard/courtyard-combat-dimensions.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const scene=(x=24,y=16)=>({type:'combat',sessionId:'camera-fixture',geometryId:'valley-open-v2',geometryVersion:2,tick:1200,interactive:true,width:48,height:32,arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player:{id:'master',x,y,hp:100,facing:{x:1,y:0},motion:{action:'idle',phase:'idle',movementLocked:false,moveIntent:{x:0,y:0}}},allies:[],enemies:[],projectiles:[],effects:[],landmarks:[{id:'exit',x:1,y:15,radius:2,worldExitId:'exit:valley-yunxiu'}],obstacles:[{id:'object:valley:herbs',x:7,y:2.5,w:4,h:3},{id:'object:valley:bridge',x:21.5,y:9.5,w:7,h:3},{id:'object:valley:cave',x:38,y:16.5,w:6,h:5}]});
const sizes=[{width:1024,height:600},{width:1672,height:816},{width:2560,height:1315}];
test('camera keeps 22 metres and the common actor scale at all three viewports without mutating authority',()=>{
 for(const size of sizes){const b=scene(),before=structuredClone(b),t=combatCameraTransform(b,size);near(t.sx,size.width/22);near(t.sy/t.sx,COMBAT_GROUND_Y_SCALE);near(combatActorHeight(t)/t.sx,1.45);near(t.visibleWorld.right-t.visibleWorld.left,22);for(const p of [{x:.6,y:.6},{x:47.4,y:31.4},{x:21,y:24},{x:1,y:15}]){const screen=combatWorldToScreen(t,p.x,p.y),back=combatScreenToWorld(t,screen.x,screen.y);near(back.x,p.x);near(back.y,p.y);}assert.deepEqual(b,before);}
});
test('following clamps to display edges with top/bottom aprons while walk bounds stay unchanged',()=>{
 for(const size of sizes)for(const p of [{x:.6,y:.6},{x:47.4,y:.6},{x:.6,y:31.4},{x:47.4,y:31.4}]){const b=scene(p.x,p.y),t=combatCameraTransform(b,size);assert(t.visibleWorld.left>=-1e-8);assert(t.visibleWorld.right<=48+1e-8);assert(t.visibleWorld.top>=-2.5-1e-8);assert(t.visibleWorld.bottom<=37+1e-8);assert.deepEqual(t.displayBounds,{left:0,right:48,top:-2.5,bottom:37});assert.deepEqual(combatSceneBounds(b),b.arena.bounds);if(p.y===.6){const at=combatWorldToScreen(t,p.x,p.y);assert(at.y-combatActorHeight(t)>0,'top-edge standing body remains visible');}}
 const portrait=combatCameraTransform(scene(.6,.6),{width:500,height:1000});near(portrait.center.y,(-2.5+37)/2);
});
test('the measured victory-01 HUD overlap is reproduced and the bottom-edge foot clears it',()=>{
 const size={width:1672,height:816},canvasRect={left:0,top:90,...size},panelRect={left:500,top:720,width:672,height:171},safeBottom=combatHudSafeBottom(canvasRect,panelRect,size.height),b=scene(24,28.62),before=structuredClone(b);
 const oldFoot=size.height+(b.player.y-32)*(size.width/22*COMBAT_GROUND_Y_SCALE);assert(oldFoot>panelRect.top-canvasRect.top,'the old 32m display clamp puts the measured foot behind HUD');assert(Math.abs(oldFoot-665.5)<.1);
 near(safeBottom,618);for(const y of [28.62,31.4]){const t=combatCameraTransform(scene(24,y),{...size,safeBottom}),foot=combatWorldToScreen(t,24,y);assert(foot.y+canvasRect.top<=panelRect.top-12);assert(foot.y-combatActorHeight(t)>0);near(t.bottomApron,5);}
 assert.deepEqual(b,before);
});
test('HUD rectangle fixtures keep the full bottom-edge body above the panel at three viewport sizes',()=>{
 const hudTops=[415,630,1130];for(let i=0;i<sizes.length;i++){
  const size=sizes[i],canvasRect={left:0,top:90,...size},panelRect={left:size.width/2-300,top:90+hudTops[i],width:600,height:size.height-hudTops[i]-14},safeBottom=combatHudSafeBottom(canvasRect,panelRect,size.height);
  for(const y of [28.62,31.4])for(const x of [.6,24,47.4]){const b=scene(x,y),before=structuredClone(b),t=combatCameraTransform(b,{...size,safeBottom}),foot=combatWorldToScreen(t,x,y);assert(foot.y<=hudTops[i]-12+1e-8);assert(foot.y-combatActorHeight(t)>=0);near(t.sx,size.width/22);near(combatActorHeight(t)/t.sx,1.45);near(t.displayBounds.top,-2.5);assert.deepEqual(b,before);assert.deepEqual(combatSceneBounds(b),{left:.6,right:47.4,top:.6,bottom:31.4});if(i===0)assert(t.bottomApron>5,'5m alone is insufficient for this narrower viewport');}
 }
 const short={width:1672,height:360},safeBottom=combatHudSafeBottom({left:0,top:75,...short},{left:500,top:225,width:672,height:204},short.height),t=combatCameraTransform(scene(24,31.4),{...short,safeBottom}),foot=combatWorldToScreen(t,24,31.4);near(t.anchorY,138);assert(foot.y<=138+1e-8);assert(foot.y-combatActorHeight(t)>0,'short viewport moves the focus above the obstructed centre');
});
test('HUD safety uses canvas-relative CSS scaling and ignores a hidden or nonoverlapping panel',()=>{
 const rect={left:10,top:90,width:1672,height:816},panel={left:500,top:720,width:600,height:171};near(combatHudSafeBottom(rect,panel,816),618);near(combatHudSafeBottom({...rect,height:408},{...panel,top:405,height:85.5},816),606);near(combatHudSafeBottom(rect,null,816),816);near(combatHudSafeBottom(rect,{...panel,width:0,height:0},816),816);near(combatHudSafeBottom(rect,{...panel,left:1700},816),816);near(combatHudSafeBottom(rect,{...panel,top:1000},816),816);
});
test('actual coordinates consume the HUD rectangle once per UI layout and refresh on resize',async()=>{
 const source=await fs.readFile(new URL('../../../apps/courtyard/courtyard-combat.mjs',import.meta.url),'utf8'),start=source.indexOf(' function coordinates('),end=source.indexOf(' function worldToScreen(',start);assert(start>=0&&end>start);
 let panelTop=720,reads=0;const rect={left:0,top:90,width:1672,height:816},panel={hidden:false,getBoundingClientRect:()=>({left:500,top:panelTop,width:672,height:171})},c={hudLayout:null,renderScene:null,battle:()=>scene(24,31.4),usesCombatCamera,combatCameraTransform,combatHudSafeBottom,canvas:{clientWidth:1672,clientHeight:816,getBoundingClientRect:()=>{reads++;return rect;}},$:()=>panel};
 vm.runInNewContext(source.slice(start,end),c);let t=vm.runInNewContext('coordinates()',c);near(t.safeBottom,618);assert(combatWorldToScreen(t,24,31.4).y<=618);vm.runInNewContext('coordinates()',c);assert.equal(reads,1,'rAF does not remeasure unchanged HUD layout');
 panelTop=690;c.hudLayout=null;t=vm.runInNewContext('coordinates()',c);near(t.safeBottom,588);assert.equal(reads,2);
 c.canvas.clientWidth=1024;c.canvas.clientHeight=600;rect.width=1024;rect.height=600;panelTop=505;t=vm.runInNewContext('coordinates()',c);near(t.safeBottom,403);assert(t.bottomApron>5);assert(combatWorldToScreen(t,24,31.4).y<=403+1e-8);assert.equal(reads,3);
});
test('a stationary screen pointer reprojects under camera movement and CSS resize',()=>{
 const rect={left:10,top:20,width:1672,height:816},pointer={clientX:710,clientY:420},a=combatCameraTransform(scene(18,16),rect),z=combatCameraTransform(scene(21,16),rect),one=combatPointerWorldPoint(pointer,rect,a),two=combatPointerWorldPoint(pointer,rect,z);near(two.x-one.x,3);assert.deepEqual(combatWorldToScreen(a,one.x,one.y),combatPointerScreenPoint(pointer,rect,a));assert.deepEqual(combatWorldToScreen(z,two.x,two.y),combatPointerScreenPoint(pointer,rect,z));
 const resized={left:30,top:40,width:1024,height:600},at=combatPointerWorldPoint(pointer,resized,z),screen=combatWorldToScreen(z,at.x,at.y);near(screen.x*resized.width/z.width+resized.left,pointer.clientX);near(screen.y*resized.height/z.height+resized.top,pointer.clientY);
});
test('old active transforms and painted insets preserve the exact existing projection',()=>{
 for(const size of sizes){const inset={left:.22,right:.78,top:.32,bottom:.65},ratio=1585/992,imageWidth=Math.max(size.width,size.height*ratio),imageHeight=imageWidth/ratio,t=legacyCombatTransform({...size,image:{width:1585,height:992},inset});near(t.sx,imageWidth*.56/10.8);near(t.sy,imageHeight*.33/6.8);near(t.ox,(size.width-imageWidth)/2+imageWidth*.22-.6*t.sx);near(t.oy,(size.height-imageHeight)/2+imageHeight*.32-.6*t.sy);assert.equal(combatBackdrop({geometryId:'legacy'}).id,'forest');assert.equal(combatBackdrop({geometryId:'prison-forecourt'}).id,'prison-forecourt');}
 assert.deepEqual(combatExitLandmark(scene()),scene().landmarks[0]);assert.deepEqual(combatExitLandmark({}),{id:'exit',x:.7,y:4,radius:.7});assert.throws(()=>combatSceneBounds({geometryId:'valley-open-v2'}),/arena.bounds/);
});
test('ground tiles and prop feet use the same world transform and stable authoritative object ids',()=>{
 const b=scene(),config=combatBackdrop(b),t=combatCameraTransform(b,sizes[1]),tiles=combatGroundTiles(config,t),props=combatBackdropProps(config,{...b,obstacles:[...b.obstacles].reverse()});assert(tiles.length>0&&tiles.length<60);assert(tiles.some(p=>p.worldX<=t.visibleWorld.left&&p.worldY<=t.visibleWorld.top));assert.deepEqual(props.map(p=>p.id),[...b.obstacles].reverse().map(p=>p.id));
 for(const prop of props){let args;drawCombatBackdropProp({drawImage(...a){args=a;}},{},prop,t);const [sx,sy,w,h]=prop.sourceRect,k=prop.worldWidth*t.sx/w,foot=combatWorldToScreen(t,prop.x,prop.y);near(args[5]+(prop.foot[0]-sx)*k,foot.x);near(args[6]+(prop.foot[1]-sy)*k,foot.y);near(args[7]/w,args[8]/h);}
});
test('presentation previews beyond the old 12m edge using v2 collision geometry and freezes during pause',()=>{
 const b=scene(30,24),before=structuredClone(b),p=createCombatPresentation();p.sample(b,{now:0,intent:{x:1,y:0}});const shown=p.sample(b,{now:25,intent:{x:1,y:0}});assert(shown.player.x>30&&shown.player.x<30.05);const paused=p.sample(b,{now:30,paused:true}),later=p.sample(b,{now:9000,paused:true});assert.deepEqual(later.player,paused.player);assert.deepEqual(combatCameraTransform(later,sizes[1]),combatCameraTransform(paused,sizes[1]));
 const q=createCombatPresentation(),shotScene={...b,player:{...b.player,x:25},projectiles:[{id:1,kind:'sword-qi',sourceId:'master',x:30,y:24,from:{x:30,y:24},direction:{x:1,y:0},speed:16,radius:.45,remainingDistance:10,launchedTick:1199}]};q.sample(shotScene,{now:0});
 // dodgeEndpoint retains the existing binary collision-clip tolerance.
 assert(Math.abs(q.sample(shotScene,{now:50}).projectiles[0].x-30.8)<1e-6);assert.deepEqual(b,before);
});
test('actual cast and pointer helpers use the latest painted camera without issuing world steps',async()=>{
 const source=await fs.readFile(new URL('../../../apps/courtyard/courtyard-combat.mjs',import.meta.url),'utf8'),slice=(a,z)=>{const begin=source.indexOf(' function '+a+'('),end=source.indexOf(z,begin);assert(begin>=0&&end>begin);return source.slice(begin,end);},b=scene(18,16),before=structuredClone(b),requests=[],rect={left:10,top:20,width:1672,height:816};
 const c={battle:()=>b,transform:combatCameraTransform(b,rect),pointer:null,aim:null,hoveredActorId:null,combatPointerScreenPoint,combatScreenToWorld,coordinates:()=>c.transform,actorAt:()=>null,canvas:{getBoundingClientRect:()=>rect,focus(){}},combatAudio:{unlock(){}},canInteract:()=>true,hostActive:true,document:{hasFocus:()=>true},send:q=>{requests.push(structuredClone(q));return {ok:true};},lastSkill:'spell'};
 vm.runInNewContext(slice('target',' function key(')+slice('updatePointerAim'," canvas.addEventListener('pointermove'"),c);vm.runInNewContext('rememberPointer({clientX:710,clientY:420});cast("spell")',c);const first=requests[0].target;c.transform=combatCameraTransform(scene(21,16),rect);vm.runInNewContext('cast("spell")',c);near(requests[1].target.x-first.x,3);assert.equal(requests.length,2);assert.equal(requests[0].type,'combat');
 c.hostActive=false;vm.runInNewContext('cast("spell")',c);assert.equal(requests.length,2);c.hostActive=true;c.document.hasFocus=()=>false;vm.runInNewContext('cast("spell")',c);assert.equal(requests.length,2);assert.deepEqual(b,before);
});
