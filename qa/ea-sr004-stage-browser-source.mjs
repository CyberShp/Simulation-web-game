/** SR-XF-004-AC-01: reproduce browser stage evidence from a legal complete save.
 * Outputs are local QA snapshots. Every construction snapshot follows the
 * production command gateway and the single simulation clock.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import * as S from '../dist/ea-opening-sim.mjs';
import {viewSpatial,spatialPrefab,spatialAccess,placementIssue} from '../dist/ea-sr-spatial.mjs';

const source=new URL('./ea-reference-world.json',import.meta.url);
const out=resolve(process.argv[2]||'/tmp/immortal-sr004-stage-sources');
const original=JSON.parse(readFileSync(source,'utf8'));
assert.equal(original.version,5);
const originalText=JSON.stringify(original);
const migrated=S.validateSave(original,{upgrade:true});
assert.equal(migrated.schemaVersion,6);
assert.equal(migrated.buildings.length,40);
assert.equal(migrated.disciples.length,30);
assert.equal(JSON.stringify(original),originalText,'loading cannot change source');
mkdirSync(out,{recursive:true});
const types=['farm','lumber','quarry','house','meditation','library','well','granary','clinic','workshop'];
const uniqueTypes=['alchemy','kitchen','watchtower'];
const onlyUnique=process.argv.includes('--unique-only');
const onlyHall=process.argv.includes('--hall-only');
const report={source:'qa/ea-reference-world.json',sourceVersion:5,schemaVersion:migrated.schemaVersion,sourceBuildings:40,sourcePeople:30,checks:[],coverage:'Ten repeatable types are built directly. Three unique types are rebuilt after their original instance is demolished through the public command. The hall may only be upgraded.'};
function checkpoint(type,stage,s,building,placement){
 const raw=JSON.stringify(s);assert.equal(JSON.stringify(S.validateSave(JSON.parse(raw))),raw,`${type}/${stage} exact save`);
 const name=`${type}-${stage}.json`;
 writeFileSync(join(out,name),raw);
 const prefab=spatialPrefab(building);
 report.checks.push({type,stage,file:name,worldTick:s.worldTick,buildingId:building?.instanceId,transform:building?.transform,metres:{width:prefab.width,height:prefab.height},door:spatialAccess(building),placement});
}
function captureNewBuild(type,s){
 const placement=S.recommendedPlacement(s,type);
 assert(placement,`${type}: legal placement exists`);
 assert.equal(placementIssue(s,type,placement.x,placement.y),'',`${type}: clear metre footprint`);
 const candidate={type,level:1,buildingGridVersion:s.spatial.buildingGridVersion,interiorLayoutVersion:s.spatial.interiorLayoutVersion,transform:{x:placement.x,y:placement.y,orientation:'south'}};
 checkpoint(type,'preview',s,candidate,placement);
 const command=S.dispatchCommand(s,{name:'build',args:[type,placement.x,placement.y]});s=command.state;
 const workId=command.result.workOrderId;
 const instanceId=`building:yunxiu:${command.result.id}`;
 assert(workId,`${type}: public construction created`);
 let view=viewSpatial(s);assert.equal(view?.stage,'foundation');
 checkpoint(type,'foundation',s,view.building,placement);
 const wanted=['structure','finishing'];const seen=new Set(['foundation']);
 for(let step=0;step<120;step++){
  S.tick(s,1);
  view=viewSpatial(s);
  if(view&&wanted.includes(view.stage)&&!seen.has(view.stage)){
   assert(view.progress>0&&view.progress<1);
   checkpoint(type,view.stage,s,view.building,placement);seen.add(view.stage);
  }
  if(!view&&s.buildings.some(b=>b.instanceId===instanceId))break;
 }
 assert(seen.has('structure')&&seen.has('finishing'),`${type}: all actual construction stages reached`);
 const completed=s.buildings.find(b=>b.instanceId===instanceId);
 assert(completed,`${type}: complete after public ticks`);
 checkpoint(type,'complete',s,completed,placement);
 console.log(`${type}: ${[...seen,'complete'].join(',')} at tick ${s.worldTick}`);
}
if(onlyHall){
 let s=S.cloneState(migrated);
 const hall=s.buildings.find(b=>b.type==='hall');
 assert(hall&&hall.level===1,'source has an upgradeable hall');
 const initial={...hall.transform};
 checkpoint('hall','before-upgrade',s,hall,initial);
 let command;
 const cleared=[];
 for(let attempt=0;attempt<10;attempt++){
  try{command=S.dispatchCommand(s,{name:'upgrade',args:[hall.id]});break;}
  catch(error){
   const conflictId=Number(String(error.message).match(/（(\d+)）占地冲突/)?.[1]);
   assert(conflictId&&conflictId!==hall.id,`upgrade cannot be prepared through public commands: ${error.message}`);
   const blocker=s.buildings.find(b=>b.id===conflictId);
   assert(blocker,`conflicting building ${conflictId} exists`);
   const removal=S.dispatchCommand(s,{name:'demolish',args:[conflictId]});s=removal.state;
   assert(removal.result.workOrderId);
   for(let step=0;step<200&&s.buildings.some(b=>b.id===conflictId);step++)S.tick(s,1);
   assert(!s.buildings.some(b=>b.id===conflictId),`blocker ${conflictId} removed by real ticks`);
   cleared.push({id:conflictId,type:blocker.type});
  }
 }
 assert(command,`hall upgrade can start after clearing ${cleared.length} blockers`);
 report.clearedForHall=cleared;
 s=command.state;
 assert(command.result.workOrderId,'public upgrade starts');
 const orderId=command.result.workOrderId;
 let captured=false;
 for(let step=0;step<400;step++){
  S.tick(s,1);
  const view=viewSpatial(s);
  if(view?.operation==='upgrade'&&view.progress>0&&!captured){
   checkpoint('hall','upgrading',s,view.building,initial);captured=true;
  }
  if(!s.workOrdersById[orderId])break;
 }
 assert(captured,'upgrade stage was displayed');
 const complete=s.buildings.find(b=>b.id===hall.id);
 assert.equal(complete?.level,2,'hall upgrade completes');
 assert.deepEqual(complete.transform,initial,'hall keeps its metre anchor');
 checkpoint('hall','upgraded',s,complete,initial);
} else if(!onlyUnique)for(const type of types)captureNewBuild(type,S.cloneState(migrated));
if(!onlyHall)for(const type of uniqueTypes){
 let s=S.cloneState(migrated);
 const originalBuilding=s.buildings.find(b=>b.type===type);
 assert(originalBuilding,`${type}: source instance exists`);
 const demolition=S.dispatchCommand(s,{name:'demolish',args:[originalBuilding.id]});s=demolition.state;
 assert(demolition.result.workOrderId,`${type}: public demolition starts`);
 for(let step=0;step<150&&s.buildings.some(b=>b.id===originalBuilding.id);step++)S.tick(s,1);
 assert(!s.buildings.some(b=>b.id===originalBuilding.id),`${type}: original instance removed by public ticks`);
 assert(s.spatial.completedOrders.some(order=>order.operation==='demolish'&&order.id===demolition.result.workOrderId),`${type}: demolition recorded`);
 captureNewBuild(type,s);
}
writeFileSync(join(out,onlyHall?'hall-report.json':onlyUnique?'unique-report.json':'report.json'),JSON.stringify(report,null,2));
console.log(`Wrote ${report.checks.length} stage source snapshots to ${out}`);
