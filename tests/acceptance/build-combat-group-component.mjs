/**
 * Build an isolated group-combat component source, without opening Electron.
 * node tests/acceptance/build-combat-group-component.mjs --output=/absolute/new-directory
 * The output is a component fixture; it does not prove normal player progression.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {PRISON_FORECOURT} from '../../src/simulation/ea-campaign.mjs';
import {combatCanStand} from '../../src/simulation/ea-combat-geometry.mjs';
import {projectedCombatHp} from '../../src/simulation/ea-sr-combat.mjs';
import {COURTYARD_MASTER_TERRAIN_VERSION} from '../../src/simulation/ea-courtyard-master-terrain.mjs';

export const GROUP_COMPONENT_SCHEMA='immortal-combat-component-source/v1';
export const GROUP_COMPONENT_COMPANIONS=Object.freeze(['person:lu-zhiwei','person:lin-changfeng']);
const MASTER='person:master',repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

/** Arrays are one declared setting, so adding a member cannot hide a reorder. */
export function componentWorldDiff(before,after,at=''){
 if(JSON.stringify(before)===JSON.stringify(after))return [];
 if(before===null||after===null||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after))return [{path:at,before:before??null,after:after??null}];
 return [...new Set([...Object.keys(before),...Object.keys(after)])].sort().flatMap(key=>componentWorldDiff(before[key],after[key],at+'/'+key));
}

function assertGroupState(session){
 assert.equal(validateSect(session),true);
 const s=session.state,c=s.combat,ids=[MASTER,...GROUP_COMPONENT_COMPANIONS];
 assert.equal(s.speed,0);assert.equal(c.status,'active');assert.equal(c.encounterId,'rescue');assert.equal(c.geometryId,PRISON_FORECOURT.geometryId);
 assert.equal(s.spatial.courtyardTerrain?.version,COURTYARD_MASTER_TERRAIN_VERSION);
 assert.deepEqual(c.controls,{move:{x:0,y:0},moveUntilTick:s.worldTick+5,autoAttack:false});
 assert.deepEqual(c.sceneFrame.origin,PRISON_FORECOURT.origin);assert.equal(c.sceneFrame.sceneId,PRISON_FORECOURT.sceneId);
 assert.equal(c.result,null);assert.equal(c.rewardApplied,false);assert.equal(c.allies.length,2);assert.equal(c.enemies.length,2);
 assert.deepEqual(c.allies.map(a=>a.personId),GROUP_COMPONENT_COMPANIONS);
 const battle=s.combatSessionsById[c.sessionId];assert.equal(battle.phase,'active');assert.deepEqual(battle.participantIds,ids);assert.equal(battle.combatantIds.length,2);
 for(const actor of [c.player,...c.allies,...c.enemies]){
  assert(combatCanStand(actor,c.geometryId));
  const record=actor.personId?s.personsById[actor.personId]:s.world.encounterCombatantsById[actor.combatantId];
  assert(record);assert.equal(record.lifeStatus,'alive');assert(actor.hp>0&&actor.hp<=actor.maxHp);
  assert.deepEqual(record.location,{kind:'local',sceneId:c.sceneFrame.sceneId,x:c.sceneFrame.origin.x+actor.x,y:c.sceneFrame.origin.y+actor.y});
  if(actor.personId){assert.equal(actor.hp,projectedCombatHp(record,actor.maxHp));assert.equal(record.combatSessionId,c.sessionId);assert.equal(s.activitiesById[record.activityId].orderId,c.sessionId);}
  else{assert(battle.combatantIds.includes(actor.combatantId));assert.equal(record.wound,0);}
 }
 assert.equal(new Set(ids.map(id=>s.personsById[id].id)).size,3,'every participant must retain a distinct canonical person');
}

/** Pure in-memory builder. Only the CLI below writes a fresh component directory. */
export function buildCombatGroupComponent(){
 const base=createSectSession(),baseWorld=clone(base.state),baseProvenance=clone(base.provenance),settings=[];
 const s=base.state;
 const setting=(at,before,after,reason)=>settings.push({path:at,before:clone(before),after:clone(after),reason,source:'component-fixture'});
 setting('/personsById/person:master/realm',s.master.realm,10,'Provide the foundation realm required by the existing rescue encounter; cultivation is not demonstrated.');s.master.realm=10;
 const lin=s.personsById[GROUP_COMPONENT_COMPANIONS[1]];assert(lin&&lin.lifeStatus==='alive','reuse the existing persistent Lin Changfeng, never clone a second actor');
 assert(!s.homeMemberIds.includes(lin.personId),'the bundled base should retain Lin as an existing unadmitted person');
 const members=[...s.homeMemberIds,lin.personId];setting('/homeMemberIds',s.homeMemberIds,members,'Include the existing Lin Changfeng in this component roster; normal admission is not demonstrated.');s.homeMemberIds=members;
 assert(s.homeMemberIds.length<=SIM.capacity(s),'the component roster must fit the existing base capacity');
 const known=[...new Set([...s.srWorld.knownScenes,PRISON_FORECOURT.sceneId])];setting('/srWorld/knownScenes',s.srWorld.knownScenes,known,'Expose the existing prison destination; route discovery is not demonstrated.');s.srWorld.knownScenes=known;
 const preconditionsWorld=clone(s),declared=settings.map(({path,before,after})=>({path,before,after})).sort((a,b)=>a.path.localeCompare(b.path)),actual=componentWorldDiff(baseWorld,preconditionsWorld).sort((a,b)=>a.path.localeCompare(b.path));
 assert.deepEqual(actual,declared,'all precondition changes must be explicitly declared');
 const checked=SIM.validateSave(s);assert.deepEqual(clone(checked),preconditionsWorld,'validation must not silently introduce another fixture setting');
 // Preserve the valid bundled base provenance. This derived artifact is labelled
 // separately because the frozen loader validates the base-source kind.
 const provenance={...baseProvenance,artifactKind:'component-fixture',normalPlayerProgression:false,fixture:{schema:GROUP_COMPONENT_SCHEMA,settings:clone(settings),baseStateSha256:hash(baseWorld)}};
 const session=createSectSession({source:{state:checked,provenance}}),operations=[];
 const record=(api,request,beforeTick,beforeHash,result)=>operations.push({api,request:clone(request),beforeTick,afterTick:session.state.worldTick,beforeWorldSha256:beforeHash,afterWorldSha256:hash(session.state),commandId:result?.commandId||null,status:result?.status||'committed'});
 const command=(request,purpose)=>{const beforeTick=session.state.worldTick,beforeHash=hash(session.state),result=commandSect(session,request);assert.equal(result.ok,true,result.error);record('commandSect',request,beforeTick,beforeHash,result);if(purpose)operations.at(-1).purpose=purpose;return result;};
 const engine=(name,...args)=>{const request={name,args},beforeTick=session.state.worldTick,beforeHash=hash(session.state),result=SIM.dispatchCommand(session.state,request);session.state=result.state;record('SIM.dispatchCommand',request,beforeTick,beforeHash,result);return result;};
 const until=(predicate,label)=>{const fromTick=session.state.worldTick,beforeWorldSha256=hash(session.state);let steps=0;while(!predicate(session.state)&&steps<5000){advanceSect(session,.1);steps++;}assert(predicate(session.state),label);operations.push({api:'advanceSect',label,stepSeconds:.1,steps,fromTick,toTick:session.state.worldTick,beforeWorldSha256,afterWorldSha256:hash(session.state)});};
 command({type:'enable-courtyard-terrain'},'desktop-terrain-initialization');
 const candidates=viewSect(session).expedition.world.party.candidates;
 for(const personId of GROUP_COMPONENT_COMPANIONS)assert(candidates.some(p=>p.personId===personId&&p.available),`the real person is not currently willing to travel: ${personId}`);
 const identities=Object.fromEntries([MASTER,...GROUP_COMPONENT_COMPANIONS].map(id=>{const p=session.state.personsById[id];return [id,{id:p.id,name:p.name,appearance:clone(p.appearance),realm:p.realm,wound:p.wound,energy:p.energy}];}));
 command({type:'pause',paused:false});
 engine('srWorldCommand',{action:'travel',destination:PRISON_FORECOURT.sceneId,companions:[...GROUP_COMPONENT_COMPANIONS],cargo:{food:8}});
 const travelId=session.state.srWorld.activeTravelId;assert(travelId);
 until(state=>!state.srWorld.activeTravelId,'the original three-person party must complete the public prison journey');
 assert.deepEqual(session.state.travelsById[travelId].participantIds,[MASTER,...GROUP_COMPONENT_COMPANIONS]);
 command({type:'world',action:{action:'move',...PRISON_FORECOURT.approach}});
 until(state=>!state.srWorld.interaction,'all three people must complete the real walk to the prison forecourt');
 const gate=viewSect(session).expedition.world.scene.objects.find(o=>o.id==='object:prison:gate');assert.equal(gate.near,true);assert.equal(gate.available,true);
 command({type:'world',action:{action:'engage',objectId:'object:prison:gate'}});
 command({type:'combat-input',move:{x:0,y:0},reset:true},'paused-combat-input-boundary');
 command({type:'pause',paused:true});assertGroupState(session);
 for(const [id,before]of Object.entries(identities)){const person=session.state.personsById[id];assert.equal(person.id,before.id);assert.equal(person.name,before.name);assert.deepEqual(person.appearance,before.appearance);}
 const context={schema:GROUP_COMPONENT_SCHEMA,kind:'component-fixture',normalPlayerProgression:false,mode:'group-fixture',scope:'Three real canonical people versus the two existing rescue guards; component rendering/input/contact validation only.',base:{module:'apps/courtyard/sect-sim.mjs#createSectSession',provenance:baseProvenance,stateSha256:hash(baseWorld),tick:baseWorld.worldTick},settings,rawPreconditionDiff:actual,validationIntroducedSettings:false,operations,travelId,identities,field:{...clone(PRISON_FORECOURT),bounds:{left:.6,right:11.4,top:.6,bottom:7.4}},final:{tick:session.state.worldTick,stateSha256:hash(session.state),sessionId:session.state.combat.sessionId,actorCount:5,personIds:[MASTER,...GROUP_COMPONENT_COMPANIONS],combatantIds:[...session.state.combatSessionsById[session.state.combat.sessionId].combatantIds]},publicWorldDiff:componentWorldDiff(preconditionsWorld,clone(session.state))};
 context.desktopStartupContract={terrainVersion:session.state.spatial.courtyardTerrain.version,terrainOperationIndex:operations.findIndex(o=>o.purpose==='desktop-terrain-initialization'),inputResetOperationIndex:operations.findIndex(o=>o.purpose==='paused-combat-input-boundary'),controls:clone(session.state.combat.controls),manualPause:true};
 const native=snapshotSect(session);native.source=clone(context);native.courtyardPresentation={version:2,manualPause:true,route:[],destination:null};
 assert.equal(native.provenance.artifactKind,'component-fixture');assert.equal(native.source.kind,'component-fixture');assert.equal(native.courtyardPresentation.manualPause,true);
 const restored=restoreSect(clone(native));assertGroupState(restored);assert.deepEqual(restored, native,'the native QA envelope and whole world must read back exactly');
 return {native,context,baseWorld,preconditionsWorld};
}

export function checkedComponentOutput(output){
 assert(output&&path.isAbsolute(output),'Pass an absolute --output directory.');const directory=path.resolve(output),root=path.resolve(repositoryRoot);
 assert(directory!==root&&!directory.startsWith(root+path.sep),'Component output must be outside the repository.');return directory;
}

async function main(){
 const output=checkedComponentOutput(process.argv.find(value=>value.startsWith('--output='))?.slice('--output='.length));
 assert(!process.argv.some(value=>value.startsWith('--source=')),'This component builder accepts no user or official save source.');
 const built=buildCombatGroupComponent(),nativeName='combat-group-component-session.json',json=value=>JSON.stringify(value,null,2)+'\n';
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});
 const nativeBytes=json(built.native),context={...built.context,nativeFile:nativeName,nativeSha256:hash(nativeBytes),builderFile:fileURLToPath(import.meta.url),nodeVersion:process.version};
 for(const [name,value]of [['component-base-world.json',built.baseWorld],['component-preconditions-world.json',built.preconditionsWorld],[nativeName,built.native],['component-source-context.json',context]])await fs.writeFile(path.join(output,name),json(value),{flag:'wx'});
 await fs.writeFile(path.join(output,'executed-component-builder.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
 console.log(json({kind:'component-fixture',normalPlayerProgression:false,source:path.join(output,nativeName),context:path.join(output,'component-source-context.json'),tick:built.native.state.worldTick,participants:built.context.final.personIds,combatantIds:built.context.final.combatantIds}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
