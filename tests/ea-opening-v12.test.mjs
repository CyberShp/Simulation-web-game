import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as w from '../dist/ea-opening-sim.mjs';
import * as old from '../dist/ea-sim.mjs';
import {scenicHomeActors,nextObjective} from '../dist/ea-scene-state.mjs';
import {homeInteractions,sceneDialogue} from '../dist/ea-narrative.mjs';
import {createEAPersistence,slotKeys} from '../dist/ea-persistence.mjs';
import {memoryStorage,memoryLocks} from '../qa/ea-storage-fixture.mjs';
import * as v1 from '../dist/model.mjs';
import * as v2 from '../dist/world.mjs';
import * as v3 from '../dist/living-world.mjs';
import * as v4 from '../dist/sect-sim.mjs';
import {runOpening} from '../qa/ea-opening-v12-acceptance.mjs';
import {buildingAccess} from '../dist/ea-scenic.mjs';

const act=(s,name,...args)=>w.dispatchCommand(s,{name,args}).state;
function healed(){let s=act(w.initial(),'masterAction','heal');for(let n=0;n<120&&s.master.wound;n++)w.tick(s,1);assert.equal(s.master.wound,0);const target=buildingAccess(s,s.buildings.find(b=>b.type==='hall'));s=act(s,'moveScenicMaster',target.x,target.y);for(let n=0;n<60&&s.master.action==='walk';n++)w.tick(s,1);return act(s,'advanceStory');}
function joined(choice='invite'){let s=act(healed(),'advanceStory','gift');return act(s,'advanceStory',choice);}
function startBuilding(s,type='farm'){
 const cell=w.CELLS.find(p=>!w.placementLock(s,type,p.x,p.y));
 return act(s,'build',type,cell.x,cell.y);
}

test('v6 canonical identities are serialized once and scene/UI use the same records',()=>{
 const s=w.initial(),visitor=s.personsById['person:lu-zhiwei'];
 assert.equal(s.master,s.personsById['person:master']);
 assert.equal(scenicHomeActors(s)[0],visitor);
 const saved=JSON.parse(JSON.stringify(s));
 for(const alias of ['version','master','disciples','buildings','time'])assert.equal(alias in saved,false);
 const loaded=w.validateSave(saved);
 assert.deepEqual(loaded.personsById,s.personsById);
 assert.equal(loaded.master,loaded.personsById['person:master']);
 assert.equal(loaded.buildings[0],loaded.buildingsById['building:yunxiu:1']);
});

test('world tick subdivision, save boundaries and pause preserve deterministic results',()=>{
 const coarse=joined(),fine=w.cloneState(coarse);
 w.tick(coarse,123.45);for(let i=0;i<2469;i++)w.tick(fine,.05);
 assert.deepEqual(coarse,fine);
 const loaded=w.validateSave(JSON.parse(JSON.stringify(fine)));
 w.tick(coarse,22.3);w.tick(loaded,22.3);assert.deepEqual(coarse,loaded);
 loaded.speed=0;const before=JSON.stringify(loaded);w.tick(loaded,10000);assert.equal(JSON.stringify(loaded),before);
});

test('free courtyard walk advances every world step and resumes from an in-motion save',()=>{
 let s=act(w.initial({sr:true}),'moveScenicMaster',35,28);
 const start={x:s.master.scenic.x,y:s.master.scenic.y};
 const steps=[];
 for(let i=0;i<10;i++){
  w.tick(s,.1);
  steps.push(Math.hypot(s.master.scenic.x-start.x,s.master.scenic.y-start.y));
 }
 assert(steps.every((distance,i)=>distance>0&&(i===0||distance>steps[i-1])));
 assert(Math.abs(steps[9]-1.4375)<1e-6,'ten small steps retain the old one-second walking speed');
 const loaded=w.validateSave(JSON.parse(JSON.stringify(s)));
 w.tick(s,2.3);w.tick(loaded,2.3);
 assert.deepEqual(s,loaded);
 s.speed=0;const held=JSON.stringify(s);w.tick(s,10);assert.equal(JSON.stringify(s),held);
});

test('gift, voluntary membership and companion invitation are distinct persistent facts',()=>{
 let s=healed(),herbs=s.resources.herb;
 s=act(s,'advanceStory','gift');
 assert.equal(s.resources.herb,herbs-10);assert.equal(s.disciples.length,0);assert.equal(s.story.step,1);
 assert.equal(s.stockpilesById['stockpile:lu-zhiwei'].resources.herb,10);
 assert.equal(homeInteractions(s)[0].choices.length,2);
 const identity=s.personsById['person:lu-zhiwei'].personId;
 s=w.validateSave(JSON.parse(JSON.stringify(s)));s=act(s,'advanceStory','invite');
 assert.equal(s.disciples[0],s.personsById[identity]);assert.equal(s.resources.herb,herbs-10);
 assert.equal(s.world.exploration,null);assert.equal(s.story.opening.invitation,'joined');
});

test('legacy v1 to v4 saves enter v6 without changing their source assets or input',()=>{
 for(const module of [v1,v2,v3,v4]){const source=module.initial(),before=JSON.stringify(source),oldState=old.validateSave(source),s=w.validateSave(source);assert.equal(JSON.stringify(source),before);assert.deepEqual(s.resources,oldState.resources);assert.deepEqual(s.pills,oldState.pills);assert.equal(s.disciples.length,oldState.disciples.length);assert.equal(s.schemaMigration.from,source.version);assert.equal(s.story.opening,undefined);}
});

test('both normal opening routes reach autonomous output, study and their first trip',()=>{
 for(const invitation of ['invite','decline']){const {state,report}=runOpening({invitation});assert.equal(state.story.step,4);assert.ok(state.story.onboarding.productions.length>0);assert.ok(state.master.knowledge.spring>=20);assert.equal(state.world.exploration,null);assert.equal(report.checks,6);}
});

test('study starts at its facility and cannot earn understanding while walking',()=>{
 let s=runOpening().state;const target=buildingAccess(s,s.buildings.find(b=>b.type==='hall'));
 s=act(s,'moveScenicMaster',target.x,target.y);w.tick(s,90);
 const before=s.master.knowledge.spring;s=act(s,'masterStudy','spring');
 assert.equal(s.master.learning.waitingForArrival,true);assert.ok(s.master.action==='walk'||s.activitiesById[s.master.activityId]?.phase==='waiting');
 w.tick(s,.1);assert.equal(s.master.knowledge.spring,before);assert.equal(s.master.learning.progress,0);
 const loaded=w.validateSave(JSON.parse(JSON.stringify(s)));w.tick(s,80);w.tick(loaded,80);assert.deepEqual(s,loaded);assert.ok(s.master.knowledge.spring>before);
});

test('future native saves remain untouched and cannot be overwritten after failed inspection',async t=>{
 const storage=memoryStorage(),namespace='qa:opening-future:',state=JSON.parse(JSON.stringify(w.initial()));state.schemaVersion=7;
 const raw=JSON.stringify({format:'xianfu-ea',formatVersion:1,slot:1,savedAt:1,dataVersion:7,gameVersion:'future',revision:1,writerId:'future',checkpoint:null,state});
 storage.setItem(slotKeys(1,namespace).primary,raw);
 const store=createEAPersistence({getStorage:()=>storage,locks:memoryLocks(),namespace,dataVersion:6,validate:w.validateSave,channelFactory:null});t.after(()=>store.close());
 const opened=await store.open(1);assert.equal(opened.status,'recovery-required');assert.equal(store.saveNow(w.initial()).ok,false);assert.equal(storage.getItem(slotKeys(1,namespace).primary),raw);
});

test('declining membership keeps the gift and opens the independent construction path',()=>{
 let s=joined('decline');
 assert.equal(s.disciples.length,0);assert.equal(s.story.step,2);assert.equal(s.story.opening.gifted,true);
 assert.ok(!scenicHomeActors(s).some(p=>p.personId==='person:lu-zhiwei'));
 assert.match(sceneDialogue(s,'chapter:2').pages[0].text,/先回去/);
 s=startBuilding(s);w.tick(s,100);assert.ok(s.buildings.some(b=>b.type==='farm'));
});

test('commands are revision checked, atomic and retry safe even after save/load',()=>{
 let s=healed();const revision=s.revision,original=JSON.stringify(s),id=`command:${s.transactions.nextCommandId}`;
 assert.throws(()=>w.dispatchCommand(s,{name:'build',args:['missing',999,999],expectedRevision:revision}));
 assert.equal(JSON.stringify(s),original);
 assert.throws(()=>w.dispatchCommand(s,{name:'masterAction',args:['rest'],expectedRevision:revision-1}),/已更新/);
 const command={name:'advanceStory',args:['gift'],id,expectedRevision:revision};s=w.dispatchCommand(s,command).state;
 s=w.validateSave(JSON.parse(JSON.stringify(s)));const after=JSON.stringify(s),replay=w.dispatchCommand(s,command);
 assert.equal(replay.replayed,true);assert.equal(JSON.stringify(replay.state),after);
 assert.throws(()=>w.dispatchCommand(s,{...command,args:['invite']}),/不同请求/);
});

test('construction reserves once, walks to the site and cannot produce before completion',()=>{
 let s=joined();const wood=s.resources.wood;
 s=startBuilding(s);const a=w.constructionStatus(s);
 assert.equal(s.resources.wood,wood-w.BUILDINGS.farm.cost.wood);
 assert.equal(s.buildings.length,1);assert.equal(a.phase,'moving');assert.equal(nextObjective(s).kind,'construction');
 assert.throws(()=>w.dispatchCommand(s,{name:'masterAction',args:['wood']}),/正在营造/);
 w.tick(s,.1);assert.equal(s.buildings.length,1);
 const resumed=w.validateSave(JSON.parse(JSON.stringify(s)));
 w.tick(s,100);w.tick(resumed,100);assert.deepEqual(s,resumed);
 assert.equal(s.buildings.length,2);assert.equal(w.constructionStatus(s),null);assert.equal(Object.values(s.reservationsById).filter(r=>!r.kind).length,0);
 assert.equal(s.stats.built,1);
});

test('paused construction does not finish and cancellation refunds unused reservation once',()=>{
 let s=joined();const before={...s.resources};s=startBuilding(s);s.speed=0;
 const paused=JSON.stringify(s);w.tick(s,200);assert.equal(JSON.stringify(s),paused);
 s=act(s,'cancelConstruction');assert.deepEqual(s.resources,before);assert.equal(s.buildings.length,1);
 assert.throws(()=>w.dispatchCommand(s,{name:'cancelConstruction'}),/没有营造/);
});

test('schema 5 fractional tick carry, belongings and identity survive explicit migration',()=>{
 const original=old.initial();old.tick(original,25.76);
 const before=JSON.stringify(original),s=w.validateSave(original);
 assert.equal(JSON.stringify(original),before);assert.equal(s.schemaVersion,6);assert.equal(s.worldTick,257);
 assert.ok(Math.abs(s.sim.carry-.06)<1e-9);assert.deepEqual(s.resources,original.resources);
 assert.equal(s.master.name,original.master.name);assert.equal(s.contentVersion,'legacy-ea-1.4.2');
 w.tick(s,.24);assert.equal(s.time,26);
});

test('fractional historical time keeps its simulation phase across a day boundary',()=>{
 const legacy=old.initial();old.tick(legacy,119.76);legacy.time+=.25;legacy.society.clock=legacy.time;
 const s=w.validateSave(legacy);assert.equal(s.time,legacy.time);w.validateSave(JSON.parse(JSON.stringify(s)));
 old.tick(legacy,.24);w.tick(s,.24);
 assert.equal(s.time,legacy.time);assert.deepEqual(s.resources,legacy.resources);assert.equal(s.community.day,legacy.community.day);assert.equal(s.economy.day,legacy.economy.day);
 assert.equal(s.master.wound,legacy.master.wound);w.validateSave(JSON.parse(JSON.stringify(s)));
});

test('completed real v5 fixture preserves its ending, rewards and existing responsibilities',async()=>{
 const raw=JSON.parse(await readFile(new URL('../qa/ea-reference-world.json',import.meta.url),'utf8'));
 const original=raw.state||raw;assert.equal(original.story.completed,true);
 const oldState=old.validateSave(original),s=w.validateSave(original);
 assert.deepEqual(s.story,oldState.story);assert.deepEqual(s.resources,oldState.resources);
 assert.deepEqual(s.claimed,oldState.claimed);assert.equal(s.schemaMigration.completedEndingPreserved,true);
 assert.equal(s.story.opening,undefined);assert.equal(s.disciples.length,oldState.disciples.length);
});

test('unknown schemas, ambiguous versions and corrupt references are rejected without mutation',()=>{
 const cases=[s=>{s.schemaVersion=7;},s=>{s.version=5;},s=>{s.homeMemberIds.push('person:missing');},s=>{s.worldTick=-1;},s=>{s.personsById['person:lu-zhiwei'].realm=999;},s=>{s.society.nextPersonId=1;},s=>{s.buildingsById['building:yunxiu:1'].instanceId='building:yunxiu:9';}];
 for(const mutate of cases){const s=JSON.parse(JSON.stringify(w.initial()));mutate(s);const before=JSON.stringify(s);assert.throws(()=>w.validateSave(s));assert.equal(JSON.stringify(s),before);}
});

test('real persistence preserves v5 raw primary, migrates only explicitly and reloads v6',async t=>{
 const storage=memoryStorage(),locks=memoryLocks(),namespace='qa:opening-v12:';
 const original=old.initial();old.tick(original,19.75);
 const raw=JSON.stringify({format:'xianfu-ea',formatVersion:1,slot:1,savedAt:1,dataVersion:5,gameVersion:'1.4.2-ea',revision:3,writerId:'old-writer',checkpoint:null,state:original});
 storage.setItem(slotKeys(1,namespace).primary,raw);
 const store=createEAPersistence({getStorage:()=>storage,locks,namespace,dataVersion:6,validate:w.validateSave,channelFactory:null});t.after(()=>store.close());
 const opened=await store.open(1);assert.equal(opened.status,'migration-available');assert.equal(storage.getItem(slotKeys(1,namespace).primary),raw);
 const migrated=await store.migrateLegacy(1,{source:'primary',confirmed:true});assert.equal(migrated.ok,true,migrated.message);
 assert.equal(migrated.state.schemaVersion,6);assert.ok(store.inspect(1).preserved.some(p=>p.valid));
 const envelope=JSON.parse(storage.getItem(slotKeys(1,namespace).primary));assert.equal(envelope.dataVersion,6);assert.equal(envelope.state.version,undefined);
 assert.equal(store.inspect(1).state.master.name,original.master.name);
});
