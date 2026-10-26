import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatPresentation} from '../../../apps/courtyard/courtyard-combat-presentation.mjs';
import {advanceStudyShot,studyMuzzle,sweepStudyBody} from '../../../src/simulation/ea-combat-study-body.mjs';
import {sampleSwordStudyBody,STUDY_GROUND_Y_SCALE as Y} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';
import {combatClearLine} from '../../../src/simulation/ea-combat-geometry.mjs';

const actor=(id,x,y)=>({id,personId:id==='master'?'person:master':'person:valley-shanxiao',visualIdentity:id==='master'?'shen-yan':'shanxiao',faction:id==='master'?'sect':'hostile',x,y,hp:100,facing:{x:-1,y:0},motion:{action:'idle',phase:'idle',direction:{x:-1,y:0},moveIntent:{x:0,y:0},phaseStartedTick:100,phaseDurationTicks:1}});
function fixture(direction={x:0,y:1},feetY=10){
 const player=actor('master',10,feetY),from=studyMuzzle(player),shot={id:1,sourceId:'master',ownerFaction:'sect',kind:'sword-qi',...from,from:{...from},direction,space:'visible-body-v1',coreLength:.7,coreWidth:.1,speed:12,radius:.05,remainingDistance:8,launchedTick:100};
 return {type:'combat',sessionId:'combat:study-preview',tick:100,rulesProfile:'sword-study-v1',geometryId:'valley-open-v2',geometryVersion:2,regionId:'valley',arena:{width:48,height:32,bounds:{left:.6,right:47.4,top:.6,bottom:31.4}},player,allies:[],enemies:[],effects:[],projectiles:[shot]};
}
const near=(actual,expected)=>{assert(Math.abs(actual.x-expected.x)<1e-9);assert(Math.abs(actual.y-expected.y)<1e-9);};

test('visible-space interpolation uses the same cardinal and diagonal metre displacement as formal flight',()=>{
 for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:Math.SQRT1_2,y:Math.SQRT1_2},{x:-Math.SQRT1_2,y:-Math.SQRT1_2}]){
  const scene=fixture(direction),before=structuredClone(scene),p=createCombatPresentation();p.sample(scene,{now:0});
  for(const now of [10,50,90]){const expected=advanceStudyShot(scene.projectiles[0],direction,12*now/1000),view=p.sample(scene,{now});near(view.projectiles[0],expected);near(p.sample(scene,{now}).projectiles[0],expected);}
  assert.deepEqual(scene,before);
 }
});

test('an upper-edge body-height ray stays in its air coordinate space without a foot-ground clamp',()=>{
 for(const direction of [{x:0,y:-1},{x:1,y:0}]){
  const scene=fixture(direction,.6),p=createCombatPresentation();assert(scene.projectiles[0].y<.6);p.sample(scene,{now:0});
  near(p.sample(scene,{now:50}).projectiles[0],advanceStudyShot(scene.projectiles[0],direction,.6));
 }
});

test('prediction stops on the shared native head alpha before contact without changing HP or creating hit effects',()=>{
 const scene=fixture({x:1,y:0}),foe=actor('enemy-1',20,20),frame=sampleSwordStudyBody(foe,scene.tick),row=frame.rows[Math.floor(frame.rows.length*.2)];scene.enemies=[foe];
 const nativeX=(row[1]+row[2])/2,target={x:foe.x+(nativeX-frame.root[0])*frame.scale*(frame.mirror?-1:1),y:foe.y+(row[0]+.5-frame.root[1])*frame.scale/Y};
 Object.assign(scene.projectiles[0],{x:target.x-1,y:target.y,from:{x:target.x-1,y:target.y}});
 const p=createCombatPresentation(),before=structuredClone(scene);p.sample(scene,{now:0});const shot=scene.projectiles[0],step=1.08,end=advanceStudyShot(shot,shot.direction,step),hit=sweepStudyBody(shot,end,shot.direction,foe,frame,shot.coreLength,shot.coreWidth);assert(hit);
 near(p.sample(scene,{now:90}).projectiles[0],advanceStudyShot(shot,shot.direction,step*hit.fraction));assert.deepEqual(scene,before);assert.equal(scene.effects.length,0);assert.equal(foe.hp,100);
});

test('transparent space above the selected native body does not inherit its foot-circle stop',()=>{
 const scene=fixture({x:1,y:0}),foe=actor('enemy-1',20,20),frame=sampleSwordStudyBody(foe,scene.tick);scene.enemies=[foe];
 Object.assign(scene.projectiles[0],{x:foe.x-1,y:foe.y-(frame.height+50)*frame.scale/Y});const p=createCombatPresentation();p.sample(scene,{now:0});
 near(p.sample(scene,{now:90}).projectiles[0],advanceStudyShot(scene.projectiles[0],{x:1,y:0},1.08));
});

test('air preview respects the same unexpanded obstruction line without applying actor walking margins',()=>{
 const scene=fixture({x:1,y:0});Object.assign(scene.projectiles[0],{x:6.5,y:3,from:{x:6.5,y:3}});const p=createCombatPresentation();p.sample(scene,{now:0});
 const shown=p.sample(scene,{now:90}).projectiles[0];assert(shown.x>6.99&&shown.x<7.00001);assert.equal(shown.y,3);assert(combatClearLine(scene.projectiles[0],shown,scene.geometryId));
});

test('paused new-space preview freezes its fractional position and resumes without rewinding',()=>{
 const scene=fixture(),p=createCombatPresentation();p.sample(scene,{now:0});const partial=p.sample(scene,{now:50}).projectiles[0];
 const paused=p.sample(scene,{now:60,paused:true}).projectiles[0];near(paused,partial);near(p.sample(scene,{now:500,paused:true}).projectiles[0],partial);
 near(p.sample(scene,{now:600}).projectiles[0],partial);near(p.sample(scene,{now:620}).projectiles[0],advanceStudyShot(scene.projectiles[0],scene.projectiles[0].direction,.84));
});

test('unmarked legacy projectiles retain their established world-plane interpolation',()=>{
 const scene=fixture();delete scene.rulesProfile;const shot=scene.projectiles[0];delete shot.space;delete shot.coreLength;delete shot.coreWidth;shot.kind='spell';shot.speed=8;shot.radius=.45;
 const p=createCombatPresentation();p.sample(scene,{now:0});const shown=p.sample(scene,{now:50}).projectiles[0];
 assert(Math.abs(shown.x-shot.x)<1e-9);assert(Math.abs(shown.y-(shot.y+.4))<1e-6);
});
