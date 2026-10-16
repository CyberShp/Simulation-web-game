import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import {initial,dispatchCommand,tick,validateSave} from '../../src/simulation/ea-opening-sim.mjs';
import {viewSRWorld,WORLD_SCENES} from '../../src/simulation/ea-sr-world.mjs';
import {spatialProject} from '../../src/simulation/ea-sr-spatial.mjs';
import {drawLocalSceneObject,worldObjectFootprint} from '../../apps/web/ea-world-scene-art.mjs';
import {renderSRPanel} from '../../apps/web/ea-sr-ui.mjs';

function context(){
 const paths=[];let current=[];
 const methods={beginPath(){current=[];},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},closePath(){},fill(){paths.push(current.slice());},measureText:text=>({width:text.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const ctx=new Proxy(methods,{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)});
 return {ctx,paths};
}
function assertSamePoint(a,b){assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,`world point moved from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);}
function wardArrival(){let s=initial({sr:true}),sequence=0;const send=payload=>{s=dispatchCommand(s,{name:'srWorldCommand',args:[payload],id:`command:qa-sr003-roof:${++sequence}`}).state;};const settle=()=>{let steps=0;while(s.srWorld.activeTravelId||s.srWorld.interaction){assert.ok(steps++<3000,'public movement or investigation settles');tick(s,.1);}};
 send({action:'travel',destination:'scene:valley'});settle();send({action:'move',x:26,y:23});settle();send({action:'investigate',sourceId:'object:valley:bridge'});settle();send({action:'travel',destination:'scene:quarry'});settle();send({action:'move',x:36,y:19});settle();send({action:'investigate',sourceId:'object:quarry:tools'});settle();send({action:'travel',destination:'scene:ward'});settle();assert.equal(s.master.location.sceneId,'scene:ward');assert.equal(s.personsById['person:xing-lie'].location.sceneId,'scene:ward');return validateSave(JSON.parse(JSON.stringify(s)));
}

test('SR-XF-003 rotated local art draws all four projected footprint corners, including square arrays',()=>{
 const c={rotation:Math.PI/4,depth:.65,scale:32,ox:200,oy:50},cases=[['scene:ruins','object:ruins:seal'],['scene:market','object:market:merchant'],['scene:valley','object:valley:bridge']];
 for(const [sceneId,id] of cases){const scene=WORLD_SCENES[sceneId],object=scene.objects.find(o=>o.id===id),b=worldObjectFootprint(object),expected=[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}].map(point=>spatialProject(point,c)),recording=context();drawLocalSceneObject(recording.ctx,object,scene,c,spatialProject);const first=recording.paths[0];assert.equal(first.length,4,`${id} has a four-corner footprint`);for(let i=0;i<4;i++)assertSamePoint({x:first[i][0],y:first[i][1]},expected[i]);assert.ok(Math.max(...first.map(p=>p[0]))-Math.min(...first.map(p=>p[0]))>object.width*c.scale*.6,`${id} does not collapse to a vertical line`);}
});

test('SR-XF-003 shared scene panel offers the same current actor by name',()=>{
 const s=wardArrival(),before=JSON.stringify(s),view=viewSRWorld(s),records=view.scene.objects.find(o=>o.id==='object:ward:records'),xing=view.scene.actors.find(p=>p.personId==='person:xing-lie');
 assert.ok(records&&xing);assert.equal(xing.x,47);assert.equal(xing.y,33);
 const panel=renderSRPanel(s,SIM,'explore');assert.match(panel,/查看人物 · 邢烈/);
 assert.match(panel,new RegExp(`data-ui-action="chooseScenePerson" data-ui-args="\\[${s.personsById[xing.personId].id}\\]"`));
 assert.ok(!panel.includes('查看人物 · 青萝'),'the current-scene entry excludes remote people');
 assert.equal(JSON.stringify(s),before,'current-scene projection is read-only');
});
