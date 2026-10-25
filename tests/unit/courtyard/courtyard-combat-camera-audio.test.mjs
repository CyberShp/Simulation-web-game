import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatSoundEvents} from '../../../apps/courtyard/courtyard-combat-audio.mjs';
import {createCombatEffectsRenderer} from '../../../apps/courtyard/courtyard-combat-effects.mjs';
const scene=(effects=[],extra={})=>({sessionId:'audio-camera',tick:1,player:{id:'master',x:30,y:16,hp:100,facing:{x:1,y:0}},allies:[],enemies:[],effects,projectiles:[],...extra});
const hit=(x,extra={})=>({id:x,eventId:'hit:'+x,kind:'hit',tick:1,sourceId:'master',targetId:'enemy',contact:{x,y:16},amount:10,outcome:'hit',reaction:'light',...extra});
const ready=b=>{const s=createCombatSoundEvents();s.update({...b,tick:0,effects:[],projectiles:[]});return s.update(b);};
test('v2 sound pan follows the painted camera and falls back relative to the player',()=>{
 const a=ready(scene([hit(27),hit(30),hit(33)],{geometryId:'valley-open-v2',camera:{center:{x:30,y:16},viewMetres:22}}));assert.deepEqual(a.map(c=>c.pan),[-3/11,0,3/11]);const b=ready(scene([hit(30)],{geometryId:'valley-open-v2'}));assert.equal(b[0].pan,0);const edge=ready(scene([hit(1)],{geometryId:'valley-open-v2',camera:{center:{x:11,y:16},viewMetres:22}}));assert.equal(edge[0].pan,-.55);
});
test('legacy sound pan retains the existing 6m centre and 9m span',()=>{assert.deepEqual(ready(scene([hit(3),hit(6),hit(9)],{geometryId:'legacy'})).map(c=>c.pan),[-1/3,0,1/3]);});
test('sword qi uses one swing launch and blade impact while existing spell cues retain their type',()=>{
 const attack={kind:'attack',id:1,tick:1,sourceId:'master',from:{x:30,y:16}},shot={id:1,kind:'sword-qi',sourceId:'master',launchedTick:1,from:{x:30,y:16}};
 assert.deepEqual(ready(scene([attack,hit(30,{projectileId:1,projectileKind:'sword-qi'})],{projectiles:[shot]})).map(c=>c.kind),['swing','bladeHit']);assert.deepEqual(ready(scene([hit(30,{projectileId:2})],{projectiles:[{...shot,id:2,kind:'spell'}]})).map(c=>c.kind),['spellHit','cast']);
});
test('sword qi is a directional long shape and samples its own release sword instead of the spell hand',()=>{
 for(const direction of [{x:1,y:0},{x:-1,y:0},{x:1,y:-1},{x:-1,y:1}]){const rects=[],calls=[],ctx={save(){},restore(){},fillRect(x,y,w,h){rects.push({x,y,w,h});}},b=scene([],{geometryId:'valley-open-v2'}),shot={id:1,kind:'sword-qi',sourceId:'master',x:30,y:16,from:{x:30,y:16},direction,launchedTick:1};b.player.facing={x:-direction.x,y:-direction.y};b.projectiles=[shot];const before=structuredClone(b),sx=60,sy=35,dx=direction.x*sx,dy=direction.y*sy,length=Math.hypot(dx,dy),d={x:dx/length,y:dy/length};
 const fx=createCombatEffectsRenderer({ctx,worldToScreen:(x,y)=>({x:x*sx,y:y*sy}),getTransform:()=>({sx,sy}),getActorPresentation:a=>{calls.push(a);return {height:87,foot:{x:a.x*sx,y:a.y*sy},swordTip:{x:a.x*sx+direction.x*20,y:a.y*sy-45},releaseHand:{x:a.x*sx+999,y:a.y*sy+999}};}});fx.drawProjectiles(b,1);assert.equal(calls[0].motion.action,'attack');assert.equal(calls[0].motion.phase,'release');assert.deepEqual(calls[0].motion.direction,direction);assert(calls[0].motion.movementLocked);assert(rects.length>20);assert(rects.every(p=>Math.abs(p.x-30*sx)<150&&Math.abs(p.y-(16*sy-45))<150),'launch stays at the sword tip instead of the deliberately distant spell hand');const along=rects.map(p=>p.x*d.x+p.y*d.y),cross=rects.map(p=>-p.x*d.y+p.y*d.x);assert(Math.max(...along)-Math.min(...along)>(Math.max(...cross)-Math.min(...cross))*2);assert.deepEqual(b,before);
 }
});
test('the fixed rock-spike warning fills and shrinks toward its formal release without moving its target',()=>{
 const shapes=[],ctx={save(){},restore(){},beginPath(){},ellipse(...a){shapes.push(a);},fill(){},fillRect(){},strokeText(){},fillText(){}},b=scene([],{geometryId:'valley-open-v2',worldTick:1,enemies:[{id:'foe',x:40,y:20,telegraph:{x:30,y:16,radius:1.2,remaining:.8,total:.8,kind:'震地岩刺'}}]}),before=structuredClone(b),fx=createCombatEffectsRenderer({ctx,worldToScreen:(x,y)=>({x:x*60,y:y*35}),getTransform:()=>({sx:60,sy:35})});
 fx.drawGround(b,1);const start=shapes.map(a=>[...a]);shapes.length=0;fx.drawGround({...b,tick:5,worldTick:5,enemies:[{...b.enemies[0],telegraph:{...b.enemies[0].telegraph,remaining:.4}}]},5.5);const middle=shapes;
 assert.deepEqual(start[0].slice(0,4),[1800,560,72,42]);assert.deepEqual(middle[0].slice(0,4),start[0].slice(0,4));assert(middle[1][2]>start[1][2]);assert.deepEqual(b,before);
});
