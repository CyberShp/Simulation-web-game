import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {combatActorHeight} from '../../../apps/courtyard/courtyard-combat-dimensions.mjs';
import {loadCombatActorAssets,createCombatActorRenderer} from '../../../apps/courtyard/courtyard-combat-actors.mjs';
import {createCombatEffectsRenderer} from '../../../apps/courtyard/courtyard-combat-effects.mjs';
import {combatActorAtScreen,combatDepthOrder,createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {COMBAT_BACKDROPS} from '../../../apps/courtyard/courtyard-combat-backdrops.mjs';

// Minimal read-only projection facts from native party-05/contact-00.png,
// combat:campaign:1:impact:3 at tick265363. Original combat-observation.json SHA:
// e3c95271753807075144ed2a69b510ba58c1ae2713acefa68ccad893c16b0e54.
// This is a component fixture, not a native save or another gameplay run.
const direction={x:.9579071118660076,y:-.2870783256125825};
const contact={x:4.884732510846898,y:4.100477413964404};
const hit={id:3,eventId:'combat:campaign:1:impact:3',tick:265363,kind:'hit',sourceId:1,targetId:'enemy-1',from:{x:3.369293992773896,y:4.554644156175694},to:{x:5.220000000000001,y:4},direction,contact,contactHeight:.9,amount:10,total:.75,remaining:.75,outcome:'hit',reaction:'light'};
const body=(id,personId,visualIdentity,x,y,extra={})=>({id,personId,visualIdentity,x,y,hp:100,poseTick:265363,facing:direction,...extra});
const scene={type:'combat',sessionId:'combat:campaign:1',geometryId:'legacy',tick:265363,worldTick:265363,visualTick:265363,status:'active',selectedTargetId:'enemy-1',
 player:body('master','person:master','shen-yan',3.5,4,{faction:'sect',facing:{x:1,y:0},motion:{action:'spell',phase:'windup',phaseStartedTick:265362,phaseDurationTicks:3,phaseProgressTicks:1,startedTick:265362,executeAtTick:265366,direction:{x:1,y:0},movementLocked:true}}),
 allies:[body(1,'person:lu-zhiwei','person:lu-zhiwei',hit.from.x,hit.from.y,{faction:'sect',appearance:1,motion:{action:'attack',phase:'release',phaseStartedTick:265363,phaseDurationTicks:1,phaseProgressTicks:0,startedTick:265361,executeAtTick:265363,direction}})],
 enemies:[body('enemy-1','person:valley-shanxiao','shanxiao',hit.to.x,hit.to.y,{faction:'hostile',entityKind:'beast',facing:{x:-1,y:0},hitReaction:{kind:'light',direction,contact},motion:{action:'hit',phase:'hit',phaseStartedTick:265363,phaseDurationTicks:2,phaseProgressTicks:0,direction}})],effects:[hit],projectiles:[]};
const allBodies=s=>[s.player,...s.allies,...s.enemies];
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-8,`${message}: ${a} != ${b}`);
const base=new URL('../../../assets/courtyard/',import.meta.url);
const assetsPromise=loadCombatActorAssets({loadImage:name=>loadImage(new URL(name,base).pathname),loadJson:async name=>JSON.parse(await fs.readFile(new URL(name,base),'utf8')),makeCanvas:createCanvas});
const viewportCases=[{width:1024,height:600,expectedHeight:76.98962962962962},{width:1672,height:816,expectedHeight:125.70962962962963},{width:2560,height:1315,expectedHeight:192.47407407407405}];

function projection(viewport){
 const {width,height}=viewport,inset=COMBAT_BACKDROPS.forest.clearGround,ratio=1585/992,imageWidth=Math.max(width,height*ratio),imageHeight=imageWidth/ratio;
 const sx=imageWidth*(inset.right-inset.left)/10.8,sy=imageHeight*(inset.bottom-inset.top)/6.8;
 const imageX=(width-imageWidth)/2,imageY=(height-imageHeight)/2,t={sx,sy,ox:imageX+imageWidth*inset.left-.6*sx,oy:imageY+imageHeight*inset.top-.6*sy};
 return {transform:t,worldToScreen:(x,y)=>({x:t.ox+x*sx,y:t.oy+y*sy}),image:{x:imageX,y:imageY,width:imageWidth,height:imageHeight}};
}
function renderers(assets,viewport){
 const canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d'),{transform,worldToScreen,image}=projection(viewport),getTransform=()=>transform;
 ctx.imageSmoothingEnabled=false;const actors=createCombatActorRenderer({ctx,worldToScreen,getTransform,assets});
 const effects=createCombatEffectsRenderer({ctx,worldToScreen,getTransform,getActorPresentation:actors.presentation});
 return {canvas,ctx,transform,worldToScreen,image,actors,effects};
}

for(const viewport of viewportCases)test(`shared standing scale, native contact picking and FX at ${viewport.width}px`,async()=>{
 const assets=await assetsPromise;assert.deepEqual(assets.issues,[]);const before=structuredClone(scene),r=renderers(assets,viewport),H=combatActorHeight(r.transform);
 near(H,viewport.expectedHeight,'standing height');near(H/r.transform.sx,1.45,'relative metre scale');
 const inset=COMBAT_BACKDROPS.forest.clearGround,lo=r.worldToScreen(.6,.6),hi=r.worldToScreen(11.4,7.4);
 near(lo.x,r.image.x+r.image.width*inset.left,'left ground registration');near(lo.y,r.image.y+r.image.height*inset.top,'top ground registration');near(hi.x,r.image.x+r.image.width*inset.right,'right ground registration');near(hi.y,r.image.y+r.image.height*inset.bottom,'bottom ground registration');
 for(const actor of allBodies(scene)){
  const shown=r.actors.presentation(actor,scene);near(shown.height,H,actor.id+' shared body height');assert.deepEqual(shown.foot,r.worldToScreen(actor.x,actor.y));
  if(shown.wholeFrame)near(shown.height/shown.wholeFrame.sourceHeight,H/shown.sample.pose.sourceHeight,'whole-frame uniform scaling');
 }
 const p=r.worldToScreen(contact.x,contact.y),contactScreen={x:p.x,y:p.y-hit.contactHeight*H/1.8},pick=at=>combatActorAtScreen(scene,at,{worldToScreen:r.worldToScreen,heightOf:()=>combatActorHeight(r.transform),enemiesOnly:true});
 assert.equal(pick(contactScreen)?.id,'enemy-1','the native melee contact remains on the selectable enemy body');
 assert.equal(pick({x:-100,y:-100}),null);
 r.effects.drawForeground(scene,scene.tick);const withActorMetrics=r.canvas.toBuffer('image/png'),pixel=r.ctx.getImageData(Math.round(contactScreen.x),Math.round(contactScreen.y),1,1).data;
 assert(pixel[3]>200,'actual hit compression must draw at the shared-height contact coordinate');
 r.ctx.clearRect(0,0,viewport.width,viewport.height);createCombatEffectsRenderer({ctx:r.ctx,worldToScreen:r.worldToScreen,getTransform:()=>r.transform}).drawForeground(scene,scene.tick);
 assert.deepEqual(r.canvas.toBuffer('image/png'),withActorMetrics,'FX fallback and real actor metrics must use the same standing scale');
 assert.deepEqual(scene,before,'read-only sizing, picking and effects preserve native contact facts');
});

test('paused multi-body sampling and pixels stay frozen at every shared viewport scale',async()=>{
 const assets=await assetsPromise,before=structuredClone(scene),presenter=createCombatPresentation();presenter.sample(scene,{now:0});
 const frozen=presenter.sample(scene,{paused:true,now:20}),later=presenter.sample(scene,{paused:true,now:50000,intent:{x:1,y:0}});assert.deepEqual(later,frozen);
 for(const viewport of viewportCases){
  const r=renderers(assets,viewport),draw=s=>{r.ctx.clearRect(0,0,viewport.width,viewport.height);for(const actor of combatDepthOrder(s))r.actors.draw(actor,s,s.visualTick);r.effects.drawForeground(s,s.visualTick);return r.canvas.toBuffer('image/png');};
  const first=draw(frozen),second=draw(later);assert.deepEqual(second,first,viewport.width+' paused pixels');
  for(const actor of allBodies(later))assert.deepEqual(r.actors.presentation(actor,later).foot,r.worldToScreen(actor.x,actor.y));
 }
 assert.deepEqual(scene,before);
});
