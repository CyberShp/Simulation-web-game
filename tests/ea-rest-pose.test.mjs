import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from '../qa/ea-sr-integration-acceptance.mjs';
import {spatialPrefab,spatialTransform,spatialProject} from '../dist/ea-sr-spatial.mjs';
import {CULTIVATOR_REST_ATLAS,restRenderAnchor,drawRestingCultivator,registerCultivatorRestAtlas} from '../dist/ea-character-art.mjs';
import {appearanceView} from '../dist/ea-sr-persons.mjs';

const camera={scale:32,depth:.62,rotation:Math.PI/4,ox:600,oy:0};
const options={prefab:spatialPrefab,transform:spatialTransform,project:spatialProject,camera};
function restingWorld(){
  const h=harness();h.act('acknowledgeIntro');h.act('masterAction','rest');
  h.until(s=>s.activitiesById[s.master.activityId]?.phase==='executing','walk to own bed');h.save();
  return h.s;
}
function recorder(){const calls=[];return {calls,ctx:new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true})};}

test('SR-XF-007: six authored resting identities keep adult length on the real bed plane',()=>{
  const s=restingWorld(),before=JSON.stringify(s),anchor=restRenderAnchor(s,s.master,options);
  assert.equal(anchor.poseVariant,'bed-rest');assert.equal(anchor.label,'卧床休养');
  const projected=appearanceView(s,s.master.personId);
  assert.equal(projected.asset,'yunxiu-courtyard:characters:v1');
  assert.equal(projected.assetRole,'identity-base');
  assert.equal(projected.sceneAssetCandidate,CULTIVATOR_REST_ATLAS.id);
  assert.equal(projected.fullAnimationAvailable,false);
  assert.deepEqual(anchor.worldPosition,{x:s.master.scenic.x,y:s.master.scenic.y});
  assert.notDeepEqual(anchor.visualWorldPosition,anchor.worldPosition);
  assert.equal(anchor.surface.length,s.master.appearance.recipe.height);
  const image={width:CULTIVATOR_REST_ATLAS.width,height:CULTIVATOR_REST_ATLAS.height};
  for(let spriteIndex=0;spriteIndex<6;spriteIndex++){
    const {ctx,calls}=recorder(),view={...s.master.appearance,spriteIndex};
    const pose=drawRestingCultivator(ctx,view,anchor,{atlas:image});
    assert.equal(pose.column,spriteIndex);assert.equal(pose.length,anchor.surface.length);
    assert.equal(pose.sourcePose,'supine');assert.equal(pose.animated,false);
    const draws=calls.filter(c=>c[0]==='drawImage');assert.equal(draws.length,1);
    const f=CULTIVATOR_REST_ATLAS.frames[spriteIndex];assert.deepEqual(draws[0].slice(2,6),[f.x,f.y,f.w,f.h]);
    assert.equal(draws[0].at(-1),s.master.appearance.recipe.height);
    assert.ok(calls.some(c=>c[0]==='transform'&&c.slice(1).every(Number.isFinite)));
  }
  assert.equal(JSON.stringify(s),before,'render projection cannot move the collision body or progress rest');
});

test('SR-XF-007: walking, missing/mismatched reservations and missing images cannot display occupied-bed rest',()=>{
  const s=restingWorld(),person=s.master,a=s.activitiesById[person.activityId];
  a.phase='navigating';assert.equal(restRenderAnchor(s,person,options),null);a.phase='executing';
  const reservation=s.reservationsById[a.reservationId];delete s.reservationsById[a.reservationId];
  assert.notEqual(restRenderAnchor(s,person,options)?.poseVariant,'bed-rest');
  assert.equal(appearanceView(s,person.personId).asset,'yunxiu-courtyard:characters:v1');
  assert.equal(appearanceView(s,person.personId).sceneAssetCandidate,null);
  s.reservationsById[a.reservationId]={...reservation,personId:'person:someone-else'};
  assert.notEqual(restRenderAnchor(s,person,options)?.poseVariant,'bed-rest');
  s.reservationsById[a.reservationId]=reservation;
  const anchor=restRenderAnchor(s,person,options),{ctx,calls}=recorder();
  registerCultivatorRestAtlas(null);assert.equal(drawRestingCultivator(ctx,person.appearance,anchor),false);
  assert.equal(drawRestingCultivator(ctx,person.appearance,anchor,{atlas:{width:1,height:1}}),false);
  assert.equal(calls.length,0);
  person.scenic.y+=.5;assert.equal(restRenderAnchor(s,person,options),null);
  assert.equal(appearanceView(s,person.personId).asset,'yunxiu-courtyard:characters:v1');
});
