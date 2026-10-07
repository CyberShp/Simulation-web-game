/** SR-XF-007-AC-03: one earned identity across rest, study and paused harvest. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {spatialPrefab,spatialProject,spatialTransform} from '../dist/ea-sr-spatial.mjs';
import {CULTIVATOR_ACTIVITY_ATLAS,cultivatorSpriteFrame,restRenderAnchor} from '../dist/ea-character-art.mjs';

function earnedStates(){
 const h=normalOpening();
 h.act('masterAction','rest');h.until(s=>s.activitiesById[s.master.activityId]?.phase==='executing','real bed arrival',1000);
 h.act('setSpeed',0);h.save();const rest=h.s,restCounts=h.counts;
 h.act('setSpeed',1);const studyOrder=h.act('masterStudy','spring');
 h.until(s=>s.srCultivation.orders[studyOrder.orderId]?.phase==='executing','real desk arrival',200);
 h.act('setSpeed',0);h.save();const study=h.s,studyCounts=h.counts;
 h.act('setSpeed',1);h.until(s=>s.srCultivation.orders[studyOrder.orderId]?.phase==='completed','study completion',1000);
 for(let i=0;i<4;i++){
  const order=h.act('startMasterHarvest','wood');
  h.until(s=>!s.activitiesById[order.id]||s.activitiesById[order.id].phase==='paused','real harvest or full-pack pause',500);
 }
 h.act('setSpeed',0);h.save();const waiting=h.s,waitingCounts=h.counts;
 return {states:{rest,study,waiting},counts:{rest:restCounts,study:studyCounts,waiting:waitingCounts}};
}

test('SR-XF-007-AC-03: public rest → study → waiting keeps one body and truthful static fallback',()=>{
 const {states,counts}=earnedStates(),identity=JSON.stringify(states.rest.master.appearance),portrait=states.rest.master.personId;
 const wanted={rest:{action:'rest',tool:null,life:'rest'},study:{action:'study',tool:'book',life:'study'},waiting:{action:'waiting',tool:null,life:'waiting'}};
 for(const [name,s] of Object.entries(states)){
  const raw=JSON.stringify(s),person=s.master,body=s.activitiesById[person.activityId],view=S.appearanceView(s,'person:master'),life=S.personLifeSummary(s,person);
  assert.equal(JSON.stringify(person.appearance),identity,`${name}: saved appearance identity`);
  assert.equal(person.personId,portrait);assert.equal(view.personId,portrait);
  assert.equal(s.speed,0);assert.equal(view.action,wanted[name].action);
  assert.equal(view.tool,wanted[name].tool);assert.equal(view.fullAnimationAvailable,false);
  assert.equal(life.activity,wanted[name].life);
  if(name==='waiting'){
   assert.equal(body.kind,'sr-harvest');assert.equal(body.phase,'paused');
   assert.equal(life.status,'waiting');assert.equal(life.facilityId,null);
   assert.match(life.reason,/随身包裹已满/);
   assert.equal(s.stockpilesById['stockpile:carried:master'].resources.wood,36);
  }else{
   assert.equal(body.phase,'executing');assert(body.slotId);
   assert(life.slotId===body.slotId&&life.facilityId!=null);
  }
  assert.equal(JSON.stringify(S.validateSave(JSON.parse(raw))),raw,`${name}: exact save/reload`);
  assert.equal(JSON.stringify(s),raw,`${name}: read-only projections`);
 }
 const studyView=S.appearanceView(states.study,'person:master'),waitingView=S.appearanceView(states.waiting,'person:master');
 const available={complete:true,width:CULTIVATOR_ACTIVITY_ATLAS.width,height:CULTIVATOR_ACTIVITY_ATLAS.height};
 for(const view of [studyView,waitingView]){
  const painted=cultivatorSpriteFrame(view,0,{activityAtlas:available});
  assert.equal(painted.column,view.spriteIndex);assert.equal(painted.sourcePose,view.action);
  assert.equal(painted.animated,false);assert.equal(painted.fullAnimationAvailable,false);
  const fallback=cultivatorSpriteFrame(view,0,{activityAtlas:null});
  assert.equal(fallback.column,view.spriteIndex);assert.equal(fallback.asset,'yunxiu-courtyard:characters:v1');
  assert.equal(fallback.fullAnimationAvailable,false);
 }
 const resting=states.rest,anchor=restRenderAnchor(resting,resting.master,{prefab:spatialPrefab,transform:spatialTransform,project:spatialProject,camera:{scale:32,depth:.65,ox:0,oy:0}});
 assert.equal(anchor?.poseVariant,'bed-rest');
 assert.ok(counts.waiting.commands>=40&&counts.waiting.saves>=23,`normal public chain ${JSON.stringify(counts)}`);
 const output=process.env.XIANFU_QA_PERSON_DIR;
 if(output){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dir=resolve(output),rel=relative(root,dir);
  assert(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel),'QA sources belong outside the source repository');
  mkdirSync(dir,{recursive:true});
  const persistence=createEAPersistence({validate:S.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr007-ac03',now:()=>Date.now()});
  for(const [name,s] of Object.entries(states)){
   writeFileSync(resolve(dir,`person-${name}.json`),JSON.stringify({provenance:{kind:'normal-public-command-checkpoint',label:`SR-XF-007-AC-03 ${name}`,counts:counts[name]},state:s}));
   writeFileSync(resolve(dir,`person-${name}-import.json`),persistence.exportState(s,{slot:1}));
  }
 }
});
