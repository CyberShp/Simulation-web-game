import test from 'node:test';import assert from 'node:assert/strict';
import {createExpeditionCompanionsScenario} from '../../fixtures/expedition-companions.mjs';
import {commandSect,advanceSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {advanceDiscipleExpeditions,discipleExpeditionsView} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {personLocalPathSR} from '../../../src/simulation/ea-sr-world.mjs';
const VALLEY='scene:valley';
const outings=f=>f.session.state.discipleExpeditions.journeys.filter(j=>f.travellerIds.includes(j.personId));
function step(f,n=1){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
function until(f,fn,max=4000){for(let n=0;n<max&&!fn();n++)step(f,n);assert(fn(),'bounded real world steps reach the endpoint');}
function open(f){const out=commandSect(f.session,{type:'disciple-expeditions',enabled:true,allowCompanions:true});assert(out.ok,out.error);return f;}

test('two nearby willing residents pay and travel separately, observe at distinct actual points and return each unused dose',()=>{
 const f=open(createExpeditionCompanionsScenario()),initial=f.session.state,keeperBody=initial.personsById[f.stayId].activityId;let maxOverlap=0,overlap=0;const entranceOverlaps=[];
 for(let n=0;n<3000;n++){step(f,n);const s=f.session.state,js=outings(f),ps=f.travellerIds.map(id=>s.personsById[id]);if(ps.every(p=>p.location?.kind==='local'&&p.location.sceneId===VALLEY)){const d=Math.hypot(ps[0].location.x-ps[1].location.x,ps[0].location.y-ps[1].location.y);overlap=d<1e-7?overlap+1:0;maxOverlap=Math.max(maxOverlap,overlap);if(d<1e-7)entranceOverlaps.push({point:{...ps[0].location},phases:js.map(j=>j.phase)});}if(js.length===2&&js.every(j=>j.phase==='returned'))break;}
 const s=f.session.state,js=outings(f);assert.equal(js.length,2);assert(js.every(j=>j.phase==='returned'));assert.equal(maxOverlap,0,JSON.stringify(entranceOverlaps));assert.equal(js[0].party.peerJourneyId,js[1].id);assert.equal(js[1].party.peerJourneyId,js[0].id);assert.equal(js[0].startedTick,js[1].startedTick);
 assert.notDeepEqual(js[0].scoutGoal,js[1].scoutGoal);assert.notDeepEqual(js[0].supplyGoal,js[1].supplyGoal);assert.notDeepEqual(js[0].deliveryGoal,js[1].deliveryGoal);
 for(const j of js){assert.deepEqual(j.cost,{food:2,energy:8});assert.equal(s.factsById[`fact:disciple:${j.id}:supply`].personId,j.personId);assert.equal(j.growth.experience,8);assert.equal(j.medicine.returned,1);assert.equal(j.medicine.use,undefined);const fact=s.factsById[`fact:disciple:${j.id}:exploration`];assert.equal(fact.observationTicks,60);assert.deepEqual(fact.position,{x:j.scoutGoal.x,y:j.scoutGoal.y});assert.equal(s.travelsById[`travel:disciple:${j.id}:valley`].participantIds[0],j.personId);assert.equal(s.travelsById[`travel:disciple:${j.id}:home`].participantIds[0],j.personId);}
 assert.equal(s.stockpilesById[f.sourceStockpileId].pills.heal,2);assert(keeperBody);const before=JSON.stringify(s);advanceDiscipleExpeditions(s);discipleExpeditionsView(s);assert.equal(JSON.stringify(s),before);validateSect(f.session);
});

test('both real contact bodies take injury before warnings; a single public dose is used only by its actual holder and the other recovers at home',()=>{
 const f=createExpeditionCompanionsScenario({condition:'contact-shortage'});step(f);let s=f.session.state,js=outings(f);assert(js.every(j=>j.encounter?.injury===10));assert(f.travellerIds.every(id=>s.personsById[id].wound===10));assert.equal(js.reduce((n,j)=>n+j.medicine.borrowed,0),1);
 until(f,()=>outings(f).every(j=>j.phase==='returned'));
 s=f.session.state;js=outings(f);const treated=js.find(j=>j.medicine.use?.status==='consumed'),untreated=js.find(j=>j!==treated);assert(treated);assert.equal(treated.medicine.use.progressTicks,20);assert.equal(treated.growth.wound,0);assert.equal(untreated.growth.wound,10);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.heal,0);assert.equal(js.reduce((n,j)=>n+(j.medicine.use?.status==='consumed'?1:0),0),1);assert(js.every(j=>j.growth.experience===0));assert(js.every(j=>j.partyWarning));
 assert(untreated.partySupport?.ticks>0);const uid=untreated.personId;until(f,()=>f.session.state.personsById[uid].wound<=5,1500);assert.equal(f.session.state.personsById[uid].mind.recovering,undefined);validateSect(f.session);
});

test('a configured mid-route separation waits finitely then walks each actual return trail without remote warning or an exploration award',()=>{
 const f=createExpeditionCompanionsScenario({condition:'contact-shortage'}),s=f.session.state,js=outings(f),foe=s.personsById['person:valley-shanxiao'];foe.location={kind:'local',sceneId:VALLEY,x:5,y:5};foe.position={kind:'scene',sceneId:VALLEY,x:5,y:5};
 // U-172 starts the isolated separation here; neither return nor its outcome is configured.
 const j=js.find(j=>j.personId===f.companionId),p=s.personsById[j.personId],point={x:22,y:35};p.location={kind:'local',sceneId:VALLEY,...point};p.position={kind:'scene',sceneId:VALLEY,...point};j.valleyTrail.push({...point});j.scoutPath=personLocalPathSR(s,p.personId,j.scoutGoal);assert(j.scoutPath);validateSect(f.session);
 const start=s.worldTick,positions=f.travellerIds.map(id=>structuredClone(s.personsById[id].position));for(let n=0;n<119;n++)step(f,n);assert.deepEqual(f.travellerIds.map(id=>f.session.state.personsById[id].position),positions);until(f,()=>outings(f).every(j=>j.partySeparated),10);
 assert(f.session.state.worldTick-start<=122);assert(outings(f).every(j=>!j.partyWarning&&!j.encounter));until(f,()=>outings(f).every(j=>j.phase==='returned'),3000);assert(outings(f).every(j=>j.growth.experience===0&&j.partySeparated));validateSect(f.session);
});
