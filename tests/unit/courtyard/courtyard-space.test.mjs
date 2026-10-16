import test from 'node:test';
import assert from 'node:assert/strict';
import {ART_WIDTH,ART_HEIGHT,toArt,toWorld,isArtWalkable,routeArt,REVIEW_POINTS} from '../../../apps/courtyard/courtyard-space.mjs';
import {createSectSession,commandSect,advanceSect,snapshotSect,viewSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {spatialAccess,spatialSlots,spatialTerrain,meterCanStand,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {COURTYARD_MASTER_TERRAIN_VERSION,COURTYARD_MASTER_TERRAIN_V1,COURTYARD_MASTER_FENCES,COURTYARD_MASTER_JAR} from '../../../src/simulation/ea-courtyard-master-terrain.mjs';

const close = (a,b,epsilon=1e-7) => assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function terrainSession(){const session=createSectSession();assert.equal(commandSect(session,{type:'enable-courtyard-terrain'}).ok,true);return session;}

test('explicit courtyard terrain activation preserves facts, active transport and saved routes',()=>{
  const session=createSectSession();
  assert.equal(session.state.spatial.courtyardTerrain,undefined,'historical callers keep their terrain');
  for(let i=0;i<300;i++)advanceSect(session,.1);
  assert.equal(session.state.activitiesById[session.state.master.activityId].kind,'sr-transport');
  const before=snapshotSect(session),result=commandSect(session,{type:'enable-courtyard-terrain'});
  assert.equal(result.ok,true,result.error);assert.equal(result.result.alreadyEnabled,false);
  assert.equal(session.state.spatial.courtyardTerrain.version,COURTYARD_MASTER_TERRAIN_VERSION);
  for(const key of ['worldTick','rngState','stockpilesById','activitiesById','workOrdersById','reservationsById','buildingsById'])assert.deepEqual(session.state[key],before.state[key],key);
  assert.deepEqual(session.control,before.control);assert.deepEqual(session.policy,before.policy);
  for(const person of viewSect(session).people){const old=viewSect(restoreSect(before)).people.find(p=>p.id===person.id);close(person.x,old.x);close(person.y,old.y);}
  const actor=session.state.master.scenic;assert.notDeepEqual(actor.path,before.state.personsById['person:master'].scenic.path);
  let previous=actor;for(const point of actor.path){assert.equal(meterSweep(session.state,previous,point).blocked,false);previous=point;}
  const saved=snapshotSect(session);assert.deepEqual(snapshotSect(restoreSect(saved)),saved);
  assert.equal(commandSect(session,{type:'enable-courtyard-terrain'}).result.alreadyEnabled,true);
  assert.deepEqual(snapshotSect(session),saved,'repeated adapter activation is a no-op');
  const seed=terrainSession();for(const p of viewSect(seed).people)if(p.resident)assert.ok(meterCanStand(seed.state,p));
  const legacySave=snapshotSect(seed);legacySave.state.spatial.courtyardTerrain.version=COURTYARD_MASTER_TERRAIN_V1;
  const legacy=restoreSect(legacySave),jarFoot=toWorld(617.4,757.4);
  assert.deepEqual(snapshotSect(legacy),legacySave,'version 1 loads under its original geometry');
  assert.equal(spatialTerrain(legacy.state).some(t=>t.id===COURTYARD_MASTER_JAR.id),false);
  assert.ok(meterCanStand(legacy.state,jarFoot));assert.equal(meterCanStand(seed.state,jarFoot),false);
  for(let i=0;i<517;i++)advanceSect(legacy,.1);
  assert.equal(legacy.state.worldTick,1163);assert.ok(legacy.state.master.scenic.path.length);
  const legacyFacts=snapshotSect(legacy);assert.equal(commandSect(legacy,{type:'enable-courtyard-terrain'}).ok,true);
  assert.equal(legacy.state.spatial.courtyardTerrain.version,COURTYARD_MASTER_TERRAIN_VERSION);
  assert.notDeepEqual(legacy.state.master.scenic.path,legacyFacts.state.personsById['person:master'].scenic.path,'an existing version 1 journey replans around the jar');
  let at=legacy.state.master.scenic;for(const point of at.path){assert.equal(meterSweep(legacy.state,at,point).blocked,false);at=point;}
  for(const key of ['worldTick','rngState','stockpilesById','activitiesById','workOrdersById','reservationsById','buildingsById'])assert.deepEqual(legacy.state[key],legacyFacts.state[key],`upgrade ${key}`);
  for(const p of viewSect(legacy).people){const old=viewSect(restoreSect(legacyFacts)).people.find(q=>q.id===p.id);close(p.x,old.x);close(p.y,old.y);}
  const oldAtJar=restoreSect(legacySave);Object.assign(oldAtJar.state.master.scenic,{...jarFoot,path:[],goal:null});
  const jarSave=snapshotSect(oldAtJar),loadedAtJar=restoreSect(jarSave);
  assert.deepEqual(snapshotSect(loadedAtJar),jarSave);
  assert.equal(commandSect(loadedAtJar,{type:'enable-courtyard-terrain'}).ok,false);
  assert.deepEqual(snapshotSect(loadedAtJar),jarSave,'a version 1 body at the jar keeps its original save when upgrade is refused');
  for(const change of [s=>s.spatial.courtyardTerrain.version='unknown',s=>s.spatial.courtyardTerrain.extra=true,s=>s.spatial.courtyardTerrain.activatedAtTick=s.worldTick+1]){
    const bad=snapshotSect(seed);change(bad.state);const untouched=structuredClone(bad);
    assert.throws(()=>restoreSect(bad));assert.equal(commandSect(bad,{type:'enable-courtyard-terrain'}).ok,false);assert.deepEqual(bad,untouched);
  }
  const blocked=createSectSession(),polygon=COURTYARD_MASTER_FENCES[20].polygon;
  Object.assign(blocked.state.master.scenic,{x:polygon[0][0],y:polygon[0][1],path:[]});
  const untouched=snapshotSect(blocked);assert.equal(commandSect(blocked,{type:'enable-courtyard-terrain'}).ok,false);assert.deepEqual(snapshotSect(blocked),untouched,'unsafe feet reject activation without relocating the body');
});

test('calibrated image anchors and reversible world coordinates',()=>{
  assert.equal(ART_WIDTH,1672);assert.equal(ART_HEIGHT,941);
  for(const [world,art] of [[{x:28,y:12.6},{x:680,y:407}],[{x:12,y:40},{x:230,y:750}],[{x:16,y:40},{x:650,y:750}],[{x:16,y:44},{x:580,y:810}],[{x:14,y:44.6},{x:450,y:820}]]){
    const p=toArt(world.x,world.y);close(p.x,art.x);close(p.y,art.y);
  }
  for(let y=-2;y<=100;y+=.83)for(let x=-2;x<=164;x+=1.17){const p=toArt(x,y),q=toWorld(p.x,p.y);close(x,q.x);close(y,q.y);}
  for(let y=0;y<=ART_HEIGHT;y+=19)for(let x=0;x<=ART_WIDTH;x+=23){const p=toWorld(x,y),q=toArt(p.x,p.y);close(x,q.x);close(y,q.y);}
  assert.equal(toArt(NaN,2),null);assert.equal(toWorld(3,Infinity),null);
});

test('first-screen paths stay on authored ground and preserve endpoints',()=>{
  for(const p of Object.values(REVIEW_POINTS))assert.ok(isArtWalkable(p.art.x,p.art.y));
  for(const end of ['farmDropoff','eastPath','westPath','southSteps','hallEntrance']){
    const start=REVIEW_POINTS.courtyard.art,target=REVIEW_POINTS[end].art,route=routeArt(start,target);
    assert.ok(route?.length,end);assert.deepEqual(route.at(-1),target);
    let before=start;
    for(const p of route){assert.ok(distance(before,p)<=18.00001);for(let t=0;t<=1;t+=.05)assert.ok(isArtWalkable(before.x+(p.x-before.x)*t,before.y+(p.y-before.y)*t),end);before=p;}
  }
  assert.equal(routeArt(REVIEW_POINTS.courtyard.art,{x:1100,y:260}),null);
  assert.equal(isArtWalkable(30,420),false);
  assert.equal(isArtWalkable(1590,860),false);
  assert.equal(isArtWalkable(1290,450),false);
  assert.equal(isArtWalkable(617.4,757.4),false,'the ceramic jar base is occupied');
});

function walk(session,worldTarget){
  const result=commandSect(session,{type:'move',...worldTarget});assert.equal(result.ok,true,result.error);
  let steps=0;
  while(session.state.master.scenic.path.length&&steps<250){
    advanceSect(session,.1);steps++;
    const actual=toArt(session.state.master.scenic.x,session.state.master.scenic.y);
    assert.ok(isArtWalkable(actual.x,actual.y),`official movement left image ground: ${JSON.stringify(actual)}`);
  }
  assert.ok(steps<250,'official movement did not finish');
  assert.ok(distance(session.state.master.scenic,worldTarget)<.13,`official destination differs: ${JSON.stringify(session.state.master.scenic)} vs ${JSON.stringify(worldTarget)}`);
}
function walkArtRoute(session,target){
  const master=session.state.master.scenic,start=toArt(master.x,master.y),route=routeArt(start,target);
  assert.ok(route?.length,`no art route from ${JSON.stringify(start)} to ${JSON.stringify(target)}`);
  for(const p of route){
    walk(session,toWorld(p.x,p.y));
    const actual=toArt(session.state.master.scenic.x,session.state.master.scenic.y);
    assert.ok(isArtWalkable(actual.x,actual.y),`official path left image ground: ${JSON.stringify(actual)}`);
  }
  return route.length;
}

test('official SIM reaches courtyard, field dropoff and east path through public moves',()=>{
  const session=terrainSession(),before=snapshotSect(session);
  const initial=toArt(session.state.master.scenic.x,session.state.master.scenic.y);
  assert.ok(isArtWalkable(initial.x,initial.y),`seed master outside visible ground: ${JSON.stringify(initial)}`);
  walkArtRoute(session,REVIEW_POINTS.courtyard.art);
  walkArtRoute(session,REVIEW_POINTS.farmDropoff.art);
  walkArtRoute(session,REVIEW_POINTS.courtyard.art);
  walkArtRoute(session,REVIEW_POINTS.eastPath.art);
  assert.equal(session.state.master.personId,before.state.personsById['person:master'].personId);
  assert.ok(session.state.worldTick>before.state.worldTick);
  assert.equal(session.state.spatial.extentVersion,before.state.spatial.extentVersion);
});

test('manual move releases indoor cultivation and returns through the official entrance',()=>{
  const session=terrainSession();
  for(let i=0;i<700;i++)advanceSect(session,.1);
  const actor=viewSect(session).people.find(p=>p.id==='person:master');
  assert.equal(actor.indoor,true);
  const activity=session.state.activitiesById[session.state.master.activityId];
  assert.equal(activity.kind,'facility');assert.equal(activity.action,'cultivate');
  const building=session.state.buildingsById[activity.targetId],entrance=spatialAccess(building);
  const before={tick:session.state.worldTick,x:actor.x,y:actor.y,xp:session.state.master.xp};
  const result=commandSect(session,{type:'move',...entrance});
  assert.equal(result.ok,true,result.error);
  assert.equal(session.control.mode,'manual');
  assert.equal(session.state.master.activityId,null);
  assert.equal(session.state.activitiesById[activity.id],undefined);
  assert.equal(session.state.reservationsById[activity.reservationId],undefined);
  assert.equal(session.state.worldTick,before.tick);
  assert.equal(session.state.master.xp,before.xp);
  close(session.state.master.scenic.x,before.x);close(session.state.master.scenic.y,before.y);
  let steps=0;
  while(session.state.master.scenic.path.length&&steps++<300)advanceSect(session,.1);
  assert.ok(steps<300,'master did not leave the building');
  close(session.state.master.scenic.x,entrance.x);close(session.state.master.scenic.y,entrance.y);
  assert.equal(viewSect(session).people.find(p=>p.id==='person:master').indoor,false);
  const art=toArt(entrance.x,entrance.y);assert.ok(isArtWalkable(art.x,art.y));
  walkArtRoute(session,REVIEW_POINTS.courtyard.art);
  close(session.state.master.scenic.x,REVIEW_POINTS.courtyard.world.x);
  close(session.state.master.scenic.y,REVIEW_POINTS.courtyard.world.y);
});

test('autonomous field approach follows the visible east entrance and work slots remain in soil',t=>{
  const session=terrainSession(),seen=new Set(),last=new Map();
  let sampleCount=0,maxWorldStep=0,maxArtStep=0,maxOrdinaryArtStep=0,maxInterpolatedStep=0;
  for(let i=0;i<700;i++){
    advanceSect(session,.1);
    for(const actor of viewSect(session).people){
      if(!actor.resident||actor.indoor){last.delete(actor.id);continue;}
      const previous=last.get(actor.id)||actor;last.set(actor.id,actor);
      const worldStep=distance(previous,actor),beforeArt=toArt(previous.x,previous.y),actorArt=toArt(actor.x,actor.y);
      let previousArt=beforeArt;
      for(let k=0;k<=10;k++){
        const fraction=k/10,world={x:previous.x+(actor.x-previous.x)*fraction,y:previous.y+(actor.y-previous.y)*fraction};
        const art=toArt(world.x,world.y),interpolatedStep=distance(previousArt,art);previousArt=art;
        if(world.x<16||world.x>22||world.y<28||world.y>40)continue;
        maxWorldStep=Math.max(maxWorldStep,worldStep);
        maxArtStep=Math.max(maxArtStep,distance(beforeArt,actorArt));
        if(worldStep<.4)maxOrdinaryArtStep=Math.max(maxOrdinaryArtStep,distance(beforeArt,actorArt));
        maxInterpolatedStep=Math.max(maxInterpolatedStep,interpolatedStep);
        const key=`${actor.id}:${world.x.toFixed(3)}:${world.y.toFixed(3)}`;
        if(seen.has(key))continue;seen.add(key);sampleCount++;
        assert.ok(isArtWalkable(art.x,art.y),`${actor.id} at ${session.state.worldTick}: ${JSON.stringify({world,art})}`);
        assert.ok(art.x>650&&art.x<755,'field approach must pass east of the lamp and fence');
      }
    }
  }
  assert.ok(sampleCount>100,'normal autonomous movement was not sampled');
  t.diagnostic(JSON.stringify({sampleCount,maxWorldStep,maxArtStep,maxOrdinaryArtStep,maxInterpolatedStep}));
  const farm=Object.values(session.state.buildingsById).find(b=>b.type==='farm'),slots=spatialSlots(farm,'work');
  assert.equal(slots.length,4);
  for(const slot of slots){
    const art=toArt(slot.position.x,slot.position.y);
    assert.ok(art.x>=290&&art.x<=550&&art.y>=755&&art.y<=805,'work station must remain inside the visible planted soil');
    assert.ok(isArtWalkable(art.x,art.y));
  }
  for(const y of [28,36,40,44])for(const x of [14,16,20,24]){
    const a=toArt(x,y-1e-6),b=toArt(x,y+1e-6);
    assert.ok(distance(a,b)<.01,'calibration rows must remain continuous');
  }
});

test('enabled terrain reaches the two occlusion points and field-side review point through public moves',()=>{
  const session=terrainSession();walkArtRoute(session,REVIEW_POINTS.courtyard.art);
  for(const point of [{x:615,y:600},{x:942,y:598},REVIEW_POINTS.farmDropoff.art]){
    walkArtRoute(session,point);walkArtRoute(session,REVIEW_POINTS.courtyard.art);
  }
  assert.equal(routeArt(REVIEW_POINTS.courtyard.art,{x:420,y:850}),null,'bamboo itself is not a movement target');
});

test('seventy autonomous seconds keep actual residents and remaining farm routes on visible ground',t=>{
  const session=terrainSession(),feet=new Set(),routeSamples=new Set(),jarFeet=new Set(),jarRoutes=new Set();
  const nearJar=p=>p.x>=570&&p.x<=680&&p.y>=735&&p.y<=800;
  for(let i=0;i<700;i++){
    advanceSect(session,.1);
    for(const actor of viewSect(session).people){
      if(!actor.resident||actor.indoor)continue;
      const art=toArt(actor.x,actor.y);
      if(art.y>=640){
        assert.ok(isArtWalkable(art.x,art.y),`actual ${actor.id} tick ${session.state.worldTick}: ${JSON.stringify(art)}`);
        feet.add(`${actor.id}:${actor.x.toFixed(4)}:${actor.y.toFixed(4)}`);
        if(nearJar(art))jarFeet.add(`${actor.id}:${art.x.toFixed(3)}:${art.y.toFixed(3)}`);
      }
      let previous=actor;
      for(const target of actor.path){
        assert.equal(meterSweep(session.state,previous,target).blocked,false);
        const steps=Math.max(1,Math.ceil(distance(previous,target)/.03));
        for(let j=0;j<=steps;j++){
          const fraction=j/steps,world={x:previous.x+(target.x-previous.x)*fraction,y:previous.y+(target.y-previous.y)*fraction},p=toArt(world.x,world.y);
          if(p.y<640)continue;
          assert.ok(isArtWalkable(p.x,p.y),`route ${actor.id} tick ${session.state.worldTick}: ${JSON.stringify({world,art:p})}`);
          routeSamples.add(`${world.x.toFixed(3)}:${world.y.toFixed(3)}`);
          if(nearJar(p))jarRoutes.add(`${world.x.toFixed(3)}:${world.y.toFixed(3)}`);
        }
        previous=target;
      }
    }
    if(i===350){const saved=snapshotSect(session);Object.assign(session,restoreSect(saved));assert.deepEqual(snapshotSect(session),saved);}
  }
  assert.ok(feet.size>=80);assert.ok(routeSamples.size>500);
  assert.ok(jarFeet.size>=5);assert.ok(jarRoutes.size>=20);
  t.diagnostic(JSON.stringify({actualFenceFeet:feet.size,remainingRouteSamples:routeSamples.size,actualJarFeet:jarFeet.size,jarRouteSamples:jarRoutes.size,tick:session.state.worldTick}));
});
